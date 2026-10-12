// Prompt 2 新功能：種子重現、從某個機制開始、回放錄影、弱點練習、判定圈、失誤統計
import { describe, it, expect } from 'vitest';
import { hitRect, hitCircle, insideCircle, hitRay } from '../src/core/hit';
import { HIT, EMBRACE } from '../src/core/tuning';
import { mechName } from '../src/game/results';
import { blend } from '../src/game/replay';
import { getDrill, WEAK_PREFIX } from '../src/drills';
import { runDemo, makeSession, runToEnd } from './helpers';
import { cellUnder, zoneOf } from '../src/core/p2';
import { cellRed } from '../src/game/p2state';

describe('種子', () => {
  it('同種子重打同一局：判定清單完全相同', () => {
    const a = runDemo('tl1', 'A', 'D3', 4242), b = runDemo('tl1', 'A', 'D3', 4242);
    expect(a.checks).toEqual(b.checks);
    expect(a.G.rng.seed).toBe(4242);
  });
  it('不同種子出不同的局', () => {
    const labels = new Set([1, 2, 3, 4, 5, 6].map((s) => runDemo('tl1', 'A', 'D3', s).G.seq.map((x) => x.label).join('|')));
    expect(labels.size).toBeGreaterThan(1);
  });
});

describe('從某個機制開始練', () => {
  it('時間軸 1 從超石化開始：之前由 Bot 代打，紀錄清空、重新倒數', () => {
    const s = makeSession('tl1', 'C', 'H1');
    const G = s.newGame(false, 99, 47.5);
    expect(G.state).toBe('count');
    expect(G.t).toBeGreaterThan(45);
    expect(G.t).toBeLessThan(47.5);
    expect(G.checks).toEqual([]);
    expect(G.player.embs.length).toBeGreaterThan(0); // 99／111 秒的減益還在
    while (G.t < 47) s.step(1 / 120);
    expect(G.stored).not.toBeNull(); // 44 秒的超賦在 46.5 秒儲存
  });
  it('示範模式從中途開始也能跑完且成功', () => {
    const r = runDemo('tl2', 'B', 'MT', 7, 66.3);
    expect(r.ok).toBe(true);
    expect(Math.min(...r.G.checks.map((c) => c.t))).toBeGreaterThan(64);
  });
});

describe('回放錄影', () => {
  it('錄下每個判定前後的影格，且之後的變動不影響錄影', () => {
    const r = runDemo('petrify', 'A', 'D1', 5, 0, true);
    const frames = r.session.rec.frames;
    const c = r.G.checks[0];
    const near = frames.filter((f) => f.t >= c.t - 4 && f.t <= c.t + 1);
    expect(near.length).toBeGreaterThan(60);
    const before = near[0].player.x;
    r.G.player.x += 100;
    expect(near[0].player.x).toBe(before);
    const b = blend(near[0], near[1]);
    expect(b.player.px).toBe(near[0].player.x);
    expect(c.fix).toBeDefined();
  });
});

describe('弱點練習', () => {
  it('把幾個單練串成一局並能完成', () => {
    const D = getDrill(WEAK_PREFIX + 'petrify,volley,beam');
    expect(D.name).toBe('弱點練習');
    const s = makeSession(WEAK_PREFIX + 'petrify,volley,beam', 'B', 'D4');
    const G = s.newGame(true, 3);
    runToEnd(s, G);
    expect(G.result?.ok).toBe(true);
    const kinds = new Set(G.checks.map((c) => mechName(c.tag)));
    expect([...kinds].sort()).toEqual(['超石化', '連射式波動炮', '齊射式波動炮'].sort());
  });
});

describe('P2 格子規則', () => {
  it('玩家（內場）站著不動：40 秒變紅、45 秒格子消失掉下去', () => {
    const s = makeSession('p2grid', 'B', 'D3');
    const G = s.newGame(false, 1);
    const c = cellUnder(G.player)!;
    while (G.t < 41 && !G.player.dead) s.step(1 / 120);
    expect(cellRed(G.p2!, c)).toBe(true);
    while (G.t < 47 && !G.player.dead) s.step(1 / 120);
    expect(G.player.dead).toBe(true);
    expect(G.fails.join()).toContain('格子消失');
  });
  it('兩人碰到同一格：1 秒後消失', () => {
    const s = makeSession('p2grid', 'B', 'D3');
    const G = s.newGame(false, 1);
    G.state = 'run';
    const c = cellUnder(G.player)!;
    const other = G.ents.find((e) => !e.isPlayer && zoneOf(e.al, e.role) === 'in')!;
    Object.assign(other, { x: c.cx + 1, y: c.cy, mt: { x: c.cx + 1, y: c.cy } });
    s.step(1 / 120);
    expect(G.p2!.cells[c.idx].doomAt).not.toBeNull();
    while (G.t < 1.2) s.step(1 / 120);
    expect(G.p2!.cells[c.idx].goneUntil).not.toBeNull();
    expect(G.player.dead).toBe(true);
  });
  it('三重暗之戰技順序：第 1 擊單手、三擊中剛好 2 次單手', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = runDemo('p2open', 'A', 'MT', seed);
      const mine = r.G.checks.filter((c) => c.tag === '三重暗之戰技').map((c) => c.text);
      expect(mine[0]).toMatch(/單手球/);
      expect(mine.filter((t) => /單手球/.test(t)).length).toBe(2);
    }
  });
});

describe('判定圈', () => {
  it('矩形：判定圈碰到邊緣即中、角落是圓角', () => {
    const O = { x: 0, y: 0 }, H = 0; // 往北
    const w = EMBRACE.handW, len = EMBRACE.handLen;
    expect(hitRect({ x: w / 2 + HIT - 0.01, y: -5 }, O, H, len, w)).toBe(true);
    expect(hitRect({ x: w / 2 + HIT + 0.01, y: -5 }, O, H, len, w)).toBe(false);
    // 角落外斜方向：方形擴張會判中，圓角不會
    expect(hitRect({ x: w / 2 + HIT * 0.9, y: HIT * 0.9 }, O, H, len, w)).toBe(false);
  });
  it('圓形與安全區', () => {
    expect(hitCircle({ x: 6.4, y: 0 }, { x: 0, y: 0 }, 6)).toBe(true);
    expect(insideCircle({ x: 6.4, y: 0 }, { x: 0, y: 0 }, 6.5)).toBe(false);
    expect(hitRay({ x: 3, y: -10 }, { x: 0, y: 0 }, { x: 0, y: -1 }, 2.5)).toBe(true);
  });
  it('失誤統計的機制名稱去掉秒數與（超賦）', () => {
    expect(mechName('陰冷擁抱 40s')).toBe('陰冷擁抱');
    expect(mechName('飆風（超賦）')).toBe('飆風');
  });
});
