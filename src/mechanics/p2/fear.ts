/*
 * 恐懼之雲（P3 華容道，王）
 * 時間點（相對 t0）：0 詠唱，王身邊出現紫色環形暗雲（→ 環形 AOE）或方形暗雲（→ 十字 AOE）；+cast 判定。
 * 判定規則：被打中＝恐怖 6 秒（不能動，格子照樣計時）。
 *   環形：r0～r1 之間；內場站到靠王的格子（各條的中段），外場留在平臺外側。
 *   十字：南北、東西兩條直線；外場平臺幾乎整個在東西線上，要到環狀地板斜角迴避；內場離開中央那幾格。
 * 估計值：詠唱 5 秒、環形 12.5～21 m、十字半寬 4 m（見 tuning.ts P3.fear）。
 */
import { P3, HIT, TELE_SHOW } from '../../core/tuning';
import { cellUnder, cellPath, center, homeE, zoneE, roleE, rel, type Cell } from '../../core/p2';
import type { Vec } from '../../core/constants';
import { hitRing, hitLine } from '../../core/hit';
import { at, setCast, alertMsg, say, seqAdd, type Entity, type Fix, type GameState } from '../../game/state';
import { good } from '../../game/results';
import { isBot } from '../../game/bots';
import { cornerMembers, zoneCells, rearrange } from '../../game/p3plan';
import { failE, busy, allSettle, SIDES, outers, BOSS3, ringWalk } from './common';

export type FearKind = 'ring' | 'cross';
const NAME: Record<FearKind, string> = { ring: '環形', cross: '十字' };

const hitBy = (kind: FearKind, p: Vec, hb = HIT): boolean => (kind === 'ring'
  ? hitRing(p, BOSS3, P3.fear.r0, P3.fear.r1, hb)
  : hitLine(p, BOSS3, 0, P3.fear.crossHW, hb) || hitLine(p, BOSS3, Math.PI / 2, P3.fear.crossHW, hb));

/** 把一個角落的人分到安全格：總路徑最短（玩家也算進來，只是不會被搬） */
function assignSafe(G: GameState, k: number, safe: (c: Cell) => boolean): Map<Entity, Cell> {
  const people = cornerMembers(G, k);
  const cells = zoneCells(G, k).filter(safe);
  const cur = (e: Entity): Cell => cellUnder(e) ?? cellUnder(homeE(e))!;
  // 已經站在安全格的人不動
  if (people.every((e) => safe(cur(e)))) return new Map(people.map((e) => [e, cur(e)]));
  let best: Cell[] = [], bestCost = Infinity;
  const pick = (i: number, acc: Cell[]): void => {
    if (i === people.length) {
      const cost = people.reduce((s, e, j) => s + (cellPath(cur(e), acc[j])?.length ?? 99), 0);
      if (cost < bestCost) { bestCost = cost; best = acc.slice(); }
      return;
    }
    cells.forEach((c) => { if (!acc.includes(c)) { acc.push(c); pick(i + 1, acc); acc.pop(); } });
  };
  pick(0, []);
  return new Map(people.map((e, j) => [e, best[j] ?? cur(e)]));
}

/** 環形時外場的閃避點：平臺外側 */
const ringSpot = (side: -1 | 1, i: number): Vec => rel(side, 3, [-3, -1.5, 0, 1.5, 3, -4][i % 6]);

/** 十字時外場的閃避點：環狀地板的斜角（北 3 人、南 3 人） */
function crossSpot(e: Entity, side: -1 | 1): Vec {
  const north = ['MT', 'D1', 'D3'].includes(roleE(e));
  const k = { MT: 0, H2: 0, D1: 1, D2: 1, D3: 2, D4: 2 }[roleE(e) as 'MT'] ?? 0;
  const pts: [number, number][] = [[20.5, 12.5], [22.5, 11.5], [24.5, 10]];
  return { x: side * pts[k][0], y: (north ? -1 : 1) * pts[k][1] };
}

export function fear(G: GameState, t0: number, forced?: FearKind): number {
  const tag = '恐懼之雲';
  const kind: FearKind = forced ?? (G.rng.chance(0.5) ? 'ring' : 'cross');
  const tR = t0 + P3.fear.cast;
  seqAdd(G, t0, `恐懼之雲（${NAME[kind]}）`);
  const fixFor = (e: Entity): Fix => {
    if (zoneE(e) === 'in') return { ...homeE(e), r: 1.2, label: kind === 'ring' ? '站到靠王的格子（各條中段）' : '離開中央十字線上的格子' };
    return kind === 'ring' ? { ...rel(zoneE(e) as -1 | 1, 3, 0), r: 2, label: '到平臺外側' } : { ...crossSpot(e, zoneE(e) as -1 | 1), r: 1.5, label: '到環狀地板斜角' };
  };
  at(G, t0, () => {
    setCast(G, '恐懼之雲', P3.fear.cast, kind === 'ring'
      ? '王身邊環形暗雲 → 環形 AOE：內場站到靠王的格子，外場留在平臺外側'
      : '王身邊方形暗雲 → 十字 AOE：外場到環狀地板斜角，內場離開中央十字線');
    say(G, '暗雲帶來了恐懼……', 3);
    G.p2!.fear = { kind, until: tR };
    busy(G, tR + 1);
  });
  // Bot 反應後開始移動
  at(G, t0 + 0.8, () => {
    const safeCell = (c: Cell): boolean => !hitBy(kind, center(c), HIT + 0.3);
    for (let k = 0; k < 4; k++) {
      // Bot：任何安全格都行（用最少步數）；玩家的建議格用最短路徑分配
      const goals = assignSafe(G, k, safeCell);
      rearrange(G, k, (_e, c) => safeCell(c), G.t, tR - 0.2);
      const mine = goals.get(G.player);
      if (mine && G.cfg.hint && !G.auto) G.hints = [{ ...center(mine), r: 1.2, label: '躲恐懼之雲' }];
    }
    // 外場：十字到環狀地板斜角；環形到平臺外側（離王遠）
    SIDES.forEach((side) => outers(G, side).forEach((e, i) => {
      if (!isBot(G, e)) return;
      if (kind === 'cross') ringWalk(G, e, crossSpot(e, side), G.t);
      else { e.mt = ringSpot(side, i); e.buffs.sprint = G.t + 4; }
    }));
    if (kind === 'cross') {
      const P = G.player;
      if (zoneE(P) !== 'in' && G.cfg.hint && !G.auto) G.hints = [{ ...crossSpot(P, zoneE(P) as -1 | 1), r: 1.5, label: '環狀地板斜角' }];
    }
  });
  at(G, tR - TELE_SHOW, () => {
    if (!G.cfg.tele) return;
    if (kind === 'ring') G.tele.push({ k: 'ring', ...BOSS3, r0: P3.fear.r0, r1: P3.fear.r1, until: tR });
    else [0, Math.PI / 2].forEach((a) => G.tele.push({ k: 'line', ...BOSS3, a, hw: P3.fear.crossHW, until: tR }));
  });
  at(G, tR, () => {
    G.hints = [];
    G.p2!.fear = null;
    const P = G.player;
    let mine = false;
    G.ents.forEach((e) => {
      if (e.dead || !hitBy(kind, e)) return;
      if (e.isPlayer) mine = true;
      e.stun = G.t + P3.fear.stun; e.stunKind = 'stun';
      failE(G, e, tag, `被${NAME[kind]}恐懼之雲打中（恐怖 ${P3.fear.stun} 秒）`, fixFor(e));
    });
    if (!mine && !P.dead) good(G, tag, `躲開${NAME[kind]}恐懼之雲`, fixFor(P));
    if (mine) alertMsg(G, '恐怖：不能動', 2, true);
  });
  allSettle(G, tR + 0.4);
  return tR;
}

