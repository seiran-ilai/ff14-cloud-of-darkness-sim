// 右側說明卡與時間軸列表（點機制可「從這裡開始練」）
import { fmtT } from '../core/format';
import { getDrill } from '../drills';
import type { Session } from '../game/session';
import { $ } from './dom';

export function renderBrief(session: Session): void {
  const D = getDrill(session.cfg.drill), G = session.G;
  let h = `<h3>${D.group === 'p2' ? 'P2 華容道（數值多為估計）' : D.tl ? '完整時間軸' : '單一機制'}</h3><h4>${D.name}</h4><p class="muted" style="color:var(--fg)">${D.brief}</p>`;
  h += `<div class="row"><button class="btn ghost sm" id="bDemo">${G && G.auto ? '示範中…' : '看示範（T）'}</button><button class="btn ghost sm" id="bRe">自己練（R）</button></div>`;
  if (D.tl && G) {
    const canStart = !session.cfg.drill.startsWith('weak:');
    if (canStart) h += `<p class="muted">點下面的機制可以從那裡開始練（前面由 Bot 照攻略代打）。${session.startAt > 0 ? `目前從 <b>${fmtT(session.startAt)}</b> 開始　<button class="btn ghost sm" id="bFrom0">從頭開始</button>` : ''}</p>`;
    h += `<ul class="seq" id="seq">${G.seq.map((s, i) => {
      const cls = [s.emb ? 'emb' : '', Math.abs(s.t - session.startAt) < 0.01 && session.startAt > 0 ? 'start' : ''].join(' ');
      const inner = `<span>${fmtT(s.t)}</span>${s.label}`;
      return `<li class="${cls}">${canStart && !s.emb && s.t > 0 ? `<button data-from="${i}" title="從這裡開始練">${inner}</button>` : inner}</li>`;
    }).join('')}</ul>`;
  }
  $('brief').innerHTML = h;
  $('bDemo').onclick = (e) => { (e.target as HTMLElement).blur(); session.newGame(true); };
  $('bRe').onclick = (e) => { (e.target as HTMLElement).blur(); session.newGame(); };
  const b0 = document.getElementById('bFrom0');
  if (b0) b0.onclick = () => { session.startAt = 0; session.newGame(); };
  $('brief').querySelectorAll<HTMLButtonElement>('[data-from]').forEach((b) => {
    b.onclick = () => { session.startAt = G!.seq[+b.dataset.from!].t; session.newGame(); };
  });
  $('seedNow').textContent = G ? String(G.rng.seed) : '—';
}
