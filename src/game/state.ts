// 遊戲狀態型別與建立新局
import { ALS, ROLES, type Alliance, type Role, type Vec } from '../core/constants';
import { homePos, edgeSpot } from '../core/positions';
import type { Config } from '../core/config';
import type { Rng } from '../core/rng';
import { Scheduler } from './scheduler';
import type { P2State } from './p2state';

export type EmbraceType = 'scoop' | 'cover';
/**
 * 陰冷擁抱手勢文字（依攻略）：上減益時看王的手勢，記住到減益結束。
 * cover＝🫳 右手心向下（撒鹽）、左手在身前；scoop＝🤌 右手心向上（義大利手勢）、左手在身後。
 */
export const EMBRACE_TEXT: Record<EmbraceType, { icon: string; hand: string; other: string; how: string }> = {
  cover: { icon: '🫳', hand: '右手心向下（撒鹽）', other: '左手在身前', how: '面向場內直走' },
  scoop: { icon: '🤌', hand: '右手心向上（義大利手勢）', other: '左手在身後', how: '面向場外，手出現後轉身往場內疾跑' },
};
export const embraceLine = (type: EmbraceType): string => {
  const T = EMBRACE_TEXT[type];
  return `${T.icon} ${T.hand}・${T.other} → ${T.how}`;
};
export type BladeMode = 'L' | 'R' | 'B';
export type StoredKind = 'aero' | 'death';
export type LaneFam = 'U' | 'V';

export interface Buffs { sprint?: number; akb?: number; heavy?: number; bleed?: number }
export interface EmbraceDebuff { exp: number; type: EmbraceType }
export interface Forced { vx: number; vy: number; left: number }
/** 移動目標；emb 標記是哪一次陰冷擁抱設的臨時目標 */
export interface MoveTarget extends Vec { emb?: number }
/** 齊射式走位：目前站的列 iu/iv、第一批炸完後要踩進的列 fu/fv、格子內偏移 ju/jv */
export interface VolleyPlan { iu: number; iv: number; fu: number; fv: number; ju: number; jv: number }

export interface Entity {
  al: Alliance;
  role: Role;
  isPlayer: boolean;
  x: number;
  y: number;
  face: number;
  /** 主要移動目標 */
  mt: MoveTarget | null;
  /** 覆蓋目標（優先於 mt），例如陰冷擁抱外周處理 */
  ov: MoveTarget | null;
  faceLock: number | null;
  forced: Forced | null;
  buffs: Buffs;
  embs: EmbraceDebuff[];
  /** 陰冷擁抱外周處理位置 */
  spot: Vec;
  /** 石化／眩暈到幾秒 */
  stun: number;
  stunKind?: 'stone' | 'stun';
  dead: boolean;
  /** 上一個模擬步的位置與面向（渲染插值用） */
  px: number;
  py: number;
  pface: number;
  flareUntil?: number;
  fellAt?: number;
  vol?: VolleyPlan | null;
  /** P2 格子導航：目標格、剩下的路（含目前格）、已取得進入權的下一格 */
  nav?: { goal: number; path: number[]; next: number | null };
  /** P3 波動的詛咒：結束時間（結束時朝面向射出扇形） */
  curse?: number;
  /** P3 頭上標記（種子彈、凝聚式、分散式、潛地式等）：種類與消失時間 */
  mark?: { kind: 'seed' | 'charge' | 'spread' | 'dive' | 'impale'; until: number };
  /** P3 華容道的座位（混沌迫近換位後改坐別人的位置）；沒有就是自己的 al／role */
  seat?: { al: Alliance; role: Role };
  /** 換位後另外指定的定點（例如進格子的外場 MT：角落格往中間 2 格）；沒有就照座位 */
  seatHome?: Vec;
  /** P2 Bot 刷新格子的狀態 */
  p2r?: { phase: 'idle' | 'out' | 'wait' | 'back'; at: number; cell: number; threshold: number; ret?: Vec };
}

export type Telegraph =
  /** hand：攥魂之手（畫手的起點） */
  | { k: 'rect'; O: Vec; H: number; len: number; w: number; until: number; hand?: boolean }
  /** 半圓：中心 (x,y)、半徑 r、朝 a 方向的那一半（a 為角度） */
  | { k: 'half'; x: number; y: number; r: number; a: number; until: number }
  | { k: 'circle' | 'blue' | 'donut'; x: number; y: number; r: number; until: number }
  /** 環形：r0～r1 之間 */
  | { k: 'ring'; x: number; y: number; r0: number; r1: number; until: number }
  /** 扇形：中心、半徑、朝 a、半張角 w */
  | { k: 'fan'; x: number; y: number; r: number; a: number; w: number; until: number }
  /** 通過 (x,y)、角度 a 的直線（前後都打），半寬 hw、每邊長 len（沒有就是整個場地） */
  | { k: 'line'; x: number; y: number; a: number; hw: number; len?: number; until: number }
  | { k: 'lane'; fam: LaneFam; lanes: number[]; until: number };

export interface BeamLine { al: Alliance; v: Vec }

export type Effect =
  | { k: 'flash'; until: number }
  | { k: 'tether'; members: Entity[]; until: number }
  | { k: 'kb' | 'pull'; until: number }
  /** ell：P1 開場的橢圓範圍（沒有就是王周圍的圓） */
  | { k: 'bladeB'; until: number; ell?: { cx: number; cy: number; rx: number; ry: number } }
  | { k: 'hit' | 'flare' | 'stack'; x: number; y: number; until: number; r?: number }
  | { k: 'lane'; fam: LaneFam; lanes: number[]; until: number }
  /** pocket：P1 開場的安全區（沒有就是 P2 的王前方安全區） */
  | { k: 'bladeS'; side: number; until: number; pocket?: { x: number; y: number; r: number } }
  | { k: 'gaze'; srcs: Vec[]; until: number }
  | { k: 'beams'; lines: BeamLine[]; until: number }
  /** 預兆判定瞬間的爆發特效 */
  | { k: 'burst'; tele: Telegraph; start: number; until: number };

/** 正確處理方式（回放時標出）：位置、可選的正確面向 */
export interface Fix { x: number; y: number; r?: number; face?: number; label: string }
/** from：要「從此機制開始」練時的起點秒數 */
export interface Check { t: number; tag: string; ok: boolean; warn?: boolean; text: string; fix?: Fix; from?: number }
export interface Hint { x: number; y: number; r?: number; label?: string; cells?: boolean }
/** Bot（非玩家）違反規則被打中的紀錄：自動測試要求為 0 */
export interface BotFail { t: number; tag: string; who: string; why: string }
export type Sfx = 'cast' | 'hit' | 'ok' | 'ng' | 'alert';
/** tip：詠唱條下方的處理提示 */
export interface Cast { name: string; start: number; dur: number; tip?: string }
export interface TimedText { text: string; until: number; danger?: boolean }
export interface SeqItem { t: number; label: string; emb?: boolean }
export interface Pose { type: EmbraceType; from: number; to: number }
export interface VolleyRound { fam: LaneFam; lanes: number[]; glow: number; fire: number }

export interface Extra {
  heart?: boolean;
  /** P1 → P2 前的範圍提示：到這個時間前畫出會消失的外圍 */
  gemWarn?: number;
  clouds?: { rounds: VolleyRound[]; until: number };
  flare?: Record<Alliance, Entity>;
  flareT?: number;
  holy?: boolean;
  arms?: { mode: BladeMode; until: number };
  eyes?: { side: number; until: number };
  orb?: StoredKind | null;
  beam?: Record<Alliance, Entity>;
}

/** ready＝等玩家按「開始」；count＝倒數；run＝進行中；end＝結束 */
export type Phase = 'ready' | 'count' | 'run' | 'end';

export interface GameState {
  t: number;
  state: Phase;
  countT: number;
  ents: Entity[];
  player: Entity;
  ev: Scheduler;
  tele: Telegraph[];
  fx: Effect[];
  cast: Cast | null;
  line: TimedText | null;
  alert: TimedText | null;
  toasts: TimedText[];
  /** 示範模式：Bot 代打玩家 */
  auto: boolean;
  checks: Check[];
  fails: string[];
  endT: number;
  hints: Hint[];
  embHint: Hint | null;
  poses: Pose[];
  extra: Extra;
  paused: boolean;
  /** 技能冷卻結束時間（依技能列索引） */
  cds: Record<number, number>;
  tl: boolean;
  seq: SeqItem[];
  stored: StoredKind | null;
  /** 指定機制樣式（教學頁用，例如 { embrace: 'cover' }）；沒指定的照亂數 */
  pick?: Record<string, string>;
  ff: boolean;
  /** 目前「擁有」Bot 回原位權的機制 */
  active?: object;
  result?: { ok: boolean };
  cfg: Config;
  rng: Rng;
  /** 待播放的音效（UI 每幀取走） */
  sfx: Sfx[];
  botFails: BotFail[];
  /** 從時間軸的某個機制開始練：之前的部分已快轉 */
  startAt: number;
  /** 本局每個機制目前處理情形（給失誤統計）：tag → 有沒有失誤 */
  mech: Record<string, boolean>;
  /** P1 開場（準備階段）的圓形場地；暗之大泛濫後變成 P2 魔法陣 */
  round?: boolean;
  /** P3（程式裡沿用 p2 命名；沒有就是 P1 圓形／P2 菱形場地） */
  p2?: P2State;
  /** 最後一次用插言（打斷）的時間 */
  lastInterject?: number;
  /** 錯誤即停：讓這局停下來的那個失誤 */
  stopCheck?: Check;
}

/** 渲染只需要的部分狀態（回放時用錄下來的影格組出同樣的形狀） */
export type RenderState = Pick<GameState, 't' | 'ents' | 'player' | 'tele' | 'fx' | 'extra' | 'poses' | 'stored' | 'hints' | 'embHint' | 'cast' | 'round' | 'p2'>;

export interface Drill {
  tl?: boolean;
  /** 練習項目分組（畫面上的按鈕列）：P1／P2 時間軸／P2 單一機制／P3（'p2'） */
  group?: 'p2';
  name: string;
  sub: string;
  brief: string;
  /** 說明卡「機制說明」要列的機制（drills/mechinfo.ts 的名稱） */
  info?: string[];
  setup(G: GameState): void;
}

export function mkEnt(al: Alliance, role: Role, isPlayer: boolean): Entity {
  const h = homePos(al, role);
  return { al, role, isPlayer, x: h.x, y: h.y, face: Math.PI, mt: { ...h }, ov: null, faceLock: null, forced: null, buffs: {}, embs: [], spot: edgeSpot(al, role), stun: 0, dead: false, px: h.x, py: h.y, pface: Math.PI };
}

export function createState(cfg: Config, auto: boolean, rng: Rng, drill: Drill): GameState {
  const ents: Entity[] = [];
  ALS.forEach((al) => ROLES.forEach((role) => ents.push(mkEnt(al, role, al === cfg.al && role === cfg.role))));
  return {
    t: 0, state: auto ? 'count' : 'ready', countT: 3, ents, player: ents.find((e) => e.isPlayer)!, ev: new Scheduler(), tele: [], fx: [], cast: null, line: null, alert: null, toasts: [],
    auto: !!auto, checks: [], fails: [], endT: 9999, hints: [], embHint: null, poses: [], extra: {}, paused: false, cds: {}, tl: !!drill.tl, seq: [], stored: null, ff: false,
    cfg, rng, sfx: [], botFails: [], startAt: 0, mech: {},
  };
}

// ---- 狀態小工具（機制檔共用） ----
export const at = (G: GameState, t: number, fn: () => void): void => G.ev.at(t, fn);

/**
 * 機制樣式：rolled 是照亂數抽出的樣式；教學頁指定了 G.pick[key] 就改用指定的。
 * 一定先抽亂數再覆蓋，亂數的使用順序不變（同種子仍是同一局）。
 */
export const variant = <T extends string>(G: GameState, key: string, rolled: T): T => (G.pick?.[key] as T | undefined) ?? rolled;
export const setCast = (G: GameState, name: string, dur: number, tip?: string): void => { G.cast = { name, start: G.t, dur, tip }; G.sfx.push('cast'); };
export const say = (G: GameState, text: string, dur = 4): void => { G.line = { text, until: G.t + dur }; };
export const alertMsg = (G: GameState, text: string, dur = 2, danger?: boolean): void => {
  G.alert = { text, until: G.t + dur, danger };
  if (danger) G.sfx.push('alert');
};
export const hasBuff = (G: GameState, e: Entity, k: keyof Buffs): boolean => (e.buffs[k] || 0) > G.t;
export const seqAdd = (G: GameState, t: number, label: string, emb?: boolean): void => { G.seq.push({ t, label, emb }); };
/** 強制位移：time 秒內往 (vx,vy) 方向移動 d 公尺 */
export function force(e: Entity, vx: number, vy: number, d: number, time: number): void {
  e.forced = { vx: (vx * d) / time, vy: (vy * d) / time, left: time };
}
