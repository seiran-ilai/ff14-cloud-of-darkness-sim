// 座標慣例：x 往東、y 往南（畫面座標）；角度 0 = 北，順時針為正。
import { R, HALF, CELL, type Vec } from './constants';

export const dirV = (a: number): Vec => ({ x: Math.sin(a), y: -Math.cos(a) });
export const angOf = (dx: number, dy: number): number => Math.atan2(dx, -dy);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const inArena = (x: number, y: number): boolean => Math.abs(x) + Math.abs(y) <= R;
/** 到菱形邊緣的垂直距離（場外為負） */
export const edgeDist = (p: Vec): number => (R - (Math.abs(p.x) + Math.abs(p.y))) / Math.SQRT2;
/** 兩角度差的絕對值，0～π */
export const angDiff = (a: number, b: number): number =>
  Math.abs(((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

/** 轉成沿菱形邊的 (u,v) 座標：u 沿東南向、v 沿東北向 */
export const toUV = (p: Vec): { u: number; v: number } => ({ u: (p.x + p.y) / Math.SQRT2, v: (p.x - p.y) / Math.SQRT2 });
export const fromUV = (u: number, v: number): Vec => ({ x: (u + v) / Math.SQRT2, y: (u - v) / Math.SQRT2 });
/** 第 i 列／行（0～3）的中心座標 */
export const laneC = (i: number): number => -HALF + CELL * (i + 0.5);
/** 座標落在第幾列／行（夾在 0～3） */
export const laneOf = (c: number): number => Math.max(0, Math.min(3, Math.floor((c + HALF) / CELL)));

/** 從中心沿角度 theta 走到離邊 inset 公尺處 */
export function edgePoint(theta: number, inset: number): Vec {
  const d = dirV(theta);
  const k = (R - inset * Math.SQRT2) / (Math.abs(d.x) + Math.abs(d.y));
  return { x: d.x * k, y: d.y * k };
}
