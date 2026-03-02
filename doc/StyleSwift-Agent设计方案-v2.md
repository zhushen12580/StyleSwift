# StyleSwift Agent 设计方案

> 版本：v2.0
> 日期：2026-03-01
> 设计理念：基于 agent-builder 哲学，让模型成为智能体，代码只是提供能力

---

## 一、核心定位

```
Purpose: 让用户用一句话个性化任意网页的视觉样式
Domain: 网页样式设计 + 浏览器交互
Trust: 让模型自主决定改什么、怎么改、改到什么程度
```

**核心场景：**
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格化表达：赛博朋克、复古、现代感

---

## 二、架构总览

```
StyleSwift Agent (主智能体)
│
├── Tools (原子能力)
│   ├── get_page_structure()    # 读取DOM，返回结构摘要
│   ├── pick_element()          # 激活元素选择模式
│   ├── apply_styles()          # 注入CSS到页面
│   └── save_preference()       # 存储用户偏好
│
├── Subagents (子智能体)
│   └── StyleGenerator Agent    # 样式生成专家
│       ├── 意图推理
│       ├── CSS生成
│       └── 自我验证
│
├── Skills (领域知识)
│   ├── design-principles       # 设计原则
│   ├── color-theory            # 配色理论
│   ├── css-selectors-guide     # CSS选择器最佳实践
│   ├── accessibility-rules     # 无障碍设计规则
│   └── style-templates/        # 预设风格模板
│       ├── dark-mode
│       ├── minimal
│       ├── focus-reader
│       └── cyberpunk
│
├── TodoWrite (任务追踪)
│   └── 多步骤任务的进度管理
│
└── Context (上下文)
    ├── 当前页面状态
    ├── 对话历史
    ├── 生效中的样式
    └── 用户偏好
```

---

## 三、Tools（原子能力）

### 3.1 get_page_structure

```python
def get_page_structure():
    """
    获取当前页面的结构信息
    返回简化的结构摘要（不返回完整DOM，避免context污染）
    """
    return {
        "url": "https://example.com",
        "title": "页面标题",
        "type": "news|blog|ecommerce|social|...",
        "semantic_zones": ["header", "nav", "main", "sidebar", "footer"],
        "key_elements": [
            {
                "selector": ".header",
                "type": "header",
                "visibility": "high",
                "current_styles": {"bg": "#fff", "color": "#333"}
            },
            ...
        ],
        "theme_hints": {
            "bg_color": "#ffffff",
            "text_color": "#333333",
            "font_family": "sans-serif",
            "is_dark": False
        }
    }
```

### 3.2 pick_element

```python
def pick_element(prompt: str = "请点击要调整的元素"):
    """
    激活页面元素选择模式
    用户点击后返回选中元素的详细信息
    """
    return {
        "selector": "#main-content > .article > h1.title",
        "tag": "h1",
        "type": "heading",
        "parent_context": "位于文章区域内，是主标题",
        "current_styles": {
            "font-size": "24px",
            "color": "#333",
            "font-weight": "bold"
        },
        "computed_styles": {...}
    }
```

### 3.3 apply_styles

```python
def apply_styles(css: str, mode: str = "preview"):
    """
    应用样式到页面

    mode:
    - preview: 预览模式，可回滚
    - apply: 正式应用
    - rollback: 回滚到上一状态
    """
    return {
        "status": "success",
        "elements_changed": 42,
        "preview_id": "prev_001"
    }
```

### 3.4 save_preference

```python
def save_preference(config: dict):
    """
    保存用户偏好到Chrome Storage

    config:
    - url_pattern: URL匹配规则（支持通配符）
    - styles: 样式配置
    - auto_apply: 是否自动应用
    """
    return {
        "status": "saved",
        "id": "pref_001",
        "url_pattern": "https://example.com/*"
    }
```

---

## 四、Subagents（子智能体）

### 4.1 StyleGenerator Agent

**为什么需要子智能体？**

样式生成是一个复杂的推理过程：
- 意图理解：用户说的"刺眼"具体指什么？
- 范围决策：改哪些元素？
- 代码生成：生成CSS
- 自我验证：语法检查、选择器检查

这个过程会产生大量中间推理，如果放在主Agent会污染context。

**设计：**

```python
class StyleGeneratorAgent:
    """
    样式生成子智能体
    独立运行，隔离复杂推理过程
    """

    def run(self, intent: str, page_structure: dict, target=None):
        """
        输入:
        - intent: 用户意图描述
        - page_structure: 页面结构信息
        - target: 目标范围（None=全局，或特定选择器）

        输出:
        - css: 生成的CSS代码
        - affected_selectors: 影响的选择器列表
        - confidence: 置信度
        - suggestions: 后续建议
        """
        pass
```

**内部工作流：**

```
StyleGenerator Agent 内部:

1. 意图推理
   "太刺眼了" → 背景亮度过高 → 深色模式

2. 范围决策
   全局改动：body, .header, .content, .footer
   保留：图片、视频（避免颜色失真）

3. CSS生成
   生成CSS代码，考虑：
   - 选择器特异性
   - !important策略
   - 兼容性

4. 自我验证
   - 语法检查
   - 选择器有效性检查
   - 与现有样式的冲突检测

5. 输出结果
```

---

## 五、Skills（领域知识）

Skills 是按需加载的知识模块，不一次性塞进context：

### 5.1 知识库结构

```
knowledge/
├── design-principles.md      # 设计原则
│   ├── 对比度原则
│   ├── 视觉层级
│   ├── 留白原则
│   └── 一致性原则
│
├── color-theory.md           # 配色理论
│   ├── 色彩心理学
│   ├── 配色方案类型
│   └── 对比度计算
│
├── css-selectors-guide.md    # CSS选择器最佳实践
│   ├── 选择器优先级
│   ├── 稳定选择器策略
│   └── 动态class处理
│
├── accessibility-rules.md    # 无障碍设计规则
│   ├── WCAG标准
│   ├── 对比度要求
│   └── 字体大小建议
│
└── style-templates/          # 预设风格模板
    ├── dark-mode.md          # 深色模式模板
    ├── minimal.md            # 极简风格模板
    ├── focus-reader.md       # 阅读模式模板
    └── cyberpunk.md          # 赛博朋克模板
```

### 5.2 加载策略

```python
# 根据用户意图动态加载相关知识
def load_relevant_skills(intent: str):
    skills = []

    if "深色" in intent or "暗" in intent or "刺眼" in intent:
        skills.append("style-templates/dark-mode")

    if "看不清" in intent or "字体" in intent:
        skills.append("accessibility-rules")

    if "颜色" in intent or "配色" in intent:
        skills.append("color-theory")

    # 默认加载设计原则
    skills.append("design-principles")

    return skills
```

---

## 六、TodoWrite（任务追踪）

### 6.1 为什么需要TodoWrite

用户的请求往往是多步骤的：

```
用户: "太刺眼了，导航栏保持白色，按钮加个圆角"

实际任务:
1. 理解意图 → 深色模式需求
2. 生成深色模式样式
3. 应用并预览
4. 调整导航栏（保持白色）
5. 给按钮添加圆角
6. 保存偏好
7. 确认用户满意
```

### 6.2 TodoWrite 结构

```python
class TodoWrite:
    """
    任务追踪系统
    """

    def create(self, tasks: list):
        """
        创建任务列表
        """
        return {
            "session_id": "sess_001",
            "tasks": [
                {"id": 1, "desc": "理解用户意图", "status": "completed"},
                {"id": 2, "desc": "生成深色模式样式", "status": "in_progress"},
                {"id": 3, "desc": "应用并预览", "status": "pending"},
                {"id": 4, "desc": "调整导航栏", "status": "pending"},
                {"id": 5, "desc": "添加按钮圆角", "status": "pending"},
                {"id": 6, "desc": "保存偏好", "status": "pending"}
            ]
        }

    def update(self, task_id: int, status: str):
        """更新任务状态"""
        pass

    def get_progress(self):
        """获取当前进度"""
        return {
            "completed": 1,
            "total": 6,
            "current": "生成深色模式样式"
        }
```

### 6.3 用户可见的进度

```
┌─────────────────────────────┐
│  正在处理您的请求...         │
│                             │
│  ✓ 理解用户意图             │
│  ◉ 生成深色模式样式         │
│  ○ 应用并预览               │
│  ○ 调整导航栏               │
│  ○ 添加按钮圆角             │
│  ○ 保存偏好                 │
│                             │
│  进度: 1/6                  │
└─────────────────────────────┘
```

---

## 七、Context（上下文管理）

### 7.1 上下文结构

```python
context = {
    # 1. 当前页面状态（精简）
    "page": {
        "url": "https://example.com",
        "type": "news",
        "zones": ["header", "nav", "main", "footer"],
        "title": "页面标题"
    },

    # 2. 对话历史
    "conversation": [
        {
            "role": "user",
            "content": "太刺眼了"
        },
        {
            "role": "agent",
            "action": "applied dark mode",
            "result": "success"
        },
        {
            "role": "user",
            "content": "导航栏保持白色"
        }
    ],

    # 3. 当前生效的样式
    "active_styles": {
        "base": "dark-mode-v1",
        "overrides": [
            {"selector": ".nav", "style": "light-bg"}
        ],
        "css": "body { ... }"
    },

    # 4. 用户偏好（长期记忆）
    "user_preferences": {
        "global": {
            "likes": ["dark_mode", "large_text"],
            "dislikes": ["animations", "auto_play"]
        },
        "site_specific": {
            "example.com": {
                "nav_style": "light"
            }
        }
    },

    # 5. 当前任务进度
    "todo": {
        "completed": 2,
        "total": 5,
        "current_task": "调整导航栏"
    }
}
```

### 7.2 Context 保护策略

```
原则：Context 是珍贵的资源，避免污染

策略:
1. DOM 结构只保留摘要，不保留完整HTML
2. 子智能体的中间推理不进入主context
3. 长对话定期压缩历史
4. 用户偏好单独存储，按需加载
```

---

## 八、Agent Loop（核心循环）

```python
def style_agent_loop():
    """
    主智能体循环
    """
    while True:
        # 1. 构建当前上下文
        context = build_context()

        # 2. 准备可用能力
        tools = [get_page_structure, pick_element, apply_styles, save_preference]
        subagents = [StyleGeneratorAgent]
        skills = load_relevant_skills(user_input)

        # 3. 模型决策
        response = model.reason(
            context=context,
            tools=tools,
            subagents=subagents,
            skills=skills,
            todo=current_todo
        )

        # 4. 执行动作
        if response.action == "tool_call":
            result = execute_tool(response.tool, response.args)
            add_to_context(result)
            update_todo_progress()
            continue

        elif response.action == "subagent_call":
            result = execute_subagent(response.subagent, response.args)
            add_to_context(result.summary)  # 只添加摘要，不添加中间过程
            update_todo_progress()
            continue

        elif response.action == "respond":
            return response.message
```

---

## 九、与Chrome插件的集成

### 9.1 架构图

```
┌─────────────────────────────────────────────────────┐
│                   Chrome Extension                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  UI Layer                      Content Script       │
│  ┌─────────────────┐          ┌─────────────────┐  │
│  │ 对话界面         │          │ DOM读取         │  │
│  │ - 输入框         │          │ 元素高亮        │  │
│  │ - 对话历史       │◄────────►│ 样式注入        │  │
│  │ - 进度显示       │          │ 事件监听        │  │
│  │ - 预览控制       │          │ 元素选择        │  │
│  └─────────────────┘          └─────────────────┘  │
│         │                              │           │
│         └──────────────┬───────────────┘           │
│                        │                           │
│                        ▼                           │
│              ┌─────────────────┐                   │
│              │  Background     │                   │
│              │  ┌───────────┐  │                   │
│              │  │Agent Runtime│ │                   │
│              │  │- 主循环    │  │                   │
│              │  │- 状态管理  │  │                   │
│              │  │- 存储管理  │  │                   │
│              │  └───────────┘  │                   │
│              └─────────────────┘                   │
│                        │                           │
└────────────────────────┼───────────────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │   LLM Backend   │
              │  (Claude API)   │
              └─────────────────┘
```

### 9.2 消息协议

```javascript
// 用户输入 → Agent
{
  type: "USER_INPUT",
  payload: {
    text: "太刺眼了",
    context: {
      url: "https://example.com",
      selectedElement: null
    }
  }
}

// Agent → Content Script (获取结构)
{
  type: "GET_PAGE_STRUCTURE",
  requestId: "req_001"
}

// Content Script → Agent (返回结构)
{
  type: "PAGE_STRUCTURE_RESPONSE",
  requestId: "req_001",
  payload: { ... }
}

// Agent → Content Script (应用样式)
{
  type: "APPLY_STYLES",
  payload: {
    css: "body { background: #1a1a1a; }",
    mode: "preview"
  }
}

// Agent → UI (更新进度)
{
  type: "UPDATE_PROGRESS",
  payload: {
    todo: [...],
    current: "生成深色模式样式"
  }
}
```

---

## 十、交互流程示例

### 示例1：全局换皮

```
用户: "太刺眼了"

Agent:
├── [TodoWrite] 创建任务: 意图理解 → 生成样式 → 应用预览 → 保存
├── [TodoWrite] 更新: 意图理解 → completed
├── 调用 get_page_structure()
├── [TodoWrite] 更新: 生成样式 → in_progress
├── 调用 StyleGenerator(intent="太刺眼了", page=...)
│   └── Subagent内部推理: "刺眼"→深色模式→生成CSS
├── 调用 apply_styles(css, mode="preview")
├── [TodoWrite] 更新: 应用预览 → completed
├── 响应: "已为您切换到深色模式，看看效果？"
└── [TodoWrite] 等待用户确认

用户: "可以，导航栏保持白色"

Agent:
├── [TodoWrite] 新增任务: 调整导航栏
├── 调用 StyleGenerator(intent="导航栏白色", target=".nav")
├── 调用 apply_styles(css, mode="apply")
├── 调用 save_preference()
├── [TodoWrite] 全部完成
└── 响应: "已调整，导航栏保持白色。下次打开会自动应用。"
```

### 示例2：局部调整

```
用户: [点击按钮] "这个按钮太小了"

Agent:
├── 接收 pick_element 结果
├── 调用 StyleGenerator(intent="按钮变大", target="#submit-btn")
├── 调用 apply_styles(css, mode="preview")
└── 响应: "已放大按钮，看看效果？"
```

---

## 十一、设计原则总结

遵循 agent-builder 哲学：

| 原则 | 应用 |
|------|------|
| **模型即智能体** | 代码只提供能力，让模型自主决策 |
| **能力原子化** | Tools 只做原子操作，不包含推理 |
| **推理隔离** | 复杂推理放入 Subagent，保护主context |
| **知识按需加载** | Skills 动态加载，不前置塞入 |
| **任务可追踪** | TodoWrite 让多步骤任务可控 |
| **从简开始** | 先实现核心能力，按需扩展 |

---

## 十二、项目结构

```
StyleSwift/
├── agent/                          # Agent 核心代码
│   ├── core/
│   │   └── style_agent.py         # 主智能体实现
│   ├── subagents/
│   │   └── style_generator.py     # 样式生成子智能体
│   └── skills/
│       ├── design-principles.md
│       ├── color-theory.md
│       └── style-templates/
│           ├── dark-mode.md
│           └── minimal.md
│
├── extension/                      # Chrome 插件
│   ├── manifest.json
│   ├── background/
│   │   └── agent_bridge.js        # Agent 与插件的桥接
│   ├── content/
│   │   ├── protocol.js            # 消息协议
│   │   ├── structure_extractor.js # 页面结构提取
│   │   ├── style_injector.js      # 样式注入
│   │   └── element_picker.js      # 元素选择器
│   └── popup/
│       ├── popup.html
│       └── popup.js
│
├── doc/                           # 文档
│   └── StyleSwift-Agent设计方案-v2.md
│
└── tests/                         # 测试
    └── agent_test.py
```

---

## 十三、实现进度

### 已完成
- [x] Agent 核心框架 (`agent/core/style_agent.py`)
- [x] Chrome 插件消息协议 (`extension/content/protocol.js`)
  - PageStructureExtractor: 页面结构提取
  - StyleInjector: 样式注入
  - ElementPicker: 元素选择

### 进行中
- [ ] StyleGenerator 子智能体完整实现
- [ ] Skills 知识库内容
- [ ] Background script 与 Agent 的通信桥接

### 待开始
- [ ] Chrome 插件 UI 界面
- [ ] 用户偏好存储
- [ ] 集成测试

---

## 十四、下一步行动

1. **完善 StyleGenerator 子智能体** - 添加完整的意图推理和CSS生成逻辑
2. **实现 Skills 知识库** - 编写设计原则、配色理论等知识文件
3. **实现 Background bridge** - 连接 Agent 和 Chrome 插件
4. **开发插件 UI** - 对话界面、进度显示
5. **集成测试** - 端到端测试完整流程