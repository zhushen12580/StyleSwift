#!/usr/bin/env python3
"""
StyleSwift Agent - 网页样式个性化智能体

核心理念：让用户用一句话个性化任意网页
技术实现：基于 agent-builder 模式，简单的循环 + 明确的能力
"""

from anthropic import Anthropic
from typing import Optional
import json

# =============================================================================
# 配置
# =============================================================================

client = Anthropic()  # 需要 ANTHROPIC_API_KEY 环境变量
MODEL = "claude-sonnet-4-20250514"

# =============================================================================
# 系统提示词
# =============================================================================

SYSTEM = """你是 StyleSwift，一个网页样式个性化智能体。

你的任务：帮助用户用一句话个性化任意网页的视觉样式。

工作方式：
1. 理解用户意图（"太刺眼" → 深色模式需求）
2. 获取页面结构信息
3. 生成并应用CSS样式
4. 确认用户满意

你可以使用的工具：
- get_page_structure: 获取当前页面的结构摘要
- pick_element: 让用户选择页面元素
- apply_styles: 应用CSS样式到页面
- save_preference: 保存用户的样式偏好
- TodoWrite: 追踪多步骤任务的进度
- Task: 调用子智能体处理复杂任务

原则：
- 优先行动，而不是长篇解释
- 复杂的样式生成交给 StyleGenerator 子智能体
- 记住用户偏好，下次自动应用
- 完成后简要总结你做了什么"""


# =============================================================================
# 工具定义
# =============================================================================

TOOLS = [
    # 1. 获取页面结构
    {
        "name": "get_page_structure",
        "description": "获取当前页面的结构信息。返回页面类型、语义区域、关键元素等摘要。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },

    # 2. 元素选择
    {
        "name": "pick_element",
        "description": "激活页面元素选择模式，让用户点击选择要调整的元素。",
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
    },

    # 3. 应用样式
    {
        "name": "apply_styles",
        "description": "应用CSS样式到页面。mode: preview(预览), apply(正式), rollback(回滚)",
        "input_schema": {
            "type": "object",
            "properties": {
                "css": {
                    "type": "string",
                    "description": "CSS代码"
                },
                "mode": {
                    "type": "string",
                    "enum": ["preview", "apply", "rollback"],
                    "description": "应用模式"
                },
                "description": {
                    "type": "string",
                    "description": "样式描述，用于用户理解"
                }
            },
            "required": ["css", "mode"]
        }
    },

    # 4. 保存偏好
    {
        "name": "save_preference",
        "description": "保存用户的样式偏好，下次访问自动应用。",
        "input_schema": {
            "type": "object",
            "properties": {
                "url_pattern": {
                    "type": "string",
                    "description": "URL匹配模式，支持通配符"
                },
                "styles": {
                    "type": "object",
                    "description": "样式配置"
                }
            },
            "required": ["url_pattern", "styles"]
        }
    },

    # 5. 任务追踪
    {
        "name": "TodoWrite",
        "description": "更新任务列表，追踪多步骤任务的进度。",
        "input_schema": {
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string"},
                            "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                            "activeForm": {"type": "string"}
                        },
                        "required": ["content", "status", "activeForm"]
                    }
                }
            },
            "required": ["todos"]
        }
    },

    # 6. 子智能体调用
    {
        "name": "Task",
        "description": """调用子智能体处理复杂任务。

可用的子智能体：
- StyleGenerator: 样式生成专家，根据用户意图生成CSS代码

子智能体在隔离的上下文中运行，不会污染主对话历史。""",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "任务简短描述（3-5个字）"
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
]


# =============================================================================
# 子智能体类型定义
# =============================================================================

AGENT_TYPES = {
    "StyleGenerator": {
        "description": "样式生成专家，根据用户意图和页面结构生成CSS代码",
        "tools": ["get_page_structure"],  # 可以获取页面信息
        "prompt": """你是样式生成专家。

任务：根据用户意图生成CSS代码

工作流程：
1. 分析用户意图的具体含义
2. 确定要修改的元素范围
3. 生成CSS代码
4. 验证代码正确性

输出格式：
{
    "css": "生成的CSS代码",
    "affected_selectors": ["受影响的选择器列表"],
    "description": "样式描述"
}

原则：
- 选择器要足够具体，避免误伤其他元素
- 使用 !important 确保样式生效
- 考虑颜色对比度和可访问性
- 保持样式的一致性"""
    }
}


# =============================================================================
# 上下文状态
# =============================================================================

class AgentContext:
    """智能体上下文状态"""

    def __init__(self):
        self.page_info: dict = {}  # 当前页面信息
        self.active_styles: dict = {}  # 当前生效的样式
        self.user_preferences: dict = {}  # 用户偏好
        self.todos: list = []  # 任务列表

    def to_summary(self) -> str:
        """生成上下文摘要，用于注入到系统提示"""
        parts = []

        if self.page_info:
            parts.append(f"当前页面: {self.page_info.get('url', 'unknown')}")
            parts.append(f"页面类型: {self.page_info.get('type', 'unknown')}")

        if self.active_styles:
            parts.append(f"已应用样式: {len(self.active_styles)} 个")

        if self.user_preferences:
            parts.append(f"用户偏好: {list(self.user_preferences.keys())}")

        return "\n".join(parts) if parts else "暂无页面信息"


# =============================================================================
# 工具实现
# =============================================================================

def execute_tool(name: str, args: dict, context: AgentContext) -> str:
    """
    执行工具调用

    注意：这里是框架代码，实际实现需要与 Chrome 插件通信
    """

    if name == "get_page_structure":
        # TODO: 通过 Chrome extension message 获取页面结构
        # 这里返回模拟数据
        context.page_info = {
            "url": "https://example.com",
            "type": "news",
            "semantic_zones": ["header", "nav", "main", "sidebar", "footer"],
            "theme_hints": {
                "bg_color": "#ffffff",
                "text_color": "#333333",
                "is_dark": False
            }
        }
        return json.dumps(context.page_info, ensure_ascii=False, indent=2)

    if name == "pick_element":
        # TODO: 通过 Chrome extension 激活元素选择模式
        return f"已激活元素选择模式: {args['prompt']}"

    if name == "apply_styles":
        # TODO: 通过 Chrome extension 注入 CSS
        mode = args.get("mode", "preview")
        css = args["css"]

        if mode == "preview":
            context.active_styles["preview"] = css
            return f"已预览样式，等待确认"
        elif mode == "apply":
            context.active_styles["applied"] = css
            return f"已应用样式"
        elif mode == "rollback":
            context.active_styles.pop("preview", None)
            return f"已回滚预览样式"

    if name == "save_preference":
        # TODO: 保存到 Chrome storage
        url_pattern = args["url_pattern"]
        styles = args["styles"]
        context.user_preferences[url_pattern] = styles
        return f"已保存偏好，下次访问 {url_pattern} 将自动应用"

    if name == "TodoWrite":
        context.todos = args["todos"]
        return "任务列表已更新"

    if name == "Task":
        return run_subagent(
            description=args["description"],
            prompt=args["prompt"],
            agent_type=args["agent_type"],
            context=context
        )

    return f"未知工具: {name}"


def run_subagent(description: str, prompt: str, agent_type: str,
                 context: AgentContext) -> str:
    """
    运行子智能体

    关键：子智能体在隔离的上下文中运行
    """
    if agent_type not in AGENT_TYPES:
        return f"未知子智能体类型: {agent_type}"

    config = AGENT_TYPES[agent_type]

    # 子智能体的系统提示
    sub_system = f"""{config['prompt']}

上下文信息:
{context.to_summary()}"""

    # 子智能体的工具（根据配置过滤）
    # 简化：子智能体只能用特定工具

    # 子智能体的消息历史（隔离的！）
    sub_messages = [{"role": "user", "content": prompt}]

    # 运行子智能体循环
    while True:
        response = client.messages.create(
            model=MODEL,
            system=sub_system,
            messages=sub_messages,
            max_tokens=4000
        )

        # 如果没有工具调用，返回文本
        if response.stop_reason != "tool_use":
            break

        # 执行工具调用
        # ... (简化实现)

    # 提取最终文本
    for block in response.content:
        if hasattr(block, "text"):
            return block.text

    return "(子智能体无输出)"


# =============================================================================
# 主循环
# =============================================================================

def agent_loop(user_input: str, history: list, context: AgentContext) -> str:
    """
    智能体主循环

    这就是 agent-builder 的核心：一个简单的循环
    - 模型看到上下文和能力
    - 模型决定行动或回复
    - 如果行动：执行工具，添加结果，继续
    - 如果回复：返回给用户
    """

    # 添加用户消息
    history.append({"role": "user", "content": user_input})

    # 构建增强的系统提示（包含当前上下文）
    enhanced_system = f"{SYSTEM}\n\n当前状态:\n{context.to_summary()}"

    while True:
        # 调用模型
        response = client.messages.create(
            model=MODEL,
            system=enhanced_system,
            messages=history,
            tools=TOOLS,
            max_tokens=8000
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
                result = execute_tool(block.name, block.input, context)
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
    context = AgentContext()

    while True:
        try:
            user_input = input(">> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if user_input in ("q", "quit", "exit", ""):
            break

        response = agent_loop(user_input, history, context)
        print(f"\n{response}\n")
