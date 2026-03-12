---
name: color-theory
description: 配色理论 - 色彩基础与网页配色最佳实践
tags: color, design, palette
---

# 配色理论

> 内置知识：色彩基础与网页配色最佳实践

## 一、色彩基础

### 色彩三要素

1. **色相 (Hue)**
   - 色彩的类型：红、橙、黄、绿、青、蓝、紫
   - 色轮上 0°-360° 的位置

2. **饱和度 (Saturation)**
   - 色彩的纯度
   - 0% = 灰色，100% = 纯色

3. **明度 (Brightness/Lightness)**
   - 色彩的明暗程度
   - 0% = 黑色，100% = 白色

### 色彩表示法

```css
/* HEX - 最常用 */
color: #ff6b6b;

/* RGB - 适合透明度 */
color: rgba(255, 107, 107, 0.8);

/* HSL - 最直观调色 */
color: hsl(0, 100%, 71%);
```

## 二、配色方案

### 1. 单色方案 (Monochromatic)
一个色相，变化明度和饱和度。

**特点**：简洁、和谐、易实现
**适合**：专业网站、文档站

```css
:root {
  --primary-50: #eff6ff;   /* 最浅 */
  --primary-100: #dbeafe;
  --primary-500: #3b82f6;  /* 主色 */
  --primary-700: #1d4ed8;
  --primary-900: #1e3a8a;  /* 最深 */
}
```

### 2. 类比色方案 (Analogous)
色轮上相邻的 2-3 个色相。

**特点**：和谐、自然、舒适
**适合**：生活方式、健康网站

```css
:root {
  --primary: #3b82f6;      /* 蓝 */
  --secondary: #06b6d4;    /* 青 */
  --accent: #8b5cf6;       /* 紫 */
}
```

### 3. 互补色方案 (Complementary)
色轮上相对的 2 个色相。

**特点**：对比强烈、活力
**适合**：营销页面、CTA 强调

```css
:root {
  --primary: #3b82f6;      /* 蓝 */
  --accent: #f97316;       /* 橙 - 互补色 */
}
```

### 4. 三角方案 (Triadic)
色轮上等距的 3 个色相。

**特点**：丰富、平衡
**适合**：创意类、儿童网站

```css
:root {
  --primary: #3b82f6;      /* 蓝 */
  --secondary: #ef4444;    /* 红 */
  --accent: #22c55e;       /* 绿 */
}
```

### 5. 分裂互补方案 (Split-Complementary)
一个主色 + 互补色两侧的两个色相。

**特点**：对比但有协调
**适合**：需要个性但不极端的场景

```css
:root {
  --primary: #3b82f6;      /* 蓝 */
  --accent-1: #f97316;     /* 红橙 */
  --accent-2: #ec4899;     /* 粉红 */
}
```

## 三、网页配色实践

### 60-30-10 法则

**背景色 60% + 次要色 30% + 强调色 10%**

```css
/* 示例 */
body {
  background-color: #f5f5f5;  /* 60% 背景色 */
}
.card {
  background-color: #ffffff;  /* 30% 次要色 */
}
button {
  background-color: #3b82f6;  /* 10% 强调色 */
}
```

### 文字配色原则

1. **正文文字**：深灰色，非纯黑
   ```css
   body { color: #333333; }  /* 好 */
   body { color: #000000; }  /* 太刺眼 */
   ```

2. **背景浅色时**：文字用深色
   ```css
   .light-bg { background: #fff; color: #333; }
   ```

3. **背景深色时**：文字用浅色
   ```css
   .dark-bg { background: #1a1a2e; color: #e0e0e0; }
   ```

### 链接配色

```css
/* 默认状态 */
a { color: #3b82f6; }

/* 悬浮状态 */
a:hover { color: #2563eb; }

/* 已访问 */
a:visited { color: #7c3aed; }

/* 激活 */
a:active { color: #1d4ed8; }
```

### 状态色

```css
:root {
  /* 成功 - 绿色 */
  --success: #22c55e;
  --success-bg: #dcfce7;
  
  /* 警告 - 黄色 */
  --warning: #f59e0b;
  --warning-bg: #fef3c7;
  
  /* 错误 - 红色 */
  --error: #ef4444;
  --error-bg: #fee2e2;
  
  /* 信息 - 蓝色 */
  --info: #3b82f6;
  --info-bg: #dbeafe;
}
```

## 四、色彩心理学

### 暖色系
- **红色**：激情、紧迫、重要性
- **橙色**：活力、创意、友好
- **黄色**：乐观、警示、温暖

### 冷色系
- **蓝色**：信任、专业、平静
- **绿色**：自然、健康、成长
- **紫色**：高贵、神秘、创意

### 中性色
- **黑色**：高端、权威、神秘
- **白色**：纯洁、简约、现代
- **灰色**：中立、专业、稳定

## 五、工具与检查

### 对比度检查
- Chrome DevTools > Accessibility
- 对比度必须 ≥ 4.5:1 (正文)
- 对比度必须 ≥ 3:1 (大文本)

### 调色工具
- [Coolors](https://coolors.co/) - 配色方案生成
- [Adobe Color](https://color.adobe.com/) - 色轮工具
- [Contrast Checker](https://webaim.org/resources/contrastchecker/) - 对比度检查

### 色盲模拟
- Chrome DevTools > Rendering > Emulate vision deficiencies
- 检查色盲用户是否可辨识
