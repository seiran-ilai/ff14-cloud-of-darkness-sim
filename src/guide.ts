// 機制教學頁：一整頁往下捲，每個單元（各階段流程、每個機制）一段：動態圖＋效果／預兆／應對（全部展開）。
// 左側（手機是下拉選單）是索引，點了跳到那一段。動態圖直接跑模擬器的教學示範（同一套機制與照攻略站位的 Bot），
// 所以站位、走位和模擬器一致；黃色「你」是選的座位。同一時間只播放畫面中的那一段。
import './styles/tokens.css';
import './styles/layout.css';
import './styles/guide.css';
import { ALS, ROLES, type Alliance, type Role } from './core/constants';
import { defaultConfig, loadConfig, saveConfig } from './core/config';
import { fmtT } from './core/format';
import { DRILLS } from './drills';
import { singles } from './drills/singles';
import { p3singles } from './drills/p3singles';
import { mechInfoHtml } from './drills/mechinfo';
import { seatText, unrelated } from './drills/relevance';
import { Session } from './game/session';
import { newInput } from './game/simulation';
import { initCanvas, resize } from './render/canvas';
import { draw } from './render';
import { $, seg } from './ui/dom';

/** 教學的單元：直接用模擬器的練習項目 key */
const GROUPS: [string, string[]][] = [
  ['P1 開場', ['opener']],
  ['P2／P4 魔法陣', Object.keys(singles)],
  ['P3 華容道', ['p2open', 'p2grid', ...Object.keys(p3singles)]],
];
const KEYS = GROUPS.flatMap(([, ks]) => ks);
const SPEEDS = [0.5, 1, 2, 4];

// 教學頁用自己的設定（不存檔）：座位沿用模擬器上次選的，鏡頭固定、地面預兆全開；
// 文字說明（王手勢的處理方式等）不畫在場地上，改在動態圖上下的文字列
const saved = loadConfig();
const cfg = { ...defaultConfig(), al: saved.al, role: saved.role, cam: 'fixed' as const, hint: true, text: false, tele: true };
const session = new Session(cfg, newInput(), false);
let active = '';
let seed = 1;
let playing = true, speed = 1, endWait = 0;

const sec = (k: string): HTMLElement => $(`k-${k}`);
const q = <T extends HTMLElement = HTMLElement>(k: string, cls: string): T => sec(k).querySelector<T>(`.${cls}`)!;

function restart(newSeed = false): void {
  if (!active) return;
  if (newSeed) seed = Math.floor(Math.random() * 1e9);
  cfg.drill = active;
  session.startAt = 0;
  const G = session.newGame(true, seed);
  G.countT = 0.8;
  endWait = 0;
}

/** 換播放的單元：動態圖畫到那一段的 canvas */
function activate(k: string): void {
  if (k === active) return;
  if (active) sec(active).classList.remove('playing');
  active = k;
  sec(k).classList.add('playing');
  initCanvas(q<HTMLCanvasElement>(k, 'gcv'));
  resize();
  restart();
  document.querySelectorAll('#gnav .gitem').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === k));
  ($('gsel') as HTMLSelectElement).value = k;
}

function sectionHtml(k: string): string {
  const D = DRILLS[k], info = D.info ?? [];
  return `<section class="gsec card" id="k-${k}" data-k="${k}">
    <div class="ghead"><h2>${D.name}</h2><span class="muted">${D.sub}</span><span class="gwhy muted"></span></div>
    <div class="gcols">
      <div class="gplayer">
        <div class="gview">
          <div class="gtop"><div class="gcap"></div><span class="gtime"></span></div>
          <div class="gstage" title="點畫面暫停／播放"><canvas class="gcv"></canvas><div class="gidle">捲到這一段就會播放</div></div>
          <div class="gbot"><span class="galert"></span></div>
        </div>
        <div class="gctrl">
          <button class="btn sm" data-a="play">暫停</button>
          <button class="btn ghost sm" data-a="re">重播</button>
          <button class="btn ghost sm" data-a="new" title="換一局：手勢、點名、方向會不一樣">換一局</button>
          <button class="btn ghost sm" data-a="go">到模擬器練這個</button>
        </div>
      </div>
      <div class="gtext">
        ${D.brief ? `<div class="btext open">${D.brief}</div>` : ''}
        ${info.length ? `<div class="mihead"><span>機制說明（效果 → 預兆 → 應對）</span></div><div class="milist">${info.map((n) => mechInfoHtml(n, true)).join('')}</div>` : ''}
      </div>
    </div></section>`;
}

function renderPage(): void {
  $('gnav').innerHTML = GROUPS.map(([g, ks]) => `<div class="ggroup"><p>${g}</p>${ks.map((k) => `<a class="gitem" href="#k-${k}" data-k="${k}">${DRILLS[k].name}</a>`).join('')}</div>`).join('');
  $('gsel').innerHTML = GROUPS.map(([g, ks]) => `<optgroup label="${g}">${ks.map((k) => `<option value="${k}">${DRILLS[k].name}</option>`).join('')}</optgroup>`).join('');
  $('gbody').innerHTML = GROUPS.map(([g, ks]) => `<h2 class="gphase">${g}</h2>${ks.map(sectionHtml).join('')}`).join('');
}

/** 座位相關：上方座位說明、每段「跟你的座位無關」的提示、索引變淡 */
function renderSeat(): void {
  seg($('alSeg'), ALS, cfg.al, (v) => { cfg.al = v as Alliance; renderSeat(); restart(); });
  seg($('roleSeg'), ROLES, cfg.role, (v) => { cfg.role = v as Role; renderSeat(); restart(); });
  $('seatInfo').textContent = seatText(cfg.al, cfg.role);
  $('gnote').textContent = `動態圖中黃色「你」＝ ${cfg.al} 隊 ${cfg.role}`;
  KEYS.forEach((k) => {
    const why = unrelated(k, cfg.al, cfg.role);
    q(k, 'gwhy').textContent = why ? `・你的座位：${why}` : '';
    document.querySelector(`#gnav [data-k="${k}"]`)?.classList.toggle('dim', !!why);
  });
}

function jump(k: string): void {
  sec(k).scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#k-${k}`);
  activate(k);
}

/**
 * 動態圖上下的文字列（不疊在場地上）：上方＝詠唱名稱／讀條／處理方式與時間，下方＝王台詞與提示。
 * 只有內容變了才改 DOM。
 */
const lastHtml = new Map<HTMLElement, string>();
const put = (el: HTMLElement, h: string): void => { if (lastHtml.get(el) !== h) { lastHtml.set(el, h); el.innerHTML = h; } };

function updCaption(): void {
  const G = session.G;
  if (!G || !active) return;
  const c = G.cast && G.state === 'run' && G.t < G.cast.start + G.cast.dur ? G.cast : null;
  put(q(active, 'gcap'), c
    ? `<div class="gcast"><b>${c.name}</b><span>${Math.max(0, c.start + c.dur - G.t).toFixed(1)}</span></div><i class="gprog"><i style="width:${((G.t - c.start) / c.dur) * 100}%"></i></i>${c.tip ? `<em>${c.tip}</em>` : ''}`
    : '<span class="muted">（目前沒有詠唱）</span>');
  const line = G.line && G.t < G.line.until ? G.line.text : '';
  const al = G.alert && G.t < G.alert.until ? G.alert.text : '';
  put(q(active, 'galert'), [line && `<span class="gline"><small>暗黑之雲</small>${line}</span>`, al && `<b>${al}</b>`].filter(Boolean).join(''));
  q(active, 'gtime').textContent = !playing ? '⏸ 已暫停・點畫面繼續' : G.state === 'end' ? '結束，馬上重播' : fmtT(G.t);
}

function togglePlay(): void {
  playing = !playing;
  document.querySelectorAll('[data-a="play"]').forEach((x) => { x.textContent = playing ? '暫停' : '播放'; });
}

let last = performance.now();
function frame(now: number): void {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  const G = session.G;
  if (G && playing) {
    if (G.state === 'end') { endWait += real; if (endWait > 2) restart(); }
    else session.advance(real * speed);
  }
  draw(session.G, cfg, { alpha: session.alpha });
  updCaption();
  requestAnimationFrame(frame);
}

renderPage();
renderSeat();
const renderSpeed = (): void => seg($('gSpeed'), SPEEDS, speed, (v) => { speed = +v; renderSpeed(); }, (v) => `${v}x`);
renderSpeed();

$('gnav').onclick = (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
  if (!a) return;
  e.preventDefault();
  jump(a.dataset.k!);
};
($('gsel') as HTMLSelectElement).onchange = (e) => jump((e.target as HTMLSelectElement).value);
$('gbody').onclick = (e) => {
  const t = e.target as HTMLElement;
  // 點動態圖：暫停／播放（還沒在播的那段就開始播）
  const st = t.closest<HTMLElement>('.gstage');
  if (st) {
    const k = st.closest<HTMLElement>('.gsec')!.dataset.k!;
    if (k !== active) { activate(k); if (!playing) togglePlay(); } else togglePlay();
    return;
  }
  const b = t.closest<HTMLElement>('[data-a]');
  if (!b) return;
  const k = b.closest<HTMLElement>('.gsec')!.dataset.k!;
  activate(k);
  const act = b.dataset.a;
  if (act === 'play') togglePlay();
  else if (act === 're') restart();
  else if (act === 'new') restart(true);
  else if (act === 'go') {
    // 帶著座位與這個練習回到模擬器
    const c = loadConfig();
    Object.assign(c, { drill: k, al: cfg.al, role: cfg.role });
    saveConfig(c);
    location.href = './index.html';
  }
};

// 捲動時：畫面中最靠近上方 40% 位置的那一段開始播放
if (typeof IntersectionObserver === 'function') {
  const vis = new Map<string, number>();
  const io = new IntersectionObserver((es) => {
    es.forEach((en) => vis.set((en.target as HTMLElement).dataset.k!, en.isIntersecting ? en.intersectionRatio : 0));
    let best = '', bestR = 0;
    vis.forEach((r, k) => { if (r > bestR) { best = k; bestR = r; } });
    if (best && bestR > 0.25) activate(best);
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  document.querySelectorAll<HTMLElement>('.gsec').forEach((s) => io.observe(s));
}
window.addEventListener('resize', resize);

const start = location.hash.startsWith('#k-') ? location.hash.slice(3) : '';
activate(KEYS.includes(start) ? start : KEYS[0]);
if (KEYS.includes(start)) sec(start).scrollIntoView();
requestAnimationFrame(frame);
