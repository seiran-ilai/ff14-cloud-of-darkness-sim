// 完整時間軸（docs 第 2 節「兩種時間軸」）。各機制起點秒數為估計。
import type { BladeMode, Drill, StoredKind } from '../game/state';
import { seqAdd } from '../game/state';
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
import { deluge } from '../mechanics/deluge';
import { greatDeluge } from '../mechanics/greatDeluge';
import { at } from '../game/state';
import { OPENER } from '../core/tuning';

/** 開場（準備階段，docs 第 1 節）：3 次暗之刃（攻擊方式不重複）→ 暗之大泛濫進入魔法陣 */
export const opener: Drill = {
  tl: true,
  name: '開場',
  sub: '暗之刃×3 → 暗之大泛濫',
  brief: '準備階段：暗之刃 3 次，攻擊方式一定不重複。單手舉刀＝站到沒舉手那一側的王前方圓形安全區；雙手舉刀構於身前＝離開王腳下。之後暗之大泛濫：大傷害全場 AOE，附加 15 秒出血，場地變成魔法陣（P1）。',
  setup(G) {
    const modes = G.rng.shuffle<BladeMode>(['L', 'R', 'B']);
    OPENER.blades.forEach((t, i) => { blade(G, t, modes[i]); seqAdd(G, t, '暗之刃'); });
    const end = greatDeluge(G, OPENER.deluge, '進入魔法陣階段');
    at(G, end + 2, () => { G.endT = G.t; });
  },
};

export const tl1: Drill = {
  tl: true,
  name: '時間軸 1',
  sub: '核爆 → 神聖 → 刃 → 超賦 → 石化',
  brief: '陰冷擁抱×2 → 齊射式 → 核爆 → 黑暗神聖 → 暗之刃 → 超賦風／死 → 超石化 → 暗之刃（＋儲存的飆風／極死）→ 齊射式 → 極死／飆風。陰冷擁抱減益 40／56／99／111 秒，會在其他機制之間結束。',
  setup(G) {
    const { rng } = G;
    const k: StoredKind = rng.chance(0.5) ? 'aero' : 'death', k2: StoredKind = k === 'aero' ? 'death' : 'aero';
    const m1 = rng.pickOne<BladeMode>(['L', 'R', 'B']);
    // 3 次暗之刃不重複；超賦後一定單手
    const m2 = rng.pickOne((['L', 'R'] as BladeMode[]).filter((x) => x !== m1));
    // 減益秒數照 docs：第一次 40／99、第二次 56／111（第一次拿短的人第二次拿長的）
    const g1 = embraceCast(G, 0, [40, 99]);
    embraceCast(G, 3, [56, 111], { after: g1 });
    volley(G, 10);
    // 攻略：齊射途中點名核爆（估計在第 3 發，t0+7.5），核爆後立刻詠唱黑暗神聖
    flare(G, 17.5);
    holy(G, 23.3);
    blade(G, 29.6, m1);
    seqAdd(G, 29.6, '暗之刃');
    enhance(G, 44, k);
    petrify(G, 47.5);
    bladeRelease(G, 66.3, m2, k);
    volley(G, 77.4);
    // TODO(確認): 最後的飆風／極死固定用「沒被超賦儲存的那一個」，docs 沒寫是否一定如此
    (k2 === 'aero' ? aero : death)(G, 86.8, 4.5);
    deluge(G, 121);
  },
};

export const tl2: Drill = {
  tl: true,
  name: '時間軸 2',
  sub: '飆風／極死 → 超賦 → 連射 → 核爆',
  brief: '陰冷擁抱×2 → 齊射式 → 飆風／極死 → 超賦風／死 → 連射式 → 齊射式 → 暗之刃（＋儲存的飆風／極死）→ 核爆。陰冷擁抱減益 51／107 與 50／57 秒。',
  setup(G) {
    const { rng } = G;
    const k1: StoredKind = rng.chance(0.5) ? 'aero' : 'death', k2: StoredKind = rng.chance(0.5) ? 'aero' : 'death';
    const m = rng.pickOne<BladeMode>(['L', 'R']);
    // 減益秒數照 docs：第一次 51／107、第二次 50／57（第一次拿短的人第二次拿長的）
    const g1 = embraceCast(G, 0, [51, 107]);
    embraceCast(G, 3, [50, 57], { after: g1 });
    volley(G, 10);
    (k1 === 'aero' ? aero : death)(G, 19.5, 5);
    enhance(G, 29.2, k2);
    beam(G, 32);
    volley(G, 66.3);
    // 攻略：約第 3 發時開始詠唱暗之刃（t0+7.5）
    bladeRelease(G, 73.8, m, k2);
    flare(G, 87);
    deluge(G, 113);
  },
};
