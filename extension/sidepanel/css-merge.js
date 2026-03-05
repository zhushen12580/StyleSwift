/**
 * StyleSwift - CSS Merge Engine
 * 
 * CSS 去重、合并、序列化逻辑
 * 
 * 主要功能：
 * - splitTopLevelBlocks: 正确处理嵌套花括号的顶层块分割
 * - parseRules: 解析 CSS 文本为结构化数据
 * - mergeCSS: 合并两段 CSS（属性级去重）
 * - serializeRules: 将结构化数据序列化为 CSS 文本
 */

// ============================================================================
// 顶层块分割
// ============================================================================

/**
 * 分割 CSS 为顶层块
 * 
 * 正确处理嵌套花括号（@media, @keyframes 等）的顶层块分割。
 * 通过追踪大括号深度，确保嵌套规则被正确识别为一个整体。
 * 
 * 核心逻辑：
 * 1. 遍历 CSS 字符串，追踪 `{` 和 `}` 的深度
 * 2. 当遇到 `{` 时深度 +1
 * 3. 当遇到 `}` 时深度 -1
 * 4. 当深度回到 0 时，说明找到了一个完整的顶层块
 * 
 * @param {string} css - CSS 文本
 * @returns {string[]} 顶层块数组，每个元素是一个完整的 CSS 块
 * 
 * @example
 * // 普通规则
 * splitTopLevelBlocks('.header { color: red; }')
 * // → ['.header { color: red; }']
 * 
 * @example
 * // @media 嵌套规则
 * splitTopLevelBlocks('@media (max-width: 600px) { .header { color: blue; } }')
 * // → ['@media (max-width: 600px) { .header { color: blue; } }']
 * 
 * @example
 * // 混合规则
 * splitTopLevelBlocks('.a { color: red; } @media print { .a { color: black; } } .b { margin: 0; }')
 * // → ['.a { color: red; }', '@media print { .a { color: black; } }', '.b { margin: 0; }']
 */
function splitTopLevelBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        // 找到一个完整的顶层块
        const block = css.slice(start, i + 1).trim();
        if (block) {
          blocks.push(block);
        }
        start = i + 1;
      }
    }
  }

  return blocks;
}

// ============================================================================
// 导出
// ============================================================================

export { splitTopLevelBlocks };
