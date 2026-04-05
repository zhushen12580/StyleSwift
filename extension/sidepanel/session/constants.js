/**
 * StyleSwift - Session Constants
 *
 * Shared constants for session management.
 */

// IndexedDB 配置常量
export const DB_NAME = "StyleSwiftDB";
export const DB_VERSION = 2; // v2: 添加 styles_history store
export const STORE_NAME = "conversations";
export const STYLES_HISTORY_STORE = "styles_history"; // 存储 CSS 历史栈

// 存储清理常量
export const MAX_SESSIONS_PER_DOMAIN = 20;
export const SESSION_EXPIRE_DAYS = 90;

// Storage Schema 版本
export const CURRENT_SCHEMA_VERSION = 1;

// 存储配额阈值
export const QUOTA_THRESHOLD_PERCENT = 80;