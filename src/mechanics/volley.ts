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
import { toUV, fromUV, laneC, laneOf } from '../core/geometry';
import { at, alertMsg, seqAdd, type Entity, type GameState, type LaneFam, type VolleyPlan, type VolleyRound } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { claim, npcHome, npcs } from '../game/bots';

/** 判定圈是否碰到這一輪發射的直線 */
export function inLanes(p: Vec, r: Pick<VolleyRound, 'fam' | 'lanes'>): boolean {
  const uv = toUV(p);
  const c = r.fam === 'U' ? uv.u : uv.v;
  return r.lanes.some((i) => c >= -HALF + CELL * i - HIT && c <= -HALF + CELL * (i + 1) + HIT);
}

/** Bot 站格子時離格子中心的隨機偏移上限（離相鄰列至少 CELL/2 − 2.5 ≈ 3 m） */
const JITTER = 2.5;

/**
 * 單一方向的走位計畫：先站「第一批不打」的列 s，第一批炸完後踩進「第一批打過」的列 f。
 * 成本＝移動列數＋最後離中央的距離（攻略站交會點旁，結束時靠中央，下一個機制才跑得到）。
 */
export function planAxis(cur: number, first: number[]): { s: number; f: number } {
  let best = { s: 0, f: 0 }, bestCost = Infinity;
  for (let s = 0; s < 4; s++) {
    if (first.includes(s)) continue;
    for (const f of first) {
      const cost = Math.abs(cur - s) * 2 + Math.abs(s - f) + Math.abs(f - 1.5) * 0.9;
      if (cost < bestCost) { bestCost = cost; best = { s, f }; }
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
  const [a1, a2] = split(), [b1, b2] = split();
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
  at(G, t0 - 0.5, () => { alertMsg(G, '暗黑之破片雲出現了……', 2.5); G.extra.clouds = { rounds, until: t0 + f[3] + 0.7 }; });

  const plan = (p: Vec, ju: number, jv: number): VolleyPlan => {
    const uv = toUV(p), a = planAxis(laneOf(uv.u), first.U), b = planAxis(laneOf(uv.v), first.V);
    return { iu: a.s, fu: a.f, iv: b.s, fv: b.f, ju, jv };
  };
  const cellOf = (v: VolleyPlan): Vec => fromUV(laneC(v.iu) + v.ju, laneC(v.iv) + v.jv);
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
  at(G, t0 + 9.1, () => {
    if (!hits) good(G, tag, '四輪全部躲開', playerFix('最後站的格子'));
    G.hints = [];
    npcs(G).forEach((e: Entity) => { e.vol = null; });
  });
  npcHome(G, t0 + 9.2, me);
  return t0 + 9.2;
}
