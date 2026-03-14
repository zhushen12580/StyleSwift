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

const DB_NAME = "StyleSwiftDB";
const DB_VERSION = 1;
const STORE_NAME = "conversations";

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
      console.log(
        `[IndexedDB] Database opened successfully: ${dbInstance.name} v${dbInstance.version}`,
      );
      resolve(dbInstance);
    };

    // 打开数据库失败
    request.onerror = (event) => {
      console.error("[IndexedDB] Failed to open database:", event.target.error);
      reject(event.target.error);
    };

    // 数据库被意外关闭时清除缓存
    request.onblocked = () => {
      console.warn(
        "[IndexedDB] Database upgrade blocked by another connection",
      );
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
    const { _schemaVersion = 0 } =
      await chrome.storage.local.get("_schemaVersion");

    // 如果已是最新版本，跳过迁移
    if (_schemaVersion >= CURRENT_SCHEMA_VERSION) {
      console.log(
        `[Schema] Storage already at version ${_schemaVersion}, skipping migration.`,
      );
      return;
    }

    console.log(
      `[Schema] Migrating storage: v${_schemaVersion} → v${CURRENT_SCHEMA_VERSION}`,
    );

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
    console.log(
      `[Schema] Migration complete. Current version: ${CURRENT_SCHEMA_VERSION}`,
    );
  } catch (error) {
    console.error("[Schema] Migration failed:", error);
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
 * 将对话历史（含快照）存储到 conversations Object Store 中，
 * key 格式为 {domain}:{sessionId}。
 *
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @param {Object} data - 对话数据，包含 messages 和 snapshots
 * @param {Array} data.messages - 对话历史数组
 * @param {Object} data.snapshots - 每轮结束时的 CSS 快照 { [turn]: css }
 * @returns {Promise<void>}
 * @throws {Error} 当保存失败时抛出错误
 */
async function saveHistory(domain, sessionId, data) {
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
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(`${domain}:${sessionId}`);

  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * 加载并准备对话历史
 *
 * 从 IndexedDB 加载对话历史，返回 { messages, snapshots } 格式。
 * 兼容旧格式（纯 Array）和新格式（{ messages, snapshots }）。
 *
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{messages: Array, snapshots: Object}>}
 */
async function loadAndPrepareHistory(domain, sessionId) {
  const data = await loadHistory(domain, sessionId);
  if (Array.isArray(data)) {
    return { messages: data, snapshots: {} };
  }
  if (data && typeof data === "object" && Array.isArray(data.messages)) {
    return { messages: data.messages, snapshots: data.snapshots || {} };
  }
  return { messages: [], snapshots: {} };
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
  const tx = db.transaction(STORE_NAME, "readwrite");
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
 * console.log(ctx.activeStylesKey); // 'active_styles:github.com'
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
   * 获取当前域名活跃样式的 chrome.storage.local key
   * 始终镜像当前活跃会话的 CSS，供 early-inject.js 在 document_start 时读取
   * @returns {string} 格式: 'active_styles:{domain}'
   */
  get activeStylesKey() {
    return `active_styles:${this.domain}`;
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

/**
 * 设置当前会话
 *
 * 用于在会话切换或创建时更新 currentSession。
 *
 * @param {SessionContext|null} session - 会话上下文实例
 *
 * @example
 * const session = new SessionContext('github.com', 'session-id');
 * setCurrentSession(session);
 */
function setCurrentSession(session) {
  currentSession = session;
}

/**
 * 获取当前会话
 *
 * @returns {SessionContext|null} 当前会话上下文实例
 */
function getCurrentSession() {
  return currentSession;
}

// ============================================================================
// 会话索引管理
// ============================================================================

/**
 * 记录某域名当前活跃的会话 ID
 * 用于 Side Panel 重新打开时恢复到上次使用的会话，而非最新创建的会话
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<void>}
 */
async function setActiveSession(domain, sessionId) {
  const key = `sessions:${domain}:active`;
  await chrome.storage.local.set({ [key]: sessionId });
}

/**
 * 获取某域名当前活跃的会话 ID
 *
 * @param {string} domain - 域名
 * @returns {Promise<string|null>} 会话 ID，不存在时返回 null
 */
async function getActiveSession(domain) {
  const key = `sessions:${domain}:active`;
  const { [key]: sessionId = null } = await chrome.storage.local.get(key);
  return sessionId;
}

async function getOrCreateSession(domain) {
  const indexKey = `sessions:${domain}:index`;

  try {
    // 读取会话索引
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);

    if (Array.isArray(index) && index.length > 0) {
      // 优先恢复上次活跃的会话（而非按 created_at 排序取最新）
      const activeId = await getActiveSession(domain);
      if (activeId && index.some((s) => s.id === activeId)) {
        return activeId;
      }

      // 回退：按 created_at 降序排序，取第一个（最新的）
      const sorted = [...index].sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0),
      );
      return sorted[0].id;
    }

    // 没有会话，创建新会话
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    // 新会话条目
    const newSession = {
      id: sessionId,
      created_at: now,
    };

    // 更新索引
    const newIndex = [newSession];
    await chrome.storage.local.set({ [indexKey]: newIndex });

    console.log(
      `[Session] Created new session: ${sessionId} for domain: ${domain}`,
    );
    return sessionId;
  } catch (error) {
    console.error("[Session] Failed to get or create session:", error);
    throw error;
  }
}

// ============================================================================
// 会话元数据读写
// ============================================================================

/**
 * 加载会话元数据
 *
 * 从 chrome.storage.local 读取会话的元数据信息。
 * 如果元数据不存在，返回默认的元数据对象。
 *
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Object>} 返回会话元数据对象
 *
 * @example
 * // 加载已存在的元数据
 * const meta = await loadSessionMeta('github.com', 'abc123');
 * // meta: { title: '我的样式调整', created_at: 1234567890, message_count: 5 }
 *
 * // 加载不存在的元数据（返回默认值）
 * const newMeta = await loadSessionMeta('github.com', 'new-session-id');
 * // newMeta: { title: null, created_at: Date.now(), message_count: 0 }
 */
async function loadSessionMeta(domain, sessionId) {
  const key = `sessions:${domain}:${sessionId}:meta`;

  try {
    const result = await chrome.storage.local.get(key);

    // 如果存在元数据，返回它
    if (result[key]) {
      return result[key];
    }

    // 如果不存在，返回默认元数据
    return {
      title: null,
      created_at: Date.now(),
      message_count: 0,
    };
  } catch (error) {
    console.error("[Session] Failed to load session meta:", error);
    // 出错时也返回默认值，避免中断流程
    return {
      title: null,
      created_at: Date.now(),
      message_count: 0,
    };
  }
}

/**
 * 保存会话元数据
 *
 * 将会话元数据写入 chrome.storage.local。
 *
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @param {Object} meta - 会话元数据对象
 * @param {string|null} [meta.title] - 会话标题
 * @param {number} [meta.created_at] - 创建时间戳
 * @param {number} [meta.message_count] - 消息计数
 * @returns {Promise<void>}
 *
 * @example
 * await saveSessionMeta('github.com', 'abc123', {
 *   title: '深色模式调整',
 *   created_at: Date.now(),
 *   message_count: 3,
 *   activeStylesSummary: '5 条规则，涉及 body, .header 等'
 * });
 */
async function saveSessionMeta(domain, sessionId, meta) {
  const key = `sessions:${domain}:${sessionId}:meta`;

  try {
    await chrome.storage.local.set({ [key]: meta });
  } catch (error) {
    console.error("[Session] Failed to save session meta:", error);
    throw error;
  }
}

// ============================================================================
// 会话标题自动生成
// ============================================================================

/**
 * 自动生成会话标题
 *
 * 如果会话元数据中没有标题，则从首条用户消息中截取前 20 个字符作为标题。
 * 如果已有标题，则不做修改。
 *
 * @param {Object} sessionMeta - 会话元数据对象
 * @param {string|null} [sessionMeta.title] - 会话标题
 * @param {string} firstUserMessage - 首条用户消息内容
 * @returns {void} 直接修改 sessionMeta 对象
 *
 * @example
 * // 无标题时自动生成
 * const meta = { title: null, created_at: Date.now(), message_count: 0 };
 * autoTitle(meta, '把背景改成深蓝色');
 * console.log(meta.title); // '把背景改成深蓝色'
 *
 * @example
 * // 已有标题时不覆盖
 * const meta = { title: '我的样式调整', created_at: Date.now() };
 * autoTitle(meta, '把背景改成深蓝色');
 * console.log(meta.title); // '我的样式调整'（保持不变）
 *
 * @example
 * // 消息超过 20 字时截断
 * const meta = { title: null };
 * autoTitle(meta, '这是一条超过二十个字的用户消息内容会被截断');
 * console.log(meta.title); // '这是一条超过二十个字的用户消息'（20字）
 */
function autoTitle(sessionMeta, firstUserMessage) {
  if (!sessionMeta.title) {
    sessionMeta.title = firstUserMessage.slice(0, 20);
  }
}

// ============================================================================
// 会话删除
// ============================================================================

/**
 * 删除会话
 *
 * 从 chrome.storage.local 和 IndexedDB 中删除会话的所有相关数据：
 * 1. 从索引中移除会话条目
 * 2. 删除会话的 meta 和 styles 数据
 * 3. 删除 IndexedDB 中的对话历史
 *
 * 注意：permanent:{domain} 永久样式是域名级别的，不随会话删除。
 * 仅当删除最后一个会话时，返回 lastSession: true，由 UI 询问用户是否一并清除。
 *
 * @param {string} domain - 域名，如 'github.com'
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{lastSession: boolean, domain?: string}>} 返回删除结果，包含是否为最后会话的标识
 *
 * @example
 * // 删除普通会话
 * const result = await deleteSession('github.com', 'abc123');
 * // result: { lastSession: false }
 *
 * // 删除最后一个会话
 * const lastResult = await deleteSession('github.com', 'last-session-id');
 * // lastResult: { lastSession: true, domain: 'github.com' }
 */
async function deleteSession(domain, sessionId) {
  try {
    // 1. 从索引中移除
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
    const filtered = index.filter((s) => s.id !== sessionId);

    // 如果索引中没有该会话，直接返回
    if (filtered.length === index.length) {
      console.warn(`[Session] Session not found in index: ${sessionId}`);
      return { lastSession: false };
    }

    // 更新索引
    await chrome.storage.local.set({ [indexKey]: filtered });
    console.log(
      `[Session] Removed session ${sessionId} from index for domain: ${domain}`,
    );

    // 2. 删除会话数据（meta 和 styles）
    const metaKey = `sessions:${domain}:${sessionId}:meta`;
    const stylesKey = `sessions:${domain}:${sessionId}:styles`;
    await chrome.storage.local.remove([metaKey, stylesKey]);
    console.log(`[Session] Removed storage keys: ${metaKey}, ${stylesKey}`);

    // 3. 如果删除的是当前活跃会话，清除活跃记录
    const activeId = await getActiveSession(domain);
    if (activeId === sessionId) {
      await chrome.storage.local.remove(`sessions:${domain}:active`);
    }

    // 4. 删除 IndexedDB 中的对话历史
    await deleteHistory(domain, sessionId);
    console.log(
      `[Session] Removed IndexedDB history for session: ${sessionId}`,
    );

    // 5. 如果是该域名最后一个会话，返回标识
    if (filtered.length === 0) {
      console.log(`[Session] Deleted last session for domain: ${domain}`);
      return { lastSession: true, domain };
    }

    return { lastSession: false };
  } catch (error) {
    console.error("[Session] Failed to delete session:", error);
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
    const domainIndices = Object.entries(all).filter(([k]) =>
      k.match(/^sessions:.+:index$/),
    );

    for (const [indexKey, sessions] of domainIndices) {
      if (!Array.isArray(sessions)) continue;

      // 提取域名：sessions:{domain}:index
      const parts = indexKey.split(":");
      if (parts.length < 3) continue;
      const domain = parts[1];

      // 按创建时间排序，最新的在前（age 小的在前）
      const sorted = sessions
        .map((s) => ({ ...s, age: now - (s.created_at || 0) }))
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
        console.log(
          `[Cleanup] Removed ${toDelete.length} sessions for domain: ${domain}`,
        );
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
    console.error("[Cleanup] Storage cleanup failed:", error);
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
    const { StyleSkillStore } = await import("./style-skill.js");

    const skills = await StyleSkillStore.list();
    const MAX_STYLE_SKILLS = 50;

    if (skills.length <= MAX_STYLE_SKILLS) return;

    // 按创建时间降序排序，最新的在前
    const sorted = [...skills].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    );

    // 删除超出限制的最旧技能
    const toRemove = sorted.slice(MAX_STYLE_SKILLS);

    for (const skill of toRemove) {
      await StyleSkillStore.remove(skill.id);
    }

    if (toRemove.length > 0) {
      console.log(`[Cleanup] Removed ${toRemove.length} old style skills`);
    }
  } catch (error) {
    console.error("[Cleanup] Style skills cleanup failed:", error);
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
  return { bytes, maxBytes, percent: Math.round((bytes / maxBytes) * 100) };
}

// ============================================================================
// 样式摘要更新
// ============================================================================

/**
 * 更新样式摘要
 *
 * 读取当前会话的 CSS，统计规则数和前 3 个选择器，写入 meta.activeStylesSummary。
 * 用于 Session Context 注入，帮助 LLM 了解当前已应用的样式情况。
 *
 * @returns {Promise<void>}
 *
 * @example
 * // 当前会话有 CSS 样式时
 * // CSS: "body { background: #000; } .header { color: #fff; }"
 * // 生成摘要: "2 条规则，涉及 body, .header 等"
 * await updateStylesSummary();
 *
 * // 当前会话无 CSS 样式时
 * // 不生成摘要，直接返回
 */
async function updateStylesSummary() {
  // 检查是否有当前会话
  if (!currentSession) {
    console.warn("[Session] updateStylesSummary called without active session");
    return;
  }

  try {
    // 读取当前会话样式
    const key = currentSession.stylesKey;
    const { [key]: css = "" } = await chrome.storage.local.get(key);

    // 如果没有样式，不生成摘要
    if (!css.trim()) return;

    // 统计规则数（通过匹配 { 的数量）
    const ruleCount = (css.match(/\{/g) || []).length;

    // 提取前 3 个选择器
    // 匹配模式：选择器后面跟着 {
    const selectorMatches = css.match(/([^{}]+)\{/g);
    const selectors = selectorMatches
      ?.map((s) => s.replace("{", "").trim())
      .filter((s) => s.length > 0) // 过滤空字符串
      .slice(0, 3);

    // 生成摘要
    const summary = `${ruleCount} 条规则，涉及 ${selectors?.join(", ") || "未知"} 等`;

    // 写入 meta.activeStylesSummary
    const metaKey = currentSession.metaKey;
    const { [metaKey]: meta = {} } = await chrome.storage.local.get(metaKey);
    meta.activeStylesSummary = summary;
    await chrome.storage.local.set({ [metaKey]: meta });
  } catch (error) {
    console.error("[Session] Failed to update styles summary:", error);
    // 不抛出错误，避免中断流程
  }
}

// ============================================================================
// 时间旅行：逐轮快照辅助函数
// ============================================================================

/**
 * 统计 messages 中用户文本消息的数量（即"轮次数"）
 *
 * 一条 role === 'user' 且 content 为 string 的消息代表一轮的开始。
 * tool_result 消息（content 为数组）不计入轮次。
 *
 * @param {Array} messages - 对话历史数组
 * @returns {number} 用户文本消息的数量
 */
function countUserTextMessages(messages) {
  let count = 0;
  for (const msg of messages) {
    if (msg.role === "user" && typeof msg.content === "string") {
      count++;
    }
  }
  return count;
}

/**
 * 找到第 N 轮用户文本消息在 messages 数组中的索引
 *
 * @param {Array} messages - 对话历史数组
 * @param {number} turn - 目标轮次（从 1 开始）
 * @returns {number} 该轮用户消息在 messages 中的索引，未找到返回 -1
 */
function findTurnMessageIndex(messages, turn) {
  let count = 0;
  for (let i = 0; i < messages.length; i++) {
    if (
      messages[i].role === "user" &&
      typeof messages[i].content === "string"
    ) {
      count++;
      if (count === turn) return i;
    }
  }
  return -1;
}

/**
 * 回退到指定轮次（时间旅行）
 *
 * 截断对话历史到目标轮次结束的位置，恢复该轮的 CSS 快照，
 * 更新 chrome.storage 和 IndexedDB，并通过 loadSessionCSS 注入页面。
 *
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {number} targetTurn - 目标轮次（从 1 开始）
 * @returns {Promise<{messages: Array, snapshots: Object, css: string}>} 截断后的数据
 */
async function rewindToTurn(domain, sessionId, targetTurn) {
  const { messages, snapshots } = await loadAndPrepareHistory(
    domain,
    sessionId,
  );

  // 找到 targetTurn 轮用户消息的索引作为截断点
  // 点击第 N 轮回撤 = 删除第 N 轮及之后，保留 1 到 N-1 轮
  const turnStartIdx = findTurnMessageIndex(messages, targetTurn);
  const truncated =
    turnStartIdx === -1 ? messages : messages.slice(0, turnStartIdx);

  // 查找目标轮次前一轮的 CSS 快照（向前取最近的）
  // 因为要删除 targetTurn 轮，所以恢复到 targetTurn-1 轮的状态
  let css = "";
  for (let t = targetTurn - 1; t >= 0; t--) {
    if (snapshots[t] !== undefined) {
      css = snapshots[t];
      break;
    }
  }

  // 裁剪快照：删除 key >= targetTurn 的条目
  const prunedSnapshots = {};
  for (const [k, v] of Object.entries(snapshots)) {
    if (Number(k) < targetTurn) {
      prunedSnapshots[k] = v;
    }
  }

  // 写回 IndexedDB
  await saveHistory(domain, sessionId, {
    messages: truncated,
    snapshots: prunedSnapshots,
  });

  // 更新 chrome.storage 中的 stylesKey 和 activeStylesKey
  const session = new SessionContext(domain, sessionId);
  if (css.trim()) {
    await chrome.storage.local.set({
      [session.stylesKey]: css,
      [session.activeStylesKey]: css,
    });
  } else {
    await chrome.storage.local.remove([
      session.stylesKey,
      session.activeStylesKey,
    ]);
  }

  // 更新样式摘要
  const prevSession = currentSession;
  currentSession = session;
  await updateStylesSummary();
  currentSession = prevSession;

  return { messages: truncated, snapshots: prunedSnapshots, css };
}

// ============================================================================
// 导出
// ============================================================================

// 导出常量供其他模块使用
export { DB_NAME, DB_VERSION, STORE_NAME, CURRENT_SCHEMA_VERSION };
export { MAX_SESSIONS_PER_DOMAIN, SESSION_EXPIRE_DAYS };

// 导出函数
export {
  openDB,
  closeDB,
  saveHistory,
  loadHistory,
  deleteHistory,
  checkAndMigrateStorage,
};
export { cleanupStorage, cleanupStyleSkills, getStorageUsage };
export { getOrCreateSession, deleteSession, setActiveSession, getActiveSession };
export { loadSessionMeta, saveSessionMeta };
export { loadAndPrepareHistory };
export { autoTitle };
export { updateStylesSummary };
export { countUserTextMessages, rewindToTurn };
export { setCurrentSession, getCurrentSession };

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
    openDB().catch((err) => {
      console.error("[Storage] Failed to initialize IndexedDB:", err);
    });

    console.log("[Storage] Storage layer initialized successfully");
  } catch (error) {
    console.error("[Storage] Storage initialization failed:", error);
  }
}

// 导出初始化函数
export { initStorage };

// 自动执行初始化（模块加载时立即运行）
// 注意：这是 IIFE 模式，确保在模块导入时执行
initStorage();
