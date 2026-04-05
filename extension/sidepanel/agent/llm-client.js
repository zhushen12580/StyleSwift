/**
 * LLM Client Module
 * Handles streaming API calls to OpenAI and Claude providers,
 * including retry logic and error handling.
 */

import {
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
} from "./message-serialization.js";
import { truncateLargeToolResults, estimateTokenCount, msgTokenEstimate } from "./token-manager.js";

// --- AgentError (categorized error codes) ---
// Custom error class with error codes for better error handling

export class AgentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// --- Utility Functions ---
// Helper functions for API calls

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- HTTP Error Handling ---
// Check response and throw appropriate AgentError

function checkHttpError(response) {
  if (!response.ok) {
    return response.text().then((errorText) => {
      if (response.status === 401) {
        throw new AgentError("API_KEY_INVALID", "Please check if the API Key is correct");
      }
      if (response.status === 429) {
        throw new AgentError("RATE_LIMITED", `API rate limited: ${errorText}`);
      }
      if (response.status === 400) {
        const lower = errorText.toLowerCase();
        if (lower.includes("context length") || lower.includes("too long") || lower.includes("token")) {
          throw new AgentError("CONTEXT_TOO_LONG", `Input exceeds model context length limit: ${errorText}`);
        }
      }
      if (response.status >= 500) {
        throw new AgentError("API_ERROR", `API service error (${response.status}): ${errorText}`);
      }
      throw new AgentError("API_ERROR", `API error (${response.status}): ${errorText}`);
    });
  }
  return Promise.resolve();
}

// --- OpenAI Streaming API ---
// Call OpenAI chat/completions API with streaming

async function callOpenAIStream(
  { apiKey, model, apiBase },
  system,
  messages,
  tools,
  callbacks,
  abortSignal,
) {
  const { buildApiUrl } = await import("../api.js");
  const openaiMessages = serializeToOpenAI(system, messages);
  const openaiTools = serializeToolsToOpenAI(tools);

  const url = buildApiUrl(apiBase, "/chat/completions");
  const requestBody = {
    model,
    messages: openaiMessages,
    max_tokens: 8000,
    stream: true,
  };

  if (openaiTools && openaiTools.length > 0) {
    requestBody.tools = openaiTools;
    requestBody.tool_choice = "auto";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  });

  await checkHttpError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const state = {
    text: "",
    reasoning: "",
    toolCalls: [],
    stopReason: null,
    usage: null,
  };

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      parseOpenAIStreamLine(line, state, callbacks);
    }
  }

  return finalizeOpenAIStream(state, callbacks);
}

// --- Claude Streaming API ---
// Call Claude messages API with streaming

async function callClaudeStream(
  { apiKey, model, apiBase },
  system,
  messages,
  tools,
  callbacks,
  abortSignal,
) {
  const { buildApiUrl } = await import("../api.js");
  const claudeMessages = serializeToClaude(messages);
  const claudeTools = serializeToolsToClaude(tools);

  const url = buildApiUrl(apiBase, "/messages");
  const requestBody = {
    model,
    messages: claudeMessages,
    max_tokens: 8000,
    stream: true,
  };

  if (system) {
    requestBody.system = system;
  }

  if (claudeTools && claudeTools.length > 0) {
    requestBody.tools = claudeTools;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  });

  await checkHttpError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const state = {
    blocks: [],
    reasoning: "",
    stopReason: null,
    usage: null,
  };

  let buffer = "";
  let currentEventType = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        parseClaudeStreamLine(currentEventType, line, state, callbacks);
      }
    }
  }

  return finalizeClaudeStream(state, callbacks);
}

// --- Main LLM Streaming API ---
// Unified entry point for LLM calls (detects provider and routes accordingly)

/**
 * Call LLM streaming API (serialize ICF by provider, supports OpenAI/Claude)
 * @param {string} system - System prompt
 * @param {Array} messages - ICF message array
 * @param {Array} tools - Tool definitions
 * @param {Object} callbacks - { onReasoning, onText, onToolCall, onStatus }
 * @param {AbortSignal} abortSignal - Abort signal for cancellation
 * @returns {Promise<Object>} - Response with content, stop_reason, usage, reasoning
 */
export async function callLLMStream(system, messages, tools, callbacks, abortSignal) {
  const hasImages = detectImages(messages);
  const { getSettingsForRequest } = await import("../api.js");
  const { apiKey, model, apiBase, provider } = await getSettingsForRequest(hasImages);

  // Debug: Log vision model detection
  console.log("[callLLMStream] Vision detection:", {
    hasImages,
    usingModel: model,
    provider,
  });

  const safeMsgs = hasImages ? messages : stripImagesFromMessages(messages);

  try {
    if (provider === "claude") {
      return await callClaudeStream(
        { apiKey, model, apiBase },
        system,
        safeMsgs,
        tools,
        callbacks,
        abortSignal,
      );
    } else {
      return await callOpenAIStream(
        { apiKey, model, apiBase },
        system,
        safeMsgs,
        tools,
        callbacks,
        abortSignal,
      );
    }
  } catch (error) {
    if (error.name === "AbortError" || abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (error instanceof AgentError) throw error;
    if (error instanceof TypeError) {
      throw new AgentError("NETWORK_ERROR", "Network connection failed, please check your network");
    }
    throw new AgentError("API_ERROR", `API call failed: ${error.message || error}`);
  }
}

// --- Retry Logic ---
// Handle rate limiting and context length exceeded with retries

const API_MAX_RETRIES = 2;

/**
 * callLLMStream wrapper: 401/network/context exceeded no retry, 429 exponential backoff
 * @param {string} system - System prompt
 * @param {Array} messages - ICF message array
 * @param {Array} tools - Tool definitions
 * @param {Object} callbacks - { onReasoning, onText, onToolCall, onStatus }
 * @param {AbortSignal} abortSignal - Abort signal for cancellation
 * @returns {Promise<Object>} - Response with content, stop_reason, usage, reasoning
 */
export async function callLLMStreamSafe(
  system,
  messages,
  tools,
  callbacks,
  abortSignal,
) {
  let retries = 0;
  let currentMessages = messages;
  while (retries <= API_MAX_RETRIES) {
    try {
      return await callLLMStream(
        system,
        currentMessages,
        tools,
        callbacks,
        abortSignal,
      );
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (err.code === "API_KEY_INVALID") throw err;
      if (err.code === "NETWORK_ERROR") throw err;

      if (err.code === "CONTEXT_TOO_LONG" && retries === 0) {
        callbacks.onStatus?.("Input too long, auto-compressing and retrying...");
        currentMessages = stripImagesFromMessages(currentMessages);
        currentMessages = truncateLargeToolResults(currentMessages);
        retries++;
        continue;
      }
      if (err.code === "CONTEXT_TOO_LONG") throw err;

      if (err.code === "RATE_LIMITED" && retries < API_MAX_RETRIES) {
        const waitMs = Math.pow(2, retries) * 2000;
        callbacks.onStatus?.(`API rate limited, retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
        retries++;
        continue;
      }

      throw err;
    }
  }
  throw new AgentError("MAX_RETRIES", "API retries exhausted after multiple attempts");
}

// Export internal functions for reuse
export { sleep, msgTokenEstimate };