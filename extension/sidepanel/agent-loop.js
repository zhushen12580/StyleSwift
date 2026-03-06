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
// §4.1 Agent Types 注册表
// =============================================================================

/**
 * AGENT_TYPES - 子智能体配置注册表
 * 
 * 定义所有可用的子智能体类型及其配置：
 * - description: 子智能体类型描述（用于工具描述中展示）
 * - tools: 该子智能体可使用的工具列表（数组为工具名列表，'*' 表示所有工具）
 * - prompt: 子智能体的系统提示词模板
 * 
 * 子智能体在隔离上下文中运行，不会污染主对话历史。
 * 执行时会在 Side Panel 中独立运行，共享同一个 API Key 和模型配置。
 */
const AGENT_TYPES = {
  StyleGenerator: {
    description: '样式生成专家。根据用户意图和页面结构生成CSS代码。',
    tools: ['get_page_structure', 'grep', 'load_skill'],
    prompt: `你是样式生成专家。

任务：根据用户意图生成CSS代码

输入：
- 用户意图描述
- 页面结构信息（可能需要你主动获取）

输出格式（JSON）：
{
    "css": "生成的CSS代码",
    "affected_selectors": ["受影响的选择器"],
    "description": "样式描述"
}

你有完全的自由决定如何完成这个任务。
- 可以加载知识获得专业指导
- 可以多次获取页面信息
- 只返回最终结果，不要返回中间过程`,
  },
};

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
// §10.1 LLM API 调用（Streaming）
// =============================================================================

/**
 * 调用 Anthropic Streaming API
 * 
 * 从 Side Panel 直接调用 Anthropic Streaming API，实现逐步输出。
 * 支持 SSE（Server-Sent Events）流式解析。
 * 
 * @param {string} system - 系统提示词
 * @param {Array} messages - 消息历史
 * @param {Array} tools - 工具定义数组
 * @param {Object} callbacks - 回调函数对象
 * @param {Function} [callbacks.onText] - 文本增量回调 (delta: string) => void
 * @param {Function} [callbacks.onToolCall] - 工具调用回调 (block: object) => void
 * @param {AbortSignal} abortSignal - 取消信号
 * @returns {Promise<{content: Array, stop_reason: string|null, usage: object|null}>}
 * 
 * @example
 * const result = await callAnthropicStream(
 *   'You are a helpful assistant',
 *   [{ role: 'user', content: 'Hello' }],
 *   ALL_TOOLS,
 *   { onText: (delta) => console.log(delta) },
 *   abortController.signal
 * );
 */
async function callAnthropicStream(system, messages, tools, callbacks, abortSignal) {
  // 动态导入 getSettings 避免循环依赖
  const { getSettings } = await import('./api.js');
  const { apiKey, model, apiBase } = await getSettings();

  const resp = await fetch(`${apiBase}/v1/messages`, {
    signal: abortSignal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      system,
      messages,
      tools,
      max_tokens: 8000,
      stream: true,
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`API 错误: ${err.error?.message || resp.statusText}`);
  }

  // SSE 流式解析
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const result = { content: [], stop_reason: null, usage: null };
  let currentBlock = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]' || !raw) continue;

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        console.warn('[SSE] JSON parse failed:', raw);
        continue;
      }

      switch (data.type) {
        case 'content_block_start':
          currentBlock = data.content_block;
          if (currentBlock.type === 'text') currentBlock.text = '';
          if (currentBlock.type === 'tool_use') currentBlock.input = '';
          result.content.push(currentBlock);
          break;

        case 'content_block_delta':
          if (data.delta.type === 'text_delta') {
            currentBlock.text += data.delta.text;
            callbacks.onText?.(data.delta.text);       // 流式文本回调
          }
          if (data.delta.type === 'input_json_delta') {
            currentBlock.input += data.delta.partial_json;
          }
          break;

        case 'content_block_stop':
          if (currentBlock?.type === 'tool_use') {
            try {
              currentBlock.input = JSON.parse(currentBlock.input);
            } catch (e) {
              console.warn('[SSE] Failed to parse tool input:', e);
              currentBlock.input = {};
            }
            callbacks.onToolCall?.(currentBlock);       // 工具调用回调
          }
          break;

        case 'message_delta':
          result.stop_reason = data.delta?.stop_reason;
          result.usage = data.usage;
          break;

        case 'message_start':
          result.usage = data.message?.usage;
          break;
      }
    }
  }

  return result;
}

// =============================================================================
// §10.4 主循环常量与状态
// =============================================================================

/**
 * Agent Loop 最大迭代次数
 * 防止死循环，超过此次数自动停止
 * @type {number}
 */
const MAX_ITERATIONS = 20;

/**
 * 子智能体最大迭代次数
 * @type {number}
 */
const SUB_MAX_ITERATIONS = 10;

/**
 * 当前 AbortController 实例
 * 用于取消正在进行的 API 请求
 * @type {AbortController|null}
 */
let currentAbortController = null;

/**
 * Agent 运行状态标志
 * 用于并发保护，防止重复请求
 * @type {boolean}
 */
let isAgentRunning = false;

/**
 * 工具调用历史记录
 * 用于检测死循环（连续 3 次相同工具+参数）
 * @type {Array<{name: string, args: object, timestamp: number}>}
 */
let toolCallHistory = [];

/**
 * 最大重试次数（失败后最多重试 2 次，总共执行 3 次）
 * @type {number}
 */
const MAX_RETRIES = 2;

/**
 * 连续相同调用阈值（连续 3 次相同工具+参数视为死循环）
 * @type {number}
 */
const DUPLICATE_CALL_THRESHOLD = 3;

// =============================================================================
// §11.4 死循环保护
// =============================================================================

/**
 * 重置工具调用历史
 * 每次新的 Agent Loop 开始时调用
 */
function resetToolCallHistory() {
  toolCallHistory = [];
}

/**
 * 生成工具调用的唯一键
 * 用于判断两次调用是否相同（相同工具名 + 相同参数）
 * 
 * @param {string} toolName - 工具名称
 * @param {object} args - 工具参数
 * @returns {string} 工具调用的唯一键
 */
function generateToolCallKey(toolName, args) {
  try {
    // 对参数进行稳定排序后序列化，确保相同参数但不同顺序产生相同的键
    const sortedArgs = sortObjectKeys(args);
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  } catch (error) {
    // 如果序列化失败，返回工具名 + 时间戳避免误判
    console.warn('[Tool Call Key] Failed to generate key:', error);
    return `${toolName}:${Date.now()}`;
  }
}

/**
 * 递归排序对象的键（确保稳定序列化）
 * 
 * @param {any} obj - 要排序的对象
 * @returns {any} 排序后的对象
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/**
 * 检测是否为死循环（连续相同工具调用）
 * 
 * @param {string} toolName - 工具名称
 * @param {object} args - 工具参数
 * @returns {boolean} true 表示检测到死循环
 */
function detectDeadLoop(toolName, args) {
  const callKey = generateToolCallKey(toolName, args);
  
  // 添加到历史记录
  toolCallHistory.push({
    name: toolName,
    args: args,
    key: callKey,
    timestamp: Date.now()
  });
  
  // 检查连续相同调用
  if (toolCallHistory.length >= DUPLICATE_CALL_THRESHOLD) {
    const recentCalls = toolCallHistory.slice(-DUPLICATE_CALL_THRESHOLD);
    const allSame = recentCalls.every(call => call.key === callKey);
    
    if (allSame) {
      console.warn('[Dead Loop Detection] 检测到连续 3 次相同的工具调用:', {
        tool: toolName,
        args: args
      });
      return true;
    }
  }
  
  return false;
}

/**
 * 带重试的工具执行函数
 * 失败后最多重试 MAX_RETRIES 次
 * 
 * @param {string} toolName - 工具名称
 * @param {object} args - 工具参数
 * @param {Function} executor - 工具执行函数
 * @returns {Promise<string>} 工具执行结果
 */
async function executeToolWithRetry(toolName, args, executor) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executor(toolName, args);
      return result;
    } catch (error) {
      lastError = error;
      
      // 如果还有重试机会，记录日志并继续
      if (attempt < MAX_RETRIES) {
        console.warn(`[Tool Retry] ${toolName} 执行失败 (尝试 ${attempt + 1}/${MAX_RETRIES + 1})，正在重试...`, error);
      } else {
        // 重试次数用尽，返回错误信息
        console.error(`[Tool Retry] ${toolName} 执行失败，已达最大重试次数`, error);
        return `工具 ${toolName} 执行失败: ${error.message || error}. 已重试 ${MAX_RETRIES} 次仍失败。`;
      }
    }
  }
  
  // 理论上不会到达这里，但为了类型安全
  return `工具 ${toolName} 执行失败: ${lastError?.message || lastError}`;
}

// =============================================================================
// §4.3 Subagent 执行
// =============================================================================

/**
 * 执行子智能体任务
 * 
 * 子智能体在隔离上下文中运行，不会污染主对话历史。
 * 执行环境在 Side Panel 中，共享同一个 API Key 和模型配置。
 * 
 * @param {string} description - 任务简短描述（3-5字）
 * @param {string} prompt - 详细的任务指令
 * @param {string} agentType - 子智能体类型（目前支持 'StyleGenerator'）
 * @returns {Promise<string>} 子智能体返回的结果摘要
 * 
 * @example
 * const result = await runTask(
 *   '生成样式',
 *   '为页面生成深色模式的 CSS',
 *   'StyleGenerator'
 * );
 */
async function runTask(description, prompt, agentType) {
  const config = AGENT_TYPES[agentType];
  
  if (!config) {
    return `未知子智能体类型: ${agentType}`;
  }

  // 构建子智能体的系统提示词
  const subSystem = `${config.prompt}\n\n完成任务后返回清晰、简洁的摘要。`;
  
  // 筛选子智能体可用的工具
  const subTools = config.tools === '*'
    ? BASE_TOOLS
    : BASE_TOOLS.filter(t => config.tools.includes(t.name));

  // 子智能体的消息历史（隔离上下文）
  const subMessages = [{ role: 'user', content: prompt }];
  let iterations = 0;

  // 动态导入 executeTool 避免循环依赖
  const { executeTool } = await import('./tools.js');

  while (iterations++ < SUB_MAX_ITERATIONS) {
    try {
      const response = await callAnthropicStream(
        subSystem, 
        subMessages, 
        subTools, 
        {
          onText: () => {}, // 子智能体不流式输出到 UI
          onToolCall: () => {}
        },
        null // 子智能体不支持取消
      );

      // 如果不是工具调用，返回最终文本
      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(b => b.type === 'text');
        return textBlock?.text || '(子智能体无输出)';
      }

      // 处理工具调用
      const results = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const output = await executeTool(block.name, block.input);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
        }
      }

      // 追加助手消息和工具结果
      subMessages.push({ role: 'assistant', content: response.content });
      subMessages.push({ role: 'user', content: results });

    } catch (error) {
      console.error('[Subagent] Error:', error);
      return `(子智能体执行失败: ${error.message})`;
    }
  }

  return '(子智能体达到最大迭代次数，返回已有结果)';
}

// =============================================================================
// §10.4 agentLoop 主循环
// =============================================================================

/**
 * Agent 主循环
 * 
 * 完整流程包括：
 * 1. 并发保护 (isAgentRunning)
 * 2. Tab 锁定
 * 3. 域名获取
 * 4. 会话加载/创建
 * 5. System prompt 构建 (L0+L1)
 * 6. 流式 API 循环 (MAX_ITERATIONS=20)
 * 7. 工具执行
 * 8. 取消支持 (AbortController)
 * 9. 历史持久化
 * 10. 自动标题
 * 
 * @param {string} prompt - 用户输入的提示词
 * @param {Object} uiCallbacks - UI 回调函数对象
 * @param {Function} [uiCallbacks.appendText] - 追加文本回调 (delta: string) => void
 * @param {Function} [uiCallbacks.showToolCall] - 显示工具调用回调 (block: object) => void
 * @param {Function} [uiCallbacks.showToolExecuting] - 显示工具执行中回调 (name: string) => void
 * @param {Function} [uiCallbacks.showToolResult] - 显示工具结果回调 (id: string, output: string) => void
 * @returns {Promise<string|undefined>} 返回最终文本回复，取消时返回 undefined
 * 
 * @example
 * const response = await agentLoop('把背景改成深蓝色', {
 *   appendText: (delta) => console.log(delta),
 *   showToolCall: (block) => console.log('Tool call:', block.name),
 *   showToolExecuting: (name) => console.log('Executing:', name),
 *   showToolResult: (id, output) => console.log('Result:', output)
 * });
 */
async function agentLoop(prompt, uiCallbacks) {
  // —— 并发保护：拒绝重复请求 ——
  if (isAgentRunning) {
    uiCallbacks.appendText?.('(正在处理中，请等待当前请求完成)');
    return;
  }

  isAgentRunning = true;
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;
  
  // 重置工具调用历史（新会话开始）
  resetToolCallHistory();

  // 动态导入所需模块
  const { 
    getTargetTabId, 
    lockTab, 
    unlockTab, 
    getTargetDomain,
    executeTool 
  } = await import('./tools.js');
  const { 
    getOrCreateSession, 
    loadAndPrepareHistory, 
    saveHistory, 
    loadSessionMeta, 
    saveSessionMeta,
    SessionContext,
    setCurrentSession,
    currentSession
  } = await import('./session.js');
  const { getProfileOneLiner } = await import('./profile.js');

  try {
    // 0. 锁定当前 Tab 并获取域名
    const tabId = await getTargetTabId();
    lockTab(tabId);
    const domain = await getTargetDomain();
    
    // 创建或获取会话
    const sessionId = await getOrCreateSession(domain);
    const session = new SessionContext(domain, sessionId);
    setCurrentSession(session);

    // 1. 加载历史
    let history = await loadAndPrepareHistory(domain, sessionId);

    // 2. 构建 system prompt = L0 + L1
    const sessionMeta = await loadSessionMeta(domain, sessionId);
    const profileHint = await getProfileOneLiner();
    const system = SYSTEM_BASE + buildSessionContext(domain, sessionMeta, profileHint);

    // 3. Agent Loop（流式 + 迭代上限 + 取消支持）
    history.push({ role: 'user', content: prompt });
    let lastInputTokens = 0;
    let response;
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      // 检查取消信号
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // 调用流式 API
      response = await callAnthropicStream(system, history, ALL_TOOLS, {
        onText: (delta) => uiCallbacks.appendText?.(delta),
        onToolCall: (block) => uiCallbacks.showToolCall?.(block),
      }, signal);

      // 更新 token 统计
      lastInputTokens = response.usage?.input_tokens || 0;
      
      // 追加助手消息到历史
      history.push({ role: 'assistant', content: response.content });

      // 如果不是工具调用，跳出循环
      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // 处理工具调用
      const results = [];
      for (const block of response.content) {
        // 检查取消信号
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        if (block.type === 'tool_use') {
          // 检测死循环
          if (detectDeadLoop(block.name, block.input)) {
            // 检测到死循环，中断执行
            const errorMsg = `\n⚠️ 检测到死循环：工具 "${block.name}" 连续调用了 ${DUPLICATE_CALL_THRESHOLD} 次。已自动中断。请尝试调整你的需求或重新开始对话。`;
            uiCallbacks.appendText?.(errorMsg);
            results.push({ 
              type: 'tool_result', 
              tool_use_id: block.id, 
              content: `死循环检测：工具 ${block.name} 连续调用了 ${DUPLICATE_CALL_THRESHOLD} 次，已强制中断。` 
            });
            // 继续处理其他工具调用，但跳过这个死循环的工具
            continue;
          }
          
          uiCallbacks.showToolExecuting?.(block.name);
          
          // 使用带重试的工具执行
          const output = await executeToolWithRetry(block.name, block.input, executeTool);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
          uiCallbacks.showToolResult?.(block.id, output);
        }
      }

      // 追加工具结果到历史
      history.push({ role: 'user', content: results });

      // 检查是否需要压缩历史
      if (lastInputTokens > TOKEN_BUDGET) {
        history = await checkAndCompressHistory(history, lastInputTokens);
      }
    }

    // 达到最大迭代次数时提示
    if (iterations >= MAX_ITERATIONS) {
      uiCallbacks.appendText?.('\n(已达到最大处理轮次，自动停止)');
    }

    // 4. 持久化历史
    await saveHistory(domain, sessionId, history);

    // 5. 首轮自动标题
    if (!sessionMeta.title) {
      sessionMeta.title = prompt.slice(0, 20);
      await saveSessionMeta(domain, sessionId, sessionMeta);
    }

    // 返回最终文本回复
    const textParts = response.content.filter(b => b.type === 'text').map(b => b.text);
    return textParts.join('');

  } catch (err) {
    // 处理取消
    if (err.name === 'AbortError') {
      uiCallbacks.appendText?.('\n(已取消)');
      return;
    }
    
    // 其他错误向上抛出
    throw err;
    
  } finally {
    // 清理状态
    isAgentRunning = false;
    currentAbortController = null;
    unlockTab();
  }
}

// =============================================================================
// §10.4 cancelAgentLoop 取消机制
// =============================================================================

/**
 * 取消当前正在执行的 Agent Loop
 * 
 * 调用 AbortController.abort()，重置运行状态，解锁 Tab。
 * 已应用的样式会保留，用户可通过对话要求 rollback。
 */
function cancelAgentLoop() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  isAgentRunning = false;
  
  // 动态导入 unlockTab 避免循环依赖
  import('./tools.js').then(({ unlockTab }) => {
    unlockTab();
  }).catch(err => {
    console.error('[Agent] Failed to unlock tab:', err);
  });
}

// =============================================================================
// 状态获取函数
// =============================================================================

/**
 * 获取 Agent 运行状态
 * @returns {boolean} true 表示正在运行
 */
function getIsAgentRunning() {
  return isAgentRunning;
}

/**
 * 获取当前 AbortController
 * @returns {AbortController|null}
 */
function getCurrentAbortController() {
  return currentAbortController;
}

// =============================================================================
// 导出常量和工具数组
// =============================================================================

export { 
  SYSTEM_BASE,
  BASE_TOOLS,
  ALL_TOOLS,
  AGENT_TYPES,
  buildSessionContext,
  TOKEN_BUDGET,
  checkAndCompressHistory,
  findTurnBoundary,
  summarizeOldTurns,
  RESTRICTED_PATTERNS,
  isRestrictedPage,
  checkPageAccess,
  // 新增导出
  MAX_ITERATIONS,
  SUB_MAX_ITERATIONS,
  callAnthropicStream,
  agentLoop,
  cancelAgentLoop,
  runTask,
  getIsAgentRunning,
  getCurrentAbortController,
  // §11.4 死循环保护
  MAX_RETRIES,
  DUPLICATE_CALL_THRESHOLD,
  resetToolCallHistory,
  generateToolCallKey,
  detectDeadLoop,
  executeToolWithRetry
};
