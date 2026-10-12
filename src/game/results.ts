// 判定結果：成功／提醒／失誤，以及玩家受傷、Bot 被打中
import { inArena } from '../core/geometry';
import type { Entity, Fix, GameState } from './state';

/** 失誤統計用的機制名稱：去掉減益秒數與（超賦） */
export const mechName = (tag: string): string => tag.replace(/\s\d+s$/, '').replace('（超賦）', '');

function mark(G: GameState, tag: string, failed: boolean): void {
  const k = mechName(tag);
  G.mech[k] = (G.mech[k] ?? false) || failed;
}

export function good(G: GameState, tag: string, text: string, fix?: Fix): void {
  G.checks.push({ t: G.t, tag, ok: true, text, fix });
  mark(G, tag, false);
  G.sfx.push('ok');
}

export function warn(G: GameState, tag: string, text: string, fix?: Fix): void {
  G.checks.push({ t: G.t, tag, ok: false, warn: true, text, fix });
  mark(G, tag, false);
}

export function bad(G: GameState, tag: string, text: string, fix?: Fix): void {
  G.checks.push({ t: G.t, tag, ok: false, text, fix });
  G.fails.push(`${tag}：${text}`);
  G.toasts.push({ text: `${tag}：${text}`, until: G.t + 3 });
  mark(G, tag, true);
  G.sfx.push('ng');
}

/** lethal：時間軸且設定「陣亡後繼續」時不結束，只把掉出場地的玩家放回中央（docs：屍體出現在場地中央） */
export function hurtPlayer(G: GameState, tag: string, why: string, lethal: boolean, fix?: Fix): void {
  const P = G.player;
  if (P.dead) return;
  bad(G, tag, why, fix);
  G.fx.push({ k: 'flash', until: G.t + 0.35 });
  if (!lethal) return;
  if (G.tl && G.cfg.cont) {
    if (!inArena(P.x, P.y)) { P.x = 0; P.y = 0; P.px = 0; P.py = 0; P.forced = null; }
  } else {
    P.dead = true;
    P.forced = null;
    G.endT = Math.min(G.endT, G.t + 1.5);
  }
}

/** 隊友（非玩家角色）被打中：只記錄、不結束 */
export function botHit(G: GameState, e: Entity, tag: string, why: string): void {
  if (e.isPlayer || e.dead) return;
  G.botFails.push({ t: G.t, tag, who: `${e.al}-${e.role}`, why });
  G.fx.push({ k: 'hit', x: e.x, y: e.y, until: G.t + 1.2 });
}
