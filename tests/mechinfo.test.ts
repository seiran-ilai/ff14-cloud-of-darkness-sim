// 機制說明（效果／預兆／應對）：每個練習列出的機制、每個詠唱名稱都要有說明
import { describe, it, expect } from 'vitest';
import { DRILLS, getDrill } from '../src/drills';
import { mechInfo } from '../src/drills/mechinfo';
import { CATALOG } from '../src/drills/catalog';

const CASTS = ['暗之刃', '暗之大泛濫', '暗之泛濫', '陰冷擁抱', '核爆', '黑暗神聖', '連射式波動炮', '飆風', '極死', '超賦風', '超賦死', '超石化',
  '深暗領域', '三重暗之戰技', '波動球', '恐懼之雲', '波動詛咒', '種子彈', '荊棘叢生', '暗之泛濫（小王）', '凝聚式波動炮', '分散式波動炮',
  '迴旋式波動炮', '混沌迫近', '潛地式波動炮', '磔殺', '雲散'];

describe('機制說明', () => {
  it('每個詠唱名稱都有效果／預兆／應對', () => {
    const miss = CASTS.filter((n) => !mechInfo(n));
    expect(miss).toEqual([]);
    CASTS.forEach((n) => { const m = mechInfo(n)!; expect(m.effect && m.tell && m.how).toBeTruthy(); });
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
