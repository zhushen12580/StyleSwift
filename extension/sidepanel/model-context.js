/**
 * StyleSwift - Model Context Window Management
 *
 * 动态获取模型的上下文窗口大小，用于计算 token 预算。
 * 不同模型有不同的上下文窗口，使用错误的值会导致：
 * - 上下文过短：无法利用模型的完整上下文能力
 * - 上下文过长：API 报错（超出上下文限制）
 *
 * @module model-context
 */

// ============================================================================
// 模型上下文窗口映射表
// ============================================================================

/**
 * 模型名称到上下文窗口大小的映射（单位：tokens）
 *
 * 数据来源：
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 * - OpenAI: https://platform.openai.com/docs/models
 * - DeepSeek: https://platform.deepseek.com/api-docs/
 * - 其他: 官方文档或 API 说明
 *
 * 注意：
 * 1. 模型名称可能有多种写法（带/不带前缀）
 * 2. 同一模型的不同版本可能有不同上下文窗口
 * 3. 新模型会持续发布，此表需要定期更新
 *
 * @type {Object.<string, number>}
 */
const MODEL_CONTEXT_WINDOWS = {
  // ========================================================================
  // Claude 系列 (Anthropic)
  // ========================================================================
  // Claude 3.5 系列 - 200k context window
  'claude-3-5-sonnet': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-5-haiku': 200000,
  'claude-3-5-haiku-20241022': 200000,
  
  // Claude 3 系列 - 200k context window
  'claude-3-opus': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku': 200000,
  'claude-3-haiku-20240307': 200000,
  
  // Claude 2 系列 - 100k context window
  'claude-2': 100000,
  'claude-2.1': 200000,
  'claude-2.0': 100000,
  'claude-instant': 100000,
  
  // ========================================================================
  // GPT 系列 (OpenAI)
  // ========================================================================
  // GPT-4o 系列 - 128k context window
  'gpt-4o': 128000,
  'gpt-4o-2024-05-13': 128000,
  'gpt-4o-2024-08-06': 128000,
  'gpt-4o-2024-11-20': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4o-mini-2024-07-18': 128000,
  
  // GPT-4 Turbo 系列 - 128k context window
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-2024-04-09': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-0125-preview': 128000,
  'gpt-4-1106-preview': 128000,
  
  // GPT-4 系列 - 128k (turbo) 或 8k/32k (legacy)
  'gpt-4': 8192,
  'gpt-4-0613': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-32k-0613': 32768,
  
  // GPT-3.5 系列 - 16k (default) 或 4k (legacy)
  'gpt-3.5-turbo': 16384,
  'gpt-3.5-turbo-0125': 16384,
  'gpt-3.5-turbo-1106': 16384,
  'gpt-3.5-turbo-16k': 16384,
  'gpt-3.5-turbo-instruct': 4096,
  
  // ========================================================================
  // DeepSeek 系列
  // ========================================================================
  // DeepSeek V3 - 64k context window
  'deepseek-chat': 64000,
  'deepseek-v3': 64000,
  
  // DeepSeek R1 - 64k context window
  'deepseek-reasoner': 64000,
  'deepseek-r1': 64000,
  
  // ========================================================================
  // Google Gemini 系列
  // ========================================================================
  // Gemini 2.0 - 1M context window (实验性)
  'gemini-2.0-flash': 1000000,
  'gemini-2.0-flash-exp': 1000000,
  
  // Gemini 1.5 系列 - 1M context window
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-pro-002': 1000000,
  'gemini-1.5-flash': 1000000,
  'gemini-1.5-flash-002': 1000000,
  
  // Gemini 1.0 系列 - 32k context window
  'gemini-1.0-pro': 32000,
  'gemini-pro': 32000,
  
  // ========================================================================
  // Moonshot (Kimi) 系列
  // ========================================================================
  // Moonshot V1 - 128k context window
  'moonshot-v1-8k': 8000,
  'moonshot-v1-32k': 32000,
  'moonshot-v1-128k': 128000,
  
  // ========================================================================
  // 智谱 AI 系列
  // ========================================================================
  'glm-4': 128000,
  'glm-4-plus': 128000,
  'glm-4-air': 128000,
  'glm-4-airx': 128000,
  'glm-4-flash': 128000,
  
  // ========================================================================
  // 阿里云千问系列
  // ========================================================================
  'qwen-turbo': 128000,
  'qwen-plus': 128000,
  'qwen-max': 32000,
  'qwen-max-longcontext': 28000,
  
  // ========================================================================
  // 百度文心系列
  // ========================================================================
  'ernie-4.0': 8000,
  'ernie-3.5': 8000,
  'ernie-4.0-8k': 8000,
  
  // ========================================================================
  // SiliconFlow 系列 (代理平台，聚合多种模型)
  // ========================================================================
  // SiliconFlow 上游模型命名格式：provider/model-name
  
  // ========================================================================
  // Groq 系列 (快速推理)
  // ========================================================================
  'llama-3.3-70b-versatile': 128000,
  'llama-3.3-70b-specdec': 128000,
  'llama-3.1-8b': 128000,
  'llama-3.1-70b': 128000,
  'llama-3.1-405b': 128000,
  'mixtral-8x7b-32768': 32768,
};

/**
 * 模型名称前缀匹配规则
 * 用于处理模型名称变体（如 "deepseek/deepseek-r1" 匹配到 "deepseek-r1"）
 * 
 * 格式：[前缀正则, 基础模型名, 默认上下文窗口]
 * 
 * @type {Array<[RegExp, string, number]>}
 */
const MODEL_PREFIX_RULES = [
  // Claude 前缀变体
  [/^anthropic\//, 'claude', 200000],
  [/^claude-/, 'claude', 200000],
  
  // OpenAI 前缀变体
  [/^openai\//, 'gpt', 128000],
  [/^gpt-/, 'gpt', 128000],
  
  // DeepSeek 前缀变体
  [/^deepseek\//, 'deepseek', 64000],
  [/^deepseek-/, 'deepseek', 64000],
  
  // Google Gemini 前缀变体
  [/^google\//, 'gemini', 1000000],
  [/^gemini-/, 'gemini', 1000000],
  
  // Moonshot 前缀变体
  [/^moonshot\//, 'moonshot', 128000],
  [/^moonshot-kimi\//, 'moonshot', 128000],
  
  // 智谱前缀变体
  [/^zhipu\//, 'glm', 128000],
  [/^glm-/, 'glm', 128000],
  
  // 阿里云前缀变体
  [/^alibaba\//, 'qwen', 128000],
  [/^qwen-/, 'qwen', 128000],
  [/^通义千问-/, 'qwen', 128000],
  
  // 百度前缀变体
  [/^baidu\//, 'ernie', 8000],
  [/^ernie-/, 'ernie', 8000],
];

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 根据模型名称获取上下文窗口大小
 * 
 * 查找顺序：
 * 1. 精确匹配 MODEL_CONTEXT_WINDOWS
 * 2. 前缀匹配 MODEL_PREFIX_RULES
 * 3. 返回默认值
 *
 * @param {string} modelName - 模型名称（可能包含前缀，如 "deepseek/deepseek-r1"）
 * @returns {number} 上下文窗口大小（tokens）
 *
 * @example
 * getContextWindowSize('claude-3-5-sonnet')        // 200000
 * getContextWindowSize('deepseek/deepseek-r1')      // 64000 (前缀匹配)
 * getContextWindowSize('unknown-model')             // 128000 (默认)
 */
export function getContextWindowSize(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    console.warn('[Model Context] Invalid model name:', modelName);
    return 128000; // 默认值
  }
  
  // 标准化模型名称：转小写，去除多余空格
  const normalizedName = modelName.toLowerCase().trim();
  
  // 1. 精确匹配
  if (MODEL_CONTEXT_WINDOWS[normalizedName]) {
    return MODEL_CONTEXT_WINDOWS[normalizedName];
  }
  
  // 2. 前缀匹配（处理 "provider/model-name" 格式）
  for (const [prefix, baseName, defaultWindow] of MODEL_PREFIX_RULES) {
    if (prefix.test(normalizedName)) {
      // 提取实际模型名（去除前缀）
      const actualName = normalizedName.replace(prefix, '');
      
      // 尝试用提取的名字再次查找
      const lookupName = baseName + '-' + actualName;
      if (MODEL_CONTEXT_WINDOWS[actualName]) {
        return MODEL_CONTEXT_WINDOWS[actualName];
      }
      if (MODEL_CONTEXT_WINDOWS[lookupName]) {
        return MODEL_CONTEXT_WINDOWS[lookupName];
      }
      
      // 未找到具体模型，返回前缀默认值
      console.log(`[Model Context] Using prefix default for "${modelName}": ${defaultWindow} tokens`);
      return defaultWindow;
    }
  }
  
  // 3. 未找到，返回保守默认值
  console.warn(`[Model Context] Unknown model "${modelName}", using default 128000 tokens`);
  return 128000;
}

/**
 * 计算 token 预算
 * 
 * 公式：budget = (context_window * usage_ratio) - system_overhead
 * 
 * @param {string} modelName - 模型名称
 * @param {number} [usageRatio=0.9] - 上下文窗口使用比例（默认 90%）
 * @param {number} [systemOverhead=4000] - 系统开销（系统提示词 + 工具定义）
 * @returns {number} token 预算
 *
 * @example
 * // Claude 3.5 Sonnet: 200k context, 90% usage, 4000 overhead
 * // budget = 200000 * 0.9 - 4000 = 176000
 * calculateTokenBudget('claude-3-5-sonnet')  // 176000
 * 
 * // DeepSeek R1: 64k context
 * // budget = 64000 * 0.9 - 4000 = 53600
 * calculateTokenBudget('deepseek/deepseek-r1')  // 53600
 */
export function calculateTokenBudget(modelName, usageRatio = 0.9, systemOverhead = 4000) {
  const contextWindow = getContextWindowSize(modelName);
  const budget = Math.floor(contextWindow * usageRatio) - systemOverhead;
  
  // 确保预算至少为常用值（避免计算出负数或过小的值）
  const MIN_BUDGET = 10000;
  const finalBudget = Math.max(budget, MIN_BUDGET);
  
  if (budget < MIN_BUDGET) {
    console.warn(
      `[Model Context] Calculated budget ${budget} too low for model "${modelName}", ` +
      `using minimum ${MIN_BUDGET} tokens`
    );
  }
  
  return finalBudget;
}

/**
 * 获取模型信息摘要
 * 
 * @param {string} modelName - 模型名称
 * @returns {{contextWindow: number, tokenBudget: number, usageRatio: number, systemOverhead: number}}
 */
export function getModelInfo(modelName) {
  const contextWindow = getContextWindowSize(modelName);
  const usageRatio = 0.9;
  const systemOverhead = 4000;
  const tokenBudget = calculateTokenBudget(modelName, usageRatio, systemOverhead);
  
  return {
    contextWindow,
    tokenBudget,
    usageRatio,
    systemOverhead,
  };
}

// ============================================================================
// 导出
// ============================================================================

export {
  MODEL_CONTEXT_WINDOWS,
  MODEL_PREFIX_RULES,
};