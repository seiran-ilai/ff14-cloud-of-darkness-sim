// @vitest-environment jsdom
// UI 冒煙測試：載入真正的 index.html 與 main.ts，手動推進 requestAnimationFrame，確認 DOM 接線無誤
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let rafCb: FrameRequestCallback | null = null;
let now = 0;
const frames = (n: number): void => { for (let i = 0; i < n; i++) { now += 1000 / 60; const cb = rafCb; rafCb = null; cb?.(now); } };
const key = (type: 'keydown' | 'keyup', code: string, k = ''): void => { window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true })); };

function stubCtx(): unknown {
  const fn: unknown = new Proxy(function () { /* noop */ }, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : fn), apply: () => fn, set: () => true });
  return fn;
}

beforeAll(async () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
  HTMLCanvasElement.prototype.getContext = (() => stubCtx()) as never;
  window.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  performance.now = () => now;
  await import('../src/main');
});

describe('UI 冒煙測試', () => {
  it('初始畫面：練習項目、技能列、說明、準備畫面', () => {
    expect(document.querySelectorAll('#drillsMode [data-mode]').length).toBe(3); // 單一階段／連續／隨機
    expect(document.querySelectorAll('#drillsTl .drill').length).toBe(3); // P1、P2／P4、P3
    expect(document.querySelectorAll('#drillsOne .drill').length).toBeGreaterThan(5);
    expect(document.querySelectorAll('#bar .slot').length).toBe(5);
    expect(document.getElementById('brief')!.textContent).toContain('單一階段・P1 開場');
    expect(document.querySelectorAll('#ov [data-mode]').length).toBe(2);
    frames(120);
    expect(document.querySelector('#ov [data-mode]')).not.toBeNull(); // 沒按開始就不會倒數
  });

  it('隨機練習：勾選樹、取消一個階段', () => {
    (document.querySelector('#drillsMode [data-mode="rand"]') as HTMLButtonElement).click();
    expect(document.getElementById('rTree')).not.toBeNull();
    expect(document.querySelectorAll('#rMins .chip').length).toBe(5);
    const p3 = document.querySelector('#rTree [data-ph="p3"]') as HTMLInputElement;
    expect(p3.checked).toBe(true);
    p3.checked = false;
    p3.dispatchEvent(new Event('change', { bubbles: true }));
    expect((document.querySelector('#rTree [data-ph="p3"]') as HTMLInputElement).checked).toBe(false);
    expect(document.getElementById('brief')!.textContent).toContain('隨機練習');
    // 回到連續模式（後面的測試用）
    (document.querySelector('#drillsMode [data-mode="cont"]') as HTMLButtonElement).click();
    expect(document.getElementById('brief')!.textContent).toContain('連續・從 P1 開場 開始');
    (document.querySelector('#drillsMode [data-mode="one"]') as HTMLButtonElement).click();
  });

  it('按開始後倒數、開打，移動與技能有效、HUD 更新', () => {
    (document.querySelector('#ov [data-mode="stop"]') as HTMLButtonElement).click();
    expect(document.querySelector('#ov .count')).not.toBeNull();
    frames(200);
    expect(document.getElementById('ov')!.hidden).toBe(true);
    expect(document.getElementById('tr')!.textContent).toContain('時間');
    key('keydown', 'Digit1', '1');
    key('keydown', 'KeyD', 'd');
    frames(30);
    key('keyup', 'KeyD', 'd');
    expect(document.getElementById('status')!.textContent).toContain('疾跑');
    expect(document.querySelector('.slot[data-i="0"] .cd')!.hasAttribute('hidden')).toBe(false);
  });

  it('Esc 暫停／繼續、設定視窗開關', () => {
    key('keydown', 'Escape');
    expect(document.querySelector('#ov h2')!.textContent).toBe('暫停');
    key('keydown', 'Escape');
    expect(document.getElementById('ov')!.hidden).toBe(true);
    (document.getElementById('openSet') as HTMLButtonElement).click();
    expect(document.getElementById('modal')!.hidden).toBe(false);
    expect(document.querySelectorAll('#acts .act').length).toBe(5);
    (document.getElementById('closeSet') as HTMLButtonElement).click();
    expect(document.getElementById('modal')!.hidden).toBe(true);
  });

  it('切換單一機制並以示範模式跑完到結算', () => {
    (document.querySelector('[data-k="petrify"]') as HTMLButtonElement).click();
    expect(document.getElementById('brief')!.textContent).toContain('超石化');
    (document.querySelector('#ov [data-demo]') as HTMLButtonElement).click();
    frames(60 * 12);
    expect(document.querySelector('#ov .ocard h2')!.textContent).toContain('示範結束');
    expect(document.querySelectorAll('#ov .checks li').length).toBeGreaterThan(0);
  });

  it('收起／顯示側欄', () => {
    const b = document.getElementById('toggleSides') as HTMLButtonElement;
    b.click();
    expect(document.body.classList.contains('nosides')).toBe(true);
    expect(b.textContent).toBe('顯示側欄');
    b.click();
    expect(document.body.classList.contains('nosides')).toBe(false);
  });

  it('點判定可回放，Esc 回到結算', () => {
    (document.querySelector('#ov [data-ck="0"]') as HTMLButtonElement).click();
    expect(document.getElementById('rp')!.hidden).toBe(false);
    frames(120);
    expect(document.getElementById('rpTime')!.textContent).toContain('秒');
    key('keydown', 'Escape');
    expect(document.getElementById('rp')!.hidden).toBe(true);
    expect(document.querySelector('#ov .ocard')).not.toBeNull();
  });

  it('鏡頭切換、時間軸從中途開始', () => {
    (document.getElementById('openSet') as HTMLButtonElement).click();
    (document.querySelector('#setCam [data-v="follow"]') as HTMLButtonElement).click();
    (document.getElementById('closeSet') as HTMLButtonElement).click();
    frames(240);
    (document.querySelector('[data-k="tl1"]') as HTMLButtonElement).click();
    const from = [...document.querySelectorAll<HTMLButtonElement>('#seq [data-from]')].find((b) => b.textContent!.includes('超石化'))!;
    from.click();
    expect(document.querySelector('#ov .ocard')!.textContent).toContain('從 0:4');
    key('keydown', 'Enter');
    frames(60 * 6);
    expect(document.getElementById('castN')!.textContent).toBe('超石化');
  });
});
