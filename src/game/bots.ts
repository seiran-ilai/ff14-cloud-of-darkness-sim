// Bot（隊友，以及示範模式下的玩家角色）
import { homePos } from '../core/positions';
import { HALF, CELL, type Vec } from '../core/constants';
import { HIT } from '../core/tuning';
import { toUV, fromUV, laneOf } from '../core/geometry';
import { at, type Entity, type GameState } from './state';

export const isBot = (G: GameState, e: Entity): boolean => !e.isPlayer || G.auto;
export const npcs = (G: GameState): Entity[] => G.ents.filter((e) => isBot(G, e));

/** 機制在 t0 宣告「接手」Bot；之後只有最後接手的機制能叫 Bot 回原位 */
export function claim(G: GameState, t0: number): object {
  const me = {};
  at(G, t0, () => { G.active = me; });
  return me;
}

/**
 * 齊射式還在進行時，要等最後一發打完才能跑位（攻略：「先躲完波動炮，再到核爆位置散開」）。
 * 回傳可以開始跑位的時間；沒有齊射時就是現在。
 */
export function afterVolley(G: GameState): number {
  const cl = G.extra.clouds;
  // until = 最後一發 + 0.7；齊射在最後一發 +0.1 清提示，這裡排在它之後
  return cl && cl.until > G.t ? Math.max(G.t, cl.until - 0.55) : G.t;
}

/**
 * 齊射還沒打完時「提前靠近」目標：還有剩餘發射的方向，只能在自己目前那一列裡移動（離列邊至少判定圈＋0.4 m），
 * 其他方向可以直接往目標靠（攻略：提前靠近安全區，但不要太早衝過去吃到第 4 發）。
 */
export function volleyApproach(G: GameState, e: Entity, target: Vec): Vec {
  const cl = G.extra.clouds;
  if (!cl) return target;
  const pending = new Set(cl.rounds.filter((r) => r.fire > G.t).map((r) => r.fam));
  if (!pending.size) return target;
  const cur = toUV(e), tg = toUV(target), m = HIT + 0.4;
  // 用計畫要站的列（可能還在走過去的路上），不是目前位置所在的列
  const clampLane = (i: number, t: number): number => {
    const lo = -HALF + CELL * i + m, hi = -HALF + CELL * (i + 1) - m;
    return Math.max(lo, Math.min(hi, t));
  };
  const iu = e.vol ? e.vol.iu : laneOf(cur.u), iv = e.vol ? e.vol.iv : laneOf(cur.v);
  // 還沒走進計畫的列：先繼續走過去，不要斜著拖慢
  if ((pending.has('U') && laneOf(cur.u) !== iu) || (pending.has('V') && laneOf(cur.v) !== iv)) return e.mt ?? target;
  return fromUV(pending.has('U') ? clampLane(iu, tg.u) : tg.u, pending.has('V') ? clampLane(iv, tg.v) : tg.v);
}

/** Bot 跑去 spot：齊射進行中先提前靠近，最後一發打完再直接過去 */
export function goAfterVolley(G: GameState, e: Entity, spot: Vec): void {
  e.mt = volleyApproach(G, e, spot);
  atOrNow(G, afterVolley(G), () => { e.mt = spot; });
}

/** 在 t（≥ 現在）執行；已經到了就立刻執行 */
export function atOrNow(G: GameState, t: number, fn: () => void): void {
  if (t <= G.t) fn(); else at(G, t, fn);
}

export function npcHome(G: GameState, t: number, me?: object): void {
  at(G, t, () => {
    if (me && G.active !== me) return;
    npcs(G).forEach((e) => { e.mt = homePos(e.al, e.role); });
  });
}
