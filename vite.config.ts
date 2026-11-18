import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    // 兩個頁面：模擬器（index.html）與機制教學（guide.html）
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        guide: fileURLToPath(new URL('./guide.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    // 一次跑一個檔案：legacy 對照要載入 jsdom，和其他檔平行時在部分 Windows 環境會極慢
    fileParallelism: false,
  },
});
