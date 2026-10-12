// 回放：每秒 REPLAY.hz 次錄下可渲染的狀態（玩家與 Bot 位置、面向、預兆、特效），結算時可慢動作重播某個判定的前後幾秒
import { REPLAY } from '../core/tuning';
import type { Alliance } from '../core/constants';
import type { Effect, Entity, GameState, RenderState } from './state';

export type Frame = RenderState;

function cloneEnt(e: Entity): Entity {
  return { ...e, buffs: { ...e.buffs }, embs: e.embs.slice(), mt: null, ov: null, forced: null, vol: null };
}

export function snapshot(G: GameState): Frame {
  const map = new Map<Entity, Entity>();
  const ents = G.ents.map((e) => { const c = cloneEnt(e); map.set(e, c); return c; });
  const m = (e: Entity): Entity => map.get(e) ?? e;
  const mapRec = (r?: Record<Alliance, Entity>): Record<Alliance, Entity> | undefined => (r ? { A: m(r.A), B: m(r.B), C: m(r.C) } : undefined);
  const fx: Effect[] = G.fx.map((f) => (f.k === 'tether' ? { ...f, members: f.members.map(m) } : { ...f }));
  return {
    t: G.t, ents, player: m(G.player), tele: G.tele.slice(), fx,
    extra: { ...G.extra, flare: mapRec(G.extra.flare), beam: mapRec(G.extra.beam) },
    poses: G.poses, stored: G.stored, hints: G.hints.slice(), embHint: G.embHint, cast: G.cast ? { ...G.cast } : null,
    p2: G.p2 && {
      ...G.p2,
      cells: G.p2.cells.map((c) => ({ ...c })),
      sb: G.p2.sb.map((b) => ({ ...b })),
      innerTowers: G.p2.innerTowers.slice(),
      outerTowers: G.p2.outerTowers.slice(),
      reserve: new Map(),
    },
  };
}

export class Recorder {
  frames: Frame[] = [];
  private last = -Infinity;

  clear(): void { this.frames = []; this.last = -Infinity; }

  tick(G: GameState): void {
    if (G.state !== 'run' || G.t - this.last < 1 / REPLAY.hz - 1e-9) return;
    this.last = G.t;
    this.frames.push(snapshot(G));
  }

  /** 取 [t0, t1] 之間的影格 */
  range(t0: number, t1: number): Frame[] {
    return this.frames.filter((f) => f.t >= t0 && f.t <= t1);
  }
}

/** 在影格 a→b 之間插值：位置取 b、前一位置取 a，配合 draw 的 alpha */
export function blend(a: Frame, b: Frame): Frame {
  const ents = b.ents.map((e, i) => ({ ...e, px: a.ents[i].x, py: a.ents[i].y, pface: a.ents[i].face }));
  const player = ents[b.ents.indexOf(b.player)];
  return { ...b, ents, player };
}
