/*
 * 三重暗之戰技（東西兩隻小王各自詠唱）
 * 時間點（相對 t0）：0 開始詠唱；詠唱中小王依序亮出三個球（第 k 個在 0.4 + k·show 秒，亮 showFor 秒），
 *   玩家要記住順序；詠唱結束後才依序放招：第 k 擊在 t0 + cast + k·gap 判定（放招時不會再亮球）。
 * 順序規則（攻略）：一定是「單手球 → 單手球／雙手球／黑霧 → 單手球／雙手球／黑霧」，3 次中一定有 2 次單手球。
 * 判定規則：
 *   單手球（L／R）：有球那側（小王的左／右）半場的半圓 halfR，能打到內場縱向格；
 *   雙手球（B）：離小王最近 3 人各一個 2 人分攤圓 pairR，人數不足或吃到 2 個都算失誤；
 *   黑霧（C）：離小王最近 6 人，從小王朝各自方向的直線，被別人的線打到算失誤。
 * 處理（イディル改，相對方向以場外為北）：分攤 MT＋H2（北）、D1＋D3（西）、D2＋D4（東），MT/D1/D2 站內側；
 *   散開 MT 北北西、H2 北北東、D1 西、D3 西北西、D2 東、D4 東北東，只在前側半場；
 *   內場 B 隊伍 H1/H2/D1/D2 站在格子內偏本體側。
 * 估計值：詠唱 5 秒、間隔 3 秒、半圓 15 m、分攤圓 2.2 m、直線寬 2 m（見 tuning.ts TRIPLE）。
 * TODO(確認): 兩隻小王的順序是否相同未知，目前各自隨機。
 */
import { TRIPLE, TELE_SHOW } from '../../core/tuning';
import { angOf, dist } from '../../core/geometry';
import { hitHalf, hitCircle, hitRect } from '../../core/hit';
import { rel, sbPos, sbFacing, zoneE, homeE, roleE, type Side } from '../../core/p2';
import type { Role, Vec } from '../../core/constants';
import { at, setCast, alertMsg, seqAdd, type Entity, type Fix, type GameState } from '../../game/state';
import { good, hurtPlayer, botHit } from '../../game/results';
import { isBot } from '../../game/bots';
import type { TripleKind } from '../../game/p2state';

const NAME: Record<TripleKind, string> = { L: '左手單手球（左半場）', R: '右手單手球（右半場）', B: '雙手球（2 人分攤）', C: '黑霧（直線散開）' };
const PAIR: Partial<Record<Role, Role>> = { H2: 'MT', D3: 'D1', D4: 'D2' };
/** 雙手球站位（相對 f, r） */
const PAIR_POS: Partial<Record<Role, [number, number]>> = { MT: [2.3, 0], H2: [4, 0], D1: [0, -2.3], D3: [0, -4], D2: [0, 2.3], D4: [0, 4] };
/** 黑霧站位：相對角度（0＝場外、正值往右） */
const SPREAD_A: Partial<Record<Role, number>> = { MT: -22.5, H2: 22.5, D1: -90, D3: -67.5, D2: 90, D4: 67.5 };
const SPREAD_R = 4.3;
/** 單手球：躲到沒球那半邊（r 乘上正負號） */
const SAFE_POS: Partial<Record<Role, [number, number]>> = { MT: [2.5, 2.2], H2: [2.5, 4], D1: [0, 2.2], D3: [0, 4], D2: [-2.5, 2.2], D4: [-2.5, 4] };

/** 某座位在這一擊該站的位置（外場） */
export function tripleSpot(side: Side, role: Role, kind: TripleKind): Vec {
  if (kind === 'B') { const [f, r] = PAIR_POS[role]!; return rel(side, f, r); }
  if (kind === 'C') { const a = (SPREAD_A[role]! * Math.PI) / 180; return rel(side, SPREAD_R * Math.cos(a), SPREAD_R * Math.sin(a)); }
  const [f, r] = SAFE_POS[role]!;
  return rel(side, f, kind === 'L' ? r : -r);
}

/** 三擊的順序（符合攻略規則） */
function sequence(G: GameState, noSniper: boolean): TripleKind[] {
  const one = (): TripleKind => (G.rng.chance(0.5) ? 'L' : 'R');
  // 潛地式時的三重暗之戰技（攻略：只有分攤）：第一擊照規則是單手球，之後兩擊都是雙手球
  if (noSniper) return [one(), 'B', 'B'];
  // 混沌迫近後不會用狙擊式（黑霧）
  const other: TripleKind = noSniper || G.rng.chance(0.5) ? 'B' : 'C';
  return G.rng.chance(0.5) ? [one(), one(), other] : [one(), other, one()];
}

/** 這一擊的攻擊範圍（給判定與預兆） */
interface Strike { kind: TripleKind; side: Side; targets: Entity[] }

const nearest = (G: GameState, p: Vec, n: number): Entity[] => G.ents.filter((e) => !e.dead).sort((a, b) => dist(a, p) - dist(b, p)).slice(0, n);
/** 半圓朝向：小王的左手邊或右手邊 */
const halfDir = (side: Side, kind: TripleKind): number => sbFacing(side) + (kind === 'L' ? -Math.PI / 2 : Math.PI / 2);

/** 回傳最後一擊的時間 */
export function triple(G: GameState, t0: number, noSniper = false): number {
  const tag = '三重暗之戰技';
  seqAdd(G, t0, '三重暗之戰技（小王）');
  const seqs: Record<string, TripleKind[]> = { '-1': sequence(G, noSniper), '1': sequence(G, noSniper) };
  const P = G.player;
  // 換位後玩家的區域會變：判定時才讀
  const pzOf = (): ReturnType<typeof zoneE> => zoneE(P);
  at(G, t0, () => { setCast(G, '三重暗之戰技', TRIPLE.cast, '記住小王依序亮的三個球！單手球→躲到沒球那半邊；雙手球→兩人分攤；黑霧→照相對方向散開'); });
  let last = t0;
  for (let k = 0; k < 3; k++) {
    const hit = t0 + TRIPLE.cast + k * TRIPLE.gap;
    last = hit;
    const strikes: Strike[] = [];
    // 詠唱中：依序亮出第 k 個球（要記住順序）
    const show = t0 + 0.4 + k * TRIPLE.show;
    at(G, show, () => ([-1, 1] as Side[]).forEach((side) => {
      const kind = seqs[side][k];
      G.p2!.sb[side < 0 ? 0 : 1].glow = kind;
      if (pzOf() === side) alertMsg(G, `第 ${k + 1} 個球：${NAME[kind]}（記住順序）`, TRIPLE.showFor, kind === 'B' || kind === 'C');
    }));
    at(G, show + TRIPLE.showFor, () => ([-1, 1] as Side[]).forEach((side) => { G.p2!.sb[side < 0 ? 0 : 1].glow = null; }));
    // 放招：不再亮球，照記住的順序處理（Bot 記得順序）
    at(G, hit - TRIPLE.tell, () => {
      ([-1, 1] as Side[]).forEach((side) => {
        const kind = seqs[side][k];
        if (pzOf() === side) alertMsg(G, `第 ${k + 1} 擊`, 1.5);
        G.ents.forEach((e) => { if (isBot(G, e) && !e.dead && zoneE(e) === side) e.mt = tripleSpot(side, roleE(e), kind); });
        if (pzOf() === side && G.cfg.hint && !G.auto) G.hints = [{ ...tripleSpot(side, roleE(P), kind), r: 1, label: `第 ${k + 1} 擊` }];
      });
    });
    at(G, hit - TELE_SHOW, () => ([-1, 1] as Side[]).forEach((side) => {
      const kind = seqs[side][k];
      if ((kind === 'L' || kind === 'R') && G.cfg.tele) { const c = sbPos(side); G.tele.push({ k: 'half', x: c.x, y: c.y, r: TRIPLE.halfR, a: halfDir(side, kind), until: hit }); }
    }));
    // 分攤與直線：判定前 1 秒鎖定目標並顯示預兆
    at(G, hit - 1, () => {
      strikes.length = 0;
      ([-1, 1] as Side[]).forEach((side) => {
        const kind = seqs[side][k], c = sbPos(side);
        const targets = kind === 'B' ? nearest(G, c, 3) : kind === 'C' ? nearest(G, c, 6) : [];
        strikes.push({ kind, side, targets });
        if (kind === 'B') targets.forEach((t) => G.tele.push({ k: 'circle', x: t.x, y: t.y, r: TRIPLE.pairR, until: hit }));
        if (kind === 'C') targets.forEach((t) => G.tele.push({ k: 'rect', O: c, H: angOf(t.x - c.x, t.y - c.y), len: TRIPLE.lineLen, w: TRIPLE.lineHalfW * 2, until: hit }));
      });
    });
    at(G, hit, () => {
      G.hints = [];
      strikes.forEach((s) => {
        resolve(G, s, tag, k, pzOf() === s.side);
      });
    });
  }
  return last;
}

function resolve(G: GameState, s: Strike, tag: string, k: number, mineSide: boolean): void {
  const c = sbPos(s.side), P = G.player;
  const fixFor = (e: Entity): Fix => (zoneE(e) === s.side
    ? { ...tripleSpot(s.side, roleE(e), s.kind), r: 1, label: NAME[s.kind] }
    : { ...homeE(e), r: 0.8, label: '格子內偏本體側' });
  const fail = (e: Entity, why: string): void => {
    if (e.isPlayer) hurtPlayer(G, tag, `第 ${k + 1} 擊 ${why}`, false, fixFor(e));
    else botHit(G, e, tag, `第 ${k + 1} 擊 ${why}`);
  };
  const failed = new Set<Entity>();
  const half = s.kind === 'L' || s.kind === 'R';
  if (half) {
    const a = halfDir(s.side, s.kind);
    G.ents.forEach((e) => { if (!e.dead && hitHalf(e, c, TRIPLE.halfR, a)) { failed.add(e); fail(e, '被單手球的半場打中'); } });
  } else if (s.kind === 'B') {
    const circles = s.targets.map((t) => ({ t, x: t.x, y: t.y }));
    circles.forEach((ci) => G.fx.push({ k: 'stack', x: ci.x, y: ci.y, r: TRIPLE.pairR, until: G.t + 0.6 }));
    G.ents.forEach((e) => {
      if (e.dead) return;
      const n = circles.filter((ci) => hitCircle(e, ci, TRIPLE.pairR)).length;
      if (n >= 2) { failed.add(e); fail(e, '吃到兩個分攤'); }
    });
    circles.forEach((ci) => {
      const inside = G.ents.filter((e) => !e.dead && hitCircle(e, ci, TRIPLE.pairR));
      if (inside.length >= 2 || failed.has(ci.t)) return;
      // 分攤人數不足：算在「該來分攤卻沒來的人」身上；找不到就算目標自己
      const partner = G.ents.find((e) => PAIR[roleE(e)] === roleE(ci.t) && zoneE(e) === s.side);
      const who = partner && !partner.dead ? partner : ci.t;
      failed.add(who);
      fail(who, who === ci.t ? '分攤人數不足' : '沒進分攤');
    });
  } else {
    const lines = s.targets.map((t) => ({ t, H: angOf(t.x - c.x, t.y - c.y) }));
    G.ents.forEach((e) => {
      if (e.dead) return;
      const n = lines.filter((l) => l.t !== e && hitRect(e, c, l.H, TRIPLE.lineLen, TRIPLE.lineHalfW * 2)).length;
      if (n) { failed.add(e); fail(e, '被別人的黑霧直線打到'); }
    });
  }
  if (mineSide && !P.dead && !failed.has(P)) good(G, tag, `第 ${k + 1} 擊 ${NAME[s.kind]}：處理正確`, fixFor(P));
  // 內場玩家在單手球那一側附近（半圓外 3 m 內）沒被打到：給一個成功紀錄
  if (half && !mineSide && zoneE(P) === 'in' && !P.dead && !failed.has(P)
    && hitHalf(P, c, TRIPLE.halfR + 3, halfDir(s.side, s.kind), 0)) {
    good(G, tag, `第 ${k + 1} 擊 ${s.side < 0 ? '西' : '東'}側單手球：站在格子內偏本體側，沒被打到`);
  }
}
