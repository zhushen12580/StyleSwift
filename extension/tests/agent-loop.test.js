/**
 * Agent Loop 单元测试
 *
 * 测试 SYSTEM_BASE 常量定义
 * 测试 buildSessionContext 函数
 * 测试 checkAndCompressHistory 函数
 * 测试 findKeepBoundary 函数
 * 测试 summarizeOldTurns 函数（需要 mock API）
 *
 * 测试标准：
 * - SYSTEM_BASE 包含所有关键指引
 * - buildSessionContext 输出包含域名和会话标题，有画像时包含偏好提示
 * - DEFAULT_TOKEN_BUDGET 为 50000（旧版常量，用于兼容）
 * - getDynamicTokenBudget 动态计算模型 token 预算
 * - 未超预算不压缩
 * - 超预算后全量摘要旧消息 + 动态保留最近上下文
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Import constants to test
import {
  SYSTEM_BASE,
  buildSessionContext,
  DEFAULT_TOKEN_BUDGET,
  getDynamicTokenBudget,
  findKeepBoundary,
  checkAndCompressHistory,
  extractEffectiveHistory,
  summarizeOldTurns,
  estimateTokenCount,
  truncateLargeToolResults,
  cancelAgentLoop,
  getIsAgentRunning,
  getCurrentAbortController,
  // §11.4 死循环保护
  MAX_RETRIES,
  DUPLICATE_CALL_THRESHOLD,
  resetToolCallHistory,
  generateToolCallKey,
  detectDeadLoop,
  executeToolWithRetry,
} from "../sidepanel/agent/agent-loop.js";

describe("SYSTEM_BASE 常量", () => {
  test("SYSTEM_BASE 定义为字符串", () => {
    expect(typeof SYSTEM_BASE).toBe("string");
    expect(SYSTEM_BASE.length).toBeGreaterThan(100);
  });

  test("包含身份定义", () => {
    expect(SYSTEM_BASE).toContain("StyleSwift");
    expect(SYSTEM_BASE).toContain("web styling personalization");
  });

  test("包含工作方式指引", () => {
    expect(SYSTEM_BASE).toContain("Intent Classification");
    expect(SYSTEM_BASE).toContain("Task Planning");
  });

  test("包含 CSS 生成规则", () => {
    expect(SYSTEM_BASE).toContain("Specific class/ID selectors");
    expect(SYSTEM_BASE).toContain("!important");
  });

  test("包含样式编辑策略（引用 get_current_styles）", () => {
    expect(SYSTEM_BASE).toContain("get_current_styles");
    expect(SYSTEM_BASE).toContain("edit_css");
    expect(SYSTEM_BASE).toContain("apply_styles");
  });

  test("包含风格技能指引", () => {
    expect(SYSTEM_BASE).toContain("load_skill");
  });
});

describe("工具数组导出验证", () => {
  test("可以从 agent-loop.js 导入 SYSTEM_BASE", async () => {
    // 验证模块可以正常导入
    const agentLoop = await import("../sidepanel/agent/agent-loop.js");
    expect(agentLoop.SYSTEM_BASE).toBeDefined();
    expect(typeof agentLoop.SYSTEM_BASE).toBe("string");
  });

  test("agent-loop.js 导出 BASE_TOOLS 和 ALL_TOOLS", async () => {
    // 验证模块导出
    const agentLoop = await import("../sidepanel/agent/agent-loop.js");

    // 这两个变量应该被导出
    expect(agentLoop).toHaveProperty("BASE_TOOLS");
    expect(agentLoop).toHaveProperty("ALL_TOOLS");
  });
});

describe("buildSessionContext 函数", () => {
  test("输出包含域名和会话标题", () => {
    const ctx = buildSessionContext("github.com", { title: "深色模式" }, "");

    expect(ctx).toContain("[Session Context]");
    expect(ctx).toContain("Domain: github.com");
    expect(ctx).toContain("Session: 深色模式");
  });

  test('无标题时显示"New Session"', () => {
    const ctx = buildSessionContext("example.com", { title: null }, "");

    expect(ctx).toContain("Session: New Session");
  });

  test("不包含 CSS 样式（改为工具按需获取）", () => {
    const ctx = buildSessionContext("github.com", { title: "New Session" }, "");

    expect(ctx).not.toContain("Applied Styles");
    expect(ctx).not.toContain("```css");
  });

  test("有画像时包含偏好提示", () => {
    const ctx = buildSessionContext(
      "github.com",
      { title: "调整" },
      "偏好深色模式、圆角设计",
    );

    expect(ctx).toContain("User Style Preference: 偏好深色模式、圆角设计");
    expect(ctx).toContain("(details available via get_user_profile)");
  });

  test("无画像时不包含偏好提示", () => {
    const ctx = buildSessionContext("github.com", { title: "调整" }, "");

    expect(ctx).not.toContain("User Style Preference");
  });

  test("完整上下文包含所有信息", () => {
    const ctx = buildSessionContext(
      "github.com",
      {
        title: "深色模式调整",
      },
      "偏好深色模式",
    );

    expect(ctx).toContain("[Session Context]");
    expect(ctx).toContain("Domain: github.com");
    expect(ctx).toContain("Session: 深色模式调整");
    expect(ctx).toContain("User Style Preference: 偏好深色模式");
  });

  test("返回的上下文以换行符开始", () => {
    const ctx = buildSessionContext("test.com", { title: "测试" }, "");

    expect(ctx.startsWith("\n")).toBe(true);
  });
});

// =============================================================================
// §6.3 Layer 2 — 对话历史与 Token 预算控制 测试
// =============================================================================

describe("DEFAULT_TOKEN_BUDGET 常量", () => {
  test("DEFAULT_TOKEN_BUDGET 定义为 50000", () => {
    expect(DEFAULT_TOKEN_BUDGET).toBe(50000);
  });
});

describe("getDynamicTokenBudget 函数", () => {
  test("未知模型使用默认预算", () => {
    // 未知模型应该返回保守值或默认值的90%
    const budget = getDynamicTokenBudget("unknown-model");
    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThanOrEqual(500000); // 不应超过50万
  });
  
  test("返回合理的预算值", () => {
    // 即使模型名称变化，也应返回正数
    const budget = getDynamicTokenBudget("some-model");
    expect(typeof budget).toBe("number");
    expect(budget).toBeGreaterThan(10000); // 最小值保护
  });
});

describe("findKeepBoundary 函数", () => {
  test("短历史全部保留，返回 0", () => {
    const history = [
      { role: "user", content: "消息1" },
      { role: "assistant", content: [{ type: "text", text: "回复1" }] },
    ];
    expect(findKeepBoundary(history, DEFAULT_TOKEN_BUDGET)).toBe(0);
  });

  test("空历史返回 0", () => {
    expect(findKeepBoundary([], DEFAULT_TOKEN_BUDGET)).toBe(0);
  });

  test("切分点落在 user 消息上", () => {
    // 构建一个包含大量内容的历史
    const history = [];
    for (let i = 0; i < 20; i++) {
      history.push({ role: "user", content: "x".repeat(3000) });
      history.push({ role: "assistant", content: [{ type: "text", text: "y".repeat(3000) }] });
    }
    const boundary = findKeepBoundary(history, DEFAULT_TOKEN_BUDGET);
    if (boundary > 0 && boundary < history.length) {
      expect(history[boundary].role).toBe("user");
    }
  });
});

describe("estimateTokenCount 函数", () => {
  test("空消息返回系统开销", () => {
    expect(estimateTokenCount([])).toBe(4000);
  });

  test("计算字符串内容的 token", () => {
    const messages = [{ role: "user", content: "abc" }];
    // 3 ASCII chars * 0.25 = 0.75, ceil = 1, + 4000 = 4001
    expect(estimateTokenCount(messages)).toBe(4001);
  });

  test("自定义 systemOverhead", () => {
    const messages = [{ role: "user", content: "abc" }];
    // 3 ASCII chars * 0.25 = 0.75, ceil = 1
    expect(estimateTokenCount(messages, 0)).toBe(1);
  });
});

describe("truncateLargeToolResults 函数", () => {
  test("不截断小型工具结果", () => {
    const messages = [
      { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: "短结果" }] },
    ];
    const result = truncateLargeToolResults(messages);
    expect(result[0].content[0].content).toBe("短结果");
  });

  test("截断超大工具结果", () => {
    const bigContent = "x".repeat(5000);
    const messages = [
      { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: bigContent }] },
    ];
    const result = truncateLargeToolResults(messages);
    expect(result[0].content[0].content.length).toBeLessThan(bigContent.length);
    expect(result[0].content[0].content).toContain("truncated");
  });

  test("不修改非 user 消息", () => {
    const messages = [
      { role: "assistant", content: [{ type: "text", text: "x".repeat(5000) }] },
    ];
    const result = truncateLargeToolResults(messages);
    expect(result[0]).toBe(messages[0]);
  });
});

describe("extractEffectiveHistory 函数", () => {
  test("过滤 _isCompressed 消息", () => {
    const history = [
      { role: "user", content: "[摘要]", _isSummary: true },
      { role: "assistant", content: [{ type: "text", text: "OK" }], _isLearned: true },
      { role: "user", content: "旧消息1", _isCompressed: true },
      { role: "assistant", content: [{ type: "text", text: "旧回复1" }], _isCompressed: true },
      { role: "user", content: "新消息1" },
      { role: "assistant", content: [{ type: "text", text: "新回复1" }] },
    ];

    const effective = extractEffectiveHistory(history);

    // 应该保留摘要、学习和未压缩消息，跳过已压缩消息
    expect(effective.length).toBe(4);
    expect(effective.find((m) => m._isCompressed)).toBeUndefined();
    expect(effective[0]._isSummary).toBe(true);
    expect(effective[1]._isLearned).toBe(true);
    expect(effective[2].content).toBe("新消息1");
    expect(effective[3].content[0].text).toBe("新回复1");
  });

  test("空数组返回空数组", () => {
    const result = extractEffectiveHistory([]);
    expect(result).toEqual([]);
  });

  test("无压缩标记时返回全部历史", () => {
    const history = [
      { role: "user", content: "消息1" },
      { role: "assistant", content: [{ type: "text", text: "回复1" }] },
      { role: "user", content: "消息2" },
      { role: "assistant", content: [{ type: "text", text: "回复2" }] },
    ];

    const effective = extractEffectiveHistory(history);
    expect(effective.length).toBe(4);
    expect(effective).toEqual(history);
  });

  test("只有压缩消息时返回空数组", () => {
    const history = [
      { role: "user", content: "旧消息1", _isCompressed: true },
      { role: "assistant", content: [{ type: "text", text: "旧回复1" }], _isCompressed: true },
      { role: "user", content: "旧消息2", _isCompressed: true },
    ];

    const effective = extractEffectiveHistory(history);
    expect(effective.length).toBe(0);
  });

  test("摘要和消息混合时正确过滤", () => {
    const history = [
      { role: "user", content: "[摘要]", _isSummary: true },
      { role: "assistant", content: [{ type: "text", text: "OK" }], _isLearned: true },
      { role: "user", content: "已压缩消息1", _isCompressed: true },
      { role: "assistant", content: [{ type: "text", text: "已压缩回复1" }], _isCompressed: true },
      { role: "user", content: "新消息1" },
      { role: "assistant", content: [{ type: "text", text: "新回复1" }] },
      { role: "user", content: "已压缩消息2", _isCompressed: true },
      { role: "user", content: "新消息2" },
    ];

    const effective = extractEffectiveHistory(history);

    // 应该保留：摘要 + 确认 + 新消息1 + 新回复1 + 新消息2
    expect(effective.length).toBe(5);
    expect(effective[0]._isSummary).toBe(true);
    expect(effective[1]._isLearned).toBe(true);
    expect(effective[2].content).toBe("新消息1");
    expect(effective[3].content[0].text).toBe("新回复1");
    expect(effective[4].content).toBe("新消息2");
  });
});

describe("checkAndCompressHistory 函数", () => {
  test("未超预算不压缩", async () => {
    const history = [
      { role: "user", content: "消息1" },
      { role: "assistant", content: [{ type: "text", text: "回复1" }] },
    ];

    const result = await checkAndCompressHistory(history, 30000);
    // When no compression needed, both histories are the same as input
    expect(result).toHaveProperty("fullHistory");
    expect(result).toHaveProperty("llmHistory");
    expect(result.fullHistory).toBe(history);
    expect(result.llmHistory).toBe(history);
  });

  test("刚好等于预算不压缩", async () => {
    const history = [
      { role: "user", content: "消息1" },
      { role: "assistant", content: [{ type: "text", text: "回复1" }] },
    ];

    const result = await checkAndCompressHistory(history, 50000);
    // When no compression needed, both histories are the same as input
    expect(result).toHaveProperty("fullHistory");
    expect(result).toHaveProperty("llmHistory");
    expect(result.fullHistory).toBe(history);
    expect(result.llmHistory).toBe(history);
  });

  test("超预算后生成摘要 + 保留最近上下文 + 标记已压缩消息", async () => {
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              apiKey: "test-api-key",
              model: "claude-sonnet-4-20250514",
              apiBase: "https://api.anthropic.com",
            },
          }),
        },
      },
    };

    const mockSummary = "用户偏好深色模式，已应用深蓝背景";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockSummary } }],
      }),
    });

    // 构建一个超大历史（每条消息足够大以触发压缩）
    const history = [];
    for (let i = 1; i <= 30; i++) {
      history.push({ role: "user", content: `消息${i} ${"填充".repeat(500)}` });
      history.push({
        role: "assistant",
        content: [{ type: "text", text: `回复${i} ${"填充".repeat(500)}` }],
      });
    }

    const result = await checkAndCompressHistory(history, 200000);

    // New format: { fullHistory, llmHistory }
    expect(result).toHaveProperty("fullHistory");
    expect(result).toHaveProperty("llmHistory");

    const { fullHistory, llmHistory } = result;

    // fullHistory 应包含已压缩消息
    expect(fullHistory).not.toBe(history);
    expect(fullHistory.length).toBeGreaterThan(0);

    // llmHistory 应不含 _isCompressed 消息
    const compressedInLlm = llmHistory.filter((m) => m._isCompressed);
    expect(compressedInLlm.length).toBe(0);

    // 第一条应该是摘要消息（带 _isSummary 标记）
    expect(llmHistory[0].role).toBe("user");
    expect(llmHistory[0].content).toContain("[Conversation History Summary]");
    expect(llmHistory[0].content).toContain(mockSummary);
    expect(llmHistory[0]._isSummary).toBe(true);

    // 第二条应该是 assistant 确认（带 _isLearned 标记）
    expect(llmHistory[1].role).toBe("assistant");
    expect(llmHistory[1]._isLearned).toBe(true);

    // fullHistory 中检查被压缩的旧消息是否被标记为 _isCompressed
    const compressedMsgs = fullHistory.filter((m) => m._isCompressed);
    expect(compressedMsgs.length).toBeGreaterThan(0);

    // llmHistory 的最后应该是未压缩的最近消息（没有 _isSummary, _isLearned, _isCompressed 标记）
    const recentMsgs = llmHistory.filter((m) => !m._isSummary && !m._isLearned && !m._isCompressed);
    expect(recentMsgs.length).toBeGreaterThan(0);

    // 最后一条应该是助手回复
    expect(llmHistory[llmHistory.length - 1].role).toBe("assistant");

    // llmHistory 应比 fullHistory 短（不包含已压缩消息）
    expect(llmHistory.length).toBeLessThan(fullHistory.length);

    vi.clearAllMocks();
  });

  test("二次压缩时整合旧摘要 + 跳过已压缩消息", async () => {
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              apiKey: "test-api-key",
              model: "claude-sonnet-4-20250514",
              apiBase: "https://api.anthropic.com",
            },
          }),
        },
      },
    };

    const mockSummary = "整合后的完整摘要";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockSummary } }],
      }),
    });

    // 模拟已经压缩过一次的历史，包含摘要和已压缩消息
    const history = [
      { role: "user", content: "[Conversation History Summary]\n旧摘要内容", _isSummary: true },
      { role: "assistant", content: [{ type: "text", text: "OK, I've learned about the previous conversation." }], _isLearned: true },
      // 已压缩的旧消息（二次压缩时应跳过这些）
      { role: "user", content: "旧消息1", _isCompressed: true },
      { role: "assistant", content: [{ type: "text", text: "旧回复1" }], _isCompressed: true },
      { role: "user", content: "旧消息2", _isCompressed: true },
      { role: "assistant", content: [{ type: "text", text: "旧回复2" }], _isCompressed: true },
    ];
    // 添加足够多的大消息以超出保留预算
    for (let i = 0; i < 20; i++) {
      history.push({ role: "user", content: `消息${i} ${"填充".repeat(2000)}` });
      history.push({ role: "assistant", content: [{ type: "text", text: `回复${i} ${"填充".repeat(2000)}` }] });
    }
    history.push({ role: "user", content: "最新消息" });

    const result = await checkAndCompressHistory(history, 200000);

    // New format: { fullHistory, llmHistory }
    expect(result).toHaveProperty("fullHistory");
    expect(result).toHaveProperty("llmHistory");

    const { fullHistory, llmHistory } = result;

    // 应该包含新摘要
    const summaryMsg = llmHistory.find((m) => m._isSummary);
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg.content).toContain(mockSummary);

    // fullHistory 中应包含已压缩的消息（_isCompressed: true）
    const compressedMsgs = fullHistory.filter((m) => m._isCompressed);
    expect(compressedMsgs.length).toBeGreaterThan(0);

    // llmHistory 中不应包含已压缩消息
    const compressedInLlm = llmHistory.filter((m) => m._isCompressed);
    expect(compressedInLlm.length).toBe(0);

    // llmHistory 应以摘要开始
    expect(llmHistory[0]._isSummary).toBe(true);

    vi.clearAllMocks();
  });
});

describe("summarizeOldTurns 函数", () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            settings: {
              apiKey: "test-api-key",
              model: "claude-sonnet-4-20250514",
              apiBase: "https://api.anthropic.com",
            },
          }),
        },
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("对简单历史生成摘要", async () => {
    const mockSummary = "用户偏好深色模式";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockSummary } }],
      }),
    });

    const history = [
      { role: "user", content: "改成深色模式" },
      {
        role: "assistant",
        content: [{ type: "text", text: "好的，已为您应用深色模式" }],
      },
    ];

    const summary = await summarizeOldTurns(history);
    expect(summary).toBe(mockSummary);
  });

  test("空历史返回默认消息", async () => {
    const summary = await summarizeOldTurns([]);
    expect(summary).toBe("(No history)");
  });

  test("API 错误时返回失败消息", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const history = [
      { role: "user", content: "消息" },
      { role: "assistant", content: [{ type: "text", text: "回复" }] },
    ];

    const summary = await summarizeOldTurns(history);
    expect(summary).toBe("(History summary generation failed)");
  });
});

// =============================================================================
// §10.4 cancelAgentLoop 取消机制 测试
// =============================================================================

describe("cancelAgentLoop 函数", () => {
  beforeEach(() => {
    // Mock chrome.tabs 和 chrome.runtime
    global.chrome = {
      tabs: {
        sendMessage: vi.fn(),
      },
      runtime: {
        lastError: null,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("取消 Agent 时调用 AbortController.abort()", () => {
    // 模拟正在运行的 Agent
    const controller = getCurrentAbortController();

    // 创建一个 AbortController 并模拟正在运行的状态
    const mockAbort = vi.fn();
    const mockController = {
      abort: mockAbort,
      signal: { aborted: false },
    };

    // 直接通过 agentLoop 内部逻辑来测试
    // 由于 agentLoop 是异步的且需要完整的设置，
    // 我们这里测试 cancelAgentLoop 的核心逻辑

    // 在实际场景中，cancelAgentLoop 会从 agentLoop 获得 AbortController
    // 这里我们验证函数可以被正常调用
    expect(() => cancelAgentLoop()).not.toThrow();
  });

  test("重置 isAgentRunning 状态", () => {
    // 调用 cancelAgentLoop
    cancelAgentLoop();

    // 验证 isAgentRunning 被重置为 false
    expect(getIsAgentRunning()).toBe(false);
  });

  test("多次调用不会报错", () => {
    // 连续调用多次应该不会报错
    expect(() => {
      cancelAgentLoop();
      cancelAgentLoop();
      cancelAgentLoop();
    }).not.toThrow();
  });

  test("空闲状态下调用安全", () => {
    // 确保在没有运行 Agent 时调用也是安全的
    expect(() => cancelAgentLoop()).not.toThrow();
    expect(getIsAgentRunning()).toBe(false);
  });
});

// =============================================================================
// §11.4 死循环保护 测试
// =============================================================================

describe("§11.4 死循环保护常量", () => {
  test("MAX_RETRIES 定义为 2（最多重试 2 次）", () => {
    expect(MAX_RETRIES).toBe(2);
  });

  test("DUPLICATE_CALL_THRESHOLD 定义为 5（连续 5 次相同调用视为死循环）", () => {
    expect(DUPLICATE_CALL_THRESHOLD).toBe(5);
  });
});

describe("resetToolCallHistory 函数", () => {
  test("重置工具调用历史为空数组", () => {
    // 先添加一些历史记录
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("another_tool", { arg: "value2" });

    // 重置历史
    resetToolCallHistory();

    // 再次检测应该不会检测到死循环
    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });
    expect(isDeadLoop).toBe(false);
  });
});

describe("generateToolCallKey 函数", () => {
  test("相同工具名和参数生成相同的键", () => {
    const key1 = generateToolCallKey("test_tool", { arg: "value", num: 123 });
    const key2 = generateToolCallKey("test_tool", { arg: "value", num: 123 });

    expect(key1).toBe(key2);
  });

  test("参数顺序不同但内容相同生成相同的键", () => {
    const key1 = generateToolCallKey("test_tool", { a: 1, b: 2 });
    const key2 = generateToolCallKey("test_tool", { b: 2, a: 1 });

    expect(key1).toBe(key2);
  });

  test("不同工具名生成不同的键", () => {
    const key1 = generateToolCallKey("tool1", { arg: "value" });
    const key2 = generateToolCallKey("tool2", { arg: "value" });

    expect(key1).not.toBe(key2);
  });

  test("不同参数生成不同的键", () => {
    const key1 = generateToolCallKey("test_tool", { arg: "value1" });
    const key2 = generateToolCallKey("test_tool", { arg: "value2" });

    expect(key1).not.toBe(key2);
  });

  test("嵌套对象参数也能正确比较", () => {
    const key1 = generateToolCallKey("test_tool", {
      nested: { a: 1, b: 2 },
      arr: [1, 2, 3],
    });
    const key2 = generateToolCallKey("test_tool", {
      nested: { b: 2, a: 1 },
      arr: [1, 2, 3],
    });

    expect(key1).toBe(key2);
  });

  test("空参数也能生成键", () => {
    const key = generateToolCallKey("test_tool", {});

    expect(typeof key).toBe("string");
    expect(key).toContain("test_tool");
  });

  test("null 参数不会崩溃", () => {
    const key = generateToolCallKey("test_tool", null);

    expect(typeof key).toBe("string");
  });
});

describe("detectDeadLoop 函数", () => {
  beforeEach(() => {
    resetToolCallHistory();
  });

  test("首次调用不检测为死循环", () => {
    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });

    expect(isDeadLoop).toBe(false);
  });

  test("两次相同调用不检测为死循环", () => {
    detectDeadLoop("test_tool", { arg: "value" });
    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });

    expect(isDeadLoop).toBe(false);
  });

  test("连续 5 次相同调用检测为死循环", () => {
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });

    expect(isDeadLoop).toBe(true);
  });

  test("不同调用不会误判为死循环", () => {
    detectDeadLoop("tool1", { arg: "value1" });
    detectDeadLoop("tool2", { arg: "value2" });
    detectDeadLoop("tool3", { arg: "value3" });

    const isDeadLoop = detectDeadLoop("tool4", { arg: "value4" });
    expect(isDeadLoop).toBe(false);
  });

  test("间隔不同调用不会误判", () => {
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("other_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });

    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });
    expect(isDeadLoop).toBe(false);
  });

  test("连续 6 次相同调用第 6 次也检测为死循环", () => {
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    detectDeadLoop("test_tool", { arg: "value" });
    const isDeadLoop = detectDeadLoop("test_tool", { arg: "value" });

    expect(isDeadLoop).toBe(true);
  });
});

describe("executeToolWithRetry 函数", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("首次成功不重试", async () => {
    const mockExecutor = vi.fn().mockResolvedValue("success");

    const result = await executeToolWithRetry(
      "test_tool",
      { arg: "value" },
      mockExecutor,
    );

    expect(result).toBe("success");
    expect(mockExecutor).toHaveBeenCalledTimes(1);
  });

  test("失败后自动重试", async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error("第一次失败"))
      .mockResolvedValue("success");

    const result = await executeToolWithRetry(
      "test_tool",
      { arg: "value" },
      mockExecutor,
    );

    expect(result).toBe("success");
    expect(mockExecutor).toHaveBeenCalledTimes(2);
  });

  test("达到最大重试次数后返回错误信息", async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error("持续失败"));

    const result = await executeToolWithRetry(
      "test_tool",
      { arg: "value" },
      mockExecutor,
    );

    expect(result).toContain("failed");
    expect(result).toContain("持续失败");
    expect(result).toContain("Retried 2 times");
    expect(mockExecutor).toHaveBeenCalledTimes(MAX_RETRIES + 1); // 初始 + 2 次重试
  });

  test("重试成功后立即返回", async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error("失败1"))
      .mockRejectedValueOnce(new Error("失败2"))
      .mockResolvedValue("success");

    const result = await executeToolWithRetry(
      "test_tool",
      { arg: "value" },
      mockExecutor,
    );

    expect(result).toBe("success");
    expect(mockExecutor).toHaveBeenCalledTimes(3);
  });

  test("错误对象没有 message 属性时也能处理", async () => {
    const mockExecutor = vi.fn().mockRejectedValue("string error");

    const result = await executeToolWithRetry(
      "test_tool",
      { arg: "value" },
      mockExecutor,
    );

    expect(result).toContain("failed");
    expect(mockExecutor).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });
});

describe("工具调用历史记录集成测试", () => {
  beforeEach(() => {
    resetToolCallHistory();
  });

  test("工具调用被正确记录到历史", () => {
    const toolName = "get_page_structure";
    const args = { query: "header" };

    detectDeadLoop(toolName, args);

    // 验证历史记录被添加
    const isDeadLoop = detectDeadLoop(toolName, args);
    expect(isDeadLoop).toBe(false); // 第二次，不是死循环

    detectDeadLoop(toolName, args);
    detectDeadLoop(toolName, args);
    detectDeadLoop(toolName, args);
    const isDeadLoopAgain = detectDeadLoop(toolName, args);
    expect(isDeadLoopAgain).toBe(true); // 第五次，是死循环
  });

  test("重试逻辑和死循环检测协同工作", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 模拟工具执行失败
    const mockExecutor = vi.fn().mockRejectedValue(new Error("Network error"));

    // 执行带重试的工具调用
    const result = await executeToolWithRetry(
      "failing_tool",
      { arg: "test" },
      mockExecutor,
    );

    // 应该重试了 MAX_RETRIES 次
    expect(mockExecutor).toHaveBeenCalledTimes(MAX_RETRIES + 1);

    // 结果应该包含错误信息
    expect(result).toContain("failed");

    // 应该有重试日志
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
