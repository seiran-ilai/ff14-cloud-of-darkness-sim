/*
 * 深暗領域（P2 開場）
 * 時間點（相對 t0）：0 王開始詠唱；+cast 全場 AOE，外周環狀地板變成出血區域 bleed 秒。
 * 判定規則：出血期間站在環狀地板上（不在平臺上）算失誤。
 * TODO(確認): docs 寫「圓環區域變為持續一段時間的出血區域」，攻略寫「外周環狀地板變為即死地板」，目前照 docs 做成非致命出血。
 * 估計值：詠唱 4 秒、出血 20 秒（見 tuning.ts DOMAIN）。
 */
import { DOMAIN } from '../../core/tuning';
import { onPlatform, onRing } from '../../core/p2';
import { at, setCast, alertMsg, seqAdd, type Entity, type GameState } from '../../game/state';
import { bad, good, botHit } from '../../game/results';

export function domain(G: GameState, t0: number): number {
  const tag = '深暗領域';
  seqAdd(G, t0, '深暗領域');
  const end = t0 + DOMAIN.cast + DOMAIN.bleed;
  const caught = new Set<Entity>();
  const onBleed = (e: Entity): boolean => onRing(e) && !onPlatform(e);
  at(G, t0, () => setCast(G, '深暗領域', DOMAIN.cast));
  at(G, t0 + DOMAIN.cast, () => {
    G.fx.push({ k: 'flash', until: G.t + 0.4 });
    G.p2!.bleedUntil = end;
    alertMsg(G, '外周環狀地板變成出血區域', 2.5, true);
  });
  for (let t = t0 + DOMAIN.cast; t < end; t += 0.5) {
    at(G, t, () => G.ents.forEach((e) => {
      if (e.dead || caught.has(e) || !onBleed(e)) return;
      caught.add(e);
      if (e.isPlayer) bad(G, tag, '站在出血的環狀地板上', { x: e.x < 0 ? -23.5 : 23.5, y: 0, r: 2, label: '留在平臺上' });
      else botHit(G, e, tag, '站在出血的環狀地板上');
    }));
  }
  at(G, t0 + DOMAIN.cast + 1, () => { if (!caught.has(G.player) && !G.player.dead) good(G, tag, '沒有站在出血的環狀地板上'); });
  return t0 + DOMAIN.cast;
}
