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
	// ============================================================
	// 通用风格 (General)
	// ============================================================
	{
		id: "minimalism",
		name: "极简瑞士风",
		nameEn: "Minimalism & Swiss Style",
		desc: "干净简洁的高对比度设计，大量留白",
		descEn: "Clean, simple design with high contrast and generous whitespace",
		prompt:
			"极简瑞士风格设计。使用单色配色（纯黑#000000和纯白#FFFFFF为主），大量留白，高对比度。采用无衬线字体，基于网格的布局，避免多余装饰。过渡动画简洁（200-250ms），强调内容层级和功能优先。适合专业工具、文档站点、企业应用。",
		preview: { bg: "#FFFFFF", text: "#000000" },
	},
	{
		id: "neumorphism",
		name: "新拟物化",
		nameEn: "Neumorphism",
		desc: "柔和凸起效果，精致阴影质感",
		descEn: "Soft UI with subtle raised depth and refined shadows",
		prompt:
			"新拟物化设计风格。使用柔和的淡色调背景（柔蓝#C8E0F4、柔粉#F5E0E8、柔灰#E8E8E8），通过多层阴影创造凸起或凹陷的3D效果（box-shadow: -5px -5px 15px, 5px 5px 15px）。圆角（12-16px），单色调配色，过渡平缓（150ms）。适合健康应用、冥想平台。",
		preview: { bg: "#E8E8E8", text: "#5a5a5a" },
	},
	{
		id: "glassmorphism",
		name: "玻璃拟态",
		nameEn: "Glassmorphism",
		desc: "半透明毛玻璃效果，层次分明",
		descEn: "Frosted glass effect with translucent layers",
		prompt:
			"玻璃拟态设计。使用半透明白色背景（rgba(255,255,255,0.1-0.3)），配合背景模糊效果（backdrop-filter: blur(10-20px)）。鲜艳的渐变背景（电蓝#0080FF、霓紫#8B00FF、亮粉#FF1493），细腻的边框（1px solid rgba(255,255,255,0.2)）。营造层次分明的现代感。适合SaaS、金融仪表板、现代企业应用。",
		preview: {
			bg: "linear-gradient(135deg, #0080FF, #8B00FF)",
			text: "#FFFFFF",
		},
	},
	{
		id: "brutalism",
		name: "粗野主义",
		nameEn: "Brutalism",
		desc: "原始粗犷，高对比度，反设计美学",
		descEn: "Raw, unpolished design with high contrast anti-aesthetic",
		prompt:
			"粗野主义设计。使用原始未修饰的风格，高对比度配色（纯红#FF0000、纯蓝#0000FF、纯黄#FFFF00、黑白）。无渐变，instant过渡，尖锐的边角（0px），粗体字（700+），可见的边框和网格。大胆的排版，不对称布局，打破传统设计规则。适合设计作品集、艺术项目、编辑类网站。",
		preview: { bg: "#FFFF00", text: "#000000" },
	},
	{
		id: "claymorphism",
		name: "粘土拟态",
		nameEn: "Claymorphism",
		desc: "柔软3D，玩具般的圆润质感",
		descEn: "Soft 3D, toy-like bubbly shapes with thick borders",
		prompt:
			"粘土拟态设计。使用柔和的粉彩色调（柔桃#FDBCB4、婴儿蓝#ADD8E6、薄荷#98FF98、淡紫#E6E6FA）。元素呈圆润的球状（border-radius: 16-24px），配合双层阴影创造蓬松的3D效果。粗边框（3-4px），柔和的按压缩放动画（200ms ease-out）。营造可爱、友好的氛围。适合教育应用、儿童产品、创意工具。",
		preview: { bg: "#FDBCB4", text: "#4a4a4a" },
	},
	{
		id: "aurora-ui",
		name: "极光界面",
		nameEn: "Aurora UI",
		desc: "绚丽渐变，流动的北极光效果",
		descEn: "Vibrant flowing gradients like Northern Lights",
		prompt:
			"极光风格设计。使用鲜艳的渐变配色（蓝→紫→粉→青），营造极光般的流动感。大面积的CSS/SVG渐变，配合8-12秒的柔和动画。互补配色（蓝橙、紫黄），渐变融合效果（screen/multiply混合模式）。层次通过颜色叠加表现。适合创意机构、音乐平台、高端产品展示。",
		preview: {
			bg: "linear-gradient(135deg, #0080FF, #8B00FF, #FF1493, #00FFFF)",
			text: "#FFFFFF",
		},
	},
	{
		id: "retro-futurism",
		name: "复古未来主义",
		nameEn: "Retro-Futurism",
		desc: "80年代科幻风，霓虹辉光效果",
		descEn: "80s sci-fi aesthetic with neon glow effects",
		prompt:
			"复古未来主义风格。使用霓虹配色（霓蓝#0080FF、亮粉#FF006E、青色#00FFFF、深黑#1A1A2E）。CRT扫描线效果（::before伪元素），霓虹发光（text-shadow + box-shadow），故障艺术动画（skew/offset keyframes）。网格背景，深色基调。适合游戏、音乐平台、科技品牌、赛博朋克风格产品。",
		preview: { bg: "#1A1A2E", text: "#00FFFF" },
	},
	{
		id: "flat-design",
		name: "扁平化设计",
		nameEn: "Flat Design",
		desc: "简洁2D，无阴影现代风格",
		descEn: "Clean 2D design without shadows",
		prompt:
			"扁平化设计。使用明亮纯色（红、橙、蓝、绿），无渐变无阴影。简洁的形状，干净的线条，以字体为核心。简洁的悬停效果（颜色/透明度变化），快速加载，过渡简洁（150-200ms ease）。有限的调色板（4-6色）。适合Web应用、移动应用、初创MVP、SaaS、仪表板。",
		preview: { bg: "#3498db", text: "#FFFFFF" },
	},
	{
		id: "dark-mode-oled",
		name: "深色OLED模式",
		nameEn: "Dark Mode (OLED)",
		desc: "纯黑深色主题，护眼省电",
		descEn: "Pure black dark theme, eye-friendly and power efficient",
		prompt:
			"OLED深色模式设计。使用纯黑背景（#000000），深灰色调（#121212、#0A0E27）。鲜艳的强调色（霓绿#39FF14、电蓝#0080FF、金色#FFD700、等离子紫#BF00FF）。最小化发光效果（text-shadow: 0 0 10px），深色到浅色的文字过渡，高可读性，可见的焦点状态。适合夜间模式应用、编程平台、娱乐类产品。",
		preview: { bg: "#000000", text: "#39FF14" },
	},
	{
		id: "neubrutalism",
		name: "新粗野主义",
		nameEn: "Neubrutalism",
		desc: "大胆边框，粗犷阴影，玩味十足",
		descEn: "Bold borders, thick shadows, playful and loud",
		prompt:
			"新粗野主义设计。使用明亮的主色（黄#FFEB3B、红#FF5252、蓝#2196F3），粗黑边框（border: 3px solid #000），45度偏移阴影（box-shadow: 4px 4px 0 #000）。无渐变，尖锐边角（0px），粗体字。大胆的悬停偏移动画。适合Z世代品牌、初创公司、创意机构、Figma风格界面。",
		preview: { bg: "#FFEB3B", text: "#000000" },
	},
	{
		id: "bento-grid",
		name: "便当盒网格",
		nameEn: "Bento Box Grid",
		desc: "模块化卡片，苹果风格展示",
		descEn: "Modular cards, Apple-style display",
		prompt:
			"便当盒网格设计。使用中性底色（#FFFFFF、#F5F5F5）配合品牌强调色。模块化卡片布局，不对称网格（grid-template），变化的卡片尺寸（span属性）。圆角（16px），柔和阴影，悬停放大（scale: 1.02），平滑过渡。干净的层级结构，大片负空间。适合仪表板、产品页面、作品集、SaaS。",
		preview: { bg: "#F5F5F7", text: "#1D1D1F" },
	},
	{
		id: "y2k-aesthetic",
		name: "Y2K千禧风",
		nameEn: "Y2K Aesthetic",
		desc: "于禧年代美学，金属光泽复古",
		descEn: "Y2K millennium aesthetic with metallic gloss",
		prompt:
			"Y2K千禧风格。使用霓虹粉（#FF69B4）、青色（#00FFFF）、银色（#C0C0C0）、紫色（##9400D3）。金属渐变效果，光泽按钮，3D铬金效果，发光动画，气泡形状。复古未来主义，怀旧感。适合时尚品牌、音乐平台、Z世代品牌、娱乐产品。",
		preview: {
			bg: "linear-gradient(135deg, #FF69B4, #00FFFF, #C0C0C0)",
			text: "#FFFFFF",
		},
	},
	{
		id: "cyberpunk-ui",
		name: "赛博朋克UI",
		nameEn: "Cyberpunk UI",
		desc: "霓虹终端，科幻感界面",
		descEn: "Neon terminal, sci-fi interface aesthetic",
		prompt:
			"赛博朋克UI设计。使用深黑背景（#0D0D0D），霓虹绿（#00FF00）、品红（#FF00FF）、青色（#00FFFF）。终端风格字体，霓虹发光效果（text-shadow），故障艺术动画（skew/offset），扫描线覆盖（::before伪元素）。HUD元素，矩阵数字雨效果。适合游戏平台、科技产品、加密应用、开发工具。",
		preview: { bg: "#0D0D0D", text: "#00FF00" },
	},
	{
		id: "organic-biophilic",
		name: "有机亲和设计",
		nameEn: "Organic Biophilic",
		desc: "自然纹理，有机曲线，可持续美学",
		descEn: "Natural textures, organic curves, sustainable aesthetic",
		prompt:
			"有机亲和设计。使用自然色调（森林绿#228B22、土棕#8B4513、天蓝#87CEEB、米色#F5F5DC）。有机曲线（border-radius变化），自然阴影，流动的SVG形状，圆角（16-24px）。天然纹理背景。适合健康应用、可持续品牌、生态产品、冥想应用。",
		preview: { bg: "#228B22", text: "#F5F5DC" },
	},
	{
		id: "ai-native-ui",
		name: "AI原生界面",
		nameEn: "AI-Native UI",
		desc: "对话式，极简边框，流式文本",
		descEn: "Conversational, minimal chrome, streaming text",
		prompt:
			"AI原生界面设计。使用中性色背景（#F5F5F5）配合单一强调色（AI紫#6366F1）。极简边框，对话气泡风格，流式文本动画（三点脉冲指示器），打字效果。上下文卡片，平滑揭示动画。适合AI产品、聊天机器人、语音助手、AI辅助工具。",
		preview: { bg: "#F5F5F5", text: "#6366F1" },
	},
	{
		id: "memphis-design",
		name: "孟菲斯设计",
		nameEn: "Memphis Design",
		desc: "80年代几何，玩味图案，波普艺术",
		descEn: "80s geometric, playful patterns, pop art",
		prompt:
			"孟菲斯设计。使用明亮的几何配色（亮粉#FF71CE、黄色#FFCE5C、青色#86CCCA、紫蓝#6A7BB4）。重复的几何图案（三角形、波浪线、圆形），clip-path多边形，mix-blend-mode混合模式。大胆的形状，80年代后现代美学。适合创意机构、音乐网站、Z世代品牌、活动推广。",
		preview: { bg: "#FF71CE", text: "#FFFFFF" },
	},
	{
		id: "vaporwave",
		name: "蒸汽波",
		nameEn: "Vaporwave",
		desc: "合成波，80-90年代复古霓虹",
		descEn: "Synthwave, 80s-90s retro neon aesthetic",
		prompt:
			"蒸汽波设计。使用霓虹配色（粉#FF71CE、青#01CDFE、薄荷#05FFA1、紫#B967FF）。日落渐变，故障覆盖，VHS效果，复古扫描线。文字发光阴影效果，hue-rotate滤镜动画。怀旧复古未来主义，梦幻氛围。适合音乐平台、游戏、创意作品集、科技初创公司。",
		preview: {
			bg: "linear-gradient(135deg, #FF71CE, #01CDFE, #05FFA1, #B967FF)",
			text: "#FFFFFF",
		},
	},
	{
		id: "spatial-ui",
		name: "空间UI (VisionOS)",
		nameEn: "Spatial UI (VisionOS)",
		desc: "空间计算，深度层次，凝视交互",
		descEn: "Spatial computing, depth layers, gaze interaction",
		prompt:
			"空间UI设计。使用毛玻璃效果（#FFFFFF 15-30%透明度），系统白色。深色阴影创造深度感，视差深度效果，动态光照响应，凝视悬停效果，焦点缩放动画。通透的层次感。适合空间计算应用、VR/AR界面、沉浸式媒体、未来仪表板。",
		preview: { bg: "rgba(255,255,255,0.2)", text: "#1D1D1F" },
	},
	{
		id: "gen-z-chaos",
		name: "Z世代混沌",
		nameEn: "Gen Z Chaos / Maximalism",
		desc: "混乱美学，贴纸拼贴，互联网文化",
		descEn: "Chaos aesthetic, stickers collage, internet culture",
		prompt:
			"Z世代混沌设计。使用冲突的明亮色（#FF00FF、#00FF00、#FFFF00、#0000FF）。渐变、彩虹、故障、噪点、饱和度混合。滚动字幕动画、抖动、贴纸层叠、GIF过载、随机放置。打破秩序的互联网文化美学。适合Z世代生活方式品牌、音乐艺术家、创意作品集、病毒式营销。",
		preview: { bg: "#FF00FF", text: "#00FF00" },
	},
	// ============================================================
	// 落地页风格 (Landing Page)
	// ============================================================
	{
		id: "hero-centric",
		name: "英雄中心设计",
		nameEn: "Hero-Centric Design",
		desc: "大英雄区，醒目标题，高对比CTA",
		descEn: "Large hero section, compelling headline, high-contrast CTA",
		prompt:
			"英雄中心落地页设计。大尺寸英雄区域，醒目的标题，高对比度的CTA按钮。品牌主色，白色/浅色背景保证对比度，强调色用于CTA。滚动揭示动画，英雄区淡入效果，背景视差，CTA发光/脉冲效果。适合SaaS落地页、产品发布、服务落地页、B2B平台。",
		preview: { bg: "#FFFFFF", text: "#2563EB" },
	},
	{
		id: "conversion-optimized",
		name: "转化优化页",
		nameEn: "Conversion-Optimized",
		desc: "表单聚焦，单一CTA，信任元素",
		descEn: "Form-focused, single CTA, trust signals",
		prompt:
			"转化优化落地页设计。极简设计，单一CTA焦点，高对比度。紧迫感元素（倒计时、限时优惠），信任信号（客户Logo、评价、安全徽章），社会证明。表单焦点悬停动画，加载微调，成功反馈。适合电商产品页、免费试用注册、潜在客户获取、SaaS定价页。",
		preview: { bg: "#FFFFFF", text: "#22C55E" },
	},
	{
		id: "social-proof",
		name: "社交证明页",
		nameEn: "Social Proof-Focused",
		desc: "客户评价，成功案例，信任标记",
		descEn: "Testimonials, case studies, credibility markers",
		prompt:
			"社交证明落地页设计。突出的客户评价，客户Logo展示，成功案例区块，评分/星级，用户头像，成功指标。主品牌色，信任蓝，成功绿用于增长指标。评价轮播动画，Logo网格淡入，数字计数动画。适合B2B SaaS、专业服务、高级产品、电商转化页。",
		preview: { bg: "#F8FAFC", text: "#1E40AF" },
	},
	// ============================================================
	// 数据可视化风格 (BI/Analytics)
	// ============================================================
	{
		id: "data-dashboard",
		name: "数据密集仪表板",
		nameEn: "Data-Dense Dashboard",
		desc: "多图表，KPI卡片，空间高效",
		descEn: "Multiple charts, KPI cards, space-efficient",
		prompt:
			"数据密集仪表板设计。多图表/小部件，数据表格，KPI卡片，最小内边距，网格布局。中控配色（浅灰#F5F5F5），数据色（蓝绿红），深色文字#333333。成功绿#22C55E、警告橙#F59E0B、警报红#EF4444用于状态。悬停工具提示，图表点击缩放，行高亮，平滑过滤动画。适合BI仪表板、财务分析、企业报告。",
		preview: { bg: "#F5F5F5", text: "#333333" },
	},
	{
		id: "realtime-monitoring",
		name: "实时监控面板",
		nameEn: "Real-Time Monitoring",
		desc: "实时更新，状态指示，流式图表",
		descEn: "Live updates, status indicators, streaming charts",
		prompt:
			"实时监控面板设计。实时数据更新，状态指示器，警报通知。警报色：紧急红#FF0000、警告橙#FFA500、正常绿#22C55E、更新蓝。状态指示闪烁动画，警报脉冲/发光，平滑数据流更新，加载效果。适合系统监控、DevOps仪表板、实时分析、股票看板、直播跟踪。",
		preview: { bg: "#1E1E1E", text: "#22C55E" },
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

		// 根据背景类型处理：渐变或纯色
		let bgStyle;
		if (style.preview.bg.includes("gradient")) {
			// 渐变背景直接使用
			bgStyle = style.preview.bg;
		} else {
			// 纯色背景生成渐变效果
			bgStyle = `linear-gradient(135deg, ${style.preview.bg} 0%, ${lightenColor(style.preview.bg, 15)} 100%)`;
		}

		card.innerHTML = `
      <div class="style-card-preview" style="background: ${bgStyle}; color: ${style.preview.text}">
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

	// 根据背景类型处理：渐变或纯色
	let bgStyle;
	if (style.preview.bg.includes("gradient")) {
		// 渐变背景直接使用
		bgStyle = style.preview.bg;
	} else {
		// 纯色背景生成渐变效果
		bgStyle = `linear-gradient(135deg, ${style.preview.bg} 0%, ${lightenColor(style.preview.bg, 15)} 100%)`;
	}
	stylePreview.style.background = bgStyle;
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
