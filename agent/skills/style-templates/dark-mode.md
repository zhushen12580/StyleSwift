# 深色模式模板

> StyleSwift Agent 预设风格模板

---

## 一、标准深色模式

### 生成规则

当用户说：
- "深色模式"
- "暗黑模式"
- "太亮了" / "太刺眼了"
- "晚上看" / "护眼"

### CSS 模板

```css
/* === StyleSwift 深色模式 === */

/* 全局背景和文字 */
html, body {
  background-color: #1a1a1a !important;
  color: #e0e0e0 !important;
}

/* 主要内容区域 */
main, article, .content, .main, #main,
[role="main"], .post, .article {
  background-color: #1a1a1a !important;
  color: #e0e0e0 !important;
}

/* 卡片和容器 */
.card, .box, .container, .panel,
.sidebar, aside, [role="complementary"] {
  background-color: #2d2d2d !important;
  border-color: #404040 !important;
}

/* 导航栏 */
nav, .nav, .navbar, header, .header, [role="navigation"] {
  background-color: #2d2d2d !important;
  border-bottom: 1px solid #404040 !important;
}

/* 标题 */
h1, h2, h3, h4, h5, h6 {
  color: #f0f0f0 !important;
}

/* 段落和文本 */
p, span, div, li, td, th {
  color: #e0e0e0 !important;
}

/* 链接 */
a, a:link {
  color: #64b5f6 !important;
}

a:hover, a:focus {
  color: #90caf9 !important;
}

/* 输入框 */
input, textarea, select {
  background-color: #3d3d3d !important;
  color: #e0e0e0 !important;
  border-color: #505050 !important;
}

input:focus, textarea:focus, select:focus {
  border-color: #64b5f6 !important;
  outline-color: #64b5f6 !important;
}

/* 按钮 */
button, .btn, [role="button"] {
  background-color: #3d3d3d !important;
  color: #e0e0e0 !important;
  border-color: #505050 !important;
}

button:hover, .btn:hover {
  background-color: #4d4d4d !important;
}

/* 主要操作按钮 */
.btn-primary, button[type="submit"] {
  background-color: #1976d2 !important;
  color: #ffffff !important;
  border-color: #1976d2 !important;
}

/* 表格 */
table, th, td {
  border-color: #404040 !important;
}

th {
  background-color: #2d2d2d !important;
}

/* 代码块 */
code, pre, .code {
  background-color: #2d2d2d !important;
  color: #e0e0e0 !important;
}

/* 分割线 */
hr, .divider {
  border-color: #404040 !important;
}

/* 图片处理 - 轻微降低亮度避免刺眼 */
img {
  filter: brightness(0.9) !important;
}

img:hover {
  filter: brightness(1) !important;
}

/* 隐藏或降低广告亮度 */
.ad, .ads, .advertisement, [class*="ad-"], [id*="ad-"] {
  opacity: 0.5 !important;
}
```

---

## 二、OLED 深色模式（纯黑）

### 生成规则

当用户说：
- "OLED深色"
- "纯黑模式"
- "省电模式"

### CSS 模板

```css
/* === StyleSwift OLED 深色模式 === */

html, body {
  background-color: #000000 !important;
  color: #ffffff !important;
}

main, article, .content, .main {
  background-color: #000000 !important;
}

.card, .box, .container, .panel {
  background-color: #121212 !important;
  border-color: #1f1f1f !important;
}

nav, header {
  background-color: #0a0a0a !important;
}

input, textarea, select {
  background-color: #1a1a1a !important;
}
```

---

## 三、暖色深色模式

### 生成规则

当用户说：
- "暖色调深色"
- "护眼模式"
- "夜间模式"（偏向暖色）

### CSS 模板

```css
/* === StyleSwift 暖色深色模式 === */

html, body {
  background-color: #1a1815 !important;
  color: #e8e0d0 !important;
}

.card, .box, .container {
  background-color: #2a2520 !important;
  border-color: #3d3530 !important;
}

nav, header {
  background-color: #2a2520 !important;
}

a {
  color: #d4a574 !important;
}

a:hover {
  color: #e8b884 !important;
}

/* 降低蓝光 */
* {
  filter: sepia(10%) !important;
}
```

---

## 四、保留元素规则

以下元素**不应该**被深色模式改变：

```css
/* 图片保持原样 */
img, video, iframe, embed, object,
svg, canvas, [role="img"] {
  /* 不覆盖 */
}

/* 已有深色背景的元素 */
[data-theme="dark"],
.dark-mode,
.theme-dark {
  /* 保持不变 */
}

/* 第三方嵌入内容 */
.twitter-tweet, .instagram-media,
.fb-post, .linkedin-post {
  /* 保持不变 */
}
```

---

## 五、智能检测规则

在生成深色模式前，应检测：

```javascript
// 检测当前是否已经是深色模式
function isAlreadyDarkMode() {
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  const rgb = bgColor.match(/\d+/g);
  if (rgb) {
    const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    return brightness < 128;
  }
  return false;
}

// 检测网站是否有自己的深色模式
function hasNativeDarkMode() {
  return document.querySelector('[data-theme="dark"]') ||
         document.querySelector('.dark-mode') ||
         document.querySelector('[class*="dark"]');
}
```

---

## 六、排除选择器

某些网站元素应该被排除：

```css
/* 排除代码编辑器（保持原有高亮） */
.CodeMirror, .monaco-editor, .ace_editor,
.leetcode-editor, pre[class*="language-"] {
  filter: none !important;
}

/* 排除地图 */
#map, .map, [id*="map"], [class*="map"] {
  filter: none !important;
}

/* 排除 Canvas 游戏 */
canvas {
  filter: none !important;
}
```

---

## 使用指南

主 Agent 调用此模板时：

1. **获取页面结构**：识别哪些区域需要应用深色
2. **检测已有样式**：避免与网站原生深色模式冲突
3. **应用模板**：根据用户偏好选择标准/OLED/暖色版本
4. **排除特殊元素**：图片、视频、编辑器等保持不变
5. **预览确认**：让用户确认效果
