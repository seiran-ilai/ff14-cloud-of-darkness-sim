/*
 * 陰冷擁抱
 * 時間點（相對 t0）：0 開始詠唱（心臟出現、王擺手勢到詠唱結束）；+cast 上減益給 12 人（再分兩批各 6 人、秒數不同）；
 *   兩次詠唱各 12 人，合起來剛好 24 人，每人只會拿到一次暗之擁抱；兩次的手勢一定相反。
 *   王放招時不會再擺手勢，要記住自己上減益時看到的手勢。
 *   每批在 E = t0 + cast + 減益秒數 結束：E−8 提示去外周（附上手勢）、E−warnAt 提示、E−heavyAt 加重、
 *   E 在每人位置生成攥魂之手、E+handDelay 判定矩形。
 * 判定規則：撈起＝手與玩家同向（從背後打）；包覆＝手與玩家反向（從面前打）。
 *   只看減益結束那一刻的面向。手要朝場外（與「離中心方向」差 < 60°），要在外周處理（離場邊 ≤ edgeOk）。
 *   被任何人的手打到＝死亡宣告（致命）；自己的手打到隊友算失誤。
 * 估計值：矩形寬 4 m、起點在身後 1.5 m、生成後 1.25 秒判定、詠唱 3 秒（見 tuning.ts EMBRACE）。
 */
import { dirV, angOf, angDiff, edgeDist } from '../core/geometry';
import { DIRNAME } from '../core/format';
import { hitRect } from '../core/hit';
import { EMBRACE } from '../core/tuning';
import type { Vec } from '../core/constants';
import { at, setCast, say, alertMsg, seqAdd, embraceLine, EMBRACE_TEXT, type Entity, type EmbraceType, type Fix, type GameState } from '../game/state';
import { good, bad, hurtPlayer, botHit } from '../game/results';
import { isBot } from '../game/bots';

/** 一次詠唱的結果：groups[i] 拿 durs[i]，整次同一個手勢 */
export interface EmbraceCast { groups: Entity[][]; type: EmbraceType }

export interface EmbraceOpts {
  /** 第二次詠唱：傳入第一次的結果，這次給剩下沒拿到減益的 12 人、手勢相反 */
  after?: EmbraceCast;
  /** 單練：確保玩家在這次的 12 人裡 */
  withPlayer?: boolean;
  /** 單練：玩家那批判定完就結束 */
  endOnMine?: boolean;
}

export const EMBRACE_NAME: Record<EmbraceType, string> = { scoop: '撈起', cover: '包覆' };

/** 減益結束時的正確面向：撈起面向外、包覆面向場內 */
export const embraceFace = (type: EmbraceType, p: Vec): number => (type === 'scoop' ? angOf(p.x, p.y) : angOf(p.x, p.y) + Math.PI);

/**
 * 一次詠唱給 12 人、同一個手勢，再分兩批各 6 人；durs 由短到長（groups[i] 拿 durs[i]）。
 * 第二次詠唱傳入 after = 第一次的結果，給剩下的 12 人（每人只拿一次），手勢相反。
 */
export function embraceCast(G: GameState, t0: number, durs: number[], opt: EmbraceOpts = {}): EmbraceCast {
  const type: EmbraceType = opt.after ? (opt.after.type === 'scoop' ? 'cover' : 'scoop') : G.rng.chance(0.5) ? 'scoop' : 'cover';
  const taken = new Set(opt.after?.groups.flat() ?? []);
  const pool = G.rng.shuffle(G.ents.filter((e) => !taken.has(e)));
  if (opt.withPlayer && pool.includes(G.player)) pool.sort((a, b) => Number(b === G.player) - Number(a === G.player));
  const picked = pool.slice(0, 12);
  const groups = [picked.slice(0, 6), picked.slice(6)];
  const apply = t0 + EMBRACE.cast, T = EMBRACE_TEXT[type];
  seqAdd(G, t0, '陰冷擁抱（上減益）');
  // 王只在詠唱、上減益時擺手勢；放招時不擺，要自己記住
  G.poses.push({ type, from: t0, to: apply });
  at(G, t0, () => { setCast(G, '陰冷擁抱', EMBRACE.cast, `看王的手勢：${embraceLine(type)}`); G.extra.heart = true; say(G, '（暗黑之雲身前浮現一顆心臟）', 3); });

  durs.forEach((dur, wi) => {
    const members = groups[wi], E = apply + dur, tag = `陰冷擁抱 ${dur}s`;
    const mine = members.includes(G.player);
    seqAdd(G, E, `攥魂之手（${dur}s・${EMBRACE_NAME[type]}）${mine ? '← 你' : ''}`, true);
    const P = G.player;
    const fix = (): Fix => ({ ...P.spot, r: 1.4, face: embraceFace(type, P.spot), label: type === 'scoop' ? '外周・面向外' : '外周・面向場內' });

    at(G, apply, () => {
      members.forEach((e) => e.embs.push({ exp: E, type }));
      G.fx.push({ k: 'tether', members, until: G.t + 2 });
      if (mine) alertMsg(G, `暗之擁抱 ${dur} 秒｜記住：${T.icon} ${T.hand} → ${T.how}`, 3);
    });
    // 該去外周時提醒手勢（王放招時不會再擺）
    at(G, E - 8, () => {
      if (!mine) return;
      alertMsg(G, `去外周！你的手勢：${embraceLine(type)}`, 3.2, true);
      G.embHint = { ...P.spot, r: 1.4, label: `到外周・${T.icon} ${T.how}` };
    });
    // Bot：提前 6 秒開疾跑去外周（覆蓋其他機制的跑位）
    at(G, E - 6, () => members.forEach((e) => { if (isBot(G, e)) { e.ov = { ...e.spot, emb: E }; e.buffs.sprint = G.t + 5; } }));
    at(G, E - EMBRACE.warnAt, () => {
      if (!mine) return;
      alertMsg(G, `攥魂之手即將出現：${T.icon} ${T.how}`, 2.2, true);
      G.embHint = { ...P.spot, r: 1.4, label: `${T.icon} ${T.how}` };
    });
    // Bot：結束前 2 秒鎖定正確面向
    at(G, E - 2, () => members.forEach((e) => { if (isBot(G, e)) e.faceLock = embraceFace(type, e); }));
    at(G, E - EMBRACE.heavyAt, () => members.forEach((e) => { e.buffs.heavy = G.t + EMBRACE.heavyDur; }));

    let hands: { owner: Entity; O: Vec; H: number }[] = [];
    let my: { face: number; H: number; ed: number; outOk: boolean } | null = null;
    at(G, E, () => {
      hands = [];
      members.forEach((e) => {
        if (e.dead) return;
        const H = type === 'scoop' ? e.face : e.face + Math.PI, hv = dirV(H);
        const O = { x: e.x - hv.x * EMBRACE.handBack, y: e.y - hv.y * EMBRACE.handBack };
        hands.push({ owner: e, O, H });
        G.tele.push({ k: 'rect', O, H, len: EMBRACE.handLen, w: EMBRACE.handW, until: G.t + EMBRACE.handDelay, hand: true });
        if (isBot(G, e)) {
          // 手出現後往場內走
          e.faceLock = null;
          const v = dirV(angOf(-e.x, -e.y));
          e.ov = { x: e.x + v.x * 4, y: e.y + v.y * 4, emb: E };
        }
        if (e.isPlayer) my = { face: e.face, H, ed: edgeDist(e), outOk: angDiff(H, angOf(e.x, e.y)) < Math.PI / 3 };
      });
    });
    at(G, E + EMBRACE.handDelay, () => {
      let hitNpc = 0;
      hands.forEach((h) => {
        G.ents.forEach((e) => {
          if (e.dead || !hitRect(e, h.O, h.H, EMBRACE.handLen, EMBRACE.handW)) return;
          if (e.isPlayer) hurtPlayer(G, tag, h.owner === e ? '被自己的攥魂之手打中（死亡宣告）' : '被隊友的攥魂之手打中（死亡宣告）', true, fix());
          else {
            if (h.owner.isPlayer) hitNpc++;
            botHit(G, e, tag, h.owner === e ? '被自己的攥魂之手打中' : `被 ${h.owner.al}-${h.owner.role} 的攥魂之手打中`);
          }
        });
      });
      if (mine) {
        G.embHint = null;
        const m = my as { face: number; H: number; ed: number; outOk: boolean } | null;
        if (!m) bad(G, tag, '減益結束前已陣亡', fix());
        else {
          good(G, tag, `手勢：${T.icon} ${T.hand}・${T.other}：手出現在你${type === 'scoop' ? '後方' : '前方'}`, fix());
          if (m.ed <= EMBRACE.edgeOk) good(G, tag, `在外周處理（離場邊 ${m.ed.toFixed(1)} m）`, fix());
          else bad(G, tag, `離場邊 ${m.ed.toFixed(1)} m，沒有到外周`, fix());
          const ft = `你面向${DIRNAME(m.face)}，手朝${DIRNAME(m.H)}打`;
          if (m.outOk) good(G, tag, `${ft}（朝場外）`, fix());
          else bad(G, tag, `${ft}（朝場內）：${type === 'scoop' ? '撈起要在結束時面向外' : '包覆要在結束時面向場內'}`, fix());
          if (!P.dead && !G.fails.some((f) => f.startsWith(tag) && f.includes('攥魂之手打中'))) good(G, tag, '躲開了長方形', fix());
          if (hitNpc) bad(G, tag, `你的手打到 ${hitNpc} 名隊友`, fix());
        }
        if (opt.endOnMine) G.endT = G.t + 1.2;
      }
    });
    // Bot：判定完就放開「往內走」，回到目前機制的站位（才趕得上下一個機制）
    at(G, E + EMBRACE.handDelay + 0.2, () => members.forEach((e) => { if (isBot(G, e) && e.ov && e.ov.emb === E) e.ov = null; }));
  });
  return { groups, type };
}
