/*
 * 暗之泛濫（P2 第一次魔法陣、P3 華容道結束）
 * 時間點（相對 t0）：0 詠唱；+cast 全場 AOE、場地恢復初始狀態（P1 的大圓形）；+cast+1 結束練習（endGame；連續模式接下一階段）。
 * 判定規則：無（全場傷害）。
 * 估計值：詠唱 4 秒（見 tuning.ts DELUGE）。
 */
import { DELUGE } from '../core/tuning';
import { homePos } from '../core/positions';
import { at, setCast, alertMsg, seqAdd, type GameState } from '../game/state';
import { npcs } from '../game/bots';

export function deluge(G: GameState, t0: number, endGame = true): number {
  seqAdd(G, t0, '暗之泛濫（階段結束）');
  at(G, t0, () => setCast(G, '暗之泛濫', DELUGE.cast, '全場 AOE，場地恢復初始狀態'));
  at(G, t0 + DELUGE.cast, () => {
    G.fx.push({ k: 'flash', until: G.t + 0.4 });
    alertMsg(G, '場地恢復初始狀態', 2);
    // 場地回到 P1 的大圓形（華容道的格子、平臺也消失）
    G.round = true;
    if (G.p2) {
      G.p2 = undefined;
      G.ents.forEach((e) => { e.nav = undefined; e.p2r = undefined; e.seat = undefined; });
    }
    npcs(G).forEach((e) => { e.mt = homePos(e.al, e.role); e.ov = null; });
  });
  if (endGame) at(G, t0 + DELUGE.cast + 1, () => { G.endT = G.t; });
  return t0 + DELUGE.cast + 1;
}
