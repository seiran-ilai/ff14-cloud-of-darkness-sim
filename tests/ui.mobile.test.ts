// @vitest-environment jsdom
// 手機版：版面窄（matchMedia 符合）時只能看示範，並顯示機制提示卡
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
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
  HTMLCanvasElement.prototype.getContext = (() => stubCtx()) as never;
  window.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
  performance.now = () => now;
  await import('../src/main');
});

describe('手機版', () => {
  it('開局只有教學示範，沒有錯誤即停／不停', () => {
    expect(document.body.classList.contains('mobile')).toBe(true);
    expect(document.querySelectorAll('#ov [data-mode]').length).toBe(0);
    expect(document.querySelector('#ov [data-demo]')).not.toBeNull();
    frames(1);
    expect(document.getElementById('tipCard')!.textContent).toContain('機制提示');
  });

  it('選單一機制 → 看示範：機制說明、機制提示，結束後可再看', () => {
    (document.querySelector('[data-k="petrify"]') as HTMLButtonElement).click();
    expect(document.getElementById('brief')!.textContent).toContain('超石化');
    (document.querySelector('#ov [data-demo]') as HTMLButtonElement).click();
    frames(60 * 5);
    expect(document.getElementById('tipCard')!.textContent).toContain('超石化');
    frames(60 * 10);
    expect(document.querySelector('#ov .ocard h2')!.textContent).toContain('示範結束');
    expect(document.getElementById('oRe')!.textContent).toBe('換一局再看');
    (document.getElementById('oRe') as HTMLButtonElement).click();
    expect(document.querySelector('#ov [data-mode]')).toBeNull();
  });
});
