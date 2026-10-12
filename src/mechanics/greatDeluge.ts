/*
 * 暗之大泛濫
 * 時間點（相對 t0）：0 詠唱；+cast 大傷害全場 AOE，全員附加 15 秒「出血」，場地變化（onField）。
 * 判定規則：全場傷害沒有判定；場地變化後腳下沒有地板就會掉下去（由模擬迴圈判定）。
 *   開場：進入第一次魔法陣（P1）；P1 之後：進入華容道（P2），要先站到 P2 的位置。
 * 估計值：詠唱 6 秒（見 tuning.ts GREAT_DELUGE）；出血 15 秒依 docs。
 */
import { GREAT_DELUGE } from '../core/tuning';
import { at, setCast, alertMsg, seqAdd, type GameState } from '../game/state';

export function greatDeluge(G: GameState, t0: number, note: string, onField?: () => void): number {
  const tR = t0 + GREAT_DELUGE.cast;
  seqAdd(G, t0, `暗之大泛濫（${note}）`);
  at(G, t0, () => setCast(G, '暗之大泛濫', GREAT_DELUGE.cast));
  at(G, tR, () => {
    G.fx.push({ k: 'flash', until: G.t + 0.5 });
    G.ents.forEach((e) => { if (!e.dead) e.buffs.bleed = G.t + GREAT_DELUGE.bleed; });
    alertMsg(G, `場地變化：${note}`, 2.5);
    onField?.();
  });
  return tR;
}
