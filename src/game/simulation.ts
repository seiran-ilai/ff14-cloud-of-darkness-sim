// 模擬一步：時間推進、事件、玩家移動、Bot 移動、強制位移、掉落判定
import { R, type Vec } from '../core/constants';
import { angOf, inArena } from '../core/geometry';
import { RUN, SPRINT_MUL, HEAVY_MUL } from '../core/tuning';
import { hurtPlayer, botHit } from './results';
import { isBot } from './bots';
import { cellUnder } from '../core/p2';
import { p2Walkable, updateGrid } from './p2state';
import { navTarget, p2Refresh } from './p2nav';
import { hasBuff, type Entity, type GameState } from './state';

export interface InputState {
  keys: Set<string>;
  /** 滑鼠右鍵按住 */
  rmb: boolean;
  /** 游標的世界座標 */
  mouse: Vec;
}

export const newInput = (): InputState => ({ keys: new Set(), rmb: false, mouse: { x: 0, y: 0 } });

export function speedOf(G: GameState, e: Entity): number {
  let s = RUN;
  if (hasBuff(G, e, 'sprint')) s *= SPRINT_MUL;
  if (hasBuff(G, e, 'heavy')) s *= HEAVY_MUL;
  return s;
}

function moveForced(e: Entity, dt: number): void {
  const f = e.forced!, k = Math.min(dt, f.left);
  e.x += f.vx * k;
  e.y += f.vy * k;
  f.left -= dt;
  if (f.left <= 0) e.forced = null;
}

const axis = (keys: Set<string>, pos: string[], neg: string[]): number =>
  (pos.some((k) => keys.has(k)) ? 1 : 0) - (neg.some((k) => keys.has(k)) ? 1 : 0);

export function step(G: GameState, input: InputState, dt: number): void {
  if (G.state === 'count') {
    G.countT -= dt;
    if (G.countT <= 0) G.state = 'run';
    return;
  }
  if (G.state !== 'run') return;
  G.ents.forEach((e) => { e.px = e.x; e.py = e.y; e.pface = e.face; });
  G.t += dt;
  G.ev.runUntil(G.t);
  const P = G.player;
  if (!P.dead && !G.auto) {
    if (P.forced) moveForced(P, dt);
    else if (P.stun <= G.t) {
      let mx = axis(input.keys, ['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
      let my = axis(input.keys, ['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
      const L = Math.hypot(mx, my);
      if (L > 0) {
        mx /= L; my /= L;
        const s = speedOf(G, P);
        P.x += mx * s * dt;
        P.y += my * s * dt;
        if (G.cfg.auto && !input.rmb) P.face = angOf(mx, my);
      }
      if (input.rmb) {
        const dx = input.mouse.x - P.x, dy = input.mouse.y - P.y;
        if (Math.hypot(dx, dy) > 0.3) P.face = angOf(dx, dy);
      }
    }
    if (!onFloor(G, P)) fall(G);
  }
  if (G.auto && !P.dead && !onFloor(G, P)) fall(G);
  G.ents.forEach((e) => {
    if (!isBot(G, e) || e.dead) return;
    if (G.p2) p2Refresh(G, e);
    if (e.forced) moveForced(e, dt);
    else if (!(e.stun > G.t)) {
      let tg = e.ov || e.mt;
      if (tg && G.p2) tg = navTarget(G, e, tg);
      if (tg) {
        const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy), s = speedOf(G, e) * dt;
        if (d > 0.05) {
          if (d <= s) { e.x = tg.x; e.y = tg.y; } else { e.x += (dx / d) * s; e.y += (dy / d) * s; e.face = angOf(dx, dy); }
        }
      }
    }
    if (e.faceLock != null) e.face = e.faceLock;
    // P2：隊友掉下去就陣亡（屍體留在原地）
    if (G.p2 && !e.isPlayer && !p2Walkable(G.p2, e)) {
      botHit(G, e, '掉落', cellUnder(e) ? '格子消失掉下去' : '走出地板');
      e.dead = true;
      return;
    }
    // P1：隊友被打出場地：記一次 Bot 失誤，夾回場內繼續（不讓畫面上少人）
    if (!G.p2 && !e.isPlayer && !inArena(e.x, e.y)) {
      if (!((e.fellAt ?? -Infinity) > G.t - 1)) botHit(G, e, '掉落', '被打出場地');
      e.fellAt = G.t;
      const k = (R - 1) / (Math.abs(e.x) + Math.abs(e.y));
      e.x *= k; e.y *= k;
    }
  });
  G.ents.forEach((e) => { e.embs = e.embs.filter((b) => b.exp > G.t); });
  if (G.p2) updateGrid(G, dt);
  // 預兆到時間 = 判定瞬間：留下爆發特效
  G.tele.forEach((t) => {
    if (t.until <= G.t) { G.fx.push({ k: 'burst', tele: t, start: G.t, until: G.t + 0.4 }); G.sfx.push('hit'); }
  });
  G.tele = G.tele.filter((t) => t.until > G.t);
  G.fx = G.fx.filter((f) => f.until > G.t);
  G.toasts = G.toasts.filter((t) => t.until > G.t);
  if (G.t >= G.endT) finish(G);
}

/** 腳下有沒有地板：P1 菱形場地；P2 格子／平臺／環狀地板 */
const onFloor = (G: GameState, p: Vec): boolean => (G.p2 ? p2Walkable(G.p2, p) : inArena(p.x, p.y));

function fall(G: GameState): void {
  const P = G.player;
  P.fellAt = G.t;
  const why = G.p2 && cellUnder(P) ? '格子消失（站太久或兩人同格），掉了下去' : '掉出場地';
  hurtPlayer(G, '掉落', why, true);
}

export function finish(G: GameState): void {
  G.state = 'end';
  G.result = { ok: G.fails.length === 0 && !G.player.dead };
}
