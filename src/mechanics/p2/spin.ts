/*
 * 迴旋式波動炮（王）＋跳躍波動炮（小王）（P3 華容道）
 *
 * 迴旋式：台詞「一群螻蟻，把你們趕盡殺絕！」。王隨機面向東或西，順／逆時針旋轉；
 *   +cast 起每 gap 秒一擊、共 5 擊，每擊轉 step（共 90°），打前後的直線（只打內場）。
 *   處理（攻略）：依序往前補 1 格躲開。模擬器：內場 Bot 先算好每一擊前要站的格子（一擊之間最多走一格、
 *   只走進上一擊時沒人的格子），再照表走。
 * 跳躍波動炮：小王跳到平臺內側，正側＝先正面再兩側、側正＝先兩側再正面，扇形 90°。
 *   處理：先站在第一發打不到的區域，第一發後換到另一區。
 * 估計值：見 tuning.ts P3.spin／P3.jump。
 */
import { P3 } from '../../core/tuning';
import { center, rel, sbFacing, zoneE, homeE, type Cell, type Side } from '../../core/p2';
import { hitRect, hitFan } from '../../core/hit';
import type { Vec } from '../../core/constants';
import { at, setCast, alertMsg, say, seqAdd, variant, type Entity, type GameState } from '../../game/state';
import { good } from '../../game/results';
import { isBot } from '../../game/bots';
import { dodge, type Hazard } from '../../game/p3plan';
import { failE, busy, allSettle, SIDES, outers, BOSS3 } from './common';

/** 直線（前後兩端，從王出發各 len 長）會不會打到 p */
const spinHit = (p: Vec, a: number, hb?: number): boolean =>
  hitRect(p, BOSS3, a, P3.spin.len, P3.spin.hw * 2, hb) || hitRect(p, BOSS3, a + Math.PI, P3.spin.len, P3.spin.hw * 2, hb);

export function spin(G: GameState, t0: number): number {
  const tag = '迴旋式波動炮';
  seqAdd(G, t0, '迴旋式波動炮');
  const face = G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, dir = variant(G, 'spinDir', G.rng.chance(0.5) ? 'cw' : 'ccw') === 'cw' ? 1 : -1;
  const hits = [0, 1, 2, 3, 4].map((k) => ({ t: t0 + P3.spin.cast + k * P3.spin.gap, a: face + dir * k * P3.spin.step }));
  const end = hits[4].t;
  at(G, t0, () => {
    setCast(G, '迴旋式波動炮', P3.spin.cast, `王面向${face > 0 ? '東' : '西'}、${dir > 0 ? '順' : '逆'}時針轉 90°：內場跟著直線一格一格往前補`);
    say(G, '一群螻蟻，把你們趕盡殺絕！', 3);
    alertMsg(G, `迴旋式：${dir > 0 ? '順時針' : '逆時針'}`, 2.5);
    if (G.p2) G.p2.aura = { kind: 'spin', face, dir, until: end };
    busy(G, end + 2);
  });
  // Bot：先算好每一擊前要站的格子（有人還在移動、算不出來就再試，直到第一擊前 1 秒）
  // 詠唱很長：第一擊前先有幾個「不會被打」的步驟，讓 Bot 先就位（攻略：坦克先移到深處格）
  const pre: Hazard[] = [0.35, 0.55, 0.75].map((k) => ({ t: t0 + P3.spin.cast * k, hit: () => false }));
  const hz: Hazard[] = [...pre, ...hits.map((h) => ({ t: h.t, hit: (c: Cell) => spinHit(center(c), h.a, 0.6) }))];
  for (let k = 0; k < 4; k++) {
    const tryPlan = (): void => { if (G.p2 && !dodge(G, k, hz.filter((h) => h.t > G.t + 0.3), G.t) && G.t + 0.4 < hits[0].t - 1) at(G, G.t + 0.4, tryPlan); };
    at(G, t0 + 1, tryPlan);
  }
  hits.forEach((h, k) => {
    at(G, h.t - 1.1, () => { if (G.cfg.tele) G.tele.push({ k: 'line', ...BOSS3, a: h.a, hw: P3.spin.hw, len: P3.spin.len, until: h.t }); });
    at(G, h.t, () => G.ents.forEach((e) => {
      if (e.dead || zoneE(e) !== 'in' || !spinHit(e, h.a)) return;
      failE(G, e, tag, `第 ${k + 1} 擊被迴旋式直線打中`, { x: e.x, y: e.y, r: 1, label: '往直線已經掃過的格子補' });
    }));
  });
  at(G, end + 0.1, () => {
    const P = G.player;
    if (zoneE(P) === 'in' && !P.dead && !G.fails.some((f) => f.startsWith(tag))) good(G, tag, '五擊全部躲開');
  });
  allSettle(G, end + 0.3);
  return end;
}

export type JumpOrder = 'frontFirst' | 'sideFirst';

/** 跳躍波動炮的兩個站位區：正面區、側面區（相對 f, r） */
const FRONT: [number, number][] = [[1, -1.2], [1, 1.2], [2.5, -1.2], [2.5, 1.2], [4, -1.2], [4, 1.2]];
const SIDE: [number, number][] = [[-3, -3.5], [-3, 3.5], [-1.5, -4], [-1.5, 4], [-0.5, -4.7], [-0.5, 4.7]];

export function jump(G: GameState, t0: number, order?: JumpOrder): number {
  const tag = '跳躍波動炮';
  const ord: JumpOrder = order ?? variant<JumpOrder>(G, 'jump', G.rng.chance(0.5) ? 'frontFirst' : 'sideFirst');
  seqAdd(G, t0, ord === 'frontFirst' ? '正側跳躍波動炮（小王）' : '側正跳躍波動炮（小王）');
  const t1 = t0 + 4, t2 = t1 + P3.jump.gap;
  const sbAt = (side: Side): Vec => rel(side, P3.jump.f, 0);
  const fans = (side: Side, which: 'front' | 'side'): number[] => (which === 'front' ? [sbFacing(side)] : [sbFacing(side) - Math.PI / 2, sbFacing(side) + Math.PI / 2]);
  const first: 'front' | 'side' = ord === 'frontFirst' ? 'front' : 'side', second = first === 'front' ? 'side' : 'front';
  const spotOf = (_e: Entity, side: Side, zone: 'front' | 'side', i: number): Vec => rel(side, ...(zone === 'front' ? FRONT : SIDE)[i % 6]);
  const idx = new Map<Entity, number>();
  at(G, t0, () => {
    SIDES.forEach((side) => { G.p2!.sb[side < 0 ? 0 : 1].at = sbAt(side); });
    const P = G.player;
    if (zoneE(P) !== 'in') alertMsg(G, ord === 'frontFirst' ? '正側：先躲正面（站兩側），再進正面' : '側正：先躲兩側（站正面），再到兩側', 2.5, true);
    SIDES.forEach((side) => outers(G, side).forEach((e, i) => {
      idx.set(e, i);
      if (isBot(G, e)) { e.mt = spotOf(e, side, second, i); e.buffs.sprint = G.t + 5; }
    }));
    if (zoneE(P) !== 'in' && G.cfg.hint && !G.auto) G.hints = [{ ...spotOf(P, zoneE(P) as Side, second, idx.get(P) ?? 0), r: 1, label: '先站這裡' }];
  });
  const fire = (t: number, which: 'front' | 'side', k: number): void => {
    at(G, t - 1, () => { if (G.cfg.tele) SIDES.forEach((side) => fans(side, which).forEach((a) => G.tele.push({ k: 'fan', ...sbAt(side), r: P3.jump.r, a, w: P3.jump.w, until: t }))); });
    at(G, t, () => {
      SIDES.forEach((side) => G.ents.forEach((e) => {
        if (e.dead || !fans(side, which).some((a) => hitFan(e, sbAt(side), P3.jump.r, a, P3.jump.w))) return;
        failE(G, e, tag, `第 ${k} 發被${which === 'front' ? '正面' : '側面'}扇形打中`, { ...spotOf(e, side, which === 'front' ? 'side' : 'front', idx.get(e) ?? 0), r: 1, label: which === 'front' ? '站兩側' : '站正面' });
      }));
      // 第一發後換區
      if (k === 1) {
        SIDES.forEach((side) => outers(G, side).forEach((e) => { if (isBot(G, e)) e.mt = spotOf(e, side, first, idx.get(e) ?? 0); }));
        const P = G.player;
        if (zoneE(P) !== 'in' && G.cfg.hint && !G.auto) G.hints = [{ ...spotOf(P, zoneE(P) as Side, first, idx.get(P) ?? 0), r: 1, label: '換區' }];
      }
    });
  };
  fire(t1, first, 1);
  fire(t2, second, 2);
  at(G, t2 + 0.1, () => {
    G.hints = [];
    SIDES.forEach((side) => { G.p2!.sb[side < 0 ? 0 : 1].at = null; });
    const P = G.player;
    if (zoneE(P) !== 'in' && !P.dead && !G.fails.some((f) => f.startsWith(tag))) good(G, tag, '兩發都躲開');
  });
  at(G, t2 + 0.3, () => SIDES.forEach((side) => outers(G, side).forEach((e) => { if (isBot(G, e)) e.mt = homeE(e); })));
  return t2;
}
