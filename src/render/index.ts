// 繪製一幀（只讀狀態）。alpha 為固定步長之間的插值比例。
import type { Config } from '../core/config';
import type { EmbraceType, Fix, RenderState } from '../game/state';
import { BOSS } from '../core/constants';
import { dirV } from '../core/geometry';
import { view, px, text, circle, setCamera, worldTransform, lerp } from './canvas';
import { drawArena } from './arena';
import { drawBoss, drawClouds, drawOrbAndEyes, drawPose, activePose } from './boss';
import { drawTele } from './telegraphs';
import { drawFx } from './effects';
import { drawEnt } from './entities';
import { drawP2Field, drawP2Bosses } from './p2';

export interface DrawOpts {
  alpha?: number;
  /** 回放時標出的正確位置 */
  fix?: Fix;
  /** 回放時不顯示提示 */
  noHints?: boolean;
}

export function draw(G: RenderState | null, cfg: Config, opts: DrawOpts = {}): void {
  if (!G) return;
  const alpha = opts.alpha ?? 1;
  const c = view.ctx, cv = view.cv;
  const P = G.player;
  setCamera(cfg.cam, { x: lerp(P.px, P.x, alpha), y: lerp(P.py, P.y, alpha) });
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#05040a';
  c.fillRect(0, 0, cv.width, cv.height);
  worldTransform(c);
  if (G.p2) drawP2Field(c, G); else drawArena(c);
  if (cfg.hint && !opts.noHints) {
    const hs = G.hints.concat(G.embHint ? [G.embHint] : []);
    hs.forEach((h) => {
      if (h.cells) return;
      c.save();
      if (h.r) {
        c.setLineDash([px(6), px(5)]);
        c.strokeStyle = '#43df9f'; c.fillStyle = 'rgba(67,223,159,.12)'; c.lineWidth = px(2);
        circle(c, h.x, h.y, h.r); c.fill(); c.stroke();
      }
      if (h.label) text(c, h.label, h.x, h.y - (h.r || 0) - 1.3, 12, '#43df9f', 700);
      c.restore();
    });
  }
  G.tele.forEach((t) => drawTele(c, t, G.t));
  if (G.p2) drawP2Bosses(c, G);
  else {
    drawClouds(c, G, cfg);
    drawOrbAndEyes(c, G);
    drawBoss(c, G, cfg);
  }
  G.fx.forEach((f) => { if (f.k !== 'flash') drawFx(c, f, G); });
  G.ents.filter((e) => !e.isPlayer).forEach((e) => drawEnt(c, e, G, alpha));
  drawEnt(c, P, G, alpha);
  if (opts.fix) drawFix(c, opts.fix);
  if (G.fx.some((f) => f.k === 'flash')) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(255,60,80,.18)';
    c.fillRect(0, 0, cv.width, cv.height);
  }
  // 跟隨鏡頭時王可能在畫面外：右上角小窗顯示王的手勢
  const pose = activePose(G);
  if (pose && cfg.cam === 'follow') drawPoseInset(c, pose, cfg);
}

function drawPoseInset(c: CanvasRenderingContext2D, pose: EmbraceType, cfg: Config): void {
  const cv = view.cv, D = view.DPR, size = 116 * D, x0 = cv.width - size - 10 * D, y0 = 86 * D;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = 'rgba(10,8,18,.82)'; c.strokeStyle = 'rgba(233,185,73,.7)'; c.lineWidth = 1.5 * D;
  c.beginPath(); c.roundRect(x0, y0, size, size + 22 * D, 10 * D); c.fill(); c.stroke();
  const saved = view.SCALE;
  view.SCALE = size / 9.5;
  // 手掌在心臟上方（包覆）或下方（撈起），把整隻手置中
  const cy = BOSS.y + 8 + (pose === 'cover' ? -1.7 : 1.7);
  c.setTransform(view.SCALE, 0, 0, view.SCALE, x0 + size / 2 - BOSS.x * view.SCALE, y0 + size / 2 - cy * view.SCALE);
  c.fillStyle = '#ff3b5c'; circle(c, BOSS.x, BOSS.y + 8, 1); c.fill();
  drawPose(c, pose, cfg, false);
  view.SCALE = saved;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `900 ${13 * D}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffd36b';
  c.fillText(cfg.text ? (pose === 'cover' ? '包覆（手心）' : '撈起（手背）') : '王的手勢', x0 + size / 2, y0 + size + 8 * D);
}

/** 回放的「正確位置」標記：綠色圈＋（可選）正確面向箭頭 */
function drawFix(c: CanvasRenderingContext2D, f: Fix): void {
  c.save();
  const r = f.r ?? 1.2;
  c.strokeStyle = '#43df9f'; c.fillStyle = 'rgba(67,223,159,.22)'; c.lineWidth = px(3);
  circle(c, f.x, f.y, r); c.fill(); c.stroke();
  if (f.face != null) {
    const v = dirV(f.face), L = r + 2.4;
    c.strokeStyle = '#43df9f'; c.lineWidth = px(4); c.lineCap = 'round';
    c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + v.x * L, f.y + v.y * L); c.stroke();
    const n = { x: -v.y, y: v.x }, tip = { x: f.x + v.x * L, y: f.y + v.y * L };
    c.fillStyle = '#43df9f';
    c.beginPath(); c.moveTo(tip.x + v.x * 0.9, tip.y + v.y * 0.9); c.lineTo(tip.x + n.x * 0.7, tip.y + n.y * 0.7); c.lineTo(tip.x - n.x * 0.7, tip.y - n.y * 0.7); c.closePath(); c.fill();
  }
  text(c, `正確：${f.label}`, f.x, f.y - r - 1.6, 13, '#43df9f');
  c.restore();
}
