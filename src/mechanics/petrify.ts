/*
 * 超石化
 * 時間點（相對 t0）：0 台詞＋詠唱、場外東或西出現 2 個邪眼；+3 Bot 轉身；+cast 判定。
 * 判定規則：面向王或任一邪眼 gazeAngle 以內 → 石化 stoneDur 秒（無法行動，非致命失誤）。
 * 估計值：詠唱 4.5 秒、±60°、邪眼在場外 2.5 m、南北 ±4.5 m（見 tuning.ts PETRIFY）。
 */
import { BOSS, R, type Vec } from '../core/constants';
import { angOf, angDiff } from '../core/geometry';
import { DIRNAME } from '../core/format';
import { PETRIFY, REACT } from '../core/tuning';
import { homePos } from '../core/positions';
import { at, setCast, say, seqAdd, type Entity, type GameState } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { npcs } from '../game/bots';

/** 王與兩個邪眼的位置；side = −1 西、1 東 */
export const gazeSources = (side: number): Vec[] => [BOSS, { x: side * (R + PETRIFY.eyeOut), y: -PETRIFY.eyeY }, { x: side * (R + PETRIFY.eyeOut), y: PETRIFY.eyeY }];

/** 背對所有視線來源的合向量 */
export function safeFace(p: Vec, srcs: Vec[]): number {
  let sx = 0, sy = 0;
  srcs.forEach((s) => { const d = Math.hypot(s.x - p.x, s.y - p.y) || 1; sx += (s.x - p.x) / d; sy += (s.y - p.y) / d; });
  return angOf(-sx, -sy);
}

export const looksAt = (e: Entity, srcs: Vec[]): boolean => srcs.some((s) => angDiff(e.face, angOf(s.x - e.x, s.y - e.y)) < PETRIFY.gazeAngle);

export function petrify(G: GameState, t0: number): number {
  const tag = '超石化';
  seqAdd(G, t0, '超石化');
  const side = G.rng.chance(0.5) ? -1 : 1;
  const srcs = gazeSources(side);
  at(G, t0, () => {
    say(G, '變成沉默的石頭吧！', 3);
    setCast(G, '超石化', PETRIFY.cast, '背對王與邪眼：面向沒有邪眼的那一側');
    G.extra.eyes = { side, until: t0 + PETRIFY.cast + 0.5 };
    G.hints = [{ x: -side * 6, y: 0, r: 0, label: `背對王與${side < 0 ? '西' : '東'}側邪眼` }];
  });
  // 邪眼出現（預兆）後走到空曠處（原位），才轉身背對
  at(G, t0 + REACT, () => npcs(G).forEach((e) => { if (!e.dead) e.mt = homePos(e.al, e.role); }));
  at(G, t0 + 3, () => npcs(G).forEach((e) => { e.faceLock = safeFace(e, srcs); }));
  at(G, t0 + PETRIFY.cast, () => {
    G.hints = [];
    const P = G.player;
    G.fx.push({ k: 'gaze', srcs, until: G.t + 0.6 });
    G.ents.forEach((e) => { if (!e.isPlayer && !e.dead && looksAt(e, srcs)) botHit(G, e, tag, '面向王或邪眼被石化'); });
    if (!P.dead) {
      const fix = { x: P.x, y: P.y, face: safeFace(P, srcs), label: `面向${DIRNAME(safeFace(P, srcs))}` };
      if (looksAt(P, srcs)) {
        P.stun = G.t + PETRIFY.stoneDur;
        P.stunKind = 'stone';
        hurtPlayer(G, tag, `面向${DIRNAME(P.face)}，看到王或邪眼被石化 9 秒`, false, fix);
      } else good(G, tag, `面向${DIRNAME(P.face)}，沒看到王與邪眼`, fix);
    }
    npcs(G).forEach((e) => { e.faceLock = null; });
  });
  return t0 + PETRIFY.cast;
}
