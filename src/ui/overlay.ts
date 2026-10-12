// 遊戲畫面覆蓋層：準備（選模式、開始）、倒數、暫停、錯誤即停的失誤分析、結算
import { fmtT } from '../core/format';
import { saveConfig, type Config } from '../core/config';
import { getDrill } from '../drills';
import { singles, singleForMech } from '../drills/singles';
import { mechName } from '../game/results';
import type { Check } from '../game/state';
import type { Session } from '../game/session';
import { $, seg } from './dom';
import { startReplay } from './replay';

const MODE_NOTE: Record<Config['failMode'], string> = {
  stop: '犯錯就立刻停下，分析錯在哪、正確該怎麼做，可以從這個機制重來。',
  continue: '犯錯也不停（陣亡也繼續），打完整段再一次看所有判定。',
};

/** 失誤分析：這個機制的攻略處理（有單練說明就用，沒有就用目前練習的說明） */
function howTo(session: Session, c: Check): string {
  const k = singleForMech(mechName(c.tag));
  return k ? singles[k].brief : getDrill(session.cfg.drill).brief;
}

function renderReady(session: Session): void {
  const ov = $('ov'), G = session.G!, cfg = session.cfg, D = getDrill(cfg.drill);
  ov.hidden = false;
  ov.style.background = '';
  ov.innerHTML = `<div class="ocard"><h2>${D.name}</h2>
    <p class="muted">${G.startAt > 0 ? `從 <b>${fmtT(G.startAt)}</b> 開始（前面由 Bot 代打）・` : ''}種子 ${G.rng.seed}</p>
    <div class="set"><span class="lbl">模式</span><span class="grp" id="oMode"></span></div>
    <p class="muted">${MODE_NOTE[cfg.failMode]}</p>
    <div class="row"><button class="btn" id="oStart">開始（Enter）</button><button class="btn ghost" id="oDemo">看示範（T）</button></div></div>`;
  seg($('oMode'), ['stop', 'continue'], cfg.failMode, (v) => { cfg.failMode = v as Config['failMode']; saveConfig(cfg); renderReady(session); }, (v) => (v === 'stop' ? '錯誤即停' : '錯誤不停'));
  $('oStart').onclick = () => session.start();
  $('oDemo').onclick = () => session.newGame(true, G.rng.seed, G.startAt);
  $('oStart').focus();
}

/** 錯誤即停：分析這個失誤 */
function renderStop(session: Session, c: Check): void {
  const ov = $('ov'), G = session.G!;
  const from = c.from ?? 0;
  ov.hidden = false;
  ov.style.background = '';
  ov.innerHTML = `<div class="ocard ng"><h2>失誤：${c.tag}</h2>
    <ul class="checks"><li class="ng"><span><span class="tg">${fmtT(c.t)}</span>　${c.text}</span></li></ul>
    ${c.fix ? `<p><b style="color:var(--ok)">正確處理：</b>${c.fix.label}（回放裡用綠圈標出）</p>` : ''}
    <p class="muted" style="color:var(--fg)"><b>攻略：</b>${howTo(session, c)}</p>
    <div class="row">
      <button class="btn" id="oFrom">從此機制開始（${fmtT(from)}）</button>
      <button class="btn ghost" id="oRe">重新開始</button>
      <button class="btn ghost" id="oRp">回放這段</button>
      <button class="btn ghost" id="oDemo">看這段示範</button>
    </div></div>`;
  $('oFrom').onclick = () => { session.startAt = from; session.newGame(false, G.rng.seed); };
  $('oRe').onclick = () => { session.startAt = 0; session.newGame(); };
  $('oDemo').onclick = () => session.newGame(true, G.rng.seed, from);
  $('oRp').onclick = () => { if (!startReplay(session.rec.frames, c, () => renderOverlay(session))) $('oRp').textContent = '（沒有錄到）'; };
  $('oFrom').focus();
}

export function renderOverlay(session: Session): void {
  const ov = $('ov'), G = session.G;
  if (!G) { ov.hidden = true; return; }
  if (G.state === 'ready') { renderReady(session); return; }
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
  if (G.state === 'end' && G.stopCheck) { renderStop(session, G.stopCheck); return; }
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
