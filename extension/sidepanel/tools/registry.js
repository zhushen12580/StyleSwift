/**
 * StyleSwift - Tools Registry
 *
 * Central registry for tool definitions, tool assembly, and execution.
 * Exports BASE_TOOLS, SUBAGENT_TOOLS, ALL_TOOLS for use by agent-loop.
 */

import {
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
  createPageToolHandlers,
} from "./page-tools.js";
import {
  APPLY_STYLES_TOOL,
  GET_CURRENT_STYLES_TOOL,
  EDIT_CSS_TOOL,
  createStyleToolHandlers,
} from "./style-tools.js";
import {
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
  createProfileToolHandlers,
} from "./profile-tools.js";
import {
  LOAD_SKILL_TOOL,
  SAVE_STYLE_SKILL_TOOL,
  LIST_STYLE_SKILLS_TOOL,
  DELETE_STYLE_SKILL_TOOL,
  createSkillToolHandlers,
} from "./skill-tools.js";
import {
  TODO_WRITE_TOOL,
  TASK_TOOL,
  createTaskToolHandlers,
} from "./task-tools.js";
import {
  CAPTURE_SCREENSHOT_TOOL,
  captureScreenshot as doCaptureScreenshot,
  createScreenshotToolHandlers,
} from "./screenshot-tools.js";

import { mergeCSS, checkBraceBalance, repairBraces } from "../css-merge.js";
import { StyleSkillStore } from "../style-skill.js";
import { createSkillManager } from "../skill-loader.js";
import { validateToolArgs } from "../schema-validator.js";

// Re-export for backward compatibility
export { captureScreenshot } from "./screenshot-tools.js";

// =============================================================================
// Tool Collections
// =============================================================================

const BASE_TOOLS = [
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
  APPLY_STYLES_TOOL,
  GET_CURRENT_STYLES_TOOL,
  EDIT_CSS_TOOL,
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
  LOAD_SKILL_TOOL,
  SAVE_STYLE_SKILL_TOOL,
  LIST_STYLE_SKILLS_TOOL,
  DELETE_STYLE_SKILL_TOOL,
  TODO_WRITE_TOOL,
];

const SUBAGENT_TOOLS = [...BASE_TOOLS, CAPTURE_SCREENSHOT_TOOL];

const ALL_TOOLS = [...BASE_TOOLS, TASK_TOOL];

/**
 * 工具名 → input_schema 查找表，供运行时 schema 校验使用。
 * 由 ALL_TOOLS 自动构建，无需手动维护。
 *
 * @type {Map<string, object>}
 */
const TOOL_SCHEMA_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t.input_schema]));

// =============================================================================
// Skill Manager - 统一管理静态技能和用户技能
// =============================================================================

/** @type {import('../skill-loader.js').UnifiedSkillManager|null} */
let skillManager = null;

/**
 * 获取或初始化 Skill Manager
 * @returns {Promise<import('../skill-loader.js').UnifiedSkillManager>}
 */
async function getSkillManager() {
  if (!skillManager) {
    skillManager = await createSkillManager(chrome.runtime.id, StyleSkillStore);
  }
  return skillManager;
}

// =============================================================================
// Tab 锁定机制
// =============================================================================

/**
 * 锁定的 Tab ID
 * Agent 启动时锁定当前 Tab，全程操作该 Tab，不跟随用户切换
 */
let lockedTabId = null;

/**
 * 获取目标 Tab ID
 * 优先返回锁定的 Tab ID，否则获取当前活跃 Tab
 * @returns {Promise<number>} Tab ID
 */
async function getTargetTabId() {
  if (lockedTabId) return lockedTabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error("没有可用的活跃标签页");
  }
  return tab.id;
}

/**
 * 锁定指定 Tab
 * @param {number} tabId - 要锁定的 Tab ID
 */
function lockTab(tabId) {
  lockedTabId = tabId;
}

/**
 * 解锁 Tab
 */
function unlockTab() {
  lockedTabId = null;
}

/**
 * 通过 Content Script 获取目标 Tab 的域名
 * @returns {Promise<string>} 域名，失败时返回 'unknown'
 */
async function getTargetDomain() {
  const tabId = await getTargetTabId();
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { tool: "get_domain" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "getTargetDomain failed:",
          chrome.runtime.lastError.message,
        );
        resolve("unknown");
      } else {
        resolve(response || "unknown");
      }
    });
  });
}

/**
 * 发送消息到 Content Script
 * @param {object} message - 要发送的消息对象
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
 * @returns {Promise<any>} Content Script 的响应
 * @throws {Error} Content Script 不可用时抛出错误
 */
async function sendToContentScript(message, tabId) {
  const targetTabId = tabId ?? (await getTargetTabId());
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(targetTabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            `Content Script 不可用: ${chrome.runtime.lastError.message}`,
          ),
        );
      } else if (response && typeof response === "object" && response.error) {
        reject(new Error(`Content Script 执行错误: ${response.error}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 将工具返回值规范化为字符串
 * @param {any} value - 工具返回值
 * @returns {string} 字符串化的返回值
 */
function normalizeToolResult(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "(无结果)";
  return JSON.stringify(value);
}

// =============================================================================
// Style Operations
// =============================================================================

// Import session functions dynamically to avoid circular deps
let currentSession = null;
let updateStylesSummary = null;
let loadStylesHistory = null;
let saveStylesHistory = null;
let checkQuotaAndMigrate = null;

async function initSessionDeps() {
  const session = await import("../session.js");
  currentSession = session.currentSession;
  updateStylesSummary = session.updateStylesSummary;
  loadStylesHistory = session.loadStylesHistory;
  saveStylesHistory = session.saveStylesHistory;
  checkQuotaAndMigrate = session.checkQuotaAndMigrate;
}

/**
 * 使用 chrome.scripting.insertCSS 注入样式（CSP 方案 3）
 */
async function injectCSSViaScriptingAPI(css, tabId) {
  const targetTabId = tabId ?? (await getTargetTabId());
  await chrome.scripting.insertCSS({
    target: { tabId: targetTabId },
    css,
  });
}

/**
 * 将当前会话的样式同步到 active_styles:{domain}
 */
async function syncActiveStyles() {
  const aKey = currentSession.activeStylesKey;
  const sKey = currentSession.stylesKey;
  const { [sKey]: sessionCSS = "" } = await chrome.storage.local.get(sKey);
  if (sessionCSS.trim()) {
    await chrome.storage.local.set({ [aKey]: sessionCSS });
  } else {
    await chrome.storage.local.remove(aKey);
  }
}

/**
 * 应用或回滚 CSS 样式
 */
async function runApplyStyles(css, mode, tabId) {
  await initSessionDeps();

  if (!currentSession) {
    throw new Error("[runApplyStyles] 没有活动的会话");
  }

  try {
    const sKey = currentSession.stylesKey;
    const domain = currentSession.domain;
    const sessionId = currentSession.sessionId;
    const MAX_HISTORY = 20;

    // === rollback_last 模式 ===
    if (mode === "rollback_last") {
      const history = await loadStylesHistory(domain, sessionId);

      if (history.length <= 1) {
        return "没有可回滚的历史。当前无已应用样式或已是最初状态。";
      }

      history.pop();
      const newCSS = history.length > 0 ? history[history.length - 1] : "";

      if (newCSS.trim()) {
        await chrome.storage.local.set({ [sKey]: newCSS });
        await saveStylesHistory(domain, sessionId, history);
        await sendToContentScript({
          tool: "replace_css",
          args: { css: newCSS }
        }, tabId);
      } else {
        await chrome.storage.local.remove(sKey);
        await saveStylesHistory(domain, sessionId, []);
        await sendToContentScript({
          tool: "rollback_css",
          args: { scope: "all" }
        }, tabId);
      }

      await syncActiveStyles();
      await updateStylesSummary();

      return newCSS.trim()
        ? `已回滚到上一次样式（历史栈: ${history.length} 层）。`
        : "已回滚所有样式。当前无已应用样式。";
    }

    // === rollback_all 模式 ===
    if (mode === "rollback_all") {
      await sendToContentScript({
        tool: "rollback_css",
        args: { scope: "all" },
      }, tabId);
      await chrome.storage.local.remove(sKey);
      await saveStylesHistory(domain, sessionId, []);
      await syncActiveStyles();
      await updateStylesSummary();
      return "已回滚所有样式。当前无已应用样式。";
    }

    // === save 模式 ===
    if (mode === "save") {
      if (!css || !css.trim()) {
        throw new Error("[runApplyStyles] save 模式需要提供 CSS 代码");
      }

      const migrationResult = await checkQuotaAndMigrate();
      if (migrationResult.migrated) {
        console.log(`[runApplyStyles] 已迁移 ${migrationResult.migratedCount} 个历史到 IndexedDB`);
      }

      const { balanced, depth } = checkBraceBalance(css);
      if (!balanced) {
        console.warn('[StyleSwift] AI 提交的 CSS 花括号不平衡，depth:', depth, '| 自动修复后继续');
        css = repairBraces(css);
      }

      const injectResp = await sendToContentScript({
        tool: "inject_css",
        args: { css },
      }, tabId);
      if (injectResp && injectResp.fallback === "scripting-api") {
        await injectCSSViaScriptingAPI(injectResp.css, tabId);
      }

      const { [sKey]: existing = "" } = await chrome.storage.local.get(sKey);
      const merged = mergeCSS(existing, css);
      await chrome.storage.local.set({ [sKey]: merged });

      const history = await loadStylesHistory(domain, sessionId);
      history.push(merged);
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
      await saveStylesHistory(domain, sessionId, history);

      await syncActiveStyles();
      await updateStylesSummary();

      return `样式已应用（历史栈: ${history.length} 层）。`;
    }

    throw new Error(`[runApplyStyles] 未知模式: ${mode}`);
  } catch (error) {
    console.error("[runApplyStyles] 执行失败:", error);
    throw error;
  }
}

/**
 * 精准编辑已应用的 CSS 样式
 */
async function runEditCSS(oldCSS, newCSS, tabId) {
  await initSessionDeps();

  if (!currentSession) {
    throw new Error("[runEditCSS] 没有活动的会话");
  }

  const sKey = currentSession.stylesKey;
  const { [sKey]: stored = "" } = await chrome.storage.local.get(sKey);

  if (!stored || !stored.includes(oldCSS)) {
    return `编辑失败：未找到匹配的 CSS 片段。请确保 old_css 与 [当前已应用样式] 中的内容完全一致。`;
  }

  const updated = stored.replace(oldCSS, newCSS);
  const trimmed = updated.trim();

  if (trimmed) {
    await chrome.storage.local.set({ [sKey]: trimmed });
  } else {
    await chrome.storage.local.remove(sKey);
  }

  await sendToContentScript({ tool: "replace_css", args: { css: trimmed } }, tabId);
  await syncActiveStyles();
  await updateStylesSummary();

  if (trimmed) {
    return `样式已更新。`;
  }
  return "样式已全部删除。当前无已应用样式。";
}

// =============================================================================
// Skill Operations
// =============================================================================

async function runLoadSkill(skillName) {
  const manager = await getSkillManager();
  return await manager.getContent(skillName);
}

async function runSaveStyleSkill(name, mood, skillContent) {
  await initSessionDeps();

  const id = crypto.randomUUID().slice(0, 8);
  const sourceDomain = currentSession?.domain || "unknown";
  const header = `# ${name}\n\n> 来源: ${sourceDomain} | 创建: ${new Date().toLocaleDateString()}\n> 风格: ${mood || ""}\n\n`;
  const fullContent = skillContent.startsWith("# ")
    ? skillContent
    : header + skillContent;

  await StyleSkillStore.save(id, name, mood || "", sourceDomain, fullContent);

  return `已保存风格技能「${name}」(id: ${id})，可在任意网站通过 load_skill('skill:${id}') 加载使用。`;
}

async function runListStyleSkills() {
  const skills = await StyleSkillStore.list();

  if (skills.length === 0) {
    return "(暂无保存的风格技能)";
  }

  return skills
    .map(
      (s) =>
        `- skill:${s.id}「${s.name}」${s.mood ? `— ${s.mood}` : ""} (来自 ${s.sourceDomain}, ${new Date(s.createdAt).toLocaleDateString()})`,
    )
    .join("\n");
}

async function runDeleteStyleSkill(skillId) {
  const skills = await StyleSkillStore.list();
  const target = skills.find((s) => s.id === skillId);

  if (!target) {
    return `未找到技能: ${skillId}`;
  }

  await StyleSkillStore.remove(skillId);

  return `已删除风格技能「${target.name}」`;
}

// =============================================================================
// Tool Handlers Assembly
// =============================================================================

/**
 * 构建 TOOL_HANDLERS dispatch map
 */
function buildToolHandlers() {
  const pageHandlers = createPageToolHandlers(sendToContentScript, normalizeToolResult);

  const styleHandlers = createStyleToolHandlers({
    runApplyStyles,
    runEditCSS,
    sendToContentScript,
    getCurrentSession: () => currentSession,
  });

  const profileHandlers = createProfileToolHandlers();

  const skillHandlers = createSkillToolHandlers({
    runLoadSkill,
    runSaveStyleSkill,
    runListStyleSkills,
    runDeleteStyleSkill,
  });

  const taskHandlers = createTaskToolHandlers();

  const screenshotHandlers = createScreenshotToolHandlers((tabId) =>
    doCaptureScreenshot(tabId, getTargetTabId)
  );

  return {
    ...pageHandlers,
    ...styleHandlers,
    ...profileHandlers,
    ...skillHandlers,
    ...taskHandlers,
    ...screenshotHandlers,
  };
}

const TOOL_HANDLERS = buildToolHandlers();

/**
 * 工具执行器统一分派器
 */
async function executeTool(name, args, context) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return `未知工具: ${name}`;
  }

  // Schema 校验
  const schema = TOOL_SCHEMA_MAP.get(name);
  if (schema) {
    const { valid, errors } = validateToolArgs(schema, args);
    if (!valid) {
      const errorList = errors.map((e) => `  • ${e}`).join("\n");
      console.warn(`[Schema] 工具 "${name}" 参数校验失败：\n${errorList}`);
      return (
        `[参数校验失败] 工具 "${name}" 的调用参数不合法：\n${errorList}\n\n` +
        `请根据以上错误修正参数，然后重新调用该工具。`
      );
    }
  }

  return await handler(args, context);
}

// =============================================================================
// Exports
// =============================================================================

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
};