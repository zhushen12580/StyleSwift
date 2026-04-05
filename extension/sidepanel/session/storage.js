/**
 * StyleSwift - Session Storage Operations
 *
 * IndexedDB and chrome.storage operations for session data.
 */

import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  STYLES_HISTORY_STORE,
  QUOTA_THRESHOLD_PERCENT,
} from "./constants.js";

// =============================================================================
// IndexedDB 封装
// =============================================================================

/**
 * 数据库实例缓存
 * @type {IDBDatabase|null}
 */
let dbInstance = null;

/**
 * 打开 IndexedDB 数据库
 *
 * @returns {Promise<IDBDatabase>} 返回 IDBDatabase 实例
 * @throws {Error} 当数据库打开失败时抛出错误
 */
export function openDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      console.log(`[IndexedDB] Upgrading: v${oldVersion} → v${newVersion}`);

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log(`[IndexedDB] Created Object Store: ${STORE_NAME}`);
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STYLES_HISTORY_STORE)) {
          db.createObjectStore(STYLES_HISTORY_STORE);
          console.log(`[IndexedDB] Created Object Store: ${STYLES_HISTORY_STORE}`);
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log(
        `[IndexedDB] Database opened successfully: ${dbInstance.name} v${dbInstance.version}`,
      );
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[IndexedDB] Failed to open database:", event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn("[IndexedDB] Database upgrade blocked by another connection");
    };
  });
}

/**
 * 关闭数据库连接
 */
export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// =============================================================================
// Storage Schema 版本迁移
// =============================================================================

/**
 * 迁移函数注册表
 */
const migrations = {
  // 版本 1: 初始版本，无需迁移逻辑
};

/**
 * 检查并执行 Storage Schema 版本迁移
 *
 * @param {number} CURRENT_SCHEMA_VERSION - Current schema version
 * @returns {Promise<void>}
 */
export async function checkAndMigrateStorage(CURRENT_SCHEMA_VERSION) {
  try {
    const { _schemaVersion = 0 } = await chrome.storage.local.get("_schemaVersion");

    if (_schemaVersion >= CURRENT_SCHEMA_VERSION) {
      console.log(
        `[Schema] Storage already at version ${_schemaVersion}, skipping migration.`,
      );
      return;
    }

    console.log(
      `[Schema] Migrating storage: v${_schemaVersion} → v${CURRENT_SCHEMA_VERSION}`,
    );

    for (let v = _schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      if (migrations[v]) {
        console.log(`[Schema] Executing migration for version ${v}...`);
        await migrations[v]();
        console.log(`[Schema] Migration v${v} completed.`);
      }
    }

    await chrome.storage.local.set({ _schemaVersion: CURRENT_SCHEMA_VERSION });
    console.log(`[Schema] Migration complete.`);
  } catch (error) {
    console.error("[Schema] Migration failed:", error);
  }
}

// =============================================================================
// 对话历史读写操作
// =============================================================================

/**
 * 保存对话历史到 IndexedDB
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {Object} data - 对话数据
 */
export async function saveHistory(domain, sessionId, data) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.put(data, `${domain}:${sessionId}`);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 从 IndexedDB 加载对话历史
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Array>} 对话历史数组
 */
export async function loadHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
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
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 */
export async function deleteHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.delete(`${domain}:${sessionId}`);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================================
// 样式历史存储（IndexedDB）
// =============================================================================

/**
 * 保存样式历史到 IndexedDB
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {Array<string>} history - CSS 历史数组
 */
export async function saveStylesHistory(domain, sessionId, history) {
  const db = await openDB();
  const tx = db.transaction(STYLES_HISTORY_STORE, "readwrite");
  const store = tx.objectStore(STYLES_HISTORY_STORE);

  store.put(history, `${domain}:${sessionId}`);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 从 IndexedDB 加载样式历史
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Array<string>>} CSS 历史数组
 */
export async function loadStylesHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STYLES_HISTORY_STORE, "readonly");
  const store = tx.objectStore(STYLES_HISTORY_STORE);
  const request = store.get(`${domain}:${sessionId}`);

  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * 从 IndexedDB 删除样式历史
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 */
export async function deleteStylesHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STYLES_HISTORY_STORE, "readwrite");
  const store = tx.objectStore(STYLES_HISTORY_STORE);

  store.delete(`${domain}:${sessionId}`);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================================
// 存储配额管理
// =============================================================================

/**
 * 获取存储用量
 *
 * @returns {Promise<{bytes: number, maxBytes: number, percent: number}>}
 */
export async function getStorageUsage() {
  const bytes = await chrome.storage.local.getBytesInUse(null);
  const maxBytes = chrome.storage.local.QUOTA_BYTES || 10485760;
  return { bytes, maxBytes, percent: Math.round((bytes / maxBytes) * 100) };
}

/**
 * 检查存储配额并在需要时迁移数据
 *
 * @returns {Promise<{migrated: boolean, usage: object}>}
 */
export async function checkQuotaAndMigrate() {
  const { bytes, maxBytes, percent } = await getStorageUsage();

  if (percent < QUOTA_THRESHOLD_PERCENT) {
    return { migrated: false, usage: { bytes, maxBytes, percent } };
  }

  console.log(
    `[Storage] Quota at ${percent}%, migrating styles history to IndexedDB...`
  );

  try {
    const all = await chrome.storage.local.get(null);
    const historyKeys = Object.keys(all).filter((k) =>
      k.endsWith(":styles_history")
    );

    let migratedCount = 0;

    for (const hKey of historyKeys) {
      const match = hKey.match(/^sessions:([^:]+):([^:]+):styles_history$/);
      if (!match) continue;

      const domain = match[1];
      const sessionId = match[2];
      const history = all[hKey];

      if (Array.isArray(history) && history.length > 0) {
        await saveStylesHistory(domain, sessionId, history);
        await chrome.storage.local.remove(hKey);
        migratedCount++;
      }
    }

    const newUsage = await getStorageUsage();
    console.log(
      `[Storage] Migrated ${migratedCount} style histories. New usage: ${newUsage.percent}%`
    );

    return { migrated: true, migratedCount, usage: newUsage };
  } catch (error) {
    console.error("[Storage] Migration failed:", error);
    return { migrated: false, error: error.message, usage: { bytes, maxBytes, percent } };
  }
}

/**
 * 迁移指定会话的样式历史到 IndexedDB
 */
export async function migrateSessionStylesHistory(domain, sessionId) {
  const hKey = `sessions:${domain}:${sessionId}:styles_history`;
  const { [hKey]: history = [] } = await chrome.storage.local.get(hKey);

  if (Array.isArray(history) && history.length > 0) {
    await saveStylesHistory(domain, sessionId, history);
    await chrome.storage.local.remove(hKey);
    return true;
  }
  return false;
}