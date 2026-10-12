/*
 * 黑暗神聖
 * 時間點（相對 t0）：0 開始詠唱、點名 6 名補師；+cast 判定 6 處分攤。
 * 判定規則：判定圈要整個在自己聯盟、自己小隊（前排 MT 組／後排 ST 組）的分攤圈 stackR 內。
 *   例外：剛丟完 B 聯盟（南）核爆的 MT 組玩家站進 B 後排 → 只給提醒（攻略允許靠減傷 3:5 吃）。
 * 估計值：詠唱 4 秒、分攤圈半徑 3.2 m（見 tuning.ts HOLY）。
 */
import { ALS, partyOf, type Party } from '../core/constants';
import { dist } from '../core/geometry';
import { HOLY } from '../core/tuning';
import { HOLY_SPOT } from '../core/positions';
import { at, setCast, seqAdd, type Entity, type GameState } from '../game/state';
import { good, bad, warn, botHit } from '../game/results';
import { claim, npcHome, npcs } from '../game/bots';

const partyName = (p: Party): string => (p === 'MT' ? '前排（MT 組）' : '後排（ST 組）');

export function holy(G: GameState, t0: number): number {
  const me = claim(G, t0);
  const tag = '黑暗神聖';
  seqAdd(G, t0, '黑暗神聖');
  /** 剛丟完 B 核爆的人改進 B 後排 */
  const bFlare = (): Entity | undefined => (G.extra.flare && G.t - (G.extra.flareT ?? -99) < 6 ? G.extra.flare.B : undefined);
  at(G, t0, () => {
    setCast(G, '黑暗神聖', HOLY.cast);
    G.extra.holy = true;
    const bF = G.extra.flare && G.extra.flare.B;
    npcs(G).forEach((e) => {
      const s = HOLY_SPOT(e.al, e === bF ? 'ST' : partyOf(e.role));
      e.mt = { x: s.x + G.rng.rnd(-1.2, 1.2), y: s.y + G.rng.rnd(-1, 1) };
    });
    const P = G.player;
    G.hints = [{ ...HOLY_SPOT(P.al, partyOf(P.role)), r: 2.6, label: `${P.al} ${partyOf(P.role)}組` }];
  });
  at(G, t0 + HOLY.cast, () => {
    G.extra.holy = false;
    G.hints = [];
    const P = G.player;
    ALS.forEach((al) => (['MT', 'ST'] as const).forEach((p) => { const s = HOLY_SPOT(al, p); G.fx.push({ k: 'stack', x: s.x, y: s.y, until: G.t + 0.7 }); }));
    const bF = bFlare();
    G.ents.forEach((e) => {
      if (e.isPlayer || e.dead) return;
      const ok = [partyOf(e.role), ...(e === bF ? ['ST' as const] : [])].some((p) => dist(e, HOLY_SPOT(e.al, p)) <= HOLY.stackR);
      if (!ok) botHit(G, e, tag, '沒進分攤');
    });
    if (P.dead) return;
    const party = partyOf(P.role), s = HOLY_SPOT(P.al, party), d = dist(P, s);
    const fix = { ...s, r: HOLY.stackR, label: `${P.al} 聯盟${partyName(party)}` };
    // TODO(確認): legacy 只對 B 聯盟（6 秒內丟過核爆）開例外；A／C 的核爆玩家是否也允許換排，未定
    if (bF === P && party === 'MT' && dist(P, HOLY_SPOT('B', 'ST')) <= HOLY.stackR) {
      warn(G, tag, '剛丟完南邊核爆來不及進前排，改進後排（攻略允許微調，靠減傷 3:5 吃）', fix);
      return;
    }
    if (d <= HOLY.stackR) good(G, tag, `進了 ${P.al} 聯盟${partyName(party)}的分攤`, fix);
    else bad(G, tag, `沒進 ${P.al} 聯盟${partyName(party)}的分攤`, fix);
  });
  npcHome(G, t0 + 4.4, me);
  return t0 + 4.5;
}
