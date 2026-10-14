/*
 * 種子彈 → 暗之荊棘 → 荊棘叢生，以及小王的暗之泛濫（可打斷）（P3 華容道）
 *
 * 種子彈（小王）：0 詠唱；+cast 點名：每個平臺 2 名外場＋每個內場角落 1 人（頭上紫色種子）；
 *   點名後 mark 秒在目標位置爆炸（判定前 2 秒鎖定位置、出預兆），打到別人算失誤，原地留下暗之荊棘。
 *   處理（攻略）：外場放在平臺的 3／9 點（以內周為 12 點＝平臺南北邊緣的中間），內場放在面向平臺的那兩格（直條中段）。
 *   暗之荊棘：佔用 1 格（算 1 人，放完要立刻離開那格）、站在荊棘裡受刺傷、兩個荊棘太近會大爆炸。
 *   模擬器：內場由離放置格最近的人負責（攻略的分配）；外場被點的 2 人照「9 點 ← MT H2 D1 D2 D3 D4 → 3 點」分配。
 * 荊棘叢生（小王）：0 詠唱；+cast 每個荊棘連線一人、內場南北各一對玩家互連，持續 18 秒，剩 5 秒時沒拉開就失誤。
 *   模擬器：荊棘直接連給小抄指定的拉線人（相對方向：H2 東北、D2 東南、D4 西北、D3 西南；
 *   西平臺＝H2／D2 往北、D3／D4 往南，東平臺左右相反），沿環狀地板拉；MT、D1 留在小王腳下；
 *   內場兩人各自跑到橫條的兩端（約 7 格）。
 * 小王暗之泛濫：可打斷的全場 AOE；外場 MT 用插言打斷（玩家是外場 MT 時要自己按）。
 * 估計值：見 tuning.ts P3.seed／P3.thorn／P3.sbDeluge。
 */
import { P2, P3, HIT, REACT } from '../../core/tuning';
import { cellAt, cellUnder, cellsTouching, neighbors, center, rel, zoneE, roleE, homeE, type Cell } from '../../core/p2';
import { dist } from '../../core/geometry';
import { hitCircle } from '../../core/hit';
import type { Vec } from '../../core/constants';
import { at, setCast, alertMsg, say, seqAdd, type Entity, type GameState } from '../../game/state';
import { good, bad } from '../../game/results';
import { isBot } from '../../game/bots';
import { entIndex } from '../../game/p2state';
import { cornerMembers, rearrange } from '../../game/p3plan';
import { p2Goto } from '../../game/p2nav';
import { failE, busy, allSettle, SIDES, outers, ringWalk, outerGo } from './common';

/** 原位在外場荊棘上、暫時讓開的人（荊棘叢生結束、荊棘消失時恢復） */
const thornShifted = new Set<Entity>();

/** 內場各角落放種子的格子：面向平臺的直條中段 */
const SEED_CELL = [[1, 3], [6, 3], [1, 4], [6, 4]] as const;
const seedCell = (k: number): Cell => cellAt(SEED_CELL[k][0], SEED_CELL[k][1])!;

/**
 * 外場種子落點（相對座標 f, r）：平臺南北邊緣的中間。攻略以內周為 12 點：9 點＝相對東（r > 0）、3 點＝相對西；
 * 兩個被點的人照優先順序「9 點 ← MT H2 D1 D2 D3 D4 → 3 點」，順序在前的放 9 點。
 */
const SEED_OUT: [number, number][] = [[0, 4.5], [0, -4.5]];
const SEED_ORDER = ['MT', 'H2', 'D1', 'D2', 'D3', 'D4'];
const OTHER_OUT: [number, number][] = [[3.5, -1.2], [3.5, 1.2], [1.5, -1.2], [1.5, 1.2]];

export function seeds(G: GameState, t0: number): number {
  const tag = '種子彈';
  seqAdd(G, t0, '種子彈（小王）');
  const tM = t0 + P3.seed.cast, tLock = tM + P3.seed.mark - 2, tR = tM + P3.seed.mark;
  const targets: Entity[] = [];
  const spot = new Map<Entity, Vec>();
  at(G, t0, () => { setCast(G, '種子彈', P3.seed.cast, '外場：被點的人放平臺 3／9 點；內場：放面向平臺的直條中段，放完立刻離開那格'); busy(G, tR + 3); });
  at(G, tM, () => {
    SIDES.forEach((side) => {
      const outs = outers(G, side), picked = G.rng.shuffle(outs).slice(0, 2);
      picked.sort((a, b) => SEED_ORDER.indexOf(roleE(a)) - SEED_ORDER.indexOf(roleE(b)));
      picked.forEach((e, i) => { targets.push(e); spot.set(e, rel(side, ...SEED_OUT[i])); });
      outs.filter((e) => !picked.includes(e)).forEach((e, i) => spot.set(e, rel(side, ...OTHER_OUT[i % 4])));
    });
    for (let k = 0; k < 4; k++) {
      // 離放置格最近（照現在站的位置）的人負責
      const c = seedCell(k), m = cornerMembers(G, k).sort((a, b) => dist(a, center(c)) - dist(b, center(c)));
      if (!m.length) continue;
      targets.push(m[0]);
      spot.set(m[0], center(c));
      rearrange(G, k, new Map([[m[0], c]]), G.t, tLock);
    }
    targets.forEach((e) => { e.mark = { kind: 'seed', until: tR }; });
    G.ents.forEach((e) => { if (isBot(G, e) && !e.dead && zoneE(e) !== 'in' && spot.has(e)) { e.mt = spot.get(e)!; e.buffs.sprint = G.t + 4; } });
    const P = G.player;
    if (targets.includes(P)) alertMsg(G, '你被點了種子彈', 2, true);
    if (G.cfg.hint && !G.auto && spot.has(P)) G.hints = [{ ...spot.get(P)!, r: 1.2, label: targets.includes(P) ? '放種子' : '離開種子' }];
  });
  const locked = new Map<Entity, Vec>();
  at(G, tLock, () => targets.forEach((e) => {
    if (e.dead) return;
    locked.set(e, { x: e.x, y: e.y });
    G.tele.push({ k: 'circle', x: e.x, y: e.y, r: P3.seed.r, until: tR });
  }));
  at(G, tR, () => {
    G.hints = [];
    const s = G.p2!;
    const thorns = [...s.thorns];
    let mineOk = true;
    locked.forEach((p, owner) => {
      owner.mark = undefined;
      G.ents.forEach((e) => {
        if (e === owner || e.dead || !hitCircle(e, p, P3.seed.r)) return;
        if (e.isPlayer) mineOk = false;
        failE(G, e, tag, '被別人的種子彈打中', { ...(spot.get(e) ?? homeE(e)), r: 1.2, label: '離開種子' });
      });
      const c = cellUnder(p);
      thorns.push({ x: p.x, y: p.y, cell: c ? c.idx : -1, owner: entIndex(G, owner), since: G.t + P3.seed.grace });
    });
    // 荊棘太近：大爆炸
    for (let i = 0; i < thorns.length; i++) for (let j = i + 1; j < thorns.length; j++) {
      if (dist(thorns[i], thorns[j]) >= P3.seed.boom) continue;
      [thorns[i], thorns[j]].forEach((t) => { const o = G.ents[t.owner]; if (!o.dead) failE(G, o, tag, '荊棘放太近，一起大爆炸'); });
    }
    s.thorns = thorns;
    // 外場荊棘在平臺南北邊緣中間：原位剛好在荊棘上的人（例如 D3、D4）先往平臺外側讓 2.5 m
    // （往外讓：從平臺上其他位置直線走過去都不會經過荊棘），荊棘消失後再回原位
    G.ents.forEach((e) => {
      if (e.dead || zoneE(e) === 'in') return;
      const h = homeE(e);
      if (!thorns.some((t) => t.cell < 0 && dist(h, t) < P3.seed.thornR + HIT + 0.4)) return;
      e.seatHome = { x: h.x + Math.sign(h.x) * 2.5, y: h.y };
      thornShifted.add(e);
    });
    const P = G.player;
    if (locked.has(P) && !P.dead) good(G, tag, '放下種子，沒有打到人', { ...spot.get(P)!, r: 1.2, label: '放種子的位置' });
    else if (mineOk && !P.dead && spot.has(P)) good(G, tag, '沒被種子彈打中');
  });
  // 內場的主人立刻走回旁邊的座位（荊棘 1 秒後就佔格）；其他人之後再回座位
  at(G, tR + 0.02, () => locked.forEach((_p, o) => {
    if (!isBot(G, o) || o.dead) return;
    o.buffs.sprint = G.t + 2;
    if (zoneE(o) !== 'in') { o.mt = homeE(o); return; }
    // 內場：走到旁邊沒人的格子（荊棘 1 秒後佔格）
    const cur = cellUnder(o), free = cur ? neighbors(cur).find((n) => !G.p2!.thorns.some((t) => t.cell === n.idx) && !G.ents.some((x) => x !== o && !x.dead && cellsTouching(x).includes(n))) : undefined;
    p2Goto(G, o, free ? center(free) : homeE(o));
  }));
  allSettle(G, tR + 1.2);
  thornWatch(G, tR + P3.seed.grace, tR + 60);
  return tR;
}

/** 站在荊棘裡（刺傷）：每人只記一次 */
function thornWatch(G: GameState, from: number, until: number): void {
  const hurt = new Set<Entity>();
  for (let t = from; t < until; t += 0.5) {
    at(G, t, () => {
      if (!G.p2 || !G.p2.thorns.length) return;
      G.ents.forEach((e) => {
        if (e.dead || hurt.has(e)) return;
        if (G.p2!.thorns.some((th) => G.t >= th.since && hitCircle(e, th, P3.seed.thornR))) {
          hurt.add(e);
          failE(G, e, '暗之荊棘', '站在暗之荊棘裡（刺傷）');
        }
      });
    });
  }
}

/** 荊棘叢生的拉線點（以東、南為正）：外場荊棘拉到近的點、內場荊棘拉到遠的點 */
const PULL_PT: Record<'outer' | 'inner', Vec> = { outer: { x: 15, y: 20 }, inner: { x: 6, y: 24.3 } };

/**
 * 荊棘叢生的誘導站位（攻略圖，相對座標 f, r；r > 0＝相對東＝西平臺的北）：荊棘連線最近的人，
 * 所以詠唱時外場先站到自己要誘導的荊棘旁邊——H2 平臺外側偏北的角（平臺北邊的荊棘）、D2 平臺內側偏北（格子北邊的荊棘）、
 * D3 平臺內側偏南、D4 平臺外側偏南的角；MT、D1 在小王腳下。
 */
const LURE: Record<string, [number, number]> = {
  H2: [3.5, 4], D4: [3.5, -4], D2: [P2.px0 - P2.sbX + 1, 2.5], D3: [P2.px0 - P2.sbX + 1, -2.5], MT: [1, 0], D1: [-1, 0],
};

/** 內場連線的人要去的橫條末端格 */
const pairEnd = (e: Entity, west: boolean): Cell => cellAt(west ? 0 : 7, cellUnder(homeE(e))!.j <= 3 ? 1 : 6)!;

export function thornTether(G: GameState, t0: number): number {
  const tag = '荊棘叢生';
  seqAdd(G, t0, '荊棘叢生（小王）');
  const tL = t0 + P3.thorn.cast, tCheck = tL + P3.thorn.dur - P3.thorn.warnLeft;
  const pulls: { thorn: Vec; who: Entity; to: Vec }[] = [];
  const pairs: [Entity, Entity][] = [];
  // 詠唱時：外場先站到誘導位置（荊棘會連線最近的人）
  at(G, t0 + REACT, () => {
    SIDES.forEach((side) => outers(G, side).forEach((e) => {
      const l = LURE[roleE(e)];
      if (l && isBot(G, e) && !e.dead) outerGo(G, e, rel(side, ...l));
    }));
    const P = G.player, l = LURE[roleE(P)];
    if (l && zoneE(P) !== 'in' && G.cfg.hint && !G.auto) G.hints = [{ ...rel(zoneE(P) as -1 | 1, ...l), r: 1, label: roleE(P) === 'MT' || roleE(P) === 'D1' ? '留在小王腳下' : '站到要誘導的荊棘旁' }];
  });
  at(G, t0, () => {
    setCast(G, '荊棘叢生', P3.thorn.cast, '荊棘連線最近的人：外場先站到自己要誘導的荊棘旁（H2／D4 平臺外側角、D2／D3 平臺內側），連線後沿環狀地板拉遠；內場兩人各跑到橫條兩端');
    say(G, '生於黑暗之物正在操縱暗之植物……', 3);
    busy(G, tCheck + 2);
  });
  at(G, tL, () => {
    const s = G.p2!;
    SIDES.forEach((side) => {
      const mine = s.thorns.filter((t) => Math.sign(t.x) === side);
      // 小抄（イディル改，相對方向）：H2 相對東北、D2 相對東南、D4 相對西北、D3 相對西南。
      // 相對東 = 西平臺的北、東平臺的南（相對西相反）；每一半「外側（平臺上）的荊棘」給 H2／D4、「內側（格子上）的」給 D2／D3
      const roles = { relE: ['H2', 'D2'], relW: ['D4', 'D3'] };
      (['relE', 'relW'] as const).forEach((half) => {
        const ys = (half === 'relE' ? 1 : -1) * side;
        const th = mine.filter((t) => Math.sign(t.y || 0.01) === ys).sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
        th.forEach((t, i) => {
          const who = outers(G, side).find((e) => roleE(e) === roles[half][i]);
          if (!who) return;
          const p = PULL_PT[t.cell >= 0 ? 'inner' : 'outer'];
          pulls.push({ thorn: { x: t.x, y: t.y }, who, to: { x: side * p.x, y: ys * p.y } });
        });
      });
    });
    // 內場：北邊一對（西北＋東北）、南邊一對（西南＋東南）
    ([[0, 1], [2, 3]] as const).forEach(([a, b]) => {
      const ma = cornerMembers(G, a), mb = cornerMembers(G, b);
      if (!ma.length || !mb.length) return;
      const ea = G.rng.pickOne(ma), eb = G.rng.pickOne(mb);
      pairs.push([ea, eb]);
      rearrange(G, a, new Map([[ea, pairEnd(ea, true)]]), G.t + 0.3, tCheck);
      rearrange(G, b, new Map([[eb, pairEnd(eb, false)]]), G.t + 0.3, tCheck);
    });
    s.links = [
      ...pulls.map((p) => ({ x: p.thorn.x, y: p.thorn.y, a: entIndex(G, p.who), until: tCheck })),
      ...pairs.map(([a, b]) => ({ a: entIndex(G, a), b: entIndex(G, b), until: tCheck })),
    ];
    // 拉線：沿環狀地板拉（ringWalk 會自動經過平臺中線、平臺外緣，避開平臺南北邊緣中間的荊棘）
    pulls.forEach((p) => { if (isBot(G, p.who)) ringWalk(G, p.who, p.to, G.t + 0.3); });
    const P = G.player, myPull = pulls.find((p) => p.who === P), myPair = pairs.find((p) => p.includes(P));
    if (myPull || myPair) alertMsg(G, '你被荊棘叢生連線：拉遠', 2.2, true);
    if (G.cfg.hint && !G.auto) {
      if (myPull) G.hints = [{ ...myPull.to, r: 1.5, label: '沿環狀地板拉遠' }];
      if (myPair) G.hints = [{ ...center(pairEnd(P, myPair[0] === P)), r: 1.2, label: '跑到橫條末端' }];
    }
  });
  at(G, tCheck, () => {
    G.hints = [];
    const s = G.p2!;
    pulls.forEach((p) => {
      if (p.who.dead) return;
      const d = dist(p.who, p.thorn), fix = { ...p.to, r: 1.5, label: '沿環狀地板拉遠' };
      if (d < P3.thorn.pull) failE(G, p.who, tag, `沒拉斷荊棘（只拉開 ${d.toFixed(1)} m）`, fix);
      else if (p.who.isPlayer) good(G, tag, `拉斷荊棘（${d.toFixed(1)} m）`, fix);
    });
    pairs.forEach(([a, b]) => {
      if (a.dead || b.dead) return;
      const d = dist(a, b);
      [a, b].forEach((e) => {
        const fix = { ...center(pairEnd(e, e === a)), r: 1.2, label: '跑到橫條末端' };
        if (d < P3.thorn.pair) failE(G, e, tag, `內場連線沒拉斷（相距 ${d.toFixed(1)} m）`, fix);
        else if (e.isPlayer) good(G, tag, `內場連線拉斷（相距 ${d.toFixed(1)} m）`, fix);
      });
    });
    s.links = [];
    s.thorns = [];
    // 荊棘消失：讓開的人回原位
    thornShifted.forEach((e) => { e.seatHome = undefined; });
    thornShifted.clear();
  });
  allSettle(G, tCheck + 0.1);
  // 外場拉線的人沿環狀地板走回來
  at(G, tCheck + 0.2, () => pulls.forEach((p) => { if (isBot(G, p.who) && !p.who.dead) ringWalk(G, p.who, homeE(p.who), G.t); }));
  return tCheck;
}

/** 小王暗之泛濫：可打斷；外場 MT 插言 */
export function sbDeluge(G: GameState, t0: number): number {
  const tag = '小王暗之泛濫';
  seqAdd(G, t0, '暗之泛濫（小王，打斷）');
  const tR = t0 + P3.sbDeluge.cast;
  const P = G.player, mine = (): boolean => zoneE(P) !== 'in' && roleE(P) === 'MT' && !P.dead;
  at(G, t0, () => {
    setCast(G, '暗之泛濫（小王）', P3.sbDeluge.cast, '外場 MT 用插言打斷（技能列的插言）');
    if (mine()) alertMsg(G, '打斷小王的暗之泛濫（插言）', 2.5, true);
  });
  // 示範模式：Bot 代打的玩家自動插言
  at(G, t0 + 2, () => { if (G.auto && mine()) G.lastInterject = G.t; });
  at(G, tR, () => {
    if (!mine()) return;
    const li = G.lastInterject ?? -99;
    if (li >= t0 && li <= tR) good(G, tag, '用插言打斷了小王的暗之泛濫');
    else bad(G, tag, '沒有打斷小王的暗之泛濫（全場 AOE＋持續傷害）');
  });
  return tR;
}
