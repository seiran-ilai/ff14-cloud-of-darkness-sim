/*
 * 超石化
 * 時間點（相對 t0）：0 台詞＋詠唱、場外出現 2 個邪眼（西側上下、東側上下或南側左右三組之一）；
 *   +REACT Bot 走到空曠處；+3 Bot 轉身；+cast 判定。
 * 判定規則：面向王或任一邪眼 gazeAngle 以內 → 石化 stoneDur 秒（無法行動，非致命失誤）。
 * 估計值：詠唱 4.5 秒、±50°、邪眼位置（見 tuning.ts PETRIFY）。
 */
import { BOSS, type Vec } from '../core/constants';
import { angOf, angDiff } from '../core/geometry';
import { DIRNAME } from '../core/format';
import { PETRIFY, REACT } from '../core/tuning';
import { homePos } from '../core/positions';
import { at, setCast, say, seqAdd, type Entity, type GameState } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { npcs } from '../game/bots';

export type EyeSet = keyof typeof PETRIFY.eyes;
const EYE_NAME: Record<EyeSet, string> = { W: '西側', E: '東側', S: '南側' };

/** 王與兩個邪眼的位置 */
export const gazeSources = (set: EyeSet): Vec[] => [BOSS, ...PETRIFY.eyes[set]];

/** 離所有視線來源都最遠的面向（每 5° 找一次，選「離最近的來源最遠」的方向） */
export function safeFace(p: Vec, srcs: Vec[]): number {
  let best = 0, bestGap = -1;
  for (let k = 0; k < 72; k++) {
    const a = (k * Math.PI) / 36;
    const gap = Math.min(...srcs.map((s) => angDiff(a, angOf(s.x - p.x, s.y - p.y))));
    if (gap > bestGap) { bestGap = gap; best = a; }
  }
  return best;
}

export const looksAt = (e: Entity, srcs: Vec[]): boolean => srcs.some((s) => angDiff(e.face, angOf(s.x - e.x, s.y - e.y)) < PETRIFY.gazeAngle);

export function petrify(G: GameState, t0: number): number {
  const tag = '超石化';
  seqAdd(G, t0, '超石化');
  const set = G.rng.pickOne<EyeSet>(['W', 'E', 'S']);
  const srcs = gazeSources(set);
  at(G, t0, () => {
    say(G, '變成沉默的石頭吧！', 3);
    setCast(G, '超石化', PETRIFY.cast, '背對王與兩個邪眼：轉到三者都不在面前的方向');
    G.extra.eyes = { pts: PETRIFY.eyes[set], until: t0 + PETRIFY.cast + 0.5 };
    G.hints = [{ x: 0, y: 4, r: 0, label: `背對王與${EYE_NAME[set]}邪眼` }];
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
