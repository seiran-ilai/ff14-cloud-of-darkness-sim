// 玩家與隊友：圓形底座＋面向扇形＋判定圈；石化、加重、眩暈、陣亡時外觀改變
import { ROLE_COL, roleType } from '../core/constants';
import { dirV } from '../core/geometry';
import { HIT } from '../core/tuning';
import type { Entity, RenderState } from '../game/state';
import { px, text, circle, lerp, lerpAng } from './canvas';

const has = (G: RenderState, e: Entity, k: 'sprint' | 'akb' | 'heavy'): boolean => (e.buffs[k] || 0) > G.t;

export function drawEnt(c: CanvasRenderingContext2D, e: Entity, G: RenderState, alpha: number): void {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha), face = lerpAng(e.pface, e.face, alpha);
  const me = e.isPlayer;
  const col = ROLE_COL[roleType(e.role)];
  const r = me ? 1 : 0.72;
  const stone = e.stun > G.t && e.stunKind === 'stone';
  const stunned = e.stun > G.t && !stone;
  const heavy = has(G, e, 'heavy');
  c.save();

  // 面向扇形（90°）
  const fr = me ? 3.4 : 2;
  const a0 = face - Math.PI / 2 - Math.PI / 4, a1 = face - Math.PI / 2 + Math.PI / 4;
  const g = c.createRadialGradient(x, y, r * 0.6, x, y, fr);
  const fc = e.dead ? '120,120,120' : me ? '255,255,255' : '220,220,255';
  g.addColorStop(0, `rgba(${fc},${me ? 0.42 : 0.22})`);
  g.addColorStop(1, `rgba(${fc},0)`);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, fr, a0, a1); c.closePath(); c.fill();
  if (me) {
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = px(1.2);
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, fr, a0, a1); c.closePath(); c.stroke();
  }

  // 加重：腳下橘色鎖鏈環
  if (heavy && !e.dead) {
    c.strokeStyle = '#ff8f3d'; c.lineWidth = px(me ? 3 : 2); c.setLineDash([px(4), px(3)]);
    circle(c, x, y, r + 0.45); c.stroke(); c.setLineDash([]);
  }

  // 底座
  circle(c, x, y, r);
  c.fillStyle = e.dead ? '#444' : stone ? '#8d8d8d' : col;
  c.fill();
  c.lineWidth = px(me ? 3 : 1.2);
  c.strokeStyle = me ? '#fff' : '#0b0a12';
  c.stroke();
  if (stone) {
    // 石化裂紋
    c.strokeStyle = '#3c3c3c'; c.lineWidth = px(1.5);
    c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.3); c.lineTo(x - r * 0.1, y + r * 0.1); c.lineTo(x + r * 0.2, y - r * 0.4); c.lineTo(x + r * 0.6, y + r * 0.2); c.stroke();
  }
  if (e.dead) {
    c.strokeStyle = '#ff5d6c'; c.lineWidth = px(2.5);
    c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.6); c.lineTo(x + r * 0.6, y + r * 0.6); c.moveTo(x + r * 0.6, y - r * 0.6); c.lineTo(x - r * 0.6, y + r * 0.6); c.stroke();
  }

  // 面向指示
  const v = dirV(face), L = r + (me ? 1.1 : 0.6);
  c.strokeStyle = me ? '#fff' : 'rgba(255,255,255,.75)';
  c.lineWidth = px(me ? 3 : 1.5);
  c.beginPath(); c.moveTo(x + v.x * r * 0.4, y + v.y * r * 0.4); c.lineTo(x + v.x * L, y + v.y * L); c.stroke();

  // 判定圈（實際判定大小）
  if (me) { c.strokeStyle = '#ffe28a'; c.lineWidth = px(1.5); circle(c, x, y, HIT); c.stroke(); }

  // 眩暈：頭上轉圈的星星
  if (stunned) {
    for (let i = 0; i < 3; i++) { const a = G.t * 4 + (i * 2 * Math.PI) / 3; c.fillStyle = '#ffe066'; circle(c, x + Math.cos(a) * 1.1, y - r - 0.8 + Math.sin(a) * 0.35, 0.22); c.fill(); }
  }
  if (e.embs.length) { c.fillStyle = '#c05bff'; circle(c, x - 0.5, y - r - 0.7, 0.4); c.fill(); }
  if ((e.flareUntil ?? 0) > G.t) { c.fillStyle = '#ff9b3d'; circle(c, x + 0.5, y - r - 0.8, 0.55); c.fill(); }
  // P3 頭上標記
  if (e.mark && e.mark.until > G.t) {
    const col = { seed: '#c05bff', charge: '#ffb84a', spread: '#a46bff', dive: '#ff5d6c', impale: '#ff5d6c' }[e.mark.kind];
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = px(2);
    if (e.mark.kind === 'seed') { circle(c, x, y - r - 1.3, 0.55); c.fill(); }
    else if (e.mark.kind === 'spread') { circle(c, x, y, r + 1.2); c.stroke(); }
    else { circle(c, x, y - r - 1.3, 0.7); c.stroke(); circle(c, x, y - r - 1.3, 0.25); c.fill(); }
  }
  if (e.curse && e.curse > G.t) { c.fillStyle = '#7a2a9c'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r + 0.8, e.face - Math.PI / 2 - 0.26, e.face - Math.PI / 2 + 0.26); c.closePath(); c.fill(); }
  if (G.extra.holy && e.role[0] === 'H') { c.strokeStyle = '#f2c94c'; c.lineWidth = px(2); circle(c, x, y, r + 0.9); c.stroke(); }
  if (G.extra.beam && Object.values(G.extra.beam).includes(e) && G.cast && G.cast.name === '連射式波動炮') {
    c.strokeStyle = '#f2c94c'; c.lineWidth = px(2); c.setLineDash([px(4), px(3)]);
    circle(c, x, y, r + 1.1); c.stroke(); c.setLineDash([]);
  }
  if (has(G, e, 'akb')) { c.strokeStyle = '#43df9f'; c.lineWidth = px(2); circle(c, x, y, r + 0.5); c.stroke(); }
  if (me) {
    // 自己的暗之擁抱倒數顯示在頭上
    const emb = e.embs.slice().sort((a, b) => a.exp - b.exp)[0];
    if (emb && emb.exp - G.t <= 10) text(c, (emb.exp - G.t).toFixed(1), x, y - 3.9, 13, emb.exp - G.t <= 5 ? '#ff9aa4' : '#e2c6ff');
    if (e.curse && e.curse - G.t <= 10 && e.curse > G.t) text(c, `詛 ${(e.curse - G.t).toFixed(1)}`, x, y - 3.9, 13, e.curse - G.t <= 3 ? '#ff9aa4' : '#e2c6ff');
    text(c, stone ? '石化' : '你', x, y - 2.5, 13, stone ? '#cfcfcf' : '#fff');
  }
  c.restore();
}
