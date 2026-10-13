// 隨機練習的設定（顯示在右側說明卡）：重複／不重複、分鐘數、機制勾選樹（全選 → 階段 → 單一機制）
import type { Config } from '../core/config';
import { CATALOG, PHASE_LABEL, type MechPhase } from '../drills/catalog';
import { randKey, type RandOpts } from '../drills/random';
import { unrelated } from '../drills/relevance';
import type { Session } from '../game/session';
import { seg } from './dom';
import { pickDrill } from './topbar';

export function randPanelHtml(o: RandOpts, cfg: Config): string {
  const on = new Set(o.ids);
  const groups = (['p1', 'p2', 'p3'] as MechPhase[]).map((ph) => {
    const items = CATALOG.filter((m) => m.phase === ph);
    return `<div class="mgroup" data-g="${ph}"><label class="mph"><input type="checkbox" data-ph="${ph}"> ${PHASE_LABEL[ph]}</label>
      <div class="mitems">${items.map((m) => {
        const why = unrelated(m.id, cfg.al, cfg.role);
        return `<label${why ? ` class="dim" title="${why}"` : ''}><input type="checkbox" data-id="${m.id}" ${on.has(m.id) ? 'checked' : ''}> ${m.name}</label>`;
      }).join('')}</div></div>`;
  }).join('');
  return `<div class="set"><span class="lbl">重複</span><span class="grp" id="rRep"></span></div>
    <div class="set"><span class="lbl">時間</span><span class="grp" id="rMins"></span></div>
    <div class="mtree" id="rTree"><label class="mall"><input type="checkbox" data-all> 全選</label>${groups}</div>`;
}

export function bindRandPanel(session: Session, o: RandOpts): void {
  const cfg = session.cfg;
  const pick = (patch: Partial<Config['rand']>): void => {
    Object.assign(cfg.rand, { repeat: o.repeat, mins: o.mins, ids: o.ids }, patch);
    pickDrill(session, randKey({ repeat: cfg.rand.repeat, mins: cfg.rand.mins, ids: cfg.rand.ids }));
  };
  seg(document.getElementById('rRep')!, ['r', 'n'], o.repeat ? 'r' : 'n', (v) => pick({ repeat: v === 'r' }), (v) => (v === 'r' ? '重複' : '不重複'));
  seg(document.getElementById('rMins')!, [1, 2, 3, 4, 5], o.mins, (v) => pick({ mins: Number(v) }), (v) => `${v} 分鐘`);
  const tree = document.getElementById('rTree')!;
  const boxes = (sel: string): HTMLInputElement[] => [...tree.querySelectorAll<HTMLInputElement>(sel)];
  const sync = (): void => {
    const set = (box: HTMLInputElement, items: HTMLInputElement[]): void => {
      const n = items.filter((b) => b.checked).length;
      box.checked = n === items.length;
      box.indeterminate = n > 0 && n < items.length;
    };
    boxes('[data-ph]').forEach((b) => set(b, boxes(`.mgroup[data-g="${b.dataset.ph}"] [data-id]`)));
    set(boxes('[data-all]')[0], boxes('[data-id]'));
  };
  sync();
  tree.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.all !== undefined) boxes('[data-id]').forEach((b) => { b.checked = t.checked; });
    else if (t.dataset.ph) boxes(`.mgroup[data-g="${t.dataset.ph}"] [data-id]`).forEach((b) => { b.checked = t.checked; });
    let ids = boxes('[data-id]').filter((b) => b.checked).map((b) => b.dataset.id!);
    // 至少留一個機制
    if (!ids.length) ids = [CATALOG[0].id];
    pick({ ids });
  };
}
