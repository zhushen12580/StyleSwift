/**
 * StyleSwift Welcome Page
 * 欢迎引导流程：功能介绍 → 置顶图标 → 风格选择
 */

// ============================================================
// 1. 国际化配置
// ============================================================

const i18n = {
	zh_CN: {
		welcomeTitle: "欢迎使用 数字女娲",
		stepFeatures: "功能介绍",
		stepPin: "置顶图标",
		stepStyles: "设计风格",
		featuresTitle: "一句话，给常逛的网页换皮肤",
		featuresSubtitle: "数字女娲 让你用自然语言控制网页样式",
		feature1Title: "网页风格化",
		feature1Desc: "一键为任意网站换上精美主题，打造个性化浏览体验",
		feature2Title: "样式质检",
		feature2Desc: "智能检测样式问题，确保可读性和视觉一致性",
		feature3Title: "精准编辑",
		feature3Desc: "点选任意元素，精准定位并修改特定样式",
		feature4Title: "风格技能复用",
		feature4Desc: "保存成功的风格方案，跨网站一键复用",
		demoHint: "GIF 演示",
		btnNext: "下一步",
		btnSkip: "跳过",
		btnBack: "上一步",
		btnStart: "开始使用",
		pinTitle: "置顶扩展图标",
		pinSubtitle: "将 数字女娲 固定到工具栏，方便随时使用",
		pinCallout: "固定到工具栏",
		pinStep1Title: "点击拼图图标",
		pinStep1Desc: "在浏览器工具栏右侧找到拼图形状的扩展图标",
		pinStep2Title: "找到 数字女娲",
		pinStep2Desc: '在扩展列表中找到"数字女娲"',
		pinStep3Title: "点击图钉固定",
		pinStep3Desc: "点击旁边的图钉图标，将其固定到工具栏",
		detectWaiting: "正在检测置顶状态...",
		detectSuccess: "已成功置顶！",
		detectHint: "请按照上述步骤将插件固定到工具栏",
		detectSuccessHint: "太棒了！插件已成功固定到工具栏",
		celebrateTitle: "设置成功！",
		celebrateMessage: "插件已固定到工具栏，随时可以开始使用",
		celebrateButton: "开始探索",
		stylesTitle: "探索设计风格",
		stylesSubtitle: "选择一个喜欢的风格，立即开始你的定制之旅",
		stylePrompt: "风格提示词",
		btnCopy: "复制",
		btnClose: "关闭",
		btnUseStyle: "使用此风格",
		copied: "已复制",
	},
	en: {
		welcomeTitle: "Welcome to StyleSwift",
		stepFeatures: "Features",
		stepPin: "Pin Icon",
		stepStyles: "Styles",
		featuresTitle: "Transform Any Webpage with a Single Sentence",
		featuresSubtitle:
			"StyleSwift lets you control webpage styles with natural language",
		feature1Title: "Webpage Styling",
		feature1Desc:
			"Transform any website with beautiful themes for a personalized browsing experience",
		feature2Title: "Style Quality Check",
		feature2Desc:
			"Intelligently detect style issues to ensure readability and visual consistency",
		feature3Title: "Precision Editing",
		feature3Desc:
			"Click any element to precisely target and modify specific styles",
		feature4Title: "Style Skill Reuse",
		feature4Desc:
			"Save successful style solutions and reuse them across websites with one click",
		demoHint: "GIF Demo",
		btnNext: "Next",
		btnSkip: "Skip",
		btnBack: "Back",
		btnStart: "Get Started",
		pinTitle: "Pin Extension Icon",
		pinSubtitle: "Pin StyleSwift to your toolbar for quick access anytime",
		pinCallout: "Pin to toolbar",
		pinStep1Title: "Click puzzle icon",
		pinStep1Desc:
			"Find the puzzle-shaped extension icon on the right side of browser toolbar",
		pinStep2Title: "Find StyleSwift",
		pinStep2Desc: 'Find "StyleSwift" in the extension list',
		pinStep3Title: "Click pin icon",
		pinStep3Desc: "Click the pin icon next to it to pin it to the toolbar",
		detectWaiting: "Detecting pin status...",
		detectSuccess: "Successfully pinned!",
		detectHint: "Please follow the steps above to pin the extension to toolbar",
		detectSuccessHint: "Great! Extension is pinned to toolbar",
		celebrateTitle: "Setup Complete!",
		celebrateMessage: "Extension pinned to toolbar, ready to use anytime",
		celebrateButton: "Start Exploring",
		stylesTitle: "Explore Design Styles",
		stylesSubtitle:
			"Choose a style you like and start your customization journey",
		stylePrompt: "Style Prompt",
		btnCopy: "Copy",
		btnClose: "Close",
		btnUseStyle: "Use This Style",
		copied: "Copied",
	},
};

// 功能对应的GIF演示数据
const FEATURE_DEMOS = [
	{
		title: "网页风格化",
		gif: "../images/网页风格化压缩.gif",
		thumbnail: "../images/网页风格化压缩.gif",
	},
	{
		title: "样式质检",
		gif: "../images/质检压缩.gif",
		thumbnail: "../images/质检压缩.gif",
	},
	{
		title: "精准编辑",
		gif: "../images/精准编辑压缩.gif",
		thumbnail: "../images/精准编辑压缩.gif",
	},
	{
		title: "风格技能复用",
		gif: "../images/风格复用.gif",
		thumbnail: "../images/风格复用.gif",
	},
];

// 获取当前语言
function getLocale() {
	const browserLang = navigator.language || navigator.languages?.[0] || "en";
	return browserLang.startsWith("zh") ? "zh_CN" : "en";
}

// 获取翻译文本
function t(key) {
	const locale = getLocale();
	return i18n[locale]?.[key] || i18n.en[key] || key;
}

// ============================================================
// 2. 预设风格数据
// ============================================================

const PRESET_STYLES = [
	{
		id: "dark-mode",
		name: "深色模式",
		nameEn: "Dark Mode",
		desc: "护眼深色主题，适合夜间浏览",
		descEn: "Eye-friendly dark theme, perfect for night browsing",
		prompt:
			"将页面切换为深色模式，背景使用深色，文字使用浅色，保持良好的对比度，减少眼睛疲劳",
		preview: { bg: "#1a1a2e", text: "#e8e8e8" },
	},
	{
		id: "light-minimal",
		name: "极简白",
		nameEn: "Minimal White",
		desc: "干净简约的白色主题",
		descEn: "Clean and minimalist white theme",
		prompt:
			"极简白色主题，去除多余装饰，使用大量留白，字体简洁现代，营造清爽干净的阅读体验",
		preview: { bg: "#fafafa", text: "#333" },
	},
	{
		id: "cyberpunk",
		name: "赛博朋克",
		nameEn: "Cyberpunk",
		desc: "未来科技感，霓虹配色",
		descEn: "Futuristic tech aesthetic with neon colors",
		prompt:
			"赛博朋克风格，使用霓虹蓝紫配色，添加发光边框效果，字体使用科技感字体，营造未来都市氛围",
		preview: { bg: "#0a0a0a", text: "#00ffcc" },
	},
	{
		id: "newspaper",
		name: "旧报纸",
		nameEn: "Old Newspaper",
		desc: "复古报纸风格，怀旧阅读体验",
		descEn: "Vintage newspaper style, nostalgic reading experience",
		prompt:
			"旧报纸风格，使用泛黄的纸张背景，衬线字体，黑色文字，添加纸张纹理效果，营造复古新闻阅读体验",
		preview: { bg: "#f4e4c1", text: "#2d2d2d" },
	},
	{
		id: "nature",
		name: "自然森林",
		nameEn: "Nature Forest",
		desc: "清新自然的绿色主题",
		descEn: "Fresh and natural green theme",
		prompt:
			"自然森林主题，使用深绿色背景，浅绿色点缀，自然纹理元素，营造清新自然的浏览氛围",
		preview: { bg: "#2d5a27", text: "#90ee90" },
	},
	{
		id: "ocean",
		name: "海洋蓝",
		nameEn: "Ocean Blue",
		desc: "深邃海洋主题，平静放松",
		descEn: "Deep ocean theme, calm and relaxing",
		prompt:
			"海洋蓝主题，使用深海蓝配色，添加波浪渐变效果，营造深邃平静的浏览体验",
		preview: { bg: "#006994", text: "#e0f7fa" },
	},
	{
		id: "sunset",
		name: "日落橙",
		nameEn: "Sunset Orange",
		desc: "温暖活力的橙色调",
		descEn: "Warm and vibrant orange tones",
		prompt: "日落橙主题，使用温暖的橙红配色，渐变背景，营造活力温暖的浏览体验",
		preview: { bg: "#ff6b35", text: "#fff5f0" },
	},
	{
		id: "midnight",
		name: "午夜紫",
		nameEn: "Midnight Purple",
		desc: "神秘优雅的紫色调",
		descEn: "Mysterious and elegant purple tones",
		prompt:
			"午夜紫主题，使用深紫色背景，淡紫色点缀，营造神秘优雅的夜间浏览体验",
		preview: { bg: "#0f0f23", text: "#9575cd" },
	},
];

// ============================================================
// 3. 页面状态管理
// ============================================================

let currentPage = 1;
let currentFeatureIndex = 0;
let hasPlayedCelebrate = false;

// 页面元素
const pages = {
	1: document.getElementById("page-features"),
	2: document.getElementById("page-pin"),
	3: document.getElementById("page-styles"),
};

const steps = document.querySelectorAll(".step");

// ============================================================
// 4. 页面导航功能
// ============================================================

function showPage(pageNum) {
	// 隐藏所有页面
	Object.values(pages).forEach((page) => {
		if (page) page.classList.remove("active");
	});

	// 显示当前页面
	if (pages[pageNum]) {
		pages[pageNum].classList.add("active");
	}

	// 更新进度条
	steps.forEach((step, index) => {
		const stepNum = index + 1;
		step.classList.remove("active", "completed");
		if (stepNum < pageNum) {
			step.classList.add("completed");
		} else if (stepNum === pageNum) {
			step.classList.add("active");
		}
	});

	currentPage = pageNum;

	// 渲染风格卡片（如果是第三页）
	if (pageNum === 3) {
		renderStyleCards();
	}
}

// 页面1: 功能点点击切换
function initFeatureList() {
	const featureItems = document.querySelectorAll(".feature-item");

	featureItems.forEach((item) => {
		item.addEventListener("click", () => {
			const index = parseInt(item.dataset.feature);

			// 更新活跃状态
			featureItems.forEach((fi) => fi.classList.remove("active"));
			item.classList.add("active");

			// 更新当前功能索引
			currentFeatureIndex = index;

			// 更新右侧演示内容
			updateDemoContent(index);
		});
	});
}

function updateDemoContent(index) {
	const demoTitle = document.querySelector(".demo-title");
	const demoPlaceholder = document.getElementById("demo-placeholder");

	// 更新标题
	if (demoTitle) {
		const titles = [
			t("feature1Title"),
			t("feature2Title"),
			t("feature3Title"),
			t("feature4Title"),
		];
		demoTitle.textContent = titles[index] || "";
	}

	// 更新 GIF 演示
	if (demoPlaceholder && FEATURE_DEMOS[index]?.gif) {
		const demo = FEATURE_DEMOS[index];
		demoPlaceholder.innerHTML = `
			<img src="${demo.gif}" alt="${demo.title}" class="demo-gif" />
		`;
	}
}

// 页面1: 下一步按钮
document
	.querySelector("#page-features .btn-next")
	?.addEventListener("click", () => {
		showPage(2);
		startPinnedDetection();
	});

// 页面2: 置顶检测
async function startPinnedDetection() {
	const detectionWaiting = document.getElementById("detection-waiting");
	const detectionSuccess = document.getElementById("detection-success");
	const detectionHint = document.getElementById("detection-hint");
	const pinDetection = document.getElementById("pin-detection");
	const btnNextPin = document.getElementById("btn-next-pin");

	if (!detectionWaiting || !detectionSuccess) return;

	// 检查是否支持 getUserSettings API (Chrome 116+)
	if (
		typeof chrome !== "undefined" &&
		chrome.action &&
		chrome.action.getUserSettings
	) {
		try {
			const settings = await chrome.action.getUserSettings();

			if (settings.isOnToolbar) {
				// 已置顶，显示成功状态
				showDetectionSuccess();
			} else {
				// 未置顶，开始轮询检测
				startPinningPoll();
			}
		} catch (err) {
			// API不可用，显示等待状态
			console.log("getUserSettings API not available:", err);
			showWaitingState();
		}
	} else {
		// API不可用，使用轮询检测
		startPinningPoll();
	}
}

function startPinningPoll() {
	let pollCount = 0;
	const maxPolls = 30; // 最多轮询30次（约15秒）

	const pollInterval = setInterval(async () => {
		pollCount++;

		try {
			if (
				typeof chrome !== "undefined" &&
				chrome.action &&
				chrome.action.getUserSettings
			) {
				const settings = await chrome.action.getUserSettings();

				if (settings.isOnToolbar) {
					clearInterval(pollInterval);
					showDetectionSuccess();
					return;
				}
			}

			// 超过最大轮询次数，停止轮询
			if (pollCount >= maxPolls) {
				clearInterval(pollInterval);
				showWaitingState();
			}
		} catch (err) {
			// 忽略错误，继续轮询
			if (pollCount >= maxPolls) {
				clearInterval(pollInterval);
				showWaitingState();
			}
		}
	}, 500);
}

function showDetectionSuccess() {
	const detectionWaiting = document.getElementById("detection-waiting");
	const detectionSuccess = document.getElementById("detection-success");
	const detectionHint = document.getElementById("detection-hint");
	const pinDetection = document.getElementById("pin-detection");
	const btnNextPin = document.getElementById("btn-next-pin");

	if (detectionWaiting) detectionWaiting.classList.add("hidden");
	if (detectionSuccess) detectionSuccess.classList.remove("hidden");
	if (detectionHint) detectionHint.textContent = t("detectSuccessHint");
	if (pinDetection) pinDetection.classList.add("success");

	// 播放撒花动画
	if (!hasPlayedCelebrate) {
		hasPlayedCelebrate = true;
		playConfetti();
		showCelebrationOverlay();
	}
}

function showWaitingState() {
	const detectionWaiting = document.getElementById("detection-waiting");
	const detectionSuccess = document.getElementById("detection-success");

	// 保持等待状态，用户可以手动点击下一步
	if (detectionWaiting) detectionWaiting.classList.remove("hidden");
	if (detectionSuccess) detectionSuccess.classList.add("hidden");
}

// ============================================================
// 5. 撒花动画
// ============================================================

function playConfetti() {
	const container = document.getElementById("confetti-container");
	if (!container) return;

	const colors = [
		"color-1",
		"color-2",
		"color-3",
		"color-4",
		"color-5",
		"color-6",
		"color-7",
		"color-8",
	];
	const shapes = ["square", "circle", "ribbon"];
	const confettiCount = 80;

	for (let i = 0; i < confettiCount; i++) {
		setTimeout(() => {
			createConfetti(container, colors, shapes);
		}, i * 30); // 错开创建时间
	}
}

function createConfetti(container, colors, shapes) {
	const confetti = document.createElement("div");
	const color = colors[Math.floor(Math.random() * colors.length)];
	const shape = shapes[Math.floor(Math.random() * shapes.length)];
	const startX = Math.random() * 100;
	const duration = 2 + Math.random() * 2;
	const size = 8 + Math.random() * 8;

	confetti.className = `confetti ${shape} ${color}`;
	confetti.style.cssText = `
    left: ${startX}%;
    width: ${size}px;
    height: ${size}px;
    animation-duration: ${duration}s;
  `;

	container.appendChild(confetti);

	// 动画结束后移除
	setTimeout(() => {
		confetti.remove();
	}, duration * 1000);
}

function showCelebrationOverlay() {
	const overlay = document.createElement("div");
	overlay.className = "celebration-overlay";
	overlay.innerHTML = `
    <div class="celebration-content">
      <div class="celebration-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="celebration-title">${t("celebrateTitle")}</h2>
      <p class="celebration-message">${t("celebrateMessage")}</p>
      <div class="celebration-actions">
        <button type="button" class="btn-primary" id="btn-celebrate-next">${t("celebrateButton")}</button>
      </div>
    </div>
  `;

	document.body.appendChild(overlay);

	// 点击按钮跳转下一页
	const btnNext = overlay.querySelector("#btn-celebrate-next");
	btnNext?.addEventListener("click", () => {
		overlay.remove();
		showPage(3);
	});

	// 点击背景关闭
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			overlay.remove();
		}
	});

	// 3秒后自动跳转
	setTimeout(() => {
		if (document.body.contains(overlay)) {
			overlay.remove();
			if (currentPage === 2) {
				showPage(3);
			}
		}
	}, 4000);
}

// 页面2: 下一步/跳过按钮
document.querySelector("#page-pin .btn-next")?.addEventListener("click", () => {
	showPage(3);
});

document.querySelector("#page-pin .btn-skip")?.addEventListener("click", () => {
	showPage(3);
});

// 页面3: 上一步按钮
document
	.querySelector("#page-styles .btn-back")
	?.addEventListener("click", () => {
		showPage(2);
	});

// 页面3: 开始使用按钮
document
	.querySelector("#page-styles .btn-start")
	?.addEventListener("click", () => {
		// 标记已完成欢迎引导
		chrome.storage.local.set({ welcomeCompleted: true }, () => {
			// 关闭欢迎页面
			window.close();
		});
	});

// ============================================================
// 6. 风格卡片渲染
// ============================================================

function renderStyleCards() {
	const container = document.getElementById("style-cards-container");
	if (!container) return;

	const locale = getLocale();
	container.innerHTML = "";

	PRESET_STYLES.forEach((style) => {
		const card = document.createElement("div");
		card.className = "style-card";
		card.dataset.style = style.id;

		card.innerHTML = `
      <div class="style-card-preview" style="background: linear-gradient(135deg, ${style.preview.bg} 0%, ${lightenColor(style.preview.bg, 10)} 100%); color: ${style.preview.text}">
        ${style.name.charAt(0)}
      </div>
      <div class="style-card-content">
        <div class="style-card-name">${locale === "zh_CN" ? style.name : style.nameEn}</div>
        <div class="style-card-desc">${locale === "zh_CN" ? style.desc : style.descEn}</div>
      </div>
    `;

		card.addEventListener("click", () => {
			showStyleModal(style);
		});

		container.appendChild(card);
	});
}

// 辅助函数：颜色变亮
function lightenColor(hex, percent) {
	if (hex.startsWith("#")) {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		const lighten = (c) =>
			Math.min(255, Math.floor(c + (255 - c) * (percent / 100)));
		return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
	}
	return hex;
}

// ============================================================
// 7. 风格详情弹窗
// ============================================================

const styleModal = document.getElementById("style-modal");
const modalStyleName = document.getElementById("modal-style-name");
const stylePreview = document.getElementById("style-preview");
const stylePromptCode = document.getElementById("style-prompt-code");
const styleDescription = document.getElementById("style-description");
const modalClose = document.getElementById("modal-close");
const btnModalClose = document.getElementById("btn-modal-close");
const btnCopyPrompt = document.getElementById("btn-copy-prompt");
const btnUseStyle = document.getElementById("btn-use-style");

let currentStyle = null;

function showStyleModal(style) {
	currentStyle = style;
	const locale = getLocale();

	// 设置弹窗内容
	modalStyleName.textContent = locale === "zh_CN" ? style.name : style.nameEn;
	stylePromptCode.textContent = style.prompt;
	styleDescription.textContent = locale === "zh_CN" ? style.desc : style.descEn;

	// 设置预览样式
	stylePreview.style.background = `linear-gradient(135deg, ${style.preview.bg} 0%, ${lightenColor(style.preview.bg, 10)} 100%)`;
	stylePreview.style.color = style.preview.text;
	stylePreview.textContent = style.name.charAt(0);

	// 显示弹窗
	styleModal.classList.remove("hidden");
}

function closeStyleModal() {
	styleModal.classList.add("hidden");
	currentStyle = null;
}

// 关闭按钮事件
modalClose?.addEventListener("click", closeStyleModal);
btnModalClose?.addEventListener("click", closeStyleModal);

// 点击背景关闭
styleModal
	?.querySelector(".modal-backdrop")
	?.addEventListener("click", closeStyleModal);

// 复制提示词
btnCopyPrompt?.addEventListener("click", async () => {
	if (!currentStyle) return;

	try {
		await navigator.clipboard.writeText(currentStyle.prompt);

		// 更新按钮文本为"已复制"
		const originalText = btnCopyPrompt.innerHTML;
		btnCopyPrompt.innerHTML = `<span class="icon icon-check-circle" style="width:12px;height:12px;"></span><span>${t("copied")}</span>`;

		// 2秒后恢复
		setTimeout(() => {
			btnCopyPrompt.innerHTML = originalText;
		}, 2000);
	} catch (err) {
		console.error("Failed to copy:", err);
	}
});

// 使用此风格
btnUseStyle?.addEventListener("click", () => {
	if (!currentStyle) return;

	// 保存选中的风格
	chrome.storage.local.set(
		{
			selectedStyle: currentStyle.id,
			welcomeCompleted: true,
		},
		() => {
			// 关闭欢迎页面
			window.close();
		},
	);
});

// ============================================================
// 8. 国际化初始化
// ============================================================

function initI18n() {
	const locale = getLocale();

	// 更新 HTML lang 属性
	document.documentElement.lang = locale === "zh_CN" ? "zh-CN" : "en";

	// 更新所有带 data-i18n 属性的元素
	document.querySelectorAll("[data-i18n]").forEach((el) => {
		const key = el.getAttribute("data-i18n");
		const text = t(key);
		if (text && text !== key) {
			el.textContent = text;
		}
	});

	// 更新页面标题
	document.title = t("welcomeTitle");
}

// ============================================================
// 9. 初始化
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
	// 初始化国际化
	initI18n();

	// 初始化功能点列表
	initFeatureList();

	// 显示第一页
	showPage(1);

	// 显示第一个功能的 GIF 演示
	updateDemoContent(0);
});
