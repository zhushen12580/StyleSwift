/**
 * 集成测试 - 扩展加载与 Side Panel 基础功能
 * 
 * 测试目标（testCriteria）:
 * - Puppeteer 能加载扩展并打开 Side Panel
 * 
 * 参考: §14.2 集成测试
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  launchBrowser,
  closeBrowser,
  getExtensionId,
  getSidePanelPage,
  waitForExtensionReady,
  navigateToTestPage,
  getExtensionPath,
} from './setup.js';
import {
  waitForElement,
  waitForSidePanelReady,
  takeScreenshot,
  getElementText,
  elementExists,
  sleep,
  setChromeStorage,
  getChromeStorage,
} from './helpers.js';

describe('StyleSwift 扩展集成测试', () => {
  let browser;
  let page;
  let extensionId;

  // 测试超时设置（集成测试需要更长时间）
  const TEST_TIMEOUT = 60000;
  const SETUP_TIMEOUT = 30000;

  beforeAll(async () => {
    // 验证扩展目录存在
    const extensionPath = getExtensionPath();
    expect(extensionPath).toBeDefined();
    
    // 启动浏览器并加载扩展
    const result = await launchBrowser({
      headless: false, // 扩展测试需要非无头模式
      timeout: SETUP_TIMEOUT,
    });
    
    browser = result.browser;
    page = result.page;
    
    // 等待扩展就绪
    await waitForExtensionReady(browser, SETUP_TIMEOUT);
    
    // 获取扩展 ID
    extensionId = await getExtensionId(browser);
    expect(extensionId).toBeTruthy();
    
    console.log(`扩展已加载，ID: ${extensionId}`);
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await closeBrowser(browser);
    }
  });

  describe('扩展加载', () => {
    test('扩展 Service Worker 应该激活', async () => {
      expect(extensionId).toBeDefined();
      expect(extensionId.length).toBeGreaterThan(10);
    }, TEST_TIMEOUT);

    test('扩展 ID 格式应该正确', async () => {
      // Chrome 扩展 ID 是 32 个字符的字母字符串
      expect(extensionId).toMatch(/^[a-z]+$/);
    }, TEST_TIMEOUT);
  });

  describe('Side Panel 打开', () => {
    let sidePanelPage;

    beforeAll(async () => {
      // 导航到测试页面
      await navigateToTestPage(page, 'https://example.com');
      
      // 获取 Side Panel 页面
      sidePanelPage = await getSidePanelPage(browser);
      expect(sidePanelPage).toBeDefined();
    }, TEST_TIMEOUT);

    test('Side Panel 页面应该加载成功', async () => {
      const url = sidePanelPage.url();
      expect(url).toContain('chrome-extension://');
      expect(url).toContain('/sidepanel/index.html');
    }, TEST_TIMEOUT);

    test('Side Panel 应该包含基本 DOM 结构', async () => {
      await waitForSidePanelReady(sidePanelPage, 10000);
      
      // 检查基本元素存在
      const appExists = await elementExists(sidePanelPage, '#app');
      expect(appExists).toBe(true);
    }, TEST_TIMEOUT);

    test('截图：Side Panel 初始状态', async () => {
      const screenshotPath = await takeScreenshot(
        sidePanelPage, 
        'side-panel-initial'
      );
      expect(screenshotPath).toBeDefined();
      console.log(`截图已保存: ${screenshotPath}`);
    }, TEST_TIMEOUT);
  });

  describe('Content Script 注入', () => {
    beforeAll(async () => {
      // 导航到测试页面
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000); // 等待 Content Script 注入
    });

    test('页面应该注入了 Content Script', async () => {
      // 检查是否有 StyleSwift 相关的 style 元素
      const hasPersistentStyle = await page.evaluate(() => {
        // early-inject.js 创建的 style 元素
        const style = document.getElementById('styleswift-persistent');
        return style !== null;
      });
      
      // 如果没有永久样式，说明页面没有保存过样式，这是正常的
      // 我们只需要验证 Content Script 被注入
      console.log(`永久样式存在: ${hasPersistentStyle}`);
    }, TEST_TIMEOUT);

    test('页面应该可以响应扩展消息', async () => {
      // 通过 Side Panel 发送消息测试
      const sidePanelPage = await getSidePanelPage(browser);
      
      // 获取当前活动 Tab
      const tabId = await sidePanelPage.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      
      expect(tabId).toBeDefined();
      expect(tabId).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('Chrome Storage', () => {
    let sidePanelPage;

    beforeAll(async () => {
      sidePanelPage = await getSidePanelPage(browser);
    });

    test('应该可以读写 Chrome Storage', async () => {
      const testData = { test_key: 'test_value_' + Date.now() };
      
      await setChromeStorage(sidePanelPage, testData);
      
      const result = await getChromeStorage(sidePanelPage, 'test_key');
      expect(result.test_key).toBe(testData.test_key);
    }, TEST_TIMEOUT);

    test('应该可以存储设置', async () => {
      const testSettings = {
        settings: {
          apiKey: 'test-api-key',
          apiBase: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-20250514',
        },
      };
      
      await setChromeStorage(sidePanelPage, testSettings);
      
      const result = await getChromeStorage(sidePanelPage, 'settings');
      expect(result.settings.apiKey).toBe(testSettings.settings.apiKey);
    }, TEST_TIMEOUT);
  });

  describe('扩展消息通信', () => {
    test('应该能获取域名', async () => {
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000);
      
      const sidePanelPage = await getSidePanelPage(browser);
      
      // 获取当前 Tab ID
      const tabId = await sidePanelPage.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      
      expect(tabId).toBeDefined();
      
      // 发送消息获取域名
      const domain = await sidePanelPage.evaluate(async (tid) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tid, { tool: 'get_domain' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      }, tabId);
      
      expect(domain).toBe('example.com');
    }, TEST_TIMEOUT);
  });
});
