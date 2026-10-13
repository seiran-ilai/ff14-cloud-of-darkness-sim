// 練習項目和目前座位的關係：跟你無關的機制在按鈕列變淡（還是可以點）
import { zoneOf } from '../core/p2';
import type { Alliance, Role } from '../core/constants';

/** 跟座位無關的話回傳原因（給按鈕的提示文字）；有關回傳 null */
export function unrelated(key: string, al: Alliance, role: Role): string | null {
  const z = zoneOf(al, role), inner = z === 'in', outerMT = !inner && role === 'MT';
  switch (key) {
    case 'p3curse': return inner ? '波動詛咒只上在外場，你在內場' : null;
    case 'p3interrupt': return outerMT ? null : '只有外場 MT 要用插言打斷';
    case 'p3impale': return inner ? '磔殺只打外場（外場 MT 吃死刑，其他人退開）' : null;
    case 'p2grid': return inner ? null : '你在外場，沒有格子';
    default: return null;
  }
}

/** P3 華容道的座位說明（顯示在職能旁邊） */
export function seatText(al: Alliance, role: Role): string {
  const z = zoneOf(al, role);
  if (z !== 'in') return `P3：${z < 0 ? '西平臺' : '東平臺'}`;
  const corner = ({ 'A-H1': '西北', 'A-ST': '西北', 'B-D1': '西北', 'C-H1': '東北', 'C-ST': '東北', 'B-D2': '東北', 'B-D3': '西南', 'B-MT': '西南', 'B-H1': '西南', 'B-D4': '東南', 'B-ST': '東南', 'B-H2': '東南' } as Record<string, string>)[`${al}-${role}`];
  return `P3：內場・${corner}角`;
}
