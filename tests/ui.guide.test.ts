// @vitest-environment jsdom
// 機制教學頁：列表、說明（效果／預兆／應對）、動態圖會播放並循環
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let rafCb: FrameRequestCallback | null = null;
let now = 0;
const frames = (n: number): void => { for (let i = 0; i < n; i++) { now += 1000 / 60; const cb = rafCb; rafCb = null; cb?.(now); } };

function stubCtx(): unknown {
  const fn: unknown = new Proxy(function () { /* noop */ }, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : fn), apply: () => fn, set: () => true });
  return fn;
}

beforeAll(async () => {
  const html = readFileSync(resolve(__dirname, '../guide.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
  HTMLCanvasElement.prototype.getContext = (() => stubCtx()) as never;
  window.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  performance.now = () => now;
  await import('../src/guide');
});

beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });

describe('機制教學頁', () => {
  it('一整頁：三個階段、每個單元一段，機制說明全部展開；索引對應每一段', () => {
    expect(document.querySelectorAll('#gnav .ggroup').length).toBe(3);
    const n = document.querySelectorAll('.gsec').length;
    expect(n).toBeGreaterThan(20);
    expect(document.querySelectorAll('#gnav .gitem').length).toBe(n);
    expect(document.querySelectorAll('#gsel option').length).toBe(n);
    const mi = document.querySelectorAll('details.mi');
    expect(mi.length).toBeGreaterThan(20);
    expect([...mi].every((d) => (d as HTMLDetailsElement).open)).toBe(true);
    expect(document.querySelector('#k-opener')!.classList.contains('playing')).toBe(true);
  });

  it('索引跳到單一機制：那一段播放，效果／預兆／應對都在', () => {
    (document.querySelector('#gnav [data-k="petrify"]') as HTMLElement).click();
    const s = document.getElementById('k-petrify')!;
    expect(s.classList.contains('playing')).toBe(true);
    ['效果', '預兆', '應對', '邪眼'].forEach((w) => expect(s.textContent).toContain(w));
    frames(60 * 4);
    expect(s.querySelector('.gcap')!.textContent).toContain('超石化');
    // 讀條有進度
    expect(parseFloat((s.querySelector('.gprog i') as HTMLElement).style.width)).toBeGreaterThan(0);
    frames(60 * 12);
    expect(s.querySelector('.gtime')!.textContent).toMatch(/0:0\d|結束/);
    // 點畫面暫停、再點播放
    const stage = s.querySelector('.gstage') as HTMLElement;
    stage.click();
    frames(2);
    expect(s.querySelector('.gtime')!.textContent).toContain('已暫停');
    stage.click();
    frames(2);
    expect(s.querySelector('.gtime')!.textContent).not.toContain('已暫停');
  });

  it('換座位、速度、下拉選單跳到 P3', () => {
    (document.querySelector('#roleSeg [data-v="MT"]') as HTMLButtonElement).click();
    expect(document.getElementById('gnote')!.textContent).toContain('MT');
    (document.querySelector('#gSpeed [data-v="4"]') as HTMLButtonElement).click();
    const sel = document.getElementById('gsel') as HTMLSelectElement;
    sel.value = 'p3fear';
    sel.dispatchEvent(new Event('change'));
    // 4 倍速：1 秒＝遊戲 4 秒（倒數 0.8 秒後、詠唱 1.5～6.5 秒之間）
    frames(60);
    expect(document.querySelector('#k-p3fear .gcap')!.textContent).toContain('恐懼之雲');
  });
});
