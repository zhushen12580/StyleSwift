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
// 存储清理常量
// ============================================================================

/**
 * 每个域名最多保留的会话数量
 * 超过此数量的会话会被清理（按创建时间，保留最新的）
 * @type {number}
 */
const MAX_SESSIONS_PER_DOMAIN = 20;

/**
 * 会话过期天数
 * 超过此天数的会话会被自动清理
 * @type {number}
 */
const SESSION_EXPIRE_DAYS = 90;

// ============================================================================
// Storage Schema 版本迁移常量
// ============================================================================

/**
 * 当前 Storage Schema 版本号
 * 用于 chrome.storage.local 数据结构的版本控制
 * 
 * 版本历史：
 * - v1: 初始版本，无迁移逻辑
 * - v2+: 未来版本，需添加迁移函数到 migrations 对象
 */
const CURRENT_SCHEMA_VERSION = 1;

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
 * onupgradeneeded 处理 IndexedDB 版本升级：
 * - 首次创建：创建 conversations Object Store
 * - 未来版本升级：在此添加迁移逻辑
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

    // 数据库版本升级时创建/修改 Object Store
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      console.log(`[IndexedDB] Upgrading: v${oldVersion} → v${newVersion}`);

      // 根据 oldVersion 执行不同的升级逻辑
      if (oldVersion < 1) {
        // 版本 0 → 1: 首次创建，创建 conversations Object Store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log(`[IndexedDB] Created Object Store: ${STORE_NAME}`);
        }
      }

      // 未来版本升级示例：
      // if (oldVersion < 2) {
      //   // 版本 1 → 2: 添加索引或其他结构变更
      //   const store = transaction.objectStore(STORE_NAME);
      //   store.createIndex('domain', 'domain', { unique: false });
      // }
    };

    // 成功打开数据库
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log(`[IndexedDB] Database opened successfully: ${dbInstance.name} v${dbInstance.version}`);
      resolve(dbInstance);
    };

    // 打开数据库失败
    request.onerror = (event) => {
      console.error('[IndexedDB] Failed to open database:', event.target.error);
      reject(event.target.error);
    };

    // 数据库被意外关闭时清除缓存
    request.onblocked = () => {
      console.warn('[IndexedDB] Database upgrade blocked by another connection');
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
// Storage Schema 版本迁移
// ============================================================================

/**
 * 迁移函数注册表
 * 
 * 每个 key 为目标版本号，value 为该版本的迁移函数。
 * 迁移函数负责将数据从 v-1 升级到 v。
 * 
 * 示例：
 * - 1: 初始版本，无迁移逻辑
 * - 2: async () => { 重命名 key、添加新字段等 }
 */
const migrations = {
  // 版本 1: 初始版本，无需迁移逻辑
  // 未来版本迁移示例：
  // 2: async () => {
  //   // 迁移逻辑：例如重命名 key、添加新字段
  //   const all = await chrome.storage.local.get(null);
  //   const updates = {};
  //   for (const [key, value] of Object.entries(all)) {
  //     if (key.startsWith('oldPrefix:')) {
  //       const newKey = key.replace('oldPrefix:', 'newPrefix:');
  //       updates[newKey] = value;
  //       await chrome.storage.local.remove(key);
  //     }
  //   }
  //   await chrome.storage.local.set(updates);
  // },
};

/**
 * 检查并执行 Storage Schema 版本迁移
 * 
 * 读取当前 _schemaVersion，按版本号顺序执行迁移函数。
 * 迁移完成后更新版本号到 CURRENT_SCHEMA_VERSION。
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * // Side Panel 启动时调用
 * await checkAndMigrateStorage();
 */
async function checkAndMigrateStorage() {
  try {
    // 读取当前版本号，默认为 0（全新安装）
    const { _schemaVersion = 0 } = await chrome.storage.local.get('_schemaVersion');

    // 如果已是最新版本，跳过迁移
    if (_schemaVersion >= CURRENT_SCHEMA_VERSION) {
      console.log(`[Schema] Storage already at version ${_schemaVersion}, skipping migration.`);
      return;
    }

    console.log(`[Schema] Migrating storage: v${_schemaVersion} → v${CURRENT_SCHEMA_VERSION}`);

    // 按版本号顺序执行迁移
    for (let v = _schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      if (migrations[v]) {
        console.log(`[Schema] Executing migration for version ${v}...`);
        await migrations[v]();
        console.log(`[Schema] Migration v${v} completed.`);
      } else {
        console.log(`[Schema] No migration needed for version ${v}.`);
      }
    }

    // 更新版本号
    await chrome.storage.local.set({ _schemaVersion: CURRENT_SCHEMA_VERSION });
    console.log(`[Schema] Migration complete. Current version: ${CURRENT_SCHEMA_VERSION}`);
  } catch (error) {
    console.error('[Schema] Migration failed:', error);
    // 不抛出错误，避免阻塞应用启动
    // 可以在后续操作中重试或提示用户
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
// 会话索引管理
// ============================================================================

/**
 * 获取或创建会话
 * 
 * 根据域名读取会话索引，若无会话则新建。返回会话 ID。
 * - 如果索引中已有会话，返回最新创建的会话 ID（按 created_at 降序）
 * - 如果索引为空或不存在，创建新会话并更新索引
 * 
 * @param {string} domain - 域名，如 'github.com'
 * @returns {Promise<string>} 返回会话 ID
 * 
 * @example
 * // 首次调用：创建新会话
 * const sessionId1 = await getOrCreateSession('github.com');
 * console.log(sessionId1); // 'a1b2c3d4-...'
 * 
 * // 再次调用：返回已存在的最新会话
 * const sessionId2 = await getOrCreateSession('github.com');
 * console.log(sessionId2); // 'a1b2c3d4-...' (与 sessionId1 相同)
 */
async function getOrCreateSession(domain) {
  const indexKey = `sessions:${domain}:index`;
  
  try {
    // 读取会话索引
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
    
    // 如果索引中有会话，返回最新创建的（created_at 最大的）
    if (Array.isArray(index) && index.length > 0) {
      // 按 created_at 降序排序，取第一个（最新的）
      const sorted = [...index].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      return sorted[0].id;
    }
    
    // 没有会话，创建新会话
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    
    // 新会话条目
    const newSession = {
      id: sessionId,
      created_at: now
    };
    
    // 更新索引
    const newIndex = [newSession];
    await chrome.storage.local.set({ [indexKey]: newIndex });
    
    console.log(`[Session] Created new session: ${sessionId} for domain: ${domain}`);
    return sessionId;
    
  } catch (error) {
    console.error('[Session] Failed to get or create session:', error);
    throw error;
  }
}

// ============================================================================
// 存储清理策略
// ============================================================================

/**
 * 清理会话存储
 * 
 * 遍历所有域名会话索引，执行以下清理：
 * 1. 清理超过 90 天的过期会话
 * 2. 每个域名保留最新的 20 个会话（清理超出部分）
 * 3. 删除关联的 meta/styles/IndexedDB 数据
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * // Side Panel 打开时自动清理
 * cleanupStorage().catch(err => console.error('Cleanup failed:', err));
 */
async function cleanupStorage() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const keysToRemove = [];

    // 收集所有域名的会话索引
    const domainIndices = Object.entries(all)
      .filter(([k]) => k.match(/^sessions:.+:index$/));

    for (const [indexKey, sessions] of domainIndices) {
      if (!Array.isArray(sessions)) continue;
      
      // 提取域名：sessions:{domain}:index
      const parts = indexKey.split(':');
      if (parts.length < 3) continue;
      const domain = parts[1];

      // 按创建时间排序，最新的在前（age 小的在前）
      const sorted = sessions
        .map(s => ({ ...s, age: now - (s.created_at || 0) }))
        .sort((a, b) => a.age - b.age);

      const toKeep = [];
      const toDelete = [];

      for (const session of sorted) {
        const expired = session.age > SESSION_EXPIRE_DAYS * 86400000;
        
        // 过期或超出数量限制则删除
        if (expired || toKeep.length >= MAX_SESSIONS_PER_DOMAIN) {
          toDelete.push(session);
        } else {
          toKeep.push(session);
        }
      }

      // 删除会话相关的所有数据
      for (const session of toDelete) {
        keysToRemove.push(`sessions:${domain}:${session.id}:meta`);
        keysToRemove.push(`sessions:${domain}:${session.id}:styles`);
        // IndexedDB 中的对话历史也需要清理
        await deleteHistory(domain, session.id);
      }

      // 更新索引（如果有删除）
      if (toDelete.length > 0) {
        // 移除 age 临时字段，保留原始结构
        const cleanToKeep = toKeep.map(({ age, ...rest }) => rest);
        await chrome.storage.local.set({ [indexKey]: cleanToKeep });
        console.log(`[Cleanup] Removed ${toDelete.length} sessions for domain: ${domain}`);
      }
    }

    // 批量删除 storage keys
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`[Cleanup] Removed ${keysToRemove.length} storage keys`);
    }

    // 清理风格技能（上限 50 个）
    await cleanupStyleSkills();
    
  } catch (error) {
    console.error('[Cleanup] Storage cleanup failed:', error);
    // 不抛出错误，避免影响应用启动
  }
}

/**
 * 清理风格技能存储
 * 
 * 限制最多 50 个技能，超出部分按创建时间淘汰最旧的。
 * 从 style-skill.js 模块导入执行。
 * 
 * @returns {Promise<void>}
 */
async function cleanupStyleSkills() {
  try {
    // 动态导入 StyleSkillStore 避免循环依赖
    const { StyleSkillStore } = await import('./style-skill.js');
    
    const skills = await StyleSkillStore.list();
    const MAX_STYLE_SKILLS = 50;
    
    if (skills.length <= MAX_STYLE_SKILLS) return;

    // 按创建时间降序排序，最新的在前
    const sorted = [...skills].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // 删除超出限制的最旧技能
    const toRemove = sorted.slice(MAX_STYLE_SKILLS);
    
    for (const skill of toRemove) {
      await StyleSkillStore.remove(skill.id);
    }
    
    if (toRemove.length > 0) {
      console.log(`[Cleanup] Removed ${toRemove.length} old style skills`);
    }
  } catch (error) {
    console.error('[Cleanup] Style skills cleanup failed:', error);
    // 不抛出错误，避免影响应用启动
  }
}

/**
 * 获取存储用量
 * 
 * 返回当前 chrome.storage.local 的使用情况。
 * 
 * @returns {Promise<{bytes: number, maxBytes: number, percent: number}>}
 * 
 * @example
 * const usage = await getStorageUsage();
 * console.log(`Storage: ${usage.percent}% used (${usage.bytes}/${usage.maxBytes} bytes)`);
 */
async function getStorageUsage() {
  const bytes = await chrome.storage.local.getBytesInUse(null);
  const maxBytes = chrome.storage.local.QUOTA_BYTES || 10485760;
  return { bytes, maxBytes, percent: Math.round(bytes / maxBytes * 100) };
}

// ============================================================================
// 导出
// ============================================================================

// 导出常量供其他模块使用
export { DB_NAME, DB_VERSION, STORE_NAME, CURRENT_SCHEMA_VERSION };
export { MAX_SESSIONS_PER_DOMAIN, SESSION_EXPIRE_DAYS };

// 导出函数
export { openDB, closeDB, saveHistory, loadHistory, deleteHistory, checkAndMigrateStorage };
export { cleanupStorage, cleanupStyleSkills, getStorageUsage };
export { getOrCreateSession };

// 导出 SessionContext 类和当前会话变量
export { SessionContext, currentSession };

// ============================================================================
// 初始化（Side Panel 启动时执行）
// ============================================================================

/**
 * 初始化存储层
 * 
 * 在 Side Panel 加载时执行：
 * 1. 检查并执行 Storage Schema 迁移
 * 2. 打开 IndexedDB 连接（预热）
 * 
 * 此函数应在 sidepanel/panel.js 的模块初始化时调用。
 * 
 * @returns {Promise<void>}
 */
async function initStorage() {
  try {
    // 执行 Storage Schema 版本迁移
    await checkAndMigrateStorage();

    // 预热 IndexedDB 连接（创建但不等待）
    openDB().catch(err => {
      console.error('[Storage] Failed to initialize IndexedDB:', err);
    });

    console.log('[Storage] Storage layer initialized successfully');
  } catch (error) {
    console.error('[Storage] Storage initialization failed:', error);
  }
}

// 导出初始化函数
export { initStorage };

// 自动执行初始化（模块加载时立即运行）
// 注意：这是 IIFE 模式，确保在模块导入时执行
initStorage();
