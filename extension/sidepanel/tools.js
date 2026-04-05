/**
 * StyleSwift - Tools Module
 *
 * This file is now a re-export entry point for the modularized tools.
 * All tool definitions and handlers have been moved to the tools/ subdirectory.
 *
 * Modules:
 * - tools/registry.js: Central registry, tool execution, and core functions
 * - tools/page-tools.js: Page structure and element search tools
 * - tools/style-tools.js: CSS style management tools
 * - tools/profile-tools.js: User profile tools
 * - tools/skill-tools.js: Style skill management tools
 * - tools/task-tools.js: TodoWrite and Task tools
 * - tools/screenshot-tools.js: Screenshot capture tool
 * - tools/index.js: Full exports for external modules
 */

export {
  // Tool collections
  BASE_TOOLS,
  SUBAGENT_TOOLS,
  ALL_TOOLS,
  // Tab management
  getTargetTabId,
  lockTab,
  unlockTab,
  getTargetDomain,
  sendToContentScript,
  normalizeToolResult,
  // Tool execution
  executeTool,
  // Skill manager
  getSkillManager,
  // Style operations
  runApplyStyles,
  runEditCSS,
  // Skill operations
  runLoadSkill,
  runSaveStyleSkill,
  runListStyleSkills,
  runDeleteStyleSkill,
  // Screenshot
  captureScreenshot,
} from "./tools/index.js";