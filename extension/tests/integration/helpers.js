/**
 * Puppeteer 集成测试 Helper 函数
 * 提供常用的测试辅助功能
 * 
 * 参考: §14.2 集成测试
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 截图保存目录
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

/**
 * 确保截图目录存在
 */
function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/**
 * 等待元素出现
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {Object} options - 选项
 * @param {number} options.timeout - 超时时间（毫秒）
 * @param {boolean} options.visible - 是否需要可见
 * @returns {Promise<import('puppeteer').ElementHandle>}
 */
export async function waitForElement(page, selector, options = {}) {
  const { timeout = 10000, visible = true } = options;
  
  return await page.waitForSelector(selector, {
    timeout,
    visible,
  });
}

/**
 * 等待元素消失
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
export async function waitForElementHidden(page, selector, timeout = 10000) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !el || el.offsetParent === null;
    },
    { timeout },
    selector
  );
}

/**
 * 等待文本出现
 * @param {import('puppeteer').Page} page 
 * @param {string} text - 要等待的文本
 * @param {Object} options - 选项
 * @param {string} options.selector - 在特定元素内查找
 * @param {number} options.timeout - 超时时间
 * @returns {Promise<void>}
 */
export async function waitForText(page, text, options = {}) {
  const { selector = 'body', timeout = 10000 } = options;
  
  await page.waitForFunction(
    ({ sel, txt }) => {
      const el = document.querySelector(sel);
      return el && el.textContent.includes(txt);
    },
    { timeout },
    { sel: selector, txt: text }
  );
}

/**
 * 截图并保存到文件
 * @param {import('puppeteer').Page} page 
 * @param {string} name - 截图名称
 * @param {Object} options - 选项
 * @param {boolean} options.fullPage - 是否全页面截图
 * @returns {Promise<string>} 截图保存路径
 */
export async function takeScreenshot(page, name, options = {}) {
  const { fullPage = false } = options;
  
  ensureScreenshotDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  
  await page.screenshot({
    path: filepath,
    fullPage,
    type: 'png',
  });
  
  return filepath;
}

/**
 * 获取元素文本内容
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @returns {Promise<string>}
 */
export async function getElementText(page, selector) {
  const element = await page.$(selector);
  if (!element) return '';
  
  return await page.evaluate(
    (el) => el.textContent || '',
    element
  );
}

/**
 * 获取元素属性值
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {string} attribute - 属性名
 * @returns {Promise<string|null>}
 */
export async function getElementAttribute(page, selector, attribute) {
  const element = await page.$(selector);
  if (!element) return null;
  
  return await page.evaluate(
    (el, attr) => el.getAttribute(attr),
    element,
    attribute
  );
}

/**
 * 点击元素
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {Object} options - 选项
 * @param {number} options.delay - 点击后延迟
 * @returns {Promise<void>}
 */
export async function clickElement(page, selector, options = {}) {
  const { delay = 0 } = options;
  
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * 输入文本
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {string} text - 要输入的文本
 * @param {Object} options - 选项
 * @param {boolean} options.clear - 是否先清空
 * @param {number} options.delay - 输入延迟
 * @returns {Promise<void>}
 */
export async function typeText(page, selector, text, options = {}) {
  const { clear = true, delay = 0 } = options;
  
  await page.waitForSelector(selector, { visible: true });
  
  if (clear) {
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
  }
  
  await page.type(selector, text, { delay });
}

/**
 * 获取计算样式
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @param {string} property - CSS 属性名
 * @returns {Promise<string>}
 */
export async function getComputedStyleProperty(page, selector, property) {
  return await page.evaluate(
    (sel, prop) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      return window.getComputedStyle(el).getPropertyValue(prop);
    },
    selector,
    property
  );
}

/**
 * 检查元素是否存在
 * @param {import('puppeteer').Page} page 
 * @param {string} selector - CSS 选择器
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selector) {
  const element = await page.$(selector);
  return element !== null;
}

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 执行页面脚本
 * @param {import('puppeteer').Page} page 
 * @param {Function} fn - 要执行的函数
 * @param {...any} args - 函数参数
 * @returns {Promise<any>}
 */
export async function evaluateInPage(page, fn, ...args) {
  return await page.evaluate(fn, ...args);
}

/**
 * 模拟 Chrome Storage API（用于测试环境）
 * 在 Side Panel 页面中设置 storage 数据
 * @param {import('puppeteer').Page} sidePanelPage 
 * @param {Object} data - 要存储的数据
 * @returns {Promise<void>}
 */
export async function setChromeStorage(sidePanelPage, data) {
  await sidePanelPage.evaluate(async (items) => {
    await chrome.storage.local.set(items);
  }, data);
}

/**
 * 获取 Chrome Storage 数据
 * @param {import('puppeteer').Page} sidePanelPage 
 * @param {string|string[]} keys - 要获取的 key
 * @returns {Promise<Object>}
 */
export async function getChromeStorage(sidePanelPage, keys) {
  return await sidePanelPage.evaluate(async (k) => {
    return await chrome.storage.local.get(k);
  }, keys);
}

/**
 * 清除 Chrome Storage 数据
 * @param {import('puppeteer').Page} sidePanelPage 
 * @returns {Promise<void>}
 */
export async function clearChromeStorage(sidePanelPage) {
  await sidePanelPage.evaluate(async () => {
    await chrome.storage.local.clear();
  });
}

/**
 * 在 Side Panel 中发送消息
 * @param {import('puppeteer').Page} sidePanelPage 
 * @param {Object} message - 消息对象
 * @param {number} tabId - 目标 Tab ID
 * @returns {Promise<any>}
 */
export async function sendToContentScript(sidePanelPage, message, tabId) {
  return await sidePanelPage.evaluate(async (msg, tid) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tid, msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }, message, tabId);
}

/**
 * 获取当前活动 Tab ID
 * @param {import('puppeteer').Page} sidePanelPage 
 * @returns {Promise<number>}
 */
export async function getActiveTabId(sidePanelPage) {
  return await sidePanelPage.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  });
}

/**
 * 等待 Side Panel 完全加载
 * @param {import('puppeteer').Page} sidePanelPage 
 * @param {number} timeout - 超时时间
 * @returns {Promise<void>}
 */
export async function waitForSidePanelReady(sidePanelPage, timeout = 10000) {
  await sidePanelPage.waitForFunction(
    () => {
      // 检查基本 DOM 结构是否加载
      const app = document.querySelector('#app') || document.body;
      return app && app.children.length > 0;
    },
    { timeout }
  );
}

/**
 * 获取截图保存目录
 * @returns {string}
 */
export function getScreenshotDir() {
  return SCREENSHOT_DIR;
}

/**
 * 清理所有截图
 */
export function clearScreenshots() {
  if (fs.existsSync(SCREENSHOT_DIR)) {
    const files = fs.readdirSync(SCREENSHOT_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
    }
  }
}
