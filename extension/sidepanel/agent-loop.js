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
// §6.3 Layer 2 — 对话历史与 Token 预算控制
// =============================================================================

/**
 * Token 预算上限
 * 
 * 当 lastInputTokens 超过此值时触发历史压缩。
 * 设为 50000，为新的对话和工具结果留出充足空间。
 * 
 * Claude 模型的上下文窗口为 200k tokens，
 * 预留 50k 给工具结果和输出，确保不会超出限制。
 * 
 * @type {number}
 */
const TOKEN_BUDGET = 50000;

/**
 * 检查并压缩对话历史
 * 
 * 基于 API 返回的 lastInputTokens 判断是否需要压缩。
 * 如果超过 TOKEN_BUDGET，则：
 * 1. 找到最近 10 轮对话的边界
 * 2. 对边界之前的旧对话生成摘要
 * 3. 用摘要替换旧对话
 * 
 * @param {Array} history - 对话历史数组
 * @param {number} lastInputTokens - 上次 API 调用的 input_tokens
 * @returns {Promise<Array>} 压缩后的对话历史（可能不变）
 * 
 * @example
 * // 未超预算，不压缩
 * const compressed = await checkAndCompressHistory(history, 30000);
 * // compressed === history（同一引用）
 * 
 * @example
 * // 超预算，压缩
 * const compressed = await checkAndCompressHistory(history, 60000);
 * // compressed[0] = { role: 'user', content: '[之前的对话摘要]\n...' }
 * // compressed.slice(1) 包含最近 10 轮对话
 */
async function checkAndCompressHistory(history, lastInputTokens) {
  // 未超预算，不压缩
  if (lastInputTokens <= TOKEN_BUDGET) {
    return history;
  }

  // 找到最近 10 轮对话的起始边界
  const split = findTurnBoundary(history, 10);
  
  // 分割历史：旧对话和最近对话
  const oldPart = history.slice(0, split);
  const recentPart = history.slice(split);

  // 如果没有旧对话可压缩，直接返回
  if (oldPart.length === 0) {
    return history;
  }

  // 异步生成摘要
  const summary = await summarizeOldTurns(oldPart);

  // 用摘要替换旧对话
  return [
    { role: 'user', content: `[之前的对话摘要]\n${summary}` },
    ...recentPart
  ];
}

/**
 * 找到最近 N 轮对话的起始边界
 * 
 * 从后往前遍历历史，找到第 N 个用户消息的索引。
 * "一轮对话"定义为：用户消息 + 可能的工具调用 + 助手回复
 * 
 * @param {Array} history - 对话历史数组
 * @param {number} keepRecentTurns - 保留的最近轮数
 * @returns {number} 最近 N 轮对话的起始索引（history 中的位置）
 * 
 * @example
 * // 历史有 15 轮对话，保留最近 10 轮
 * const index = findTurnBoundary(history, 10);
 * // history.slice(index) 是最近 10 轮
 * // history.slice(0, index) 是要压缩的旧对话
 */
function findTurnBoundary(history, keepRecentTurns) {
  let turnCount = 0;
  
  // 从后往前遍历，统计用户消息数量
  for (let i = history.length - 1; i >= 0; i--) {
    // 一轮对话的开始标志：用户发送的文本消息
    if (history[i].role === 'user' && typeof history[i].content === 'string') {
      turnCount++;
      // 找到第 N 个用户消息时，返回其索引
      if (turnCount >= keepRecentTurns) {
        return i;
      }
    }
  }
  
  // 如果轮数不足 N，返回 0（保留全部）
  return 0;
}

/**
 * 使用 LLM 对早期对话生成摘要
 * 
 * 将旧对话历史压缩成一段简洁的摘要文本。
 * 摘要重点保留：
 * - 用户的风格偏好
 * - 已应用的样式变更
 * - 未完成的请求
 * 
 * 注意：此函数会调用 LLM API，产生 API 费用。
 * 
 * @param {Array} oldHistory - 要压缩的旧对话历史
 * @returns {Promise<string>} 压缩后的摘要文本
 * 
 * @example
 * const summary = await summarizeOldTurns([
 *   { role: 'user', content: '改成深色模式' },
 *   { role: 'assistant', content: [{ type: 'text', text: '好的' }, ...] },
 *   ...
 * ]);
 * // summary 可能是: "用户偏好深色模式，已应用深蓝背景和白色文字..."
 */
async function summarizeOldTurns(oldHistory) {
  // 将历史压缩成简化的文本格式
  const condensed = oldHistory.map(msg => {
    if (msg.role === 'user') {
      // 用户消息
      if (typeof msg.content === 'string') {
        return `用户: ${msg.content}`;
      }
      // tool_result 消息（通常是工具调用结果）
      return '用户: [工具调用结果]';
    }
    
    if (msg.role === 'assistant') {
      // 助手消息：提取文本和工具调用
      const texts = (msg.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text.slice(0, 200)); // 截断过长的文本
      
      const tools = (msg.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => b.name);
      
      let summary = '';
      if (texts.length) {
        summary += `助手: ${texts.join(' ')}`;
      }
      if (tools.length) {
        summary += ` [调用了: ${tools.join(', ')}]`;
      }
      return summary;
    }
    
    return '';
  }).filter(Boolean).join('\n');

  // 如果压缩后的文本为空，返回默认消息
  if (!condensed.trim()) {
    return '(无历史记录)';
  }

  try {
    // 动态导入 getSettings（避免循环依赖）
    const { getSettings } = await import('./api.js');
    const { apiKey, model, apiBase } = await getSettings();

    // 调用 LLM 生成摘要
    const resp = await fetch(`${apiBase}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        system: '用一段简洁的文字总结以下对话历史，重点保留：用户的风格偏好、已应用的样式变更、未完成的请求。不超过 300 字。',
        messages: [{ role: 'user', content: condensed }],
        max_tokens: 500,
      })
    });

    if (!resp.ok) {
      console.error('[History Compression] API error:', resp.status);
      return '(历史摘要生成失败)';
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text;
    return text || '(历史摘要生成失败)';
    
  } catch (err) {
    console.error('[History Compression] Failed:', err);
    return '(历史摘要生成失败)';
  }
}

// =============================================================================
// §11.2 受限页面预检测
// =============================================================================

/**
 * 受限 URL 模式列表
 * 
 * 这些 URL 模式匹配的页面无法注入 Content Script，因此无法进行样式修改：
 * - chrome:// - Chrome 内部页面（设置、扩展管理等）
 * - chrome-extension:// - 扩展页面
 * - edge:// - Edge 内部页面
 * - about: - 浏览器内部页面（about:blank, about:newtab 等）
 * - file:// - 本地文件页面
 * - Chrome Web Store 和 Edge Add-ons - 扩展商店页面受限
 * 
 * @type {RegExp[]}
 */
const RESTRICTED_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^file:\/\//,
  /^https:\/\/chrome\.google\.com\/webstore/,
  /^https:\/\/microsoftedge\.microsoft\.com\/addons/,
];

/**
 * 检测 URL 是否为受限页面
 * 
 * 通过正则匹配判断 URL 是否属于无法注入 Content Script 的受限页面。
 * 
 * @param {string} url - 要检测的 URL
 * @returns {boolean} true 表示是受限页面，false 表示正常页面
 * 
 * @example
 * isRestrictedPage('chrome://extensions')
 * // 返回: true
 * 
 * @example
 * isRestrictedPage('https://github.com')
 * // 返回: false
 */
function isRestrictedPage(url) {
  return RESTRICTED_PATTERNS.some(p => p.test(url));
}

/**
 * 检测页面访问权限
 * 
 * 通过尝试向 Content Script 发送消息来判断页面是否可访问。
 * 如果消息发送成功，说明 Content Script 已注入，页面可正常操作。
 * 如果失败，说明页面受限或 Content Script 未注入。
 * 
 * 该函数应在 Agent Loop 启动前调用，用于预检测页面可访问性。
 * 
 * @param {number} tabId - 要检测的 Tab ID
 * @returns {Promise<{ok: boolean, domain?: string, reason?: string}>}
 *          - ok: true 表示页面可访问，返回 domain
 *          - ok: false 表示页面不可访问，返回 reason 说明原因
 * 
 * @example
 * // 正常页面
 * const result = await checkPageAccess(123);
 * // result = { ok: true, domain: 'github.com' }
 * 
 * @example
 * // 受限页面
 * const result = await checkPageAccess(456);
 * // result = { ok: false, reason: '此页面不支持样式修改（浏览器内部页面或受限页面）' }
 */
async function checkPageAccess(tabId) {
  try {
    const domain = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { tool: 'get_domain' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    return { ok: true, domain };
  } catch {
    return { ok: false, reason: '此页面不支持样式修改（浏览器内部页面或受限页面）' };
  }
}

// =============================================================================
// 导出常量和工具数组
// =============================================================================

export { 
  SYSTEM_BASE,
  BASE_TOOLS,
  ALL_TOOLS,
  buildSessionContext,
  TOKEN_BUDGET,
  checkAndCompressHistory,
  findTurnBoundary,
  summarizeOldTurns,
  RESTRICTED_PATTERNS,
  isRestrictedPage,
  checkPageAccess
};
