#!/usr/bin/env python3
"""
StyleSwift Agent - 基于 agent-builder 哲学的极简实现

核心：一个简单的循环 + 明确的能力
模型自己决定做什么，代码只提供手段

参考：agent-builder/references/minimal-agent.py
"""

from anthropic import Anthropic
from pathlib import Path
import json
import os

# =============================================================================
# 配置
# =============================================================================

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = os.getenv("MODEL_NAME", "claude-sonnet-4-20250514")
SKILLS_DIR = Path(__file__).parent / "skills"

# =============================================================================
# 系统提示 - 保持简洁
# =============================================================================

SYSTEM = """你是 StyleSwift，网页样式个性化智能体。

任务：帮助用户用一句话个性化网页样式。

工作方式：
- 使用工具完成任务
- 优先行动，而非长篇解释
- 完成后简要总结

可用工具：
- get_page_structure: 获取页面原始结构
- pick_element: 选择页面元素
- apply_styles: 应用CSS样式
- save_preference: 保存样式偏好
- load_skill: 加载领域知识（深色模板、设计原则等）
- Task: 调用子智能体处理复杂任务
- TodoWrite: 追踪复杂任务进度（简单任务不需要）"""


# =============================================================================
# 工具定义 - 全部是原子操作，不做推理
# =============================================================================

GET_PAGE_STRUCTURE_TOOL = {
    "name": "get_page_structure",
    "description": "获取当前页面的原始结构信息。返回URL、标题、主要元素选择器、当前主题提示。",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

PICK_ELEMENT_TOOL = {
    "name": "pick_element",
    "description": "激活页面元素选择模式。用户点击后返回元素的原始信息。",
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "提示用户选择什么元素"
            }
        },
        "required": ["prompt"]
    }
}

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


# =============================================================================
# 子智能体类型注册表
# =============================================================================

AGENT_TYPES = {
    "StyleGenerator": {
        "description": "样式生成专家。根据用户意图和页面结构生成CSS代码。",
        "tools": ["get_page_structure", "load_skill"],  # 可以获取页面信息、加载知识
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
- 可以加载知识获得专业指导（如 dark-mode-template）
- 可以获取页面信息
- 只返回最终结果，不要返回中间过程""",
    },
}


def get_agent_descriptions() -> str:
    """生成 Task 工具描述中的子智能体列表。"""
    return "\n".join(
        f"- {name}: {cfg['description']}"
        for name, cfg in AGENT_TYPES.items()
    )


TASK_TOOL = {
    "name": "Task",
    "description": f"""调用子智能体处理复杂任务。

子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
{get_agent_descriptions()}

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
                "enum": list(AGENT_TYPES.keys()),
                "description": "子智能体类型"
            }
        },
        "required": ["description", "prompt", "agent_type"]
    }
}


# =============================================================================
# 工具列表
# =============================================================================

BASE_TOOLS = [
    GET_PAGE_STRUCTURE_TOOL,
    PICK_ELEMENT_TOOL,
    APPLY_STYLES_TOOL,
    SAVE_PREFERENCE_TOOL,
    LOAD_SKILL_TOOL,
    TODO_WRITE_TOOL,
]

TOOLS = BASE_TOOLS + [TASK_TOOL]


# =============================================================================
# 工具实现 - 全部是原子操作
# =============================================================================

def run_get_page_structure() -> str:
    """
    获取页面原始结构。

    注意：不返回页面类型判断！让模型自己推理。
    """
    # TODO: 通过 Chrome extension message 获取页面结构
    # 这里返回模拟数据
    return json.dumps({
        "url": "https://example.com",
        "title": "页面标题",
        "headings": ["主标题", "副标题"],
        "main_selectors": ["article", ".content", "#main"],
        "nav_selectors": ["nav", ".navbar"],
        "sidebar_selectors": ["aside", ".sidebar"],
        "button_selectors": ["button", ".btn", "[role='button']"],
        "theme_hints": {
            "bg_color": "#ffffff",
            "text_color": "#333333",
            "is_dark": False
        }
    }, ensure_ascii=False)


def run_pick_element(prompt: str) -> str:
    """
    激活元素选择模式。

    纯交互，返回选中元素的原始信息。
    """
    # TODO: 通过 Chrome extension 激活元素选择模式
    return f"已激活元素选择模式: {prompt}"


def run_apply_styles(css: str, mode: str) -> str:
    """
    应用CSS样式。

    纯注入，不验证CSS正确性（由模型负责）。
    """
    # TODO: 通过 Chrome extension 注入 CSS
    if mode == "preview":
        return f"已预览样式，等待确认"
    elif mode == "apply":
        return f"已应用样式"
    elif mode == "rollback":
        return f"已回滚样式"
    return f"未知模式: {mode}"


def run_save_preference(url_pattern: str, css: str) -> str:
    """
    保存样式偏好。

    纯存储。
    """
    # TODO: 保存到 Chrome Storage
    return f"已保存，访问 {url_pattern} 时自动应用"


def run_load_skill(skill_name: str) -> str:
    """
    加载领域知识。

    模型自己决定何时加载什么知识。
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

    skill_path = skills[skill_name]
    if not skill_path.exists():
        return f"知识文件不存在: {skill_path}"

    return skill_path.read_text(encoding="utf-8")


def get_tools_for_agent(agent_type: str) -> list:
    """
    根据子智能体类型过滤工具。

    子智能体不获得 Task 工具，防止无限递归。
    """
    allowed = AGENT_TYPES.get(agent_type, {}).get("tools", "*")

    if allowed == "*":
        return BASE_TOOLS

    return [t for t in BASE_TOOLS if t["name"] in allowed]


def run_task(description: str, prompt: str, agent_type: str) -> str:
    """
    执行子智能体任务。

    关键：
    1. ISOLATED HISTORY - 子智能体从零开始，看不到父对话
    2. FILTERED TOOLS - 根据类型限制工具
    3. 返回摘要 - 父智能体只看到最终结果
    """
    if agent_type not in AGENT_TYPES:
        return f"未知子智能体类型: {agent_type}"

    config = AGENT_TYPES[agent_type]

    # 子智能体的系统提示
    sub_system = f"""{config["prompt"]}

完成任务后返回清晰、简洁的摘要。"""

    # 过滤工具
    sub_tools = get_tools_for_agent(agent_type)

    # 关键：隔离的消息历史！
    sub_messages = [{"role": "user", "content": prompt}]

    print(f"  [{agent_type}] {description}")

    # 运行子智能体循环
    while True:
        response = client.messages.create(
            model=MODEL,
            system=sub_system,
            messages=sub_messages,
            tools=sub_tools,
            max_tokens=8000,
        )

        # 如果没有工具调用，返回文本
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


# =============================================================================
# 工具分发器
# =============================================================================

def execute_tool(name: str, args: dict) -> str:
    """
    分发工具调用到具体实现。
    """
    if name == "get_page_structure":
        return run_get_page_structure()

    if name == "pick_element":
        return run_pick_element(args["prompt"])

    if name == "apply_styles":
        return run_apply_styles(args["css"], args["mode"])

    if name == "save_preference":
        return run_save_preference(args["url_pattern"], args["css"])

    if name == "load_skill":
        return run_load_skill(args["skill_name"])

    if name == "TodoWrite":
        # 只更新状态，不做其他事
        # TODO: 可以存储到某个地方供 UI 读取
        return "任务列表已更新"

    if name == "Task":
        return run_task(
            description=args["description"],
            prompt=args["prompt"],
            agent_type=args["agent_type"]
        )

    return f"未知工具: {name}"


# =============================================================================
# 主循环 - agent-builder 的核心
# =============================================================================

def agent_loop(prompt: str, history: list) -> str:
    """
    主智能体循环。

    这就是 agent-builder 的核心：一个简单的循环
    - 模型看到对话历史 + 可用能力
    - 模型决定行动或回复
    - 如果行动：执行工具，添加结果，继续
    - 如果回复：返回给用户
    """
    history.append({"role": "user", "content": prompt})

    while True:
        response = client.messages.create(
            model=MODEL,
            system=SYSTEM,
            messages=history,
            tools=TOOLS,
            max_tokens=8000,
        )

        # 记录助手响应
        history.append({"role": "assistant", "content": response.content})

        # 如果没有工具调用，返回文本
        if response.stop_reason != "tool_use":
            return "".join(
                block.text for block in response.content
                if hasattr(block, "text")
            )

        # 执行工具调用
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"> {block.name}: {json.dumps(block.input, ensure_ascii=False)[:100]}")
                result = execute_tool(block.name, block.input)
                print(f"  {result[:100]}...")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        # 添加工具结果，继续循环
        history.append({"role": "user", "content": tool_results})


# =============================================================================
# 入口
# =============================================================================

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
