// 攻略站位（cycleapple 繁中攻略）。座標是示意圖目測，屬估計。
import { ROLES, BOSS, R, PARTY_MEMBERS, partyOf, type Alliance, type Role, type Party, type Vec } from './constants';
import { edgePoint } from './geometry';
import { BLADE } from './tuning';

/** 原位：A 西、B 中、C 東；MT 組前排、ST 組後排 */
export function homePos(al: Alliance, role: Role): Vec {
  const ax = { A: -8, B: 0, C: 8 }[al];
  const p = partyOf(role);
  const i = PARTY_MEMBERS[p].indexOf(role);
  return { x: ax + (i % 2 ? 1.4 : -1.4), y: (p === 'MT' ? -1 : 4) + (i >= 2 ? 1.6 : 0) };
}

/** 陰冷擁抱外周處理位置：各聯盟分一段邊 */
export function edgeSpot(al: Alliance, role: Role): Vec {
  const i = ROLES.indexOf(role);
  const [a0, a1] = { A: [218, 292], B: [154, 206], C: [68, 142] }[al];
  return edgePoint(((a0 + ((a1 - a0) * i) / 7) * Math.PI) / 180, 2.2);
}

/** 核爆：A 丟西、B 丟南、C 丟東 */
export const FLARE_SPOT: Record<Alliance, Vec> = { A: { x: -R + 3.5, y: 0 }, B: { x: 0, y: R - 3.5 }, C: { x: R - 3.5, y: 0 } };
export const FLARE_DIR_NAME: Record<Alliance, string> = { A: '西', B: '南', C: '東' };

/** 黑暗神聖：A／B／C 由西到東，前排 MT 組、後排 ST 組 */
export const HOLY_SPOT = (al: Alliance, party: Party): Vec => ({ x: { A: -13, B: 0, C: 13 }[al], y: party === 'MT' ? -9.9 : 1.6 });

/** 暗之刃單手安全區中心；side = 1 東、−1 西 */
export const POCKET = (side: number): Vec => ({ x: side * BLADE.pocketX, y: BLADE.pocketY });

/** 連射式：各聯盟直線的方向參考點 */
export const BEAM_F: Record<Alliance, Vec> = { A: { x: -9.3, y: -12.4 }, B: { x: 0, y: -11.8 }, C: { x: 9.3, y: -12.4 } };
export const beamDir = (al: Alliance): Vec => {
  const f = BEAM_F[al], dx = f.x - BOSS.x, dy = f.y - BOSS.y, L = Math.hypot(dx, dy);
  return { x: dx / L, y: dy / L };
};
