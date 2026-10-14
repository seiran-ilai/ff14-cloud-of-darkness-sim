// 機制目錄：隨機練習用。每個機制知道自己屬於哪個階段、要什麼場地，以及怎麼從任意時間點排一次（seg）。
import type { BladeMode, GameState } from '../game/state';
import { at, alertMsg, seqAdd, variant } from '../game/state';
import { homePos } from '../core/positions';
import { blade } from '../mechanics/blade';
import { enterP2 } from '../mechanics/p2/enter';
import { triple } from '../mechanics/p2/triple';
import { waveball } from '../mechanics/p2/waveball';
import { fear } from '../mechanics/p2/fear';
import { curse } from '../mechanics/p2/curse';
import { seeds, thornTether, sbDeluge } from '../mechanics/p2/seeds';
import { chargeOrSpread } from '../mechanics/p2/charge';
import { spin, jump } from '../mechanics/p2/spin';
import { swap, dive, impale } from '../mechanics/p2/swap';
import { allSettle } from '../mechanics/p2/common';
import { singles } from './singles';
import { P3 } from '../core/tuning';

export type Field = 'round' | 'gem' | 'p3';
export type MechPhase = 'p1' | 'p2' | 'p3';

export interface MechEntry {
  id: string;
  phase: MechPhase;
  name: string;
  field: Field;
  /** 從 t0 開始排一次，回傳可以接下一個的時間 */
  seg(G: GameState, t0: number): number;
}

export const PHASE_LABEL: Record<MechPhase, string> = { p1: 'P1 開場', p2: 'P2／P4 魔法陣', p3: 'P3 華容道' };

/** 從 P2 單練借用 */
const fromSingle = (id: string): MechEntry => ({ id, phase: 'p2', name: singles[id].name, field: 'gem', seg: (G, t0) => singles[id].seg(G, t0) });

export const CATALOG: MechEntry[] = [
  {
    id: 'p1blade', phase: 'p1', name: '暗之刃（開場）', field: 'round',
    seg(G, t0) { const m = G.rng.pickOne<BladeMode>(['L', 'R', 'B']); seqAdd(G, t0 + 0.5, '暗之刃'); return blade(G, t0 + 0.5, m) + 1.2; },
  },
  ...['embrace', 'volley', 'death', 'aero', 'blade', 'flareholy', 'petrify', 'beam'].map(fromSingle),
  {
    id: 'p3tower', phase: 'p3', name: '三重暗之戰技＋波動球', field: 'p3',
    seg(G, t0) { const last = triple(G, t0); const end = waveball(G, t0, last); allSettle(G, end + 0.3); return end + 3; },
  },
  { id: 'p3fear', phase: 'p3', name: '恐懼之雲', field: 'p3', seg: (G, t0) => fear(G, t0) + 2.5 },
  // 單練用較短的詛咒秒數（實戰 7／33／97 秒）
  { id: 'p3curse', phase: 'p3', name: '波動詛咒', field: 'p3', seg: (G, t0) => curse(G, t0, [7, 12, 17]) + 1 },
  { id: 'p3seed', phase: 'p3', name: '種子彈＋荊棘叢生', field: 'p3', seg: (G, t0) => { const e = seeds(G, t0) + 3; return thornTether(G, e) + 3; } },
  { id: 'p3charge', phase: 'p3', name: '凝聚式／分散式波動炮', field: 'p3', seg: (G, t0) => chargeOrSpread(G, t0, variant(G, 'charge', G.rng.chance(0.5) ? 'charge' : 'spread')) + 3 },
  { id: 'p3spin', phase: 'p3', name: '迴旋式＋跳躍波動炮', field: 'p3', seg: (G, t0) => { jump(G, t0 + P3.spin.cast - 1); return spin(G, t0) + 3; } },
  { id: 'p3swap', phase: 'p3', name: '混沌迫近（換位）', field: 'p3', seg: (G, t0) => swap(G, t0) + 2 },
  { id: 'p3dive', phase: 'p3', name: '潛地式波動炮', field: 'p3', seg: (G, t0) => { triple(G, t0 + 2, true); return dive(G, t0) + 3; } },
  { id: 'p3impale', phase: 'p3', name: '磔殺（坦克死刑）', field: 'p3', seg: (G, t0) => impale(G, t0) + 1.5 },
  { id: 'p3interrupt', phase: 'p3', name: '小王暗之泛濫（打斷）', field: 'p3', seg: (G, t0) => sbDeluge(G, t0) + 1 },
];

export const catalogById = (id: string): MechEntry | undefined => CATALOG.find((m) => m.id === id);

const FIELD_NAME: Record<Field, string> = { round: 'P1 開場（大圓形）', gem: '魔法陣（鑽石形）', p3: 'P3 華容道' };

/** 在 t 瞬間切換場地：所有人直接站到新場地的基本位置 */
export function setField(G: GameState, t: number, f: Field): void {
  at(G, t, () => {
    if (f === 'p3') {
      if (!G.p2) { G.ents.forEach((e) => { e.seat = undefined; }); enterP2(G); }
    } else {
      G.p2 = undefined;
      G.round = f === 'round';
      G.ents.forEach((e) => {
        const h = homePos(e.al, e.role);
        Object.assign(e, { x: h.x, y: h.y, px: h.x, py: h.y, mt: { ...h }, ov: null, nav: undefined, p2r: undefined, seat: undefined, faceLock: null, forced: null, curse: undefined, mark: undefined });
      });
    }
    G.hints = [];
    alertMsg(G, `場地切換：${FIELD_NAME[f]}`, 1.8);
  });
}

