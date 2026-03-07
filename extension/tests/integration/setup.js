/**
 * Puppeteer 集成测试 Setup
 * 配置 Puppeteer 加载未打包扩展模式
 * 
 * 参考: §14.2 集成测试
 */

import puppeteer from 'puppeteer';
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
 * @param {number} options.slowMo - 操作延迟毫秒数（调试用）
 * @returns {Promise<{browser: import('puppeteer').Browser, page: import('puppeteer').Page}>}
 */
export async function launchBrowser(options = {}) {
  const {
    headless = false, // 扩展测试通常需要非无头模式
    slowMo = 0,
    timeout = 30000,
  } = options;

  const browser = await puppeteer.launch({
    headless,
    slowMo,
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

  // 获取默认页面
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // 设置默认超时
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);

  return { browser, page };
}

/**
 * 获取扩展的 ID
 * @param {import('puppeteer').Browser} browser 
 * @returns {Promise<string>}
 */
export async function getExtensionId(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    target => target.type() === 'service_worker' && 
              target.url().startsWith('chrome-extension://')
  );
  
  if (!extensionTarget) {
    throw new Error('未找到扩展 Service Worker');
  }
  
  const extensionUrl = extensionTarget.url();
  const match = extensionUrl.match(/chrome-extension:\/\/([a-z]+)\//);
  
  if (!match) {
    throw new Error('无法解析扩展 ID');
  }
  
  return match[1];
}

/**
 * 获取扩展的 Side Panel 页面
 * @param {import('puppeteer').Browser} browser 
 * @returns {Promise<import('puppeteer').Page>}
 */
export async function getSidePanelPage(browser) {
  const extensionId = await getExtensionId(browser);
  
  // Side Panel 的 URL
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/index.html`;
  
  // 查找已打开的 Side Panel
  const pages = await browser.pages();
  let sidePanelPage = pages.find(page => page.url() === sidePanelUrl);
  
  if (!sidePanelPage) {
    // 如果没有打开，创建新页面并导航到 Side Panel
    // 注意：实际上 Side Panel 需要通过扩展图标点击打开
    // 这里作为备选方案直接访问 URL
    sidePanelPage = await browser.newPage();
    await sidePanelPage.goto(sidePanelUrl, { waitUntil: 'networkidle0' });
  }
  
  return sidePanelPage;
}

/**
 * 打开 Side Panel（通过点击扩展图标）
 * @param {import('puppeteer').Page} page - 当前活动页面
 * @param {import('puppeteer').Browser} browser 
 * @returns {Promise<import('puppeteer').Page>}
 */
export async function openSidePanel(page, browser) {
  // 点击扩展图标打开 Side Panel
  // 注意：Puppeteer 无法直接访问浏览器 UI（如工具栏）
  // 需要通过以下方式之一：
  // 1. 使用键盘快捷键（如果配置了）
  // 2. 通过扩展的 service worker 触发
  // 3. 直接访问 Side Panel URL
  
  const extensionId = await getExtensionId(browser);
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/index.html`;
  
  // 使用 Service Worker 的消息来打开 Side Panel
  const serviceWorkerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker' && 
              target.url().includes(extensionId)
  );
  
  // 直接在页面中执行脚本来模拟扩展图标点击效果
  // 或者直接打开 Side Panel 页面
  const sidePanelPage = await browser.newPage();
  await sidePanelPage.goto(sidePanelUrl, { waitUntil: 'networkidle0' });
  
  return sidePanelPage;
}

/**
 * 关闭浏览器并清理资源
 * @param {import('puppeteer').Browser} browser 
 */
export async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

/**
 * 等待扩展 Service Worker 激活
 * @param {import('puppeteer').Browser} browser 
 * @param {number} timeout 
 * @returns {Promise<void>}
 */
export async function waitForExtensionReady(browser, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const extensionId = await getExtensionId(browser);
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
 * @param {import('puppeteer').Page} page 
 * @param {string} url - 测试页面 URL
 * @returns {Promise<void>}
 */
export async function navigateToTestPage(page, url = 'https://example.com') {
  await page.goto(url, { waitUntil: 'networkidle0' });
}

/**
 * 获取扩展路径
 * @returns {string}
 */
export function getExtensionPath() {
  return EXTENSION_PATH;
}
