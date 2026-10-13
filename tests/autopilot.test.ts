// 示範模式自動跑：時間軸成功率 ≥ 95%，單一機制 100%，而且 Bot 不可以違反規則被打中
import { describe, it, expect } from 'vitest';
import { DRILLS, getDrill } from '../src/drills';
import { CATALOG } from '../src/drills/catalog';
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

  // 階段練習：連續從 P1 打到 P4、單一階段 P2／P3；隨機練習（全部機制、可重複）
  for (const key of ['run:cont:p1', 'run:one:p2', 'run:one:p3', `rand:r:5:${CATALOG.map((m) => m.id).join(',')}`]) {
    it(`${getDrill(key).name}（10 次）`, () => {
      let ok = 0;
      const fails: string[] = [], bots: string[] = [];
      for (let i = 0; i < 10; i++) {
        const { al, role } = seatOf(i * 5);
        const seed = 2000 + i * 104729;
        const r = runDemo(key, al, role, seed);
        if (r.ok) ok++;
        else fails.push(`seed=${seed} ${al}-${role}: ${r.fails.join(' / ')}`);
        r.botFails.forEach((b) => bots.push(`seed=${seed} ${b.t.toFixed(1)}s ${b.tag} ${b.who}：${b.why}`));
        // 一定要打到最後一個階段才結束
        expect(r.G.state).toBe('end');
      }
      console.log(`[autopilot] ${key}: ${ok}/10${fails.length ? '\n  ' + fails.join('\n  ') : ''}${bots.length ? '\n  ' + bots.slice(0, 10).join('\n  ') : ''}`);
      expect(ok).toBeGreaterThanOrEqual(9);
      expect(bots).toEqual([]);
    });
  }
});
