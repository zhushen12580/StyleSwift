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
// 导出
// ============================================================================

// 导出常量供其他模块使用
export { DB_NAME, DB_VERSION, STORE_NAME };

// 导出函数
export { openDB, closeDB };
