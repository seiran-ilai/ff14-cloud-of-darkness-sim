// 王、暗之刃手臂、心臟與陰冷擁抱手勢、雲之魔刃標示、齊射雲、球、邪眼
import { BOSS, R } from '../core/constants';
import { fromUV, laneC } from '../core/geometry';
import { HALF } from '../core/constants';
import { VOLLEY } from '../core/tuning';
import type { Config } from '../core/config';
import type { EmbraceType, RenderState as GameState } from '../game/state';
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

/**
 * 陰冷擁抱手勢：王的右手捏住心臟。
 * 包覆＝掌心朝向玩家：畫「手心」（淺色、掌紋、指腹），手從上方往下蓋住心臟。
 * 撈起＝手背朝向玩家：畫「手背」（深色、金色指節、指甲），手從下方往上撈起心臟。
 */
export function drawPose(c: CanvasRenderingContext2D, type: EmbraceType, cfg: Config, label = true): void {
  const hx = BOSS.x, hy = BOSS.y + 8;
  const palm = type === 'cover';
  // dir：手指指向（1 往南蓋下、−1 往北撈起）；以心臟為中心放大 1.4 倍畫
  const dir = palm ? 1 : -1, cx = 0, cy = -dir * 2.1;
  c.save();
  c.translate(hx, hy);
  c.scale(1.4, 1.4);
  c.lineJoin = 'round';
  const skin = palm ? '#f3d2a2' : '#6a5a92', edge = palm ? '#b9875a' : '#ffd36b';
  const thin = px(1.5) / 1.4;
  /** 膠囊形（手指、拇指）：先畫外框色粗線再畫膚色細線 */
  const capsule = (x0: number, y0: number, x1: number, y1: number, w: number): void => {
    c.lineCap = 'round';
    [[edge, w + thin * 2], [skin, w]].forEach(([col, lw]) => {
      c.strokeStyle = col as string; c.lineWidth = lw as number;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    });
  };
  // 手指
  const fingers = [-1.05, -0.35, 0.35, 1.05];
  const tips: [number, number, number, number][] = [];
  fingers.forEach((ox, i) => {
    const len = i === 0 || i === 3 ? 1.6 : 2.0;
    const x0 = cx + ox * 0.95, y0 = cy + dir * 0.6, x1 = cx + ox * 1.05, y1 = y0 + dir * len;
    capsule(x0, y0, x1, y1, 0.62);
    tips.push([x0, y0, x1, y1]);
  });
  // 拇指
  capsule(cx - 1.2, cy + dir * 0.2, cx - 1.95, cy + dir * 1.3, 0.62);
  // 手掌
  c.fillStyle = skin; c.strokeStyle = edge; c.lineWidth = thin;
  c.beginPath(); c.ellipse(cx, cy, 1.55, 1.25, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  tips.forEach(([x0, y0, x1, y1]) => {
    if (palm) { c.fillStyle = '#f9e3c4'; circle(c, x1, y1, 0.2); c.fill(); }
    else {
      // 手背：指尖的指甲＋指根的金色指節
      c.fillStyle = '#f0d8e6'; c.beginPath(); c.ellipse(x1, y1 - dir * 0.05, 0.18, 0.24, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd36b'; circle(c, x0, y0, 0.19); c.fill();
    }
  });
  if (palm) {
    // 掌紋
    c.strokeStyle = '#b9875a'; c.lineWidth = px(1.3);
    c.beginPath(); c.arc(cx - 0.2, cy + dir * 0.9, 1.0, dir > 0 ? Math.PI * 1.15 : Math.PI * 0.15, dir > 0 ? Math.PI * 1.75 : Math.PI * 0.75); c.stroke();
    c.beginPath(); c.moveTo(cx - 1.0, cy - 0.2); c.quadraticCurveTo(cx, cy + dir * 0.3, cx + 1.1, cy - 0.1); c.stroke();
  } else {
    // 手背：骨節線
    c.strokeStyle = 'rgba(255,211,107,.6)'; c.lineWidth = px(1.2);
    fingers.forEach((ox) => { c.beginPath(); c.moveTo(cx + ox * 0.6, cy - dir * 0.7); c.lineTo(cx + ox, cy + dir * 0.85); c.stroke(); });
  }
  c.restore();
  if (cfg.text && label) text(c, palm ? '包覆（手心朝你）' : '撈起（手背朝你）', hx + 10.5, hy, 14, '#ffd36b');
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
