---
name: minimal-template
description: 极简风格模板 - 简洁、留白、功能导向的设计风格
tags: template, minimal, clean
---

# 极简风格模板

> 内置知识：简洁、留白、功能导向的设计风格

## 设计理念

极简风格强调"少即是多"，通过：
- 大量留白创造呼吸感
- 简洁的几何形状
- 克制的色彩运用
- 清晰的视觉层级

## 色彩方案

### 背景色
- **主背景**: `#ffffff` (纯白)
- **次背景**: `#f5f5f5` (极淡灰)
- **卡片背景**: `#ffffff` (纯白)

### 文字色
- **主文字**: `#333333` (深灰，非纯黑)
- **次要文字**: `#666666` (中灰)
- **辅助文字**: `#999999` (浅灰)

### 强调色
- **主强调**: `#000000` (纯黑，极少使用)
- **链接**: `#333333` (深灰)

### 边框/分割
- **边框**: `#e0e0e0` (浅灰)
- **分割线**: `#eeeeee` (极浅灰)

## 排版规范

### 字体
- **标题**: 无衬线字体 (Helvetica, Arial, system-ui)
- **正文**: 无衬线字体，行高 1.6+
- **代码**: 等宽字体 (Menlo, Monaco, monospace)

### 间距
- **页面边距**: 至少 40px
- **元素间距**: 24px 或 32px
- **段落间距**: 16px 或 24px

### 圆角
- **按钮/卡片**: 4px 或 8px (小圆角)
- **输入框**: 4px

## CSS 生成指引

### 基本结构
```css
/* 页面主体 */
body {
  background-color: #ffffff !important;
  color: #333333 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  line-height: 1.6 !important;
}

/* 移除多余装饰 */
* {
  box-shadow: none !important;
  text-shadow: none !important;
}

/* 卡片/容器 */
.card, .container, article, section {
  background-color: #ffffff !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 8px !important;
  padding: 24px !important;
}

/* 标题 */
h1, h2, h3 {
  color: #333333 !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
}

/* 链接 */
a {
  color: #333333 !important;
  text-decoration: underline !important;
}

a:hover {
  color: #000000 !important;
}

/* 输入框 */
input, textarea, select {
  background-color: #ffffff !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 4px !important;
  padding: 12px 16px !important;
}

input:focus, textarea:focus {
  border-color: #333333 !important;
  outline: none !important;
}

/* 按钮 */
button, .btn {
  background-color: #333333 !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 12px 24px !important;
  font-weight: 500 !important;
}

button:hover, .btn:hover {
  background-color: #000000 !important;
}

/* 次要按钮 */
.btn-secondary {
  background-color: transparent !important;
  color: #333333 !important;
  border: 1px solid #e0e0e0 !important;
}
```

### 注意事项

1. **移除阴影**：极简风格不使用 box-shadow
2. **保持白度**：背景尽量纯白，避免米色或灰白
3. **细边框**：使用 1px 边框，颜色要浅
4. **大留白**：padding 和 margin 要充足

## 适用场景

- 专业文档/博客
- 作品集展示
- 商务网站
- 需要专注阅读的场景
