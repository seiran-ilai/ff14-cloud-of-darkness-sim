// 單一機制練習。每項都有 seg(G, t0) → 結束時間，可以串成「弱點練習」。
import type { BladeMode, Drill, GameState, StoredKind } from '../game/state';
import { at, seqAdd } from '../game/state';
import { EMBRACE } from '../core/tuning';
import { embraceCast } from '../mechanics/embrace';
import { volley } from '../mechanics/volley';
import { flare } from '../mechanics/flare';
import { holy } from '../mechanics/holy';
import { blade, bladeRelease } from '../mechanics/blade';
import { enhance } from '../mechanics/enhance';
import { petrify } from '../mechanics/petrify';
import { aero } from '../mechanics/aero';
import { death } from '../mechanics/death';
import { beam } from '../mechanics/beam';
import { flowHtml } from './mechinfo';

export interface SingleDrill extends Drill {
  /** 從 t0 開始排一次這個機制，回傳可以接下一段的時間 */
  seg(G: GameState, t0: number): number;
  /** 失誤統計裡對應的機制名稱 */
  mechs: string[];
}

/** 用 seg 組出單練：起點 start，結束後 tail 秒收尾 */
const single = (d: Omit<SingleDrill, 'setup'>, start: number, tail: number): SingleDrill => ({
  ...d,
  setup(G) { const end = d.seg(G, start); at(G, end + tail, () => { G.endT = G.t; }); },
});

export const singles: Record<string, SingleDrill> = {
  embrace: {
    name: '陰冷擁抱',
    sub: '面向與外周處理',
    brief: '單練只有你這一批的減益，長度可以在「設定」改。',
    mechs: ['陰冷擁抱'],
    info: ['陰冷擁抱'],
    seg(G, t0) {
      const d = G.cfg.dur;
      embraceCast(G, t0, [d, d + 8], { withPlayer: true });
      return t0 + EMBRACE.cast + d + 8 + EMBRACE.handDelay + 1.5;
    },
    // 單練：玩家那批判定完就結束
    setup(G) { embraceCast(G, 0.5, [G.cfg.dur, G.cfg.dur + 8], { endOnMine: true, withPlayer: true }); },
  },
  volley: single({
    name: '齊射式波動炮',
    sub: '四輪交替直線',
    brief: '「設定」可以打開地面預兆，先看清楚每一輪打哪裡。',
    mechs: ['齊射式波動炮'],
    info: ['齊射式波動炮'],
    seg: (G, t0) => volley(G, t0 + 0.5) + 0.8,
  }, 1.5, 0.5),
  death: single({
    name: '極死',
    sub: '吸引 → 圓形 → 環形',
    brief: '',
    mechs: ['極死'],
    info: ['極死'],
    seg: (G, t0) => death(G, t0, 7),
  }, 1, 0.8),
  aero: single({
    name: '飆風',
    sub: '中央擊退・藍圈',
    brief: '',
    mechs: ['飆風'],
    info: ['飆風'],
    seg: (G, t0) => aero(G, t0, 7),
  }, 1, 1.3),
  blade: single({
    name: '暗之刃＋超賦',
    sub: '刃 → 無讀條飆風／極死',
    brief: flowHtml(['暗之刃（單手或雙手）', '超賦風／超賦死（存進刀裡）', '暗之刃（一定單手）＋立刻無讀條的飆風／極死']),
    mechs: ['暗之刃', '飆風', '極死'],
    info: ['暗之刃', '超賦', '飆風', '極死'],
    seg(G, t0) {
      const { rng } = G;
      const k: StoredKind = rng.chance(0.5) ? 'aero' : 'death';
      const m1 = rng.pickOne<BladeMode>(['L', 'R', 'B']);
      blade(G, t0, m1);
      seqAdd(G, t0, '暗之刃');
      enhance(G, t0 + 6, k);
      const m2 = rng.pickOne((['L', 'R'] as BladeMode[]).filter((x) => x !== m1));
      return bladeRelease(G, t0 + 10, m2, k);
    },
  }, 1, 1),
  flareholy: single({
    name: '核爆＋神聖',
    sub: 'A 西・B 南・C 東',
    brief: flowHtml(['核爆（每隊伍點 1 人）', '黑暗神聖（6 處分攤）']),
    mechs: ['核爆', '黑暗神聖'],
    info: ['核爆', '黑暗神聖'],
    seg(G, t0) { flare(G, t0); return holy(G, t0 + 6); },
  }, 1, 0.5),
  petrify: single({
    name: '超石化',
    sub: '背對王與邪眼',
    brief: '',
    mechs: ['超石化'],
    info: ['超石化'],
    seg: (G, t0) => petrify(G, t0) + 1.5,
  }, 1, 0),
  beam: single({
    name: '連射式波動炮',
    sub: '直線分攤四輪',
    brief: '',
    mechs: ['連射式波動炮'],
    info: ['連射式波動炮'],
    seg: (G, t0) => beam(G, t0) + 0.9,
  }, 1, 0),
};

/** 機制名稱 → 單練項目 */
export const singleForMech = (mech: string): string | undefined => Object.keys(singles).find((k) => singles[k].mechs[0] === mech || singles[k].mechs.includes(mech));
