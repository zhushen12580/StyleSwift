/**
 * Playwright 集成测试 Setup
 * 配置 Playwright 加载未打包扩展模式
 * 
 * 参考: §14.2 集成测试
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 扩展根目录（相对于此文件的路径）
const EXTENSION_PATH = path.resolve(__dirname, '../..');

/**
 * 启动加载了 StyleSwift 扩展的浏览器实例
 * @param {Object} options - 配置选项
 * @param {boolean} options.headless - 是否无头模式（默认 false，扩展测试需要可见窗口）
 * @returns {Promise<{browser: import('@playwright/test').Browser, context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page}>}
 */
export async function launchBrowser(options = {}) {
  const {
    headless = false, // 扩展测试通常需要非无头模式
    timeout = 30000,
  } = options;

  const browser = await chromium.launch({
    headless,
    args: [
      // 加载未打包扩展
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      // Side Panel 相关
      '--enable-features=SidePanel',
      // 其他有用参数
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // 禁用自动扩展更新提示
      '--disable-component-update',
    ],
    timeout,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);

  return { browser, context, page };
}

/**
 * 获取扩展的 ID
 * @param {import('@playwright/test').Browser} browser 
 * @returns {Promise<string>}
 */
export async function getExtensionId(browser) {
  const targets = await browser.waitForEvent('backgroundpage', { timeout: 10000 });
  // 获取 service worker 页面
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('未找到浏览器上下文');
  }
  
  // 通过 background page 或 service worker 获取扩展 ID
  const pages = contexts[0].pages();
  for (const pg of pages) {
    const url = pg.url();
    if (url.startsWith('chrome-extension://')) {
      const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
      if (match) return match[1];
    }
  }
  
  // 备选方案：通过 background page 获取
  const bgPages = contexts.filter(c => {
    try {
      return c.pages().some(p => p.url().includes('chrome-extension'));
    } catch {
      return false;
    }
  });
  
  if (bgPages.length > 0) {
    const pg = bgPages[0].pages()[0];
    const url = pg.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
    if (match) return match[1];
  }
  
  throw new Error('未找到扩展 ID');
}

/**
 * 通过 Service Worker 获取扩展 ID（更可靠的方式）
 * @param {import('@playwright/test').Browser} browser 
 * @returns {Promise<string>}
 */
export async function getExtensionIdFromServiceWorker(browser) {
  // 等待 Service Worker 上下文出现
  let extensionId = null;
  
  for (let i = 0; i < 20; i++) {
    const contexts = browser.contexts();
    for (const ctx of contexts) {
      const pages = ctx.pages();
      for (const pg of pages) {
        const url = pg.url();
        if (url.startsWith('chrome-extension://')) {
          const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
          if (match) {
            extensionId = match[1];
            break;
          }
        }
      }
      if (extensionId) break;
    }
    if (extensionId) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!extensionId) {
    throw new Error('等待扩展 Service Worker 激活超时');
  }
  
  return extensionId;
}

/**
 * 获取扩展的 Side Panel 页面
 * @param {import('@playwright/test').Browser} browser 
 * @returns {Promise<import('@playwright/test').Page>}
 */
export async function getSidePanelPage(browser) {
  const extensionId = await getExtensionIdFromServiceWorker(browser);
  
  // Side Panel 的 URL
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/index.html`;
  
  // 查找已打开的 Side Panel
  const contexts = browser.contexts();
  for (const ctx of contexts) {
    const pages = ctx.pages();
    const sidePanelPage = pages.find(page => page.url() === sidePanelUrl);
    if (sidePanelPage) return sidePanelPage;
  }
  
  // 如果没有打开，创建新页面并导航到 Side Panel
  // 注意：实际上 Side Panel 需要通过扩展图标点击打开
  // 这里作为备选方案直接访问 URL
  const context = contexts[0];
  const sidePanelPage = await context.newPage();
  await sidePanelPage.goto(sidePanelUrl, { waitUntil: 'domcontentloaded' });
  
  return sidePanelPage;
}

/**
 * 关闭浏览器并清理资源
 * @param {import('@playwright/test').Browser} browser 
 */
export async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

/**
 * 等待扩展 Service Worker 激活
 * @param {import('@playwright/test').Browser} browser 
 * @param {number} timeout 
 * @returns {Promise<void>}
 */
export async function waitForExtensionReady(browser, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const extensionId = await getExtensionIdFromServiceWorker(browser);
      if (extensionId) return;
    } catch {
      // 继续等待
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error('等待扩展就绪超时');
}

/**
 * 导航到测试页面
 * @param {import('@playwright/test').Page} page 
 * @param {string} url - 测试页面 URL
 * @returns {Promise<void>}
 */
export async function navigateToTestPage(page, url = 'https://example.com') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * 获取扩展路径
 * @returns {string}
 */
export function getExtensionPath() {
  return EXTENSION_PATH;
}
