# StyleSwift 架构概览

> 版本：extension v1.0.0（以 `extension/manifest.json` 为准）
> 更新日期：2026-03-18

---

## 一、产品定位

**StyleSwift** 是一个 Chrome 扩展，让用户用自然语言个性化任意网页的视觉样式。

**核心场景**：
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格迁移：在 A 网站打磨的风格，应用到 B 网站

**目标效果**：安装即用，无需后端，用户自带 API Key。

---

## 二、架构总览

```
Chrome Extension (Manifest V3)
│
├── Side Panel                    # UI + Agent 运行环境
│   ├── 会话管理
│   ├── Agent Loop
│   └── LLM API 调用
│
├── Service Worker                # 扩展生命周期
│
├── Content Script × 2
│   ├── early-inject.js           # 样式预注入
│   └── content.js                # DOM 操作
│
└── Storage
    ├── chrome.storage.local      # 轻量/高频：设置、索引、会话样式、镜像
    └── IndexedDB                 # 大体积/低频：对话历史 + CSS 快照
```

**重要决策**：
- [ADR-001: Side Panel vs Popup](ADR/001-sidepanel-vs-popup.md)
- [ADR-002: 双 Content Script 策略](ADR/002-dual-content-script.md)
- [ADR-003: 双层存储架构](ADR/003-dual-storage.md)

---

## 三、模块职责

| 模块 | 职责 |
|------|------|
| Side Panel | UI 交互、Agent 循环、工具调度（tool dispatcher）、API 调用、会话/存储读写 |
| Content Script | 页面结构提取、元素搜索（grep）、CSS 注入/回滚、元素 Picker、SPA 导航通知 |
| Service Worker | 点击图标打开 Side Panel；扩展安装/更新/启动时向已打开标签页补注入脚本；打开欢迎页 |

---

## 四、核心功能

| 功能 | 说明 | 详情 |
|------|------|------|
| 页面结构获取 | 返回 DOM 树形文本 | [设计文档](features/get-page-structure.md) |
| 元素搜索 | 按选择器或关键词搜索 | [设计文档](features/grep.md) |
| 样式应用 | 注入 CSS，支持回滚；必要时 CSP 降级 | [设计文档](features/apply-styles.md) |
| 样式编辑 | 精准修改已应用 CSS | [设计文档](features/edit-css.md) |
| 用户画像 | 存储用户偏好 | [设计文档](features/user-profile.md) |
| 风格迁移 | 跨网站应用风格 | [设计文档](features/style-skill.md) |

**重要决策**：[ADR-004: 风格迁移方案](ADR/004-style-skill.md)

---

## 五、会话管理

三级隔离模型：全局 → 域名 → 会话（代码入口：`extension/sidepanel/session.js`）

```
全局层: 用户画像
  │
  └── 域名层: 每个域名的会话列表
        │
        └── 会话层: 样式、元数据、对话历史
              │
              ├── 活动镜像: 用于刷新恢复（document_start 预注入）
              └── 样式历史栈: 支持 rollback_last
```

### 真实存储键（实现对齐）

- **域名会话索引**：`sessions:{domain}:index`
- **域名活跃会话**：`sessions:{domain}:active`
- **会话元数据**：`sessions:{domain}:{sessionId}:meta`
- **会话样式（合并后的完整 CSS）**：`sessions:{domain}:{sessionId}:styles`
- **会话样式历史栈（用于撤销）**：`sessions:{domain}:{sessionId}:styles_history`
- **域名活跃样式镜像（用于刷新后无闪烁恢复）**：`active_styles:{domain}`
- **对话历史 + CSS 快照**：IndexedDB `StyleSwiftDB / conversations`，key 为 `{domain}:{sessionId}`

**重要决策**：
- [ADR-005: 会话隔离模型](ADR/005-session-isolation.md)

---

## 六、Agent 循环

```
用户消息 → 构建上下文 → 调 LLM → 执行工具（如有）→ 循环 → 保存历史
```

**核心理念**：代码只提供能力，模型负责推理决策。

### 真实实现要点（与代码一致）

- **执行环境**：Agent Loop 运行在 Side Panel（`extension/sidepanel/agent-loop.js`）。
- **Provider 兼容**：同一套 ICF 消息结构，按 Provider 序列化为 OpenAI ChatCompletions 或 Claude Messages；并支持流式解析与工具调用。
- **上下文管理**：
  - **动态 Token 预算**：根据模型上下文窗口动态计算 token 预算，而非固定值。计算公式：`budget = context_window × 90% - system_overhead`。支持的模型及其上下文窗口定义在 `extension/sidepanel/model-context.js`。
  - **模型上下文窗口映射**：主流模型（Claude、GPT、DeepSeek、Gemini 等）的上下文窗口大小已内置，未知模型使用保守默认值（128k）。
  - **历史压缩**：当超过 token 预算时触发"历史压缩"（对旧对话做摘要 + 截断大 tool_result），避免上下文爆炸。
  - 旧 assistant 的 `_reasoning` 会被剥离，仅保留最后一条（节省上下文）。
- **死循环保护**：连续多次相同 tool + args 会触发去重保护并返回提示，避免无效重复调用。
- **并发保护**：同一时间仅允许一个 Agent Loop 运行；并提供取消（abort）能力。
- **子智能体**：内置 `QualityAudit`（质检）子任务，可在隔离上下文中运行并自动截图（`Task` 工具）。

**重要决策**：
- [ADR-006: Agent 设计理念](ADR/006-agent-philosophy.md)
- [ADR-007: Tab 锁定机制](ADR/007-tab-locking.md)

---

## 七、UI 设计

详见 [UI 界面设计文档](ui-design.md)。

---

## 八、错误与安全

**错误分类**（与实现对齐）：API Key 无效（401）、网络错误（fetch TypeError）、限流（429，指数退避重试）、上下文过长（自动压缩后重试一次）、受限页面（内部页/协议不允许注入）、死循环保护、用户取消（AbortError）。

**安全措施**（与实现对齐）：
- **API Key 本地存储**：使用 `chrome.storage.local` 保存设置，不做后端中转。
- **API 访问权限**：默认 API 地址通过 `host_permissions` 覆盖；当用户配置为其他域名时，通过 `chrome.permissions.request()` 动态申请对应 origin 访问权限（避免无权限导致请求失败）。
- **受限页面保护**：对 `chrome://`、`edge://`、`about:`、`file://` 等页面直接判定不可注入，并在 UI 侧提示。
- **Content Script 隔离**：页面 DOM 操作与注入逻辑在 Content Script；Side Panel 仅通过 message/工具调用触达。
- **CSP 降级**：Content Script 注入 CSS 若被 CSP 阻止，会返回 fallback；Side Panel 使用 `chrome.scripting.insertCSS` 进行降级注入（绕过 CSP 限制）。

---

## 九、设计原则

| 原则 | 说明 |
|------|------|
| 模型即智能体 | 代码只提供能力，模型负责推理 |
| 能力原子化 | 每个工具只做一件事 |
| 上下文珍贵 | 分层管理，按需获取 |
| 会话隔离 | 按域名分割，支持多会话 |
| 零部署 | 纯扩展，安装即用 |

> **The model already knows how to be an agent. Your job is to get out of the way.**
