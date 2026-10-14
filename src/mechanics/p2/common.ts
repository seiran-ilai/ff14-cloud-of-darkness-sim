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
      outerGo(G, e, homeE(e));
    });
    busy(G, G.t + 4);
  });
  innerHome(G, t, t + 6);
}

/** 王（內場中央） */
export const BOSS3 = { x: 0, y: 0 } as const;

/**
 * 外場 Bot 走到 p：兩端都在平臺上就直走，否則沿環狀地板走。
 * 平臺南北邊緣中間有荊棘時，平臺上不直走：先往平臺中線靠、沿中線走，再出去（不踩荊棘）。
 */
export function outerGo(G: GameState, e: Entity, p: Vec): void {
  if (!(onPlatform(e) && onPlatform(p))) { ringWalk(G, e, p, G.t); return; }
  e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 4);
  if (!G.p2?.thorns.some((th) => th.cell < 0)) { e.mt = p; return; }
  const mid = (q: Vec): Vec => ({ x: q.x, y: Math.max(-1.8, Math.min(1.8, q.y)) });
  walkPts(G, e, [mid(e), mid(p), p], G.t);
}

/** 依序走過這些點（依距離估時間換目標）；中途有別的機制換了目標就停 */
function walkPts(G: GameState, e: Entity, pts: Vec[], t: number): number {
  const v = RUN * SPRINT_MUL;
  let cur: Vec = { x: e.x, y: e.y }, when = t;
  let mine: Vec | null = null, first = true;
  pts.forEach((p) => {
    at(G, when, () => {
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

/**
 * 外場 Bot 沿環狀地板走到 to（平臺和環狀地板之間是空的，直線可能踩空）：
 * 每 15° 一個點，依距離估時間排程換目標。回傳預計到達時間。
 * 外場有荊棘（種子放在平臺南北邊緣中間）時自動避開：沿環狀地板的外緣走，離開／回到平臺時
 * 先經過平臺中線、平臺外緣（不從平臺南北邊緣中間直接切出去）。
 * opt.R：沿著哪個半徑走；opt.via：先依序走過這些點再上環狀地板。
 */
export function ringWalk(G: GameState, e: Entity, to: Vec, t: number, opt: { R?: number; via?: Vec[] } = {}): number {
  const avoid = !!G.p2?.thorns.some((th) => th.cell < 0);
  const R = opt.R ?? (avoid ? P2.ring1 - 0.6 : (P2.ring0 + P2.ring1) / 2);
  const edgeVia = (p: Vec): Vec[] => { const y = Math.max(-2, Math.min(2, p.y)); return [{ x: p.x, y }, { x: Math.sign(p.x) * (P2.px1 - 0.6), y }]; };
  const head = opt.via ?? (avoid && onPlatform(e) ? edgeVia(e) : []);
  const tail = avoid && onPlatform(to) ? edgeVia(to).reverse() : [];
  const start = head.length ? head[head.length - 1] : e, end = tail.length ? tail[0] : to;
  const a0 = Math.atan2(start.y, start.x), a1 = Math.atan2(end.y, end.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 12)));
  const pts: Vec[] = [...head];
  for (let i = 1; i < n; i++) { const a = a0 + (d * i) / n; pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R }); }
  pts.push(...tail, to);
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
