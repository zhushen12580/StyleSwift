/**
 * Agent Loop Module
 * Main agent loop orchestration - imports from modularized components.
 *
 * Split modules:
 * - message-serialization.js: ICF ↔ OpenAI/Claude format conversion
 * - system-prompt.js: SYSTEM_BASE and AGENT_TYPES configuration
 * - token-manager.js: Token budget and history compression
 * - llm-client.js: LLM API streaming calls
 */

import { BASE_TOOLS, SUBAGENT_TOOLS, ALL_TOOLS, getSkillManager } from "../tools.js";
import { SYSTEM_BASE, AGENT_TYPES } from "./system-prompt.js";
import {
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
import {
  AgentError,
  callLLMStream,
  callLLMStreamSafe,
  sleep,
} from "./llm-client.js";
// Re-export serialization functions for backward compatibility
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
} from "./message-serialization.js";

// --- Restricted Page Precheck (URLs where Content Script cannot be injected) ---

export const RESTRICTED_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^file:\/\//,
  /^https:\/\/chrome\.google\.com\/webstore/,
  /^https:\/\/microsoftedge\.microsoft\.com\/addons/,
];

export function isRestrictedPage(url) {
  return RESTRICTED_PATTERNS.some((p) => p.test(url));
}

/** Send message to Content Script to check page accessibility, return { ok, domain? } or { ok, reason } */
export async function checkPageAccess(tabId) {
  try {
    const domain = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { tool: "get_domain" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    return { ok: true, domain };
  } catch {
    return {
      ok: false,
      reason: "This page does not support style modifications (browser internal page or restricted page)",
    };
  }
}

// --- Session Context Building ---

/** Build [Session Context]: domain, session title, user preference in one line */
export function buildSessionContext(domain, sessionMeta, profileHint) {
  let ctx = `\n[Session Context]\nDomain: ${domain}\nSession: ${sessionMeta.title || "New Session"}\n`;

  if (profileHint) {
    ctx += `User Style Preference: ${profileHint} (details available via get_user_profile)\n`;
  }

  return ctx;
}

/** Get available skill descriptions and format as [Available Skills] block to inject into system */
export async function buildSkillDescriptions() {
  try {
    const manager = await getSkillManager();
    if (!manager) {
      return "";
    }
    const disabledSkills = await getDisabledSkills();
    const disabledUserSkills = await getDisabledUserSkills();

    const descriptions = await manager.getDescriptions(
      disabledSkills,
      disabledUserSkills,
    );
    if (!descriptions || descriptions === "(no skills available)") {
      return "";
    }
    return `\n[Available Skills]\n${descriptions}\n`;
  } catch (err) {
    console.warn("[Skill Descriptions] Failed to build:", err);
    return "";
  }
}

async function getDisabledSkills() {
  const DISABLED_SKILLS_KEY = "settings:disabledSkills";
  const { [DISABLED_SKILLS_KEY]: disabled = [] } =
    await chrome.storage.local.get(DISABLED_SKILLS_KEY);
  return disabled;
}

async function getDisabledUserSkills() {
  const DISABLED_USER_SKILLS_KEY = "settings:disabledUserSkills";
  const { [DISABLED_USER_SKILLS_KEY]: disabled = [] } =
    await chrome.storage.local.get(DISABLED_USER_SKILLS_KEY);
  return disabled;
}

// --- Main Loop Constants and State ---

export const MAX_ITERATIONS = 50;
export const SUB_MAX_ITERATIONS = 20;
let currentAbortController = null;
let isAgentRunning = false;
let toolCallHistory = [];
export const MAX_RETRIES = 2;
export const DUPLICATE_CALL_THRESHOLD = 5;

// --- Pending User Messages Queue ---
// Stores user messages sent during Agent loop execution
// These will be injected into the conversation before the next iteration

let pendingUserMessages = [];
let onQueuedMessageProcessed = null;

export function queueUserMessage(content) {
  if (!isAgentRunning) {
    console.log("[Agent] Not running, message not queued");
    return false;
  }

  const message = {
    role: "user",
    content: typeof content === "string" ? content : content,
    queuedAt: Date.now(),
  };

  pendingUserMessages.push(message);
  console.log("[Agent] User message queued for next iteration:", message);
  return true;
}

export function getPendingMessagesCount() {
  return pendingUserMessages.length;
}

export function clearPendingMessages() {
  pendingUserMessages = [];
}

export function setOnQueuedMessageProcessed(callback) {
  onQueuedMessageProcessed = callback;
}

// --- Dead Loop Protection ---

export function resetToolCallHistory() {
  toolCallHistory = [];
}

/** Tool name + stable argument serialization for deduplication */
export function generateToolCallKey(toolName, args) {
  try {
    const sortedArgs = sortObjectKeys(args);
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  } catch (error) {
    console.warn("[Tool Call Key] Failed to generate key:", error);
    return `${toolName}:${Date.now()}`;
  }
}

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/** CONSECUTIVE DUPLICATE_CALL_THRESHOLD calls with same tool+args is considered a dead loop */
export function detectDeadLoop(toolName, args) {
  const callKey = generateToolCallKey(toolName, args);
  toolCallHistory.push({
    name: toolName,
    args: args,
    key: callKey,
    timestamp: Date.now(),
  });
  if (toolCallHistory.length >= DUPLICATE_CALL_THRESHOLD) {
    const recentCalls = toolCallHistory.slice(-DUPLICATE_CALL_THRESHOLD);
    const allSame = recentCalls.every((call) => call.key === callKey);

    if (allSame) {
      console.warn("[Dead Loop Detection] Detected 3 consecutive identical tool calls:", {
        tool: toolName,
        args: args,
      });
      return true;
    }
  }

  return false;
}

/** Tool execution with up to MAX_RETRIES retries on failure */
export async function executeToolWithRetry(toolName, args, executor, context) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executor(toolName, args, context);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[Tool Retry] ${toolName} execution failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`,
          error,
        );
      } else {
        console.error(
          `[Tool Retry] ${toolName} execution failed, max retries reached`,
          error,
        );
        return `Tool ${toolName} execution failed: ${error.message || error}. Retried ${MAX_RETRIES} times but still failed.`;
      }
    }
  }
  return `Tool ${toolName} execution failed: ${lastError?.message || lastError}`;
}

// --- Subagent Execution (isolated context, QualityAudit auto-screenshot injection to first message) ---

export async function runTask(description, prompt, agentType, abortSignal, tabId, uiCallbacks) {
  const config = AGENT_TYPES[agentType];

  if (!config) {
    return `Unknown subagent type: ${agentType}`;
  }

  const subCb = uiCallbacks ?? {};

  let enrichedPrompt = prompt;
  try {
    const { getProfileOneLiner } = await import("../profile.js");
    const profileHint = await getProfileOneLiner();
    if (profileHint) {
      enrichedPrompt = `[User Style Preference: ${profileHint}]\n\n${prompt}`;
    }
  } catch (_) {}

  const subSystem = `${config.prompt}\n\nReturn a clear, concise summary after completing the task.`;

  const subTools =
    config.tools === "*"
      ? SUBAGENT_TOOLS
      : SUBAGENT_TOOLS.filter((t) => config.tools.includes(t.name));

  const { executeTool, getTargetTabId, captureScreenshot } =
    await import("../tools.js");

  const resolvedTabId = tabId ?? await getTargetTabId();
  let firstUserContent;
  if (agentType === "QualityAudit") {
    try {
      const dataUrl = await captureScreenshot(resolvedTabId);
      firstUserContent = [
        { type: "text", text: enrichedPrompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    } catch (err) {
      console.warn("[Subagent] Screenshot failed, using text-only:", err);
      firstUserContent = enrichedPrompt;
    }
  } else {
    firstUserContent = enrichedPrompt;
  }

  const SUB_TOKEN_BUDGET = 40000;
  const subMessages = [{ role: "user", content: firstUserContent }];
  let iterations = 0;
  let subToolCallHistory = [];
  let subLastInputTokens = 0;

  while (iterations++ < SUB_MAX_ITERATIONS) {
    if (abortSignal?.aborted) {
      return "(Subagent cancelled)";
    }

    try {
      let currentSubMessages;
      if (iterations === 1) {
        currentSubMessages = subMessages;
      } else {
        const [firstMsg, ...restMsgs] = subMessages;
        let strippedFirst;
        if (Array.isArray(firstMsg.content)) {
          const textOnly = firstMsg.content.filter((c) => c.type === "text");
          strippedFirst = {
            role: "user",
            content: textOnly.length > 0 ? textOnly : firstMsg.content,
          };
        } else {
          strippedFirst = firstMsg;
        }
        currentSubMessages = [strippedFirst, ...restMsgs];
      }

      const subTokenCount = subLastInputTokens > 0
        ? subLastInputTokens + msgTokenEstimate(currentSubMessages[currentSubMessages.length - 1])
        : estimateTokenCount(currentSubMessages);
      if (subTokenCount > SUB_TOKEN_BUDGET) {
        currentSubMessages = truncateLargeToolResults(currentSubMessages);
      }

      const response = await callLLMStreamSafe(
        subSystem,
        currentSubMessages,
        subTools,
        {
          onReasoning: (delta) => subCb.appendReasoning?.(delta),
          onText: (delta) => subCb.appendText?.(delta),
          onToolCall: (block) => subCb.showToolCall?.(block),
          onStatus: (msg) => subCb.appendText?.(msg),
        },
        abortSignal,
      );

      subLastInputTokens = response.usage?.input_tokens || 0;
      const subAssistantMsg = { role: "assistant", content: response.content };
      if (response.reasoning) subAssistantMsg._reasoning = response.reasoning;
      subMessages.push(subAssistantMsg);

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock?.text || "(Subagent has no output)";
      }

      const results = [];
      for (const block of response.content) {
        if (abortSignal?.aborted) return "(Subagent cancelled)";

        if (block.type === "tool_use") {
          const callKey = generateToolCallKey(block.name, block.input);
          subToolCallHistory.push(callKey);
          if (subToolCallHistory.length >= DUPLICATE_CALL_THRESHOLD) {
            const recent = subToolCallHistory.slice(-DUPLICATE_CALL_THRESHOLD);
            if (recent.every((k) => k === callKey)) {
              return `(Subagent detected dead loop: ${block.name} called ${DUPLICATE_CALL_THRESHOLD} times consecutively)`;
            }
          }
          if (block.name === "capture_screenshot") {
            try {
              const dataUrl = await captureScreenshot(resolvedTabId);
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: [
                  {
                    type: "text",
                    text: `Screenshot captured. Please analyze this page screenshot against the following dimensions:

**Visual Analysis Checklist (Check each item, record issues immediately upon discovery)**

1. **Contrast**: Scan all text areas—are there insufficient contrast ratios between light text/light backgrounds and dark text/dark backgrounds (target WCAG AA ≥4.5:1)? Small fonts (<18px) need particular attention.

2. **Visibility**: Is any content obscured, cropped, or overflowing container boundaries? Is button/link text clearly legible? Are any elements completely invisible (excessive transparency, colors matching background)?

3. **Consistency**: Do similar elements (same-level headings, all links, all cards, all buttons) have unified appearance? Are there any unmatured elements of the same type?

4. **Color Harmony**: Do new colors harmonize with the overall page tone? Are there color conflicts, jarring combinations, or obvious mismatches with brand colors?

5. **Layout Integrity**: Are there element position shifts, unexpected wrapping, spacing anomalies (too large/too small/asymmetric), or broken alignment? Does horizontal scrollbar appear?

6. **Touch Targets**: Are interactive elements (buttons, links, inputs) sufficiently large (target ≥44×44px)?

7. **AI Traces**: Are there typical AI-generated style characteristics—gradient text, stacked glassmorphism cards, excessive rounded corners, cookie-cutter hero number display areas, gray text over colored backgrounds?

8. **Overall Impression**: Does the page look "finished" and professional? What's already done well that's worth preserving?

Please provide specific observations based on the above dimensions (with issue location, e.g., "second link text in left navigation..."), avoid vague descriptions.`,
                  },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              });
            } catch (err) {
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Screenshot failed: ${err.message}`,
              });
            }
            subCb.showToolResult?.(block.id, "Screenshot captured");
            continue;
          }

          subCb.showToolExecuting?.(block.name);
          const output = await executeTool(block.name, block.input, { tabId: resolvedTabId, abortSignal });
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: output,
          });
          subCb.showToolResult?.(block.id, output);
        }
      }

      if (results.length > 0) {
        subMessages.push({ role: "user", content: results });
      }
    } catch (error) {
      if (error.name === "AbortError") return "(Subagent cancelled)";
      console.error("[Subagent] Error:", error);
      return `(Subagent execution failed: ${error.message})`;
    }
  }

  return "(Subagent reached max iterations, returning existing results)";
}

// --- agentLoop Main Loop ---

/** Main loop: concurrency protection → Tab lock → session/history → system(L0+L1) → streaming API → tool execution → persistence/title */
export async function agentLoop(prompt, uiCallbacks) {
  if (isAgentRunning) {
    uiCallbacks.appendText?.("(Processing in progress, please wait for the current request to complete)");
    return;
  }

  isAgentRunning = true;
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;
  resetToolCallHistory();
  const { resetTodos, setTodoUpdateCallback } =
    await import("./todo-manager.js");
  resetTodos();
  setTodoUpdateCallback(uiCallbacks.onTodoUpdate || null);
  const { getTargetTabId, lockTab, unlockTab, executeTool, captureScreenshot } =
    await import("../tools.js");
  const {
    getOrCreateSession,
    loadAndPrepareHistory,
    saveHistory,
    loadSessionMeta,
    saveSessionMeta,
    SessionContext,
    setCurrentSession,
    currentSession,
    countUserTextMessages,
  } = await import("../session.js");
  const { getProfileOneLiner   } = await import("../profile.js");
  const { getSettings, DEFAULT_MODEL } = await import("../api.js");

  // Get model name for dynamic token budget calculation
  let currentModelName = DEFAULT_MODEL;
  try {
    const settings = await getSettings();
    currentModelName = settings.model || DEFAULT_MODEL;
  } catch (err) {
    console.warn("[Token Budget] Failed to get model name, using default:", err);
  }
  const tokenBudget = getDynamicTokenBudget(currentModelName);

  let _saveState = null;

  try {
    const tabId = await getTargetTabId();
    lockTab(tabId);

    const access = await checkPageAccess(tabId);
    if (!access.ok) {
      uiCallbacks.appendText?.(access.reason);
      return;
    }
    const domain = access.domain || "unknown";
    const sessionId = await getOrCreateSession(domain);
    const session = new SessionContext(domain, sessionId);
    setCurrentSession(session);
    const historyData = await loadAndPrepareHistory(domain, sessionId);
    let fullHistory = historyData.messages;
    const snapshots = historyData.snapshots;
    _saveState = { domain, sessionId, fullHistory, snapshots, saveHistory };

    const sessionMeta = await loadSessionMeta(domain, sessionId);
    const profileHint = await getProfileOneLiner();
    const skillDescriptions = await buildSkillDescriptions();
    const system =
      SYSTEM_BASE +
      buildSessionContext(domain, sessionMeta, profileHint) +
      skillDescriptions;

    let textOnlyContent;
    if (typeof prompt === "string") {
      textOnlyContent = prompt;
    } else if (Array.isArray(prompt)) {
      textOnlyContent = prompt
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    } else {
      textOnlyContent = "";
    }
    const userMsg = { role: "user", content: textOnlyContent };
    fullHistory.push(userMsg);
    let llmHistory = extractEffectiveHistory(fullHistory);

    let lastInputTokens = 0;
    let response;
    let iterations = 0;
    let isFirstIteration = true;
    const hasImagesInPrompt =
      Array.isArray(prompt) && prompt.some((c) => c.type === "image_url");

    const systemAndToolsOverhead =
      estimateTokenCount(system) +
      estimateTokenCount(JSON.stringify(ALL_TOOLS));

    while (iterations++ < MAX_ITERATIONS) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // --- Inject pending user messages at the start of each iteration ---
      if (pendingUserMessages.length > 0) {
        console.log(`[Agent] Injecting ${pendingUserMessages.length} pending user message(s) at iteration ${iterations}`);
        for (const pendingMsg of pendingUserMessages) {
          const userInjectMsg = {
            role: "user",
            content: pendingMsg.content,
            _queuedAt: pendingMsg.queuedAt,
          };
          fullHistory.push(userInjectMsg);
          llmHistory.push(userInjectMsg);

          if (onQueuedMessageProcessed && typeof pendingMsg.content === "string") {
            onQueuedMessageProcessed(pendingMsg.content);
          }
        }
        pendingUserMessages = [];
      }

      if (iterations > 1) {
        uiCallbacks.onNewIteration?.();
      }
      const tokenCount = lastInputTokens > 0
        ? lastInputTokens + msgTokenEstimate(llmHistory[llmHistory.length - 1])
        : estimateTokenCount(llmHistory, systemAndToolsOverhead);

      console.log("[Token Budget] Check:", {
        iteration: iterations,
        tokenCount,
        tokenBudget,
        lastInputTokens,
        historyLength: llmHistory.length,
        willCompress: tokenCount > tokenBudget,
      });

      if (tokenCount > tokenBudget) {
        console.log("[Token Budget] Triggering compression...");
        const compressionResult = await checkAndCompressHistory(llmHistory, tokenCount, uiCallbacks, tokenBudget);
        fullHistory = compressionResult.fullHistory;
        llmHistory = compressionResult.llmHistory;
        lastInputTokens = 0;
      }
      let currentLlmHistory = llmHistory;
      if (isFirstIteration && hasImagesInPrompt) {
        currentLlmHistory = [
          ...llmHistory.slice(0, -1),
          { role: "user", content: prompt },
        ];
      }
      isFirstIteration = false;
      response = await callLLMStreamSafe(
        system,
        currentLlmHistory,
        ALL_TOOLS,
        {
          onReasoning: (delta) => uiCallbacks.appendReasoning?.(delta),
          onText: (delta) => uiCallbacks.appendText?.(delta),
          onToolCall: (block) => uiCallbacks.showToolCall?.(block),
          onStatus: (msg) => uiCallbacks.appendText?.(msg),
        },
        signal,
      );
      lastInputTokens = response.usage?.input_tokens || 0;
      const assistantMsg = { role: "assistant", content: response.content };
      const fullMsg = response.reasoning
        ? { ...assistantMsg, _reasoning: response.reasoning }
        : assistantMsg;
      fullHistory.push(fullMsg);
      llmHistory.push(fullMsg);
      if (response.stop_reason !== "tool_use") {
        if (pendingUserMessages.length > 0) {
          console.log(`[Agent] No more tool calls, but ${pendingUserMessages.length} user message(s) pending. Injecting and continuing...`);
          for (const pendingMsg of pendingUserMessages) {
            const userInjectMsg = {
              role: "user",
              content: pendingMsg.content,
              _queuedAt: pendingMsg.queuedAt,
            };
            fullHistory.push(userInjectMsg);
            llmHistory.push(userInjectMsg);
          }
          pendingUserMessages = [];
          continue;
        }
        break;
      }
      const results = [];
      let planCancelled = false;
      for (const block of response.content) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        if (block.type === "tool_use") {
          if (planCancelled) {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "已跳过：用户取消了任务计划。",
            });
            continue;
          }
          if (detectDeadLoop(block.name, block.input)) {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `⚠️ Duplicate call detected: ${block.name} has been called ${DUPLICATE_CALL_THRESHOLD} times with the same parameters. Result will not change. Please try a different approach, such as using different tools, adjusting parameters, or responding directly.`,
            });
            resetToolCallHistory();
            continue;
          }
          uiCallbacks.showToolExecuting?.(block.name);
          if (block.name === "capture_screenshot") {
            try {
              const dataUrl = await captureScreenshot(tabId);
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: [
                  {
                    type: "text",
                    text: `Screenshot captured. Please analyze this page screenshot against the following dimensions:

**Visual Analysis Checklist (Check each item, record issues immediately upon discovery)**

1. **Contrast**: Scan all text areas—are there insufficient contrast ratios between light text/light backgrounds and dark text/dark backgrounds (target WCAG AA ≥4.5:1)? Small fonts (<18px) need particular attention.

2. **Visibility**: Is any content obscured, cropped, or overflowing container boundaries? Is button/link text clearly legible? Are any elements completely invisible (excessive transparency, colors matching background)?

3. **Consistency**: Do similar elements (same-level headings, all links, all cards, all buttons) have unified appearance? Are there any unmatured elements of the same type?

4. **Color Harmony**: Do new colors harmonize with the overall page tone? Are there color conflicts, jarring combinations, or obvious mismatches with brand colors?

5. **Layout Integrity**: Are there element position shifts, unexpected wrapping, spacing anomalies (too large/too small/asymmetric), or broken alignment? Does horizontal scrollbar appear?

6. **Touch Targets**: Are interactive elements (buttons, links, inputs) sufficiently large (target ≥44×44px)?

7. **AI Traces**: Are there typical AI-generated style characteristics—gradient text, stacked glassmorphism cards, excessive rounded corners, cookie-cutter hero number display areas, gray text over colored backgrounds?

8. **Overall Impression**: Does the page look "finished" and professional? What's already done well that's worth preserving?

Please provide specific observations based on the above dimensions (with issue location, e.g., "second link text in left navigation..."), avoid vague descriptions.`,
                  },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              });
            } catch (err) {
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Screenshot failed: ${err.message}`,
              });
            }
            uiCallbacks.showToolResult?.(block.id, "Screenshot captured");
            continue;
          }
          const toolContext = { abortSignal: signal, tabId, uiCallbacks };
          if (block.name === "Task" && uiCallbacks.onTaskStart) {
            toolContext.uiCallbacks = uiCallbacks.onTaskStart(block.id, block.input);
          }
          const output = await executeToolWithRetry(
            block.name,
            block.input,
            executeTool,
            toolContext,
          );
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: output,
          });
          uiCallbacks.showToolResult?.(block.id, output);
          if (block.name === "TodoWrite") {
            const { isAwaitingConfirmation, requestConfirmation } =
              await import("./todo-manager.js");
            if (isAwaitingConfirmation()) {
              const abortPromise = new Promise((resolve) => {
                const onAbort = () => resolve({ confirmed: false, aborted: true });
                if (signal.aborted) { onAbort(); return; }
                signal.addEventListener("abort", onAbort, { once: true });
              });

              const confirmation = await Promise.race([
                requestConfirmation(),
                abortPromise,
              ]);

              if (confirmation.aborted) {
                throw new DOMException("Aborted", "AbortError");
              }
              const lastResult = results[results.length - 1];
              if (confirmation.confirmed) {
                const planText = confirmation.todos
                  .map((t, i) => `${i + 1}. ${t.content}`)
                  .join("\n");
                lastResult.content = `User confirmed the task plan. Please execute according to the following steps:\n${planText}`;
              } else {
                lastResult.content = "User cancelled the task plan. Please ask what adjustments the user needs.";
                planCancelled = true;
              }
            }
          }
        }
      }
      const toolResultMsg = { role: "user", content: results };
      fullHistory.push(toolResultMsg);
      llmHistory.push(toolResultMsg);
    }
    if (iterations >= MAX_ITERATIONS) {
      uiCallbacks.appendText?.("\n(Max iterations reached, stopping automatically)");
    }
    const turnNumber = countUserTextMessages(fullHistory);
    const snapshotResult = await chrome.storage.local.get(session.stylesKey);
    snapshots[turnNumber] = snapshotResult[session.stylesKey] || "";
    await saveHistory(domain, sessionId, { messages: fullHistory, snapshots });
    if (!sessionMeta.title) {
      sessionMeta.title = textOnlyContent.slice(0, 20);
      await saveSessionMeta(domain, sessionId, sessionMeta);
    }
    const textParts = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text);
    return textParts.join("");
  } catch (err) {
    if (err.name === "AbortError") {
      uiCallbacks.appendText?.("\n(Cancelled)");
      if (_saveState) {
        try {
          const { domain, sessionId, fullHistory, snapshots } = _saveState;
          await saveHistory(domain, sessionId, { messages: fullHistory, snapshots });
          console.log("[Agent] History saved after cancellation");
        } catch (saveErr) {
          console.error("[Agent] Failed to save history after cancellation:", saveErr);
        }
      }
      return;
    }

    if (err instanceof AgentError) {
      const userMessages = {
        API_KEY_INVALID: "\n⚠️ Invalid API Key, please check in settings.",
        NETWORK_ERROR: "\n⚠️ Network connection failed, please check your network and try again.",
        RATE_LIMITED: "\n⚠️ API rate limit exceeded, please try again later.",
        MAX_RETRIES: "\n⚠️ API retry limit reached, please try again later.",
        CONTEXT_TOO_LONG: "\n⚠️ Conversation exceeds model context length limit, auto-compression applied but still over limit. Please try starting a new session.",
      };
      uiCallbacks.appendText?.(userMessages[err.code] || `\n⚠️ ${err.message}`);
      if (_saveState) {
        try {
          const { domain, sessionId, fullHistory, snapshots } = _saveState;
          await saveHistory(domain, sessionId, { messages: fullHistory, snapshots });
        } catch {}
      }
      return;
    }

    throw err;
  } finally {
    isAgentRunning = false;
    currentAbortController = null;
    clearPendingMessages();
    unlockTab();
  }
}

/** Cancel current Agent Loop (abort + unlock Tab) */
export function cancelAgentLoop() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  isAgentRunning = false;
  clearPendingMessages();
  import("../tools.js")
    .then(({ unlockTab }) => {
      unlockTab();
    })
    .catch((err) => {
      console.error("[Agent] Failed to unlock tab:", err);
    });
}

export function getIsAgentRunning() {
  return isAgentRunning;
}

export function getCurrentAbortController() {
  return currentAbortController;
}

// Re-export from tools.js for backward compatibility
export { BASE_TOOLS, SUBAGENT_TOOLS, ALL_TOOLS };

// Re-export from system-prompt.js
export { SYSTEM_BASE, AGENT_TYPES };

// Re-export from token-manager.js
export {
  DEFAULT_TOKEN_BUDGET,
  getDynamicTokenBudget,
  findKeepBoundary,
  checkAndCompressHistory,
  extractEffectiveHistory,
  summarizeOldTurns,
  estimateTokenCount,
  truncateLargeToolResults,
};

// Re-export from llm-client.js
export { AgentError, callLLMStream, callLLMStreamSafe };