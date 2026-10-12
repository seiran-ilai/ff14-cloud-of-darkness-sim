// 上方：聯盟、職能、練習項目選擇；右側：本項目紀錄、最常錯的機制、種子
import { ALS, ROLES, type Alliance, type Role } from '../core/constants';
import { saveConfig } from '../core/config';
import { DRILLS, WEAK_PREFIX } from '../drills';
import { singleForMech } from '../drills/singles';
import type { Drill } from '../game/state';
import type { Session } from '../game/session';
import { getDrillStat, worstMechs, clearMechStats } from '../game/stats';
import { $, seg } from './dom';

export function renderStats(session: Session): void {
  const s = getDrillStat(session.cfg.drill);
  $('sOk').textContent = String(s.ok);
  $('sAll').textContent = String(s.all);
  $('sStreak').textContent = String(s.streak);
  renderWeak(session);
}

/** 最常錯的 3 個機制，一鍵只練那幾個 */
function renderWeak(session: Session): void {
  const w = worstMechs(3);
  const keys = [...new Set(w.map((m) => singleForMech(m.mech)).filter((k): k is string => !!k))];
  $('weak').innerHTML = `<h3>最常錯的機制</h3>${w.length
    ? `<ul class="weaklist">${w.map((m) => `<li><span>${m.mech}</span><span>成功率 <b>${Math.round(m.rate * 100)}%</b>（${m.ok}/${m.all}）</span></li>`).join('')}</ul>
       <div class="row">${keys.length ? '<button class="btn sm" id="wGo">只練這幾個</button>' : ''}<button class="btn ghost sm" id="wClr">清除紀錄</button></div>`
    : '<p class="muted">還沒有失誤紀錄。自己練（不是看示範）結束後會統計每個機制的成功率。</p>'}`;
  const go = document.getElementById('wGo');
  if (go) go.onclick = () => pickDrill(session, WEAK_PREFIX + keys.join(','));
  const clr = document.getElementById('wClr');
  if (clr) clr.onclick = () => { clearMechStats(); renderWeak(session); };
}

export function pickDrill(session: Session, key: string): void {
  session.cfg.drill = key;
  session.startAt = 0;
  saveConfig(session.cfg);
  renderTop(session);
  session.newGame();
}

export function renderTop(session: Session): void {
  const cfg = session.cfg;
  seg($('alSeg'), ALS, cfg.al, (v) => { cfg.al = v as Alliance; saveConfig(cfg); renderTop(session); session.newGame(); });
  seg($('roleSeg'), ROLES, cfg.role, (v) => { cfg.role = v as Role; saveConfig(cfg); renderTop(session); session.newGame(); });
  const btn = ([k, d]: [string, Drill]): string => `<button class="drill${d.tl ? ' tl' : ''}" data-k="${k}" aria-pressed="${k === cfg.drill}"><b>${d.name}</b><span>${d.sub}</span></button>`;
  const ents = Object.entries(DRILLS);
  $('drillsTl').innerHTML = '<span class="lbl">時間軸</span>' + ents.filter(([, d]) => d.tl).map(btn).join('');
  $('drillsOne').innerHTML = '<span class="lbl">單一機制</span>' + ents.filter(([, d]) => !d.tl && !d.group).map(btn).join('');
  $('drillsP2').innerHTML = '<span class="lbl">P2 華容道</span>' + ents.filter(([, d]) => d.group === 'p2').map(btn).join('');
  renderStats(session);
}

export function bindDrillPicker(session: Session): void {
  ['drillsTl', 'drillsOne', 'drillsP2'].forEach((id) => {
    $(id).onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.drill');
      if (!b) return;
      pickDrill(session, b.dataset.k!);
      b.blur();
    };
  });
  $('seedGo').onclick = () => {
    const v = ($('seedIn') as HTMLInputElement).value.trim();
    if (!/^\d+$/.test(v)) { ($('seedIn') as HTMLInputElement).focus(); return; }
    session.newGame(false, Number(v) >>> 0);
  };
}
