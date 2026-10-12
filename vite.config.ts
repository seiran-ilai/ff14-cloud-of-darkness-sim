import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    // 一次跑一個檔案：legacy 對照要載入 jsdom，和其他檔平行時在部分 Windows 環境會極慢
    fileParallelism: false,
  },
});
