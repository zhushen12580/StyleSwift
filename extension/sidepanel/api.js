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
 * 默认 API 基础地址
 * Anthropic API 的默认端点
 * @type {string}
 */
const DEFAULT_API_BASE = 'https://api.anthropic.com';

/**
 * 默认模型
 * 当前使用的默认 Claude 模型
 * @type {string}
 */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * 设置存储 key
 * @type {string}
 */
const SETTINGS_KEY = 'settings';

// ============================================================================
// API 设置存储
// ============================================================================

/**
 * 从 chrome.storage.local 读取 API 设置
 * 
 * 读取 settings 对象（包含 apiKey, apiBase, model）。
 * 如果未配置 API Key，抛出错误提示用户去设置。
 * 
 * @returns {Promise<{apiKey: string, apiBase: string, model: string}>}
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
    throw new Error('请先在设置中配置 API Key');
  }
  
  return {
    apiKey: settings.apiKey,
    model: settings.model || DEFAULT_MODEL,
    apiBase: settings.apiBase || DEFAULT_API_BASE,
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
 */
async function saveSettings({ apiKey, apiBase, model }) {
  // 获取当前设置（如果存在），失败时使用空对象
  let current = {};
  try {
    const result = await getSettings();
    current = result;
  } catch {
    // 未配置过设置，使用默认值
    current = {
      apiKey: '',
      apiBase: DEFAULT_API_BASE,
      model: DEFAULT_MODEL,
    };
  }
  
  // 合并新旧设置
  const newSettings = {
    apiKey: apiKey ?? current.apiKey,
    apiBase: apiBase ?? current.apiBase ?? DEFAULT_API_BASE,
    model: model ?? current.model ?? DEFAULT_MODEL,
  };
  
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
    console.error('[API] Failed to ensure permission for:', apiBase);
    return false;
  }
}

// ============================================================================
// 连接验证
// ============================================================================

/**
 * 验证 API 连接有效性
 * 
 * 向 apiBase/v1/messages 发送最小测试请求，
 * 验证 API Key 和连接是否正常。
 * 
 * @param {string} apiKey - API Key
 * @param {string} apiBase - API 基础地址
 * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
 * 
 * @example
 * const result = await validateConnection('sk-ant-xxx', 'https://api.anthropic.com');
 * if (result.ok) {
 *   console.log('连接成功');
 * } else {
 *   console.error('连接失败:', result.error || `HTTP ${result.status}`);
 * }
 */
async function validateConnection(apiKey, apiBase) {
  const url = `${apiBase}/v1/messages`;
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });
    
    return { ok: resp.ok, status: resp.status };
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
  SETTINGS_KEY,
  getSettings,
  saveSettings,
  ensureApiPermission,
  validateConnection,
  checkFirstRun,
};
