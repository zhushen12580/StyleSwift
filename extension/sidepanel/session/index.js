/**
 * StyleSwift - Session Module Entry
 *
 * Re-exports all session-related functions and constants for backward compatibility.
 */

// Constants
export {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  STYLES_HISTORY_STORE,
  MAX_SESSIONS_PER_DOMAIN,
  SESSION_EXPIRE_DAYS,
  CURRENT_SCHEMA_VERSION,
  QUOTA_THRESHOLD_PERCENT,
} from "./constants.js";

// Storage operations
export {
  openDB,
  closeDB,
  saveHistory,
  loadHistory,
  deleteHistory,
  saveStylesHistory,
  loadStylesHistory,
  deleteStylesHistory,
  checkAndMigrateStorage,
  checkQuotaAndMigrate,
  migrateSessionStylesHistory,
  getStorageUsage,
} from "./storage.js";

// Session management
export {
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
} from "./manager.js";