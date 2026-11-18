/*
 * 進入 P3（程式裡沿用 p2 命名）：場地變成井字內場＋東西平臺＋環狀地板，所有人站到攻略的基本站位。
 * 分組（イディル改）：內場 B 隊伍 8 人＋A／C 的 ST、H1；西平臺 A 隊伍其餘 6 人；東平臺 C 隊伍其餘 6 人。
 */
import { angOf } from '../../core/geometry';
import { homeE, zoneE, sbPos } from '../../core/p2';
import type { GameState } from '../../game/state';
import { createP2 } from '../../game/p2state';

/** keep：保留目前位置（暗之大泛濫時大家已經先跑好位）；否則直接放到基本站位 */
export function enterP2(G: GameState, keep = false): void {
  G.p2 = createP2();
  G.ents.forEach((e) => {
    const h = homeE(e), z = zoneE(e);
    const look = z === 'in' ? { x: 0, y: 0 } : sbPos(z);
    Object.assign(e, { mt: { ...h }, ov: null, faceLock: null });
    if (keep) return;
    Object.assign(e, { x: h.x, y: h.y, px: h.x, py: h.y });
    e.face = e.pface = angOf(look.x - h.x, look.y - h.y);
  });
}
