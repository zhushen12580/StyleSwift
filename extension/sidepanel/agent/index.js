/**
 * StyleSwift - Agent Module Entry
 *
 * Re-exports all agent-related functions for backward compatibility.
 */

// Main agent loop
export {
  agentLoop,
  cancelAgentLoop,
  queueUserMessage,
  getPendingMessagesCount,
  RESTRICTED_PATTERNS,
  isRestrictedPage,
} from "./agent-loop.js";

// Re-export serialization functions from agent-loop (which re-exports from message-serialization)
export {
  serializeToOpenAI,
  serializeToolsToOpenAI,
  serializeToClaude,
  serializeToolsToClaude,
  parseOpenAIStreamLine,
  finalizeOpenAIStream,
  parseClaudeStreamLine,
  finalizeClaudeStream,
  detectImages,
  stripImagesFromMessages,
} from "./agent-loop.js";

// LLM client
export {
  AgentError,
  callLLMStream,
  callLLMStreamSafe,
  sleep,
} from "./llm-client.js";

// Token manager
export {
  DEFAULT_TOKEN_BUDGET,
  getDynamicTokenBudget,
  findKeepBoundary,
  checkAndCompressHistory,
  extractEffectiveHistory,
  summarizeOldTurns,
  estimateTokenCount,
  truncateLargeToolResults,
  msgTokenEstimate,
} from "./token-manager.js";

// System prompt
export { SYSTEM_BASE, AGENT_TYPES } from "./system-prompt.js";

// Model context
export { calculateTokenBudget } from "./model-context.js";

// Todo manager
export {
  TodoStatus,
  resetTodos,
  setTodoUpdateCallback,
  updateTodos,
  getTodos,
  startTodo,
  completeTodo,
  formatTodoList,
  isAwaitingConfirmation,
  requestConfirmation,
  confirmPlan,
  rejectPlan,
} from "./todo-manager.js";