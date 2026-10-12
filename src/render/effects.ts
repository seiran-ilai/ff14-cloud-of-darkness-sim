// 判定特效：連線、擊退／吸引、命中、直線、核爆、分攤、暗之刃、石化視線、連射直線
import { BOSS } from '../core/constants';
import { dirV } from '../core/geometry';
import { BLADE } from '../core/tuning';
import { POCKET } from '../core/positions';
import type { Effect, RenderState } from '../game/state';
import { px, circle, diamondPath } from './canvas';
import { lanePoly, drawBurst } from './telegraphs';

export function drawFx(c: CanvasRenderingContext2D, f: Effect, G: RenderState): void {
  c.save();
  switch (f.k) {
    case 'tether':
      c.strokeStyle = 'rgba(192,91,255,.6)'; c.lineWidth = px(1.3);
      f.members.forEach((e) => { c.beginPath(); c.moveTo(BOSS.x, BOSS.y + 8); c.lineTo(e.x, e.y); c.stroke(); });
      break;
    case 'kb':
    case 'pull': {
      c.strokeStyle = f.k === 'kb' ? '#8bdcff' : '#ff7a8a'; c.lineWidth = px(2.5);
      for (let i = 0; i < 8; i++) {
        const v = dirV((i * Math.PI) / 4), a1 = f.k === 'kb' ? 7 : 16, a2 = f.k === 'kb' ? 14 : 9;
        c.beginPath(); c.moveTo(v.x * a1, v.y * a1); c.lineTo(v.x * a2, v.y * a2); c.stroke();
      }
      break;
    }
    case 'hit':
      c.strokeStyle = '#ff5d6c'; c.lineWidth = px(3); circle(c, f.x, f.y, 1.6); c.stroke();
      break;
    case 'lane':
      c.fillStyle = 'rgba(255,170,90,.55)';
      f.lanes.forEach((i) => { lanePoly(c, f.fam, i); c.fill(); });
      break;
    case 'flare': {
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 18);
      g.addColorStop(0, 'rgba(255,150,60,.75)'); g.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = g; circle(c, f.x, f.y, 18); c.fill();
      break;
    }
    case 'stack':
      c.fillStyle = 'rgba(242,201,76,.35)'; c.strokeStyle = '#f2c94c'; c.lineWidth = px(2);
      circle(c, f.x, f.y, f.r ?? 3.2); c.fill(); c.stroke();
      break;
    case 'bladeB':
      c.fillStyle = 'rgba(255,128,48,.4)'; circle(c, BOSS.x, BOSS.y, BLADE.bothR); c.fill();
      break;
    case 'bladeS': {
      const p = POCKET(f.side);
      c.fillStyle = 'rgba(255,128,48,.4)';
      diamondPath(c); c.moveTo(p.x + BLADE.pocketR, p.y); c.arc(p.x, p.y, BLADE.pocketR, 0, Math.PI * 2, true); c.fill('evenodd');
      break;
    }
    case 'gaze':
      c.strokeStyle = 'rgba(255,93,108,.8)'; c.lineWidth = px(2); c.setLineDash([px(6), px(5)]);
      f.srcs.forEach((s) => { c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(G.player.x, G.player.y); c.stroke(); });
      break;
    case 'beams':
      diamondPath(c); c.clip();
      c.fillStyle = 'rgba(242,201,76,.32)';
      f.lines.forEach((l) => {
        const n = { x: -l.v.y, y: l.v.x }, L = 55;
        c.beginPath();
        c.moveTo(BOSS.x + n.x * 2.5, BOSS.y + n.y * 2.5);
        c.lineTo(BOSS.x + n.x * 2.5 + l.v.x * L, BOSS.y + n.y * 2.5 + l.v.y * L);
        c.lineTo(BOSS.x - n.x * 2.5 + l.v.x * L, BOSS.y - n.y * 2.5 + l.v.y * L);
        c.lineTo(BOSS.x - n.x * 2.5, BOSS.y - n.y * 2.5);
        c.closePath(); c.fill();
      });
      break;
    case 'burst':
      drawBurst(c, f.tele, (G.t - f.start) / (f.until - f.start));
      break;
    case 'flash':
      break;
  }
  c.restore();
}
