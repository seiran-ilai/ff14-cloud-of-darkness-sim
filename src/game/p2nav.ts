// P2 內場 Bot 的格子導航與刷新：
// - 只沿格子中心走（不會斜切掉下去），要進下一格前先站到目前格中心，確認下一格沒人、沒被預約才進去。
// - 要停在某格（終點）時，如果那格還在別人要經過的路上，就等對方先過。
// - 平時站太久（隨機 20～32 秒）就到旁邊沒人的格子站一下再回來，刷新站立時間。
import { CELLS, cellUnder, cellsTouching, cellPath, neighbors, center, p2Home, type Cell } from '../core/p2';
import type { Vec } from '../core/constants';
import { cellGone, entIndex } from './p2state';
import { isBot } from './bots';
import type { Entity, GameState } from './state';

const AT_CENTER = 0.12;

/** 別人（活著的）判定圈有沒有碰到這格 */
function touchedByOthers(G: GameState, e: Entity, c: Cell): boolean {
  return G.ents.some((o) => o !== e && !o.dead && cellsTouching(o).includes(c));
}

function canEnter(G: GameState, e: Entity, c: Cell, final: boolean): boolean {
  const s = G.p2!, cs = s.cells[c.idx], me = entIndex(G, e);
  if (cs.goneUntil !== null || cs.doomAt !== null) return false;
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
  const p = cellPath(a, b, (c) => cellGone(G.p2!, c));
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
  const home = p2Home(e.al, e.role);
  const homeCell = cellUnder(home);
  if (!homeCell) return; // 外場
  const r = (e.p2r ??= { phase: 'idle', at: 0, cell: -1, threshold: G.rng.rnd(20, 32) });
  const cur = cellUnder(e);
  const atPoint = (p: Vec): boolean => Math.hypot(e.x - p.x, e.y - p.y) < 0.15;
  if (r.phase === 'idle') {
    if (G.t < s.busyUntil || !e.mt || !atPoint(home) || Math.hypot(e.mt.x - home.x, e.mt.y - home.y) > 0.01) return;
    if (!cur || s.cells[cur.idx].stand < r.threshold) return;
    // 優先不進交叉格（攻略：只是更新地板時不要進交叉口）
    const opts = neighbors(cur).filter((n) => canEnter(G, e, n, true)).sort((a, b) => Number(a.cross) - Number(b.cross));
    if (!opts.length) return;
    r.cell = opts[0].idx;
    r.phase = 'out';
    p2Goto(G, e, center(opts[0]), true);
  } else if (r.phase === 'out') {
    if (cur?.idx === r.cell && atPoint(center(CELLS[r.cell]))) { r.phase = 'wait'; r.at = G.t + 0.5; }
  } else if (r.phase === 'wait') {
    if (G.t >= r.at) { r.phase = 'back'; p2Goto(G, e, home, true); }
  } else if (atPoint(home)) {
    r.phase = 'idle';
    r.threshold = G.rng.rnd(20, 32);
  }
}
