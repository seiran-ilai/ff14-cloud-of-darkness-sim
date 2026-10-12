// 遊戲畫面覆蓋層：倒數、暫停、結算（判定依時間排序，點一下回放那幾秒；顯示種子）
import { fmtT } from '../core/format';
import type { Session } from '../game/session';
import { $ } from './dom';
import { startReplay } from './replay';

export function renderOverlay(session: Session): void {
  const ov = $('ov'), G = session.G;
  if (!G) { ov.hidden = true; return; }
  if (G.state === 'count') {
    ov.hidden = false;
    ov.style.background = 'rgba(6,5,11,.35)';
    const from = G.startAt > 0 ? `<p class="muted" style="text-align:center">從 ${fmtT(G.startAt)} 開始</p>` : '';
    ov.innerHTML = `<div><div class="count">${Math.max(1, Math.ceil(G.countT))}</div>${from}</div>`;
    return;
  }
  if (G.paused) {
    ov.hidden = false;
    ov.style.background = '';
    ov.innerHTML = `<div class="ocard"><h2>暫停</h2><div class="row"><button class="btn" id="oRes">繼續（Esc）</button><button class="btn ghost" id="oRe">重來（R）</button></div></div>`;
    $('oRes').onclick = () => session.togglePause();
    $('oRe').onclick = () => session.newGame();
    return;
  }
  if (G.state === 'end') {
    const ok = !!G.result?.ok;
    ov.hidden = false;
    ov.style.background = '';
    const checks = G.checks.slice().sort((a, b) => a.t - b.t);
    const cks = checks.map((c, i) => `<li class="${c.warn ? 'warn' : c.ok ? '' : 'ng'}"><button data-ck="${i}" title="回放這個判定的前後幾秒"><span class="tg">${fmtT(c.t)} ${c.tag}</span>　${c.text}<span class="rp">▶ 回放</span></button></li>`).join('');
    const title = (G.auto ? '示範結束：' : '') + (ok ? (G.tl ? '完美通過' : '處理成功') : G.tl ? `失誤 ${G.fails.length} 次` : '失敗');
    ov.innerHTML = `<div class="ocard ${ok ? 'ok' : 'ng'}"><h2>${title}</h2>
      <p class="endseed">種子 <b>${G.rng.seed}</b>${G.startAt > 0 ? `・從 ${fmtT(G.startAt)} 開始` : ''}　點任一判定可慢動作回放並標出正確位置</p>
      <ul class="checks">${cks || '<li>沒有紀錄</li>'}</ul>
      <div class="row"><button class="btn" id="oRe">再來一次（R）</button><button class="btn ghost" id="oSame">同種子重打</button><button class="btn ghost" id="oDemo">看示範</button></div></div>`;
    $('oRe').onclick = () => session.newGame();
    $('oSame').onclick = () => session.newGame(false, G.rng.seed);
    $('oDemo').onclick = () => session.newGame(true, G.rng.seed);
    ov.querySelectorAll<HTMLButtonElement>('[data-ck]').forEach((b) => {
      b.onclick = () => {
        const c = checks[+b.dataset.ck!];
        if (!startReplay(session.rec.frames, c, () => renderOverlay(session))) b.querySelector('.rp')!.textContent = '（沒有錄到）';
      };
    });
    return;
  }
  ov.hidden = true;
}
