// 右側說明卡與時間軸列表（點機制可「從這裡開始練」）
import { fmtT } from '../core/format';
import { getDrill } from '../drills';
import type { Session } from '../game/session';
import { $ } from './dom';
import { parseRand } from '../drills/random';
import { randPanelHtml, bindRandPanel } from './randpanel';

export function renderBrief(session: Session): void {
  const D = getDrill(session.cfg.drill), G = session.G;
  const rand = parseRand(session.cfg.drill);
  let h = `<h3>${rand ? '隨機練習' : D.group === 'p2' ? 'P3 華容道（數值多為估計）' : D.tl ? '目前練習' : '單一機制'}</h3><h4>${D.name}</h4><p class="muted btext" id="bText" style="color:var(--fg)">${D.brief}</p><button class="linkbtn" id="bMore" hidden>看完整說明</button>`;
  if (rand) h += randPanelHtml(rand, session.cfg);
  if (G && G.auto) h += `<div class="row"><span class="muted">教學示範中…</span><button class="btn ghost sm" id="bRe">自己練（R）</button></div>`;
  $('brief').innerHTML = h;
  // 說明太長就先收起來（6 行），按鈕展開
  const bt = $('bText'), more = $('bMore');
  if (bt.scrollHeight > bt.clientHeight + 4) {
    more.hidden = false;
    more.onclick = () => { const open = bt.classList.toggle('open'); more.textContent = open ? '收起說明' : '看完整說明'; };
  }
  // 時間軸：獨立一張卡片，固定高度、內部捲動（打到哪會自動捲過去）
  const sc = $('seqCard');
  sc.hidden = !(D.tl && G);
  if (D.tl && G) {
    const canStart = !session.cfg.drill.startsWith('weak:');
    let t = `<h3>時間軸</h3>`;
    if (canStart) t += `<p class="muted">點機制可以從那裡開始練（前面由 Bot 照攻略代打）。${session.startAt > 0 ? `目前從 <b>${fmtT(session.startAt)}</b> 開始　<button class="btn ghost sm" id="bFrom0">從頭開始</button>` : ''}</p>`;
    t += `<ul class="seq" id="seq">${G.seq.map((s, i) => {
      const cls = [s.emb ? 'emb' : '', Math.abs(s.t - session.startAt) < 0.01 && session.startAt > 0 ? 'start' : ''].join(' ');
      const inner = `<span>${fmtT(s.t)}</span>${s.label}`;
      return `<li class="${cls}">${canStart && !s.emb && s.t > 0 ? `<button data-from="${i}" title="從這裡開始練">${inner}</button>` : inner}</li>`;
    }).join('')}</ul>`;
    sc.innerHTML = t;
  }
  if (rand) bindRandPanel(session, rand);
  const bRe = document.getElementById('bRe');
  if (bRe) bRe.onclick = (e) => { (e.target as HTMLElement).blur(); session.newGame(); };
  const b0 = document.getElementById('bFrom0');
  if (b0) b0.onclick = () => { session.startAt = 0; session.newGame(); };
  $('seqCard').querySelectorAll<HTMLButtonElement>('[data-from]').forEach((b) => {
    b.onclick = () => { session.startAt = G!.seq[+b.dataset.from!].t; session.newGame(); };
  });
}
