// 使用者設定（存 localStorage）
import { store } from './storage';
import type { Alliance, Role } from './constants';

export type ActType = 'sprint' | 'akb' | 'dash';
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
  /** 時間軸中陣亡後繼續 */
  cont: boolean;
  /** 單練陰冷擁抱的減益長度 */
  dur: number;
  cdReset: boolean;
  /** 鏡頭：固定北在上／跟隨角色並放大 */
  cam: 'fixed' | 'follow';
  sound: boolean;
  acts: ActionConfig[];
  al: Alliance;
  role: Role;
  drill: string;
}

export const MAX_ACTS = 8;

export const DEFAULT_ACTS: readonly ActionConfig[] = [
  { name: '疾跑', type: 'sprint', code: 'Digit1', label: '1', dist: 0, dur: 10, cd: 60 },
  { name: '防擊退', type: 'akb', code: 'Digit2', label: '2', dist: 0, dur: 6, cd: 120 },
  { name: '前衝', type: 'dash', dir: 'fwd', code: 'Digit3', label: '3', dist: 15, dur: 0, cd: 30 },
  { name: '後跳', type: 'dash', dir: 'back', code: 'Digit4', label: '4', dist: 10, dur: 0, cd: 30 },
];

export const cloneActs = (a: readonly ActionConfig[]): ActionConfig[] => JSON.parse(JSON.stringify(a));

export function defaultConfig(): Config {
  return { auto: true, speed: 1, hint: true, text: true, tele: true, cont: true, dur: 14, cdReset: true, cam: 'fixed', sound: true, acts: cloneActs(DEFAULT_ACTS), al: 'A', role: 'D3', drill: 'tl1' };
}

export function loadConfig(): Config {
  const d = defaultConfig();
  return {
    auto: store.get('auto', d.auto),
    speed: store.get('speed', d.speed),
    hint: store.get('hint', d.hint),
    text: store.get('text', d.text),
    tele: store.get('tele', d.tele),
    cont: store.get('cont', d.cont),
    dur: store.get('dur', d.dur),
    cdReset: store.get('cdReset', d.cdReset),
    cam: store.get('cam', d.cam),
    sound: store.get('sound', d.sound),
    acts: store.get<ActionConfig[] | null>('acts', null) || d.acts,
    al: store.get('al', d.al),
    role: store.get('role', d.role),
    drill: store.get('drill', d.drill),
  };
}

export function saveConfig(cfg: Config): void {
  (Object.keys(cfg) as (keyof Config)[]).forEach((k) => store.set(k, cfg[k]));
}
