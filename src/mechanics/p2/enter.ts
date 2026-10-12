/*
 * 進入 P2 華容道：場地變成井字內場＋東西平臺＋環狀地板，所有人站到攻略的基本站位。
 * 分組（イディル改）：內場 B 聯盟 8 人＋A／C 的 ST、H1；西平臺 A 聯盟其餘 6 人；東平臺 C 聯盟其餘 6 人。
 */
import { angOf } from '../../core/geometry';
import { p2Home, zoneOf, sbPos } from '../../core/p2';
import type { GameState } from '../../game/state';
import { createP2 } from '../../game/p2state';

export function enterP2(G: GameState): void {
  G.p2 = createP2();
  G.ents.forEach((e) => {
    const h = p2Home(e.al, e.role), z = zoneOf(e.al, e.role);
    const look = z === 'in' ? { x: 0, y: 0 } : sbPos(z);
    Object.assign(e, { x: h.x, y: h.y, px: h.x, py: h.y, mt: { ...h }, ov: null, faceLock: null });
    e.face = e.pface = angOf(look.x - h.x, look.y - h.y);
  });
}
