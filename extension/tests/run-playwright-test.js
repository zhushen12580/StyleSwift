/**
 * Playwright 浏览器环境页面结构提取测试
 * 
 * 运行方式: node extension/tests/run-playwright-test.js
 * 
 * 目标：在真实浏览器环境中提取 Reddit 页面结构
 * 对比 JSDOM 静态解析与真实浏览器渲染的差异
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// === 常量定义（与 content.js 保持一致）===

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

// === 页面内执行的提取函数 ===

// 这个函数会被注入到浏览器页面中执行
const PAGE_STRUCTURE_SCRIPT = `
(function() {
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
  const MAX_CHAIN_LENGTH = 5;
  const MAX_BUILD_DEPTH = 32;
  const TOKEN_LIMIT = 8000;
  const STYLE_DEPTH_CUTOFF = 7;

  function shortSelector(el) {
    const tag = el.tagName.toLowerCase();
    const testAttr = el.getAttribute("data-testid") ||
      el.getAttribute("data-cy") || el.getAttribute("data-test");
    if (testAttr) return '[data-testid="' + testAttr + '"]';
    if (el.id) return tag + "#" + el.id;
    if (el.className && typeof el.className === "string") {
      const classes = el.className.split(/\\s+/).filter(Boolean);
      if (classes.length > 0) return tag + "." + classes[0];
    }
    return tag;
  }

  function uniqueSelector(el, validate = false) {
    const tag = el.tagName.toLowerCase();
    const testAttr = el.getAttribute("data-testid") ||
      el.getAttribute("data-cy") || el.getAttribute("data-test");
    if (testAttr) {
      const selector = '[data-testid="' + testAttr + '"]';
      if (!validate || document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
    if (el.id) return "#" + CSS.escape(el.id);
    const parent = el.parentElement;
    if (!parent) return shortSelector(el);
    const sameTagSiblings = Array.from(parent.children).filter(
      (s) => s.tagName.toLowerCase() === tag
    );
    if (sameTagSiblings.length <= 1) return shortSelector(el);
    if (el.className && typeof el.className === "string") {
      const classes = el.className.split(/\\s+/).filter(Boolean);
      if (classes.length > 0) {
        let bestClass = classes[0];
        let bestMatchCount = Infinity;
        for (const cls of classes) {
          const count = sameTagSiblings.filter((s) => {
            if (!s.className || typeof s.className !== "string") return false;
            return s.className.split(/\\s+/).filter(Boolean).includes(cls);
          }).length;
          if (count < bestMatchCount) {
            bestMatchCount = count;
            bestClass = cls;
            if (count === 1) break;
          }
        }
        const escapedClass = CSS.escape(bestClass);
        const base = tag + "." + escapedClass;
        if (bestMatchCount <= 1) return base;
        const index = sameTagSiblings.indexOf(el) + 1;
        return base + ":nth-of-type(" + index + ")";
      }
    }
    const index = sameTagSiblings.indexOf(el) + 1;
    return tag + ":nth-of-type(" + index + ")";
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
      .map(([k, v]) => (v > 1 ? k + "×" + v : k))
      .join(", ");
  }

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

  function pickStylesForDisplay(tag, pairs) {
    if (LANDMARKS.has(tag)) return pairs;
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
    const cjk = (text.match(/[\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]/g) || []).length;
    const rest = text.length - cjk;
    return Math.ceil(cjk * 1.5 + rest / 4);
  }

  function formatNodeDecoration(node, compact = false) {
    let deco = "";
    if (node.styles && node.styles.length) {
      if (!compact) {
        deco += " [" + node.styles.map(([p, v]) => p + ":" + v).join("; ") + "]";
      } else {
        const essential = node.styles.filter(([p]) => ESSENTIAL_STYLE_PROPS.has(p));
        if (essential.length) {
          deco += " [" + essential.map(([p, v]) => p + ":" + v).join("; ") + "]";
        }
      }
    }
    if (node.count) deco += " × " + node.count;
    if (node.text) deco += ' "' + node.text + '"';
    if (node.summary) deco += " — " + node.summary;
    return deco;
  }

  function formatTreeNode(node, indent, isLast, maxDepth, compact, currentDepth) {
    if (!node || maxDepth <= 0) return "";
    const effectiveCompact = compact || currentDepth >= STYLE_DEPTH_CUTOFF;
    const prefix = isLast ? "└── " : "├── ";
    const childIndent = indent + (isLast ? "    " : "│   ");
    let line = indent + prefix + node.selector;
    line += formatNodeDecoration(node, effectiveCompact);
    let result = line + "\\n";
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        result += formatTreeNode(
          node.children[i], childIndent,
          i === node.children.length - 1, maxDepth - 1, compact, currentDepth + 1
        );
      }
    }
    return result;
  }

  function formatTree(node, indent, isLast, maxDepth, compact) {
    if (!node) return "";
    let line = node.selector;
    line += formatNodeDecoration(node, compact);
    let result = line + "\\n";
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        result += formatTreeNode(
          node.children[i], indent,
          i === node.children.length - 1, maxDepth - 1, compact, 1
        );
      }
    }
    return result;
  }

  function nodeToSummary(node) {
    if (!node) return null;
    if (!node.children || node.children.length === 0) return { ...node };
    const summaryParts = [];
    const counts = {};
    for (const child of node.children) {
      const key = child.selector || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      summaryParts.push(count > 1 ? key + "×" + count : key);
    }
    return {
      selector: node.selector,
      styles: node.styles,
      text: node.text,
      count: node.count,
      summary: summaryParts.join(", "),
    };
  }

  function formatTreeWithSummaryThreshold(node, indent, isLast, maxFullDepth, currentDepth) {
    if (!node) return "";
    const effectiveNode = currentDepth >= maxFullDepth && node.children && node.children.length > 0
      ? nodeToSummary(node) : node;
    const prefix = isLast ? "└── " : "├── ";
    const childIndent = indent + (isLast ? "    " : "│");
    const isCompact = currentDepth >= STYLE_DEPTH_CUTOFF || currentDepth >= maxFullDepth;
    let line = indent + prefix + effectiveNode.selector;
    line += formatNodeDecoration(effectiveNode, isCompact);
    let result = line + "\\n";
    if (currentDepth < maxFullDepth && effectiveNode !== nodeToSummary(node) && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        result += formatTreeWithSummaryThreshold(
          node.children[i], childIndent,
          i === node.children.length - 1, maxFullDepth, currentDepth + 1
        );
      }
    }
    return result;
  }

  function formatRootTreeWithSummaryThreshold(node, maxFullDepth) {
    if (!node) return "";
    let line = node.selector;
    line += formatNodeDecoration(node, false);
    let result = line + "\\n";
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        result += formatTreeWithSummaryThreshold(
          node.children[i], "", true, maxFullDepth, 1
        );
      }
    }
    return result;
  }

  function estimateNodeTokens(node) {
    if (!node) return 0;
    let size = (node.selector ? node.selector.length : 0) / 3.5;
    if (node.styles && node.styles.length) size += node.styles.length * 8;
    size += (node.text ? node.text.length : 0) / 3.5;
    size += (node.summary ? node.summary.length : 0) / 3.5;
    if (node.count) size += 3;
    if (node.children) {
      for (const child of node.children) {
        size += estimateNodeTokens(child);
      }
    }
    return Math.ceil(size);
  }

  function buildTree(element, depth, maxDepth) {
    let tag = element.tagName ? element.tagName.toLowerCase() : null;
    if (!tag) return null;
    // Shadow DOM 检测
    const hasShadowRoot = !!element.shadowRoot;
    if (hasShadowRoot || SKIP_TAGS.has(tag)) return null;

    let current = element;
    const chainParts = [uniqueSelector(element)];

    if (!LANDMARKS.has(tag)) {
      while (chainParts.length < MAX_CHAIN_LENGTH) {
        if (getDirectText(current)) break;
        const visibleChildren = Array.from(current.children).filter(
          (c) => !SKIP_TAGS.has(c.tagName ? c.tagName.toLowerCase() : "") && !c.shadowRoot
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
      (c) => !SKIP_TAGS.has(c.tagName ? c.tagName.toLowerCase() : "") && !c.shadowRoot
    );

    if (depth >= maxDepth || childEls.length === 0) {
      const summary = summarizeChildren(childEls);
      return { selector: selector, text: text, styles: styles, summary: summary, hasShadowRoot: hasShadowRoot };
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

    return { selector: selector, text: text, styles: styles, children: children, hasShadowRoot: hasShadowRoot };
  }

  function formatOutput(meta, tree) {
    const depthThresholds = [32, 24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2];
    for (const threshold of depthThresholds) {
      const result = formatRootTreeWithSummaryThreshold(tree, threshold);
      if (estimateTokens(result) <= TOKEN_LIMIT) {
        return meta + "\\n\\n" + result;
      }
    }
    return meta + "\\n\\n" + formatTree(tree, "", true, 2, true);
  }

  // 统计函数
  function calculateTreeDepth(node, currentDepth) {
    currentDepth = currentDepth || 0;
    if (!node) return currentDepth;
    if (!node.children || node.children.length === 0) return currentDepth;
    return Math.max.apply(null, node.children.map(function(child) {
      return calculateTreeDepth(child, currentDepth + 1);
    }));
  }

  function countTreeNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        count += countTreeNodes(node.children[i]);
      }
    }
    return count;
  }

  function countShadowRoots(node, count) {
    count = count || 0;
    if (!node) return count;
    if (node.hasShadowRoot) count++;
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        count = countShadowRoots(node.children[i], count);
      }
    }
    return count;
  }

  function countElementsByTag(node, counts) {
    counts = counts || {};
    if (!node) return counts;
    var tag = node.selector ? node.selector.split(/[.#>\\s]/)[0] : "unknown";
    counts[tag] = (counts[tag] || 0) + 1;
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        countElementsByTag(node.children[i], counts);
      }
    }
    return counts;
  }

  // 主函数
  function getPageStructure() {
    const meta = "Title: " + document.title;
    const tree = buildTree(document.body, 0, MAX_BUILD_DEPTH);
    const structure = formatOutput(meta, tree);
    return {
      structure: structure,
      stats: {
        title: document.title,
        url: window.location.href,
        treeDepth: calculateTreeDepth(tree),
        nodeCount: countTreeNodes(tree),
        shadowRootCount: countShadowRoots(tree),
        elementCounts: countElementsByTag(tree)
      }
    };
  }

  return getPageStructure();
})();
`;

// === 运行测试 ===

async function runTest() {
  console.log('='.repeat(80));
  console.log('Playwright 浏览器环境测试');
  console.log('='.repeat(80));
  console.log('');
  
  let browser;
  let page;
  
  try {
    console.log('启动浏览器...');
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    // 使用本地 HTML 文件进行测试
    const htmlPath = path.join(__dirname, 'reddit.html');
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    
    console.log('加载本地 HTML 文件...');
    console.log(`路径: ${htmlPath}`);
    console.log('');
    
    // 加载本地文件
    await page.goto(fileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // 等待自定义元素注册和渲染
    await page.waitForTimeout(5000);
    
    // 获取页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    console.log('');
    
    // 执行页面结构提取
    console.log('提取页面结构...');
    const startTime = Date.now();
    
    const result = await page.evaluate(PAGE_STRUCTURE_SCRIPT);
    
    const endTime = Date.now();
    console.log(`提取完成: ${endTime - startTime}ms`);
    console.log('');
    
    // 输出统计信息
    console.log('-'.repeat(80));
    console.log('统计信息');
    console.log('-'.repeat(80));
    console.log(`URL: ${result.stats.url}`);
    console.log(`标题: ${result.stats.title}`);
    console.log(`结构树深度: ${result.stats.treeDepth}`);
    console.log(`结构节点总数: ${result.stats.nodeCount}`);
    console.log(`Shadow DOM 元素数: ${result.stats.shadowRootCount}`);
    console.log('');
    
    console.log('-'.repeat(80));
    console.log('元素类型统计 (Top 20)');
    console.log('-'.repeat(80));
    const sortedElements = Object.entries(result.stats.elementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    for (const [tag, count] of sortedElements) {
      console.log(`  ${tag.padEnd(20)} : ${count.toString().padStart(5)}`);
    }
    console.log('');
    
    // 估算 token
    const tokens = estimateTokens(result.structure);
    console.log(`Token 估算: ${tokens}`);
    console.log('');
    
    // 保存结果
    const report = generateReport(result);
    const outputPath = path.join(__dirname, '..', '结构信息-playwright.txt');
    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`结构信息已保存至: ${outputPath}`);
    console.log('');
    
    // 对比 JSDOM 结果
    const jsdomPath = path.join(__dirname, '..', '结构信息.txt');
    if (fs.existsSync(jsdomPath)) {
      const jsdomContent = fs.readFileSync(jsdomPath, 'utf-8');
      const jsdomTokens = estimateTokens(jsdomContent);
      
      console.log('-'.repeat(80));
      console.log('JSDOM vs Playwright 对比');
      console.log('-'.repeat(80));
      console.log(`JSDOM Token: ${jsdomTokens}`);
      console.log(`Playwright Token: ${tokens}`);
      console.log(`差异: ${tokens - jsdomTokens} (${((tokens - jsdomTokens) / jsdomTokens * 100).toFixed(1)}%)`);
      
      const jsdomLines = jsdomContent.split('\n').length;
      const playwrightLines = result.structure.split('\n').length;
      console.log(`JSDOM 行数: ${jsdomLines}`);
      console.log(`Playwright 行数: ${playwrightLines}`);
      console.log('');
    }
    
    // 测试通过标志
    console.log('='.repeat(80));
    console.log('测试完成');
    console.log('='.repeat(80));
    
    return result;
    
  } catch (error) {
    console.error('测试失败:', error.message);
    throw error;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

function estimateTokens(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest / 4);
}

function generateReport(result) {
  const timestamp = new Date().toISOString();
  const tokens = estimateTokens(result.structure);
  
  let report = '';
  report += '='.repeat(80) + '\n';
  report += '页面结构提取测试报告 (Playwright 浏览器环境)\n';
  report += '='.repeat(80) + '\n';
  report += `\n生成时间: ${timestamp}\n`;
  report += `测试 URL: ${result.stats.url}\n`;
  report += '\n';
  
  report += '-'.repeat(80) + '\n';
  report += '统计数据\n';
  report += '-'.repeat(80) + '\n';
  report += `页面标题: ${result.stats.title}\n`;
  report += `Token 预算使用: ${tokens}/${TOKEN_LIMIT} (${((tokens / TOKEN_LIMIT) * 100).toFixed(1)}%)\n`;
  report += `结构树深度: ${result.stats.treeDepth}\n`;
  report += `结构节点总数: ${result.stats.nodeCount}\n`;
  report += `Shadow DOM 元素数: ${result.stats.shadowRootCount}\n`;
  report += '\n';
  
  report += '-'.repeat(80) + '\n';
  report += '元素类型统计\n';
  report += '-'.repeat(80) + '\n';
  const sortedElements = Object.entries(result.stats.elementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  for (const [tag, count] of sortedElements) {
    report += `  ${tag.padEnd(20)} : ${count.toString().padStart(5)}\n`;
  }
  report += '\n';
  
  report += '='.repeat(80) + '\n';
  report += '完整结构信息\n';
  report += '='.repeat(80) + '\n';
  report += '\n';
  report += result.structure;
  report += '\n';
  
  report += '='.repeat(80) + '\n';
  report += '报告结束\n';
  report += '='.repeat(80) + '\n';
  
  return report;
}

// 运行测试
runTest().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});