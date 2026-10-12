// 場地與角色常數。估計值（跑速、判定圈…）放在 tuning.ts，這裡轉出方便沿用舊名。
export { RUN, HIT } from './tuning';

export interface Vec { x: number; y: number }

/** 菱形場地中心到角的距離 (m) */
export const R = 31;
/** 王的位置：北角內側 */
export const BOSS: Readonly<Vec> = { x: 0, y: -20 };
/** 菱形在 (u,v) 座標是半邊長 HALF 的正方形，切成 4×4 格 */
export const HALF = R / Math.SQRT2;
export const CELL = HALF / 2;
export const O0: Readonly<Vec> = { x: 0, y: 0 };

export const ROLES = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;
export type Role = (typeof ROLES)[number];
export const ALS = ['A', 'B', 'C'] as const;
export type Alliance = (typeof ALS)[number];
export type RoleType = 'tank' | 'heal' | 'dps';
export type Party = 'MT' | 'ST';

export const roleType = (r: Role): RoleType => (r[0] === 'H' ? 'heal' : r === 'MT' || r === 'ST' ? 'tank' : 'dps');
export const PARTY_MEMBERS: Record<Party, readonly Role[]> = { MT: ['MT', 'H1', 'D1', 'D3'], ST: ['ST', 'H2', 'D2', 'D4'] };
export const partyOf = (r: Role): Party => (PARTY_MEMBERS.MT.includes(r) ? 'MT' : 'ST');

export const ROLE_COL: Record<RoleType, string> = { tank: '#4f7ff2', heal: '#3cba6a', dps: '#d65454' };
