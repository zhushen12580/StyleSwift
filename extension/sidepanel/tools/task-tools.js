/**
 * StyleSwift - Task Tools
 *
 * Tools for task management and sub-agent invocation.
 */

// =============================================================================
// TodoWrite - 任务列表管理
// =============================================================================

export const TODO_WRITE_TOOL = {
  name: "TodoWrite",
  description: `更新任务列表。用于规划和追踪复杂任务的进度。

使用场景：
- 用户请求涉及多个步骤的复杂任务
- 需要将大任务分解为子任务
- 需要追踪任务完成进度

工作模式：
1. 规划模式（首次调用）：传入完整任务数组，设置所有任务状态为 pending。
   计划会展示给用户确认，用户可以编辑、增删步骤。确认后才开始执行。
   例：todos: [{content: "获取页面结构", status: "pending"}, {content: "修改导航样式", status: "pending"}]

2. 更新模式（后续调用）：传入任务 id 和新状态，更新单个任务进度（无需确认）
   例：todos: [{id: "todo_1", status: "in_progress"}] 或 [{id: "todo_1", status: "completed"}]

状态流转：pending → in_progress → completed
- 开始任务时标记为 in_progress
- 完成任务后标记为 completed

简单任务（单步操作）不需要使用此工具。`,
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description:
          "任务数组。规划模式：每项包含 content 和 status；更新模式：每项包含 id 和要更新的字段",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "任务 ID（更新模式必填，由首次调用返回）",
            },
            content: {
              type: "string",
              description: "任务描述（规划模式必填）",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "任务状态",
            },
          },
        },
      },
    },
    required: ["todos"],
  },
};

// =============================================================================
// Task Tool - 子智能体调用
// =============================================================================

export const TASK_TOOL = {
  name: "Task",
  description: `调用子智能体处理复杂任务。
子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- QualityAudit: 样式质检专家，验证已应用CSS的视觉效果、可访问性和一致性

使用场景：
- 应用了较多样式（8+条规则）后需要质检
- 全局色彩/主题变更后验证效果
- 用户反馈样式有问题，需要系统性排查`,
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "任务简短描述（3-5字）" },
      prompt: { type: "string", description: "详细的任务指令" },
      agent_type: {
        type: "string",
        enum: ["QualityAudit"],
        description: "子智能体类型",
      },
    },
    required: ["description", "prompt", "agent_type"],
  },
};

/**
 * Task tools handler factory
 * @returns {object} Handlers for task tools
 */
export function createTaskToolHandlers() {
  return {
    TodoWrite: async (args) => {
      const { updateTodos } = await import("../agent/todo-manager.js");
      return updateTodos(args.todos);
    },

    Task: async (args, context) => {
      const { runTask } = await import("../agent/agent-loop.js").catch(() => ({
        runTask: null,
      }));
      if (runTask) {
        return await runTask(
          args.description,
          args.prompt,
          args.agent_type,
          context?.abortSignal,
          context?.tabId,
          context?.uiCallbacks,
        );
      }
      return "(子智能体功能尚未实现)";
    },
  };
}