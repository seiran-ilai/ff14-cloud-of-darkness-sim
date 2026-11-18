// localStorage 包裝：codsim: 前綴；無法存取（私密視窗、Node 測試環境）時回傳預設值
// 正式版放在同一個網域的 /formal/ 底下：用另一個前綴，設定和紀錄才不會和測試版混在一起
const formal = ((): boolean => { try { return location.pathname.includes('/formal/'); } catch { return false; } })();
const PREFIX = formal ? 'codsim-formal:' : 'codsim:';

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(PREFIX + k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch {
      /* 存不了就算了 */
    }
  },
};
