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
 * 应用全局状态
 */
const AppState = {
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
};

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
 */
function initMainView() {
  // 获取 DOM 元素
  DOM.statusDot = document.getElementById('status-dot');
  DOM.currentDomain = document.getElementById('current-domain');
  DOM.sessionTitle = document.getElementById('session-title');
  DOM.messagesContainer = document.getElementById('messages-container');
  DOM.messageInput = document.getElementById('message-input');
  DOM.sendBtn = document.getElementById('send-btn');
  
  // 获取技能区 DOM 元素
  DOM.skillArea = document.getElementById('skill-area');
  DOM.skillChips = document.getElementById('skill-chips');
  DOM.skillAreaToggle = document.getElementById('skill-area-toggle');
  
  // 设置初始状态
  updateStatusIndicator('idle');
  updateTopBarDisplay('--', '新会话');
  
  // 绑定顶栏交互事件
  bindTopBarEvents();
  
  // 初始化技能快捷区
  initSkillArea();
  
  // TODO: 后续任务实现完整主界面逻辑
  // - 获取当前 Tab 域名
  // - 加载/创建会话
  // - 绑定消息发送事件
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
  
  chip.addEventListener('click', () => handleSkillChipClick({
    id: skill.id,
    name: skill.name,
    type: 'user',
    prompt
  }));
  
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
 * Fills the input with skill prompt (user can edit before sending)
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
  DOM.messageInput.focus();
  
  // Move cursor to end
  DOM.messageInput.setSelectionRange(
    DOM.messageInput.value.length,
    DOM.messageInput.value.length
  );
  
  console.log('[Panel] Skill chip clicked:', skill.name);
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
  
  // 设置按钮
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      initSettingsView();
      switchView('settings');
    });
  }
}

/**
 * 切换会话列表面板
 */
function toggleSessionList() {
  const panel = document.getElementById('session-list-panel');
  if (!panel) return;
  
  panel.classList.toggle('hidden');
}

/**
 * 更新顶栏显示内容
 * @param {string} domain - 当前域名
 * @param {string} title - 会话标题
 */
function updateTopBarDisplay(domain, title) {
  if (DOM.currentDomain) {
    DOM.currentDomain.textContent = domain || '--';
  }
  if (DOM.sessionTitle) {
    DOM.sessionTitle.textContent = title || '新会话';
  }
}

/**
 * 更新状态指示灯
 * @param {'idle' | 'running' | 'error' | 'restricted'} status - 状态
 */
function updateStatusIndicator(status) {
  const dot = DOM.statusDot?.querySelector('.dot');
  if (!dot) return;
  
  // 移除所有状态类
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
    default:
      dot.classList.add('ready');
  }
  
  AppState.agentStatus = status;
}

// ============================================================================
// 设置页逻辑
// ============================================================================

/**
 * 初始化设置页
 */
function initSettingsView() {
  // 获取 DOM 元素
  DOM.settingsApiKey = document.getElementById('settings-api-key');
  DOM.settingsApiBase = document.getElementById('settings-api-base');
  DOM.settingsModel = document.getElementById('settings-model');
  DOM.verifyConnectionBtn = document.getElementById('verify-connection-btn');
  DOM.connectionStatus = document.getElementById('connection-status');
  
  // 返回按钮
  const backBtn = document.getElementById('settings-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => switchView('main'));
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
  
  // 加载当前设置
  loadCurrentSettings();
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

// ============================================================================
// 初始化
// ============================================================================

/**
 * 应用初始化入口
 */
async function init() {
  console.log('[Panel] Initializing...');
  
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
  
  // 检测是否需要显示引导页
  try {
    const { needsSetup } = await checkFirstRun();
    
    if (needsSetup) {
      // 首次使用，显示引导页
      console.log('[Panel] First run detected, showing onboarding');
      initOnboarding();
      switchView('onboarding');
      AppState.apiKeyStatus = 'missing';
    } else {
      // 已有配置，进入主界面
      console.log('[Panel] Existing settings found, entering main view');
      AppState.apiKeyStatus = 'valid';
      initMainView();
      switchView('main');
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
  bubbleDiv.className = 'message-bubble';
  
  messageDiv.appendChild(bubbleDiv);
  return messageDiv;
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
 * 滚动对话区到底部
 */
function scrollToBottom() {
  if (DOM.messagesContainer) {
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  }
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

// ============================================================================
// 导出供其他模块使用（可选）
// ============================================================================

export { 
  AppState, 
  switchView, 
  showError, 
  updateStatusIndicator,
  renderUserMessage,
  renderAssistantMessageContainer,
  addMessageToContainer,
  clearMessages,
  scrollToBottom,
  showEmptyState
};
