/*
 * 陰冷擁抱
 * 時間點（相對 t0）：0 開始詠唱（心臟出現）；+cast 上減益，兩批各 12 人；
 *   每批在 E = t0 + cast + 減益秒數 結束：E−poseLead 王擺手勢、E−warnAt 提示、E−heavyAt 加重、
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
import { at, setCast, say, alertMsg, seqAdd, type Entity, type EmbraceType, type Fix, type GameState } from '../game/state';
import { good, bad, hurtPlayer, botHit } from '../game/results';
import { isBot } from '../game/bots';

export interface EmbraceOpts {
  /** 第二次詠唱：依第一次的分組分配（見下方 TODO） */
  after?: Entity[][];
  /** 單練：玩家那批判定完就結束 */
  endOnMine?: boolean;
}

export const EMBRACE_NAME: Record<EmbraceType, string> = { scoop: '撈起', cover: '包覆' };

/** 減益結束時的正確面向：撈起面向外、包覆面向場內 */
export const embraceFace = (type: EmbraceType, p: Vec): number => (type === 'scoop' ? angOf(p.x, p.y) : angOf(p.x, p.y) + Math.PI);

/**
 * 一次詠唱，兩批各 12 人，手勢相反；durs 由短到長。回傳分組（groups[i] 拿 durs[i]）。
 * 第二次詠唱傳入 after = 第一次的分組：第一次拿短的人，第二次拿長的（docs 第 2 節的模擬器假設）。
 */
export function embraceCast(G: GameState, t0: number, durs: number[], opt: EmbraceOpts = {}): Entity[][] {
  const t1: EmbraceType = G.rng.chance(0.5) ? 'scoop' : 'cover';
  const types: EmbraceType[] = [t1, t1 === 'scoop' ? 'cover' : 'scoop'];
  const all = G.rng.shuffle(G.ents);
  // TODO(確認): docs 標【未知】的人員分配；目前照 docs 假設「第一次拿短的人，第二次拿長的」
  const groups = opt.after ? [opt.after[1], opt.after[0]] : [all.slice(0, 12), all.slice(12)];
  seqAdd(G, t0, '陰冷擁抱（上減益）');
  at(G, t0, () => { setCast(G, '陰冷擁抱', EMBRACE.cast); G.extra.heart = true; say(G, '（暗黑之雲身前浮現一顆心臟）', 3); });

  durs.forEach((dur, wi) => {
    const members = groups[wi], type = types[wi], apply = t0 + EMBRACE.cast, E = apply + dur, tag = `陰冷擁抱 ${dur}s`;
    const mine = members.includes(G.player);
    seqAdd(G, E, `攥魂之手（${dur}s・${EMBRACE_NAME[type]}）${mine ? '← 你' : ''}`, true);
    G.poses.push({ type, from: E - EMBRACE.poseLead, to: E + 0.3 });
    const P = G.player;
    const fix = (): Fix => ({ ...P.spot, r: 1.4, face: embraceFace(type, P.spot), label: type === 'scoop' ? '外周・面向外' : '外周・面向場內' });

    at(G, apply, () => {
      members.forEach((e) => e.embs.push({ exp: E, type }));
      G.fx.push({ k: 'tether', members, until: G.t + 2 });
      if (mine) alertMsg(G, `你被附加了 ${dur} 秒的暗之擁抱`, 2);
    });
    at(G, E - 8, () => { if (mine) G.embHint = { ...P.spot, r: 1.4, label: '到外周處理' }; });
    // Bot：提前 6 秒開疾跑去外周（覆蓋其他機制的跑位）
    at(G, E - 6, () => members.forEach((e) => { if (isBot(G, e)) { e.ov = { ...e.spot, emb: E }; e.buffs.sprint = G.t + 5; } }));
    at(G, E - EMBRACE.warnAt, () => {
      if (!mine) return;
      alertMsg(G, '攥魂之手即將出現', 2.2, true);
      G.embHint = { ...P.spot, r: 1.4, label: type === 'scoop' ? '結束時面向外，手出現後往內走' : '面向場內，往內走' };
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
          good(G, tag, `手勢：${type === 'scoop' ? '下方撈起（手與你同向，從背後打）' : '上方包覆（手與你反向，從面前打）'}`, fix());
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
  return groups;
}
