/**
 * StyleSwift - Style Tools
 *
 * Tools for CSS style management: apply, edit, and query styles.
 */

// =============================================================================
// apply_styles - 应用/回滚样式
// =============================================================================

export const APPLY_STYLES_TOOL = {
  name: "apply_styles",
  description: `应用或回滚CSS样式。

mode 说明：
- save: 注入CSS到页面并保存到当前会话（添加全新规则时使用）
- rollback_last: 回滚到上一次样式（撤销最近一次修改）
- rollback_all: 回滚所有已应用的样式

修改已有样式请用 edit_css 工具（更精准、省token）。`,
  input_schema: {
    type: "object",
    properties: {
      css: {
        type: "string",
        description: "CSS代码（save 模式必填，rollback 模式不需要）",
      },
      mode: {
        type: "string",
        enum: ["save", "rollback_last", "rollback_all"],
        description: "save=应用并保存, rollback_last=撤销最近一次修改, rollback_all=全部回滚",
      },
    },
    required: ["mode"],
  },
};

// =============================================================================
// get_current_styles - 获取当前已应用样式
// =============================================================================

export const GET_CURRENT_STYLES_TOOL = {
  name: "get_current_styles",
  description: `获取当前会话中已应用的全部CSS样式。

典型用途：
- 修改样式前先查看当前已有哪些规则
- 为 edit_css 获取精确的 old_css 内容
- 确认某条规则是否已经应用`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// edit_css - 精准编辑已应用样式
// =============================================================================

export const EDIT_CSS_TOOL = {
  name: "edit_css",
  description: `精准编辑已应用的CSS样式。通过精确匹配替换CSS片段，支持修改和删除。

使用方式：
- 先调用 get_current_styles 查看当前样式
- old_css 必须与 get_current_styles 返回内容精确匹配，包含空格和换行
- new_css 为替换后的内容，空字符串表示删除该片段
- 每次只替换第一处匹配

典型用途：
- 修改某个属性值（如改颜色、调字号）
- 删除某条规则
- 替换某个选择器的整个规则块`,
  input_schema: {
    type: "object",
    properties: {
      old_css: {
        type: "string",
        description: "要替换的 CSS 片段，必须与当前已应用样式中的内容精确匹配",
      },
      new_css: {
        type: "string",
        description: "替换后的 CSS 内容，空字符串表示删除",
      },
    },
    required: ["old_css", "new_css"],
  },
};

/**
 * Style tools handler factory
 * @param {object} deps - Dependencies
 * @param {function} deps.runApplyStyles - Apply styles function
 * @param {function} deps.runEditCSS - Edit CSS function
 * @param {function} deps.sendToContentScript - Send to content script function
 * @param {function} deps.currentSession - Current session getter
 * @returns {object} Handlers for style tools
 */
export function createStyleToolHandlers({ runApplyStyles, runEditCSS, sendToContentScript, getCurrentSession }) {
  return {
    apply_styles: async (args, context) =>
      await runApplyStyles(args.css || "", args.mode, context?.tabId),

    get_current_styles: async () => {
      const currentSession = getCurrentSession();
      if (!currentSession) return "(无活动会话)";
      const sKey = currentSession.stylesKey;
      const { [sKey]: css = "" } = await chrome.storage.local.get(sKey);
      return css.trim() || "(当前无已应用样式)";
    },

    edit_css: async (args, context) =>
      await runEditCSS(args.old_css, args.new_css, context?.tabId),
  };
}