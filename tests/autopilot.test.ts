// 示範模式自動跑：時間軸成功率 ≥ 95%，單一機制 100%，而且 Bot 不可以違反規則被打中
import { describe, it, expect } from 'vitest';
import { DRILLS } from '../src/drills';
import { runDemo, seatOf } from './helpers';

const TL_RUNS = 40;
const SINGLE_RUNS = 6;

describe('示範模式自動跑', () => {
  for (const key of Object.keys(DRILLS)) {
    const tl = !!DRILLS[key].tl;
    const n = tl ? TL_RUNS : SINGLE_RUNS;
    it(`${DRILLS[key].name}（${n} 次）`, () => {
      let ok = 0;
      const fails: string[] = [], bots: string[] = [];
      for (let i = 0; i < n; i++) {
        const { al, role } = seatOf(i);
        const seed = 1000 + i * 7919;
        const r = runDemo(key, al, role, seed);
        if (r.ok) ok++;
        else fails.push(`seed=${seed} ${al}-${role}: ${r.fails.join(' / ')}`);
        r.botFails.forEach((b) => bots.push(`seed=${seed} ${b.t.toFixed(1)}s ${b.tag} ${b.who}：${b.why}`));
      }
      const rate = ok / n;
      console.log(`[autopilot] ${DRILLS[key].name}: ${ok}/${n} = ${(rate * 100).toFixed(1)}%，Bot 被打中 ${bots.length} 次${fails.length ? '\n  ' + fails.join('\n  ') : ''}${bots.length ? '\n  ' + bots.slice(0, 10).join('\n  ') : ''}`);
      expect(rate).toBeGreaterThanOrEqual(tl ? 0.95 : 1);
      expect(bots).toEqual([]);
    });
  }
});
