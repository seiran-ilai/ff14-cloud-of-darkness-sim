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
import { VARIANTS, type VariantGroup } from './drills/variants';
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

/**
 * 一段裡有好幾個機制（例如 P1 的暗之刃 → 暗之大泛濫）：可以選「看哪個機制」，動態圖從那個機制開始播
 * （前面照攻略快轉）。值是時間軸項目要包含的文字。
 */
const STEPS: Record<string, [string, string][]> = {
  opener: [['暗之刃', '暗之刃'], ['暗之大泛濫', '暗之大泛濫']],
  blade: [['暗之刃', '暗之刃'], ['超賦', '超賦'], ['超賦後的暗之刃', '（超賦）']],
  flareholy: [['核爆', '核爆'], ['黑暗神聖', '黑暗神聖']],
  p2open: [['暗之大泛濫', '暗之大泛濫'], ['深暗領域', '深暗領域'], ['三重暗之戰技＋波動球', '三重暗之戰技']],
  p3seed: [['種子彈', '種子彈'], ['荊棘叢生', '荊棘叢生']],
};
const STEP_KEY = 'step';

/** 每段的選擇列：「看哪個機制」＋各組樣式 */
const groupsOf = (k: string): VariantGroup[] => [
  ...(STEPS[k] ? [{ key: STEP_KEY, label: '機制', opts: STEPS[k].map(([label, value]) => ({ value, label, tell: '', how: '' })) }] : []),
  ...(VARIANTS[k] ?? []),
];

/** 每段選的項目（key → value）；預設每組第一個 */
const picks: Record<string, Record<string, string>> = {};
const pickOf = (k: string): Record<string, string> =>
  (picks[k] ??= Object.fromEntries(groupsOf(k).map((g) => [g.key, g.opts[0].value])));

/** 選擇列：每組一排按鈕；樣式的預兆與應對全部列出，選到的那個加框 */
function renderVariants(k: string): void {
  const box = sec(k).querySelector<HTMLElement>('[data-var]');
  if (!box) return;
  const cur = pickOf(k);
  box.innerHTML = groupsOf(k).map((g) => {
    const chips = g.opts.map((o) => `<button class="chip" data-vk="${g.key}" data-vv="${o.value}" aria-pressed="${cur[g.key] === o.value}">${o.label}</button>`).join('');
    const info = g.key === STEP_KEY ? '' : `<div class="gvinfo">${g.opts.map((o) => `<div class="gvopt${cur[g.key] === o.value ? ' sel' : ''}"><b>${o.label}</b><dl class="midl"><dt class="tell">預兆</dt><dd>${o.tell}</dd><dt class="how">應對</dt><dd>${o.how}</dd></dl></div>`).join('')}</div>`;
    return `<div class="gvrow"><span class="lbl">${g.label}</span><span class="grp">${chips}</span></div>${info}`;
  }).join('');
}

function restart(): void {
  if (!active) return;
  cfg.drill = active;
  const { [STEP_KEY]: step, ...pick } = pickOf(active);
  session.pick = pick;
  session.startAt = 0;
  // 選了「看哪個機制」：先排一次找出那個機制在時間軸的時間，再從那裡開始（前面照攻略快轉）
  let G = session.newGame(true, seed, 0);
  const at = step ? G.seq.find((s) => s.label.includes(step))?.t ?? 0 : 0;
  if (at > 0) G = session.newGame(true, seed, at);
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

/** 每個機制在模擬器裡最適合練的項目（P1 開場、P3 開場這兩段裡的機制就練那一段） */
const MECH_DRILL: Record<string, string> = {
  暗之刃: 'blade', 暗之大泛濫: 'opener', 暗之泛濫: 'run:one:p2', 陰冷擁抱: 'embrace', 齊射式波動炮: 'volley', 核爆: 'flareholy', 黑暗神聖: 'flareholy',
  連射式波動炮: 'beam', 飆風: 'aero', 極死: 'death', 超賦: 'blade', 超石化: 'petrify',
  深暗領域: 'p2open', 三重暗之戰技: 'p3tower', 波動球: 'p3tower', 恐懼之雲: 'p3fear', 波動詛咒: 'p3curse', 種子彈: 'p3seed', 荊棘叢生: 'p3seed',
  '暗之泛濫（小王）': 'p3interrupt', 凝聚式波動炮: 'p3charge', 分散式波動炮: 'p3charge', 磔殺: 'p3impale', 迴旋式波動炮: 'p3spin', 跳躍波動炮: 'p3spin',
  混沌迫近: 'p3swap', 潛地式波動炮: 'p3dive', 雲散: 'run:one:p3',
};
const drillForMech = (n: string, sectionKey: string): string =>
  (sectionKey === 'opener' || sectionKey === 'p2open' ? sectionKey : MECH_DRILL[n] ?? sectionKey);

/** 機制說明卡（全部展開）＋「到模擬器練這個」 */
const mechCard = (n: string, sectionKey: string): string =>
  mechInfoHtml(n, true).replace('</details>', `<button class="btn ghost sm gmigo" data-go="${drillForMech(n, sectionKey)}">到模擬器練這個</button></details>`);

function sectionHtml(k: string): string {
  const D = DRILLS[k], info = D.info ?? [];
  return `<section class="gsec card" id="k-${k}" data-k="${k}">
    <div class="ghead"><h2>${D.name}</h2><span class="muted">${D.sub}</span><span class="gwhy muted"></span></div>
    <div class="gcols">
      <div class="gplayer">
        <div class="gstage" title="點畫面暫停／播放"><canvas class="gcv"></canvas>
          <div class="gtop"><div class="gcap"></div><span class="gtime"></span></div>
          <div class="gbot"><span class="galert"></span></div>
          <div class="gidle">捲到這一段就會播放</div></div>
        ${groupsOf(k).length ? `<div class="gvar" data-var></div>` : ''}
        <div class="gctrl">
          <button class="btn ghost sm" data-go="${k}">到模擬器練這個</button>
          <span class="muted">點畫面＝暫停／播放・播完自動重播</span>
        </div>
      </div>
      <div class="gtext">
        ${D.brief ? `<div class="btext open">${D.brief}</div>` : ''}
        ${info.length ? `<div class="mihead"><span>機制說明（效果 → 預兆 → 應對）</span></div><div class="milist">${info.map((n) => mechCard(n, k)).join('')}</div>` : ''}
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
 * 動態圖裡的文字（畫面比場地高，場地上下各留一段空白，文字放在空白處，不蓋到場地）：
 * 上方＝詠唱名稱／讀條／處理方式與時間，下方＝王台詞與提示。
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
    : '');
  const line = G.line && G.t < G.line.until ? G.line.text : '';
  const al = G.alert && G.t < G.alert.until ? G.alert.text : '';
  put(q(active, 'galert'), [line && `<span class="gline"><small>暗黑之雲</small>${line}</span>`, al && `<b>${al}</b>`].filter(Boolean).join(''));
  q(active, 'gtime').textContent = !playing ? '⏸ 已暫停・點畫面繼續' : G.state === 'end' ? '結束，馬上重播' : fmtT(G.t);
}

function togglePlay(): void {
  playing = !playing;
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
KEYS.forEach(renderVariants);
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
  // 到模擬器練這個：帶著座位與練習項目回到模擬器
  const go = t.closest<HTMLElement>('[data-go]');
  if (go) {
    const c = loadConfig();
    Object.assign(c, { drill: go.dataset.go!, al: cfg.al, role: cfg.role });
    saveConfig(c);
    location.href = './index.html';
    return;
  }
  // 選機制／樣式：這段改播指定的
  const v = t.closest<HTMLElement>('[data-vk]');
  if (v) {
    const k = v.closest<HTMLElement>('.gsec')!.dataset.k!;
    pickOf(k)[v.dataset.vk!] = v.dataset.vv!;
    renderVariants(k);
    if (k === active) restart(); else activate(k);
    if (!playing) togglePlay();
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
