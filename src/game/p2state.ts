// P2 的狀態：格子（站立計時、擠人、消失與重生）、小王、塔、環狀地板出血
import { P2 } from '../core/tuning';
import { CELLS, cellsTouching, cellUnder, onPlatform, onRing, type Cell, type Side } from '../core/p2';
import type { Vec } from '../core/constants';
import type { Entity, GameState } from './state';

export interface CellState {
  /** 目前單獨站在格子上的人（G.ents 的索引，−1 沒人） */
  who: number;
  /** 這個人已經連續站了幾秒 */
  stand: number;
  /** 2 人以上：在這個時間消失 */
  doomAt: number | null;
  /** 消失中：到這個時間重生 */
  goneUntil: number | null;
}

/** 三重暗之戰技的一擊：L/R 單手球（半場）、B 雙手球（分攤）、C 黑霧（直線散開） */
export type TripleKind = 'L' | 'R' | 'B' | 'C';

export interface SmallBoss {
  side: Side;
  /** 目前亮出的特效（判定前 tell 秒） */
  glow: TripleKind | null;
  /** 跳躍波動炮：跳到的位置（沒有就在平臺中央） */
  at?: Vec | null;
}

/** 暗之荊棘：位置、佔用的格子（外場 −1）、種子主人（實體索引） */
export interface Thorn { x: number; y: number; cell: number; owner: number; since: number }
/** 連線：荊棘叢生（從荊棘到人）或內場兩人互連（a、b 實體索引） */
export interface Link { x?: number; y?: number; a: number; b?: number; until: number }

/** 內場塔：cells 是格子索引；need = 需要的人數（單人 1、雙人 2，雙人塔橫跨 2 格） */
export interface InnerTower { cells: number[]; need: number }
/** 外場三人塔 */
export interface OuterTower { x: number; y: number; r: number; need: number; side: Side; group: 1 | 2 }

export interface P2State {
  cells: CellState[];
  sb: SmallBoss[];
  innerTowers: InnerTower[];
  outerTowers: OuterTower[];
  /** 環狀地板出血到這個時間 */
  bleedUntil: number;
  /** 進格子的預約（避免兩個 Bot 同時走進同一格）：格子索引 → 實體索引 */
  reserve: Map<number, number>;
  /** 這段時間內 Bot 不去刷新格子（機制進行中） */
  busyUntil: number;
  thorns: Thorn[];
  links: Link[];
  /** 恐懼之雲的特效（王身邊的環形／方形暗雲） */
  fear: { kind: 'ring' | 'cross'; until: number } | null;
  /** 雲散：小王消失 */
  vanished: boolean;
  /** 內場各角落目前生效的換格規劃編號（新的規劃開始，舊的就停） */
  plan: number[];
}

export function createP2(): P2State {
  return {
    cells: CELLS.map(() => ({ who: -1, stand: 0, doomAt: null, goneUntil: null })),
    sb: [{ side: -1, glow: null }, { side: 1, glow: null }],
    innerTowers: [], outerTowers: [], bleedUntil: 0, reserve: new Map(), busyUntil: 0,
    thorns: [], links: [], fear: null, vanished: false, plan: [0, 0, 0, 0],
  };
}

export const cellGone = (s: P2State, c: Cell): boolean => s.cells[c.idx].goneUntil !== null;
/** 格子被荊棘佔用 */
export const cellThorn = (s: P2State, c: Cell): boolean => s.thorns.some((t) => t.cell === c.idx);
export const cellRed = (s: P2State, c: Cell): boolean => { const cs = s.cells[c.idx]; return cs.doomAt !== null || cs.stand >= P2.standRed; };

/** P2 能站的地方：沒消失的格子、平臺、環狀地板（中心點判定） */
export function p2Walkable(s: P2State, p: Vec): boolean {
  const c = cellUnder(p);
  if (c) return !cellGone(s, c);
  return onPlatform(p) !== 0 || onRing(p);
}

/** 每步更新格子：誰站在上面、計時、變紅、消失、重生 */
export function updateGrid(G: GameState, dt: number): void {
  const s = G.p2!;
  const on: number[][] = CELLS.map(() => []);
  G.ents.forEach((e, k) => { if (!e.dead) cellsTouching(e).forEach((c) => on[c.idx].push(k)); });
  // 暗之荊棘佔用 1 格（算 1 人；放下後有一點寬限讓主人離開）
  s.thorns.forEach((t) => { if (t.cell >= 0 && G.t >= t.since) on[t.cell].push(-1); });
  CELLS.forEach((c) => {
    const cs = s.cells[c.idx];
    if (cs.goneUntil !== null) {
      if (G.t >= cs.goneUntil) Object.assign(cs, { who: -1, stand: 0, doomAt: null, goneUntil: null });
      return;
    }
    const who = on[c.idx];
    if (who.length >= 2) { if (cs.doomAt === null) cs.doomAt = G.t + P2.crowdGone; }
    // 只有荊棘：不計站立時間
    else if (who.length === 1 && who[0] >= 0) { if (cs.who === who[0]) cs.stand += dt; else { cs.who = who[0]; cs.stand = dt; } }
    else { cs.who = -1; cs.stand = 0; }
    if ((cs.doomAt !== null && G.t >= cs.doomAt) || cs.stand >= P2.standGone) {
      cs.goneUntil = G.t + P2.regen;
      cs.doomAt = null;
      G.fx.push({ k: 'hit', x: c.cx, y: c.cy, until: G.t + 0.8 });
    }
  });
  // 預約：預約者的中心已經進到格子裡（之後由「站在上面」接手），或已經不需要，就取消
  s.reserve.forEach((k, idx) => {
    const e = G.ents[k];
    if (e.dead || cellUnder(e)?.idx === idx || e.nav?.next !== idx) s.reserve.delete(idx);
  });
}

/** 玩家目前站的格子已經連續站幾秒（HUD 用） */
export function playerCellTime(G: GameState): number | null {
  if (!G.p2) return null;
  const c = cellUnder(G.player);
  if (!c) return null;
  const cs = G.p2.cells[c.idx];
  return cs.who === G.ents.indexOf(G.player) ? cs.stand : 0;
}

export const entIndex = (G: GameState, e: Entity): number => G.ents.indexOf(e);
