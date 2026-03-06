/**
 * StyleSwift Content Script
 * DOM 操作层：页面结构获取、搜索、CSS 注入/回滚、消息监听
 * 
 * 设计方案参考：§3.1.2 常量定义
 */

'use strict';

// === 常量定义 ===

/**
 * DOM 元素标签白名单
 * 仅处理这些标签的元素，过滤掉 script、style、meta 等非视觉元素
 */
const TAG_WHITELIST = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img',
  'form', 'input', 'button', 'select', 'textarea', 'label',
  'section', 'article', 'nav', 'header', 'footer', 'aside', 'main',
  'blockquote', 'figure', 'figcaption', 'details', 'summary',
  'video', 'audio', 'dialog'
]);

/**
 * 语义化地标标签
 * 这些标签代表页面的主要结构区域，需要更深层次的遍历
 */
const LANDMARKS = new Set([
  'header', 'nav', 'main', 'aside', 'footer', 'article', 'section'
]);

/**
 * CSS 样式属性白名单
 * 仅提取这些计算样式，避免冗余信息
 */
const STYLE_WHITELIST = [
  'display', 'position', 'float', 'clear',
  'flex-direction', 'justify-content', 'align-items', 'flex-wrap',
  'grid-template-columns', 'grid-template-rows', 'gap',
  'width', 'height', 'max-width', 'max-height',
  'padding', 'margin',
  'background-color', 'color', 'border-color', 'border-radius',
  'box-shadow', 'opacity', 'z-index',
  'font-size', 'font-family', 'font-weight', 'line-height',
  'letter-spacing', 'text-decoration',
  'overflow'
];

/**
 * 跳过的 CSS 属性值
 * 这些值为默认值或无意义值，不需要包含在输出中
 */
const SKIP_VALUES = new Set([
  'none', 'normal', '0px', 'auto', 'static', 'visible'
]);

/**
 * 相似元素折叠阈值
 * 连续相同签名的元素超过此数量时折叠显示
 */
const COLLAPSE_THRESHOLD = 3;

/**
 * 文本内容标签
 * 这些标签主要包含文本内容，优先显示文本相关样式
 */
const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'label'
]);

/**
 * 视觉属性集合
 * 非文本/地标元素只显示这些视觉相关属性
 */
const VISUAL_PROPS = new Set([
  'background-color', 'color', 'border-radius', 'box-shadow',
  'opacity', 'position', 'display', 'width', 'height'
]);

/**
 * CSS 选择器特征模式
 * 用于检测查询字符串是否为 CSS 选择器（而非普通关键词）
 * 匹配：.class、#id、[attr]、>、+、~、:pseudo 或 tag tag 空格组合
 */
const SELECTOR_PATTERN = /[.#\[\]>+~:=]|^\w+\s+\w+/;

// === 辅助函数 ===

/**
 * 生成元素的最短选择器
 * 优先级：tag#id > tag.className > tag
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 最短选择器字符串
 */
function shortSelector(el) {
  const tag = el.tagName.toLowerCase();
  
  // 优先使用 ID（页面唯一）
  if (el.id) {
    return `${tag}#${el.id}`;
  }
  
  // 其次使用第一个 class 名
  if (el.className && typeof el.className === 'string') {
    const firstClass = el.className.split(/\s+/)[0];
    if (firstClass) {
      return `${tag}.${firstClass}`;
    }
  }
  
  // 降级为纯标签名
  return tag;
}

/**
 * 获取元素的直接文本内容（不含子元素文本）
 * 仅提取元素自身的文本节点内容
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 直接文本内容
 */
function getDirectText(el) {
  return Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * 判断两个元素是否具有相同签名（tagName + className）
 * 用于相似元素分组
 * 
 * @param {Element} a - 第一个元素
 * @param {Element} b - 第二个元素
 * @returns {boolean} 签名是否相同
 */
function sameSignature(a, b) {
  return a.tagName === b.tagName && a.className === b.className;
}

// === 分组折叠 ===

/**
 * 将连续相同签名的子元素分组
 * 用于简化树形结构输出，避免重复显示相同元素
 * 
 * @param {Element[]} children - 子元素数组
 * @returns {Element[][]} 分组后的二维数组，每组包含相同签名的连续元素
 */
function groupSimilar(children) {
  if (children.length === 0) return [];
  
  const groups = [[children[0]]];
  
  for (let i = 1; i < children.length; i++) {
    const lastGroup = groups[groups.length - 1];
    
    // 如果当前元素与上一组的第一个元素签名相同，加入该组
    if (sameSignature(children[i], lastGroup[0])) {
      lastGroup.push(children[i]);
    } else {
      // 否则创建新组
      groups.push([children[i]]);
    }
  }
  
  return groups;
}

/**
 * 生成子元素摘要统计
 * 统计子元素的类型和数量，生成 'tag×count' 格式摘要
 * 
 * @param {Element[]} childEls - 子元素数组
 * @returns {string|null} 摘要字符串，如 "div×3, span×2" 或 null（无子元素时）
 */
function summarizeChildren(childEls) {
  if (childEls.length === 0) return null;
  
  const counts = {};
  
  // 统计每种选择器的出现次数
  for (const c of childEls) {
    const key = shortSelector(c);
    counts[key] = (counts[key] || 0) + 1;
  }
  
  // 生成摘要字符串：count > 1 时显示 "tag×count"，否则只显示 "tag"
  return Object.entries(counts)
    .map(([k, v]) => v > 1 ? `${k}×${v}` : k)
    .join(', ');
}

// === 计算样式提取 ===

/**
 * 获取元素的计算样式
 * 从 STYLE_WHITELIST 中读取计算样式，过滤 SKIP_VALUES 中的默认值
 * 
 * @param {Element} element - DOM 元素
 * @param {string} tag - 元素标签名（小写）
 * @returns {Array<[string, string]>} 样式属性-值对数组
 */
function getComputedStyles(element, tag) {
  const cs = window.getComputedStyle(element);
  const pairs = [];
  
  // 遍历样式白名单，提取有意义的样式值
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    
    // 过滤空值和跳过值（默认值/无意义值）
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push([prop, val]);
    }
  }
  
  // 根据元素类型筛选要显示的样式
  return pickStylesForDisplay(tag, pairs);
}

/**
 * 根据元素类型筛选要显示的样式
 * - LANDMARKS（地标元素）：返回全量样式
 * - TEXT_TAGS（文本元素）：只返回文本相关属性
 * - 其他元素：只返回视觉属性
 * 
 * @param {string} tag - 元素标签名（小写）
 * @param {Array<[string, string]>} pairs - 样式属性-值对数组
 * @returns {Array<[string, string]>} 筛选后的样式属性-值对数组
 */
function pickStylesForDisplay(tag, pairs) {
  // 地标元素（header, nav, main, aside, footer, article, section）：返回全量样式
  if (LANDMARKS.has(tag)) {
    return pairs;
  }
  
  // 文本元素（h1-h6, p, span, a, li, label）：只返回文本相关属性
  if (TEXT_TAGS.has(tag)) {
    const textProps = new Set([
      'color', 'font-size', 'font-weight', 'font-family', 
      'line-height', 'text-decoration', 'letter-spacing'
    ]);
    return pairs.filter(([prop]) => textProps.has(prop));
  }
  
  // 其他元素：只返回视觉属性
  return pairs.filter(([prop]) => VISUAL_PROPS.has(prop));
}

// === 后续功能实现区域 ===
// T044-T053 任务将在此添加 DOM 操作、CSS 注入等功能
