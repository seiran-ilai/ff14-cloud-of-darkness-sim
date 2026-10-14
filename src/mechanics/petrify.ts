/*
 * 超石化
 * 時間點（相對 t0）：0 台詞＋詠唱、場外出現 3 個邪眼（正面 1 個＋隨機東或西 2 個）；+3 Bot 轉身；+cast 判定。
 * 判定規則：面向王或任一邪眼 gazeAngle 以內 → 石化 stoneDur 秒（無法行動，非致命失誤）。
 * 處理（兩種都可以，判定只看面向）：
 *   原地背對（攻略）：面向沒有邪眼的東或西。
 *   角落面壁（更安全）：跑到王最左／最右側的角落（翅膀是盲區），面向場外。
 * 估計值：詠唱 4.5 秒、±60°、邪眼在場外 2.5 m、南北 ±4.5 m、角落位置（見 tuning.ts PETRIFY）。
 */
import { BOSS, R, type Vec } from '../core/constants';
import { angOf, angDiff } from '../core/geometry';
import { DIRNAME } from '../core/format';
import { PETRIFY, REACT } from '../core/tuning';
import { homePos } from '../core/positions';
import { at, setCast, say, seqAdd, variant, type Entity, type GameState } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { npcs } from '../game/bots';

/** 正面的邪眼（王的北邊、場外） */
export const FRONT_EYE: Vec = { x: 0, y: -(R + PETRIFY.eyeOut) };

/** 王與三個邪眼的位置（正面 1 個＋側邊 2 個）；side = −1 西、1 東 */
export const gazeSources = (side: number): Vec[] => [BOSS, FRONT_EYE, { x: side * (R + PETRIFY.eyeOut), y: -PETRIFY.eyeY }, { x: side * (R + PETRIFY.eyeOut), y: PETRIFY.eyeY }];

/** 角落面壁：王最左（s = −1）／最右（s = 1）側的角落位置，以及面向場外的方向（西北／東北） */
export const cornerSpot = (s: number): Vec => ({ x: s * PETRIFY.cornerX, y: PETRIFY.cornerY });
export const cornerFace = (s: number): number => (s * Math.PI) / 4;

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
  const side = variant(G, 'petrify', G.rng.chance(0.5) ? 'west' : 'east') === 'west' ? -1 : 1;
  const srcs = gazeSources(side);
  // Bot 的處理方式（教學頁可以指定；平常照攻略原地背對）
  const corner = variant<'stay' | 'corner'>(G, 'petrifyHow', 'stay') === 'corner';
  const sideOf = (e: Entity): number => (e.x < 0 ? -1 : 1);
  at(G, t0, () => {
    say(G, '變成沉默的石頭吧！', 3);
    setCast(G, '超石化', PETRIFY.cast, `背對王與邪眼：原地面向沒有邪眼的那一側（${side < 0 ? '東' : '西'}），或跑到王最左／右側的角落面向場外`);
    G.extra.eyes = { side, until: t0 + PETRIFY.cast + 0.5 };
    G.hints = corner
      ? [-1, 1].map((s) => ({ ...cornerSpot(s), r: 2.5, label: '角落面壁' }))
      : [{ x: -side * 6, y: 0, r: 0, label: `背對王與${side < 0 ? '西' : '東'}側邪眼` }];
  });
  // 邪眼出現（預兆）後：原地背對＝走回空曠處（原位）；角落面壁＝跑到自己那一側的角落，才轉身
  at(G, t0 + REACT, () => npcs(G).forEach((e) => {
    if (e.dead) return;
    if (!corner) { e.mt = homePos(e.al, e.role); return; }
    const c = cornerSpot(sideOf(e)), a = G.rng.rnd(0, 6.28), r = G.rng.rnd(0, 2.2);
    e.mt = { x: c.x + Math.sin(a) * r, y: c.y + Math.abs(Math.cos(a)) * r };
    e.buffs.sprint = G.t + 4;
  }));
  at(G, t0 + 3, () => npcs(G).forEach((e) => { e.faceLock = corner ? cornerFace(sideOf(e)) : safeFace(e, srcs); }));
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
