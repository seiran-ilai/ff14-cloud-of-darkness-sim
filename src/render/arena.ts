// 場地、格線、方位字
import { R } from '../core/constants';
import { px, text, diamondPath } from './canvas';

export function drawArena(c: CanvasRenderingContext2D): void {
  const g = c.createRadialGradient(0, 0, 4, 0, 0, 48);
  g.addColorStop(0, '#150f24');
  g.addColorStop(1, '#05040a');
  c.fillStyle = g;
  c.fillRect(-90, -90, 180, 180);
  diamondPath(c);
  const fg = c.createLinearGradient(0, -R, 0, R);
  fg.addColorStop(0, '#3a2f55');
  fg.addColorStop(1, '#2a2240');
  c.fillStyle = fg;
  c.fill();
  c.strokeStyle = '#8c79c4';
  c.lineWidth = px(2.5);
  c.stroke();
  c.strokeStyle = 'rgba(160,140,210,.28)';
  c.lineWidth = px(1);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    c.beginPath(); c.moveTo(-R * (1 - t), -R * t); c.lineTo(R * t, R * (1 - t)); c.stroke();
    c.beginPath(); c.moveTo(R * (1 - t), -R * t); c.lineTo(-R * t, R * (1 - t)); c.stroke();
  }
  text(c, '東', R + 2, 0, 14, 'rgba(200,190,230,.6)', 700);
  text(c, '西', -R - 2, 0, 14, 'rgba(200,190,230,.6)', 700);
  text(c, '南', 0, R + 2, 14, 'rgba(200,190,230,.6)', 700);
}
