---
name: css-selectors
description: CSS选择器最佳实践 - 高效、可维护的选择器编写指南
tags: css, selectors, best-practices
---

# CSS 选择器最佳实践

> 内置知识：高效、可维护的选择器编写指南

## 一、选择器优先级

### 优先级计算

| 选择器类型 | 权重 | 示例 |
|-----------|------|------|
| !important | 最高 | `color: red !important;` |
| 内联样式 | 1000 | `<div style="...">` |
| ID 选择器 | 100 | `#header` |
| 类/属性/伪类 | 10 | `.card`, `[type="text"]`, `:hover` |
| 元素/伪元素 | 1 | `div`, `::before` |

### 优先级示例

```css
/* 权重: 1 */
div { color: black; }

/* 权重: 10 */
.text { color: gray; }

/* 权重: 11 */
div.text { color: darkgray; }

/* 权重: 100 */
#content { color: blue; }

/* 权重: 111 */
#content div.text { color: navy; }
```

## 二、选择器类型

### 基础选择器

```css
/* 元素选择器 */
body { margin: 0; }
h1 { font-size: 2em; }

/* 类选择器 - 推荐 */
.card { padding: 16px; }
.btn-primary { background: blue; }

/* ID 选择器 - 谨慎使用 */
#header { position: fixed; }

/* 通配符 - 避免滥用 */
* { box-sizing: border-box; }
```

### 组合选择器

```css
/* 后代选择器（所有后代） */
.article p { line-height: 1.6; }

/* 子选择器（直接子元素） */
.list > li { margin-top: 8px; }

/* 相邻兄弟选择器 */
h1 + p { font-size: 1.1em; }

/* 通用兄弟选择器 */
h1 ~ p { color: gray; }
```

### 属性选择器

```css
/* 存在属性 */
[disabled] { opacity: 0.5; }

/* 属性等于 */
[type="text"] { border: 1px solid gray; }

/* 属性包含 */
[class*="btn"] { cursor: pointer; }

/* 属性开头 */
[href^="https"] { color: green; }

/* 属性结尾 */
[href$=".pdf"] { color: red; }
```

### 伪类选择器

```css
/* 状态伪类 */
a:hover { text-decoration: underline; }
a:active { color: red; }
a:visited { color: purple; }

/* 表单伪类 */
input:focus { border-color: blue; }
input:disabled { background: gray; }
input:checked + label { font-weight: bold; }

/* 结构伪类 */
li:first-child { font-weight: bold; }
li:last-child { border: none; }
li:nth-child(odd) { background: #f5f5f5; }
li:nth-child(3n+1) { clear: left; }

/* 否定伪类 */
.item:not(.active) { opacity: 0.5; }
```

### 伪元素选择器

```css
/* 首行首字 */
p::first-line { font-weight: bold; }
p::first-letter { font-size: 2em; }

/* 前后插入 */
.quote::before { content: '"'; }
.quote::after { content: '"'; }

/* 选中样式 */
::selection { background: yellow; }
```

## 三、选择器最佳实践

### 1. 避免过度嵌套

```css
/* ❌ 不推荐 - 过度嵌套 */
.header .nav .list .item .link { color: blue; }

/* ✅ 推荐 - 扁平化 */
.nav-link { color: blue; }
```

### 2. 使用语义化类名

```css
/* ❌ 不推荐 - 无语义 */
.red { color: red; }
.mt20 { margin-top: 20px; }

/* ✅ 推荐 - 语义化 */
.error-message { color: red; }
.section-spacing { margin-top: 20px; }
```

### 3. BEM 命名规范

```css
/* Block */
.card { }
.card__header { }  /* Element */
.card__body { }    /* Element */
.card--featured { } /* Modifier */
```

### 4. 避免使用 ID 选择器

```css
/* ❌ 不推荐 - 优先级过高，难以覆盖 */
#main-content { padding: 20px; }

/* ✅ 推荐 - 使用类选择器 */
.main-content { padding: 20px; }
```

### 5. 避免使用通配符作为关键选择器

```css
/* ❌ 不推荐 - 性能差 */
* [class^="col-"] { float: left; }

/* ✅ 推荐 */
[class^="col-"] { float: left; }
```

## 四、性能优化

### 选择器匹配顺序

CSS 选择器从右到左匹配，右侧选择器称为"关键选择器"。

```css
/* 匹配过程：先找所有 a，再过滤 .nav 内的 */
.nav a { }  /* 好 - 关键选择器简单 */

/* 匹配过程：先找所有 *，再过滤父级 */
.nav * { }  /* 差 - 关键选择器是通配符 */
```

### 性能建议

1. **关键选择器要精确**
   ```css
   /* ❌ 差 */
   .nav * { }
   
   /* ✅ 好 */
   .nav a { }
   .nav li { }
   ```

2. **避免深层嵌套**
   ```css
   /* ❌ 差 - 5层嵌套 */
   .header .nav .list .item .link { }
   
   /* ✅ 好 - 最多3层 */
   .nav-link { }
   ```

3. **优先使用类选择器**
   ```css
   /* ❌ 差 - 属性选择器效率低 */
   [data-type="button"] { }
   
   /* ✅ 好 - 类选择器效率高 */
   .btn { }
   ```

## 五、覆盖内联样式

### 使用 !important

```css
/* 内联样式优先级最高，只能用 !important 覆盖 */
.element {
  color: red !important;
}
```

### 更好的方法：移除内联样式

在生成 CSS 时，如果发现页面有内联样式干扰：
1. 尝试用更具体的选择器
2. 必要时使用 !important
3. 推荐用户清理页面内联样式

## 六、常见场景

### 覆盖第三方样式

```css
/* 使用更高优先级 */
body .third-party-class {
  color: my-color !important;
}

/* 或使用更具体的选择器 */
#my-app .third-party-class {
  color: my-color;
}
```

### 响应式选择器

```css
/* 移动端隐藏 */
.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: block;
  }
  
  .desktop-only {
    display: none;
  }
}
```

### 状态切换

```css
/* 默认状态 */
.tab { background: gray; }

/* 激活状态 */
.tab.active { background: blue; }

/* 悬浮状态 */
.tab:hover { background: lightblue; }

/* 禁用状态 */
.tab.disabled {
  background: gray;
  pointer-events: none;
}
```
