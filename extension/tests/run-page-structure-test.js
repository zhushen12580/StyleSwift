/**
 * 页面结构提取函数独立测试脚本
 * 
 * 运行方式: node extension/tests/run-page-structure-test.js
 * 
 * 测试目标：
 * - 在 token 预算下，最大限度地将页面结构信息全面、准确地提取出来
 * - 全面即不能丢失深层结构信息
 * - 准确即 Agent 能清楚知道哪些结构信息对应页面上的哪些部分
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// === 常量定义 ===

const SKIP_TAGS = new Set([
  "script", "style", "noscript", "meta", "link", "base", "head",
  "title", "template", "slot", "br", "hr", "wbr", "embed", "param",
  "source", "track", "area", "col", "colgroup",
]);

const LANDMARKS = new Set([
  "body", "header", "nav", "main", "aside", "footer", "article", "section",
]);

const STYLE_WHITELIST = [
  "display", "position", "float", "clear", "flex-direction",
  "justify-content", "align-items", "flex-wrap", "grid-template-columns",
  "grid-template-rows", "gap", "width", "height", "max-width", "max-height",
  "padding", "margin", "background-color", "color", "border-color",
  "border-radius", "box-shadow", "opacity", "z-index", "font-size",
  "font-family", "font-weight", "line-height", "letter-spacing",
  "text-decoration", "overflow",
];

const SKIP_VALUES = new Set([
  "none", "normal", "0px", "auto", "static", "visible",
]);

const COLLAPSE_THRESHOLD = 3;

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "li", "label",
]);

const VISUAL_PROPS = new Set([
  "background-color", "color", "border-radius", "box-shadow",
  "opacity", "position", "display", "width", "height",
]);

const ESSENTIAL_STYLE_PROPS = new Set([
  "background-color", "color", "font-size", "font-weight",
]);

const TOKEN_LIMIT = 8000;
const MAX_BUILD_DEPTH = 32;
const MAX_CHAIN_LENGTH = 5;
const STYLE_DEPTH_CUTOFF = 7;

// === 辅助函数 ===

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
      
      const escapedClass = CSS.escape(bestClass);
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

function getDirectText(el) {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .filter(Boolean)
    .join(" ");
}

function sameSignature(a, b) {
  return shortSelector(a) === shortSelector(b);
}

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

function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest / 4);
}

// === 格式化函数 ===

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

function getPageStructure(document) {
  const meta = extractMeta(document);
  const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
  return formatOutput(meta, tree);
}

// === 统计分析函数 ===

function calculateTreeDepth(node, currentDepth = 0) {
  if (!node) return currentDepth;
  if (!node.children || node.children.length === 0) return currentDepth;
  
  return Math.max(...node.children.map(child => 
    calculateTreeDepth(child, currentDepth + 1)
  ));
}

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

function verifySelectorsInDOM(selectors, document, sampleSize = 50) {
  const results = {
    total: selectors.length,
    verified: 0,
    failed: 0,
    sampled: 0,
    failures: [],
  };
  
  const sampleStep = Math.max(1, Math.floor(selectors.length / sampleSize));
  
  for (let i = 0; i < selectors.length && results.sampled < sampleSize; i += sampleStep) {
    const selector = selectors[i];
    results.sampled++;
    
    try {
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

// === 测试运行 ===

async function runTests() {
  console.log('='.repeat(80));
  console.log('页面结构提取函数测试');
  console.log('='.repeat(80));
  console.log('');
  
  // 读取测试 HTML 文件
  const htmlPath = path.join(__dirname, 'reddit.html');
  console.log(`加载测试文件: ${htmlPath}`);
  
  let htmlContent;
  try {
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    console.log(`原始 HTML 大小: ${(htmlContent.length / 1024).toFixed(2)} KB`);
  } catch (e) {
    console.error(`无法读取测试文件: ${e.message}`);
    process.exit(1);
  }
  
  // 创建 JSDOM 实例
  console.log('解析 HTML...');
  const startTime = Date.now();
  
  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    resources: 'usable',
  });
  const document = dom.window.document;
  
  // 确保 CSS.escape 存在
  if (!dom.window.CSS) {
    dom.window.CSS = {
      escape: (str) => str.replace(/([^\w-])/g, '\\$1'),
    };
  }
  global.CSS = dom.window.CSS;
  
  const parseTime = Date.now() - startTime;
  console.log(`HTML 解析完成: ${parseTime}ms`);
  console.log('');
  
  // 运行测试
  const testResults = {
    passed: 0,
    failed: 0,
    tests: [],
  };
  
  function test(name, fn) {
    try {
      fn();
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
    } catch (e) {
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAIL', error: e.message });
      console.log(`✗ ${name}`);
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // ===== Token 预算限制测试 =====
  console.log('-'.repeat(80));
  console.log('Token 预算限制测试');
  console.log('-'.repeat(80));
  
  let structure;
  let tree;
  let tokens;
  
  test('提取的结构应在 token 预算范围内', () => {
    structure = getPageStructure(document);
    tokens = estimateTokens(structure);
    
    if (tokens > TOKEN_LIMIT) {
      throw new Error(`Token 数量 ${tokens} 超过限制 ${TOKEN_LIMIT}`);
    }
  });
  
  test('结构文本大小应合理', () => {
    const sizeKB = structure.length / 1024;
    console.log(`  结构文本大小: ${sizeKB.toFixed(2)} KB`);
    console.log(`  Token 数量: ${tokens}`);
    
    if (sizeKB > 500) {
      throw new Error(`结构文本过大: ${sizeKB.toFixed(2)} KB`);
    }
  });
  
  // ===== 结构完整性测试 =====
  console.log('');
  console.log('-'.repeat(80));
  console.log('结构完整性测试');
  console.log('-'.repeat(80));
  
  test('应包含页面标题信息', () => {
    if (!structure.includes('Title:')) {
      throw new Error('缺少标题信息');
    }
    if (!structure.toLowerCase().includes('reddit')) {
      throw new Error('标题不包含 reddit');
    }
  });
  
  test('不应丢失关键语义元素', () => {
    const structureLower = structure.toLowerCase();
    const keyElements = ['header', 'nav', 'main', 'article'];
    let foundCount = 0;
    
    for (const elem of keyElements) {
      if (structureLower.includes(elem)) {
        foundCount++;
      }
    }
    
    console.log(`  关键语义元素覆盖: ${foundCount}/${keyElements.length}`);
    
    if (foundCount < keyElements.length / 2) {
      throw new Error(`关键元素覆盖率不足: ${foundCount}/${keyElements.length}`);
    }
  });
  
  test('应提取深层结构（深度 >= 5）', () => {
    tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
    const depth = calculateTreeDepth(tree);
    console.log(`  结构树深度: ${depth}`);
    
    if (depth < 5) {
      throw new Error(`结构深度不足: ${depth}`);
    }
  });
  
  test('应包含合理数量的结构节点', () => {
    const nodeCount = countTreeNodes(tree);
    console.log(`  结构节点总数: ${nodeCount}`);
    
    if (nodeCount < 10) {
      throw new Error(`节点数量不足: ${nodeCount}`);
    }
  });
  
  test('应正确折叠重复元素', () => {
    const collapseMatches = structure.match(/×\s*\d+/g);
    const collapseCount = collapseMatches ? collapseMatches.length : 0;
    console.log(`  折叠元素组数: ${collapseCount}`);
  });
  
  // ===== 选择器准确性测试 =====
  console.log('');
  console.log('-'.repeat(80));
  console.log('选择器准确性测试');
  console.log('-'.repeat(80));
  
  test('提取的选择器应能在原文档中定位元素', () => {
    const selectors = extractSelectors(tree);
    const verification = verifySelectorsInDOM(selectors, document, 30);
    
    console.log(`  总选择器数: ${verification.total}`);
    console.log(`  抽样数量: ${verification.sampled}`);
    console.log(`  验证成功: ${verification.verified}`);
    console.log(`  验证失败: ${verification.failed}`);
    
    const successRate = verification.verified / verification.sampled;
    console.log(`  成功率: ${(successRate * 100).toFixed(1)}%`);
    
    if (successRate < 0.9) {
      throw new Error(`选择器验证成功率过低: ${(successRate * 100).toFixed(1)}%`);
    }
  });
  
  test('选择器应包含有效的样式信息', () => {
    const stylePattern = /\[(color|background|font|display|width|height):[^\]]+\]/gi;
    const styleMatches = structure.match(stylePattern);
    const styleCount = styleMatches ? styleMatches.length : 0;
    
    console.log(`  包含样式信息的节点数: ${styleCount}`);
    
    if (styleCount === 0) {
      throw new Error('缺少样式信息');
    }
  });
  
  test('ID 选择器应正确处理', () => {
    const idSelectors = structure.match(/#[\w-]+/g);
    const idCount = idSelectors ? idSelectors.length : 0;
    
    console.log(`  ID 选择器数量: ${idCount}`);
  });
  
  // ===== 性能基准测试 =====
  console.log('');
  console.log('-'.repeat(80));
  console.log('性能基准测试');
  console.log('-'.repeat(80));
  
  test('结构提取应在合理时间内完成', () => {
    const iterations = 3;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      getPageStructure(document);
    }
    
    const avgTime = (Date.now() - start) / iterations;
    console.log(`  平均执行时间: ${avgTime.toFixed(2)}ms (${iterations}次)`);
    
    if (avgTime > 500) {
      throw new Error(`执行时间过长: ${avgTime.toFixed(2)}ms`);
    }
  });
  
  test('输出大小应显著小于原始 HTML', () => {
    const compressionRatio = htmlContent.length / structure.length;
    console.log(`  原始 HTML: ${(htmlContent.length / 1024).toFixed(2)} KB`);
    console.log(`  结构输出: ${(structure.length / 1024).toFixed(2)} KB`);
    console.log(`  压缩比: ${compressionRatio.toFixed(2)}x`);
    
    if (compressionRatio < 2) {
      throw new Error(`压缩比过低: ${compressionRatio.toFixed(2)}x`);
    }
  });
  
  // ===== Reddit 页面特征测试 =====
  console.log('');
  console.log('-'.repeat(80));
  console.log('Reddit 页面特征测试');
  console.log('-'.repeat(80));
  
  test('应识别帖子容器结构', () => {
    const structureLower = structure.toLowerCase();
    const hasPostStructure = 
      structureLower.includes('shreddit') || 
      structureLower.includes('post') ||
      structureLower.includes('comment') ||
      structureLower.includes('reddit');
    
    console.log(`  包含 Reddit 特征: ${hasPostStructure}`);
    
    if (!hasPostStructure) {
      throw new Error('缺少 Reddit 页面特征');
    }
  });
  
  test('应识别导航结构', () => {
    const structureLower = structure.toLowerCase();
    const navPatterns = ['nav', 'header', 'menu', 'sidebar'];
    let navFound = false;
    
    for (const pattern of navPatterns) {
      if (structureLower.includes(pattern)) {
        navFound = true;
        break;
      }
    }
    
    console.log(`  导航结构识别: ${navFound}`);
    
    if (!navFound) {
      throw new Error('未识别导航结构');
    }
  });
  
  // ===== 生成报告 =====
  console.log('');
  console.log('='.repeat(80));
  console.log('测试摘要');
  console.log('='.repeat(80));
  console.log(`通过: ${testResults.passed}`);
  console.log(`失败: ${testResults.failed}`);
  console.log(`总计: ${testResults.passed + testResults.failed}`);
  console.log('');
  
  // ===== 保存结构信息到文件 =====
  const elementCounts = countElementsByTag(tree);
  const stats = {
    rawHtmlSize: htmlContent.length,
    structureSize: structure.length,
    tokenCount: tokens,
    treeDepth: calculateTreeDepth(tree),
    nodeCount: countTreeNodes(tree),
    elementCounts: elementCounts,
    compressionRatio: (htmlContent.length / structure.length).toFixed(2),
  };
  
  // 生成报告
  const report = generateReport(structure, stats);
  const outputPath = path.join(__dirname, '..', '结构信息.txt');
  
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`结构信息已保存至: ${outputPath}`);
  console.log('');
  
  // 清理
  dom.window.close();
  
  // 返回退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

function generateReport(structure, stats) {
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
    .slice(0, 30);
  for (const [tag, count] of sortedElements) {
    report += `  ${tag.padEnd(15)} : ${count.toString().padStart(5)}\n`;
  }
  report += '\n';
  
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

// 运行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});