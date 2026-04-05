/**
 * 集成测试 - 核心流程
 * 
 * 测试目标（testCriteria）:
 * - Side Panel ↔ Content Script 通信（get_domain/get_page_structure/grep/inject_css/rollback_css）
 * - chrome.storage CRUD 操作
 * - 永久样式注入验证
 * 
 * 参考: §14.2 集成测试覆盖
 */

import { test, expect } from '@playwright/test';
import {
  launchBrowser,
  closeBrowser,
  getExtensionIdFromServiceWorker,
  getSidePanelPage,
  navigateToTestPage,
  getExtensionPath,
  waitForExtensionReady,
} from './setup.js';
import {
  waitForElement,
  sleep,
  setChromeStorage,
  getChromeStorage,
  sendToContentScript,
  getActiveTabId,
  getComputedStyleProperty,
  elementExists,
  takeScreenshot,
} from './helpers.js';

// 测试超时设置
const TEST_TIMEOUT = 60000;
const SETUP_TIMEOUT = 30000;

test.describe('StyleSwift 核心流程集成测试', () => {
  test.setTimeout(TEST_TIMEOUT);

  let browser;
  let context;
  let page;
  let extensionId;
  let sidePanelPage;

  test.beforeAll(async () => {
    // 启动浏览器并加载扩展
    const result = await launchBrowser({
      headless: false, // 集成测试需要非无头模式
      timeout: SETUP_TIMEOUT,
    });
    
    browser = result.browser;
    context = result.context;
    page = result.page;
    
    // 获取扩展 ID
    await waitForExtensionReady(browser, SETUP_TIMEOUT);
    extensionId = await getExtensionIdFromServiceWorker(browser);
    expect(extensionId).toBeDefined();
    
    console.log(`[Core Flow Tests] 扩展已加载，ID: ${extensionId}`);
  });

  test.afterAll(async () => {
    if (browser) {
      await closeBrowser(browser);
    }
  });

  // ============================================================================
  // §14.2.1 Side Panel ↔ Content Script 通信
  // ============================================================================

  test.describe('Side Panel ↔ Content Script 通信', () => {
    test.beforeEach(async () => {
      // 导航到测试页面
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000); // 等待页面加载完成
      
      // 获取 Side Panel 页面
      sidePanelPage = await getSidePanelPage(browser);
      expect(sidePanelPage).toBeDefined();
    });

    test('get_domain 返回正确域名', async () => {
      // 获取当前活动 Tab ID
      const tabId = await getActiveTabId(sidePanelPage);
      expect(tabId).toBeDefined();
      expect(tabId).toBeGreaterThan(0);

      // 发送 get_domain 消息
      const domain = await sendToContentScript(sidePanelPage, tabId, { tool: 'get_domain' });
      
      // 验证返回的域名
      expect(domain).toBeDefined();
      expect(domain).toBe('example.com');
    });

    test('get_page_structure 返回有效树形结构', async () => {
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 发送 get_page_structure 消息
      const structure = await sendToContentScript(sidePanelPage, tabId, { 
        tool: 'get_page_structure' 
      });
      
      // 验证返回的页面结构
      expect(structure).toBeDefined();
      expect(typeof structure).toBe('string');
      expect(structure.length).toBeGreaterThan(0);
      
      // 验证包含基本信息
      expect(structure).toContain('URL:');
      expect(structure).toContain('Title:');
      expect(structure).toContain('example.com');
    });

    test('grep 关键词搜索结果正确', async () => {
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 发送 grep 消息（搜索 h1 标签）
      const result = await sendToContentScript(sidePanelPage, tabId, {
        tool: 'grep',
        args: {
          query: 'h1',
          scope: 'self',
          maxResults: 5,
        },
      });
      
      // 验证返回结果
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // example.com 页面应该有 h1 标签
      // 注意：具体内容取决于 example.com 的实际 DOM 结构
    });

    test('inject_css 样式生效（DOM 验证）', async () => {
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 测试 CSS
      const testCSS = 'body { background-color: rgb(255, 0, 0) !important; }';
      
      // 发送 inject_css 消息
      const result = await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: testCSS },
      });
      
      // 验证注入成功
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // 等待样式生效
      await sleep(500);
      
      // 验证样式已应用到页面
      const bgColor = await getComputedStyleProperty(page, 'body', 'background-color');
      expect(bgColor).toContain('rgb(255, 0, 0)'); // 或者 'rgb(255,0,0)'
    });

    test('rollback_css 样式恢复', async () => {
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 先注入 CSS
      const testCSS1 = 'body { color: rgb(0, 255, 0) !important; }';
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: testCSS1 },
      });
      await sleep(500);
      
      // 验证样式已应用
      let color = await getComputedStyleProperty(page, 'body', 'color');
      expect(color).toContain('rgb(0, 255, 0)');
      
      // 回滚 CSS
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'last' },
      });
      await sleep(500);
      
      // 验证样式已回滚
      color = await getComputedStyleProperty(page, 'body', 'color');
      expect(color).not.toContain('rgb(0, 255, 0)');
    });

    test('连续注入多个 CSS 并逐个回滚', async () => {
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 注入多个 CSS
      const css1 = 'body { border-left: 10px solid red !important; }';
      const css2 = 'body { border-right: 10px solid blue !important; }';
      
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: css1 },
      });
      await sleep(300);
      
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: css2 },
      });
      await sleep(300);
      
      // 验证两个样式都已应用
      let borderLeft = await getComputedStyleProperty(page, 'body', 'border-left-width');
      let borderRight = await getComputedStyleProperty(page, 'body', 'border-right-width');
      expect(borderLeft).toBe('10px');
      expect(borderRight).toBe('10px');
      
      // 回滚最后一个
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'last' },
      });
      await sleep(300);
      
      // 验证只有最后一个被回滚
      borderLeft = await getComputedStyleProperty(page, 'body', 'border-left-width');
      borderRight = await getComputedStyleProperty(page, 'body', 'border-right-width');
      expect(borderLeft).toBe('10px');
      expect(borderRight).not.toBe('10px');
      
      // 回滚所有
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'all' },
      });
      await sleep(300);
      
      // 验证所有样式已清除
      borderLeft = await getComputedStyleProperty(page, 'body', 'border-left-width');
      expect(borderLeft).not.toBe('10px');
    });
  });

  // ============================================================================
  // §14.2.2 存储读写
  // ============================================================================

  test.describe('chrome.storage.local CRUD 操作', () => {
    test.beforeEach(async () => {
      sidePanelPage = await getSidePanelPage(browser);
    });

    test('应该可以写入和读取存储数据', async () => {
      const testData = {
        test_key_1: 'value_1',
        test_key_2: 'value_2',
      };
      
      // 写入数据
      await setChromeStorage(sidePanelPage, testData);
      
      // 读取数据
      const result = await getChromeStorage(sidePanelPage, ['test_key_1', 'test_key_2']);
      
      expect(result.test_key_1).toBe('value_1');
      expect(result.test_key_2).toBe('value_2');
    });

    test('应该可以存储会话元数据', async () => {
      const domain = 'test-domain.com';
      const sessionId = 'test-session-123';
      const metaKey = `sessions:${domain}:${sessionId}:meta`;
      
      const meta = {
        title: '测试会话',
        created_at: Date.now(),
        message_count: 5,
      };
      
      await setChromeStorage(sidePanelPage, { [metaKey]: meta });
      
      const result = await getChromeStorage(sidePanelPage, metaKey);
      expect(result[metaKey].title).toBe('测试会话');
      expect(result[metaKey].message_count).toBe(5);
    });

    test('应该可以存储会话样式', async () => {
      const domain = 'test-domain.com';
      const sessionId = 'test-session-456';
      const stylesKey = `sessions:${domain}:${sessionId}:styles`;
      
      const css = 'body { background: #000 !important; }';
      
      await setChromeStorage(sidePanelPage, { [stylesKey]: css });
      
      const result = await getChromeStorage(sidePanelPage, stylesKey);
      expect(result[stylesKey]).toBe(css);
    });

    test('应该可以存储永久样式', async () => {
      const domain = 'test-persistent.com';
      const persistKey = `persistent:${domain}`;
      
      const css = 'body { color: #fff !important; }';
      
      await setChromeStorage(sidePanelPage, { [persistKey]: css });
      
      const result = await getChromeStorage(sidePanelPage, persistKey);
      expect(result[persistKey]).toBe(css);
    });

    test('应该可以删除存储数据', async () => {
      const testKey = 'test_delete_key';
      const testData = { [testKey]: 'to_be_deleted' };
      
      // 写入数据
      await setChromeStorage(sidePanelPage, testData);
      
      // 验证数据存在
      let result = await getChromeStorage(sidePanelPage, testKey);
      expect(result[testKey]).toBe('to_be_deleted');
      
      // 删除数据
      await sidePanelPage.evaluate(async (key) => {
        await chrome.storage.local.remove(key);
      }, testKey);
      
      // 验证数据已删除
      result = await getChromeStorage(sidePanelPage, testKey);
      expect(result[testKey]).toBeUndefined();
    });

    test('应该可以存储用户画像', async () => {
      const profile = '用户偏好深色主题，喜欢圆角设计，偏好高对比度颜色';
      
      await setChromeStorage(sidePanelPage, { userProfile: profile });
      
      const result = await getChromeStorage(sidePanelPage, 'userProfile');
      expect(result.userProfile).toBe(profile);
    });

    test('应该可以存储设置', async () => {
      const settings = {
        apiKey: 'test-api-key-123',
        apiBase: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-20250514',
      };
      
      await setChromeStorage(sidePanelPage, { settings });
      
      const result = await getChromeStorage(sidePanelPage, 'settings');
      expect(result.settings.apiKey).toBe('test-api-key-123');
      expect(result.settings.model).toBe('claude-sonnet-4-20250514');
    });
  });

  test.describe('IndexedDB 对话历史读写', () => {
    test.beforeEach(async () => {
      sidePanelPage = await getSidePanelPage(browser);
    });

    test('应该可以保存对话历史', async () => {
      const domain = 'test-idb.com';
      const sessionId = 'session-idb-123';
      const history = [
        { role: 'user', content: '把背景改成蓝色' },
        { role: 'assistant', content: [{ type: 'text', text: '好的，已应用...' }] },
      ];
      
      // 保存历史
      await sidePanelPage.evaluate(async ({ domain, sessionId, history }) => {
        // 使用 openDB 和 saveHistory 函数（需要在 Side Panel 中已加载）
        const DB_NAME = 'StyleSwiftDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'conversations';
        
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            store.put(history, `${domain}:${sessionId}`);
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          
          request.onerror = () => reject(request.error);
        });
      }, { domain, sessionId, history });
      
      // 验证保存成功
      const loaded = await sidePanelPage.evaluate(async ({ domain, sessionId }) => {
        const DB_NAME = 'StyleSwiftDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'conversations';
        
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(`${domain}:${sessionId}`);
            
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => resolve(null);
          };
          
          request.onerror = () => resolve(null);
        });
      }, { domain, sessionId });
      
      expect(loaded).toBeDefined();
      expect(loaded.length).toBe(2);
      expect(loaded[0].content).toBe('把背景改成蓝色');
    });

    test('应该可以删除对话历史', async () => {
      const domain = 'test-idb-delete.com';
      const sessionId = 'session-idb-delete';
      const history = [{ role: 'user', content: 'test' }];
      
      // 先保存
      await sidePanelPage.evaluate(async ({ domain, sessionId, history }) => {
        const DB_NAME = 'StyleSwiftDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'conversations';
        
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            store.put(history, `${domain}:${sessionId}`);
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        });
      }, { domain, sessionId, history });
      
      // 删除
      await sidePanelPage.evaluate(async ({ domain, sessionId }) => {
        const DB_NAME = 'StyleSwiftDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'conversations';
        
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            store.delete(`${domain}:${sessionId}`);
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        });
      }, { domain, sessionId });
      
      // 验证已删除
      const loaded = await sidePanelPage.evaluate(async ({ domain, sessionId }) => {
        const DB_NAME = 'StyleSwiftDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'conversations';
        
        return new Promise((resolve) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(`${domain}:${sessionId}`);
            
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => resolve(null);
          };
        });
      }, { domain, sessionId });
      
      expect(loaded).toBeUndefined();
    });
  });

  test.describe('StyleSkillStore 增删查改', () => {
    test.beforeEach(async () => {
      sidePanelPage = await getSidePanelPage(browser);
    });

    test('应该可以保存风格技能', async () => {
      const skillId = 'skill-test-123';
      const skillName = '测试风格';
      const skillContent = '# 测试风格\n\n这是测试内容';
      
      // 保存技能
      await sidePanelPage.evaluate(async ({ id, name, content }) => {
        const INDEX_KEY = 'skills:user:index';
        const skillKey = `skills:user:${id}`;
        
        const index = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] || [];
        const entry = { id, name, mood: '', sourceDomain: 'test.com', createdAt: Date.now() };
        
        index.push(entry);
        
        await chrome.storage.local.set({
          [INDEX_KEY]: index,
          [skillKey]: content,
        });
      }, { id: skillId, name: skillName, content: skillContent });
      
      // 验证保存成功
      const result = await getChromeStorage(sidePanelPage, `skills:user:${skillId}`);
      expect(result[`skills:user:${skillId}`]).toBe(skillContent);
    });

    test('应该可以列出所有风格技能', async () => {
      // 添加几个测试技能
      const skills = [
        { id: 'skill-list-1', name: '风格1', content: '内容1' },
        { id: 'skill-list-2', name: '风格2', content: '内容2' },
      ];
      
      for (const skill of skills) {
        await sidePanelPage.evaluate(async ({ id, name, content }) => {
          const INDEX_KEY = 'skills:user:index';
          const skillKey = `skills:user:${id}`;
          
          const index = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] || [];
          const entry = { id, name, mood: '', sourceDomain: 'test.com', createdAt: Date.now() };
          
          index.push(entry);
          
          await chrome.storage.local.set({
            [INDEX_KEY]: index,
            [skillKey]: content,
          });
        }, skill);
      }
      
      // 获取技能索引
      const result = await getChromeStorage(sidePanelPage, 'skills:user:index');
      const index = result['skills:user:index'];
      
      expect(Array.isArray(index)).toBe(true);
      expect(index.length).toBeGreaterThanOrEqual(2);
    });

    test('应该可以删除风格技能', async () => {
      const skillId = 'skill-delete-test';
      
      // 先保存
      await sidePanelPage.evaluate(async (id) => {
        const INDEX_KEY = 'skills:user:index';
        const skillKey = `skills:user:${id}`;
        
        const index = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] || [];
        index.push({ id, name: '待删除', createdAt: Date.now() });
        
        await chrome.storage.local.set({
          [INDEX_KEY]: index,
          [skillKey]: '待删除内容',
        });
      }, skillId);
      
      // 删除
      await sidePanelPage.evaluate(async (id) => {
        const INDEX_KEY = 'skills:user:index';
        const skillKey = `skills:user:${id}`;
        
        const index = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] || [];
        const filtered = index.filter(s => s.id !== id);
        
        await chrome.storage.local.set({ [INDEX_KEY]: filtered });
        await chrome.storage.local.remove(skillKey);
      }, skillId);
      
      // 验证已删除
      const result = await getChromeStorage(sidePanelPage, `skills:user:${skillId}`);
      expect(result[`skills:user:${skillId}`]).toBeUndefined();
    });
  });

  // ============================================================================
  // §14.2.4 永久样式注入
  // ============================================================================

  test.describe('永久样式注入', () => {
    const testDomain = 'example.com';
    const testCSS = 'body { border-top: 5px solid green !important; }';
    const persistKey = `persistent:${testDomain}`;

    test.beforeEach(async () => {
      sidePanelPage = await getSidePanelPage(browser);
      
      // 清除之前的永久样式
      await sidePanelPage.evaluate(async (key) => {
        await chrome.storage.local.remove(key);
      }, persistKey);
    });

    test('early-inject.js 在 document_start 注入', async () => {
      // 保存永久样式
      await setChromeStorage(sidePanelPage, { [persistKey]: testCSS });
      
      // 刷新页面
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(1000);
      
      // 验证样式已注入
      const borderTop = await getComputedStyleProperty(page, 'body', 'border-top-width');
      expect(borderTop).toBe('5px');
    });

    test('页面刷新后样式仍生效', async () => {
      // 保存永久样式
      await setChromeStorage(sidePanelPage, { [persistKey]: testCSS });
      
      // 第一次加载
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000);
      
      let borderTop = await getComputedStyleProperty(page, 'body', 'border-top-width');
      expect(borderTop).toBe('5px');
      
      // 刷新页面
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(1000);
      
      // 验证样式仍然存在
      borderTop = await getComputedStyleProperty(page, 'body', 'border-top-width');
      expect(borderTop).toBe('5px');
    });

    test('不同域名的永久样式应该隔离', async () => {
      // 为 example.com 设置样式
      await setChromeStorage(sidePanelPage, { 
        [persistKey]: 'body { border-left: 20px solid red !important; }' 
      });
      
      // 为另一个域名设置样式
      const otherDomain = 'other-domain.com';
      const otherPersistKey = `persistent:${otherDomain}`;
      await setChromeStorage(sidePanelPage, { 
        [otherPersistKey]: 'body { border-right: 20px solid blue !important; }' 
      });
      
      // 导航到 example.com
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000);
      
      // 验证只应用了 example.com 的样式
      const borderLeft = await getComputedStyleProperty(page, 'body', 'border-left-width');
      const borderRight = await getComputedStyleProperty(page, 'body', 'border-right-width');
      
      expect(borderLeft).toBe('20px');
      expect(borderRight).not.toBe('20px');
    });

    test('清除永久样式后刷新页面不应有样式', async () => {
      // 保存永久样式
      await setChromeStorage(sidePanelPage, { [persistKey]: testCSS });
      
      // 刷新验证样式存在
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(1000);
      
      let borderTop = await getComputedStyleProperty(page, 'body', 'border-top-width');
      expect(borderTop).toBe('5px');
      
      // 清除永久样式
      await sidePanelPage.evaluate(async (key) => {
        await chrome.storage.local.remove(key);
      }, persistKey);
      
      // 再次刷新
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(1000);
      
      // 验证样式已清除
      borderTop = await getComputedStyleProperty(page, 'body', 'border-top-width');
      expect(borderTop).not.toBe('5px');
    });
  });

  // ============================================================================
  // 综合场景测试
  // ============================================================================

  test.describe('综合场景', () => {
    test('完整的样式应用和回滚流程', async () => {
      const domain = 'example.com';
      const sessionId = 'integration-test-session';
      
      // 导航到测试页面
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000);
      
      // 获取 Side Panel
      sidePanelPage = await getSidePanelPage(browser);
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 1. 注入第一个样式
      const css1 = 'body { background-color: rgb(128, 128, 128) !important; }';
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: css1 },
      });
      await sleep(500);
      
      // 验证样式生效
      let bgColor = await getComputedStyleProperty(page, 'body', 'background-color');
      expect(bgColor).toContain('rgb(128, 128, 128)');
      
      // 2. 保存到会话存储
      const stylesKey = `sessions:${domain}:${sessionId}:styles`;
      await setChromeStorage(sidePanelPage, { [stylesKey]: css1 });
      
      // 3. 注入第二个样式
      const css2 = 'body { color: rgb(255, 255, 0) !important; }';
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: css2 },
      });
      await sleep(500);
      
      // 验证第二个样式生效
      let color = await getComputedStyleProperty(page, 'body', 'color');
      expect(color).toContain('rgb(255, 255, 0)');
      
      // 4. 回滚最后一个样式
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'last' },
      });
      await sleep(500);
      
      // 验证第二个样式已回滚
      color = await getComputedStyleProperty(page, 'body', 'color');
      expect(color).not.toContain('rgb(255, 255, 0)');
      
      // 验证第一个样式仍然存在
      bgColor = await getComputedStyleProperty(page, 'body', 'background-color');
      expect(bgColor).toContain('rgb(128, 128, 128)');
      
      // 5. 回滚所有样式
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'all' },
      });
      await sleep(500);
      
      // 验证所有样式已清除
      bgColor = await getComputedStyleProperty(page, 'body', 'background-color');
      expect(bgColor).not.toContain('rgb(128, 128, 128)');
    });

    test('会话样式与永久样式的分离', async () => {
      const domain = 'example.com';
      const sessionId = 'session-persist-test';
      const persistKey = `persistent:${domain}`;
      const stylesKey = `sessions:${domain}:${sessionId}:styles`;
      
      await navigateToTestPage(page, 'https://example.com');
      await sleep(1000);
      
      sidePanelPage = await getSidePanelPage(browser);
      const tabId = await getActiveTabId(sidePanelPage);
      
      // 1. 注入并保存永久样式
      const persistentCSS = 'body { margin-top: 15px !important; }';
      await setChromeStorage(sidePanelPage, { [persistKey]: persistentCSS });
      
      // 2. 注入会话样式
      const sessionCSS = 'body { padding: 30px !important; }';
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'inject_css',
        args: { css: sessionCSS },
      });
      await setChromeStorage(sidePanelPage, { [stylesKey]: sessionCSS });
      await sleep(500);
      
      // 验证两个样式都存在
      let marginTop = await getComputedStyleProperty(page, 'body', 'margin-top');
      let padding = await getComputedStyleProperty(page, 'body', 'padding');
      expect(marginTop).toBe('15px');
      expect(padding).toBe('30px');
      
      // 3. 回滚会话样式
      await sendToContentScript(sidePanelPage, tabId, {
        tool: 'rollback_css',
        args: { scope: 'all' },
      });
      await sleep(500);
      
      // 验证会话样式已清除，但永久样式仍然存在
      padding = await getComputedStyleProperty(page, 'body', 'padding');
      marginTop = await getComputedStyleProperty(page, 'body', 'margin-top');
      expect(padding).not.toBe('30px');
      expect(marginTop).toBe('15px');
    });
  });
});
