// 上方：隊伍、職能、練習項目選擇；右側：本項目紀錄、最常錯的機制
import { ALS, ROLES, type Alliance, type Role } from '../core/constants';
import { saveConfig } from '../core/config';
import { DRILLS, WEAK_PREFIX } from '../drills';
import { parseRun, runKey, type Phase } from '../drills/run';
import type { PickMode } from '../core/config';
import { parseRand, randKey } from '../drills/random';
import { CATALOG } from '../drills/catalog';
import { unrelated, seatText } from '../drills/relevance';

const tl1Key = 'tl1', tl2Key = 'tl2';
import { singleForMech, singles } from '../drills/singles';
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
  // 全部有失誤的機制：錯最多的在上面；清單固定高度、內部捲動
  const w = worstMechs(99);
  const keys = [...new Set(w.slice(0, 3).map((m) => singleForMech(m.mech)).filter((k): k is string => !!k))];
  $('weak').innerHTML = `<h3>常錯機制${w.length ? `（${w.length}）` : ''}</h3>${w.length
    ? `<div class="weakhead"><span>機制</span><span>失誤</span><span>成功率</span></div>
       <ul class="weaklist">${w.map((m) => `<li><span class="wn" title="${m.mech}">${m.mech}</span><b>${m.all - m.ok}</b>
         <span class="wr"><i style="width:${Math.round(m.rate * 100)}%"></i><em>${Math.round(m.rate * 100)}%</em></span></li>`).join('')}</ul>
       <div class="row">${keys.length ? '<button class="btn sm" id="wGo">只練最常錯的</button>' : ''}<button class="btn ghost sm" id="wClr">清除紀錄</button></div>`
    : '<p class="muted">還沒有失誤紀錄。自己練（不是教學示範）結束後會統計每個機制的成功率。</p>'}`;
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
  $('seatInfo').textContent = seatText(cfg.al, cfg.role);
  // 跟座位無關的機制變淡（還是可以點）；按鈕只顯示名稱，說明放在滑鼠提示
  const btn = ([k, d]: [string, Drill]): string => {
    const why = unrelated(k, cfg.al, cfg.role);
    return `<button class="drill${why ? ' dim' : ''}" data-k="${k}" aria-pressed="${k === cfg.drill}" title="${why ? `跟你的座位無關：${why}` : d.sub}">${d.name}</button>`;
  };
  const row = (label: string, items: string): string => `<span class="lbl">${label}</span><div class="items">${items}</div>`;
  // 練習方式三選一：單一階段／從指定階段連續打到最後／隨機練習
  const run = parseRun(cfg.drill), rand = parseRand(cfg.drill);
  const mode: PickMode = rand ? 'rand' : run ? (run.mode === 'cont' ? 'cont' : 'one') : cfg.pick;
  const MODES: [PickMode, string, string][] = [
    ['one', '單一階段', '只打選的那一個階段'],
    ['cont', '連續打到最後', '從選的階段一路打到 P4'],
    ['rand', '隨機練習', '從勾選的機制隨機出題'],
  ];
  $('drillsMode').innerHTML = row('練習方式', `<div class="modeseg" role="radiogroup">${MODES.map(([m, name, tip]) =>
    `<button class="modebtn" role="radio" data-mode="${m}" aria-checked="${m === mode}" title="${tip}">${name}</button>`).join('')}</div>`);
  // 階段列：依練習方式換內容（P2 和 P4 機制相同，合併成一顆）
  const PH: [Phase, string, string][] = [['p1', 'P1 開場', '從 P1 開場'], ['p2', 'P2／P4 魔法陣', '從 P2 第一次魔法陣'], ['p3', 'P3 華容道', '從 P3 華容道']];
  if (mode === 'rand') {
    $('drillsTl').innerHTML = row('階段', `<span class="muted rowhint">隨機練習：在右側勾選要出的機制、重複與時間（目前 ${cfg.rand.mins} 分鐘・${cfg.rand.repeat ? '可重複' : '不重複'}）</span>`);
  } else {
    $('drillsTl').innerHTML = row('階段', PH.map(([p, one, cont]) => {
      const pressed = !!run && run.mode === (mode === 'cont' ? 'cont' : 'one') && (run.start === p || (p === 'p2' && run.start === 'p4' && mode === 'one'));
      return `<button class="drill tl" data-k="${runKey(mode === 'cont' ? 'cont' : 'one', p)}" aria-pressed="${pressed}">${mode === 'cont' ? cont : one}</button>`;
    }).join(''));
  }
  $('drillsOne').innerHTML = row('P2／P4 魔法陣', [tl1Key, tl2Key, ...Object.keys(singles)].map((k) => btn([k, DRILLS[k]])).join(''));
  $('drillsP2').innerHTML = row('P3 華容道', Object.entries(DRILLS).filter(([, d]) => d.group === 'p2').map(btn).join(''));
  renderStats(session);
}

export function bindDrillPicker(session: Session): void {
  // 練習方式：換方式時直接選該方式的練習（階段沿用目前的，沒有就 P1）
  $('drillsMode').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
    if (!b) return;
    const cfg = session.cfg, m = b.dataset.mode as PickMode;
    cfg.pick = m;
    const run = parseRun(cfg.drill);
    const start: Phase = run ? (run.start === 'p4' ? 'p2' : run.start) : 'p1';
    if (m === 'rand') pickDrill(session, randKey({ repeat: cfg.rand.repeat, mins: cfg.rand.mins, ids: cfg.rand.ids.length ? cfg.rand.ids : CATALOG.map((x) => x.id) }));
    else pickDrill(session, runKey(m, start));
    b.blur();
  };
  ['drillsTl', 'drillsOne', 'drillsP2'].forEach((id) => {
    $(id).onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.drill');
      if (!b) return;
      pickDrill(session, b.dataset.k!);
      b.blur();
    };
  });
}
