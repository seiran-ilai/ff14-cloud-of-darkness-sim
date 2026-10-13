// 使用者設定（存 localStorage）
import { store } from './storage';
import type { Alliance, Role } from './constants';

export type PickMode = 'one' | 'cont' | 'rand';
export type ActType = 'sprint' | 'akb' | 'dash' | 'interject';
export type DashDir = 'fwd' | 'back' | 'left' | 'right';

export interface ActionConfig {
  name: string;
  type: ActType;
  dir?: DashDir;
  /** KeyboardEvent.code */
  code: string;
  /** 顯示在按鈕上的按鍵名 */
  label: string;
  /** 位移距離 m */
  dist: number;
  /** 持續秒數 */
  dur: number;
  /** 冷卻秒數 */
  cd: number;
}

export interface Config {
  /** 移動時自動面向移動方向 */
  auto: boolean;
  speed: number;
  hint: boolean;
  text: boolean;
  tele: boolean;
  /** 模式：stop＝錯誤即停（犯錯立刻停下分析）、continue＝錯誤不停（打完整段，陣亡也繼續） */
  failMode: 'stop' | 'continue';
  /** 單練陰冷擁抱的減益長度 */
  dur: number;
  cdReset: boolean;
  /** 鏡頭：固定北在上／跟隨角色並放大 */
  cam: 'fixed' | 'follow';
  /** 跟隨鏡頭的距離：近／中／遠（看得到多少場外） */
  zoom: 'near' | 'mid' | 'far';
  /** 大遊戲畫面：舞台佔滿整個寬度，說明欄移到下面 */
  big: boolean;
  /** 收起兩側的說明欄：遊戲畫面變大 */
  hideSides: boolean;
  sound: boolean;
  acts: ActionConfig[];
  al: Alliance;
  role: Role;
  drill: string;
  /** 練習方式（三選一）：單一階段／從指定階段連續打到最後／隨機練習 */
  pick: PickMode;
  /** 隨機練習：可否重複、分鐘數、選的機制（空＝全部） */
  rand: { repeat: boolean; mins: number; ids: string[] };
}

export const MAX_ACTS = 8;

export const DEFAULT_ACTS: readonly ActionConfig[] = [
  { name: '疾跑', type: 'sprint', code: 'Digit1', label: '1', dist: 0, dur: 10, cd: 60 },
  { name: '防擊退', type: 'akb', code: 'Digit2', label: '2', dist: 0, dur: 6, cd: 120 },
  { name: '前衝', type: 'dash', dir: 'fwd', code: 'Digit3', label: '3', dist: 15, dur: 0, cd: 30 },
  { name: '後跳', type: 'dash', dir: 'back', code: 'Digit4', label: '4', dist: 10, dur: 0, cd: 30 },
  { name: '插言', type: 'interject', code: 'Digit5', label: '5', dist: 0, dur: 0, cd: 30 },
];

export const cloneActs = (a: readonly ActionConfig[]): ActionConfig[] => JSON.parse(JSON.stringify(a));

export function defaultConfig(): Config {
  return { auto: true, speed: 1, hint: true, text: true, tele: true, failMode: 'stop', dur: 14, cdReset: true, cam: 'fixed', zoom: 'mid', big: false, hideSides: false, sound: true, acts: cloneActs(DEFAULT_ACTS), al: 'A', role: 'D3', drill: 'run:one:p1', pick: 'one', rand: { repeat: true, mins: 3, ids: [] } };
}

/** 舊設定沒有插言（P3 打斷小王用）：補在最後 */
function withInterject(acts: ActionConfig[]): ActionConfig[] {
  if (acts.some((a) => a.type === 'interject') || acts.length >= MAX_ACTS) return acts;
  return [...acts, { ...DEFAULT_ACTS.find((a) => a.type === 'interject')! }];
}

export function loadConfig(): Config {
  const d = defaultConfig();
  return {
    auto: store.get('auto', d.auto),
    // 舊版截圖網址會把速度存成 0，讀到不合理的值就用預設
    speed: (() => { const v = store.get('speed', d.speed); return typeof v === 'number' && v > 0 ? v : d.speed; })(),
    hint: store.get('hint', d.hint),
    text: store.get('text', d.text),
    tele: store.get('tele', d.tele),
    failMode: store.get('failMode', d.failMode),
    dur: store.get('dur', d.dur),
    cdReset: store.get('cdReset', d.cdReset),
    cam: store.get('cam', d.cam),
    zoom: store.get('zoom', d.zoom),
    big: store.get('big', d.big),
    hideSides: store.get('hideSides', d.hideSides),
    sound: store.get('sound', d.sound),
    acts: withInterject(store.get<ActionConfig[] | null>('acts', null) || d.acts),
    al: store.get('al', d.al),
    role: store.get('role', d.role),
    drill: store.get('drill', d.drill),
    pick: store.get('pick', d.pick),
    rand: store.get('rand', d.rand),
  };
}

export function saveConfig(cfg: Config): void {
  (Object.keys(cfg) as (keyof Config)[]).forEach((k) => store.set(k, cfg[k]));
}
