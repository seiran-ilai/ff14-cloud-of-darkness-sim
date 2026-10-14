/*
 * 暗之刃（＋超賦後的 bladeRelease）
 * 時間點（相對 t0）：0 開始詠唱、王舉刀；+cast 判定。bladeRelease 在判定後接無讀條的飆風／極死。
 * 判定規則：L／R 單手 → 安全區在沒舉手那側的王前方圓（判定圈要整個在 pocketR 內）；
 *   B 雙手 → 判定圈碰到王周圍 bothR 即中。被打中為非致命失誤（DoT）。
 *   正常戰鬥 3 次暗之刃不重複；超賦後一定是單手（由時間軸組裝時保證）。
 * 估計值：詠唱 4.5 秒、安全區 (±11, −10.5) 半徑 6.5 m、雙手半徑 17 m（見 tuning.ts BLADE）。
 * P1 開場（圓形場地）：單手安全區 (±9, −28.5) 半徑 7.4 m、雙手是北半場的橢圓，退到地面中央正方形的北角即安全（見 tuning.ts OPENER）。
 */
import { BOSS } from '../core/constants';
import { hitCircle, insideCircle } from '../core/hit';
import { BLADE, OPENER, FLOOR_SQ, HIT } from '../core/tuning';
import { POCKET, OPENER_POCKET } from '../core/positions';
import { at, setCast, seqAdd, type BladeMode, type Entity, type Fix, type GameState, type StoredKind } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { claim, npcSettle, npcs, afterVolley, atOrNow, goAfterVolley } from '../game/bots';
import { aero } from './aero';
import { death } from './death';

/** L＝左手舉刀 → 安全區在東（side 1）；R → 西（side −1） */
export const bladeSide = (mode: BladeMode): number => (mode === 'L' ? 1 : -1);

export function blade(G: GameState, t0: number, mode: BladeMode, tagExtra = '', goHome = true): number {
  const tag = '暗之刃' + tagExtra;
  const me = claim(G, t0);
  if (goHome) npcSettle(G, t0 + BLADE.cast + 0.3, me);
  const side = bladeSide(mode);
  // P1 開場圓形場地：單手安全區在場地北緣王的左右兩側；雙手打北半場的橢圓，站到地面中央正方形的北角就安全。
  // 連續模式裡同一局會從 P1 進到 P2，所以場地形狀要在開始詠唱時才決定
  const shape = (round: boolean) => {
    const pocket = round ? { c: OPENER_POCKET(side), r: OPENER.pocketR } : { c: POCKET(side), r: BLADE.pocketR };
    const inBoth = (e: Entity): boolean => (round
      ? ((e.x / (OPENER.bothRX + HIT)) ** 2 + ((e.y - OPENER.bothCY) / (OPENER.bothRY + HIT)) ** 2 <= 1)
      : hitCircle(e, BOSS, BLADE.bothR));
    const bothLabel = round ? '到地面中央正方形的北角（直角）' : '離開王身邊';
    const safe = (e: Entity): boolean => (mode === 'B' ? !inBoth(e) : insideCircle(e, pocket.c, pocket.r));
    const fix: Fix = mode === 'B' ? (round ? { x: 0, y: -FLOOR_SQ + 0.8, r: 1.6, label: bothLabel } : { x: 0, y: 5, r: 3, label: bothLabel }) : { ...pocket.c, r: pocket.r - 1, label: `沒舉手那側（${side > 0 ? '東' : '西'}）` };
    return { round, pocket, bothLabel, safe, fix };
  };
  let S = shape(false);
  at(G, t0, () => {
    S = shape(!!G.round);
    const { round, pocket, bothLabel, fix } = S;
    setCast(G, '暗之刃', BLADE.cast, round ? '看王舉刀：單手→到沒握刀那隻手那側（場地北緣）；雙手→退到地面中央正方形的北角（直角），不用退太後面' : '看王舉刀：單手→到沒舉手那側的王前方；雙手→離開王腳下');
    G.extra.arms = { mode, until: t0 + BLADE.cast + 0.1 };
    const spots = new Map(npcs(G).map((e) => {
      if (mode === 'B' && round) return [e, { x: G.rng.rnd(-3, 3), y: -FLOOR_SQ + G.rng.rnd(0.3, 1.6) }];
      if (mode === 'B') return [e, { x: G.rng.rnd(-9, 9), y: G.rng.rnd(3, 8) }];
      // 開場的安全區有一半在場外：Bot 站在安全區靠場內那一半
      const p = round ? { x: pocket.c.x, y: pocket.c.y + 3 } : pocket.c, a = G.rng.rnd(0, 6.28), r = G.rng.rnd(0, round ? 2 : 3.6);
      return [e, { x: p.x + Math.sin(a) * r, y: p.y + Math.cos(a) * r }];
    }));
    // 齊射途中開始詠唱（攻略：約第 3 發）：躲完第 4 發才過去
    spots.forEach((p, e) => { e.buffs.sprint = G.t + 5; goAfterVolley(G, e, p); });
    atOrNow(G, afterVolley(G), () => { G.hints = [{ ...fix, label: mode === 'B' ? bothLabel : '沒舉手那側' }]; });
  });
  at(G, t0 + BLADE.cast, () => {
    G.hints = [];
    const P = G.player, { round, pocket, safe, fix } = S;
    G.fx.push(mode === 'B'
      ? (round ? { k: 'bladeB', ell: { cx: 0, cy: OPENER.bothCY, rx: OPENER.bothRX, ry: OPENER.bothRY }, until: G.t + 0.6 } : { k: 'bladeB', until: G.t + 0.6 })
      : { k: 'bladeS', side, pocket: round ? { ...pocket.c, r: pocket.r } : undefined, until: G.t + 0.6 });
    G.ents.forEach((e) => { if (!e.isPlayer && !e.dead && !safe(e)) botHit(G, e, tag, '被暗之刃打中'); });
    if (P.dead) return;
    if (safe(P)) good(G, tag, mode === 'B' ? '躲開雙手暗之刃' : '站在沒舉手那側的安全區', fix);
    else hurtPlayer(G, tag, mode === 'B' ? (round ? '沒退到地面中央正方形的北角，被雙手暗之刃打中' : '站在王身邊，被雙手暗之刃打中') : '不在沒舉手那側的安全區', false, fix);
  });
  return t0 + BLADE.cast;
}

/** 超賦後的暗之刃（一定單手），判定後無讀條釋放儲存的飆風／極死 */
export function bladeRelease(G: GameState, t0: number, mode: BladeMode, kind: StoredKind): number {
  seqAdd(G, t0, `暗之刃＋${kind === 'aero' ? '飆風' : '極死'}（超賦）`);
  const end = blade(G, t0, mode, '（超賦）', false);
  return kind === 'aero' ? aero(G, end, 0) : death(G, end, 0);
}
