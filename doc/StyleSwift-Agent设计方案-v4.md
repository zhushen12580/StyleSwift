# StyleSwift Agent 设计方案

> 版本：v4.0
> 日期：2026-03-03
> 设计理念：基于 agent-builder 哲学 - The model IS the agent, code just provides capabilities
> 架构：纯 Chrome 插件，安装即用，无需部署后端

---

## 一、核心定位

```
Purpose: 让用户用一句话个性化任意网页的视觉样式
Domain: 网页样式设计 + 浏览器交互
Trust: 模型自己决定改什么、怎么改、改到什么程度
Delivery: 纯 Chrome 插件，安装即用
```

**核心场景：**
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格化表达：赛博朋克、复古、现代感

---

## 二、架构总览

### 2.1 插件内部架构

纯 Chrome 插件方案，无需后端服务。插件直接操作 live DOM、调用 Anthropic API，用户自带 API Key，安装即用。

```
Chrome Extension (Manifest V3)
│
├── Side Panel (sidepanel/)              # 用户界面 + Agent Loop 运行环境
│   ├── 会话列表                          # 按域名展示
│   ├── 聊天窗口                          # 流式展示文本，折叠工具调用
│   ├── 设置页                            # API Key、偏好配置
│   ├── Agent Loop                       # 主智能体循环（锁定触发 Tab，迭代上限保护）
│   ├── LLM Streaming API               # 直接调 Anthropic Streaming API
│   ├── CSS 合并引擎                      # mergeCSS 去重合并
│   └── Subagent 执行                    # 隔离上下文的子智能体
│
├── Service Worker (background.js)       # 扩展生命周期管理
│   └── 消息路由                          # Side Panel ↔ Content Script
│
├── Content Script × 2                   # 页面交互层
│   ├── early-inject.js (document_start) # 永久样式注入（防闪烁）
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
│   │   └── api.js                     # Anthropic Streaming API 调用封装
│   │
│   ├── background/
│   │   └── service-worker.js          # Side Panel 注册、扩展图标点击行为
│   │
│   ├── content/
│   │   ├── early-inject.js            # 永久样式注入（document_start，防闪烁）
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

```json
{
  "manifest_version": 3,
  "name": "StyleSwift",
  "version": "1.0.0",
  "description": "用一句话个性化任意网页的视觉样式",

  "permissions": [
    "activeTab",
    "storage",
    "sidePanel"
  ],

  "host_permissions": [
    "https://api.anthropic.com/*"
  ],

  "optional_host_permissions": [
    "https://*/*"
  ],

  "background": {
    "service_worker": "background/service-worker.js"
  },

  "side_panel": {
    "default_path": "sidepanel/index.html"
  },

  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/early-inject.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

**权限说明：**

| 权限 | 类型 | 为什么需要 |
|------|------|-----------|
| `activeTab` | permission | 获取当前活跃 Tab ID（用于 `chrome.tabs.query`），不获取 URL（域名通过 Content Script 获取） |
| `storage` | permission | 读写 chrome.storage.local，存储会话、样式、用户画像、设置 |
| `sidePanel` | permission | 注册和控制 Side Panel |
| `https://api.anthropic.com/*` | host_permission | 从 Side Panel 直接调用 Anthropic API（默认地址） |
| `https://*/*` | optional_host_permission | 用户自定义 API 代理地址时动态申请（`chrome.permissions.request`） |
| `content_scripts: <all_urls>` | manifest 声明 | 在所有页面注入 Content Script（DOM 操作 + 永久样式注入） |

> `content_scripts <all_urls>` 确保每个页面自动注入脚本；`activeTab` 用于定位目标 Tab 并通信。域名通过 Content Script 的 `location.hostname` 获取，无需 `tabs` 权限。Side Panel 是扩展内部页面，无需 `web_accessible_resources`。

**Service Worker：**

Service Worker 只负责注册 Side Panel 和处理图标点击：

```javascript
// background/service-worker.js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

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
│  ↓ 调 Anthropic API          │
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
│  ↓ 写入 chrome.storage        │
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

```javascript
let lockedTabId = null;

async function getTargetTabId() {
  if (lockedTabId) return lockedTabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.id;
}

function lockTab(tabId) {
  lockedTabId = tabId;
}

function unlockTab() {
  lockedTabId = null;
}

// 通过 Content Script 获取域名（无需 tabs 权限读 URL）
async function getTargetDomain() {
  const tabId = await getTargetTabId();
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { tool: 'get_domain' }, (response) => {
      resolve(response || 'unknown');
    });
  });
}
```

`sendToContentScript` 始终发送给锁定的 Tab：

```javascript
async function sendToContentScript(message) {
  const tabId = await getTargetTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Content Script 不可用: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(response);
      }
    });
  });
}
```

通信消息类型：

```javascript
// Side Panel → Content Script（工具调用）
// 直接通过 chrome.tabs.sendMessage，无需经过 Service Worker
{ tool: 'get_domain' }
{ tool: 'get_page_structure' | 'grep' | 'inject_css' | 'rollback_css', args?: {...} }

// Content Script → Side Panel（工具结果）
// 作为 sendMessage 的 response 回调直接返回
```

---

## 三、Tools（原子能力）

### 设计原则

```
每个 Tool 必须：
1. 原子性 - 做一件事，不做推理
2. 清晰描述 - 模型知道它能做什么
3. 简单输出 - 返回事实，不返回判断

工具执行位置：
- get_page_structure / grep → Content Script（需要访问 live DOM）
- apply_styles → Content Script（需要注入 CSS 到页面）
- get/update_user_profile → Side Panel（读写 chrome.storage）
- load_skill → Side Panel（读取打包的静态资源）
```

### SessionContext

SessionContext 基于 Chrome Storage key 映射：

```javascript
class SessionContext {
  constructor(domain, sessionId) {
    this.domain = domain;
    this.sessionId = sessionId;
  }

  get stylesKey()    { return `sessions:${this.domain}:${this.sessionId}:styles`; }
  get metaKey()      { return `sessions:${this.domain}:${this.sessionId}:meta`; }
  get historyKey()   { return `${this.domain}:${this.sessionId}`; }  // IndexedDB key
  get persistKey()   { return `persistent:${this.domain}`; }
  get sessionIndex() { return `sessions:${this.domain}:index`; }
}

let currentSession = null;
```

### 3.1 get_page_structure

直接在 Content Script 中操作 live DOM 构建简化树。

#### 3.1.1 Tool 定义（给 LLM 看的）

```javascript
const GET_PAGE_STRUCTURE_TOOL = {
  name: 'get_page_structure',
  description: '获取当前页面的结构概览。返回树形结构，包含标签、选择器、关键样式。',
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};
```

#### 3.1.2 Content Script 端实现

```javascript
// === 常量定义 ===

const TAG_WHITELIST = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img',
  'form', 'input', 'button', 'select', 'textarea', 'label',
  'section', 'article', 'nav', 'header', 'footer', 'aside', 'main',
  'blockquote', 'figure', 'figcaption', 'details', 'summary',
  'video', 'audio', 'dialog'
]);

const LANDMARKS = new Set(['header', 'nav', 'main', 'aside', 'footer', 'article', 'section']);

const STYLE_WHITELIST = [
  'display', 'position', 'float', 'clear',
  'flex-direction', 'justify-content', 'align-items', 'flex-wrap',
  'grid-template-columns', 'grid-template-rows', 'gap',
  'width', 'height', 'max-width', 'max-height',
  'padding', 'margin',
  'background-color', 'color', 'border-color', 'border-radius',
  'box-shadow', 'opacity', 'z-index',
  'font-size', 'font-family', 'font-weight', 'line-height',
  'letter-spacing', 'text-decoration',
  'overflow'
];

const SKIP_VALUES = new Set(['none', 'normal', '0px', 'auto', 'static', 'visible']);

const COLLAPSE_THRESHOLD = 3;

const TEXT_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','span','a','li','label']);

const VISUAL_PROPS = new Set([
  'background-color', 'color', 'border-radius', 'box-shadow',
  'opacity', 'position', 'display', 'width', 'height'
]);


// === 核心：直接从 live DOM 构建简化树 ===

function getPageStructure() {
  const meta = extractMeta();
  const tree = buildTree(document.body, 0, 3);
  return formatOutput(meta, tree);
}

function extractMeta() {
  return [
    `URL: ${location.href}`,
    `Title: ${document.title}`,
    `Viewport: ${window.innerWidth} × ${window.innerHeight}`
  ].join('\n');
}

function buildTree(element, depth, maxDepth) {
  const tag = element.tagName?.toLowerCase();
  if (!tag || !TAG_WHITELIST.has(tag)) return null;
  if (element.shadowRoot) return null;

  const selector = shortSelector(element);
  const text = getDirectText(element).slice(0, 40);
  const styles = getComputedStyles(element, tag);

  const childEls = Array.from(element.children).filter(c =>
    TAG_WHITELIST.has(c.tagName?.toLowerCase()) && !c.shadowRoot
  );

  if (depth >= maxDepth || childEls.length === 0) {
    const summary = summarizeChildren(childEls);
    return { selector, text, styles, summary };
  }

  const groups = groupSimilar(childEls);
  const children = [];

  for (const group of groups) {
    if (group.length >= COLLAPSE_THRESHOLD) {
      const rep = buildTree(group[0], depth + 1, maxDepth);
      if (rep) children.push({ ...rep, count: group.length });
    } else {
      for (const child of group) {
        const childTag = child.tagName.toLowerCase();
        const childMax = LANDMARKS.has(childTag) ? maxDepth + 1 : maxDepth;
        const node = buildTree(child, depth + 1, childMax);
        if (node) children.push(node);
      }
    }
  }

  return { selector, text, styles, children };
}


// === 实时读取计算样式 ===
// 直接输出完整 CSS 属性名，避免 LLM 歧义

function getComputedStyles(element, tag) {
  const cs = window.getComputedStyle(element);
  const pairs = [];

  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push([prop, val]);
    }
  }

  return pickStylesForDisplay(tag, pairs);
}

function pickStylesForDisplay(tag, pairs) {
  if (LANDMARKS.has(tag)) return pairs;

  if (TEXT_TAGS.has(tag)) {
    const textProps = new Set([
      'color', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-decoration'
    ]);
    return pairs.filter(([prop]) => textProps.has(prop));
  }

  return pairs.filter(([prop]) => VISUAL_PROPS.has(prop));
}


// === 分组折叠 ===

function groupSimilar(children) {
  if (children.length === 0) return [];
  const groups = [[children[0]]];
  for (let i = 1; i < children.length; i++) {
    if (sameSignature(children[i], groups[groups.length - 1][0])) {
      groups[groups.length - 1].push(children[i]);
    } else {
      groups.push([children[i]]);
    }
  }
  return groups;
}

function sameSignature(a, b) {
  return a.tagName === b.tagName && a.className === b.className;
}


// === 格式化输出 ===

function formatOutput(meta, tree) {
  let result = formatTree(tree, '', true, 3);

  if (estimateTokens(result) > 2000) {
    result = formatTree(tree, '', true, 2);
  }
  if (estimateTokens(result) > 2000) {
    result = formatTree(tree, '', true, 2, true);
  }

  return meta + '\n\n' + result;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 3.5);
}


// === 辅助函数 ===

function shortSelector(el) {
  // 生成最短唯一选择器：优先 tag#id，其次 tag.className
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  if (el.className) return `${tag}.${el.className.split(/\s+/)[0]}`;
  return tag;
}

function getDirectText(el) {
  // 仅获取元素自身的直接文本（不含子元素文本）
  return Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(' ');
}

function summarizeChildren(childEls) {
  // 简要统计子元素构成：tag × count
  if (childEls.length === 0) return null;
  const counts = {};
  for (const c of childEls) {
    const key = shortSelector(c);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([k, v]) => v > 1 ? `${k}×${v}` : k).join(', ');
}

function formatTree(node, indent, isLast, maxDepth, compact = false) {
  if (!node) return '';

  // 根节点：无前缀，直接输出选择器
  let line = node.selector;
  line += formatNodeDecoration(node, compact);
  let result = line + '\n';

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i], '', i === node.children.length - 1, maxDepth - 1, compact
      );
    }
  }

  return result;
}

function formatTreeNode(node, indent, isLast, maxDepth, compact) {
  if (!node || maxDepth < 0) return '';

  const prefix = isLast ? '└── ' : '├── ';
  const childIndent = indent + (isLast ? '    ' : '│   ');

  let line = indent + prefix + node.selector;
  line += formatNodeDecoration(node, compact);
  let result = line + '\n';

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i], childIndent, i === node.children.length - 1, maxDepth - 1, compact
      );
    }
  }

  return result;
}

function formatNodeDecoration(node, compact) {
  let deco = '';
  if (!compact && node.styles?.length) {
    deco += ` [${node.styles.map(([p, v]) => `${p}:${v}`).join('; ')}]`;
  }
  if (node.count) deco += ` × ${node.count}`;
  if (node.text)  deco += ` "${node.text}"`;
  if (node.summary) deco += ` — ${node.summary}`;
  return deco;
}

function buildFullPathSelector(el) {
  // 构建从 body 到当前元素的完整路径选择器
  const parts = [];
  let curr = el;
  while (curr && curr !== document.body.parentElement) {
    parts.unshift(shortSelector(curr));
    curr = curr.parentElement;
  }
  return parts.join(' > ');
}

function formatUsefulAttrs(el) {
  // 提取有用的 HTML 属性（href, src, type, placeholder, role 等）
  const useful = ['href', 'src', 'type', 'placeholder', 'role', 'aria-label'];
  return useful.map(a => el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : null).filter(Boolean).join(', ');
}

function formatChildren(el, scope) {
  // 格式化子元素列表（scope='children' 仅直接子元素，'subtree' 递归）
  const children = Array.from(el.children).filter(c => TAG_WHITELIST.has(c.tagName?.toLowerCase()));
  const depth = scope === 'subtree' ? 3 : 1;
  return children.slice(0, 10).map(c => {
    const sel = shortSelector(c);
    const styles = getAllComputedStyles(c);
    return `      ${sel}${styles ? ` [${styles}]` : ''}`;
  });
}
```

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

```javascript
const GREP_TOOL = {
  name: 'grep',
  description: `在当前页面中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）。

搜索方式（自动检测）：
- CSS 选择器：".sidebar", "nav > a.active", "#main h2"
- 关键词：在标签名、class、id、文本内容、样式值中匹配

典型用途：
- 看完 get_page_structure 概览后，深入查看某个区域的详情
- 查找具有特定样式值的元素
- 确认某个选择器是否存在、有多少匹配`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'CSS 选择器或关键词' },
      scope: {
        type: 'string',
        enum: ['self', 'children', 'subtree'],
        description: '返回详情范围：self=仅匹配元素本身，children=含直接子元素（默认），subtree=含完整子树（慎用）'
      },
      max_results: { type: 'integer', description: '最多返回几个匹配元素，默认 5，最大 20' }
    },
    required: ['query']
  }
};
```

#### 3.2.2 Content Script 端实现

```javascript
const SELECTOR_PATTERN = /[.#\[\]>+~:=]|^\w+\s+\w+/;

function runGrep(query, scope = 'children', maxResults = 5) {
  maxResults = Math.min(maxResults, 20);

  let elements;
  if (isCssSelector(query)) {
    elements = selectorSearch(query, maxResults);
  } else {
    elements = keywordSearch(query, maxResults);
  }

  if (elements.length === 0) return `未找到匹配: ${query}`;

  const groups = groupSimilarElements(elements);
  return formatGrepOutput(groups, scope, maxResults);
}

function isCssSelector(query) {
  return SELECTOR_PATTERN.test(query);
}

function selectorSearch(selector, limit) {
  try {
    // 浏览器原生 querySelectorAll
    const all = document.querySelectorAll(selector);
    return Array.from(all).slice(0, limit);
  } catch {
    return keywordSearch(selector, limit);
  }
}

function keywordSearch(keyword, limit) {
  const kw = keyword.toLowerCase();
  const results = [];

  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_ELEMENT
  );

  let el;
  while ((el = walker.nextNode()) && results.length < limit) {
    const tag = el.tagName.toLowerCase();
    if (!TAG_WHITELIST.has(tag)) continue;

    if (tag.includes(kw)) { results.push(el); continue; }

    const classes = el.className?.toLowerCase?.() || '';
    if (classes.includes(kw)) { results.push(el); continue; }

    const id = el.id?.toLowerCase() || '';
    if (id.includes(kw)) { results.push(el); continue; }

    const directText = getDirectText(el).toLowerCase();
    if (directText.includes(kw)) { results.push(el); continue; }

    // 实时读取计算样式进行匹配
    const cs = window.getComputedStyle(el);
    const bgColor = cs.backgroundColor;
    const color = cs.color;
    if (bgColor.includes(kw) || color.includes(kw)) { results.push(el); continue; }
  }

  return results;
}
```

#### 3.2.3 相似元素折叠

相似元素折叠实现：

```javascript
function groupSimilarElements(elements) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < elements.length; i++) {
    if (used.has(i)) continue;

    const sig = elementSignature(elements[i]);
    const texts = [getDirectText(elements[i]).slice(0, 30)];
    let count = 1;

    for (let j = i + 1; j < elements.length; j++) {
      if (used.has(j)) continue;
      if (elementSignature(elements[j]) === sig) {
        used.add(j);
        count++;
        if (texts.length < 3) texts.push(getDirectText(elements[j]).slice(0, 30));
      }
    }

    groups.push({ el: elements[i], count, texts });
  }

  return groups;
}

function elementSignature(el) {
  const childSig = Array.from(el.children)
    .map(c => `${c.tagName.toLowerCase()}.${c.className}`)
    .join('|');
  return `${el.tagName.toLowerCase()}.${el.className}[${childSig}]`;
}
```

#### 3.2.4 输出格式化

```javascript
function formatGrepOutput(groups, scope, maxResults) {
  const lines = [];
  let shown = 0;

  for (const { el, count, texts } of groups) {
    if (shown >= maxResults) break;

    if (count > 1) {
      lines.push(`[${shown + 1}] ${shortSelector(el)} × ${count}`);
      lines.push(`    Texts: ${texts.join(' | ')}`);
    } else {
      lines.push(`[${shown + 1}] ${shortSelector(el)}`);
    }

    lines.push(`    Path: ${buildFullPathSelector(el)}`);

    // 完整计算样式（grep 返回全量，不做详略控制）
    const allStyles = getAllComputedStyles(el);
    if (allStyles) lines.push(`    Styles: ${allStyles}`);

    const attrs = formatUsefulAttrs(el);
    if (attrs) lines.push(`    Attrs: ${attrs}`);

    const text = getDirectText(el).slice(0, 60);
    if (text) lines.push(`    Text: "${text}"`);

    if (scope === 'children' || scope === 'subtree') {
      const childLines = formatChildren(el, scope);
      if (childLines.length) {
        lines.push('    Children:');
        lines.push(...childLines);
      }
    }

    lines.push('');
    shown += count;
  }

  const result = lines.join('\n');
  if (estimateTokens(result) > 800 && scope === 'subtree')
    return formatGrepOutput(groups, 'children', maxResults);
  if (estimateTokens(result) > 800 && scope === 'children')
    return formatGrepOutput(groups, 'self', maxResults);

  return result;
}

function getAllComputedStyles(el) {
  const cs = window.getComputedStyle(el);
  const pairs = [];
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push(`${prop}:${val}`);
    }
  }
  return pairs.join('; ') || '';
}
```

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

CSS 注入/回滚在 Content Script 中执行，持久化操作在 Side Panel 中通过 chrome.storage 完成。

#### 3.3.1 Tool 定义

```javascript
const APPLY_STYLES_TOOL = {
  name: 'apply_styles',
  description: `应用或回滚CSS样式。

mode 说明：
- save: 注入CSS到页面并永久保存（下次访问该域名自动应用）
- rollback_last: 撤销最后一次样式修改（保留之前的修改）
- rollback_all: 回滚所有已应用的样式

使用流程：
1. 生成CSS后直接 save 应用并保存
2. 用户对最近一次修改不满意 → rollback_last 撤销最后一步
3. 用户想全部重来 → rollback_all 清除所有样式`,
  input_schema: {
    type: 'object',
    properties: {
      css: { type: 'string', description: 'CSS代码（save 模式必填，rollback 模式不需要）' },
      mode: {
        type: 'string',
        enum: ['save', 'rollback_last', 'rollback_all'],
        description: 'save=应用并保存, rollback_last=撤销最后一次, rollback_all=全部回滚'
      }
    },
    required: ['mode']
  }
};
```

#### 3.3.2 实现（跨两个执行环境）

**Content Script 端：CSS 注入/回滚（支持变更栈）**

```javascript
let activeStyleEl = null;
const cssStack = [];

function injectCSS(css) {
  if (!activeStyleEl) {
    activeStyleEl = document.createElement('style');
    activeStyleEl.id = 'styleswift-active';
    document.head.appendChild(activeStyleEl);
  }
  cssStack.push(css);
  activeStyleEl.textContent = cssStack.join('\n');
}

function rollbackCSS(scope = 'last') {
  if (scope === 'all') {
    cssStack.length = 0;
  } else {
    cssStack.pop();
  }
  if (activeStyleEl) {
    activeStyleEl.textContent = cssStack.join('\n');
  }
}
```

**Side Panel 端：工具执行 + 持久化**

```javascript
async function runApplyStyles(css, mode) {
  if (mode === 'rollback_all') {
    await sendToContentScript({ tool: 'rollback_css', args: { scope: 'all' } });
    const sKey = currentSession.stylesKey;
    const pKey = currentSession.persistKey;
    await chrome.storage.local.remove([sKey, pKey]);
    await updateStylesSummary();
    return '已回滚所有样式';
  }

  if (mode === 'rollback_last') {
    await sendToContentScript({ tool: 'rollback_css', args: { scope: 'last' } });
    // 重新同步存储：从 Content Script 获取当前剩余 CSS
    const remainingCSS = await sendToContentScript({ tool: 'get_active_css' });
    const sKey = currentSession.stylesKey;
    const pKey = currentSession.persistKey;
    if (remainingCSS) {
      await chrome.storage.local.set({ [sKey]: remainingCSS, [pKey]: remainingCSS });
    } else {
      await chrome.storage.local.remove([sKey, pKey]);
    }
    await updateStylesSummary();
    return '已撤销最后一次样式修改';
  }

  // save：注入到页面 + 写入会话 + 写入永久存储
  await sendToContentScript({ tool: 'inject_css', args: { css } });

  const sKey = currentSession.stylesKey;
  const { [sKey]: existing = '' } = await chrome.storage.local.get(sKey);
  const merged = mergeCSS(existing, css);
  await chrome.storage.local.set({ [sKey]: merged });

  const pKey = currentSession.persistKey;
  const { [pKey]: existingP = '' } = await chrome.storage.local.get(pKey);
  const mergedP = mergeCSS(existingP, css);
  await chrome.storage.local.set({ [pKey]: mergedP });

  await updateStylesSummary();
  return `已保存，下次访问 ${currentSession.domain} 自动应用`;
}
```

#### 3.3.3 CSS 特异性策略

生成的 CSS 需要可靠地覆盖页面已有样式。通过 System Prompt 引导 LLM 和注入层级双重保障：

```
System Prompt 中的 CSS 生成指引（附加在 SYSTEM_BASE 中）：

生成 CSS 时遵循以下规则：
1. 使用具体选择器（如 .site-header, main#content），不用 * 或标签通配
2. 所有声明加 !important，确保覆盖页面原有样式
3. 避免使用 @import 或修改 <link> 标签
4. 颜色使用 hex 或 rgba，不使用 CSS 变量（页面变量可能被覆盖）
```

注入层级保障：

```
页面原始样式              ← 特异性由页面决定
  ↓
styleswift-persistent    ← 永久样式（early-inject.js 注入，document_start）
  ↓
styleswift-active        ← 当前会话样式（content.js 注入，document_idle）
  ↓
!important               ← 所有 StyleSwift 生成的规则都带 !important

注入位置：<head> 末尾，晚于页面 <link> 和 <style>，天然高优先级
```

#### 3.3.4 CSS 去重/合并策略

多轮对话会不断追加 CSS，需要去重合并避免膨胀和冲突：

```javascript
function mergeCSS(existingCSS, newCSS) {
  const existingRules = parseRules(existingCSS);
  const newRules = parseRules(newCSS);

  for (const [selector, props] of newRules) {
    if (props.has('__raw__')) {
      // at-rule 整体覆盖（@media, @keyframes 等）
      existingRules.set(selector, props);
    } else if (!existingRules.has(selector)) {
      existingRules.set(selector, props);
    } else {
      const existing = existingRules.get(selector);
      if (existing.has('__raw__')) {
        existingRules.set(selector, props);
      } else {
        for (const [prop, val] of props) {
          existing.set(prop, val);
        }
      }
    }
  }

  return serializeRules(existingRules);
}

// 顶层块分割：正确处理嵌套花括号（@media, @keyframes 等）
function splitTopLevelBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        const block = css.slice(start, i + 1).trim();
        if (block) blocks.push(block);
        start = i + 1;
      }
    }
  }
  return blocks;
}

function parseRules(css) {
  const rules = new Map();
  if (!css?.trim()) return rules;

  const blocks = splitTopLevelBlocks(css);

  for (const block of blocks) {
    if (block.startsWith('@')) {
      // at-rule（@media, @keyframes 等）：整体作为一个单元，按 header 去重
      const headerEnd = block.indexOf('{');
      if (headerEnd === -1) continue;
      const header = block.slice(0, headerEnd).trim();
      rules.set(header, new Map([['__raw__', block]]));
    } else {
      // 普通规则：按选择器+属性去重
      const braceIdx = block.indexOf('{');
      if (braceIdx === -1) continue;
      const selector = block.slice(0, braceIdx).trim();
      const body = block.slice(braceIdx + 1, block.lastIndexOf('}'));
      const props = new Map();
      for (const decl of body.split(';')) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) continue;
        const prop = decl.slice(0, colonIdx).trim();
        const val = decl.slice(colonIdx + 1).trim();
        if (prop && val) props.set(prop, val);
      }
      rules.set(selector, props);
    }
  }

  return rules;
}

function serializeRules(rules) {
  const lines = [];
  for (const [selector, props] of rules) {
    if (props.has('__raw__')) {
      lines.push(props.get('__raw__'));
    } else {
      const decls = Array.from(props).map(([p, v]) => `  ${p}: ${v};`).join('\n');
      lines.push(`${selector} {\n${decls}\n}`);
    }
  }
  return lines.join('\n\n');
}
```

合并时机：

```
每次 apply_styles(save) → mergeCSS(已有CSS, 新CSS) → 写入存储
效果：同一选择器的同一属性始终只保留最新值，CSS 不会无限增长
```

#### 3.3.5 CSP 兼容性

部分网站设置了严格的 Content Security Policy（CSP），其 `style-src` 指令可能阻止动态注入 `<style>` 标签。需要检测并降级处理。

**检测与降级策略：**

```javascript
let cssInjectionMethod = null;

function detectCSSInjectionMethod() {
  if (cssInjectionMethod) return cssInjectionMethod;

  // 方案 1：<style> 标签注入（默认，兼容性最广）
  try {
    const testStyle = document.createElement('style');
    testStyle.textContent = '#styleswift-csp-test { display: none }';
    document.head.appendChild(testStyle);
    const applied = testStyle.sheet?.cssRules?.length > 0;
    document.head.removeChild(testStyle);
    if (applied) {
      cssInjectionMethod = 'style-element';
      return cssInjectionMethod;
    }
  } catch {}

  // 方案 2：Constructable Stylesheets API（Chrome 73+，绕过部分 CSP）
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('#styleswift-csp-test { display: none }');
    cssInjectionMethod = 'adopted-stylesheets';
    return cssInjectionMethod;
  } catch {}

  // 方案 3：通知 Side Panel 使用 chrome.scripting.insertCSS（最终降级）
  cssInjectionMethod = 'scripting-api';
  return cssInjectionMethod;
}
```

**三级降级方案：**

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

**方案 2 的 Content Script 实现：**

```javascript
let adoptedSheet = null;

function injectCSSAdopted(css) {
  if (!adoptedSheet) {
    adoptedSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, adoptedSheet];
  }
  adoptedSheet.replaceSync(cssStack.join('\n'));
}

function rollbackCSSAdopted(scope) {
  if (scope === 'all') cssStack.length = 0;
  else cssStack.pop();
  if (adoptedSheet) adoptedSheet.replaceSync(cssStack.join('\n'));
}
```

**Content Script 中统一分派：**

```javascript
function injectCSSAuto(css) {
  const method = detectCSSInjectionMethod();
  switch (method) {
    case 'style-element':     return injectCSS(css);
    case 'adopted-stylesheets': return injectCSSAdopted(css);
    case 'scripting-api':
      // 回传给 Side Panel，由扩展上下文调用 chrome.scripting.insertCSS
      return { fallback: 'scripting-api', css };
  }
}
```

> CSP 检测在 Content Script 首次收到工具调用时执行一次并缓存结果，不影响后续性能。

### 3.4 get_user_profile

```javascript
const GET_USER_PROFILE_TOOL = {
  name: 'get_user_profile',
  description: `获取用户的风格偏好画像。包含用户在历史对话中表现出的风格偏好。
新用户可能为空。建议在以下情况获取：
- 新会话开始时，了解用户已知偏好
- 用户请求模糊（如"好看点"），需参考历史偏好`,
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};

async function runGetUserProfile() {
  const { userProfile } = await chrome.storage.local.get('userProfile');
  if (!userProfile?.trim()) return '(新用户，暂无风格偏好记录)';
  return userProfile;
}
```

### 3.5 update_user_profile

```javascript
const UPDATE_USER_PROFILE_TOOL = {
  name: 'update_user_profile',
  description: `记录从当前对话中学到的用户风格偏好。
当发现新的偏好信号时调用：
- 用户明确表达："我喜欢圆角"
- 用户通过修正暗示："太黑了，用深蓝" → 偏好深蓝不是纯黑
- 反复的选择模式

记录有意义的偏好洞察，不记录具体 CSS 代码。
content 为完整的画像内容（覆盖写入），应在读取现有画像基础上整合新洞察。`,
  input_schema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '完整的用户画像内容（覆盖写入）' }
    },
    required: ['content']
  }
};

async function runUpdateUserProfile(content) {
  await chrome.storage.local.set({ userProfile: content });
  return '已更新用户画像';
}
```

### 3.6 load_skill

内置领域知识打包为扩展静态资源，用户动态创建的风格技能存储在 `chrome.storage.local` 中。两类技能通过同一个工具加载。

```javascript
const LOAD_SKILL_TOOL = {
  name: 'load_skill',
  description: `加载领域知识或用户保存的风格技能。

内置知识：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

用户风格技能（通过 save_style_skill 创建）：
- 通过 list_style_skills 查看可用的用户技能
- 使用 skill:{id} 格式加载，如 skill:a1b2c3d4

加载用户风格技能后，根据其中的色彩方案、排版、视觉效果等描述，
结合当前页面的 DOM 结构，生成适配的 CSS。不要直接复制参考 CSS 中的选择器。`,
  input_schema: {
    type: 'object',
    properties: {
      skill_name: { type: 'string', description: '内置知识名称，或 skill:{id} 加载用户风格技能' }
    },
    required: ['skill_name']
  }
};

const SKILL_PATHS = {
  'dark-mode-template': 'skills/style-templates/dark-mode.md',
  'minimal-template':   'skills/style-templates/minimal.md',
  'design-principles':  'skills/design-principles.md',
  'color-theory':       'skills/color-theory.md',
  'css-selectors':      'skills/css-selectors-guide.md',
};

async function runLoadSkill(skillName) {
  // 用户动态风格技能
  if (skillName.startsWith('skill:')) {
    const id = skillName.slice(6);
    const content = await StyleSkillStore.load(id);
    if (!content) return `未找到风格技能: ${id}。使用 list_style_skills 查看可用技能。`;
    return content;
  }

  // 内置静态知识
  const path = SKILL_PATHS[skillName];
  if (!path) {
    const userSkills = await StyleSkillStore.list();
    const hint = userSkills.length > 0
      ? `\n用户风格技能: ${userSkills.map(s => `skill:${s.id} (${s.name})`).join(', ')}`
      : '';
    return `未知知识: ${skillName}。可用: ${Object.keys(SKILL_PATHS).join(', ')}${hint}`;
  }

  // Side Panel 中通过 chrome.runtime.getURL 访问扩展内静态资源
  const url = chrome.runtime.getURL(path);
  const resp = await fetch(url);
  return await resp.text();
}
```

Side Panel 作为扩展内部页面，可直接通过 `chrome.runtime.getURL` 访问打包资源，无需在 `manifest.json` 中声明 `web_accessible_resources`。`StyleSkillStore` 的实现见 7.7 节。

### 3.7 save_style_skill

从当前会话中提取视觉风格特征，保存为可复用的风格技能（Style Skill）。

#### 3.7.1 Tool 定义

```javascript
const SAVE_STYLE_SKILL_TOOL = {
  name: 'save_style_skill',
  description: `从当前会话中提取视觉风格特征，保存为可复用的风格技能。

调用时机：
- 用户对当前风格满意，希望在其他网站复用
- 用户明确说"保存这个风格" / "把这个风格做成模板"

你需要自己分析当前会话的 CSS 和对话意图，提炼出风格技能文档。`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '风格名称，如"赛博朋克"、"清新日式"' },
      mood: { type: 'string', description: '一句话风格描述' },
      skill_content: {
        type: 'string',
        description: `风格技能文档（markdown 格式），必须包含：
1. 风格描述（自然语言，说明整体视觉感受和设计理念）
2. 色彩方案（列出背景/文字/强调/边框等具体色值）
3. 排版（标题/正文/代码的字体、字重、行高偏好）
4. 视觉效果（圆角、阴影、过渡、特殊效果）
5. 设计意图（用户想要达到的效果，为什么做这些选择）
6. 参考 CSS（当前会话生成的 CSS 片段，标注选择器不可直接复用）

重点：提取抽象的风格特征，不是复制具体 CSS。选择器是页面特定的，色彩/排版/效果才是可迁移的。`
      }
    },
    required: ['name', 'skill_content']
  }
};
```

#### 3.7.2 实现

```javascript
async function runSaveStyleSkill(name, mood, skillContent) {
  const id = crypto.randomUUID().slice(0, 8);
  const sourceDomain = currentSession?.domain || 'unknown';

  const header = `# ${name}\n\n> 来源: ${sourceDomain} | 创建: ${new Date().toLocaleDateString()}\n> 风格: ${mood || ''}\n\n`;
  const fullContent = skillContent.startsWith('# ') ? skillContent : header + skillContent;

  await StyleSkillStore.save(id, name, mood || '', sourceDomain, fullContent);

  return `已保存风格技能「${name}」(id: ${id})，可在任意网站通过 load_skill('skill:${id}') 加载使用。`;
}
```

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

```javascript
const LIST_STYLE_SKILLS_TOOL = {
  name: 'list_style_skills',
  description: `列出用户保存的所有风格技能。
当用户提到"我之前保存的风格"、"用我的XX风格"时，先调用此工具查看可用技能。`,
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};

async function runListStyleSkills() {
  const skills = await StyleSkillStore.list();
  if (skills.length === 0) return '(暂无保存的风格技能)';

  return skills.map(s =>
    `- skill:${s.id}「${s.name}」${s.mood ? `— ${s.mood}` : ''} (来自 ${s.sourceDomain}, ${new Date(s.createdAt).toLocaleDateString()})`
  ).join('\n');
}
```

### 3.9 delete_style_skill

```javascript
const DELETE_STYLE_SKILL_TOOL = {
  name: 'delete_style_skill',
  description: '删除一个用户保存的风格技能。',
  input_schema: {
    type: 'object',
    properties: {
      skill_id: { type: 'string', description: '要删除的技能 ID' }
    },
    required: ['skill_id']
  }
};

async function runDeleteStyleSkill(skillId) {
  const skills = await StyleSkillStore.list();
  const target = skills.find(s => s.id === skillId);
  if (!target) return `未找到技能: ${skillId}`;

  await StyleSkillStore.remove(skillId);
  return `已删除风格技能「${target.name}」`;
}
```

---

## 四、Task（子智能体）

### 设计原则

```
Subagent 设计原则：
1. 隔离上下文 - 子智能体看不到父对话历史
2. 只给任务描述 - 不预设内部工作流
3. 返回摘要 - 父智能体只看到最终结果

执行环境：
- Subagent 在 Side Panel 中运行（与主 Agent Loop 同一 JS 上下文）
- 共享同一个 API Key 和模型配置
- 可以调用 Content Script 的 DOM 工具
```

### 4.1 Agent Types 注册表

```javascript
const AGENT_TYPES = {
  StyleGenerator: {
    description: '样式生成专家。根据用户意图和页面结构生成CSS代码。',
    tools: ['get_page_structure', 'grep', 'load_skill'],
    prompt: `你是样式生成专家。

任务：根据用户意图生成CSS代码

输入：
- 用户意图描述
- 页面结构信息（可能需要你主动获取）

输出格式（JSON）：
{
    "css": "生成的CSS代码",
    "affected_selectors": ["受影响的选择器"],
    "description": "样式描述"
}

你有完全的自由决定如何完成这个任务。
- 可以加载知识获得专业指导
- 可以多次获取页面信息
- 只返回最终结果，不要返回中间过程`,
  },
};
```

### 4.2 Task Tool 定义

```javascript
const TASK_TOOL = {
  name: 'Task',
  description: `调用子智能体处理复杂任务。
子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- StyleGenerator: 样式生成专家

使用场景：
- 需要复杂推理的任务
- 需要多次工具调用的任务
- 可能产生大量中间输出的任务`,
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: '任务简短描述（3-5字）' },
      prompt: { type: 'string', description: '详细的任务指令' },
      agent_type: { type: 'string', enum: ['StyleGenerator'], description: '子智能体类型' }
    },
    required: ['description', 'prompt', 'agent_type']
  }
};
```

### 4.3 Subagent 执行

```javascript
const SUB_MAX_ITERATIONS = 10;

async function runTask(description, prompt, agentType) {
  const config = AGENT_TYPES[agentType];

  const subSystem = `${config.prompt}\n\n完成任务后返回清晰、简洁的摘要。`;
  const subTools = config.tools === '*'
    ? BASE_TOOLS
    : BASE_TOOLS.filter(t => config.tools.includes(t.name));

  const subMessages = [{ role: 'user', content: prompt }];
  let iterations = 0;

  while (iterations++ < SUB_MAX_ITERATIONS) {
    const response = await callAnthropicAPI(subSystem, subMessages, subTools);

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || '(子智能体无输出)';
    }

    const results = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const output = await executeTool(block.name, block.input);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
      }
    }

    subMessages.push({ role: 'assistant', content: response.content });
    subMessages.push({ role: 'user', content: results });
  }

  return '(子智能体达到最大迭代次数，返回已有结果)';
}
```

---

## 五、TodoWrite

模型自己决定是否使用，简单任务不需要。

```javascript
const TODO_WRITE_TOOL = {
  name: 'TodoWrite',
  description: '更新任务列表。用于规划和追踪复杂任务的进度。简单任务不需要使用。',
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '任务描述' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            activeForm: { type: 'string', description: '进行时形式' }
          },
          required: ['content', 'status', 'activeForm']
        }
      }
    },
    required: ['todos']
  }
};
```

---

## 六、Context（上下文管理）

### 6.1 四层上下文模型

四层上下文结构：

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

```javascript
function buildSessionContext(domain, sessionMeta, profileHint) {
  let ctx = `\n[会话上下文]\n域名: ${domain}\n会话: ${sessionMeta.title || '新会话'}\n`;

  if (sessionMeta.activeStylesSummary) {
    ctx += `已应用样式: ${sessionMeta.activeStylesSummary}\n`;
  }

  if (profileHint) {
    ctx += `用户风格偏好: ${profileHint} (详情可通过 get_user_profile 获取)\n`;
  }

  return ctx;
}

async function getProfileOneLiner() {
  const { userProfile } = await chrome.storage.local.get('userProfile');
  if (!userProfile) return '';
  return userProfile.trim().split('\n')[0].slice(0, 100);
}
```

### 6.3 Layer 2 — 对话历史与 Token 预算控制

利用 API 返回的 `response.usage.input_tokens` 做精确检测，历史存储在 IndexedDB 中：

```javascript
const TOKEN_BUDGET = 50000;

function checkAndCompressHistory(history, lastInputTokens) {
  if (lastInputTokens <= TOKEN_BUDGET) return history;

  const split = findTurnBoundary(history, 10);
  const oldPart = history.slice(0, split);
  const recentPart = history.slice(split);

  // 异步压缩，返回 Promise
  return summarizeOldTurns(oldPart).then(summary =>
    [{ role: 'user', content: `[之前的对话摘要]\n${summary}` }, ...recentPart]
  );
}

// 找到最近 N 轮对话的起始边界（user 消息的索引）
function findTurnBoundary(history, keepRecentTurns) {
  let turnCount = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user' && typeof history[i].content === 'string') {
      turnCount++;
      if (turnCount >= keepRecentTurns) return i;
    }
  }
  return 0;
}

// 使用 LLM 对早期对话生成摘要（独立 API 调用）
async function summarizeOldTurns(oldHistory) {
  const condensed = oldHistory.map(msg => {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') return `用户: ${msg.content}`;
      // tool_result 消息，简化展示
      return '用户: [工具调用结果]';
    }
    if (msg.role === 'assistant') {
      const texts = (msg.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text.slice(0, 200));
      const tools = (msg.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => b.name);
      let summary = '';
      if (texts.length) summary += `助手: ${texts.join(' ')}`;
      if (tools.length) summary += ` [调用了: ${tools.join(', ')}]`;
      return summary;
    }
    return '';
  }).filter(Boolean).join('\n');

  const { apiKey, model, apiBase } = await getSettings();

  const resp = await fetch(`${apiBase}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      system: '用一段简洁的文字总结以下对话历史，重点保留：用户的风格偏好、已应用的样式变更、未完成的请求。不超过 300 字。',
      messages: [{ role: 'user', content: condensed }],
      max_tokens: 500,
    })
  });

  const data = await resp.json();
  const text = data.content?.[0]?.text;
  return text || '(历史摘要生成失败)';
}
```

### 6.4 Context 保护原则

```
1. Tools 返回精简结果（各工具有独立 token 预算）
2. Subagent 中间推理不进入主 context
3. 用户画像：context 只注入一行提示，完整内容通过 get_user_profile 按需获取
4. Skills 通过 load_skill 按需加载，不前置塞入
5. 对话历史基于真实 token 用量做预算控制，超预算自动压缩
6. 会话切换时 context 完全替换
```

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
│  "persistent:{domain}"                  string (CSS)    │
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
| 永久样式 | <50KB/域名 | 每次页面加载 | chrome.storage.local | content script 启动时自动读取注入 |
| 风格技能索引 | <2KB | 低 | chrome.storage.local | 列出可用技能时快速读取 |
| 风格技能内容 | <5KB/个 | 低 | chrome.storage.local | 按需加载，单个技能文档不大 |
| **对话历史** | **几十KB~几百KB** | 低 | **IndexedDB** | 可能很大，只在加载/保存时访问 |

### 7.3 IndexedDB 封装

```javascript
const DB_NAME = 'StyleSwiftDB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHistory(domain, sessionId, history) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(history, `${domain}:${sessionId}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(`${domain}:${sessionId}`);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}
```

### 7.4 永久样式自动注入

通过 `document_start` 阶段的 Content Script 注入，**在页面渲染之前**应用样式，避免闪烁（FOUC）。

```javascript
// early-inject.js —— 在 document_start 阶段执行，DOM 构建前即注入
(async () => {
  const domain = location.hostname;
  const key = `persistent:${domain}`;
  const result = await chrome.storage.local.get(key);
  if (!result[key]) return;

  const style = document.createElement('style');
  style.id = 'styleswift-persistent';
  style.textContent = result[key];

  // document_start 时 <head> 可能还不存在
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.documentElement.appendChild(style);
  }
})();
```

**两个 Content Script 的分工：**

| 脚本 | 注入时机 | 职责 |
|------|---------|------|
| `early-inject.js` | `document_start` | 仅注入永久样式（DOM 构建前执行，防闪烁） |
| `content.js` | `document_idle` | DOM 工具 + 消息监听 + CSS 注入/回滚 |

### 7.5 存储清理策略

chrome.storage.local 有 ~10MB 配额限制。长期使用后会话数据逐渐累积，需要自动清理。

```javascript
const MAX_SESSIONS_PER_DOMAIN = 20;
const SESSION_EXPIRE_DAYS = 90;

async function cleanupStorage() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const keysToRemove = [];

  // 收集所有域名的会话索引
  const domainIndices = Object.entries(all)
    .filter(([k]) => k.match(/^sessions:.+:index$/));

  for (const [indexKey, sessions] of domainIndices) {
    if (!Array.isArray(sessions)) continue;
    const domain = indexKey.split(':')[1];

    // 按创建时间排序，保留最新的 MAX_SESSIONS_PER_DOMAIN 个
    const sorted = sessions
      .map(s => ({ ...s, age: now - (s.created_at || 0) }))
      .sort((a, b) => a.age - b.age);

    const toKeep = [];
    const toDelete = [];

    for (const session of sorted) {
      const expired = session.age > SESSION_EXPIRE_DAYS * 86400000;
      if (expired || toKeep.length >= MAX_SESSIONS_PER_DOMAIN) {
        toDelete.push(session);
      } else {
        toKeep.push(session);
      }
    }

    for (const session of toDelete) {
      keysToRemove.push(`sessions:${domain}:${session.id}:meta`);
      keysToRemove.push(`sessions:${domain}:${session.id}:styles`);
      // IndexedDB 中的对话历史也需要清理
      await deleteHistory(domain, session.id);
    }

    if (toDelete.length > 0) {
      await chrome.storage.local.set({ [indexKey]: toKeep });
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  // 清理风格技能：上限 50 个，超出按创建时间淘汰最旧的
  await cleanupStyleSkills();
}

const MAX_STYLE_SKILLS = 50;

async function cleanupStyleSkills() {
  const skills = await StyleSkillStore.list();
  if (skills.length <= MAX_STYLE_SKILLS) return;

  const sorted = [...skills].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const toRemove = sorted.slice(MAX_STYLE_SKILLS);

  for (const skill of toRemove) {
    await StyleSkillStore.remove(skill.id);
  }
}

async function deleteHistory(domain, sessionId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(`${domain}:${sessionId}`);
}

// 存储用量监控
async function getStorageUsage() {
  const bytes = await chrome.storage.local.getBytesInUse(null);
  const maxBytes = chrome.storage.local.QUOTA_BYTES || 10485760;
  return { bytes, maxBytes, percent: Math.round(bytes / maxBytes * 100) };
}
```

**清理触发时机：**

```
1. Side Panel 打开时（后台静默执行，不阻塞 UI）
2. 存储用量超过 80% 时主动告警，提示用户清理
3. 用户手动触发（设置页中提供"清理历史数据"按钮）
```

### 7.6 存储 Schema 版本迁移

为后续版本的存储结构变更预留迁移机制：

```javascript
const CURRENT_SCHEMA_VERSION = 1;

async function checkAndMigrateStorage() {
  const { _schemaVersion = 0 } = await chrome.storage.local.get('_schemaVersion');

  if (_schemaVersion >= CURRENT_SCHEMA_VERSION) return;

  // 按版本号顺序执行迁移
  const migrations = {
    // 版本 0 → 1：初始版本，无需迁移
    // 版本 1 → 2：（示例）重命名 key 前缀
    // 2: async () => { ... }
  };

  for (let v = _schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (migrations[v]) {
      console.log(`Migrating storage schema: v${v - 1} → v${v}`);
      await migrations[v]();
    }
  }

  await chrome.storage.local.set({ _schemaVersion: CURRENT_SCHEMA_VERSION });
}

// Side Panel 启动时执行
checkAndMigrateStorage();
```

> 迁移函数在 Side Panel 加载时同步检查。每次版本升级只需往 `migrations` 对象中添加对应版本号的迁移逻辑。

### 7.7 StyleSkillStore（风格技能存储）

用户动态创建的风格技能（Style Skill）的 CRUD 封装。

```javascript
class StyleSkillStore {
  static INDEX_KEY = 'skills:user:index';

  static skillKey(id) { return `skills:user:${id}`; }

  static async list() {
    const { [this.INDEX_KEY]: index = [] } = await chrome.storage.local.get(this.INDEX_KEY);
    return index;
  }

  static async save(id, name, mood, sourceDomain, content) {
    const index = await this.list();
    const existing = index.findIndex(s => s.id === id);
    const entry = { id, name, mood, sourceDomain, createdAt: Date.now() };

    if (existing >= 0) index[existing] = entry;
    else index.push(entry);

    await chrome.storage.local.set({
      [this.INDEX_KEY]: index,
      [this.skillKey(id)]: content,
    });
  }

  static async load(id) {
    const { [this.skillKey(id)]: content } = await chrome.storage.local.get(this.skillKey(id));
    return content || null;
  }

  static async remove(id) {
    const index = await this.list();
    const filtered = index.filter(s => s.id !== id);
    await chrome.storage.local.set({ [this.INDEX_KEY]: filtered });
    await chrome.storage.local.remove(this.skillKey(id));
  }
}
```

**索引条目结构：**

```javascript
// skills:user:index 中每个元素
{
  id: 'a1b2c3d4',            // crypto.randomUUID().slice(0, 8)
  name: '赛博朋克',           // 用户命名或 LLM 自动命名
  mood: '深色背景+霓虹色调',   // 一句话描述
  sourceDomain: 'github.com', // 创建时所在的网站
  createdAt: 1709510400000    // 创建时间戳
}
```

---

## 八、Session（会话管理）

### 8.1 三级隔离模型

三级隔离结构：

```
全局层: chrome.storage.local["userProfile"]
  │
  └── 域名层: chrome.storage.local["sessions:{domain}:*"]
        │
        └── 会话层: chrome.storage.local["sessions:{domain}:{id}:*"]
              │     + IndexedDB["conversations"]["{domain}:{id}"]
              │
              └── 永久层: chrome.storage.local["persistent:{domain}"]
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
│   ├── 读取 ["sessions:example.com:{id}:styles"] → 注入页面恢复样式
│   ├── 从 IndexedDB 加载 history → 恢复对话
│   └── 创建 SessionContext(domain, id) → Agent 就绪
│
├── [新建会话]
│   ├── 生成 session_id (crypto.randomUUID())
│   ├── 更新 index
│   └── 创建 SessionContext → Agent 就绪
│
├── [切换会话]
│   ├── 卸载当前会话样式（移除 <style> 元素）
│   ├── 加载目标会话样式
│   └── 替换 SessionContext
│
└── [删除会话]
    ├── 二次确认弹窗
    ├── 移除 chrome.storage.local 中该会话的 meta、styles
    ├── 从 sessions:{domain}:index 中移除条目
    ├── 删除 IndexedDB 中的对话历史
    ├── 若删除的是当前会话 → 自动切换到最近的会话或新建
    └── 若删除的是该域名最后一个会话 → 提示是否同时清除永久样式
```

### 8.3 会话删除

```javascript
async function deleteSession(domain, sessionId) {
  // 1. 从索引中移除
  const indexKey = `sessions:${domain}:index`;
  const { [indexKey]: index = [] } = await chrome.storage.local.get(indexKey);
  const filtered = index.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ [indexKey]: filtered });

  // 2. 删除会话数据
  const metaKey = `sessions:${domain}:${sessionId}:meta`;
  const stylesKey = `sessions:${domain}:${sessionId}:styles`;
  await chrome.storage.local.remove([metaKey, stylesKey]);

  // 3. 删除 IndexedDB 中的对话历史
  await deleteHistory(domain, sessionId);

  // 4. 如果是该域名最后一个会话，询问是否清除永久样式
  if (filtered.length === 0) {
    return { lastSession: true, domain };
  }

  return { lastSession: false };
}
```

> 注意：`persistent:{domain}` 永久样式是域名级别的，不随会话删除。仅当删除最后一个会话时通过 UI 询问用户是否一并清除。

### 8.4 会话标题自动生成

```javascript
function autoTitle(sessionMeta, firstUserMessage) {
  if (!sessionMeta.title) {
    sessionMeta.title = firstUserMessage.slice(0, 20);
  }
}
```

### 8.5 会话辅助函数

Agent Loop 中引用的会话操作函数：

```javascript
async function loadAndPrepareHistory(domain, sessionId) {
  const history = await loadHistory(domain, sessionId);
  return Array.isArray(history) ? history : [];
}

async function loadSessionMeta(domain, sessionId) {
  const key = `sessions:${domain}:${sessionId}:meta`;
  const result = await chrome.storage.local.get(key);
  return result[key] || { title: null, created_at: Date.now(), message_count: 0 };
}

async function saveSessionMeta(domain, sessionId, meta) {
  const key = `sessions:${domain}:${sessionId}:meta`;
  await chrome.storage.local.set({ [key]: meta });
}

async function updateStylesSummary() {
  // 读取当前会话样式，生成一行摘要用于 Session Context 注入
  const key = currentSession.stylesKey;
  const { [key]: css = '' } = await chrome.storage.local.get(key);
  if (!css.trim()) return;

  const ruleCount = (css.match(/\{/g) || []).length;
  const selectors = css.match(/([^{}]+)\{/g)?.map(s => s.replace('{', '').trim()).slice(0, 3);
  const summary = `${ruleCount} 条规则，涉及 ${selectors?.join(', ') || '未知'} 等`;

  const metaKey = currentSession.metaKey;
  const { [metaKey]: meta = {} } = await chrome.storage.local.get(metaKey);
  meta.activeStylesSummary = summary;
  await chrome.storage.local.set({ [metaKey]: meta });
}
```

---

## 九、API Key 与连接管理

### 9.1 存储

```javascript
const DEFAULT_API_BASE = 'https://api.anthropic.com';

// settings 页面写入
async function saveSettings({ apiKey, apiBase, model }) {
  const current = await getSettings().catch(() => ({}));
  await chrome.storage.local.set({
    settings: {
      apiKey: apiKey || current.apiKey,
      apiBase: apiBase || current.apiBase || DEFAULT_API_BASE,
      model: model || current.model || 'claude-sonnet-4-20250514',
    }
  });
}

// Agent Loop 读取
async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.apiKey) throw new Error('请先在设置中配置 API Key');
  return {
    apiKey: settings.apiKey,
    model: settings.model || 'claude-sonnet-4-20250514',
    apiBase: settings.apiBase || DEFAULT_API_BASE,
  };
}
```

### 9.2 自定义 API 地址

支持用户配置 Anthropic API 代理/中转地址，覆盖默认的 `https://api.anthropic.com`。

**典型场景：**

- 国内用户通过代理/中转站访问 Anthropic API
- 企业内部 API 网关
- 兼容 Anthropic 格式的第三方服务（OpenRouter 等）

**权限动态申请：**

manifest 中 `host_permissions` 只声明了默认的 `https://api.anthropic.com/*`。当用户填写自定义地址时，通过 `optional_host_permissions` + `chrome.permissions.request()` 动态申请：

```javascript
async function ensureApiPermission(apiBase) {
  if (apiBase === DEFAULT_API_BASE) return true;

  try {
    const url = new URL(apiBase);
    const pattern = `${url.origin}/*`;
    const granted = await chrome.permissions.contains({ origins: [pattern] });
    if (granted) return true;

    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}
```

**连接验证：**

```javascript
async function validateConnection(apiKey, apiBase) {
  const url = `${apiBase}/v1/messages`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 9.3 安全措施

```
1. API Key 存在 chrome.storage.local，不同步到云端（不用 chrome.storage.sync）
2. Content Script 无法访问 API Key（只有 Side Panel 可以）
3. 所有 API 调用从 Side Panel 发出，不经过页面上下文
4. 不在代码中硬编码任何 Key
5. 自定义 API 地址仅通过 optional_host_permissions 动态授权，不预置宽泛权限
```

### 9.4 首次使用引导

```
用户安装插件
  → 打开 Side Panel
  → 检测到无 API Key
  → 显示引导页：
    "StyleSwift 需要 Anthropic API Key 才能工作。"
    [输入 API Key]
    [API 地址（可选，默认 https://api.anthropic.com）]
    [获取 Key 的教程链接]
    [保存]
  → 验证连接有效性
  → 成功 → 进入主界面
```

---

## 十、Agent Loop（核心循环）

### 10.1 LLM API 调用（Streaming）

从 Side Panel 直接调用 Anthropic Streaming API，实现逐步输出：

```javascript
async function callAnthropicStream(system, messages, tools, callbacks, abortSignal) {
  const { apiKey, model, apiBase } = await getSettings();

  const resp = await fetch(`${apiBase}/v1/messages`, {
    signal: abortSignal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      system,
      messages,
      tools,
      max_tokens: 8000,
      stream: true,
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`API 错误: ${err.error?.message || resp.statusText}`);
  }

  // SSE 流式解析
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const result = { content: [], stop_reason: null, usage: null };
  let currentBlock = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]' || !raw) continue;

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        console.warn('SSE JSON parse failed:', raw);
        continue;
      }

      switch (data.type) {
        case 'content_block_start':
          currentBlock = data.content_block;
          if (currentBlock.type === 'text') currentBlock.text = '';
          if (currentBlock.type === 'tool_use') currentBlock.input = '';
          result.content.push(currentBlock);
          break;

        case 'content_block_delta':
          if (data.delta.type === 'text_delta') {
            currentBlock.text += data.delta.text;
            callbacks.onText?.(data.delta.text);       // 流式文本回调
          }
          if (data.delta.type === 'input_json_delta') {
            currentBlock.input += data.delta.partial_json;
          }
          break;

        case 'content_block_stop':
          if (currentBlock.type === 'tool_use') {
            currentBlock.input = JSON.parse(currentBlock.input);
            callbacks.onToolCall?.(currentBlock);       // 工具调用回调
          }
          break;

        case 'message_delta':
          result.stop_reason = data.delta.stop_reason;
          result.usage = data.usage;
          break;
      }
    }
  }

  return result;
}
```

> 注：Anthropic API 在浏览器中直接调用需要 `anthropic-dangerous-direct-browser-access` header。
> 这是 Anthropic 官方支持的方式，适用于用户自带 Key 的场景。

#### UI 消息展示策略

> 完整 UI 设计详见「十六、UI 界面设计」。此处为 Agent Loop 层面的展示回调接口说明。

```
流式输出在 Side Panel 聊天窗口中的展示规则：

文本消息（text block）：
  → 在对话气泡中逐字流式展示（打字机效果）

工具调用（tool_use block）：
  → 可交互折叠卡片，处理中显示 "🔧 查看页面结构  ◌ 进行中"
  → 完成后折叠为 "✅ 查看页面结构  ▸"，点击 ▸ 展开输入/输出详情
  → 连续的工具调用紧凑排列在同一卡片组内

工具结果（tool_result）：
  → 折叠在对应工具调用卡片内
  → 默认折叠，展开卡片时显示

样式应用确认浮层：
  → Agent 本轮完成后，若执行了 apply_styles(save)，在输入框上方浮现确认/撤销按钮
  → 等整轮结束后统一出一次浮层，不是每次 apply 都弹
  → 单次应用: [✓ 确认效果] [↶ 撤销]
  → 多次应用: [✓ 全部确认] [↶ 撤销最后一步 ▾]（展开可选"全部撤销"）
  → 浮层消失条件：点击确认/撤销、用户发新消息（隐式确认）、60s 超时

取消操作：
  → Agent 运行期间，发送按钮变为「停止」按钮（■ 图标）
  → 点击停止 → 调用 cancelAgentLoop() → 中断 fetch + 解锁 Tab
  → 已应用的样式保留（用户可通过浮层撤销或对话中要求 rollback）
  → 对话历史保存到中断位置

并发保护：
  → Agent 运行期间，禁用输入框，显示"正在处理中..."
  → 防止状态错乱
```

### 10.2 工具执行器

工具分为两类：本地执行（Side Panel 内直接完成）和远程执行（需要 Content Script）。

```javascript
async function executeTool(name, args) {
  switch (name) {
    // —— 需要 Content Script 执行的工具（DOM 操作）——
    case 'get_page_structure':
      return await sendToContentScript({ tool: 'get_page_structure' });

    case 'grep':
      return await sendToContentScript({
        tool: 'grep',
        args: { query: args.query, scope: args.scope || 'children', maxResults: args.max_results || 5 }
      });

    case 'apply_styles':
      return await runApplyStyles(args.css || '', args.mode);

    // —— Side Panel 本地执行的工具 ——
    case 'get_user_profile':
      return await runGetUserProfile();

    case 'update_user_profile':
      return await runUpdateUserProfile(args.content);

    case 'load_skill':
      return await runLoadSkill(args.skill_name);

    case 'save_style_skill':
      return await runSaveStyleSkill(args.name, args.mood, args.skill_content);

    case 'list_style_skills':
      return await runListStyleSkills();

    case 'delete_style_skill':
      return await runDeleteStyleSkill(args.skill_id);

    case 'TodoWrite':
      return '任务列表已更新';

    case 'Task':
      return await runTask(args.description, args.prompt, args.agent_type);

    default:
      return `未知工具: ${name}`;
  }
}
```

### 10.3 Content Script 通信

Side Panel 通过 `chrome.tabs.sendMessage` 与 Content Script 通信。使用 `getTargetTabId()`（见 2.5）确保始终操作正确的 Tab：

```javascript
// Side Panel 端 —— 发给锁定的目标 Tab 的 Content Script
// getTargetTabId() 定义见 section 2.5
async function sendToContentScript(message) {
  const tabId = await getTargetTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Content Script 不可用: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

// Content Script 端 —— 工具执行
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.tool) {
    case 'get_domain':
      sendResponse(location.hostname);
      break;
    case 'get_page_structure':
      sendResponse(getPageStructure());
      break;
    case 'grep':
      sendResponse(runGrep(message.args.query, message.args.scope, message.args.maxResults));
      break;
    case 'inject_css': {
      const result = injectCSSAuto(message.args.css);
      sendResponse(result?.fallback ? result : 'ok');
      break;
    }
    case 'rollback_css':
      rollbackCSS(message.args?.scope || 'last');
      sendResponse('ok');
      break;
    case 'get_active_css':
      sendResponse(cssStack.join('\n') || '');
      break;
  }
  return true;
});

// 页面导航检测：整页刷新时 Content Script 重新注入，SPA 导航时主动通知
let lastUrl = location.href;

const navObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    chrome.runtime.sendMessage({ type: 'page_navigated', url: location.href, domain: location.hostname });
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener('popstate', () => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    chrome.runtime.sendMessage({ type: 'page_navigated', url: location.href, domain: location.hostname });
  }
});
```

### 10.4 主循环

```javascript
const SYSTEM_BASE = `你是 StyleSwift，网页样式个性化智能体。

任务：帮助用户用一句话个性化网页样式。

工作方式：
- 使用工具完成任务
- 优先行动，而非长篇解释
- 完成后简要总结

可用工具：get_page_structure, grep, apply_styles, get_user_profile, update_user_profile, load_skill, save_style_skill, list_style_skills, delete_style_skill, Task, TodoWrite

生成 CSS 时遵循：
1. 使用具体选择器（如 .site-header, main#content），不用 * 或标签通配
2. 所有声明加 !important，确保覆盖页面原有样式
3. 避免使用 @import 或修改 <link> 标签
4. 颜色使用 hex 或 rgba，不使用 CSS 变量（页面变量可能被覆盖）

风格技能（Style Skill）：
- 用户满意当前风格并希望复用时，用 save_style_skill 提取并保存
- 提取时关注抽象特征（色彩、排版、效果、设计意图），不是具体选择器
- 应用用户风格技能时，先 load_skill 读取，再结合 get_page_structure 查看目标页面结构，生成适配当前页面的 CSS
- 参考 CSS 中的选择器来自原始页面，不可直接使用
- 同一风格在不同网站上应保持视觉一致性（色彩/氛围/效果），但选择器必须适配目标页面`;

const BASE_TOOLS = [
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
  APPLY_STYLES_TOOL,
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
  LOAD_SKILL_TOOL,
  SAVE_STYLE_SKILL_TOOL,
  LIST_STYLE_SKILLS_TOOL,
  DELETE_STYLE_SKILL_TOOL,
  TODO_WRITE_TOOL,
];

const ALL_TOOLS = [...BASE_TOOLS, TASK_TOOL];


const MAX_ITERATIONS = 20;

let currentAbortController = null;
let isAgentRunning = false;

// 取消当前正在执行的 Agent Loop
function cancelAgentLoop() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  isAgentRunning = false;
  unlockTab();
}

async function agentLoop(prompt, uiCallbacks) {
  // —— 并发保护：拒绝重复请求 ——
  if (isAgentRunning) {
    uiCallbacks.appendText('(正在处理中，请等待当前请求完成)');
    return;
  }

  isAgentRunning = true;
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  try {
    // 0. 锁定当前 Tab 并获取域名
    const tabId = await getTargetTabId();
    lockTab(tabId);
    const domain = await getTargetDomain();
    const sessionId = await getOrCreateSession(domain);
    currentSession = new SessionContext(domain, sessionId);

    // 1. 加载历史
    let history = await loadAndPrepareHistory(domain, sessionId);

    // 2. 构建 system prompt = L0 + L1
    const sessionMeta = await loadSessionMeta(domain, sessionId);
    const profileHint = await getProfileOneLiner();
    const system = SYSTEM_BASE + buildSessionContext(domain, sessionMeta, profileHint);

    // 3. Agent Loop（流式 + 迭代上限 + 取消支持）
    history.push({ role: 'user', content: prompt });
    let lastInputTokens = 0;
    let response;
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      response = await callAnthropicStream(system, history, ALL_TOOLS, {
        onText: (delta) => uiCallbacks.appendText(delta),
        onToolCall: (block) => uiCallbacks.showToolCall(block),
      }, signal);

      lastInputTokens = response.usage?.input_tokens || 0;
      history.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') break;

      const results = [];
      for (const block of response.content) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        if (block.type === 'tool_use') {
          uiCallbacks.showToolExecuting(block.name);
          const output = await executeTool(block.name, block.input);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: output });
          uiCallbacks.showToolResult(block.id, output);
        }
      }

      history.push({ role: 'user', content: results });

      if (lastInputTokens > TOKEN_BUDGET) {
        history = await checkAndCompressHistory(history, lastInputTokens);
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      uiCallbacks.appendText('\n(已达到最大处理轮次，自动停止)');
    }

    // 4. 持久化
    await saveHistory(domain, sessionId, history);

    // 5. 首轮自动标题
    if (!sessionMeta.title) {
      sessionMeta.title = prompt.slice(0, 20);
      await saveSessionMeta(domain, sessionId, sessionMeta);
    }

    const textParts = response.content.filter(b => b.type === 'text').map(b => b.text);
    return textParts.join('');

  } catch (err) {
    if (err.name === 'AbortError') {
      uiCallbacks.appendText('\n(已取消)');
      return;
    }
    throw err;
  } finally {
    isAgentRunning = false;
    currentAbortController = null;
    unlockTab();
  }
}
```

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

```javascript
const RESTRICTED_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^file:\/\//,
  /^https:\/\/chrome\.google\.com\/webstore/,
  /^https:\/\/microsoftedge\.microsoft\.com\/addons/,
];

function isRestrictedPage(url) {
  return RESTRICTED_PATTERNS.some(p => p.test(url));
}

// 在 Agent Loop 启动前检测（通过 Content Script 是否可达判断）
async function checkPageAccess(tabId) {
  try {
    const domain = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { tool: 'get_domain' }, (response) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response);
      });
    });
    return { ok: true, domain };
  } catch {
    return { ok: false, reason: '此页面不支持样式修改（浏览器内部页面或受限页面）' };
  }
}
```

### 11.3 API 调用错误处理

```javascript
async function callAnthropicStreamSafe(system, messages, tools, callbacks, abortSignal) {
  const MAX_RETRIES = 2;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      return await callAnthropicStream(system, messages, tools, callbacks, abortSignal);
    } catch (err) {
      if (err.message.includes('401')) {
        throw new AgentError('API_KEY_INVALID', '请检查 API Key 是否正确');
      }
      if (err.message.includes('429')) {
        const waitMs = Math.pow(2, retries) * 2000;
        callbacks.onStatus?.(`API 限流，${waitMs / 1000}秒后重试...`);
        await sleep(waitMs);
        retries++;
        continue;
      }
      if (err instanceof TypeError) {
        throw new AgentError('NETWORK_ERROR', '网络连接失败，请检查网络');
      }
      throw new AgentError('API_ERROR', `API 异常: ${err.message}`);
    }
  }

  throw new AgentError('MAX_RETRIES', 'API 多次重试失败');
}

class AgentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
```

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
│   ├── Side Panel 写入 chrome.storage.local（会话样式 + 永久样式）
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

### 12.3 风格迁移场景：保存风格

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

### 12.4 风格迁移场景：应用风格到新网站

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

### 12.5 风格技能管理

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

```javascript
// 示例：mergeCSS 单元测试
describe('mergeCSS', () => {
  test('同选择器同属性覆盖', () => {
    const old = '.header { color: red !important; }';
    const add = '.header { color: blue !important; }';
    expect(mergeCSS(old, add)).toContain('color: blue !important');
    expect(mergeCSS(old, add)).not.toContain('color: red');
  });

  test('不同选择器合并', () => {
    const old = '.header { color: red; }';
    const add = '.footer { color: blue; }';
    const result = mergeCSS(old, add);
    expect(result).toContain('.header');
    expect(result).toContain('.footer');
  });

  test('@media 规则整体保留', () => {
    const old = '@media (max-width: 768px) { .header { color: red; } }';
    const add = '.footer { color: blue; }';
    const result = mergeCSS(old, add);
    expect(result).toContain('@media');
    expect(result).toContain('.footer');
  });
});
```

### 14.2 集成测试

使用 Puppeteer 的扩展测试模式，加载未打包的扩展进行端到端测试：

```javascript
// 使用 puppeteer 加载扩展
const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});
```

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
└── 永久样式
    ├── early-inject.js 在 document_start 注入
    └── 页面刷新后样式仍生效
```

### 14.3 手动测试清单

```
核心流程：
☐ 安装扩展 → 点击图标 → Side Panel 打开
☐ 首次使用 → API Key 引导页 → 输入 Key → 验证通过
☐ 输入 "把背景改成深蓝色" → 流式展示 → 页面样式变化
☐ 输入 "撤回" → 样式恢复
☐ 关闭 Side Panel → 重新打开 → 对话历史恢复
☐ 刷新页面 → 永久样式自动注入（无闪烁）

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
│                              (截断)   │
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
| 点击"撤销" | 自动发送 rollback_last 指令给 Agent，撤销最后一步样式，浮层消失 |
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
│ 是否同时清除该网站的永久样式？      │
│                                   │
│   [仅删会话]    [一并清除样式]     │
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
│  │ https://api.anthropic.com         │  │
│  └───────────────────────────────────┘  │
│  默认: https://api.anthropic.com        │
│  支持兼容 Anthropic 格式的代理地址       │
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
│  │  https://api.anthropic.com        │  │
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
