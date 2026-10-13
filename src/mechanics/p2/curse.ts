/*
 * 波動詛咒 → 詛咒式波動炮（P3 華容道，兩隻小王）
 * 時間點（相對 t0）：0 詠唱；+cast 全場 30% 真實傷害（不判定），外場 12 人得到「波動的詛咒」，
 *   3 種秒數各 4 人（第一次 7／33／97 秒、第二次 25／56／104 秒）；結束時朝面向射出扇形。
 * 判定規則：扇形打到別人＝持有人失誤（攻略：面向不會打到人的方向；第二次朝外周）。
 * 估計值：詠唱 4 秒、扇形半徑 20 m、半張角 15°（見 tuning.ts P3.curse）。
 */
import { P3, HIT } from '../../core/tuning';
import { angOf } from '../../core/geometry';
import { hitFan } from '../../core/hit';
import { zoneE } from '../../core/p2';
import { at, setCast, alertMsg, seqAdd, type Entity, type GameState } from '../../game/state';
import { good } from '../../game/results';
import { isBot } from '../../game/bots';
import { failE, SIDES, outers } from './common';

/** 從 e 朝 a 射出的扇形會打到幾個人 */
const victims = (G: GameState, e: Entity, a: number, hb = HIT): Entity[] =>
  G.ents.filter((o) => o !== e && !o.dead && hitFan(o, e, P3.curse.r, a, P3.curse.w, hb));

/** Bot 選面向：從「朝外」開始左右找，第一個不會打到人的方向（找不到 ok＝false） */
function bestFace(G: GameState, e: Entity): { a: number; ok: boolean } {
  const out = angOf(e.x, e.y);
  for (let d = 0; d <= Math.PI; d += Math.PI / 24) {
    for (const a of [out + d, out - d]) if (!victims(G, e, a, HIT + 1).length) return { a, ok: true };
  }
  return { a: out, ok: false };
}
const safeFace = (G: GameState, e: Entity): number => bestFace(G, e).a;

export function curse(G: GameState, t0: number, durs: readonly number[]): number {
  const tag = '詛咒式波動炮';
  seqAdd(G, t0, '波動詛咒（外場上詛咒）');
  const apply = t0 + P3.curse.cast;
  at(G, t0, () => setCast(G, '波動詛咒', P3.curse.cast, '外場 12 人上「波動的詛咒」：結束時朝面向射扇形，面向不會打到人的方向'));
  let last = apply;
  at(G, apply, () => {
    const outs = G.rng.shuffle(SIDES.flatMap((s) => outers(G, s)));
    outs.forEach((e, i) => { e.curse = apply + durs[Math.min(durs.length - 1, Math.floor((i * durs.length) / outs.length))]; });
    if (G.player.curse && zoneE(G.player) !== 'in') alertMsg(G, `你被附加了 ${(G.player.curse - G.t).toFixed(0)} 秒的波動的詛咒`, 2.5);
  });
  durs.forEach((d) => {
    const E = apply + d;
    last = Math.max(last, E);
    seqAdd(G, E, `詛咒式波動炮（${d}s）`, true);
    // Bot：結束前 1 秒開始選面向，到結束前一直重新確認（其他人還在移動）
    [1, 0.6, 0.35, 0.15].forEach((dt) => at(G, E - dt, () => G.ents.forEach((e) => { if (e.curse === E && isBot(G, e) && !e.dead) e.faceLock = safeFace(G, e); })));
    at(G, E - 3, () => {
      const P = G.player;
      if (P.curse === E && !P.dead) alertMsg(G, '詛咒快結束：面向不會打到人的方向', 2.2, true);
    });
    at(G, E, () => {
      G.ents.forEach((e) => {
        if (e.curse !== E) return;
        e.curse = undefined;
        if (e.dead) return;
        if (isBot(G, e)) e.faceLock = null;
        G.tele.push({ k: 'fan', x: e.x, y: e.y, r: P3.curse.r, a: e.face, w: P3.curse.w, until: G.t + 0.01 });
        const hit = victims(G, e, e.face);
        const fix = { x: e.x, y: e.y, r: 1, face: safeFace(G, e), label: '面向不會打到人的方向' };
        if (hit.length) failE(G, e, tag, `詛咒式波動炮打到 ${hit.length} 名隊友`, fix);
        else if (e.isPlayer) good(G, tag, '詛咒式波動炮沒有打到人', fix);
      });
    });
  });
  return last;
}
