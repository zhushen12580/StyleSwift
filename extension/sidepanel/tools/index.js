/**
 * StyleSwift - Tools Module Entry
 *
 * Re-exports all tool-related definitions and functions for backward compatibility.
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
} from "./registry.js";

// Re-export tool definitions for external use
export {
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
} from "./page-tools.js";

export {
  APPLY_STYLES_TOOL,
  GET_CURRENT_STYLES_TOOL,
  EDIT_CSS_TOOL,
} from "./style-tools.js";

export {
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
} from "./profile-tools.js";

export {
  LOAD_SKILL_TOOL,
  SAVE_STYLE_SKILL_TOOL,
  LIST_STYLE_SKILLS_TOOL,
  DELETE_STYLE_SKILL_TOOL,
} from "./skill-tools.js";

export {
  TODO_WRITE_TOOL,
  TASK_TOOL,
} from "./task-tools.js";

export {
  CAPTURE_SCREENSHOT_TOOL,
} from "./screenshot-tools.js";