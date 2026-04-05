/**
 * Token Manager Module
 * Handles token budget calculation, history compression, and large content truncation.
 * Core functionality for managing LLM context window limits.
 */

import { calculateTokenBudget } from "./model-context.js";

// --- Token Budget Constants ---
// Default budget for backward compatibility and as fallback

export const DEFAULT_TOKEN_BUDGET = 50000;

/** Minimum messages to keep when compressing history */
const MIN_KEEP_MSGS = 6;

/** CJK character regex for token estimation */
const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/g;

// --- Token Estimation Functions ---
// Estimate token count for messages without calling the API

/**
 * Estimate text token count: CJK at 1.5 tokens/char, ASCII at 0.25 tokens/char
 * This provides a rough estimate without exact tokenizer overhead.
 * @param {string} text - Text to estimate
 * @returns {number} - Estimated token count
 */
function estimateTextTokens(text) {
  if (!text) return 0;
  const cjkCount = (text.match(CJK_RE) || []).length;
  const asciiCount = text.length - cjkCount;
  return Math.ceil(cjkCount * 1.5 + asciiCount * 0.25);
}

/**
 * Recursively collect all text fragments from message for precise token estimation
 * @param {Object} msg - ICF message
 * @param {Array} out - Output array to collect text fragments
 */
function collectMsgTexts(msg, out) {
  if (msg._reasoning) out.push(msg._reasoning);

  if (typeof msg.content === "string") {
    out.push(msg.content);
    return;
  }
  if (!Array.isArray(msg.content)) return;

  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      out.push(block.text);
    } else if (block.type === "image_url") {
      // Base64 images are very long strings, use fixed estimate instead of actual string length
      // A typical screenshot base64 is 100k-1M chars, but visually ~1000 tokens
      // We use a placeholder to avoid counting the full base64 string
      out.push("[IMAGE_DATA]"); // Fixed placeholder for token estimation
    } else if (block.type === "tool_result") {
      if (typeof block.content === "string") {
        out.push(block.content);
      } else if (Array.isArray(block.content)) {
        for (const c of block.content) {
          if (c.type === "text" && c.text) out.push(c.text);
          if (c.type === "image_url") out.push("[IMAGE_DATA]"); // Fixed placeholder
        }
      }
    } else if (block.type === "tool_use") {
      out.push(block.name || "");
      out.push(JSON.stringify(block.input || {}));
    }
  }
}

/**
 * Estimate single message token count
 * @param {Object} msg - ICF message
 * @returns {number} - Estimated token count
 */
function msgTokenEstimate(msg) {
  const texts = [];
  collectMsgTexts(msg, texts);
  let total = 0;
  for (const t of texts) {
    // Fixed token estimate for image placeholders
    if (t === "[IMAGE_DATA]") {
      total += 1000; // Reasonable estimate for vision token usage
    } else {
      total += estimateTextTokens(t);
    }
  }
  return total;
}

/**
 * Estimate tokens: each message token + systemOverhead
 * @param {Array} messages - ICF message array
 * @param {number} systemOverhead - System prompt and tools overhead
 * @returns {number} - Total estimated tokens
 */
export function estimateTokenCount(messages, systemOverhead = 4000) {
  let total = 0;
  for (const msg of messages) {
    total += msgTokenEstimate(msg);
  }
  return total + systemOverhead;
}

// --- Dynamic Token Budget ---
// Calculate budget based on model's context window

/**
 * Dynamic token budget calculation
 * Uses 90% of context window minus system overhead (4000 tokens)
 * @param {string} modelName - Model name (e.g., "gpt-4o", "claude-3-5-sonnet")
 * @returns {number} - Token budget
 */
export function getDynamicTokenBudget(modelName) {
  if (!modelName) {
    console.warn('[Token Budget] No model name provided, using default 50000');
    return DEFAULT_TOKEN_BUDGET;
  }
  const budget = calculateTokenBudget(modelName, 0.9, 4000);
  console.log(`[Token Budget] Calculated for model "${modelName}": ${budget} tokens`);
  return budget;
}

// --- History Compression ---
// Compress old history when exceeding token budget

/**
 * Check if user message contains tool_result
 * (cannot be a compression cut point, would break tool_use/tool_result pairing)
 * @param {Object} msg - ICF message
 * @returns {boolean} - True if message contains tool_result
 */
function isToolResultMessage(msg) {
  if (msg.role !== "user" || !Array.isArray(msg.content)) return false;
  return msg.content.some((c) => c.type === "tool_result");
}

/**
 * Find boundary for keeping recent messages when compressing
 * Accumulates from end to reach 40% of budget (aggressive compression for longer history).
 * Cut point lands on a clean user message (not tool_result).
 * Always keep at least MIN_KEEP_MSGS recent messages.
 * @param {Array} history - Full history array
 * @param {number} tokenBudget - Token budget limit
 * @returns {number} - Index to cut from (messages before this will be compressed)
 */
export function findKeepBoundary(history, tokenBudget) {
  if (history.length <= MIN_KEEP_MSGS) return 0;

  const keepLimit = Math.floor(tokenBudget * 0.4);
  let accTokens = 0;
  // Candidate cut point: default to keeping all recent MIN_KEEP_MSGS messages
  let cutIndex = history.length - MIN_KEEP_MSGS;

  for (let i = history.length - 1; i >= 0; i--) {
    accTokens += msgTokenEstimate(history[i]);
    if (accTokens >= keepLimit) {
      // Ensure at least MIN_KEEP_MSGS messages are kept
      cutIndex = Math.min(i + 1, history.length - MIN_KEEP_MSGS);
      break;
    }
  }

  if (cutIndex <= 0) return 0;
  if (cutIndex >= history.length) return history.length - MIN_KEEP_MSGS;

  // Move forward until landing on a clean user message (not tool_result)
  while (cutIndex > 0) {
    const msg = history[cutIndex];
    if (msg.role === "user" && !isToolResultMessage(msg)) break;
    cutIndex--;
  }
  // Ensure again not exceeding history.length - MIN_KEEP_MSGS
  cutIndex = Math.min(cutIndex, history.length - MIN_KEEP_MSGS);

  return cutIndex;
}

/**
 * Extract effective history for LLM from full history.
 * Rules: Keep summary messages + un-compressed messages, skip _isCompressed messages.
 * @param {Array} fullHistory - Complete history including compressed messages
 * @returns {Array} - Effective history for LLM (summary + un-compressed messages)
 */
export function extractEffectiveHistory(fullHistory) {
  if (!Array.isArray(fullHistory)) return [];

  return fullHistory.filter((msg) =>
    // Summary messages: always keep
    msg._isSummary === true ||
    // Learned confirmation: always keep
    msg._isLearned === true ||
    // Un-compressed messages: keep
    msg._isCompressed !== true,
  );
}

/**
 * Compression result containing both histories:
 * - fullHistory: Complete history with _isCompressed marks (for storage)
 * - llmHistory: Effective history without _isCompressed messages (for LLM)
 * @typedef {Object} CompressionResult
 * @property {Array} fullHistory - Complete history with _isCompressed marks
 * @property {Array} llmHistory - Effective history without _isCompressed messages
 */

/**
 * When over budget, summarize old messages + keep recent context, truncate large tool results if still over
 * @param {Array} history - Full history array
 * @param {number} estimatedTokens - Current token estimate
 * @param {Object} callbacks - UI callbacks { onCompressionStart, onCompressionProgress, onCompressionEnd }
 * @param {number} tokenBudget - Token budget limit
 * @returns {Promise<CompressionResult>} - Object with fullHistory and llmHistory
 */
export async function checkAndCompressHistory(history, estimatedTokens, callbacks, tokenBudget) {
  const budget = tokenBudget || DEFAULT_TOKEN_BUDGET;

  if (estimatedTokens <= budget) {
    return { fullHistory: history, llmHistory: history };
  }

  // Notify UI that compression is starting
  callbacks?.onCompressionStart?.();

  const keepFrom = findKeepBoundary(history, budget);

  if (keepFrom <= 0) {
    callbacks?.onCompressionProgress?.("compressing_tool_results");
    const result = truncateLargeToolResults(history);
    callbacks?.onCompressionEnd?.();
    return { fullHistory: result, llmHistory: result };
  }

  const oldPart = history.slice(0, keepFrom);
  const recentPart = history.slice(keepFrom);

  if (oldPart.length === 0) {
    callbacks?.onCompressionProgress?.("compressing_tool_results");
    const result = truncateLargeToolResults(history);
    callbacks?.onCompressionEnd?.();
    return { fullHistory: result, llmHistory: result };
  }

  // Extract existing summary from _isSummary message (if any)
  // Skip _isCompressed messages when generating new summary
  let existingSummary = null;
  const nonCompressedOld = [];

  for (const msg of oldPart) {
    if (msg._isSummary) {
      // Extract existing summary content
      existingSummary = typeof msg.content === "string"
        ? msg.content.replace(/^\[Conversation History Summary\]\n?/, "")
        : null;
    } else if (!msg._isCompressed) {
      // Only collect un-compressed messages for summary generation
      nonCompressedOld.push(msg);
    }
    // _isCompressed messages are skipped entirely
  }

  // Filter out the "OK, I've learned" confirmation when generating summary
  const oldForSummary = nonCompressedOld.filter(
    (msg) => !(msg.role === "assistant"
      && Array.isArray(msg.content)
      && msg.content.length === 1
      && msg.content[0]?.text === "OK, I've learned about the previous conversation."),
  );

  // Notify UI that summarization is in progress
  callbacks?.onCompressionProgress?.("summarizing_history");

  const summary = await summarizeOldTurns(oldForSummary, existingSummary);

  // Mark oldPart messages as compressed (they will be kept in fullHistory but skipped for LLM)
  const compressedPart = oldPart.map((msg) => ({
    ...msg,
    _isCompressed: true,
  }));

  // Build fullHistory: summary + compressed messages (marked) + recent messages
  // This is stored in IndexedDB for user review
  const fullHistory = [
    { role: "user", content: `[Conversation History Summary]\n${summary}`, _isSummary: true },
    {
      role: "assistant",
      content: [{ type: "text", text: "OK, I've learned about the previous conversation." }],
      _isLearned: true,
    },
    ...compressedPart,
    ...recentPart,
  ];

  // Build llmHistory: summary + recent messages (skip _isCompressed messages)
  // This is sent to LLM, excluding compressed content
  let llmHistory = [
    { role: "user", content: `[Conversation History Summary]\n${summary}`, _isSummary: true },
    {
      role: "assistant",
      content: [{ type: "text", text: "OK, I've learned about the previous conversation." }],
      _isLearned: true,
    },
    ...recentPart,
  ];

  const postEstimate = estimateTokenCount(llmHistory);
  if (postEstimate > budget) {
    callbacks?.onCompressionProgress?.("compressing_tool_results");
    llmHistory = truncateLargeToolResults(llmHistory);
  }

  // Notify UI that compression is complete
  callbacks?.onCompressionEnd?.();

  return { fullHistory, llmHistory };
}

/**
 * Use LLM to summarize old conversation turns into a paragraph
 * Integrates with existing summary when provided
 * @param {Array} oldHistory - History to summarize
 * @param {string|null} existingSummary - Existing summary to integrate with
 * @returns {Promise<string>} - Summarized history
 */
export async function summarizeOldTurns(oldHistory, existingSummary = null) {
  const condensed = oldHistory
    .map((msg) => {
      if (msg.role === "user") {
        if (typeof msg.content === "string") return `User: ${msg.content}`;
        if (Array.isArray(msg.content)) {
          const parts = msg.content.map((c) => {
            if (c.type === "tool_result") {
              const toolContent = typeof c.content === "string"
                ? c.content
                : Array.isArray(c.content)
                  ? c.content.filter((x) => x.type === "text").map((x) => x.text).join(" ")
                  : JSON.stringify(c.content);
              return `[Tool Result: ${toolContent.slice(0, 800)}${toolContent.length > 800 ? "..." : ""}]`;
            }
            if (c.type === "text") return c.text;
            return "";
          });
          return `User: ${parts.filter(Boolean).join(" ")}`;
        }
        return "";
      }
      if (msg.role === "assistant") {
        const texts = (msg.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text.slice(0, 500));
        const tools = (msg.content || [])
          .filter((b) => b.type === "tool_use")
          .map((b) => `${b.name}(${JSON.stringify(b.input).slice(0, 100)})`);
        let s = "";
        if (texts.length) s += `Assistant: ${texts.join(" ")}`;
        if (tools.length) s += ` [Called: ${tools.join(", ")}]`;
        return s;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  if (!condensed.trim() && !existingSummary) return "(No history)";

  let userContent;
  let systemPrompt;

  if (existingSummary) {
    systemPrompt = `You are a conversation history compression assistant. Integrate the existing summary with new conversation content.

OUTPUT FORMAT (strict structure):
## Applied Styles
- [selector] { property: value; } (status: applied/reverted)
- ...

## User Preferences
- [preference type]: [specific description]
- ...

## Pending Requests
- [unfinished task description]

## Context Notes
- [important context for understanding recent requests]

RULES:
1. Merge new Applied Styles with existing ones; remove reverted/overwritten ones
2. Accumulate User Preferences; note conflicting preferences
3. Clear Pending Requests if completed in new content
4. Keep Context Notes concise (relevant for recent context only)
5. Total output under 400 words`;
    userContent = `[Existing Summary]\n${existingSummary}\n\n[New Conversation]\n${condensed || "(No new content)"}`;
  } else {
    systemPrompt = `You are a conversation history compression assistant. Compress conversation into structured summary.

OUTPUT FORMAT (strict structure):
## Applied Styles
- [selector] { property: value; } (status: applied)
- ...

## User Preferences
- [preference type]: [specific description]
- ...

## Pending Requests
- [unfinished task description]

## Context Notes
- [important context for understanding recent requests]

RULES:
1. Applied Styles: Extract exact CSS selectors and properties. Skip intermediate attempts, keep final state.
2. User Preferences: Extract explicit preferences (colors, fonts, spacing, etc.). Skip procedural exchanges.
3. Pending Requests: Only include explicitly stated but not yet fulfilled requests.
4. Context Notes: Only include context needed for recent request understanding.
5. Total output under 400 words.`;
    userContent = condensed;
  }

  try {
    const { getSettings, detectProvider, buildApiUrl } = await import("../api.js");
    const { apiKey, model, apiBase } = await getSettings();
    const provider = detectProvider(apiBase, model);

    let resp;
    if (provider === "claude") {
      resp = await fetch(buildApiUrl(apiBase, "/messages"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: [{ type: "text", text: userContent }] }],
          max_tokens: 800,
        }),
      });
    } else {
      resp = await fetch(buildApiUrl(apiBase, "/chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: 800,
        }),
      });
    }

    if (!resp.ok) {
      console.error("[History Compression] API error:", resp.status);
      return existingSummary || "(History summary generation failed)";
    }

    const data = await resp.json();
    if (data.choices) {
      return data.choices?.[0]?.message?.content || existingSummary || "(History summary generation failed)";
    }
    if (data.content) {
      return data.content?.find((b) => b.type === "text")?.text || existingSummary || "(History summary generation failed)";
    }
    return existingSummary || "(History summary generation failed)";
  } catch (err) {
    console.error("[History Compression] Failed:", err);
    return existingSummary || "(History summary generation failed)";
  }
}

// --- Large Content Truncation ---
// Truncate tool_result text over threshold, remove base64 images (but preserve recent images for vision model)

const TRUNCATE_THRESHOLD = 3000;
const KEEP_CHARS = 1000;

/**
 * Truncate tool_result text over TRUNCATE_THRESHOLD chars
 * Remove base64 images from older messages (preserve images in last user message for vision model)
 * @param {Array} messages - ICF message array
 * @returns {Array} - Truncated messages
 */
export function truncateLargeToolResults(messages) {
  // Find the last user message index - preserve images in this message
  let lastUserMsgIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserMsgIndex = i;
      break;
    }
  }

  console.log("[truncateLargeToolResults] Preserving images in last user message at index:", lastUserMsgIndex);

  return messages.map((msg, msgIndex) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;

    // Check if this is the last user message - we'll preserve its images
    const isLastUserMsg = msgIndex === lastUserMsgIndex;

    let changed = false;
    const newContent = msg.content.map((block) => {
      if (block.type === "image_url") {
        // Only remove if this is NOT the last user message (preserve recent images for vision model)
        if (!isLastUserMsg) {
          changed = true;
          console.log("[truncateLargeToolResults] Removing image from older message at index:", msgIndex);
          return { type: "text", text: "(Image removed to save context space)" };
        }
        console.log("[truncateLargeToolResults] Preserving image in last user message");
        return block; // Keep image in last user message
      }

      if (block.type !== "tool_result") return block;

      if (typeof block.content === "string" && block.content.length > TRUNCATE_THRESHOLD) {
        changed = true;
        return {
          ...block,
          content: block.content.slice(0, KEEP_CHARS) + "\n...(Content truncated to save context space)",
        };
      }

      if (Array.isArray(block.content)) {
        let innerChanged = false;
        const newInner = block.content
          .filter((c) => {
            if (c.type === "image_url") {
              // Only remove if this is NOT the last user message (preserve recent images)
              if (!isLastUserMsg) {
                innerChanged = true;
                console.log("[truncateLargeToolResults] Removing image from tool_result in older message at index:", msgIndex);
                return false;
              }
              console.log("[truncateLargeToolResults] Preserving image in tool_result in last user message");
              return true; // Keep image in last user message
            }
            return true;
          })
          .map((c) => {
            if (c.type === "text" && c.text && c.text.length > TRUNCATE_THRESHOLD) {
              innerChanged = true;
              return { ...c, text: c.text.slice(0, KEEP_CHARS) + "\n...(Content truncated to save context space)" };
            }
            return c;
          });
        if (innerChanged) {
          changed = true;
          const finalInner = newInner.length > 0 ? newInner : [{ type: "text", text: "(Content truncated to save context space)" }];
          return { ...block, content: finalInner };
        }
      }

      return block;
    });

    return changed ? { ...msg, content: newContent } : msg;
  });
}

// Export internal functions for reuse in agent-loop
export { estimateTextTokens, msgTokenEstimate };