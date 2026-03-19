# 数字女娲 (StyleSwift)

<div align="center">

![数字女娲 Logo](images/banner.png)

**一句话，给常逛的网页换皮肤**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://github.com/zhushen12580/StyleSwift) [![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/zhushen12580/StyleSwift)

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 项目简介

数字女娲 (StyleSwift) 是一个基于 AI Agent 的 Chrome 浏览器扩展。不同于传统的模板系统，它能够理解你的自然语言描述，分析页面结构，自主规划样式方案，并智能地应用到页面元素。无需编写代码，只需描述你想要的效果，AI Agent 会完成从理解意图到执行样式的全部流程。

**核心能力**：
- **自然语言理解**：用日常语言描述需求，Agent 自动解析意图并规划执行步骤
- **智能页面分析**：自动识别页面结构、元素层级、现有样式，无需手动定位选择器
- **动态样式生成**：根据页面特征和用户意图，实时生成最适合的 CSS 规则
- **视觉质检能力**：样式应用后自动检测视觉问题（对比度、可访问性、样式冲突等），主动发现并修复潜在缺陷
- **隐私优先保护**：只传递页面结构代码给 AI，不传递页面核心内容（文本、图片等），保护用户隐私数据安全
- **自主学习优化**：记住你的风格偏好，在新页面自动应用相似的设计语言
- **多轮对话调整**：像和设计师对话一样，持续优化直到满意，支持撤销和回滚

### 效果预览

<div align="center">

智能样式生成效果展示：

![效果预览 1](images/demo1.png) | ![效果预览 2](images/demo2.png) | ![效果预览 3](images/demo3.png)
:---:|:---:|:---:
**旧报纸风格设计** | **黑客帝国风格设计** | **风格一键迁移**

只需一句话，数字女娲 即可理解你的设计意图并智能应用样式。

</div>

### 核心特性

| 特性 | 说明 |
|------|------|
| **AI 驱动** | 基于大语言模型，理解自然语言指令 |
| **元素选择器** | 点选页面元素，精准定位修改目标 |
| **图片上传** | 上传参考图片，AI 分析视觉风格 |
| **风格技能** | 保存成功的风格，跨网站复用 |
| **多语言支持** | 支持中文和英文界面 |
| **会话管理** | 按域名隔离，支持多会话历史 |
| **隐私优先** | 仅传递页面结构给 AI，不传递页面内容，API Key 本地存储，数据不上传 |
| **零配置** | 安装即用，无需后端服务 |

### 快速开始

#### 安装

1. **从源码安装**：
   ```bash
   # 克隆仓库
   git clone https://github.com/yourusername/StyleSwift.git
   cd StyleSwift
   ```

2. **加载扩展**：
   - 打开 Chrome 浏览器，访问 `chrome://extensions/`
   - 启用右上角的「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择 `extension` 文件夹

#### 配置

1. 首次使用会看到引导页面
2. 输入你的 API Key（支持 OpenAI 和 Anthropic API 格式）
3. 可选：配置自定义 API 地址和模型

#### 使用

1. **打开侧边栏**：点击浏览器工具栏的扩展图标
2. **输入指令**：在输入框中描述你想要的风格
   - 示例：「给页面换个深色模式」
   - 示例：「把标题字体放大一点」
   - 示例：「隐藏这个广告元素」（先点击元素选择器）
3. **上传图片**：点击图片按钮上传参考图片
4. **查看结果**：样式会立即应用到页面
5. **确认或撤销**：满意后点击确认，不满意点击撤销

### 风格技能

**保存风格**：
```
用户：「保存这个风格为"赛博朋克"」
AI 会提取当前的视觉特征并保存
```

**应用风格**：
```
用户：「用我的"赛博朋克"风格」
AI 会自动适配到当前网站
```

### 架构概览

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
│   ├── early-inject.js           # 样式预注入 (document_start)
│   └── content.js                # DOM 操作 (document_idle)
│
└── Storage
    ├── chrome.storage.local      # 轻量数据（设置、会话索引）
    └── IndexedDB                 # 对话历史
```

**核心设计理念**：
- **模型即智能体**：代码只提供能力，模型负责推理决策
- **能力原子化**：每个工具只做一件事
- **上下文珍贵**：分层管理，按需获取
- **会话隔离**：按域名分割，支持多会话

### 核心功能

| 功能 | 说明 | 文档 |
|------|------|------|
| 页面结构获取 | 返回 DOM 树形文本 | [查看](doc/features/get-page-structure.md) |
| 元素搜索 | 按选择器或关键词搜索 | [查看](doc/features/grep.md) |
| 样式应用 | 注入 CSS，支持回滚 | [查看](doc/features/apply-styles.md) |
| 样式编辑 | 精准修改已应用 CSS | [查看](doc/features/edit-css.md) |
| 用户画像 | 存储用户偏好 | [查看](doc/features/user-profile.md) |
| 风格迁移 | 跨网站应用风格 | [查看](doc/features/style-skill.md) |

### 项目结构

```
StyleSwift/
├── extension/                 # 扩展源码
│   ├── sidepanel/            # 侧边栏 UI 和逻辑
│   │   ├── panel.js          # 主面板逻辑
│   │   ├── agent-loop.js     # Agent 循环
│   │   ├── api.js            # API 调用
│   │   ├── tools.js          # 工具定义
│   │   ├── session.js        # 会话管理
│   │   └── style-skill.js    # 风格技能管理
│   ├── content/              # 内容脚本
│   │   ├── early-inject.js   # 早期样式注入
│   │   └── content.js        # DOM 操作
│   ├── background/           # 后台服务
│   │   └── service-worker.js # Service Worker
│   ├── _locales/             # 国际化
│   │   ├── en/               # 英文
│   │   └── zh_CN/            # 中文
│   ├── icons/                # 图标资源
│   ├── skills/               # 静态技能库
│   └── manifest.json         # 扩展配置
├── doc/                      # 文档
│   ├── ARCHITECTURE.md       # 架构文档
│   ├── ui-design.md          # UI 设计文档
│   ├── ADR/                  # 架构决策记录
│   └── features/             # 功能文档
└── tests/                    # 测试文件
```

### 技术栈

- **Manifest V3**：Chrome 扩展最新标准
- **Side Panel API**：现代化扩展 UI
- **JavaScript**：原生 JS，无框架依赖
- **Chrome Storage API**：数据持久化
- **IndexedDB**：大规模数据存储
- **OpenAI/Anthropic API**：大语言模型接口

### 开发指南

#### 本地开发

```bash
# 安装依赖（如果需要）
npm install

# 运行测试
npm test

# 代码检查
npm run lint
```

#### 架构决策

本项目使用 ADR (Architecture Decision Records) 记录重要设计决策：

- [ADR-001: Side Panel vs Popup](doc/ADR/001-sidepanel-vs-popup.md)
- [ADR-002: 双 Content Script 策略](doc/ADR/002-dual-content-script.md)
- [ADR-003: 双层存储架构](doc/ADR/003-dual-storage.md)
- [ADR-004: 风格迁移方案](doc/ADR/004-style-skill.md)
- [ADR-005: 会话隔离模型](doc/ADR/005-session-isolation.md)
- [ADR-006: Agent 设计理念](doc/ADR/006-agent-philosophy.md)
- [ADR-007: Tab 锁定机制](doc/ADR/007-tab-locking.md)

### 贡献指南

欢迎贡献代码、报告问题或提出建议！

**重要**：提交 Pull Request 前，请先签署 [贡献者许可协议 (CLA)](CONTRIBUTING.md)。这是为了支持项目的双重许可模式（开源 + 商业）。

**贡献流程**：
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request
6. 首次贡献需签署 CLA（机器人会自动引导）

**行为准则**：
- 遵循代码规范
- 编写必要的测试
- 更新相关文档
- 尊重所有贡献者

### 许可证

本项目采用 **Server Side Public License (SSPL)** 开源许可证。

#### 允许的使用方式

- 个人学习和研究
- 内部使用和部署
- 修改和分发源代码
- 部署为自己的服务（需开源完整服务端代码）

#### 禁止的使用方式

- 提供商业云服务
- 商业销售或分发
- 嵌入商业产品

#### 商业许可

如果要将 数字女娲 嵌入商业产品
- 提供商业 SaaS 服务
- 获得优先技术支持

请联系我们获取商业许可：
- Email: 2270364052@qq.com
- Website: https://github.com/zhushen12580/StyleSwift

详见 [LICENSE](LICENSE) 文件

### 致谢

- 感谢所有贡献者
- 感谢 [impeccable](https://github.com/pbakaus/impeccable) 项目，为样式生成质量提供了重要帮助
- 感谢 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 项目，本项目遵循了其 Agent 设计哲学
- 灵感来源于用户对个性化浏览体验的需求

### 赞助

特别感谢 **[PPIO](https://ppio.com/)** 为本项目提供了研发所需的大部分 AI Token 支持。

<div align="center">

[![PPIO](https://img.shields.io/badge/PPIO-Sponsor-blue.svg)](https://ppio.com/)

</div>

PPIO 是一个去中心化的存储与计算平台，致力于为开发者提供高效、安全、低成本的基础设施服务。

---

## English

### Introduction

数字女娲 (StyleSwift) is an AI Agent-powered Chrome extension. Unlike traditional template systems, it understands your natural language descriptions, analyzes page structure, autonomously plans styling strategies, and intelligently applies them to page elements. No coding required—just describe the effect you want, and the AI Agent handles the entire process from intent understanding to style execution.

**Core Capabilities**:
- **Natural Language Understanding**: Describe requirements in everyday language, Agent automatically parses intent and plans execution steps
- **Intelligent Page Analysis**: Automatically identifies page structure, element hierarchy, and existing styles—no manual selector targeting needed
- **Dynamic Style Generation**: Generates optimal CSS rules in real-time based on page characteristics and user intent
- **Visual Quality Assurance**: Automatically detects visual issues after style application (contrast, accessibility, style conflicts, etc.) and proactively identifies and fixes potential defects
- **Privacy-First Protection**: Only sends page structure code to AI, never sends page core content (text, images, etc.)—protecting user privacy data security
- **Adaptive Learning**: Remembers your style preferences and automatically applies similar design language on new pages
- **Conversational Refinement**: Like talking to a designer—continuously optimize until satisfied, with undo and rollback support

### Effect Preview

<div align="center">

Intelligent style generation demonstration:

![Preview 1](images/demo1.png) | ![Preview 2](images/demo2.png) | ![Preview 3](images/demo3.png)
:---:|:---:|:---:
**Old Newspaper Style** | **The Matrix Style** | **One-Click Style Transfer**

Simply describe your design intent, and 数字女娲 understands and intelligently applies styles.

</div>

### Key Features

| Feature | Description |
|---------|-------------|
| **AI-Powered** | Based on LLM, understands natural language commands |
| **Element Picker** | Click to select page elements for precise targeting |
| **Image Upload** | Upload reference images for AI to analyze visual style |
| **Style Skills** | Save successful styles for cross-site reuse |
| **Multilingual** | Supports Chinese and English interfaces |
| **Session Management** | Isolated by domain, supports multiple session history |
| **Privacy First** | Only sends page structure to AI, never page content; API Key stored locally, no data uploaded |
| **Zero Config** | Install and use, no backend service needed |

### Quick Start

#### Installation

1. **Install from Source**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/StyleSwift.git
   cd StyleSwift
   ```

2. **Load Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in top right
   - Click "Load unpacked"
   - Select the `extension` folder

#### Configuration

1. First launch shows onboarding page
2. Enter your API Key (supports OpenAI and Anthropic API format)
3. Optional: Configure custom API endpoint and model

#### Usage

1. **Open Sidebar**: Click the extension icon in browser toolbar
2. **Enter Command**: Describe your desired style in the input box
   - Example: "Give this page a dark mode"
   - Example: "Make the title font larger"
   - Example: "Hide this ad element" (click element picker first)
3. **Upload Image**: Click image button to upload reference images
4. **View Results**: Styles are applied immediately
5. **Confirm or Undo**: Click confirm if satisfied, or undo to revert

### Style Skills

**Save Style**:
```
User: "Save this style as 'Cyberpunk'"
AI extracts current visual features and saves them
```

**Apply Style**:
```
User: "Apply my 'Cyberpunk' style"
AI automatically adapts it to current website
```

### Architecture Overview

```
Chrome Extension (Manifest V3)
│
├── Side Panel                    # UI + Agent runtime
│   ├── Session Management
│   ├── Agent Loop
│   └── LLM API Calls
│
├── Service Worker                # Extension lifecycle
│
├── Content Script × 2
│   ├── early-inject.js           # Style pre-injection (document_start)
│   └── content.js                # DOM operations (document_idle)
│
└── Storage
    ├── chrome.storage.local      # Lightweight data (settings, session index)
    └── IndexedDB                 # Conversation history
```

**Core Design Philosophy**:
- **Model as Agent**: Code provides capabilities, model makes decisions
- **Atomic Capabilities**: Each tool does one thing only
- **Context Efficiency**: Layered management, fetch on demand
- **Session Isolation**: Split by domain, support multiple sessions

### Core Functions

| Function | Description | Documentation |
|----------|-------------|---------------|
| Page Structure | Get DOM tree as text | [View](doc/features/get-page-structure.md) |
| Element Search | Search by selector or keyword | [View](doc/features/grep.md) |
| Apply Styles | Inject CSS with rollback support | [View](doc/features/apply-styles.md) |
| Edit Styles | Precise modification of applied CSS | [View](doc/features/edit-css.md) |
| User Profile | Store user preferences | [View](doc/features/user-profile.md) |
| Style Transfer | Cross-site style application | [View](doc/features/style-skill.md) |

### Project Structure

```
StyleSwift/
├── extension/                 # Extension source code
│   ├── sidepanel/            # Sidebar UI and logic
│   │   ├── panel.js          # Main panel logic
│   │   ├── agent-loop.js     # Agent loop
│   │   ├── api.js            # API calls
│   │   ├── tools.js          # Tool definitions
│   │   ├── session.js        # Session management
│   │   └── style-skill.js    # Style skill management
│   ├── content/              # Content scripts
│   │   ├── early-inject.js   # Early style injection
│   │   └── content.js        # DOM operations
│   ├── background/           # Background service
│   │   └── service-worker.js # Service Worker
│   ├── _locales/             # Internationalization
│   │   ├── en/               # English
│   │   └── zh_CN/            # Chinese
│   ├── icons/                # Icon resources
│   ├── skills/               # Static skill library
│   └── manifest.json         # Extension config
├── doc/                      # Documentation
│   ├── ARCHITECTURE.md       # Architecture docs
│   ├── ui-design.md          # UI design docs
│   ├── ADR/                  # Architecture Decision Records
│   └── features/             # Feature docs
└── tests/                    # Test files
```

### Tech Stack

- **Manifest V3**: Latest Chrome extension standard
- **Side Panel API**: Modern extension UI
- **JavaScript**: Vanilla JS, no framework dependencies
- **Chrome Storage API**: Data persistence
- **IndexedDB**: Large-scale data storage
- **OpenAI/Anthropic API**: LLM interface

### Development Guide

#### Local Development

```bash
# Install dependencies (if needed)
npm install

# Run tests
npm test

# Lint code
npm run lint
```

#### Architecture Decisions

This project uses ADR (Architecture Decision Records) to document important design decisions:

- [ADR-001: Side Panel vs Popup](doc/ADR/001-sidepanel-vs-popup.md)
- [ADR-002: Dual Content Script Strategy](doc/ADR/002-dual-content-script.md)
- [ADR-003: Dual Storage Architecture](doc/ADR/003-dual-storage.md)
- [ADR-004: Style Transfer Solution](doc/ADR/004-style-skill.md)
- [ADR-005: Session Isolation Model](doc/ADR/005-session-isolation.md)
- [ADR-006: Agent Design Philosophy](doc/ADR/006-agent-philosophy.md)
- [ADR-007: Tab Locking Mechanism](doc/ADR/007-tab-locking.md)

### Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

**Important**: Before submitting a Pull Request, please sign the [Contributor License Agreement (CLA)](CONTRIBUTING.md). This is required to support the project's dual licensing model (open source + commercial).

**Contribution Process**:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request
6. First-time contributors need to sign the CLA (bot will guide you)

**Code of Conduct**:
- Follow code standards
- Write necessary tests
- Update relevant documentation
- Respect all contributors

### License

This project is licensed under the **Server Side Public License (SSPL)**.

#### Permitted Uses

- Personal learning and research
- Internal use and deployment
- Modifying and distributing source code
- Self-hosting as a service (with full server-side source code disclosure)

#### Prohibited Uses

- Offering commercial cloud services
- Commercial sales or distribution
- Embedding in commercial products

#### Commercial Licensing

For commercial use, please contact us:
- Email: 2270364052@qq.com
- Website: https://github.com/zhushen12580/StyleSwift

Commercial licenses are available for:
- Embedding 数字女娲 (StyleSwift) in commercial products
- Offering 数字女娲 (StyleSwift) as a commercial SaaS service
- Proprietary modifications and distributions

See [LICENSE](LICENSE) file for full details.

### Acknowledgments

- Thanks to all contributors
- Thanks to [impeccable](https://github.com/pbakaus/impeccable) project for significantly improving style generation quality
- Thanks to [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) project—this project follows its Agent design philosophy
- Inspired by users' need for personalized browsing experience

### Sponsorship

Special thanks to **[PPIO](https://ppio.com/)** for providing most of the AI tokens used in this project's development.

<div align="center">

[![PPIO](https://img.shields.io/badge/PPIO-Sponsor-blue.svg)](https://ppio.com/)

</div>

PPIO is a decentralized storage and computing platform dedicated to providing developers with efficient, secure, and cost-effective infrastructure services.

---

<div align="center">

**[Back to Top](#数字女娲-styleswift)**

Made by 数字女娲 Team

</div>