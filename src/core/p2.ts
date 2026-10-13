// P2的場地幾何：井字內場格子、東西平臺、環狀地板、攻略站位（docs/p2-strategy.md）
import { P2, HIT } from './tuning';
import type { Alliance, Role, Vec } from './constants';

export type Side = -1 | 1; // −1 西、1 東

export interface Cell {
  idx: number;
  i: number; // 往東 0～7
  j: number; // 往南 0～7
  x0: number; y0: number; x1: number; y1: number;
  cx: number; cy: number;
  /** 交叉格（角落格） */
  cross: boolean;
}

const HALF_GRID = (P2.n * P2.cell) / 2;

export const CELLS: Cell[] = [];
const byIJ = new Map<string, Cell>();
for (let j = 0; j < P2.n; j++) {
  for (let i = 0; i < P2.n; i++) {
    if (!P2.bars.includes(i) && !P2.bars.includes(j)) continue;
    const x0 = -HALF_GRID + P2.cell * i, y0 = -HALF_GRID + P2.cell * j;
    const c: Cell = { idx: CELLS.length, i, j, x0, y0, x1: x0 + P2.cell, y1: y0 + P2.cell, cx: x0 + P2.cell / 2, cy: y0 + P2.cell / 2, cross: P2.bars.includes(i) && P2.bars.includes(j) };
    CELLS.push(c);
    byIJ.set(`${i},${j}`, c);
  }
}

export const cellAt = (i: number, j: number): Cell | undefined => byIJ.get(`${i},${j}`);
export const center = (c: Cell): Vec => ({ x: c.cx, y: c.cy });

/** 角色中心所在的格子 */
export const cellUnder = (p: Vec): Cell | undefined =>
  cellAt(Math.floor((p.x + HALF_GRID) / P2.cell), Math.floor((p.y + HALF_GRID) / P2.cell));

/** 判定圈碰到的格子（使用者確認：碰到就算站在該格） */
export const cellsTouching = (p: Vec, hb = HIT): Cell[] =>
  CELLS.filter((c) => p.x >= c.x0 - hb && p.x <= c.x1 + hb && p.y >= c.y0 - hb && p.y <= c.y1 + hb
    && Math.hypot(p.x - Math.max(c.x0, Math.min(c.x1, p.x)), p.y - Math.max(c.y0, Math.min(c.y1, p.y))) <= hb);

export const neighbors = (c: Cell): Cell[] =>
  [cellAt(c.i + 1, c.j), cellAt(c.i - 1, c.j), cellAt(c.i, c.j + 1), cellAt(c.i, c.j - 1)].filter((x): x is Cell => !!x);

/** 格子間最短路（含起點與終點）；blocked 的格子不能經過 */
export function cellPath(a: Cell, b: Cell, blocked: (c: Cell) => boolean = () => false): Cell[] | null {
  const prev = new Map<number, Cell | null>([[a.idx, null]]);
  const q = [a];
  while (q.length) {
    const c = q.shift()!;
    if (c === b) break;
    for (const n of neighbors(c)) if (!prev.has(n.idx) && (n === b || !blocked(n))) { prev.set(n.idx, c); q.push(n); }
  }
  if (!prev.has(b.idx)) return null;
  const path: Cell[] = [];
  for (let c: Cell | null = b; c; c = prev.get(c.idx) ?? null) path.unshift(c);
  return path;
}

export const onPlatform = (p: Vec): Side | 0 =>
  Math.abs(p.y) <= P2.ph && Math.abs(p.x) >= P2.px0 && Math.abs(p.x) <= P2.px1 ? (p.x < 0 ? -1 : 1) : 0;

export const onRing = (p: Vec): boolean => { const r = Math.hypot(p.x, p.y); return r >= P2.ring0 && r <= P2.ring1; };

/** 小王位置（平臺中央） */
export const sbPos = (side: Side): Vec => ({ x: side * P2.sbX, y: 0 });

/**
 * 平臺上的相對座標：以場外為北（小王面向場外）。
 * f = 往前（場外）、r = 往右；西平臺面向西時右手是北，東平臺面向東時右手是南。
 */
export const rel = (side: Side, f: number, r: number): Vec => ({ x: side * (P2.sbX + f), y: side * r });
/** 小王面向（角度，0 = 北、順時針） */
export const sbFacing = (side: Side): number => (side < 0 ? -Math.PI / 2 : Math.PI / 2);

// ---------- 分組與基本站位（イディル改） ----------

export type Zone = 'in' | Side;

/** 內場 12 人：B 聯盟 8 人＋A／C 的 ST、H1 */
export const zoneOf = (al: Alliance, role: Role): Zone => (al === 'B' || role === 'ST' || role === 'H1' ? 'in' : al === 'A' ? -1 : 1);

/** 內場待機格（格子座標）與站在格內的位置（B 聯盟 H1/H2/D1/D2 站偏本體側） */
const IN_SEAT: Record<string, [number, number, number?]> = {
  'A-H1': [1, 0], 'A-ST': [2, 1], 'B-D1': [1, 2, 1.2],
  'C-H1': [6, 0], 'C-ST': [5, 1], 'B-D2': [6, 2, -1.2],
  'B-D3': [1, 7], 'B-MT': [2, 6], 'B-H1': [1, 5, 1.2],
  'B-D4': [6, 7], 'B-ST': [5, 6], 'B-H2': [6, 5, -1.2],
};

/** 外場待機（相對座標 f, r）：以雙手球的分攤配對站位為基準 */
const OUT_IDLE: Record<string, [number, number]> = {
  MT: [2.3, 0], H2: [4, 0], D1: [0, -2.3], D3: [0, -4], D2: [0, 2.3], D4: [0, 4],
};

export function p2Home(al: Alliance, role: Role): Vec {
  const z = zoneOf(al, role);
  if (z === 'in') {
    const [i, j, dx = 0] = IN_SEAT[`${al}-${role}`];
    const c = cellAt(i, j)!;
    return { x: c.cx + dx, y: c.cy };
  }
  const [f, r] = OUT_IDLE[role];
  return rel(z, f, r);
}

/** 內場角落區（西北 0、東北 1、西南 2、東南 3）與其十字格：交叉格＋上下左右 */
export const CORNERS = [[1, 1], [6, 1], [1, 6], [6, 6]] as const;
export const cornerOfCell = (c: Cell): number => (c.i <= 3 ? 0 : 1) + (c.j <= 3 ? 0 : 2);
export const crossCells = (k: number): Cell[] => {
  const [i, j] = CORNERS[k];
  return [cellAt(i, j)!, cellAt(i, j - 1)!, cellAt(i - 1, j)!, cellAt(i + 1, j)!, cellAt(i, j + 1)!];
};

// ---------- 座位（混沌迫近換位後，改坐別人的位置） ----------

export interface Seated { al: Alliance; role: Role; seat?: { al: Alliance; role: Role } }
/** 目前坐的座位：換位前就是自己 */
export const seatOf = (e: Seated): { al: Alliance; role: Role } => e.seat ?? { al: e.al, role: e.role };
export const zoneE = (e: Seated): Zone => { const s = seatOf(e); return zoneOf(s.al, s.role); };
export const homeE = (e: Seated): Vec => { const s = seatOf(e); return p2Home(s.al, s.role); };
/** 站位用的職能（外場的分攤、散開、塔都依座位的職能） */
export const roleE = (e: Seated): Role => seatOf(e).role;
