// 階段練習：連續（從選的階段一路打到最後）／單一階段（只打 P1～P4 其中一段）。
// 練習項目 key：run:<cont|one>:<p1|p2|p3|p4>，例如 run:cont:p2＝從 P2 開始一路到 P4。
import type { Drill, GameState } from '../game/state';
import { at, seqAdd } from '../game/state';
import { p1Seg, tl1Seg, tl2Seg, toGem, OPENER_BRIEF, TL1_BRIEF, TL2_BRIEF } from './timelines';
import { p3Seg, P3_BRIEF } from './p2';
import { PHASE_MECHS, P2_MECHS } from './mechinfo';

export type RunMode = 'cont' | 'one';
export type Phase = 'p1' | 'p2' | 'p3' | 'p4';

export const RUN_PREFIX = 'run:';
export const PHASES: readonly Phase[] = ['p1', 'p2', 'p3', 'p4'];
export const RUN_MODE_NAME: Record<RunMode, string> = { cont: '連續', one: '單一階段' };
export const PHASE_NAME: Record<Phase, string> = { p1: 'P1 開場', p2: 'P2 第一次魔法陣', p3: 'P3 華容道', p4: 'P4 第二次魔法陣' };

export const runKey = (mode: RunMode, start: Phase): string => `${RUN_PREFIX}${mode}:${start}`;

/** 解析階段練習的 key；不是階段練習就回傳 null */
export function parseRun(key: string): { mode: RunMode; start: Phase } | null {
  const m = /^run:(cont|one):(p[1-4])$/.exec(key);
  return m ? { mode: m[1] as RunMode, start: m[2] as Phase } : null;
}

/**
 * 依序排各階段。魔法陣的時間軸：P2 隨機一套，P4 用另一套（docs：第二次魔法陣用第一次沒用到的）。
 * 階段之間：P1 暗之大泛濫 → P2；P2 暗之泛濫（場地回到大圓形）→ P3 暗之大泛濫；P3 暗之泛濫 → P4 暗之大泛濫。
 */
function runPhases(G: GameState, phases: Phase[]): number {
  let t = 0.5;
  let first = G.rng.chance(0.5);
  phases.forEach((ph, k) => {
    const last = k === phases.length - 1;
    if (ph === 'p1') {
      seqAdd(G, t, '【P1 開場】');
      t = p1Seg(G, t) + 3;
    } else if (ph === 'p2' || ph === 'p4') {
      const one = ph === 'p2' || k === 0 ? first : !first;
      first = one;
      seqAdd(G, t, `【${PHASE_NAME[ph]}・時間軸 ${one ? 1 : 2}】`);
      // P4 從 P3 接過來：先暗之大泛濫回到魔法陣
      if (ph === 'p4' && k > 0) t = toGem(G, t, '進入 P4 第二次魔法陣') + 3;
      t = (one ? tl1Seg : tl2Seg)(G, t, ph === 'p4' ? 'enrage' : last ? 'game' : 'next') + 1;
    } else {
      seqAdd(G, t, '【P3 華容道】');
      t = p3Seg(G, t) + 1;
    }
  });
  return t;
}

const BRIEF: Record<Phase, string> = {
  p1: OPENER_BRIEF,
  p2: `兩套時間軸隨機一套；P4 用另一套。<p class="bsub">時間軸 1</p>${TL1_BRIEF}<p class="bsub">時間軸 2</p>${TL2_BRIEF}`,
  p3: P3_BRIEF,
  p4: '用 P2 沒用到的另一套時間軸（單獨練時隨機），最後是<b>暗之大泛濫（強制團滅）</b>，不是暗之泛濫。',
};

const INFO: Record<Phase, string[]> = { p1: PHASE_MECHS.p1, p2: P2_MECHS, p3: PHASE_MECHS.p3, p4: [...P2_MECHS, '暗之大泛濫'] };

export function makeRunDrill(mode: RunMode, start: Phase): Drill {
  const phases = mode === 'cont' ? PHASES.slice(PHASES.indexOf(start)) : [start];
  return {
    tl: true,
    name: mode === 'cont' ? `連續・從 ${PHASE_NAME[start]} 開始` : `單一階段・${start === 'p2' ? 'P2／P4 魔法陣' : PHASE_NAME[start]}`,
    sub: phases.map((p) => PHASE_NAME[p]).join(' → '),
    brief: phases.map((p) => `<p class="bhead">${PHASE_NAME[p]}</p>${BRIEF[p]}`).join(''),
    info: [...new Set(phases.flatMap((p) => INFO[p]))],
    setup(G) {
      const end = runPhases(G, phases);
      at(G, end, () => { G.endT = G.t; });
    },
  };
}
