/*
 * 混沌迫近（ルーミングカオス）、潛地式波動炮、磔殺、雲散（P3 華容道）
 *
 * 混沌迫近（王）：+cast 全員眩暈 2 秒並換位（同職能互換；內場格子的站立計時不重置）。
 *   換位規律（docs）：外場離王近的 3 人和另一側近的 3 人互換；外場遠的 3 人和內場「較遠一角」互換
 *   （北端或南端隨機）；沒和外場換的兩個內場角落彼此互換。
 *   模擬器：外場近 3 人＝D2、D3、D4，遠 3 人＝MT、H2、D1（攻略：外場的坦克＋補師＋DPS 進內場）；
 *   換位後改坐對方的座位（之後所有站位都照新座位）。
 * 潛地式（王）：台詞「你逃得掉嗎？」。內場每個角落點 1 人，在他身後連放 16 次圓形（落在 lag 秒前的位置）。
 *   處理（攻略）：被點者從角落格出發，沿井字外圈順時針跑一圈回來；其他人進凸出格讓路。
 * 磔殺（小王）：對外場 MT 的圓形死刑；其他人離開。
 * 雲散（小王）：小王消失（不判定）。
 * 估計值：見 tuning.ts P3.swap／P3.dive／P3.impale／P3.vanish。
 */
import { P3, TELE_SHOW } from '../../core/tuning';
import { roleType, type Alliance, type Role, type Vec } from '../../core/constants';
import { cellAt, cellUnder, center, rel, zoneE, roleE, homeE, seatOf, zoneOf, CORNERS, cornerOfCell, type Cell, type Side } from '../../core/p2';
import { dist } from '../../core/geometry';
import { hitCircle } from '../../core/hit';
import { at, setCast, alertMsg, say, seqAdd, variant, type Entity, type GameState } from '../../game/state';
import { good } from '../../game/results';
import { isBot } from '../../game/bots';
import { entIndex } from '../../game/p2state';
import { p2Goto } from '../../game/p2nav';
import { cornerMembers, rearrange } from '../../game/p3plan';
import { failE, busy, allSettle, SIDES, outers } from './common';

type Seat = { al: Alliance; role: Role };
const seatKey = (s: Seat): string => `${s.al}-${s.role}`;
const ZONE_NAME = (s: Seat): string => { const z = zoneOf(s.al, s.role); return z === 'in' ? '內場' : z < 0 ? '西平臺' : '東平臺'; };

/** 內場角落的座位（依職能類型：坦克、補師、DPS） */
const CORNER_SEATS: Seat[][] = [
  [{ al: 'A', role: 'ST' }, { al: 'A', role: 'H1' }, { al: 'B', role: 'D1' }],
  [{ al: 'C', role: 'ST' }, { al: 'C', role: 'H1' }, { al: 'B', role: 'D2' }],
  [{ al: 'B', role: 'MT' }, { al: 'B', role: 'H1' }, { al: 'B', role: 'D3' }],
  [{ al: 'B', role: 'ST' }, { al: 'B', role: 'H2' }, { al: 'B', role: 'D4' }],
];
const FAR: Role[] = ['MT', 'H2', 'D1'];
const NEAR: Role[] = ['D2', 'D3', 'D4'];
const byType = (seats: Seat[], r: Role): Seat => seats.find((s) => roleType(s.role) === roleType(r))!;

/** 換位的配對（座位對座位） */
function swapPairs(north: boolean): [Seat, Seat][] {
  const pairs: [Seat, Seat][] = NEAR.map((r) => [{ al: 'A', role: r }, { al: 'C', role: r }]);
  const wk = north ? 0 : 2, ek = north ? 1 : 3;
  FAR.forEach((r) => {
    pairs.push([{ al: 'A', role: r }, byType(CORNER_SEATS[wk], r)]);
    pairs.push([{ al: 'C', role: r }, byType(CORNER_SEATS[ek], r)]);
  });
  const [x, y] = north ? [2, 3] : [0, 1];
  CORNER_SEATS[x].forEach((s) => pairs.push([s, byType(CORNER_SEATS[y], s.role)]));
  return pairs;
}

export function swap(G: GameState, t0: number): number {
  const tag = '混沌迫近';
  seqAdd(G, t0, '混沌迫近（換位）');
  const tR = t0 + P3.swap.cast;
  const north = variant(G, 'swap', G.rng.chance(0.5) ? 'north' : 'south') === 'north';
  at(G, t0, () => {
    setCast(G, '混沌迫近', P3.swap.cast, `換位：外場遠的 3 人和內場${north ? '北' : '南'}端角落互換、外場近的 3 人東西互換；換位後坦克記得挑釁`);
    busy(G, tR + 3);
  });
  at(G, tR, () => {
    const s = G.p2!;
    const holder = new Map<string, Entity>();
    G.ents.forEach((e) => holder.set(seatKey(seatOf(e)), e));
    const before = new Map(G.ents.map((e) => [e, seatOf(e)]));
    swapPairs(north).forEach(([a, b]) => {
      const ea = holder.get(seatKey(a)), eb = holder.get(seatKey(b));
      if (!ea || !eb || ea.dead || eb.dead) return;
      ea.seat = b; eb.seat = a;
    });
    // 瞬間換位：站到新座位；內場格子的站立計時不重置（換成新的人繼續算）
    const stands = new Map<number, number>();
    G.ents.forEach((e) => { const c = cellUnder(e); if (c && !e.dead) stands.set(entIndex(G, e), s.cells[c.idx].stand); });
    G.ents.forEach((e) => {
      if (e.dead) return;
      const h = homeE(e);
      Object.assign(e, { x: h.x, y: h.y, px: h.x, py: h.y, mt: { ...h }, ov: null, nav: undefined, faceLock: null, forced: null });
      e.p2r = undefined;
      e.stun = G.t + P3.swap.stun; e.stunKind = 'stun';
    });
    G.ents.forEach((e) => {
      const c = cellUnder(e);
      if (!c || e.dead) return;
      const old = G.ents.find((o) => seatKey(before.get(o)!) === seatKey(seatOf(e)));
      const cs = s.cells[c.idx];
      cs.who = entIndex(G, e);
      cs.stand = old ? stands.get(entIndex(G, old)) ?? cs.stand : cs.stand;
    });
    G.fx.push({ k: 'flash', until: G.t + 0.4 });
    const P = G.player;
    const moved = seatKey(before.get(P)!) !== seatKey(seatOf(P));
    alertMsg(G, moved ? `換位：你被換到${ZONE_NAME(seatOf(P))}（${seatKey(seatOf(P))} 的位置）` : '換位：你留在原地', 3, true);
    if (!P.dead) good(G, tag, moved ? `換到${ZONE_NAME(seatOf(P))}` : '沒有換位');
  });
  return tR + P3.swap.stun;
}

/** 井字外圈的四個角落格，順時針（西北 → 東北 → 東南 → 西南） */
const LOOP = [0, 1, 3, 2];

export function dive(G: GameState, t0: number): number {
  const tag = '潛地式波動炮';
  seqAdd(G, t0, '潛地式波動炮');
  const tS = t0 + P3.dive.cast;
  const fires = Array.from({ length: P3.dive.n }, (_, k) => tS + 0.6 + k * P3.dive.gap);
  const end = fires[fires.length - 1];
  const targets: Entity[] = [];
  at(G, t0, () => {
    setCast(G, '潛地式波動炮', P3.dive.cast, '內場每角點 1 人：被點的人從角落格順時針跑一圈；其他人進凸出格讓路');
    say(G, '你逃得掉嗎？', 3);
    busy(G, end + 3);
  });
  at(G, t0 + 0.8, () => {
    for (let k = 0; k < 4; k++) {
      const m = cornerMembers(G, k);
      if (!m.length) continue;
      const tg = G.rng.pickOne(m);
      targets.push(tg);
      tg.mark = { kind: 'dive', until: end };
      const [ci, cj] = CORNERS[k];
      const prot = [cellAt(ci, cj === 1 ? 0 : 7)!, cellAt(ci === 1 ? 0 : 7, cj)!];
      const others = m.filter((e) => e !== tg);
      // 讓路的人：分到兩個凸出格（離得近的先選）
      const goals = new Map<Entity, Cell>([[tg, cellAt(ci, cj)!]]);
      const d0 = (e: Entity, c: Cell): number => dist(e, center(c));
      if (others.length === 2 && d0(others[0], prot[0]) + d0(others[1], prot[1]) > d0(others[0], prot[1]) + d0(others[1], prot[0])) prot.reverse();
      others.forEach((e, i) => goals.set(e, prot[i]));
      rearrange(G, k, goals, G.t, tS);
      const P = G.player;
      if (G.cfg.hint && !G.auto && goals.has(P)) G.hints = [{ ...center(goals.get(P)!), r: 1.2, label: P === tg ? '到角落格準備跑' : '進凸出格讓路' }];
    }
    if (targets.includes(G.player)) alertMsg(G, '你被潛地式點名：順時針跑一圈', 2.5, true);
  });
  // 被點的人沿外圈順時針跑：到一個角落格就換下一個；最後一段（回到起點角落）攻略是「回定點」：
  // 自己的定點在最後一段路上（例如角落格南邊那格）就直接停在定點，不跑過頭再折返
  at(G, tS, () => {
    G.hints = [];
    targets.forEach((tg) => {
      if (!isBot(G, tg)) return;
      const home = homeE(tg), homeCell = cellUnder(home)!;
      const k0 = LOOP.indexOf(cornerOfCell(homeCell));
      const cornerAt = (s: number): Cell => { const [i, j] = CORNERS[LOOP[(k0 + s) % 4]]; return cellAt(i, j)!; };
      // 最後一段：從前一個角落到起點角落，定點在這條路上（同一行／列、在兩個角落之間）
      const from = cornerAt(3), to = cornerAt(4);
      const between = (a: number, b: number, x: number): boolean => x >= Math.min(a, b) && x <= Math.max(a, b);
      const homeOnLast = (homeCell.i === to.i && from.i === to.i && between(from.j, to.j, homeCell.j))
        || (homeCell.j === to.j && from.j === to.j && between(from.i, to.i, homeCell.i));
      const target = (s: number): Vec => (s === 4 && homeOnLast ? home : center(cornerAt(s)));
      let step = 1, sent = 0;
      const go = (): void => {
        if (tg.dead || step > 4 || !G.p2) return;
        if (dist(tg, target(step)) < 0.3) step++;
        // 目標換了才重新下指令（每次下指令都會重算路，太頻繁會一直退回格子中央）
        if (step <= 4 && sent !== step) { p2Goto(G, tg, target(step)); sent = step; }
        tg.buffs.sprint = G.t + 2;
        at(G, G.t + 0.15, go);
      };
      go();
    });
    const P = G.player;
    if (targets.includes(P) && G.cfg.hint && !G.auto) alertMsg(G, '順時針跑一圈回到角落格', 2);
  });
  // 追擊：落在 lag 秒前的位置
  fires.forEach((tf, i) => {
    const spots = new Map<Entity, Vec>();
    at(G, tf - P3.dive.lag, () => targets.forEach((tg) => {
      if (tg.dead) return;
      spots.set(tg, { x: tg.x, y: tg.y });
      G.tele.push({ k: 'circle', x: tg.x, y: tg.y, r: P3.dive.r, until: tf });
    }));
    at(G, tf, () => spots.forEach((p) => G.ents.forEach((e) => {
      if (e.dead || !hitCircle(e, p, P3.dive.r)) return;
      failE(G, e, tag, `第 ${i + 1} 發追擊打中`, { ...homeE(e), r: 1, label: targets.includes(e) ? '一直跑，不要停' : '進凸出格讓路' });
    })));
  });
  at(G, end + 0.1, () => {
    targets.forEach((tg) => { tg.mark = undefined; });
    const P = G.player;
    if (zoneE(P) === 'in' && !P.dead && !G.fails.some((f) => f.startsWith(tag))) good(G, tag, targets.includes(P) ? '跑完一圈，追擊都沒打中' : '讓路成功，沒被追擊打中');
  });
  allSettle(G, end + 0.4);
  return end;
}

/** 磔殺：小王對外場 MT 的圓形死刑 */
export function impale(G: GameState, t0: number): number {
  const tag = '磔殺';
  seqAdd(G, t0, '磔殺（小王，坦克死刑）');
  const tR = t0 + P3.impale.cast;
  const tank = (side: Side): Entity | undefined => outers(G, side).find((e) => roleE(e) === 'MT');
  const BACK: [number, number][] = [[-2.5, -3], [-2.5, 0], [-2.5, 3], [-4, -1.5], [-4, 1.5]];
  at(G, t0, () => {
    setCast(G, '磔殺', P3.impale.cast, '外場 MT 到平臺前緣吃死刑，其他人往內側退開');
    SIDES.forEach((side) => {
      const tk = tank(side);
      outers(G, side).forEach((e) => {
        if (!isBot(G, e)) return;
        e.mt = e === tk ? rel(side, 4.2, 0) : rel(side, ...BACK[outers(G, side).filter((o) => o !== tk).indexOf(e) % 5]);
      });
      if (tk) tk.mark = { kind: 'impale', until: tR };
    });
  });
  at(G, tR - TELE_SHOW, () => SIDES.forEach((side) => { const tk = tank(side); if (tk && G.cfg.tele) G.tele.push({ k: 'circle', x: tk.x, y: tk.y, r: P3.impale.r, until: tR }); }));
  at(G, tR, () => {
    SIDES.forEach((side) => {
      const tk = tank(side);
      if (!tk || tk.dead) return;
      tk.mark = undefined;
      const p = { x: tk.x, y: tk.y };
      G.ents.forEach((e) => { if (e !== tk && !e.dead && hitCircle(e, p, P3.impale.r)) failE(G, e, tag, '被坦克死刑波及', { ...rel(side, -2.5, 0), r: 1.5, label: '往平臺內側退開' }); });
    });
    const P = G.player;
    if (zoneE(P) !== 'in' && !P.dead && !G.fails.some((f) => f.startsWith(tag))) good(G, tag, roleE(P) === 'MT' ? '吃下死刑，沒波及隊友' : '躲開坦克死刑');
  });
  at(G, tR + 0.3, () => SIDES.forEach((side) => outers(G, side).forEach((e) => { if (isBot(G, e)) e.mt = homeE(e); })));
  return tR;
}

/** 雲散：小王消失 */
export function vanish(G: GameState, t0: number): number {
  seqAdd(G, t0, '雲散（小王消失）');
  at(G, t0, () => setCast(G, '雲散', P3.vanish.cast, '小王消失，把受到的傷害轉給王；內外場結界消失'));
  at(G, t0 + P3.vanish.cast, () => { G.p2!.vanished = true; alertMsg(G, '小王消失了', 2); });
  return t0 + P3.vanish.cast;
}

