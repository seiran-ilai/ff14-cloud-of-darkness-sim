/*
 * 凝聚式波動炮／分散式波動炮（P3 華容道，王；全程 2 次，第二次一定和第一次相反）
 * 提示：「大量魔力集中到了暗黑之雲身上……」；凝聚式＝王身上橙黃色蓄能，分散式＝紫黑色懸浮球。
 *
 * 凝聚式：+cast 判定。東西外場各隨機 1 人、內場四角各隨機 1 人：從王朝目標的直線分攤。
 *   外場要 needOut 人以上、內場要 needIn 人以上進線；處理（攻略）：外場整組集合在平臺中央，
 *   內場角落 3 人站成 L 形（角落格＋橫向往中間 1 格＋凸出格）。
 * 分散式：+cast 內場 12 人各一個圓形，+outerDelay 外場 12 人各一個圓形；打到別人算失誤。
 *   處理（攻略）：內場站自己待機格的中央；外場散開到平臺四角與環狀地板。
 * 估計值：見 tuning.ts P3.charge／P3.spread。
 */
import { P3, TELE_SHOW } from '../../core/tuning';
import { cellAt, cellUnder, center, rel, zoneE, roleE, homeE, CORNERS, type Cell } from '../../core/p2';
import { angOf } from '../../core/geometry';
import { hitRay, hitCircle } from '../../core/hit';
import type { Vec } from '../../core/constants';
import { dirV } from '../../core/geometry';
import { at, setCast, say, seqAdd, type Entity, type Fix, type GameState } from '../../game/state';
import { good } from '../../game/results';
import { isBot } from '../../game/bots';
import { cornerMembers, rearrange } from '../../game/p3plan';
import { failE, busy, allSettle, SIDES, outers, inners, BOSS3, outerGo } from './common';

export type ChargeKind = 'charge' | 'spread';
export const CHARGE_NAME: Record<ChargeKind, string> = { charge: '凝聚式波動炮', spread: '分散式波動炮' };

/** 凝聚式：內場角落 3 人的 L 形（座位的格子 → 要站的格子） */
function chargeCell(e: Entity): Cell {
  const home = cellUnder(homeE(e))!;
  const k = home.i <= 3 ? (home.j <= 3 ? 0 : 2) : (home.j <= 3 ? 1 : 3);
  const [ci, cj] = CORNERS[k], di = ci === 1 ? 1 : -1, dj = cj === 1 ? -1 : 1;
  // 坦克：橫向往中間 1 格；凸出格（南北端）的人留在凸出格；另一人站角落格
  if (roleE(e) === 'MT' || roleE(e) === 'ST') return cellAt(ci + di, cj)!;
  if (home.j === cj + dj) return home;
  return cellAt(ci, cj)!;
}

/** 分散式：外場站位（相對 f, r） */
const SPREAD_OUT: Record<string, [number, number]> = { MT: [-3.5, 3.5], H2: [-3.5, -3.5], D1: [3.5, 3.5], D2: [3.5, -3.5], D3: [0, 9.5], D4: [0, -9.5] };

export function chargeOrSpread(G: GameState, t0: number, kind: ChargeKind): number {
  const tag = CHARGE_NAME[kind];
  seqAdd(G, t0, tag);
  const tR = t0 + (kind === 'charge' ? P3.charge.cast : P3.spread.cast);
  const end = kind === 'charge' ? tR : tR + P3.spread.outerDelay;
  const spot = new Map<Entity, Vec>();
  at(G, t0, () => {
    setCast(G, tag, tR - t0, kind === 'charge'
      ? '橙黃色蓄能：直線分攤。外場整組到平臺中央；內場角落 3 人站 L 形'
      : '紫黑色懸浮球：先內場、再外場各一個圓形。內場站待機格中央，外場散開');
    say(G, kind === 'charge' ? '把你們送入更加幽邃的黑暗之中！' : '全都給我消失吧！', 3);
    if (G.p2) G.p2.aura = { kind, until: tR };
    busy(G, end + 1);
  });
  // Bot 反應後就位
  at(G, t0 + 0.8, () => {
    for (let k = 0; k < 4; k++) {
      const goals = new Map<Entity, Cell>();
      cornerMembers(G, k).forEach((e) => goals.set(e, kind === 'charge' ? chargeCell(e) : cellUnder(homeE(e))!));
      rearrange(G, k, goals, G.t, tR - 0.3, () => {
        // 分散式：站到格子正中央（拉開距離）
        if (kind === 'spread') cornerMembers(G, k).forEach((e) => { if (isBot(G, e)) e.mt = center(cellUnder(homeE(e))!); });
      });
    }
    SIDES.forEach((side) => outers(G, side).forEach((e, i) => {
      const p = kind === 'charge' ? rel(side, (i % 3) - 1, i < 3 ? -0.8 : 0.8) : rel(side, ...SPREAD_OUT[roleE(e)]);
      spot.set(e, p);
      if (isBot(G, e)) outerGo(G, e, p);
    }));
    inners(G).forEach((e) => spot.set(e, kind === 'charge' ? center(chargeCell(e)) : center(cellUnder(homeE(e))!)));
    const P = G.player;
    if (G.cfg.hint && !G.auto && spot.has(P)) G.hints = [{ ...spot.get(P)!, r: 1.1, label: kind === 'charge' ? '分攤' : '散開' }];
  });
  const fixFor = (e: Entity): Fix => ({ ...(spot.get(e) ?? homeE(e)), r: 1.1, label: kind === 'charge' ? (zoneE(e) === 'in' ? '角落 L 形分攤' : '平臺中央集合') : (zoneE(e) === 'in' ? '待機格中央' : '散開') });

  if (kind === 'charge') {
    const lines: { who: Entity; a: number; need: number; group: Entity[] }[] = [];
    at(G, tR - 1.5, () => {
      lines.length = 0;
      SIDES.forEach((side) => {
        const g = outers(G, side);
        if (g.length) lines.push({ who: G.rng.pickOne(g), a: 0, need: P3.charge.needOut, group: g });
      });
      for (let k = 0; k < 4; k++) {
        const g = cornerMembers(G, k);
        if (g.length) lines.push({ who: G.rng.pickOne(g), a: 0, need: P3.charge.needIn, group: g });
      }
      lines.forEach((l) => { l.who.mark = { kind: 'charge', until: tR }; });
    });
    // 判定前 1 秒鎖定方向、出預兆
    at(G, tR - 1, () => lines.forEach((l) => {
      l.a = angOf(l.who.x - BOSS3.x, l.who.y - BOSS3.y);
      G.tele.push({ k: 'rect', O: BOSS3, H: l.a, len: 40, w: P3.charge.hw * 2, until: tR });
    }));
    at(G, tR, () => {
      G.hints = [];
      const P = G.player;
      let mineOk = true;
      lines.forEach((l) => {
        l.who.mark = undefined;
        const v = dirV(l.a);
        const inside = G.ents.filter((e) => !e.dead && hitRay(e, BOSS3, v, P3.charge.hw));
        // 吃到兩條線
        inside.forEach((e) => {
          if (lines.filter((o) => hitRay(e, BOSS3, dirV(o.a), P3.charge.hw)).length >= 2) { if (e.isPlayer) mineOk = false; failE(G, e, tag, '吃到兩條直線分攤', fixFor(e)); }
        });
        if (inside.length >= l.need) return;
        l.group.filter((e) => !e.dead && !inside.includes(e)).forEach((e) => {
          if (e.isPlayer) mineOk = false;
          failE(G, e, tag, `沒進直線分攤（只有 ${inside.length} 人，需要 ${l.need} 人）`, fixFor(e));
        });
      });
      if (mineOk && !P.dead) good(G, tag, '直線分攤處理正確', fixFor(P));
    });
  } else {
    const resolve = (group: () => Entity[]) => (): void => {
      const P = G.player, g = group();
      let mineOk = true;
      g.forEach((src) => {
        G.fx.push({ k: 'stack', x: src.x, y: src.y, r: P3.spread.r, until: G.t + 0.5 });
        G.ents.forEach((e) => {
          if (e === src || e.dead || !hitCircle(e, src, P3.spread.r)) return;
          if (e.isPlayer || src.isPlayer) mineOk = false;
          failE(G, src, tag, '分散式的圓形打到別人', fixFor(src));
        });
      });
      if (g.includes(P) && mineOk && !P.dead) good(G, tag, '散開，沒有打到人', fixFor(P));
    };
    at(G, tR - TELE_SHOW, () => {
      inners(G).forEach((e) => { e.mark = { kind: 'spread', until: tR }; G.tele.push({ k: 'circle', x: e.x, y: e.y, r: P3.spread.r, until: tR }); });
    });
    at(G, tR, () => { G.hints = []; inners(G).forEach((e) => { e.mark = undefined; }); });
    at(G, tR, resolve(() => inners(G)));
    at(G, end - TELE_SHOW, () => SIDES.forEach((s) => outers(G, s).forEach((e) => { e.mark = { kind: 'spread', until: end }; G.tele.push({ k: 'circle', x: e.x, y: e.y, r: P3.spread.r, until: end }); })));
    at(G, end, () => SIDES.forEach((s) => outers(G, s).forEach((e) => { e.mark = undefined; })));
    at(G, end, resolve(() => SIDES.flatMap((s) => outers(G, s))));
  }
  allSettle(G, end + 0.3);
  return end;
}
