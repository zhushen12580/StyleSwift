/**
 * StyleSwift - Session Storage Module
 *
 * This file is now a re-export entry point for the modularized session module.
 * All session-related functions have been moved to the session/ subdirectory.
 *
 * Modules:
 * - session/constants.js: Shared constants (DB_NAME, limits, etc.)
 * - session/storage.js: IndexedDB and chrome.storage operations
 * - session/context.js: SessionContext class and current session
 * - session/manager.js: Session CRUD, cleanup, and time-travel
 * - session/index.js: Full exports for external modules
 */

export {
  // Constants
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  STYLES_HISTORY_STORE,
  MAX_SESSIONS_PER_DOMAIN,
  SESSION_EXPIRE_DAYS,
  CURRENT_SCHEMA_VERSION,
  QUOTA_THRESHOLD_PERCENT,
  // Storage operations
  openDB,
  closeDB,
  saveHistory,
  loadHistory,
  deleteHistory,
  saveStylesHistory,
  loadStylesHistory,
  deleteStylesHistory,
  checkQuotaAndMigrate,
  migrateSessionStylesHistory,
  getStorageUsage,
  // Session management
  SessionContext,
  currentSession,
  setCurrentSession,
  getCurrentSession,
  setActiveSession,
  getActiveSession,
  getOrCreateSession,
  loadSessionMeta,
  saveSessionMeta,
  autoTitle,
  deleteSession,
  updateStylesSummary,
  loadAndPrepareHistory,
  countUserTextMessages,
  rewindToTurn,
  cleanupStorage,
} from "./session/index.js";

// =============================================================================
// 初始化（Side Panel 启动时执行）
// =============================================================================

import { checkAndMigrateStorage } from "./session/storage.js";
import { openDB, checkQuotaAndMigrate } from "./session/storage.js";

/**
 * 初始化存储层
 */
async function initStorage() {
  try {
    const { CURRENT_SCHEMA_VERSION } = await import("./session/constants.js");
    await checkAndMigrateStorage(CURRENT_SCHEMA_VERSION);

    openDB().catch((err) => {
      console.error("[Storage] Failed to initialize IndexedDB:", err);
    });

    checkQuotaAndMigrate().then((result) => {
      if (result.migrated) {
        console.log(`[Storage] Auto-migrated ${result.migratedCount} style histories to IndexedDB`);
      }
    }).catch((err) => {
      console.error("[Storage] Quota check failed:", err);
    });

    console.log("[Storage] Storage layer initialized successfully");
  } catch (error) {
    console.error("[Storage] Storage initialization failed:", error);
  }
}

export { initStorage };

// 自动执行初始化（模块加载时立即运行）
initStorage();