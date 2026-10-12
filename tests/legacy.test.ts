// @vitest-environment node
// legacy 對照：在 jsdom 載入 legacy/cod-sim.html，把 Math.random 換成同種子的 mulberry32，和新版跑同一局示範。
// Prompt 1（純重構）時兩邊的判定清單逐字相同；Prompt 2 刻意修改了判定（判定圈、陰冷擁抱分配、Bot），
// 所以改比對「機制順序」與「判定項目種類」（Prompt 1 允許的後備比對方式）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import type * as JsdomNS from 'jsdom';
// 用 Node 原生 require 載入 jsdom（經過 Vitest 轉譯時偶爾會極慢甚至逾時）
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof JsdomNS;
import { mulberry32 } from '../src/core/rng';
import { mechName } from '../src/game/results';
import { runDemo, DT } from './helpers';
import type { Alliance, Role } from '../src/core/constants';

const html = readFileSync(resolve(__dirname, '../legacy/cod-sim.html'), 'utf8').replace(/<link[^>]*>/g, '');

/** 什麼都不做的 2D context（legacy 在載入時會呼叫 getContext） */
function stubCtx(): unknown {
  const fn: unknown = new Proxy(function () { /* noop */ }, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : fn),
    apply: () => fn,
    set: () => true,
  });
  return fn;
}

interface Summary { order: string[]; kinds: string[] }

interface LegacySim {
  CFG: { drill: string; al: string; role: string };
  G: { state: string; checks: { tag: string }[]; seq: { label: string; emb?: boolean }[] };
  newGame(auto?: boolean): void;
  step(dt: number): void;
}

const summarize = (seq: { label: string; emb?: boolean }[], tags: string[]): Summary => ({
  order: seq.filter((s) => !s.emb).map((s) => s.label),
  kinds: [...new Set(tags.map(mechName).filter((t) => t !== '掉落'))].sort(),
});

function runLegacy(drill: string, al: Alliance, role: Role, seed: number): Summary {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(win) {
      (win as unknown as { requestAnimationFrame: () => number }).requestAnimationFrame = () => 0;
      win.HTMLCanvasElement.prototype.getContext = (() => stubCtx()) as never;
    },
  });
  const win = dom.window as unknown as { __sim: LegacySim; Math: Math };
  const sim = win.__sim;
  Object.assign(sim.CFG, { drill, al, role });
  win.Math.random = mulberry32(seed);
  sim.newGame(true);
  for (let i = 0; i < 200 / DT && sim.G.state !== 'end'; i++) sim.step(DT);
  const out = summarize(sim.G.seq, sim.G.checks.map((c) => c.tag));
  dom.window.close();
  return out;
}

describe('legacy 對照（機制順序與判定項目種類）', () => {
  const cases: [string, Alliance, Role, number][] = [
    ['tl1', 'A', 'D3', 11], ['tl1', 'B', 'MT', 22], ['tl1', 'C', 'H2', 33],
    ['tl2', 'A', 'ST', 44], ['tl2', 'B', 'D2', 80190], ['embrace', 'B', 'D1', 55], ['volley', 'C', 'D4', 66], ['beam', 'A', 'MT', 77],
  ];
  for (const [drill, al, role, seed] of cases) {
    it(`${drill} ${al}-${role} seed=${seed}`, () => {
      const legacy = runLegacy(drill, al, role, seed);
      const r = runDemo(drill, al, role, seed);
      const now = summarize(r.G.seq, r.G.checks.map((c) => c.tag));
      expect(legacy.order.length).toBeGreaterThan(0);
      expect(now.order).toEqual(legacy.order);
      expect(now.kinds).toEqual(legacy.kinds);
    });
  }
});
