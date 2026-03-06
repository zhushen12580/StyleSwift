/**
 * StyleSwift - Agent Loop
 * Agent 主循环 + 系统提示词定义
 */

// Import tool definitions from tools.js
import { 
  BASE_TOOLS as BASE_TOOLS_DEF,
  ALL_TOOLS as ALL_TOOLS_DEF 
} from './tools.js';

// =============================================================================
// §10.4 SYSTEM_BASE - 系统提示词常量
// =============================================================================

/**
 * SYSTEM_BASE - Agent 系统提示词
 * 
 * 包含以下部分：
 * 1. 身份定义 - StyleSwift 的定位
 * 2. 工作方式 - Agent 的行为准则
 * 3. CSS 生成规则 - 确保生成的 CSS 可靠生效
 * 4. 风格技能指引 - 如何保存和应用风格技能
 * 
 * 该常量作为 Layer 0 - System Prompt（恒定，约 200 tokens）
 * 在每次 Agent Loop 中作为 system 参数传给 API
 */
const SYSTEM_BASE = `你是 StyleSwift，网页样式个性化智能体。

任务：帮助用户用一句话个性化网页样式。

工作方式：
- 使用工具完成任务
- 优先行动，而非长篇解释
- 完成后简要总结

可用工具：get_page_structure, grep, apply_styles, get_user_profile, update_user_profile, load_skill, save_style_skill, list_style_skills, delete_style_skill, Task, TodoWrite

生成 CSS 时遵循：
1. 使用具体选择器（如 .site-header, main#content），不用 * 或标签通配
2. 所有声明加 !important，确保覆盖页面原有样式
3. 避免使用 @import 或修改 <link> 标签
4. 颜色使用 hex 或 rgba，不使用 CSS 变量（页面变量可能被覆盖）

风格技能（Style Skill）：
- 用户满意当前风格并希望复用时，用 save_style_skill 提取并保存
- 提取时关注抽象特征（色彩、排版、效果、设计意图），不是具体选择器
- 应用用户风格技能时，先 load_skill 读取，再结合 get_page_structure 查看目标页面结构，生成适配当前页面的 CSS
- 参考 CSS 中的选择器来自原始页面，不可直接使用
- 同一风格在不同网站上应保持视觉一致性（色彩/氛围/效果），但选择器必须适配目标页面`;

// =============================================================================
// §10.4 工具数组定义
// =============================================================================

/**
 * BASE_TOOLS - 基础工具数组
 * 
 * 包含所有可直接调用的工具，不包括 Task 子智能体工具。
 * 从 tools.js 模块导入并重新导出，方便统一管理。
 * 
 * 包含的工具：
 * - GET_PAGE_STRUCTURE_TOOL: 获取页面结构
 * - GREP_TOOL: 元素搜索
 * - APPLY_STYLES_TOOL: 应用/回滚样式
 * - GET_USER_PROFILE_TOOL: 获取用户画像
 * - UPDATE_USER_PROFILE_TOOL: 更新用户画像
 * - LOAD_SKILL_TOOL: 加载领域知识/风格技能
 * - SAVE_STYLE_SKILL_TOOL: 保存风格技能
 * - LIST_STYLE_SKILLS_TOOL: 列出风格技能
 * - DELETE_STYLE_SKILL_TOOL: 删除风格技能
 * - TODO_WRITE_TOOL: 任务列表管理
 */
const BASE_TOOLS = BASE_TOOLS_DEF;

/**
 * ALL_TOOLS - 完整工具数组
 * 
 * 包含所有工具，包括 Task 子智能体工具。
 * 从 tools.js 模块导入并重新导出。
 * 
 * 组成：BASE_TOOLS + TASK_TOOL
 */
const ALL_TOOLS = ALL_TOOLS_DEF;

// =============================================================================
// §6.2 Layer 1 — Session Context 注入
// =============================================================================

/**
 * 构建会话上下文块
 * 
 * 拼接 [会话上下文] 块，包含域名、会话标题、已应用样式摘要、用户偏好一行提示。
 * 作为 Layer 1 注入到每次 Agent 会话的 system prompt 中。
 * 
 * @param {string} domain - 当前网站的域名，如 'github.com'
 * @param {Object} sessionMeta - 会话元数据对象
 * @param {string|null} [sessionMeta.title] - 会话标题，无标题时显示'新会话'
 * @param {string} [sessionMeta.activeStylesSummary] - 已应用样式的摘要，如 '5 条规则，涉及 body, .header 等'
 * @param {string} profileHint - 用户画像的一行提示（来自 getProfileOneLiner），无画像时为空字符串
 * @returns {string} 格式化的会话上下文文本
 * 
 * @example
 * // 完整上下文
 * const ctx = buildSessionContext('github.com', {
 *   title: '深色模式调整',
 *   activeStylesSummary: '5 条规则，涉及 body, .header 等'
 * }, '偏好深色模式、圆角设计');
 * // 返回:
 * // [会话上下文]
 * // 域名: github.com
 * // 会话: 深色模式调整
 * // 已应用样式: 5 条规则，涉及 body, .header 等
 * // 用户风格偏好: 偏好深色模式、圆角设计 (详情可通过 get_user_profile 获取)
 * 
 * @example
 * // 最小上下文（新会话、无样式、无画像）
 * const ctx = buildSessionContext('example.com', { title: null }, '');
 * // 返回:
 * // [会话上下文]
 * // 域名: example.com
 * // 会话: 新会话
 */
function buildSessionContext(domain, sessionMeta, profileHint) {
  // 基础上下文：域名和会话标题（必有）
  let ctx = `\n[会话上下文]\n域名: ${domain}\n会话: ${sessionMeta.title || '新会话'}\n`;

  // 已应用样式摘要（可选）
  if (sessionMeta.activeStylesSummary) {
    ctx += `已应用样式: ${sessionMeta.activeStylesSummary}\n`;
  }

  // 用户风格偏好提示（可选）
  if (profileHint) {
    ctx += `用户风格偏好: ${profileHint} (详情可通过 get_user_profile 获取)\n`;
  }

  return ctx;
}

// =============================================================================
// 导出常量和工具数组
// =============================================================================

export { 
  SYSTEM_BASE,
  BASE_TOOLS,
  ALL_TOOLS,
  buildSessionContext
};
