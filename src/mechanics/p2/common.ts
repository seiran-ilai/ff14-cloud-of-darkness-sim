// P3 華容道機制共用：分組、失誤、機制結束原地待命、讓內場 Bot 暫停刷新格子、外場沿環狀地板走
import { zoneE, homeE, onPlatform, type Side } from '../../core/p2';
import { P2, RUN, SPRINT_MUL } from '../../core/tuning';
import type { Vec } from '../../core/constants';
import { at, type Entity, type Fix, type GameState } from '../../game/state';
import { hurtPlayer, botHit } from '../../game/results';
import { isBot } from '../../game/bots';
import { innerHome } from '../../game/p3plan';

/** 內場的人（活著的） */
export const inners = (G: GameState): Entity[] => G.ents.filter((e) => !e.dead && zoneE(e) === 'in');
/** 某一側外場的人（活著的） */
export const outers = (G: GameState, side: Side): Entity[] => G.ents.filter((e) => !e.dead && zoneE(e) === side);
export const SIDES: readonly Side[] = [-1, 1];

/** 失誤：玩家記一筆（預設非致命），Bot 記 Bot 失誤 */
export function failE(G: GameState, e: Entity, tag: string, why: string, fix?: Fix, lethal = false): void {
  if (e.isPlayer) hurtPlayer(G, tag, why, lethal, fix);
  else botHit(G, e, tag, why);
}

/** 機制進行中：內場 Bot 不去刷新格子 */
export const busy = (G: GameState, until: number): void => { G.p2!.busyUntil = Math.max(G.p2!.busyUntil, until); };

/**
 * 機制結束：回待機位置。華容道的攻略有固定的待機位置（小抄的「待機」欄），
 * 所以和魔法陣階段不同，機制之間要回座位（內場一格一格搬回去、外場沿環狀地板走回平臺）。
 */
export function allSettle(G: GameState, t: number): void {
  at(G, t, () => {
    if (!G.p2) return;
    G.ents.forEach((e) => {
      if (!isBot(G, e) || e.dead || zoneE(e) === 'in') return;
      e.faceLock = null;
      if (onPlatform(e)) e.mt = homeE(e); else ringWalk(G, e, homeE(e), G.t);
    });
    busy(G, G.t + 4);
  });
  innerHome(G, t, t + 6);
}

/** 王（內場中央） */
export const BOSS3 = { x: 0, y: 0 } as const;

/** 外場 Bot 走到 p：兩端都在平臺上就直走，否則沿環狀地板走 */
export function outerGo(G: GameState, e: Entity, p: Vec): void {
  if (onPlatform(e) && onPlatform(p)) { e.mt = p; e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 4); }
  else ringWalk(G, e, p, G.t);
}

/**
 * 外場 Bot 沿環狀地板走到 to（平臺和環狀地板之間是空的，直線可能踩空）：
 * 每 15° 一個點，依距離估時間排程換目標。回傳預計到達時間。
 */
export function ringWalk(G: GameState, e: Entity, to: Vec, t: number): number {
  const R = (P2.ring0 + P2.ring1) / 2;
  const a0 = Math.atan2(e.y, e.x), a1 = Math.atan2(to.y, to.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 12)));
  const pts: Vec[] = [];
  for (let i = 1; i < n; i++) { const a = a0 + (d * i) / n; pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R }); }
  pts.push(to);
  const v = RUN * SPRINT_MUL;
  let cur: Vec = { x: e.x, y: e.y }, when = t;
  // 中途有別的機制給了新的目標（e.mt 被換掉）就不再走下去
  let mine: Vec | null = null, first = true;
  pts.forEach((p) => {
    const at0 = when;
    at(G, at0, () => {
      if (e.dead || (!first && e.mt !== mine)) { mine = null; return; }
      first = false;
      mine = p;
      e.mt = p;
      e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 3);
    });
    when += Math.hypot(p.x - cur.x, p.y - cur.y) / v + 0.05;
    cur = p;
  });
  return when;
}
