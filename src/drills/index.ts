import type { Drill } from '../game/state';
import { at, seqAdd } from '../game/state';
import { opener, tl1, tl2 } from './timelines';
import { singles } from './singles';
import { p2 } from './p2';
import { p3singles } from './p3singles';
import { parseRun, makeRunDrill } from './run';
import { parseRand, makeRandDrill } from './random';
import { flowHtml } from './mechinfo';

/** 所有練習項目；順序即畫面上按鈕順序 */
export const DRILLS: Record<string, Drill> = { opener, tl1, tl2, ...singles, ...p2, ...p3singles };

/** 弱點練習的 key 前綴：weak:volley,embrace */
export const WEAK_PREFIX = 'weak:';

/** 把幾個單練串成一局 */
export function makeWeakDrill(keys: string[]): Drill {
  const list = keys.filter((k) => singles[k]);
  return {
    name: '弱點練習',
    sub: list.map((k) => singles[k].name).join('・'),
    brief: '把最常失誤的機制串在一起練。' + flowHtml(list.map((k) => singles[k].name)),
    info: [...new Set(list.flatMap((k) => singles[k].info ?? []))],
    setup(G) {
      G.tl = list.length > 1;
      let t = 1;
      list.forEach((k) => { seqAdd(G, t, `【${singles[k].name}】`); t = singles[k].seg(G, t) + 1.5; });
      at(G, t, () => { G.endT = G.t; });
    },
  };
}

export const getDrill = (key: string): Drill => {
  if (key.startsWith(WEAK_PREFIX)) return makeWeakDrill(key.slice(WEAK_PREFIX.length).split(','));
  const run = parseRun(key);
  if (run) return makeRunDrill(run.mode, run.start);
  const rand = parseRand(key);
  if (rand) return makeRandDrill(rand);
  return DRILLS[key] ?? DRILLS.tl1;
};
