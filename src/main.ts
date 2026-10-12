// 進入點：組裝各模組、啟動迴圈（模擬用固定步長，渲染用插值）
import './styles/tokens.css';
import './styles/layout.css';
import './styles/hud.css';
import './styles/settings.css';
import { loadConfig } from './core/config';
import { Session } from './game/session';
import { newInput } from './game/simulation';
import { initCanvas, resize, view } from './render/canvas';
import { draw } from './render';
import { $ } from './ui/dom';
import { updHUD } from './ui/hud';
import { renderBar, bindBar } from './ui/actionbar';
import { renderBrief } from './ui/brief';
import { renderOverlay } from './ui/overlay';
import { renderTop, renderStats, bindDrillPicker } from './ui/topbar';
import { bindSettings, isSettingsOpen } from './ui/settings';
import { replayActive, replayFrame, stopReplay } from './ui/replay';
import { unlockAudio, play } from './ui/sound';
import { bindKeyboard } from './input/keyboard';
import { bindMouse } from './input/mouse';

const cfg = loadConfig();
const input = newInput();
const session = new Session(cfg, input, true);

initCanvas($<HTMLCanvasElement>('cv'));
session.on('new', () => { stopReplay(); renderBrief(session); renderOverlay(session); });
session.on('change', () => { if (!replayActive()) renderOverlay(session); });
session.on('stats', () => renderStats(session));
bindBar((i) => session.useAct(i));
bindDrillPicker(session);
bindSettings(session);
bindKeyboard(session);
bindMouse(view.cv, input);
// 音效只能在使用者互動後啟用
['keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { capture: true }));

let last = performance.now();
function frame(now: number): void {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  const rp = replayFrame(real);
  if (rp) {
    draw(rp.frame, cfg, { alpha: rp.alpha, fix: rp.check.fix, noHints: true });
  } else {
    const G = session.G;
    if (G && !G.paused && !isSettingsOpen()) session.advance(real * cfg.speed * (G.ff ? 2 : 1));
    draw(session.G, cfg, { alpha: session.alpha });
    updHUD(session.G, input);
    const sfx = session.drainSfx();
    if (cfg.sound && sfx.length) play(sfx);
  }
  requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
renderTop(session);
renderBar(cfg);
resize();
session.newGame();
requestAnimationFrame(frame);

if (import.meta.env.DEV) void import('./debug').then((m) => m.attachDebug(session));
