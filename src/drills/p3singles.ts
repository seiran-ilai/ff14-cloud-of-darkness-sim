// P3 華容道的單一機制練習：直接在華容道場地開始，只打一個機制（和隨機練習用同一份機制目錄）。
import type { Drill } from '../game/state';
import { at } from '../game/state';
import { enterP2 } from '../mechanics/p2/enter';
import { CATALOG } from './catalog';
import { flowHtml } from './mechinfo';

/** 按鈕的小字、單練的補充說明，以及說明卡要列的機制（效果／預兆／應對在 mechinfo.ts） */
export const P3_INFO: Record<string, { sub: string; brief: string; info: string[] }> = {
  p3tower: { sub: '單手／雙手／黑霧＋踩塔', brief: flowHtml(['三重暗之戰技：記住三個球的順序', '照順序躲三擊', '踩波動球的塔']), info: ['三重暗之戰技', '波動球'] },
  p3fear: { sub: '環形／十字', brief: '', info: ['恐懼之雲'] },
  p3curse: { sub: '詛咒結束時的扇形', brief: '單練用 7／12／17 秒（實戰 7／33／97 秒）。', info: ['波動詛咒'] },
  p3seed: { sub: '放種子 → 拉荊棘', brief: flowHtml(['種子彈：放種子、立刻離開', '荊棘叢生：拉斷連線']), info: ['種子彈', '荊棘叢生'] },
  p3charge: { sub: '直線分攤／圓形散開', brief: '凝聚式和分散式隨機出一種，看王身上的特效分辨。', info: ['凝聚式波動炮', '分散式波動炮'] },
  p3spin: { sub: '內場補格＋外場跳躍', brief: '內場處理迴旋式，外場同時處理跳躍波動炮。', info: ['迴旋式波動炮', '跳躍波動炮'] },
  p3swap: { sub: '換位', brief: '', info: ['混沌迫近'] },
  p3dive: { sub: '被追擊的人跑一圈', brief: '內場處理潛地式，外場同時處理三重暗之戰技（單手 → 雙手 → 雙手）。', info: ['潛地式波動炮', '三重暗之戰技'] },
  p3impale: { sub: '坦克死刑', brief: '', info: ['磔殺'] },
  p3interrupt: { sub: '外場 MT 插言', brief: '', info: ['暗之泛濫（小王）'] },
};

export const p3singles: Record<string, Drill> = Object.fromEntries(
  CATALOG.filter((m) => m.phase === 'p3').map((m) => [m.id, {
    group: 'p2',
    name: m.name,
    sub: P3_INFO[m.id]?.sub ?? 'P3 單一機制',
    brief: P3_INFO[m.id]?.brief ?? '',
    info: P3_INFO[m.id]?.info ?? [],
    setup(G) {
      // 一開始就是華容道場地，所有人在基本站位
      enterP2(G);
      const end = m.seg(G, 1.5);
      at(G, end + 0.5, () => { G.endT = G.t; });
    },
  } satisfies Drill]),
);
