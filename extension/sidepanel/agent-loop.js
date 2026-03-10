/**
 * StyleSwift - Agent Loop
 * Agent 主循环 + 系统提示词定义
 */

import { BASE_TOOLS, ALL_TOOLS } from './tools.js';

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
const SYSTEM_BASE = `你是 StyleSwift，网页样式个性化智能体。使用工具帮用户修改网页样式，优先行动，完成后简要总结。

CSS规则：具体选择器+!important，颜色用hex/rgba，不用CSS变量/*/@import，不用*或标签通配。

收到[用户指定元素]时优先用其选择器定位，无需再调get_page_structure。

风格技能：仅用户明确要求时才save_style_skill；应用时先load_skill再结合页面结构适配选择器，保持视觉一致但选择器必须适配目标页面。`;

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
 * 找到第一轮对话的结束位置
 * 
 * 第一轮 = 第一条用户文本消息 + 后续所有工具交换 + 助手回复，
 * 直到遇到第二条用户文本消息为止。
 * 
 * @param {Array} history - 对话历史数组
 * @returns {number} 第一轮对话结束的索引（即第二条用户文本消息的索引）
 */
function findFirstTurnEnd(history) {
  let foundFirst = false;
  for (let i = 0; i < history.length; i++) {
    if (history[i].role === 'user' && typeof history[i].content === 'string') {
      if (!foundFirst) {
        foundFirst = true;
        continue;
      }
      return i;
    }
  }
  return history.length;
}

/**
 * 压缩对话历史（仅用于 LLM 视图，不影响持久化）
 * 
 * 基于 API 返回的 lastInputTokens 判断是否需要压缩。
 * 压缩策略：保留第一轮完整对话 + 最近 3 轮对话，中间部分生成 LLM 摘要。
 * 完整对话历史和 CSS 快照始终完整保存在 IndexedDB 中。
 * 
 * @param {Array} history - 对话历史数组
 * @param {number} lastInputTokens - 上次 API 调用的 input_tokens
 * @returns {Promise<Array>} 压缩后的消息数组（可能不变）
 */
async function checkAndCompressHistory(history, lastInputTokens) {
  if (lastInputTokens <= TOKEN_BUDGET) {
    return history;
  }

  const firstTurnEnd = findFirstTurnEnd(history);
  const recentStart = findTurnBoundary(history, 3);

  if (recentStart <= firstTurnEnd) {
    return history;
  }

  const firstTurn = history.slice(0, firstTurnEnd);
  const middlePart = history.slice(firstTurnEnd, recentStart);
  const recentPart = history.slice(recentStart);

  if (middlePart.length === 0) {
    return history;
  }

  const summary = await summarizeOldTurns(middlePart);

  return [
    ...firstTurn,
    { role: 'user', content: `[中间对话摘要]\n${summary}` },
    { role: 'assistant', content: [{ type: 'text', text: '好的，我已了解之前的对话内容。' }] },
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

    // 调用 LLM 生成摘要（OpenAI 兼容格式）
    const resp = await fetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '用一段简洁的文字总结以下对话历史，重点保留：用户的风格偏好、已应用的样式变更、未完成的请求。不超过 300 字。'
          },
          { role: 'user', content: condensed }
        ],
        max_tokens: 500,
      })
    });

    if (!resp.ok) {
      console.error('[History Compression] API error:', resp.status);
      return '(历史摘要生成失败)';
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    return text || '(历史摘要生成失败)';
    
  } catch (err) {
    console.error('[History Compression] Failed:', err);
    return '(历史摘要生成失败)';
  }
}

// =============================================================================
// §6.4 工具结果压缩（LLM 视图）
// =============================================================================

/**
 * 压缩旧的工具结果以减少 context 占用
 * 
 * 创建消息数组的浅拷贝，将除最近一条外的所有 tool_result 内容
 * 替换为 '[已处理]' 占位符。原始 history 不受影响。
 * 
 * @param {Array} messages - 对话历史数组
 * @returns {Array} 压缩后的消息数组（浅拷贝）
 */
function compressToolResultsForLLM(messages) {
  let lastToolResultIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && Array.isArray(messages[i].content)) {
      if (messages[i].content.some(c => c.type === 'tool_result')) {
        lastToolResultIdx = i;
        break;
      }
    }
  }

  if (lastToolResultIdx === -1) return messages;

  return messages.map((msg, idx) => {
    if (idx >= lastToolResultIdx) return msg;
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
    if (!msg.content.some(c => c.type === 'tool_result')) return msg;

    return {
      ...msg,
      content: msg.content.map(item => {
        if (item.type !== 'tool_result') return item;
        return { type: 'tool_result', tool_use_id: item.tool_use_id, content: '[已处理]' };
      })
    };
  });
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
// §11.3 AgentError - 分类错误
// =============================================================================

class AgentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// §10.1 LLM API 调用（Streaming）
// =============================================================================

/**
 * 调用 LLM Streaming API（OpenAI 兼容格式）
 *
 * 支持流式输出和工具调用。底层使用 /v1/chat/completions 端点。
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
 * const result = await callLLMStream(
 *   'You are a helpful assistant',
 *   [{ role: 'user', content: 'Hello' }],
 *   ALL_TOOLS,
 *   { onText: (delta) => console.log(delta) },
 *   abortController.signal
 * );
 */
async function callLLMStream(system, messages, tools, callbacks, abortSignal) {
  // 动态导入依赖
  const { getSettings } = await import('./api.js');
  
  const { apiKey, model, apiBase } = await getSettings();

  // 转换为 OpenAI 格式的消息
  const openaiMessages = [];
  
  // 添加系统消息
  if (system) {
    openaiMessages.push({ role: 'system', content: system });
  }
  
  // 转换消息格式
  for (const msg of messages) {
    if (msg.role === 'user') {
      // 用户消息
      if (typeof msg.content === 'string') {
        openaiMessages.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // 检查是否是工具结果
        const hasToolResult = msg.content.some(c => c.type === 'tool_result');
        if (hasToolResult) {
          // 工具结果消息 - 转换为 OpenAI 格式
          for (const item of msg.content) {
            if (item.type === 'tool_result') {
              // 确保 content 是字符串（OpenAI API 要求）
              let toolContent = item.content;
              if (typeof toolContent !== 'string') {
                toolContent = JSON.stringify(toolContent);
              }
              openaiMessages.push({
                role: 'tool',
                tool_call_id: item.tool_use_id,
                content: toolContent,
              });
            }
          }
        } else {
          // 处理多模态内容
          const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          if (textParts) {
            openaiMessages.push({ role: 'user', content: textParts });
          }
        }
      }
    } else if (msg.role === 'assistant') {
      // 助手消息
      const textContent = msg.content?.find(c => c.type === 'text')?.text || '';
      const toolCalls = msg.content?.filter(c => c.type === 'tool_use').map(c => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input),
        }
      }));
      
      if (toolCalls && toolCalls.length > 0) {
        openaiMessages.push({ 
          role: 'assistant', 
          content: textContent || null,
          tool_calls: toolCalls 
        });
      } else {
        openaiMessages.push({ role: 'assistant', content: textContent || '' });
      }
    }
  }

  // 转换工具格式
  const openaiTools = tools?.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }
  }));

  try {
    const url = `${apiBase}/v1/chat/completions`;
    const requestBody = {
      model,
      messages: openaiMessages,
      max_tokens: 8000,
      stream: true,
    };
    
    if (openaiTools && openaiTools.length > 0) {
      requestBody.tools = openaiTools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new AgentError('API_KEY_INVALID', '请检查 API Key 是否正确');
      }
      if (response.status === 429) {
        throw new AgentError('RATE_LIMITED', `API 限流: ${errorText}`);
      }
      if (response.status >= 500) {
        throw new AgentError('API_ERROR', `API 服务异常 (${response.status}): ${errorText}`);
      }
      throw new AgentError('API_ERROR', `API 错误 (${response.status}): ${errorText}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const result = { content: [], stop_reason: null, usage: null };
    let currentText = '';
    let currentToolCalls = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.trim() === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));
          const choice = data.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          
          // 处理文本内容
          if (delta.content) {
            currentText += delta.content;
            callbacks.onText?.(delta.content);
          }
          
          // 处理工具调用
          if (delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index;
              if (!currentToolCalls[index]) {
                currentToolCalls[index] = {
                  id: toolCall.id || `call_${Date.now()}_${index}`,
                  type: 'tool_use',
                  name: toolCall.function?.name || '',
                  input: '',
                };
              }
              
              if (toolCall.function?.name) {
                currentToolCalls[index].name = toolCall.function.name;
              }
              
              if (toolCall.function?.arguments) {
                currentToolCalls[index].input += toolCall.function.arguments;
              }
            }
          }
          
          // 处理结束原因
          if (choice.finish_reason) {
            result.stop_reason = choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason;
          }
          
          // 处理使用统计
          if (data.usage) {
            result.usage = {
              input_tokens: data.usage.prompt_tokens,
              output_tokens: data.usage.completion_tokens,
            };
          }
        } catch (e) {
          console.warn('[Stream] Failed to parse SSE line:', line, e);
        }
      }
    }

    // 构建最终内容
    if (currentText) {
      result.content.push({ type: 'text', text: currentText });
    }
    
    for (const toolCall of currentToolCalls) {
      if (toolCall && toolCall.name) {
        try {
          toolCall.input = JSON.parse(toolCall.input);
        } catch (e) {
          console.warn('[Stream] Failed to parse tool input:', e);
          toolCall.input = {};
        }
        callbacks.onToolCall?.(toolCall);
        result.content.push(toolCall);
      }
    }

    return result;
    
  } catch (error) {
    if (error.name === 'AbortError' || abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (error instanceof AgentError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new AgentError('NETWORK_ERROR', '网络连接失败，请检查网络');
    }
    throw new AgentError('API_ERROR', `API 调用失败: ${error.message || error}`);
  }
}

/**
 * 带安全重试的 LLM API 调用
 *
 * 对 callLLMStream 的安全包装，按错误类型做分类处理：
 * - 401: 直接抛出，不重试
 * - 429: 指数退避重试
 * - TypeError (网络): 直接抛出
 * - 其他: 直接抛出
 */
const API_MAX_RETRIES = 2;

async function callLLMStreamSafe(system, messages, tools, callbacks, abortSignal) {
  let retries = 0;
  while (retries <= API_MAX_RETRIES) {
    try {
      return await callLLMStream(system, messages, tools, callbacks, abortSignal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.code === 'API_KEY_INVALID') throw err;
      if (err.code === 'NETWORK_ERROR') throw err;

      if (err.code === 'RATE_LIMITED' && retries < API_MAX_RETRIES) {
        const waitMs = Math.pow(2, retries) * 2000;
        callbacks.onStatus?.(`API 限流，${waitMs / 1000}秒后重试...`);
        await sleep(waitMs);
        retries++;
        continue;
      }

      throw err;
    }
  }
  throw new AgentError('MAX_RETRIES', 'API 多次重试失败');
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
async function executeToolWithRetry(toolName, args, executor, context) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executor(toolName, args, context);
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
async function runTask(description, prompt, agentType, abortSignal) {
  const config = AGENT_TYPES[agentType];
  
  if (!config) {
    return `未知子智能体类型: ${agentType}`;
  }

  const subSystem = `${config.prompt}\n\n完成任务后返回清晰、简洁的摘要。`;
  
  const subTools = config.tools === '*'
    ? BASE_TOOLS
    : BASE_TOOLS.filter(t => config.tools.includes(t.name));

  const subMessages = [{ role: 'user', content: prompt }];
  let iterations = 0;
  let subToolCallHistory = [];

  const { executeTool } = await import('./tools.js');

  while (iterations++ < SUB_MAX_ITERATIONS) {
    // 检查取消信号
    if (abortSignal?.aborted) {
      return '(子智能体已被取消)';
    }

    try {
      const response = await callLLMStreamSafe(
        subSystem, 
        subMessages, 
        subTools, 
        { onText: () => {}, onToolCall: () => {} },
        abortSignal
      );

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(b => b.type === 'text');
        return textBlock?.text || '(子智能体无输出)';
      }

      const results = [];
      for (const block of response.content) {
        if (abortSignal?.aborted) return '(子智能体已被取消)';

        if (block.type === 'tool_use') {
          // 子智能体死循环检测
          const callKey = generateToolCallKey(block.name, block.input);
          subToolCallHistory.push(callKey);
          if (subToolCallHistory.length >= DUPLICATE_CALL_THRESHOLD) {
            const recent = subToolCallHistory.slice(-DUPLICATE_CALL_THRESHOLD);
            if (recent.every(k => k === callKey)) {
              return `(子智能体检测到死循环: ${block.name} 连续调用 ${DUPLICATE_CALL_THRESHOLD} 次)`;
            }
          }

          const output = await executeTool(block.name, block.input);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
        }
      }

      subMessages.push({ role: 'assistant', content: response.content });
      subMessages.push({ role: 'user', content: results });

    } catch (error) {
      if (error.name === 'AbortError') return '(子智能体已被取消)';
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
    currentSession,
    countUserTextMessages
  } = await import('./session.js');
  const { getProfileOneLiner } = await import('./profile.js');

  try {
    // 0. 锁定当前 Tab 并预检测页面可访问性
    const tabId = await getTargetTabId();
    lockTab(tabId);

    const access = await checkPageAccess(tabId);
    if (!access.ok) {
      uiCallbacks.appendText?.(access.reason);
      return;
    }
    const domain = access.domain || 'unknown';
    
    // 创建或获取会话
    const sessionId = await getOrCreateSession(domain);
    const session = new SessionContext(domain, sessionId);
    setCurrentSession(session);

    // 1. 加载历史（含快照）
    const historyData = await loadAndPrepareHistory(domain, sessionId);
    const fullHistory = historyData.messages;
    const snapshots = historyData.snapshots;

    // 2. 构建 system prompt = L0 + L1
    const sessionMeta = await loadSessionMeta(domain, sessionId);
    const profileHint = await getProfileOneLiner();
    const system = SYSTEM_BASE + buildSessionContext(domain, sessionMeta, profileHint);

    // 3. Agent Loop（流式 + 迭代上限 + 取消支持）
    // 新会话自动附加页面结构概览，减少首轮工具调用
    let enrichedPrompt = prompt;
    if (fullHistory.length === 0) {
      try {
        const pageStructure = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { tool: 'get_page_structure' }, (resp) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(resp);
          });
        });
        if (pageStructure && typeof pageStructure === 'string') {
          enrichedPrompt = prompt + `\n\n[页面结构概览]\n${pageStructure}`;
        }
      } catch (e) {
        console.warn('[Agent] Failed to pre-fetch page structure:', e);
      }
    }

    // fullHistory: 完整历史，持久化到 IndexedDB
    // llmHistory: LLM 视图，可被压缩以节省 context
    const userMsg = { role: 'user', content: enrichedPrompt };
    fullHistory.push(userMsg);
    let llmHistory = [...fullHistory];
    let lastInputTokens = 0;
    let response;
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      // 检查取消信号
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // 压缩旧工具结果，减少 context 占用（不影响 llmHistory）
      const messagesForLLM = compressToolResultsForLLM(llmHistory);

      // 调用流式 API（带安全重试）
      response = await callLLMStreamSafe(system, messagesForLLM, ALL_TOOLS, {
        onText: (delta) => uiCallbacks.appendText?.(delta),
        onToolCall: (block) => uiCallbacks.showToolCall?.(block),
        onStatus: (msg) => uiCallbacks.appendText?.(msg),
      }, signal);

      // 更新 token 统计
      lastInputTokens = response.usage?.input_tokens || 0;
      
      // 追加助手消息到完整历史和 LLM 视图
      const assistantMsg = { role: 'assistant', content: response.content };
      fullHistory.push(assistantMsg);
      llmHistory.push(assistantMsg);

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
          // 检测死循环：连续相同工具+相同参数时，跳过执行并提示 LLM 改变策略
          if (detectDeadLoop(block.name, block.input)) {
            results.push({ 
              type: 'tool_result', 
              tool_use_id: block.id, 
              content: `⚠️ 检测到重复调用：${block.name} 已连续 ${DUPLICATE_CALL_THRESHOLD} 次使用相同参数，结果不会改变。请换一种方式完成任务，例如使用不同的工具、调整参数或直接给出回复。` 
            });
            resetToolCallHistory();
            continue;
          }
          
          uiCallbacks.showToolExecuting?.(block.name);
          
          // 使用带重试的工具执行，传递 abortSignal 上下文
          const toolContext = { abortSignal: signal };
          const output = await executeToolWithRetry(block.name, block.input, executeTool, toolContext);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
          uiCallbacks.showToolResult?.(block.id, output);
        }
      }

      // 追加工具结果到完整历史和 LLM 视图
      const toolResultMsg = { role: 'user', content: results };
      fullHistory.push(toolResultMsg);
      llmHistory.push(toolResultMsg);

      // 超预算时仅压缩 LLM 视图，完整历史不受影响
      if (lastInputTokens > TOKEN_BUDGET) {
        llmHistory = await checkAndCompressHistory(llmHistory, lastInputTokens);
      }
    }

    // 达到最大迭代次数时提示
    if (iterations >= MAX_ITERATIONS) {
      uiCallbacks.appendText?.('\n(已达到最大处理轮次，自动停止)');
    }

    // 4. 捕获当前轮的 CSS 快照，完整历史和快照持久化到 IndexedDB
    const turnNumber = countUserTextMessages(fullHistory);
    const cssResult = await chrome.storage.local.get(session.stylesKey);
    snapshots[turnNumber] = cssResult[session.stylesKey] || '';
    await saveHistory(domain, sessionId, { messages: fullHistory, snapshots });

    // 5. 首轮自动标题
    if (!sessionMeta.title) {
      sessionMeta.title = prompt.slice(0, 20);
      await saveSessionMeta(domain, sessionId, sessionMeta);
    }

    // 返回最终文本回复
    const textParts = response.content.filter(b => b.type === 'text').map(b => b.text);
    return textParts.join('');

  } catch (err) {
    if (err.name === 'AbortError') {
      uiCallbacks.appendText?.('\n(已取消)');
      return;
    }

    if (err instanceof AgentError) {
      const userMessages = {
        'API_KEY_INVALID': '\n⚠️ API Key 无效，请在设置中检查。',
        'NETWORK_ERROR': '\n⚠️ 网络连接失败，请检查网络后重试。',
        'RATE_LIMITED': '\n⚠️ API 请求频率过高，请稍后重试。',
        'MAX_RETRIES': '\n⚠️ API 多次重试失败，请稍后重试。',
      };
      uiCallbacks.appendText?.(userMessages[err.code] || `\n⚠️ ${err.message}`);
      return;
    }

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
  AGENT_TYPES,
  buildSessionContext,
  TOKEN_BUDGET,
  findFirstTurnEnd,
  checkAndCompressHistory,
  findTurnBoundary,
  summarizeOldTurns,
  compressToolResultsForLLM,
  RESTRICTED_PATTERNS,
  isRestrictedPage,
  checkPageAccess,
  MAX_ITERATIONS,
  SUB_MAX_ITERATIONS,
  AgentError,
  callLLMStream,
  callLLMStreamSafe,
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
