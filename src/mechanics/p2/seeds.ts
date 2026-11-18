/*
 * 種子彈 → 暗之荊棘 → 荊棘叢生，以及小王的暗之泛濫（可打斷）（P3 華容道）
 *
 * 種子彈（小王）：0 詠唱；+cast 點名：每個平臺 2 名外場＋每個內場角落 1 人（頭上紫色種子）；
 *   點名後 mark 秒在目標位置爆炸（判定前 2 秒鎖定位置、出預兆），打到別人算失誤，原地留下暗之荊棘。
 *   處理（攻略）：外場放在平臺的 3／9 點（相對），內場放在面向平臺的那兩格（直條中段）。
 *   暗之荊棘：佔用 1 格（算 1 人，放完要立刻離開那格）、站在荊棘裡受刺傷、兩個荊棘太近會大爆炸。
 *   模擬器（玩家回饋）：內場一側上下兩角各點 1 人；另一側上或下其中一角點 2 人，照 H > D > T 排前面的人
 *   補到同側空著那角的放置格，留下的人改放自己角落橫條靠中央那格（直條只留一顆荊棘，補位的人放完走得回來）。
 *   被點的人走過去時其他 Bot 讓路。外場隨機 2 人。
 * 荊棘叢生（小王）：0 詠唱；+cast 每個荊棘連線一人、內場南北各一對玩家互連，持續 18 秒，剩 5 秒時沒拉開就失誤。
 *   模擬器：荊棘直接連給攻略指定的拉線人（每側外場 H2、D2 拉北，D3、D4 拉南），沿環狀地板拉；
 *   內場同一側上下兩角各一人互連，各自跑到直條的上下兩端（約 7 格）。
 * 小王暗之泛濫：可打斷的全場 AOE；外場 MT 用插言打斷（玩家是外場 MT 時要自己按）。
 * 估計值：見 tuning.ts P3.seed／P3.thorn／P3.sbDeluge。
 */
import { P3 } from '../../core/tuning';
import { cellAt, cellUnder, cellsTouching, cellPath, cornerOfCell, neighbors, center, rel, zoneE, roleE, homeE, type Cell } from '../../core/p2';
import { roleType } from '../../core/constants';
import { cellGone, cellThorn } from '../../game/p2state';
import { dist } from '../../core/geometry';
import { hitCircle } from '../../core/hit';
import type { Vec } from '../../core/constants';
import { at, setCast, alertMsg, say, seqAdd, type Entity, type GameState } from '../../game/state';
import { good, bad } from '../../game/results';
import { isBot } from '../../game/bots';
import { entIndex } from '../../game/p2state';
import { cornerMembers, sendTo } from '../../game/p3plan';
import { p2Goto } from '../../game/p2nav';
import { failE, busy, allSettle, SIDES, outers, inners, ringWalk } from './common';

/** 內場各角落放種子的格子：面向平臺的直條中段 */
const SEED_CELL = [[1, 3], [6, 3], [1, 4], [6, 4]] as const;
const seedCell = (k: number): Cell => cellAt(SEED_CELL[k][0], SEED_CELL[k][1])!;
/** 同一角落兩顆時，留在原角落的人放的格子：角落橫條靠中央那格（直條只留補位的人那顆荊棘，他放完才走得回來） */
const seedCellAlt = (k: number): Cell => cellAt(k % 2 === 0 ? 3 : 4, k < 2 ? 1 : 6)!;

/** 外場種子落點（相對座標 f, r）、其他人的站位 */
const SEED_OUT: [number, number][] = [[-3.5, -2.8], [-3.5, 2.8]];
const OTHER_OUT: [number, number][] = [[4, -1.2], [4, 1.2], [3, 0], [4.4, 0]];

export function seeds(G: GameState, t0: number): number {
  const tag = '種子彈';
  seqAdd(G, t0, '種子彈（小王）');
  const tM = t0 + P3.seed.cast, tLock = tM + P3.seed.mark - 2, tR = tM + P3.seed.mark;
  const targets: Entity[] = [];
  const spot = new Map<Entity, Vec>();
  at(G, t0, () => { setCast(G, '種子彈', P3.seed.cast, '外場：被點的人放平臺 3／9 點；內場：放面向平臺的直條中段（同角兩顆時 H>D>T 優先的人補到空角），放完立刻離開那格'); busy(G, tR + 3); });
  at(G, tM, () => {
    SIDES.forEach((side) => {
      const outs = outers(G, side), picked = G.rng.shuffle(outs).slice(0, 2);
      picked.forEach((e, i) => { targets.push(e); spot.set(e, rel(side, ...SEED_OUT[i])); });
      outs.filter((e) => !picked.includes(e)).forEach((e, i) => spot.set(e, rel(side, ...OTHER_OUT[i % 4])));
    });
    // 內場 4 人：一側上下兩角各 1 人；另一側上或下其中一角 2 人（同角兩顆時照 H > D > T 由排前面的人補到同側空著的那角）
    const westFull = G.rng.chance(0.5), northDouble = G.rng.chance(0.5);
    const full = westFull ? [0, 2] : [1, 3], dbl = westFull ? (northDouble ? 1 : 3) : (northDouble ? 0 : 2);
    const empty = dbl === 0 ? 2 : dbl === 1 ? 3 : dbl === 2 ? 0 : 1;
    const goal = new Map<Entity, Cell>();
    full.forEach((k) => { const m = cornerMembers(G, k); if (m.length) goal.set(G.rng.pickOne(m), seedCell(k)); });
    const PRI: Record<string, number> = { heal: 0, dps: 1, tank: 2 };
    const two = G.rng.shuffle(cornerMembers(G, dbl)).slice(0, 2).sort((a, b) => PRI[roleType(roleE(a))] - PRI[roleType(roleE(b))]);
    if (two.length === 2) {
      // 直條只有一格寬：排前面的人要穿過另一個被點的人才到得了空角時（會卡住），兩人互換目標
      const ca = cellUnder(two[0]), cb = cellUnder(two[1]);
      const via = ca && cellPath(ca, seedCell(empty), (x) => cellGone(G.p2!, x) || cellThorn(G.p2!, x));
      const viaB = cb && cellPath(cb, seedCellAlt(dbl), (x) => cellGone(G.p2!, x) || cellThorn(G.p2!, x));
      if ((via && cb && via.includes(cb)) || (viaB && ca && viaB.includes(ca))) two.reverse();
      goal.set(two[0], seedCell(empty)); goal.set(two[1], seedCellAlt(dbl));
    }
    else if (two.length === 1) goal.set(two[0], seedCell(dbl));
    goal.forEach((c, e) => { targets.push(e); spot.set(e, center(c)); });
    // 讓路：沒被點的 Bot 先離開被點的人要走的格子（放完要立刻離開，放置格旁邊也空著）；被點的 Bot 再走過去
    sendTo(G, goal, tLock, neighbors);
    targets.forEach((e) => { e.mark = { kind: 'seed', until: tR }; });
    G.ents.forEach((e) => { if (isBot(G, e) && !e.dead && zoneE(e) !== 'in' && spot.has(e)) { e.mt = spot.get(e)!; e.buffs.sprint = G.t + 4; } });
    const P = G.player;
    if (targets.includes(P)) alertMsg(G, '你被點了種子彈', 2, true);
    if (G.cfg.hint && !G.auto && spot.has(P)) G.hints = [{ ...spot.get(P)!, r: 1.2, label: targets.includes(P) ? '放種子' : '離開種子' }];
  });
  const locked = new Map<Entity, Vec>();
  at(G, tLock, () => targets.forEach((e) => {
    if (e.dead) return;
    locked.set(e, { x: e.x, y: e.y });
    G.tele.push({ k: 'circle', x: e.x, y: e.y, r: P3.seed.r, until: tR });
  }));
  at(G, tR, () => {
    G.hints = [];
    const s = G.p2!;
    const thorns = [...s.thorns];
    let mineOk = true;
    locked.forEach((p, owner) => {
      owner.mark = undefined;
      G.ents.forEach((e) => {
        if (e === owner || e.dead || !hitCircle(e, p, P3.seed.r)) return;
        if (e.isPlayer) mineOk = false;
        failE(G, e, tag, '被別人的種子彈打中', { ...(spot.get(e) ?? homeE(e)), r: 1.2, label: '離開種子' });
      });
      const c = cellUnder(p);
      thorns.push({ x: p.x, y: p.y, cell: c ? c.idx : -1, owner: entIndex(G, owner), since: G.t + P3.seed.grace });
    });
    // 荊棘太近：大爆炸
    for (let i = 0; i < thorns.length; i++) for (let j = i + 1; j < thorns.length; j++) {
      if (dist(thorns[i], thorns[j]) >= P3.seed.boom) continue;
      [thorns[i], thorns[j]].forEach((t) => { const o = G.ents[t.owner]; if (!o.dead) failE(G, o, tag, '荊棘放太近，一起大爆炸'); });
    }
    s.thorns = thorns;
    const P = G.player;
    if (locked.has(P) && !P.dead) good(G, tag, '放下種子，沒有打到人', { ...spot.get(P)!, r: 1.2, label: '放種子的位置' });
    else if (mineOk && !P.dead && spot.has(P)) good(G, tag, '沒被種子彈打中');
  });
  // 內場的主人立刻走回旁邊的座位（荊棘 1 秒後就佔格）；其他人之後再回座位
  at(G, tR + 0.02, () => locked.forEach((_p, o) => {
    if (!isBot(G, o) || o.dead) return;
    o.buffs.sprint = G.t + 2;
    if (zoneE(o) !== 'in') { o.mt = homeE(o); return; }
    // 內場：走到旁邊沒人的格子（荊棘 1 秒後佔格）
    const home = homeE(o), cur = cellUnder(o), free = cur ? neighbors(cur).sort((a, b) => dist(center(a), home) - dist(center(b), home)).find((n) => !G.p2!.thorns.some((t) => t.cell === n.idx) && !G.ents.some((x) => x !== o && !x.dead && cellsTouching(x).includes(n))) : undefined;
    p2Goto(G, o, free ? center(free) : homeE(o));
  }));
  allSettle(G, tR + 1.2);
  thornWatch(G, tR + P3.seed.grace, tR + 60);
  return tR;
}

/** 站在荊棘裡（刺傷）：每人只記一次 */
function thornWatch(G: GameState, from: number, until: number): void {
  const hurt = new Set<Entity>();
  for (let t = from; t < until; t += 0.5) {
    at(G, t, () => {
      if (!G.p2 || !G.p2.thorns.length) return;
      G.ents.forEach((e) => {
        if (e.dead || hurt.has(e)) return;
        if (G.p2!.thorns.some((th) => G.t >= th.since && hitCircle(e, th, P3.seed.thornR))) {
          hurt.add(e);
          failE(G, e, '暗之荊棘', '站在暗之荊棘裡（刺傷）');
        }
      });
    });
  }
}

/** 荊棘叢生的拉線點（以東、南為正）：外場荊棘拉到近的點、內場荊棘拉到遠的點 */
const PULL_PT: Record<'outer' | 'inner', Vec> = { outer: { x: 15, y: 20 }, inner: { x: 6, y: 24.3 } };

/** 內場連線的人要去的橫條末端格 */
/** 內場連線的人要去的直條末端格：同一側上下兩角一對，上面的跑到上端、下面的跑到下端（約 7 格） */
const pairEnd = (west: boolean, north: boolean): Cell => cellAt(west ? 1 : 6, north ? 0 : 7)!;
/** 這一對是西邊還是東邊（看兩人的連線位置） */
const pairWest = (pr: [Entity, Entity]): boolean => pr[0].x + pr[1].x < 0;

export function thornTether(G: GameState, t0: number): number {
  const tag = '荊棘叢生';
  seqAdd(G, t0, '荊棘叢生（小王）');
  const tL = t0 + P3.thorn.cast, tCheck = tL + P3.thorn.dur - P3.thorn.warnLeft;
  const pulls: { thorn: Vec; who: Entity; to: Vec }[] = [];
  const pairs: [Entity, Entity][] = [];
  at(G, t0, () => {
    setCast(G, '荊棘叢生', P3.thorn.cast, '荊棘連線最近的人：外場沿環狀地板拉遠；內場兩人各跑到橫條兩端');
    say(G, '生於黑暗之物正在操縱暗之植物……', 3);
    busy(G, tCheck + 2);
  });
  at(G, tL, () => {
    const s = G.p2!;
    SIDES.forEach((side) => {
      const mine = s.thorns.filter((t) => Math.sign(t.x) === side);
      const roles = { north: ['H2', 'D2'], south: ['D3', 'D4'] };
      (['north', 'south'] as const).forEach((ns) => {
        const ys = ns === 'north' ? -1 : 1;
        const th = mine.filter((t) => Math.sign(t.y || 0.01) === ys).sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
        th.forEach((t, i) => {
          const who = outers(G, side).find((e) => roleE(e) === roles[ns][i]);
          if (!who) return;
          const p = PULL_PT[t.cell >= 0 ? 'inner' : 'outer'];
          pulls.push({ thorn: { x: t.x, y: t.y }, who, to: { x: side * p.x, y: ys * p.y } });
        });
      });
    });
    // 內場：西邊一對（西北＋西南）、東邊一對（東北＋東南），沿直條往上下兩端拉開。
    // 依「現在站在哪一角」選人（放完種子的人可能在別的角落），而且要走得到直條末端（不被荊棘擋住）
    const goals = new Map<Entity, Cell>();
    ([[0, 2], [1, 3]] as const).forEach(([a, b]) => {
      const west = a === 0;
      const pick = (k: number, north: boolean): Entity | undefined => {
        const end = cellAt(west ? 1 : 6, north ? 0 : 7)!;
        const ok = inners(G).filter((e) => {
          const c = cellUnder(e);
          return c && cornerOfCell(c) === k && !goals.has(e) && cellPath(c, end, (x) => cellGone(s, x) || cellThorn(s, x));
        });
        return ok.length ? G.rng.pickOne(ok) : undefined;
      };
      const ea = pick(a, true), eb = pick(b, false);
      if (!ea || !eb) return;
      pairs.push([ea, eb]);
      goals.set(ea, pairEnd(west, true));
      goals.set(eb, pairEnd(west, false));
    });
    at(G, G.t + 0.3, () => sendTo(G, goals, tCheck));
    s.links = [
      ...pulls.map((p) => ({ x: p.thorn.x, y: p.thorn.y, a: entIndex(G, p.who), until: tCheck })),
      ...pairs.map(([a, b]) => ({ a: entIndex(G, a), b: entIndex(G, b), until: tCheck })),
    ];
    pulls.forEach((p) => { if (isBot(G, p.who)) ringWalk(G, p.who, p.to, G.t + 0.3); });
    const P = G.player, myPull = pulls.find((p) => p.who === P), myPair = pairs.find((p) => p.includes(P));
    if (myPull || myPair) alertMsg(G, '你被荊棘叢生連線：拉遠', 2.2, true);
    if (G.cfg.hint && !G.auto) {
      if (myPull) G.hints = [{ ...myPull.to, r: 1.5, label: '沿環狀地板拉遠' }];
      if (myPair) G.hints = [{ ...center(goals.get(P)!), r: 1.2, label: '跑到直條末端' }];
    }
  });
  at(G, tCheck, () => {
    G.hints = [];
    const s = G.p2!;
    pulls.forEach((p) => {
      if (p.who.dead) return;
      const d = dist(p.who, p.thorn), fix = { ...p.to, r: 1.5, label: '沿環狀地板拉遠' };
      if (d < P3.thorn.pull) failE(G, p.who, tag, `沒拉斷荊棘（只拉開 ${d.toFixed(1)} m）`, fix);
      else if (p.who.isPlayer) good(G, tag, `拉斷荊棘（${d.toFixed(1)} m）`, fix);
    });
    pairs.forEach(([a, b]) => {
      if (a.dead || b.dead) return;
      const d = dist(a, b);
      [a, b].forEach((e) => {
        const fix = { ...center(pairEnd(pairWest([a, b]), e === a)), r: 1.2, label: '跑到直條末端' };
        if (d < P3.thorn.pair) failE(G, e, tag, `內場連線沒拉斷（相距 ${d.toFixed(1)} m）`, fix);
        else if (e.isPlayer) good(G, tag, `內場連線拉斷（相距 ${d.toFixed(1)} m）`, fix);
      });
    });
    s.links = [];
    s.thorns = [];
  });
  allSettle(G, tCheck + 0.1);
  // 外場拉線的人沿環狀地板走回來
  at(G, tCheck + 0.2, () => pulls.forEach((p) => { if (isBot(G, p.who) && !p.who.dead) ringWalk(G, p.who, homeE(p.who), G.t); }));
  return tCheck;
}

/** 小王暗之泛濫：可打斷；外場 MT 插言 */
export function sbDeluge(G: GameState, t0: number): number {
  const tag = '小王暗之泛濫';
  seqAdd(G, t0, '暗之泛濫（小王，打斷）');
  const tR = t0 + P3.sbDeluge.cast;
  const P = G.player, mine = (): boolean => zoneE(P) !== 'in' && roleE(P) === 'MT' && !P.dead;
  at(G, t0, () => {
    setCast(G, '暗之泛濫（小王）', P3.sbDeluge.cast, '外場 MT 用插言打斷（技能列的插言）');
    if (mine()) alertMsg(G, '打斷小王的暗之泛濫（插言）', 2.5, true);
  });
  // 打斷：玩家按插言（任何人按都算），或外場 MT 是 Bot 時約 2 秒後由 Bot 打斷；示範模式玩家也由 Bot 代按
  let cut = false;
  const interrupt = (who: string): void => {
    if (cut) return;
    cut = true;
    if (G.cast && G.cast.name === '暗之泛濫（小王）') G.cast = null;
    alertMsg(G, `${who}打斷了小王的暗之泛濫`, 2);
    if (mine()) good(G, tag, '用插言打斷了小王的暗之泛濫');
  };
  for (let t = t0 + 0.1; t <= tR; t += 0.1) {
    at(G, t, () => {
      if (cut) return;
      const li = G.lastInterject ?? -99;
      if (li >= t0 && li <= G.t) interrupt('你');
      else if (G.t >= t0 + 2 && (G.auto || !mine())) { if (G.auto && mine()) G.lastInterject = G.t; interrupt(mine() ? '你' : '外場 MT '); }
    });
  }
  at(G, tR + 0.01, () => {
    if (cut) return;
    // 沒打斷：全場 AOE＋持續傷害
    G.fx.push({ k: 'flash', until: G.t + 0.6 });
    G.ents.forEach((e) => { if (!e.dead) e.buffs.bleed = G.t + 15; });
    alertMsg(G, '沒打斷：小王的暗之泛濫全場 AOE＋持續傷害', 2.5, true);
    if (mine()) bad(G, tag, '沒有打斷小王的暗之泛濫（全場 AOE＋持續傷害）');
  });
  return tR;
}
