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
  DOM.stopBtn = document.getElementById('stop-btn');
  DOM.inputArea = document.getElementById('input-area');
  DOM.inputWrapper = document.getElementById('input-wrapper');
  
  // 获取技能区 DOM 元素
  DOM.skillArea = document.getElementById('skill-area');
  DOM.skillChips = document.getElementById('skill-chips');
  DOM.skillAreaToggle = document.getElementById('skill-area-toggle');
  
  // 设置初始状态
  updateStatusIndicator('idle');
  updateTopBarDisplay('--', '新会话');
  
  // 绑定顶栏交互事件
  bindTopBarEvents();
  
  // 初始化输入区
  initInputArea();
  
  // 初始化技能快捷区
  initSkillArea();
  
  // 显示空状态
  showEmptyState();
  
  // TODO: 后续任务实现完整主界面逻辑
  // - 获取当前 Tab 域名
  // - 加载/创建会话
  // - 绑定消息发送事件
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
 */
function handleSendClick() {
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
  
  // TODO: 触发 Agent Loop 发送消息
  // 这里需要后续任务 T140 实现完整的消息发送流程
  // 目前先清空输入框并切换到处理中状态（演示用）
  DOM.messageInput.value = '';
  
  // 演示：切换到处理中状态
  // updateInputAreaState('processing');
  // updateStatusIndicator('running');
  
  // 演示：3秒后恢复空闲态
  // setTimeout(() => {
  //   updateInputAreaState('idle');
  //   updateStatusIndicator('idle');
  // }, 3000);
}

/**
 * 处理停止按钮点击
 */
function handleStopClick() {
  console.log('[Panel] Stop button clicked');
  
  // TODO: 调用 cancelAgentLoop 取消当前处理
  // 这里需要后续任务 T141 实现
  // cancelAgentLoop();
  
  // 演示：立即恢复空闲态
  updateInputAreaState('idle');
  updateStatusIndicator('idle');
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

/**
 * 设置受限页面状态
 * @param {boolean} isRestricted - 是否为受限页面
 */
function setRestrictedPageState(isRestricted) {
  AppState.pageStatus = isRestricted ? 'restricted' : 'ready';
  
  if (isRestricted) {
    updateInputAreaState('restricted');
    updateStatusIndicator('restricted');
  } else {
    updateInputAreaState('idle');
    updateStatusIndicator('idle');
  }
}

/**
 * 设置处理中状态
 * @param {boolean} isProcessing - 是否处理中
 */
function setProcessingState(isProcessing) {
  AppState.agentStatus = isProcessing ? 'running' : 'idle';
  
  if (isProcessing) {
    updateInputAreaState('processing');
    updateStatusIndicator('running');
  } else {
    updateInputAreaState('idle');
    updateStatusIndicator('idle');
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

export { 
  AppState, 
  switchView, 
  showError, 
  updateStatusIndicator,
  updateInputAreaState,
  setRestrictedPageState,
  setProcessingState,
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
  getConfirmationOverlay
};
