// 場地、格線、地面圖案、方位字：P1 開場是大圓形；P2 魔法陣是北角切平的菱形（王底下沒有地板）
import { R } from '../core/constants';
import { GEM_CUT, OPENER, FLOOR_SQ } from '../core/tuning';
import type { RenderState } from '../game/state';
import { px, text } from './canvas';

/** P2 地形：菱形北角在 GEM_CUT 切平 */
function gemPath(c: CanvasRenderingContext2D, fresh = true): void {
  const w = R + GEM_CUT; // 切線上的半寬
  if (fresh) c.beginPath();
  c.moveTo(-w, GEM_CUT); c.lineTo(w, GEM_CUT);
  c.lineTo(R, 0); c.lineTo(0, R); c.lineTo(-R, 0);
  c.closePath();
}

/**
 * 地面圖案（依實際地圖簡化，只留關鍵的中央正方形）：以場地中心為中心、轉 45° 的正方形，
 * 四個角離中心 FLOOR_SQ。攻略說的「地面直角線」就是它的北角（雙手暗之刃退到這裡就安全）。
 */
function floorSquare(c: CanvasRenderingContext2D): void {
  const d = FLOOR_SQ;
  c.fillStyle = 'rgba(185,156,255,.07)';
  c.strokeStyle = 'rgba(230,220,255,.6)'; c.lineWidth = px(1.8);
  c.beginPath();
  c.moveTo(0, -d); c.lineTo(d, 0); c.lineTo(0, d); c.lineTo(-d, 0); c.closePath();
  c.fill(); c.stroke();
  // 北角（直角，雙手暗之刃的安全點）稍微強調
  c.fillStyle = 'rgba(230,220,255,.75)';
  c.beginPath(); c.arc(0, -d, 0.45, 0, Math.PI * 2); c.fill();
}

function dirs(c: CanvasRenderingContext2D, r: number): void {
  text(c, '東', r + 2, 0, 14, 'rgba(200,190,230,.6)', 700);
  text(c, '西', -r - 2, 0, 14, 'rgba(200,190,230,.6)', 700);
  text(c, '南', 0, r + 2, 14, 'rgba(200,190,230,.6)', 700);
}

export function drawArena(c: CanvasRenderingContext2D, G: Pick<RenderState, 'round' | 'extra' | 't'>): void {
  const g = c.createRadialGradient(0, 0, 4, 0, 0, 48);
  g.addColorStop(0, '#150f24');
  g.addColorStop(1, '#05040a');
  c.fillStyle = g;
  c.fillRect(-90, -90, 180, 180);
  const fg = c.createLinearGradient(0, -R, 0, R);
  fg.addColorStop(0, '#3a2f55');
  fg.addColorStop(1, '#2a2240');
  if (G.round) {
    const RR = OPENER.roundR;
    c.beginPath(); c.arc(0, 0, RR, 0, Math.PI * 2);
    c.fillStyle = fg; c.fill();
    c.strokeStyle = '#8c79c4'; c.lineWidth = px(2.5); c.stroke();
    c.save();
    c.beginPath(); c.arc(0, 0, RR, 0, Math.PI * 2); c.clip();
    floorSquare(c);
    // 進 P2 前的範圍提示：圓形外圍（菱形以外）會消失
    if ((G.extra.gemWarn ?? -1) > G.t) {
      const k = 0.35 + 0.15 * Math.sin(G.t * 8);
      c.beginPath(); c.arc(0, 0, RR, 0, Math.PI * 2);
      gemPath(c, false);
      c.fillStyle = `rgba(255,170,90,${k})`; c.fill('evenodd');
      c.strokeStyle = '#ffd36b'; c.lineWidth = px(2);
      gemPath(c); c.stroke();
    }
    c.restore();
    dirs(c, RR);
    return;
  }
  gemPath(c);
  c.fillStyle = fg;
  c.fill();
  c.strokeStyle = '#8c79c4';
  c.lineWidth = px(2.5);
  c.stroke();
  c.save();
  gemPath(c); c.clip();
  c.strokeStyle = 'rgba(160,140,210,.22)';
  c.lineWidth = px(1);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    c.beginPath(); c.moveTo(-R * (1 - t), -R * t); c.lineTo(R * t, R * (1 - t)); c.stroke();
    c.beginPath(); c.moveTo(R * (1 - t), -R * t); c.lineTo(-R * t, R * (1 - t)); c.stroke();
  }
  floorSquare(c);
  c.restore();
  dirs(c, R);
}
