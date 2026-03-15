/**
 * StyleSwift - Tool Definitions
 * 定义所有工具的 JSON Schema，供 Agent Loop 使用
 */

// 导入依赖模块
import { currentSession, updateStylesSummary } from "./session.js";
import { mergeCSS, checkBraceBalance, repairBraces } from "./css-merge.js";
import { StyleSkillStore } from "./style-skill.js";
import { createSkillManager } from "./skill-loader.js";

// =============================================================================
// §3.1 get_page_structure - 获取页面结构
// =============================================================================

const GET_PAGE_STRUCTURE_TOOL = {
  name: "get_page_structure",
  description:
    "获取当前页面的结构概览。返回树形结构，包含标签、选择器、关键样式。",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// §3.2 grep - 元素搜索
// =============================================================================

const GREP_TOOL = {
  name: "grep",
  description: `在当前页面中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）。

搜索方式（自动检测）：
- CSS 选择器：".sidebar", "nav > a.active", "#main h2"
- 关键词：在标签名、class、id、文本内容、样式值中匹配

典型用途：
- 看完 get_page_structure 概览后，深入查看某个区域的详情
- 查找具有特定样式值的元素
- 确认某个选择器是否存在、有多少匹配`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "CSS 选择器或关键词" },
      scope: {
        type: "string",
        enum: ["self", "children", "subtree"],
        description:
          "返回详情范围：self=仅匹配元素本身，children=含直接子元素（默认），subtree=含完整子树（慎用）",
      },
      max_results: {
        type: "integer",
        description: "最多返回几个匹配元素，默认 5，最大 20",
      },
    },
    required: ["query"],
  },
};

// =============================================================================
// §3.3 apply_styles - 应用/回滚样式
// =============================================================================

const APPLY_STYLES_TOOL = {
  name: "apply_styles",
  description: `应用或回滚CSS样式。

mode 说明：
- save: 注入CSS到页面并保存到当前会话（添加全新规则时使用）
- rollback_last: 回滚到上一次样式（撤销最近一次修改）
- rollback_all: 回滚所有已应用的样式

修改已有样式请用 edit_css 工具（更精准、省token）。`,
  input_schema: {
    type: "object",
    properties: {
      css: {
        type: "string",
        description: "CSS代码（save 模式必填，rollback 模式不需要）",
      },
      mode: {
        type: "string",
        enum: ["save", "rollback_last", "rollback_all"],
        description: "save=应用并保存, rollback_last=撤销最近一次修改, rollback_all=全部回滚",
      },
    },
    required: ["mode"],
  },
};

// =============================================================================
// §3.4 get_user_profile - 获取用户画像
// =============================================================================

const GET_USER_PROFILE_TOOL = {
  name: "get_user_profile",
  description: `获取用户的风格偏好画像。包含用户在历史对话中表现出的风格偏好。
新用户可能为空。建议在以下情况获取：
- 新会话开始时，了解用户已知偏好
- 用户请求模糊（如"好看点"），需参考历史偏好`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// §3.5 update_user_profile - 更新用户画像
// =============================================================================

const UPDATE_USER_PROFILE_TOOL = {
  name: "update_user_profile",
  description: `记录从当前对话中学到的用户风格偏好。
当发现新的偏好信号时调用：
- 用户明确表达："我喜欢圆角"
- 用户通过修正暗示："太黑了，用深蓝" → 偏好深蓝不是纯黑
- 反复的选择模式

记录有意义的偏好洞察，不记录具体 CSS 代码。
content 为完整的画像内容（覆盖写入），应在读取现有画像基础上整合新洞察。`,
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "完整的用户画像内容（覆盖写入）",
      },
    },
    required: ["content"],
  },
};

// =============================================================================
// §3.6 load_skill - 加载领域知识/风格技能
// =============================================================================

const LOAD_SKILL_TOOL = {
  name: "load_skill",
  description: `加载领域知识或用户保存的风格技能。

内置知识（自动发现）：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

用户风格技能（通过 save_style_skill 创建）：
- 通过 list_style_skills 查看可用的用户技能
- 使用 skill:{id} 格式加载，如 skill:a1b2c3d4

加载用户风格技能后，根据其中的色彩方案、排版、视觉效果等描述，
结合当前页面的 DOM 结构，生成适配的 CSS。不要直接复制参考 CSS 中的选择器。`,
  input_schema: {
    type: "object",
    properties: {
      skill_name: {
        type: "string",
        description: "内置知识名称，或 skill:{id} 加载用户风格技能",
      },
    },
    required: ["skill_name"],
  },
};

// =============================================================================
// §3.7 save_style_skill - 保存风格技能
// =============================================================================

const SAVE_STYLE_SKILL_TOOL = {
  name: "save_style_skill",
  description: `从当前会话中提取视觉风格特征，保存为可复用的风格技能。

⚠️ 重要：此工具**只能**在用户**明确要求**时调用！

必须等待用户说以下类似的话才能调用：
- "保存这个风格" / "保存当前风格"
- "把这个风格做成模板" / "创建风格模板"
- "我想在其他网站也用这个风格"
- "帮我保存风格技能"

❌ 禁止自动调用：即使你对当前样式效果很满意，也不能主动保存，必须等待用户明确请求。`,
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: '风格名称，如"赛博朋克"、"清新日式"',
      },
      mood: { type: "string", description: "一句话风格描述" },
      skill_content: {
        type: "string",
        description: `风格技能文档（markdown 格式），必须包含：
1. 风格描述（自然语言，说明整体视觉感受和设计理念）
2. 色彩方案（列出背景/文字/强调/边框等具体色值）
3. 排版（标题/正文/代码的字体、字重、行高偏好）
4. 视觉效果（圆角、阴影、过渡、特殊效果）
5. 设计意图（用户想要达到的效果，为什么做这些选择）
6. 参考 CSS（当前会话生成的 CSS 片段，标注选择器不可直接复用）

重点：提取抽象的风格特征，不是复制具体 CSS。选择器是页面特定的，色彩/排版/效果才是可迁移的。`,
      },
    },
    required: ["name", "skill_content"],
  },
};

// =============================================================================
// §3.8 list_style_skills - 列出风格技能
// =============================================================================

const LIST_STYLE_SKILLS_TOOL = {
  name: "list_style_skills",
  description: `列出用户保存的所有风格技能。
当用户提到"我之前保存的风格"、"用我的XX风格"时，先调用此工具查看可用技能。`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// §3.9 delete_style_skill - 删除风格技能
// =============================================================================

const DELETE_STYLE_SKILL_TOOL = {
  name: "delete_style_skill",
  description: "删除一个用户保存的风格技能。",
  input_schema: {
    type: "object",
    properties: {
      skill_id: { type: "string", description: "要删除的技能 ID" },
    },
    required: ["skill_id"],
  },
};

// =============================================================================
// §3.10.1 get_current_styles - 获取当前已应用样式
// =============================================================================

const GET_CURRENT_STYLES_TOOL = {
  name: "get_current_styles",
  description: `获取当前会话中已应用的全部CSS样式。

典型用途：
- 修改样式前先查看当前已有哪些规则
- 为 edit_css 获取精确的 old_css 内容
- 确认某条规则是否已经应用`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// §3.10 edit_css - 精准编辑已应用样式
// =============================================================================

const EDIT_CSS_TOOL = {
  name: "edit_css",
  description: `精准编辑已应用的CSS样式。通过精确匹配替换CSS片段，支持修改和删除。

使用方式：
- 先调用 get_current_styles 查看当前样式
- old_css 必须与 get_current_styles 返回内容精确匹配，包含空格和换行
- new_css 为替换后的内容，空字符串表示删除该片段
- 每次只替换第一处匹配

典型用途：
- 修改某个属性值（如改颜色、调字号）
- 删除某条规则
- 替换某个选择器的整个规则块`,
  input_schema: {
    type: "object",
    properties: {
      old_css: {
        type: "string",
        description: "要替换的 CSS 片段，必须与当前已应用样式中的内容精确匹配",
      },
      new_css: {
        type: "string",
        description: "替换后的 CSS 内容，空字符串表示删除",
      },
    },
    required: ["old_css", "new_css"],
  },
};

// =============================================================================
// §3.11 capture_screenshot - 截取页面可见区域
// =============================================================================

const CAPTURE_SCREENSHOT_TOOL = {
  name: "capture_screenshot",
  description: "截取当前页面可见区域的截图，用于视觉分析页面样式效果。",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

/**
 * 截取指定 Tab 的可见区域
 *
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
 * @returns {Promise<string>} base64 Data URL（data:image/png;base64,...）
 */
async function captureScreenshot(tabId) {
  const targetTabId = tabId ?? (await getTargetTabId());
  const tab = await chrome.tabs.get(targetTabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  return dataUrl;
}

// =============================================================================
// §五、TodoWrite - 任务列表管理
// =============================================================================

const TODO_WRITE_TOOL = {
  name: "TodoWrite",
  description: `更新任务列表。用于规划和追踪复杂任务的进度。

使用场景：
- 用户请求涉及多个步骤的复杂任务
- 需要将大任务分解为子任务
- 需要追踪任务完成进度

工作模式：
1. 规划模式（首次调用）：传入完整任务数组，设置所有任务状态为 pending
   例：todos: [{content: "获取页面结构", status: "pending"}, {content: "修改导航样式", status: "pending"}]

2. 更新模式（后续调用）：传入任务 id 和新状态，更新单个任务进度
   例：todos: [{id: "todo_1", status: "in_progress"}] 或 [{id: "todo_1", status: "completed"}]

状态流转：pending → in_progress → completed
- 开始任务时标记为 in_progress
- 完成任务后标记为 completed

简单任务（单步操作）不需要使用此工具。`,
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description:
          "任务数组。规划模式：每项包含 content 和 status；更新模式：每项包含 id 和要更新的字段",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "任务 ID（更新模式必填，由首次调用返回）",
            },
            content: {
              type: "string",
              description: "任务描述（规划模式必填）",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "任务状态",
            },
          },
        },
      },
    },
    required: ["todos"],
  },
};

// =============================================================================
// §4.2 Task Tool - 子智能体调用
// =============================================================================

const TASK_TOOL = {
  name: "Task",
  description: `调用子智能体处理复杂任务。
子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- QualityAudit: 样式质检专家，验证已应用CSS的视觉效果、可访问性和一致性

使用场景：
- 应用了较多样式（5+条规则）后需要质检
- 全局色彩/主题变更后验证效果
- 用户反馈样式有问题，需要系统性排查`,
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "任务简短描述（3-5字）" },
      prompt: { type: "string", description: "详细的任务指令" },
      agent_type: {
        type: "string",
        enum: ["QualityAudit"],
        description: "子智能体类型",
      },
    },
    required: ["description", "prompt", "agent_type"],
  },
};

// =============================================================================
// 导出所有工具定义
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

const ALL_TOOLS = [...BASE_TOOLS, TASK_TOOL, CAPTURE_SCREENSHOT_TOOL];

// =============================================================================
// Skill Manager - 统一管理静态技能和用户技能
// =============================================================================

/** @type {import('./skill-loader.js').UnifiedSkillManager|null} */
let skillManager = null;

/**
 * 获取或初始化 Skill Manager
 * @returns {Promise<import('./skill-loader.js').UnifiedSkillManager>}
 */
async function getSkillManager() {
  if (!skillManager) {
    skillManager = await createSkillManager(chrome.runtime.id, StyleSkillStore);
  }
  return skillManager;
}

// =============================================================================
// §2.5 多 Tab 场景处理 - Tab 锁定机制
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
 * 不需要 tabs 权限读取 tab.url，通过 Content Script 的 location.hostname 获取
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
 * 优先使用显式传入的 tabId，否则 fallback 到锁定的 Tab
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
 * LLM 的 tool_result content 必须是字符串类型
 * @param {any} value - 工具返回值
 * @returns {string} 字符串化的返回值
 */
function normalizeToolResult(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "(无结果)";
  return JSON.stringify(value);
}

// =============================================================================
// §3.3.2 Side Panel 端：runApplyStyles - 工具执行 + 会话样式持久化
// =============================================================================

/**
 * 使用 chrome.scripting.insertCSS 注入样式（CSP 方案 3）
 * 当 Content Script 无法通过 <style> 或 adoptedStyleSheets 注入时，
 * 通过浏览器级别 API 绕过 CSP 限制。
 * @param {string} css - 要注入的 CSS 代码
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
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
 * 供 early-inject.js 在 document_start 时读取，实现页面刷新后样式不闪烁。
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
 *
 * 跨 Side Panel 和 Content Script 两个执行环境的样式管理函数。
 * 仅维护当前会话的样式，切换会话时自动切换对应样式。
 * 每次操作后同步到 active_styles:{domain}，确保页面刷新后样式不丢失。
 *
 * @param {string} css - CSS 代码（save 模式必填，rollback 模式不需要）
 * @param {string} mode - 模式：'save' | 'rollback_all'
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
 * @returns {Promise<string>} 操作结果消息
 */
async function runApplyStyles(css, mode, tabId) {
  if (!currentSession) {
    throw new Error("[runApplyStyles] 没有活动的会话");
  }

  try {
    const sKey = currentSession.stylesKey;
    const hKey = currentSession.stylesHistoryKey;
    const MAX_HISTORY = 20; // 最多保留 20 层历史

    // === rollback_last 模式 ===
    if (mode === "rollback_last") {
      // 1. 获取历史栈
      const { [hKey]: history = [] } = await chrome.storage.local.get(hKey);
      
      if (history.length <= 1) {  // 只有空字符串或一个元素时不能回滚
        return "没有可回滚的历史。当前无已应用样式或已是最初状态。";
      }

      // 2. 从历史栈 pop（移除最后一次保存的状态）
      history.pop();
      
      // 3. 获取回滚后的 CSS（栈顶或空）
      const newCSS = history.length > 0 ? history[history.length - 1] : "";

      // 4. 更新 storage
      if (newCSS.trim()) {
        await chrome.storage.local.set({ 
          [sKey]: newCSS,
          [hKey]: history 
        });
        // 同步到 Content Script
        await sendToContentScript({ 
          tool: "replace_css", 
          args: { css: newCSS } 
        }, tabId);
      } else {
        await chrome.storage.local.remove([sKey, hKey]);
        // 同步到 Content Script（清空）
        await sendToContentScript({ 
          tool: "rollback_css", 
          args: { scope: "all" } 
        }, tabId);
      }

      // 5. 同步到 active_styles
      await syncActiveStyles();
      // 6. 更新样式摘要
      await updateStylesSummary();

      return newCSS.trim()
        ? `已回滚到上一次样式（历史栈: ${history.length} 层）。当前完整样式：\n${newCSS}`
        : "已回滚所有样式。当前无已应用样式。";
    }

    // === rollback_all 模式 ===
    if (mode === "rollback_all") {
      await sendToContentScript({
        tool: "rollback_css",
        args: { scope: "all" },
      }, tabId);
      await chrome.storage.local.remove([sKey, hKey]);
      await syncActiveStyles();
      await updateStylesSummary();
      return "已回滚所有样式。当前无已应用样式。";
    }

    // === save 模式 ===
    if (mode === "save") {
      if (!css || !css.trim()) {
        throw new Error("[runApplyStyles] save 模式需要提供 CSS 代码");
      }

      // 0. 源头校验：检测 AI 提交的 CSS 花括号是否平衡
      const { balanced, depth } = checkBraceBalance(css);
      if (!balanced) {
        console.warn('[StyleSwift] AI 提交的 CSS 花括号不平衡，depth:', depth, '| 自动修复后继续');
        css = repairBraces(css);
      }

      // 1. 注入 CSS 到页面（带 CSP 降级）
      const injectResp = await sendToContentScript({
        tool: "inject_css",
        args: { css },
      }, tabId);
      if (injectResp && injectResp.fallback === "scripting-api") {
        await injectCSSViaScriptingAPI(injectResp.css, tabId);
      }

      // 2. 合并并写入会话样式
      const { [sKey]: existing = "" } = await chrome.storage.local.get(sKey);
      const merged = mergeCSS(existing, css);
      await chrome.storage.local.set({ [sKey]: merged });

      // 3. push 到历史栈（保存当前完整状态，限制最大长度）
      const { [hKey]: history = [] } = await chrome.storage.local.get(hKey);
      history.push(merged);
      // 限制历史长度，超出时移除最早的条目（保留 index 0 的空字符串）
      if (history.length > MAX_HISTORY) {
        history.shift(); // 移除最早的（除了空字符串基准）
      }
      await chrome.storage.local.set({ [hKey]: history });

      // 4. 同步到 active_styles（供页面刷新时使用）
      await syncActiveStyles();

      // 5. 更新样式摘要
      await updateStylesSummary();

      return `样式已应用（历史栈: ${history.length} 层）。当前完整样式：\n${merged}`;
    }

    throw new Error(`[runApplyStyles] 未知模式: ${mode}`);
  } catch (error) {
    console.error("[runApplyStyles] 执行失败:", error);
    throw error;
  }
}

// =============================================================================
// §3.10 Side Panel 端：runEditCSS - 精准编辑已应用样式
// =============================================================================

/**
 * 精准编辑已应用的 CSS 样式
 *
 * 通过文本替换方式修改已存储的 CSS，替换后重新注入页面。
 *
 * @param {string} oldCSS - 要替换的 CSS 片段（必须精确匹配）
 * @param {string} newCSS - 替换后的内容（空字符串表示删除）
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
 * @returns {Promise<string>} 操作结果 + 更新后的完整 CSS
 */
async function runEditCSS(oldCSS, newCSS, tabId) {
  if (!currentSession) {
    throw new Error("[runEditCSS] 没有活动的会话");
  }

  const sKey = currentSession.stylesKey;
  const { [sKey]: stored = "" } = await chrome.storage.local.get(sKey);

  if (!stored || !stored.includes(oldCSS)) {
    return `编辑失败：未找到匹配的 CSS 片段。请确保 old_css 与 [当前已应用样式] 中的内容完全一致。\n\n当前完整样式：\n${stored || "(无)"}`;
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
    return `样式已更新。当前完整样式：\n${trimmed}`;
  }
  return "样式已全部删除。当前无已应用样式。";
}

// =============================================================================
// §3.6 Side Panel 端：runLoadSkill - 加载领域知识/风格技能
// =============================================================================

/**
 * 加载领域知识或用户保存的风格技能
 *
 * 使用 UnifiedSkillManager 统一管理静态技能和用户技能。
 * 静态技能通过 SkillLoader 自动发现，用户技能通过 StyleSkillStore 加载。
 *
 * @param {string} skillName - 内置知识名称，或 skill:{id} 加载用户风格技能
 * @returns {Promise<string>} 技能内容（markdown 格式）或错误提示
 *
 * @example
 * // 加载内置知识
 * const content = await runLoadSkill('dark-mode-template');
 * // → 返回 dark-mode.md 文件内容
 *
 * @example
 * // 加载用户技能
 * const content = await runLoadSkill('skill:a1b2c3d4');
 * // → 返回用户保存的技能内容
 */
async function runLoadSkill(skillName) {
  const manager = await getSkillManager();
  return await manager.getContent(skillName);
}

// =============================================================================
// §3.7 Side Panel 端：runSaveStyleSkill - 保存风格技能
// =============================================================================

/**
 * 从当前会话中提取视觉风格特征，保存为可复用的风格技能
 *
 * **工作流程：**
 * 1. 生成 8 位 UUID 作为技能 ID
 * 2. 获取当前域名作为来源
 * 3. 组装 header（名称、来源、日期、风格描述）
 * 4. 调用 StyleSkillStore.save 保存技能内容和索引
 *
 * **Header 格式：**
 * ```markdown
 * # {name}
 *
 * > 来源: {domain} | 创建: {date}
 * > 风格: {mood}
 *
 * {skillContent}
 * ```
 *
 * 如果 skillContent 已经以 `# ` 开头，则不重复添加 header。
 *
 * @param {string} name - 风格名称，如"赛博朋克"、"清新日式"
 * @param {string} mood - 一句话风格描述（可选）
 * @param {string} skillContent - 风格技能文档（markdown 格式）
 * @returns {Promise<string>} 成功消息，包含技能 ID 和使用方法
 *
 * @example
 * const result = await runSaveStyleSkill(
 *   '赛博朋克',
 *   '深色背景+霓虹色调的高科技感',
 *   '## 风格描述\n深色背景配合霓虹色调...'
 * );
 * // → '已保存风格技能「赛博朋克」(id: a1b2c3d4)，可在任意网站通过 load_skill('skill:a1b2c3d4') 加载使用。'
 */
async function runSaveStyleSkill(name, mood, skillContent) {
  // 1. 生成 8 位 UUID
  const id = crypto.randomUUID().slice(0, 8);

  // 2. 获取来源域名
  const sourceDomain = currentSession?.domain || "unknown";

  // 3. 组装 header
  const header = `# ${name}\n\n> 来源: ${sourceDomain} | 创建: ${new Date().toLocaleDateString()}\n> 风格: ${mood || ""}\n\n`;

  // 4. 处理完整内容（避免重复添加 header）
  const fullContent = skillContent.startsWith("# ")
    ? skillContent
    : header + skillContent;

  // 5. 保存技能
  await StyleSkillStore.save(id, name, mood || "", sourceDomain, fullContent);

  // 6. 返回成功消息
  return `已保存风格技能「${name}」(id: ${id})，可在任意网站通过 load_skill('skill:${id}') 加载使用。`;
}

// =============================================================================
// §3.8 Side Panel 端：runListStyleSkills - 列出风格技能
// =============================================================================

/**
 * 列出用户保存的所有风格技能
 *
 * 返回格式化的技能列表，每个技能包含 ID、名称、描述、来源域名和创建日期。
 *
 * @returns {Promise<string>} 格式化的技能列表，无技能时返回默认提示
 *
 * @example
 * // 有技能时
 * const list = await runListStyleSkills();
 * // → '- skill:a1b2c3d4「赛博朋克」— 深色背景+霓虹色调 (来自 github.com, 2026/3/4)'
 *
 * @example
 * // 无技能时
 * const list = await runListStyleSkills();
 * // → '(暂无保存的风格技能)'
 */
async function runListStyleSkills() {
  const skills = await StyleSkillStore.list();

  // 空列表返回默认提示
  if (skills.length === 0) {
    return "(暂无保存的风格技能)";
  }

  // 格式化输出
  return skills
    .map(
      (s) =>
        `- skill:${s.id}「${s.name}」${s.mood ? `— ${s.mood}` : ""} (来自 ${s.sourceDomain}, ${new Date(s.createdAt).toLocaleDateString()})`,
    )
    .join("\n");
}

// =============================================================================
// §3.9 Side Panel 端：runDeleteStyleSkill - 删除风格技能
// =============================================================================

/**
 * 删除一个用户保存的风格技能
 *
 * @param {string} skillId - 要删除的技能 ID
 * @returns {Promise<string>} 操作结果消息
 *
 * @example
 * // 删除成功
 * const result = await runDeleteStyleSkill('a1b2c3d4');
 * // → '已删除风格技能「赛博朋克」'
 *
 * @example
 * // 技能不存在
 * const result = await runDeleteStyleSkill('notexist');
 * // → '未找到技能: notexist'
 */
async function runDeleteStyleSkill(skillId) {
  // 检查技能是否存在
  const skills = await StyleSkillStore.list();
  const target = skills.find((s) => s.id === skillId);

  // 技能不存在时返回错误提示
  if (!target) {
    return `未找到技能: ${skillId}`;
  }

  // 删除技能
  await StyleSkillStore.remove(skillId);

  return `已删除风格技能「${target.name}」`;
}

// =============================================================================
// §10.2 工具执行器 - TOOL_HANDLERS dispatch map + executeTool
// =============================================================================

/**
 * 工具处理器注册表（dispatch map）
 *
 * 每个 handler 接收 args 对象和 context，返回 Promise<string>。
 * context.tabId 指定目标 Tab，确保工具始终操作 Agent 启动时绑定的页面。
 * 添加新工具只需在此 map 中新增一行。
 */
const TOOL_HANDLERS = {
  // —— Content Script 工具（DOM 操作）——
  get_page_structure: async (_args, context) =>
    normalizeToolResult(
      await sendToContentScript({ tool: "get_page_structure" }, context?.tabId),
    ),

  grep: async (args, context) =>
    normalizeToolResult(
      await sendToContentScript({
        tool: "grep",
        args: {
          query: args.query,
          scope: args.scope || "children",
          maxResults: args.max_results || 5,
        },
      }, context?.tabId),
    ),

  apply_styles: async (args, context) =>
    await runApplyStyles(args.css || "", args.mode, context?.tabId),

  get_current_styles: async () => {
    if (!currentSession) return "(无活动会话)";
    const sKey = currentSession.stylesKey;
    const { [sKey]: css = "" } = await chrome.storage.local.get(sKey);
    return css.trim() || "(当前无已应用样式)";
  },

  edit_css: async (args, context) =>
    await runEditCSS(args.old_css, args.new_css, context?.tabId),

  // —— Side Panel 本地工具 ——
  get_user_profile: async () => {
    const { runGetUserProfile } = await import("./profile.js");
    return await runGetUserProfile();
  },

  update_user_profile: async (args) => {
    const { runUpdateUserProfile } = await import("./profile.js");
    return await runUpdateUserProfile(args.content);
  },

  load_skill: async (args) => await runLoadSkill(args.skill_name),

  save_style_skill: async (args) =>
    await runSaveStyleSkill(args.name, args.mood, args.skill_content),

  list_style_skills: async () => await runListStyleSkills(),

  delete_style_skill: async (args) => await runDeleteStyleSkill(args.skill_id),

  capture_screenshot: async (_args, context) => {
    const dataUrl = await captureScreenshot(context?.tabId);
    return dataUrl;
  },

  TodoWrite: async (args) => {
    const { updateTodos } = await import("./todo-manager.js");
    return updateTodos(args.todos);
  },

  Task: async (args, context) => {
    const { runTask } = await import("./agent-loop.js").catch(() => ({
      runTask: null,
    }));
    if (runTask) {
      return await runTask(
        args.description,
        args.prompt,
        args.agent_type,
        context?.abortSignal,
        context?.tabId,
      );
    }
    return "(子智能体功能尚未实现)";
  },
};

/**
 * 工具执行器统一分派器
 *
 * 通过 TOOL_HANDLERS dispatch map 路由到对应的实现函数。
 * 保证返回值为字符串。
 *
 * @param {string} name - 工具名称
 * @param {object} args - 工具参数
 * @param {object} [context] - 执行上下文（包含 abortSignal 等）
 * @returns {Promise<string>} 工具执行结果
 */
async function executeTool(name, args, context) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return `未知工具: ${name}`;
  }
  return await handler(args, context);
}

// =============================================================================
// 导出函数
// =============================================================================

export {
  // 工具定义
  BASE_TOOLS,
  SUBAGENT_TOOLS,
  ALL_TOOLS,
  // 工具执行函数
  getTargetTabId,
  lockTab,
  unlockTab,
  getTargetDomain,
  sendToContentScript,
  normalizeToolResult,
  captureScreenshot,
  runApplyStyles,
  runEditCSS,
  runLoadSkill,
  runSaveStyleSkill,
  runListStyleSkills,
  runDeleteStyleSkill,
  executeTool,
  // Skill Manager
  getSkillManager,
};
