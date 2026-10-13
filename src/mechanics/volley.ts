/*
 * 齊射式波動炮
 * 時間點（相對 t0）：−0.5 提示「暗黑之破片雲出現了……」；四輪 glow 0／1.5／4／5.5 發光、fire 4／5.5／7.5／9 發射。
 * 判定規則：兩組雲各負責一個方向（U：沿東南向的直行、V：沿東北向的直行），四輪交替，相鄰兩輪方向不同。
 *   每輪判定時判定圈碰到發射中的列／行即中彈（傷害降低，非致命）。
 * 處理（攻略）：站在第一批與第二批交會點旁（兩方向的第一批都不打的格子），各自炸完後踩進剛爆完的線。
 * 估計值：時間、雲的方位（見 tuning.ts VOLLEY）。
 */
import { HIT, VOLLEY } from '../core/tuning';
import { HALF, CELL, type Vec } from '../core/constants';
import { toUV, fromUV, laneC, laneOf, voidDist } from '../core/geometry';
import { at, alertMsg, seqAdd, type Entity, type GameState, type LaneFam, type VolleyPlan, type VolleyRound } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { claim, npcSettle, npcs } from '../game/bots';

/** 判定圈是否碰到這一輪發射的直線 */
export function inLanes(p: Vec, r: Pick<VolleyRound, 'fam' | 'lanes'>): boolean {
  const uv = toUV(p);
  const c = r.fam === 'U' ? uv.u : uv.v;
  return r.lanes.some((i) => c >= -HALF + CELL * i - HIT && c <= -HALF + CELL * (i + 1) + HIT);
}

/** Bot 站格子時離格子中心的隨機偏移上限（離相鄰列至少 CELL/2 − 2.5 ≈ 3 m） */
const JITTER = 2.5;

/** 王底下沒有地板的那一格（北角） */
/**
 * 格子的站位點：一般是格子中心；被北邊切線切到的格子改站格子偏南的部分（往南角移 CELL/4）。
 * 移過去還是沒地板（北角那格）就不能站。
 */
export function cellStand(u: number, v: number): Vec {
  const c = fromUV(laneC(u), laneC(v));
  return voidDist(c.x, c.y) < 3 ? fromUV(laneC(u) + CELL / 4, laneC(v) - CELL / 4) : c;
}
const isVoidCell = (u: number, v: number): boolean => { const s = cellStand(u, v); return voidDist(s.x, s.y) < HIT + 1; };

/**
 * 走位計畫：先站「兩方向第一批都不打」的格子 (su,sv)，各方向第一批炸完後踩進打過的列 (fu,fv)。
 * 中途、最後的格子都不能是王底下沒地板的那一格。
 * 成本＝移動列數＋最後離中央的距離（攻略站交會點旁，結束時靠中央，下一個機制才跑得到）。
 */
export function planCells(cu: number, cv: number, first: { U: number[]; V: number[] }, uFirst: boolean): { su: number; fu: number; sv: number; fv: number } | null {
  const axis = (cur: number, s: number, f: number): number => Math.abs(cur - s) * 2 + Math.abs(s - f) + Math.abs(f - 1.5) * 0.9;
  let best: { su: number; fu: number; sv: number; fv: number } | null = null, bestCost = Infinity;
  for (let su = 0; su < 4; su++) for (let sv = 0; sv < 4; sv++) {
    if (first.U.includes(su) || first.V.includes(sv)) continue;
    for (const fu of first.U) for (const fv of first.V) {
      const mid = uFirst ? [fu, sv] : [su, fv];
      if (isVoidCell(su, sv) || isVoidCell(mid[0], mid[1]) || isVoidCell(fu, fv)) continue;
      const cost = axis(cu, su, fu) + axis(cv, sv, fv);
      if (cost < bestCost) { bestCost = cost; best = { su, fu, sv, fv }; }
    }
  }
  return best;
}

export function volley(G: GameState, t0: number): number {
  const { rng } = G;
  const me = claim(G, t0);
  const tag = '齊射式波動炮';
  seqAdd(G, t0, '齊射式波動炮');
  const f1: LaneFam = rng.chance(0.5) ? 'U' : 'V', f2: LaneFam = f1 === 'U' ? 'V' : 'U';
  const split = (): [number[], number[]] => {
    const n = rng.chance(0.5) ? 2 : 3, idx = rng.shuffle([0, 1, 2, 3]);
    return [idx.slice(0, n).sort(), idx.slice(n).sort()];
  };
  // 只剩王底下那一格安全的組合不會出現（重抽）
  let [a1, a2] = split(), [b1, b2] = split();
  for (let i = 0; i < 30; i++) {
    const fU = f1 === 'U' ? a1 : b1, fV = f1 === 'V' ? a1 : b1;
    if (planCells(1.5, 1.5, { U: fU, V: fV }, f1 === 'U')) break;
    [a1, a2] = split(); [b1, b2] = split();
  }
  const g = VOLLEY.glow, f = VOLLEY.fire;
  const rounds: VolleyRound[] = [
    { fam: f1, lanes: a1, glow: t0 + g[0], fire: t0 + f[0] },
    { fam: f2, lanes: b1, glow: t0 + g[1], fire: t0 + f[1] },
    { fam: f1, lanes: a2, glow: t0 + g[2], fire: t0 + f[2] },
    { fam: f2, lanes: b2, glow: t0 + g[3], fire: t0 + f[3] },
  ];
  const first = { U: f1 === 'U' ? a1 : b1, V: f1 === 'V' ? a1 : b1 };
  const tFirst = { U: f1 === 'U' ? t0 + f[0] : t0 + f[1], V: f1 === 'V' ? t0 + f[0] : t0 + f[1] };
  let hits = 0;
  at(G, t0 - 0.5, () => { alertMsg(G, '暗黑之破片雲出現了：站第一批與第二批交會點旁，炸完踩進去', 3); G.extra.clouds = { rounds, until: t0 + f[3] + 0.7 }; });

  // 被切線切到的格子不加隨機偏移（偏移會出列或踩空）
  const cellOf = (v: VolleyPlan): Vec => {
    const c = fromUV(laneC(v.iu), laneC(v.iv));
    return voidDist(c.x, c.y) < 3 ? cellStand(v.iu, v.iv) : fromUV(laneC(v.iu) + v.ju, laneC(v.iv) + v.jv);
  };
  const plan = (p: Vec, ju: number, jv: number): VolleyPlan => {
    const uv = toUV(p), c = planCells(laneOf(uv.u), laneOf(uv.v), first, f1 === 'U')!;
    const v: VolleyPlan = { iu: c.su, fu: c.fu, iv: c.sv, fv: c.fv, ju, jv };
    // 隨機偏移會踩進王底下沒地板處就不偏移
    const cells = [cellOf(v), cellOf({ ...v, iu: c.fu }), cellOf({ ...v, iv: c.fv }), cellOf({ ...v, iu: c.fu, iv: c.fv })];
    if (cells.some((q) => voidDist(q.x, q.y) < HIT + 0.5)) { v.ju = 0; v.jv = 0; }
    return v;
  };
  // 玩家的建議格（不加隨機偏移）：給提示與回放
  let pv: VolleyPlan | null = null;
  const playerFix = (label: string) => (pv ? { ...cellOf(pv), r: 1.6, label } : undefined);
  const showHint = (label: string): void => { if (G.cfg.hint && pv && !G.auto) G.hints = [{ ...cellOf(pv), r: 1.6, label }]; };

  at(G, t0 + 0.3, () => {
    npcs(G).forEach((e) => {
      e.buffs.sprint = G.t + 5;
      e.vol = plan(e, rng.rnd(-JITTER, JITTER), rng.rnd(-JITTER, JITTER));
      e.mt = cellOf(e.vol);
    });
    pv = plan(G.player, 0, 0);
    showHint('交會點旁待命');
  });
  const stepIn = (fam: LaneFam): void => {
    const go = (v: VolleyPlan): void => { if (fam === 'U') v.iu = v.fu; else v.iv = v.fv; };
    npcs(G).forEach((e) => { if (!e.vol) return; go(e.vol); e.mt = cellOf(e.vol); });
    if (pv) go(pv);
    showHint('踩進剛爆完的線');
  };
  at(G, tFirst.U + 0.05, () => stepIn('U'));
  at(G, tFirst.V + 0.05, () => stepIn('V'));
  rounds.forEach((r, k) => {
    at(G, r.fire - VOLLEY.teleLead, () => { if (G.cfg.tele) G.tele.push({ k: 'lane', fam: r.fam, lanes: r.lanes, until: r.fire }); });
    at(G, r.fire, () => {
      G.fx.push({ k: 'lane', fam: r.fam, lanes: r.lanes, until: G.t + 0.45 });
      const P = G.player;
      if (!P.dead && inLanes(P, r)) { hits++; hurtPlayer(G, tag, `第 ${k + 1} 輪吃到波動炮（傷害降低）`, false, playerFix(`第 ${k + 1} 輪該站的格子`)); }
      G.ents.forEach((e) => { if (!e.isPlayer && !e.dead && inLanes(e, r)) botHit(G, e, tag, `第 ${k + 1} 輪吃到波動炮`); });
    });
  });
  at(G, t0 + f[3] + 0.1, () => {
    if (!hits) good(G, tag, '四輪全部躲開', playerFix('最後站的格子'));
    G.hints = [];
    npcs(G).forEach((e: Entity) => { e.vol = null; });
  });
  npcSettle(G, t0 + f[3] + 0.2, me);
  return t0 + f[3] + 0.2;
}
