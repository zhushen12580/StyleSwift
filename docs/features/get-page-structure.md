# 页面结构获取

## 功能概述

获取当前页面的 DOM 结构概览，返回树形文本，供 LLM 理解页面结构。

---

## 为什么需要

LLM 需要了解页面结构才能生成正确的 CSS 选择器。

用户说"把导航栏改成深色"，Agent 需要知道：
- 导航栏的标签是什么（`<nav>`？`<header>`？）
- 有哪些 class 或 id 可用作选择器
- 当前有什么样式（避免冲突）

---

## 设计目标

| 目标 | 说明 |
|------|------|
| 信息充分 | 提供足够的选择器信息，让 LLM 能定位任意元素 |
| 控制体积 | 输出控制在 token 预算内（约 8000 tokens） |
| 样式感知 | 展示关键样式，避免生成的 CSS 与现有样式冲突 |
| 快速响应 | 不阻塞页面，快速返回结果 |

---

## 功能设计

### 输入

无参数，直接获取当前页面结构。

### 输出

树形文本，包含：
- 页面元信息（标题）
- 元素树（标签、选择器、关键样式、文本摘要）

### 结构简化策略

原始 DOM 过于庞大且冗余，需要简化：

**1. 标签过滤**

只保留有样式意义的标签：
- 保留：`div`、`section`、`header`、`nav`、`main`、`article`、`h1-h6`、`p`、`a`、`button`、`input`、`img` 等
- 过滤：`script`、`style`、`meta`、`link`、`noscript` 等

**2. 链式折叠**

当非语义元素只有一个子元素且无文本时，折叠为链式选择器：

```
原始：
div.container > div.wrapper > div.content > p

折叠后：
div.container > div.wrapper > div.content > p

好处：不消耗深度层级，能看到更深的页面结构
```

**3. 分组折叠**

连续相同结构的元素折叠显示：

```
原始：
a.nav-link "首页"
a.nav-link "产品"
a.nav-link "博客"
a.nav-link "关于"
a.nav-link "联系"

折叠后：
a.nav-link × 5: 首页|产品|博客|关于|联系
```

**4. 深度自适应**

根据 token 预算自动调整输出深度：
- 浅层：展示完整样式
- 深层：只展示关键样式（颜色、背景色、字号）

### 样式展示

**样式属性选择**：
- 布局属性：display、position、flex 相关
- 尺寸属性：width、height、padding、margin
- 视觉属性：background-color、color、font-size、border

**默认值过滤**：
- 跳过默认值（`auto`、`none`、`normal`、`0px`）
- 只展示有意义的样式

**分级展示**：
- 语义元素（`header`、`nav`、`main`）：展示完整样式
- 文本元素（`h1-h6`、`p`、`a`）：展示字体和颜色
- 深层元素：只展示关键样式

### 输出示例

```
Title: user/repo - GitHub

body [background-color:#fff; color:#333; font-size:16px]
├── header.site-header [position:fixed; height:60px]
│   ├── a.logo "GitHub"
│   └── nav.main-nav [display:flex; gap:24px]
│       └── a.nav-link × 5: Pull requests|Issues|Codespaces|...
├── main#content [display:flex]
│   ├── article.readme [width:800px]
│   │   └── h1 "项目名称"
│   └── aside.sidebar [width:300px; background-color:#f6f8fa]
└── footer.site-footer [background-color:#f6f8fa]
```

---

## 目标效果

| 场景 | 效果 |
|------|------|
| 用户说"改导航栏" | Agent 能识别 `.main-nav` 作为选择器 |
| 用户说"标题太暗" | Agent 能看到标题当前颜色，知道要调亮 |
| 大型页面 | 输出体积可控，不超 token 限制 |

---

## 边界情况

| 情况 | 处理 |
|------|------|
| 页面无 DOM | 返回错误提示 |
| DOM 节点过多 | 自动降低深度，优先展示高层结构 |
| CSP 限制 | Content Script 已注入，无额外限制 |
| 动态内容 | 获取实时 DOM，反映当前状态 |
