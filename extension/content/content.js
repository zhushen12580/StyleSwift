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
  'body',
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
  'body', 'header', 'nav', 'main', 'aside', 'footer', 'article', 'section'
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
 * 深层关键样式属性
 * 深层元素（depth >= STYLE_DEPTH_CUTOFF）在紧凑模式下仍然展示这些属性，
 * 避免模型生成的 CSS 与元素现有的颜色、字体等产生冲突导致风格不统一
 */
const ESSENTIAL_STYLE_PROPS = new Set([
  'background-color', 'color', 'font-size', 'font-weight'
]);

/**
 * CSS 选择器特征模式
 * 用于检测查询字符串是否为 CSS 选择器（而非普通关键词）
 * 匹配：.class、#id、[attr]、>、+、~、:pseudo 或 tag tag 空格组合
 */
const SELECTOR_PATTERN = /[.#\[\]>+~:=]|^\w+\s+\w+/;

// === 辅助函数 ===

/**
 * 生成元素的最短选择器（不保证唯一性）
 * 优先级：tag#id > tag.className > tag
 * 用于签名比较、分组折叠等不需要唯一性的场景
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
    // split 可能产生空字符串（如多余空格），需要过滤
    const classes = el.className.split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      return `${tag}.${classes[0]}`;
    }
  }
  
  // 降级为纯标签名
  return tag;
}

/**
 * 生成元素在兄弟中唯一的选择器段
 * 当同级存在多个会被 CSS 选择器匹配的兄弟元素时，
 * 追加 :nth-of-type(n) 确保选择器精准且唯一。
 * 
 * 唯一性判断基于 CSS 实际匹配规则：
 * - tag#id → 全局唯一
 * - tag.class → 匹配所有含该 class 的同标签兄弟
 * - tag → 匹配所有同标签兄弟（不管有无 class）
 * 
 * :nth-of-type(n) 计数基于同标签兄弟的位置（CSS 规范行为）
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 唯一的选择器字符串
 */
function uniqueSelector(el) {
  const tag = el.tagName.toLowerCase();
  
  if (el.id) {
    return `${tag}#${el.id}`;
  }
  
  const parent = el.parentElement;
  if (!parent) return shortSelector(el);
  
  const sameTagSiblings = Array.from(parent.children).filter(
    s => s.tagName.toLowerCase() === tag
  );
  
  if (sameTagSiblings.length <= 1) return shortSelector(el);
  
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      const base = `${tag}.${classes[0]}`;
      const matchCount = sameTagSiblings.filter(s => {
        if (!s.className || typeof s.className !== 'string') return false;
        return s.className.split(/\s+/).filter(Boolean).includes(classes[0]);
      }).length;
      
      if (matchCount <= 1) return base;
      
      const index = sameTagSiblings.indexOf(el) + 1;
      return `${base}:nth-of-type(${index})`;
    }
  }
  
  const index = sameTagSiblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
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
 * 判断两个元素是否具有相同签名
 * 使用 shortSelector 比较（tagName + 第一个 class 或 id），
 * 忽略修饰类差异（如 BEM 的 --active、--clone）
 * 
 * @param {Element} a - 第一个元素
 * @param {Element} b - 第二个元素
 * @returns {boolean} 签名是否相同
 */
function sameSignature(a, b) {
  return shortSelector(a) === shortSelector(b);
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

// === Token 估算 ===

/**
 * 估算文本的 token 数量
 * 区分 CJK 字符（~1.5 token/字）和非 CJK 字符（~0.25 token/字符）
 * 
 * @param {string} text - 要估算的文本
 * @returns {number} 估算的 token 数量
 */
function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest / 4);
}

// === 格式化输出 ===

/**
 * 格式化树节点装饰信息
 * 
 * @param {Object} node - 节点对象
 * @param {boolean} [compact=false] - 是否紧凑模式（隐藏样式）
 * @returns {string} 装饰字符串
 */
function formatNodeDecoration(node, compact = false) {
  let deco = '';
  
  if (node.styles?.length) {
    if (!compact) {
      deco += ` [${node.styles.map(([p, v]) => `${p}:${v}`).join('; ')}]`;
    } else {
      const essential = node.styles.filter(([p]) => ESSENTIAL_STYLE_PROPS.has(p));
      if (essential.length) {
        deco += ` [${essential.map(([p, v]) => `${p}:${v}`).join('; ')}]`;
      }
    }
  }
  
  // 折叠计数
  if (node.count) {
    deco += ` × ${node.count}`;
  }
  
  // 文本内容
  if (node.text) {
    deco += ` "${node.text}"`;
  }
  
  // 子元素摘要
  if (node.summary) {
    deco += ` — ${node.summary}`;
  }
  
  return deco;
}

/**
 * 渐进式紧凑的样式深度阈值
 * 浅层（< 阈值）显示完整样式，深层只显示结构标签
 * 详细样式可通过 grep 按需获取
 */
const STYLE_DEPTH_CUTOFF = 7;

/**
 * 格式化树节点（子节点）
 * 
 * @param {Object} node - 节点对象
 * @param {string} indent - 当前缩进
 * @param {boolean} isLast - 是否为同级最后一个节点
 * @param {number} maxDepth - 剩余可渲染深度
 * @param {boolean} [compact=false] - 是否强制紧凑模式
 * @param {number} [currentDepth=0] - 当前绝对深度（用于渐进式紧凑）
 * @returns {string} 格式化后的字符串
 */
function formatTreeNode(node, indent, isLast, maxDepth, compact = false, currentDepth = 0) {
  if (!node || maxDepth <= 0) return '';
  
  const effectiveCompact = compact || currentDepth >= STYLE_DEPTH_CUTOFF;
  
  const prefix = isLast ? '└── ' : '├── ';
  const childIndent = indent + (isLast ? '    ' : '│   ');
  
  let line = indent + prefix + node.selector;
  line += formatNodeDecoration(node, effectiveCompact);
  let result = line + '\n';
  
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i],
        childIndent,
        i === node.children.length - 1,
        maxDepth - 1,
        compact,
        currentDepth + 1
      );
    }
  }
  
  return result;
}

/**
 * 格式化树结构（根节点）
 * 
 * @param {Object} node - 根节点对象
 * @param {string} indent - 缩进
 * @param {boolean} isLast - 是否为最后一个节点
 * @param {number} maxDepth - 最大深度
 * @param {boolean} [compact=false] - 是否强制紧凑模式
 * @returns {string} 格式化后的字符串
 */
function formatTree(node, indent, isLast, maxDepth, compact = false) {
  if (!node) return '';
  
  let line = node.selector;
  line += formatNodeDecoration(node, compact);
  let result = line + '\n';
  
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i],
        indent,
        i === node.children.length - 1,
        maxDepth - 1,
        compact,
        1
      );
    }
  }
  
  return result;
}

// === 元素签名 ===

/**
 * 生成元素的签名（用于相似元素判断）
 * 签名包含：tagName.className + 子元素签名
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 元素签名
 */
function elementSignature(el) {
  const childSig = Array.from(el.children)
    .map(c => `${c.tagName.toLowerCase()}.${c.className || ''}`)
    .join('|');
  return `${el.tagName.toLowerCase()}.${el.className || ''}[${childSig}]`;
}

// === 页面结构获取 ===

/**
 * 提取页面元信息
 * 
 * @returns {string} 格式化的元信息字符串
 */
function extractMeta() {
  return [
    `URL: ${location.href}`,
    `Title: ${document.title}`,
    `Viewport: ${window.innerWidth} × ${window.innerHeight}`
  ].join('\n');
}

/**
 * 链式折叠的最大长度
 * 防止极端嵌套产生过长的选择器路径
 */
const MAX_CHAIN_LENGTH = 5;

/**
 * 构建 DOM 树结构
 * 
 * 包含链式折叠优化：当非地标元素只有一个非地标子元素且自身无文本时，
 * 将它们折叠为链式选择器（如 "div.a > div.b > div.c"），
 * 不消耗深度层级，大幅提升有效深度。
 * 
 * @param {Element} element - 当前元素
 * @param {number} depth - 当前深度
 * @param {number} maxDepth - 最大深度
 * @returns {Object|null} 节点对象或 null
 */
function buildTree(element, depth, maxDepth) {
  let tag = element.tagName?.toLowerCase();
  if (!tag || !TAG_WHITELIST.has(tag)) return null;
  if (element.shadowRoot) return null;

  // === 链式折叠：合并单子元素的 wrapper div 链 ===
  let current = element;
  const chainParts = [uniqueSelector(element)];

  if (!LANDMARKS.has(tag)) {
    while (chainParts.length < MAX_CHAIN_LENGTH) {
      if (getDirectText(current)) break;

      const visibleChildren = Array.from(current.children).filter(c =>
        TAG_WHITELIST.has(c.tagName?.toLowerCase()) && !c.shadowRoot
      );
      if (visibleChildren.length !== 1) break;

      const child = visibleChildren[0];
      const childTag = child.tagName.toLowerCase();
      if (LANDMARKS.has(childTag)) break;

      chainParts.push(uniqueSelector(child));
      current = child;
      tag = childTag;
    }
  }

  const selector = chainParts.join(' > ');
  const text = getDirectText(current).slice(0, 40);
  const styles = getComputedStyles(current, tag);

  const childEls = Array.from(current.children).filter(c =>
    TAG_WHITELIST.has(c.tagName?.toLowerCase()) && !c.shadowRoot
  );

  if (depth >= maxDepth || childEls.length === 0) {
    const summary = summarizeChildren(childEls);
    return { selector, text, styles, summary };
  }

  const groups = groupSimilar(childEls);
  const children = [];

  for (const group of groups) {
    if (group.length >= COLLAPSE_THRESHOLD) {
      const rep = buildTree(group[0], depth + 1, maxDepth);
      if (rep) children.push({ ...rep, count: group.length });
    } else {
      for (const child of group) {
        const childTag = child.tagName.toLowerCase();
        const childMax = LANDMARKS.has(childTag) ? maxDepth + 1 : maxDepth;
        const node = buildTree(child, depth + 1, childMax);
        if (node) children.push(node);
      }
    }
  }

  return { selector, text, styles, children };
}

/**
 * 格式化页面结构输出
 * 
 * @param {string} meta - 页面元信息
 * @param {Object} tree - DOM 树
 * @returns {string} 格式化的输出字符串
 */
const TOKEN_LIMIT = 8000;
const FORMAT_DEPTHS = [4, 8, 12, 16, 24, 32];

function formatOutput(meta, tree) {
  // 二分查找满足 token 预算的最大深度
  let lo = 0, hi = FORMAT_DEPTHS.length - 1;
  let bestResult = '';

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const result = formatTree(tree, '', true, FORMAT_DEPTHS[mid]);
    if (estimateTokens(result) <= TOKEN_LIMIT) {
      bestResult = result;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // 如果最小深度仍超限，使用紧凑模式
  if (!bestResult) {
    bestResult = formatTree(tree, '', true, 2, true);
  }

  return meta + '\n\n' + bestResult;
}

let _structureCache = null;
let _structureCacheTime = 0;
const STRUCTURE_CACHE_TTL = 3000;

/**
 * 获取页面结构（主函数）
 * 3 秒内的重复调用返回缓存结果
 * @returns {string} 页面结构的文本表示
 */
function getPageStructure() {
  const now = Date.now();
  if (_structureCache && (now - _structureCacheTime) < STRUCTURE_CACHE_TTL) {
    return _structureCache;
  }
  const meta = extractMeta();
  const tree = buildTree(document.body, 0, 30);
  _structureCache = formatOutput(meta, tree);
  _structureCacheTime = now;
  return _structureCache;
}

// === 元素搜索 (grep) ===

/**
 * 判断查询是否为 CSS 选择器
 * 
 * @param {string} query - 查询字符串
 * @returns {boolean} 是否为 CSS 选择器
 */
function isCssSelector(query) {
  return SELECTOR_PATTERN.test(query);
}

/**
 * 使用 CSS 选择器搜索元素
 * 选择器无效时返回空数组，降级逻辑由 runGrep 统一控制
 * 
 * @param {string} selector - CSS 选择器
 * @param {number} limit - 最大结果数
 * @returns {Element[]} 匹配的元素数组
 */
function selectorSearch(selector, limit) {
  try {
    const all = document.querySelectorAll(selector);
    return Array.from(all).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * 使用关键词搜索元素
 * 
 * @param {string} keyword - 关键词
 * @param {number} limit - 最大结果数
 * @returns {Element[]} 匹配的元素数组
 */
function keywordSearch(keyword, limit) {
  const kw = keyword.toLowerCase();
  const results = [];
  // 仅在关键词看起来像颜色值时才匹配 computedStyle
  const looksLikeColor = /^(#|rgb|hsl|red|blue|green|black|white|gray|grey|transparent)/i.test(keyword);

  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_ELEMENT
  );

  let el;
  while ((el = walker.nextNode()) && results.length < limit) {
    const tag = el.tagName.toLowerCase();
    if (!TAG_WHITELIST.has(tag)) continue;

    if (tag.includes(kw)) { results.push(el); continue; }

    const classes = el.className?.toLowerCase?.() || '';
    if (classes.includes(kw)) { results.push(el); continue; }

    const id = el.id?.toLowerCase() || '';
    if (id.includes(kw)) { results.push(el); continue; }

    const directText = getDirectText(el).toLowerCase();
    if (directText.includes(kw)) { results.push(el); continue; }

    // 仅在关键词疑似颜色值时才执行 getComputedStyle（避免大量 reflow）
    if (looksLikeColor) {
      const cs = window.getComputedStyle(el);
      if (cs.backgroundColor.includes(kw) || cs.color.includes(kw)) {
        results.push(el);
        continue;
      }
    }
  }

  return results;
}

/**
 * 将相似元素分组（用于 grep 输出折叠）
 * 
 * @param {Element[]} elements - 元素数组
 * @returns {Array<{el: Element, count: number, texts: string[]}>} 分组结果
 */
function groupSimilarElements(elements) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < elements.length; i++) {
    if (used.has(i)) continue;

    const sig = elementSignature(elements[i]);
    const texts = [getDirectText(elements[i]).slice(0, 30)];
    let count = 1;

    for (let j = i + 1; j < elements.length; j++) {
      if (used.has(j)) continue;
      if (elementSignature(elements[j]) === sig) {
        used.add(j);
        count++;
        if (texts.length < 3) texts.push(getDirectText(elements[j]).slice(0, 30));
      }
    }

    groups.push({ el: elements[i], count, texts });
  }

  return groups;
}

/**
 * 获取元素的所有计算样式（字符串格式）
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 样式字符串
 */
function getAllComputedStyles(el) {
  const cs = window.getComputedStyle(el);
  const pairs = [];
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push(`${prop}:${val}`);
    }
  }
  return pairs.join('; ') || '';
}

/**
 * 构建从 body 到当前元素的完整路径选择器
 * 使用 uniqueSelector 确保路径中每一段都能唯一定位元素
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 完整路径选择器
 */
function buildFullPathSelector(el) {
  const parts = [];
  let curr = el;
  while (curr && curr !== document.body.parentElement) {
    parts.unshift(uniqueSelector(curr));
    curr = curr.parentElement;
  }
  return parts.join(' > ');
}

/**
 * 提取有用的 HTML 属性
 * 
 * @param {Element} el - DOM 元素
 * @returns {string} 格式化的属性字符串
 */
function formatUsefulAttrs(el) {
  const useful = ['href', 'src', 'type', 'placeholder', 'role', 'aria-label'];
  return useful.map(a => el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : null).filter(Boolean).join(', ');
}

/**
 * 格式化子元素列表
 * 
 * @param {Element} el - DOM 元素
 * @param {string} scope - 范围：'children' 仅直接子元素，'subtree' 递归展示子树
 * @returns {string[]} 子元素描述行数组
 */
function formatChildren(el, scope) {
  const maxDepth = scope === 'subtree' ? 3 : 1;

  function walk(parent, depth, indent) {
    if (depth > maxDepth) return [];
    const children = Array.from(parent.children).filter(c => TAG_WHITELIST.has(c.tagName?.toLowerCase()));
    const lines = [];
    for (const c of children.slice(0, 10)) {
      const sel = uniqueSelector(c);
      const styles = getAllComputedStyles(c);
      lines.push(`${indent}${sel}${styles ? ` [${styles}]` : ''}`);
      if (scope === 'subtree' && depth < maxDepth) {
        lines.push(...walk(c, depth + 1, indent + '  '));
      }
    }
    return lines;
  }

  return walk(el, 1, '      ');
}

/**
 * 格式化 grep 输出
 * 
 * @param {Array<{el: Element, count: number, texts: string[]}>} groups - 分组结果
 * @param {string} scope - 范围
 * @param {number} maxResults - 最大结果数
 * @returns {string} 格式化的输出字符串
 */
function formatGrepOutput(groups, scope, maxResults) {
  const lines = [];
  let shown = 0;

  for (const { el, count, texts } of groups) {
    if (shown >= maxResults) break;

    if (count > 1) {
      lines.push(`[${shown + 1}] ${shortSelector(el)} × ${count}`);
      lines.push(`    Texts: ${texts.join(' | ')}`);
    } else {
      lines.push(`[${shown + 1}] ${uniqueSelector(el)}`);
    }

    lines.push(`    Path: ${buildFullPathSelector(el)}`);

    // 完整计算样式
    const allStyles = getAllComputedStyles(el);
    if (allStyles) lines.push(`    Styles: ${allStyles}`);

    const attrs = formatUsefulAttrs(el);
    if (attrs) lines.push(`    Attrs: ${attrs}`);

    const text = getDirectText(el).slice(0, 60);
    if (text) lines.push(`    Text: "${text}"`);

    if (scope === 'children' || scope === 'subtree') {
      const childLines = formatChildren(el, scope);
      if (childLines.length) {
        lines.push('    Children:');
        lines.push(...childLines);
      }
    }

    lines.push('');
    shown++;
  }

  const result = lines.join('\n');
  if (estimateTokens(result) > 800 && scope === 'subtree')
    return formatGrepOutput(groups, 'children', maxResults);
  if (estimateTokens(result) > 800 && scope === 'children')
    return formatGrepOutput(groups, 'self', maxResults);
  if (estimateTokens(result) > 800 && scope === 'self')
    return formatGrepOutput(groups, 'self', Math.max(1, Math.floor(maxResults / 2)));

  return result;
}

/**
 * 执行元素搜索（主函数）
 * 
 * 搜索策略（方法优先）：
 * 1. 总是先用 CSS 选择器搜索（querySelectorAll），覆盖标签名、#id、.class、复合选择器
 * 2. CSS 选择器无结果且查询不像 CSS 选择器时，降级为关键词搜索
 * 
 * 这确保 get_page_structure 返回的 shortSelector（如 nav、div.container）
 * 都能被可靠地 grep 到，不依赖启发式检测。
 * 
 * @param {string} query - 查询字符串（CSS 选择器或关键词）
 * @param {string} scope - 范围：'self'、'children' 或 'subtree'
 * @param {number} maxResults - 最大结果数
 * @returns {string} 搜索结果字符串
 */
function runGrep(query, scope = 'children', maxResults = 5) {
  maxResults = Math.max(1, Math.min(maxResults, 20));

  // 第一步：尝试 CSS 选择器搜索（querySelectorAll 对标签名也有效）
  let elements = selectorSearch(query, maxResults);

  // 第二步：选择器无结果时，降级为关键词搜索
  // 仅当查询不含明确的 CSS 选择器语法时才降级，避免对合法但无匹配的选择器误降级
  if (elements.length === 0 && !isCssSelector(query)) {
    elements = keywordSearch(query, maxResults);
  }

  if (elements.length === 0) return `未找到匹配: ${query}`;

  const groups = groupSimilarElements(elements);
  return formatGrepOutput(groups, scope, maxResults);
}

// === CSS 注入/回滚功能 ===

/**
 * 当前活动的样式元素（方案 1：<style> 标签注入）
 * @type {HTMLStyleElement|null}
 */
let activeStyleEl = null;

/**
 * Constructable Stylesheet 实例（方案 2：adoptedStyleSheets）
 * @type {CSSStyleSheet|null}
 */
let adoptedSheet = null;

/**
 * CSS 注入方式缓存
 * @type {'style-element'|'adopted-stylesheets'|'scripting-api'|null}
 */
let cssInjectionMethod = null;

/**
 * CSS 变更栈（内存中的会话状态）
 * @type {string[]}
 */
const cssStack = [];

/**
 * 检测可用的 CSS 注入方式
 * 按优先级尝试：<style> 标签 → adoptedStyleSheets → scripting-api
 * 结果缓存，只检测一次
 */
function detectCSSInjectionMethod() {
  if (cssInjectionMethod) return cssInjectionMethod;

  // 方案 1：<style> 标签注入（默认，兼容性最广）
  try {
    const testStyle = document.createElement('style');
    testStyle.textContent = '#styleswift-csp-test { display: none }';
    document.head.appendChild(testStyle);
    const applied = testStyle.sheet?.cssRules?.length > 0;
    document.head.removeChild(testStyle);
    if (applied) {
      cssInjectionMethod = 'style-element';
      return cssInjectionMethod;
    }
  } catch { /* CSP 阻止 */ }

  // 方案 2：Constructable Stylesheets（Chrome 73+，绕过部分 CSP）
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('#styleswift-csp-test { display: none }');
    cssInjectionMethod = 'adopted-stylesheets';
    return cssInjectionMethod;
  } catch { /* 不支持 */ }

  // 方案 3：需要通知 Side Panel 使用 chrome.scripting.insertCSS
  cssInjectionMethod = 'scripting-api';
  return cssInjectionMethod;
}

/**
 * 使用 <style> 标签注入 CSS（方案 1）
 */
function injectCSSStyleElement(fullCSS) {
  if (!activeStyleEl) {
    activeStyleEl = document.createElement('style');
    activeStyleEl.id = 'styleswift-active';
    document.head.appendChild(activeStyleEl);
  }
  activeStyleEl.textContent = fullCSS;
}

/**
 * 使用 adoptedStyleSheets 注入 CSS（方案 2）
 */
function injectCSSAdopted(fullCSS) {
  if (!adoptedSheet) {
    adoptedSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, adoptedSheet];
  }
  adoptedSheet.replaceSync(fullCSS);
}

/**
 * 根据检测结果更新当前 CSS 显示
 */
function applyCurrentCSS() {
  const fullCSS = cssStack.join('\n');
  const method = detectCSSInjectionMethod();

  switch (method) {
    case 'style-element':
      injectCSSStyleElement(fullCSS);
      break;
    case 'adopted-stylesheets':
      injectCSSAdopted(fullCSS);
      break;
    case 'scripting-api':
      // scripting-api 由 Side Panel 处理，此处不操作 DOM
      break;
  }
}

/**
 * 注入 CSS 到页面
 * 自动选择最佳注入方式（带 CSP 降级）
 *
 * @param {string} css - CSS 代码
 * @returns {void|{fallback: string, css: string}} scripting-api 降级时返回对象
 */
function injectCSS(css) {
  cssStack.push(css);

  const method = detectCSSInjectionMethod();
  if (method === 'scripting-api') {
    return { fallback: 'scripting-api', css: cssStack.join('\n') };
  }

  applyCurrentCSS();
}

/**
 * 回滚 CSS
 *
 * @param {string} [scope='last'] - 'last' 或 'all'
 * @returns {void}
 */
function rollbackCSS(scope = 'last') {
  if (scope === 'all') {
    cssStack.length = 0;
  } else {
    cssStack.pop();
  }
  applyCurrentCSS();
}

/**
 * 获取当前活动的 CSS
 * 
 * 返回 cssStack 中所有 CSS 的合并结果。
 * 用于 Side Panel 在 rollback_last 后同步存储。
 * 
 * @returns {string} 合并后的 CSS 代码，如果栈为空则返回空字符串
 */
function getActiveCSS() {
  return cssStack.join('\n');
}

/**
 * 卸载当前会话样式
 * 
 * 用于会话切换时卸载当前会话的样式：
 * 1. 移除 activeStyleEl 元素（如果存在）
 * 2. 清空 cssStack
 * 3. 重置 activeStyleEl 为 null
 * 
 * @returns {boolean} 是否成功卸载（有样式则返回 true，无样式返回 false）
 */
function removeEarlyInjectStyle() {
  const el = document.getElementById('styleswift-active-persistent');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function unloadSessionCSS() {
  const hadStyles = activeStyleEl !== null || adoptedSheet !== null || cssStack.length > 0;
  
  cssStack.length = 0;
  
  if (activeStyleEl && activeStyleEl.parentNode) {
    activeStyleEl.parentNode.removeChild(activeStyleEl);
  }
  activeStyleEl = null;
  
  if (adoptedSheet) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== adoptedSheet);
    adoptedSheet = null;
  }
  
  removeEarlyInjectStyle();
  
  console.log('[StyleSwift] Session CSS unloaded:', hadStyles ? 'had styles' : 'no styles');
  return hadStyles;
}

/**
 * 加载会话样式
 * 
 * 用于会话切换时加载目标会话的样式：
 * 1. 清空当前 cssStack
 * 2. 如果提供了 CSS，将其推入栈中
 * 3. 创建或更新 activeStyleEl 元素
 * 
 * 同时移除 early-inject.js 注入的样式元素（content.js 接管后不再需要）。
 * 
 * @param {string} css - 要加载的 CSS 代码（可以为空字符串）
 * @returns {boolean} 是否成功加载（有 CSS 内容则返回 true，否则返回 false）
 */
function loadSessionCSS(css) {
  cssStack.length = 0;
  removeEarlyInjectStyle();
  
  const hasStyles = css && css.trim().length > 0;
  if (hasStyles) {
    cssStack.push(css);
  }
  
  if (hasStyles) {
    applyCurrentCSS();
  } else {
    // 清除所有注入方式
    if (activeStyleEl && activeStyleEl.parentNode) {
      activeStyleEl.parentNode.removeChild(activeStyleEl);
      activeStyleEl = null;
    }
    if (adoptedSheet) {
      adoptedSheet.replaceSync('');
    }
  }
  
  console.log('[StyleSwift] Session CSS loaded:', hasStyles ? 'has styles' : 'empty');
  return hasStyles;
}

// === 元素选择器 ===

let _pickerActive = false;
let _pickerOverlay = null;
let _pickerHighlight = null;
let _hoveredElement = null;

/**
 * 创建选择器覆盖层和高亮元素
 */
function createPickerOverlay() {
  if (_pickerOverlay) return;

  _pickerOverlay = document.createElement('div');
  _pickerOverlay.id = 'styleswift-picker-overlay';
  _pickerOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;';

  _pickerHighlight = document.createElement('div');
  _pickerHighlight.id = 'styleswift-picker-highlight';
  _pickerHighlight.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483647;' +
    'border:2px solid #0a84ff;background:rgba(10,132,255,.12);' +
    'border-radius:3px;transition:all 80ms ease;';
  document.documentElement.appendChild(_pickerHighlight);
  document.documentElement.appendChild(_pickerOverlay);

  _pickerOverlay.addEventListener('mousemove', onPickerMouseMove, true);
  _pickerOverlay.addEventListener('click', onPickerClick, true);
  _pickerOverlay.addEventListener('contextmenu', (e) => { e.preventDefault(); stopPicker(); }, true);
  document.addEventListener('keydown', onPickerKeyDown, true);
}

function removePickerOverlay() {
  if (_pickerOverlay) {
    _pickerOverlay.remove();
    _pickerOverlay = null;
  }
  if (_pickerHighlight) {
    _pickerHighlight.remove();
    _pickerHighlight = null;
  }
  document.removeEventListener('keydown', onPickerKeyDown, true);
  _hoveredElement = null;
}

function onPickerMouseMove(e) {
  _pickerOverlay.style.pointerEvents = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  _pickerOverlay.style.pointerEvents = '';

  if (!el || el === _pickerHighlight || el === _pickerOverlay) return;
  if (_hoveredElement === el) return;
  _hoveredElement = el;

  const rect = el.getBoundingClientRect();
  Object.assign(_pickerHighlight.style, {
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    display: 'block',
  });
}

function onPickerClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!_hoveredElement) return;
  const target = _hoveredElement;
  stopPicker();

  const info = extractElementInfo(target);
  try {
    chrome.runtime.sendMessage({
      type: 'element_picked',
      data: info,
    });
  } catch { /* extension context lost */ }
}

function onPickerKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    stopPicker();
    try {
      chrome.runtime.sendMessage({ type: 'picker_cancelled' });
    } catch { /* ignored */ }
  }
}

function startPicker() {
  if (_pickerActive) return;
  _pickerActive = true;
  createPickerOverlay();
}

function stopPicker() {
  if (!_pickerActive) return;
  _pickerActive = false;
  removePickerOverlay();
}

/**
 * 提取选中元素及其子元素的结构和样式信息
 */
function extractElementInfo(el) {
  const tag = el.tagName.toLowerCase();
  const selector = uniqueSelector(el);
  const fullPath = buildFullPathSelector(el);
  const tree = buildTree(el, 0, 8);
  const treeText = tree ? formatTree(tree, '', true, 8) : selector;

  const cs = window.getComputedStyle(el);
  const styles = {};
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    if (val && !SKIP_VALUES.has(val)) {
      styles[prop] = val;
    }
  }

  const rect = el.getBoundingClientRect();
  const meta = `URL: ${location.href}\nTitle: ${document.title}\nViewport: ${window.innerWidth} × ${window.innerHeight}`;

  return {
    selector,
    fullPath,
    tag,
    id: el.id || null,
    classes: (typeof el.className === 'string') ? el.className.split(/\s+/).filter(Boolean) : [],
    text: getDirectText(el).slice(0, 60),
    styles,
    rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
    treeText,
    meta,
  };
}

// === 消息监听器 ===

/**
 * 监听来自 Side Panel 的消息
 * 
 * 支持的工具：
 * - get_domain: 返回当前页面的域名
 * - inject_css: 注入 CSS（args: { css }）
 * - rollback_css: 回滚 CSS（args: { scope }）
 * - get_active_css: 获取当前活动的 CSS
 * - start_picker: 启动元素选择器
 * - stop_picker: 停止元素选择器
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { tool, args = {} } = message;
  
  try {
    switch (tool) {
      case 'get_domain':
        // 返回当前页面的域名
        sendResponse(location.hostname || 'unknown');
        break;
        
      case 'inject_css': {
        const injectResult = injectCSS(args.css);
        if (injectResult && injectResult.fallback === 'scripting-api') {
          sendResponse({ success: false, fallback: 'scripting-api', css: injectResult.css });
        } else {
          sendResponse({ success: true });
        }
        break;
      }
        
      case 'rollback_css':
        // 回滚 CSS
        rollbackCSS(args.scope);
        sendResponse({ success: true });
        break;
        
      case 'get_active_css':
        // 获取当前活动的 CSS
        const css = getActiveCSS();
        sendResponse(css || null);
        break;
        
      case 'unload_session_css':
        // 卸载当前会话样式（会话切换时使用）
        const unloaded = unloadSessionCSS();
        sendResponse({ success: true, hadStyles: unloaded });
        break;
        
      case 'load_session_css':
        // 加载会话样式（会话切换时使用）
        const loaded = loadSessionCSS(args.css || '');
        sendResponse({ success: true, hasStyles: loaded });
        break;
        
      case 'get_page_structure':
        // 获取页面结构
        const structure = getPageStructure();
        sendResponse(structure);
        break;
        
      case 'grep':
        // 搜索元素
        const grepResult = runGrep(
          args.query,
          args.scope || 'children',
          args.maxResults || 5
        );
        sendResponse(grepResult);
        break;
        
      case 'start_picker':
        startPicker();
        sendResponse({ success: true });
        break;

      case 'stop_picker':
        stopPicker();
        sendResponse({ success: true });
        break;

      default:
        // 未知工具
        console.warn(`[StyleSwift] Unknown tool: ${tool}`);
        sendResponse({ error: `Unknown tool: ${tool}` });
    }
  } catch (error) {
    console.error(`[StyleSwift] Tool execution error:`, error);
    sendResponse({ error: error.message });
  }
  
  // 返回 true 表示异步响应（虽然这里都是同步的，但保持一致性）
  return true;
});

// === SPA 导航检测 ===

let lastUrl = location.href;

function notifyNavigation() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    try {
      chrome.runtime.sendMessage({
        type: 'page_navigated',
        url: location.href,
        domain: location.hostname
      });
    } catch {
      // 扩展上下文失效时忽略
    }
  }
}

const navObserver = new MutationObserver(notifyNavigation);
if (document.body) {
  navObserver.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('popstate', notifyNavigation);
