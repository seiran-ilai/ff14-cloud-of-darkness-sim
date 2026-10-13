// 座標慣例：x 往東、y 往南（畫面座標）；角度 0 = 北，順時針為正。
import { R, HALF, CELL, type Vec } from './constants';
import { GEM_CUT, OPENER } from './tuning';

export const dirV = (a: number): Vec => ({ x: Math.sin(a), y: -Math.cos(a) });
export const angOf = (dx: number, dy: number): number => Math.atan2(dx, -dy);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
/** P2 魔法陣：菱形北角切平（王底下沒有地板）；回傳離切線的距離（正＝在地板這側） */
export const voidDist = (_x: number, y: number): number => y - GEM_CUT;
export const inVoid = (x: number, y: number): boolean => voidDist(x, y) < 0;
/** P2 魔法陣（北角切平的菱形）上有沒有地板 */
export const inArena = (x: number, y: number): boolean => Math.abs(x) + Math.abs(y) <= R && !inVoid(x, y);
/** P1 開場圓形場地 */
export const inRound = (x: number, y: number): boolean => Math.hypot(x, y) <= OPENER.roundR;
/** 腳下有沒有地板：round＝P1 開場圓形場地，否則 P2 魔法陣 */
export const onP1Floor = (p: Vec, round?: boolean): boolean => (round ? inRound(p.x, p.y) : inArena(p.x, p.y));
/** Bot 目標在王底下沒地板處：推回切線南側 margin 處（切線是直線，兩端都在地板上的路徑不會經過） */
export function aroundVoid(_p: Vec, tg: Vec, margin = 0.8): Vec {
  return voidDist(tg.x, tg.y) < margin ? { x: tg.x, y: GEM_CUT + margin + 0.2 } : tg;
}

/** 把掉出場地的點夾回場內（離邊 1 m） */
export function clampP1(p: Vec, round?: boolean): Vec {
  if (round) { const k = Math.min(1, (OPENER.roundR - 1) / (Math.hypot(p.x, p.y) || 1)); return { x: p.x * k, y: p.y * k }; }
  let { x, y } = p;
  if (inVoid(x, y)) y = GEM_CUT + 1;
  const s = Math.abs(x) + Math.abs(y);
  if (s > R - 1) { const k = (R - 1) / s; x *= k; y *= k; }
  return { x, y };
}
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
