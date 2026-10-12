/*
 * 飆風（castLen = 0 代表超賦後無讀條）
 * 時間點（相對 t0）：0 台詞＋詠唱、中央風球與藍圈；tR = t0 + castLen（無讀條則 t0 + storedDelay）判定；tR+0.9 結算擊退結果。
 * 判定規則：判定圈碰到藍圈（blueR）→ 高傷害（非致命失誤）；沒開防擊退的人從中心往外擊退 kbDist。
 *   被擊退出場即掉落（由模擬迴圈判定致命）。開防擊退或留在場上算成功。
 * 估計值：藍圈 6 m、擊退 16 m／0.6 秒、無讀條延遲 2 秒（見 tuning.ts AERO）。
 */
import { O0 } from '../core/constants';
import { dist, inArena, angOf } from '../core/geometry';
import { hitCircle } from '../core/hit';
import { DIRNAME } from '../core/format';
import { AERO } from '../core/tuning';
import { at, setCast, say, alertMsg, seqAdd, hasBuff, force, type Fix, type GameState } from '../game/state';
import { good, hurtPlayer, botHit } from '../game/results';
import { claim, npcHome, npcs } from '../game/bots';

export function aero(G: GameState, t0: number, castLen: number): number {
  const me = claim(G, t0);
  const tag = castLen ? '飆風' : '飆風（超賦）';
  if (castLen) seqAdd(G, t0, '飆風');
  const tR = castLen ? t0 + castLen : t0 + AERO.storedDelay;
  const P = G.player;
  const fix = (): Fix => (castLen ? { x: P.x < 0 ? -8 : 8, y: 0, r: 1.4, label: '藍圈外正東／正西' } : { x: P.x, y: P.y, r: 1.2, label: '開防擊退（或站在被擊退後仍在場內的位置）' });
  at(G, t0, () => {
    if (castLen) { say(G, '黑暗之風，將一切送入無！', 3.5); setCast(G, '飆風', castLen); }
    else { alertMsg(G, '雲之魔刃：飆風', 1.8, true); G.stored = null; }
    G.extra.orb = 'aero';
    G.tele.push({ k: 'blue', x: 0, y: 0, r: AERO.blueR, until: tR });
    if (castLen) {
      // Bot：站藍圈外正東／正西
      npcs(G).forEach((e) => { const s = e.x < 0 ? -1 : 1; e.mt = { x: s * G.rng.rnd(7, 8.5), y: G.rng.rnd(-1, 1) }; });
      G.hints = [{ x: -8, y: 0, r: 1.4 }, { x: 8, y: 0, r: 1.4 }];
    } else {
      // Bot：超賦後來不及跑位，開防擊退
      npcs(G).forEach((e) => { e.buffs.akb = tR + 1; });
      G.hints = [];
    }
  });
  let akb = false;
  at(G, tR, () => {
    G.extra.orb = null;
    G.hints = [];
    akb = hasBuff(G, P, 'akb');
    if (!P.dead && hitCircle(P, O0, AERO.blueR)) hurtPlayer(G, tag, '站在藍圈內，吃到高額傷害', false, fix());
    G.ents.forEach((e) => {
      if (e.dead) return;
      if (!e.isPlayer && hitCircle(e, O0, AERO.blueR)) botHit(G, e, tag, '站在藍圈內');
      if (hasBuff(G, e, 'akb')) return;
      const d = dist(e, O0);
      let vx: number, vy: number;
      if (d < 0.01) { const a = G.rng.rnd(0, 6.28); vx = Math.sin(a); vy = -Math.cos(a); } else { vx = e.x / d; vy = e.y / d; }
      force(e, vx, vy, AERO.kbDist, AERO.kbTime);
    });
    G.fx.push({ k: 'kb', until: G.t + 0.7 });
  });
  at(G, tR + 0.9, () => {
    if (P.dead) return;
    if (akb) good(G, tag, '開了防擊退，沒被擊退', fix());
    else if (inArena(P.x, P.y) && !((P.fellAt ?? -Infinity) > tR)) good(G, tag, `被擊退到${DIRNAME(angOf(P.x, P.y))}，留在場上`, fix());
  });
  npcHome(G, tR + 1.2, me);
  return tR + 1.2;
}
