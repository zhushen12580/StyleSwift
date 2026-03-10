# StyleSwift Agent 设计方案

> 版本：v4.0
> 日期：2026-03-03
> 设计理念：基于 agent-builder 哲学 - The model IS the agent, code just provides capabilities
> 架构：纯 Chrome 插件，安装即用，无需部署后端

---

## 一、核心定位

**Purpose：** 让用户用一句话个性化任意网页的视觉样式
**Domain：** 网页样式设计 + 浏览器交互
**Trust：** 模型自己决定改什么、怎么改、改到什么程度
**Delivery：** 纯 Chrome 插件，安装即用

**核心场景：**
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格化表达：赛博朋克、复古、现代感

---

## 二、架构总览

### 2.1 插件内部架构

纯 Chrome 插件方案，无需后端服务。插件直接操作 live DOM、调用 openai API，用户自带 API Key，安装即用。

```
Chrome Extension (Manifest V3)
│
├── Side Panel (sidepanel/)              # 用户界面 + Agent Loop 运行环境
│   ├── 会话列表                          # 按域名展示
│   ├── 聊天窗口                          # 流式展示文本，折叠工具调用
│   ├── 设置页                            # API Key、偏好配置
│   ├── Agent Loop                       # 主智能体循环（锁定触发 Tab，迭代上限保护）
│   ├── LLM Streaming API               # 直接调 openai Streaming API
│   ├── CSS 合并引擎                      # mergeCSS 去重合并
│   └── Subagent 执行                    # 隔离上下文的子智能体
│
├── Service Worker (background.js)       # 扩展生命周期管理
│   └── 消息路由                          # Side Panel ↔ Content Script
│
├── Content Script × 2                   # 页面交互层
│   ├── early-inject.js (document_start) # 活动会话样式预注入（防闪烁）
│   └── content.js (document_idle)       # DOM 操作 + 工具执行 + CSS 注入/回滚
│
└── Storage
    ├── chrome.storage.local             # 轻量数据（画像、样式、会话索引）
    └── IndexedDB                        # 大体积数据（对话历史）
```

### 2.2 项目结构

```
StyleSwift/
├── extension/
│   ├── manifest.json                  # Manifest V3 配置
│   │
│   ├── sidepanel/                     # Side Panel（UI + Agent Loop）
│   │   ├── index.html
│   │   ├── panel.js                   # UI 交互（会话列表、聊天窗口、设置、流式展示）
│   │   ├── panel.css
│   │   ├── agent-loop.js              # Agent 主循环 + 迭代上限 + Tab 锁定
│   │   ├── tools.js                   # 工具执行器（本地工具 + Content Script 工具分派）
│   │   ├── css-merge.js               # CSS 去重/合并逻辑
│   │   ├── session.js                 # SessionContext + 会话管理（chrome.storage + IndexedDB）
│   │   ├── profile.js                 # 用户画像读写
│   │   └── api.js                     # openai Streaming API 调用封装
│   │
│   ├── background/
│   │   └── service-worker.js          # Side Panel 注册、扩展图标点击行为
│   │
│   ├── content/
│   │   ├── early-inject.js            # 活动会话样式预注入（document_start，防闪烁）
│   │   └── content.js                 # DOM 操作 + 消息监听（document_idle）
│   │
│   ├── skills/                        # 领域知识（静态资源，打包在扩展中）
│   │   ├── design-principles.md
│   │   ├── color-theory.md
│   │   ├── css-selectors-guide.md
│   │   └── style-templates/
│   │       ├── dark-mode.md
│   │       └── minimal.md
│   │
│   └── icons/                         # 扩展图标
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
└── doc/
    └── StyleSwift-Agent设计方案-v4.md   # 设计方案
```

### 2.3 Manifest 配置

**文件位置：** `extension/manifest.json`

Manifest V3 配置，声明扩展基本信息（name: StyleSwift, version: 1.0.0）。权限包括 `activeTab`、`storage`、`sidePanel`；`host_permissions` 声明 `https://api.openai.com/*`（默认 API 地址）；`optional_host_permissions` 声明 `https://*/*`（用户自定义代理地址时动态申请）。注册 `background/service-worker.js` 为 Service Worker，`sidepanel/index.html` 为 Side Panel 默认页面。Content Scripts 声明两个注入脚本：`content/early-inject.js` 在 `document_start` 注入，`content/content.js` 在 `document_idle` 注入，均匹配 `<all_urls>`。

**权限说明：**

| 权限 | 类型 | 为什么需要 |
|------|------|-----------|
| `activeTab` | permission | 获取当前活跃 Tab ID（用于 `chrome.tabs.query`），不获取 URL（域名通过 Content Script 获取） |
| `storage` | permission | 读写 chrome.storage.local，存储会话、样式、用户画像、设置 |
| `sidePanel` | permission | 注册和控制 Side Panel |
| `https://api.openai.com/*` | host_permission | 从 Side Panel 直接调用 openai API（默认地址） |
| `https://*/*` | optional_host_permission | 用户自定义 API 代理地址时动态申请（`chrome.permissions.request`） |
| `content_scripts: <all_urls>` | manifest 声明 | 在所有页面注入 Content Script（DOM 操作 + 活动会话样式预注入） |

> `content_scripts <all_urls>` 确保每个页面自动注入脚本；`activeTab` 用于定位目标 Tab 并通信。域名通过 Content Script 的 `location.hostname` 获取，无需 `tabs` 权限。Side Panel 是扩展内部页面，无需 `web_accessible_resources`。

**Service Worker：**

**文件位置：** `extension/background/service-worker.js`

Service Worker 只负责一件事：调用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 注册 Side Panel 并设置点击图标时自动打开。

### 2.4 内部消息流

```
用户输入 "把背景改成深蓝色"
        │
        ▼
┌──────────────────────────────┐
│         Side Panel           │
│                              │
│  聊天窗口收到输入              │
│  ↓                           │
│  Agent Loop 启动              │
│  ↓ 调 openai API          │
│  ↓ LLM 返回: 需要看页面       │
│  ↓ 调用工具 get_page_structure│
│  ↓                           │
└──────────┬───────────────────┘
           │
    chrome.tabs.sendMessage
           │
           ▼
┌──────────────────┐
│  Content Script   │
│  (页面上下文)      │
│                   │
│  遍历 DOM          │
│  简化 → 返回文本    │
└──────────┬───────┘
           │
       返回结果
           │
           ▼
┌──────────────────────────────┐
│         Side Panel           │
│                              │
│  Agent Loop 收到页面结构       │
│  ↓ 再调 LLM → 生成 CSS       │
│  ↓ 调用 apply_styles(save)    │
│  ↓ chrome.tabs.sendMessage    │──→ Content Script 注入 CSS
│  ↓ 写入会话样式并同步 active_styles │
│  显示 "已应用深蓝色背景"        │
└──────────────────────────────┘
```

### 2.5 多 Tab 场景处理

Side Panel 是 per-window 级别的，同一窗口内切换 Tab 时面板保持不变。

**核心原则：Agent 启动时锁定当前 Tab，全程操作该 Tab，不跟随切换。**

不监听 `chrome.tabs.onActivated`，避免引入 `tabs` 权限（该权限会触发"读取您的浏览历史记录"的恐怖提示）。域名通过 Content Script 直接获取，无需读取 `tab.url`。

```
流程：
  1. 用户发送消息 → 获取当前活跃 Tab ID → 锁定
  2. 向该 Tab 的 Content Script 发送 get_domain → 获取域名
  3. Agent 处理期间，用户切换 Tab 不影响（所有工具调用发往锁定的 Tab）
  4. Agent 处理完成 → 解锁

  用户下次发送新消息时，重新获取当前活跃 Tab，可能已切换到新页面。
```

**文件位置：** `extension/sidepanel/agent-loop.js`

Tab 锁定机制通过模块级变量 `lockedTabId` 实现。`getTargetTabId()` 优先返回已锁定的 Tab ID，否则通过 `chrome.tabs.query({ active: true, currentWindow: true })` 获取当前活跃 Tab。`lockTab(tabId)` 和 `unlockTab()` 分别设置和清除锁定。`getTargetDomain()` 通过向目标 Tab 发送 `get_domain` 消息获取域名，无需 `tabs` 权限读取 URL。

`sendToContentScript(message)` 始终发送给锁定的 Tab，通过 `chrome.tabs.sendMessage` 发送消息并返回 Promise，处理 `chrome.runtime.lastError` 检测 Content Script 不可用的情况。

**通信消息格式：**

Side Panel → Content Script 通过 `chrome.tabs.sendMessage` 直接发送，格式为 `{ tool: '工具名', args?: {...} }`，支持的 tool 包括 `get_domain`、`get_page_structure`、`grep`、`inject_css`、`rollback_css`。Content Script 的响应作为 `sendMessage` 的 response 回调直接返回，无需经过 Service Worker。

---

## 三、Tools（原子能力）

### 设计原则

每个 Tool 必须满足三个要求：原子性（做一件事，不做推理）、清晰描述（模型知道它能做什么）、简单输出（返回事实，不返回判断）。

工具按执行位置分为两类：需要访问 live DOM 的工具（`get_page_structure`、`grep`、`apply_styles`）在 Content Script 中执行；读写 chrome.storage 的工具（`get/update_user_profile`、`load_skill`）在 Side Panel 中执行。

### SessionContext

**文件位置：** `extension/sidepanel/session.js`

`SessionContext` 类基于域名和会话 ID 生成 Chrome Storage key 映射。提供以下 key 计算属性：`stylesKey` → `sessions:{domain}:{sessionId}:styles`、`metaKey` → `sessions:{domain}:{sessionId}:meta`、`historyKey` → `{domain}:{sessionId}`（IndexedDB key）、`activeStylesKey` → `active_styles:{domain}`（当前活动会话样式镜像）、`sessionIndex` → `sessions:{domain}:index`。模块级变量 `currentSession` 持有当前活跃的 SessionContext 实例。

### 3.1 get_page_structure

直接在 Content Script 中操作 live DOM 构建简化树。

#### 3.1.1 Tool 定义（给 LLM 看的）

**文件位置：** `extension/sidepanel/tools.js`

工具名 `get_page_structure`，描述为"获取当前页面的结构概览，返回树形结构，包含标签、选择器、关键样式"。无输入参数。

#### 3.1.2 Content Script 端实现

**文件位置：** `extension/content/content.js`

**常量定义：** `TAG_WHITELIST`（允许遍历的 HTML 标签白名单，含 div/span/p/h1-h6/nav/header/footer/main 等 30+ 标签）、`LANDMARKS`（语义地标标签集合：header/nav/main/aside/footer/article/section）、`STYLE_WHITELIST`（需要读取的 CSS 属性白名单，含布局/尺寸/颜色/字体等 25+ 属性）、`SKIP_VALUES`（应跳过的默认值集合：none/normal/0px/auto 等）、`COLLAPSE_THRESHOLD`（分组折叠阈值，设为 3）、`TEXT_TAGS`（文本类标签集合）、`VISUAL_PROPS`（视觉属性集合）、`ESSENTIAL_STYLE_PROPS`（深层关键样式属性：background-color/color/font-size/font-weight，在紧凑模式下仍然展示以避免模型生成的 CSS 与现有样式冲突）。

**核心函数 `getPageStructure()`：** 提取页面 meta 信息（URL、Title、Viewport 尺寸），然后从 `document.body` 开始调用 `buildTree` 构建简化树，最后通过 `formatOutput` 格式化输出。

**链式折叠（Chain Collapsing）：** `buildTree` 函数的核心优化。当非地标元素只有一个非地标子元素且自身无文本时，折叠为链式选择器 `div.a > div.b > div.c`，不消耗深度层级，最大链长 `MAX_CHAIN_LENGTH = 5`。这大幅提升有效遍历深度，使模型能看到更深层的页面结构。

**计算样式读取：** `getComputedStyles` 通过 `window.getComputedStyle` 实时读取元素样式，遍历 `STYLE_WHITELIST` 属性并过滤默认值。`pickStylesForDisplay` 按标签类型筛选展示的样式——地标标签显示全部属性、文本标签只显示字体/颜色相关属性、其他标签只显示视觉属性。

**分组折叠：** `groupSimilar` 将连续相同签名的子元素分组，`sameSignature` 通过 `shortSelector` 比较来忽略 BEM 修饰类差异。超过 `COLLAPSE_THRESHOLD` 的同类元素折叠为一个代表加计数。

**渐进式紧凑格式化：** `formatOutput` 使用二分查找（在 `FORMAT_DEPTHS = [4, 8, 12, 16, 24, 32]` 中搜索）找到满足 `TOKEN_LIMIT = 8000` 的最大深度。浅层（depth < `STYLE_DEPTH_CUTOFF = 7`）显示完整样式用于理解布局，深层进入紧凑模式——只展示 `ESSENTIAL_STYLE_PROPS` 中的关键样式（颜色、背景色、字号、字重），确保模型能感知深层元素的现有视觉属性，避免生成冲突的 CSS 导致风格不统一。

**辅助函数：** `shortSelector` 生成最短选择器（优先 `tag#id`，其次 `tag.className`）；`getDirectText` 仅获取元素自身的直接文本节点；`summarizeChildren` 简要统计子元素构成（`tag × count`）；`formatTree`/`formatTreeNode` 递归生成树形缩进文本，`currentDepth` 追踪绝对深度自动切换紧凑模式；`estimateTokens` 按 `text.length / 3.5` 估算 token 数；`buildFullPathSelector` 构建从 body 到当前元素的完整路径选择器；`formatUsefulAttrs` 提取有用的 HTML 属性。

#### 3.1.3 输出格式

使用完整 CSS 属性名的树形文本（LLM 能直接对应 CSS 语法）：

```
URL: https://example.com/blog/post/123
Title: 如何设计高效的CSS架构
Viewport: 1920 × 1080

body [background-color:#fff; color:#333; font-size:16px; font-family:"Microsoft YaHei",sans-serif]
├── header.site-header [background-color:#fff; height:60px; position:fixed; box-shadow:0 2px 4px rgba(0,0,0,.1)]
│   ├── a.logo ["StyleSwift"]
│   ├── nav.main-nav [display:flex; gap:24px; color:#333; font-size:14px]
│   │   └── a.nav-link × 5 [color:#0066cc; font-weight:500]: 首页|产品|博客|关于|联系
│   └── div.user-actions [display:flex; gap:12px]
│       └── button.btn × 2 [background-color:#0066cc; color:#fff; border-radius:4px]: 登录|注册
├── main#content [display:flex; margin:80px 0 0 0]
│   ├── article.post [width:800px; padding:40px]
│   │   ├── h1 [font-size:32px; font-weight:700; color:#111] "如何设计高效的CSS架构"
│   │   ├── div.meta [color:#999; font-size:14px] — span × 3
│   │   ├── div.content [...: p×12, h2×4, img×3, pre.code×6, blockquote×2]
│   │   └── div.comments — div.comment × 18
│   └── aside.sidebar [width:300px; background-color:#f9f9f9; padding:20px]
│       └── div.widget × 3 [background-color:#fff; border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.08)]
└── footer.site-footer [background-color:#f5f5f5; color:#666; padding:40px]
    ├── div.footer-nav — a × 12
    └── div.copyright "© 2026"
```

### 3.2 grep

使用浏览器原生 `querySelectorAll` 和 DOM 遍历。

#### 3.2.1 Tool 定义

**文件位置：** `extension/sidepanel/tools.js`

工具名 `grep`，描述为"在当前页面中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）"。搜索方式自动检测——CSS 选择器（如 `.sidebar`、`nav > a.active`）或关键词（在标签名、class、id、文本内容、样式值中匹配）。参数包括 `query`（必填，CSS 选择器或关键词）、`scope`（可选，`self`/`children`/`subtree` 三级详情范围，默认 `children`）、`max_results`（可选，最多返回数量，默认 5，最大 20）。

#### 3.2.2 Content Script 端实现

**文件位置：** `extension/content/content.js`

`runGrep` 函数通过正则 `SELECTOR_PATTERN` 自动判断输入是 CSS 选择器还是关键词。CSS 选择器模式直接使用 `document.querySelectorAll` 搜索；关键词模式使用 `TreeWalker` 遍历 DOM，依次在标签名、className、id、直接文本、计算样式（backgroundColor/color）中匹配。搜索结果经过 `groupSimilarElements` 折叠后格式化输出。

#### 3.2.3 相似元素折叠

**文件位置：** `extension/content/content.js`

`groupSimilarElements` 根据 `elementSignature`（由标签名、className、子元素签名组成）将相同签名的搜索结果分组，记录组内计数和前 3 个元素的文本摘要，避免输出大量重复信息。

#### 3.2.4 输出格式化

**文件位置：** `extension/content/content.js`

`formatGrepOutput` 为每个匹配组输出：序号、选择器（含分组计数）、完整路径选择器、全量计算样式（不做详略控制）、有用的 HTML 属性、直接文本。根据 `scope` 参数展示子元素信息。内置 token 预算保护——结果超过 800 tokens 时自动降级 scope（subtree → children → self）。

`getAllComputedStyles` 与 `getPageStructure` 中的 `getComputedStyles` 不同，返回 `STYLE_WHITELIST` 中所有非默认值的属性，不做标签类型筛选。

输出示例：

```
>> grep(query=".main-nav", scope="children")

[1] nav.main-nav
    Path: body > header.site-header > nav.main-nav
    Styles: display:flex; gap:24px; color:#333; font-size:14px
    Children:
      a.nav-link × 5 [color:#0066cc; font-weight:500; padding:8px 12px]
```

### 3.3 apply_styles

CSS 注入/回滚在 Content Script 中执行；会话级持久化和 `active_styles:{domain}` 镜像同步在 Side Panel 中通过 chrome.storage 完成。

#### 3.3.1 Tool 定义

**文件位置：** `extension/sidepanel/tools.js`

工具名 `apply_styles`，支持三种 mode：`save`（注入 CSS 到页面，保存到当前会话，并同步当前域名的活动样式镜像，供刷新后自动恢复）、`rollback_last`（撤销最后一次样式修改）、`rollback_all`（回滚当前会话的全部样式）。参数包括 `css`（save 模式必填）和 `mode`（必填）。

#### 3.3.2 实现（跨两个执行环境）

**Content Script 端（`extension/content/content.js`）：** 维护 `cssStack` 数组作为变更栈。`injectCSS(css)` 先将新 CSS 压入栈，再根据运行环境自动选择注入方式：优先使用 `<style id="styleswift-active">`，严格 CSP 页面可降级到 `adoptedStyleSheets`，极端情况下返回 `scripting-api` 回退信号交给 Side Panel 处理。`rollbackCSS(scope)` 根据 scope 弹出栈顶元素或清空整个栈；`getActiveCSS()` 返回当前栈拼接结果，供 Side Panel 在回滚后重新同步存储。`loadSessionCSS(css)` / `unloadSessionCSS()` 用于会话切换时接管或卸载样式，并移除 `early-inject.js` 预注入的 `<style id="styleswift-active-persistent">`。

**Side Panel 端（`extension/sidepanel/tools.js`）：** `runApplyStyles` 函数根据 mode 分派执行，并始终以当前 `SessionContext` 为准：

- `rollback_all`：向 Content Script 发送回滚全部指令，清除当前会话的 `stylesKey`，再同步清空 `active_styles:{domain}`，最后更新样式摘要。
- `rollback_last`：向 Content Script 发送回滚最后一步指令，通过 `get_active_css` 获取剩余 CSS；若仍有内容，则用 `mergeCSS('', remainingCSS)` 归一化后写回当前会话，否则删除 `stylesKey`，随后同步 `active_styles:{domain}`。
- `save`：向 Content Script 发送注入指令；若 Content Script 返回 `scripting-api` 降级信号，则由 Side Panel 调用 `chrome.scripting.insertCSS` 完成注入。之后使用 `mergeCSS` 将新 CSS 与当前会话已有 CSS 去重合并，写回 `stylesKey`，再镜像到 `active_styles:{domain}`，并更新样式摘要。

#### 3.3.3 CSS 特异性策略

生成的 CSS 需要可靠地覆盖页面已有样式。通过 System Prompt 引导 LLM 和注入层级双重保障。

**System Prompt 中的 CSS 生成指引：** 使用具体选择器（如 `.site-header`、`main#content`），不用 `*` 或标签通配；所有声明加 `!important`；避免使用 `@import` 或修改 `<link>` 标签；颜色使用 hex 或 rgba，不使用 CSS 变量。

注入层级保障：

```
页面原始样式              ← 特异性由页面决定
  ↓
styleswift-active-persistent ← 活动会话样式镜像（early-inject.js 注入，document_start）
  ↓
styleswift-active           ← 当前会话样式（content.js 接管，document_idle）
  ↓
!important               ← 所有 StyleSwift 生成的规则都带 !important

注入位置：<head> 末尾，晚于页面 <link> 和 <style>，天然高优先级
```

#### 3.3.4 CSS 去重/合并策略

**文件位置：** `extension/sidepanel/css-merge.js`

多轮对话会不断追加 CSS，需要去重合并避免膨胀和冲突。

`mergeCSS(existingCSS, newCSS)` 先通过 `parseRules` 解析两份 CSS 为 `Map<selector, Map<property, value>>` 结构，然后按选择器合并——同选择器同属性以新值覆盖旧值。`parseRules` 先用 `splitTopLevelBlocks` 按顶层花括号正确分割（处理嵌套的 `@media`、`@keyframes` 等），普通规则按选择器+属性去重，at-rule 整体作为一个单元按 header 去重。`serializeRules` 将合并后的 Map 序列化回 CSS 文本。

合并时机：每次 `apply_styles(save)` 执行时调用 `mergeCSS(已有CSS, 新CSS)` 后写入存储，同一选择器的同一属性始终只保留最新值，CSS 不会无限增长。

#### 3.3.5 逐轮样式快照与时间旅行

**相关文件：** `extension/sidepanel/session.js`、`extension/sidepanel/agent-loop.js`、`extension/sidepanel/panel.js`

用户在同一会话中可能经过多轮对话打磨样式。为支持"点击任意历史消息回退到该轮对话对应的样式状态"，采用逐轮 CSS 快照机制。

**数据模型：** IndexedDB 中的对话数据从纯 `Array<message>` 变为 `{ messages: Array, snapshots: Object }` 结构。`snapshots` 是以轮次号为 key、该轮结束时合并后 CSS 为 value 的映射。向后兼容：`loadAndPrepareHistory` 检测到旧格式（纯数组）时自动转换为 `{ messages: data, snapshots: {} }`。

**快照捕获：** `agentLoop()` 主循环结束后、持久化历史之前，读取当前会话 `stylesKey` 中的 CSS，以 `countUserTextMessages(history)` 计算的轮次号为 key 存入 `snapshots`。

**回退（时间旅行）：** `rewindToTurn(domain, sessionId, targetTurn)` 函数从 IndexedDB 加载数据，计算目标轮次的消息边界并截断 messages，查找目标轮次的 CSS 快照（向前取最近的 `max(key <= targetTurn)`），裁剪后续快照，写回 IndexedDB，更新 `stylesKey` / `activeStylesKey`，通过 `loadSessionCSS` 注入页面。

**UI 交互：** 历史用户消息气泡在鼠标悬停时左侧显示"↩"回退按钮（最后一轮不显示），点击后弹出确认提示，确认后执行回退并重新渲染对话区。

**历史压缩兼容：** `checkAndCompressHistory` 压缩旧对话时，保留压缩边界处的 CSS 快照作为基准，删除更早的快照。

#### 3.3.6 CSP 兼容性

**文件位置：** `extension/content/content.js`

部分网站设置了严格的 Content Security Policy（CSP），其 `style-src` 指令可能阻止动态注入 `<style>` 标签。`detectCSSInjectionMethod()` 在首次收到工具调用时执行一次并缓存结果，按三级优先级选择注入方式。

三级降级方案：

```
优先级 1: <style> 标签注入
  → 默认方案，代码最简单
  → 被 CSP style-src 限制时失效

优先级 2: Constructable Stylesheets (document.adoptedStyleSheets)
  → Chrome 73+，不受大部分 CSP 限制
  → 需要维护 CSSStyleSheet 实例引用

优先级 3: chrome.scripting.insertCSS
  → 浏览器级别注入，完全绕过页面 CSP
  → 需要从 Side Panel / Service Worker 调用（非 Content Script）
  → 需要额外的 scripting 权限
  → 无法精细回滚（只能通过 chrome.scripting.removeCSS）
```

方案 2 通过 `CSSStyleSheet` 实例和 `document.adoptedStyleSheets` 注入样式，回滚时直接 `replaceSync` 更新后的栈内容。`injectCSSAuto` 统一分派函数根据检测结果选择方案，方案 3 返回 `{ fallback: 'scripting-api', css }` 由 Side Panel 处理。

> CSP 检测在 Content Script 首次收到工具调用时执行一次并缓存结果，不影响后续性能。

### 3.4 get_user_profile

**文件位置：** `extension/sidepanel/profile.js`

工具名 `get_user_profile`，无参数。描述为"获取用户的风格偏好画像"，建议在新会话开始或用户请求模糊时获取。实现直接从 `chrome.storage.local` 读取 `userProfile` 字段，新用户返回空提示。

### 3.5 update_user_profile

**文件位置：** `extension/sidepanel/profile.js`

工具名 `update_user_profile`，参数 `content`（完整画像内容，覆盖写入）。描述说明在发现新的偏好信号时调用（用户明确表达、通过修正暗示、反复选择模式等）。记录有意义的偏好洞察而非具体 CSS 代码，应在读取现有画像基础上整合新洞察。实现直接将 content 写入 `chrome.storage.local` 的 `userProfile` 字段。

### 3.6 load_skill

**文件位置：** `extension/sidepanel/tools.js`

工具名 `load_skill`，参数 `skill_name`。统一加载两类技能：内置静态知识（如 `dark-mode-template`、`minimal-template`、`design-principles`、`color-theory`、`css-selectors`）和用户动态风格技能（`skill:{id}` 格式）。

内置知识通过 `SKILL_PATHS` 映射到 `skills/` 目录下的静态资源文件，使用 `chrome.runtime.getURL` + `fetch` 读取。用户技能通过 `StyleSkillStore.load(id)` 从 chrome.storage 读取。未找到时返回可用技能列表提示。

Side Panel 作为扩展内部页面，可直接访问打包资源，无需声明 `web_accessible_resources`。

### 3.7 save_style_skill

**文件位置：** `extension/sidepanel/tools.js`

从当前会话中提取视觉风格特征，保存为可复用的风格技能。

#### 3.7.1 Tool 定义

工具名 `save_style_skill`，参数包括 `name`（风格名称）、`mood`（一句话描述，可选）、`skill_content`（风格技能文档，markdown 格式，必须包含风格描述、色彩方案、排版、视觉效果、设计意图、参考 CSS 六个部分）。强调提取抽象的风格特征而非复制具体 CSS，选择器是页面特定的，色彩/排版/效果才是可迁移的。

#### 3.7.2 实现

`runSaveStyleSkill` 生成 8 位短 UUID 作为 id，记录来源域名和创建日期，组装文档 header 后调用 `StyleSkillStore.save` 写入 chrome.storage。返回技能 id 和 `load_skill` 调用方式提示。

#### 3.7.3 Style Skill 文档格式

Style Skill 采用自由格式 markdown，遵循"记忆即文本"原则。以下是 LLM 生成的风格技能文档示例：

```markdown
# 赛博朋克

> 来源: github.com | 创建: 2026/3/4
> 风格: 深色背景+霓虹色调的高科技感

## 风格描述
深色背景配合霓虹色调的高科技感设计。主色调为深紫/深蓝，强调色使用明亮的
霓虹粉和电光蓝。文字以高对比度浅色为主，标题使用粗体并带有微光效果。

## 色彩方案
- 背景主色: #0a0a1a (深太空蓝)
- 背景辅色: #1a1a2e (稍亮的深蓝)
- 强调色: #ff00ff (霓虹粉), #00ffff (电光蓝)
- 文字主色: #e0e0e0 (浅灰)
- 文字辅色: #a0a0a0 (中灰)
- 边框: rgba(255, 0, 255, 0.3) (半透明霓虹粉)

## 排版
- 标题: 粗体, 较大字号, 可带 text-shadow 霓虹效果
- 正文: 常规字重, 舒适行高(1.6+)
- 导航/按钮: 中等字重

## 视觉效果
- 容器: 深色半透明背景 + 霓虹色 border 或 glow
- 按钮: 霓虹渐变或实色背景, hover 时发光增强
- 圆角: 中等 (6-8px)
- 阴影: 霓虹色外发光 (box-shadow with neon colors)
- 过渡: 颜色和阴影使用平滑过渡 (0.3s ease)

## 设计意图
用户希望营造科幻电影般的视觉体验，重点是：
1. 深色背景减轻视觉疲劳
2. 霓虹色点缀提供视觉焦点
3. 保持文字可读性（高对比度）

## 参考 CSS（来自 github.com，选择器不可直接复用）
body { background-color: #0a0a1a !important; color: #e0e0e0 !important; }
.Header { background: #1a1a2e !important; border-bottom: 1px solid rgba(255,0,255,0.3) !important; }
.btn-primary { background: linear-gradient(135deg, #ff00ff, #00ffff) !important; }
h1, h2, h3 { color: #fff !important; text-shadow: 0 0 10px rgba(0,255,255,0.5) !important; }
```

**为什么用这种格式：**

| 设计决策 | 原因 |
|---------|------|
| 自然语言描述 | LLM 理解设计意图（"为什么"），不只是"是什么" |
| 具体色值 | LLM 有精确参考，不需要猜 |
| 参考 CSS 片段 | LLM 看到具体实现模式（渐变方向、阴影写法），但知道选择器不可复用 |
| markdown 格式 | 与静态 Skill 一致，`load_skill` 无需改格式解析 |
| 不用 JSON schema | 遵循"记忆即文本"原则，不限制模型表达 |

### 3.8 list_style_skills

**文件位置：** `extension/sidepanel/tools.js`

工具名 `list_style_skills`，无参数。调用 `StyleSkillStore.list()` 获取所有用户保存的风格技能索引，返回每个技能的 id、名称、描述、来源域名和创建日期。空列表返回提示信息。

### 3.9 delete_style_skill

**文件位置：** `extension/sidepanel/tools.js`

工具名 `delete_style_skill`，参数 `skill_id`。先从索引中查找目标技能确认存在，然后调用 `StyleSkillStore.remove(skillId)` 删除。返回删除结果。

---

## 四、Task（子智能体）

### 设计原则

Subagent 遵循三个原则：隔离上下文（子智能体看不到父对话历史）、只给任务描述（不预设内部工作流）、返回摘要（父智能体只看到最终结果）。Subagent 在 Side Panel 中运行（与主 Agent Loop 同一 JS 上下文），共享同一个 API Key 和模型配置，可以调用 Content Script 的 DOM 工具。

### 4.1 Agent Types 注册表

**文件位置：** `extension/sidepanel/agent-loop.js`

`AGENT_TYPES` 对象注册可用的子智能体类型。当前定义了 `StyleGenerator`（样式生成专家），配置其可用工具集（`get_page_structure`、`grep`、`load_skill`）和 system prompt（说明任务为根据用户意图生成 CSS 代码，输出 JSON 格式包含 css、affected_selectors、description 三个字段）。

### 4.2 Task Tool 定义

**文件位置：** `extension/sidepanel/tools.js`

工具名 `Task`，参数包括 `description`（任务简短描述）、`prompt`（详细任务指令）、`agent_type`（子智能体类型，当前仅 `StyleGenerator`）。描述说明子智能体在隔离上下文中运行，适用于需要复杂推理、多次工具调用或可能产生大量中间输出的任务。

### 4.3 Subagent 执行

**文件位置：** `extension/sidepanel/agent-loop.js`

`runTask` 函数执行子智能体循环，最大迭代次数 `SUB_MAX_ITERATIONS = 10`。根据 `agentType` 从 `AGENT_TYPES` 获取配置，构建独立的 system prompt 和工具集，创建独立的 messages 数组（只包含任务 prompt）。循环调用 openai API，执行工具调用，直到模型返回文本（非 tool_use）或达到迭代上限。返回模型的最终文本输出作为摘要。

---

## 五、TodoWrite

**文件位置：** `extension/sidepanel/tools.js`

工具名 `TodoWrite`，描述为"更新任务列表，用于规划和追踪复杂任务的进度，简单任务不需要使用"。参数 `todos` 为数组，每个元素包含 `content`（任务描述）、`status`（pending/in_progress/completed）、`activeForm`（进行时形式）。模型自己决定是否使用。

---

## 六、Context（上下文管理）

### 6.1 四层上下文模型

```
Layer 0 — System Prompt（恒定，~200 tokens）
  身份 + 工作方式 + 工具列表

Layer 1 — Session Context（每次会话注入，~50-100 tokens）
  域名 + 会话标题 + 已有样式摘要 + 用户画像一句话提示

Layer 2 — Conversation History（动态增长，有 token 预算）
  用户消息 + Agent 回复 + 工具调用结果

Layer 3 — Tool Results（临时，各工具自控 token）
  get_page_structure: 500-2000 / grep: 200-800 / get_user_profile: 按画像大小
```

### 6.2 Layer 1 — Session Context 注入

**文件位置：** `extension/sidepanel/session.js`

`buildSessionContext(domain, sessionMeta, profileHint)` 构建会话上下文文本，包含域名、会话标题、已应用样式摘要（如有）和用户风格偏好一句话提示（如有，注明可通过 `get_user_profile` 获取详情）。`getProfileOneLiner()` 从 chrome.storage 读取用户画像，截取第一行前 100 字符作为提示。

### 6.3 Layer 2 — 对话历史与 Token 预算控制

**文件位置：** `extension/sidepanel/agent-loop.js`

利用 API 返回的 `response.usage.input_tokens` 做精确检测，历史存储在 IndexedDB 中。

`TOKEN_BUDGET = 50000`。`checkAndCompressHistory` 在输入 token 超预算时触发压缩：通过 `findTurnBoundary` 找到最近 10 轮对话的起始位置，将更早的历史交给 `summarizeOldTurns` 生成摘要（独立的 LLM API 调用，限制 500 tokens），压缩后的历史以 `[之前的对话摘要]` 消息替换旧内容。

`summarizeOldTurns` 将历史消息精简为文本（用户消息保留原文、助手消息截取前 200 字+工具调用列表），然后调用 openai API 生成不超过 300 字的摘要，重点保留用户风格偏好、已应用的样式变更和未完成的请求。

### 6.4 Context 保护原则

1. Tools 返回精简结果（各工具有独立 token 预算）
2. Subagent 中间推理不进入主 context
3. 用户画像：context 只注入一行提示，完整内容通过 `get_user_profile` 按需获取
4. Skills 通过 `load_skill` 按需加载，不前置塞入
5. 对话历史基于真实 token 用量做预算控制，超预算自动压缩
6. 会话切换时 context 完全替换

---

## 七、Storage（存储设计）

### 7.1 双层存储架构

```
┌─────────────────────────────────────────────────────────┐
│                   chrome.storage.local                   │
│                （轻量、高频读写的数据）                      │
│                                                         │
│  Key                                    Value           │
│  ────────────────────────────────────   ──────────────  │
│  "userProfile"                          string (纯文本)  │
│  "settings"                             object          │
│    { apiKey, apiBase, model }                           │
│  "active_styles:{domain}"               string (CSS)    │
│                                                         │
│  "sessions:{domain}:index"              array           │
│  "sessions:{domain}:{id}:meta"          object          │
│  "sessions:{domain}:{id}:styles"        string (CSS)    │
│                                                         │
│  "skills:user:index"                    array           │
│  "skills:user:{id}"                     string (md)     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                        IndexedDB                         │
│                （大体积、低频读写的数据）                     │
│                                                         │
│  Database: "StyleSwiftDB"                                │
│  Object Store: "conversations"                           │
│  Key: "{domain}:{sessionId}"                             │
│  Value: [...messages array...]                           │
└─────────────────────────────────────────────────────────┘
```

### 7.2 双层存储选型

| 数据 | 典型大小 | 读写频率 | 存在哪 | 理由 |
|------|---------|---------|--------|------|
| 用户画像 | <1KB | 低 | chrome.storage.local | 小而轻，需要快速读取 |
| API Key / API 地址 / 模型设置 | <1KB | 极低 | chrome.storage.local | 设置页读写（apiKey, apiBase, model） |
| 会话索引 | <5KB/域名 | 中 | chrome.storage.local | 打开 Side Panel 时需要立即展示列表 |
| 会话样式 | <50KB/会话 | 中 | chrome.storage.local | 恢复会话时需要快速注入 |
| 当前活动会话样式镜像 | <50KB/域名 | 每次页面加载 / 会话切换 | chrome.storage.local | `early-inject.js` 在 `document_start` 读取，页面刷新时可无闪烁恢复当前会话样式 |
| 风格技能索引 | <2KB | 低 | chrome.storage.local | 列出可用技能时快速读取 |
| 风格技能内容 | <5KB/个 | 低 | chrome.storage.local | 按需加载，单个技能文档不大 |
| **对话历史+快照** | **几十KB~几MB** | 低 | **IndexedDB** | `{ messages, snapshots }` 格式，含逐轮 CSS 快照 |

### 7.3 IndexedDB 封装

**文件位置：** `extension/sidepanel/session.js`

封装 IndexedDB 操作为 Promise 接口。`openDB()` 打开 `StyleSwiftDB` 数据库（版本 1），创建 `conversations` Object Store。`saveHistory(domain, sessionId, data)` 将 `{ messages, snapshots }` 对象以 `{domain}:{sessionId}` 为 key 写入。`loadHistory(domain, sessionId)` 读取并返回原始值。`loadAndPrepareHistory` 兼容旧格式（纯 messages 数组）和新格式（`{ messages, snapshots }` 对象），始终返回 `{ messages: Array, snapshots: Object }`。

### 7.4 活动会话样式自动注入

**文件位置：** `extension/content/early-inject.js`

通过 `document_start` 阶段的 Content Script 预注入当前活动会话样式，在页面渲染之前恢复样式，避免闪烁（FOUC）。脚本立即执行一个异步 IIFE：获取当前域名，从 `chrome.storage.local` 读取 `active_styles:{domain}` 对应的 CSS，创建 `<style id="styleswift-active-persistent">` 元素注入。因为 `document_start` 时 `<head>` 可能还不存在，优先追加到 `document.head`，否则追加到 `document.documentElement`。随后在 `document_idle` 阶段由 `content.js` 调用 `loadSessionCSS()` 接管，并移除这个预注入节点。

**两个 Content Script 的分工：**

| 脚本 | 注入时机 | 职责 |
|------|---------|------|
| `early-inject.js` | `document_start` | 仅预注入 `active_styles:{domain}` 镜像（DOM 构建前执行，防闪烁） |
| `content.js` | `document_idle` | DOM 工具 + 消息监听 + CSS 注入/回滚 + 会话样式接管 |

### 7.5 存储清理策略

**文件位置：** `extension/sidepanel/session.js`

chrome.storage.local 有 ~10MB 配额限制。长期使用后会话数据逐渐累积，需要自动清理。

`cleanupStorage()` 遍历所有域名的会话索引，按创建时间排序，保留每个域名最新的 `MAX_SESSIONS_PER_DOMAIN = 20` 个会话，超过 `SESSION_EXPIRE_DAYS = 90` 天的会话也一并清理。对于每个要删除的会话，移除其 meta、styles storage key 和 IndexedDB 中的对话历史。同时调用 `cleanupStyleSkills()` 清理超过 `MAX_STYLE_SKILLS = 50` 上限的最旧风格技能。`getStorageUsage()` 通过 `chrome.storage.local.getBytesInUse` 监控存储用量百分比。

**清理触发时机：** Side Panel 打开时后台静默执行（不阻塞 UI）；存储用量超过 80% 时主动告警提示用户清理；用户可通过设置页"清理历史数据"按钮手动触发。

### 7.6 存储 Schema 版本迁移

**文件位置：** `extension/sidepanel/session.js`

通过 `_schemaVersion` 字段记录当前存储 schema 版本（`CURRENT_SCHEMA_VERSION = 1`）。Side Panel 启动时 `checkAndMigrateStorage()` 检查版本号，按顺序执行 `migrations` 对象中注册的迁移函数。每次版本升级只需往 `migrations` 中添加对应版本号的迁移逻辑。

### 7.7 StyleSkillStore（风格技能存储）

**文件位置：** `extension/sidepanel/tools.js`

用户动态创建的风格技能的 CRUD 封装，实现为静态方法的类。索引存储在 `skills:user:index`，每个技能内容存储在 `skills:user:{id}`。

- `list()` — 返回索引数组
- `save(id, name, mood, sourceDomain, content)` — 写入/更新索引条目和内容
- `load(id)` — 按 id 读取技能内容
- `remove(id)` — 从索引中移除条目并删除内容 key

索引条目结构包含：`id`（8 位 UUID）、`name`（用户命名或 LLM 自动命名）、`mood`（一句话描述）、`sourceDomain`（创建时所在网站）、`createdAt`（创建时间戳）。

---

## 八、Session（会话管理）

### 8.1 三级隔离模型

```
全局层: chrome.storage.local["userProfile"]
  │
  └── 域名层: chrome.storage.local["sessions:{domain}:*"]
        │
        └── 会话层: chrome.storage.local["sessions:{domain}:{id}:*"]
              │     + IndexedDB["conversations"]["{domain}:{id}"]
              │
              └── 活跃镜像层: chrome.storage.local["active_styles:{domain}"]
```

### 8.2 会话生命周期

会话的 CRUD 由 Side Panel UI 负责，Agent 不参与会话管理逻辑。

```
用户打开 Side Panel（在 example.com 上）
│
├── Side Panel 读取 chrome.storage.local["sessions:example.com:index"]
│   → 展示该域名的会话列表
│
├── [选择已有会话]
│   ├── 创建 SessionContext(domain, id)
│   ├── 读取 ["sessions:example.com:{id}:styles"] → 同步到 ["active_styles:example.com"]
│   ├── Content Script load_session_css() 接管样式
│   ├── 从 IndexedDB 加载 history → 恢复对话
│   └── Agent 就绪
│
├── [新建会话]
│   ├── 生成 session_id (crypto.randomUUID())
│   ├── 更新 index
│   ├── 创建 SessionContext
│   ├── 卸载当前会话样式并清空 ["active_styles:{domain}"]
│   └── Agent 就绪
│
├── [切换会话]
│   ├── unload_session_css() 卸载当前会话样式
│   ├── 替换 SessionContext
│   ├── 读取目标会话 stylesKey
│   ├── 同步到 ["active_styles:{domain}"]
│   └── load_session_css() 加载目标会话样式
│
└── [删除会话]
    ├── 二次确认弹窗（最后一个会话使用特殊提示文案）
    ├── 移除 chrome.storage.local 中该会话的 meta、styles
    ├── 从 sessions:{domain}:index 中移除条目
    ├── 删除 IndexedDB 中的对话历史
    └── 若删除的是当前会话 → 自动切换到最近的会话或新建；新建时会清空 ["active_styles:{domain}"]
```

### 8.3 会话删除

**文件位置：** `extension/sidepanel/session.js`

`deleteSession(domain, sessionId)` 依次执行：从索引中移除条目、删除该会话的 meta 和 styles storage key、删除 IndexedDB 中的对话历史。如果是该域名最后一个会话，返回 `{ lastSession: true }`，供 UI 展示“该域名最后一个会话”的特殊确认提示。

> 注意：当前实现不再维护独立的域名级“永久样式”；`active_styles:{domain}` 只是当前活动会话的镜像，会在新建空会话、切换到无样式会话或相关回滚操作后被同步清空。

### 8.4 会话标题自动生成

**文件位置：** `extension/sidepanel/session.js`

`autoTitle(sessionMeta, firstUserMessage)` 在会话尚无标题时，取首条用户消息的前 20 字符作为标题。

### 8.5 会话辅助函数

**文件位置：** `extension/sidepanel/session.js`

Agent Loop 中引用的会话操作函数：`loadAndPrepareHistory` 从 IndexedDB 加载历史并确保返回数组；`loadSessionMeta`/`saveSessionMeta` 读写会话元数据（标题、创建时间、消息计数）；`updateStylesSummary` 读取当前会话样式 CSS，统计规则数量和前 3 个选择器生成一行摘要，写入会话 meta 的 `activeStylesSummary` 字段用于 Session Context 注入。

---

## 九、API Key 与连接管理

### 9.1 存储

**文件位置：** `extension/sidepanel/api.js`

默认 API 地址 `DEFAULT_API_BASE = 'https://api.openai.com'`。`saveSettings({ apiKey, apiBase, model })` 将设置写入 `chrome.storage.local` 的 `settings` 字段，支持部分更新（未提供的字段保留原值），model 默认 `claude-sonnet-4-20250514`。`getSettings()` 读取设置，未配置 API Key 时抛出错误提示用户。

### 9.2 自定义 API 地址

支持用户配置 openai API 代理/中转地址，覆盖默认的 `https://api.openai.com`。

**典型场景：**

- 国内用户通过代理/中转站访问 openai API
- 企业内部 API 网关
- 兼容 openai 格式的第三方服务（OpenRouter 等）

**权限动态申请（`extension/sidepanel/api.js`）：**

manifest 中 `host_permissions` 只声明了默认地址。`ensureApiPermission(apiBase)` 在用户填写自定义地址时，通过 `chrome.permissions.contains` 检查是否已授权，未授权则调用 `chrome.permissions.request` 动态申请 `optional_host_permissions`。

**连接验证（`extension/sidepanel/api.js`）：**

`validateConnection(apiKey, apiBase)` 向 API 发送一个 `max_tokens: 1` 的最小请求验证 Key 和地址是否有效，返回 `{ ok, status }` 或 `{ ok: false, error }`。

### 9.3 安全措施

1. API Key 存在 `chrome.storage.local`，不同步到云端（不用 `chrome.storage.sync`）
2. Content Script 无法访问 API Key（只有 Side Panel 可以）
3. 所有 API 调用从 Side Panel 发出，不经过页面上下文
4. 不在代码中硬编码任何 Key
5. 自定义 API 地址仅通过 `optional_host_permissions` 动态授权，不预置宽泛权限

### 9.4 首次使用引导

```
用户安装插件
  → 打开 Side Panel
  → 检测到无 API Key
  → 显示引导页：
    "StyleSwift 需要 openai API Key 才能工作。"
    [输入 API Key]
    [API 地址（可选，默认 https://api.openai.com）]
    [获取 Key 的教程链接]
    [保存]
  → 验证连接有效性
  → 成功 → 进入主界面
```

---

## 十、Agent Loop（核心循环）

### 10.1 LLM API 调用（Streaming）

**文件位置：** `extension/sidepanel/api.js`

`callopenaiStream(system, messages, tools, callbacks, abortSignal)` 从 Side Panel 直接调用 openai Streaming API。通过 `getSettings()` 获取 apiKey/model/apiBase，使用 `fetch` 发送 POST 请求（附带 `openai-dangerous-direct-browser-access` header，这是 openai 官方支持的浏览器直接调用方式）。

SSE 流式解析：使用 `ReadableStream` reader 逐块读取，按 `\n` 分行解析 `data:` 前缀的 SSE 事件。处理四种事件类型：`content_block_start`（初始化文本/工具调用块）、`content_block_delta`（流式文本回调 `callbacks.onText` / 工具参数 JSON 累积）、`content_block_stop`（解析工具参数 JSON 并回调 `callbacks.onToolCall`）、`message_delta`（获取 stop_reason 和 usage）。返回完整的 response 对象。

#### UI 消息展示策略

> 完整 UI 设计详见「十六、UI 界面设计」。此处为 Agent Loop 层面的展示回调接口说明。

**文本消息（text block）：** 在对话气泡中逐字流式展示（打字机效果）。

**工具调用（tool_use block）：** 可交互折叠卡片，处理中显示 "🔧 工具名 ◌ 进行中"，完成后折叠为 "✅ 工具名 ▸"，点击展开输入/输出详情。连续的工具调用紧凑排列在同一卡片组内。

**样式应用确认浮层：** Agent 本轮完成后，若执行了 `apply_styles(save)`，在输入框上方浮现确认/撤销按钮。等整轮结束后统一出一次浮层。单次应用显示 `[✓ 确认效果] [↶ 撤销]`；多次应用显示 `[✓ 全部确认] [↶ 撤销最后一步 ▾]`（展开可选"全部撤销"）。浮层消失条件：点击确认/撤销、用户发新消息（隐式确认）、60s 超时。

**取消操作：** Agent 运行期间发送按钮变为停止按钮（■），点击调用 `cancelAgentLoop()` 中断 fetch + 解锁 Tab。已应用的样式保留，对话历史保存到中断位置。

**并发保护：** Agent 运行期间禁用输入框，显示"正在处理中..."，防止状态错乱。

### 10.2 工具执行器

**文件位置：** `extension/sidepanel/tools.js`

`executeTool(name, args)` 按工具名分派执行。需要 Content Script 的工具（`get_page_structure`、`grep`、`apply_styles`）通过 `sendToContentScript` 发送消息；Side Panel 本地工具（`get_user_profile`、`update_user_profile`、`load_skill`、`save_style_skill`、`list_style_skills`、`delete_style_skill`、`TodoWrite`、`Task`）直接调用对应函数。

### 10.3 Content Script 通信

**文件位置：** `extension/sidepanel/agent-loop.js`（Side Panel 端）、`extension/content/content.js`（Content Script 端）

Side Panel 端的 `sendToContentScript` 始终使用 `getTargetTabId()` 获取目标 Tab ID（见 2.5 节），通过 `chrome.tabs.sendMessage` 发送并等待响应。

Content Script 端通过 `chrome.runtime.onMessage.addListener` 注册消息监听器，根据 `message.tool` 分派执行：`get_domain` 返回 `location.hostname`；`get_page_structure` 调用 `getPageStructure()`；`grep` 调用 `runGrep()`；`inject_css` 调用 `injectCSSAuto()`（CSP 兼容分派）；`rollback_css` 调用 `rollbackCSS()`；`get_active_css` 返回当前 cssStack 内容。监听器返回 `true` 以支持异步 `sendResponse`。

Content Script 还包含 SPA 页面导航检测：通过 `MutationObserver` 监听 `document.body` 子树变化和 `popstate` 事件，当 `location.href` 变化时发送 `page_navigated` 消息通知 Side Panel。

### 10.4 主循环

**文件位置：** `extension/sidepanel/agent-loop.js`

**System Prompt（`SYSTEM_BASE`）：** 定义 StyleSwift 身份为网页样式个性化智能体，说明工作方式（使用工具完成任务、优先行动而非解释、完成后简要总结），列出所有可用工具名称，包含 CSS 生成指引（使用具体选择器、加 !important、用 hex/rgba 颜色）和风格技能使用规范。

**工具集合：** `BASE_TOOLS` 包含 9 个基础工具 + TodoWrite；`ALL_TOOLS` 在此基础上加 Task 工具。

**主循环 `agentLoop(prompt, uiCallbacks)`：**

1. **并发保护** — 通过 `isAgentRunning` 标志拒绝重复请求，创建 `AbortController` 支持取消。
2. **初始化** — 锁定当前 Tab、获取域名、获取或创建会话、实例化 `SessionContext`。
3. **加载历史** — 从 IndexedDB 加载对话历史。
4. **构建 system prompt** — `SYSTEM_BASE` + `buildSessionContext`（域名/会话/画像提示）。
5. **迭代循环**（最大 `MAX_ITERATIONS = 20`）— 每轮检查取消信号，调用 `callopenaiStream` 获取流式响应（通过 `uiCallbacks` 实时展示文本和工具调用），若 `stop_reason` 非 `tool_use` 则结束；否则依次执行所有工具调用，将结果加入历史，超预算时自动压缩历史。
6. **持久化** — 保存历史到 IndexedDB，首轮自动设置会话标题。
7. **清理** — `finally` 块中解锁 Tab、重置运行状态。

`cancelAgentLoop()` 通过 abort AbortController 中断 fetch，解锁 Tab 并重置状态。

---

## 十一、错误处理

### 11.1 错误分类与处理策略

```
┌──────────────────────┬────────────────────────────┬───────────────────────────┐
│ 错误类型              │ 检测方式                     │ 处理策略                   │
├──────────────────────┼────────────────────────────┼───────────────────────────┤
│ API Key 无效/过期     │ HTTP 401                   │ 提示用户更新 Key，跳转设置页 │
│ API 限额耗尽          │ HTTP 429                   │ 显示剩余额度提示 + 重试倒计时│
│ 网络断开              │ fetch 抛出 TypeError        │ 显示离线提示，自动重试       │
│ API 响应异常          │ HTTP 5xx / 解析失败         │ 显示错误详情 + 重试按钮      │
│ Content Script 不可用 │ chrome.runtime.lastError   │ 提示"此页面不支持样式修改"   │
│ 受限页面              │ URL 以 chrome:// 等开头     │ 预检测，不发送工具调用       │
│ Agent 死循环          │ iterations >= MAX_ITERATIONS│ 自动停止 + 保存已有进度     │
│ Storage 写入失败      │ chrome.storage 回调 error   │ 降级为内存暂存 + 提示用户    │
└──────────────────────┴────────────────────────────┴───────────────────────────┘
```

### 11.2 受限页面预检测

**文件位置：** `extension/sidepanel/agent-loop.js`

`RESTRICTED_PATTERNS` 定义了一组正则匹配受限 URL（`chrome://`、`chrome-extension://`、`edge://`、`about:`、`file://`、Chrome 应用商店、Edge 扩展商店）。`checkPageAccess(tabId)` 在 Agent Loop 启动前通过向 Content Script 发送 `get_domain` 探测是否可达，不可达时返回错误原因提示。

### 11.3 API 调用错误处理

**文件位置：** `extension/sidepanel/api.js`

`callopenaiStreamSafe` 包装 `callopenaiStream`，最多重试 `MAX_RETRIES = 2` 次。针对不同错误码分类处理：401 抛出 `AgentError('API_KEY_INVALID')`；429 按指数退避等待后重试（2s, 4s）；`TypeError` 识别为网络错误；其他错误包装为 `API_ERROR`。`AgentError` 继承 `Error` 并附带 `code` 字段。

---

## 十二、交互流程示例

### 12.1 基本场景：深色模式

```
用户: "把这个页面改成深色模式"

Agent Loop（Side Panel 中运行）:
│
├── [1] 调 LLM → 返回 tool_use: get_page_structure
│   ├── Side Panel 发 chrome.tabs.sendMessage(tabId, {tool: 'get_page_structure'})
│   ├── Content Script 遍历 live DOM → 返回树形文本
│   └── UI: 🔧 查看页面结构 [折叠]
│
├── [2] 调 LLM（附带页面结构）→ 返回 tool_use: load_skill('dark-mode-template')
│   ├── Side Panel 从扩展静态资源读取 skills/style-templates/dark-mode.md
│   └── UI: 🔧 加载深色模式知识 [折叠]
│
├── [3] 调 LLM（附带知识）→ 返回 tool_use: apply_styles(css, mode='save')
│   ├── Side Panel 发 chrome.tabs.sendMessage(tabId, {tool: 'inject_css', args: {css}})
│   ├── Content Script 创建 <style id="styleswift-active">，注入 CSS
│   ├── Side Panel 写入 chrome.storage.local（会话样式 + active_styles 镜像）
│   ├── mergeCSS 去重合并
│   └── UI: 🔧 应用样式 [折叠]
│
├── [4] 调 LLM → 返回 text: "已为页面应用深色模式..."
│   └── UI: 流式展示文本回复
│
└── 持久化 history 到 IndexedDB
```

### 12.2 多轮调整场景

```
用户: "不错，但标题太暗了，看不清"

Agent:
├── grep(query="h1, h2, h3")  → 查看标题元素当前样式
├── apply_styles(css_for_headings, mode='save')
├── update_user_profile("偏好：深色模式下标题用高对比度浅色")
└── 响应: "已调亮标题颜色为 #e0e0e0，下次生成深色模式时会保持标题高对比度"

用户: "还是不行，撤回这一步吧"

Agent:
├── apply_styles(mode='rollback_last')
└── 响应: "已撤销最后一次标题颜色修改，恢复到深色模式基础样式"

用户: "算了，全部撤回"

Agent:
├── apply_styles(mode='rollback_all')
└── 响应: "已撤回所有样式修改，页面恢复原样"
```

### 12.3 时间旅行场景

```
（用户经过 3 轮对话：Turn 1 应用深色模式，Turn 2 调亮标题，Turn 3 修改侧栏）
（此时 snapshots: { 1: css1, 2: css1+css2, 3: css1+css2+css3 }）

用户: 点击 Turn 1 消息旁的"↩"回退按钮
  → 确认对话框: "回到这一轮？之后的对话和样式修改将被丢弃。"
  → 确认

Panel:
├── rewindToTurn(domain, sessionId, 1)
│   ├── 截断 messages 到 Turn 1 结束位置
│   ├── 加载 snapshots[1] = css1
│   ├── 裁剪 snapshots: 删除 key > 1 的条目
│   ├── 写回 IndexedDB + 更新 stylesKey/activeStylesKey
│   └── loadSessionCSS(css1) → 页面恢复到 Turn 1 的样式
├── renderHistoryMessages(truncatedMessages)
└── 用户可从 Turn 1 继续发新消息（成为新的 Turn 2）
```

### 12.4 风格迁移场景：保存风格

```
（在 github.com 上，用户经过多轮对话得到了满意的赛博朋克风格）

用户: "这个风格很棒，帮我保存下来，以后其他网站也想用"

Agent:
├── [分析] 回顾当前会话中累积的 CSS 和对话意图
├── save_style_skill(
│     name: "赛博朋克",
│     mood: "深色背景+霓虹色调的高科技感",
│     skill_content: "# 赛博朋克\n\n## 风格描述\n深色背景配合霓虹色调..."
│   )
└── 响应: "已保存「赛博朋克」风格技能，你可以在任意网站说'用我的赛博朋克风格'来应用"
```

### 12.5 风格迁移场景：应用风格到新网站

```
（用户切换到 stackoverflow.com）

用户: "用我的赛博朋克风格"

Agent:
├── [1] list_style_skills
│   → skill:a1b2c3d4「赛博朋克」— 深色背景+霓虹色调 (来自 github.com)
│
├── [2] load_skill("skill:a1b2c3d4")
│   → 读取完整风格文档（色彩方案、排版、视觉效果、设计意图、参考 CSS）
│
├── [3] get_page_structure
│   → 了解 stackoverflow 的 DOM 结构（.s-topbar, .question, .answer 等）
│
├── [4] 根据风格文档生成适配 stackoverflow 选择器的 CSS
│   └── 核心：色彩/效果从 skill 文档获取，选择器从页面结构获取
│
├── [5] apply_styles(css, mode='save')
│
└── 响应: "已将赛博朋克风格应用到 stackoverflow.com，
    深色背景(#0a0a1a)、霓虹强调色、发光边框效果已适配页面结构"
```

### 12.6 风格技能管理

```
用户: "我保存过哪些风格？"

Agent:
├── list_style_skills
└── 响应:
    "你保存了以下风格技能：
     1. 「赛博朋克」— 深色背景+霓虹色调 (来自 github.com, 2026/3/4)
     2. 「清新日式」— 浅色暖调+圆角卡片 (来自 notion.so, 2026/3/2)
     3. 「极简黑白」— 纯黑白+大留白 (来自 medium.com, 2026/2/28)"

用户: "删掉极简黑白吧，不常用"

Agent:
├── delete_style_skill(skill_id: "c3d4e5f6")
└── 响应: "已删除「极简黑白」风格技能"
```

---

## 十三、设计原则总结

| 原则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **模型即智能体** | 代码只提供能力 | 代码预判决策 |
| **能力原子化** | Tools 只做一件事 | Tools 包含推理 |
| **知识按需加载** | `load_skill` 工具 | 代码自动加载 |
| **推理隔离** | Subagent 隔离上下文 | 主循环处理复杂推理 |
| **信任模型** | 让模型自己决定 | 预设工作流 |
| **Context 珍贵** | 四层分离，按需获取 | 塞入所有信息 |
| **记忆即文本** | 自由文本画像，模型自己管理 | 结构化 JSON 限制表达 |
| **会话隔离** | 域名分割 + 多会话 | 单一全局 history |
| **零部署** | 纯插件，安装即用 | 要求用户部署后端 |
| **最短路径** | 直接操作 DOM，不经中间文件 | 序列化→传输→反序列化 |
| **存储就近** | 数据存在使用它的地方 | 跨进程传输数据 |
| **风格即文本** | 自然语言风格描述，模型理解并适配 | CSS 复制粘贴或刚性变量映射 |

> **The model already knows how to be an agent. Your job is to get out of the way.**

---

## 十四、测试策略

Chrome 扩展的三个执行上下文（Side Panel、Service Worker、Content Script）相互隔离，测试需要分层覆盖。

### 14.1 单元测试

纯函数可脱离浏览器环境独立测试，使用 Vitest 或 Jest：

```
可单测的模块：
├── css-merge.js      → mergeCSS, parseRules, splitTopLevelBlocks, serializeRules
├── session.js        → SessionContext key 生成逻辑
├── style-skill.js    → StyleSkillStore CRUD（mock chrome.storage）
├── content.js 中的纯函数
│   ├── shortSelector, getDirectText, sameSignature
│   ├── groupSimilar, summarizeChildren
│   ├── formatTree, formatTreeNode, formatNodeDecoration
│   ├── estimateTokens
│   └── elementSignature（需 mock DOM）
└── agent-loop.js     → findTurnBoundary, checkAndCompressHistory（mock LLM）
```

典型单元测试场景包括：`mergeCSS` 的同选择器同属性覆盖、不同选择器合并、`@media` 规则整体保留等（测试文件位于项目测试目录中）。

### 14.2 集成测试

使用 Puppeteer 的扩展测试模式，通过 `--disable-extensions-except` 和 `--load-extension` 参数加载未打包的扩展进行端到端测试。

```
集成测试覆盖：
├── Side Panel ↔ Content Script 通信
│   ├── get_domain 返回正确域名
│   ├── get_page_structure 返回有效树形结构
│   ├── grep 关键词/选择器搜索结果正确
│   ├── inject_css 样式生效（DOM 验证）
│   └── rollback_css 样式恢复
│
├── 存储读写
│   ├── chrome.storage.local CRUD
│   ├── IndexedDB 对话历史读写
│   ├── StyleSkillStore 增删查改
│   └── 存储清理逻辑（含 skill 清理）
│
├── CSP 降级
│   ├── 正常页面使用 <style> 注入
│   └── 严格 CSP 页面降级到 adoptedStyleSheets
│
└── 刷新恢复
    ├── early-inject.js 在 document_start 预注入 active_styles
    └── content.js 在 document_idle 接管当前会话样式
```

### 14.3 手动测试清单

```
核心流程：
☐ 安装扩展 → 点击图标 → Side Panel 打开
☐ 首次使用 → API Key 引导页 → 输入 Key → 验证通过
☐ 输入 "把背景改成深蓝色" → 流式展示 → 页面样式变化
☐ 输入 "撤回" → 样式恢复
☐ 关闭 Side Panel → 重新打开 → 对话历史恢复
☐ 刷新页面 → 当前活动会话样式自动恢复（无闪烁）

风格迁移：
☐ 在网站 A 完成风格 → "保存这个风格" → 技能创建成功
☐ 切换到网站 B → "用我的XX风格" → 风格正确适配（色彩一致，选择器不同）
☐ "我保存过哪些风格" → 列出所有风格技能
☐ "删掉XX风格" → 技能删除成功
☐ 保存 50+ 个技能 → 自动清理最旧的

边界场景：
☐ chrome:// 页面 → 提示不支持
☐ Agent 处理中切换 Tab → 操作不受影响
☐ Agent 处理中点击停止 → 正确中断
☐ 快速连发两条消息 → 第二条被拒绝/排队
☐ API Key 无效 → 错误提示 + 跳转设置
☐ 网络断开 → 离线提示
☐ 大型页面（>10000 DOM 节点）→ get_page_structure 不卡顿
```

---

## 十五、风格迁移（Style Skill）

### 15.1 设计理念

用户在某个网站上通过多轮对话打磨出满意的视觉风格后，希望将其"迁移"到其他网站。核心挑战在于：**CSS 是页面特定的（选择器绑定 DOM），但视觉风格是跨页面通用的（色彩/排版/效果）**。

解决方案：引入 **Style Skill**——从对话中提取抽象的"风格 DNA"，存储为自然语言文档。在新页面上，LLM 读取风格 DNA 并结合目标页面的 DOM 结构，重新生成适配的 CSS。

```
传统方案（不可行）：
  github.com 的 CSS  ──复制粘贴──→  stackoverflow.com
  ✗ 选择器 .Header 在 stackoverflow 不存在

Style Skill 方案：
  github.com 的对话  ──LLM 提取──→  风格 DNA（色彩/排版/效果/意图）
                                         │
  stackoverflow.com  ──LLM 适配──→  新 CSS（.s-topbar 等目标选择器）
  ✓ 视觉一致，选择器适配
```

**关键设计决策：不引入"风格变量系统"或"CSS 转换引擎"。** 从页面 A 的 `.Header` 选择器映射到页面 B 的 `nav.topbar`——这恰恰是 LLM 最擅长的：理解语义、适配结构。代码只提供 save/load 能力，风格迁移的智能全交给模型。

### 15.2 静态 Skill vs 动态 Style Skill

| | 静态 Skill | 动态 Style Skill |
|---|---|---|
| 来源 | 预设的设计领域知识 | 从用户对话中提取 |
| 内容 | 通用方法论（如"深色模式怎么做"） | 具体的色彩/排版/效果方案 |
| 适用性 | 所有网站、所有用户通用 | 风格通用，CSS 需按页面适配 |
| 存储位置 | 扩展内打包（`skills/` 目录） | `chrome.storage.local` |
| 加载方式 | `load_skill('dark-mode-template')` | `load_skill('skill:a1b2c3d4')` |
| 生命周期 | 随扩展版本更新 | 用户创建/删除 |

两者通过同一个 `load_skill` 工具加载，对 LLM 来说是统一的知识源。

### 15.3 生命周期

```
[创建] 用户在网站 A 上对话得到满意风格
         │
         ▼
  Agent 分析当前会话的 CSS + 对话意图
         │
         ▼
  save_style_skill → 提取风格 DNA → 写入 chrome.storage.local
         │
         ▼
[使用] 用户在网站 B 上说"用我的XX风格"
         │
         ▼
  list_style_skills → 找到匹配技能
         │
         ▼
  load_skill('skill:{id}') → 读取风格 DNA
         │
         ▼
  get_page_structure → 获取网站 B 的 DOM 结构
         │
         ▼
  Agent 根据风格 DNA + 目标 DOM → 生成适配 CSS
         │
         ▼
  apply_styles(css, 'save') → 注入并保存
         │
         ▼
[管理] 用户可以 list / delete 已保存的技能
```

### 15.4 涉及的工具

| 工具 | 职责 | 定义章节 |
|------|------|---------|
| `save_style_skill` | 提取风格特征，保存为 Style Skill | 3.7 |
| `load_skill` | 加载静态知识或用户 Style Skill（已扩展） | 3.6 |
| `list_style_skills` | 列出所有用户保存的 Style Skill | 3.8 |
| `delete_style_skill` | 删除指定 Style Skill | 3.9 |
| `StyleSkillStore` | 存储层 CRUD 封装 | 7.7 |

### 15.5 设计原则对齐

| 原则 | 风格迁移如何遵循 |
|------|----------------|
| **模型即智能体** | 提取什么特征、如何适配新页面——全由模型推理决定 |
| **能力原子化** | `save_style_skill` 只存储，`load_skill` 只读取，风格理解是模型的推理 |
| **记忆即文本** | Style Skill 是自由格式 markdown，不是僵硬的 JSON schema |
| **知识按需加载** | 技能列表按需查询，完整内容通过 `load_skill` 按需获取 |
| **Context 珍贵** | 技能文档不预加载，只在用户需要风格迁移时才进入 context |
| **零部署** | 全部存在 chrome.storage.local，无需后端服务 |
| **信任模型** | 不预设"先提取色板再映射选择器"的工作流，模型自己决定策略 |

---

## 十六、UI 界面设计

### 16.1 设计约束

Chrome Side Panel 宽度约 **360-420px**，高度跟随浏览器窗口。所有界面在此尺寸内以**单列纵向流**布局，不做横向多列分割。

### 16.2 视图结构

| 视图 | 触发条件 | 核心内容 |
|------|---------|---------|
| **首次引导页** | 无 API Key 时自动展示 | API Key 输入 + API 地址（可选）+ 简要说明 |
| **聊天主界面** | 默认主视图 | 顶栏 + 技能快捷区 + 对话区 + 操作浮层 + 输入区 |
| **会话下拉面板** | 点击顶栏会话标题 | 按域名分组的历史会话列表 + 新建/删除 |
| **设置页** | 点击顶栏齿轮图标 | API Key + API 地址 + 模型 + 存储用量 + 清理 |

### 16.3 聊天主界面布局

Side Panel 从上到下分为 5 个区域：

```
┌─────────────────────────────┐
│  ① 顶栏 (Top Bar)           │  ← 固定，~44px
├─────────────────────────────┤
│  ② 风格技能快捷区            │  ← 固定/可折叠，~64px
├─────────────────────────────┤
│                             │
│  ③ 对话区 (Chat Area)       │  ← 自适应高度，可滚动
│                             │
│                             │
├─────────────────────────────┤
│  ④ 操作确认浮层（条件出现）   │  ← 样式应用后浮现
│  ⑤ 输入区 (Input Area)      │  ← 固定底部，~56px
└─────────────────────────────┘
```

#### ① 顶栏 (Top Bar)

```
┌─────────────────────────────────────────┐
│ 🟢  github.com · 深色模式调整  ▾    ⚙️  │
└─────────────────────────────────────────┘
     ↑        ↑                ↑      ↑
  状态灯   域名       会话标题+切换   设置
```

**组成元素：**

| 元素 | 说明 |
|------|------|
| 状态指示灯 | 小圆点，3 种状态色：🟢 就绪 / 🟡 处理中（带呼吸动画） / 🔴 错误 |
| 域名 | 当前页面域名，灰色小字 |
| 会话标题 | 取自首条消息前 20 字，点击触发会话下拉面板 |
| ▾ 下拉箭头 | 点击展开会话管理浮层 |
| ⚙️ 设置 | 进入设置页 |

#### ② 风格技能快捷区

横向滚动的 pill/chip 列表，始终展示在对话区上方：

```
┌─────────────────────────────────────────────┐
│ 🎨 [🌙 深色模式] [✨ 极简风] [🔮 赛博朋克] [🌸 清新日式] ▸ │
└─────────────────────────────────────────────┘
       ↑ 内置静态技能           ↑ 用户动态技能       ↑ 横向滚动
```

**设计规则：**

| 特性 | 说明 |
|------|------|
| 排列顺序 | 静态内置技能在前（深色模式、极简风等），用户保存的 Style Skill 在后 |
| 视觉区分 | 内置技能用实心 chip；用户技能用描边 chip + 来源域名小标签 |
| 点击行为 | 点击 chip → 自动在输入框填入"应用 [技能名] 风格"并发送 |
| 长按/右键 | 用户技能支持长按弹出菜单：应用 / 查看详情 / 删除 |
| 空状态 | 暂无用户技能时，末尾显示虚线 `+ 从当前风格创建` chip |
| 自动折叠 | 对话超过一定长度时自动折叠为单行提示，左侧 🎨 图标可手动展开/折叠 |

**chip 视觉规格：**

```
内置技能 chip:                 用户技能 chip:
┌──────────────┐              ┌──────────────────┐
│ 🌙 深色模式   │              │ 🔮 赛博朋克       │  ← 描边样式
└──────────────┘              │    github.com     │  ← 来源域名，更小的灰色字
  ↑ 实心背景                   └──────────────────┘
```

#### ③ 对话区 (Chat Area)

**用户消息：** 右对齐气泡，简洁色调。

```
                        ┌────────────────────┐
                        │ 把这个页面改成深色模式 │
                        └────────────────────┘
```

**Agent 文本回复：** 左对齐，流式逐字展示（打字机效果）。

```
┌──────────────────────────────────────┐
│ 已为页面应用深色模式。背景色改为        │
│ #1a1a2e，文字调整为浅灰 #e0e0e0，      │
│ 导航栏和侧边栏也做了相应适配。          │
└──────────────────────────────────────┘
```

**工具调用卡片（可交互折叠）：**

```
处理中状态：
┌──────────────────────────────────────┐
│ 🔧 查看页面结构              ◌ 进行中  │
└──────────────────────────────────────┘

完成后折叠态（默认）：
┌──────────────────────────────────────┐
│ ✅ 查看页面结构                   ▸  │
└──────────────────────────────────────┘

完成后展开态（点击 ▸ 展开）：
┌──────────────────────────────────────┐
│ ✅ 查看页面结构                   ▾  │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ 输入: (无参数)                       │
│ 输出:                                │
│ URL: https://github.com/...          │
│ body [bg:#fff; color:#333]           │
│   ├── header.site-header [...]       │
│   ├── main#content [...]             │
│   └── footer [...]                   │
│                                 │
└──────────────────────────────────────┘
```

**多步工具调用聚合展示：** 连续的工具调用卡片紧凑排列在同一卡片组内。

```
┌──────────────────────────────────────┐
│ ✅ 查看页面结构                   ▸  │
│ ✅ 加载深色模式知识                ▸  │
│ ✅ 应用样式                       ▸  │
└──────────────────────────────────────┘
已为页面应用深色模式。背景色改为...
```

#### ④ 操作确认浮层

当 Agent 本轮结束且执行了 `apply_styles(mode='save')` 时，在输入框上方浮现确认/撤销按钮。

**单次样式应用：**

```
┌─────────────────────────────────────────┐
│     [ ✓ 确认效果 ]    [ ↶ 撤销 ]        │  ← 淡入动画
├─────────────────────────────────────────┤
│  继续调整或描述新需求...        [ ➤ ]    │
└─────────────────────────────────────────┘
```

**本轮多次样式应用：**

```
┌─────────────────────────────────────────┐
│  [ ✓ 全部确认 ]  [ ↶ 撤销最后一步 ▾ ]   │
├─────────────────────────────────────────┤
│  继续调整...                    [ ➤ ]    │
└─────────────────────────────────────────┘

点击 ▾ 展开：
┌───────────────────┐
│ ↶ 撤销最后一步     │
│ ↶↶ 全部撤销       │
└───────────────────┘
```

**浮层交互规则：**

| 操作 | 行为 |
|------|------|
| 点击"确认效果" | 浮层消失（淡出），样式保留，纯 UI 操作不调 Agent |
| 点击"撤销" | Side Panel 直接调用 `executeTool('apply_styles', { mode: 'rollback_last' })` 撤销最后一步样式，浮层消失 |
| 用户直接输入新消息 | 浮层自动消失（视为隐式确认），进入新一轮对话 |
| 60 秒无操作 | 浮层自动淡出（视为隐式确认） |

#### ⑤ 输入区

三种状态：

```
空闲态：
┌─────────────────────────────────────────┐
│  描述你想要的风格...           [ ➤ ]    │
└─────────────────────────────────────────┘

处理中：
┌─────────────────────────────────────────┐
│  正在处理中...                  [ ■ ]    │  ← 输入框禁用 + 停止按钮
└─────────────────────────────────────────┘

受限页面：
┌─────────────────────────────────────────┐
│  此页面不支持样式修改                     │  ← 整体置灰禁用
└─────────────────────────────────────────┘
```

### 16.4 会话下拉面板

点击顶栏会话标题区域展开：

```
┌─────────────────────────────────────┐
│  github.com 的会话                   │
│ ┌─────────────────────────────────┐ │
│ │ ● 深色模式调整          3月4日   │ │  ← 当前会话（高亮）
│ │   把背景改成深蓝色...            │ │
│ ├─────────────────────────────────┤ │
│ │   字体优化    3月3日       🗑️   │ │  ← hover 出现删除图标
│ ├─────────────────────────────────┤ │
│ │   护眼配色    3月1日       🗑️   │ │
│ └─────────────────────────────────┘ │
│                                     │
│         ＋ 新建会话                  │
└─────────────────────────────────────┘
```

**会话条目：** 标题 + 日期 + 首条消息预览。当前会话高亮，不可删除（🗑️ 置灰）。

**删除确认弹窗：**

```
┌─────────────────────────────┐
│ 删除「字体优化」？            │
│ 会话记录和该会话的样式将      │
│ 被永久删除。                 │
│                             │
│   [取消]      [确认删除]     │
└─────────────────────────────┘
```

若删除的是该域名最后一个会话，额外提示：

```
┌───────────────────────────────────┐
│ 这是 github.com 的最后一个会话。   │
│ 删除后将清除该域名的所有会话数据。   │
│                                   │
│      [取消]        [确认删除]      │
└───────────────────────────────────┘
```

### 16.5 状态指示器

#### 状态灯（顶栏左侧圆点）

| 状态 | 颜色 | 动画 |
|------|------|------|
| 就绪 | 🟢 绿色 | 无 |
| 处理中 | 🟡 黄色 | 呼吸脉动 |
| 错误 | 🔴 红色 | 无 |
| 受限页面 | ⚪ 灰色 | 无 |

#### 全局状态联动

| 状态 | 顶栏指示灯 | 对话区 | 输入区 | 技能区 |
|------|-----------|--------|--------|--------|
| 就绪 | 🟢 | 正常 | 可输入，➤ 发送按钮 | 正常 |
| 处理中 | 🟡 脉动 | 流式输出 + 工具卡片 | 禁用，■ 停止按钮 | 正常（不可点击） |
| 有样式生效 | 🟢 + 小徽标 | 正常 | 样式应用后浮层 | 正常 |
| API Key 缺失 | 🔴 | — | — | — |
| API Key 无效 | 🔴 | 顶部错误横幅 | 可输入 | 正常 |
| 网络错误 | 🔴 | 顶部错误横幅 + 重试按钮 | 可输入 | 正常 |
| 受限页面 | ⚪ | 居中提示"此页面不支持样式修改" | 整体置灰禁用 | 整体置灰禁用 |
| 存储将满 | 🟢 | 无影响 | 无影响 | 无影响（设置页内提醒） |

#### 错误横幅

位于顶栏下方、技能区上方，可关闭：

```
┌─────────────────────────────────────────┐
│ 🔴 github.com · 深色模式调整  ▾    ⚙️  │
├─────────────────────────────────────────┤
│ ⚠️ API Key 无效，请检查设置   [去设置→] │  ← 可关闭的错误横幅
├─────────────────────────────────────────┤
│ 🎨 [ 🌙 深色模式 ] [ ✨ 极简风 ] ...    │
├─────────────────────────────────────────┤
│              (对话区)                    │
```

### 16.6 设置页

```
┌─────────────────────────────────────────┐
│ ← 返回                        设置      │
├─────────────────────────────────────────┤
│                                         │
│  API Key                                │
│  ┌───────────────────────────────────┐  │
│  │ sk-ant-api03-••••••••••••••       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  API 地址                               │
│  ┌───────────────────────────────────┐  │
│  │ https://api.openai.com         │  │
│  └───────────────────────────────────┘  │
│  默认: https://api.openai.com        │
│  支持兼容 openai 格式的代理地址       │
│                                         │
│  [验证连接]        如何获取 API Key →    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  模型                                   │
│  ┌───────────────────────────────────┐  │
│  │ claude-sonnet-4-20250514     ▾    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  存储用量                               │
│  ████████░░░░░░░░  42% (4.2 / 10 MB)   │
│                                         │
│  [清理历史数据]                          │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  关于                                   │
│  StyleSwift v1.0.0                      │
│                                         │
└─────────────────────────────────────────┘
```

### 16.7 首次引导页

```
┌─────────────────────────────────────────┐
│                                         │
│            ✦ StyleSwift ✦               │
│                                         │
│     用一句话个性化任意网页的视觉样式       │
│                                         │
│                                         │
│  API Key                                │
│  ┌───────────────────────────────────┐  │
│  │  粘贴你的 API Key...              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  API 地址（可选）                        │
│  ┌───────────────────────────────────┐  │
│  │  https://api.openai.com        │  │
│  └───────────────────────────────────┘  │
│                                         │
│          [ 开始使用 StyleSwift ]         │
│                                         │
│     没有 Key？查看获取教程 →             │
│                                         │
└─────────────────────────────────────────┘
```

### 16.8 UI 交互流程串联

完整使用流程：

```
用户安装插件 → 点击图标 → Side Panel 打开
│
├─ 无 API Key → 首次引导页 → 输入 Key(+ 可选代理地址) → 验证 → 主界面
│
├─ 主界面加载:
│   ├─ 顶栏: 🟢 github.com · 新会话 ▾  ⚙️
│   ├─ 技能区: [🌙深色模式] [✨极简风] [+从当前创建]
│   ├─ 对话区: 空白，居中提示"试试点击上方风格，或直接输入"
│   └─ 输入框: "描述你想要的风格..."
│
├─ 用户点击 [🌙 深色模式] chip
│   → 输入框自动填入"应用深色模式风格" → 自动发送
│   → 状态灯变 🟡 → 输入框"正在处理..." → ■ 停止按钮
│   → 对话区流式输出:
│       用户: "应用深色模式风格"
│       ┌ ✅ 加载深色模式知识    ▸
│       ├ ✅ 查看页面结构        ▸
│       ├ ✅ 应用样式            ▸
│       └ 已为页面应用深色模式，背景 #1a1a2e...
│   → 状态灯变 🟢 → 浮层出现: [✓确认效果] [↶撤销]
│
├─ 用户: "标题太暗了"
│   → 浮层消失（隐式确认上一步）
│   → Agent 调整标题颜色 → Agent 本轮结束 → 新浮层出现
│
├─ 用户点击 [↶ 撤销]
│   → 标题颜色回滚，保留深色背景
│
├─ 用户: "保存这个风格"
│   → Agent 提取风格 DNA → 保存
│   → 技能区自动刷新，出现新 chip: [🎨 深色极客]
│
├─ 切换到 stackoverflow.com → 新会话
│   → 技能区: [🌙深色模式] [✨极简风] [🎨深色极客(github.com)]
│   → 点击 [🎨 深色极客] → 风格迁移
│
└─ 受限页面 (chrome://extensions)
    → 状态灯 ⚪ → 技能区+输入区置灰
    → 对话区居中: "此页面不支持样式修改"
```

### 16.9 UI 设计决策汇总

| 编号 | 决策项 | 结论 |
|------|--------|------|
| 1 | 会话切换模式 | 顶部域名+会话标题，点击下拉面板切换/新建/删除 |
| 2 | 工具调用可视化 | 可交互折叠卡片，显示工具名+状态，点击展开输入/输出详情 |
| 3 | 样式应用反馈 | Agent 整轮结束后，输入框上方浮现"确认/撤销"浮层 |
| 4 | 确认浮层时机 | 等 Agent 当轮全部完成后统一出一次，不是每次 apply 都弹 |
| 5 | 浮层消失规则 | 点击确认/撤销、用户发新消息（隐式确认）、60s 超时自动淡出 |
| 6 | 风格技能展示 | 聊天主界面顶部横向滚动 chip 列表，内置+用户技能并列 |
| 7 | 技能区折叠 | 对话变长时自动折叠为单行提示，可手动展开/折叠 |
| 8 | 状态指示器 | 顶栏状态灯（绿/黄/红/灰）+ 错误横幅 + 输入框状态联动 |
| 9 | 受限页面 | 技能区+输入区整体置灰禁用，对话区居中提示 |
| 10 | 会话删除 | 会话下拉面板中 hover 显示删除图标，二次确认弹窗 |
| 11 | 自定义 API 地址 | 设置页增加 API 地址字段，默认官方地址，支持代理 |
| 12 | 视图结构 | 4 个视图：首次引导页、聊天主界面、会话下拉面板（overlay）、设置页 |
