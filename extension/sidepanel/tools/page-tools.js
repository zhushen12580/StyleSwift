/**
 * StyleSwift - Page Tools
 *
 * Tools for page structure analysis and element search.
 */

// =============================================================================
// get_page_structure - 获取页面结构
// =============================================================================

export const GET_PAGE_STRUCTURE_TOOL = {
  name: "get_page_structure",
  description:
    "获取当前页面的结构概览。返回树形结构，包含标签、选择器、关键样式。",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// grep - 元素搜索
// =============================================================================

export const GREP_TOOL = {
  name: "grep",
  description: `在当前页面中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）。

搜索方式（自动检测）：
- CSS 选择器：".sidebar", "nav > a.active", "#main h2"
- 关键词：在标签名、class、id、文本内容、样式值中匹配

典型用途：
- 看完 get_page_structure 概览后，深入查看某个区域的详情
- 查找具有特定样式值的元素
- 确认某个选择器是否存在、有多少匹配`,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "CSS 选择器或关键词" },
      scope: {
        type: "string",
        enum: ["self", "children", "subtree"],
        description:
          "返回详情范围：self=仅匹配元素本身，children=含直接子元素（默认），subtree=含完整子树（慎用）",
      },
      max_results: {
        type: "integer",
        description: "最多返回几个匹配元素，默认 5，最大 20",
      },
    },
    required: ["query"],
  },
};

/**
 * Page tools handler factory
 * @param {function} sendToContentScript - Function to send message to content script
 * @param {function} normalizeToolResult - Function to normalize tool result
 * @returns {object} Handlers for page tools
 */
export function createPageToolHandlers(sendToContentScript, normalizeToolResult) {
  return {
    get_page_structure: async (_args, context) =>
      normalizeToolResult(
        await sendToContentScript({ tool: "get_page_structure" }, context?.tabId),
      ),

    grep: async (args, context) =>
      normalizeToolResult(
        await sendToContentScript({
          tool: "grep",
          args: {
            query: args.query,
            scope: args.scope || "children",
            maxResults: args.max_results || 5,
          },
        }, context?.tabId),
      ),
  };
}