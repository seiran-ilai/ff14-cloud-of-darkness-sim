// AOE 預兆（仿遊戲）：橘色填色＋邊緣漸亮，判定前 TELE_FLASH 秒閃爍；判定瞬間由 effects 畫爆發
import { HALF, CELL } from '../core/constants';
import { dirV, fromUV } from '../core/geometry';
import { TELE_FLASH } from '../core/tuning';
import type { LaneFam, Telegraph } from '../game/state';
import { px, circle, diamondPath } from './canvas';

export function lanePoly(c: CanvasRenderingContext2D, fam: LaneFam, i: number, begin = true): void {
  const a = -HALF + CELL * i, b = a + CELL;
  const pts = fam === 'U' ? [[a, -HALF], [b, -HALF], [b, HALF], [a, HALF]] : [[-HALF, a], [-HALF, b], [HALF, b], [HALF, a]];
  if (begin) c.beginPath();
  pts.forEach(([u, v], k) => { const p = fromUV(u, v); if (k) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
  c.closePath();
}

export function rectPath(c: CanvasRenderingContext2D, t: Extract<Telegraph, { k: 'rect' }>): void {
  const v = dirV(t.H), n = { x: -v.y, y: v.x }, hw = t.w / 2, O = t.O;
  c.beginPath();
  c.moveTo(O.x + n.x * hw, O.y + n.y * hw);
  c.lineTo(O.x + n.x * hw + v.x * t.len, O.y + n.y * hw + v.y * t.len);
  c.lineTo(O.x - n.x * hw + v.x * t.len, O.y - n.y * hw + v.y * t.len);
  c.lineTo(O.x - n.x * hw, O.y - n.y * hw);
  c.closePath();
}

/** 預兆的路徑（填色區域）；donut 用 evenodd */
export function telePath(c: CanvasRenderingContext2D, t: Telegraph): void {
  if (t.k === 'rect') rectPath(c, t);
  else if (t.k === 'lane') { c.beginPath(); t.lanes.forEach((i) => lanePoly(c, t.fam, i, false)); }
  else if (t.k === 'donut') { diamondPath(c); c.moveTo(t.x + t.r, t.y); c.arc(t.x, t.y, t.r, 0, Math.PI * 2, true); }
  else if (t.k === 'half') {
    // 畫布角度 = 我們的角度 − 90°；半圓從 a−90° 到 a+90°
    const m = t.a - Math.PI / 2;
    c.beginPath(); c.moveTo(t.x, t.y); c.arc(t.x, t.y, t.r, m - Math.PI / 2, m + Math.PI / 2); c.closePath();
  }
  else circle(c, t.x, t.y, t.r);
}

const ORANGE = { fill: '255,128,48', edge: '255,190,120' };
const BLUE = { fill: '92,200,255', edge: '190,235,255' };

/** 填色＋邊緣由內往外漸亮（多層描邊） */
function glowFill(c: CanvasRenderingContext2D, path: () => void, col: { fill: string; edge: string }, a: number, evenodd = false): void {
  path();
  c.fillStyle = `rgba(${col.fill},${0.22 * a})`;
  if (evenodd) c.fill('evenodd'); else c.fill();
  c.save();
  if (evenodd) c.clip('evenodd'); else c.clip();
  // 只畫在區域內側：寬線被 clip 掉外半邊，形成內側光暈
  [[14, 0.1], [8, 0.18], [4, 0.32]].forEach(([w, al]) => { path(); c.strokeStyle = `rgba(${col.fill},${al * a})`; c.lineWidth = px(w); c.stroke(); });
  c.restore();
  path();
  c.strokeStyle = `rgba(${col.edge},${0.95 * a})`;
  c.lineWidth = px(2);
  c.stroke();
}

export function drawTele(c: CanvasRenderingContext2D, t: Telegraph, now: number): void {
  const left = t.until - now;
  // 判定前閃爍
  const a = left < TELE_FLASH ? (Math.floor(left * 20) % 2 ? 1.6 : 0.7) : 1;
  const col = t.k === 'blue' ? BLUE : ORANGE;
  c.save();
  if (t.k === 'lane') {
    glowFill(c, () => telePath(c, t), col, a * 0.75);
  } else if (t.k === 'donut') {
    glowFill(c, () => telePath(c, t), col, a, true);
  } else {
    glowFill(c, () => telePath(c, t), col, a);
  }
  if (t.k === 'rect' && t.hand) {
    // 攥魂之手的起點與朝向
    const v = dirV(t.H), O = t.O;
    c.fillStyle = '#c05bff'; circle(c, O.x, O.y, 1.1); c.fill();
    c.strokeStyle = '#f0d7ff'; c.lineWidth = px(2.5);
    c.beginPath(); c.moveTo(O.x, O.y); c.lineTo(O.x + v.x * 2.2, O.y + v.y * 2.2); c.stroke();
  }
  c.restore();
}

/** 判定瞬間的爆發：白熱填色快速淡出 */
export function drawBurst(c: CanvasRenderingContext2D, t: Telegraph, k: number): void {
  const a = Math.max(0, 1 - k);
  c.save();
  c.fillStyle = t.k === 'blue' ? `rgba(200,240,255,${0.55 * a})` : `rgba(255,220,170,${0.6 * a})`;
  telePath(c, t);
  if (t.k === 'donut') c.fill('evenodd'); else c.fill();
  c.restore();
}
