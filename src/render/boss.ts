// 王、暗之刃手臂、心臟與陰冷擁抱手勢、雲之魔刃標示、齊射雲、球、邪眼
import { BOSS, R } from '../core/constants';
import { fromUV, laneC } from '../core/geometry';
import { HALF } from '../core/constants';
import { VOLLEY } from '../core/tuning';
import type { Config } from '../core/config';
import { EMBRACE_TEXT, type EmbraceType, type RenderState as GameState } from '../game/state';
import { px, text, circle } from './canvas';

export function drawBoss(c: CanvasRenderingContext2D, G: GameState, cfg: Config): void {
  const { x, y } = BOSS;
  const arms = G.extra.arms && G.t < G.extra.arms.until ? G.extra.arms.mode : null;
  if (arms) {
    [-1, 1].forEach((s) => {
      const up = arms === 'B' || (arms === 'L' && s < 0) || (arms === 'R' && s > 0);
      const ax = x + s * 3.6, ay = y + 0.5, ex = x + s * (up ? 7.5 : 6.5), ey = y + (up ? -6.5 : 5.5);
      c.strokeStyle = up ? '#ffd36b' : '#8a7fb5';
      c.lineWidth = px(7);
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(x + s * 7, y, ex, ey); c.stroke();
      c.fillStyle = up ? '#ffd36b' : '#8a7fb5';
      circle(c, ex, ey, 1.1); c.fill();
      if (up) { c.strokeStyle = '#fff6d5'; c.lineWidth = px(3); c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + s * 0.6, ey - 3); c.stroke(); }
    });
  }
  c.fillStyle = 'rgba(120,80,200,.18)';
  circle(c, x, y, 6.5); c.fill();
  c.fillStyle = '#120d1e';
  circle(c, x, y, 4.2); c.fill();
  c.strokeStyle = '#b99cff'; c.lineWidth = px(2); c.stroke();
  c.fillStyle = '#b99cff';
  c.beginPath(); c.moveTo(x, y + 6.4); c.lineTo(x - 1.5, y + 4.4); c.lineTo(x + 1.5, y + 4.4); c.closePath(); c.fill();
  text(c, '暗黑之雲', x, y, 13, '#eae4fb');
  if (G.stored) text(c, `雲之魔刃：${G.stored === 'aero' ? '風' : '死'}`, x, y - 7.6, 12, G.stored === 'aero' ? '#8bdcff' : '#ff8a9a');
  if (G.extra.heart) { const pulse = 1 + 0.12 * Math.sin(G.t * 6); c.fillStyle = '#ff3b5c'; circle(c, x, y + 8, 1 * pulse); c.fill(); }
  const pose = activePose(G);
  if (pose) drawPose(c, pose, cfg);
}

/** 目前王擺出的陰冷擁抱手勢（同時有兩個時取先結束的） */
export const activePose = (G: GameState): EmbraceType | null =>
  G.poses.filter((p) => G.t >= p.from && G.t <= p.to).sort((a, b) => a.to - b.to)[0]?.type ?? null;

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

/**
 * 陰冷擁抱手勢（依攻略，只在詠唱、上減益時擺出）：
 * 🫳 右手心向下（撒鹽），左手在身前；🤌 右手心向上（義大利手勢），左手在身後。
 * inset＝跟隨鏡頭右上角的小窗：只畫圖示，不畫手臂與說明。
 */
export function drawPose(c: CanvasRenderingContext2D, type: EmbraceType, cfg: Config, inset = false): void {
  const hx = BOSS.x, hy = BOSS.y + 8, T = EMBRACE_TEXT[type];
  c.save();
  if (!inset) {
    // 王的左手（王面向南，左手在畫面東）：包覆＝伸到身前（南），撈起＝伸到身後（北）
    const front = type === 'cover';
    const sx = BOSS.x + 3.8, sy = BOSS.y + 0.3, ex = BOSS.x + 7.2, ey = BOSS.y + (front ? 6.5 : -6.5);
    c.strokeStyle = '#e9b949'; c.lineWidth = px(7); c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(BOSS.x + 7.5, BOSS.y, ex, ey); c.stroke();
    c.fillStyle = '#ffd36b'; circle(c, ex, ey, 1.2); c.fill();
    text(c, T.other.replace('在', '・'), ex + 3.6, ey, 12, '#ffd36b', 700);
  }
  // 手勢圖示，畫在心臟上
  c.font = `${px(inset ? 64 : 46)}px ${EMOJI_FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(T.icon, hx, hy);
  c.restore();
  if (!inset && cfg.text) {
    text(c, `${T.icon} ${T.hand}`, hx, hy + 4.3, 14, '#ffd36b');
    text(c, T.other, hx, hy + 6.6, 12, '#ffe6a3', 700);
    text(c, T.how, hx, hy + 8.6, 11.5, '#eadff9', 700);
  }
}

export function drawClouds(c: CanvasRenderingContext2D, G: GameState, cfg: Config): void {
  const cl = G.extra.clouds;
  if (!cl || G.t > cl.until) return;
  (['U', 'V'] as const).forEach((fam) => [0, 1, 2, 3].forEach((i) => {
    const p = fam === 'U' ? fromUV(laneC(i), -HALF - VOLLEY.cloudOut) : fromUV(HALF + VOLLEY.cloudOut, laneC(i));
    const r = cl.rounds.find((r) => r.fam === fam && r.lanes.includes(i) && G.t >= r.glow && G.t < r.fire);
    const k = r ? cl.rounds.indexOf(r) + 1 : 0;
    const fired = cl.rounds.some((r) => r.fam === fam && r.lanes.includes(i) && G.t >= r.fire && G.t < r.fire + 0.5);
    c.fillStyle = k ? '#5a2a7a' : '#231b33';
    circle(c, p.x, p.y, 2); c.fill();
    c.lineWidth = px(k ? 3 : 1.5);
    c.strokeStyle = k ? '#ffb067' : '#6d5a92';
    c.stroke();
    if (k) {
      const spin = G.t * 6;
      c.strokeStyle = '#ffd8a8'; c.lineWidth = px(2);
      c.beginPath(); c.arc(p.x, p.y, 2.7, spin, spin + 2); c.stroke();
      if (cfg.text) text(c, String(k), p.x, p.y, 13, '#fff');
    }
    if (fired) { c.fillStyle = 'rgba(255,200,120,.5)'; circle(c, p.x, p.y, 2.8); c.fill(); }
  }));
}

export function drawOrbAndEyes(c: CanvasRenderingContext2D, G: GameState): void {
  if (G.extra.orb) {
    const p = 1 + 0.1 * Math.sin(G.t * 5);
    if (G.extra.orb === 'death') { c.fillStyle = '#3a0d1a'; circle(c, 0, 0, 2.2 * p); c.fill(); c.strokeStyle = '#ff3b5c'; c.lineWidth = px(2); c.stroke(); }
    else { c.fillStyle = '#bfe9ff'; circle(c, 0, 0, 1.3 * p); c.fill(); }
  }
  if (G.extra.eyes && G.t < G.extra.eyes.until) {
    const s = G.extra.eyes.side;
    [-4.5, 4.5].forEach((y) => {
      const x = s * (R + 2.5);
      c.fillStyle = '#2a0d16'; circle(c, x, y, 1.6); c.fill();
      c.strokeStyle = '#ff5d6c'; c.lineWidth = px(2); c.stroke();
      c.fillStyle = '#ff5d6c'; circle(c, x, y, 0.6); c.fill();
    });
  }
}
