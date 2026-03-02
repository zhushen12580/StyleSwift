# StyleSwift Agent 设计方案

> 版本：v3.1
> 日期：2026-03-02
> 设计理念：基于 agent-builder 哲学 - The model IS the agent, code just provides capabilities

---

## 一、核心定位

```
Purpose: 让用户用一句话个性化任意网页的视觉样式
Domain: 网页样式设计 + 浏览器交互
Trust: 模型自己决定改什么、怎么改、改到什么程度
```

**核心场景：**
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格化表达：赛博朋克、复古、现代感

---

## 二、架构总览

```
StyleSwift Agent
│
├── Tools (原子能力) - 全部是动作，不做推理
│   ├── get_page_structure()    # 返回页面整体结构概览
│   ├── grep()                  # 查询指定选择器详细信息
│   ├── apply_styles()          # 纯注入
│   ├── save_preference()       # 纯存储
│   └── load_skill()            # 按需加载知识
│
├── Task (子智能体) - 隔离上下文的推理
│   └── StyleGenerator          # 样式生成
│
└── TodoWrite (可选)            # 模型决定是否使用
```

**关键原则：**
- Tools 只做原子操作，不包含任何推理逻辑
- 模型主动查询信息（grep），而非强制用户交互（pick_element）
- 知识通过 `load_skill` 工具按需加载，模型自己决定
- Subagent 只给任务描述，不预设内部工作流
- Context 保持最小，用户偏好通过工具获取

---

## 三、Tools（原子能力）

### 设计原则

```
每个 Tool 必须：
1. 原子性 - 做一件事，不做推理
2. 清晰描述 - 模型知道它能做什么
3. 简单输出 - 返回事实，不返回判断
```

### 3.1 get_page_structure

```python
GET_PAGE_STRUCTURE_TOOL = {
    "name": "get_page_structure",
    "description": "获取当前页面的原始结构信息。返回URL、标题、主要元素选择器、当前主题提示。",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

def run_get_page_structure() -> str:
    """
    返回原始结构，不做判断。

    注意：不返回页面类型判断！让模型自己推理。
    """
    return json.dumps({
        "url": "https://example.com",
        "title": "页面标题",
        "headings": ["h1 文本", "h2 文本", ...],  # 原始数据
        "main_selectors": ["article", ".content", "#main"],
        "nav_selectors": ["nav", ".navbar"],
        "sidebar_selectors": ["aside", ".sidebar"],
        "theme_hints": {
            "bg_color": "#ffffff",
            "text_color": "#333333",
            "is_dark": False
        }
    })
```

### 3.2 grep

```python
GREP_TOOL = {
    "name": "grep",
    "description": "获取指定CSS选择器的详细信息。返回元素的HTML结构、当前样式、文本内容等。",
    "input_schema": {
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS选择器，如 'nav', '.content', '#main', 'article h1'"
            }
        },
        "required": ["selector"]
    }
}

def run_grep(selector: str) -> str:
    """
    模型主动查询选择器信息，而非强制用户交互。

    这符合 agent-builder 哲学：模型自己决定需要什么信息。
    """
    # 由 Chrome 插件处理，返回结果
    return json.dumps({
        "selector": selector,
        "found": True,
        "count": 1,
        "elements": [{
            "tag": "nav",
            "classes": ["navbar", "navbar-default"],
            "text_preview": "首页 产品 关于...",
            "styles": {
                "background-color": "#ffffff",
                "height": "60px",
                "position": "fixed"
            },
            "children": ["a", "button", "ul"]
        }]
    })
```

### 3.3 apply_styles

```python
APPLY_STYLES_TOOL = {
    "name": "apply_styles",
    "description": "应用CSS样式到页面。preview模式可回滚，apply模式正式生效。",
    "input_schema": {
        "type": "object",
        "properties": {
            "css": {"type": "string", "description": "CSS代码"},
            "mode": {
                "type": "string",
                "enum": ["preview", "apply", "rollback"],
                "description": "preview=预览, apply=正式, rollback=回滚"
            }
        },
        "required": ["css", "mode"]
    }
}

def run_apply_styles(css: str, mode: str) -> str:
    """纯注入，不验证CSS正确性（由模型负责）。"""
    # 注入到页面
    return f"已{mode}样式"
```

### 3.4 save_preference

```python
SAVE_PREFERENCE_TOOL = {
    "name": "save_preference",
    "description": "保存样式偏好，下次访问自动应用。",
    "input_schema": {
        "type": "object",
        "properties": {
            "url_pattern": {"type": "string", "description": "URL匹配模式"},
            "css": {"type": "string", "description": "CSS代码"}
        },
        "required": ["url_pattern", "css"]
    }
}

def run_save_preference(url_pattern: str, css: str) -> str:
    """纯存储。"""
    # 存储到 Chrome Storage
    return f"已保存，访问 {url_pattern} 时自动应用"
```

### 3.5 load_skill（关键！）

```python
LOAD_SKILL_TOOL = {
    "name": "load_skill",
    "description": """加载领域知识。

可用的知识：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

当你需要专业知识时加载。""",
    "input_schema": {
        "type": "object",
        "properties": {
            "skill_name": {
                "type": "string",
                "description": "知识名称"
            }
        },
        "required": ["skill_name"]
    }
}

def run_load_skill(skill_name: str) -> str:
    """
    模型自己决定何时加载什么知识。
    不是代码预判，而是模型按需请求。
    """
    skills = {
        "dark-mode-template": SKILLS_DIR / "style-templates/dark-mode.md",
        "minimal-template": SKILLS_DIR / "style-templates/minimal.md",
        "design-principles": SKILLS_DIR / "design-principles.md",
        "color-theory": SKILLS_DIR / "color-theory.md",
        "css-selectors": SKILLS_DIR / "css-selectors-guide.md",
    }

    if skill_name not in skills:
        return f"未知知识: {skill_name}。可用: {list(skills.keys())}"

    return skills[skill_name].read_text()
```

---

## 四、Task（子智能体）

### 设计原则

```
Subagent 设计原则：
1. 隔离上下文 - 子智能体看不到父对话历史
2. 只给任务描述 - 不预设内部工作流
3. 返回摘要 - 父智能体只看到最终结果
```

### 4.1 Agent Types 注册表

```python
AGENT_TYPES = {
    "StyleGenerator": {
        "description": "样式生成专家。根据用户意图和页面结构生成CSS代码。",
        "tools": ["get_page_structure", "grep", "load_skill"],  # 可以获取页面信息、查询元素、加载知识
        "prompt": """你是样式生成专家。

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
- 只返回最终结果，不要返回中间过程""",
    },
}
```

### 4.2 Task Tool 定义

```python
TASK_TOOL = {
    "name": "Task",
    "description": f"""调用子智能体处理复杂任务。

子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- StyleGenerator: 样式生成专家

使用场景：
- 需要复杂推理的任务
- 需要多次工具调用的任务
- 可能产生大量中间输出的任务""",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "任务简短描述（3-5字）"
            },
            "prompt": {
                "type": "string",
                "description": "详细的任务指令"
            },
            "agent_type": {
                "type": "string",
                "enum": ["StyleGenerator"],
                "description": "子智能体类型"
            }
        },
        "required": ["description", "prompt", "agent_type"]
    }
}
```

### 4.3 Subagent 执行

```python
def run_task(description: str, prompt: str, agent_type: str,
             client, model: str, base_tools: list, execute_tool) -> str:
    """
    执行子智能体任务。

    关键：
    1. ISOLATED HISTORY - 子智能体从零开始，看不到父对话
    2. FILTERED TOOLS - 根据类型限制工具
    3. 返回摘要 - 父智能体只看到最终结果
    """
    config = AGENT_TYPES[agent_type]

    # 子智能体的系统提示
    sub_system = f"""{config["prompt"]}

完成任务后返回清晰、简洁的摘要。"""

    # 过滤工具
    allowed = config["tools"]
    if allowed == "*":
        sub_tools = base_tools
    else:
        sub_tools = [t for t in base_tools if t["name"] in allowed]

    # 关键：隔离的消息历史！
    sub_messages = [{"role": "user", "content": prompt}]

    # 运行子智能体循环
    while True:
        response = client.messages.create(
            model=model,
            system=sub_system,
            messages=sub_messages,
            tools=sub_tools,
            max_tokens=8000,
        )

        if response.stop_reason != "tool_use":
            break

        # 执行工具
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = execute_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output
                })

        sub_messages.append({"role": "assistant", "content": response.content})
        sub_messages.append({"role": "user", "content": results})

    # 只返回最终文本
    for block in response.content:
        if hasattr(block, "text"):
            return block.text

    return "(子智能体无输出)"
```

---

## 五、TodoWrite（可选）

### 设计原则

```
TodoWrite 使用原则：
1. 模型自己决定是否使用，不强制
2. 简单任务不需要用
3. 复杂多分支任务才需要
4. 只追踪需要执行的动作，不追踪"理解意图"
```

### 5.1 Tool 定义

```python
TODO_WRITE_TOOL = {
    "name": "TodoWrite",
    "description": "更新任务列表。用于规划和追踪复杂任务的进度。简单任务不需要使用。",
    "input_schema": {
        "type": "object",
        "properties": {
            "todos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "任务描述"},
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                        "activeForm": {"type": "string", "description": "进行时形式"}
                    },
                    "required": ["content", "status", "activeForm"]
                }
            }
        },
        "required": ["todos"]
    }
}
```

---

## 六、Context（上下文管理）

### 6.1 精简的上下文

```python
# 正确设计：只保留当前状态
context = {
    "page": {
        "url": "https://example.com",
        "title": "页面标题"
    },
    "active_styles": "body { background: #1a1a1a; }"
}

# 错误设计：包含用户偏好
# context = {
#     "user_preferences": {...}  # ❌ 不应该常驻 context
# }
```

### 6.2 Context 保护策略

```
原则：Context 是珍贵的资源

策略：
1. Tools 返回精简结果
2. Subagent 中间推理不进入主 context
3. 用户偏好通过工具按需获取，不常驻
4. Skills 通过工具按需加载，不前置塞入
```

---

## 七、Agent Loop（核心循环）

```python
#!/usr/bin/env python3
"""
StyleSwift Agent - 基于 agent-builder 哲学的极简实现

核心：一个简单的循环 + 明确的能力
模型自己决定做什么，代码只提供手段
"""

from anthropic import Anthropic
import json

client = Anthropic()
MODEL = "claude-sonnet-4-20250514"

# 系统提示 - 保持简洁
SYSTEM = """你是 StyleSwift，网页样式个性化智能体。

任务：帮助用户用一句话个性化网页样式。

工作方式：
- 使用工具完成任务
- 优先行动，而非长篇解释
- 完成后简要总结

可用工具：get_page_structure, grep, apply_styles, save_preference, load_skill, Task, TodoWrite"""

# 工具定义
BASE_TOOLS = [
    GET_PAGE_STRUCTURE_TOOL,
    GREP_TOOL,
    APPLY_STYLES_TOOL,
    SAVE_PREFERENCE_TOOL,
    LOAD_SKILL_TOOL,
    TODO_WRITE_TOOL,
]

TOOLS = BASE_TOOLS + [TASK_TOOL]


def execute_tool(name: str, args: dict) -> str:
    """执行工具调用。"""
    if name == "get_page_structure":
        return run_get_page_structure()
    if name == "grep":
        return run_grep(args["selector"])
    if name == "apply_styles":
        return run_apply_styles(args["css"], args["mode"])
    if name == "save_preference":
        return run_save_preference(args["url_pattern"], args["css"])
    if name == "load_skill":
        return run_load_skill(args["skill_name"])
    if name == "TodoWrite":
        # 只更新状态，不做其他事
        return "任务列表已更新"
    if name == "Task":
        return run_task(
            description=args["description"],
            prompt=args["prompt"],
            agent_type=args["agent_type"],
            client=client,
            model=MODEL,
            base_tools=BASE_TOOLS,
            execute_tool=execute_tool
        )
    return f"未知工具: {name}"


def agent_loop(prompt: str, history: list) -> str:
    """主智能体循环 - 这就是 agent-builder 的核心。"""
    history.append({"role": "user", "content": prompt})

    while True:
        response = client.messages.create(
            model=MODEL,
            system=SYSTEM,
            messages=history,
            tools=TOOLS,
            max_tokens=8000,
        )

        history.append({"role": "assistant", "content": response.content})

        # 如果没有工具调用，返回文本
        if response.stop_reason != "tool_use":
            return "".join(b.text for b in response.content if hasattr(b, "text"))

        # 执行工具
        results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"> {block.name}: {json.dumps(block.input, ensure_ascii=False)[:100]}")
                output = execute_tool(block.name, block.input)
                print(f"  {output[:100]}...")
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output
                })

        history.append({"role": "user", "content": results})


if __name__ == "__main__":
    print("StyleSwift Agent")
    print("输入 'q' 退出\n")

    history = []
    while True:
        try:
            user_input = input(">> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if user_input in ("q", "quit", "exit", ""):
            break

        response = agent_loop(user_input, history)
        print(f"\n{response}\n")
```

---

## 八、交互流程示例

### 示例1：简单请求

```
用户: "太刺眼了"

Agent:
├── get_page_structure()
│   ← 返回页面原始结构
├── load_skill("dark-mode-template")
│   ← 加载深色模式知识
├── apply_styles(css, mode="preview")
│   ← 注入样式
└── 响应: "已切换深色模式，看看效果？"

（没有使用 TodoWrite，因为任务很简单）
```

### 示例2：复杂请求

```
用户: "把导航栏改成蓝色，文章区用大字体，侧边栏隐藏"

Agent:
├── TodoWrite([
│   {content: "修改导航栏颜色", status: "pending"},
│   {content: "放大文章区字体", status: "pending"},
│   {content: "隐藏侧边栏", status: "pending"}
│ ])
├── get_page_structure()
├── Task(StyleGenerator, "导航栏改成蓝色")
│   └── Subagent: 生成CSS → 返回摘要
├── apply_styles(css_nav, mode="preview")
├── TodoWrite([..., {content: "修改导航栏颜色", status: "completed"}, ...])
├── Task(StyleGenerator, "文章区用大字体")
│   └── Subagent: 生成CSS → 返回摘要
├── apply_styles(css_article, mode="preview")
├── ...
└── 响应: "已完成：导航栏蓝色、文章区放大、侧边栏隐藏"
```

---

## 九、与原设计的对比

| 方面 | v2.0（错误） | v3.0（正确） |
|------|-------------|-------------|
| Skills 加载 | 代码预判，`load_relevant_skills(intent)` | 模型请求，`load_skill` 工具 |
| get_page_structure | 返回页面类型判断 | 返回原始结构，模型自己判断 |
| 元素信息获取 | `pick_element` 强制用户交互 | `grep` 模型主动查询 |
| Subagent | 预设内部工作流 | 只给任务描述，自由发挥 |
| TodoWrite | 每一步都更新 | 模型决定是否使用 |
| Context | 包含用户偏好 | 精简，偏好通过工具获取 |
| "理解意图" | 作为显式任务 | 不是任务，是模型能力 |

---

## 十、项目结构

```
StyleSwift/
├── agent/
│   ├── style_agent.py           # 主智能体（~100行）
│   └── skills/
│       ├── design-principles.md
│       ├── color-theory.md
│       └── style-templates/
│           ├── dark-mode.md
│           └── minimal.md
│
├── extension/
│   ├── manifest.json
│   ├── background/
│   │   └── agent_bridge.js      # Agent 与插件桥接
│   └── content/
│       └── protocol.js          # 页面交互
│
└── doc/
    └── StyleSwift-Agent设计方案-v3.md
```

---

## 十一、设计原则总结

遵循 agent-builder 哲学：

| 原则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **模型即智能体** | 代码只提供能力 | 代码预判决策 |
| **能力原子化** | Tools 只做一件事 | Tools 包含推理 |
| **知识按需加载** | `load_skill` 工具 | 代码自动加载 |
| **推理隔离** | Subagent 隔离上下文 | 主循环处理复杂推理 |
| **信任模型** | 让模型自己决定 | 预设工作流 |
| **Context 珍贵** | 保持最小 | 塞入所有信息 |

> **The model already knows how to be an agent. Your job is to get out of the way.**
