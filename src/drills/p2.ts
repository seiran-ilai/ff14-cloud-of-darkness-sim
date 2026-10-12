// P2 華容道練習（第一段：場地、格子、深暗領域、波動球＋三重暗之戰技）
import type { Drill } from '../game/state';
import { at, alertMsg, seqAdd } from '../game/state';
import { good, warn } from '../game/results';
import { zoneOf } from '../core/p2';
import { enterP2 } from '../mechanics/p2/enter';
import { domain } from '../mechanics/p2/domain';
import { triple } from '../mechanics/p2/triple';
import { waveball } from '../mechanics/p2/waveball';

/** 格子自由練習的長度（秒）：超過 45 秒，一定要刷新 */
const GRID_SECS = 70;

export const p2: Record<string, Drill> = {
  p2open: {
    group: 'p2',
    name: 'P2 開場',
    sub: '深暗領域 → 戰技＋塔',
    brief: '進入華容道：內場 12 人（B 聯盟＋A/C 的 ST、H1）、西平臺 A、東平臺 C。深暗領域後環狀地板會出血，留在平臺或格子上。'
      + '小王的三重暗之戰技一定是「單手 → 單手／雙手／黑霧 → 單手／雙手／黑霧」：單手球躲到沒球那半邊；雙手球 MT＋H2、D1＋D3、D2＋D4 分攤；黑霧照相對方向散開。'
      + '內場 B 聯盟 H1/H2/D1/D2 站在格子內偏本體側。三擊結束後踩波動球的塔：內場踩自己角落的塔格，外場 MT/D1/D3 踩 12／9 點、H2/D2/D4 踩 6／3 點。',
    setup(G) {
      enterP2(G);
      domain(G, 1);
      const last = triple(G, 6);
      const end = waveball(G, 6, last);
      at(G, end + 1.5, () => { G.endT = G.t; });
    },
  },
  p2grid: {
    group: 'p2',
    name: '格子刷新',
    sub: `內場自由練習 ${GRID_SECS} 秒`,
    brief: '內場每格只能站 1 人：連續站 40 秒變紅、45 秒消失；兩人以上碰到同一格會在 1 秒後消失；離開格子站立時間就刷新。'
      + '判定圈碰到格子就算站在上面，所以換格時不要貼到別人的格子。平時就在自己的區域換格刷新（只是刷新時不要進交叉格）。'
      + '外場座位沒有格子，請選 B 聯盟、或 A／C 聯盟的 ST、H1 練習。',
    setup(G) {
      enterP2(G);
      seqAdd(G, 0, '格子刷新練習');
      const inner = zoneOf(G.player.al, G.player.role) === 'in';
      at(G, 0.5, () => alertMsg(G, inner ? `撐過 ${GRID_SECS} 秒：記得換格刷新` : '你的座位在外場，沒有格子', 3));
      at(G, GRID_SECS, () => {
        if (G.player.dead) return;
        if (inner) good(G, '格子', `撐過 ${GRID_SECS} 秒，格子沒有消失`);
        else warn(G, '格子', '你的座位在外場，這個練習請換內場座位');
        G.endT = G.t + 0.5;
      });
    },
  },
};
