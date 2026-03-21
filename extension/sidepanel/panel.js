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
	DEFAULT_API_BASE,
	DEFAULT_MODEL,
	getSettings,
	normalizeApiBase,
	saveSettings,
	validateConnection,
} from "./api.js";
import {
	applyTranslations,
	formatMessage,
	getLocale,
	getMessage,
	getUILanguage,
	isChineseLanguage,
} from "./i18n.js";
import { runGetUserProfile, runUpdateUserProfile } from "./profile.js";
import { SkillLoader } from "./skill-loader.js";
import { StyleSkillStore } from "./style-skill.js";

// ============================================================================
// Icon Utility — Iconify 图标辅助函数
// ============================================================================

/**
 * 生成 Iconify 图标的 HTML 字符串
 * 使用 CSS mask-image 方案，颜色继承 currentColor
 * @param {string} name - 图标名称，对应 CSS 类 .icon-{name}
 * @param {number} size - 图标尺寸（px）
 * @param {string} [extraClass] - 额外的 CSS 类名
 * @returns {string} 图标 HTML 字符串
 */
function iconHtml(name, size, extraClass = "") {
	const cls = extraClass ? ` ${extraClass}` : "";
	return `<span class="icon icon-${name}${cls}" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
}

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
	modelInput: null,
	startBtn: null,
	setupError: null,

	// Main view elements
	statusDot: null,
	currentDomain: null,
	sessionTitle: null,
	chatArea: null, // 滚动容器（实际可滚动区域）
	messagesContainer: null, // 消息内容容器
	messageInput: null,
	sendBtn: null,
	stopBtn: null,
	inputArea: null,
	inputWrapper: null,
	typewriterPlaceholder: null,
	typewriterText: null,

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
	settingsVisionApiKey: null,
	settingsVisionApiBase: null,
	settingsVisionModel: null,
	settingsUserProfile: null,
	profileCharCount: null,
	saveProfileBtn: null,
	profileStatus: null,
	verifyConnectionBtn: null,
	connectionStatus: null,

	// Element picker
	pickerBtn: null,
	pickedElementBar: null,
	pickedElementLabel: null,
	pickedElementClear: null,

	// Image upload
	imageUploadBtn: null,
	imageUploadInput: null,
	attachedImagesBar: null,
	attachedImagesContainer: null,
	attachedImagesClear: null,

	// Element picker
	pickerBtn: null,
	pickedElementBar: null,
	pickedElementLabel: null,
	pickedElementClear: null,

	// Other
	loadingOverlay: null,
	errorToast: null,
	errorMessage: null,
};

// ============================================================================
// 打字机效果管理器
// ============================================================================

/**
 * 打字机效果管理器
 * 在输入框中显示循环滚动的示例文本
 */
class TypewriterEffect {
	constructor() {
		this.textElement = null;
		this.placeholderElement = null;
		this.inputElement = null;
		// Typewriter examples - localizedi18n
		this.examples = this.getLocalizedExamples();
		this.currentIndex = 0;
		this.currentText = "";
		this.isTyping = false;
		this.isDeleting = false;
		this.isPaused = false;
		this.timeoutId = null;
		this.typeSpeed = 60; // 打字速度 (ms)
		this.deleteSpeed = 30; // 删除速度 (ms)
		this.pauseDelay = 2000; // 完成后暂停时间 (ms)
		this.switchDelay = 500; // 切换示例前的暂停时间 (ms)
	}

	/**
	 * Get localized typewriter examples
	 * @returns {string[]}
	 */
	getLocalizedExamples() {
		return [
			getMessage("typingExample1"),
			getMessage("typingExample2"),
			getMessage("typingExample3"),
			getMessage("typingExample4"),
		];
	}

	/**
	 * 初始化打字机效果
	 * @param {HTMLElement} textElement - 显示文本的元素
	 * @param {HTMLElement} placeholderElement - 占位符容器元素
	 * @param {HTMLTextAreaElement} inputElement - 输入框元素
	 */
	init(textElement, placeholderElement, inputElement) {
		this.textElement = textElement;
		this.placeholderElement = placeholderElement;
		this.inputElement = inputElement;

		if (!this.textElement || !this.placeholderElement || !this.inputElement) {
			console.warn("[TypewriterEffect] " + getMessage("typewriterNothing"));
			return;
		}

		// 监听输入框的 focus/blur 事件
		this.inputElement.addEventListener("focus", () => this.hide());
		this.inputElement.addEventListener("blur", () => this.checkShow());

		// 监听输入框的内容变化
		this.inputElement.addEventListener("input", () => this.checkShow());

		// 开始打字机效果
		this.start();
	}

	/**
	 * 开始打字机效果
	 */
	start() {
		if (!this.textElement || this.isPaused) return;
		this.isTyping = true;
		this.type();
	}

	/**
	 * 停止打字机效果
	 */
	stop() {
		this.isTyping = false;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}

	/**
	 * 显示打字机效果
	 */
	show() {
		if (this.placeholderElement) {
			this.placeholderElement.classList.remove("hidden");
		}
		this.isPaused = false;
		this.start();
	}

	/**
	 * 隐藏打字机效果
	 */
	hide() {
		if (this.placeholderElement) {
			this.placeholderElement.classList.add("hidden");
		}
		this.stop();
	}

	/**
	 * 检查是否应该显示打字机效果
	 */
	checkShow() {
		const shouldShow = !this.isFocused() && this.isEmpty();
		if (shouldShow) {
			this.show();
		} else {
			this.hide();
		}
	}

	/**
	 * 检查输入框是否聚焦
	 */
	isFocused() {
		return document.activeElement === this.inputElement;
	}

	/**
	 * 检查输入框是否为空
	 */
	isEmpty() {
		return this.inputElement && this.inputElement.value.trim() === "";
	}

	/**
	 * 打字动画核心逻辑
	 */
	type() {
		if (!this.isTyping || this.isPaused) return;

		const currentExample = this.examples[this.currentIndex];

		if (this.isDeleting) {
			// 删除模式：从后向前逐字删除
			this.currentText = currentExample.substring(
				0,
				this.currentText.length - 1,
			);
			this.textElement.textContent = this.currentText;

			if (this.currentText === "") {
				// 删除完成，切换到下一个示例
				this.isDeleting = false;
				this.currentIndex = (this.currentIndex + 1) % this.examples.length;
				this.timeoutId = setTimeout(() => this.type(), this.switchDelay);
			} else {
				this.timeoutId = setTimeout(() => this.type(), this.deleteSpeed);
			}
		} else {
			// 打字模式：从前向后逐字添加
			this.currentText = currentExample.substring(
				0,
				this.currentText.length + 1,
			);
			this.textElement.textContent = this.currentText;

			if (this.currentText === currentExample) {
				// 当前示例打字完成，暂停后开始删除
				this.timeoutId = setTimeout(() => {
					this.isDeleting = true;
					this.type();
				}, this.pauseDelay);
			} else {
				this.timeoutId = setTimeout(() => this.type(), this.typeSpeed);
			}
		}
	}
}

// 创建全局打字机效果实例
const typewriterEffect = new TypewriterEffect();

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
			currentView: "onboarding",

			/** Agent 状态: 'idle' | 'running' | 'error' | 'restricted' */
			agentStatus: "idle",

			/** API Key 状态: 'valid' | 'invalid' | 'missing' */
			apiKeyStatus: "missing",

			/** 页面状态: 'ready' | 'restricted' */
			pageStatus: "ready",

			/** 当前域名 */
			currentDomain: null,

			/** 当前会话 ID */
			currentSessionId: null,

			/** 是否有样式生效 */
			hasActiveStyles: false,

			/** 存储空间警告: 'none' | 'warning' | 'critical' */
			storageWarning: "none",

			/** 当前错误类型: null | 'API_KEY_INVALID' | 'NETWORK_ERROR' | 'API_ERROR' */
			currentError: null,

			/** 会话是否已开始对话（用于控制技能区显示） */
			hasConversationStarted: false,
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
			keyListeners.forEach((listener) => {
				try {
					listener(value, oldValue, key);
				} catch (err) {
					console.error("[StateManager] Listener error:", err);
				}
			});
		}

		// 触发全局监听器
		this._globalListeners.forEach((listener) => {
			try {
				listener(key, value, oldValue);
			} catch (err) {
				console.error("[StateManager] Global listener error:", err);
			}
		});

		console.log(
			`[StateManager] State changed: ${key} = ${JSON.stringify(value)}`,
		);
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
 * 当前选中的元素信息（由元素选择器设置）
 * 存在时会作为上下文注入到 agentLoop 的 prompt 中
 * @type {Object|null}
 */
let _pickedElementInfo = null;

/**
 * 元素选择器是否处于激活状态
 * @type {boolean}
 */
let _pickerActive = false;

/**
 * 当前附加的图片列表
 * 每个图片对象包含: { file, dataUrl, preview }
 * @type {Array<Object>}
 */
let _attachedImages = [];

/**
 * 兼容旧代码的 AppState 对象
 * 通过 Proxy 实现与 stateManager 的双向同步
 */
const AppState = new Proxy(
	{},
	{
		get(target, prop) {
			return stateManager.get(prop);
		},
		set(target, prop, value) {
			stateManager.set(prop, value);
			return true;
		},
	},
);

// ============================================================================
// 视图切换
// ============================================================================

/**
 * 切换视图
 * @param {'onboarding' | 'main' | 'settings'} viewName - 目标视图名称
 */
function switchView(viewName) {
	// 隐藏所有视图
	DOM.onboardingView.classList.add("hidden");
	DOM.mainView.classList.add("hidden");
	DOM.settingsView.classList.add("hidden");

	// 显示目标视图
	switch (viewName) {
		case "onboarding":
			DOM.onboardingView.classList.remove("hidden");
			break;
		case "main":
			DOM.mainView.classList.remove("hidden");
			break;
		case "settings":
			DOM.settingsView.classList.remove("hidden");
			break;
		default:
			console.error("[Panel] Unknown view:", viewName);
			return;
	}

	AppState.currentView = viewName;
	console.log("[Panel] Switched to view:", viewName);
}

/**
 * 显示加载状态
 * @param {boolean} show - 是否显示
 */
function showLoading(show) {
	if (show) {
		DOM.loadingOverlay.classList.remove("hidden");
	} else {
		DOM.loadingOverlay.classList.add("hidden");
	}
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 * @param {number} duration - 显示时长(ms)，默认 5000ms
 */
function showError(message, duration = 5000) {
	DOM.errorMessage.textContent = message;
	DOM.errorToast.classList.remove("hidden");

	// 自动隐藏
	setTimeout(() => {
		DOM.errorToast.classList.add("hidden");
	}, duration);
}

/**
 * 隐藏错误提示
 */
function hideError() {
	DOM.errorToast.classList.add("hidden");
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
		topBar: { status: "idle" },
		chatArea: { mode: "normal" },
		inputArea: { mode: "idle" },
		skillArea: { mode: "normal" },
		errorBanner: { show: false },
	},

	/**
	 * 处理中状态
	 * - 顶栏：🟡 黄色 + 脉动动画
	 * - 对话区：流式输出 + 工具卡片
	 * - 输入区：可输入（支持排队消息），停止按钮可见
	 * - 技能区：正常但不可点击
	 */
	processing: {
		topBar: { status: "running" },
		chatArea: { mode: "streaming" },
		inputArea: { mode: "queuing" }, // 新模式：允许用户排队消息
		skillArea: { mode: "disabled" },
		errorBanner: { show: false },
	},

	/**
	 * 有样式生效状态
	 * - 顶栏：🟢 绿色
	 * - 对话区：正常
	 * - 输入区：正常 + 样式应用后浮层
	 * - 技能区：正常
	 */
	hasStyles: {
		topBar: { status: "idle" },
		chatArea: { mode: "normal" },
		inputArea: { mode: "idle" },
		skillArea: { mode: "normal" },
		errorBanner: { show: false },
	},

	/**
	 * API Key 缺失状态
	 * - 顶栏：🔴 红色
	 * - 其他区域：不显示（引导页）
	 */
	apiKeyMissing: {
		topBar: { status: "error" },
		chatArea: { mode: "hidden" },
		inputArea: { mode: "hidden" },
		skillArea: { mode: "hidden" },
		errorBanner: { show: false },
	},

	/**
	 * API Key 无效状态
	 * - 顶栏：🔴 红色
	 * - 对话区：顶部错误横幅
	 * - 输入区：可输入
	 * - 技能区：正常
	 */
	apiKeyInvalid: {
		topBar: { status: "error" },
		chatArea: { mode: "normal" },
		inputArea: { mode: "idle" },
		skillArea: { mode: "normal" },
		errorBanner: { show: true, type: "API_KEY_INVALID" },
	},

	/**
	 * 网络错误状态
	 * - 顶栏：🔴 红色
	 * - 对话区：顶部错误横幅 + 重试按钮
	 * - 输入区：可输入
	 * - 技能区：正常
	 */
	networkError: {
		topBar: { status: "error" },
		chatArea: { mode: "normal" },
		inputArea: { mode: "idle" },
		skillArea: { mode: "normal" },
		errorBanner: { show: true, type: "NETWORK_ERROR" },
	},

	/**
	 * API 错误状态
	 * - 顶栏：🔴 红色
	 * - 对话区：顶部错误横幅 + 重试按钮
	 * - 输入区：可输入
	 * - 技能区：正常
	 */
	apiError: {
		topBar: { status: "error" },
		chatArea: { mode: "normal" },
		inputArea: { mode: "idle" },
		skillArea: { mode: "normal" },
		errorBanner: { show: true, type: "API_ERROR" },
	},

	/**
	 * 受限页面状态
	 * - 顶栏：⚪ 灰色
	 * - 对话区：居中提示
	 * - 输入区：整体置灰禁用
	 * - 技能区：整体置灰禁用
	 */
	restricted: {
		topBar: { status: "restricted" },
		chatArea: { mode: "restricted" },
		inputArea: { mode: "restricted" },
		skillArea: { mode: "disabled" },
		errorBanner: { show: false },
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
		errorBanner: { inherit: true },
	},
};

/**
 * 计算当前全局状态
 * 根据各子状态综合计算最终的全局状态
 * @returns {string} 全局状态名称
 */
function computeGlobalState() {
	const agentStatus = stateManager.get("agentStatus");
	const apiKeyStatus = stateManager.get("apiKeyStatus");
	const pageStatus = stateManager.get("pageStatus");
	const hasActiveStyles = stateManager.get("hasActiveStyles");
	const currentError = stateManager.get("currentError");

	// 优先级：受限页面 > API Key 缺失 > 处理中 > 错误 > 有样式 > 就绪

	// 1. 受限页面
	if (pageStatus === "restricted") {
		return "restricted";
	}

	// 2. API Key 缺失（显示引导页）
	if (apiKeyStatus === "missing") {
		return "apiKeyMissing";
	}

	// 3. 处理中
	if (agentStatus === "running") {
		return "processing";
	}

	// 4. 错误状态
	if (currentError) {
		switch (currentError) {
			case "API_KEY_INVALID":
				return "apiKeyInvalid";
			case "NETWORK_ERROR":
				return "networkError";
			case "API_ERROR":
				return "apiError";
		}
	}

	// 5. 有样式生效
	if (hasActiveStyles) {
		return "hasStyles";
	}

	// 6. 就绪状态
	return "ready";
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
		console.error("[Panel] Unknown global state:", globalState);
		return;
	}

	console.log("[Panel] Applying global state:", globalState);

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

	const dot = DOM.statusDot.querySelector(".dot");
	if (!dot) return;

	// 更新状态指示灯颜色
	dot.classList.remove("ready", "processing", "error", "restricted");

	switch (config.status) {
		case "idle":
			dot.classList.add("ready");
			break;
		case "running":
			dot.classList.add("processing");
			break;
		case "error":
			dot.classList.add("error");
			break;
		case "restricted":
			dot.classList.add("restricted");
			break;
	}
}

/**
 * 更新顶栏显示
 * @param {string} domain - 当前域名
 * @param {string} title - 会话标题
 */
function updateTopBarDisplay(domain, title) {
	const domainEl = document.getElementById("current-domain");
	const titleEl = document.getElementById("session-title");

	if (domainEl) {
		domainEl.textContent = domain || "--";
	}

	if (titleEl) {
		titleEl.textContent = title || getMessage("newSession");
	}
}

/**
 * 应用对话区状态
 * @param {Object} config - 对话区配置
 */
function applyChatAreaState(config) {
	if (!DOM.messagesContainer) return;

	// 移除所有状态类
	DOM.messagesContainer.classList.remove("restricted-mode", "hidden");

	switch (config.mode) {
		case "normal": {
			// 正常模式
			// 移除受限提示（如果存在）
			const restrictedTip =
				DOM.messagesContainer.querySelector(".restricted-tip");
			if (restrictedTip) {
				restrictedTip.remove();
			}
			break;
		}

		case "streaming":
			// 流式输出模式（由 Agent Loop 控制）
			break;

		case "restricted": {
			// 受限页面模式：居中提示
			DOM.messagesContainer.classList.add("restricted-mode");

			// 清空并显示受限提示
			DOM.messagesContainer.innerHTML = "";
			const tip = document.createElement("div");
			tip.className = "restricted-tip";
			tip.innerHTML = `
        <div class="restricted-icon">${iconHtml("lock", 48)}</div>
        <div class="restricted-title">此页面不支持样式修改</div>
        <div class="restricted-desc">Chrome 扩展无法操作浏览器内部页面（chrome://、扩展商店等）</div>
      `;
			DOM.messagesContainer.appendChild(tip);
			break;
		}

		case "hidden":
			// 隐藏模式（引导页时）
			DOM.messagesContainer.classList.add("hidden");
			break;
	}
}

/**
 * 应用输入区状态
 * @param {Object} config - 输入区配置
 */
function applyInputAreaState(config) {
	if (!DOM.inputArea || !DOM.messageInput || !DOM.sendBtn || !DOM.stopBtn)
		return;

	// 移除所有状态类
	DOM.inputArea.classList.remove("processing", "restricted", "hidden", "queuing");
	DOM.sendBtn.classList.remove("hidden");
	DOM.stopBtn.classList.add("hidden");

	switch (config.mode) {
		case "idle":
			// 空闲态：输入框可用 + 发送按钮
			DOM.messageInput.disabled = false;
			DOM.messageInput.placeholder = "";
			// 恢复打字机效果显示（如果输入框为空且未聚焦）
			typewriterEffect.checkShow();
			break;

		case "queuing":
			// 排队态（Agent运行中）：输入框可用 + 发送按钮 + 停止按钮
			// 用户可以发送消息，消息会被排队到下一轮迭代
			DOM.inputArea.classList.add("queuing");
			DOM.messageInput.disabled = false;
			DOM.messageInput.placeholder = "";
			DOM.sendBtn.classList.remove("hidden");
			DOM.stopBtn.classList.remove("hidden"); // 同时显示停止按钮
			typewriterEffect.hide();
			break;

		case "processing":
			// 处理中（传统模式，暂不使用）：输入框禁用 + 停止按钮
			DOM.inputArea.classList.add("processing");
			DOM.messageInput.disabled = true;
			DOM.messageInput.placeholder = getMessage("processing");
			DOM.sendBtn.classList.add("hidden");
			DOM.stopBtn.classList.remove("hidden");
			// Agent 运行时隐藏打字机效果
			typewriterEffect.hide();
			break;

		case "restricted":
			// 受限页面：整体置灰 + 提示
			DOM.inputArea.classList.add("restricted");
			DOM.messageInput.disabled = true;
			DOM.messageInput.placeholder = getMessage("restrictedPage");
			DOM.messageInput.value = "";
			DOM.sendBtn.disabled = true;
			// 受限页面隐藏打字机效果
			typewriterEffect.hide();
			break;

		case "hidden":
			// 隐藏模式（引导页时）
			DOM.inputArea.classList.add("hidden");
			break;
	}
}

/**
 * 应用技能区状态
 * @param {Object} config - 技能区配置
 */
function applySkillAreaState(config) {
	if (!DOM.skillArea) return;

	// 检查会话是否已开始对话
	// 如果已开始对话，技能区应始终隐藏（仅新会话显示）
	const hasConversationStarted = stateManager.get("hasConversationStarted");
	if (hasConversationStarted) {
		DOM.skillArea.classList.add("hidden");
		DOM.skillArea.classList.remove("disabled");
		return;
	}

	// 移除所有状态类
	DOM.skillArea.classList.remove("disabled", "hidden");

	switch (config.mode) {
		case "normal":
			// 正常模式：可点击
			DOM.skillArea.style.pointerEvents = "";
			DOM.skillArea.style.opacity = "";
			break;

		case "disabled":
			// 禁用模式：置灰不可点击
			DOM.skillArea.classList.add("disabled");
			DOM.skillArea.style.pointerEvents = "none";
			DOM.skillArea.style.opacity = "0.5";
			break;

		case "hidden":
			// 隐藏模式
			DOM.skillArea.classList.add("hidden");
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
	stateManager.set("agentStatus", isProcessing ? "running" : "idle");
	stateManager.set("currentError", null); // 清除错误
	applyGlobalState();
}

/**
 * 设置受限页面状态（便捷方法）
 * @param {boolean} isRestricted - 是否为受限页面
 */
function setRestrictedPageState(isRestricted) {
	stateManager.set("pageStatus", isRestricted ? "restricted" : "ready");
	applyGlobalState();
}

/**
 * 设置错误状态（便捷方法）
 * @param {string|null} errorType - 错误类型：'API_KEY_INVALID' | 'NETWORK_ERROR' | 'API_ERROR' | null
 */
function setErrorState(errorType) {
	stateManager.set("currentError", errorType);
	if (errorType) {
		stateManager.set("agentStatus", "error");
	}
	applyGlobalState();
}

/**
 * 清除错误状态
 */
function clearErrorState() {
	stateManager.set("currentError", null);
	if (stateManager.get("agentStatus") === "error") {
		stateManager.set("agentStatus", "idle");
	}
	applyGlobalState();
}

/**
 * 设置样式生效状态
 * @param {boolean} hasStyles - 是否有样式生效
 */
function setHasActiveStyles(hasStyles) {
	stateManager.set("hasActiveStyles", hasStyles);
	applyGlobalState();
}

/**
 * 设置 API Key 状态
 * @param {string} status - API Key 状态：'valid' | 'invalid' | 'missing'
 */
function setApiKeyStatus(status) {
	stateManager.set("apiKeyStatus", status);
	applyGlobalState();
}

/**
 * 初始化状态联动
 * 设置状态变化监听器
 */
function initStateSync() {
	// 监听关键状态变化，自动应用全局状态
	const watchedKeys = [
		"agentStatus",
		"apiKeyStatus",
		"pageStatus",
		"hasActiveStyles",
		"currentError",
	];

	watchedKeys.forEach((key) => {
		stateManager.subscribe(key, () => {
			applyGlobalState();
		});
	});

	console.log("[Panel] State sync initialized");
}

// ============================================================================
// 引导页逻辑
// ============================================================================

/**
 * 初始化引导页
 */
function initOnboarding() {
	// 获取 DOM 元素
	DOM.apiKeyInput = document.getElementById("api-key-input");
	DOM.apiBaseInput = document.getElementById("api-base-input");
	DOM.modelInput = document.getElementById("model-input");
	DOM.startBtn = document.getElementById("start-btn");
	DOM.setupError = document.getElementById("setup-error");

	// 监听输入变化
	DOM.apiKeyInput.addEventListener("input", validateOnboardingForm);
	DOM.apiBaseInput.addEventListener("input", validateOnboardingForm);
	DOM.modelInput.addEventListener("input", validateOnboardingForm);

	// 监听开始按钮
	DOM.startBtn.addEventListener("click", handleStartClick);

	// 设置默认值
	DOM.apiBaseInput.value = DEFAULT_API_BASE;
	DOM.modelInput.value = DEFAULT_MODEL;

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
	DOM.setupError.classList.remove("hidden");
}

/**
 * 隐藏引导页错误
 */
function hideSetupError() {
	DOM.setupError.classList.add("hidden");
}

/**
 * 处理开始按钮点击
 */
async function handleStartClick() {
	const apiKey = DOM.apiKeyInput.value.trim();
	let apiBase = DOM.apiBaseInput.value.trim();
	let model = DOM.modelInput.value.trim();

	// 基本验证
	if (!apiKey) {
		showSetupError(getMessage("enterApiKey"));
		return;
	}

	// 如果 API 地址为空，使用默认值
	if (!apiBase) {
		apiBase = DEFAULT_API_BASE;
	}

	// 如果模型为空，使用默认值
	if (!model) {
		model = DEFAULT_MODEL;
	}

	// 规范化 API 地址（移除多余路径）
	apiBase = normalizeApiBase(apiBase);

	// 验证 URL 格式
	try {
		new URL(apiBase);
	} catch {
		showSetupError(getMessage("apiAddressFormatError"));
		return;
	}

	// 显示加载状态
	showLoading(true);
	DOM.startBtn.disabled = true;
	hideSetupError();

	try {
		// 验证连接
		const result = await validateConnection(apiKey, apiBase, model);

		if (!result.ok) {
			// 连接失败
			let errorMsg = getMessage("connectionVerifyFailed");

			if (result.error) {
				// 网络错误
				errorMsg = `连接失败: ${result.error}`;
			} else if (result.status === 401) {
				errorMsg = getMessage("apiKeyInvalidPleaseCheck");
			} else if (result.status === 403) {
				errorMsg = getMessage("accessDeniedPleaseCheck");
			} else if (result.status) {
				errorMsg = `连接失败 (HTTP ${result.status})`;
			}

			showSetupError(errorMsg);
			AppState.apiKeyStatus = "invalid";
			return;
		}

		// 连接成功，保存设置
		await saveSettings({ apiKey, apiBase, model });
		AppState.apiKeyStatus = "valid";

		console.log("[Panel] API Key validated and saved");

		// 切换到主界面
		switchView("main");
		initMainView();
	} catch (err) {
		console.error("[Panel] Setup error:", err);
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
 * 动态注入 Content Scripts 到当前标签页
 * 用于处理扩展刷新后已打开页面没有注入脚本的情况
 * @returns {Promise<void>}
 */
async function injectContentScripts() {
	const { getTargetTabId } = await import("./tools.js");
	const tabId = await getTargetTabId();

	// Content Scripts 配置
	const scripts = [
		{ file: "content/early-inject.js", name: "early-inject" },
		{ file: "content/content.js", name: "content-script" },
	];

	console.log(`[Panel] Dynamically injecting content scripts to tab ${tabId}`);

	for (const script of scripts) {
		try {
			await chrome.scripting.executeScript({
				target: { tabId },
				files: [script.file],
			});
			console.log(`[Panel] Injected ${script.name}`);
		} catch (err) {
			// 忽略已注入或无法注入的错误
			if (
				err.message?.includes("Cannot access") ||
				err.message?.includes("Cannot script")
			) {
				throw new Error(`Page not injectable: ${err.message}`);
			}
			console.log(`[Panel] Failed to inject ${script.name}:`, err.message);
		}
	}
}

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
	DOM.statusDot = document.getElementById("status-dot");
	DOM.currentDomain = document.getElementById("current-domain");
	DOM.sessionTitle = document.getElementById("session-title");
	DOM.chatArea = document.getElementById("chat-area"); // 滚动容器
	DOM.messagesContainer = document.getElementById("messages-container");
	DOM.messageInput = document.getElementById("message-input");
	DOM.sendBtn = document.getElementById("send-btn");
	DOM.stopBtn = document.getElementById("stop-btn");
	DOM.inputArea = document.getElementById("input-area");
	DOM.inputWrapper = document.getElementById("input-wrapper");
	DOM.typewriterPlaceholder = document.getElementById("typewriter-placeholder");
	DOM.typewriterText = document.getElementById("typewriter-text");

	// 获取元素选择器 DOM 元素
	DOM.pickerBtn = document.getElementById("picker-btn");
	DOM.pickedElementBar = document.getElementById("picked-element-bar");
	DOM.pickedElementLabel = document.getElementById("picked-element-label");
	DOM.pickedElementClear = document.getElementById("picked-element-clear");

	// 获取图片上传 DOM 元素
	DOM.imageUploadBtn = document.getElementById("image-upload-btn");
	DOM.imageUploadInput = document.getElementById("image-upload-input");
	DOM.attachedImagesBar = document.getElementById("attached-images-bar");
	DOM.attachedImagesContainer = document.getElementById(
		"attached-images-container",
	);
	DOM.attachedImagesClear = document.getElementById("attached-images-clear");

	// 获取技能区 DOM 元素
	DOM.skillArea = document.getElementById("skill-area");
	DOM.skillChips =
		document.getElementById("skill-chips-inner") ||
		document.getElementById("skill-chips");
	DOM.skillAreaToggle = document.getElementById("skill-area-toggle");

	// 获取错误横幅 DOM 元素
	DOM.errorBanner = document.getElementById("error-banner");
	DOM.errorBannerMessage = document.getElementById("error-banner-message");
	DOM.errorBannerAction = document.getElementById("error-banner-action");
	DOM.errorBannerClose = document.getElementById("error-banner-close");

	// 初始化状态同步系统
	initStateSync();

	// 设置初始状态
	stateManager.set("agentStatus", "idle");
	stateManager.set("apiKeyStatus", "valid"); // 进入主界面说明已有有效 Key
	stateManager.set("pageStatus", "ready");

	// 应用初始全局状态
	applyGlobalState();

	// 更新顶栏显示
	updateTopBarDisplay("--", getMessage("newSession"));

	// 绑定顶栏交互事件
	bindTopBarEvents();

	// 初始化错误横幅事件
	initErrorBanner();

	// 绑定新建会话按钮事件
	const newSessionBtn = document.getElementById("new-session-btn");
	if (newSessionBtn) {
		newSessionBtn.addEventListener("click", handleNewSession);
	}

	// 初始化输入区
	initInputArea();

	// 初始化元素选择器
	initElementPicker();

	// 初始化图片上传
	initImageUpload();

	// 初始化技能快捷区
	initSkillArea();

	// 初始化打字机效果
	initTypewriter();

	// 显示空状态（默认）
	showEmptyState();

	// === Step 4: 获取域名 ===
	try {
		const { getTargetDomain, sendToContentScript } = await import("./tools.js");

		// 获取域名（同时检测页面是否受限）
		let domain = null;
		try {
			// 尝试向 Content Script 发送消息获取域名
			domain = await sendToContentScript({ tool: "get_domain" });
		} catch (contentScriptError) {
			// Content Script 不可达，可能是扩展刚刷新导致的
			// 尝试动态注入 Content Script 后重试
			console.log(
				"[Panel] Content Script not reachable, attempting dynamic injection:",
				contentScriptError.message,
			);

			try {
				// 动态注入 Content Scripts
				await injectContentScripts();
				// 重试获取域名
				domain = await sendToContentScript({ tool: "get_domain" });
				console.log("[Panel] Dynamic injection successful, domain:", domain);
			} catch (retryError) {
				// 重试失败，确认为受限页面
				console.log(
					"[Panel] Content Script still not reachable after dynamic injection:",
					retryError.message,
				);
				stateManager.set("pageStatus", "restricted");
				stateManager.set("currentDomain", null);
				applyGlobalState();
				return;
			}
		}

		if (domain && domain !== "unknown") {
			console.log("[Panel] Current domain:", domain);
			stateManager.set("currentDomain", domain);

			// 更新顶栏显示
			updateTopBarDisplay(domain, getMessage("newSession"));

			// === Step 5: 加载会话 ===
			await loadSessionForDomain(domain);
		} else {
			console.warn("[Panel] Failed to get domain");
			// 无法获取域名时，显示空状态
			showEmptyState();
		}
	} catch (err) {
		console.error("[Panel] Failed to get domain or load session:", err);
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
		const session = await import("./session.js");

		// 获取或创建会话
		const sessionId = await session.getOrCreateSession(domain);
		console.log("[Panel] Session loaded:", sessionId);

		// 创建 SessionContext 并设置为当前会话
		const currentSession = new session.SessionContext(domain, sessionId);
		session.setCurrentSession(currentSession);

		// 记录活跃会话（确保下次打开 Side Panel 时恢复到此会话）
		await session.setActiveSession(domain, sessionId);

		// 更新全局状态中的会话 ID
		stateManager.set("currentSessionId", sessionId);

		// 加载会话元数据
		const meta = await session.loadSessionMeta(domain, sessionId);

		// 更新顶栏显示（如果有标题）
		if (meta.title) {
			updateTopBarDisplay(domain, meta.title);
		}

		// 加载会话历史（新格式 { messages, snapshots }）
		const historyData = await session.loadAndPrepareHistory(domain, sessionId);

		if (historyData.messages && historyData.messages.length > 0) {
			renderHistoryMessages(historyData.messages);
			console.log(
				`[Panel] Loaded ${historyData.messages.length} history messages`,
			);
		} else {
			showEmptyState();
		}

		// 加载会话样式到 Content Script（接管 early-inject.js 的样式）
		const stylesKey = currentSession.stylesKey;
		const { [stylesKey]: sessionStyles = "" } =
			await chrome.storage.local.get(stylesKey);

		if (sessionStyles && sessionStyles.trim()) {
			try {
				const { sendToContentScript } = await import("./tools.js");
				await sendToContentScript({
					tool: "load_session_css",
					args: { css: sessionStyles },
				});
			} catch (error) {
				console.warn(
					"[Panel] Failed to load session CSS on init:",
					error.message,
				);
			}
			// 同步 active_styles（确保与当前会话一致）
			await chrome.storage.local.set({
				[currentSession.activeStylesKey]: sessionStyles,
			});
			setHasActiveStyles(true);
		}
	} catch (err) {
		console.error("[Panel] Failed to load session for domain:", domain, err);
		// 失败时显示空状态
		showEmptyState();
	}
}

// ============================================================================
// 输入区逻辑
// ============================================================================

/**
 * 根据内容自动增高输入框（多行友好）
 * 受 CSS min-height / max-height 约束
 */
function resizeMessageInput() {
	const el = DOM.messageInput;
	if (!el) return;

	// 临时设置 overflow-y: hidden 以正确计算 scrollHeight
	el.style.overflowY = "hidden";
	el.style.height = "auto";

	const maxH = 200; // 与 CSS --input-max-height 一致
	const scrollHeight = el.scrollHeight;
	const h = Math.min(Math.max(scrollHeight, 44), maxH);
	el.style.height = `${h}px`;

	// 当内容超出最大高度时，启用滚动条
	if (scrollHeight > maxH) {
		el.style.overflowY = "auto";
	} else {
		el.style.overflowY = "hidden";
	}
}

/**
 * 初始化输入区
 */
function initInputArea() {
	// 绑定发送按钮点击事件
	if (DOM.sendBtn) {
		DOM.sendBtn.addEventListener("click", handleSendClick);
	}

	// 绑定停止按钮点击事件
	if (DOM.stopBtn) {
		DOM.stopBtn.addEventListener("click", handleStopClick);
	}

	if (DOM.messageInput) {
		DOM.messageInput.addEventListener("keydown", handleInputKeydown);
		// 输入时自动增高，便于长文本
		DOM.messageInput.addEventListener("input", resizeMessageInput);
		DOM.messageInput.addEventListener("focus", resizeMessageInput);
	}

	// 初始化为空闲态
	updateInputAreaState("idle");
}

/**
 * 初始化打字机效果
 * 在输入框中显示循环滚动的示例文本
 */
function initTypewriter() {
	if (DOM.typewriterText && DOM.typewriterPlaceholder && DOM.messageInput) {
		typewriterEffect.init(
			DOM.typewriterText,
			DOM.typewriterPlaceholder,
			DOM.messageInput,
		);
	}
}

/**
 * 更新输入区状态
 * @param {'idle' | 'processing' | 'restricted'} state - 状态
 * @deprecated 请使用 setProcessingState / setRestrictedPageState / applyGlobalState
 */
function updateInputAreaState(state) {
	if (!DOM.inputArea || !DOM.messageInput || !DOM.sendBtn || !DOM.stopBtn)
		return;

	// 移除所有状态类
	DOM.inputArea.classList.remove("processing", "restricted");
	DOM.sendBtn.classList.remove("hidden");
	DOM.stopBtn.classList.add("hidden");

	switch (state) {
		case "idle":
			// 空闲态：输入框可用 + 发送按钮
			DOM.messageInput.disabled = false;
			DOM.messageInput.placeholder = "";
			DOM.messageInput.value = "";
			DOM.sendBtn.disabled = false;
			break;

		case "processing":
			// 处理中：输入框禁用 + 停止按钮
			DOM.inputArea.classList.add("processing");
			DOM.messageInput.disabled = true;
			DOM.messageInput.placeholder = getMessage("processing");
			DOM.messageInput.value = "";
			DOM.sendBtn.classList.add("hidden");
			DOM.stopBtn.classList.remove("hidden");
			break;

		case "restricted":
			// 受限页面：整体置灰 + 提示
			DOM.inputArea.classList.add("restricted");
			DOM.messageInput.disabled = true;
			DOM.messageInput.placeholder = getMessage("restrictedPage");
			DOM.messageInput.value = "";
			DOM.sendBtn.disabled = true;
			break;

		default:
			console.warn("[Panel] Unknown input area state:", state);
			return;
	}

	console.log("[Panel] Input area state changed to:", state);
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
		console.log("[Panel] Empty message, ignored");
		return;
	}

	// 禁止在受限页面发送
	if (AppState.pageStatus === "restricted") {
		console.warn("[Panel] Page is restricted, cannot send message");
		return;
	}

	// 如果有选中的元素，将其信息附加到 prompt 中
	let finalMessage = message;
	const pickedInfo = _pickedElementInfo;
	if (pickedInfo) {
		const elementContext = [
			`\n[用户指定元素]`,
			`选择器: ${pickedInfo.fullPath}`,
			`标签: ${pickedInfo.tag}`,
			pickedInfo.id ? `ID: ${pickedInfo.id}` : null,
			pickedInfo.classes.length
				? `Classes: ${pickedInfo.classes.join(" ")}`
				: null,
			pickedInfo.text ? `文本: "${pickedInfo.text}"` : null,
			`尺寸: ${pickedInfo.rect.width}×${pickedInfo.rect.height}`,
		]
			.filter(Boolean)
			.join("\n");
		finalMessage = message + "\n" + elementContext;
		clearPickedElement();
	}

	// 保存图片信息用于显示（在清空前）
	const imagesToSend = [..._attachedImages];
	const hasImages = imagesToSend.length > 0;

	// 如果有图片，构建多模态内容
	let messageContent;
	if (hasImages) {
		// 构建多模态内容数组
		messageContent = [
			{ type: "text", text: finalMessage },
			...imagesToSend.map((img) => ({
				type: "image_url",
				image_url: {
					url: img.dataUrl,
				},
			})),
		];
	} else {
		messageContent = finalMessage;
	}

	// --- 检查 Agent 是否正在运行 ---
	// 如果正在运行，将消息排队到下次迭代注入
	if (AppState.agentStatus === "running") {
		console.log("[Panel] Agent is running, queuing user message for next iteration");

		try {
			// 动态导入 queueUserMessage 函数
			const { queueUserMessage, getPendingMessagesCount } = await import("./agent-loop.js");

			// 排队用户消息
			const queued = queueUserMessage(messageContent);

			if (queued) {
				// 清空输入框并恢复高度
				DOM.messageInput.value = "";
				resizeMessageInput();

				// 清除已附加的图片
				clearAttachedImages();

				// 渲染用户消息气泡（静默排队，不显示额外提示）
				// 使用 finalMessage 作为显示文本（不含排队提示）
				const userMessageEl = renderUserMessage(finalMessage, {
					turn: 0,
					showRewind: false,
				});
				addMessageToContainer(userMessageEl);

				console.log(`[Panel] Message queued successfully.`);
			} else {
				console.warn("[Panel] Failed to queue message");
				showError("无法排队消息，请稍后重试");
			}
		} catch (err) {
			console.error("[Panel] Error queueing message:", err);
			showError("排队消息时出错");
		}
		return;
	}

	// 清空输入框并恢复高度
	DOM.messageInput.value = "";
	resizeMessageInput();

	// 清除已附加的图片
	clearAttachedImages();

	// 隐藏确认浮层（如果有）- 用户发新消息视为隐式确认上一步
	if (isConfirmationOverlayVisible()) {
		hideConfirmationOverlay(false);
	}

	// 移除空状态提示（如果存在）
	const emptyState = DOM.messagesContainer?.querySelector(".chat-area-empty");
	if (emptyState) {
		emptyState.remove();
	}

	// 标记会话已开始对话（技能区将永久隐藏）
	stateManager.set("hasConversationStarted", true);

	// 隐藏技能快捷区（用户开始对话后隐藏）
	setSkillAreaVisible(false);

	// 渲染用户消息气泡（附带元素定位标记和图片指示）
	let displayMessage = pickedInfo
		? `${message}\n${pickedInfo.selector}`
		: message;
	if (hasImages) {
		displayMessage += `\n🖼 ${imagesToSend.length} 张图片`;
	}

	// 计算当前轮次（统计已有的用户文本消息数量 + 1）
	const existingUserMessages =
		DOM.messagesContainer?.querySelectorAll(
			".message-user .message-bubble[data-turn]",
		) || [];
	const currentTurn = existingUserMessages.length + 1;

	const userMessageEl = renderUserMessage(displayMessage, {
		turn: currentTurn,
		showRewind: true,
	});
	addMessageToContainer(userMessageEl);

	// 切换为处理中状态
	setProcessingState(true);

	// 清除上一次的任务列表显示
	todoCardManager.clear();

	// 创建首个助手消息容器（用于流式输出）
	let curAssistantEl = renderAssistantMessageContainer();
	let curBubble = curAssistantEl.querySelector(".message-bubble");
	let curReasoningBlock = curAssistantEl.querySelector(".reasoning-block");
	let curReasoningContentEl =
		curAssistantEl.querySelector(".reasoning-content");
	let curReasoningHeader = curAssistantEl.querySelector(".reasoning-header");
	let curReasoningTitleEl = curAssistantEl.querySelector(".reasoning-title");
	addMessageToContainer(curAssistantEl);

	// 创建流式文本渲染器
	let streamingRenderer = createStreamingRenderer(curBubble);

	// 创建推理内容流式渲染器
	let reasoningRenderer = createStreamingRenderer(curReasoningContentEl, {
		showCursor: true,
		autoScroll: true,
	});
	let reasoningCharCount = 0;

	// 工具输入暂存 Map（toolId -> input），在 showToolResult 时使用
	const toolInputMap = new Map();

	// SubAgent 活动面板 Map（taskToolId -> { panel, toolCardMgr, streamingRenderer, toolInputMap }）
	const subAgentPanelMap = new Map();

	// 样式应用计数器（用于确认浮层）
	let applyStylesCount = 0;

	/**
	 * 结束当前气泡的流式输出，为下一轮 LLM 迭代做准备
	 * 由 onNewIteration 回调调用
	 */
	function finalizeCurrentBubble() {
		if (reasoningCharCount > 0) {
			reasoningRenderer.finish();
			curReasoningBlock.classList.add("finished", "collapsed");
			curReasoningHeader.setAttribute("aria-expanded", "false");
			if (curReasoningTitleEl) {
				curReasoningTitleEl.textContent = formatMessage("thinkingProcess", {
					count: reasoningCharCount,
				});
			}
		}
		streamingRenderer.finish();
		finalizeToolCardGroup();
	}

	/**
	 * 创建新的助手消息气泡，更新所有当前气泡引用
	 * 在 agentLoop 每轮新迭代开始时调用
	 */
	function createNewAssistantBubble() {
		finalizeCurrentBubble();
		curAssistantEl = renderAssistantMessageContainer();
		curBubble = curAssistantEl.querySelector(".message-bubble");
		curReasoningBlock = curAssistantEl.querySelector(".reasoning-block");
		curReasoningContentEl = curAssistantEl.querySelector(".reasoning-content");
		curReasoningHeader = curAssistantEl.querySelector(".reasoning-header");
		curReasoningTitleEl = curAssistantEl.querySelector(".reasoning-title");
		addMessageToContainer(curAssistantEl);
		streamingRenderer = createStreamingRenderer(curBubble);
		reasoningRenderer = createStreamingRenderer(curReasoningContentEl, {
			showCursor: true,
			autoScroll: true,
		});
		reasoningCharCount = 0;
	}

	// 动态导入 agent-loop 模块
	try {
		const { agentLoop, cancelAgentLoop } = await import("./agent-loop.js");

		// UI 回调函数
		const uiCallbacks = {
			/**
			 * 新的 LLM 迭代开始：结束当前气泡，创建新气泡
			 */
			onNewIteration: () => {
				createNewAssistantBubble();
			},

			/**
			 * 追加推理文本（reasoning_content 字段）
			 * @param {string} delta - 推理文本增量
			 */
			appendReasoning: (delta) => {
				if (!delta) return;
				if (reasoningCharCount === 0) {
					curReasoningBlock.classList.add("visible");
				}
				reasoningCharCount += delta.length;
				reasoningRenderer.appendText(delta);
			},

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
				if (block.type === "tool_use") {
					toolInputMap.set(block.id, block.input);
					createToolCard(block.id, block.name);
					if (block.name === "apply_styles" && block.input?.mode === "save") {
						applyStylesCount++;
					}
				}
			},

			/**
			 * 子智能体开始执行时创建内嵌活动面板，返回子 uiCallbacks
			 * @param {string} taskId - Task 工具调用 ID
			 * @param {Object} input - Task 工具输入（含 agent_type、description）
			 * @returns {Object} 子 uiCallbacks
			 */
			onTaskStart: (taskId, input) => {
				const panel = createSubAgentPanel(taskId, input);
				subAgentPanelMap.set(taskId, panel);
				return panel.uiCallbacks;
			},

			/**
			 * 显示工具执行中状态
			 * @param {string} toolName - 工具名称
			 */
			showToolExecuting: (toolName) => {
				console.log("[Panel] Tool executing:", toolName);
			},

			/**
			 * 显示工具执行结果
			 * @param {string} toolId - 工具调用 ID
			 * @param {string} output - 工具输出
			 */
			showToolResult: (toolId, output) => {
				// 如果有对应的子智能体面板，先完成它
				const subPanel = subAgentPanelMap.get(toolId);
				if (subPanel) {
					subPanel.uiCallbacks.finalize();
					subAgentPanelMap.delete(toolId);
				}
				const card = toolCardManager.cardMap.get(toolId);
				const toolName = card?.dataset.toolName || null;
				const toolInput = toolInputMap.get(toolId) ?? null;
				completeToolCard(toolId, toolName, toolInput, output);
			},

			/**
			 * 更新任务列表显示
			 * @param {Array<{id: string, content: string, status: string}>} todos - 任务列表
			 * @param {Object} [meta] - 元信息
			 * @param {boolean} [meta.awaitingConfirmation] - 是否等待用户确认
			 */
			onTodoUpdate: (todos, meta) => {
				todoCardManager.updateTodos(todos, meta?.awaitingConfirmation);
			},
		};

		// 调用 Agent Loop（传递多模态内容）
		const response = await agentLoop(messageContent, uiCallbacks);

		// 完成最后一个气泡的推理流式输出
		if (reasoningCharCount > 0) {
			reasoningRenderer.finish();
			curReasoningBlock.classList.add("finished");
			curReasoningBlock.classList.add("collapsed");
			curReasoningHeader.setAttribute("aria-expanded", "false");
			if (curReasoningTitleEl) {
				curReasoningTitleEl.textContent = formatMessage("thinkingProcess", {
					count: reasoningCharCount,
				});
			}
		}

		// 完成最后一个气泡的流式文本输出
		streamingRenderer.finish();

		// 结束工具卡片组
		finalizeToolCardGroup();

		// 恢复就绪状态
		setProcessingState(false);

		if (applyStylesCount > 0) {
			showConfirmationOverlay({
				applyCount: applyStylesCount,
				onConfirm: () => {
					console.log("[Panel] 样式已确认");
				},
				onUndo: async () => {
					try {
						const { executeTool } = await import("./tools.js");
						await executeTool("apply_styles", { mode: "rollback_last" });
						console.log("[Panel] 已直接撤销最后一步样式");
					} catch (error) {
						console.error("[Panel] 撤销失败:", error);
					}
				},
				onUndoAll: async () => {
					try {
						const { executeTool } = await import("./tools.js");
						await executeTool("apply_styles", { mode: "rollback_all" });
						setHasActiveStyles(false);
						console.log("[Panel] 已直接撤销所有样式");
					} catch (error) {
						console.error("[Panel] 全部撤销失败:", error);
					}
				},
			});
		}

		console.log("[Panel] Agent response:", response);
	} catch (error) {
		console.error("[Panel] Agent loop error:", error);

		// 完成流式输出
		streamingRenderer.finish();

		// 结束工具卡片组
		finalizeToolCardGroup();

		// 恢复就绪状态
		setProcessingState(false);

		// 处理错误类型
		if (error.message?.includes("401") || error.message?.includes("API Key")) {
			setErrorState("API_KEY_INVALID");
			showErrorBanner("API_KEY_INVALID");
		} else if (
			error.message?.includes("network") ||
			error.message?.includes("Network") ||
			error instanceof TypeError
		) {
			setErrorState("NETWORK_ERROR");
			showErrorBanner("NETWORK_ERROR", {
				onRetry: () => {
					// 重新发送消息
					DOM.messageInput.value = message;
					handleSendClick();
				},
			});
		} else {
			setErrorState("API_ERROR");
			showErrorBanner("API_ERROR", {
				customMessage: error.message || "API 调用失败",
				onRetry: () => {
					DOM.messageInput.value = message;
					handleSendClick();
				},
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
	console.log("[Panel] Stop button clicked");

	try {
		// 动态导入 agent-loop 模块
		const { cancelAgentLoop } = await import("./agent-loop.js");

		// 取消 Agent Loop
		cancelAgentLoop();

		// 结束工具卡片组
		finalizeToolCardGroup();

		// 恢复空闲态
		setProcessingState(false);

		console.log("[Panel] Agent loop cancelled");
	} catch (error) {
		console.error("[Panel] Failed to cancel agent loop:", error);

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
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		handleSendClick();
	}
}

// ============================================================================
// 元素选择器逻辑
// ============================================================================

/**
 * 初始化元素选择器
 * 绑定按钮事件和消息监听
 */
function initElementPicker() {
	if (DOM.pickerBtn) {
		DOM.pickerBtn.addEventListener("click", togglePicker);
	}
	if (DOM.pickedElementClear) {
		DOM.pickedElementClear.addEventListener("click", clearPickedElement);
	}

	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === "element_picked") {
			onElementPicked(message.data);
			sendResponse({ ok: true });
		} else if (message.type === "picker_cancelled") {
			setPickerActive(false);
			sendResponse({ ok: true });
		}
		return false;
	});
}

/**
 * 切换元素选择器激活状态
 */
async function togglePicker() {
	if (AppState.agentStatus === "running") return;
	if (AppState.pageStatus === "restricted") return;

	try {
		const { sendToContentScript } = await import("./tools.js");
		if (_pickerActive) {
			await sendToContentScript({ tool: "stop_picker" });
			setPickerActive(false);
		} else {
			await sendToContentScript({ tool: "start_picker" });
			setPickerActive(true);
		}
	} catch (err) {
		console.error("[Panel] Picker toggle failed:", err);
		setPickerActive(false);
	}
}

/**
 * 更新选择器按钮的激活态 UI
 */
function setPickerActive(active) {
	_pickerActive = active;
	if (DOM.pickerBtn) {
		DOM.pickerBtn.classList.toggle("active", active);
	}
}

/**
 * 元素被选中后的回调
 */
function onElementPicked(info) {
	_pickedElementInfo = info;
	setPickerActive(false);

	if (DOM.pickedElementBar && DOM.pickedElementLabel) {
		const label = info.fullPath || info.selector || info.tag;
		DOM.pickedElementLabel.textContent = label;
		DOM.pickedElementLabel.title = label;
		DOM.pickedElementBar.classList.remove("hidden");
	}
}

/**
 * 清除已选中的元素
 */
function clearPickedElement() {
	_pickedElementInfo = null;
	if (DOM.pickedElementBar) {
		DOM.pickedElementBar.classList.add("hidden");
	}
}

/**
 * 获取当前选中的元素信息（供外部模块使用）
 * @returns {Object|null}
 */
function getPickedElementInfo() {
	return _pickedElementInfo;
}

// ============================================================================
// 图片上传逻辑
// ============================================================================

/**
 * 最大图片数量
 * @type {number}
 */
const MAX_ATTACHED_IMAGES = 5;

/**
 * 图片压缩阈值（2MB）
 * 超过此大小的图片将被压缩
 * @type {number}
 */
const IMAGE_COMPRESSION_THRESHOLD = 2 * 1024 * 1024;

/**
 * 压缩图片的最大尺寸（像素）
 * @type {number}
 */
const MAX_IMAGE_DIMENSION = 1920;

/**
 * 压缩图片的质量（0-1）
 * @type {number}
 */
const COMPRESSION_QUALITY = 0.8;

/**
 * 初始化图片上传功能
 * 绑定按钮事件和文件选择
 */
function initImageUpload() {
	if (DOM.imageUploadBtn) {
		DOM.imageUploadBtn.addEventListener("click", () => {
			DOM.imageUploadInput?.click();
		});
	}

	if (DOM.imageUploadInput) {
		DOM.imageUploadInput.addEventListener("change", handleImageSelect);
	}

	if (DOM.attachedImagesClear) {
		DOM.attachedImagesClear.addEventListener("click", clearAttachedImages);
	}

	// 监听粘贴事件（在输入区域或整个文档）
	const pasteTarget = DOM.inputArea || document;
	pasteTarget.addEventListener("paste", handlePaste);
}

/**
 * 处理粘贴事件
 * 从剪贴板提取图片并添加到附件列表
 * @param {ClipboardEvent} event - 粘贴事件
 */
async function handlePaste(event) {
	const items = event.clipboardData?.items;
	if (!items) return;

	// 检查数量限制
	const remaining = MAX_ATTACHED_IMAGES - _attachedImages.length;
	if (remaining <= 0) {
		console.warn("[Panel] Max images reached");
		return;
	}

	let addedCount = 0;

	for (const item of items) {
		// 只处理图片类型
		if (!item.type.startsWith("image/")) continue;
		if (addedCount >= remaining) break;

		const file = item.getAsFile();
		if (!file) continue;

		// 验证文件大小（最大 10MB）
		if (file.size > 10 * 1024 * 1024) {
			console.warn("[Panel] Pasted image too large:", file.size);
			continue;
		}

		try {
			// 读取图片
			let dataUrl = await readFileAsDataURL(file);

			// 如果超过 2MB，进行压缩
			let wasCompressed = false;
			if (file.size > IMAGE_COMPRESSION_THRESHOLD) {
				const result = await compressImage(dataUrl, file.size);
				dataUrl = result.dataUrl;
				wasCompressed = result.wasCompressed;
			}

			_attachedImages.push({
				file,
				dataUrl,
				name: file.name || `粘贴图片 ${_attachedImages.length + 1}`,
				wasCompressed,
			});

			addedCount++;
		} catch (err) {
			console.error("[Panel] Failed to process pasted image:", err);
		}
	}

	// 如果添加了图片，阻止默认行为并更新 UI
	if (addedCount > 0) {
		event.preventDefault();
		renderAttachedImages();
	}
}

/**
 * 处理图片选择
 * @param {Event} event - 文件选择事件
 */
async function handleImageSelect(event) {
	const files = Array.from(event.target.files || []);
	if (!files.length) return;

	// 检查数量限制
	const remaining = MAX_ATTACHED_IMAGES - _attachedImages.length;
	if (remaining <= 0) {
		console.warn("[Panel] Max images reached");
		return;
	}

	const filesToAdd = files.slice(0, remaining);

	for (const file of filesToAdd) {
		// 验证文件类型
		if (!file.type.startsWith("image/")) {
			console.warn("[Panel] Invalid file type:", file.type);
			continue;
		}

		// 验证文件大小（最大 10MB）
		if (file.size > 10 * 1024 * 1024) {
			console.warn("[Panel] Image too large:", file.size);
			continue;
		}

		try {
			// 读取原始图片
			let dataUrl = await readFileAsDataURL(file);

			// 如果超过 2MB，进行压缩
			let wasCompressed = false;
			if (file.size > IMAGE_COMPRESSION_THRESHOLD) {
				const result = await compressImage(dataUrl, file.size);
				dataUrl = result.dataUrl;
				wasCompressed = result.wasCompressed;
			}

			_attachedImages.push({
				file,
				dataUrl,
				name: file.name,
				wasCompressed,
			});
		} catch (err) {
			console.error("[Panel] Failed to read image:", err);
		}
	}

	// 清空 input 以便重复选择同一文件
	event.target.value = "";

	// 更新 UI
	renderAttachedImages();
}

/**
 * 将文件读取为 Data URL
 * @param {File} file - 文件对象
 * @returns {Promise<string>} Data URL
 */
function readFileAsDataURL(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/**
 * 压缩图片
 * 如果图片超过阈值，使用 Canvas 进行压缩
 * @param {string} dataUrl - 原始 Data URL
 * @param {number} originalSize - 原始文件大小（字节）
 * @returns {Promise<{dataUrl: string, wasCompressed: boolean}>} 压缩后的 Data URL 和是否进行了压缩
 */
function compressImage(dataUrl, originalSize) {
	return new Promise((resolve, reject) => {
		// 如果小于阈值，直接返回
		if (originalSize <= IMAGE_COMPRESSION_THRESHOLD) {
			resolve({ dataUrl, wasCompressed: false });
			return;
		}

		const img = new Image();
		img.onload = () => {
			try {
				// 计算压缩后的尺寸
				let width = img.width;
				let height = img.height;

				// 如果尺寸过大，按比例缩小
				if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
					const ratio = Math.min(
						MAX_IMAGE_DIMENSION / width,
						MAX_IMAGE_DIMENSION / height,
					);
					width = Math.round(width * ratio);
					height = Math.round(height * ratio);
				}

				// 创建 Canvas 进行压缩
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;

				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, width, height);

				// 导出为 JPEG 格式（比 PNG 更小）
				const compressedDataUrl = canvas.toDataURL(
					"image/jpeg",
					COMPRESSION_QUALITY,
				);

				console.log(
					`[Panel] Image compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ` +
						`${((compressedDataUrl.length * 0.75) / 1024 / 1024).toFixed(2)}MB`,
				);

				resolve({ dataUrl: compressedDataUrl, wasCompressed: true });
			} catch (err) {
				console.error("[Panel] Compression failed, using original:", err);
				resolve({ dataUrl, wasCompressed: false });
			}
		};

		img.onerror = () => {
			console.error("[Panel] Failed to load image for compression");
			resolve({ dataUrl, wasCompressed: false });
		};

		img.src = dataUrl;
	});
}

/**
 * 渲染已附加的图片预览
 */
function renderAttachedImages() {
	if (!DOM.attachedImagesContainer) return;

	DOM.attachedImagesContainer.innerHTML = "";

	if (_attachedImages.length === 0) {
		DOM.attachedImagesBar?.classList.add("hidden");
		return;
	}

	DOM.attachedImagesBar?.classList.remove("hidden");

	_attachedImages.forEach((img, index) => {
		const item = document.createElement("div");
		item.className = "attached-image-item";

		const preview = document.createElement("img");
		preview.src = img.dataUrl;
		preview.alt = img.name || `图片 ${index + 1}`;
		item.appendChild(preview);

		const removeBtn = document.createElement("button");
		removeBtn.className = "attached-image-remove";
		removeBtn.textContent = "×";
		removeBtn.title = getMessage("removeImage");
		removeBtn.addEventListener("click", () => removeAttachedImage(index));
		item.appendChild(removeBtn);

		DOM.attachedImagesContainer.appendChild(item);
	});
}

/**
 * 移除指定索引的图片
 * @param {number} index - 图片索引
 */
function removeAttachedImage(index) {
	_attachedImages.splice(index, 1);
	renderAttachedImages();
}

/**
 * 清除所有已附加的图片
 */
function clearAttachedImages() {
	_attachedImages = [];
	renderAttachedImages();
}

/**
 * 获取当前附加的图片列表
 * @returns {Array<Object>}
 */
function getAttachedImages() {
	return _attachedImages;
}

/**
 * 检查是否有附加图片
 * @returns {boolean}
 */
function hasAttachedImages() {
	return _attachedImages.length > 0;
}

// ============================================================================
// 技能快捷区逻辑
// ============================================================================

/**
 * Built-in skill definitions
 * These are static skills bundled with the extension
 */
const BUILT_IN_SKILLS = [
	{
		id: "dark-mode-template",
		name: "Dark Mode",
		icon: iconHtml("moon", 14),
		prompt: "Apply dark mode style",
	},
	{
		id: "minimal-template",
		name: "Minimal",
		icon: iconHtml("sparkles", 14),
		prompt: "Apply minimal style",
	},
];

/**
 * Initialize skill chips area
 */
function initSkillArea() {
	// Bind toggle event
	if (DOM.skillAreaToggle) {
		DOM.skillAreaToggle.addEventListener("click", toggleSkillArea);
	}

	// Render skill chips
	renderSkillChips();
}

/**
 * Toggle skill area collapsed state
 */
function toggleSkillArea() {
	if (DOM.skillArea) {
		DOM.skillArea.classList.toggle("collapsed");
	}
}

/**
 * Set skill area visibility
 * Design: Skills area is shown only for new/empty sessions, hidden when agent starts processing
 * @param {boolean} visible - Whether to show the skill area
 */
function setSkillAreaVisible(visible) {
	if (!DOM.skillArea) return;

	if (visible) {
		DOM.skillArea.classList.remove("hidden");
	} else {
		DOM.skillArea.classList.add("hidden");
	}
	console.log(`[Panel] Skill area ${visible ? "shown" : "hidden"}`);
}

/**
 * Storage key for disabled static skills
 */
const DISABLED_SKILLS_KEY = "settings:disabledSkills";

/**
 * Storage key for disabled user skills
 */
const DISABLED_USER_SKILLS_KEY = "settings:disabledUserSkills";

/**
 * Get list of disabled static skill IDs
 * @returns {Promise<string[]>}
 */
async function getDisabledSkills() {
	const { [DISABLED_SKILLS_KEY]: disabled = [] } =
		await chrome.storage.local.get(DISABLED_SKILLS_KEY);
	return disabled;
}

/**
 * Get list of disabled user skill IDs
 * @returns {Promise<string[]>}
 */
async function getDisabledUserSkills() {
	const { [DISABLED_USER_SKILLS_KEY]: disabled = [] } =
		await chrome.storage.local.get(DISABLED_USER_SKILLS_KEY);
	return disabled;
}

/**
 * Toggle a static skill's enabled state
 * @param {string} skillId - Skill ID to toggle
 * @param {boolean} enabled - Whether to enable the skill
 */
async function setSkillEnabled(skillId, enabled) {
	const disabled = await getDisabledSkills();
	if (enabled) {
		// Remove from disabled list
		const filtered = disabled.filter((id) => id !== skillId);
		await chrome.storage.local.set({ [DISABLED_SKILLS_KEY]: filtered });
	} else {
		// Add to disabled list
		if (!disabled.includes(skillId)) {
			disabled.push(skillId);
			await chrome.storage.local.set({ [DISABLED_SKILLS_KEY]: disabled });
		}
	}
}

/**
 * Toggle a user skill's enabled state
 * @param {string} skillId - User skill ID to toggle
 * @param {boolean} enabled - Whether to enable the skill
 */
async function setUserSkillEnabled(skillId, enabled) {
	const disabled = await getDisabledUserSkills();
	if (enabled) {
		// Remove from disabled list
		const filtered = disabled.filter((id) => id !== skillId);
		await chrome.storage.local.set({ [DISABLED_USER_SKILLS_KEY]: filtered });
	} else {
		// Add to disabled list
		if (!disabled.includes(skillId)) {
			disabled.push(skillId);
			await chrome.storage.local.set({ [DISABLED_USER_SKILLS_KEY]: disabled });
		}
	}
}

/**
 * Render skill chips (built-in + user skills)
 * Respects disabled skills setting
 * Recently used skills are shown first
 */
async function renderSkillChips() {
	if (!DOM.skillChips) return;

	// Clear existing chips
	DOM.skillChips.innerHTML = "";

	// Get disabled skills
	const disabledSkills = await getDisabledSkills();
	const disabledUserSkills = await getDisabledUserSkills();

	// Get recently used skills
	const recentSkills = await StyleSkillStore.getRecent();
	const recentIds = new Set(recentSkills.map((r) => r.id));

	// Collect all skills with their recency info
	const allSkillData = [];

	// 1. Collect built-in skills (filter out disabled)
	for (const skill of BUILT_IN_SKILLS) {
		if (disabledSkills.includes(skill.id)) continue;
		const recentInfo = recentSkills.find(
			(r) => r.id === skill.id && r.type === "built-in",
		);
		allSkillData.push({
			skill,
			type: "built-in",
			isRecent: recentIds.has(skill.id),
			timestamp: recentInfo?.timestamp || 0,
		});
	}

	// 2. Collect user skills (filter out disabled)
	try {
		const userSkills = await StyleSkillStore.list();

		for (const skill of userSkills) {
			if (disabledUserSkills.includes(skill.id)) continue;
			const recentInfo = recentSkills.find(
				(r) => r.id === skill.id && r.type === "user",
			);
			allSkillData.push({
				skill,
				type: "user",
				isRecent: recentIds.has(skill.id),
				timestamp: recentInfo?.timestamp || 0,
			});
		}
	} catch (err) {
		console.warn("[Panel] Failed to load user skills:", err);
	}

	// If no skills at all, hide the skill area
	if (allSkillData.length === 0) {
		setSkillAreaVisible(false);
		return;
	}

	// 3. Sort: recently used first (by timestamp desc), then others
	allSkillData.sort((a, b) => {
		// Recent skills first
		if (a.isRecent !== b.isRecent) {
			return a.isRecent ? -1 : 1;
		}
		// Among recent, sort by timestamp desc
		if (a.isRecent && b.isRecent) {
			return b.timestamp - a.timestamp;
		}
		// Non-recent skills: keep original order
		return 0;
	});

	// 4. Render sorted skills
	for (const data of allSkillData) {
		let chip;
		if (data.type === "built-in") {
			chip = createBuiltInChip(data.skill, data.isRecent);
		} else {
			chip = createUserSkillChip(data.skill, data.isRecent);
		}
		DOM.skillChips.appendChild(chip);
	}
}

/**
 * Handle skill chip click - send skill prompt to agent
 * @param {Object} skill - Skill object with id, name, type (built-in/user), prompt
 */
async function handleSkillChipClick(skill) {
	console.log("[Panel] Skill chip clicked:", skill.name);

	// Prevent if agent is already running - queue the skill prompt instead
	if (AppState.agentStatus === "running") {
		console.log("[Panel] Agent is running, queuing skill prompt for next iteration");
		const prompt = skill.prompt || `Apply my "${skill.name}" style`;

		// Queue the skill prompt
		(async () => {
			try {
				const { queueUserMessage } = await import("./agent-loop.js");
				queueUserMessage(prompt);

				// Render user message showing skill name (silently queued)
				const userMessageEl = renderUserMessage(`✨ ${skill.name}`, {
					turn: 0,
					showRewind: false,
				});
				addMessageToContainer(userMessageEl);
			} catch (err) {
				console.error("[Panel] Failed to queue skill:", err);
			}
		})();
		return;
	}

	// Prevent on restricted pages
	if (AppState.pageStatus === "restricted") {
		console.warn("[Panel] Page is restricted, cannot apply skill");
		return;
	}

	const prompt = skill.prompt || `Apply my "${skill.name}" style`;

	// Mark conversation as started
	stateManager.set("hasConversationStarted", true);

	// Hide skill area
	setSkillAreaVisible(false);

	// Remove empty state if exists
	const emptyState = DOM.messagesContainer?.querySelector(".chat-area-empty");
	if (emptyState) {
		emptyState.remove();
	}

	// Render user message showing skill name
	const displayMessage = `✨ ${skill.name}`;
	const userMessageEl = renderUserMessage(displayMessage, {
		turn: 1,
		showRewind: false,
	});
	addMessageToContainer(userMessageEl);

	// Set processing state
	setProcessingState(true);

	// Clear previous todo display
	todoCardManager.clear();

	// Create assistant message bubble for streaming
	let curAssistantEl = renderAssistantMessageContainer();
	let curBubble = curAssistantEl.querySelector(".message-bubble");
	let curReasoningBlock = curAssistantEl.querySelector(".reasoning-block");
	let curReasoningContentEl =
		curAssistantEl.querySelector(".reasoning-content");
	let curReasoningHeader = curAssistantEl.querySelector(".reasoning-header");
	let curReasoningTitleEl = curAssistantEl.querySelector(".reasoning-title");
	addMessageToContainer(curAssistantEl);

	// Create streaming renderer
	let streamingRenderer = createStreamingRenderer(curBubble);
	let reasoningRenderer = createStreamingRenderer(curReasoningContentEl, {
		showCursor: true,
		autoScroll: true,
	});
	let reasoningCharCount = 0;

	// Tool input map for tool cards
	const toolInputMap = new Map();
	const subAgentPanelMap = new Map();
	let applyStylesCount = 0;

	function finalizeCurrentBubble() {
		if (reasoningCharCount > 0) {
			reasoningRenderer.finish();
			curReasoningBlock.classList.add("finished", "collapsed");
			curReasoningHeader.setAttribute("aria-expanded", "false");
			if (curReasoningTitleEl) {
				curReasoningTitleEl.textContent = formatMessage("thinkingProcess", {
					count: reasoningCharCount,
				});
			}
		}
		streamingRenderer.finish();
		finalizeToolCardGroup();
	}

	function createNewAssistantBubble() {
		finalizeCurrentBubble();
		curAssistantEl = renderAssistantMessageContainer();
		curBubble = curAssistantEl.querySelector(".message-bubble");
		curReasoningBlock = curAssistantEl.querySelector(".reasoning-block");
		curReasoningContentEl = curAssistantEl.querySelector(".reasoning-content");
		curReasoningHeader = curAssistantEl.querySelector(".reasoning-header");
		curReasoningTitleEl = curAssistantEl.querySelector(".reasoning-title");
		addMessageToContainer(curAssistantEl);
		streamingRenderer = createStreamingRenderer(curBubble);
		reasoningRenderer = createStreamingRenderer(curReasoningContentEl, {
			showCursor: true,
			autoScroll: true,
		});
		reasoningCharCount = 0;
	}

	try {
		const { agentLoop, cancelAgentLoop } = await import("./agent-loop.js");

		// Record skill as recently used
		await StyleSkillStore.recordUsage(skill.id, skill.type);

		const uiCallbacks = {
			onNewIteration: () => {
				createNewAssistantBubble();
			},
			appendReasoning: (delta) => {
				if (!delta) return;
				if (reasoningCharCount === 0) {
					curReasoningBlock.classList.add("visible");
				}
				reasoningCharCount += delta.length;
				reasoningRenderer.appendText(delta);
			},
			appendText: (delta) => {
				streamingRenderer.appendText(delta);
			},
			showToolCall: (block) => {
				if (block.type === "tool_use") {
					toolInputMap.set(block.id, block.input);
					createToolCard(block.id, block.name);
					if (block.name === "apply_styles" && block.input?.mode === "save") {
						applyStylesCount++;
					}
				}
			},

			/**
			 * 子智能体开始执行时创建内嵌活动面板，返回子 uiCallbacks
			 */
			onTaskStart: (taskId, input) => {
				const panel = createSubAgentPanel(taskId, input);
				subAgentPanelMap.set(taskId, panel);
				return panel.uiCallbacks;
			},

			/**
			 * 显示工具执行中状态
			 */
			showToolExecuting: (toolName) => {
				console.log("[Panel] Tool executing:", toolName);
			},

			/**
			 * 显示工具执行结果
			 */
			showToolResult: (toolId, output) => {
				// 如果有对应的子智能体面板，先完成它
				const subPanel = subAgentPanelMap.get(toolId);
				if (subPanel) {
					subPanel.uiCallbacks.finalize();
					subAgentPanelMap.delete(toolId);
				}
				const card = toolCardManager.cardMap.get(toolId);
				const toolName = card?.dataset.toolName || null;
				const toolInput = toolInputMap.get(toolId) ?? null;
				completeToolCard(toolId, toolName, toolInput, output);
			},

			onTodoUpdate: (todos, meta) => {
				todoCardManager.updateTodos(todos, meta?.awaitingConfirmation);
			},
		};

		const response = await agentLoop(prompt, uiCallbacks);

		// Finalize reasoning display
		if (reasoningCharCount > 0) {
			reasoningRenderer.finish();
			curReasoningBlock.classList.add("finished");
			curReasoningBlock.classList.add("collapsed");
			curReasoningHeader.setAttribute("aria-expanded", "false");
			if (curReasoningTitleEl) {
				curReasoningTitleEl.textContent = formatMessage("thinkingProcess", {
					count: reasoningCharCount,
				});
			}
		}

		streamingRenderer.finish();
		finalizeToolCardGroup();
		setProcessingState(false);

		if (applyStylesCount > 0) {
			showConfirmationOverlay({
				applyCount: applyStylesCount,
				onConfirm: () => {
					console.log("[Panel] Styles confirmed from skill");
				},
				onUndo: async () => {
					try {
						const { executeTool } = await import("./tools.js");
						await executeTool("apply_styles", { mode: "rollback_last" });
						console.log("[Panel] Rolled back last style");
					} catch (error) {
						console.error("[Panel] Rollback failed:", error);
					}
				},
				onUndoAll: async () => {
					try {
						const { executeTool } = await import("./tools.js");
						await executeTool("apply_styles", { mode: "rollback_all" });
						setHasActiveStyles(false);
						console.log("[Panel] Rolled back all styles");
					} catch (error) {
						console.error("[Panel] Rollback all failed:", error);
					}
				},
			});
		}

		console.log("[Panel] Skill applied, agent response:", response);
	} catch (error) {
		console.error("[Panel] Skill application error:", error);
		streamingRenderer.finish();
		finalizeToolCardGroup();
		setProcessingState(false);

		if (error.message?.includes("401") || error.message?.includes("API Key")) {
			setErrorState("API_KEY_INVALID");
		} else if (error.message?.includes("Network")) {
			setErrorState("NETWORK_ERROR");
		} else {
			setErrorState("API_ERROR");
			renderAssistantMessage(
				`Error: ${error.message || "Failed to apply skill"}`,
			);
		}
	}
}

/**
 * Create a built-in skill chip (filled style)
 * @param {Object} skill - Skill object with id, name, icon, prompt
 * @param {boolean} isRecent - Whether this skill was recently used
 * @returns {HTMLElement}
 */
function createBuiltInChip(skill, isRecent = false) {
	const chip = document.createElement("div");
	chip.className = "skill-chip built-in" + (isRecent ? " recent" : "");
	chip.dataset.skillId = skill.id;
	chip.dataset.skillType = "built-in";
	chip.dataset.prompt = skill.prompt;

	chip.innerHTML = `
    ${isRecent ? '<span class="skill-recent-badge">' + getMessage("recentBadge") + "</span>" : ""}
    <span class="skill-icon">${skill.icon}</span>
    <span class="skill-name">${skill.name}</span>
  `;

	chip.addEventListener("click", () =>
		handleSkillChipClick({ ...skill, type: "built-in" }),
	);

	return chip;
}

/**
 * Create a user skill chip (outlined style with source domain)
 * Design ref: §16.3 ② - 用户技能支持长按弹出菜单：应用 / 查看详情 / 删除
 * @param {Object} skill - Skill object from StyleSkillStore
 * @param {boolean} isRecent - Whether this skill was recently used
 * @returns {HTMLElement}
 */
function createUserSkillChip(skill, isRecent = false) {
	const chip = document.createElement("div");
	chip.className = "skill-chip user-skill" + (isRecent ? " recent" : "");
	chip.dataset.skillId = skill.id;
	chip.dataset.skillType = "user";

	// Generate prompt text
	const prompt = `Apply my "${skill.name}" style`;
	chip.dataset.prompt = prompt;

	chip.innerHTML = `
    ${isRecent ? '<span class="skill-recent-badge">' + getMessage("recentBadge") + "</span>" : ""}
    <span class="skill-name">${skill.name}</span>
  `;

	// Click handler (short tap)
	chip.addEventListener("click", () =>
		handleSkillChipClick({
			id: skill.id,
			name: skill.name,
			type: "user",
			prompt,
		}),
	);

	// Long press handler for context menu
	let longPressTimer = null;
	let isLongPress = false;

	chip.addEventListener("mousedown", (e) => {
		isLongPress = false;
		longPressTimer = setTimeout(() => {
			isLongPress = true;
			showSkillContextMenu(e, skill);
		}, 500); // 500ms threshold for long press
	});

	chip.addEventListener("mouseup", () => {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	});

	chip.addEventListener("mouseleave", () => {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	});

	// Context menu (right-click)
	chip.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		showSkillContextMenu(e, skill);
	});

	return chip;
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
	const menu = document.createElement("div");
	menu.className = "skill-context-menu";
	menu.innerHTML = `
    <div class="context-menu-item" data-action="apply">
      <span class="menu-icon">${iconHtml("sparkles", 14)}</span>
      <span>${getMessage("apply")}</span>
    </div>
    <div class="context-menu-item" data-action="view">
      <span class="menu-icon">${iconHtml("file-text", 14)}</span>
      <span>${getMessage("viewDetails")}</span>
    </div>
    <div class="context-menu-item danger" data-action="delete">
      <span class="menu-icon">${iconHtml("trash", 14)}</span>
      <span>${getMessage("delete")}</span>
    </div>
  `;

	// Position the menu
	const rect = e.target.getBoundingClientRect();
	menu.style.position = "fixed";
	menu.style.left = `${rect.left}px`;
	menu.style.top = `${rect.bottom + 4}px`;
	menu.style.zIndex = "1000";

	// Add event listeners for menu items
	menu.querySelectorAll(".context-menu-item").forEach((item) => {
		item.addEventListener("click", (event) => {
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
		document.addEventListener("click", handleContextMenuOutsideClick);
	}, 0);
}

/**
 * Hide context menu
 */
function hideSkillContextMenu() {
	if (skillContextMenu) {
		skillContextMenu.remove();
		skillContextMenu = null;
		document.removeEventListener("click", handleContextMenuOutsideClick);
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
		case "apply":
			// Apply the skill
			handleSkillChipClick({
				id: skill.id,
				name: skill.name,
				type: "user",
				prompt: `Apply my "${skill.name}" style`,
			});
			break;

		case "view":
			// View skill details in a modal
			await viewSkillDetails(skill);
			break;

		case "delete":
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
			showError(getMessage("loadSkillDetailsError"));
			return;
		}

		// Create modal
		const modal = document.createElement("div");
		modal.className = "skill-detail-modal";
		modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(skill.name)}</h3>
          <button class="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="skill-meta">
            <span class="skill-source">${getMessage("source")}: ${escapeHtml(skill.sourceDomain || "unknown")}</span>
            <span class="skill-date">${getMessage("createdAt")}: ${new Date(skill.createdAt).toLocaleDateString(getLocale())}</span>
          </div>
          ${skill.mood ? `<div class="skill-mood">${getMessage("style")}: ${escapeHtml(skill.mood)}</div>` : ""}
          <div class="skill-content">
            <pre>${escapeHtml(content)}</pre>
          </div>
        </div>
      </div>
    `;

		// Add event listeners
		const closeBtn = modal.querySelector(".modal-close-btn");

		const closeModal = () => {
			modal.remove();
		};

		closeBtn.addEventListener("click", closeModal);
		modal.addEventListener("click", (e) => {
			if (e.target === modal) closeModal();
		});

		// Append to body
		document.body.appendChild(modal);
	} catch (err) {
		console.error("[Panel] Failed to view skill details:", err);
		showError(getMessage("loadSkillDetailsError"));
	}
}

/**
 * Delete skill with confirmation
 * @param {Object} skill - Skill object
 */
async function deleteSkillWithConfirmation(skill) {
	// Create confirmation modal
	const modal = document.createElement("div");
	modal.className = "skill-delete-modal";
	modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${getMessage("confirmDelete")}</h3>
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
	const cancelBtn = modal.querySelector(".btn-cancel");
	const deleteBtn = modal.querySelector(".btn-danger");

	const closeModal = () => {
		modal.remove();
	};

	cancelBtn.addEventListener("click", closeModal);
	modal.addEventListener("click", (e) => {
		if (e.target === modal) closeModal();
	});

	deleteBtn.addEventListener("click", async () => {
		try {
			// Delete skill
			await StyleSkillStore.remove(skill.id);

			// Close modal
			closeModal();

			// Refresh skill chips
			await renderSkillChips();

			// Show success message
			console.log("[Panel] Skill deleted:", skill.name);
		} catch (err) {
			console.error("[Panel] Failed to delete skill:", err);
			showError(getMessage("deleteSkillError"));
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
	const sessionHeader = document.getElementById("session-header");
	const sessionListToggle = document.getElementById("session-list-toggle");

	if (sessionHeader) {
		sessionHeader.addEventListener("click", toggleSessionList);
	}

	if (sessionListToggle) {
		sessionListToggle.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleSessionList();
		});
	}

	// 新建会话按钮
	const newSessionBtn = document.getElementById("new-session-btn");
	if (newSessionBtn) {
		newSessionBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			handleNewSession();
		});
	}

	// 设置按钮
	const settingsBtn = document.getElementById("settings-btn");
	if (settingsBtn) {
		settingsBtn.addEventListener("click", () => {
			initSettingsView();
			switchView("settings");
		});
	}

	// 点击会话列表外部关闭
	document.addEventListener("click", (e) => {
		const panel = document.getElementById("session-list-panel");
		const sessionHeader = document.getElementById("session-header");

		if (panel && sessionHeader) {
			const isClickInside =
				panel.contains(e.target) || sessionHeader.contains(e.target);
			if (!isClickInside && !panel.classList.contains("hidden")) {
				panel.classList.add("hidden");
			}
		}
	});
}

/**
 * 切换会话列表面板
 */
function toggleSessionList() {
	const panel = document.getElementById("session-list-panel");
	if (!panel) return;

	const isHidden = panel.classList.contains("hidden");

	if (isHidden) {
		// 显示面板前先加载会话列表
		renderSessionList();
		panel.classList.remove("hidden");
	} else {
		panel.classList.add("hidden");
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
	const listContainer = document.getElementById("session-list");
	if (!listContainer) return;

	// 获取当前域名
	const domain = AppState.currentDomain;
	if (!domain) {
		listContainer.innerHTML =
			'<div class="session-list-empty">' +
			getMessage("domainNotDetected") +
			"</div>";
		return;
	}

	try {
		// 动态导入 session 模块
		const session = await import("./session.js");

		// 读取会话索引
		const indexKey = `sessions:${domain}:index`;
		const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);

		if (!Array.isArray(index) || index.length === 0) {
			listContainer.innerHTML =
				'<div class="session-list-empty">' +
				getMessage("noSessions") +
				"</div>";
			return;
		}

		// 按创建时间降序排序
		const sorted = [...index].sort(
			(a, b) => (b.created_at || 0) - (a.created_at || 0),
		);

		// 清空列表
		listContainer.innerHTML = "";

		// 获取当前会话 ID
		const currentSessionId = session.getCurrentSession()?.sessionId;

		// 渲染每个会话
		for (const sessionItem of sorted) {
			const card = await createSessionCard(
				sessionItem,
				domain,
				currentSessionId,
			);
			listContainer.appendChild(card);
		}

		console.log(
			`[Panel] Rendered ${sorted.length} sessions for domain: ${domain}`,
		);
	} catch (error) {
		console.error("[Panel] Failed to render session list:", error);
		listContainer.innerHTML =
			'<div class="session-list-empty">' +
			getMessage("loadSessionError") +
			"</div>";
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
	const session = await import("./session.js");

	// 加载会话元数据
	const meta = await session.loadSessionMeta(domain, id);

	// 加载首条用户消息（用于预览）
	const historyData = await session.loadAndPrepareHistory(domain, id);
	const firstUserMessage = historyData.messages.find(
		(msg) => msg.role === "user",
	);
	const preview = firstUserMessage?.content || getMessage("noContent");

	// 创建卡片元素
	const card = document.createElement("div");
	card.className = `session-card ${id === currentSessionId ? "active" : ""}`;
	card.dataset.sessionId = id;
	card.dataset.domain = domain;

	// 格式化日期
	const date = new Date(created_at || Date.now());
	const dateStr = date.toLocaleDateString("zh-CN", {
		month: "numeric",
		day: "numeric",
	});

	// 组装卡片内容
	card.innerHTML = `
    <div class="session-info">
      <div class="session-title">${escapeHtml(meta.title || getMessage("newSession"))}</div>
      <div class="session-date">${dateStr}</div>
      <div class="session-preview">${escapeHtml(preview.slice(0, 50))}</div>
    </div>
    <div class="session-actions">
      <button class="session-delete-btn" title="${getMessage("deleteSession")}" ${id === currentSessionId ? "disabled" : ""}>
        ${iconHtml("trash", 13)}
      </button>
    </div>
  `;

	// 绑定点击事件（切换会话）
	card.addEventListener("click", (e) => {
		// 如果点击的是删除按钮，不触发切换
		if (e.target.closest(".session-delete-btn")) return;
		handleSessionClick(domain, id);
	});

	// 绑定删除按钮事件
	const deleteBtn = card.querySelector(".session-delete-btn");
	deleteBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (!deleteBtn.disabled) {
			handleDeleteSession(domain, id, meta.title || getMessage("newSession"));
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
		const session = await import("./session.js");
		const { sendToContentScript } = await import("./tools.js");

		// === 1. 卸载当前会话样式 ===
		try {
			await sendToContentScript({ tool: "unload_session_css" });
			console.log("[Panel] Unloaded current session CSS");
		} catch (error) {
			console.warn(
				"[Panel] Failed to unload session CSS (Content Script may not be ready):",
				error.message,
			);
			// 继续执行，不中断切换流程
		}

		// === 2. 创建新的 SessionContext 并设置为当前会话 ===
		const newSession = new session.SessionContext(domain, sessionId);
		session.setCurrentSession(newSession);

		// 记录活跃会话（确保下次打开 Side Panel 时恢复到此会话）
		await session.setActiveSession(domain, sessionId);

		// === 3. 加载目标会话样式并注入 ===
		const stylesKey = newSession.stylesKey;
		const { [stylesKey]: sessionCSS = "" } =
			await chrome.storage.local.get(stylesKey);

		// 同步 active_styles（供页面刷新时 early-inject.js 读取）
		const aKey = newSession.activeStylesKey;
		if (sessionCSS && sessionCSS.trim()) {
			await chrome.storage.local.set({ [aKey]: sessionCSS });
			try {
				await sendToContentScript({
					tool: "load_session_css",
					args: { css: sessionCSS },
				});
				console.log("[Panel] Loaded target session CSS");
				setHasActiveStyles(true);
			} catch (error) {
				console.warn("[Panel] Failed to load session CSS:", error.message);
			}
		} else {
			await chrome.storage.local.remove(aKey);
			setHasActiveStyles(false);
		}

		// === 4. 更新顶栏显示 ===
		const meta = await session.loadSessionMeta(domain, sessionId);
		updateTopBarDisplay(domain, meta.title || getMessage("newSession"));

		// 更新全局状态中的域名和会话 ID
		stateManager.set("currentDomain", domain);
		stateManager.set("currentSessionId", sessionId);

		// === 5. 关闭下拉面板 ===
		const panel = document.getElementById("session-list-panel");
		if (panel) panel.classList.add("hidden");

		// === 6. 清空当前对话区并加载历史消息 ===
		clearMessages();

		// 加载会话历史（新格式 { messages, snapshots }）
		const historyData = await session.loadAndPrepareHistory(domain, sessionId);

		// 渲染历史消息
		if (historyData.messages && historyData.messages.length > 0) {
			renderHistoryMessages(historyData.messages);
			// 有历史消息时：标记会话已开始，隐藏技能区
			stateManager.set("hasConversationStarted", true);
			setSkillAreaVisible(false);
			console.log(
				`[Panel] Loaded ${historyData.messages.length} history messages`,
			);
		} else {
			// 空会话：重置状态，显示技能区
			stateManager.set("hasConversationStarted", false);
			showEmptyState();
		}

		console.log("[Panel] Session switched successfully");
	} catch (error) {
		console.error("[Panel] Failed to switch session:", error);
		showError(getMessage("switchSessionError"));
	}
}

/**
 * 处理新建会话
 */
async function handleNewSession() {
	try {
		console.log("[Panel] Creating new session");

		// 获取当前域名
		const domain = AppState.currentDomain;
		if (!domain) {
			showError(getMessage("domainNotDetected"));
			return;
		}

		// 动态导入 session 模块
		const session = await import("./session.js");

		// 生成新会话 ID
		const newSessionId = crypto.randomUUID();

		// 更新会话索引
		const indexKey = `sessions:${domain}:index`;
		const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);

		const now = Date.now();
		const newSessionItem = {
			id: newSessionId,
			created_at: now,
		};

		// 添加到索引（最新会话放在最前面）
		const newIndex = [newSessionItem, ...index];
		await chrome.storage.local.set({ [indexKey]: newIndex });

		// 创建新的 SessionContext
		const newSession = new session.SessionContext(domain, newSessionId);
		session.setCurrentSession(newSession);

		// 记录活跃会话（确保下次打开 Side Panel 时恢复到此新会话）
		await session.setActiveSession(domain, newSessionId);

		// 卸载当前会话样式并清空 active_styles
		try {
			const { sendToContentScript } = await import("./tools.js");
			await sendToContentScript({ tool: "unload_session_css" });
		} catch (error) {
			console.warn("[Panel] Failed to unload session CSS:", error.message);
		}
		await chrome.storage.local.remove(newSession.activeStylesKey);
		setHasActiveStyles(false);

		// 创建默认元数据
		await session.saveSessionMeta(domain, newSessionId, {
			title: null,
			created_at: now,
			message_count: 0,
		});

		// 重置会话对话状态（新会话允许显示技能区）
		stateManager.set("hasConversationStarted", false);

		// 更新顶栏显示
		updateTopBarDisplay(domain, getMessage("newSession"));

		// 关闭下拉面板
		const panel = document.getElementById("session-list-panel");
		if (panel) panel.classList.add("hidden");

		// 清空当前对话区
		clearMessages();
		showEmptyState();

		console.log(`[Panel] New session created: ${newSessionId}`);
	} catch (error) {
		console.error("[Panel] Failed to create new session:", error);
		showError(getMessage("createSessionError"));
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
		const session = await import("./session.js");

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
		console.error("[Panel] Failed to handle delete session:", error);
		showError("删除会话失败");
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
	const overlay = document.createElement("div");
	overlay.className = "modal-overlay";

	// 创建弹窗
	const modal = document.createElement("div");
	modal.className = "modal-container";

	modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">删除「${escapeHtml(sessionTitle)}」？</h3>
    </div>
    <div class="modal-body">
      <p>会话记录和该会话的样式将被永久删除。</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" data-action="cancel">取消</button>
      <button class="modal-btn modal-btn-danger" data-action="confirm">${getMessage("confirm")}</button>
    </div>
  `;

	overlay.appendChild(modal);
	document.body.appendChild(overlay);

	// 绑定事件
	const handleAction = async (action) => {
		if (action === "confirm") {
			await executeDeleteSession(domain, sessionId);
		}
		// 关闭弹窗
		overlay.remove();
	};

	modal.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-action]");
		if (btn) {
			handleAction(btn.dataset.action);
		}
	});

	// 点击遮罩关闭
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			handleAction("cancel");
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
	const overlay = document.createElement("div");
	overlay.className = "modal-overlay";

	const modal = document.createElement("div");
	modal.className = "modal-container";

	modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">这是 ${domain} 的最后一个会话</h3>
    </div>
    <div class="modal-body">
      <p>删除后将清除该域名的所有会话数据。</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" data-action="cancel">取消</button>
      <button class="modal-btn modal-btn-danger" data-action="delete">${getMessage("confirm")}</button>
    </div>
  `;

	overlay.appendChild(modal);
	document.body.appendChild(overlay);

	const handleAction = async (action) => {
		if (action === "delete") {
			await executeDeleteSession(domain, sessionId);
		}
		overlay.remove();
	};

	modal.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-action]");
		if (btn) {
			handleAction(btn.dataset.action);
		}
	});

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			overlay.remove();
		}
	});
}

/**
 * 执行删除会话
 * @param {string} domain - 域名
 * @param {string} sessionId - 会话 ID
 */
async function executeDeleteSession(domain, sessionId) {
	try {
		console.log(`[Panel] Deleting session: ${sessionId}`);

		const session = await import("./session.js");
		const result = await session.deleteSession(domain, sessionId);

		const currentSession = session.getCurrentSession();
		if (currentSession && currentSession.sessionId === sessionId) {
			await handleNewSession();
		} else {
			await renderSessionList();
		}

		console.log("[Panel] Session deleted successfully");
	} catch (error) {
		console.error("[Panel] Failed to delete session:", error);
		showError(getMessage("deleteSession") + " " + getMessage("saveFailed"));
	}
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} - 转义后的文本
 */
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * 更新状态指示灯
 * @param {'idle' | 'running' | 'error' | 'restricted'} status - 状态
 * @deprecated 请使用 setProcessingState / setErrorState / setRestrictedPageState
 */
function updateStatusIndicator(status) {
	// 兼容旧接口：仅更新 agentStatus
	stateManager.set("agentStatus", status);
	// 直接更新指示灯，不触发完整联动（避免循环）
	const dot = DOM.statusDot?.querySelector(".dot");
	if (!dot) return;

	dot.classList.remove("ready", "processing", "error", "restricted");

	switch (status) {
		case "idle":
			dot.classList.add("ready");
			break;
		case "running":
			dot.classList.add("processing");
			break;
		case "error":
			dot.classList.add("error");
			break;
		case "restricted":
			dot.classList.add("restricted");
			break;
	}
}

// ============================================================================
// 设置页逻辑
// ============================================================================

/**
 * 初始化设置页
 */
async function initSettingsView() {
	// 获取设置页 DOM 元素
	DOM.settingsApiKey = document.getElementById("settings-api-key");
	DOM.settingsApiBase = document.getElementById("settings-api-base");
	DOM.settingsModel = document.getElementById("settings-model");
	DOM.settingsUserProfile = document.getElementById("settings-user-profile");
	DOM.profileCharCount = document.getElementById("profile-char-count");
	DOM.saveProfileBtn = document.getElementById("save-profile-btn");
	DOM.profileStatus = document.getElementById("profile-status");
	DOM.verifyConnectionBtn = document.getElementById("verify-connection-btn");
	DOM.connectionStatus = document.getElementById("connection-status");

	// 获取视觉模型设置 DOM 元素
	DOM.settingsVisionApiKey = document.getElementById("settings-vision-api-key");
	DOM.settingsVisionApiBase = document.getElementById(
		"settings-vision-api-base",
	);
	DOM.settingsVisionModel = document.getElementById("settings-vision-model");

	// 防止重复绑定事件监听器（使用 data 属性标记）
	const settingsView = document.getElementById("settings-view");
	if (settingsView && settingsView.dataset.listenersAttached === "true") {
		// 仅重新加载数据，不重复绑定事件
		await loadCurrentSettings();
		await loadUserProfile();
		await loadStorageUsage();
		return;
	}
	if (settingsView) settingsView.dataset.listenersAttached = "true";

	// 返回按钮
	const backBtn = document.getElementById("settings-back-btn");
	if (backBtn) {
		backBtn.addEventListener("click", async () => {
			await handleSettingsBack();
		});
	}

	// 验证连接按钮
	if (DOM.verifyConnectionBtn) {
		DOM.verifyConnectionBtn.addEventListener("click", handleVerifyConnection);
	}

	// 切换 API Key 可见性
	const toggleKeyBtn = document.getElementById("toggle-key-visibility");
	if (toggleKeyBtn) {
		toggleKeyBtn.addEventListener("click", () => {
			const type = DOM.settingsApiKey.type;
			DOM.settingsApiKey.type = type === "password" ? "text" : "password";
			toggleKeyBtn.innerHTML =
				type === "password" ? iconHtml("eye-off", 16) : iconHtml("eye", 16);
		});
	}

	// 输入框变化时标记有未保存的更改
	const settingsInputs = [
		document.getElementById("settings-api-key"),
		document.getElementById("settings-api-base"),
		document.getElementById("settings-model"),
		document.getElementById("settings-vision-api-key"),
		document.getElementById("settings-vision-api-base"),
		document.getElementById("settings-vision-model"),
	];
	settingsInputs.forEach((input) => {
		if (input) {
			input.addEventListener("input", () => markSettingsDirty());
		}
	});

	// 用户画像编辑
	if (DOM.settingsUserProfile) {
		// 字数统计
		DOM.settingsUserProfile.addEventListener("input", () => {
			updateProfileCharCount();
		});
	}

	// 保存用户画像按钮
	if (DOM.saveProfileBtn) {
		DOM.saveProfileBtn.addEventListener("click", handleSaveUserProfile);
	}

	// 清理历史数据按钮
	const clearStorageBtn = document.getElementById("clear-storage-btn");
	if (clearStorageBtn) {
		clearStorageBtn.addEventListener("click", handleClearStorage);
	}

	// 加载当前设置
	await loadCurrentSettings();

	// 加载用户画像
	await loadUserProfile();

	// 加载存储用量
	await loadStorageUsage();

	// 渲染静态技能列表
	await renderStaticSkillList();

	// 渲染用户风格技能列表
	await renderUserSkillList();
}

/**
 * 标记设置有未保存的更改
 */
function markSettingsDirty() {
	const saveHint = document.getElementById("settings-save-hint");
	if (saveHint) {
		saveHint.classList.remove("hidden");
	}
	if (DOM.connectionStatus) {
		DOM.connectionStatus.classList.add("hidden");
	}
}

/**
 * 处理设置页返回按钮
 * 自动保存有效的设置后返回
 */
async function handleSettingsBack() {
	const apiKey = DOM.settingsApiKey?.value.trim();
	const apiBase = DOM.settingsApiBase?.value.trim() || DEFAULT_API_BASE;
	const model = DOM.settingsModel?.value.trim() || DEFAULT_MODEL;

	// 获取视觉模型设置
	const visionApiKey = DOM.settingsVisionApiKey?.value.trim() || undefined;
	const visionApiBase = DOM.settingsVisionApiBase?.value.trim() || undefined;
	const visionModel = DOM.settingsVisionModel?.value.trim() || undefined;

	// 如果有 API Key，自动保存设置
	if (apiKey) {
		try {
			await saveSettings({
				apiKey,
				apiBase,
				model,
				visionApiKey,
				visionApiBase,
				visionModel,
			});
			showSaveSuccess();
		} catch (err) {
			console.warn("[Panel] Auto-save on back failed:", err);
		}
	}

	// 根据是否有 API Key 决定返回哪个视图
	if (!apiKey) {
		switchView("onboarding");
		return;
	}

	// 若之前是 missing 状态但现在填入了 Key，需要初始化主界面
	if (AppState.apiKeyStatus === "missing") {
		AppState.apiKeyStatus = "valid";
		try {
			await initMainView();
		} catch (err) {
			console.warn("[Panel] initMainView on back failed:", err);
		}
	}
	switchView("main");
}

/**
 * 显示保存成功的简短提示（不跳转）
 */
function showSaveSuccess() {
	const saveHint = document.getElementById("settings-save-hint");
	if (saveHint) {
		saveHint.textContent = "✓ " + getMessage("saved");
		saveHint.classList.remove("hidden", "unsaved");
		saveHint.classList.add("saved");
		setTimeout(() => {
			saveHint.classList.add("hidden");
		}, 2000);
	}
}

/**
 * 加载当前设置到表单
 */
async function loadCurrentSettings() {
	try {
		const settings = await getSettings();
		if (DOM.settingsApiKey) {
			DOM.settingsApiKey.value = settings.apiKey || "";
		}
		if (DOM.settingsApiBase) {
			DOM.settingsApiBase.value = settings.apiBase || DEFAULT_API_BASE;
		}
		if (DOM.settingsModel) {
			DOM.settingsModel.value = settings.model || DEFAULT_MODEL;
		}
		// 加载视觉模型设置
		if (DOM.settingsVisionApiKey) {
			DOM.settingsVisionApiKey.value = settings.visionApiKey || "";
		}
		if (DOM.settingsVisionApiBase) {
			DOM.settingsVisionApiBase.value = settings.visionApiBase || "";
		}
		if (DOM.settingsVisionModel) {
			DOM.settingsVisionModel.value = settings.visionModel || "";
		}
	} catch (err) {
		console.warn("[Panel] No existing settings");
	}
}

/**
 * 加载用户画像到表单
 */
async function loadUserProfile() {
	try {
		const profile = await runGetUserProfile();
		if (DOM.settingsUserProfile) {
			// 如果是默认提示，显示空
			if (profile === "(" + getMessage("newUserProfile") + ")") {
				DOM.settingsUserProfile.value = "";
			} else {
				DOM.settingsUserProfile.value = profile;
			}
			updateProfileCharCount();
		}
	} catch (err) {
		console.warn("[Panel] Failed to load user profile:", err);
	}
}

// ============================================================================
// 静态技能列表渲染
// ============================================================================

/**
 * 全局 SkillLoader 实例（延迟初始化）
 * @type {SkillLoader|null}
 */
let staticSkillLoader = null;

/**
 * 获取或初始化 SkillLoader
 * @returns {Promise<SkillLoader>}
 */
async function getStaticSkillLoader() {
	if (!staticSkillLoader) {
		const baseUrl = `chrome-extension://${chrome.runtime.id}`;
		staticSkillLoader = new SkillLoader(baseUrl);
		await staticSkillLoader.init();
	}
	return staticSkillLoader;
}

/**
 * 渲染静态技能列表（带启用/禁用开关）
 * 从 SkillLoader 获取所有静态技能
 */
async function renderStaticSkillList() {
	const container = document.getElementById("static-skill-list");
	if (!container) return;

	container.innerHTML = "";

	try {
		// 从 SkillLoader 获取所有静态技能
		const loader = await getStaticSkillLoader();
		const allSkills = loader.list();

		// 获取禁用的技能列表
		const disabledSkills = await getDisabledSkills();

		if (allSkills.length === 0) {
			container.innerHTML =
				'<p class="hint">' + getMessage("noStaticSkills") + "</p>";
			return;
		}

		for (const skill of allSkills) {
			const isEnabled = !disabledSkills.includes(skill.name);
			const item = createStaticSkillItem(skill, isEnabled);
			container.appendChild(item);
		}
	} catch (err) {
		console.error("[Panel] Failed to load static skills:", err);
		container.innerHTML = '<p class="hint error">加载技能失败</p>';
	}
}

/**
 * 创建静态技能列表项
 * @param {Object} skill - 技能对象 {name, description, tags}
 * @param {boolean} isEnabled - 是否启用
 * @returns {HTMLElement}
 */
function createStaticSkillItem(skill, isEnabled) {
	const item = document.createElement("div");
	item.className = "static-skill-item";
	item.dataset.skillId = skill.name;

	item.innerHTML = `
    <div class="static-skill-info">
      <span class="static-skill-icon">${iconHtml("file-text", 16)}</span>
      <div class="static-skill-text">
        <span class="static-skill-name">${escapeHtml(skill.name)}</span>
        <span class="static-skill-desc">${escapeHtml(skill.description || "No description")}</span>
      </div>
    </div>
    <label class="toggle-switch">
      <input type="checkbox" ${isEnabled ? "checked" : ""}>
      <span class="toggle-slider"></span>
    </label>
  `;

	// 绑定开关事件
	const toggle = item.querySelector('input[type="checkbox"]');
	toggle.addEventListener("change", async (e) => {
		const enabled = e.target.checked;
		await setSkillEnabled(skill.name, enabled);
		// 刷新主界面的技能 chips
		await renderSkillChips();
		console.log(
			`[Panel] Static skill ${skill.name} ${enabled ? "enabled" : "disabled"}`,
		);
	});

	return item;
}

// ============================================================================
// 用户风格技能列表渲染
// ============================================================================

/**
 * 渲染用户风格技能列表
 */
async function renderUserSkillList() {
	const container = document.getElementById("skill-list");
	if (!container) return;

	container.innerHTML = "";

	try {
		const userSkills = await StyleSkillStore.list();
		const disabledUserSkills = await getDisabledUserSkills();

		if (userSkills.length === 0) {
			container.innerHTML =
				'<p class="hint">' + getMessage("noStyleSkills") + "</p>";
			return;
		}

		for (const skill of userSkills) {
			const isEnabled = !disabledUserSkills.includes(skill.id);
			const item = createUserSkillItem(skill, isEnabled);
			container.appendChild(item);
		}
	} catch (err) {
		console.error("[Panel] Failed to render user skill list:", err);
		container.innerHTML =
			'<p class="hint error">' + getMessage("loadSkillError") + "</p>";
	}
}

/**
 * 创建用户风格技能列表项
 * @param {Object} skill - 技能对象
 * @param {boolean} isEnabled - 是否启用
 * @returns {HTMLElement}
 */
function createUserSkillItem(skill, isEnabled) {
	const item = document.createElement("div");
	item.className = "user-skill-item";
	item.dataset.skillId = skill.id;

	const createdDate = new Date(skill.createdAt).toLocaleDateString("zh-CN");

	item.innerHTML = `
    <div class="user-skill-info">
      <span class="user-skill-name">${escapeHtml(skill.name)}</span>
      <span class="user-skill-mood">${escapeHtml(skill.mood || getMessage("noDesc"))}</span>
      <div class="user-skill-meta">
        <span class="user-skill-domain">${escapeHtml(skill.sourceDomain || "unknown")}</span>
        <span class="user-skill-date">${createdDate}</span>
      </div>
    </div>
    <div class="user-skill-actions">
      <label class="toggle-switch toggle-switch-small" title="${isEnabled ? getMessage("enabled") : getMessage("disabled")}">
        <input type="checkbox" ${isEnabled ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
      <button class="btn-icon-small" data-action="edit" title="编辑">${iconHtml("pencil", 13)}</button>
      <button class="btn-icon-small" data-action="delete" title="${getMessage("delete")}">${iconHtml("trash", 13)}</button>
    </div>
  `;

	// 绑定开关事件
	const toggle = item.querySelector('input[type="checkbox"]');
	toggle.addEventListener("change", async (e) => {
		const enabled = e.target.checked;
		await setUserSkillEnabled(skill.id, enabled);
		// 更新 tooltip
		toggle.parentElement.title = enabled
			? getMessage("enabled")
			: getMessage("disabled");
		// 刷新主界面的技能 chips
		await renderSkillChips();
		console.log(
			`[Panel] User skill ${skill.id} ${enabled ? "enabled" : "disabled"}`,
		);
	});

	// 绑定按钮事件
	const editBtn = item.querySelector('[data-action="edit"]');
	const deleteBtn = item.querySelector('[data-action="delete"]');

	editBtn.addEventListener("click", () => openSkillEditor(skill));
	deleteBtn.addEventListener("click", () => deleteSkillWithConfirmation(skill));

	// 点击整个项目也可以编辑
	item
		.querySelector(".user-skill-info")
		.addEventListener("click", () => openSkillEditor(skill));

	return item;
}

/**
 * 打开技能编辑器模态框
 * @param {Object} skill - 技能对象
 */
async function openSkillEditor(skill) {
	// 加载技能内容
	const content = await StyleSkillStore.load(skill.id);

	// 创建模态框
	const modal = document.createElement("div");
	modal.className = "skill-editor-modal";
	modal.innerHTML = `
    <div class="modal-content skill-editor-content">
      <div class="modal-header">
        <h3>${getMessage("editStyleSkill")}</h3>
        <button class="modal-close-btn" title="${getMessage("close")}">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-skill-name">名称</label>
          <input type="text" id="edit-skill-name" value="${escapeHtml(skill.name)}" data-i18n-placeholder="styleNamePlaceholder">
        </div>
        <div class="form-group">
          <label for="edit-skill-mood">描述</label>
          <input type="text" id="edit-skill-mood" value="${escapeHtml(skill.mood || "")}" data-i18n-placeholder="styleDescPlaceholder">
        </div>
        <div class="form-group">
          <label for="edit-skill-content">内容</label>
          <textarea id="edit-skill-content" class="settings-textarea skill-editor-textarea" data-i18n-placeholder="skillContentPlaceholder">${escapeHtml(content || "")}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel">取消</button>
        <button class="btn btn-primary">保存</button>
      </div>
    </div>
  `;

	// 绑定事件
	const closeBtn = modal.querySelector(".modal-close-btn");
	const cancelBtn = modal.querySelector(".btn-cancel");
	const saveBtn = modal.querySelector(".btn-primary");

	const closeModal = () => modal.remove();

	closeBtn.addEventListener("click", closeModal);
	cancelBtn.addEventListener("click", closeModal);
	modal.addEventListener("click", (e) => {
		if (e.target === modal) closeModal();
	});

	saveBtn.addEventListener("click", async () => {
		const nameInput = modal.querySelector("#edit-skill-name");
		const moodInput = modal.querySelector("#edit-skill-mood");
		const contentInput = modal.querySelector("#edit-skill-content");

		const name = nameInput.value.trim();
		const mood = moodInput.value.trim();
		const newContent = contentInput.value.trim();

		if (!name) {
			nameInput.focus();
			return;
		}

		try {
			saveBtn.disabled = true;
			saveBtn.textContent = getMessage("saving");

			await StyleSkillStore.save(
				skill.id,
				name,
				mood,
				skill.sourceDomain,
				newContent,
			);

			closeModal();
			await renderUserSkillList();
			await renderSkillChips();
			console.log("[Panel] Skill updated:", name);
		} catch (err) {
			console.error("[Panel] Failed to save skill:", err);
			saveBtn.disabled = false;
			saveBtn.textContent = getMessage("save");
			alert(getMessage("saveFailed") + ": " + err.message);
		}
	});

	document.body.appendChild(modal);
}

/**
 * 更新用户画像字数统计
 */
function updateProfileCharCount() {
	if (DOM.settingsUserProfile && DOM.profileCharCount) {
		const count = DOM.settingsUserProfile.value.length;
		DOM.profileCharCount.textContent = `${count} 字`;
	}
}

/**
 * 处理保存用户画像
 */
async function handleSaveUserProfile() {
	if (!DOM.settingsUserProfile) return;

	const content = DOM.settingsUserProfile.value.trim();

	if (!DOM.saveProfileBtn) return;
	DOM.saveProfileBtn.disabled = true;
	showProfileStatus(getMessage("saving"), "loading");

	try {
		await runUpdateUserProfile(content);
		showProfileStatus("✓ " + getMessage("profileSaved"), "success");
	} catch (err) {
		console.error("[Panel] Failed to save user profile:", err);
		showProfileStatus(`✗ 保存失败: ${err.message}`, "error");
	} finally {
		DOM.saveProfileBtn.disabled = false;
	}
}

/**
 * 显示用户画像状态消息
 * @param {string} message - 状态消息
 * @param {string} type - 消息类型: 'success' | 'error' | 'loading'
 */
function showProfileStatus(message, type) {
	if (!DOM.profileStatus) return;

	DOM.profileStatus.textContent = message;
	// 移除所有状态类
	DOM.profileStatus.classList.remove("hidden", "success", "error", "loading");
	// 添加当前状态类
	DOM.profileStatus.classList.add(type, "status-message");

	// 成功消息 2 秒后自动淡出
	if (type === "success") {
		setTimeout(() => {
			DOM.profileStatus.classList.add("fade-out");
			setTimeout(() => {
				DOM.profileStatus.classList.add("hidden");
				DOM.profileStatus.classList.remove("fade-out", "success");
			}, 300);
		}, 2000);
	}
}

/**
 * 处理验证连接按钮点击
 */
async function handleVerifyConnection() {
	const apiKey = DOM.settingsApiKey.value.trim();
	const apiBase = DOM.settingsApiBase.value.trim() || DEFAULT_API_BASE;
	const model = DOM.settingsModel.value.trim() || DEFAULT_MODEL;

	if (!apiKey) {
		showConnectionStatus(getMessage("enterApiKey"), "error");
		return;
	}

	DOM.verifyConnectionBtn.disabled = true;
	DOM.verifyConnectionBtn.classList.add("loading");
	showConnectionStatus(getMessage("verifyingConnection"), "loading");

	try {
		const result = await validateConnection(apiKey, apiBase, model);

		if (result.ok) {
			showConnectionStatus("✓ " + getMessage("connectionSuccess"), "success");
			// 保存所有设置
			await saveSettings({ apiKey, apiBase, model });
			AppState.apiKeyStatus = "valid";
			// 隐藏未保存提示
			const saveHint = document.getElementById("settings-save-hint");
			if (saveHint) saveHint.classList.add("hidden");
		} else {
			let msg = getMessage("connectionFailed");
			if (result.status === 401) msg = getMessage("apiKeyInvalid");
			else if (result.status === 403) msg = getMessage("accessDenied");
			else if (result.error) msg = result.error;

			showConnectionStatus(`✗ ${msg}`, "error");
			AppState.apiKeyStatus = "invalid";
		}
	} catch (err) {
		showConnectionStatus(`✗ 连接错误: ${err.message}`, "error");
	} finally {
		DOM.verifyConnectionBtn.disabled = false;
		DOM.verifyConnectionBtn.classList.remove("loading");
	}
}

/**
 * 显示连接状态
 * @param {string} message - 状态消息
 * @param {'success' | 'error' | 'loading'} type - 状态类型
 */
function showConnectionStatus(message, type) {
	if (!DOM.connectionStatus) return;

	DOM.connectionStatus.textContent = message;
	// 移除所有状态类
	DOM.connectionStatus.classList.remove(
		"hidden",
		"success",
		"error",
		"loading",
	);
	// 添加当前状态类
	DOM.connectionStatus.classList.add(type, "status-message");

	// 移除内联样式 - CSS 已处理样式
	DOM.connectionStatus.style.color = "";
	DOM.connectionStatus.style.backgroundColor = "";

	// 成功消息 2 秒后自动淡出
	if (type === "success") {
		DOM.connectionStatus.classList.add("success");
		setTimeout(() => {
			DOM.connectionStatus.classList.add("fade-out");
			setTimeout(() => {
				DOM.connectionStatus.classList.add("hidden");
				DOM.connectionStatus.classList.remove("fade-out", "success");
			}, 300);
		}, 2000);
	}
}

/**
 * 加载存储用量
 */
async function loadStorageUsage() {
	try {
		// 动态导入 session 模块
		const session = await import("./session.js");

		// 获取存储用量
		const usage = await session.getStorageUsage();

		// 更新进度条
		const progressBar = document.getElementById("storage-progress");
		if (progressBar) {
			progressBar.style.width = `${usage.percent}%`;

			// 根据使用率设置颜色
			if (usage.percent >= 90) {
				progressBar.style.backgroundColor = "var(--color-error)";
			} else if (usage.percent >= 70) {
				progressBar.style.backgroundColor = "var(--color-warning)";
			} else {
				progressBar.style.backgroundColor = "var(--color-primary)";
			}
		}

		// 更新百分比文本
		const percentText = document.getElementById("storage-percent");
		if (percentText) {
			percentText.textContent = `${usage.percent}%`;
		}

		// 更新详细文本
		const detailText = document.getElementById("storage-detail");
		if (detailText) {
			const usedMB = (usage.bytes / (1024 * 1024)).toFixed(2);
			const maxMB = (usage.maxBytes / (1024 * 1024)).toFixed(0);
			detailText.textContent = `${usedMB} MB / ${maxMB} MB`;
		}
	} catch (error) {
		console.error("[Panel] Failed to load storage usage:", error);

		// 显示错误状态
		const percentText = document.getElementById("storage-percent");
		if (percentText) {
			percentText.textContent = "--";
		}

		const detailText = document.getElementById("storage-detail");
		if (detailText) {
			detailText.textContent = getMessage("getStorageFailed");
		}
	}
}

/**
 * 处理清理历史数据按钮点击
 */
async function handleClearStorage() {
	// 确认对话框
	const confirmed = confirm(getMessage("clearHistoryConfirm"));

	if (!confirmed) return;

	try {
		// 动态导入 session 模块
		const session = await import("./session.js");

		// 显示加载状态
		const clearBtn = document.getElementById("clear-storage-btn");
		if (clearBtn) {
			clearBtn.disabled = true;
			clearBtn.textContent = getMessage("clearing");
		}

		// 执行清理
		await session.cleanupStorage();

		// 刷新存储用量显示
		await loadStorageUsage();

		// 显示成功提示
		alert(getMessage("clearHistorySuccess"));
	} catch (error) {
		console.error("[Panel] Failed to clear storage:", error);
		alert("清理失败：" + error.message);
	} finally {
		// 恢复按钮状态
		const clearBtn = document.getElementById("clear-storage-btn");
		if (clearBtn) {
			clearBtn.disabled = false;
			clearBtn.textContent = getMessage("clearHistory");
		}
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
	console.log("[Panel] Initializing...");

	// Initialize i18n translations
	applyTranslations();

	// === Step 1: 存储 Schema 版本迁移 ===
	try {
		const session = await import("./session.js");
		await session.checkAndMigrateStorage();
		console.log("[Panel] Storage migration checked");
	} catch (err) {
		console.error("[Panel] Storage migration failed:", err);
		// 继续执行，不中断初始化
	}

	// 缓存 DOM 元素
	DOM.onboardingView = document.getElementById("onboarding-view");
	DOM.mainView = document.getElementById("main-view");
	DOM.settingsView = document.getElementById("settings-view");
	DOM.loadingOverlay = document.getElementById("loading-overlay");
	DOM.errorToast = document.getElementById("error-toast");
	DOM.errorMessage = document.getElementById("error-message");

	// 错误提示关闭按钮
	const dismissErrorBtn = document.getElementById("dismiss-error");
	if (dismissErrorBtn) {
		dismissErrorBtn.addEventListener("click", hideError);
	}

	// 设置按钮
	const settingsBtn = document.getElementById("settings-btn");
	if (settingsBtn) {
		settingsBtn.addEventListener("click", () => {
			initSettingsView();
			switchView("settings");
		});
	}

	// === Step 2: 检测 API Key ===
	try {
		const { needsSetup } = await checkFirstRun();

		if (needsSetup) {
			// === Step 3a: 首次使用，显示引导页 ===
			console.log("[Panel] First run detected, showing onboarding");
			initOnboarding();
			switchView("onboarding");
			AppState.apiKeyStatus = "missing";
		} else {
			// === Step 3b: 已有配置，进入主界面 ===
			console.log("[Panel] Existing settings found, entering main view");
			AppState.apiKeyStatus = "valid";

			// 初始化主界面（包含获取域名、加载会话、加载技能 chip）
			await initMainView();

			switchView("main");

			// === Step 7: 后台执行 cleanupStorage（不阻塞 UI）===
			import("./session.js").then((session) => {
				session.cleanupStorage().catch((err) => {
					console.error("[Panel] Background cleanup failed:", err);
				});
			});
		}
	} catch (err) {
		console.error("[Panel] Init error:", err);
		// 出错时显示引导页
		initOnboarding();
		switchView("onboarding");
	}
}

// ============================================================================
// 启动
// ============================================================================

// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", init);

// ============================================================================
// 消息渲染函数
// ============================================================================

/**
 * 渲染用户消息气泡
 * @param {string} content - 消息内容
 * @param {Object} [options] - 可选参数
 * @param {number} [options.turn] - 轮次号（用于时间旅行回退）
 * @param {boolean} [options.showRewind] - 是否显示回退按钮
 * @returns {HTMLElement} - 消息 DOM 元素
 */
function renderUserMessage(content, options = {}) {
	const messageDiv = document.createElement("div");
	messageDiv.className = "message message-user";

	const bubbleDiv = document.createElement("div");
	bubbleDiv.className = "message-bubble";
	bubbleDiv.textContent = content;

	if (options.turn != null) {
		bubbleDiv.dataset.turn = options.turn;
	}

	if (options.showRewind && options.turn != null) {
		const rewindBtn = document.createElement("button");
		rewindBtn.className = "rewind-btn";
		rewindBtn.title = "回到这一轮";
		rewindBtn.innerHTML = "↩";
		rewindBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			handleRewindClick(options.turn);
		});
		bubbleDiv.appendChild(rewindBtn);
	}

	messageDiv.appendChild(bubbleDiv);
	return messageDiv;
}

/**
 * 渲染助手消息容器（用于流式输出）
 * @returns {HTMLElement} - 消息 DOM 元素（包含推理块和气泡容器）
 */
function renderAssistantMessageContainer() {
	const messageDiv = document.createElement("div");
	messageDiv.className = "message message-assistant";

	// 推理思考块（初始隐藏，有 reasoning_content 时才显示）
	const reasoningBlock = document.createElement("div");
	reasoningBlock.className = "reasoning-block";

	const reasoningHeader = document.createElement("button");
	reasoningHeader.className = "reasoning-header";
	reasoningHeader.setAttribute("aria-expanded", "true");
	reasoningHeader.innerHTML =
		'<span class="reasoning-spinner"></span>' +
		'<span class="reasoning-title">' +
		getMessage("thinking") +
		"</span>" +
		'<span class="reasoning-chevron"></span>';

	const reasoningContent = document.createElement("div");
	reasoningContent.className = "reasoning-content";

	reasoningHeader.addEventListener("click", () => {
		const expanded = reasoningHeader.getAttribute("aria-expanded") === "true";
		reasoningHeader.setAttribute("aria-expanded", String(!expanded));
		reasoningBlock.classList.toggle("collapsed", expanded);
	});

	reasoningBlock.appendChild(reasoningHeader);
	reasoningBlock.appendChild(reasoningContent);

	const bubbleDiv = document.createElement("div");
	bubbleDiv.className = "message-bubble streaming-text";

	messageDiv.appendChild(reasoningBlock);
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
		this.buffer = ""; // 原始文本缓冲
		this.renderedHTML = ""; // 已渲染的 HTML
		this.cursor = null; // 光标元素
		this.isStreaming = false; // 是否正在流式输出

		// 配置选项
		this.options = {
			showCursor: options.showCursor !== false, // 默认显示光标
			autoScroll: options.autoScroll !== false, // 默认自动滚动
			scrollContainer: options.scrollContainer || null, // 滚动容器
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
		this.cursor = document.createElement("span");
		this.cursor.className = "typing-cursor";
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
		this.buffer = "";
		this.renderedHTML = "";
		this.container.innerHTML = "";

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
		if (!text) return "";

		// 先保护代码块，避免内部内容被其他规则处理
		const codeBlocks = [];
		let html = text.replace(
			/```(\w*)\n?([\s\S]*?)```/g,
			(match, lang, code) => {
				const langAttr = lang ? ` class="language-${lang}"` : "";
				const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
				codeBlocks.push(`<pre><code${langAttr}>${code.trim()}</code></pre>`);
				return placeholder;
			},
		);

		// 转义 HTML（但保留占位符）
		html = this._escapeHtml(html);

		// 水平线（--- 或 ***）
		html = html.replace(/^[-]{3,}$/gm, "<hr>");
		html = html.replace(/^[*]{3,}$/gm, "<hr>");

		// 标题（# ## ### #### ##### ######）
		html = html.replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>");
		html = html.replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>");
		html = html.replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>");
		html = html.replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>");
		html = html.replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>");
		html = html.replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>");

		// 引用块（> quote）
		html = html.replace(/^(?:&gt;|>)\s+(.+)$/gm, "<blockquote>$1</blockquote>");

		// 处理列表 - 使用占位符来分隔无序和有序列表
		// 无序列表（- 或 *）
		html = html.replace(/^[*-]\s+(.+)$/gm, "<li data-type='ul'>$1</li>");
		// 有序列表（1. 2. 等）
		html = html.replace(/^\d+\.\s+(.+)$/gm, "<li data-type='ol'>$1</li>");

		// 将连续的同类型列表项合并为列表
		// 先处理无序列表
		html = html.replace(/(<li data-type='ul'>[\s\S]*?<\/li>\n?)+/g, (match) => {
			const items = match.replace(/ data-type='ul'/g, "");
			return `<ul>${items}</ul>`;
		});
		// 再处理有序列表
		html = html.replace(/(<li data-type='ol'>[\s\S]*?<\/li>\n?)+/g, (match) => {
			const items = match.replace(/ data-type='ol'/g, "");
			return `<ol>${items}</ol>`;
		});

		// 行内代码（`code`）
		html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

		// 加粗（**text** 或 __text__）
		html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

		// 斜体（*text* 或 _text_）- 注意放在加粗之后
		html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
		html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

		// 删除线（~~text~~）
		html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

		// 链接（[text](url)）
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener">$1</a>',
		);

		// 换行处理
		html = html.replace(/\n\n/g, "</p><p>");
		html = html.replace(/\n/g, "<br>");

		// 恢复代码块
		codeBlocks.forEach((block, index) => {
			html = html.replace(`__CODE_BLOCK_${index}__`, block);
		});

		// 包裹段落（如果不是块级元素开头）
		const blockStart =
			html.startsWith("<pre>") ||
			html.startsWith("<h") ||
			html.startsWith("<ul>") ||
			html.startsWith("<ol>") ||
			html.startsWith("<blockquote>") ||
			html.startsWith("<hr>");
		if (!blockStart) {
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
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * 滚动到底部
	 * @private
	 */
	_scrollToBottom() {
		// 默认使用 chatArea 作为滚动容器
		const scrollContainer = this.options.scrollContainer || DOM.chatArea;
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
		DOM.messagesContainer.innerHTML = "";
	}
}

/**
 * 滚动对话区到底部（平滑滚动）
 * @param {Object} options - 配置选项
 * @param {boolean} options.instant - 是否使用即时滚动（用于历史消息加载）
 */
function scrollToBottom(options = {}) {
	// 注意：滚动容器是 #chat-area，而不是 #messages-container
	const scrollContainer = DOM.chatArea;
	if (!scrollContainer) return;

	const { instant = false } = options;

	// 使用双重 requestAnimationFrame 确保 DOM 完全渲染和布局完成
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			scrollContainer.scrollTo({
				top: scrollContainer.scrollHeight,
				behavior: instant ? "instant" : "smooth",
			});
		});
	});
}

/**
 * 创建流式文本渲染器实例
 * @param {HTMLElement} container - 目标容器元素
 * @param {Object} options - 配置选项
 * @returns {StreamingTextRenderer} - 渲染器实例
 */
function createStreamingRenderer(container, options = {}) {
	// 默认配置：自动滚动，使用 chatArea 作为滚动容器
	const defaultOptions = {
		showCursor: true,
		autoScroll: true,
		scrollContainer: DOM.chatArea,
		...options,
	};

	return new StreamingTextRenderer(container, defaultOptions);
}

/**
 * 显示空状态提示
 * 会先移除已有的空状态，保证只存在一个。
 */
function showEmptyState() {
	if (!DOM.messagesContainer) return;

	const existing = DOM.messagesContainer.querySelector(".chat-area-empty");
	if (existing) existing.remove();

	// 显示技能快捷区（新会话/空状态时显示）
	setSkillAreaVisible(true);

	// 注意：示例提示现在以打字机效果显示在输入框中
	// 由 TypewriterEffect 类管理，这里不再创建底部示例按钮

	// 创建空的空状态容器（保持布局一致性）
	const emptyState = document.createElement("div");
	emptyState.className = "chat-area-empty";
	DOM.messagesContainer.appendChild(emptyState);

	// 启动打字机效果
	if (typewriterEffect && DOM.messageInput) {
		const isEmpty = DOM.messageInput.value.trim() === "";
		const isFocused = document.activeElement === DOM.messageInput;
		if (isEmpty && !isFocused) {
			typewriterEffect.show();
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

	// 兼容新旧格式：可传入 messages 数组或 { messages, snapshots } 对象
	const messages = Array.isArray(history) ? history : history?.messages || [];

	if (!messages || messages.length === 0) {
		showEmptyState();
		return;
	}

	// 统计总轮次数（用于决定是否显示回退按钮）
	let totalTurns = 0;
	for (const msg of messages) {
		if (msg.role === "user" && typeof msg.content === "string") totalTurns++;
	}

	// 预先构建 tool_use_id -> tool_result 的映射，供渲染工具卡片时使用
	const toolResultMap = new Map();
	for (const msg of messages) {
		if (msg.role === "user" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_result" && block.tool_use_id) {
					const content = block.content;
					toolResultMap.set(
						block.tool_use_id,
						typeof content === "string" ? content : JSON.stringify(content),
					);
				}
			}
		}
	}

	let currentTurn = 0;

	// 遍历历史消息并渲染
	for (const message of messages) {
		if (message.role === "user") {
			// 渲染用户消息
			const userContent =
				typeof message.content === "string"
					? message.content
					: message.content?.[0]?.text || "";

			if (userContent) {
				// 用户文本消息（非 tool_result）才计入轮次
				if (typeof message.content === "string") {
					currentTurn++;
				}
				const showRewind = typeof message.content === "string";
				const userMessageEl = renderUserMessage(userContent, {
					turn: typeof message.content === "string" ? currentTurn : undefined,
					showRewind,
				});
				addMessageToContainer(userMessageEl);
			}
		} else if (message.role === "assistant") {
			// 渲染助手消息
			const assistantMessageEl = renderAssistantMessageContainer();
			const bubble = assistantMessageEl.querySelector(".message-bubble");

			// 渲染推理文本（_reasoning 字段由 agent-loop 在完整历史中保存）
			if (message._reasoning) {
				const reasoningBlock =
					assistantMessageEl.querySelector(".reasoning-block");
				const reasoningContentEl =
					assistantMessageEl.querySelector(".reasoning-content");
				const reasoningHeader =
					assistantMessageEl.querySelector(".reasoning-header");
				const reasoningTitleEl =
					assistantMessageEl.querySelector(".reasoning-title");
				const charCount = message._reasoning.length;
				const reasoningRenderer = createStreamingRenderer(reasoningContentEl, {
					showCursor: false,
				});
				reasoningRenderer.appendText(message._reasoning);
				reasoningRenderer.finish();
				reasoningBlock.classList.add("visible", "finished", "collapsed");
				reasoningHeader.setAttribute("aria-expanded", "false");
				if (reasoningTitleEl) {
					reasoningTitleEl.textContent = formatMessage("thinkingProcess", {
						count: charCount,
					});
				}
			}

			// 处理 content 数组
			if (Array.isArray(message.content)) {
				let textContent = "";
				const toolCalls = [];

				for (const block of message.content) {
					if (block.type === "text") {
						textContent += block.text || "";
					} else if (block.type === "tool_use") {
						toolCalls.push(block);
					}
				}

				// 渲染文本内容
				if (textContent) {
					const renderer = createStreamingRenderer(bubble, {
						showCursor: false,
					});
					renderer.appendText(textContent);
					renderer.finish();
				}

				// 渲染工具调用卡片（从后续 tool_result 消息中查找实际输出）
				if (toolCalls.length > 0) {
					const cardGroup = toolCardManager.createCardGroup();

					for (const toolCall of toolCalls) {
						toolCardManager.addToolCard(toolCall.id, toolCall.name);
						const actualOutput = toolResultMap.get(toolCall.id) ?? null;
						toolCardManager.completeToolCard(
							toolCall.id,
							toolCall.name,
							toolCall.input,
							actualOutput,
						);
					}

					addMessageToContainer(cardGroup);
					toolCardManager.finalizeCardGroup();
				}
			} else if (typeof message.content === "string") {
				const renderer = createStreamingRenderer(bubble, { showCursor: false });
				renderer.appendText(message.content);
				renderer.finish();
			}

			addMessageToContainer(assistantMessageEl);
		}
	}

	// 滚动到底部（使用即时滚动确保正确显示最新消息）
	scrollToBottom({ instant: true });

	console.log(`[Panel] Rendered ${messages.length} history messages`);
}

// ============================================================================
// 时间旅行：回退到指定轮次
// ============================================================================

/**
 * 处理回退按钮点击
 * 弹出确认对话框，确认后截断历史、恢复样式、重新渲染 UI
 *
 * @param {number} targetTurn - 要回退到的轮次号
 */
async function handleRewindClick(targetTurn) {
	if (AppState.agentStatus === "running") {
		console.warn("[Panel] Agent is running, cannot rewind");
		return;
	}

	const confirmed = confirm("回到这一轮？之后的对话和样式修改将被丢弃。");
	if (!confirmed) return;

	try {
		// 获取被回撤轮次的用户消息内容，以便恢复到输入框
		const userBubble = DOM.messagesContainer?.querySelector(
			`.message-user .message-bubble[data-turn="${targetTurn}"]`,
		);
		const rewoundMessage = userBubble?.firstChild?.textContent || "";

		const session = await import("./session.js");
		const { sendToContentScript } = await import("./tools.js");

		const domain = stateManager.get("currentDomain");
		const sessionId = stateManager.get("currentSessionId");
		if (!domain || !sessionId) {
			console.error("[Panel] Cannot rewind: no active session");
			return;
		}

		const result = await session.rewindToTurn(domain, sessionId, targetTurn);

		// 注入回退后的 CSS 到页面
		try {
			await sendToContentScript({
				tool: "load_session_css",
				args: { css: result.css || "" },
			});
		} catch (err) {
			console.warn("[Panel] Failed to load rewound CSS:", err.message);
		}

		setHasActiveStyles(!!result.css?.trim());

		// 重新渲染对话区
		renderHistoryMessages(result.messages);

		// 将回撤的用户输入恢复到输入框
		if (rewoundMessage && DOM.messageInput) {
			DOM.messageInput.value = rewoundMessage;
			DOM.messageInput.focus();
		}

		// 隐藏确认浮层（如果有）
		if (isConfirmationOverlayVisible()) {
			hideConfirmationOverlay(false);
		}

		console.log(`[Panel] Rewound to turn ${targetTurn}`);
	} catch (error) {
		console.error("[Panel] Rewind failed:", error);
	}
}

// ============================================================================
// 工具调用卡片渲染
// ============================================================================

/**
 * 工具名称映射表（友好的显示名称）
 */
const TOOL_DISPLAY_NAMES = {
	get_page_structure: "查看页面结构",
	grep: "搜索页面元素",
	apply_styles: "应用样式",
	get_user_profile: "获取用户画像",
	update_user_profile: "更新用户画像",
	load_skill: "加载知识",
	save_style_skill: "保存风格技能",
	list_style_skills: "列出风格技能",
	delete_style_skill: "删除风格技能",
	TodoWrite: "任务规划",
	Task: "子任务",
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

		const group = document.createElement("div");
		group.className = "tool-card-group";

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

		const card = document.createElement("div");
		card.className = "tool-card processing";
		card.dataset.toolId = toolId;
		card.dataset.toolName = toolName;

		const displayName = getToolDisplayName(toolName);
		const isTask = toolName === "Task";

		card.innerHTML = `
      <div class="tool-card-header">
        <div class="tool-card-title">
          <span class="tool-card-icon">${isTask ? iconHtml("bot", 14) : iconHtml("wrench", 14)}</span>
          <span class="tool-card-name">${displayName}</span>
        </div>
        <div class="tool-card-status processing">
          <span class="status-indicator">${iconHtml("loader", 12, "spin")}</span>
          <span class="status-text">${isTask ? "子智能体运行中…" : "进行中"}</span>
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
		const isTask = toolName === "Task";

		// 更新卡片状态
		card.classList.remove("processing");
		card.classList.add("completed", "collapsed");

		if (isTask) {
			// Task 子任务专属渲染
			card.classList.add("task-card");
			const taskTitle = input?.description
				? this.escapeHtml(input.description)
				: displayName;
			const agentType = input?.agent_type || "";
			const agentBadge = agentType
				? `<span class="task-card-badge">${this.escapeHtml(agentType)}</span>`
				: "";

			const summaryHtml = this.formatTaskOutput(output);

			card.innerHTML = `
        <div class="tool-card-header">
          <div class="tool-card-title">
            <span class="tool-card-icon">${iconHtml("bot", 14)}</span>
            <span class="tool-card-name">${taskTitle}</span>
            ${agentBadge}
          </div>
          <div class="tool-card-expand">${iconHtml("chevron-right", 12)}</div>
        </div>
        <div class="tool-card-body">
          ${summaryHtml}
        </div>
      `;
		} else {
			// 普通工具默认渲染
			const inputDisplay = this.formatInput(input);
			const outputDisplay = this.formatOutput(output);

			card.innerHTML = `
        <div class="tool-card-header">
          <div class="tool-card-title">
            <span class="tool-card-icon">${iconHtml("check-circle", 14)}</span>
            <span class="tool-card-name">${displayName}</span>
          </div>
          <div class="tool-card-expand">${iconHtml("chevron-right", 12)}</div>
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
		}

		// 绑定展开/折叠事件
		const header = card.querySelector(".tool-card-header");
		header.addEventListener("click", () => this.toggleCard(card));

		// 更新映射
		this.cardMap.set(toolId, card);
	}

	/**
	 * 切换卡片展开/折叠状态
	 * @param {HTMLElement} card - 卡片元素
	 */
	toggleCard(card) {
		const isCollapsed = card.classList.contains("collapsed");

		if (isCollapsed) {
			// 展开前，折叠同组的其他卡片
			if (this.currentCardGroup) {
				const allCards = this.currentCardGroup.querySelectorAll(".tool-card");
				allCards.forEach((c) => c.classList.add("collapsed"));
			}
			card.classList.remove("collapsed");
			card.classList.add("expanded");
		} else {
			card.classList.remove("expanded");
			card.classList.add("collapsed");
		}
	}

	/**
	 * 完成当前卡片组
	 */
	finalizeCardGroup() {
		if (this.currentCardGroup) {
			// 检查卡片组内是否有卡片
			const cards = this.currentCardGroup.querySelectorAll(".tool-card");
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
			const cssPreview =
				input.css.length > 50 ? input.css.substring(0, 50) + "..." : input.css;
			keyParams.push(`css: "${cssPreview}"`);
		}

		if (keyParams.length > 0) {
			return `<code>${keyParams.join(", ")}</code>`;
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

		// 转义HTML
		const escaped = this.escapeHtml(output);

		// 保留换行
		const formatted = escaped.replace(/\n/g, "<br>");

		return `<span class="tool-card-text">${formatted}</span>`;
	}

	/**
	 * 格式化子任务（Task）输出，尝试解析 JSON 以生成结构化摘要
	 * @param {string} output - 子任务输出文本
	 * @returns {string} - 格式化后的HTML
	 */
	formatTaskOutput(output) {
		if (!output) {
			return '<span class="tool-card-empty">(无输出)</span>';
		}

		// 尝试提取并解析 JSON（支持被 markdown 代码块包裹的情况）
		let parsed = null;
		try {
			const jsonMatch =
				output.match(/```(?:json)?\s*([\s\S]*?)```/) ||
				output.match(/(\{[\s\S]*\})/);
			if (jsonMatch) {
				parsed = JSON.parse(jsonMatch[1].trim());
			} else {
				parsed = JSON.parse(output.trim());
			}
		} catch (_) {
			// 非 JSON，退回纯文本显示
		}

		if (parsed && typeof parsed === "object") {
			// 结构化渲染（QualityAudit 格式）
			const parts = [];

			// 通过/失败 + 评分
			if ("passed" in parsed || "score" in parsed) {
				const passed = parsed.passed;
				const score = parsed.score;
				const passedHtml =
					passed !== undefined
						? `<span class="task-result-badge ${passed ? "pass" : "fail"}">${passed ? "✓ 通过" : "✗ 未通过"}</span>`
						: "";
				const scoreHtml =
					score !== undefined
						? `<span class="task-result-score">评分 <strong>${score}</strong>/10</span>`
						: "";
				if (passedHtml || scoreHtml) {
					parts.push(
						`<div class="task-result-row">${passedHtml}${scoreHtml}</div>`,
					);
				}
			}

			// 摘要
			if (parsed.summary) {
				parts.push(
					`<div class="task-result-summary">${this.escapeHtml(parsed.summary)}</div>`,
				);
			}

			// issues 统计
			if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
				const high = parsed.issues.filter((i) => i.severity === "high").length;
				const medium = parsed.issues.filter(
					(i) => i.severity === "medium",
				).length;
				const low = parsed.issues.filter((i) => i.severity === "low").length;
				const issueChips = [];
				if (high > 0)
					issueChips.push(
						`<span class="task-issue-chip high">${high} 严重</span>`,
					);
				if (medium > 0)
					issueChips.push(
						`<span class="task-issue-chip medium">${medium} 中等</span>`,
					);
				if (low > 0)
					issueChips.push(
						`<span class="task-issue-chip low">${low} 轻微</span>`,
					);
				if (issueChips.length > 0) {
					parts.push(
						`<div class="task-issue-chips">${issueChips.join("")}</div>`,
					);
				}
			}

			// 折叠的原始输出
			const rawEscaped = this.escapeHtml(output);
			parts.push(`
        <details class="task-raw-details">
          <summary>查看完整报告</summary>
          <pre class="task-raw-output">${rawEscaped}</pre>
        </details>
      `);

			return parts.join("");
		}

		// 纯文本：超过 300 字时截断 + 折叠展开
		const escaped = this.escapeHtml(output);
		if (output.length > 300) {
			const preview = this.escapeHtml(output.substring(0, 300));
			return `
        <div class="task-text-preview">${preview.replace(/\n/g, "<br>")}…</div>
        <details class="task-raw-details">
          <summary>查看完整输出</summary>
          <pre class="task-raw-output">${escaped}</pre>
        </details>
      `;
		}

		return `<div class="task-text-preview">${escaped.replace(/\n/g, "<br>")}</div>`;
	}

	/**
	 * 转义HTML特殊字符
	 * @param {string} text - 原始文本
	 * @returns {string} - 转义后的文本
	 */
	escapeHtml(text) {
		const div = document.createElement("div");
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
		return (
			this.currentCardGroup !== null &&
			this.currentCardGroup.querySelectorAll(".tool-card").length > 0
		);
	}
}

// ============================================================================
// 任务列表卡片渲染
// ============================================================================

/**
 * 任务状态图标映射
 */
const TODO_STATUS_ICONS = {
	pending: iconHtml("clock", 13),
	in_progress: iconHtml("refresh", 13, "spin"),
	completed: iconHtml("check-circle", 13),
};

/**
 * 任务卡片管理器
 * 用于管理悬浮在输入框上方的任务列表显示
 * 支持两种模式：
 * - 确认模式：用户可编辑、增删步骤后确认执行
 * - 进度模式：只读显示任务执行进度
 */
class TodoCardManager {
	constructor() {
		/** @type {HTMLElement|null} 当前任务卡片容器 */
		this.todoContainer = null;
		/** @type {HTMLElement|null} 输入框区域引用 */
		this.inputArea = null;
	}

	/**
	 * 获取输入框区域元素
	 * @returns {HTMLElement|null}
	 */
	getInputArea() {
		if (!this.inputArea) {
			this.inputArea = document.getElementById("input-area");
		}
		return this.inputArea;
	}

	/**
	 * 创建任务列表容器并插入到输入框上方
	 * @returns {HTMLElement} 任务卡片容器
	 */
	createTodoContainer() {
		if (this.todoContainer) {
			this.todoContainer.remove();
		}

		const container = document.createElement("div");
		container.className = "todo-floating-container";

		const inputArea = this.getInputArea();
		if (inputArea && inputArea.parentNode) {
			inputArea.parentNode.insertBefore(container, inputArea);
		}

		this.todoContainer = container;
		return container;
	}

	/**
	 * 更新任务列表显示
	 * @param {Array<{id: string, content: string, status: string}>} todos - 任务列表
	 * @param {boolean} [awaitingConfirmation=false] - 是否处于等待确认状态
	 */
	updateTodos(todos, awaitingConfirmation = false) {
		if (!todos || todos.length === 0) {
			this.hide();
			return;
		}

		if (!this.todoContainer) {
			this.createTodoContainer();
		}

		if (awaitingConfirmation) {
			this._renderConfirmationMode(todos);
		} else {
			this._renderProgressMode(todos);
		}
	}

	/**
	 * 渲染确认模式：可编辑的任务计划
	 * @param {Array} todos
	 * @private
	 */
	_renderConfirmationMode(todos) {
		const todosHtml = todos
			.map(
				(todo, index) => `
      <div class="todo-item todo-item-editable" data-index="${index}">
        <span class="todo-drag-handle">⠿</span>
        <input type="text" class="todo-edit-input" value="${this._escapeAttr(todo.content)}" />
        <button class="todo-delete-btn" data-index="${index}" title="删除此步骤">×</button>
      </div>
    `,
			)
			.join("");

		this.todoContainer.innerHTML = `
      <div class="todo-card-header">
        <span class="todo-card-title">📋 请确认任务计划</span>
        <span class="todo-step-count">${todos.length} 个步骤</span>
      </div>
      <div class="todo-hint">可编辑、增删步骤后确认执行</div>
      <div class="todo-list todo-list-editable">
        ${todosHtml}
      </div>
      <button class="todo-add-btn">+ 添加步骤</button>
      <div class="todo-confirm-actions">
        <button class="todo-cancel-btn">取消</button>
        <button class="todo-confirm-btn">确认执行</button>
      </div>
    `;

		this.todoContainer.classList.add("todo-confirmation-mode");
		this._wireConfirmationEvents();
	}

	/**
	 * 绑定确认模式的交互事件
	 * @private
	 */
	_wireConfirmationEvents() {
		const container = this.todoContainer;
		if (!container) return;

		// 删除按钮
		container.querySelectorAll(".todo-delete-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const item = e.target.closest(".todo-item");
				if (item) {
					item.remove();
					this._updateStepCount();
				}
			});
		});

		// 添加步骤按钮
		const addBtn = container.querySelector(".todo-add-btn");
		if (addBtn) {
			addBtn.addEventListener("click", () => {
				const list = container.querySelector(".todo-list");
				if (!list) return;
				const newItem = document.createElement("div");
				newItem.className = "todo-item todo-item-editable";
				newItem.innerHTML = `
          <span class="todo-drag-handle">⠿</span>
          <input type="text" class="todo-edit-input" value="" placeholder="输入步骤描述..." />
          <button class="todo-delete-btn" title="删除此步骤">×</button>
        `;
				newItem
					.querySelector(".todo-delete-btn")
					.addEventListener("click", () => {
						newItem.remove();
						this._updateStepCount();
					});
				list.appendChild(newItem);
				newItem.querySelector(".todo-edit-input").focus();
				this._updateStepCount();
			});
		}

		// 确认按钮
		const confirmBtn = container.querySelector(".todo-confirm-btn");
		if (confirmBtn) {
			confirmBtn.addEventListener("click", async () => {
				const inputs = container.querySelectorAll(".todo-edit-input");
				const editedTodos = [];
				inputs.forEach((input) => {
					const content = input.value.trim();
					if (content) {
						editedTodos.push({ content, status: "pending" });
					}
				});

				if (editedTodos.length === 0) {
					const { rejectPlan } = await import("./todo-manager.js");
					rejectPlan();
					return;
				}

				const { confirmPlan } = await import("./todo-manager.js");
				confirmPlan(editedTodos);
			});
		}

		// 取消按钮
		const cancelBtn = container.querySelector(".todo-cancel-btn");
		if (cancelBtn) {
			cancelBtn.addEventListener("click", async () => {
				const { rejectPlan } = await import("./todo-manager.js");
				rejectPlan();
			});
		}

		// Enter 键在输入框中按下时移动到下一个
		container.querySelectorAll(".todo-edit-input").forEach((input) => {
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					const nextItem = input.closest(".todo-item")?.nextElementSibling;
					if (nextItem) {
						nextItem.querySelector(".todo-edit-input")?.focus();
					} else {
						container.querySelector(".todo-add-btn")?.click();
					}
				}
			});
		});
	}

	/**
	 * 更新步骤计数显示
	 * @private
	 */
	_updateStepCount() {
		const countEl = this.todoContainer?.querySelector(".todo-step-count");
		const itemCount =
			this.todoContainer?.querySelectorAll(".todo-item").length || 0;
		if (countEl) {
			countEl.textContent = `${itemCount} 个步骤`;
		}
	}

	/**
	 * 渲染进度模式：只读显示执行进度
	 * @param {Array} todos
	 * @private
	 */
	_renderProgressMode(todos) {
		const allCompleted = todos.every((t) => t.status === "completed");
		const completed = todos.filter((t) => t.status === "completed").length;
		const total = todos.length;
		const progressPercent =
			total > 0 ? Math.round((completed / total) * 100) : 0;

		const todosHtml = todos
			.map((todo) => {
				const icon = TODO_STATUS_ICONS[todo.status] || iconHtml("clock", 13);
				const statusClass = `todo-item-${todo.status}`;
				return `
        <div class="todo-item ${statusClass}">
          <span class="todo-icon">${icon}</span>
          <span class="todo-content">${this.escapeHtml(todo.content)}</span>
        </div>
      `;
			})
			.join("");

		this.todoContainer.innerHTML = `
      <div class="todo-card-header">
        <span class="todo-card-title">📋 任务进度</span>
        <span class="todo-progress">${completed}/${total}</span>
      </div>
      <div class="todo-progress-bar">
        <div class="todo-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      <div class="todo-list">
        ${todosHtml}
      </div>
    `;

		this.todoContainer.classList.remove("todo-confirmation-mode");

		if (allCompleted) {
			this.todoContainer.classList.add("all-completed");
			setTimeout(() => {
				this.hide();
			}, 1500);
		}
	}

	/**
	 * 隐藏任务列表
	 */
	hide() {
		if (this.todoContainer) {
			this.todoContainer.remove();
			this.todoContainer = null;
		}
	}

	/**
	 * 清除任务列表（别名）
	 */
	clear() {
		this.hide();
	}

	/**
	 * 转义HTML特殊字符
	 * @param {string} text - 原始文本
	 * @returns {string} - 转义后的文本
	 */
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * 转义 HTML 属性值
	 * @param {string} text
	 * @returns {string}
	 * @private
	 */
	_escapeAttr(text) {
		return text
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}
}

/**
 * 全局工具卡片管理器实例
 */
const toolCardManager = new ToolCardManager();

/**
 * 全局任务卡片管理器实例
 */
const todoCardManager = new TodoCardManager();

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

/**
 * 在消息容器中创建子智能体活动面板，并返回对应的子 uiCallbacks
 * @param {string} taskId - Task 工具调用 ID
 * @param {Object} input - Task 工具输入（agent_type、description 等）
 * @returns {{ uiCallbacks: Object }}
 */
function createSubAgentPanel(taskId, input) {
	const agentType = input?.agent_type || "SubAgent";
	const description = input?.description || "";

	// 外层面板容器
	const panel = document.createElement("div");
	panel.className = "subagent-panel";
	panel.dataset.taskId = taskId;

	// 面板头部（标签 + 折叠按钮）
	const header = document.createElement("div");
	header.className = "subagent-panel-header";
	header.innerHTML = `
    <span class="subagent-panel-icon">${iconHtml("bot", 14)}</span>
    <span class="subagent-panel-label">${escapeHtml(agentType)}</span>
    ${description ? `<span class="subagent-panel-desc">${escapeHtml(description)}</span>` : ""}
    <span class="icon icon-chevron-down subagent-panel-toggle" style="width:12px;height:12px" aria-hidden="true"></span>
  `;
	panel.appendChild(header);

	// 面板主体（内嵌输出区域）
	const body = document.createElement("div");
	body.className = "subagent-panel-body";
	panel.appendChild(body);

	// 折叠/展开交互
	header.addEventListener("click", () => {
		panel.classList.toggle("collapsed");
	});

	addMessageToContainer(panel);

	// 子智能体独立的文本气泡
	const textBubble = document.createElement("div");
	textBubble.className = "subagent-text-bubble";
	body.appendChild(textBubble);

	const subStreamingRenderer = createStreamingRenderer(textBubble);
	let hasText = false;

	// 子智能体独立的工具卡片管理器
	const subCardManager = new ToolCardManager();

	const subToolInputMap = new Map();

	const uiCallbacks = {
		appendText: (delta) => {
			if (!delta) return;
			if (!hasText) {
				hasText = true;
				textBubble.classList.add("has-content");
			}
			subStreamingRenderer.appendText(delta);
		},

		appendReasoning: (_delta) => {
			// SubAgent 推理内容暂不展示，避免界面过于拥挤
		},

		showToolCall: (block) => {
			if (block.type !== "tool_use") return;
			subToolInputMap.set(block.id, block.input);
			if (!subCardManager.hasActiveCardGroup()) {
				const group = subCardManager.createCardGroup();
				body.appendChild(group);
				scrollToBottom();
			}
			subCardManager.addToolCard(block.id, block.name);
			scrollToBottom();
		},

		showToolExecuting: (_toolName) => {},

		showToolResult: (toolId, output) => {
			const card = subCardManager.cardMap.get(toolId);
			const toolName = card?.dataset.toolName || null;
			const toolInput = subToolInputMap.get(toolId) ?? null;
			subCardManager.completeToolCard(toolId, toolName, toolInput, output);
		},

		finalize: () => {
			subStreamingRenderer.finish();
			subCardManager.finalizeCardGroup();
			panel.classList.add("done");
		},
	};

	return { panel, body, uiCallbacks };
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
		const inputArea = document.getElementById("input-area");
		if (inputArea && inputArea.parentNode) {
			inputArea.parentNode.insertBefore(this.overlay, inputArea);
		}

		// 启动超时计时器
		this._startTimeout();

		console.log("[ConfirmationOverlay] 浮层已显示，样式应用次数:", applyCount);
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
				this.overlay.classList.add("fade-out");

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
		const overlay = document.createElement("div");
		overlay.className = "confirmation-overlay";

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
                <span class="icon icon-chevron-down arrow" style="width:10px;height:10px" aria-hidden="true"></span>
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
			this.dropdown = overlay.querySelector(".confirmation-dropdown");
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
		overlay.addEventListener("click", (e) => {
			const target = e.target.closest("[data-action]");
			if (!target) return;

			const action = target.dataset.action;

			switch (action) {
				case "confirm":
				case "confirm-all":
					// 确认 - 隐藏浮层
					this.hide(true);
					if (this.onConfirm) {
						this.onConfirm();
					}
					break;

				case "undo":
				case "undo-last":
					// 撤销最后一步
					this.hide(false);
					if (this.onUndo) {
						this.onUndo();
					}
					break;

				case "undo-all":
					// 全部撤销
					this.hide(false);
					if (this.onUndoAll) {
						this.onUndoAll();
					}
					break;

				case "dropdown":
					// 切换下拉菜单
					this._toggleDropdown();
					break;
			}
		});

		// 点击外部关闭下拉菜单
		document.addEventListener("click", (e) => {
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

		const isHidden = this.dropdown.classList.contains("hidden");

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

		this.dropdown.classList.remove("hidden");

		// 更新触发按钮状态
		const trigger = this.overlay.querySelector(
			".confirmation-dropdown-trigger",
		);
		if (trigger) {
			trigger.classList.add("open");
		}
	}

	/**
	 * 关闭下拉菜单
	 * @private
	 */
	_closeDropdown() {
		if (!this.dropdown) return;

		this.dropdown.classList.add("hidden");

		// 更新触发按钮状态
		const trigger = this.overlay.querySelector(
			".confirmation-dropdown-trigger",
		);
		if (trigger) {
			trigger.classList.remove("open");
		}
	}

	/**
	 * 启动超时计时器
	 * @private
	 */
	_startTimeout() {
		const startTime = Date.now();
		const progressBar = this.overlay?.querySelector(
			".confirmation-timeout-bar",
		);

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
			console.log("[ConfirmationOverlay] 超时自动隐藏");
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
		message: "API Key 无效，请检查设置",
		actionText: "去设置→",
		action: "settings",
	},
	NETWORK_ERROR: {
		message: "网络错误，请检查网络连接",
		actionText: "重试",
		action: "retry",
	},
	API_ERROR: {
		message: "API 调用失败",
		actionText: "重试",
		action: "retry",
	},
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
		console.error("[Panel] Unknown error type:", errorType);
		return;
	}

	// 设置错误消息
	const message = options.customMessage || config.message;
	DOM.errorBannerMessage.textContent = message;

	// 设置操作按钮
	if (config.actionText && config.action) {
		DOM.errorBannerAction.textContent = config.actionText;
		DOM.errorBannerAction.classList.remove("hidden");
		DOM.errorBannerAction.dataset.action = config.action;

		// 如果是重试操作，保存回调
		if (config.action === "retry" && options.onRetry) {
			DOM.errorBannerAction.dataset.hasCallback = "true";
			// 使用闭包保存回调
			DOM.errorBannerAction._retryCallback = options.onRetry;
		} else {
			DOM.errorBannerAction.dataset.hasCallback = "false";
			DOM.errorBannerAction._retryCallback = null;
		}
	} else {
		DOM.errorBannerAction.classList.add("hidden");
	}

	// 显示横幅
	DOM.errorBanner.classList.remove("hidden");

	// 更新状态指示灯为错误状态
	updateStatusIndicator("error");

	console.log("[Panel] Error banner shown:", errorType, message);
}

/**
 * 隐藏错误横幅
 */
function hideErrorBanner() {
	if (!DOM.errorBanner) return;

	DOM.errorBanner.classList.add("hidden");

	// 清除重试回调
	if (DOM.errorBannerAction) {
		DOM.errorBannerAction._retryCallback = null;
	}

	// 恢复状态指示灯
	if (AppState.agentStatus === "error") {
		updateStatusIndicator("idle");
	}

	console.log("[Panel] Error banner hidden");
}

/**
 * 初始化错误横幅事件
 */
function initErrorBanner() {
	// 关闭按钮
	if (DOM.errorBannerClose) {
		DOM.errorBannerClose.addEventListener("click", () => {
			hideErrorBanner();
		});
	}

	// 操作按钮
	if (DOM.errorBannerAction) {
		DOM.errorBannerAction.addEventListener("click", () => {
			const action = DOM.errorBannerAction.dataset.action;

			switch (action) {
				case "settings":
					// 跳转到设置页
					hideErrorBanner();
					initSettingsView();
					switchView("settings");
					break;

				case "retry":
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
	addMessageToContainer,
	applyGlobalState,
	// 操作确认浮层导出
	ConfirmationOverlay,
	clearAttachedImages,
	clearErrorState,
	clearMessages,
	clearPickedElement,
	completeToolCard,
	computeGlobalState,
	confirmationOverlay,
	createStreamingRenderer,
	createToolCard,
	createToolCardGroup,
	finalizeToolCardGroup,
	// 图片上传导出
	getAttachedImages,
	getConfirmationOverlay,
	// 元素选择器导出
	getPickedElementInfo,
	getToolDisplayName,
	hasAttachedImages,
	hideConfirmationOverlay,
	hideErrorBanner,
	initStateSync,
	isConfirmationOverlayVisible,
	renderAssistantMessageContainer,
	renderUserMessage,
	StreamingTextRenderer,
	scrollToBottom,
	setApiKeyStatus,
	setErrorState,
	setHasActiveStyles,
	setProcessingState,
	setRestrictedPageState,
	showConfirmationOverlay,
	showEmptyState,
	showError,
	// 错误横幅导出
	showErrorBanner,
	stateManager,
	switchView,
	// 工具调用卡片导出
	ToolCardManager,
	toolCardManager,
	updateInputAreaState,
	updateStatusIndicator,
};
