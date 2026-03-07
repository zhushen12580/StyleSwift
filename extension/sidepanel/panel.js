/**
 * StyleSwift - Panel UI Module
 * 
 * Side Panel UI controller
 * Responsible for: onboarding, main view, settings view management and interactions
 * 
 * This file implements:
 * - First-run onboarding (shown when no API Key detected)
 * - View switching logic
 * - Skill chips area
 */

// ============================================================================
// Imports
// ============================================================================

import { 
  checkFirstRun, 
  saveSettings, 
  validateConnection,
  DEFAULT_API_BASE,
  getSettings 
} from './api.js';

import { StyleSkillStore } from './style-skill.js';

// ============================================================================
// DOM Element References
// ============================================================================

/**
 * DOM element cache
 * Initialized after DOMContentLoaded
 */
const DOM = {
  // View containers
  onboardingView: null,
  mainView: null,
  settingsView: null,
  
  // Onboarding elements
  apiKeyInput: null,
  apiBaseInput: null,
  startBtn: null,
  setupError: null,
  
  // Main view elements
  statusDot: null,
  currentDomain: null,
  sessionTitle: null,
  messagesContainer: null,
  messageInput: null,
  sendBtn: null,
  stopBtn: null,
  inputArea: null,
  inputWrapper: null,
  
  // Error banner elements
  errorBanner: null,
  errorBannerMessage: null,
  errorBannerAction: null,
  errorBannerClose: null,
  
  // Skill area elements
  skillArea: null,
  skillChips: null,
  skillAreaToggle: null,
  
  // Settings elements
  settingsApiKey: null,
  settingsApiBase: null,
  settingsModel: null,
  verifyConnectionBtn: null,
  connectionStatus: null,
  
  // Other
  loadingOverlay: null,
  errorToast: null,
  errorMessage: null,
};

// ============================================================================
// 应用状态
// ============================================================================

/**
 * 应用全局状态定义
 * 
 * 设计参考：§16.5 全局状态联动
 * 
 * 状态说明：
 * - agentStatus: Agent 运行状态
 *   - 'idle': 空闲，等待用户输入
 *   - 'running': 正在处理用户请求
 *   - 'error': 出现错误
 *   - 'restricted': 受限页面（chrome:// 等）
 * 
 * - apiKeyStatus: API Key 状态
 *   - 'valid': 已验证有效
 *   - 'invalid': 验证失败/过期
 *   - 'missing': 未配置
 * 
 * - pageStatus: 页面状态
 *   - 'ready': 正常页面，可操作
 *   - 'restricted': 受限页面，不支持样式修改
 * 
 * - hasActiveStyles: 是否有样式生效
 * 
 * - storageWarning: 存储空间警告
 *   - 'none': 无警告
 *   - 'warning': 存储将满（>80%）
 *   - 'critical': 存储严重不足（>95%）
 */

/**
 * 全局状态管理器类
 * 实现状态变化通知机制，支持订阅/发布模式
 */
class GlobalStateManager {
  constructor() {
    /** @type {Object} 状态存储 */
    this._state = {
      /** 当前视图: 'onboarding' | 'main' | 'settings' */
      currentView: 'onboarding',
      
      /** Agent 状态: 'idle' | 'running' | 'error' | 'restricted' */
      agentStatus: 'idle',
      
      /** API Key 状态: 'valid' | 'invalid' | 'missing' */
      apiKeyStatus: 'missing',
      
      /** 页面状态: 'ready' | 'restricted' */
      pageStatus: 'ready',
      
      /** 当前域名 */
      currentDomain: null,
      
      /** 当前会话 ID */
      currentSessionId: null,
      
      /** 是否有样式生效 */
      hasActiveStyles: false,
      
      /** 存储空间警告: 'none' | 'warning' | 'critical' */
      storageWarning: 'none',
      
      /** 当前错误类型: null | 'API_KEY_INVALID' | 'NETWORK_ERROR' | 'API_ERROR' */
      currentError: null,
    };
    
    /** @type {Map<string, Set<Function>>} 状态变化监听器 */
    this._listeners = new Map();
    
    /** @type {Set<Function>} 全局状态变化监听器 */
    this._globalListeners = new Set();
  }
  
  /**
   * 获取状态值
   * @param {string} key - 状态键名
   * @returns {*} 状态值
   */
  get(key) {
    return this._state[key];
  }
  
  /**
   * 获取所有状态
   * @returns {Object} 状态对象
   */
  getAll() {
    return { ...this._state };
  }
  
  /**
   * 设置状态值并触发监听器
   * @param {string} key - 状态键名
   * @param {*} value - 新值
   */
  set(key, value) {
    const oldValue = this._state[key];
    
    if (oldValue === value) return; // 值未变化，不触发
    
    this._state[key] = value;
    
    // 触发特定键的监听器
    const keyListeners = this._listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(value, oldValue, key);
        } catch (err) {
          console.error('[StateManager] Listener error:', err);
        }
      });
    }
    
    // 触发全局监听器
    this._globalListeners.forEach(listener => {
      try {
        listener(key, value, oldValue);
      } catch (err) {
        console.error('[StateManager] Global listener error:', err);
      }
    });
    
    console.log(`[StateManager] State changed: ${key} = ${JSON.stringify(value)}`);
  }
  
  /**
   * 批量设置状态
   * @param {Object} updates - 状态更新对象
   */
  setMultiple(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }
  
  /**
   * 订阅特定状态变化
   * @param {string} key - 状态键名
   * @param {Function} listener - 监听函数 (newValue, oldValue, key) => void
   * @returns {Function} 取消订阅函数
   */
  subscribe(key, listener) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    
    this._listeners.get(key).add(listener);
    
    // 返回取消订阅函数
    return () => {
      const keyListeners = this._listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(listener);
      }
    };
  }
  
  /**
   * 订阅所有状态变化
   * @param {Function} listener - 监听函数 (key, newValue, oldValue) => void
   * @returns {Function} 取消订阅函数
   */
  subscribeAll(listener) {
    this._globalListeners.add(listener);
    return () => this._globalListeners.delete(listener);
  }
}

/**
 * 全局状态管理器实例
 */
const stateManager = new GlobalStateManager();

/**
 * 兼容旧代码的 AppState 对象
 * 通过 Proxy 实现与 stateManager 的双向同步
 */
const AppState = new Proxy({}, {
  get(target, prop) {
    return stateManager.get(prop);
  },
  set(target, prop, value) {
    stateManager.set(prop, value);
    return true;
  }
});

// ============================================================================
// 视图切换
// ============================================================================

/**
 * 切换视图
 * @param {'onboarding' | 'main' | 'settings'} viewName - 目标视图名称
 */
function switchView(viewName) {
  // 隐藏所有视图
  DOM.onboardingView.classList.add('hidden');
  DOM.mainView.classList.add('hidden');
  DOM.settingsView.classList.add('hidden');
  
  // 显示目标视图
  switch (viewName) {
    case 'onboarding':
      DOM.onboardingView.classList.remove('hidden');
      break;
    case 'main':
      DOM.mainView.classList.remove('hidden');
      break;
    case 'settings':
      DOM.settingsView.classList.remove('hidden');
      break;
    default:
      console.error('[Panel] Unknown view:', viewName);
      return;
  }
  
  AppState.currentView = viewName;
  console.log('[Panel] Switched to view:', viewName);
}

/**
 * 显示加载状态
 * @param {boolean} show - 是否显示
 */
function showLoading(show) {
  if (show) {
    DOM.loadingOverlay.classList.remove('hidden');
  } else {
    DOM.loadingOverlay.classList.add('hidden');
  }
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 * @param {number} duration - 显示时长(ms)，默认 5000ms
 */
function showError(message, duration = 5000) {
  DOM.errorMessage.textContent = message;
  DOM.errorToast.classList.remove('hidden');
  
  // 自动隐藏
  setTimeout(() => {
    DOM.errorToast.classList.add('hidden');
  }, duration);
}

/**
 * 隐藏错误提示
 */
function hideError() {
  DOM.errorToast.classList.add('hidden');
}

// ============================================================================
// 全局状态联动
// ============================================================================

/**
 * 全局状态联动配置表
 * 
 * 设计参考：§16.5 全局状态联动
 * 
 * 定义各状态下各区域的表现
 * 
 * 区域定义：
 * - topBar: 顶栏状态指示灯
 * - chatArea: 对话区
 * - inputArea: 输入区
 * - skillArea: 技能快捷区
 * - errorBanner: 错误横幅
 */
const GLOBAL_STATE_CONFIG = {
  /**
   * 就绪状态
   * - 顶栏：🟢 绿色
   * - 对话区：正常
   * - 输入区：可输入，发送按钮
   * - 技能区：正常
   */
  ready: {
    topBar: { status: 'idle', showStyleBadge: false },
    chatArea: { mode: 'normal' },
    inputArea: { mode: 'idle' },
    skillArea: { mode: 'normal' },
    errorBanner: { show: false }
  },
  
  /**
   * 处理中状态
   * - 顶栏：🟡 黄色 + 脉动动画
   * - 对话区：流式输出 + 工具卡片
   * - 输入区：禁用，停止按钮
   * - 技能区：正常但不可点击
   */
  processing: {
    topBar: { status: 'running', showStyleBadge: false },
    chatArea: { mode: 'streaming' },
    inputArea: { mode: 'processing' },
    skillArea: { mode: 'disabled' },
    errorBanner: { show: false }
  },
  
  /**
   * 有样式生效状态
   * - 顶栏：🟢 绿色 + 小徽标
   * - 对话区：正常
   * - 输入区：正常 + 样式应用后浮层
   * - 技能区：正常
   */
  hasStyles: {
    topBar: { status: 'idle', showStyleBadge: true },
    chatArea: { mode: 'normal' },
    inputArea: { mode: 'idle' },
    skillArea: { mode: 'normal' },
    errorBanner: { show: false }
  },
  
  /**
   * API Key 缺失状态
   * - 顶栏：🔴 红色
   * - 其他区域：不显示（引导页）
   */
  apiKeyMissing: {
    topBar: { status: 'error', showStyleBadge: false },
    chatArea: { mode: 'hidden' },
    inputArea: { mode: 'hidden' },
    skillArea: { mode: 'hidden' },
    errorBanner: { show: false }
  },
  
  /**
   * API Key 无效状态
   * - 顶栏：🔴 红色
   * - 对话区：顶部错误横幅
   * - 输入区：可输入
   * - 技能区：正常
   */
  apiKeyInvalid: {
    topBar: { status: 'error', showStyleBadge: false },
    chatArea: { mode: 'normal' },
    inputArea: { mode: 'idle' },
    skillArea: { mode: 'normal' },
    errorBanner: { show: true, type: 'API_KEY_INVALID' }
  },
  
  /**
   * 网络错误状态
   * - 顶栏：🔴 红色
   * - 对话区：顶部错误横幅 + 重试按钮
   * - 输入区：可输入
   * - 技能区：正常
   */
  networkError: {
    topBar: { status: 'error', showStyleBadge: false },
    chatArea: { mode: 'normal' },
    inputArea: { mode: 'idle' },
    skillArea: { mode: 'normal' },
    errorBanner: { show: true, type: 'NETWORK_ERROR' }
  },
  
  /**
   * API 错误状态
   * - 顶栏：🔴 红色
   * - 对话区：顶部错误横幅 + 重试按钮
   * - 输入区：可输入
   * - 技能区：正常
   */
  apiError: {
    topBar: { status: 'error', showStyleBadge: false },
    chatArea: { mode: 'normal' },
    inputArea: { mode: 'idle' },
    skillArea: { mode: 'normal' },
    errorBanner: { show: true, type: 'API_ERROR' }
  },
  
  /**
   * 受限页面状态
   * - 顶栏：⚪ 灰色
   * - 对话区：居中提示
   * - 输入区：整体置灰禁用
   * - 技能区：整体置灰禁用
   */
  restricted: {
    topBar: { status: 'restricted', showStyleBadge: false },
    chatArea: { mode: 'restricted' },
    inputArea: { mode: 'restricted' },
    skillArea: { mode: 'disabled' },
    errorBanner: { show: false }
  },
  
  /**
   * 存储将满状态（不单独作为主状态，叠加在其他状态上）
   * - 顶栏：继承主状态
   * - 其他区域：无影响，设置页内提醒
   */
  storageWarning: {
    // 存储警告不改变主状态，仅作为叠加状态
    topBar: { inherit: true },
    chatArea: { inherit: true },
    inputArea: { inherit: true },
    skillArea: { inherit: true },
    errorBanner: { inherit: true }
  }
};

/**
 * 计算当前全局状态
 * 根据各子状态综合计算最终的全局状态
 * @returns {string} 全局状态名称
 */
function computeGlobalState() {
  const agentStatus = stateManager.get('agentStatus');
  const apiKeyStatus = stateManager.get('apiKeyStatus');
  const pageStatus = stateManager.get('pageStatus');
  const hasActiveStyles = stateManager.get('hasActiveStyles');
  const currentError = stateManager.get('currentError');
  
  // 优先级：受限页面 > API Key 缺失 > 处理中 > 错误 > 有样式 > 就绪
  
  // 1. 受限页面
  if (pageStatus === 'restricted') {
    return 'restricted';
  }
  
  // 2. API Key 缺失（显示引导页）
  if (apiKeyStatus === 'missing') {
    return 'apiKeyMissing';
  }
  
  // 3. 处理中
  if (agentStatus === 'running') {
    return 'processing';
  }
  
  // 4. 错误状态
  if (currentError) {
    switch (currentError) {
      case 'API_KEY_INVALID':
        return 'apiKeyInvalid';
      case 'NETWORK_ERROR':
        return 'networkError';
      case 'API_ERROR':
        return 'apiError';
    }
  }
  
  // 5. 有样式生效
  if (hasActiveStyles) {
    return 'hasStyles';
  }
  
  // 6. 就绪状态
  return 'ready';
}

/**
 * 应用全局状态到 UI
 * 根据当前状态配置更新所有区域的显示
 * @param {string} [forceState] - 强制指定的状态（可选，用于调试）
 */
function applyGlobalState(forceState) {
  const globalState = forceState || computeGlobalState();
  const config = GLOBAL_STATE_CONFIG[globalState];
  
  if (!config) {
    console.error('[Panel] Unknown global state:', globalState);
    return;
  }
  
  console.log('[Panel] Applying global state:', globalState);
  
  // 1. 更新顶栏状态指示灯
  applyTopBarState(config.topBar);
  
  // 2. 更新对话区状态
  applyChatAreaState(config.chatArea);
  
  // 3. 更新输入区状态
  applyInputAreaState(config.inputArea);
  
  // 4. 更新技能区状态
  applySkillAreaState(config.skillArea);
  
  // 5. 更新错误横幅
  applyErrorBannerState(config.errorBanner);
}

/**
 * 应用顶栏状态
 * @param {Object} config - 顶栏配置
 */
function applyTopBarState(config) {
  if (!DOM.statusDot) return;
  
  const dot = DOM.statusDot.querySelector('.dot');
  if (!dot) return;
  
  // 更新状态指示灯颜色
  dot.classList.remove('ready', 'processing', 'error', 'restricted');
  
  switch (config.status) {
    case 'idle':
      dot.classList.add('ready');
      break;
    case 'running':
      dot.classList.add('processing');
      break;
    case 'error':
      dot.classList.add('error');
      break;
    case 'restricted':
      dot.classList.add('restricted');
      break;
  }
  
  // 更新样式徽标
  const existingBadge = DOM.statusDot.querySelector('.style-badge');
  if (config.showStyleBadge && !existingBadge) {
    // 添加样式徽标
    const badge = document.createElement('span');
    badge.className = 'style-badge';
    badge.textContent = '✨';
    badge.title = '当前页面有样式生效';
    DOM.statusDot.appendChild(badge);
  } else if (!config.showStyleBadge && existingBadge) {
    // 移除样式徽标
    existingBadge.remove();
  }
}

/**
 * 应用对话区状态
 * @param {Object} config - 对话区配置
 */
function applyChatAreaState(config) {
  if (!DOM.messagesContainer) return;
  
  // 移除所有状态类
  DOM.messagesContainer.classList.remove('restricted-mode', 'hidden');
  
  switch (config.mode) {
    case 'normal':
      // 正常模式
      // 移除受限提示（如果存在）
      const restrictedTip = DOM.messagesContainer.querySelector('.restricted-tip');
      if (restrictedTip) {
        restrictedTip.remove();
      }
      break;
      
    case 'streaming':
      // 流式输出模式（由 Agent Loop 控制）
      break;
      
    case 'restricted':
      // 受限页面模式：居中提示
      DOM.messagesContainer.classList.add('restricted-mode');
      
      // 清空并显示受限提示
      DOM.messagesContainer.innerHTML = '';
      const tip = document.createElement('div');
      tip.className = 'restricted-tip';
      tip.innerHTML = `
        <div class="restricted-icon">🔒</div>
        <div class="restricted-title">此页面不支持样式修改</div>
        <div class="restricted-desc">Chrome 扩展无法操作浏览器内部页面（chrome://、扩展商店等）</div>
      `;
      DOM.messagesContainer.appendChild(tip);
      break;
      
    case 'hidden':
      // 隐藏模式（引导页时）
      DOM.messagesContainer.classList.add('hidden');
      break;
  }
}

/**
 * 应用输入区状态
 * @param {Object} config - 输入区配置
 */
function applyInputAreaState(config) {
  if (!DOM.inputArea || !DOM.messageInput || !DOM.sendBtn || !DOM.stopBtn) return;
  
  // 移除所有状态类
  DOM.inputArea.classList.remove('processing', 'restricted', 'hidden');
  DOM.sendBtn.classList.remove('hidden');
  DOM.stopBtn.classList.add('hidden');
  
  switch (config.mode) {
    case 'idle':
      // 空闲态：输入框可用 + 发送按钮
      DOM.messageInput.disabled = false;
      DOM.messageInput.placeholder = '描述你想要的风格...';
      break;
      
    case 'processing':
      // 处理中：输入框禁用 + 停止按钮
      DOM.inputArea.classList.add('processing');
      DOM.messageInput.disabled = true;
      DOM.messageInput.placeholder = '正在处理中...';
      DOM.sendBtn.classList.add('hidden');
      DOM.stopBtn.classList.remove('hidden');
      break;
      
    case 'restricted':
      // 受限页面：整体置灰 + 提示
      DOM.inputArea.classList.add('restricted');
      DOM.messageInput.disabled = true;
      DOM.messageInput.placeholder = '此页面不支持样式修改';
      DOM.messageInput.value = '';
      DOM.sendBtn.disabled = true;
      break;
      
    case 'hidden':
      // 隐藏模式（引导页时）
      DOM.inputArea.classList.add('hidden');
      break;
  }
}

/**
 * 应用技能区状态
 * @param {Object} config - 技能区配置
 */
function applySkillAreaState(config) {
  if (!DOM.skillArea) return;
  
  // 移除所有状态类
  DOM.skillArea.classList.remove('disabled', 'hidden');
  
  switch (config.mode) {
    case 'normal':
      // 正常模式：可点击
      DOM.skillArea.style.pointerEvents = '';
      DOM.skillArea.style.opacity = '';
      break;
      
    case 'disabled':
      // 禁用模式：置灰不可点击
      DOM.skillArea.classList.add('disabled');
      DOM.skillArea.style.pointerEvents = 'none';
      DOM.skillArea.style.opacity = '0.5';
      break;
      
    case 'hidden':
      // 隐藏模式
      DOM.skillArea.classList.add('hidden');
      break;
  }
}

/**
 * 应用错误横幅状态
 * @param {Object} config - 错误横幅配置
 */
function applyErrorBannerState(config) {
  if (!DOM.errorBanner) return;
  
  if (config.show) {
    showErrorBanner(config.type);
  } else {
    hideErrorBanner();
  }
}

/**
 * 设置处理中状态（便捷方法）
 * 自动更新 agentStatus 并应用全局状态
 * @param {boolean} isProcessing - 是否处理中
 */
function setProcessingState(isProcessing) {
  stateManager.set('agentStatus', isProcessing ? 'running' : 'idle');
  stateManager.set('currentError', null); // 清除错误
  applyGlobalState();
}

/**
 * 设置受限页面状态（便捷方法）
 * @param {boolean} isRestricted - 是否为受限页面
 */
function setRestrictedPageState(isRestricted) {
  stateManager.set('pageStatus', isRestricted ? 'restricted' : 'ready');
  applyGlobalState();
}

/**
 * 设置错误状态（便捷方法）
 * @param {string|null} errorType - 错误类型：'API_KEY_INVALID' | 'NETWORK_ERROR' | 'API_ERROR' | null
 */
function setErrorState(errorType) {
  stateManager.set('currentError', errorType);
  if (errorType) {
    stateManager.set('agentStatus', 'error');
  }
  applyGlobalState();
}

/**
 * 清除错误状态
 */
function clearErrorState() {
  stateManager.set('currentError', null);
  if (stateManager.get('agentStatus') === 'error') {
    stateManager.set('agentStatus', 'idle');
  }
  applyGlobalState();
}

/**
 * 设置样式生效状态
 * @param {boolean} hasStyles - 是否有样式生效
 */
function setHasActiveStyles(hasStyles) {
  stateManager.set('hasActiveStyles', hasStyles);
  applyGlobalState();
}

/**
 * 设置 API Key 状态
 * @param {string} status - API Key 状态：'valid' | 'invalid' | 'missing'
 */
function setApiKeyStatus(status) {
  stateManager.set('apiKeyStatus', status);
  applyGlobalState();
}

/**
 * 初始化状态联动
 * 设置状态变化监听器
 */
function initStateSync() {
  // 监听关键状态变化，自动应用全局状态
  const watchedKeys = [
    'agentStatus',
    'apiKeyStatus',
    'pageStatus',
    'hasActiveStyles',
    'currentError'
  ];
  
  watchedKeys.forEach(key => {
    stateManager.subscribe(key, () => {
      applyGlobalState();
    });
  });
  
  console.log('[Panel] State sync initialized');
}

// ============================================================================
// 引导页逻辑
// ============================================================================

/**
 * 初始化引导页
 */
function initOnboarding() {
  // 获取 DOM 元素
  DOM.apiKeyInput = document.getElementById('api-key-input');
  DOM.apiBaseInput = document.getElementById('api-base-input');
  DOM.startBtn = document.getElementById('start-btn');
  DOM.setupError = document.getElementById('setup-error');
  
  // 监听输入变化
  DOM.apiKeyInput.addEventListener('input', validateOnboardingForm);
  DOM.apiBaseInput.addEventListener('input', validateOnboardingForm);
  
  // 监听开始按钮
  DOM.startBtn.addEventListener('click', handleStartClick);
  
  // 设置默认 API 地址
  DOM.apiBaseInput.value = DEFAULT_API_BASE;
  
  // 初始验证表单
  validateOnboardingForm();
}

/**
 * 验证引导页表单
 * 只有 API Key 非空时才启用开始按钮
 */
function validateOnboardingForm() {
  const apiKey = DOM.apiKeyInput.value.trim();
  const isValid = apiKey.length > 0;
  
  DOM.startBtn.disabled = !isValid;
  
  // 清除之前的错误提示
  if (isValid) {
    hideSetupError();
  }
}

/**
 * 显示引导页错误
 * @param {string} message - 错误消息
 */
function showSetupError(message) {
  DOM.setupError.textContent = message;
  DOM.setupError.classList.remove('hidden');
}

/**
 * 隐藏引导页错误
 */
function hideSetupError() {
  DOM.setupError.classList.add('hidden');
}

/**
 * 处理开始按钮点击
 */
async function handleStartClick() {
  const apiKey = DOM.apiKeyInput.value.trim();
  let apiBase = DOM.apiBaseInput.value.trim();
  
  // 基本验证
  if (!apiKey) {
    showSetupError('请输入 API Key');
    return;
  }
  
  // 如果 API 地址为空，使用默认值
  if (!apiBase) {
    apiBase = DEFAULT_API_BASE;
  }
  
  // 验证 URL 格式
  try {
    new URL(apiBase);
  } catch {
    showSetupError('API 地址格式不正确');
    return;
  }
  
  // 显示加载状态
  showLoading(true);
  DOM.startBtn.disabled = true;
  hideSetupError();
  
  try {
    // 验证连接
    const result = await validateConnection(apiKey, apiBase);
    
    if (!result.ok) {
      // 连接失败
      let errorMsg = '连接验证失败';
      
      if (result.error) {
        // 网络错误
        errorMsg = `连接失败: ${result.error}`;
      } else if (result.status === 401) {
        errorMsg = 'API Key 无效，请检查是否正确';
      } else if (result.status === 403) {
        errorMsg = '访问被拒绝，请检查 API Key 权限';
      } else if (result.status) {
        errorMsg = `连接失败 (HTTP ${result.status})`;
      }
      
      showSetupError(errorMsg);
      AppState.apiKeyStatus = 'invalid';
      return;
    }
    
    // 连接成功，保存设置
    await saveSettings({ apiKey, apiBase });
    AppState.apiKeyStatus = 'valid';
    
    console.log('[Panel] API Key validated and saved');
    
    // 切换到主界面
    switchView('main');
    initMainView();
    
  } catch (err) {
    console.error('[Panel] Setup error:', err);
    showSetupError(`保存设置失败: ${err.message}`);
  } finally {
    showLoading(false);
    DOM.startBtn.disabled = false;
  }
}

// ============================================================================
// 主界面逻辑
// ============================================================================

/**
 * 初始化主界面
 * 
 * 完整初始化流程（设计参考：§16.8 完整使用流程）：
 * 1. 获取当前 Tab 域名（通过 Content Script）
 * 2. 加载/创建会话
 * 3. 加载技能 chip
 * 4. 恢复会话历史（如果有）
 */
async function initMainView() {
  // 获取 DOM 元素
  DOM.statusDot = document.getElementById('status-dot');
  DOM.currentDomain = document.getElementById('current-domain');
  DOM.sessionTitle = document.getElementById('session-title');
  DOM.messagesContainer = document.getElementById('messages-container');
  DOM.messageInput = document.getElementById('message-input');
  DOM.sendBtn = document.getElementById('send-btn');
  DOM.stopBtn = document.getElementById('stop-btn');
  DOM.inputArea = document.getElementById('input-area');
  DOM.inputWrapper = document.getElementById('input-wrapper');
  
  // 获取技能区 DOM 元素
  DOM.skillArea = document.getElementById('skill-area');
  DOM.skillChips = document.getElementById('skill-chips');
  DOM.skillAreaToggle = document.getElementById('skill-area-toggle');
  
  // 获取错误横幅 DOM 元素
  DOM.errorBanner = document.getElementById('error-banner');
  DOM.errorBannerMessage = document.getElementById('error-banner-message');
  DOM.errorBannerAction = document.getElementById('error-banner-action');
  DOM.errorBannerClose = document.getElementById('error-banner-close');
  
  // 初始化状态同步系统
  initStateSync();
  
  // 设置初始状态
  stateManager.set('agentStatus', 'idle');
  stateManager.set('apiKeyStatus', 'valid'); // 进入主界面说明已有有效 Key
  stateManager.set('pageStatus', 'ready');
  
  // 应用初始全局状态
  applyGlobalState();
  
  // 更新顶栏显示
  updateTopBarDisplay('--', '新会话');
  
  // 绑定顶栏交互事件
  bindTopBarEvents();
  
  // 初始化错误横幅事件
  initErrorBanner();
  
  // 绑定新建会话按钮事件
  const newSessionBtn = document.getElementById('new-session-btn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', handleNewSession);
  }
  
  // 初始化输入区
  initInputArea();
  
  // 初始化技能快捷区
  initSkillArea();
  
  // 显示空状态（默认）
  showEmptyState();
  
  // === Step 4: 获取域名 ===
  try {
    const { getTargetDomain, sendToContentScript } = await import('./tools.js');
    
    // 获取域名（同时检测页面是否受限）
    let domain = null;
    try {
      // 尝试向 Content Script 发送消息获取域名
      domain = await sendToContentScript({ tool: 'get_domain' });
    } catch (contentScriptError) {
      // Content Script 不可达，可能是受限页面
      console.log('[Panel] Content Script not reachable:', contentScriptError.message);
      stateManager.set('pageStatus', 'restricted');
      stateManager.set('currentDomain', null);
      applyGlobalState();
      return;
    }
    
    if (domain && domain !== 'unknown') {
      console.log('[Panel] Current domain:', domain);
      stateManager.set('currentDomain', domain);
      
      // 更新顶栏显示
      updateTopBarDisplay(domain, '新会话');
      
      // === Step 5: 加载会话 ===
      await loadSessionForDomain(domain);
    } else {
      console.warn('[Panel] Failed to get domain');
      // 无法获取域名时，显示空状态
      showEmptyState();
    }
  } catch (err) {
    console.error('[Panel] Failed to get domain or load session:', err);
    // 继续显示空状态
    showEmptyState();
  }
}

/**
 * 为指定域名加载会话
 * 设计参考：§8.2 会话生命周期
 * 
 * @param {string} domain - 域名
 */
async function loadSessionForDomain(domain) {
  try {
    // 动态导入依赖模块
    const session = await import('./session.js');
    
    // 获取或创建会话
    const sessionId = await session.getOrCreateSession(domain);
    console.log('[Panel] Session loaded:', sessionId);
    
    // 创建 SessionContext 并设置为当前会话
    const currentSession = new session.SessionContext(domain, sessionId);
    session.setCurrentSession(currentSession);
    
    // 更新全局状态中的会话 ID
    stateManager.set('currentSessionId', sessionId);
    
    // 加载会话元数据
    const meta = await session.loadSessionMeta(domain, sessionId);
    
    // 更新顶栏显示（如果有标题）
    if (meta.title) {
      updateTopBarDisplay(domain, meta.title);
    }
    
    // 加载会话历史
    const history = await session.loadAndPrepareHistory(domain, sessionId);
    
    if (history && history.length > 0) {
      // 渲染历史消息
      renderHistoryMessages(history);
      console.log(`[Panel] Loaded ${history.length} history messages`);
    } else {
      // 无历史，显示空状态
      showEmptyState();
    }
    
    // 检查是否有样式生效
    const stylesKey = currentSession.stylesKey;
    const { [stylesKey]: sessionStyles } = await chrome.storage.local.get(stylesKey);
    
    if (sessionStyles && sessionStyles.trim()) {
      // 有样式生效
      setHasActiveStyles(true);
    }
    
  } catch (err) {
    console.error('[Panel] Failed to load session for domain:', domain, err);
    // 失败时显示空状态
    showEmptyState();
  }
}

// ============================================================================
// 输入区逻辑
// ============================================================================

/**
 * 初始化输入区
 */
function initInputArea() {
  // 绑定发送按钮点击事件
  if (DOM.sendBtn) {
    DOM.sendBtn.addEventListener('click', handleSendClick);
  }
  
  // 绑定停止按钮点击事件
  if (DOM.stopBtn) {
    DOM.stopBtn.addEventListener('click', handleStopClick);
  }
  
  // 绑定输入框 Enter 键事件
  if (DOM.messageInput) {
    DOM.messageInput.addEventListener('keydown', handleInputKeydown);
  }
  
  // 初始化为空闲态
  updateInputAreaState('idle');
}

/**
 * 更新输入区状态
 * @param {'idle' | 'processing' | 'restricted'} state - 状态
 * @deprecated 请使用 setProcessingState / setRestrictedPageState / applyGlobalState
 */
function updateInputAreaState(state) {
  if (!DOM.inputArea || !DOM.messageInput || !DOM.sendBtn || !DOM.stopBtn) return;
  
  // 移除所有状态类
  DOM.inputArea.classList.remove('processing', 'restricted');
  DOM.sendBtn.classList.remove('hidden');
  DOM.stopBtn.classList.add('hidden');
  
  switch (state) {
    case 'idle':
      // 空闲态：输入框可用 + 发送按钮
      DOM.messageInput.disabled = false;
      DOM.messageInput.placeholder = '描述你想要的风格...';
      DOM.messageInput.value = '';
      DOM.sendBtn.disabled = false;
      break;
      
    case 'processing':
      // 处理中：输入框禁用 + 停止按钮
      DOM.inputArea.classList.add('processing');
      DOM.messageInput.disabled = true;
      DOM.messageInput.placeholder = '正在处理中...';
      DOM.messageInput.value = '';
      DOM.sendBtn.classList.add('hidden');
      DOM.stopBtn.classList.remove('hidden');
      break;
      
    case 'restricted':
      // 受限页面：整体置灰 + 提示
      DOM.inputArea.classList.add('restricted');
      DOM.messageInput.disabled = true;
      DOM.messageInput.placeholder = '此页面不支持样式修改';
      DOM.messageInput.value = '';
      DOM.sendBtn.disabled = true;
      break;
      
    default:
      console.warn('[Panel] Unknown input area state:', state);
      return;
  }
  
  console.log('[Panel] Input area state changed to:', state);
}

/**
 * 处理发送按钮点击
 * 
 * 完整流程：
 * 1. 清空输入框
 * 2. 渲染用户消息气泡
 * 3. 隐藏空状态（如果有）
 * 4. 切换为处理中状态
 * 5. 创建助手消息容器和流式渲染器
 * 6. 调用 agentLoop 并传入 UI 回调
 * 7. 完成后恢复就绪态
 * 8. 显示确认浮层（如果有样式应用）
 */
async function handleSendClick() {
  const message = DOM.messageInput?.value?.trim();
  
  if (!message) {
    console.log('[Panel] Empty message, ignored');
    return;
  }
  
  // 禁止在处理中状态发送
  if (AppState.agentStatus === 'running') {
    console.warn('[Panel] Agent is running, cannot send message');
    return;
  }
  
  // 禁止在受限页面发送
  if (AppState.pageStatus === 'restricted') {
    console.warn('[Panel] Page is restricted, cannot send message');
    return;
  }
  
  console.log('[Panel] Sending message:', message);
  
  // 清空输入框
  DOM.messageInput.value = '';
  
  // 隐藏确认浮层（如果有）- 用户发新消息视为隐式确认上一步
  if (isConfirmationOverlayVisible()) {
    hideConfirmationOverlay(false);
  }
  
  // 移除空状态提示（如果存在）
  const emptyState = DOM.messagesContainer?.querySelector('.chat-area-empty');
  if (emptyState) {
    emptyState.remove();
  }
  
  // 渲染用户消息气泡
  const userMessageEl = renderUserMessage(message);
  addMessageToContainer(userMessageEl);
  
  // 切换为处理中状态
  setProcessingState(true);
  
  // 创建助手消息容器（用于流式输出）
  const assistantMessageEl = renderAssistantMessageContainer();
  const assistantBubble = assistantMessageEl.querySelector('.message-bubble');
  addMessageToContainer(assistantMessageEl);
  
  // 创建流式文本渲染器
  const streamingRenderer = createStreamingRenderer(assistantBubble);
  
  // 样式应用计数器（用于确认浮层）
  let applyStylesCount = 0;
  
  // 动态导入 agent-loop 模块
  try {
    const { agentLoop, cancelAgentLoop } = await import('./agent-loop.js');
    
    // UI 回调函数
    const uiCallbacks = {
      /**
       * 追加流式文本
       * @param {string} delta - 文本增量
       */
      appendText: (delta) => {
        streamingRenderer.appendText(delta);
      },
      
      /**
       * 显示工具调用（开始时）
       * @param {Object} block - 工具调用块
       */
      showToolCall: (block) => {
        if (block.type === 'tool_use') {
          createToolCard(block.id, block.name);
        }
      },
      
      /**
       * 显示工具执行中状态
       * @param {string} toolName - 工具名称
       */
      showToolExecuting: (toolName) => {
        // 卡片已经在 showToolCall 时创建，这里可以更新状态
        console.log('[Panel] Tool executing:', toolName);
      },
      
      /**
       * 显示工具执行结果
       * @param {string} toolId - 工具调用 ID
       * @param {string} output - 工具输出
       */
      showToolResult: (toolId, output) => {
        completeToolCard(toolId, null, null, output);
        
        // 检测是否为 apply_styles 工具
        // 从工具卡片管理器获取工具名称
        const card = toolCardManager.cardMap.get(toolId);
        if (card && card.dataset.toolName === 'apply_styles') {
          applyStylesCount++;
        }
      }
    };
    
    // 调用 Agent Loop
    const response = await agentLoop(message, uiCallbacks);
    
    // 完成流式输出
    streamingRenderer.finish();
    
    // 结束工具卡片组
    finalizeToolCardGroup();
    
    // 恢复就绪状态
    setProcessingState(false);
    
    // 如果有样式应用，显示确认浮层
    if (applyStylesCount > 0) {
      showConfirmationOverlay({
        applyCount: applyStylesCount,
        onConfirm: () => {
          console.log('[Panel] 样式已确认');
        },
        onUndo: async () => {
          // 撤销最后一步
          console.log('[Panel] 撤销最后一步样式');
          // 发送撤销消息
          DOM.messageInput.value = '撤销最后一次样式修改';
          handleSendClick();
        },
        onUndoAll: async () => {
          // 全部撤销
          console.log('[Panel] 撤销所有样式');
          DOM.messageInput.value = '撤销所有样式修改';
          handleSendClick();
        }
      });
    }
    
    console.log('[Panel] Agent response:', response);
    
  } catch (error) {
    console.error('[Panel] Agent loop error:', error);
    
    // 完成流式输出
    streamingRenderer.finish();
    
    // 结束工具卡片组
    finalizeToolCardGroup();
    
    // 恢复就绪状态
    setProcessingState(false);
    
    // 处理错误类型
    if (error.message?.includes('401') || error.message?.includes('API Key')) {
      setErrorState('API_KEY_INVALID');
      showErrorBanner('API_KEY_INVALID');
    } else if (error.message?.includes('network') || error.message?.includes('Network') || error instanceof TypeError) {
      setErrorState('NETWORK_ERROR');
      showErrorBanner('NETWORK_ERROR', {
        onRetry: () => {
          // 重新发送消息
          DOM.messageInput.value = message;
          handleSendClick();
        }
      });
    } else {
      setErrorState('API_ERROR');
      showErrorBanner('API_ERROR', {
        customMessage: error.message || 'API 调用失败',
        onRetry: () => {
          DOM.messageInput.value = message;
          handleSendClick();
        }
      });
    }
  }
}

/**
 * 处理停止按钮点击
 * 
 * 调用 cancelAgentLoop 取消当前处理
 * 已应用的样式保留
 */
async function handleStopClick() {
  console.log('[Panel] Stop button clicked');
  
  try {
    // 动态导入 agent-loop 模块
    const { cancelAgentLoop } = await import('./agent-loop.js');
    
    // 取消 Agent Loop
    cancelAgentLoop();
    
    // 结束工具卡片组
    finalizeToolCardGroup();
    
    // 恢复空闲态
    setProcessingState(false);
    
    console.log('[Panel] Agent loop cancelled');
    
  } catch (error) {
    console.error('[Panel] Failed to cancel agent loop:', error);
    
    // 即使出错也要恢复空闲态
    setProcessingState(false);
  }
}

/**
 * 处理输入框键盘事件
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleInputKeydown(e) {
  // Enter 键发送（Shift+Enter 换行）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendClick();
  }
}

// ============================================================================
// 技能快捷区逻辑
// ============================================================================

/**
 * Built-in skill definitions
 * These are static skills bundled with the extension
 */
const BUILT_IN_SKILLS = [
  { id: 'dark-mode-template', name: 'Dark Mode', icon: '🌙', prompt: 'Apply dark mode style' },
  { id: 'minimal-template', name: 'Minimal', icon: '✨', prompt: 'Apply minimal style' },
];

/**
 * Initialize skill chips area
 */
function initSkillArea() {
  // Bind toggle event
  if (DOM.skillAreaToggle) {
    DOM.skillAreaToggle.addEventListener('click', toggleSkillArea);
  }
  
  // Render skill chips
  renderSkillChips();
}

/**
 * Toggle skill area collapsed state
 */
function toggleSkillArea() {
  if (DOM.skillArea) {
    DOM.skillArea.classList.toggle('collapsed');
  }
}

/**
 * Render skill chips (built-in + user skills)
 */
async function renderSkillChips() {
  if (!DOM.skillChips) return;
  
  // Clear existing chips
  DOM.skillChips.innerHTML = '';
  
  // 1. Render built-in skills (filled chips)
  for (const skill of BUILT_IN_SKILLS) {
    const chip = createBuiltInChip(skill);
    DOM.skillChips.appendChild(chip);
  }
  
  // 2. Load and render user skills (outlined chips)
  try {
    const userSkills = await StyleSkillStore.list();
    
    for (const skill of userSkills) {
      const chip = createUserSkillChip(skill);
      DOM.skillChips.appendChild(chip);
    }
    
    // 3. If no user skills, show "create from current" action
    if (userSkills.length === 0) {
      const emptyChip = createEmptyActionChip();
      DOM.skillChips.appendChild(emptyChip);
    }
  } catch (err) {
    console.warn('[Panel] Failed to load user skills:', err);
    // Show empty action on error
    const emptyChip = createEmptyActionChip();
    DOM.skillChips.appendChild(emptyChip);
  }
}

/**
 * Create a built-in skill chip (filled style)
 * @param {Object} skill - Skill object with id, name, icon, prompt
 * @returns {HTMLElement}
 */
function createBuiltInChip(skill) {
  const chip = document.createElement('div');
  chip.className = 'skill-chip built-in';
  chip.dataset.skillId = skill.id;
  chip.dataset.skillType = 'built-in';
  chip.dataset.prompt = skill.prompt;
  
  chip.innerHTML = `
    <span class="skill-icon">${skill.icon}</span>
    <span class="skill-name">${skill.name}</span>
  `;
  
  chip.addEventListener('click', () => handleSkillChipClick(skill));
  
  return chip;
}

/**
 * Create a user skill chip (outlined style with source domain)
 * Design ref: §16.3 ② - 用户技能支持长按弹出菜单：应用 / 查看详情 / 删除
 * @param {Object} skill - Skill object from StyleSkillStore
 * @returns {HTMLElement}
 */
function createUserSkillChip(skill) {
  const chip = document.createElement('div');
  chip.className = 'skill-chip user-skill';
  chip.dataset.skillId = skill.id;
  chip.dataset.skillType = 'user';
  
  // Generate prompt text
  const prompt = `Apply my "${skill.name}" style`;
  chip.dataset.prompt = prompt;
  
  // Truncate source domain if too long
  const sourceDomain = skill.sourceDomain || 'unknown';
  const displayDomain = sourceDomain.length > 15 
    ? sourceDomain.substring(0, 12) + '...' 
    : sourceDomain;
  
  chip.innerHTML = `
    <span class="skill-name">${skill.name}</span>
    <span class="skill-source">${displayDomain}</span>
  `;
  
  // Click handler (short tap)
  chip.addEventListener('click', () => handleSkillChipClick({
    id: skill.id,
    name: skill.name,
    type: 'user',
    prompt
  }));
  
  // Long press handler for context menu
  let longPressTimer = null;
  let isLongPress = false;
  
  chip.addEventListener('mousedown', (e) => {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      showSkillContextMenu(e, skill);
    }, 500); // 500ms threshold for long press
  });
  
  chip.addEventListener('mouseup', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  
  chip.addEventListener('mouseleave', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  
  // Context menu (right-click)
  chip.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showSkillContextMenu(e, skill);
  });
  
  return chip;
}

/**
 * Create empty state action chip (dashed style)
 * @returns {HTMLElement}
 */
function createEmptyActionChip() {
  const chip = document.createElement('div');
  chip.className = 'skill-chip empty-action';
  chip.dataset.skillType = 'empty-action';
  
  chip.innerHTML = `
    <span class="skill-icon">+</span>
    <span class="skill-name">Create from current style</span>
  `;
  
  chip.addEventListener('click', handleEmptyActionClick);
  
  return chip;
}

/**
 * Handle skill chip click
 * Fills the input with skill prompt and auto-sends the message
 * Design ref: §16.3 ② 点击行为 - 点击 chip → 自动填入"应用 [技能名] 风格" → 自动发送
 * @param {Object} skill - Skill object
 */
function handleSkillChipClick(skill) {
  if (!DOM.messageInput) return;
  
  // Don't allow interaction when agent is running
  if (AppState.agentStatus === 'running') {
    return;
  }
  
  // Fill input with skill prompt
  DOM.messageInput.value = skill.prompt;
  
  console.log('[Panel] Skill chip clicked:', skill.name);
  
  // Auto-send the message
  // Use setTimeout to ensure the input is filled before sending
  setTimeout(() => {
    handleSendClick();
  }, 0);
}

/**
 * Handle empty action chip click
 * Prompts user to save current style
 */
function handleEmptyActionClick() {
  if (!DOM.messageInput) return;
  
  // Don't allow interaction when agent is running
  if (AppState.agentStatus === 'running') {
    return;
  }
  
  // Fill input with save style prompt
  DOM.messageInput.value = 'Save current style as a reusable skill';
  DOM.messageInput.focus();
  
  console.log('[Panel] Empty action chip clicked');
}

// ============================================================================
// 技能上下文菜单
// ============================================================================

/**
 * Context menu instance for user skills
 */
let skillContextMenu = null;

/**
 * Show context menu for user skill
 * Design ref: §16.3 ② - 长按/右键弹出菜单：应用 / 查看详情 / 删除
 * @param {Event} e - Mouse event
 * @param {Object} skill - Skill object
 */
function showSkillContextMenu(e, skill) {
  // Remove existing menu if any
  hideSkillContextMenu();
  
  // Create context menu
  const menu = document.createElement('div');
  menu.className = 'skill-context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="apply">
      <span class="menu-icon">✨</span>
      <span>应用</span>
    </div>
    <div class="context-menu-item" data-action="view">
      <span class="menu-icon">📄</span>
      <span>查看详情</span>
    </div>
    <div class="context-menu-item danger" data-action="delete">
      <span class="menu-icon">🗑️</span>
      <span>删除</span>
    </div>
  `;
  
  // Position the menu
  const rect = e.target.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.zIndex = '1000';
  
  // Add event listeners for menu items
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = item.dataset.action;
      handleContextMenuAction(action, skill);
      hideSkillContextMenu();
    });
  });
  
  // Append to body
  document.body.appendChild(menu);
  skillContextMenu = menu;
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleContextMenuOutsideClick);
  }, 0);
}

/**
 * Hide context menu
 */
function hideSkillContextMenu() {
  if (skillContextMenu) {
    skillContextMenu.remove();
    skillContextMenu = null;
    document.removeEventListener('click', handleContextMenuOutsideClick);
  }
}

/**
 * Handle click outside context menu
 * @param {Event} e - Mouse event
 */
function handleContextMenuOutsideClick(e) {
  if (skillContextMenu && !skillContextMenu.contains(e.target)) {
    hideSkillContextMenu();
  }
}

/**
 * Handle context menu action
 * @param {string} action - Action name: 'apply' | 'view' | 'delete'
 * @param {Object} skill - Skill object
 */
async function handleContextMenuAction(action, skill) {
  switch (action) {
    case 'apply':
      // Apply the skill
      handleSkillChipClick({
        id: skill.id,
        name: skill.name,
        type: 'user',
        prompt: `Apply my "${skill.name}" style`
      });
      break;
      
    case 'view':
      // View skill details in a modal
      await viewSkillDetails(skill);
      break;
      
    case 'delete':
      // Delete skill with confirmation
      await deleteSkillWithConfirmation(skill);
      break;
  }
}

/**
 * View skill details
 * @param {Object} skill - Skill object
 */
async function viewSkillDetails(skill) {
  try {
    // Load skill content
    const content = await StyleSkillStore.load(skill.id);
    
    if (!content) {
      showError('无法加载技能详情');
      return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'skill-detail-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(skill.name)}</h3>
          <button class="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="skill-meta">
            <span class="skill-source">来源: ${escapeHtml(skill.sourceDomain || 'unknown')}</span>
            <span class="skill-date">创建于: ${new Date(skill.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          ${skill.mood ? `<div class="skill-mood">风格: ${escapeHtml(skill.mood)}</div>` : ''}
          <div class="skill-content">
            <pre>${escapeHtml(content)}</pre>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('.modal-close-btn');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // Append to body
    document.body.appendChild(modal);
    
  } catch (err) {
    console.error('[Panel] Failed to view skill details:', err);
    showError('加载技能详情失败');
  }
}

/**
 * Delete skill with confirmation
 * @param {Object} skill - Skill object
 */
async function deleteSkillWithConfirmation(skill) {
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.className = 'skill-delete-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>确认删除</h3>
      </div>
      <div class="modal-body">
        <p>确定要删除风格技能「${escapeHtml(skill.name)}」吗？</p>
        <p class="hint">删除后无法恢复</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel">取消</button>
        <button class="btn btn-danger">删除</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  const cancelBtn = modal.querySelector('.btn-cancel');
  const deleteBtn = modal.querySelector('.btn-danger');
  const overlay = modal.querySelector('.modal-overlay');
  
  const closeModal = () => {
    modal.remove();
  };
  
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  
  deleteBtn.addEventListener('click', async () => {
    try {
      // Delete skill
      await StyleSkillStore.remove(skill.id);
      
      // Close modal
      closeModal();
      
      // Refresh skill chips
      await renderSkillChips();
      
      // Show success message
      console.log('[Panel] Skill deleted:', skill.name);
      
    } catch (err) {
      console.error('[Panel] Failed to delete skill:', err);
      showError('删除技能失败');
    }
  });
  
  // Append to body
  document.body.appendChild(modal);
}

/**
 * 绑定顶栏交互事件
 */
function bindTopBarEvents() {
  // 会话标题区域点击 - 展开/收起会话列表
  const sessionHeader = document.getElementById('session-header');
  const sessionListToggle = document.getElementById('session-list-toggle');
  
  if (sessionHeader) {
    sessionHeader.addEventListener('click', toggleSessionList);
  }
  
  if (sessionListToggle) {
    sessionListToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSessionList();
    });
  }
  
  // 新建会话按钮
  const newSessionBtn = document.getElementById('new-session-btn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleNewSession();
    });
  }
  
  // 设置按钮
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      initSettingsView();
      switchView('settings');
    });
  }
  
  // 点击会话列表外部关闭
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('session-list-panel');
    const sessionHeader = document.getElementById('session-header');
    
    if (panel && sessionHeader) {
      const isClickInside = panel.contains(e.target) || sessionHeader.contains(e.target);
      if (!isClickInside && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
      }
    }
  });
}

/**
 * 切换会话列表面板
 */
function toggleSessionList() {
  const panel = document.getElementById('session-list-panel');
  if (!panel) return;
  
  const isHidden = panel.classList.contains('hidden');
  
  if (isHidden) {
    // 显示面板前先加载会话列表
    renderSessionList();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

// ============================================================================
// 会话下拉面板功能
// ============================================================================

/**
 * 渲染会话列表
 * 显示当前域名的所有会话，包括标题、日期、预览
 */
async function renderSessionList() {
  const listContainer = document.getElementById('session-list');
  if (!listContainer) return;
  
  // 获取当前域名
  const domain = AppState.currentDomain;
  if (!domain) {
    listContainer.innerHTML = '<div class="session-list-empty">未检测到当前域名</div>';
    return;
  }
  
  try {
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 读取会话索引
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
    
    if (!Array.isArray(index) || index.length === 0) {
      listContainer.innerHTML = '<div class="session-list-empty">暂无会话记录</div>';
      return;
    }
    
    // 按创建时间降序排序
    const sorted = [...index].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    
    // 清空列表
    listContainer.innerHTML = '';
    
    // 获取当前会话 ID
    const currentSessionId = session.getCurrentSession()?.sessionId;
    
    // 渲染每个会话
    for (const sessionItem of sorted) {
      const card = await createSessionCard(sessionItem, domain, currentSessionId);
      listContainer.appendChild(card);
    }
    
    console.log(`[Panel] Rendered ${sorted.length} sessions for domain: ${domain}`);
    
  } catch (error) {
    console.error('[Panel] Failed to render session list:', error);
    listContainer.innerHTML = '<div class="session-list-empty">加载会话失败</div>';
  }
}

/**
 * 创建会话卡片元素
 * @param {Object} sessionItem - 会话索引项
 * @param {string} domain - 域名
 * @param {string|null} currentSessionId - 当前会话 ID
 * @returns {Promise<HTMLElement>}
 */
async function createSessionCard(sessionItem, domain, currentSessionId) {
  const { id, created_at } = sessionItem;
  
  // 动态导入 session 模块
  const session = await import('./session.js');
  
  // 加载会话元数据
  const meta = await session.loadSessionMeta(domain, id);
  
  // 加载首条用户消息（用于预览）
  const history = await session.loadAndPrepareHistory(domain, id);
  const firstUserMessage = history.find(msg => msg.role === 'user');
  const preview = firstUserMessage?.content || '（无内容）';
  
  // 创建卡片元素
  const card = document.createElement('div');
  card.className = `session-card ${id === currentSessionId ? 'active' : ''}`;
  card.dataset.sessionId = id;
  card.dataset.domain = domain;
  
  // 格式化日期
  const date = new Date(created_at || Date.now());
  const dateStr = date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  
  // 组装卡片内容
  card.innerHTML = `
    <div class="session-info">
      <div class="session-title">${escapeHtml(meta.title || '新会话')}</div>
      <div class="session-date">${dateStr}</div>
      <div class="session-preview">${escapeHtml(preview.slice(0, 50))}</div>
    </div>
    <div class="session-actions">
      <button class="session-delete-btn" title="删除会话" ${id === currentSessionId ? 'disabled' : ''}>
        🗑️
      </button>
    </div>
  `;
  
  // 绑定点击事件（切换会话）
  card.addEventListener('click', (e) => {
    // 如果点击的是删除按钮，不触发切换
    if (e.target.closest('.session-delete-btn')) return;
    handleSessionClick(domain, id);
  });
  
  // 绑定删除按钮事件
  const deleteBtn = card.querySelector('.session-delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!deleteBtn.disabled) {
      handleDeleteSession(domain, id, meta.title || '新会话');
    }
  });
  
  return card;
}

/**
 * 处理会话点击（切换会话）
 * 
 * 实现完整的会话切换流程：
 * 1. 卸载当前会话样式（移除 activeStyleEl）
 * 2. 加载目标会话历史（从 IndexedDB）
 * 3. 注入目标会话样式（从 stylesKey 读取）
 * 4. 更新 UI 对话区（渲染历史消息）
 * 5. 替换 SessionContext
 * 
 * 注意：永久样式(persistKey)是域名级别共享，不随会话切换变化
 * 
 * 设计参考：§8.2 会话生命周期 — 切换会话
 * 
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 */
async function handleSessionClick(domain, sessionId) {
  try {
    console.log(`[Panel] Switching to session: ${sessionId}`);
    
    // 动态导入依赖模块
    const session = await import('./session.js');
    const { sendToContentScript } = await import('./tools.js');
    
    // === 1. 卸载当前会话样式 ===
    // 注意：只卸载会话样式，永久样式保持不变
    try {
      await sendToContentScript({ tool: 'unload_session_css' });
      console.log('[Panel] Unloaded current session CSS');
    } catch (error) {
      console.warn('[Panel] Failed to unload session CSS (Content Script may not be ready):', error.message);
      // 继续执行，不中断切换流程
    }
    
    // === 2. 创建新的 SessionContext 并设置为当前会话 ===
    const newSession = new session.SessionContext(domain, sessionId);
    session.setCurrentSession(newSession);
    
    // === 3. 加载目标会话样式并注入 ===
    const stylesKey = newSession.stylesKey;
    const { [stylesKey]: sessionCSS = '' } = await chrome.storage.local.get(stylesKey);
    
    if (sessionCSS && sessionCSS.trim()) {
      try {
        await sendToContentScript({ 
          tool: 'load_session_css', 
          args: { css: sessionCSS } 
        });
        console.log('[Panel] Loaded target session CSS');
        
        // 更新全局状态：有样式生效
        setHasActiveStyles(true);
      } catch (error) {
        console.warn('[Panel] Failed to load session CSS:', error.message);
      }
    } else {
      // 目标会话没有样式
      setHasActiveStyles(false);
    }
    
    // === 4. 更新顶栏显示 ===
    const meta = await session.loadSessionMeta(domain, sessionId);
    updateTopBarDisplay(domain, meta.title || '新会话');
    
    // 更新全局状态中的域名和会话 ID
    stateManager.set('currentDomain', domain);
    stateManager.set('currentSessionId', sessionId);
    
    // === 5. 关闭下拉面板 ===
    const panel = document.getElementById('session-list-panel');
    if (panel) panel.classList.add('hidden');
    
    // === 6. 清空当前对话区并加载历史消息 ===
    clearMessages();
    
    // 加载会话历史
    const history = await session.loadAndPrepareHistory(domain, sessionId);
    
    // 渲染历史消息
    if (history && history.length > 0) {
      renderHistoryMessages(history);
      console.log(`[Panel] Loaded ${history.length} history messages`);
    } else {
      // 无历史，显示空状态
      showEmptyState();
    }
    
    console.log('[Panel] Session switched successfully');
    
  } catch (error) {
    console.error('[Panel] Failed to switch session:', error);
    showError('切换会话失败');
  }
}

/**
 * 处理新建会话
 */
async function handleNewSession() {
  try {
    console.log('[Panel] Creating new session');
    
    // 获取当前域名
    const domain = AppState.currentDomain;
    if (!domain) {
      showError('未检测到当前域名');
      return;
    }
    
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 生成新会话 ID
    const newSessionId = crypto.randomUUID();
    
    // 更新会话索引
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
    
    const now = Date.now();
    const newSessionItem = {
      id: newSessionId,
      created_at: now
    };
    
    // 添加到索引（最新会话放在最前面）
    const newIndex = [newSessionItem, ...index];
    await chrome.storage.local.set({ [indexKey]: newIndex });
    
    // 创建新的 SessionContext
    const newSession = new session.SessionContext(domain, newSessionId);
    
    // 设置为当前会话
    session.setCurrentSession(newSession);
    
    // 创建默认元数据
    await session.saveSessionMeta(domain, newSessionId, {
      title: null,
      created_at: now,
      message_count: 0
    });
    
    // 更新顶栏显示
    updateTopBarDisplay(domain, '新会话');
    
    // 关闭下拉面板
    const panel = document.getElementById('session-list-panel');
    if (panel) panel.classList.add('hidden');
    
    // 清空当前对话区
    clearMessages();
    showEmptyState();
    
    console.log(`[Panel] New session created: ${newSessionId}`);
    
  } catch (error) {
    console.error('[Panel] Failed to create new session:', error);
    showError('创建会话失败');
  }
}

/**
 * 处理删除会话
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {string} sessionTitle - 会话标题
 */
async function handleDeleteSession(domain, sessionId, sessionTitle) {
  try {
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 先执行删除（不立即删除，等待确认）
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
    
    // 判断是否为最后一个会话
    const isLastSession = index.length === 1;
    
    if (isLastSession) {
      // 最后一个会话，显示特殊提示
      showLastSessionModal(domain, sessionId, sessionTitle);
    } else {
      // 普通删除，显示标准确认弹窗
      showDeleteConfirmationModal(domain, sessionId, sessionTitle);
    }
    
  } catch (error) {
    console.error('[Panel] Failed to handle delete session:', error);
    showError('删除会话失败');
  }
}

/**
 * 显示删除确认弹窗
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {string} sessionTitle - 会话标题
 */
function showDeleteConfirmationModal(domain, sessionId, sessionTitle) {
  // 创建遮罩
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal-container';
  
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">删除「${escapeHtml(sessionTitle)}」？</h3>
    </div>
    <div class="modal-body">
      <p>会话记录和该会话的样式将被永久删除。</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" data-action="cancel">取消</button>
      <button class="modal-btn modal-btn-danger" data-action="confirm">确认删除</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 绑定事件
  const handleAction = async (action) => {
    if (action === 'confirm') {
      await executeDeleteSession(domain, sessionId, false);
    }
    // 关闭弹窗
    overlay.remove();
  };
  
  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      handleAction(btn.dataset.action);
    }
  });
  
  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleAction('cancel');
    }
  });
}

/**
 * 显示最后会话删除提示
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {string} sessionTitle - 会话标题
 */
function showLastSessionModal(domain, sessionId, sessionTitle) {
  // 创建遮罩
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal-container';
  
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">这是 ${domain} 的最后一个会话</h3>
    </div>
    <div class="modal-body">
      <p>删除后将清除该域名的所有会话数据。</p>
      <p>是否同时清除该网站的永久样式？</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" data-action="delete-only">仅删会话</button>
      <button class="modal-btn modal-btn-danger" data-action="delete-all">一并清除样式</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 绑定事件
  const handleAction = async (action) => {
    if (action === 'delete-only') {
      await executeDeleteSession(domain, sessionId, false);
    } else if (action === 'delete-all') {
      await executeDeleteSession(domain, sessionId, true);
    }
    // 关闭弹窗
    overlay.remove();
  };
  
  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      handleAction(btn.dataset.action);
    }
  });
  
  // 点击遮罩关闭（取消操作）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * 执行删除会话
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 * @param {boolean} clearPersistent - 是否清除永久样式
 */
async function executeDeleteSession(domain, sessionId, clearPersistent) {
  try {
    console.log(`[Panel] Deleting session: ${sessionId}, clearPersistent: ${clearPersistent}`);
    
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 执行删除
    const result = await session.deleteSession(domain, sessionId);
    
    // 如果需要清除永久样式
    if (clearPersistent && result.lastSession) {
      const persistKey = `persistent:${domain}`;
      await chrome.storage.local.remove(persistKey);
      console.log(`[Panel] Cleared persistent styles for domain: ${domain}`);
    }
    
    // 如果删除的是当前会话，创建新会话
    const currentSession = session.getCurrentSession();
    if (currentSession && currentSession.sessionId === sessionId) {
      // 创建新会话
      await handleNewSession();
    } else {
      // 重新渲染会话列表
      await renderSessionList();
    }
    
    console.log('[Panel] Session deleted successfully');
    
  } catch (error) {
    console.error('[Panel] Failed to delete session:', error);
    showError('删除会话失败');
  }
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} - 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 处理会会话点击（切换会话）
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 */
async function handleSessionClick(domain, sessionId) {
  try {
    console.log(`[Panel] Switching to session: ${sessionId}`);
    
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 动态导入 tools 模块
    const { sendToContentScript } = await import('./tools.js');
    
    // 1. 卸载当前会话样式
    try {
    await sendToContentScript({ tool: 'unload_session_css' });
    console.log('[Panel] Unloaded current session styles');
  } catch (err) {
    console.warn('[Panel] Failed to unload session styles:', err.message);
    // 继续执行，  }
    
    // 2. 创建新的 SessionContext
    const newSession = new session.SessionContext(domain, sessionId);
    
    // 3. 设置为当前会话
    session.setCurrentSession(newSession);
    
    // 4. 加载目标会话历史
    const history = await session.loadAndPrepareHistory(domain, sessionId);
    console.log(`[Panel] Loaded ${history.length} history messages`);
    
    // 5. 加载目标会话样式并注入
    const stylesKey = newSession.stylesKey;
    const { [stylesKey]: sessionStyles } = await chrome.storage.local.get(stylesKey);
    
    if (sessionStyles && sessionStyles.trim()) {
      try {
        await sendToContentScript({ 
          tool: 'load_session_css', 
          args: { css: sessionStyles } 
        });
        console.log('[Panel] Loaded target session styles');
        
        // 更新全局状态：有样式生效
        setHasActiveStyles(true);
      } catch (err) {
        console.warn('[Panel] Failed to load target session styles:', err.message);
      }
    } else {
      // 没有会话样式
      setHasActiveStyles(false);
    }
    
    // 6. 更新顶栏显示
    const meta = await session.loadSessionMeta(domain, sessionId);
    updateTopBarDisplay(domain, meta.title || '新会话');
    
    // 更新全局状态中的当前域名和会话 ID
    stateManager.set('currentDomain', domain);
    stateManager.set('currentSessionId', sessionId);
    
    // 7. 关闭下拉面板
    const panel = document.getElementById('session-list-panel');
    if (panel) panel.classList.add('hidden');
    
    // 8. 渲染历史消息到对话区
    renderHistoryMessages(history);
    
    console.log('[Panel] Session switched successfully');
    
  } catch (error) {
    console.error('[Panel] Failed to switch session:', error);
    showError('切换会话失败');
  }
}
  if (DOM.sessionTitle) {
    DOM.sessionTitle.textContent = title || '新会话';
  }
}

/**
 * 更新状态指示灯
 * @param {'idle' | 'running' | 'error' | 'restricted'} status - 状态
 * @deprecated 请使用 setProcessingState / setErrorState / setRestrictedPageState
 */
function updateStatusIndicator(status) {
  // 兼容旧接口：仅更新 agentStatus
  stateManager.set('agentStatus', status);
  // 直接更新指示灯，不触发完整联动（避免循环）
  const dot = DOM.statusDot?.querySelector('.dot');
  if (!dot) return;
  
  dot.classList.remove('ready', 'processing', 'error', 'restricted');
  
  switch (status) {
    case 'idle':
      dot.classList.add('ready');
      break;
    case 'running':
      dot.classList.add('processing');
      break;
    case 'error':
      dot.classList.add('error');
      break;
    case 'restricted':
      dot.classList.add('restricted');
      break;
  }
}

// ============================================================================
// 设置页逻辑
// ============================================================================

/**
 * 初始化主界面
 * 
 * 宝始化流程：
 * 1. 获取 DOM 元素
    2. 初始化状态同步系统
    3. 设置初始状态
    4. 应用初始全局状态
    5. 绑定顶栏交互事件
    6. 初始化错误横幅事件
    7. 初始化输入区
    8. 初始化技能快捷区
    9. 显示空状态
    10. 获取域名并加载会话（异步）
    11. 恢复会话历史消息并渲染到对话区
 */
async function initMainView() {
  // 获取 DOM 元素
  DOM.statusDot = document.getElementById('status-dot');
  DOM.currentDomain = document.getElementById('current-domain');
  DOM.sessionTitle = document.getElementById('session-title');
  DOM.messagesContainer = document.getElementById('messages-container');
  DOM.messageInput = document.getElementById('message-input');
  DOM.sendBtn = document.getElementById('send-btn');
  DOM.stopBtn = document.getElementById('stop-btn');
  DOM.inputArea = document.getElementById('input-area');
  DOM.inputWrapper = document.getElementById('input-wrapper');
  
  // 获取技能区 DOM 元素
  DOM.skillArea = document.getElementById('skill-area');
  DOM.skillChips = document.getElementById('skill-chips');
  DOM.skillAreaToggle = document.getElementById('skill-area-toggle');
  
  // 获取错误横幅 DOM 元素
  DOM.errorBanner = document.getElementById('error-banner');
  DOM.errorBannerMessage = document.getElementById('error-banner-message');
  DOM.errorBannerAction = document.getElementById('error-banner-action');
  DOM.errorBannerClose = document.getElementById('error-banner-close');
  
  // 初始化状态同步系统
  initStateSync();
  
    // 设置初始状态
  stateManager.set('agentStatus', 'idle');
    stateManager.set('apiKeyStatus', 'valid'); // 进入主界面说明已有有效 Key
    stateManager.set('pageStatus', 'ready');
    
    // 应用初始全局状态
    applyGlobalState();
    
    // 更新顶栏显示
    updateTopBarDisplay('--', '新会话');
    
    // 绑定顶栏交互事件
    bindTopBarEvents();
    
    // 初始化错误横幅事件
    initErrorBanner();
    
    // 绑定新建会话按钮事件
    const newSessionBtn = document.getElementById('new-session-btn');
    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', handleNewSession);
    }
    
    // 初始化输入区
    initInputArea();
    
    // 初始化技能快捷区
    initSkillArea();
    
    // 显示空状态
    showEmptyState();
    
    // === 获取域名并加载会话（异步）===
    try {
        // 动态导入 tools.js 获取域名
        const { getTargetDomain } = await import('./tools.js');
        
        if (domain) {
            // 更新全局状态中的域名
            stateManager.set('currentDomain', domain);
            
            // === 加载会话 ===
            // 动态导入 session.js
            const session = await import('./session.js');
            
            // 获取或创建当前域名的会话
            const { sessionId, sessionMeta } = await session.getOrCreateSession(domain);
            
            // 更新全局状态中的会话 ID
            stateManager.set('currentSessionId', sessionId);
            
            // 创建 SessionContext 并设置为当前会话
            const currentSession = new session.SessionContext(domain, sessionId);
            session.setCurrentSession(currentSession);
            
            // === 加载会话历史（如果有历史） ===
            const history = await session.loadAndPrepareHistory(domain, sessionId);
            
            if (history && history.length > 0) {
                // 渲染历史消息到对话区
                renderHistoryMessages(history);
                console.log(`[Panel] Loaded ${history.length} history messages`);
            } else {
                // 无历史，显示空状态
                showEmptyState();
            }
            
            // 更新顶栏显示
            const meta = await session.loadSessionMeta(domain, sessionId);
            updateTopBarDisplay(domain, meta.title || '新会话');
            
            console.log(`[Panel] Main view initialized for domain: ${domain}`);
        } catch (err) {
        console.error('[Panel] Failed to initialize main view:', err);
        // 显示错误状态
        showError('初始化失败');
        
        // 设置为受限页面状态
        setRestrictedPageState(true);
    }
}
  
  // 验证连接按钮
  if (DOM.verifyConnectionBtn) {
    DOM.verifyConnectionBtn.addEventListener('click', handleVerifyConnection);
  }
  
  // 切换 API Key 可见性
  const toggleKeyBtn = document.getElementById('toggle-key-visibility');
  if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener('click', () => {
      const type = DOM.settingsApiKey.type;
      DOM.settingsApiKey.type = type === 'password' ? 'text' : 'password';
      toggleKeyBtn.textContent = type === 'password' ? '🙈' : '👁';
    });
  }
  
  // 清理历史数据按钮
  const clearStorageBtn = document.getElementById('clear-storage-btn');
  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', handleClearStorage);
  }
  
  // 模型选择变更事件
  if (DOM.settingsModel) {
    DOM.settingsModel.addEventListener('change', handleModelChange);
  }
  
  // 加载当前设置
  await loadCurrentSettings();
  
  // 加载存储用量
  await loadStorageUsage();
}

/**
 * 加载当前设置到表单
 */
async function loadCurrentSettings() {
  try {
    const settings = await getSettings();
    if (DOM.settingsApiKey) {
      DOM.settingsApiKey.value = settings.apiKey || '';
    }
    if (DOM.settingsApiBase) {
      DOM.settingsApiBase.value = settings.apiBase || DEFAULT_API_BASE;
    }
    if (DOM.settingsModel) {
      DOM.settingsModel.value = settings.model || 'claude-sonnet-4-20250514';
    }
  } catch (err) {
    console.warn('[Panel] No existing settings');
  }
}

/**
 * 处理验证连接按钮点击
 */
async function handleVerifyConnection() {
  const apiKey = DOM.settingsApiKey.value.trim();
  const apiBase = DOM.settingsApiBase.value.trim() || DEFAULT_API_BASE;
  
  if (!apiKey) {
    showConnectionStatus('请输入 API Key', 'error');
    return;
  }
  
  DOM.verifyConnectionBtn.disabled = true;
  showConnectionStatus('正在验证...', 'info');
  
  try {
    const result = await validateConnection(apiKey, apiBase);
    
    if (result.ok) {
      showConnectionStatus('✓ 连接成功', 'success');
      // 保存设置
      await saveSettings({ apiKey, apiBase });
      AppState.apiKeyStatus = 'valid';
    } else {
      let msg = '连接失败';
      if (result.status === 401) msg = 'API Key 无效';
      else if (result.status === 403) msg = '访问被拒绝';
      else if (result.error) msg = result.error;
      
      showConnectionStatus(`✗ ${msg}`, 'error');
      AppState.apiKeyStatus = 'invalid';
    }
  } catch (err) {
    showConnectionStatus(`✗ ${err.message}`, 'error');
  } finally {
    DOM.verifyConnectionBtn.disabled = false;
  }
}

/**
 * 显示连接状态
 * @param {string} message - 状态消息
 * @param {'success' | 'error' | 'info'} type - 状态类型
 */
function showConnectionStatus(message, type) {
  if (!DOM.connectionStatus) return;
  
  DOM.connectionStatus.textContent = message;
  DOM.connectionStatus.classList.remove('hidden');
  
  // 设置颜色
  DOM.connectionStatus.style.color = 
    type === 'success' ? 'var(--color-success)' :
    type === 'error' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
}

/**
 * 加载存储用量
 */
async function loadStorageUsage() {
  try {
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 获取存储用量
    const usage = await session.getStorageUsage();
    
    // 更新进度条
    const progressBar = document.getElementById('storage-progress');
    if (progressBar) {
      progressBar.style.width = `${usage.percent}%`;
      
      // 根据使用率设置颜色
      if (usage.percent >= 90) {
        progressBar.style.backgroundColor = 'var(--color-error)';
      } else if (usage.percent >= 70) {
        progressBar.style.backgroundColor = 'var(--color-warning)';
      } else {
        progressBar.style.backgroundColor = 'var(--color-primary)';
      }
    }
    
    // 更新百分比文本
    const percentText = document.getElementById('storage-percent');
    if (percentText) {
      percentText.textContent = `${usage.percent}%`;
    }
    
    // 更新详细文本
    const detailText = document.getElementById('storage-detail');
    if (detailText) {
      const usedMB = (usage.bytes / (1024 * 1024)).toFixed(2);
      const maxMB = (usage.maxBytes / (1024 * 1024)).toFixed(0);
      detailText.textContent = `${usedMB} MB / ${maxMB} MB`;
    }
    
  } catch (error) {
    console.error('[Panel] Failed to load storage usage:', error);
    
    // 显示错误状态
    const percentText = document.getElementById('storage-percent');
    if (percentText) {
      percentText.textContent = '--';
    }
    
    const detailText = document.getElementById('storage-detail');
    if (detailText) {
      detailText.textContent = '无法获取存储信息';
    }
  }
}

/**
 * 处理清理历史数据按钮点击
 */
async function handleClearStorage() {
  // 确认对话框
  const confirmed = confirm(
    '确定要清理历史数据吗？\n\n' +
    '这将删除：\n' +
    '• 超过 90 天的会话\n' +
    '• 每个域名超过 20 个的旧会话\n' +
    '• 超过 50 个的旧风格技能\n\n' +
    '此操作不可撤销。'
  );
  
  if (!confirmed) return;
  
  try {
    // 动态导入 session 模块
    const session = await import('./session.js');
    
    // 显示加载状态
    const clearBtn = document.getElementById('clear-storage-btn');
    if (clearBtn) {
      clearBtn.disabled = true;
      clearBtn.textContent = '清理中...';
    }
    
    // 执行清理
    await session.cleanupStorage();
    
    // 刷新存储用量显示
    await loadStorageUsage();
    
    // 显示成功提示
    alert('历史数据清理完成！');
    
  } catch (error) {
    console.error('[Panel] Failed to clear storage:', error);
    alert('清理失败：' + error.message);
  } finally {
    // 恢复按钮状态
    const clearBtn = document.getElementById('clear-storage-btn');
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.textContent = '清理历史数据';
    }
  }
}

/**
 * 处理模型选择变更
 */
async function handleModelChange(event) {
  const selectedModel = event.target.value;
  
  try {
    // 保存模型设置
    await saveSettings({ model: selectedModel });
    console.log('[Panel] Model changed to:', selectedModel);
    
    // 显示成功提示（短暂显示）
    const modelSelect = event.target;
    const originalBorderColor = modelSelect.style.borderColor;
    modelSelect.style.borderColor = 'var(--color-success)';
    
    setTimeout(() => {
      modelSelect.style.borderColor = originalBorderColor;
    }, 1000);
    
  } catch (error) {
    console.error('[Panel] Failed to save model setting:', error);
    showError('保存模型设置失败');
  }
}

// ============================================================================
// 初始化
// ============================================================================

/**
 * 应用初始化入口
 * 
 * 完整初始化流程（设计参考：§16.8 完整使用流程 / §7.5 清理触发时机）：
 * 1. checkAndMigrateStorage - 存储 Schema 版本迁移
 * 2. checkFirstRun - 检测 API Key
 * 3. 无 Key 展示引导页 / 有 Key 进入主界面
 * 4. 获取域名（通过 Content Script）
 * 5. 加载会话
 * 6. 加载技能 chip
 * 7. 后台执行 cleanupStorage（不阻塞 UI）
 */
async function init() {
  console.log('[Panel] Initializing...');
  
  // === Step 1: 存储 Schema 版本迁移 ===
  try {
    const session = await import('./session.js');
    await session.checkAndMigrateStorage();
    console.log('[Panel] Storage migration checked');
  } catch (err) {
    console.error('[Panel] Storage migration failed:', err);
    // 继续执行，不中断初始化
  }
  
  // 缓存 DOM 元素
  DOM.onboardingView = document.getElementById('onboarding-view');
  DOM.mainView = document.getElementById('main-view');
  DOM.settingsView = document.getElementById('settings-view');
  DOM.loadingOverlay = document.getElementById('loading-overlay');
  DOM.errorToast = document.getElementById('error-toast');
  DOM.errorMessage = document.getElementById('error-message');
  
  // 错误提示关闭按钮
  const dismissErrorBtn = document.getElementById('dismiss-error');
  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener('click', hideError);
  }
  
  // 设置按钮
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      initSettingsView();
      switchView('settings');
    });
  }
  
  // === Step 2: 检测 API Key ===
  try {
    const { needsSetup } = await checkFirstRun();
    
    if (needsSetup) {
      // === Step 3a: 首次使用，显示引导页 ===
      console.log('[Panel] First run detected, showing onboarding');
      initOnboarding();
      switchView('onboarding');
      AppState.apiKeyStatus = 'missing';
    } else {
      // === Step 3b: 已有配置，进入主界面 ===
      console.log('[Panel] Existing settings found, entering main view');
      AppState.apiKeyStatus = 'valid';
      
      // 初始化主界面（包含获取域名、加载会话、加载技能 chip）
      await initMainView();
      
      switchView('main');
      
      // === Step 7: 后台执行 cleanupStorage（不阻塞 UI）===
      import('./session.js').then(session => {
        session.cleanupStorage().catch(err => {
          console.error('[Panel] Background cleanup failed:', err);
        });
      });
    }
  } catch (err) {
    console.error('[Panel] Init error:', err);
    // 出错时显示引导页
    initOnboarding();
    switchView('onboarding');
  }
}

// ============================================================================
// 启动
// ============================================================================

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// ============================================================================
// 消息渲染函数
// ============================================================================

/**
 * 渲染用户消息气泡
 * @param {string} content - 消息内容
 * @returns {HTMLElement} - 消息 DOM 元素
 */
function renderUserMessage(content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message message-user';
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.textContent = content;
  
  messageDiv.appendChild(bubbleDiv);
  return messageDiv;
}

/**
 * 渲染助手消息容器（用于流式输出）
 * @returns {HTMLElement} - 消息 DOM 元素（包含气泡容器）
 */
function renderAssistantMessageContainer() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message message-assistant';
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble streaming-text';
  
  messageDiv.appendChild(bubbleDiv);
  return messageDiv;
}

// ============================================================================
// 流式文本渲染器
// ============================================================================

/**
 * 流式文本渲染器类
 * 支持逐字追加、Markdown 基础渲染、打字机光标效果
 */
class StreamingTextRenderer {
  /**
   * @param {HTMLElement} container - 目标容器元素
   * @param {Object} options - 配置选项
   */
  constructor(container, options = {}) {
    this.container = container;
    this.buffer = '';              // 原始文本缓冲
    this.renderedHTML = '';        // 已渲染的 HTML
    this.cursor = null;            // 光标元素
    this.isStreaming = false;      // 是否正在流式输出
    
    // 配置选项
    this.options = {
      showCursor: options.showCursor !== false,  // 默认显示光标
      autoScroll: options.autoScroll !== false,  // 默认自动滚动
      scrollContainer: options.scrollContainer || null,  // 滚动容器
    };
    
    // 初始化光标
    if (this.options.showCursor) {
      this._initCursor();
    }
  }
  
  /**
   * 初始化光标元素
   * @private
   */
  _initCursor() {
    this.cursor = document.createElement('span');
    this.cursor.className = 'typing-cursor';
    this.container.appendChild(this.cursor);
  }
  
  /**
   * 追加文本（流式）
   * @param {string} text - 要追加的文本
   */
  appendText(text) {
    if (!text) return;
    
    this.buffer += text;
    this.isStreaming = true;
    
    // 渲染 Markdown 并更新 DOM
    const html = this._renderMarkdown(this.buffer);
    
    // 保留光标元素
    if (this.cursor && this.cursor.parentNode === this.container) {
      this.container.removeChild(this.cursor);
    }
    
    this.container.innerHTML = html;
    
    // 重新添加光标
    if (this.options.showCursor && this.isStreaming) {
      this.container.appendChild(this.cursor);
    }
    
    // 自动滚动
    if (this.options.autoScroll) {
      this._scrollToBottom();
    }
  }
  
  /**
   * 完成流式输出
   */
  finish() {
    this.isStreaming = false;
    
    // 移除光标
    if (this.cursor && this.cursor.parentNode === this.container) {
      this.container.removeChild(this.cursor);
    }
    
    // 最终渲染
    const html = this._renderMarkdown(this.buffer);
    this.container.innerHTML = html;
    
    // 确保滚动到底部
    if (this.options.autoScroll) {
      this._scrollToBottom();
    }
  }
  
  /**
   * 清空内容
   */
  clear() {
    this.buffer = '';
    this.renderedHTML = '';
    this.container.innerHTML = '';
    
    // 重新添加光标
    if (this.options.showCursor && this.cursor) {
      this.container.appendChild(this.cursor);
    }
  }
  
  /**
   * 渲染基础 Markdown
   * @param {string} text - 原始文本
   * @returns {string} - 渲染后的 HTML
   * @private
   */
  _renderMarkdown(text) {
    if (!text) return '';
    
    let html = this._escapeHtml(text);
    
    // 代码块（``` ... ```）
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const langAttr = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langAttr}>${code.trim()}</code></pre>`;
    });
    
    // 行内代码（`code`）
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 加粗（**text** 或 __text__）
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // 斜体（*text* 或 _text_）
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // 删除线（~~text~~）
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // 链接（[text](url)）
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // 换行处理
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // 包裹段落
    if (!html.startsWith('<pre>')) {
      html = `<p>${html}</p>`;
    }
    
    return html;
  }
  
  /**
   * 转义 HTML 特殊字符
   * @param {string} text - 原始文本
   * @returns {string} - 转义后的文本
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * 滚动到底部
   * @private
   */
  _scrollToBottom() {
    const scrollContainer = this.options.scrollContainer || DOM.messagesContainer;
    if (scrollContainer) {
      // 使用 requestAnimationFrame 确保平滑滚动
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }
}

/**
 * 添加消息到对话区
 * @param {HTMLElement} messageElement - 消息 DOM 元素
 */
function addMessageToContainer(messageElement) {
  if (DOM.messagesContainer) {
    DOM.messagesContainer.appendChild(messageElement);
    // 自动滚动到底部
    scrollToBottom();
  }
}

/**
 * 清空对话区所有消息
 */
function clearMessages() {
  if (DOM.messagesContainer) {
    DOM.messagesContainer.innerHTML = '';
  }
}

/**
 * 滚动对话区到底部（平滑滚动）
 */
function scrollToBottom() {
  if (DOM.messagesContainer) {
    // 使用 requestAnimationFrame 确保平滑滚动
    requestAnimationFrame(() => {
      DOM.messagesContainer.scrollTo({
        top: DOM.messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

/**
 * 创建流式文本渲染器实例
 * @param {HTMLElement} container - 目标容器元素
 * @param {Object} options - 配置选项
 * @returns {StreamingTextRenderer} - 渲染器实例
 */
function createStreamingRenderer(container, options = {}) {
  // 默认配置：自动滚动，使用 messagesContainer 作为滚动容器
  const defaultOptions = {
    showCursor: true,
    autoScroll: true,
    scrollContainer: DOM.messagesContainer,
    ...options
  };
  
  return new StreamingTextRenderer(container, defaultOptions);
}

/**
 * 显示空状态提示
 */
function showEmptyState() {
  if (!DOM.messagesContainer) return;
  
  const emptyState = document.createElement('div');
  emptyState.className = 'chat-area-empty';
  emptyState.innerHTML = `
    <div class="empty-state-icon">💬</div>
    <div class="empty-state-title">开始对话</div>
    <div class="empty-state-description">描述你想要的样式效果，或点击上方技能快捷按钮</div>
  `;
  
  DOM.messagesContainer.appendChild(emptyState);
}

/**
 * 渲染历史消息到对话区
 * 
 * 用于会话切换时恢复对话历史。
 * 支持 Anthropic Messages API 的消息格式。
 * 
 * @param {Array} history - 对话历史数组，格式为 [{ role, content }, ...]
 * @returns {void}
 * 
 * @example
 * const history = [
 *   { role: 'user', content: '把背景改成深蓝色' },
 *   { role: 'assistant', content: [{ type: 'text', text: '好的...' }] }
 * ];
 * renderHistoryMessages(history);
 */
function renderHistoryMessages(history) {
  if (!DOM.messagesContainer) return;
  
  // 如果没有历史，显示空状态
  if (!history || history.length === 0) {
    showEmptyState();
    return;
  }
  
  // 遍历历史消息并渲染
  for (const message of history) {
    if (message.role === 'user') {
      // 用户消息
      const content = typeof message.content === 'string' 
        ? message.content 
        : message.content?.[0]?.text || '';
      
      if (content) {
        const userMessageEl = renderUserMessage(content);
        addMessageToContainer(userMessageEl);
      }
    } else if (message.role === 'assistant') {
      // 助手消息
      const assistantMessageEl = renderAssistantMessageContainer();
      const bubble = assistantMessageEl.querySelector('.message-bubble');
      
      // 处理 content 数组
      if (Array.isArray(message.content)) {
        let textContent = '';
        const toolCalls = [];
        
        for (const block of message.content) {
          if (block.type === 'text') {
            textContent += block.text || '';
          } else if (block.type === 'tool_use') {
            toolCalls.push(block);
          }
        }
        
        // 渲染文本内容
        if (textContent) {
          const renderer = createStreamingRenderer(bubble, { showCursor: false });
          renderer.appendText(textContent);
          renderer.finish();
        }
        
        // 渲染工具调用卡片（如果有）
        if (toolCalls.length > 0) {
          // 创建工具卡片组
          const cardGroup = createToolCardGroup();
          
          for (const toolCall of toolCalls) {
            // 为历史消息创建已完成的工具卡片
            const card = document.createElement('div');
            card.className = 'tool-card completed collapsed';
            card.dataset.toolId = toolCall.id;
            card.dataset.toolName = toolCall.name;
            
            const displayName = getToolDisplayName(toolCall.name);
            
            card.innerHTML = `
              <div class="tool-card-header">
                <div class="tool-card-title">
                  <span class="tool-card-icon">✅</span>
                  <span class="tool-card-name">${displayName}</span>
                </div>
                <div class="tool-card-expand">▸</div>
              </div>
              <div class="tool-card-body">
                <div class="tool-card-section">
                  <div class="tool-card-label">输入:</div>
                  <div class="tool-card-content"><code>${toolCardManager.formatInput(toolCall.input)}</code></div>
                </div>
                <div class="tool-card-section">
                  <div class="tool-card-label">输出:</div>
                  <div class="tool-card-content tool-card-output"><span class="tool-card-empty">(历史记录)</span></div>
                </div>
              </div>
            `;
            
            // 绑定展开/折叠事件
            const header = card.querySelector('.tool-card-header');
            header.addEventListener('click', () => toolCardManager.toggleCard(card));
            
            cardGroup.appendChild(card);
          }
          
          // 添加卡片组到对话区
          addMessageToContainer(cardGroup);
        }
      } else if (typeof message.content === 'string') {
        // 简单字符串内容
        const renderer = createStreamingRenderer(bubble, { showCursor: false });
        renderer.appendText(message.content);
        renderer.finish();
      }
      
      addMessageToContainer(assistantMessageEl);
    }
  }
}

/**
 * 渲染历史消息到对话区
 * 
 * 用于会话切换时恢复对话历史。
 * 支持 Anthropic Messages API 的消息格式。
 * 
 * @param {Array} history - 对话历史数组，格式为 [{ role, content }, ...]
 * @returns {void}
 * 
 * @example
 * const history = [
 *   { role: 'user', content: '把背景改成深蓝色' },
 *   { role: 'assistant', content: [{ type: 'text', text: '好的...' }] }
 * ];
 * renderHistoryMessages(history);
 */
function renderHistoryMessages(history) {
  if (!DOM.messagesContainer) return;
  
  // 清空当前对话区
  clearMessages();
  
  // 如果没有历史，显示空状态
  if (!history || history.length === 0) {
    showEmptyState();
    return;
  }
  
  // 遍历历史消息并渲染
  for (const message of history) {
    if (message.role === 'user') {
      // 渲染用户消息
      const userContent = typeof message.content === 'string' 
        ? message.content 
        : message.content?.[0]?.text || '';
      
      if (userContent) {
        const userMessageEl = renderUserMessage(userContent);
        addMessageToContainer(userMessageEl);
      }
    } else if (message.role === 'assistant') {
      // 渲染助手消息
      const assistantMessageEl = renderAssistantMessageContainer();
      const bubble = assistantMessageEl.querySelector('.message-bubble');
      
      // 处理 content 数组
      if (Array.isArray(message.content)) {
        let textContent = '';
        const toolCalls = [];
        
        for (const block of message.content) {
          if (block.type === 'text') {
            textContent += block.text || '';
          } else if (block.type === 'tool_use') {
            toolCalls.push(block);
          }
        }
        
        // 渲染文本内容
        if (textContent) {
          const renderer = createStreamingRenderer(bubble, { showCursor: false });
          renderer.appendText(textContent);
          renderer.finish();
        }
        
        // 渲染工具调用卡片（如果有）
        if (toolCalls.length > 0) {
          const cardGroup = toolCardManager.createCardGroup();
          
          for (const toolCall of toolCalls) {
            toolCardManager.addToolCard(toolCall.id, toolCall.name);
            // 对于历史消息，工具调用已完成，直接显示为完成状态
            // 注意：历史消息中没有 tool_result，所以输出显示为 "(历史记录)"
            toolCardManager.completeToolCard(
              toolCall.id, 
              toolCall.name, 
              toolCall.input, 
              '(历史记录)'
            );
          }
          
          // 将卡片组添加到消息容器
          addMessageToContainer(cardGroup);
          toolCardManager.finalizeCardGroup();
        }
      } else if (typeof message.content === 'string') {
        // 兼容旧格式
        const renderer = createStreamingRenderer(bubble, { showCursor: false });
        renderer.appendText(message.content);
        renderer.finish();
      }
      
      addMessageToContainer(assistantMessageEl);
    }
  }
  
  // 滚动到底部
  scrollToBottom();
  
  console.log(`[Panel] Rendered ${history.length} history messages`);
}

// ============================================================================
// 导出供其他模块使用（可选）
// ============================================================================

// ============================================================================
// 工具调用卡片渲染
// ============================================================================

/**
 * 工具名称映射表（友好的显示名称）
 */
const TOOL_DISPLAY_NAMES = {
  'get_page_structure': '查看页面结构',
  'grep': '搜索页面元素',
  'apply_styles': '应用样式',
  'get_user_profile': '获取用户画像',
  'update_user_profile': '更新用户画像',
  'load_skill': '加载知识',
  'save_style_skill': '保存风格技能',
  'list_style_skills': '列出风格技能',
  'delete_style_skill': '删除风格技能',
  'TodoWrite': '任务规划',
  'Task': '子任务',
};

/**
 * 获取工具友好显示名称
 * @param {string} toolName - 工具名称
 * @returns {string} - 友好显示名称
 */
function getToolDisplayName(toolName) {
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

/**
 * 工具调用卡片管理器
 * 用于管理当前消息中的工具调用卡片组
 */
class ToolCardManager {
  constructor() {
    /** @type {HTMLElement|null} 当前卡片组容器 */
    this.currentCardGroup = null;
    /** @type {Map<string, HTMLElement>} 工具调用ID到卡片元素的映射 */
    this.cardMap = new Map();
  }

  /**
   * 创建新的工具卡片组
   * @returns {HTMLElement} 卡片组容器
   */
  createCardGroup() {
    // 如果已有卡片组，先结束它
    if (this.currentCardGroup) {
      this.finalizeCardGroup();
    }

    const group = document.createElement('div');
    group.className = 'tool-card-group';
    
    this.currentCardGroup = group;
    this.cardMap.clear();
    
    return group;
  }

  /**
   * 添加工具调用卡片（处理中状态）
   * @param {string} toolId - 工具调用ID
   * @param {string} toolName - 工具名称
   * @returns {HTMLElement} 卡片元素
   */
  addToolCard(toolId, toolName) {
    if (!this.currentCardGroup) {
      this.createCardGroup();
    }

    const card = document.createElement('div');
    card.className = 'tool-card processing';
    card.dataset.toolId = toolId;
    card.dataset.toolName = toolName;

    const displayName = getToolDisplayName(toolName);

    card.innerHTML = `
      <div class="tool-card-header">
        <div class="tool-card-title">
          <span class="tool-card-icon">🔧</span>
          <span class="tool-card-name">${displayName}</span>
        </div>
        <div class="tool-card-status processing">
          <span class="status-indicator">◌</span>
          <span class="status-text">进行中</span>
        </div>
      </div>
    `;

    this.currentCardGroup.appendChild(card);
    this.cardMap.set(toolId, card);

    // 滚动到底部
    scrollToBottom();

    return card;
  }

  /**
   * 完成工具调用卡片（显示结果）
   * @param {string} toolId - 工具调用ID
   * @param {string} toolName - 工具名称
   * @param {Object|null} input - 工具输入参数
   * @param {string} output - 工具输出结果
   */
  completeToolCard(toolId, toolName, input, output) {
    const card = this.cardMap.get(toolId);
    if (!card) return;

    const displayName = getToolDisplayName(toolName);

    // 更新卡片状态
    card.classList.remove('processing');
    card.classList.add('completed', 'collapsed');

    // 格式化输入参数
    const inputDisplay = this.formatInput(input);
    
    // 格式化输出（截断长文本）
    const outputDisplay = this.formatOutput(output);

    card.innerHTML = `
      <div class="tool-card-header">
        <div class="tool-card-title">
          <span class="tool-card-icon">✅</span>
          <span class="tool-card-name">${displayName}</span>
        </div>
        <div class="tool-card-expand">▸</div>
      </div>
      <div class="tool-card-body">
        <div class="tool-card-section">
          <div class="tool-card-label">输入:</div>
          <div class="tool-card-content">${inputDisplay}</div>
        </div>
        <div class="tool-card-section">
          <div class="tool-card-label">输出:</div>
          <div class="tool-card-content tool-card-output">${outputDisplay}</div>
        </div>
      </div>
    `;

    // 绑定展开/折叠事件
    const header = card.querySelector('.tool-card-header');
    header.addEventListener('click', () => this.toggleCard(card));

    // 更新映射
    this.cardMap.set(toolId, card);
  }

  /**
   * 切换卡片展开/折叠状态
   * @param {HTMLElement} card - 卡片元素
   */
  toggleCard(card) {
    const isCollapsed = card.classList.contains('collapsed');
    
    if (isCollapsed) {
      // 展开前，折叠同组的其他卡片
      if (this.currentCardGroup) {
        const allCards = this.currentCardGroup.querySelectorAll('.tool-card');
        allCards.forEach(c => c.classList.add('collapsed'));
      }
      card.classList.remove('collapsed');
      card.classList.add('expanded');
    } else {
      card.classList.remove('expanded');
      card.classList.add('collapsed');
    }
  }

  /**
   * 完成当前卡片组
   */
  finalizeCardGroup() {
    if (this.currentCardGroup) {
      // 检查卡片组内是否有卡片
      const cards = this.currentCardGroup.querySelectorAll('.tool-card');
      if (cards.length === 0) {
        this.currentCardGroup.remove();
      }
    }
    this.currentCardGroup = null;
    this.cardMap.clear();
  }

  /**
   * 格式化输入参数显示
   * @param {Object|null} input - 输入参数
   * @returns {string} - 格式化后的HTML
   */
  formatInput(input) {
    if (!input || Object.keys(input).length === 0) {
      return '<span class="tool-card-empty">(无参数)</span>';
    }

    // 特殊处理：显示关键参数
    const keyParams = [];
    
    // 常见参数处理
    if (input.query) {
      keyParams.push(`query: "${input.query}"`);
    }
    if (input.mode) {
      keyParams.push(`mode: ${input.mode}`);
    }
    if (input.skill_name) {
      keyParams.push(`skill: ${input.skill_name}`);
    }
    if (input.name) {
      keyParams.push(`name: ${input.name}`);
    }
    if (input.css) {
      // CSS 截断显示
      const cssPreview = input.css.length > 50 
        ? input.css.substring(0, 50) + '...' 
        : input.css;
      keyParams.push(`css: "${cssPreview}"`);
    }

    if (keyParams.length > 0) {
      return `<code>${keyParams.join(', ')}</code>`;
    }

    // 默认：JSON 格式
    try {
      const json = JSON.stringify(input, null, 2);
      if (json.length > 200) {
        return `<code>${json.substring(0, 200)}...</code>`;
      }
      return `<code>${json}</code>`;
    } catch {
      return '<span class="tool-card-empty">(无法显示)</span>';
    }
  }

  /**
   * 格式化输出结果显示
   * @param {string} output - 输出结果
   * @returns {string} - 格式化后的HTML
   */
  formatOutput(output) {
    if (!output) {
      return '<span class="tool-card-empty">(无输出)</span>';
    }

    // 截断长文本
    const maxLen = 500;
    let displayText = output;
    let truncated = false;

    if (output.length > maxLen) {
      displayText = output.substring(0, maxLen);
      truncated = true;
    }

    // 转义HTML
    const escaped = this.escapeHtml(displayText);
    
    // 保留换行
    const formatted = escaped.replace(/\n/g, '<br>');

    if (truncated) {
      return `<span class="tool-card-text">${formatted}</span><span class="tool-card-truncated">(已截断)</span>`;
    }

    return `<span class="tool-card-text">${formatted}</span>`;
  }

  /**
   * 转义HTML特殊字符
   * @param {string} text - 原始文本
   * @returns {string} - 转义后的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取当前卡片组（用于添加到消息容器）
   * @returns {HTMLElement|null}
   */
  getCurrentCardGroup() {
    return this.currentCardGroup;
  }

  /**
   * 是否有活跃的卡片组
   * @returns {boolean}
   */
  hasActiveCardGroup() {
    return this.currentCardGroup !== null && 
           this.currentCardGroup.querySelectorAll('.tool-card').length > 0;
  }
}

/**
 * 全局工具卡片管理器实例
 */
const toolCardManager = new ToolCardManager();

/**
 * 创建工具调用卡片（处理中状态）
 * @param {string} toolId - 工具调用ID
 * @param {string} toolName - 工具名称
 * @returns {HTMLElement} 卡片组容器
 */
function createToolCard(toolId, toolName) {
  // 确保有卡片组
  if (!toolCardManager.hasActiveCardGroup()) {
    const group = toolCardManager.createCardGroup();
    addMessageToContainer(group);
  }
  
  toolCardManager.addToolCard(toolId, toolName);
  
  return toolCardManager.getCurrentCardGroup();
}

/**
 * 完成工具调用卡片
 * @param {string} toolId - 工具调用ID
 * @param {string} toolName - 工具名称
 * @param {Object|null} input - 工具输入参数
 * @param {string} output - 工具输出结果
 */
function completeToolCard(toolId, toolName, input, output) {
  toolCardManager.completeToolCard(toolId, toolName, input, output);
}

/**
 * 结束当前工具卡片组
 */
function finalizeToolCardGroup() {
  toolCardManager.finalizeCardGroup();
}

/**
 * 创建新的工具卡片组
 * @returns {HTMLElement}
 */
function createToolCardGroup() {
  return toolCardManager.createCardGroup();
}

// ============================================================================
// 操作确认浮层
// ============================================================================

/**
 * 操作确认浮层管理类
 * 
 * 负责：
 * - 显示确认/撤销按钮
 * - 处理单次/多次样式应用的确认
 * - 60秒超时自动消失
 * - 撤销操作触发
 * 
 * 设计参考：§16.3 ④ 操作确认浮层
 */
class ConfirmationOverlay {
  constructor() {
    /** @type {HTMLElement|null} 浮层 DOM 元素 */
    this.overlay = null;
    
    /** @type {number|null} 超时定时器 ID */
    this.timeoutId = null;
    
    /** @type {number|null} 进度条动画帧 ID */
    this.progressAnimationId = null;
    
    /** @type {number} 超时时长（毫秒） */
    this.timeoutDuration = 60000;
    
    /** @type {number} 样式应用次数 */
    this.applyCount = 0;
    
    /** @type {HTMLElement|null} 下拉菜单元素 */
    this.dropdown = null;
    
    /** @type {Function|null} 撤销回调 */
    this.onUndo = null;
    
    /** @type {Function|null} 全部撤销回调 */
    this.onUndoAll = null;
    
    /** @type {Function|null} 确认回调 */
    this.onConfirm = null;
  }

  /**
   * 显示确认浮层
   * @param {Object} options - 配置选项
   * @param {number} options.applyCount - 样式应用次数
   * @param {Function} options.onUndo - 撤销回调
   * @param {Function} options.onUndoAll - 全部撤销回调
   * @param {Function} options.onConfirm - 确认回调
   */
  show(options = {}) {
    const { applyCount = 1, onUndo, onUndoAll, onConfirm } = options;
    
    this.applyCount = applyCount;
    this.onUndo = onUndo;
    this.onUndoAll = onUndoAll;
    this.onConfirm = onConfirm;
    
    // 如果已有浮层，先移除
    this.hide(false);
    
    // 创建浮层
    this.overlay = this._createOverlayElement();
    
    // 插入到输入区之前
    const inputArea = document.getElementById('input-area');
    if (inputArea && inputArea.parentNode) {
      inputArea.parentNode.insertBefore(this.overlay, inputArea);
    }
    
    // 启动超时计时器
    this._startTimeout();
    
    console.log('[ConfirmationOverlay] 浮层已显示，样式应用次数:', applyCount);
  }

  /**
   * 隐藏确认浮层
   * @param {boolean} animate - 是否使用动画淡出
   */
  hide(animate = true) {
    // 清除超时定时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // 清除进度条动画
    if (this.progressAnimationId) {
      cancelAnimationFrame(this.progressAnimationId);
      this.progressAnimationId = null;
    }
    
    // 移除浮层
    if (this.overlay) {
      if (animate) {
        // 添加淡出动画
        this.overlay.classList.add('fade-out');
        
        // 动画结束后移除元素
        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
          }
          this.overlay = null;
        }, 200); // 动画时长
      } else {
        // 直接移除
        if (this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
      }
    }
    
    // 重置状态
    this.dropdown = null;
    this.applyCount = 0;
  }

  /**
   * 创建浮层 DOM 元素
   * @private
   * @returns {HTMLElement}
   */
  _createOverlayElement() {
    const overlay = document.createElement('div');
    overlay.className = 'confirmation-overlay';
    
    if (this.applyCount === 1) {
      // 单次样式应用
      overlay.innerHTML = `
        <div class="confirmation-content">
          <div class="confirmation-buttons">
            <button class="confirmation-btn primary" data-action="confirm">
              ✓ 确认效果
            </button>
            <button class="confirmation-btn secondary" data-action="undo">
              ↶ 撤销
            </button>
          </div>
          <span class="confirmation-hint">或继续输入</span>
        </div>
      `;
    } else {
      // 多次样式应用
      overlay.innerHTML = `
        <div class="confirmation-content">
          <div class="confirmation-buttons">
            <button class="confirmation-btn primary" data-action="confirm-all">
              ✓ 全部确认
            </button>
            <div class="confirmation-dropdown-wrapper" style="position: relative;">
              <button class="confirmation-dropdown-trigger" data-action="dropdown">
                ↶ 撤销最后一步
                <span class="arrow">▾</span>
              </button>
              <div class="confirmation-dropdown hidden">
                <button class="confirmation-dropdown-item" data-action="undo-last">
                  ↶ 撤销最后一步
                </button>
                <button class="confirmation-dropdown-item danger" data-action="undo-all">
                  ↶↶ 全部撤销
                </button>
              </div>
            </div>
          </div>
          <span class="confirmation-hint">或继续输入</span>
        </div>
        <div class="confirmation-timeout">
          <div class="confirmation-timeout-bar" style="width: 100%"></div>
        </div>
      `;
      
      // 保存下拉菜单引用
      this.dropdown = overlay.querySelector('.confirmation-dropdown');
    }
    
    // 绑定事件
    this._bindEvents(overlay);
    
    return overlay;
  }

  /**
   * 绑定浮层事件
   * @private
   * @param {HTMLElement} overlay - 浮层元素
   */
  _bindEvents(overlay) {
    overlay.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      
      const action = target.dataset.action;
      
      switch (action) {
        case 'confirm':
        case 'confirm-all':
          // 确认 - 隐藏浮层
          this.hide(true);
          if (this.onConfirm) {
            this.onConfirm();
          }
          break;
          
        case 'undo':
        case 'undo-last':
          // 撤销最后一步
          this.hide(false);
          if (this.onUndo) {
            this.onUndo();
          }
          break;
          
        case 'undo-all':
          // 全部撤销
          this.hide(false);
          if (this.onUndoAll) {
            this.onUndoAll();
          }
          break;
          
        case 'dropdown':
          // 切换下拉菜单
          this._toggleDropdown();
          break;
      }
    });
    
    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
      if (this.dropdown && !this.overlay.contains(e.target)) {
        this._closeDropdown();
      }
    });
  }

  /**
   * 切换下拉菜单显示/隐藏
   * @private
   */
  _toggleDropdown() {
    if (!this.dropdown) return;
    
    const isHidden = this.dropdown.classList.contains('hidden');
    
    if (isHidden) {
      this._openDropdown();
    } else {
      this._closeDropdown();
    }
  }

  /**
   * 打开下拉菜单
   * @private
   */
  _openDropdown() {
    if (!this.dropdown) return;
    
    this.dropdown.classList.remove('hidden');
    
    // 更新触发按钮状态
    const trigger = this.overlay.querySelector('.confirmation-dropdown-trigger');
    if (trigger) {
      trigger.classList.add('open');
    }
  }

  /**
   * 关闭下拉菜单
   * @private
   */
  _closeDropdown() {
    if (!this.dropdown) return;
    
    this.dropdown.classList.add('hidden');
    
    // 更新触发按钮状态
    const trigger = this.overlay.querySelector('.confirmation-dropdown-trigger');
    if (trigger) {
      trigger.classList.remove('open');
    }
  }

  /**
   * 启动超时计时器
   * @private
   */
  _startTimeout() {
    const startTime = Date.now();
    const progressBar = this.overlay?.querySelector('.confirmation-timeout-bar');
    
    // 进度条动画
    const updateProgress = () => {
      if (!this.overlay) return;
      
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, this.timeoutDuration - elapsed);
      const percent = (remaining / this.timeoutDuration) * 100;
      
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      
      if (remaining > 0) {
        this.progressAnimationId = requestAnimationFrame(updateProgress);
      }
    };
    
    // 启动进度条动画
    if (progressBar) {
      updateProgress();
    }
    
    // 超时自动隐藏
    this.timeoutId = setTimeout(() => {
      console.log('[ConfirmationOverlay] 超时自动隐藏');
      this.hide(true);
      if (this.onConfirm) {
        this.onConfirm();
      }
    }, this.timeoutDuration);
  }

  /**
   * 检查浮层是否显示
   * @returns {boolean}
   */
  isVisible() {
    return this.overlay !== null && this.overlay.parentNode !== null;
  }
}

/**
 * 全局确认浮层管理器实例
 */
const confirmationOverlay = new ConfirmationOverlay();

/**
 * 显示确认浮层
 * @param {Object} options - 配置选项
 */
function showConfirmationOverlay(options) {
  confirmationOverlay.show(options);
}

/**
 * 隐藏确认浮层
 * @param {boolean} animate - 是否使用动画
 */
function hideConfirmationOverlay(animate = true) {
  confirmationOverlay.hide(animate);
}

/**
 * 检查确认浮层是否显示
 * @returns {boolean}
 */
function isConfirmationOverlayVisible() {
  return confirmationOverlay.isVisible();
}

/**
 * 获取确认浮层实例
 * @returns {ConfirmationOverlay}
 */
function getConfirmationOverlay() {
  return confirmationOverlay;
}

// ============================================================================
// 错误横幅逻辑
// ============================================================================

/**
 * 错误类型配置
 */
const ERROR_BANNER_CONFIGS = {
  API_KEY_INVALID: {
    message: 'API Key 无效，请检查设置',
    actionText: '去设置→',
    action: 'settings'
  },
  NETWORK_ERROR: {
    message: '网络错误，请检查网络连接',
    actionText: '重试',
    action: 'retry'
  },
  API_ERROR: {
    message: 'API 调用失败',
    actionText: '重试',
    action: 'retry'
  }
};

/**
 * 显示错误横幅
 * @param {string} errorType - 错误类型：'API_KEY_INVALID' | 'NETWORK_ERROR' | 'API_ERROR'
 * @param {Object} options - 可选配置
 * @param {string} options.customMessage - 自定义错误消息
 * @param {Function} options.onRetry - 重试回调（仅 NETWORK_ERROR 和 API_ERROR）
 */
function showErrorBanner(errorType, options = {}) {
  if (!DOM.errorBanner) return;
  
  const config = ERROR_BANNER_CONFIGS[errorType];
  if (!config) {
    console.error('[Panel] Unknown error type:', errorType);
    return;
  }
  
  // 设置错误消息
  const message = options.customMessage || config.message;
  DOM.errorBannerMessage.textContent = message;
  
  // 设置操作按钮
  if (config.actionText && config.action) {
    DOM.errorBannerAction.textContent = config.actionText;
    DOM.errorBannerAction.classList.remove('hidden');
    DOM.errorBannerAction.dataset.action = config.action;
    
    // 如果是重试操作，保存回调
    if (config.action === 'retry' && options.onRetry) {
      DOM.errorBannerAction.dataset.hasCallback = 'true';
      // 使用闭包保存回调
      DOM.errorBannerAction._retryCallback = options.onRetry;
    } else {
      DOM.errorBannerAction.dataset.hasCallback = 'false';
      DOM.errorBannerAction._retryCallback = null;
    }
  } else {
    DOM.errorBannerAction.classList.add('hidden');
  }
  
  // 显示横幅
  DOM.errorBanner.classList.remove('hidden');
  
  // 更新状态指示灯为错误状态
  updateStatusIndicator('error');
  
  console.log('[Panel] Error banner shown:', errorType, message);
}

/**
 * 隐藏错误横幅
 */
function hideErrorBanner() {
  if (!DOM.errorBanner) return;
  
  DOM.errorBanner.classList.add('hidden');
  
  // 清除重试回调
  if (DOM.errorBannerAction) {
    DOM.errorBannerAction._retryCallback = null;
  }
  
  // 恢复状态指示灯
  if (AppState.agentStatus === 'error') {
    updateStatusIndicator('idle');
  }
  
  console.log('[Panel] Error banner hidden');
}

/**
 * 初始化错误横幅事件
 */
function initErrorBanner() {
  // 关闭按钮
  if (DOM.errorBannerClose) {
    DOM.errorBannerClose.addEventListener('click', () => {
      hideErrorBanner();
    });
  }
  
  // 操作按钮
  if (DOM.errorBannerAction) {
    DOM.errorBannerAction.addEventListener('click', () => {
      const action = DOM.errorBannerAction.dataset.action;
      
      switch (action) {
        case 'settings':
          // 跳转到设置页
          hideErrorBanner();
          initSettingsView();
          switchView('settings');
          break;
          
        case 'retry':
          // 执行重试回调
          if (DOM.errorBannerAction._retryCallback) {
            hideErrorBanner();
            DOM.errorBannerAction._retryCallback();
          }
          break;
      }
    });
  }
}

// ============================================================================
// 导出函数
// ============================================================================

export {
  AppState, 
  stateManager,
  switchView, 
  showError, 
  updateStatusIndicator,
  updateInputAreaState,
  setRestrictedPageState,
  setProcessingState,
  setErrorState,
  clearErrorState,
  setHasActiveStyles,
  setApiKeyStatus,
  applyGlobalState,
  computeGlobalState,
  initStateSync,
  renderUserMessage,
  renderAssistantMessageContainer,
  addMessageToContainer,
  clearMessages,
  scrollToBottom,
  showEmptyState,
  StreamingTextRenderer,
  createStreamingRenderer,
  // 工具调用卡片导出
  ToolCardManager,
  toolCardManager,
  createToolCard,
  completeToolCard,
  finalizeToolCardGroup,
  createToolCardGroup,
  getToolDisplayName,
  // 操作确认浮层导出
  ConfirmationOverlay,
  confirmationOverlay,
  showConfirmationOverlay,
  hideConfirmationOverlay,
  isConfirmationOverlayVisible,
  getConfirmationOverlay,
  // 错误横幅导出
  showErrorBanner,
  hideErrorBanner
};
