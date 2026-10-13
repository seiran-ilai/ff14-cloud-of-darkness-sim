// P2 內場 Bot 的格子導航與刷新：
// - 只沿格子中心走（不會斜切掉下去），要進下一格前先站到目前格中心，確認下一格沒人、沒被預約才進去。
// - 要停在某格（終點）時，如果那格還在別人要經過的路上，就等對方先過。
// - 平時站太久（隨機 20～32 秒）就到旁邊沒人的格子站一下再回來，刷新站立時間。
import { CELLS, cellUnder, cellsTouching, cellPath, neighbors, center, homeE, type Cell } from '../core/p2';
import type { Vec } from '../core/constants';
import { cellGone, cellThorn, entIndex, p2Walkable } from './p2state';
import { P2 } from '../core/tuning';
import { isBot } from './bots';
import type { Entity, GameState } from './state';

const AT_CENTER = 0.12;
/** 機制進行中：站超過 FORCE 秒、附近安全就刷新；超過 LAST 秒不管怎樣都刷新（45 秒會消失） */
const FORCE_REFRESH = 37;
const LAST_REFRESH = 42;

/** 附近有沒有危險：圓形預兆、潛地式被點的人 */
function dangerNear(G: GameState, p: Vec): boolean {
  if (G.tele.some((t) => t.k === 'circle' && Math.hypot(t.x - p.x, t.y - p.y) < t.r + 3)) return true;
  return G.ents.some((o) => !o.dead && o.mark?.kind === 'dive' && Math.hypot(o.x - p.x, o.y - p.y) < 9);
}

/** 別人（活著的）判定圈有沒有碰到這格 */
function touchedByOthers(G: GameState, e: Entity, c: Cell): boolean {
  return G.ents.some((o) => o !== e && !o.dead && cellsTouching(o).includes(c));
}

function canEnter(G: GameState, e: Entity, c: Cell, final: boolean): boolean {
  const s = G.p2!, cs = s.cells[c.idx], me = entIndex(G, e);
  if (cs.goneUntil !== null || cs.doomAt !== null || cellThorn(s, c)) return false;
  if (touchedByOthers(G, e, c)) return false;
  const r = s.reserve.get(c.idx);
  if (r !== undefined && r !== me) return false;
  // 要停在這格：先讓還要經過這格的人過去
  if (final && G.ents.some((o) => o !== e && !o.dead && o.nav && o.nav.goal !== c.idx && o.nav.path.indexOf(c.idx) > 0)) return false;
  return true;
}

function plan(G: GameState, e: Entity, goal: Vec): void {
  const a = cellUnder(e), b = cellUnder(goal);
  if (!a || !b) { e.nav = undefined; return; }
  const p = cellPath(a, b, (c) => cellGone(G.p2!, c) || cellThorn(G.p2!, c));
  e.nav = p ? { goal: b.idx, path: p.map((c) => c.idx), next: null } : undefined;
}

/** 機制叫 Bot 去某個位置（內場會先算好路，讓其他 Bot 知道要讓路） */
export function p2Goto(G: GameState, e: Entity, goal: Vec, fromRefresh = false): void {
  e.mt = goal;
  if (!fromRefresh && e.p2r) e.p2r.phase = 'idle';
  plan(G, e, goal);
}

/** 模擬每步呼叫：回傳這一步 Bot 實際要走向的點 */
export function navTarget(G: GameState, e: Entity, tg: Vec): Vec {
  const cur = cellUnder(e);
  if (!cur) return tg; // 平臺、環狀地板：直接走
  const goal = cellUnder(tg);
  if (!goal) return { x: e.x, y: e.y }; // 不會從格子走下去
  if (goal === cur) { if (e.nav) e.nav.next = null; return tg; }
  if (!e.nav || e.nav.goal !== goal.idx || !e.nav.path.includes(cur.idx)) plan(G, e, tg);
  const nav = e.nav;
  if (!nav) return { x: e.x, y: e.y };
  const k = nav.path.indexOf(cur.idx);
  if (k > 0) nav.path.splice(0, k);
  if (nav.next === cur.idx) nav.next = null;
  const next = CELLS[nav.path[1]];
  if (nav.next === next.idx) return center(next);
  const c = center(cur);
  if (Math.hypot(e.x - c.x, e.y - c.y) > AT_CENTER) return c;
  if (canEnter(G, e, next, next.idx === nav.goal)) {
    nav.next = next.idx;
    G.p2!.reserve.set(next.idx, entIndex(G, e));
    return center(next);
  }
  return c;
}

/** 內場 Bot 平時刷新格子 */
export function p2Refresh(G: GameState, e: Entity): void {
  const s = G.p2!;
  if (!isBot(G, e) || e.dead) return;
  const home = homeE(e);
  const homeCell = cellUnder(home);
  if (!homeCell) return; // 外場
  const r = (e.p2r ??= { phase: 'idle', at: 0, cell: -1, threshold: G.rng.rnd(6, 12) });
  const cur = cellUnder(e);
  const atPoint = (p: Vec): boolean => Math.hypot(e.x - p.x, e.y - p.y) < 0.15;
  if (r.phase === 'idle') {
    // 機制進行中也要刷新：站了 SOFT_REFRESH 秒以上、附近沒有預兆就先跳一格；快 45 秒就不管了一定要跳。
    // 跳完回到原本的位置（不是座位）
    const stand = cur ? s.cells[cur.idx].stand : 0;
    const settled = (!e.nav || e.nav.next === null) && (!e.mt || cellUnder(e.mt) === cur);
    const hard = stand >= LAST_REFRESH, soft = stand >= FORCE_REFRESH && !dangerNear(G, e);
    const forced = !!cur && (hard || (settled && soft));
    if (!forced) {
      // 平時（沒有機制在進行）：站好、站夠久就刷新（不一定要在座位上，機制結束後原地待命）
      if (G.t < s.busyUntil || !settled || !e.mt || !atPoint(e.mt)) return;
      if (!cur || stand < r.threshold) return;
    }
    if (!cur) return;
    r.ret = e.mt ? { x: e.mt.x, y: e.mt.y } : undefined;
    // 優先不進交叉格（攻略：只是更新地板時不要進交叉口）；機制中避開有預兆的格子
    const opts = neighbors(cur).filter((n) => canEnter(G, e, n, true) && (hard || !dangerNear(G, center(n))))
      .sort((a, b) => Number(a.cross) - Number(b.cross));
    if (!opts.length) return;
    r.cell = opts[0].idx;
    r.phase = 'out';
    p2Goto(G, e, center(opts[0]), true);
  } else if (r.phase === 'out') {
    if (cur?.idx === r.cell && atPoint(center(CELLS[r.cell]))) { r.phase = 'wait'; r.at = G.t + 0.5; }
  } else if (r.phase === 'wait') {
    if (G.t >= r.at) { r.phase = 'back'; p2Goto(G, e, r.ret ?? home, true); }
  } else if (atPoint(r.ret ?? home)) {
    r.phase = 'idle';
    r.threshold = G.rng.rnd(6, 12);
  }
}

/**
 * 外場（平臺、環狀地板）Bot 的走法：直線會踩空（平臺和環之間、環和內場之間是空的）就沿著環狀地板繞過去。
 * 每步重算：先走到環上朝目標方向 0.3 弧度的點，直到可以直線走到目標。
 */
export function outerNav(G: GameState, e: Entity, tg: Vec): Vec {
  const s = G.p2!;
  const dx = tg.x - e.x, dy = tg.y - e.y, L = Math.hypot(dx, dy), n = Math.ceil(L / 0.2);
  // 路上每一點（含四周 0.35 m）都要踩得到地板，避免擦過平臺和環的轉角
  const m = 0.35;
  const safe = (x: number, y: number): boolean => [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].every(([ox, oy]) => p2Walkable(s, { x: x + ox, y: y + oy }));
  let ok = true;
  // 目標附近（最後 0.6 m）只要踩得到就好（目標可能本來就在平臺邊緣）
  for (let i = 1; i <= n && ok; i++) {
    const x = e.x + (dx * i) / n, y = e.y + (dy * i) / n;
    ok = L * (1 - i / n) < 0.6 ? p2Walkable(s, { x, y }) : safe(x, y);
  }
  if (ok) return tg;
  const R = (P2.ring0 + P2.ring1) / 2;
  const a0 = Math.atan2(e.y, e.x), r0 = Math.hypot(e.x, e.y);
  // 還沒站上環狀地板（在平臺內側）：先沿著同一個角度走到環上
  if (Math.abs(r0 - R) > 1) return { x: Math.cos(a0) * R, y: Math.sin(a0) * R };
  let d = Math.atan2(tg.y, tg.x) - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const a = a0 + Math.sign(d) * Math.min(Math.abs(d), 0.3);
  return { x: Math.cos(a) * R, y: Math.sin(a) * R };
}
