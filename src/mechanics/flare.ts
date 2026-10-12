/*
 * 核爆
 * 時間點（相對 t0）：0 開始詠唱、每聯盟隨機點名 1 人；+cast 判定（距離衰減的全場 AOE）。
 *   可能在齊射式途中點名（攻略）：要等最後一發打完才跑去端點。
 * 判定規則：被點的人要丟到指定端點（A 西、B 南、C 東，容許 spotTol）；
 *   沒被點的人離最近的核爆目標至少 safeDist。玩家陣亡後 AOE 仍在其位置判定（目前只畫特效）。
 * 估計值：詠唱 5.5 秒、容許距離 6 m、安全距離 8 m（見 tuning.ts FLARE）。
 */
import { ALS, type Alliance } from '../core/constants';
import { dist } from '../core/geometry';
import { FLARE } from '../core/tuning';
import { FLARE_SPOT, FLARE_DIR_NAME, homePos } from '../core/positions';
import { at, setCast, alertMsg, seqAdd, type Entity, type Fix, type GameState } from '../game/state';
import { good, bad, botHit } from '../game/results';
import { claim, npcHome, npcs, afterVolley, atOrNow, goAfterVolley } from '../game/bots';

export function flare(G: GameState, t0: number): number {
  const me = claim(G, t0);
  const tag = '核爆';
  seqAdd(G, t0, '核爆');
  at(G, t0, () => {
    setCast(G, '核爆', FLARE.cast);
    const tg = {} as Record<Alliance, Entity>;
    ALS.forEach((al) => { tg[al] = G.rng.pickOne(G.ents.filter((e) => e.al === al && !e.dead)); });
    G.extra.flare = tg;
    const spots = {} as Record<Alliance, { x: number; y: number }>;
    ALS.forEach((al) => {
      const e = tg[al];
      e.flareUntil = t0 + (FLARE.cast + 0.3);
      e.buffs.sprint = G.t + 6;
      spots[al] = { x: FLARE_SPOT[al].x + G.rng.rnd(-1, 1), y: FLARE_SPOT[al].y + G.rng.rnd(-1, 1) };
    });
    const P = G.player, mine = tg[P.al] === P;
    const during = afterVolley(G) > G.t;
    if (mine) alertMsg(G, during ? '你被點了核爆（先躲完波動炮）' : '你被點了核爆', 2, true);
    // 齊射途中點名：等最後一發打完才跑（被點的人去端點，其他人回原位）
    npcs(G).forEach((e) => goAfterVolley(G, e, tg[e.al] === e ? spots[e.al] : homePos(e.al, e.role)));
    atOrNow(G, afterVolley(G), () => {
      if (mine) G.hints = [{ ...FLARE_SPOT[P.al], r: 3, label: `${P.al} 丟${FLARE_DIR_NAME[P.al]}` }];
    });
  });
  at(G, t0 + FLARE.cast, () => {
    const tg = G.extra.flare!, P = G.player;
    G.hints = [];
    G.extra.flareT = G.t;
    const targets = Object.values(tg);
    targets.forEach((e) => G.fx.push({ k: 'flare', x: e.x, y: e.y, until: G.t + 0.9 }));
    const nearest = (e: Entity): number => Math.min(...targets.filter((o) => o !== e).map((o) => dist(o, e)));
    G.ents.forEach((e) => {
      if (e.isPlayer || e.dead) return;
      if (tg[e.al] === e) { if (dist(e, FLARE_SPOT[e.al]) > FLARE.spotTol) botHit(G, e, tag, '核爆沒丟到指定端點'); }
      else if (nearest(e) < FLARE.safeDist) botHit(G, e, tag, '離核爆目標太近');
    });
    if (P.dead) return;
    if (tg[P.al] === P) {
      const fix: Fix = { ...FLARE_SPOT[P.al], r: FLARE.spotTol / 2, label: `${P.al} 丟${FLARE_DIR_NAME[P.al]}端` };
      const d = dist(P, FLARE_SPOT[P.al]);
      if (d <= FLARE.spotTol) good(G, tag, `把核爆丟到${FLARE_DIR_NAME[P.al]}端`, fix);
      else bad(G, tag, `核爆沒丟到${FLARE_DIR_NAME[P.al]}端（差 ${d.toFixed(1)} m）`, fix);
    } else {
      const fix: Fix = { ...homePos(P.al, P.role), r: 1.4, label: '留在原位，遠離核爆目標' };
      const md = nearest(P);
      if (md >= FLARE.safeDist) good(G, tag, `離核爆目標 ${md.toFixed(1)} m`, fix);
      else bad(G, tag, `離核爆目標只有 ${md.toFixed(1)} m，傷害太高`, fix);
    }
  });
  npcHome(G, t0 + (FLARE.cast + 0.3), me);
  return t0 + FLARE.cast;
}
