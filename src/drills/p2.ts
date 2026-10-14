// P3 華容道練習：開場、全段、格子刷新（程式裡沿用 p2 命名）
import type { Drill, GameState } from '../game/state';
import { at, alertMsg, seqAdd } from '../game/state';
import { good, warn } from '../game/results';
import { zoneE, homeE } from '../core/p2';
import { npcs } from '../game/bots';
import { hurtPlayer } from '../game/results';
import { p2Walkable } from '../game/p2state';
import { greatDeluge } from '../mechanics/greatDeluge';
import { enterP2 } from '../mechanics/p2/enter';
import { domain } from '../mechanics/p2/domain';
import { triple } from '../mechanics/p2/triple';
import { waveball } from '../mechanics/p2/waveball';
import { fear } from '../mechanics/p2/fear';
import { curse } from '../mechanics/p2/curse';
import { seeds, thornTether, sbDeluge } from '../mechanics/p2/seeds';
import { chargeOrSpread, type ChargeKind } from '../mechanics/p2/charge';
import { spin, jump, spinJumpAt } from '../mechanics/p2/spin';
import { swap, dive, impale, vanish } from '../mechanics/p2/swap';
import { deluge } from '../mechanics/deluge';
import { allSettle } from '../mechanics/p2/common';
import { flowHtml } from './mechinfo';

/**
 * P3 華容道開場：暗之大泛濫進 P3 → 深暗領域 → 三重暗之戰技＋波動球。
 * t0＝暗之大泛濫開始詠唱；回傳最後判定的時間。
 */
export function p3Open(G: GameState, t0: number): number {
  const P = G.player;
  // 暗之大泛濫：詠唱中先跑到 P3 站位，詠唱完場地才變化
  at(G, t0, () => {
    npcs(G).forEach((e) => { e.mt = homeE(e); e.buffs.sprint = G.t + 7; });
    if (!G.auto) G.hints = [{ ...homeE(P), r: 1.2, label: '華容道站位' }];
  });
  const tF = greatDeluge(G, t0, '進入 P3 華容道', () => {
    enterP2(G, true);
    G.hints = [];
    if (!P.dead && !p2Walkable(G.p2!, P)) {
      hurtPlayer(G, '暗之大泛濫', '場地變化時沒有站在華容道的地板上，掉了下去', true, { ...homeE(P), r: 1.2, label: '你的華容道站位' });
    }
  });
  domain(G, tF + 1);
  const last = triple(G, tF + 6);
  const end = waveball(G, tF + 6, last);
  allSettle(G, end + 0.3);
  return end;
}

/**
 * P3 華容道全段（攻略順序，docs/p2-strategy.md 第 3 節；各機制起點秒數都是估計）：
 * 開場 → 恐懼之雲 → 波動詛咒 → 種子彈 → 恐懼之雲 → 荊棘叢生＋小王暗之泛濫 → 凝聚式／分散式 → 磔殺
 * → 迴旋式＋跳躍波動炮 → 混沌迫近 → 波動球 2 回＋跳躍波動炮＋波動詛咒 2 回 → 潛地式＋三重暗之戰技（只有分攤）
 * → 恐懼之雲 → 跳躍波動炮 → 分散式／凝聚式（和第一次相反）→ 小王暗之泛濫 → 雲散 → 暗之泛濫（場地恢復）。
 * 回傳暗之泛濫結束的時間（連續模式接 P4）。
 */
export function p3Seg(G: GameState, t0: number): number {
  const a = p3Open(G, t0) + 3;
  fear(G, a);
  const b = a + 10;
  const c1 = curse(G, b, [7, 33, 97]);
  const c = b + 6;
  seeds(G, c);
  const d = c + 12;
  fear(G, d);
  const e = d + 8;
  thornTether(G, e);
  sbDeluge(G, e + 2);
  const f = e + 20;
  const first: ChargeKind = G.rng.chance(0.5) ? 'charge' : 'spread';
  chargeOrSpread(G, f, first);
  const g = f + 10;
  impale(G, g);
  const h = g + 6;
  const spinEnd = spin(G, h);
  // 外場先躲跳躍波動炮（兩發），接著和內場一起躲迴旋式
  jump(G, spinJumpAt(h));
  const i = spinEnd + 3.4;
  swap(G, i);
  const j = i + 9;
  const jEnd = jump(G, j + 1);
  const wEnd = waveball(G, j, jEnd + 0.5, ['MT', 'H2', 'D1']);
  const c2 = curse(G, j + 8, [25, 56, 104]);
  const k = wEnd + 3;
  dive(G, k);
  triple(G, k + 2, true);
  const l = k + 20;
  fear(G, l);
  const m = l + 9;
  jump(G, m);
  const n = m + 8;
  chargeOrSpread(G, n, first === 'charge' ? 'spread' : 'charge');
  const o = n + 10;
  sbDeluge(G, o);
  // 第二次波動詛咒最長 104 秒：等最後一發打完才雲散
  const p = Math.max(o + 8, Math.max(c1, c2) + 2);
  vanish(G, p);
  return deluge(G, p + 6, false);
}

export const P3_BRIEF = '<ul class="bpts"><li>分組：內場 12 人（B 隊伍＋A／C 的 ST、H1）、西平臺 A、東平臺 C。</li>'
  + '<li>內場每格只能站 1 人，連續站 45 秒會消失：平時在自己的區域換格刷新。</li>'
  + '<li>暗之大泛濫詠唱時先跑到華容道站位（綠圈），腳下沒地板會掉下去。</li></ul>'
  + flowHtml(['深暗領域', '三重暗之戰技＋波動球（踩塔）', '恐懼之雲', '波動詛咒', '種子彈 → 恐懼之雲', '荊棘叢生＋小王暗之泛濫（插言）',
    '凝聚式／分散式波動炮', '磔殺', '迴旋式＋跳躍波動炮', '混沌迫近（換位）', '波動球 2 回＋波動詛咒 2 回', '潛地式波動炮＋三重暗之戰技',
    '恐懼之雲 → 跳躍波動炮', '分散式／凝聚式（和第一次相反）', '小王暗之泛濫 → 雲散 → 暗之泛濫']);

/** 格子自由練習的長度（秒）：超過 45 秒，一定要刷新 */
const GRID_SECS = 70;

export const p2: Record<string, Drill> = {
  p2open: {
    group: 'p2',
    name: 'P3 華容道 開場',
    sub: '深暗領域 → 戰技＋塔',
    brief: P3_BRIEF,
    info: ['暗之大泛濫', '深暗領域', '三重暗之戰技', '波動球'],
    setup(G) {
      const end = p3Open(G, 1);
      at(G, end + 1.5, () => { G.endT = G.t; });
    },
  },
  p2grid: {
    group: 'p2',
    name: '格子刷新',
    sub: `內場自由練習 ${GRID_SECS} 秒`,
    brief: '<ul class="bpts"><li>每格只能站 1 人：連續站 <b>40 秒變紅、45 秒消失</b>；離開格子站立時間就刷新。</li>'
      + '<li>兩人以上碰到同一格，1 秒後消失。判定圈碰到格子就算站在上面，換格時不要貼到別人的格子。</li>'
      + '<li>平時在自己的區域換格刷新（刷新時不要進交叉格）。</li>'
      + '<li>外場座位沒有格子：請選 B 隊伍、或 A／C 隊伍的 ST、H1。</li></ul>',
    setup(G) {
      enterP2(G);
      seqAdd(G, 0, '格子刷新練習');
      const inner = zoneE(G.player) === 'in';
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
