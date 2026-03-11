# StyleSwift 架构概览

> 版本：v5.0
> 更新日期：2026-03-11

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
    ├── chrome.storage.local      # 轻量数据
    └── IndexedDB                 # 对话历史
```

**重要决策**：
- [ADR-001: Side Panel vs Popup](ADR/001-sidepanel-vs-popup.md)
- [ADR-002: 双 Content Script 策略](ADR/002-dual-content-script.md)
- [ADR-003: 双层存储架构](ADR/003-dual-storage.md)

---

## 三、模块职责

| 模块 | 职责 |
|------|------|
| Side Panel | UI 交互、Agent 循环、API 调用、存储读写 |
| Content Script | DOM 遍历、CSS 注入、样式回滚 |
| Service Worker | 扩展图标行为、Side Panel 注册 |

---

## 四、核心功能

| 功能 | 说明 | 详情 |
|------|------|------|
| 页面结构获取 | 返回 DOM 树形文本 | [设计文档](features/get-page-structure.md) |
| 元素搜索 | 按选择器或关键词搜索 | [设计文档](features/grep.md) |
| 样式应用 | 注入 CSS，支持回滚 | [设计文档](features/apply-styles.md) |
| 样式编辑 | 精准修改已应用 CSS | [设计文档](features/edit-css.md) |
| 用户画像 | 存储用户偏好 | [设计文档](features/user-profile.md) |
| 风格迁移 | 跨网站应用风格 | [设计文档](features/style-skill.md) |

**重要决策**：[ADR-004: 风格迁移方案](ADR/004-style-skill.md)

---

## 五、会话管理

三级隔离模型：全局 → 域名 → 会话

```
全局层: 用户画像
  │
  └── 域名层: 每个域名的会话列表
        │
        └── 会话层: 样式、元数据、对话历史
              │
              └── 活动镜像: 用于刷新恢复
```

**重要决策**：
- [ADR-005: 会话隔离模型](ADR/005-session-isolation.md)

---

## 六、Agent 循环

```
用户消息 → 构建上下文 → 调 LLM → 执行工具（如有）→ 循环 → 保存历史
```

**核心理念**：代码只提供能力，模型负责推理决策。

**重要决策**：
- [ADR-006: Agent 设计理念](ADR/006-agent-philosophy.md)
- [ADR-007: Tab 锁定机制](ADR/007-tab-locking.md)

---

## 七、UI 设计

详见 [UI 界面设计文档](ui-design.md)。

---

## 八、错误与安全

**错误分类**：API 错误、网络错误、受限页面、死循环保护

**安全措施**：API Key 本地存储、Content Script 隔离、动态权限申请

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
