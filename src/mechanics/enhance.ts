/*
 * 超賦風／超賦死
 * 時間點（相對 t0）：0 台詞＋詠唱；+cast 王獲得「雲之魔刃」（儲存飆風或極死）。
 * 判定規則：本身無判定；下一次暗之刃（bladeRelease）後無讀條釋放。
 * 估計值：詠唱 2.5 秒（見 tuning.ts ENHANCE）。
 */
import { ENHANCE } from '../core/tuning';
import { at, setCast, say, seqAdd, type GameState, type StoredKind } from '../game/state';

export function enhance(G: GameState, t0: number, kind: StoredKind): number {
  seqAdd(G, t0, kind === 'aero' ? '超賦風（儲存飆風）' : '超賦死（儲存極死）');
  at(G, t0, () => {
    say(G, kind === 'aero' ? '狂風，匯於我的雙腕之中！' : '死亡，匯於我的雙腕之中！', 3);
    setCast(G, kind === 'aero' ? '超賦風' : '超賦死', ENHANCE.cast);
  });
  at(G, t0 + ENHANCE.cast, () => { G.stored = kind; });
  return t0 + ENHANCE.cast;
}
