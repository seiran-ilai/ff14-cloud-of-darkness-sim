// 機制說明（效果／預兆／應對）：每個練習列出的機制、每個詠唱名稱都要有說明
import { describe, it, expect } from 'vitest';
import { DRILLS, getDrill } from '../src/drills';
import { mechInfo } from '../src/drills/mechinfo';
import { CATALOG } from '../src/drills/catalog';
import { VARIANTS } from '../src/drills/variants';
import { makeSession, runToEnd, seatOf } from './helpers';

const CASTS = ['暗之刃', '暗之大泛濫', '暗之泛濫', '陰冷擁抱', '核爆', '黑暗神聖', '連射式波動炮', '飆風', '極死', '超賦風', '超賦死', '超石化',
  '深暗領域', '三重暗之戰技', '波動球', '恐懼之雲', '波動詛咒', '種子彈', '荊棘叢生', '暗之泛濫（小王）', '凝聚式波動炮', '分散式波動炮',
  '迴旋式波動炮', '混沌迫近', '潛地式波動炮', '磔殺', '雲散'];

describe('機制說明', () => {
  it('每個詠唱名稱都有效果／預兆／應對', () => {
    const miss = CASTS.filter((n) => !mechInfo(n));
    expect(miss).toEqual([]);
    CASTS.forEach((n) => { const m = mechInfo(n)!; expect(m.effect && m.tell && m.how).toBeTruthy(); });
  });

  it('教學頁的每個樣式（含超石化角落面壁）：示範模式指定樣式跑完，玩家成功、Bot 沒被打中', () => {
    const bad: string[] = [];
    Object.entries(VARIANTS).forEach(([drill, groups]) => groups.forEach((g) => g.opts.forEach((o) => {
      for (let i = 0; i < 4; i++) {
        const { al, role } = seatOf(i * 5);
        const s = makeSession(drill, al, role);
        s.pick = { [g.key]: o.value };
        const G = s.newGame(true, 500 + i);
        runToEnd(s, G);
        if (!G.result?.ok || G.botFails.length) bad.push(`${drill} ${g.key}=${o.value} ${al}-${role}: ${[...G.fails, ...G.botFails.map((b) => `${b.who}：${b.why}`)].join(' / ')}`);
      }
    })));
    expect(bad).toEqual([]);
  });

  it('每個練習列出的機制都有說明', () => {
    const keys = [...Object.keys(DRILLS), 'run:cont:p1', 'run:one:p3', 'run:one:p4', `rand:r:3:${CATALOG.map((m) => m.id).join(',')}`];
    keys.forEach((k) => {
      const D = getDrill(k);
      if (k !== 'p2grid') expect(D.info?.length, k).toBeGreaterThan(0);
      expect((D.info ?? []).filter((n) => !mechInfo(n)), k).toEqual([]);
    });
  });
});
