/**
 * StyleSwift - API Settings Module
 *
 * API Key 与连接管理：
 * - 设置存储（getSettings / saveSettings）
 * - 权限动态申请（ensureApiPermission）
 * - 连接验证（validateConnection）
 * - 首次启动检测（checkFirstRun）
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 规范化 API 基础地址
 *
 * 只移除尾部斜杠，保留用户输入的版本号路径。
 * 版本号的处理由 buildApiUrl 函数负责。
 *
 * @param {string} apiBase - 用户输入的 API 地址
 * @returns {string} 规范化后的基础地址
 *
 * @example
 * normalizeApiBase("https://api.example.com/v1")           // "https://api.example.com/v1"
 * normalizeApiBase("https://api.example.com/v4/")           // "https://api.example.com/v4"
 * normalizeApiBase("https://api.example.com/api/v1")        // "https://api.example.com/api/v1"
 * normalizeApiBase("https://api.example.com/anthropic/v1")  // "https://api.example.com/anthropic/v1"
 */
function normalizeApiBase(apiBase) {
  try {
    const url = new URL(apiBase);
    // 只移除尾部斜杠，保留用户输入的版本号
    const pathname = url.pathname.replace(/\/+$/, "");
    return url.origin + pathname;
  } catch {
    return apiBase;
  }
}

/**
 * 检查 URL 路径是否已包含版本号
 *
 * @param {string} pathname - URL 路径
 * @returns {boolean} 是否已包含版本号（如 /v1、/v2、/v4 等）
 *
 * @example
 * hasVersionInPath("/v1/chat/completions")     // true
 * hasVersionInPath("/api/v4/chat/completions") // true
 * hasVersionInPath("/openai/chat/completions") // false
 */
function hasVersionInPath(pathname) {
  // 匹配 /v1、/v2、/v4 等版本号路径段
  return /\/v\d+(?:\/|$)/i.test(pathname);
}

/**
 * 构建 API 请求 URL
 *
 * 智能拼接 URL：
 * - 如果 apiBase 已包含版本号（如 /v1、/v4），直接拼接端点路径
 * - 如果 apiBase 不包含版本号，添加 /v1 前缀
 *
 * @param {string} apiBase - API 基础地址（已规范化）
 * @param {string} endpoint - 端点路径（如 /chat/completions 或 /messages）
 * @returns {string} 完整的 API URL
 *
 * @example
 * buildApiUrl("https://api.example.com", "/chat/completions")
 *   // "https://api.example.com/v1/chat/completions"
 * buildApiUrl("https://api.example.com/v4", "/chat/completions")
 *   // "https://api.example.com/v4/chat/completions"
 * buildApiUrl("https://api.example.com/api/v1", "/chat/completions")
 *   // "https://api.example.com/api/v1/chat/completions"
 */
function buildApiUrl(apiBase, endpoint) {
  try {
    const url = new URL(apiBase);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (hasVersionInPath(pathname)) {
      // 已包含版本号，直接拼接端点
      return url.origin + pathname + endpoint;
    }

    // 未包含版本号，添加 /v1 前缀
    return url.origin + pathname + "/v1" + endpoint;
  } catch {
    // URL 解析失败，尝试简单拼接
    const base = apiBase.replace(/\/+$/, "");
    if (hasVersionInPath(base)) {
      return base + endpoint;
    }
    return base + "/v1" + endpoint;
  }
}

/**
 * 默认 API 基础地址
 * OpenAI 兼容 API 的默认端点
 * @type {string}
 */
const DEFAULT_API_BASE = "https://api.ppio.com/openai";

/**
 * 默认模型
 * 当前使用的默认模型
 * @type {string}
 */
const DEFAULT_MODEL = "deepseek/deepseek-r1";

/**
 * 默认视觉模型
 * 用于图像理解的多模态模型
 * @type {string}
 */
const DEFAULT_VISION_MODEL = "";

/**
 * 设置存储 key
 * @type {string}
 */
const SETTINGS_KEY = "settings";

// ============================================================================
// Provider 检测
// ============================================================================

/**
 * Claude 原生 API 的特征域名列表
 * @type {string[]}
 */
const CLAUDE_API_DOMAINS = ["api.anthropic.com", "anthropic.com"];

/**
 * 检测给定的 apiBase 是否应使用 Claude 原生 API（/v1/messages 格式）
 *
 * 判断依据（满足任一即视为 Claude 原生）：
 * 1. 域名属于 Anthropic 官方（api.anthropic.com）
 * 2. URL 路径中包含 "anthropic" 段（如第三方代理 https://api.ppio.com/anthropic）
 *
 * 模型名称不作为判断依据——许多第三方 OpenAI 兼容代理也提供 claude-* 模型，
 * 但接口是 OpenAI 格式（/openai 路径），不应走 Claude 原生路径。
 *
 * @param {string} apiBase - 规范化后的 API 基础地址
 * @param {string} [_model] - 模型名称（保留参数，暂不使用）
 * @returns {"claude"|"openai"} provider 类型
 *
 * @example
 * detectProvider("https://api.anthropic.com")              // "claude"（官方）
 * detectProvider("https://api.ppio.com/anthropic")         // "claude"（代理 anthropic 路径）
 * detectProvider("https://api.ppio.com/openai", "claude-3-5-sonnet")  // "openai"（OpenAI 兼容代理）
 * detectProvider("https://api.ppio.com/openai", "deepseek/deepseek-r1") // "openai"
 */
function detectProvider(apiBase, _model) {
  try {
    const url = new URL(apiBase);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 官方域名
    if (CLAUDE_API_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return "claude";
    }

    // 路径中包含 /anthropic 段（第三方代理的 anthropic 兼容路径）
    if (/(?:^|\/)anthropic(?:\/|$)/.test(pathname)) {
      return "claude";
    }
  } catch {
    // URL 解析失败，回退到 openai
  }

  return "openai";
}

// ============================================================================
// API 设置存储
// ============================================================================

/**
 * 从 chrome.storage.local 读取 API 设置
 *
 * 读取 settings 对象（包含 apiKey, apiBase, model, visionApiKey, visionApiBase, visionModel）。
 * 如果未配置 API Key，抛出错误提示用户去设置。
 *
 * @returns {Promise<{apiKey: string, apiBase: string, model: string, visionApiKey?: string, visionApiBase?: string, visionModel?: string}>}
 * @throws {Error} 当未配置 API Key 时抛出错误
 *
 * @example
 * try {
 *   const settings = await getSettings();
 *   console.log(settings.apiKey, settings.apiBase, settings.model);
 * } catch (err) {
 *   console.error(err.message); // "请先在设置中配置 API Key"
 * }
 */
async function getSettings() {
  const { settings } = await chrome.storage.local.get(SETTINGS_KEY);

  // 检查是否已配置 API Key
  if (!settings?.apiKey) {
    throw new Error("请先在设置中配置 API Key");
  }

  // 规范化 apiBase，移除多余路径
  const rawApiBase = settings.apiBase || DEFAULT_API_BASE;
  const apiBase = normalizeApiBase(rawApiBase);

  // 视觉模型配置（可选）
  const visionSettings = {
    visionApiKey: settings.visionApiKey || undefined,
    visionApiBase: settings.visionApiBase
      ? normalizeApiBase(settings.visionApiBase)
      : undefined,
    visionModel: settings.visionModel || undefined,
  };

  const model = settings.model || DEFAULT_MODEL;

  return {
    apiKey: settings.apiKey,
    model,
    apiBase,
    provider: detectProvider(apiBase, model),
    ...visionSettings,
  };
}

/**
 * 根据 是否包含图片 获取对应的 API 设置
 *
 * 如果有图片且配置了独立的视觉模型设置，返回视觉模型配置；
 * 否则返回默认的编码模型配置。
 *
 * @param {boolean} hasImages - 是否包含图片
 * @returns {Promise<{apiKey: string, apiBase: string, model: string}>}
 */
async function getSettingsForRequest(hasImages) {
  const settings = await getSettings();

  if (hasImages && settings.visionModel) {
    // 有图片且配置了视觉模型，使用视觉模型配置
    const visionApiBase = settings.visionApiBase || settings.apiBase;
    const visionModel = settings.visionModel;
    
    // Debug: Log vision model selection
    console.log("[getSettingsForRequest] Using vision model:", {
      hasImages,
      visionModel,
      visionApiBase,
      visionApiKey: settings.visionApiKey ? '(set)' : '(using main key)',
    });
    
    return {
      apiKey: settings.visionApiKey || settings.apiKey,
      apiBase: visionApiBase,
      model: visionModel,
      provider: detectProvider(visionApiBase, visionModel),
    };
  }

  // Debug: Log main model selection
  console.log("[getSettingsForRequest] Using main model:", {
    hasImages,
    reason: hasImages ? 'visionModel not configured' : 'no images detected',
    model: settings.model,
    provider: detectProvider(settings.apiBase, settings.model),
  });

  // 默认使用编码模型配置
  return {
    apiKey: settings.apiKey,
    apiBase: settings.apiBase,
    model: settings.model,
    provider: detectProvider(settings.apiBase, settings.model),
  };
}

/**
 * 保存 API 设置到 chrome.storage.local
 *
 * 合并写入设置，保留未提供的字段。
 * 确保必填字段有默认值：
 * - apiBase 默认为 DEFAULT_API_BASE
 * - model 默认为 DEFAULT_MODEL
 *
 * @param {Object} options - 设置选项
 * @param {string} [options.apiKey] - API Key
 * @param {string} [options.apiBase] - API 基础地址
 * @param {string} [options.model] - 模型名称
 * @param {string} [options.visionApiKey] - 视觉模型 API Key（可选）
 * @param {string} [options.visionApiBase] - 视觉模型 API 地址（可选）
 * @param {string} [options.visionModel] - 视觉模型名称（可选）
 * @returns {Promise<void>}
 *
 * @example
 * // 首次配置
 * await saveSettings({ apiKey: 'sk-ant-xxx' });
 *
 * // 更新部分设置
 * await saveSettings({ model: 'claude-opus-4-20250514' });
 *
 * // 自定义 API 地址
 * await saveSettings({ apiBase: 'https://my-proxy.example.com' });
 *
 * // 配置视觉模型
 * await saveSettings({ visionModel: 'gpt-4o', visionApiKey: 'sk-xxx' });
 */
async function saveSettings({
  apiKey,
  apiBase,
  model,
  visionApiKey,
  visionApiBase,
  visionModel,
}) {
  // 获取当前设置（如果存在），失败时使用空对象
  let current = {};
  try {
    const result = await getSettings();
    current = result;
  } catch {
    // 未配置过设置，使用默认值
    current = {
      apiKey: "",
      apiBase: DEFAULT_API_BASE,
      model: DEFAULT_MODEL,
    };
  }

  // 规范化 apiBase，移除多余路径
  const rawApiBase = apiBase ?? current.apiBase ?? DEFAULT_API_BASE;
  const normalizedApiBase = normalizeApiBase(rawApiBase);

  // 规范化 visionApiBase
  const rawVisionApiBase = visionApiBase ?? current.visionApiBase;
  const normalizedVisionApiBase = rawVisionApiBase
    ? normalizeApiBase(rawVisionApiBase)
    : undefined;

  // 合并新旧设置
  const newSettings = {
    apiKey: apiKey ?? current.apiKey,
    apiBase: normalizedApiBase,
    model: model ?? current.model ?? DEFAULT_MODEL,
    // 视觉模型设置（可选，使用 undefined 而非空字符串）
    visionApiKey:
      visionApiKey !== undefined ? visionApiKey : current.visionApiKey,
    visionApiBase: normalizedVisionApiBase,
    visionModel: visionModel !== undefined ? visionModel : current.visionModel,
  };

  // 清理 undefined 值
  if (!newSettings.visionApiKey) delete newSettings.visionApiKey;
  if (!newSettings.visionApiBase) delete newSettings.visionApiBase;
  if (!newSettings.visionModel) delete newSettings.visionModel;

  // 写入存储
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}

// ============================================================================
// API 权限动态申请
// ============================================================================

/**
 * 确保 API 访问权限
 *
 * 当 apiBase 非默认地址时，通过 chrome.permissions.request()
 * 动态申请对应 origin 的访问权限。
 *
 * 默认地址已在 manifest.json 的 host_permissions 中声明，
 * 无需额外申请。
 *
 * @param {string} apiBase - API 基础地址
 * @returns {Promise<boolean>} 是否获得权限
 *
 * @example
 * const settings = await getSettings();
 * const hasPermission = await ensureApiPermission(settings.apiBase);
 * if (!hasPermission) {
 *   console.error('未获得 API 访问权限');
 * }
 */
async function ensureApiPermission(apiBase) {
  // 默认地址已在 host_permissions 中声明，直接返回
  if (apiBase === DEFAULT_API_BASE) {
    return true;
  }

  try {
    const url = new URL(apiBase);
    const pattern = `${url.origin}/*`;

    // 检查是否已有权限
    const granted = await chrome.permissions.contains({ origins: [pattern] });
    if (granted) {
      return true;
    }

    // 动态申请权限（会弹出用户确认对话框）
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    // URL 解析失败或其他错误
    console.error("[API] Failed to ensure permission for:", apiBase);
    return false;
  }
}

// ============================================================================
// 连接验证
// ============================================================================

/**
 * 验证 API 连接有效性
 *
 * 根据 provider 类型自动选择验证端点和请求格式：
 * - OpenAI 兼容：POST {apiBase}/v1/chat/completions（或使用用户指定的版本号）
 * - Claude 原生：POST {apiBase}/v1/messages（或使用用户指定的版本号）
 *
 * 智能处理版本号：
 * - 如果 apiBase 已包含版本号（如 /v4），则直接使用
 * - 如果 apiBase 不包含版本号，则自动添加 /v1
 *
 * @param {string} apiKey - API Key
 * @param {string} apiBase - API 基础地址
 * @param {string} model - 模型名称
 * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
 *
 * @example
 * const result = await validateConnection('sk-xxx', 'https://api.ppio.com/openai', 'deepseek/deepseek-r1');
 * if (result.ok) {
 *   console.log('连接成功');
 * } else {
 *   console.error('连接失败:', result.error || `HTTP ${result.status}`);
 * }
 */
async function validateConnection(apiKey, apiBase, model = DEFAULT_MODEL) {
  const provider = detectProvider(apiBase, model);

  try {
    if (provider === "claude") {
      // 使用 buildApiUrl 智能拼接 URL
      const url = buildApiUrl(apiBase, "/messages");
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10,
        }),
      });
      return { ok: resp.ok, status: resp.status };
    } else {
      // 使用 buildApiUrl 智能拼接 URL
      const url = buildApiUrl(apiBase, "/chat/completions");
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10,
          stream: false,
        }),
      });
      return { ok: resp.ok, status: resp.status };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// 首次启动检测
// ============================================================================

/**
 * 检测是否首次使用（无 API Key）
 *
 * 用于判断是否需要显示引导页。
 *
 * @returns {Promise<{needsSetup: boolean}>}
 *
 * @example
 * const { needsSetup } = await checkFirstRun();
 * if (needsSetup) {
 *   showOnboardingPage();
 * } else {
 *   showMainPage();
 * }
 */
async function checkFirstRun() {
  try {
    const settings = await getSettings();
    return { needsSetup: false };
  } catch {
    return { needsSetup: true };
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  DEFAULT_API_BASE,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
  SETTINGS_KEY,
  CLAUDE_API_DOMAINS,
  normalizeApiBase,
  hasVersionInPath,
  buildApiUrl,
  detectProvider,
  getSettings,
  getSettingsForRequest,
  saveSettings,
  ensureApiPermission,
  validateConnection,
  checkFirstRun,
};
