# StyleSwift Agent 设计方案

> 版本：v4.0
> 日期：2026-03-03
> 设计理念：基于 agent-builder 哲学 - The model IS the agent, code just provides capabilities
> 架构变更：前后端合并为纯 Chrome 插件，安装即用，无需部署后端

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

### 2.1 架构决策：纯插件方案

**决策依据：**

| 因素 | 判断 |
|------|------|
| 后端是否创造独立价值？ | 否——后端只是 LLM API 的中转，不提供独立计算能力 |
| 插件能否直接调 LLM API？ | 能——Chrome 扩展可以发 HTTP 请求 |
| DOM 操作谁更擅长？ | 插件——直接操作 live DOM 比序列化→传输→反序列化更高效 |
| 用户部署成本？ | 纯插件零部署，有后端则需要用户跑 Python 服务 |
| API Key 模式？ | 用户自带 Key（类似 Cursor/ChatGPT Sidebar 模式）|

**v3 → v4 核心变化：**

```
v3（前后端分离）：                     v4（纯插件）：

Chrome Extension                      Chrome Extension
  ↓ 采集 HTML → 保存文件                  ↓ 直接操作 live DOM
  ↓ 发消息给后端                          ↓ 简化管道在 Content Script 中执行
Python Backend                            ↓ Agent Loop 在 Offscreen Document 中执行
  ↓ 读文件 → BS4 解析                     ↓ 直接调 Anthropic API
  ↓ 调 Anthropic API                     ↓ CSS 注入回 Content Script
  ↓ 发指令回插件
Chrome Extension
  ↓ 注入 CSS
```

### 2.2 插件内部架构

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

### 2.3 为什么用 Side Panel 而非 Popup

| 维度 | Popup | Side Panel |
|------|-------|-----------|
| 生命周期 | 点击其他地方**立即关闭**，状态丢失 | 持续打开，切换 tab 不消失 |
| 交互场景 | 适合一次性操作 | 适合**持续对话** |
| 并行操作 | 无法同时操作页面和插件 | **边看效果边继续对话** |
| 尺寸 | 固定小窗口（最大 800×600） | 侧边栏，高度铺满，宽度可调 |
| Agent Loop | 关闭即中断 | **面板打开期间持续运行** |

StyleSwift 的核心交互是"用户说一句话 → 看效果 → 再调整"，是持续多轮对话。Popup 的"点外面就关"是致命缺陷——用户说完"把背景改成深蓝"后想看看页面效果，鼠标一点页面，Popup 就没了。

### 2.4 为什么 Agent Loop 放在 Side Panel 而非 Offscreen Document

Manifest V3 的 Service Worker 有非活跃 30 秒后休眠的限制，不适合跑 Agent Loop。
备选方案有两个：Offscreen Document（不可见后台页面）和 Side Panel。

```
方案 A（Offscreen Document）：               方案 B（Side Panel）✓ 采用

Side Panel → Service Worker → Offscreen     Side Panel
  UI 层          路由          Agent Loop      UI 层 + Agent Loop 合一
                                              ↓ 直接调 Anthropic API
3 层消息传递                                   ↓ chrome.tabs.sendMessage 调工具
关闭面板不影响执行                              关闭面板中断执行（合理：用户不看了）
```

选择方案 B 的理由：
1. **少一层中转** —— Side Panel 可以直接 `chrome.tabs.sendMessage` 与 Content Script 通信，不需要经过 Service Worker
2. **架构更简单** —— UI 和 Agent 在同一个 JS 上下文，无需跨文档通信
3. **关闭即停止是合理行为** —— 用户关闭 Side Panel = 不看结果了，中断是合理的
4. **Side Panel 在打开期间有持久 JS 上下文**，不受 Service Worker 30 秒限制

### 2.5 内部消息流

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

### 2.6 多 Tab 场景处理

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

通信消息类型（对比 v3 的十几种，大幅简化）：

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

v4 中 SessionContext 从文件路径映射变为 Storage key 映射：

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

v3 的流程是"插件采集 HTML → 保存文件 → 后端读文件 → BeautifulSoup 解析"。
v4 直接在 Content Script 中操作 live DOM，一步到位。

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


// === 实时读取计算样式（v4 核心优势：不再需要 data-cs 预缓存）===
// 不使用缩写，直接输出完整 CSS 属性名，避免 LLM 歧义

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


// === 格式化输出（与 v3 输出格式完全一致）===

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


// === 辅助函数（与 v3 逻辑一致，语言从 Python 改为 JS）===

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

直接使用浏览器原生 `querySelectorAll` 和 DOM 遍历，比 BeautifulSoup 模拟更准确。

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
    // 浏览器原生 querySelectorAll —— 比 BeautifulSoup.select 更准确
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

    // 实时读取计算样式进行匹配（v4 优势：不依赖 data-cs 预缓存）
    const cs = window.getComputedStyle(el);
    const bgColor = cs.backgroundColor;
    const color = cs.color;
    if (bgColor.includes(kw) || color.includes(kw)) { results.push(el); continue; }
  }

  return results;
}
```

#### 3.2.3 相似元素折叠

与 v3 逻辑一致，JS 实现：

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

输出示例与 v3 完全一致：

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

技能文件打包为扩展的静态资源，通过 `fetch` 读取。

```javascript
const LOAD_SKILL_TOOL = {
  name: 'load_skill',
  description: `加载领域知识。

可用的知识：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

当你需要专业知识时加载。`,
  input_schema: {
    type: 'object',
    properties: {
      skill_name: { type: 'string', description: '知识名称' }
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
  const path = SKILL_PATHS[skillName];
  if (!path) return `未知知识: ${skillName}。可用: ${Object.keys(SKILL_PATHS).join(', ')}`;

  // Side Panel 中通过 chrome.runtime.getURL 访问扩展内静态资源
  const url = chrome.runtime.getURL(path);
  const resp = await fetch(url);
  return await resp.text();
}
```

Side Panel 作为扩展自身页面，可直接通过 `chrome.runtime.getURL` 访问打包资源，**不需要**在 `manifest.json` 中声明 `web_accessible_resources`。

> `web_accessible_resources` 的作用是让**网页**能访问扩展资源。Side Panel 是扩展内部页面，天然有权限。
> 移除该声明可避免 skills 文件被任意网页读取的安全风险。

---

## 四、Task（子智能体）

### 设计原则

```
Subagent 设计原则（与 v3 一致）：
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

## 五、TodoWrite（可选）

与 v3 完全一致，不再赘述。模型自己决定是否使用，简单任务不需要。

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

与 v3 结构一致，存储层变化：

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

利用 API 返回的 `response.usage.input_tokens` 做精确检测（与 v3 机制一致）。
历史存储从文件系统改为 IndexedDB：

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

  const { apiKey, model } = await getSettings();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
与 v3 一致：
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
│  "persistent:{domain}"                  string (CSS)    │
│                                                         │
│  "sessions:{domain}:index"              array           │
│  "sessions:{domain}:{id}:meta"          object          │
│  "sessions:{domain}:{id}:styles"        string (CSS)    │
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

### 7.2 为什么分两层

| 数据 | 典型大小 | 读写频率 | 存在哪 | 理由 |
|------|---------|---------|--------|------|
| 用户画像 | <1KB | 低 | chrome.storage.local | 小而轻，需要快速读取 |
| API Key / 设置 | <1KB | 极低 | chrome.storage.local | 设置页读写 |
| 会话索引 | <5KB/域名 | 中 | chrome.storage.local | 打开 Side Panel 时需要立即展示列表 |
| 会话样式 | <50KB/会话 | 中 | chrome.storage.local | 恢复会话时需要快速注入 |
| 永久样式 | <50KB/域名 | 每次页面加载 | chrome.storage.local | content script 启动时自动读取注入 |
| **对话历史** | **几十KB~几百KB** | 低 | **IndexedDB** | 可能很大，只在加载/保存时访问 |

### 7.3 与 v3 存储的映射关系

```
v3（文件系统）                              v4（Chrome Storage）
──────────────                             ────────────────

storage/user_profile.md              →     chrome.storage.local["userProfile"]
                                           值: string（纯文本，内容不变）

storage/domains/{d}/page.html        →     ❌ 不再需要（直接操作 live DOM）

storage/domains/{d}/sessions/        →     chrome.storage.local["sessions:{d}:index"]
  index.json                               值: [{ id, title, created_at, ... }]

storage/domains/{d}/sessions/        →     chrome.storage.local["sessions:{d}:{id}:meta"]
  {id}/（目录本身的元信息）                    值: { title, created_at, message_count, ... }

storage/domains/{d}/sessions/        →     chrome.storage.local["sessions:{d}:{id}:styles"]
  {id}/styles.css                          值: string（CSS 文本，内容不变）

storage/domains/{d}/sessions/        →     IndexedDB "conversations" store
  {id}/history.json                        key: "{d}:{id}", 值: messages array

（v3 没有）                            →     chrome.storage.local["persistent:{d}"]
Chrome Storage 永久样式                      值: string（save 模式注册的 CSS）

（v3 没有）                            →     chrome.storage.local["settings"]
                                           值: { apiKey, model, ... }
```

### 7.4 IndexedDB 封装

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

### 7.5 永久样式自动注入

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

**为什么需要两个 Content Script：**

| 脚本 | 注入时机 | 职责 | 为什么 |
|------|---------|------|-------|
| `early-inject.js` | `document_start` | 仅注入永久样式 | DOM 构建前执行，防止页面先以原始样式渲染后再闪烁变化 |
| `content.js` | `document_idle` | DOM 工具 + 消息监听 + CSS 注入/回滚 | 需要完整 DOM 才能执行 `get_page_structure`、`grep` 等操作 |

### 7.6 存储清理策略

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

### 7.7 存储 Schema 版本迁移

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

---

## 八、Session（会话管理）

### 8.1 三级隔离模型

与 v3 概念一致，容器从文件系统变为 Chrome Storage：

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
└── [切换会话]
    ├── 卸载当前会话样式（移除 <style> 元素）
    ├── 加载目标会话样式
    └── 替换 SessionContext
```

### 8.3 会话标题自动生成

```javascript
function autoTitle(sessionMeta, firstUserMessage) {
  if (!sessionMeta.title) {
    sessionMeta.title = firstUserMessage.slice(0, 20);
  }
}
```

### 8.4 会话辅助函数

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

## 九、API Key 管理

### 9.1 存储

```javascript
// settings 页面写入
async function saveApiKey(apiKey) {
  await chrome.storage.local.set({
    settings: { apiKey, model: 'claude-sonnet-4-20250514' }
  });
}

// Agent Loop 读取
async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.apiKey) throw new Error('请先在设置中配置 API Key');
  return settings;
}
```

### 9.2 安全措施

```
1. API Key 存在 chrome.storage.local，不同步到云端（不用 chrome.storage.sync）
2. Content Script 无法访问 API Key（只有 Side Panel 可以）
3. 所有 API 调用从 Side Panel 发出，不经过页面上下文
4. 不在代码中硬编码任何 Key
```

### 9.3 首次使用引导

```
用户安装插件
  → 打开 Side Panel
  → 检测到无 API Key
  → 显示引导页：
    "StyleSwift 需要 Anthropic API Key 才能工作。"
    [输入 API Key]
    [获取 Key 的教程链接]
    [保存]
  → 验证 Key 有效性（发一个 minimal API 请求）
  → 成功 → 进入主界面
```

---

## 十、Agent Loop（核心循环）

### 10.1 LLM API 调用（Streaming）

从 Side Panel 直接调用 Anthropic Streaming API，实现逐步输出：

```javascript
async function callAnthropicStream(system, messages, tools, callbacks, abortSignal) {
  const { apiKey, model } = await getSettings();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
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

```
流式输出在 Side Panel 聊天窗口中的展示规则：

文本消息（text block）：
  → 在对话气泡中逐字流式展示（打字机效果）

工具调用（tool_use block）：
  → 折叠展示为一行摘要，如 "🔧 正在查看页面结构..."
  → 用户可点击展开查看完整工具输入/输出
  → 工具执行中显示 loading 动画

工具结果（tool_result）：
  → 折叠在对应工具调用下方
  → 默认折叠，点击展开

多轮工具调用：
  → 每轮工具调用折叠为一行，最终文本回复正常展示
  → 示例：
    用户: "把背景改成深蓝色"
    ┌ 🔧 查看页面结构     [展开 ▸]
    ├ 🔧 应用样式         [展开 ▸]
    └ 已将页面背景改为深蓝色（#1a1a2e），文字颜色调整为浅灰...

取消操作：
  → Agent 运行期间，发送按钮变为「停止」按钮（■ 图标）
  → 点击停止 → 调用 cancelAgentLoop() → 中断 fetch + 解锁 Tab
  → 已应用的样式保留（用户可手动 rollback）
  → 对话历史保存到中断位置

并发保护：
  → Agent 运行期间，禁用输入框或显示排队提示
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

Side Panel 通过 `chrome.tabs.sendMessage` 与 Content Script 通信。使用 `getTargetTabId()`（见 2.6）确保始终操作正确的 Tab：

```javascript
// Side Panel 端 —— 发给锁定的目标 Tab 的 Content Script
// getTargetTabId() 定义见 section 2.6
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

可用工具：get_page_structure, grep, apply_styles, get_user_profile, update_user_profile, load_skill, Task, TodoWrite

生成 CSS 时遵循：
1. 使用具体选择器（如 .site-header, main#content），不用 * 或标签通配
2. 所有声明加 !important，确保覆盖页面原有样式
3. 避免使用 @import 或修改 <link> 标签
4. 颜色使用 hex 或 rgba，不使用 CSS 变量（页面变量可能被覆盖）`;

const BASE_TOOLS = [
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
  APPLY_STYLES_TOOL,
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
  LOAD_SKILL_TOOL,
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

---

## 十三、项目结构

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
    ├── StyleSwift-Agent设计方案-v3.md   # 历史版本（前后端分离）
    └── StyleSwift-Agent设计方案-v4.md   # 当前版本（纯插件）
```

### manifest.json

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

#### 权限说明

| 权限 | 类型 | 为什么需要 |
|------|------|-----------|
| `activeTab` | permission | 获取当前活跃 Tab ID（用于 `chrome.tabs.query`），不获取 URL（域名通过 Content Script 获取） |
| `storage` | permission | 读写 chrome.storage.local，存储会话、样式、用户画像、设置 |
| `sidePanel` | permission | 注册和控制 Side Panel |
| `https://api.anthropic.com/*` | host_permission | 从 Side Panel 直接调用 Anthropic API |
| `content_scripts: <all_urls>` | manifest 声明 | 在所有页面注入 Content Script（DOM 操作 + 永久样式注入） |

> **为什么同时有 `activeTab` 和 `content_scripts <all_urls>`：**
> `content_scripts` 的 `<all_urls>` 匹配是静态声明，确保 Content Script 在每个页面加载时自动注入（尤其是 `early-inject.js` 需要在 `document_start` 注入永久样式）。
> `activeTab` 用于 Side Panel 通过 `chrome.tabs.query` 获取当前活跃 Tab 的 ID，再通过 `chrome.tabs.sendMessage` 与其 Content Script 通信。
> 两者功能不重叠：前者是"在页面里注入脚本"，后者是"在扩展内定位目标 Tab"。
>
> **为什么不需要 `tabs` 权限：**
> 域名通过向 Content Script 发送 `get_domain` 消息获取（Content Script 返回 `location.hostname`），不需要从扩展侧读取 `tab.url`，从而避免了 `tabs` 权限带来的"读取您的浏览历史记录"恐怖提示。
>
> **为什么不需要 `web_accessible_resources`：**
> Side Panel 是扩展内部页面，天然有权通过 `chrome.runtime.getURL` 访问打包资源，无需额外声明。移除可防止 skills 文件被任意网页读取。

### Service Worker

Service Worker 的职责大幅简化——只负责注册 Side Panel 和处理图标点击：

```javascript
// background/service-worker.js

// 点击扩展图标时打开 Side Panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

---

## 十四、v3 → v4 变更对照

| 方面 | v3（前后端分离） | v4（纯插件） |
|------|----------------|-------------|
| **架构** | Chrome Extension + Python Backend | 纯 Chrome Extension |
| **部署** | 用户需跑 Python 服务 | 安装即用 |
| **用户界面** | Popup（点外面就关） | Side Panel（侧边栏常驻，边看效果边对话） |
| **API 调用** | 后端同步调用，等待完整响应 | Streaming API，流式输出文本 + AbortController 取消支持 |
| **API Key** | 后端环境变量 | 用户自带，存 chrome.storage.local |
| **DOM 操作** | 插件采集 HTML → 保存文件 → 后端 BS4 解析 | Content Script 直接操作 live DOM |
| **计算样式** | 预缓存为 data-cs 属性 + 缩写（ABBR） | 实时 getComputedStyle + 完整 CSS 属性名 |
| **CSS 选择器查询** | BeautifulSoup.select() | 原生 querySelectorAll() |
| **apply_styles** | preview/apply/save/rollback 四模式 | save/rollback_last/rollback_all 三模式（变更栈支持单步撤销）|
| **CSS 管理** | 追加写入，无去重 | mergeCSS 去重合并（支持 @media/@keyframes）+ !important 特异性策略 |
| **CSS 注入** | 仅 `<style>` 标签 | 三级 CSP 降级（`<style>` → adoptedStyleSheets → scripting API）|
| **存储** | 文件系统 (storage/ 目录) | chrome.storage.local + IndexedDB + 自动清理 + Schema 迁移 |
| **通信协议** | 十几种消息类型 | 精简消息类型（域名获取 + 工具调用 + response） |
| **Agent Loop 运行环境** | Python 进程 | Side Panel JS 上下文 |
| **多 Tab 处理** | 未定义 | Agent 启动时锁定当前 Tab，域名由 Content Script 提供 |
| **域名获取** | 后端读文件路径 | Content Script 返回 `location.hostname`（无需 `tabs` 权限）|
| **永久样式注入** | content script (document_idle) | early-inject.js (document_start)，无闪烁 |
| **错误处理** | 未定义 | 受限页面预检测 + API 重试 + 迭代上限 + 取消支持 |
| **并发保护** | 未定义 | isAgentRunning 锁 + UI 禁用 |
| **页面导航** | 未定义 | SPA 导航检测（MutationObserver + popstate）|
| **对话历史压缩** | 未定义 | LLM 自动摘要 + token 预算控制 |
| **Subagent** | 无迭代上限 | 添加 SUB_MAX_ITERATIONS 保护 |
| **SSE 解析** | 未定义 | JSON.parse 容错 + `[DONE]` 信号处理 |
| **page.html** | 需要保存和解析 | 不再需要 |
| **LLM 工具输出** | 样式用 ABBR 缩写 | 完整 CSS 属性名（消除歧义） |
| **Context 管理** | 不变 | 不变 |
| **用户画像** | 不变 | 不变（存储容器变化，内容格式不变） |

**关键变化项：** v4 不仅是架构变化（纯插件），还在多个维度做了显著改进——Streaming 流式输出 + 取消支持、三模式 rollback（变更栈）、CSS 去重合并（支持嵌套规则）、CSP 三级降级、多 Tab 锁定（域名由 Content Script 提供，无需 `tabs` 权限）、完整错误处理、并发保护、SPA 导航检测、对话历史 LLM 自动摘要、存储自动清理与 Schema 迁移。

---

## 十五、设计原则总结

继承 v3 的 agent-builder 哲学，新增架构原则：

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

> **The model already knows how to be an agent. Your job is to get out of the way.**

---

## 十六、测试策略

Chrome 扩展的三个执行上下文（Side Panel、Service Worker、Content Script）相互隔离，测试需要分层覆盖。

### 16.1 单元测试

纯函数可脱离浏览器环境独立测试，使用 Vitest 或 Jest：

```
可单测的模块：
├── css-merge.js      → mergeCSS, parseRules, splitTopLevelBlocks, serializeRules
├── session.js        → SessionContext key 生成逻辑
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

### 16.2 集成测试

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
│   └── 存储清理逻辑
│
├── CSP 降级
│   ├── 正常页面使用 <style> 注入
│   └── 严格 CSP 页面降级到 adoptedStyleSheets
│
└── 永久样式
    ├── early-inject.js 在 document_start 注入
    └── 页面刷新后样式仍生效
```

### 16.3 手动测试清单

```
核心流程：
☐ 安装扩展 → 点击图标 → Side Panel 打开
☐ 首次使用 → API Key 引导页 → 输入 Key → 验证通过
☐ 输入 "把背景改成深蓝色" → 流式展示 → 页面样式变化
☐ 输入 "撤回" → 样式恢复
☐ 关闭 Side Panel → 重新打开 → 对话历史恢复
☐ 刷新页面 → 永久样式自动注入（无闪烁）

边界场景：
☐ chrome:// 页面 → 提示不支持
☐ Agent 处理中切换 Tab → 操作不受影响
☐ Agent 处理中点击停止 → 正确中断
☐ 快速连发两条消息 → 第二条被拒绝/排队
☐ API Key 无效 → 错误提示 + 跳转设置
☐ 网络断开 → 离线提示
☐ 大型页面（>10000 DOM 节点）→ get_page_structure 不卡顿
```
