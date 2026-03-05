/**
 * StyleSwift - Session Storage Module
 * 
 * 存储层：chrome.storage.local + IndexedDB 双层存储基础设施
 * - chrome.storage.local: 轻量、高频读写的数据
 * - IndexedDB: 大体积、低频读写的数据（对话历史）
 */

// ============================================================================
// IndexedDB 配置常量
// ============================================================================

const DB_NAME = 'StyleSwiftDB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

// ============================================================================
// IndexedDB 封装
// ============================================================================

/**
 * 数据库实例缓存
 * 用于确保重复调用 openDB() 时不会重复打开数据库
 * @type {IDBDatabase|null}
 */
let dbInstance = null;

/**
 * 打开 IndexedDB 数据库
 * 
 * 创建 StyleSwiftDB 数据库和 conversations Object Store。
 * 使用 Promise 封装，支持重复调用（内部缓存数据库实例）。
 * 
 * @returns {Promise<IDBDatabase>} 返回 IDBDatabase 实例
 * @throws {Error} 当数据库打开失败时抛出错误
 * 
 * @example
 * const db = await openDB();
 * console.log(db.name); // 'StyleSwiftDB'
 */
function openDB() {
  // 如果已有缓存的数据库实例，直接返回
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // 数据库版本升级时创建 Object Store
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 仅在 Object Store 不存在时创建
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    // 成功打开数据库
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    // 打开数据库失败
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * 关闭数据库连接
 * 清除缓存实例，用于测试或重置
 */
function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ============================================================================
// 对话历史读写操作
// ============================================================================

/**
 * 保存对话历史到 IndexedDB
 * 
 * 将对话历史数组存储到 conversations Object Store 中，
 * key 格式为 {domain}:{sessionId}。
 * 
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @param {Array} history - 对话历史数组，格式为 Anthropic Messages API 的 messages 数组
 * @returns {Promise<void>}
 * @throws {Error} 当保存失败时抛出错误
 * 
 * @example
 * await saveHistory('github.com', 'abc123', [
 *   { role: 'user', content: '把背景改成深蓝色' },
 *   { role: 'assistant', content: [{ type: 'text', text: '好的...' }] }
 * ]);
 */
async function saveHistory(domain, sessionId, history) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  // 使用 {domain}:{sessionId} 作为 key
  store.put(history, `${domain}:${sessionId}`);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 从 IndexedDB 加载对话历史
 * 
 * 从 conversations Object Store 中读取对话历史，
 * key 格式为 {domain}:{sessionId}。
 * 
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Array>} 对话历史数组，无数据时返回空数组
 * 
 * @example
 * const history = await loadHistory('github.com', 'abc123');
 * // history 可能是 [{ role: 'user', content: '...' }, ...]
 * // 或者是 []（无历史）
 */
async function loadHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(`${domain}:${sessionId}`);
  
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * 从 IndexedDB 删除对话历史
 * 
 * 从 conversations Object Store 中删除对话历史，
 * key 格式为 {domain}:{sessionId}。
 * 
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<void>}
 * 
 * @example
 * await deleteHistory('github.com', 'abc123');
 */
async function deleteHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  store.delete(`${domain}:${sessionId}`);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// SessionContext 类
// ============================================================================

/**
 * 会话上下文类
 * 
 * 基于 Chrome Storage key 映射，为每个会话生成标准化的存储 key 路径。
 * 包含会话相关的元数据 key、样式 key、历史 key 等。
 * 
 * @example
 * const ctx = new SessionContext('github.com', 'abc123');
 * console.log(ctx.stylesKey);    // 'sessions:github.com:abc123:styles'
 * console.log(ctx.metaKey);      // 'sessions:github.com:abc123:meta'
 * console.log(ctx.historyKey);   // 'github.com:abc123'
 * console.log(ctx.persistKey);   // 'persistent:github.com'
 * console.log(ctx.sessionIndex); // 'sessions:github.com:index'
 */
class SessionContext {
  /**
   * 创建会话上下文实例
   * @param {string} domain - 域名，如 'github.com'
   * @param {string} sessionId - 会话 ID，如 'abc123-def456'
   */
  constructor(domain, sessionId) {
    this.domain = domain;
    this.sessionId = sessionId;
  }

  /**
   * 获取会话样式的 chrome.storage.local key
   * @returns {string} 格式: 'sessions:{domain}:{sessionId}:styles'
   */
  get stylesKey() {
    return `sessions:${this.domain}:${this.sessionId}:styles`;
  }

  /**
   * 获取会话元数据的 chrome.storage.local key
   * @returns {string} 格式: 'sessions:{domain}:{sessionId}:meta'
   */
  get metaKey() {
    return `sessions:${this.domain}:${this.sessionId}:meta`;
  }

  /**
   * 获取对话历史的 IndexedDB key
   * @returns {string} 格式: '{domain}:{sessionId}'
   */
  get historyKey() {
    return `${this.domain}:${this.sessionId}`;
  }

  /**
   * 获取永久样式的 chrome.storage.local key
   * @returns {string} 格式: 'persistent:{domain}'
   */
  get persistKey() {
    return `persistent:${this.domain}`;
  }

  /**
   * 获取域名会话索引的 chrome.storage.local key
   * @returns {string} 格式: 'sessions:{domain}:index'
   */
  get sessionIndex() {
    return `sessions:${this.domain}:index`;
  }
}

/**
 * 当前会话的 SessionContext 实例
 * 在用户打开 Side Panel 或创建新会话时设置
 * @type {SessionContext|null}
 */
let currentSession = null;

// ============================================================================
// 导出
// ============================================================================

// 导出常量供其他模块使用
export { DB_NAME, DB_VERSION, STORE_NAME };

// 导出函数
export { openDB, closeDB, saveHistory, loadHistory, deleteHistory };

// 导出 SessionContext 类和当前会话变量
export { SessionContext, currentSession };
