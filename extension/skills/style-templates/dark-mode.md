---
name: dark-mode-template
description: 深色模式模板 - 深色背景+高对比度文字的护眼风格
tags: template, dark-mode, eye-care
---

# 深色模式模板

> 内置知识：深色背景 + 高对比度文字的护眼风格

## 设计理念

深色模式通过反转传统的浅色背景，减轻长时间阅读对眼睛的疲劳。核心是：
- 深色背景减少光线刺激
- 高对比度文字确保可读性
- 适度降低蓝光成分

## 色彩方案

### 背景色
- **主背景**: `#1a1a2e` (深蓝灰)
- **卡片/容器**: `#16213e` (稍深的蓝灰)
- **悬浮/高亮**: `#0f3460` (中等蓝灰)

### 文字色
- **主文字**: `#e0e0e0` (浅灰)
- **次要文字**: `#a0a0a0` (中灰)
- **链接**: `#4fc3f7` (淡蓝)

### 强调色
- **主强调**: `#e94560` (珊瑚红)
- **次强调**: `#4fc3f7` (淡蓝)
- **警告/错误**: `#ff6b6b` (淡红)

### 边框/分割
- **边框**: `rgba(255, 255, 255, 0.1)` (半透明白)
- **分割线**: `rgba(255, 255, 255, 0.05)` (更淡的白)

## CSS 生成指引

### 基本结构
```css
/* 页面主体 */
body {
  background-color: #1a1a2e !important;
  color: #e0e0e0 !important;
}

/* 卡片/容器 */
.card, .container, article, section {
  background-color: #16213e !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* 文字 */
h1, h2, h3, h4, h5, h6 {
  color: #ffffff !important;
}

p, span, li, td, th {
  color: #e0e0e0 !important;
}

/* 链接 */
a {
  color: #4fc3f7 !important;
}

a:hover {
  color: #81d4fa !important;
}

/* 输入框 */
input, textarea, select {
  background-color: #0f3460 !important;
  color: #e0e0e0 !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* 按钮 */
button, .btn {
  background-color: #e94560 !important;
  color: #ffffff !important;
  border: none !important;
}

button:hover, .btn:hover {
  background-color: #ff6b6b !important;
}
```

### 注意事项

1. **所有规则加 `!important`**：确保覆盖原有样式
2. **避免纯黑背景**：`#000000` 太暗，使用 `#1a1a2e` 等深灰色
3. **图片保持原样**：不要强制修改图片的背景或颜色
4. **代码块特殊处理**：使用更深的背景色

## 适用场景

- 夜间阅读
- 长时间编程/文档工作
- 护眼需求用户
- 偏好暗色调的设计风格
