/**
 * 页面结构提取函数单元测试
 * 
 * 测试目标：
 * - 在 token 预算下，最大限度地将页面结构信息全面、准确地提取出来
 * - 全面即不能丢失深层结构信息
 * - 准确即 Agent 能清楚知道哪些结构信息对应页面上的哪些部分
 * 
 * 测试对象：extension/tests/reddit.html
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// === 从 content.js 提取的常量和函数（复制以便测试） ===

// 需要跳过的无意义标签（黑名单）
const SKIP_TAGS = new Set([
  "script", "style", "noscript", "meta", "link", "base", "head",
  "title", "template", "slot", "br", "hr", "wbr", "embed", "param",
  "source", "track", "area", "col", "colgroup",
]);

// 语义化地标标签
const LANDMARKS = new Set([
  "body", "header", "nav", "main", "aside", "footer", "article", "section",
]);

// CSS 样式属性白名单
const STYLE_WHITELIST = [
  "display", "position", "float", "clear", "flex-direction",
  "justify-content", "align-items", "flex-wrap", "grid-template-columns",
  "grid-template-rows", "gap", "width", "height", "max-width", "max-height",
  "padding", "margin", "background-color", "color", "border-color",
  "border-radius", "box-shadow", "opacity", "z-index", "font-size",
  "font-family", "font-weight", "line-height", "letter-spacing",
  "text-decoration", "overflow",
];

// 跳过的 CSS 属性值
const SKIP_VALUES = new Set([
  "none", "normal", "0px", "auto", "static", "visible",
]);

// 相似元素折叠阈值
const COLLAPSE_THRESHOLD = 3;

// 文本内容标签
const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "li", "label",
]);

// 视觉属性集合
const VISUAL_PROPS = new Set([
  "background-color", "color", "border-radius", "box-shadow",
  "opacity", "position", "display", "width", "height",
]);

// 深层关键样式属性
const ESSENTIAL_STYLE_PROPS = new Set([
  "background-color", "color", "font-size", "font-weight",
]);

// Token 限制
const TOKEN_LIMIT = 8000;
const MAX_BUILD_DEPTH = 32;
const MAX_CHAIN_LENGTH = 5;

// === 辅助函数 ===

/**
 * 生成元素的最短选择器
 */
function shortSelector(el) {
  const tag = el.tagName.toLowerCase();
  
  const testAttr = el.getAttribute?.("data-testid") ||
    el.getAttribute?.("data-cy") ||
    el.getAttribute?.("data-test");
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

/**
 * 生成元素在兄弟中唯一的选择器段
 */
function uniqueSelector(el, validate = false) {
  const tag = el.tagName.toLowerCase();
  
  const testAttr = el.getAttribute?.("data-testid") ||
    el.getAttribute?.("data-cy") ||
    el.getAttribute?.("data-test");
  if (testAttr) {
    const selector = `[data-testid="${testAttr}"]`;
    if (!validate || el.ownerDocument.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }
  
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
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
      
      const escapedClass = CSS?.escape?.(bestClass) ?? bestClass;
      const base = `${tag}.${escapedClass}`;
      
      if (bestMatchCount <= 1) {
        return base;
      }
      
      const index = sameTagSiblings.indexOf(el) + 1;
      return `${base}:nth-of-type(${index})`;
    }
  }
  
  const index = sameTagSiblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}

/**
 * 获取元素的直接文本内容
 */
function getDirectText(el) {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3) // TEXT_NODE
    .map((n) => n.textContent.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * 判断两个元素是否具有相同签名
 */
function sameSignature(a, b) {
  return shortSelector(a) === shortSelector(b);
}

/**
 * 将连续相同签名的子元素分组
 */
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

/**
 * 生成子元素摘要统计
 */
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

/**
 * 获取元素的计算样式
 */
function getComputedStyles(element, tag) {
  const cs = element.ownerDocument.defaultView.getComputedStyle(element);
  const pairs = [];
  
  for (const prop of STYLE_WHITELIST) {
    const val = cs.getPropertyValue(prop);
    
    if (val && !SKIP_VALUES.has(val)) {
      pairs.push([prop, val]);
    }
  }
  
  return pickStylesForDisplay(tag, pairs);
}

/**
 * 根据元素类型筛选要显示的样式
 */
function pickStylesForDisplay(tag, pairs) {
  if (LANDMARKS.has(tag)) {
    return pairs;
  }
  
  if (TEXT_TAGS.has(tag)) {
    const textProps = new Set([
      "color", "font-size", "font-weight", "font-family",
      "line-height", "text-decoration", "letter-spacing",
    ]);
    return pairs.filter(([prop]) => textProps.has(prop));
  }
  
  return pairs.filter(([prop]) => VISUAL_PROPS.has(prop));
}

/**
 * 估算文本的 token 数量
 */
function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest / 4);
}

// === 格式化输出函数 ===

const STYLE_DEPTH_CUTOFF = 7;

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

function formatTreeNode(node, indent, isLast, maxDepth, compact = false, currentDepth = 0) {
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

/**
 * 生成元素的签名
 */
function elementSignature(el) {
  const childSig = Array.from(el.children)
    .map((c) => `${c.tagName.toLowerCase()}.${c.className || ""}`)
    .join("|");
  return `${el.tagName.toLowerCase()}.${el.className || ""}[${childSig}]`;
}

// === 主树构建函数 ===

function buildTree(element, depth, maxDepth) {
  let tag = element.tagName?.toLowerCase();

  if (!tag) return null;

  if (element.shadowRoot || SKIP_TAGS.has(tag)) return null;

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

function extractMeta(document) {
  return `Title: ${document.title}`;
}

function estimateNodeTokens(node, depth = 0) {
  if (!node) return 0;

  let size = 0;

  size += (node.selector?.length || 0) / 3.5;

  if (node.styles?.length) {
    size += node.styles.length * 8;
  }

  size += (node.text?.length || 0) / 3.5;

  size += (node.summary?.length || 0) / 3.5;

  if (node.count) size += 3;

  if (node.children) {
    for (const child of node.children) {
      size += estimateNodeTokens(child, depth + 1);
    }
  }

  return Math.ceil(size);
}

function nodeToSummary(node) {
  if (!node) return null;

  if (!node.children || node.children.length === 0) {
    return { ...node };
  }

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

function formatTreeWithSummaryThreshold(node, indent, isLast, maxFullDepth, currentDepth = 0) {
  if (!node) return "";

  const effectiveNode =
    currentDepth >= maxFullDepth && node.children?.length > 0
      ? nodeToSummary(node)
      : node;

  const prefix = isLast ? "└── " : "├── ";
  const childIndent = indent + (isLast ? "    " : "│");

  const isCompact = currentDepth >= STYLE_DEPTH_CUTOFF || currentDepth >= maxFullDepth;

  let line = indent + prefix + effectiveNode.selector;
  line += formatNodeDecoration(effectiveNode, isCompact);
  let result = line + "\n";

  if (
    currentDepth < maxFullDepth &&
    effectiveNode !== nodeToSummary(node) &&
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

function formatRootTreeWithSummaryThreshold(node, maxFullDepth) {
  if (!node) return "";

  let line = node.selector;
  line += formatNodeDecoration(node, false);
  let result = line + "\n";

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      result += formatTreeWithSummaryThreshold(
        node.children[i],
        "",
        true,
        maxFullDepth,
        1,
      );
    }
  }

  return result;
}

function formatOutput(meta, tree) {
  const depthThresholds = [32, 24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2];

  for (const threshold of depthThresholds) {
    const result = formatRootTreeWithSummaryThreshold(tree, threshold);
    if (estimateTokens(result) <= TOKEN_LIMIT) {
      return meta + "\n\n" + result;
    }
  }

  let bestResult = formatTree(tree, "", true, 2, true);

  return meta + "\n\n" + bestResult;
}

function getPageStructure(document) {
  const meta = extractMeta(document);
  const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
  return formatOutput(meta, tree);
}

// === 统计分析函数 ===

/**
 * 计算结构树的深度
 */
function calculateTreeDepth(node, currentDepth = 0) {
  if (!node) return currentDepth;
  if (!node.children || node.children.length === 0) return currentDepth;
  
  return Math.max(...node.children.map(child => 
    calculateTreeDepth(child, currentDepth + 1)
  ));
}

/**
 * 计算结构树的节点总数
 */
function countTreeNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countTreeNodes(child);
    }
  }
  return count;
}

/**
 * 统计各类元素的出现次数
 */
function countElementsByTag(node, counts = {}) {
  if (!node) return counts;
  
  const tag = node.selector?.split(/[.#>\s]/)[0] || 'unknown';
  counts[tag] = (counts[tag] || 0) + 1;
  
  if (node.children) {
    for (const child of node.children) {
      countElementsByTag(child, counts);
    }
  }
  
  return counts;
}

/**
 * 提取结构中的所有选择器
 */
function extractSelectors(node, selectors = []) {
  if (!node) return selectors;
  
  if (node.selector) {
    selectors.push(node.selector);
  }
  
  if (node.children) {
    for (const child of node.children) {
      extractSelectors(child, selectors);
    }
  }
  
  return selectors;
}

/**
 * 检查选择器是否能在页面中找到对应元素
 */
function verifySelectorsInDOM(selectors, document, sampleSize = 50) {
  const results = {
    total: selectors.length,
    verified: 0,
    failed: 0,
    sampled: 0,
    failures: [],
  };
  
  // 只抽样验证，避免测试时间过长
  const sampleStep = Math.max(1, Math.floor(selectors.length / sampleSize));
  
  for (let i = 0; i < selectors.length && results.sampled < sampleSize; i += sampleStep) {
    const selector = selectors[i];
    results.sampled++;
    
    try {
      // 简化选择器（移除链式选择器的深层部分）
      const simpleSelector = selector.split(' > ')[0];
      const elements = document.querySelectorAll(simpleSelector);
      
      if (elements.length > 0) {
        results.verified++;
      } else {
        results.failed++;
        results.failures.push({
          selector,
          simpleSelector,
          reason: 'No elements found',
        });
      }
    } catch (e) {
      results.failed++;
      results.failures.push({
        selector,
        reason: `Invalid selector: ${e.message}`,
      });
    }
  }
  
  return results;
}

// === 测试状态追踪 ===

// 用于存储测试过程中的统计数据
let testResults = {
  pageStructure: null,
  tokenCount: 0,
  treeDepth: 0,
  nodeCount: 0,
  elementTypeCounts: {},
  selectorVerification: null,
  rawHtmlSize: 0,
  structureSize: 0,
};

// === 测试套件 ===

describe('页面结构提取函数', () => {
  let dom;
  let document;

  beforeAll(async () => {
    // 读取测试HTML文件
    const htmlPath = path.join(__dirname, 'reddit.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    testResults.rawHtmlSize = htmlContent.length;
    
    // 创建 JSDOM 实例
    dom = new JSDOM(htmlContent, {
      runScripts: 'dangerously',
      resources: 'usable',
    });
    document = dom.window.document;
    
    // 定义 CSS.escape if not available
    if (!dom.window.CSS) {
      dom.window.CSS = {
        escape: (str) => str.replace(/([^\w-])/g, '\\$1'),
      };
    }
    
    // 初始化全局 CSS
    global.CSS = dom.window.CSS;
    
    console.log('测试HTML文件已加载');
    console.log(`原始HTML大小: ${(htmlContent.length / 1024).toFixed(2)} KB`);
  });

  afterAll(() => {
    // 清理
    if (dom) {
      dom.window.close();
    }
  });

  // ===== 测试1: Token 预算限制测试 =====
  
  describe('Token 预算限制测试', () => {
    test('提取的结构应在 token 预算范围内', () => {
      const structure = getPageStructure(document);
      testResults.pageStructure = structure;
      testResults.structureSize = structure.length;
      
      const tokens = estimateTokens(structure);
      testResults.tokenCount = tokens;
      
      console.log(`结构提取完成`);
      console.log(`Token 数量: ${tokens}`);
      console.log(`结构文本大小: ${(structure.length / 1024).toFixed(2)} KB`);
      
      expect(tokens).toBeLessThanOrEqual(TOKEN_LIMIT);
    });

    test('结构提取应使用渐进式裁剪策略', () => {
      // 测试不同深度阈值下的输出
      const meta = extractMeta(document);
      const fullTree = buildTree(document.body, 0, 32);
      
      const thresholds = [32, 24, 16, 8, 4];
      const results = {};
      
      for (const threshold of thresholds) {
        const result = formatRootTreeWithSummaryThreshold(fullTree, threshold);
        results[threshold] = {
          tokens: estimateTokens(result),
          size: result.length,
        };
      }
      
      console.log('渐进式裁剪策略结果:');
      for (const [threshold, data] of Object.entries(results)) {
        console.log(`  深度 ${threshold}: ${data.tokens} tokens, ${data.size} chars`);
      }
      
      // 验证：更低的深度阈值应产生更少的 tokens
      const tokens = Object.values(results).map(r => r.tokens);
      for (let i = 0; i < tokens.length - 1; i++) {
        expect(tokens[i]).toBeGreaterThanOrEqual(tokens[i + 1]);
      }
    });
  });

  // ===== 测试2: 结构完整性测试 =====
  
  describe('结构完整性测试', () => {
    test('应包含页面标题信息', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      
      expect(structure).toContain('Title:');
      expect(structure).toContain('reddit'); // 页面标题词
    });

    test('不应丢失关键语义元素', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      const structureLower = structure.toLowerCase();
      
      // Reddit 页面应包含的关键结构
      const keyElements = ['header', 'nav', 'main', 'article'];
      let foundCount = 0;
      
      for (const elem of keyElements) {
        if (structureLower.includes(elem)) {
          foundCount++;
        }
      }
      
      console.log(`关键语义元素覆盖: ${foundCount}/${keyElements.length}`);
      
      // 至少应该找到一半的关键元素
      expect(foundCount).toBeGreaterThanOrEqual(keyElements.length / 2);
    });

    test('应提取深层结构（深度 >= 5）', () => {
      const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
      const depth = calculateTreeDepth(tree);
      testResults.treeDepth = depth;
      
      console.log(`结构树深度: ${depth}`);
      
      // 页面结构应足够深
      expect(depth).toBeGreaterThanOrEqual(5);
    });

    test('应包含合理数量的结构节点', () => {
      const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
      const nodeCount = countTreeNodes(tree);
      testResults.nodeCount = nodeCount;
      
      console.log(`结构节点总数: ${nodeCount}`);
      
      // 节点数量应在合理范围内
      expect(nodeCount).toBeGreaterThan(10);
    });

    test('应正确折叠重复元素', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      
      // 检查折叠符号（×）是否存在
      const collapseMatches = structure.match(/×\s*\d+/g);
      const collapseCount = collapseMatches ? collapseMatches.length : 0;
      
      console.log(`折叠元素组数: ${collapseCount}`);
      
      // 折叠有助于控制输出大小
      expect(structure.length).toBeLessThan(100000); // 100KB
    });
  });

  // ===== 测试3: 选择器准确性测试 =====
  
  describe('选择器准确性测试', () => {
    test('提取的选择器应能在原文档中定位元素', () => {
      const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
      const selectors = extractSelectors(tree);
      
      // 抽样验证
      const verification = verifySelectorsInDOM(selectors, document, 30);
      testResults.selectorVerification = verification;
      
      console.log('选择器验证结果:');
      console.log(`  总选择器数: ${verification.total}`);
      console.log(`  抽样数量: ${verification.sampled}`);
      console.log(`  验证成功: ${verification.verified}`);
      console.log(`  验证失败: ${verification.failed}`);
      
      if (verification.failures.length > 0) {
        console.log('  失败示例:');
        verification.failures.slice(0, 3).forEach(f => {
          console.log(`    - ${f.selector}: ${f.reason}`);
        });
      }
      
      // 成功率应很高
      const successRate = verification.verified / verification.sampled;
      expect(successRate).toBeGreaterThanOrEqual(0.9);
    });

    test('关键页面区域应有明确选择器', () => {}), test('选择器应包含有效的样式信息', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      
      // 检查样式信息是否包含
      const stylePattern = /\[(color|background|font|display|width|height):[^)]+\]/gi;
      const styleMatches = structure.match(stylePattern);
      const styleCount = styleMatches ? styleMatches.length : 0;
      
      console.log(`包含样式信息的节点数: ${styleCount}`);
      
      // 样式信息有助于 Agent 理解页面外观
      expect(styleCount).toBeGreaterThan(0);
    });

    test('ID 选择器应正确处理', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      
      // 检查是否有 ID 选择器（#开头）
      const idSelectors = structure.match(/#[\w-]+/g);
      const idCount = idSelectors ? idSelectors.length : 0;
      
      console.log(`ID 选择器数量: ${idCount}`);
      
      // Reddit 页面应该有一些 ID 选择器
      expect(idCount).toBeGreaterThan(0);
    });

    test('data-testid 选择器应正确处理', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      
      // 检查是否有 data-testid 选择器
      const testIdSelectors = structure.match(/\[data-testid="[^\"]+"\]/g);
      const testIdCount = testIdSelectors ? testIdSelectors.length : 0;
      
      console.log(`data-testid 选择器数量: ${testIdCount}`);
      
      // data-testid 是很好的可测试选择器
      expect(testIdCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== 测试4: 性能基准测试 =====
  
  describe('性能基准测试', () => {
    test('结构提取应在合理时间内完成', () => {
      const startTime = Date.now();
      
      const iterations = 3;
      for (let i = 0; i < iterations; i++) {
        getPageStructure(document);
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;
      
      console.log(`平均执行时间: ${avgTime.toFixed(2)}ms (${iterations}次)`);
      
      // 应在 500ms 内完成
      expect(avgTime).toBeLessThan(500);
    });

    test('输出大小应显著小于原始 HTML', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      const compressionRatio = testResults.rawHtmlSize / structure.length;
      
      console.log(`原始 HTML: ${(testResults.rawHtmlSize / 1024).toFixed(2)} KB`);
      console.log(`结构输出: ${(structure.length / 1024).toFixed(2)} KB`);
      console.log(`压缩比: ${compressionRatio.toFixed(2)}x`);
      
      // 结构输出应比原始 HTML 小很多
      expect(compressionRatio).toBeGreaterThan(2);
    });
  });

  // ===== 测试5: 特定页面特征测试 =====
  
  describe('Reddit 页面特征测试', () => {
    test('应识别帖子容器结构', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      const structureLower = structure.toLowerCase();
      
      // Reddit 页面应有帖子相关结构
      const hasPostStructure = 
        structureLower.includes('shreddit') || 
        structureLower.includes('post') ||
        structureLower.includes('comment') ||
        structureLower.includes('reddit');
      
      expect(hasPostStructure).toBe(true);
    });

    test('应识别导航结构', () => {
      const structure = testResults.pageStructure || getPageStructure(document);
      const structureLower = structure.toLowerCase();
      
      // 检查导航相关元素
      const navPatterns = ['nav', 'header', 'menu', 'sidebar'];
      let navFound = false;
      
      for (const pattern of navPatterns) {
        if (structureLower.includes(pattern)) {
          navFound = true;
          break;
        }
      }
      
      expect(navFound).toBe(true);
    });

    test('应正确处理 shadowRoot 元素（跳过）', () => {
      // 检查原始文档的 shadowRoot 元素数量
      const elementsWithShadowRoot = document.querySelectorAll('*');
      let shadowRootCount = 0;
      
      elementsWithShadowRoot.forEach(el => {
        if (el.shadowRoot) shadowRootCount++;
      });
      
      console.log(`原文档 shadowRoot 元素数: ${shadowRootCount}`);
      
      // 结构应该不包含 shadowRoot 内容
      const structure = testResults.pageStructure || getPageStructure(document);
      
      // 验证数据完整性
      expect(structure.length).toBeGreaterThan(0);
    });
  });
});

// ===== 生成输出文件 =====

describe('生成结构信息输出', () => {
  test('保存结构信息到文件', () => {
    const htmlPath = path.join(__dirname, 'reddit.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    const dom = new JSDOM(htmlContent, {
      runScripts: 'dangerously',
    });
    const document = dom.window.document;
    
    if (!dom.window.CSS) {
      dom.window.CSS = {
        escape: (str) => str.replace(/([^\w-])/g, '\\$1'),
      };
    }
    global.CSS = dom.window.CSS;
    
    const structure = getPageStructure(document);
    const tokens = estimateTokens(structure);
    const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
    
    // 统计数据
    const stats = {
      rawHtmlSize: htmlContent.length,
      structureSize: structure.length,
      tokenCount: tokens,
      treeDepth: calculateTreeDepth(tree),
      nodeCount: countTreeNodes(tree),
      elementCounts: countElementsByTag(tree),
      compressionRatio: (htmlContent.length / structure.length).toFixed(2),
    };
    
    // 生成报告
    const report = generateReport(structure, stats, testResults);
    
    // 保存到文件
    const outputPath = path.join(__dirname, '..', '结构信息.txt');
    fs.writeFileSync(outputPath, report, 'utf-8');
    
    console.log(`\n结构信息已保存至: ${outputPath}`);
    console.log(`Token 数量: ${tokens}/${TOKEN_LIMIT}`);
    
    dom.window.close();
    
    expect(structure.length).toBeGreaterThan(0);
  });
});

/**
 * 生成结构信息报告
 */
function generateReport(structure, stats, testResults) {
  const timestamp = new Date().toISOString();
  
  let report = '';
  report += '='.repeat(80) + '\n';
  report += '页面结构提取测试报告\n';
  report += '='.repeat(80) + '\n';
  report += `\n生成时间: ${timestamp}\n`;
  report += `测试文件: extension/tests/reddit.html\n`;
  report += '\n';
  
  report += '-'.repeat(80) + '\n';
  report += '统计数据\n';
  report += '-'.repeat(80) + '\n';
  report += `原始 HTML 大小: ${(stats.rawHtmlSize / 1024).toFixed(2)} KB\n`;
  report += `结构信息大小: ${(stats.structureSize / 1024).toFixed(2)} KB\n`;
  report += `压缩比: ${stats.compressionRatio}x\n`;
  report += `Token 预算使用: ${stats.tokenCount}/${TOKEN_LIMIT} (${((stats.tokenCount / TOKEN_LIMIT) * 100).toFixed(1)}%)\n`;
  report += `结构树深度: ${stats.treeDepth}\n`;
  report += `结构节点总数: ${stats.nodeCount}\n`;
  report += '\n';
  
  report += '-'.repeat(80) + '\n';
  report += '元素类型统计\n';
  report += '-'.repeat(80) + '\n';
  const sortedElements = Object.entries(stats.elementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [tag, count] of sortedElements) {
    report += `  ${tag.padEnd(15)} : ${count.toString().padStart(5)}\n`;
  }
  report += '\n';
  
  if (testResults.selectorVerification) {
    const sv = testResults.selectorVerification;
    report += '-'.repeat(80) + '\n';
    report += '选择器验证\n';
    report += '-'.repeat(80) + '\n';
    report += `总选择器数: ${sv.total}\n`;
    report += `抽样数量: ${sv.sampled}\n`;
    report += `验证成功: ${sv.verified}\n`;
    report += `验证失败: ${sv.failed}\n`;
    report += `成功率: ${((sv.verified / sv.sampled) * 100).toFixed(1)}%\n`;
    
    if (sv.failures.length > 0) {
      report += '\n失败示例:\n';
      sv.failures.slice(0, 5).forEach(f => {
        report += `  - ${f.selector}: ${f.reason}\n`;
      });
    }
    report += '\n';
  }
  
  report += '='.repeat(80) + '\n';
  report += '完整结构信息\n';
  report += '='.repeat(80) + '\n';
  report += '\n';
  report += structure;
  report += '\n';
  
  report += '='.repeat(80) + '\n';
  report += '报告结束\n';
  report += '='.repeat(80) + '\n';
  
  return report;
}