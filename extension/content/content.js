/**
 * StyleSwift Content Script
 * DOM 操作层：页面结构获取、搜索、CSS 注入/回滚、消息监听
 */

"use strict";

// === 常量定义 ===

// 需要跳过的无意义标签（黑名单）
// 这些标签没有结构意义，不参与样式应用
const SKIP_TAGS = new Set([
  // 元数据和脚本
  "script",
  "style",
  "noscript",
  "meta",
  "link",
  "base",
  "head",
  "title",
  "template",
  "slot",
  // 空元素和换行
  "br",
  "hr",
  "wbr",
  "embed",
  "param",
  "source",
  "track",
  "area",
  "col",
  "colgroup",
]);

// 语义化地标标签（获得额外深度）
const LANDMARKS = new Set([
  "body",
  "header",
  "nav",
  "main",
  "aside",
  "footer",
  "article",
  "section",
]);

// CSS 样式属性白名单
const STYLE_WHITELIST = [
  "display",
  "position",
  "float",
  "clear",
  "flex-direction",
  "justify-content",
  "align-items",
  "flex-wrap",
  "grid-template-columns",
  "grid-template-rows",
  "gap",
  "width",
  "height",
  "max-width",
  "max-height",
  "padding",
  "margin",
  "background-color",
  "color",
  "border-color",
  "border-radius",
  "box-shadow",
  "opacity",
  "z-index",
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-decoration",
  "overflow",
];

// 跳过的 CSS 属性值
const SKIP_VALUES = new Set([
  "none",
  "normal",
  "0px",
  "auto",
  "static",
  "visible",
]);

// 相似元素折叠阈值
const COLLAPSE_THRESHOLD = 3;

// 文本内容标签
const TEXT_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "a",
  "li",
  "label",
]);

// 视觉属性集合
const VISUAL_PROPS = new Set([
  "background-color",
  "color",
  "border-radius",
  "box-shadow",
  "opacity",
  "position",
  "display",
  "width",
  "height",
]);

// 深层关键样式属性
const ESSENTIAL_STYLE_PROPS = new Set([
  "background-color",
  "color",
  "font-size",
  "font-weight",
]);

// CSS 选择器特征模式
const SELECTOR_PATTERN = /[.#\[\]>+~:=]|^\w+\s+\w+/;

// === 辅助函数 ===

// 生成元素的最短选择器（不保证唯一性）
function shortSelector(el) {
  const tag = el.tagName.toLowerCase();

  const testAttr =
    el.getAttribute("data-testid") ||
    el.getAttribute("data-cy") ||
    el.getAttribute("data-test");
  if (testAttr) {
    return `[data-testid="${testAttr}"]`;
  }

  if (el.id) {
    return `${tag}#${el.id}`;
  }

  if (el.className && typeof el.className === "string") {
    const classes = el.className.split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      return `${tag}.${classes[0]}`;
    }
  }

  return tag;
}

// 生成元素在兄弟中唯一的选择器段
function uniqueSelector(el, validate = false) {
  const tag = el.tagName.toLowerCase();

  const testAttr =
    el.getAttribute("data-testid") ||
    el.getAttribute("data-cy") ||
    el.getAttribute("data-test");
  if (testAttr) {
    const selector = `[data-testid="${testAttr}"]`;
    if (!validate || document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  if (el.id) {
    const escapedId = CSS.escape(el.id);
    const selector = `#${escapedId}`;
    if (!validate || document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  const parent = el.parentElement;
  if (!parent) return shortSelector(el);

  const sameTagSiblings = Array.from(parent.children).filter(
    (s) => s.tagName.toLowerCase() === tag,
  );

  if (sameTagSiblings.length <= 1) return shortSelector(el);

  if (el.className && typeof el.className === "string") {
    const classes = el.className.split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      let bestClass = classes[0];
      let bestMatchCount = Infinity;

      for (const cls of classes) {
        const count = sameTagSiblings.filter((s) => {
          if (!s.className || typeof s.className !== "string") return false;
          return s.className.split(/\s+/).filter(Boolean).includes(cls);
        }).length;

        if (count < bestMatchCount) {
          bestMatchCount = count;
          bestClass = cls;
          if (count === 1) break;
        }
      }

      const escapedClass = CSS.escape(bestClass);
      const base = `${tag}.${escapedClass}`;

      if (bestMatchCount <= 1) {
        if (validate && document.querySelectorAll(base).length > 1) {
          return buildFullPathSelector(el);
        }
        return base;
      }

      const index = sameTagSiblings.indexOf(el) + 1;
      return `${base}:nth-of-type(${index})`;
    }
  }

  const index = sameTagSiblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}

// 获取元素的直接文本内容
function getDirectText(el) {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent.trim())
    .filter(Boolean)
    .join(" ");
}

// 判断两个元素是否具有相同签名
function sameSignature(a, b) {
  return shortSelector(a) === shortSelector(b);
}

// === 分组折叠 ===

// 将连续相同签名的子元素分组
function groupSimilar(children) {
  if (children.length === 0) return [];

  const groups = [[children[0]]];

  for (let i = 1; i < children.length; i++) {
    const lastGroup = groups[groups.length - 1];

    if (sameSignature(children[i], lastGroup[0])) {
      lastGroup.push(children[i]);
    } else {
      groups.push([children[i]]);
    }
  }

  return groups;
}

// 生成子元素摘要统计
function summarizeChildren(childEls) {
  if (childEls.length === 0) return null;

  const counts = {};

  for (const c of childEls) {
    const key = shortSelector(c);
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([k, v]) => (v > 1 ? `${k}×${v}` : k))
    .join(", ");
}

// === 计算样式提取 ===

// 获取元素的计算样式
function getComputedStyles(element, tag) {
  const cs = window.getComputedStyle(element);
  const pairs = [];

  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);

    if (val && !SKIP_VALUES.has(val)) {
      pairs.push([prop, val]);
    }
  }

  return pickStylesForDisplay(tag, pairs);
}

// 根据元素类型筛选要显示的样式
function pickStylesForDisplay(tag, pairs) {
  if (LANDMARKS.has(tag)) {
    return pairs;
  }

  if (TEXT_TAGS.has(tag)) {
    const textProps = new Set([
      "color",
      "font-size",
      "font-weight",
      "font-family",
      "line-height",
      "text-decoration",
      "letter-spacing",
    ]);
    return pairs.filter(([prop]) => textProps.has(prop));
  }

  return pairs.filter(([prop]) => VISUAL_PROPS.has(prop));
}

// === Token 估算 ===

// 估算文本的 token 数量
function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || [])
    .length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest / 4);
}

// === 格式化输出 ===

// 格式化树节点装饰信息
function formatNodeDecoration(node, compact = false) {
  let deco = "";

  if (node.styles?.length) {
    if (!compact) {
      deco += ` [${node.styles.map(([p, v]) => `${p}:${v}`).join("; ")}]`;
    } else {
      const essential = node.styles.filter(([p]) =>
        ESSENTIAL_STYLE_PROPS.has(p),
      );
      if (essential.length) {
        deco += ` [${essential.map(([p, v]) => `${p}:${v}`).join("; ")}]`;
      }
    }
  }

  if (node.count) {
    deco += ` × ${node.count}`;
  }

  if (node.text) {
    deco += ` "${node.text}"`;
  }

  if (node.summary) {
    deco += ` — ${node.summary}`;
  }

  return deco;
}

// 渐进式紧凑的样式深度阈值
const STYLE_DEPTH_CUTOFF = 7;

// 格式化树节点（子节点）
function formatTreeNode(
  node,
  indent,
  isLast,
  maxDepth,
  compact = false,
  currentDepth = 0,
) {
  if (!node || maxDepth <= 0) return "";

  const effectiveCompact = compact || currentDepth >= STYLE_DEPTH_CUTOFF;

  const prefix = isLast ? "└── " : "├── ";
  const childIndent = indent + (isLast ? "    " : "│   ");

  let line = indent + prefix + node.selector;
  line += formatNodeDecoration(node, effectiveCompact);
  let result = line + "\n";

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i],
        childIndent,
        i === node.children.length - 1,
        maxDepth - 1,
        compact,
        currentDepth + 1,
      );
    }
  }

  return result;
}

// 格式化树结构（根节点）
function formatTree(node, indent, isLast, maxDepth, compact = false) {
  if (!node) return "";

  let line = node.selector;
  line += formatNodeDecoration(node, compact);
  let result = line + "\n";

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeNode(
        node.children[i],
        indent,
        i === node.children.length - 1,
        maxDepth - 1,
        compact,
        1,
      );
    }
  }

  return result;
}

// === 元素签名 ===

// 生成元素的签名
function elementSignature(el) {
  const childSig = Array.from(el.children)
    .map((c) => `${c.tagName.toLowerCase()}.${c.className || ""}`)
    .join("|");
  return `${el.tagName.toLowerCase()}.${el.className || ""}[${childSig}]`;
}

// === 页面结构获取 ===

// 提取页面元信息
function extractMeta() {
  return `Title: ${document.title}`;
}

// 链式折叠的最大长度
const MAX_CHAIN_LENGTH = 5;

// 构建 DOM 树结构（纯黑名单模式）
// 黑名单标签完全跳过，其他所有标签正常输出
function buildTree(element, depth, maxDepth) {
  let tag = element.tagName?.toLowerCase();

  // 无效元素直接返回 null
  if (!tag) return null;

  // shadowRoot 和黑名单标签完全跳过
  if (element.shadowRoot || SKIP_TAGS.has(tag)) return null;

  // 链式折叠：合并单子元素的 wrapper div 链
  let current = element;
  const chainParts = [uniqueSelector(element)];

  if (!LANDMARKS.has(tag)) {
    while (chainParts.length < MAX_CHAIN_LENGTH) {
      if (getDirectText(current)) break;

      const visibleChildren = Array.from(current.children).filter(
        (c) => !SKIP_TAGS.has(c.tagName?.toLowerCase()) && !c.shadowRoot,
      );
      if (visibleChildren.length !== 1) break;

      const child = visibleChildren[0];
      const childTag = child.tagName.toLowerCase();

      if (LANDMARKS.has(childTag)) break;

      chainParts.push(uniqueSelector(child));
      current = child;
    }
  }

  const selector = chainParts.join(" > ");
  const actualTag = current.tagName.toLowerCase();
  const text = getDirectText(current).slice(0, 40);
  const styles = getComputedStyles(current, actualTag);

  const childEls = Array.from(current.children).filter(
    (c) => !SKIP_TAGS.has(c.tagName?.toLowerCase()) && !c.shadowRoot,
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

const TOKEN_LIMIT = 8000;
const MAX_BUILD_DEPTH = 32;

// 计算树节点的 token 大小（递归）
function estimateNodeTokens(node, depth = 0) {
  if (!node) return 0;

  let size = 0;

  // 选择器
  size += (node.selector?.length || 0) / 3.5;

  // 样式
  if (node.styles?.length) {
    size += node.styles.length * 8;
  }

  // 文本
  size += (node.text?.length || 0) / 3.5;

  // 摘要
  size += (node.summary?.length || 0) / 3.5;

  // 计数
  if (node.count) size += 3;

  // 子节点
  if (node.children) {
    for (const child of node.children) {
      size += estimateNodeTokens(child, depth + 1);
    }
  }

  return Math.ceil(size);
}

// 将深层节点转换为摘要节点（保留信息但减少 token）
function nodeToSummary(node) {
  if (!node) return null;

  // 如果是摘要节点（已经没有 children），直接返回
  if (!node.children || node.children.length === 0) {
    return { ...node };
  }

  // 生成子元素摘要
  const summaryParts = [];
  const counts = {};

  for (const child of node.children) {
    const key = child.selector || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }

  for (const [key, count] of Object.entries(counts)) {
    summaryParts.push(count > 1 ? `${key}×${count}` : key);
  }

  return {
    selector: node.selector,
    styles: node.styles,
    text: node.text,
    count: node.count,
    summary: summaryParts.join(", "),
  };
}

// 带摘要阈值的树格式化
function formatTreeWithSummaryThreshold(
  node,
  indent,
  isLast,
  maxFullDepth,
  currentDepth = 0,
) {
  if (!node) return "";

  // 超过完整深度阈值的节点转换为摘要
  const effectiveNode =
    currentDepth >= maxFullDepth && node.children?.length > 0
      ? nodeToSummary(node)
      : node;

  const prefix = isLast ? "└── " : "├── ";
  const childIndent = indent + (isLast ? "    " : "│");

  // 紧凑模式：深层或摘要节点只显示核心样式
  const isCompact = currentDepth >= STYLE_DEPTH_CUTOFF || currentDepth >= maxFullDepth;

  let line = indent + prefix + effectiveNode.selector;
  line += formatNodeDecoration(effectiveNode, isCompact);
  let result = line + "\n";

  // 只有在完整深度内才递归子节点
  if (
    currentDepth < maxFullDepth &&
    effectiveNode !== nodeToSummary(node) &&// 不是摘要节点
    node.children
  ) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeWithSummaryThreshold(
        node.children[i],
        childIndent,
        i === node.children.length - 1,
        maxFullDepth,
        currentDepth + 1,
      );
    }
  }

  return result;
}

// 格式化根节点（带摘要阈值）
function formatRootTreeWithSummaryThreshold(node, maxFullDepth) {
  if (!node) return "";

  let line = node.selector;
  line += formatNodeDecoration(node, false);
  let result = line + "\n";

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeWithSummaryThreshold(
        node.children[i],
        "",true,
        maxFullDepth,
        1,
      );
    }
  }

  return result;
}

// 渐进式摘要输出：在 token 预算内最大化信息量
function formatOutput(meta, tree) {
  // 策略：从完整输出开始，逐步将深层节点转为摘要，直到满足 token 预算
  // 优先保证浅层完整，深层以摘要形式保留

  // 预设的完整深度档次：从深到浅尝试
  const depthThresholds = [32, 24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2];

  for (const threshold of depthThresholds) {
    const result = formatRootTreeWithSummaryThreshold(tree, threshold);
    if (estimateTokens(result) <= TOKEN_LIMIT) {
      return meta + "\n\n" + result;
    }
  }

  // 兜底：使用紧凑模式 + 最小深度
  let bestResult = formatTree(tree, "", true, 2, true);

  return meta + "\n\n" + bestResult;
}

let _structureCache = null;
let _structureCacheTime = 0;
const STRUCTURE_CACHE_TTL = 3000;

// 获取页面结构（主函数）
function getPageStructure() {
  const now = Date.now();
  if (_structureCache && now - _structureCacheTime < STRUCTURE_CACHE_TTL) {
    return _structureCache;
  }
  const meta = extractMeta();
  // 始终构建完整的 32 层树，输出阶段再根据 token 预算智能裁剪
  const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
  _structureCache = formatOutput(meta, tree);
  _structureCacheTime = now;
  return _structureCache;
}

// === 元素搜索 (grep) ===

// 判断查询是否为 CSS 选择器
function isCssSelector(query) {
  return SELECTOR_PATTERN.test(query);
}

// 使用 CSS 选择器搜索元素
function selectorSearch(selector, limit) {
  try {
    const all = document.querySelectorAll(selector);
    return Array.from(all).slice(0, limit);
  } catch {
    return [];
  }
}

// 使用关键词搜索元素
function keywordSearch(keyword, limit) {
  const kw = keyword.toLowerCase();
  const results = [];
  const looksLikeColor =
    /^(#|rgb|hsl|red|blue|green|black|white|gray|grey|transparent)/i.test(
      keyword,
    );

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
  );

  let el;
  while ((el = walker.nextNode()) && results.length < limit) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;

    if (tag.includes(kw)) {
      results.push(el);
      continue;
    }

    const classes = el.className?.toLowerCase?.() || "";
    if (classes.includes(kw)) {
      results.push(el);
      continue;
    }

    const id = el.id?.toLowerCase() || "";
    if (id.includes(kw)) {
      results.push(el);
      continue;
    }

    const directText = getDirectText(el).toLowerCase();
    if (directText.includes(kw)) {
      results.push(el);
      continue;
    }

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

// 将相似元素分组（用于 grep 输出折叠）
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
        if (texts.length < 3)
          texts.push(getDirectText(elements[j]).slice(0, 30));
      }
    }

    groups.push({ el: elements[i], count, texts });
  }

  return groups;
}

// 获取元素的所有计算样式
function getAllComputedStyles(el) {
  const cs = window.getComputedStyle(el);
  const pairs = [];
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push(`${prop}:${val}`);
    }
  }
  return pairs.join("; ") || "";
}

// 构建从 body 到当前元素的完整路径选择器
function buildFullPathSelector(el, validate = false) {
  const parts = [];
  let curr = el;
  while (curr && curr !== document.body.parentElement) {
    parts.unshift(uniqueSelector(curr, false));
    curr = curr.parentElement;
  }
  const selector = parts.join(" > ");

  if (validate && document.querySelectorAll(selector).length > 1) {
    console.warn("[StyleSwift] buildFullPathSelector: 选择器不唯一", selector);
  }

  return selector;
}

// 提取有用的 HTML 属性
function formatUsefulAttrs(el) {
  const useful = ["href", "src", "type", "placeholder", "role", "aria-label"];
  return useful
    .map((a) => (el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : null))
    .filter(Boolean)
    .join(", ");
}

// 格式化子元素列表
function formatChildren(el, scope) {
  const maxDepth = scope === "subtree" ? 3 : 1;

  function walk(parent, depth, indent) {
    if (depth > maxDepth) return [];
    const children = Array.from(parent.children).filter(
      (c) => !SKIP_TAGS.has(c.tagName?.toLowerCase()),
    );
    const lines = [];
    for (const c of children.slice(0, 10)) {
      const sel = uniqueSelector(c);
      const styles = getAllComputedStyles(c);
      lines.push(`${indent}${sel}${styles ? ` [${styles}]` : ""}`);
      if (scope === "subtree" && depth < maxDepth) {
        lines.push(...walk(c, depth + 1, indent + "  "));
      }
    }
    return lines;
  }

  return walk(el, 1, "      ");
}

// 格式化 grep 输出
function formatGrepOutput(groups, scope, maxResults) {
  const lines = [];
  let shown = 0;

  for (const { el, count, texts } of groups) {
    if (shown >= maxResults) break;

    if (count > 1) {
      lines.push(`[${shown + 1}] ${shortSelector(el)} × ${count}`);
      lines.push(`    Texts: ${texts.join(" | ")}`);
    } else {
      lines.push(`[${shown + 1}] ${uniqueSelector(el)}`);
    }

    lines.push(`    Path: ${buildFullPathSelector(el)}`);

    const allStyles = getAllComputedStyles(el);
    if (allStyles) lines.push(`    Styles: ${allStyles}`);

    const attrs = formatUsefulAttrs(el);
    if (attrs) lines.push(`    Attrs: ${attrs}`);

    const text = getDirectText(el).slice(0, 60);
    if (text) lines.push(`    Text: "${text}"`);

    if (scope === "children" || scope === "subtree") {
      const childLines = formatChildren(el, scope);
      if (childLines.length) {
        lines.push("    Children:");
        lines.push(...childLines);
      }
    }

    lines.push("");
    shown++;
  }

  const result = lines.join("\n");
  if (estimateTokens(result) > 800 && scope === "subtree")
    return formatGrepOutput(groups, "children", maxResults);
  if (estimateTokens(result) > 800 && scope === "children")
    return formatGrepOutput(groups, "self", maxResults);
  if (estimateTokens(result) > 800 && scope === "self")
    return formatGrepOutput(
      groups,
      "self",
      Math.max(1, Math.floor(maxResults / 2)),
    );

  return result;
}

// 执行元素搜索（主函数）
function runGrep(query, scope = "children", maxResults = 5) {
  maxResults = Math.max(1, Math.min(maxResults, 20));

  let elements = selectorSearch(query, maxResults);

  if (elements.length === 0 && !isCssSelector(query)) {
    elements = keywordSearch(query, maxResults);
  }

  if (elements.length === 0) return `未找到匹配: ${query}`;

  const groups = groupSimilarElements(elements);
  return formatGrepOutput(groups, scope, maxResults);
}

// === CSS 注入/回滚功能 ===

let activeStyleEl = null;
let adoptedSheet = null;
let cssInjectionMethod = null;
const cssStack = [];

// 检测可用的 CSS 注入方式
function detectCSSInjectionMethod() {
  if (cssInjectionMethod) return cssInjectionMethod;

  // 方案 1：<style> 标签注入
  try {
    const testStyle = document.createElement("style");
    testStyle.textContent = "#styleswift-csp-test { display: none }";
    document.head.appendChild(testStyle);
    const applied = testStyle.sheet?.cssRules?.length > 0;
    document.head.removeChild(testStyle);
    if (applied) {
      cssInjectionMethod = "style-element";
      return cssInjectionMethod;
    }
  } catch {
    /* CSP 阻止 */
  }

  // 方案 2：Constructable Stylesheets
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("#styleswift-csp-test { display: none }");
    cssInjectionMethod = "adopted-stylesheets";
    return cssInjectionMethod;
  } catch {
    /* 不支持 */
  }

  // 方案 3：需要通知 Side Panel 使用 chrome.scripting.insertCSS
  cssInjectionMethod = "scripting-api";
  return cssInjectionMethod;
}

// 使用 <style> 标签注入 CSS
function injectCSSStyleElement(fullCSS) {
  if (!activeStyleEl) {
    activeStyleEl = document.createElement("style");
    activeStyleEl.id = "styleswift-active";
    document.head.appendChild(activeStyleEl);
  }
  activeStyleEl.textContent = fullCSS;
}

// 使用 adoptedStyleSheets 注入 CSS
function injectCSSAdopted(fullCSS) {
  if (!adoptedSheet) {
    adoptedSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      adoptedSheet,
    ];
  }
  adoptedSheet.replaceSync(fullCSS);
}

// 根据检测结果更新当前 CSS 显示
function applyCurrentCSS() {
  const fullCSS = cssStack.join("\n");
  const method = detectCSSInjectionMethod();

  switch (method) {
    case "style-element":
      injectCSSStyleElement(fullCSS);
      break;
    case "adopted-stylesheets":
      injectCSSAdopted(fullCSS);
      break;
    case "scripting-api":
      break;
  }
}

// 注入 CSS 到页面
function injectCSS(css) {
  cssStack.push(css);

  const method = detectCSSInjectionMethod();
  if (method === "scripting-api") {
    return { fallback: "scripting-api", css: cssStack.join("\n") };
  }

  applyCurrentCSS();
}

// 回滚 CSS
function rollbackCSS(scope = "last") {
  if (scope === "all") {
    cssStack.length = 0;
  } else {
    cssStack.pop();
  }
  applyCurrentCSS();
}

// 获取当前活动的 CSS
function getActiveCSS() {
  return cssStack.join("\n");
}

// 卸载当前会话样式
function removeEarlyInjectStyle() {
  const el = document.getElementById("styleswift-active-persistent");
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function unloadSessionCSS() {
  const hadStyles =
    activeStyleEl !== null || adoptedSheet !== null || cssStack.length > 0;

  cssStack.length = 0;

  if (activeStyleEl && activeStyleEl.parentNode) {
    activeStyleEl.parentNode.removeChild(activeStyleEl);
  }
  activeStyleEl = null;

  if (adoptedSheet) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== adoptedSheet,
    );
    adoptedSheet = null;
  }

  removeEarlyInjectStyle();

  console.log(
    "[StyleSwift] Session CSS unloaded:",
    hadStyles ? "had styles" : "no styles",
  );
  return hadStyles;
}

// 加载会话样式
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
    if (activeStyleEl && activeStyleEl.parentNode) {
      activeStyleEl.parentNode.removeChild(activeStyleEl);
      activeStyleEl = null;
    }
    if (adoptedSheet) {
      adoptedSheet.replaceSync("");
    }
  }

  console.log(
    "[StyleSwift] Session CSS loaded:",
    hasStyles ? "has styles" : "empty",
  );
  return hasStyles;
}

// === 元素选择器 ===

let _pickerActive = false;
let _pickerOverlay = null;
let _pickerHighlight = null;
let _hoveredElement = null;

// 创建选择器覆盖层和高亮元素
function createPickerOverlay() {
  if (_pickerOverlay) return;

  _pickerOverlay = document.createElement("div");
  _pickerOverlay.id = "styleswift-picker-overlay";
  _pickerOverlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;cursor:crosshair;";

  _pickerHighlight = document.createElement("div");
  _pickerHighlight.id = "styleswift-picker-highlight";
  _pickerHighlight.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;" +
    "border:2px solid #0a84ff;background:rgba(10,132,255,.12);" +
    "border-radius:3px;transition:all 80ms ease;";
  document.documentElement.appendChild(_pickerHighlight);
  document.documentElement.appendChild(_pickerOverlay);

  _pickerOverlay.addEventListener("mousemove", onPickerMouseMove, true);
  _pickerOverlay.addEventListener("click", onPickerClick, true);
  _pickerOverlay.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      stopPicker();
    },
    true,
  );
  document.addEventListener("keydown", onPickerKeyDown, true);
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
  document.removeEventListener("keydown", onPickerKeyDown, true);
  _hoveredElement = null;
}

function onPickerMouseMove(e) {
  _pickerOverlay.style.pointerEvents = "none";
  const el = document.elementFromPoint(e.clientX, e.clientY);
  _pickerOverlay.style.pointerEvents = "";

  if (!el || el === _pickerHighlight || el === _pickerOverlay) return;
  if (_hoveredElement === el) return;
  _hoveredElement = el;

  const rect = el.getBoundingClientRect();
  Object.assign(_pickerHighlight.style, {
    top: rect.top + "px",
    left: rect.left + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    display: "block",
  });
}

function onPickerClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!_hoveredElement) return;
  const target = _hoveredElement;
  // 不再自动关闭 picker，支持多选
  // stopPicker();

  const info = extractElementInfo(target);
  try {
    chrome.runtime.sendMessage({
      type: "element_picked",
      data: info,
    });
  } catch {
    /* extension context lost */
  }
}

function onPickerKeyDown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    stopPicker();
    try {
      chrome.runtime.sendMessage({ type: "picker_cancelled" });
    } catch {
      /* ignored */
    }
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

// 提取选中元素及其子元素的结构和样式信息
function extractElementInfo(el) {
  const tag = el.tagName.toLowerCase();
  const selector = uniqueSelector(el);
  const fullPath = buildFullPathSelector(el);

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
    classes:
      typeof el.className === "string"
        ? el.className.split(/\s+/).filter(Boolean)
        : [],
    text: getDirectText(el).slice(0, 60),
    styles,
    rect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    meta,
  };
}

// === 消息监听器 ===

// 监听来自 Side Panel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { tool, args = {} } = message;

  try {
    switch (tool) {
      case "get_domain":
        sendResponse(location.hostname || "unknown");
        break;

      case "inject_css": {
        const injectResult = injectCSS(args.css);
        if (injectResult && injectResult.fallback === "scripting-api") {
          sendResponse({
            success: false,
            fallback: "scripting-api",
            css: injectResult.css,
          });
        } else {
          sendResponse({ success: true });
        }
        break;
      }

      case "rollback_css": {
        rollbackCSS(args.scope);
        const rolledBackCSS = getActiveCSS();
        sendResponse({ success: true, css: rolledBackCSS });
        break;
      }

      case "replace_css":
        cssStack.length = 0;
        if (args.css && args.css.trim()) {
          cssStack.push(args.css);
        }
        applyCurrentCSS();
        sendResponse({ success: true });
        break;

      case "get_active_css":
        const css = getActiveCSS();
        sendResponse(css || null);
        break;

      case "unload_session_css":
        const unloaded = unloadSessionCSS();
        sendResponse({ success: true, hadStyles: unloaded });
        break;

      case "load_session_css":
        const loaded = loadSessionCSS(args.css || "");
        sendResponse({ success: true, hasStyles: loaded });
        break;

      case "get_page_structure":
        const structure = getPageStructure();
        sendResponse(structure);
        break;

      case "grep":
        const grepResult = runGrep(
          args.query,
          args.scope || "children",
          args.maxResults || 5,
        );
        sendResponse(grepResult);
        break;

      case "start_picker":
        startPicker();
        sendResponse({ success: true });
        break;

      case "stop_picker":
        stopPicker();
        sendResponse({ success: true });
        break;

      default:
        console.warn(`[StyleSwift] Unknown tool: ${tool}`);
        sendResponse({ error: `Unknown tool: ${tool}` });
    }
  } catch (error) {
    console.error(`[StyleSwift] Tool execution error:`, error);
    sendResponse({ error: error.message });
  }

  return true;
});

// === SPA 导航检测 ===

let lastUrl = location.href;

function notifyNavigation() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    try {
      chrome.runtime.sendMessage({
        type: "page_navigated",
        url: location.href,
        domain: location.hostname,
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

window.addEventListener("popstate", notifyNavigation);
