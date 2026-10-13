/*
 * 連射式波動炮
 * 時間點（相對 t0）：0 開始詠唱、每聯盟點名 1 名非坦克；+cast 起每 interval 秒一輪，共 4 輪；+8.4 結算。
 * 判定規則：每輪三條直線從王指向各聯盟被點名者，寬 width。判定圈每輪都要碰到自己聯盟的線（分攤），
 *   碰到別聯盟的線算失誤。坦克要在自己線上的最前 2 位，其他人要在第 3 位以後。
 * 估計值：詠唱 4 秒、線寬 5 m、間隔 1.2 秒（見 tuning.ts BEAM）。
 * TODO(確認): docs 說「非 1、2 仇」，目前實作為「非坦克」。
 */
import { ALS, BOSS, roleType, type Alliance, type Role, type Vec } from '../core/constants';
import { hitRay, along } from '../core/hit';
import { BEAM } from '../core/tuning';
import { beamDir } from '../core/positions';
import { at, setCast, seqAdd, type BeamLine, type Entity, type Fix, type GameState } from '../game/state';
import { good, bad, botHit } from '../game/results';
import { claim, npcSettle, isBot } from '../game/bots';

const ORDER: Role[] = ['MT', 'ST', 'H1', 'D1', 'H2', 'D2', 'D3', 'D4'];

/** 排隊位置：坦克在最前 */
export function beamSlot(e: Pick<Entity, 'al' | 'role'>): Vec {
  const d = beamDir(e.al), k = ORDER.indexOf(e.role), r = 12 + k * 1.25 + (k >= 2 ? 1.2 : 0);
  return { x: BOSS.x + d.x * r, y: BOSS.y + d.y * r };
}

export function beam(G: GameState, t0: number): number {
  const me = claim(G, t0);
  const tag = '連射式波動炮';
  seqAdd(G, t0, '連射式波動炮');
  const halfW = BEAM.width / 2;
  const P = G.player;
  const fix = (): Fix => ({ ...beamSlot(P), r: 1.3, label: roleType(P.role) === 'tank' ? '坦克站最前' : '排在坦克後面' });
  at(G, t0, () => {
    setCast(G, '連射式波動炮', BEAM.cast, '直線分攤四輪：坦克站最前、其他人排後面，別站到別聯盟的線');
    const tg = {} as Record<Alliance, Entity>;
    ALS.forEach((al) => { tg[al] = G.rng.pickOne(G.ents.filter((e) => e.al === al && roleType(e.role) !== 'tank')); });
    G.extra.beam = tg;
    G.ents.forEach((e) => {
      const p = beamSlot(e);
      if (isBot(G, e)) { e.mt = p; e.buffs.sprint = G.t + 4; }
      if (e.isPlayer) G.hints = [{ ...p, r: 1.3, label: roleType(e.role) === 'tank' ? '坦克站最前' : '排在坦克後面' }];
    });
  });
  const res: { inMine: boolean; extra: number; rank: number }[] = [];
  [0, 1, 2, 3].forEach((k) => at(G, t0 + BEAM.cast + k * BEAM.interval, () => {
    const tg = G.extra.beam!;
    const lines: BeamLine[] = ALS.map((al) => {
      const T = tg[al];
      const dx = T.x - BOSS.x, dy = T.y - BOSS.y, L = Math.hypot(dx, dy) || 1;
      return { al, v: { x: dx / L, y: dy / L } };
    });
    G.fx.push({ k: 'beams', lines, until: G.t + 0.5 });
    const lineOf = (al: Alliance): BeamLine => lines.find((l) => l.al === al)!;
    G.ents.forEach((e) => {
      if (e.isPlayer || e.dead) return;
      if (!hitRay(e, BOSS, lineOf(e.al).v, halfW)) botHit(G, e, tag, `第 ${k + 1} 輪沒進自己聯盟的線`);
      if (lines.some((l) => l.al !== e.al && hitRay(e, BOSS, l.v, halfW))) botHit(G, e, tag, `第 ${k + 1} 輪站到別聯盟的線`);
    });
    if (P.dead) return;
    const inL = lines.filter((l) => hitRay(P, BOSS, l.v, halfW));
    const mine = lineOf(P.al);
    let rank = -1;
    if (inL.includes(mine)) {
      rank = G.ents.filter((e) => !e.dead && e.al === P.al && hitRay(e, BOSS, mine.v, halfW))
        .sort((a, b) => along(a, BOSS, mine.v) - along(b, BOSS, mine.v))
        .indexOf(P);
    }
    res.push({ inMine: inL.includes(mine), extra: inL.filter((l) => l !== mine).length, rank });
  }));
  at(G, t0 + 8.4, () => {
    G.hints = [];
    if (P.dead) return;
    const tank = roleType(P.role) === 'tank';
    if (res.every((r) => r.inMine)) good(G, tag, `四輪都在 ${P.al} 聯盟的線上分攤`, fix());
    else bad(G, tag, `有 ${res.filter((r) => !r.inMine).length} 輪沒進 ${P.al} 聯盟的線`, fix());
    if (res.some((r) => r.extra)) bad(G, tag, '站到別聯盟的線上，多吃傷害', fix());
    const rk = res.filter((r) => r.inMine);
    if (rk.length) {
      if (tank) { if (rk.every((r) => r.rank <= 1)) good(G, tag, '坦克站在最前面兩位', fix()); else bad(G, tag, '坦克沒站在最前面兩位', fix()); }
      else { if (rk.every((r) => r.rank >= 2)) good(G, tag, '排在坦克後面', fix()); else bad(G, tag, '站到前兩位，吃到高額傷害', fix()); }
    }
  });
  npcSettle(G, t0 + 8.6, me);
  return t0 + 8.6;
}
