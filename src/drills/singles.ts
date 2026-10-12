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
    brief: '先看王的手勢：<b>撈起（手背朝玩家）</b>＝手與你同向、從背後打 → 減益結束時<b>面向外</b>，手出現後轉身往場內走。<b>包覆（手心朝玩家）</b>＝手與你反向、從面前打 → <b>面向場內</b>一路往內走。剩 1 秒會被加重，到外周讓手朝場外打。',
    mechs: ['陰冷擁抱'],
    seg(G, t0) {
      const d = G.cfg.dur;
      embraceCast(G, t0, [d, d + 8]);
      return t0 + EMBRACE.cast + d + 8 + EMBRACE.handDelay + 1.5;
    },
    // 單練：玩家那批判定完就結束
    setup(G) { embraceCast(G, 0.5, [G.cfg.dur, G.cfg.dur + 8], { endOnMine: true }); },
  },
  volley: single({
    name: '齊射式波動炮',
    sub: '四輪交替直線',
    brief: '兩組雲各負責一個方向的直線，四輪交替。站在第一批與第二批發光雲的交會點旁，第一批炸完踩進它的線，第二批炸完再踩進交會點，就能躲過後兩輪。',
    mechs: ['齊射式波動炮'],
    seg: (G, t0) => volley(G, t0 + 0.5) + 0.8,
  }, 1.5, 0.5),
  death: single({
    name: '極死',
    sub: '吸引 → 圓形 → 環形',
    brief: '詠唱時先到東或西端點，被吸到中央附近後先停住；中央圓炸完立刻進中央躲環形。可用防擊退抵銷吸引，但就要站近一點。',
    mechs: ['極死'],
    seg: (G, t0) => death(G, t0, 7),
  }, 1, 0.8),
  aero: single({
    name: '飆風',
    sub: '中央擊退・藍圈',
    brief: '站在藍圈外、正東或正西方向，往東西被擊退距離最長；往斜邊飛容易掉下去。也可以開防擊退。',
    mechs: ['飆風'],
    seg: (G, t0) => aero(G, t0, 7),
  }, 1, 1.3),
  blade: single({
    name: '暗之刃＋超賦',
    sub: '刃 → 無讀條飆風／極死',
    brief: '單手：安全區在沒舉手那側的王前方。雙手：離開王身邊。超賦後的暗之刃一定是單手，炸完立刻接無讀條的飆風或極死，攻略建議這時開防擊退。',
    mechs: ['暗之刃', '飆風', '極死'],
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
    brief: '核爆：被點的人 A 去西、B 去南、C 去東；沒被點的人離遠一點。黑暗神聖：6 處分攤，A／B／C 由西到東，前排 MT 組、後排 ST 組。',
    mechs: ['核爆', '黑暗神聖'],
    seg(G, t0) { flare(G, t0); return holy(G, t0 + 6); },
  }, 1, 0.5),
  petrify: single({
    name: '超石化',
    sub: '背對王與邪眼',
    brief: '場外東或西出現兩個邪眼，判定時面向王或邪眼會石化 9 秒。面向沒有邪眼的那一側（東或西）即可。',
    mechs: ['超石化'],
    seg: (G, t0) => petrify(G, t0) + 1.5,
  }, 1, 0),
  beam: single({
    name: '連射式波動炮',
    sub: '直線分攤四輪',
    brief: '每聯盟點 1 名非坦克，直線分攤四輪，最前面兩人傷害較高。坦克站最前、其他人排在後面，別站到別聯盟的線上。',
    mechs: ['連射式波動炮'],
    seg: (G, t0) => beam(G, t0) + 0.9,
  }, 1, 0),
};

/** 機制名稱 → 單練項目 */
export const singleForMech = (mech: string): string | undefined => Object.keys(singles).find((k) => singles[k].mechs[0] === mech || singles[k].mechs.includes(mech));
