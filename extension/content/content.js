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

// === 后续功能实现区域 ===
// T041-T053 任务将在此添加辅助函数、DOM 操作、CSS 注入等功能
