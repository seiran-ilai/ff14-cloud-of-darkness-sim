// 機制說明（效果／預兆／應對）：每個練習列出的機制、每個詠唱名稱都要有說明
import { describe, it, expect } from 'vitest';
import { DRILLS, getDrill } from '../src/drills';
import { mechInfo } from '../src/drills/mechinfo';
import { CATALOG } from '../src/drills/catalog';
import { VARIANTS } from '../src/drills/variants';
import { makeSession, runToEnd, seatOf } from './helpers';
import { tripleRole, tripleSpot } from '../src/mechanics/p2/triple';
import { mkEnt } from '../src/game/state';
import type { Alliance, Role } from '../src/core/constants';
import { CORNERS, cellAt, cellUnder, cornerOfCell, homeE, zoneE } from '../src/core/p2';

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

  it('混沌迫近換位後的三重暗之戰技分攤站位（小抄イディル改的換位後站位）', () => {
    const at = (al: Alliance, role: Role, seat: { al: Alliance; role: Role }) => { const e = mkEnt(al, role, false); e.seat = seat; return tripleSpot(1, tripleRole(e), 'B'); };
    // A 隊 D2：換到東平臺，外側・相對西（絕對北）
    const d2 = at('A', 'D2', { al: 'C', role: 'D2' });
    expect(d2.y).toBeLessThan(-3.5);
    // A 隊 D3：外側・相對北（往場外）
    const d3 = at('A', 'D3', { al: 'C', role: 'D3' });
    expect(d3.x).toBeGreaterThan(tripleSpot(1, 'MT', 'B').x);
    expect(Math.abs(d3.y)).toBeLessThan(0.5);
    // A 隊 D4：外側・相對東（絕對南）
    expect(at('A', 'D4', { al: 'C', role: 'D4' }).y).toBeGreaterThan(3.5);
    // 從格子出來的坦克：內側北；補師：內側西；DPS：內側東
    expect(tripleRole(Object.assign(mkEnt('A', 'ST', false), { seat: { al: 'A', role: 'MT' } }))).toBe('MT');
    expect(tripleRole(Object.assign(mkEnt('A', 'H1', false), { seat: { al: 'A', role: 'H2' } }))).toBe('D1');
    expect(tripleRole(Object.assign(mkEnt('B', 'D1', false), { seat: { al: 'A', role: 'D1' } }))).toBe('D2');
    // 沒換位：照座位
    expect(tripleRole(mkEnt('A', 'D2', false))).toBe('D2');
  });

  it('混沌迫近換位方向照小抄：A 隊遠 3 人進東側角落、西側角落的人到東平臺', () => {
    for (const [pick, eastK, westK] of [['north', 1, 0], ['south', 3, 2]] as const) {
      const s = makeSession('p3swap', 'A', 'MT');
      s.pick = { swap: pick };
      const G = s.newGame(true, 7);
      runToEnd(s, G);
      const ent = (al: Alliance, role: Role) => G.ents.find((e) => e.al === al && e.role === role)!;
      const corner = (al: Alliance, role: Role) => cornerOfCell(cellUnder(homeE(ent(al, role)))!);
      // A 隊 MT／H2／D1 進東側角落、C 隊進西側角落
      (['MT', 'H2', 'D1'] as Role[]).forEach((r) => { expect(corner('A', r)).toBe(eastK); expect(corner('C', r)).toBe(westK); });
      // A 隊 MT：角落格往中間 2 格
      // 東側角落格在第 6 行：往中間 2 格＝第 4 行
      expect(cellUnder(homeE(ent('A', 'MT')))).toBe(cellAt(4, CORNERS[eastK][1]));
      // 西側角落被換出來的人到東平臺（zone 1）；D2／D3／D4 東西互換
      const westOut = pick === 'north' ? [['A', 'ST'], ['A', 'H1'], ['B', 'D1']] : [['B', 'MT'], ['B', 'H1'], ['B', 'D3']];
      westOut.forEach(([al, r]) => expect(zoneE(ent(al as Alliance, r as Role))).toBe(1));
      (['D2', 'D3', 'D4'] as Role[]).forEach((r) => { expect(zoneE(ent('A', r))).toBe(1); expect(zoneE(ent('C', r))).toBe(-1); });
    }
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
