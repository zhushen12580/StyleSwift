/**
 * Message Serialization Module
 * Handles conversion between ICF (Internal Canonical Format) and provider-specific formats
 * (OpenAI and Claude), including streaming SSE parsing.
 */

// --- ICF → OpenAI  serialization ---
// ICF: Internal Canonical Format, unified message format used within StyleSwift

/** ICF messages → OpenAI messages */
export function serializeToOpenAI(system, messages) {
  const result = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      const userContent = Array.isArray(msg.content)
        ? msg.content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text };
            if (c.type === "image_url") return { type: "image_url", image_url: c.image_url };
            if (c.type === "tool_result") {
              // OpenAI tool_result format
              const toolContent = typeof c.content === "string"
                ? c.content
                : Array.isArray(c.content)
                  ? c.content.filter((x) => x.type === "text").map((x) => x.text).join("\n")
                  : JSON.stringify(c.content);
              return { type: "text", text: toolContent };
            }
            return { type: "text", text: JSON.stringify(c) };
          })
        : msg.content;
      result.push({ role: "user", content: userContent });
    } else if (msg.role === "assistant") {
      // OpenAI assistant: text + tool_calls array
      const textBlocks = (msg.content || []).filter((b) => b.type === "text");
      const toolBlocks = (msg.content || []).filter((b) => b.type === "tool_use");

      const textContent = textBlocks.map((b) => b.text).join("\n");
      const toolCalls = toolBlocks.map((b) => ({
        id: b.id,
        type: "function",
        function: {
          name: b.name,
          arguments: JSON.stringify(b.input || {}),
        },
      }));

      const assistantMsg = { role: "assistant" };
      if (textContent) assistantMsg.content = textContent;
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      result.push(assistantMsg);
    }
  }

  return result;
}

/** ICF tools → OpenAI tools */
export function serializeToolsToOpenAI(tools) {
  return tools?.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// --- ICF → Claude serialization ---
// Claude uses content blocks array format, system separate from messages

/** ICF messages → Claude messages */
export function serializeToClaude(messages) {
  const result = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // Claude uses separate system param

    if (msg.role === "user") {
      // Claude user: content blocks array
      const claudeContent = [];
      if (typeof msg.content === "string") {
        claudeContent.push({ type: "text", text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c.type === "text") {
            claudeContent.push({ type: "text", text: c.text });
          } else if (c.type === "image_url") {
            // Claude image format: { type: "image", source: { ... } }
            const imageUrl = c.image_url?.url || "";
            if (imageUrl.startsWith("data:")) {
              // Base64 data URL
              const [mediaType, data] = imageUrl.slice(5).split(";base64,");
              claudeContent.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/png",
                  data: data || imageUrl,
                },
              });
            } else {
              // URL reference (Claude supports URL source type)
              claudeContent.push({
                type: "image",
                source: {
                  type: "url",
                  url: imageUrl,
                },
              });
            }
          } else if (c.type === "tool_result") {
            // Claude tool_result format
            const toolContent = typeof c.content === "string"
              ? [{ type: "text", text: c.content }]
              : Array.isArray(c.content)
                ? c.content.map((x) => {
                    if (x.type === "text") return { type: "text", text: x.text };
                    if (x.type === "image_url") {
                      const imgUrl = x.image_url?.url || "";
                      if (imgUrl.startsWith("data:")) {
                        const [mediaType, data] = imgUrl.slice(5).split(";base64,");
                        return {
                          type: "image",
                          source: {
                            type: "base64",
                            media_type: mediaType || "image/png",
                            data: data || imgUrl,
                          },
                        };
                      }
                      return {
                        type: "image",
                        source: { type: "url", url: imgUrl },
                      };
                    }
                    return { type: "text", text: JSON.stringify(x) };
                  })
                : [{ type: "text", text: JSON.stringify(c.content) }];

            claudeContent.push({
              type: "tool_result",
              tool_use_id: c.tool_use_id,
              content: toolContent,
            });
          }
        }
      }

      // Claude requires user message to have non-empty content
      if (claudeContent.length === 0) {
        claudeContent.push({ type: "text", text: "" });
      }

      result.push({ role: "user", content: claudeContent });
    } else if (msg.role === "assistant") {
      // Claude assistant: content blocks array
      const claudeContent = [];
      const textBlocks = (msg.content || []).filter((b) => b.type === "text");
      const toolBlocks = (msg.content || []).filter((b) => b.type === "tool_use");

      for (const b of textBlocks) {
        claudeContent.push({ type: "text", text: b.text });
      }
      for (const b of toolBlocks) {
        claudeContent.push({
          type: "tool_use",
          id: b.id,
          name: b.name,
          input: b.input || {},
        });
      }

      // Merge consecutive assistant messages (Claude doesn't allow multiple assistant in sequence)
      const last = result[result.length - 1];
      if (last && last.role === "assistant") {
        last.content = [...last.content, ...claudeContent];
      } else {
        result.push({ role: "assistant", content: claudeContent });
      }
    }
  }

  return result;
}

/** ICF tools → Claude tools */
export function serializeToolsToClaude(tools) {
  return tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

// --- OpenAI Streaming → ICF ---
// Parse OpenAI SSE stream events and accumulate into ICF format

/**
 * Parse OpenAI SSE line, accumulate to state, trigger callbacks
 * @param {string} line - SSE line (e.g., "data: {...}")
 * @param {Object} state - Accumulator state { text, reasoning, toolCalls, stopReason, usage }
 * @param {Object} callbacks - { onReasoning, onText, onToolCall }
 */
export function parseOpenAIStreamLine(line, state, callbacks) {
  if (!line.startsWith("data: ") || line.trim() === "data: [DONE]") return;

  try {
    const data = JSON.parse(line.slice(6));
    const choice = data.choices?.[0];
    if (!choice) return;

    const delta = choice.delta;

    if (delta.reasoning_content) {
      state.reasoning += delta.reasoning_content;
      callbacks.onReasoning?.(delta.reasoning_content);
    }

    if (delta.content) {
      state.text += delta.content;
      callbacks.onText?.(delta.content);
    }

    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const idx = toolCall.index;
        if (!state.toolCalls[idx]) {
          state.toolCalls[idx] = {
            id: toolCall.id || `call_${Date.now()}_${idx}`,
            type: "tool_use",
            name: toolCall.function?.name || "",
            input: "",
          };
        }
        if (toolCall.function?.name) state.toolCalls[idx].name = toolCall.function.name;
        if (toolCall.function?.arguments) state.toolCalls[idx].input += toolCall.function.arguments;
      }
    }

    if (choice.finish_reason) {
      state.stopReason = choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason;
    }

    if (data.usage) {
      state.usage = {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
      };
    }
  } catch (e) {
    console.warn("[Stream/OpenAI] Failed to parse SSE line:", line, e);
  }
}

/** OpenAI stream state → ICF assistant message */
export function finalizeOpenAIStream(state, callbacks) {
  const content = [];

  if (state.text) {
    content.push({ type: "text", text: state.text });
  }

  for (const toolCall of state.toolCalls) {
    if (toolCall && toolCall.name) {
      try {
        toolCall.input = JSON.parse(toolCall.input);
      } catch {
        toolCall.input = {};
      }
      callbacks.onToolCall?.(toolCall);
      content.push(toolCall);
    }
  }

  return {
    content,
    stop_reason: state.stopReason,
    usage: state.usage,
    reasoning: state.reasoning || null,
  };
}

// --- Claude Streaming → ICF ---
// Parse Claude SSE stream events (content_block_start/delta/stop, message_delta, message_start)

/**
 * Parse Claude SSE line, accumulate to state, trigger callbacks
 * @param {string} eventType - SSE event type (content_block_start, content_block_delta, etc.)
 * @param {string} line - SSE data line
 * @param {Object} state - Accumulator state { blocks, reasoning, stopReason, usage }
 * @param {Object} callbacks - { onReasoning, onText, onToolCall }
 */
export function parseClaudeStreamLine(eventType, line, state, callbacks) {
  if (!line.startsWith("data: ")) return;

  try {
    const data = JSON.parse(line.slice(6));

    if (eventType === "content_block_start") {
      const block = data.content_block;
      const idx = data.index;
      if (block.type === "text") {
        state.blocks[idx] = { type: "text", text: "" };
      } else if (block.type === "tool_use") {
        state.blocks[idx] = {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: "",
        };
      }
    } else if (eventType === "content_block_delta") {
      const idx = data.index;
      const delta = data.delta;
      const block = state.blocks[idx];
      if (!block) return;

      if (delta.type === "text_delta") {
        block.text += delta.text;
        callbacks.onText?.(delta.text);
      } else if (delta.type === "thinking_delta") {
        state.reasoning += delta.thinking;
        callbacks.onReasoning?.(delta.thinking);
      } else if (delta.type === "input_json_delta") {
        block.input += delta.partial_json;
      }
    } else if (eventType === "content_block_stop") {
      // No action needed, block already accumulated
    } else if (eventType === "message_delta") {
      if (data.delta?.stop_reason) {
        state.stopReason =
          data.delta.stop_reason === "tool_use" ? "tool_use" : data.delta.stop_reason;
      }
      if (data.usage) {
        state.usage = {
          input_tokens: state.usage?.input_tokens || 0,
          output_tokens: data.usage.output_tokens,
        };
      }
    } else if (eventType === "message_start") {
      if (data.message?.usage) {
        state.usage = {
          input_tokens: data.message.usage.input_tokens,
          output_tokens: data.message.usage.output_tokens || 0,
        };
      }
    }
  } catch (e) {
    console.warn("[Stream/Claude] Failed to parse SSE line:", eventType, line, e);
  }
}

/** Claude stream state → ICF assistant message */
export function finalizeClaudeStream(state, callbacks) {
  const content = [];

  for (const block of state.blocks) {
    if (!block) continue;

    if (block.type === "text" && block.text) {
      content.push({ type: "text", text: block.text });
    } else if (block.type === "tool_use" && block.name) {
      let input = {};
      try {
        input = JSON.parse(block.input);
      } catch {
        input = {};
      }
      const toolBlock = { ...block, input };
      callbacks.onToolCall?.(toolBlock);
      content.push(toolBlock);
    }
  }

  return {
    content,
    stop_reason: state.stopReason,
    usage: state.usage,
    reasoning: state.reasoning || null,
  };
}

// --- Image Detection and Stripping ---
// Used for vision model detection and non-vision rounds

/**
 * Check if last message contains images (determines whether to use vision model)
 * @param {Array} messages - ICF message array
 * @returns {boolean} - True if last user message has images
 */
export function detectImages(messages) {
  if (!messages?.length) return false;

  const last = messages[messages.length - 1];

  if (last.role !== "user") return false;

  if (!Array.isArray(last.content)) return false;

  for (const c of last.content) {
    if (c.type === "image_url") return true;

    if (c.type === "tool_result" && Array.isArray(c.content)) {
      if (c.content.some((inner) => inner.type === "image_url")) return true;
    }
  }

  return false;
}

/**
 * Strip all images from messages (non-vision rounds don't send images to main model)
 * @param {Array} messages - ICF message array
 * @returns {Array} - Messages without images
 */
export function stripImagesFromMessages(messages) {
  return messages.map((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const stripped = msg.content
      .filter((c) => c.type !== "image_url")
      .map((c) => {
        if (c.type === "tool_result" && Array.isArray(c.content)) {
          const textOnly = c.content.filter((inner) => inner.type !== "image_url");
          return { ...c, content: textOnly.length > 0 ? textOnly : [{ type: "text", text: "(Image omitted)" }] };
        }
        return c;
      });
    return { ...msg, content: stripped };
  });
}