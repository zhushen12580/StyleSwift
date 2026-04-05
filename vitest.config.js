/**
 * Vitest 配置
 * 
 * 单元测试运行在 jsdom 环境中，排除集成测试（由 Playwright 处理）。
 */

// @ts-check
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'extension/tests/*.test.js',
    ],
    exclude: [
      'extension/tests/integration/**',
      'extension/tests/e2e/**',
      'node_modules/**',
    ],
    globals: true,
    setupFiles: [],
  },
});
