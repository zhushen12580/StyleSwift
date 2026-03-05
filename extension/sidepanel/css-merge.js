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
// CSS 规则解析
// ============================================================================

/**
 * 解析 CSS 文本为结构化数据
 * 
 * 将 CSS 文本解析为 Map<selector, Map<prop, val>> 结构。
 * - 普通规则：按选择器+属性解析，属性存储在 Map 中
 * - at-rule（@media, @keyframes 等）：整体作为一个单元，使用 __raw__ 标记保留原始文本
 * 
 * @param {string} css - CSS 文本
 * @returns {Map<string, Map<string, string>>} 解析后的规则映射
 * 
 * @example
 * // 普通规则
 * parseRules('.header { color: red; font-size: 14px; }')
 * // → Map { '.header' => Map { 'color' => 'red', 'font-size' => '14px' } }
 * 
 * @example
 * // @media 规则
 * parseRules('@media (max-width: 600px) { .header { color: blue; } }')
 * // → Map { '@media (max-width: 600px)' => Map { '__raw__ => '@media (max-width: 600px) { .header { color: blue; } }' } }
 */
function parseRules(css) {
  const rules = new Map();
  if (!css?.trim()) return rules;

  const blocks = splitTopLevelBlocks(css);

  for (const block of blocks) {
    if (block.startsWith('@')) {
      // at-rule（@media, @keyframes 等）：整体作为一个单元，按 header 去重
      const headerEnd = block.indexOf('{');
      if (headerEnd === -1) continue;
      const header = block.slice(0, headerEnd).trim();
      rules.set(header, new Map([['__raw__', block]]));
    } else {
      // 普通规则：按选择器+属性去重
      const braceIdx = block.indexOf('{');
      if (braceIdx === -1) continue;
      const selector = block.slice(0, braceIdx).trim();
      const body = block.slice(braceIdx + 1, block.lastIndexOf('}'));
      const props = new Map();
      for (const decl of body.split(';')) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) continue;
        const prop = decl.slice(0, colonIdx).trim();
        const val = decl.slice(colonIdx + 1).trim();
        if (prop && val) props.set(prop, val);
      }
      rules.set(selector, props);
    }
  }

  return rules;
}

// ============================================================================
// 导出
// ============================================================================

export { splitTopLevelBlocks, parseRules };
