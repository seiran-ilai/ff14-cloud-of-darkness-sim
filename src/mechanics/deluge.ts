/*
 * 暗之泛濫（P1 階段結束）
 * 時間點（相對 t0）：0 詠唱；+cast 全場 AOE、場地恢復初始狀態；+cast+1 結束練習。
 * 判定規則：無（全場傷害，練習在此結束）。
 * 估計值：詠唱 4 秒（見 tuning.ts DELUGE）。
 */
import { DELUGE } from '../core/tuning';
import { at, setCast, alertMsg, seqAdd, type GameState } from '../game/state';

export function deluge(G: GameState, t0: number): number {
  seqAdd(G, t0, '暗之泛濫（階段結束）');
  at(G, t0, () => setCast(G, '暗之泛濫', DELUGE.cast));
  at(G, t0 + DELUGE.cast, () => { G.fx.push({ k: 'flash', until: G.t + 0.4 }); alertMsg(G, '場地恢復初始狀態', 2); });
  at(G, t0 + DELUGE.cast + 1, () => { G.endT = G.t; });
  return t0 + DELUGE.cast + 1;
}
