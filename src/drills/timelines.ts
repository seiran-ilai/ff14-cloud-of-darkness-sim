// P1 開場與魔法陣階段的兩種時間軸（P2 第一次、P4 第二次魔法陣用另一套；docs 第 1、2、4 節）。各機制起點秒數為估計。
// 每段都是 seg(G, t0) → 結束時間，可以單獨練，也可以串成連續模式（drills/run.ts）。
import type { BladeMode, Drill, GameState, StoredKind } from '../game/state';
import { seqAdd, setCast, alertMsg } from '../game/state';
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
import { OPENER, GREAT_DELUGE, REACT } from '../core/tuning';
import { inArena } from '../core/geometry';
import { homePos } from '../core/positions';
import { npcs } from '../game/bots';

/** P1 開場：3 次暗之刃（攻擊方式不重複）→ 暗之大泛濫，圓形外圍消失、進入 P2 魔法陣。回傳場地變化的時間 */
export function p1Seg(G: GameState, t0: number): number {
  G.round = true;
  const modes = G.rng.shuffle<BladeMode>(['L', 'R', 'B']);
  OPENER.blades.forEach((t, i) => { blade(G, t0 + t, modes[i]); seqAdd(G, t0 + t, '暗之刃'); });
  return toGem(G, t0 + OPENER.deluge, '進入 P2 第一次魔法陣');
}

/** 暗之大泛濫：圓形場地 → 魔法陣（鑽石形）。詠唱時先標出會消失的外圍；回傳場地變化的時間 */
export function toGem(G: GameState, t0: number, note: string): number {
  at(G, t0, () => { G.extra.gemWarn = t0 + GREAT_DELUGE.cast; });
  // 預兆（橘色外圍）出現後，Bot 反應過來走進中間的鑽石形
  at(G, t0 + REACT, () => npcs(G).forEach((e) => { if (!e.dead && !inArena(e.x, e.y)) e.mt = homePos(e.al, e.role); }));
  return greatDeluge(G, t0, note, () => { G.round = false; }, '大傷害全場 AOE＋出血；橘色外圍會消失，站進中間的鑽石形地板');
}

/**
 * 魔法陣階段怎麼結束：game＝暗之泛濫後結束這局（單獨練）；next＝暗之泛濫後接下一階段；
 * enrage＝P4 第二次魔法陣，最後是暗之大泛濫（強制團滅），撐到這裡就算打完。
 */
export type TlEnd = 'game' | 'next' | 'enrage';

function tlEnd(G: GameState, t0: number, end: TlEnd): number {
  if (end !== 'enrage') return deluge(G, t0, end === 'game');
  seqAdd(G, t0, '暗之大泛濫（強制團滅）');
  at(G, t0, () => setCast(G, '暗之大泛濫', GREAT_DELUGE.cast, '強制團滅：撐到這裡就打完了'));
  at(G, t0 + GREAT_DELUGE.cast, () => { G.fx.push({ k: 'flash', until: G.t + 0.6 }); alertMsg(G, '暗之大泛濫（強制團滅）：戰鬥結束', 3); G.endT = G.t + 1; });
  return t0 + GREAT_DELUGE.cast + 1;
}

/** 時間軸 1（P2 或 P4）；回傳階段結束時間 */
export function tl1Seg(G: GameState, t0: number, end: TlEnd = 'game'): number {
  const { rng } = G;
  const k: StoredKind = rng.chance(0.5) ? 'aero' : 'death', k2: StoredKind = k === 'aero' ? 'death' : 'aero';
  const m1 = rng.pickOne<BladeMode>(['L', 'R', 'B']);
  // 3 次暗之刃不重複；超賦後一定單手
  const m2 = rng.pickOne((['L', 'R'] as BladeMode[]).filter((x) => x !== m1));
  // 減益秒數照 docs：第一次 40／99、第二次 56／111；兩次各 12 人，每人只拿一次
  const g1 = embraceCast(G, t0, [40, 99]);
  embraceCast(G, t0 + 3, [56, 111], { after: g1 });
  volley(G, t0 + 10);
  // 攻略：齊射途中點名核爆（估計在第 3 發，t0+7.5），核爆後立刻詠唱黑暗神聖
  flare(G, t0 + 17.5);
  holy(G, t0 + 23.3);
  blade(G, t0 + 29.6, m1);
  seqAdd(G, t0 + 29.6, '暗之刃');
  enhance(G, t0 + 44, k);
  petrify(G, t0 + 47.5);
  bladeRelease(G, t0 + 66.3, m2, k);
  volley(G, t0 + 77.4);
  // TODO(確認): 最後的飆風／極死固定用「沒被超賦儲存的那一個」，docs 沒寫是否一定如此
  (k2 === 'aero' ? aero : death)(G, t0 + 86.8, 4.5);
  return tlEnd(G, t0 + 121, end);
}

/** 時間軸 2（P2 或 P4）；回傳階段結束時間 */
export function tl2Seg(G: GameState, t0: number, end: TlEnd = 'game'): number {
  const { rng } = G;
  const k1: StoredKind = rng.chance(0.5) ? 'aero' : 'death', k2: StoredKind = rng.chance(0.5) ? 'aero' : 'death';
  const m = rng.pickOne<BladeMode>(['L', 'R']);
  // 減益秒數照 docs：第一次 51／107、第二次 50／57；兩次各 12 人，每人只拿一次
  const g1 = embraceCast(G, t0, [51, 107]);
  embraceCast(G, t0 + 3, [50, 57], { after: g1 });
  volley(G, t0 + 10);
  (k1 === 'aero' ? aero : death)(G, t0 + 19.5, 5);
  enhance(G, t0 + 29.2, k2);
  beam(G, t0 + 32);
  volley(G, t0 + 66.3);
  // 攻略：約第 3 發時開始詠唱暗之刃（t0+7.5）
  bladeRelease(G, t0 + 73.8, m, k2);
  flare(G, t0 + 87);
  return tlEnd(G, t0 + 113, end);
}

export const OPENER_BRIEF = '準備階段：場地是大圓形，地面有直角 V 字圖案。暗之刃 3 次，攻擊方式一定不重複。單手舉刀＝所有人走到沒握刀那隻手的那側（場地北緣、王的左右兩側）；雙手舉刀構於身前＝打北半場的大範圍，退到地面直角線（V 字頂點）就安全，不用退太後面。之後暗之大泛濫：詠唱時會先標出會消失的外圍，大傷害全場 AOE＋15 秒出血，場地只剩中間的鑽石形（P2 魔法陣，王底下沒有地板）。';
export const TL1_BRIEF = '陰冷擁抱×2 → 齊射式 → 核爆 → 黑暗神聖 → 暗之刃 → 超賦風／死 → 超石化 → 暗之刃（＋儲存的飆風／極死）→ 齊射式 → 極死／飆風。陰冷擁抱減益 40／56／99／111 秒，會在其他機制之間結束。';
export const TL2_BRIEF = '陰冷擁抱×2 → 齊射式 → 飆風／極死 → 超賦風／死 → 連射式 → 齊射式 → 暗之刃（＋儲存的飆風／極死）→ 核爆。陰冷擁抱減益 51／107 與 50／57 秒。';

export const opener: Drill = {
  tl: true,
  name: 'P1 開場',
  sub: '暗之刃×3 → 暗之大泛濫',
  brief: OPENER_BRIEF,
  setup(G) {
    const end = p1Seg(G, 0);
    at(G, end + 2, () => { G.endT = G.t; });
  },
};

export const tl1: Drill = {
  tl: true,
  name: 'P2 時間軸 1',
  sub: '核爆 → 神聖 → 刃 → 超賦 → 石化',
  brief: TL1_BRIEF,
  setup(G) { tl1Seg(G, 0); },
};

export const tl2: Drill = {
  tl: true,
  name: 'P2 時間軸 2',
  sub: '飆風／極死 → 超賦 → 連射 → 核爆',
  brief: TL2_BRIEF,
  setup(G) { tl2Seg(G, 0); },
};
