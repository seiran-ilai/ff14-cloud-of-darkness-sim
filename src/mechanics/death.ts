/*
 * 極死（castLen = 0 代表超賦後無讀條）
 * 時間點（相對 tP = t0 + castLen，無讀條則 t0 + storedDelay）：tP 吸引；+circleTele 中央圓預兆；
 *   +circleAt 中央圓判定、環形預兆；+donutAt 環形判定。
 * 判定規則：判定圈碰到中央圓（circleR）→ 死亡宣告（致命）；環形判定時判定圈沒有整個在中央圓內 → 致命。
 *   沒開防擊退的人被往中心吸 min(pullDist, 距離)。吸引後離中心 < 5 m 給提醒（吸引傷害大幅提升）。
 * 估計值：吸引 16 m／0.7 秒、中央圓 10 m、圓炸後 1.6 秒判定環形（見 tuning.ts DEATH）。
 */
import { O0, R } from '../core/constants';
import { dist } from '../core/geometry';
import { hitCircle, insideCircle } from '../core/hit';
import { DEATH } from '../core/tuning';
import { at, setCast, say, alertMsg, seqAdd, hasBuff, force, type Entity, type Fix, type GameState } from '../game/state';
import { good, warn, hurtPlayer, botHit } from '../game/results';
import { claim, npcSettle, npcs } from '../game/bots';

export function death(G: GameState, t0: number, castLen: number): number {
  const me = claim(G, t0);
  const tag = castLen ? '極死' : '極死（超賦）';
  if (castLen) seqAdd(G, t0, '極死');
  const tP = castLen ? t0 + castLen : t0 + DEATH.storedDelay;
  const side = (e: Entity): number => (e.x < 0 ? -1 : 1);
  const P = G.player;
  const fixOut = (): Fix => ({ x: side(P) * (R - 2.8), y: 0, r: 2, label: castLen ? '先到東／西端，被吸後停在中央圓外' : '開防擊退，留在中央圓外' });
  const fixIn: Fix = { x: 0, y: 0, r: DEATH.circleR - 0.5, label: '中央圓炸完後進中央' };
  at(G, t0, () => {
    if (castLen) { say(G, '死亡不過是回歸於無的過程而已……', 3.5); setCast(G, '極死', castLen, '先到東或西端點，被吸到中央附近先停；中央圓炸完再進中央躲環形'); }
    else { alertMsg(G, '雲之魔刃：極死', 1.8, true); G.stored = null; }
    G.extra.orb = 'death';
    if (castLen) {
      // Bot：先到東或西端點
      npcs(G).forEach((e) => { e.buffs.sprint = G.t + 6; e.mt = { x: side(e) * G.rng.rnd(R - 3.4, R - 2.2), y: G.rng.rnd(-1.2, 1.2) }; });
      G.hints = [{ x: -(R - 2.5), y: 0, r: 2, label: '西端' }, { x: R - 2.5, y: 0, r: 2, label: '東端' }];
    } else {
      npcs(G).forEach((e) => { e.buffs.akb = tP + 1; });
      G.hints = [];
    }
  });
  let p0 = 0, p1 = 0, c1 = false;
  at(G, tP, () => {
    p0 = dist(P, O0);
    G.extra.orb = null;
    G.hints = [];
    G.ents.forEach((e) => {
      if (e.dead || hasBuff(G, e, 'akb')) return;
      const d = dist(e, O0);
      if (d < 0.01) return;
      force(e, -e.x / d, -e.y / d, Math.min(DEATH.pullDist, d), DEATH.pullTime);
    });
    G.fx.push({ k: 'pull', until: G.t + 0.8 });
  });
  at(G, tP + DEATH.circleTele, () => {
    p1 = dist(P, O0);
    G.tele.push({ k: 'circle', x: 0, y: 0, r: DEATH.circleR, until: G.t + 1 });
  });
  at(G, tP + DEATH.circleAt, () => {
    c1 = hitCircle(P, O0, DEATH.circleR);
    if (c1 && !P.dead) hurtPlayer(G, tag, '被中央圓形打中（死亡宣告）', true, fixOut());
    G.ents.forEach((e) => { if (!e.isPlayer && !e.dead && hitCircle(e, O0, DEATH.circleR)) botHit(G, e, tag, '被中央圓形打中'); });
    // Bot：圓炸完立刻進中央（環形判定很快，開疾跑）
    npcs(G).forEach((e) => {
      const a = G.rng.rnd(0, 6.28), r = G.rng.rnd(0, 5);
      e.mt = { x: Math.sin(a) * r, y: -Math.cos(a) * r };
      e.buffs.sprint = Math.max(e.buffs.sprint ?? 0, G.t + 3);
    });
    G.tele.push({ k: 'donut', x: 0, y: 0, r: DEATH.circleR, until: G.t + (DEATH.donutAt - DEATH.circleAt) });
    G.hints = [{ x: 0, y: 0, r: DEATH.circleR - 0.5, label: '進中央' }];
  });
  at(G, tP + DEATH.donutAt, () => {
    G.hints = [];
    G.ents.forEach((e) => { if (!e.isPlayer && !e.dead && !insideCircle(e, O0, DEATH.circleR)) botHit(G, e, tag, '環形判定時不在中央圓內'); });
    if (P.dead) return;
    const ok = insideCircle(P, O0, DEATH.circleR);
    if (!c1) {
      if (castLen && p0 >= 26.5) good(G, tag, `吸引前在場地端點（離中心 ${p0.toFixed(1)} m）`, fixOut());
      if (!castLen) good(G, tag, '吸引後躲開了中央圓', fixOut());
      else good(G, tag, `吸引後離中心 ${p1.toFixed(1)} m，躲開中央圓`, fixOut());
    }
    if (p1 < 5 && !c1) warn(G, tag, '太靠近中心，吸引傷害會大幅提升', fixOut());
    if (ok) good(G, tag, '環形判定時在中央圓內', fixIn);
    else hurtPlayer(G, tag, '環形判定時不在中央圓內（死亡宣告）', true, fixIn);
  });
  npcSettle(G, tP + 4.7, me);
  return tP + 4.6;
}
