// 指定隨機練習：從選的機制裡隨機抽，一個接一個（不同場地會瞬間切換），練快速反應。
// 練習項目 key：rand:<r|n>:<分鐘>:<機制 id,…>（r＝可重複、n＝不重複；不重複時機制用完就提前結束）
import type { Drill } from '../game/state';
import { at, seqAdd } from '../game/state';
import { CATALOG, catalogById, setField, type Field } from './catalog';
import { singles } from './singles';
import { P3_INFO } from './p3singles';

export const RAND_PREFIX = 'rand:';

export interface RandOpts { repeat: boolean; mins: number; ids: string[] }

export const randKey = (o: RandOpts): string => `${RAND_PREFIX}${o.repeat ? 'r' : 'n'}:${o.mins}:${o.ids.join(',')}`;

export function parseRand(key: string): RandOpts | null {
  const m = /^rand:([rn]):([1-5]):(.*)$/.exec(key);
  if (!m) return null;
  const ids = m[3].split(',').filter((id) => catalogById(id));
  return { repeat: m[1] === 'r', mins: Number(m[2]), ids: ids.length ? ids : CATALOG.map((c) => c.id) };
}

/** 換機制之間的空檔（秒）；換場地時多等一下 */
const GAP = 1.5, FIELD_GAP = 2.5;

export function makeRandDrill(o: RandOpts): Drill {
  const names = o.ids.map((id) => catalogById(id)!.name);
  return {
    tl: true,
    name: `隨機練習・${o.mins} 分鐘`,
    sub: `${o.repeat ? '可重複' : '不重複'}・${o.ids.length} 種機制`,
    brief: `從選的機制隨機抽、一個接一個出（${o.repeat ? '可以重複' : '不重複，用完就提前結束'}），練換機制時的快速反應；不同場地的機制會瞬間切換場地。`
      + `<p class="bnote">${names.length} 種機制：${names.join('、')}</p>`,
    info: [...new Set(o.ids.flatMap((id) => (id === 'p1blade' ? ['暗之刃'] : singles[id]?.info ?? P3_INFO[id]?.info ?? [])))],
    setup(G) {
      const limit = o.mins * 60;
      let t = 1, field: Field | null = null, last = '';
      const left = [...o.ids];
      while (t < limit) {
        const pool = o.repeat ? (o.ids.length > 1 ? o.ids.filter((id) => id !== last) : o.ids) : left;
        if (!pool.length) break;
        const id = G.rng.pickOne(pool);
        if (!o.repeat) left.splice(left.indexOf(id), 1);
        const m = catalogById(id)!;
        if (m.field !== field) {
          setField(G, t, m.field);
          if (field !== null) t += FIELD_GAP;
          field = m.field;
        }
        seqAdd(G, t, `【${m.name}】`);
        t = m.seg(G, t) + GAP;
        last = id;
      }
      at(G, t, () => { G.endT = G.t; });
    },
  };
}
