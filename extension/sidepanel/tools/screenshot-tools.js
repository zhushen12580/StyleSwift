/**
 * StyleSwift - Screenshot Tools
 *
 * Tools for capturing page screenshots, used by QualityAudit sub-agent.
 */

// =============================================================================
// capture_screenshot - 截取页面可见区域
// =============================================================================

export const CAPTURE_SCREENSHOT_TOOL = {
  name: "capture_screenshot",
  description: "截取当前页面可见区域的截图，用于视觉分析页面样式效果。",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

/**
 * 截取指定 Tab 的可见区域
 *
 * @param {number} [tabId] - 目标 Tab ID（可选，优先于全局锁定）
 * @param {function} getTargetTabId - Function to get target tab ID
 * @returns {Promise<string>} base64 Data URL（data:image/png;base64,...）
 */
export async function captureScreenshot(tabId, getTargetTabId) {
  const targetTabId = tabId ?? (await getTargetTabId());
  const tab = await chrome.tabs.get(targetTabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  return dataUrl;
}

/**
 * Screenshot tools handler factory
 * @param {function} captureScreenshotFn - Capture screenshot function
 * @returns {object} Handlers for screenshot tools
 */
export function createScreenshotToolHandlers(captureScreenshotFn) {
  return {
    capture_screenshot: async (_args, context) => {
      const dataUrl = await captureScreenshotFn(context?.tabId);
      return dataUrl;
    },
  };
}