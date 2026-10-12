import { describe, it, expect } from 'vitest';
import { toUV, fromUV, inArena, angDiff, laneOf, edgeDist, dirV, angOf } from '../src/core/geometry';
import { R, HALF, CELL } from '../src/core/constants';

describe('geometry', () => {
  it('toUV / fromUV 互逆', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 3.2, y: -7.1 }, { x: -20, y: 5 }, { x: 15.5, y: 15.5 }]) {
      const uv = toUV(p);
      const q = fromUV(uv.u, uv.v);
      expect(q.x).toBeCloseTo(p.x, 10);
      expect(q.y).toBeCloseTo(p.y, 10);
      const back = toUV(fromUV(uv.u, uv.v));
      expect(back.u).toBeCloseTo(uv.u, 10);
      expect(back.v).toBeCloseTo(uv.v, 10);
    }
  });

  it('inArena 邊界', () => {
    expect(inArena(0, 0)).toBe(true);
    expect(inArena(R, 0)).toBe(true);
    expect(inArena(0, -R)).toBe(true);
    expect(inArena(R / 2, R / 2)).toBe(true);
    expect(inArena(R + 0.01, 0)).toBe(false);
    expect(inArena(R / 2 + 0.01, R / 2)).toBe(false);
    expect(edgeDist({ x: R, y: 0 })).toBeCloseTo(0, 10);
  });

  it('angDiff 落在 0～π 且對稱', () => {
    expect(angDiff(0, 0)).toBeCloseTo(0);
    expect(angDiff(0, Math.PI)).toBeCloseTo(Math.PI);
    expect(angDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angDiff(-3, 3)).toBeCloseTo(angDiff(3, -3));
    expect(angDiff(5 * Math.PI, Math.PI)).toBeCloseTo(0);
  });

  it('角度慣例：0 = 北、π/2 = 東', () => {
    expect(dirV(0).y).toBeCloseTo(-1);
    expect(dirV(Math.PI / 2).x).toBeCloseTo(1);
    expect(angOf(1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it('laneOf 夾在 0～3', () => {
    expect(laneOf(-HALF - 5)).toBe(0);
    expect(laneOf(-HALF + CELL * 1.5)).toBe(1);
    expect(laneOf(HALF + 5)).toBe(3);
  });
});
