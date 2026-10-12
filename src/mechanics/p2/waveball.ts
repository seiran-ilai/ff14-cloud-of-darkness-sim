/*
 * 波動球（王）— 出塔
 * 時間點（相對 t0）：0 王開始詠唱；+cast 詠唱完成出塔；+cast+soak 判定。
 * 塔（docs）：內場四角各 1 座單人塔＋1 座雙人塔（雙人塔橫跨 2 格）；外場每個平臺 2 座三人塔，在小王的前後或左右。
 * 判定規則：判定圈碰到塔的格子就算踩到（使用者確認：碰到就算站在該格）；外場判定圈碰到塔圈。
 *   人數不足算失誤（docs：全場 AOE＋受傷加重）。內場塔的格子仍受格子規則限制（兩人同格會消失）。
 * 處理（攻略）：內場踩有紋路的格子、踩最近的塔；外場先處理完三重暗之戰技再踩：
 *   以場外為 12 點，12／9 點（前／左）由 MT/D1/D3 踩，6／3 點（後／右）由 H2/D2/D4 踩。
 * 估計值：詠唱 10 秒、出塔後 6 秒判定、外場塔半徑 2.5 m、離小王 3.5 m（見 tuning.ts WAVEBALL）。
 * TODO(確認): 內場塔在「四角的 5 格」：目前解讀為每個交叉格加上下左右 4 格的十字，雙人塔＝交叉格＋一個方向。
 */
import { WAVEBALL, TRIPLE } from '../../core/tuning';
import { hitCircle } from '../../core/hit';
import { CELLS, cellsTouching, crossCells, cellPath, cornerOfCell, cellUnder, center, rel, p2Home, zoneOf, type Cell, type Side } from '../../core/p2';
import type { Role, Vec } from '../../core/constants';
import { at, setCast, alertMsg, seqAdd, type Entity, type Fix, type GameState } from '../../game/state';
import { good, bad, botHit } from '../../game/results';
import { isBot } from '../../game/bots';
import { p2Goto } from '../../game/p2nav';
import type { InnerTower, OuterTower } from '../../game/p2state';

const GROUP1: Role[] = ['MT', 'D1', 'D3'];
const groupOf = (r: Role): 1 | 2 => (GROUP1.includes(r) ? 1 : 2);

/** 把一個角落的 3 個人分配到 3 個塔格：總路徑最短 */
function assignCorner(people: Entity[], cells: Cell[]): Map<Entity, Cell> {
  const perms = (a: Cell[]): Cell[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  let best: Cell[] = cells, bestCost = Infinity;
  for (const p of perms(cells)) {
    const cost = people.reduce((s, e, i) => s + (cellPath(cellUnder(p2Home(e.al, e.role))!, p[i])?.length ?? 99), 0);
    if (cost < bestCost) { bestCost = cost; best = p; }
  }
  return new Map(people.map((e, i) => [e, best[i]]));
}

/** 外場三人塔裡 3 個人的站位（沿塔的切線方向排，不會超出平臺） */
function outerSpot(t: OuterTower, role: Role, side: Side): Vec {
  const k = (groupOf(role) === 1 ? GROUP1 : (['H2', 'D2', 'D4'] as Role[])).indexOf(role) - 1;
  const alongY = Math.abs(t.y) < 0.1; // 前後的塔：沿 y 排；左右的塔：沿 x 排
  return alongY ? { x: t.x, y: t.y + k * 1.2 } : { x: t.x + side * k * 1.2, y: t.y };
}

export function waveball(G: GameState, t0: number, outerAfter: number): number {
  const tag = '波動球（踩塔）';
  seqAdd(G, t0, '波動球（出塔）');
  const tOn = t0 + WAVEBALL.cast, tRes = tOn + WAVEBALL.soak;
  const P = G.player, pz = zoneOf(P.al, P.role);
  const assign = new Map<Entity, Cell>();
  let outer: OuterTower[] = [];
  // 詠唱條先顯示小王的三重暗之戰技，結束後換成王的波動球剩餘時間
  at(G, t0 + TRIPLE.cast + 0.01, () => setCast(G, '波動球', tOn - G.t));
  at(G, tOn, () => {
    const s = G.p2!;
    alertMsg(G, '波動球：塔出現了', 2);
    // 內場：每個角落 1 座雙人塔（交叉格＋一個方向）＋1 座單人塔
    s.innerTowers = [];
    for (let k = 0; k < 4; k++) {
      const [c, ...arms] = crossCells(k);
      const pick = G.rng.shuffle(arms);
      s.innerTowers.push({ cells: [c.idx, pick[0].idx], need: 2 }, { cells: [pick[1].idx], need: 1 });
      const people = G.ents.filter((e) => zoneOf(e.al, e.role) === 'in' && cornerOfCell(cellUnder(p2Home(e.al, e.role))!) === k);
      assignCorner(people, [c, pick[0], pick[1]]).forEach((cell, e) => assign.set(e, cell));
    }
    // 外場：前後或左右
    outer = [];
    ([-1, 1] as Side[]).forEach((side) => {
      const fb = G.rng.chance(0.5), D = WAVEBALL.outerD;
      const p1 = fb ? rel(side, D, 0) : rel(side, 0, -D), p2 = fb ? rel(side, -D, 0) : rel(side, 0, D);
      outer.push({ ...p1, r: WAVEBALL.outerR, need: 3, side, group: 1 }, { ...p2, r: WAVEBALL.outerR, need: 3, side, group: 2 });
    });
    s.outerTowers = outer;
    s.busyUntil = tRes + 0.5;
    const mine = assign.get(P);
    if (mine && G.cfg.hint && !G.auto) G.hints = [{ ...center(mine), r: 1.4, label: '你的塔' }];
  });
  // 三重暗之戰技處理完才去踩（內場凸出格離小王近，太早動會被單手球打到）
  at(G, Math.max(tOn, outerAfter) + 0.05, () => {
    // 內場：同時把所有人的路算好，讓要經過的人先過
    G.ents.forEach((e) => { const c = assign.get(e); if (c && isBot(G, e) && !e.dead) p2Goto(G, e, center(c)); });
    G.ents.forEach((e) => {
      const z = zoneOf(e.al, e.role);
      if (z === 'in' || !isBot(G, e) || e.dead) return;
      e.mt = outerSpot(outer.find((t) => t.side === z && t.group === groupOf(e.role))!, e.role, z);
    });
    if (pz === 'in' && G.cfg.hint && !G.auto) G.hints = [{ ...center(assign.get(P)!), r: 1.4, label: '去踩你的塔' }];
    if (pz !== 'in' && G.cfg.hint && !G.auto) { const t = outer.find((o) => o.side === pz && o.group === groupOf(P.role))!; G.hints = [{ x: t.x, y: t.y, r: t.r, label: '你的塔' }]; }
  });
  at(G, tRes, () => {
    const s = G.p2!;
    G.hints = [];
    const onCells = (t: InnerTower): Entity[] => G.ents.filter((e) => !e.dead && cellsTouching(e).some((c) => t.cells.includes(c.idx)));
    const inOuter = (t: OuterTower): Entity[] => G.ents.filter((e) => !e.dead && hitCircle(e, t, t.r));
    // 內場
    s.innerTowers.forEach((t) => {
      const n = onCells(t).length;
      t.cells.forEach((i) => G.fx.push({ k: 'stack', x: CELLS[i].cx, y: CELLS[i].cy, r: 1.6, until: G.t + 0.6 }));
      if (n >= t.need) return;
      const owners = [...assign].filter(([, c]) => t.cells.includes(c.idx)).map(([e]) => e);
      owners.forEach((e) => { if (!e.isPlayer && !onCells(t).includes(e)) botHit(G, e, tag, '沒踩到內場塔'); });
    });
    // 外場
    outer.forEach((t) => {
      G.fx.push({ k: 'stack', x: t.x, y: t.y, r: t.r, until: G.t + 0.6 });
      const inside = inOuter(t);
      if (inside.length >= t.need) return;
      G.ents.forEach((e) => {
        if (!e.isPlayer && !e.dead && zoneOf(e.al, e.role) === t.side && groupOf(e.role) === t.group && !inside.includes(e)) botHit(G, e, tag, '沒踩到外場塔');
      });
    });
    const towers = s.innerTowers;
    s.innerTowers = [];
    s.outerTowers = [];
    // 玩家
    if (P.dead) return;
    if (pz === 'in') {
      const mine = assign.get(P)!;
      const fix: Fix = { ...center(mine), r: 1.4, label: '你的塔格' };
      const tower = towers.find((x) => x.cells.includes(mine.idx))!;
      const n = onCells(tower).length;
      if (!cellsTouching(P).includes(mine)) bad(G, tag, '沒踩到自己的內場塔（塔漏人會全場受傷加重）', fix);
      else if (n < tower.need) bad(G, tag, `${tower.need === 2 ? '雙人' : '單人'}塔只有 ${n} 人`, fix);
      else good(G, tag, `踩到自己的內場${tower.need === 2 ? '雙人' : '單人'}塔`, fix);
    } else {
      const t = outer.find((o) => o.side === pz && o.group === groupOf(P.role))!;
      const fix: Fix = { x: t.x, y: t.y, r: t.r, label: groupOf(P.role) === 1 ? '12／9 點的塔' : '6／3 點的塔' };
      const inside = inOuter(t);
      if (!inside.includes(P)) bad(G, tag, '沒踩到自己的外場塔', fix);
      else if (inside.length < t.need) bad(G, tag, `塔只有 ${inside.length} 人（需要 ${t.need} 人）`, fix);
      else good(G, tag, '踩到外場三人塔', fix);
    }
  });
  return tRes;
}
