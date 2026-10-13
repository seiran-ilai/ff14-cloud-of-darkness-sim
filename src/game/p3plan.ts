// P3 華容道內場 Bot 的換格規劃（每格只能站 1 人，兩人碰到同一格 1 秒後就會消失）：
// - rearrange：把一個角落的 Bot 搬到指定格子。每一步只動一個人、只走進「目前沒人碰到」的相鄰格，
//   每步重新規劃（玩家當作會動的障礙物），所以不會擠格、不會互相卡死。
// - dodge：有時間表的危險格（迴旋式）：先算好每一擊前每個人要站哪一格，再照表一格一格走。
import { CELLS, cellUnder, cellsTouching, neighbors, center, cornerOfCell, homeE, zoneE, type Cell } from '../core/p2';
import { P3 } from '../core/tuning';
import { at, type Entity, type GameState } from './state';
import { isBot } from './bots';
import { cellGone, cellThorn } from './p2state';
import { p2Goto } from './p2nav';

/** 內場的人原本屬於哪個角落（西北 0、東北 1、西南 2、東南 3） */
export const homeCorner = (e: Entity): number => cornerOfCell(cellUnder(homeE(e))!);

/** 某個角落的內場成員（活著的） */
export const cornerMembers = (G: GameState, k: number): Entity[] =>
  G.ents.filter((e) => !e.dead && zoneE(e) === 'in' && homeCorner(e) === k);

/** 角落區裡能站的格子（沒消失、沒有荊棘） */
export const zoneCells = (G: GameState, k: number): Cell[] =>
  CELLS.filter((c) => cornerOfCell(c) === k && !cellGone(G.p2!, c) && !cellThorn(G.p2!, c));

/** 這些 Bot 以外的人碰到的格子（不能走進去） */
function blockedBy(G: GameState, bots: Entity[]): Set<number> {
  const b = new Set<number>();
  G.ents.forEach((o) => { if (!o.dead && !bots.includes(o)) cellsTouching(o).forEach((c) => b.add(c.idx)); });
  // 正在走的 Bot 碰到的另一格也先擋住
  bots.forEach((e) => { const cur = cellUnder(e); cellsTouching(e).forEach((c) => { if (c !== cur) b.add(c.idx); }); });
  return b;
}

/** 在 t0～until 之間，把角落 k 的 Bot 搬到 goals 指定的格子（沒指定的人可以被擠到任何格） */
/** goals：指定每個人的格子，或「這個人站這格可以嗎」（例如躲 AOE：任何安全格都行） */
export function rearrange(G: GameState, k: number, goals: Map<Entity, Cell> | ((e: Entity, c: Cell) => boolean), t0: number, until: number, onDone?: () => void): void {
  let tok = -1;
  const tick = (): void => {
    if (!G.p2) return;
    // 第一次執行時取得規劃編號；之後同一角落有新的規劃就停下
    if (tok < 0) tok = ++G.p2.plan[k];
    else if (G.p2.plan[k] !== tok) return;
    if (G.t > until || !G.p2) return;
    const bots = cornerMembers(G, k).filter((e) => isBot(G, e));
    const cur = bots.map((e) => cellUnder(e)?.idx ?? -1);
    const goal = goals instanceof Map ? bots.map((e) => goals.get(e)?.idx ?? -1) : [];
    const done = (s: number[]): boolean => (goals instanceof Map
      ? s.every((c, i) => goal[i] < 0 || c === goal[i])
      : s.every((c, i) => goals(bots[i], CELLS[c])));
    if (done(cur)) {
      // 到齊了：把每個人釘在現在的格子（取消進行中的刷新格子，免得剛好路過目標格就被算到齊又走掉）
      bots.forEach((e, i) => { const c = CELLS[cur[i]]; if (e.p2r?.phase !== 'idle' || !e.mt || cellUnder(e.mt) !== c) p2Goto(G, e, center(c)); });
      onDone?.();
      return;
    }
    if (cur.some((c) => c < 0)) { at(G, G.t + P3.stepDt / 2, tick); return; }
    const allowed = new Set(zoneCells(G, k).map((c) => c.idx));
    const blocked = blockedBy(G, bots);
    const key = (s: number[]): string => s.join(',');
    const prev = new Map<string, { from: string; who: number; to: number } | null>([[key(cur), null]]);
    const q = [cur];
    let found: number[] | null = null;
    while (q.length) {
      const s = q.shift()!;
      if (done(s)) { found = s; break; }
      for (let i = 0; i < s.length; i++) {
        for (const n of neighbors(CELLS[s[i]])) {
          if (!allowed.has(n.idx) || blocked.has(n.idx) || s.includes(n.idx)) continue;
          const ns = s.slice();
          ns[i] = n.idx;
          const kk = key(ns);
          if (prev.has(kk)) continue;
          prev.set(kk, { from: key(s), who: i, to: n.idx });
          q.push(ns);
        }
      }
    }
    if (found) {
      // 回推整條路，從頭取「互不影響」的幾步同時走：每人一步、不走進這一輪別人剛離開的格子
      const moves: { who: number; to: number; from: number }[] = [];
      let kk = key(found);
      for (let step = prev.get(kk); step; step = prev.get(kk)) {
        const fromState = step.from.split(',').map(Number);
        moves.unshift({ who: step.who, to: step.to, from: fromState[step.who] });
        kk = step.from;
      }
      const used = new Set<number>(), vacated = new Set<number>(), taken = new Set<number>();
      for (const m of moves) {
        if (used.has(m.who) || vacated.has(m.to) || taken.has(m.to)) break;
        used.add(m.who); vacated.add(m.from); taken.add(m.to);
        const e = bots[m.who];
        e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 2);
        p2Goto(G, e, center(CELLS[m.to]));
      }
    }
    at(G, G.t + P3.stepDt, tick);
  };
  at(G, t0, tick);
}

/** 把所有內場 Bot 搬回自己的座位，最後站到座位的精確位置（讓刷新格子接手） */
export function innerHome(G: GameState, t0: number, until: number): void {
  // 座位在執行時才讀（混沌迫近換位後座位會變）
  at(G, t0, () => {
    for (let k = 0; k < 4; k++) {
      const goals = new Map<Entity, Cell>();
      cornerMembers(G, k).forEach((e) => goals.set(e, cellUnder(homeE(e))!));
      rearrange(G, k, goals, G.t, until, () => cornerMembers(G, k).forEach((e) => { if (isBot(G, e)) p2Goto(G, e, homeE(e)); }));
    }
  });
}

/** 每一擊：時間、這一擊會打到哪些格子 */
export interface Hazard { t: number; hit: (c: Cell) => boolean }

/**
 * 迴旋式這類「每一擊打不同格子」：在 t0 算好角落 k 每個 Bot 每一擊前要站的格子並照表走。
 * 一擊之間每人最多走一格，而且只能走進上一擊時沒人的格子（不會擠格、不會互換）。
 * 回傳是否找到完全不被打到的走法（找不到就原地不動）。
 */
export function dodge(G: GameState, k: number, hz: Hazard[], t0: number): boolean {
  const bots = cornerMembers(G, k).filter((e) => isBot(G, e));
  const path = planDodge(G, k, bots, hz);
  if (!path) return false;
  follow(G, k, bots, hz, path, t0);
  return true;
}

/** 算出每一擊時每個 Bot 站的格子（找不到回傳 null） */
function planDodge(G: GameState, k: number, bots: Entity[], hz: Hazard[]): number[][] | null {
  const start = bots.map((e) => cellUnder(e)?.idx ?? -1);
  if (!bots.length || !hz.length || start.some((c) => c < 0)) return null;
  const allowed = new Set(zoneCells(G, k).map((c) => c.idx));
  const blocked = blockedBy(G, bots);
  const opts = (c: number): number[] => [c, ...neighbors(CELLS[c]).map((n) => n.idx).filter((n) => allowed.has(n) && !blocked.has(n))];
  const key = (s: number[]): string => s.join(',');
  // layers[j]：第 j 擊時的狀態 → 上一層的狀態
  let layer = new Map<string, number[]>([[key(start), start]]);
  const parents: Map<string, string>[] = [];
  for (const h of hz) {
    const next = new Map<string, number[]>();
    const par = new Map<string, string>();
    layer.forEach((s, sk) => {
      const combos = (i: number, acc: number[]): void => {
        if (i === s.length) {
          if (acc.some((c) => h.hit(CELLS[c]))) return;
          const kk = key(acc);
          if (!next.has(kk)) { next.set(kk, acc.slice()); par.set(kk, sk); }
          return;
        }
        for (const c of opts(s[i])) {
          // 走進的格子：這一層還沒人選、上一層也沒人
          if (acc.includes(c) || (c !== s[i] && s.includes(c))) continue;
          acc.push(c); combos(i + 1, acc); acc.pop();
        }
      };
      combos(0, []);
    });
    if (!next.size) return null;
    parents.push(par);
    layer = next;
  }
  // 從最後一層回推（第一個找到的就是「先試原地不動」的）
  const path: number[][] = [];
  let kk = layer.keys().next().value as string;
  for (let j = hz.length - 1; j >= 0; j--) { path.unshift(kk.split(',').map(Number)); kk = parents[j].get(kk)!; }
  return path;
}

/** 照表走；每一擊後檢查有沒有人沒到預定的格子，有就用剩下的幾擊重新規劃 */
function follow(G: GameState, k: number, bots: Entity[], hz: Hazard[], path: number[][], t0: number): void {
  const tok = ++G.p2!.plan[k];
  path.forEach((s, j) => {
    const when = j === 0 ? t0 : hz[j - 1].t + 0.05;
    at(G, when, () => {
      if (!G.p2 || G.p2.plan[k] !== tok) return;
      // 上一擊時有人不在預定格（被擋住、刷新格子…）：剩下的重新規劃
      if (j > 0 && bots.some((e, i) => !e.dead && cellUnder(e)?.idx !== path[j - 1][i])) {
        const rest = hz.slice(j);
        const again = planDodge(G, k, bots, rest);
        if (again) { follow(G, k, bots, rest, again, G.t); return; }
      }
      bots.forEach((e, i) => {
        if (e.dead) return;
        e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 2);
        p2Goto(G, e, center(CELLS[s[i]]));
      });
    });
  });
}
