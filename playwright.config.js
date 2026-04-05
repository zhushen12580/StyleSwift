/**
 * Playwright 配置 - StyleSwift Chrome Extension 测试
 * 
 * 支持三种测试模式：
 * - 单元测试：Vitest（jsdom 环境）
 * - 集成测试：Playwright 加载未打包扩展
 * - E2E 测试：Playwright 真实浏览器交互
 */

// @ts-check
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 扩展目录（项目根目录下的 extension/）
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

export default defineConfig({
  testDir: './extension/tests',
  
  // 超时设置
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  
  // 失败重试
  retries: process.env.CI ? 2 : 0,
  
  // 并行执行
  fullyParallel: false, // 扩展测试需要串行，避免冲突
  
  // 失败时停止
  forbidOnly: !!process.env.CI,
  
  // 报告器
  reporter: process.env.CI 
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],
  
  // 共享上下文
  use: {
    baseURL: 'https://example.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // 项目配置
  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // 加载未打包扩展
        launchOptions: {
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--enable-features=SidePanel',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-component-update',
          ],
        },
      },
      testMatch: /integration\/.*\.test\.js/,
    },
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--enable-features=SidePanel',
            '--no-sandbox',
          ],
        },
      },
      testMatch: /e2e\/.*\.test\.js/,
    },
  ],
});
