// 遊戲畫面上的 HUD：詠唱條、王台詞對話框、提示、增減益圖示列、右上資訊、失誤 toast、時間軸目前位置
import { DIRNAME, fmtT } from '../core/format';
import { hasBuff, type GameState } from '../game/state';
import type { InputState } from '../game/simulation';
import { $ } from './dom';
import { playerCellTime } from '../game/p2state';
import { updActionBar } from './actionbar';

interface Icon { glyph: string; name: string; left: number; kind: 'debuff' | 'buff'; mine?: boolean; total?: number }

function icons(G: GameState): Icon[] {
  const P = G.player, out: Icon[] = [];
  P.embs.slice().sort((a, c) => a.exp - c.exp).forEach((m) => out.push({ glyph: '擁', name: '暗之擁抱', left: m.exp - G.t, kind: 'debuff', mine: true }));
  if (hasBuff(G, P, 'heavy')) out.push({ glyph: '重', name: '加重', left: P.buffs.heavy! - G.t, kind: 'debuff', mine: true });
  if (P.stun > G.t) out.push({ glyph: P.stunKind === 'stone' ? '石' : '暈', name: P.stunKind === 'stone' ? '石化' : '眩暈', left: P.stun - G.t, kind: 'debuff', mine: true });
  if (hasBuff(G, P, 'bleed')) out.push({ glyph: '血', name: '出血', left: P.buffs.bleed! - G.t, kind: 'debuff' });
  if (hasBuff(G, P, 'sprint')) out.push({ glyph: '疾', name: '疾跑', left: P.buffs.sprint! - G.t, kind: 'buff' });
  if (hasBuff(G, P, 'akb')) out.push({ glyph: '防', name: '防擊退', left: P.buffs.akb! - G.t, kind: 'buff' });
  return out;
}

const fmtLeft = (s: number): string => (s >= 10 ? String(Math.ceil(s)) : s.toFixed(1));

export function updHUD(G: GameState | null, input: InputState): void {
  if (!G) return;
  const cw = $('castW');
  if (G.cast && G.t < G.cast.start + G.cast.dur && G.state === 'run') {
    cw.hidden = false;
    const k = (G.t - G.cast.start) / G.cast.dur;
    $('castN').textContent = G.cast.name;
    $('castF').style.width = k * 100 + '%';
    $('castT').textContent = Math.max(0, G.cast.start + G.cast.dur - G.t).toFixed(1);
  } else cw.hidden = true;

  const ln = $('line');
  if (G.line && G.t < G.line.until) { ln.hidden = false; $('lineT').textContent = G.line.text; } else ln.hidden = true;
  const al = $('alert');
  if (G.alert && G.t < G.alert.until) { al.hidden = false; al.textContent = G.alert.text; al.className = 'hud alert' + (G.alert.danger ? ' danger' : ''); } else al.hidden = true;

  $('status').innerHTML = icons(G).map((i) =>
    `<div class="ico ${i.kind}${i.mine ? ' mine' : ''}${i.kind === 'debuff' && i.left <= 5 ? ' urgent' : ''}" title="${i.name}"><b>${i.glyph}</b><span>${fmtLeft(i.left)}</span><em>${i.name}</em></div>`).join('');

  const P = G.player;
  const ct = playerCellTime(G);
  const cell = ct === null ? '' : `<span>格子 <b style="color:${ct >= 40 ? 'var(--ng)' : ct >= 30 ? 'var(--gold-2)' : 'inherit'}">${ct.toFixed(1)}</b> / 45 秒</span>`;
  $('tr').innerHTML = `<span>時間 <b>${fmtT(G.t)}</b>${G.ff ? ' ・快轉 ×2' : ''}</span><span>面向 <b>${DIRNAME(P.face)}</b>${input.rmb ? '（右鍵）' : ''}</span>${cell}${G.tl ? `<span>失誤 <b>${G.fails.length}</b></span>` : ''}`;
  $('toast').innerHTML = G.toasts.slice(-3).map((t) => `<div>${t.text}</div>`).join('');
  updActionBar(G);

  if (G.tl && G.seq.length) {
    const items = document.querySelectorAll('#seq li');
    let cur = -1;
    G.seq.forEach((s, i) => { if (s.t <= G.t + 0.01) cur = i; });
    items.forEach((li, i) => { li.classList.toggle('now', i === cur); li.classList.toggle('done', i < cur); });
  }
}
