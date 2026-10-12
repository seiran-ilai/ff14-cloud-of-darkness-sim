// 判定結果：成功／提醒／失誤，以及玩家受傷、Bot 被打中
import { inArena } from '../core/geometry';
import { P2 } from '../core/tuning';
import { p2Home } from '../core/p2';
import { p2Walkable } from './p2state';
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

/**
 * 這個失誤要「從此機制開始」時的起點：最近一個已開始的機制。
 * 陰冷擁抱（攥魂之手）從結束前 10 秒開始，才來得及跑去外周。
 */
function mechStart(G: GameState): number {
  const s = G.seq.filter((x) => x.t <= G.t + 0.01).pop();
  if (!s) return 0;
  return Math.max(0, s.emb ? s.t - 10 : s.t);
}

export function bad(G: GameState, tag: string, text: string, fix?: Fix): void {
  const check = { t: G.t, tag, ok: false, text, fix, from: mechStart(G) };
  G.checks.push(check);
  G.fails.push(`${tag}：${text}`);
  G.toasts.push({ text: `${tag}：${text}`, until: G.t + 3 });
  mark(G, tag, true);
  G.sfx.push('ng');
  // 錯誤即停：自己練（不是示範）時，第一個失誤就停下來分析
  if (!G.auto && G.cfg.failMode === 'stop' && G.state === 'run' && !G.stopCheck) {
    G.stopCheck = check;
    G.state = 'end';
    G.result = { ok: false };
  }
}

/** 錯誤不停（或示範時間軸）：致命傷害不陣亡，掉下去就放回去繼續練 */
const keepAlive = (G: GameState): boolean => (G.cfg.failMode === 'continue' && !G.auto) || (G.auto && G.tl);

/** 掉下場地後放回去：P1 場地中央（docs：屍體出現在場地中央）；P2 自己的基本站位（不能站就放到平臺） */
function putBack(G: GameState): void {
  const P = G.player;
  let to = { x: 0, y: 0 };
  if (G.p2) {
    const h = p2Home(P.al, P.role);
    to = p2Walkable(G.p2, h) ? h : { x: (P.x < 0 ? -1 : 1) * P2.sbX, y: 0 };
  }
  P.x = P.px = to.x; P.y = P.py = to.y; P.forced = null;
}

/** lethal：致命（死亡宣告、掉落）；錯誤不停模式不陣亡 */
export function hurtPlayer(G: GameState, tag: string, why: string, lethal: boolean, fix?: Fix): void {
  const P = G.player;
  if (P.dead) return;
  bad(G, tag, why, fix);
  G.fx.push({ k: 'flash', until: G.t + 0.35 });
  if (!lethal) return;
  if (keepAlive(G)) {
    if (!(G.p2 ? p2Walkable(G.p2, P) : inArena(P.x, P.y))) putBack(G);
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
