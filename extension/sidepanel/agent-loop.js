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
// 导出常量和工具数组
// =============================================================================

export { 
  SYSTEM_BASE,
  BASE_TOOLS,
  ALL_TOOLS
};
