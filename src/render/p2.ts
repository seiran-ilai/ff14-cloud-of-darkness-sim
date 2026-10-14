// P2繪製：環狀地板、平臺、井字格子（站立計時、變紅、消失）、塔、王與小王
import { P2, P3 } from '../core/tuning';
import { CELLS, sbPos, sbFacing, cellUnder } from '../core/p2';
import { dirV } from '../core/geometry';
import type { RenderState } from '../game/state';
import { px, text, circle } from './canvas';

export function drawP2Field(c: CanvasRenderingContext2D, G: RenderState): void {
  const s = G.p2!;
  c.fillStyle = '#07060d';
  c.fillRect(-90, -90, 180, 180);
  // 環狀地板（出血中變紅）
  const bleed = s.bleedUntil > G.t;
  c.beginPath();
  c.arc(0, 0, P2.ring1, 0, Math.PI * 2);
  c.arc(0, 0, P2.ring0, 0, Math.PI * 2, true);
  c.fillStyle = bleed ? 'rgba(150,30,50,.55)' : '#2a2240';
  c.fill('evenodd');
  c.strokeStyle = bleed ? '#ff5d6c' : '#8c79c4'; c.lineWidth = px(1.5);
  circle(c, 0, 0, P2.ring0); c.stroke(); circle(c, 0, 0, P2.ring1); c.stroke();
  if (bleed) text(c, '出血', 0, -(P2.ring0 + P2.ring1) / 2, 12, '#ff9aa4', 700);
  // 平臺
  [-1, 1].forEach((side) => {
    c.fillStyle = '#3a2f55';
    c.fillRect(side < 0 ? -P2.px1 : P2.px0, -P2.ph, P2.px1 - P2.px0, P2.ph * 2);
    c.strokeStyle = '#8c79c4'; c.lineWidth = px(2);
    c.strokeRect(side < 0 ? -P2.px1 : P2.px0, -P2.ph, P2.px1 - P2.px0, P2.ph * 2);
  });
  // 格子
  const me = G.ents.indexOf(G.player), myCell = cellUnder(G.player);
  CELLS.forEach((cell) => {
    const cs = s.cells[cell.idx];
    const g = 0.12;
    if (cs.goneUntil !== null) {
      c.setLineDash([px(4), px(4)]); c.strokeStyle = 'rgba(255,93,108,.6)'; c.lineWidth = px(1.5);
      c.strokeRect(cell.x0 + g, cell.y0 + g, P2.cell - 2 * g, P2.cell - 2 * g); c.setLineDash([]);
      return;
    }
    const red = cs.doomAt !== null || cs.stand >= P2.standRed;
    const k = Math.min(1, cs.stand / P2.standRed);
    c.fillStyle = red ? (Math.floor(G.t * 6) % 2 ? '#b8323f' : '#7a1f2a') : `rgb(${58 + k * 60},${50 + k * 10},${80 - k * 30})`;
    c.fillRect(cell.x0 + g, cell.y0 + g, P2.cell - 2 * g, P2.cell - 2 * g);
    c.strokeStyle = cell.cross ? '#b4a3e6' : '#6d5a92'; c.lineWidth = px(cell.cross ? 1.6 : 1);
    c.strokeRect(cell.x0 + g, cell.y0 + g, P2.cell - 2 * g, P2.cell - 2 * g);
    // 自己站的格子顯示站立秒數
    if (myCell === cell && cs.who === me && cs.stand > 0) text(c, cs.stand.toFixed(0), cell.cx, cell.cy + 1.3, 11, red ? '#ffd4d9' : '#e8e0ff', 700);
  });
  // 內場塔（圓形紋路）
  s.innerTowers.forEach((t) => t.cells.forEach((i) => {
    const cell = CELLS[i];
    c.strokeStyle = t.need === 2 ? '#ffd36b' : '#8bdcff'; c.lineWidth = px(2.5);
    circle(c, cell.cx, cell.cy, 1.3); c.stroke();
    circle(c, cell.cx, cell.cy, 0.7); c.stroke();
    text(c, String(t.need), cell.cx, cell.cy, 11, '#fff');
  }));
  if (s.innerTowers.length) s.innerTowers.filter((t) => t.cells.length === 2).forEach((t) => {
    const a = CELLS[t.cells[0]], b = CELLS[t.cells[1]];
    c.strokeStyle = 'rgba(255,211,107,.7)'; c.lineWidth = px(2); c.setLineDash([px(3), px(3)]);
    c.beginPath(); c.moveTo(a.cx, a.cy); c.lineTo(b.cx, b.cy); c.stroke(); c.setLineDash([]);
  });
  // 外場三人塔
  s.outerTowers.forEach((t) => {
    c.fillStyle = 'rgba(139,220,255,.18)'; c.strokeStyle = '#8bdcff'; c.lineWidth = px(2.5);
    circle(c, t.x, t.y, t.r); c.fill(); c.stroke();
    text(c, String(t.need), t.x, t.y, 12, '#fff');
  });
  // 暗之荊棘：紫色帶刺的圓
  s.thorns.forEach((t) => {
    const R = P3.seed.thornR;
    c.fillStyle = 'rgba(120,40,160,.55)'; circle(c, t.x, t.y, R); c.fill();
    c.strokeStyle = '#d68bff'; c.lineWidth = px(1.5);
    c.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 + G.t * 0.5; c.moveTo(t.x + Math.cos(a) * R * 0.6, t.y + Math.sin(a) * R * 0.6); c.lineTo(t.x + Math.cos(a) * (R + 0.6), t.y + Math.sin(a) * (R + 0.6)); }
    c.stroke();
  });
  // 荊棘叢生連線：荊棘 → 人、內場兩人互連
  s.links.forEach((l) => {
    const a = G.ents[l.a], b = l.b !== undefined ? G.ents[l.b] : null;
    if (!a) return;
    const from = b ? { x: b.x, y: b.y } : { x: l.x!, y: l.y! };
    c.strokeStyle = `rgba(214,139,255,${0.55 + 0.35 * Math.sin(G.t * 8)})`; c.lineWidth = px(2.5); c.setLineDash([px(6), px(4)]);
    c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(a.x, a.y); c.stroke(); c.setLineDash([]);
  });
}

/** 王（中央）與兩隻小王（平臺上，面向場外；特效：左右觸手、雙手、身體中心） */
export function drawP2Bosses(c: CanvasRenderingContext2D, G: RenderState): void {
  // 恐懼之雲的提示：王身邊的紫色環形暗雲／方形暗雲
  const fear = G.p2!.fear;
  if (fear && fear.until > G.t) {
    const k = 0.5 + 0.3 * Math.sin(G.t * 6);
    c.strokeStyle = `rgba(170,90,255,${k})`; c.lineWidth = px(6);
    if (fear.kind === 'ring') { circle(c, 0, 0, 6.5); c.stroke(); }
    else { c.strokeRect(-5.5, -5.5, 11, 11); }
  }
  // 凝聚式＝橙黃色蓄能（往內收的光環）、分散式＝紫黑色懸浮球（繞王轉）、迴旋式＝面向前後的箭頭＋旋轉方向弧線
  const aura = G.p2!.aura;
  if (aura && aura.until > G.t) {
    if (aura.kind === 'charge') {
      const k = (G.t * 1.5) % 1;
      c.strokeStyle = `rgba(255,184,74,${0.9 - 0.6 * k})`; c.lineWidth = px(4);
      circle(c, 0, 0, 8 - 4 * k); c.stroke();
      c.fillStyle = 'rgba(255,184,74,.22)'; circle(c, 0, 0, 4.2); c.fill();
    } else if (aura.kind === 'spread') {
      for (let i = 0; i < 6; i++) {
        const a = G.t * 1.2 + (i * Math.PI) / 3, bx = Math.cos(a) * 5.5, by = Math.sin(a) * 5.5 - 0.6 * Math.sin(G.t * 4 + i);
        c.fillStyle = '#2a1238'; circle(c, bx, by, 1); c.fill();
        c.strokeStyle = '#a46bff'; c.lineWidth = px(1.5); c.stroke();
      }
    } else {
      const f = dirV(aura.face!);
      c.strokeStyle = '#ffd36b'; c.lineWidth = px(3);
      [1, -1].forEach((s) => { c.beginPath(); c.moveTo(f.x * 4 * s, f.y * 4 * s); c.lineTo(f.x * 7 * s, f.y * 7 * s); c.stroke(); });
      // 旋轉方向：王周圍一整圈的環形箭頭（整圈＋等間隔的箭頭，慢慢往旋轉方向轉）；順時針橘色、逆時針藍色
      const RR = 6, col = aura.dir! > 0 ? '#ff9b3d' : '#5cc8ff';
      c.strokeStyle = col; c.globalAlpha = 0.85; c.lineWidth = px(2.5);
      circle(c, 0, 0, RR); c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = col;
      for (let i = 0; i < 6; i++) {
        // 箭頭：尖端沿切線往旋轉方向，底邊沿半徑方向
        const a = (i * Math.PI) / 3 + aura.dir! * G.t * 0.8;
        const rx = Math.cos(a), ry = Math.sin(a), tx = -ry * aura.dir!, ty = rx * aura.dir!, px0 = rx * RR, py0 = ry * RR;
        c.beginPath(); c.moveTo(px0 + tx * 1.4, py0 + ty * 1.4); c.lineTo(px0 + rx * 0.8, py0 + ry * 0.8); c.lineTo(px0 - rx * 0.8, py0 - ry * 0.8); c.closePath(); c.fill();
      }
    }
  }
  c.fillStyle = 'rgba(120,80,200,.18)'; circle(c, 0, 0, 4.5); c.fill();
  c.fillStyle = '#120d1e'; circle(c, 0, 0, 3); c.fill();
  c.strokeStyle = '#b99cff'; c.lineWidth = px(2); c.stroke();
  text(c, '暗黑之雲', 0, 0, 12, '#eae4fb');
  if (G.p2!.vanished) return;
  G.p2!.sb.forEach((b) => {
    const p = b.at ?? sbPos(b.side), f = dirV(sbFacing(b.side)), r = { x: -f.y, y: f.x };
    const glowL = b.glow === 'L' || b.glow === 'B', glowR = b.glow === 'R' || b.glow === 'B';
    // 觸手：左右兩隻
    [[-1, glowL], [1, glowR]].forEach(([s, on]) => {
      const sg = s as number;
      const ex = p.x + r.x * sg * 2.6 + f.x * 1.2, ey = p.y + r.y * sg * 2.6 + f.y * 1.2;
      c.strokeStyle = on ? '#ffd36b' : '#6d5a92'; c.lineWidth = px(5); c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x + r.x * sg * 1.2, p.y + r.y * sg * 1.2); c.lineTo(ex, ey); c.stroke();
      if (on) { c.fillStyle = '#fff2c2'; circle(c, ex, ey, 0.8); c.fill(); }
    });
    c.fillStyle = b.glow === 'C' ? '#3b1b4f' : '#1a1226'; circle(c, p.x, p.y, 1.6); c.fill();
    c.strokeStyle = '#c05bff'; c.lineWidth = px(2); c.stroke();
    if (b.glow === 'C') { c.fillStyle = 'rgba(30,10,40,.6)'; circle(c, p.x, p.y, 2.6 + 0.3 * Math.sin(G.t * 8)); c.fill(); c.fillStyle = '#ff9bff'; circle(c, p.x, p.y, 0.6); c.fill(); }
    // 面向
    c.fillStyle = '#c05bff';
    c.beginPath(); c.moveTo(p.x + f.x * 2.6, p.y + f.y * 2.6); c.lineTo(p.x + f.x * 1.6 + r.x * 0.7, p.y + f.y * 1.6 + r.y * 0.7); c.lineTo(p.x + f.x * 1.6 - r.x * 0.7, p.y + f.y * 1.6 - r.y * 0.7); c.closePath(); c.fill();
    text(c, '小王', p.x, p.y - 3.4, 11, '#e2c6ff', 700);
  });
}
