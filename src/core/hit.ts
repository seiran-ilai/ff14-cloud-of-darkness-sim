// 判定圈與 AOE 形狀的碰撞。預兆畫的是 AOE 本身的形狀，判定一律用角色判定圈（半徑 HIT）：
// 「被打中」= 判定圈與 AOE 有重疊；「站在安全區」= 判定圈整個在安全區內。
import { HIT } from './tuning';
import { dirV } from './geometry';
import type { Vec } from './constants';

/** 判定圈碰到圓形 AOE */
export const hitCircle = (p: Vec, c: Vec, r: number, hb = HIT): boolean => Math.hypot(p.x - c.x, p.y - c.y) <= r + hb;

/** 判定圈整個在圓形安全區內 */
export const insideCircle = (p: Vec, c: Vec, r: number, hb = HIT): boolean => Math.hypot(p.x - c.x, p.y - c.y) <= r - hb;

/** 判定圈碰到矩形：起點 O、朝向 H（角度）、長 len、寬 w（精確的圓與矩形相交） */
export function hitRect(p: Vec, O: Vec, H: number, len: number, w: number, hb = HIT): boolean {
  const v = dirV(H), dx = p.x - O.x, dy = p.y - O.y;
  const t = dx * v.x + dy * v.y, s = dx * v.y - dy * v.x;
  const ct = Math.max(0, Math.min(len, t)), cs = Math.max(-w / 2, Math.min(w / 2, s));
  return Math.hypot(t - ct, s - cs) <= hb;
}

/** 判定圈碰到從 O 出發、方向 v（單位向量）的無限長直線帶，半寬 halfW */
export function hitRay(p: Vec, O: Vec, v: Vec, halfW: number, hb = HIT): boolean {
  const dx = p.x - O.x, dy = p.y - O.y;
  const t = dx * v.x + dy * v.y, s = Math.abs(dx * v.y - dy * v.x);
  return t > -hb && s <= halfW + hb;
}

/** 判定圈碰到半圓：中心 c、半徑 r、朝角度 a 的那一半（以通過中心、垂直於 a 的直線切開） */
export function hitHalf(p: Vec, c: Vec, r: number, a: number, hb = HIT): boolean {
  const n = dirV(a), dx = p.x - c.x, dy = p.y - c.y;
  return dx * n.x + dy * n.y > -hb && Math.hypot(dx, dy) <= r + hb;
}

/** 沿直線帶的前後位置（給排序用） */
export const along = (p: Vec, O: Vec, v: Vec): number => (p.x - O.x) * v.x + (p.y - O.y) * v.y;
