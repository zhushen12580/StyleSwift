/**
 * StyleSwift - Session Context
 *
 * SessionContext class and current session management.
 */

// =============================================================================
// SessionContext 类
// =============================================================================

/**
 * 会话上下文类
 *
 * 基于 Chrome Storage key 映射，为每个会话生成标准化的存储 key 路径。
 */
export class SessionContext {
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
   * 获取会话样式历史的 chrome.storage.local key
   * @returns {string} 格式: 'sessions:{domain}:{sessionId}:styles_history'
   */
  get stylesHistoryKey() {
    return `sessions:${this.domain}:${this.sessionId}:styles_history`;
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

  /**
   * 获取域名永久样式的 chrome.storage.local key
   * @returns {string} 格式: 'persistent:{domain}'
   */
  get persistKey() {
    return `persistent:${this.domain}`;
  }
}

// =============================================================================
// 当前会话管理
// =============================================================================

/**
 * 当前会话的 SessionContext 实例
 * @type {SessionContext|null}
 */
export let currentSession = null;

/**
 * 设置当前会话
 *
 * @param {SessionContext|null} session - 会话上下文实例
 */
export function setCurrentSession(session) {
  currentSession = session;
}

/**
 * 获取当前会话
 *
 * @returns {SessionContext|null} 当前会话上下文实例
 */
export function getCurrentSession() {
  return currentSession;
}