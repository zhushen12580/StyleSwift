# StyleSwift Agent 设计方案

> 版本：v3.2
> 日期：2026-03-03
> 设计理念：基于 agent-builder 哲学 - The model IS the agent, code just provides capabilities

---

## 一、核心定位

```
Purpose: 让用户用一句话个性化任意网页的视觉样式
Domain: 网页样式设计 + 浏览器交互
Trust: 模型自己决定改什么、怎么改、改到什么程度
```

**核心场景：**
- 整体换皮：深色模式、护眼模式、极简风格
- 局部调整：放大按钮、调整字体、修改颜色
- 风格化表达：赛博朋克、复古、现代感

---

## 二、架构总览

```
StyleSwift Agent
│
├── SessionContext               # 会话上下文（域名+会话ID，工具的隐式依赖）
│
├── Tools (原子能力) - 全部是动作，不做推理
│   ├── get_page_structure()    # 返回页面整体结构概览
│   ├── grep()                  # 查询指定选择器详细信息
│   ├── apply_styles()          # 预览/应用/保存/回滚（含原 save_preference）
│   ├── get_user_profile()      # 读取用户风格画像
│   ├── update_user_profile()   # 更新用户风格画像
│   └── load_skill()            # 按需加载知识
│
├── Task (子智能体) - 隔离上下文的推理
│   └── StyleGenerator          # 样式生成
│
└── TodoWrite (可选)            # 模型决定是否使用
```

**关键原则：**
- Tools 只做原子操作，不包含任何推理逻辑
- 模型主动查询信息（grep），而非强制用户交互（pick_element）
- 知识通过 `load_skill` 工具按需加载，模型自己决定
- Subagent 只给任务描述，不预设内部工作流
- Context 保持最小，用户偏好通过工具获取

---

## 三、Tools（原子能力）

### 设计原则

```
每个 Tool 必须：
1. 原子性 - 做一件事，不做推理
2. 清晰描述 - 模型知道它能做什么
3. 简单输出 - 返回事实，不返回判断
```

### SessionContext（工具的隐式依赖）

所有工具通过 SessionContext 获取当前域名和会话信息，而非每次调用 `get_active_tab_domain()`。
SessionContext 在会话启动时创建一次，工具内部读取，模型接口不暴露 path/domain 参数。

```python
class SessionContext:
    """会话上下文 — 工具的隐式依赖，模型无感知"""
    def __init__(self, domain: str, session_id: str):
        self.domain = domain
        self.session_id = session_id

    @property
    def page_html_path(self):
        return STORAGE_DIR / f"domains/{self.domain}/page.html"

    @property
    def session_dir(self):
        return STORAGE_DIR / f"domains/{self.domain}/sessions/{self.session_id}"

    @property
    def styles_path(self):
        return self.session_dir / "styles.css"

    @property
    def history_path(self):
        return self.session_dir / "history.json"

# 会话启动时创建，全局可用
current_session: SessionContext = None
```

### 3.1 get_page_structure

整体流程：

```
Chrome Extension (用户发消息时触发)
│
├── cloneNode(true) 克隆 DOM（不碰原页面）
├── 白名单过滤标签 + 跳过 Shadow DOM 元素
├── getComputedStyle() 注入关键计算样式为 data-cs 属性
└── 保存 outerHTML → storage/domains/{域名}/page.html

Agent 端（通过 SessionContext 定位对应文件）
│
├── get_page_structure()  → 读取 current_session.page_html_path → 解析+简化 → 返回树形概览
└── grep()                → 搜索同一文件获取详细信息
```

#### 3.1.1 Chrome 插件端：采集与保存

```javascript
// === 标签白名单 ===
const TAG_WHITELIST = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img',
  'form', 'input', 'button', 'select', 'textarea', 'label',
  'section', 'article', 'nav', 'header', 'footer', 'aside', 'main',
  'blockquote', 'figure', 'figcaption', 'details', 'summary',
  'video', 'audio', 'dialog'
]);

// === 样式白名单 + 缩写映射 ===
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

const ABBR = {
  'display': 'd', 'position': 'pos', 'float': 'fl', 'clear': 'cl',
  'flex-direction': 'fd', 'justify-content': 'jc', 'align-items': 'ai', 'flex-wrap': 'fw',
  'grid-template-columns': 'gtc', 'grid-template-rows': 'gtr', 'gap': 'gap',
  'width': 'w', 'height': 'h', 'max-width': 'mw', 'max-height': 'mh',
  'padding': 'p', 'margin': 'm',
  'background-color': 'bg', 'color': 'c', 'border-color': 'bc', 'border-radius': 'br',
  'box-shadow': 'bs', 'opacity': 'op', 'z-index': 'z',
  'font-size': 'fs', 'font-family': 'ff', 'font-weight': 'fw', 'line-height': 'lh',
  'letter-spacing': 'ls', 'text-decoration': 'td',
  'overflow': 'of'
};

// === 无意义样式值（过滤用）===
const SKIP_VALUES = new Set(['none', 'normal', '0px', 'auto', 'static', 'visible']);

function captureAndSave() {
  // 在克隆体上操作，不影响原页面
  const clone = document.documentElement.cloneNode(true);
  const body = clone.querySelector('body');

  body.querySelectorAll('*').forEach(el => {
    const tag = el.tagName.toLowerCase();

    // 白名单过滤：不在白名单中的标签移除
    if (!TAG_WHITELIST.has(tag)) {
      el.remove();
      return;
    }

    // 跳过 Shadow DOM 元素（通常是悬浮球等第三方组件，无需样式化）
    const originalEl = document.querySelector(buildSelectorFor(el));
    if (originalEl?.shadowRoot) {
      el.remove();
      return;
    }

    // 注入关键计算样式
    if (originalEl) {
      const cs = window.getComputedStyle(originalEl);
      const styles = [];
      for (const prop of STYLE_WHITELIST) {
        const val = cs.getPropertyValue(prop);
        if (val && !SKIP_VALUES.has(val)) {
          styles.push(`${ABBR[prop]}:${val}`);
        }
      }
      if (styles.length) {
        el.setAttribute('data-cs', styles.join(';'));
      }
    }
  });

  // 保存到 storage/domains/{domain}/page.html，与 Agent 端 SessionContext 路径对齐
  const html = clone.outerHTML;
  const domain = window.location.hostname;  // 如 "example.com"
  saveToLocal(html, `domains/${domain}/page.html`);
}
```

保存后的 HTML 示例：

```html
<header class="site-header" data-cs="bg:#ffffff;c:#333;h:60px;pos:fixed;w:100%;z:1000;bs:0 2px 4px rgba(0,0,0,0.1)">
  <nav class="main-nav" data-cs="d:flex;gap:24px;c:#333;fs:14px">
    <a class="nav-link" href="/" data-cs="c:#0066cc;fw:500;p:8px 12px">首页</a>
    <a class="nav-link" href="/products" data-cs="c:#0066cc;fw:500;p:8px 12px">产品</a>
  </nav>
</header>
```

#### 3.1.2 Agent 端：简化管道

```python
GET_PAGE_STRUCTURE_TOOL = {
    "name": "get_page_structure",
    "description": "获取当前页面的结构概览。返回树形结构，包含标签、选择器、关键样式。",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

def run_get_page_structure() -> str:
    """
    读取当前会话域名对应的本地 HTML 文件，解析并简化后返回树形结构概览。
    返回原始结构信息，不做任何判断，让模型自己推理。
    目标 token 量：500 - 2000。
    """
    html = read_file(current_session.page_html_path)
    soup = BeautifulSoup(html, 'html.parser')

    # 1. 提取元信息
    meta = extract_meta(soup)

    # 2. 从 body 开始构建简化树
    tree = build_tree(soup.body, depth=0, max_depth=3)

    # 3. 格式化输出（含自适应 token 控制）
    return format_output(meta, tree)
```

**简化管道核心逻辑：**

```python
LANDMARKS = {'header', 'nav', 'main', 'aside', 'footer', 'article', 'section'}
COLLAPSE_THRESHOLD = 3

def build_tree(element, depth, max_depth):
    """递归构建简化树"""
    selector = build_full_path_selector(element)
    text = get_direct_text(element)[:40]
    styles = element.get('data-cs', '')

    children_els = [c for c in element.children
                    if hasattr(c, 'name') and c.name]

    # 超过深度限制 或 叶节点 → 只返回摘要
    if depth >= max_depth or not children_els:
        summary = summarize_children(children_els)
        return TreeNode(selector, text, styles, summary=summary)

    # 分组折叠：相邻的 tag+class 相同的兄弟节点归为一组
    groups = group_similar(children_els)
    child_nodes = []

    for group in groups:
        if len(group) >= COLLAPSE_THRESHOLD:
            # ≥3 个相似兄弟 → 折叠，取第一个作代表，标记数量
            rep = build_tree(group[0], depth + 1, max_depth)
            child_nodes.append(CollapsedNode(rep, count=len(group)))
        else:
            for child in group:
                # 地标元素允许额外多展开一层
                child_max = max_depth + 1 if child.name in LANDMARKS else max_depth
                child_nodes.append(build_tree(child, depth + 1, child_max))

    return TreeNode(selector, text, styles, children=child_nodes)


def group_similar(children):
    """相邻的 tag + class 相同的子元素归为一组"""
    groups = []
    current_group = [children[0]]

    for child in children[1:]:
        if same_signature(child, current_group[0]):
            current_group.append(child)
        else:
            groups.append(current_group)
            current_group = [child]
    groups.append(current_group)
    return groups


def same_signature(a, b):
    return a.name == b.name and a.get('class', []) == b.get('class', [])


def build_full_path_selector(element):
    """生成完整路径选择器: body > header.site-header > nav.main-nav"""
    parts = []
    current = element
    while current and current.name and current.name != '[document]':
        part = current.name
        if current.get('id'):
            part += f"#{current['id']}"
        elif current.get('class'):
            part += '.' + '.'.join(current['class'])
        parts.append(part)
        current = current.parent
    return ' > '.join(reversed(parts))
```

**样式详略控制（不同类型的元素展示不同的样式属性）：**

```python
TEXT_TAGS = {'h1','h2','h3','h4','h5','h6','p','span','a','li','label'}
VISUAL_KEYS = ('bg', 'c', 'br', 'bs', 'op', 'pos', 'd', 'w', 'h')

def pick_styles_for_display(tag_name, data_cs):
    """地标元素展示全量样式，文本元素只展示字体颜色，其他只展示视觉属性"""
    styles = parse_data_cs(data_cs)

    if tag_name in LANDMARKS:
        return styles

    if tag_name in TEXT_TAGS:
        return {k: v for k, v in styles.items()
                if k in ('c', 'fs', 'fw', 'ff', 'lh', 'td')}

    return {k: v for k, v in styles.items() if k in VISUAL_KEYS}
```

**自适应 token 控制：**

```python
def format_output(meta, tree):
    """目标 500-2000 tokens，超出则逐级降级"""
    result = format_tree(tree, max_depth=3)

    if estimate_tokens(result) > 2000:
        result = format_tree(tree, max_depth=2)

    if estimate_tokens(result) > 2000:
        result = format_tree(tree, max_depth=2, landmarks_only=True)

    return meta + "\n" + result
```

#### 3.1.3 输出格式

树形文本格式，比 JSON 节省 2-3 倍 token：

```
URL: https://example.com/blog/post/123
Title: 如何设计高效的CSS架构
Viewport: 1920 × 1080

body [bg:#fff; c:#333; fs:16px; ff:"Microsoft YaHei",sans-serif]
├── header.site-header [bg:#fff; h:60px; pos:fixed; bs:0 2px 4px rgba(0,0,0,.1)]
│   ├── a.logo ["StyleSwift"]
│   ├── nav.main-nav [d:flex; gap:24px; c:#333; fs:14px]
│   │   └── a.nav-link × 5 [c:#0066cc; fw:500]: 首页|产品|博客|关于|联系
│   └── div.user-actions [d:flex; gap:12px]
│       └── button.btn × 2 [bg:#0066cc; c:#fff; br:4px]: 登录|注册
├── main#content [d:flex; m:80px 0 0 0]
│   ├── article.post [w:800px; p:40px]
│   │   ├── h1 [fs:32px; fw:700; c:#111] "如何设计高效的CSS架构"
│   │   ├── div.meta [c:#999; fs:14px] — span × 3
│   │   ├── div.content [...: p×12, h2×4, img×3, pre.code×6, blockquote×2]
│   │   └── div.comments — div.comment × 18
│   └── aside.sidebar [w:300px; bg:#f9f9f9; p:20px]
│       └── div.widget × 3 [bg:#fff; br:8px; p:16px; bs:0 1px 3px rgba(0,0,0,.08)]
└── footer.site-footer [bg:#f5f5f5; c:#666; p:40px]
    ├── div.footer-nav — a × 12
    └── div.copyright "© 2026"
```

格式规则：
- **选择器**：树形中用短选择器（`header.site-header`），完整路径从层级可推断
- **样式**：`[缩写:值]` 格式，内联在节点后，按元素类型控制详略
- **折叠**：`× N` 标记相似兄弟节点数量（N ≥ 3 触发），用 `|` 分隔内容示例
- **深层摘要**：`[...: 组成]` 格式，列出子元素构成但不展开
- **文本预览**：引号 `"..."` 包裹，截断到 40 字符

### 3.2 grep

**定位：** `get_page_structure` 返回页面概览（广度优先，500-2000 tokens），`grep` 负责按需深入（深度优先，200-800 tokens/次）。模型看完概览后，主动 grep 感兴趣的区域获取详细信息。

```
信息获取链路：

get_page_structure()          grep()
  │                             │
  ├── 全局概览                   ├── 某个区域的完整样式
  ├── 3 层深度                   ├── 某类元素的所有实例
  ├── 样式按类型详略显示          ├── 特定样式值的元素
  └── 500-2000 tokens           └── 200-800 tokens/次
```

#### 3.2.1 Tool 定义

```python
GREP_TOOL = {
    "name": "grep",
    "description": """在本地保存的页面 HTML 中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）。

搜索方式（自动检测）：
- CSS 选择器：".sidebar", "nav > a.active", "#main h2"
- 关键词：在标签名、class、id、文本内容、样式值中匹配

典型用途：
- 看完 get_page_structure 概览后，深入查看某个区域的详情
- 查找具有特定样式值的元素（如搜 "bg:#fff" 找白色背景元素）
- 确认某个选择器是否存在、有多少匹配""",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "CSS 选择器或关键词"
            },
            "scope": {
                "type": "string",
                "enum": ["self", "children", "subtree"],
                "description": "返回详情范围：self=仅匹配元素本身，children=含直接子元素（默认），subtree=含完整子树（慎用，可能很大）"
            },
            "max_results": {
                "type": "integer",
                "description": "最多返回几个匹配元素，默认 5，最大 20"
            }
        },
        "required": ["query"]
    }
}
```

#### 3.2.2 实现

```python
import re
from bs4 import BeautifulSoup

# CSS 选择器特征：包含这些字符/模式时判定为选择器
SELECTOR_PATTERN = re.compile(r'[.#\[\]>+~:=]|^\w+\s+\w+')

def run_grep(query: str, scope: str = "children", max_results: int = 5) -> str:
    """
    在当前会话域名对应的本地 HTML 文件中搜索元素，返回详细信息。
    自动检测 query 类型：CSS 选择器 → DOM 查询，关键词 → 全文匹配。
    """
    html = read_file(current_session.page_html_path)
    soup = BeautifulSoup(html, 'html.parser')

    max_results = min(max_results, 20)

    # 自动检测查询类型
    if is_css_selector(query):
        elements = selector_search(soup, query, max_results)
    else:
        elements = keyword_search(soup, query, max_results)

    if not elements:
        return f"未找到匹配: {query}"

    # 相似元素折叠 + 格式化
    groups = group_similar_elements(elements)
    return format_grep_output(groups, scope, max_results)


def is_css_selector(query: str) -> bool:
    """判断 query 是 CSS 选择器还是关键词"""
    return bool(SELECTOR_PATTERN.search(query))


def selector_search(soup, selector: str, limit: int) -> list:
    """CSS 选择器查询，直接利用 BeautifulSoup 的 select"""
    try:
        return soup.select(selector, limit=limit)
    except Exception:
        # 选择器语法错误时回退到关键词搜索
        return keyword_search(soup, selector, limit)


def keyword_search(soup, keyword: str, limit: int) -> list:
    """
    关键词全文匹配，搜索范围：
    1. 标签名
    2. class / id 属性值
    3. 文本内容
    4. data-cs 样式值
    """
    keyword_lower = keyword.lower()
    results = []

    for el in soup.body.descendants:
        if not hasattr(el, 'name') or not el.name:
            continue
        if len(results) >= limit:
            break

        # 在标签名中匹配
        if keyword_lower in el.name:
            results.append(el)
            continue

        # 在 class 中匹配
        classes = ' '.join(el.get('class', []))
        if keyword_lower in classes.lower():
            results.append(el)
            continue

        # 在 id 中匹配
        el_id = el.get('id', '')
        if keyword_lower in el_id.lower():
            results.append(el)
            continue

        # 在直接文本内容中匹配（只取直接子文本，避免匹配到子元素文本）
        direct_text = el.string or ''
        if keyword_lower in direct_text.lower():
            results.append(el)
            continue

        # 在 data-cs 样式中匹配
        data_cs = el.get('data-cs', '')
        if keyword_lower in data_cs.lower():
            results.append(el)
            continue

    return results
```

#### 3.2.3 相似元素折叠

当多个匹配元素结构相同（如列表项、卡片），逐个展示会浪费 token。折叠为一组，只展开第一个作为代表。

```python
def group_similar_elements(elements: list) -> list:
    """
    将结构相同的匹配元素归组。
    返回: [(representative_element, count, all_texts), ...]
    """
    groups = []
    used = set()

    for i, el in enumerate(elements):
        if i in used:
            continue

        sig = element_signature(el)
        group_texts = [get_direct_text(el)[:30]]
        count = 1

        for j in range(i + 1, len(elements)):
            if j in used:
                continue
            if element_signature(elements[j]) == sig:
                used.add(j)
                count += 1
                if len(group_texts) < 3:
                    group_texts.append(get_direct_text(elements[j])[:30])

        groups.append((el, count, group_texts))

    return groups


def element_signature(el) -> str:
    """元素签名：tag + class + 子元素结构"""
    children_sig = '|'.join(
        f"{c.name}.{'.'.join(c.get('class', []))}"
        for c in el.children if hasattr(c, 'name') and c.name
    )
    return f"{el.name}.{'.'.join(el.get('class', []))}[{children_sig}]"
```

#### 3.2.4 输出格式化

```python
ABBR_REVERSE = {v: k for k, v in ABBR.items()}  # 缩写 → 全名（用于输出可读性）

def format_grep_output(groups: list, scope: str, max_results: int) -> str:
    """
    格式化搜索结果。
    目标 token 量：200-800，超出时自动缩减 scope。
    """
    lines = []
    shown = 0

    for (el, count, texts) in groups:
        if shown >= max_results:
            break

        # 元素头部
        selector = build_full_path_selector(el)
        if count > 1:
            lines.append(f"[{shown+1}] {short_selector(el)} × {count}")
            lines.append(f"    Texts: {' | '.join(texts)}")
        else:
            lines.append(f"[{shown+1}] {short_selector(el)}")

        lines.append(f"    Path: {selector}")

        # 完整样式（grep 不做详略控制，返回全量 data-cs）
        data_cs = el.get('data-cs', '')
        if data_cs:
            lines.append(f"    Styles: {data_cs}")

        # HTML 属性（href, src, type 等有意义的属性）
        attrs = format_useful_attrs(el)
        if attrs:
            lines.append(f"    Attrs: {attrs}")

        # 直接文本
        text = get_direct_text(el)[:60]
        if text:
            lines.append(f'    Text: "{text}"')

        # 根据 scope 展示子元素
        if scope in ("children", "subtree"):
            children_lines = format_children(el, scope)
            if children_lines:
                lines.append("    Children:")
                lines.extend(children_lines)

        lines.append("")
        shown += count

    # token 保护：超出预算时降级
    result = '\n'.join(lines)
    if estimate_tokens(result) > 800 and scope == "subtree":
        return format_grep_output(groups, "children", max_results)
    if estimate_tokens(result) > 800 and scope == "children":
        return format_grep_output(groups, "self", max_results)

    return result


def format_children(el, scope: str) -> list:
    """格式化子元素信息"""
    lines = []
    children = [c for c in el.children if hasattr(c, 'name') and c.name]

    # 子元素也做折叠
    child_groups = group_similar(children) if children else []

    for group in child_groups:
        rep = group[0]
        cs = rep.get('data-cs', '')
        text = get_direct_text(rep)[:30]
        style_str = f" [{cs}]" if cs else ""
        text_str = f' "{text}"' if text else ""

        if len(group) >= 3:
            lines.append(f"      {short_selector(rep)} × {len(group)}{style_str}")
        else:
            for child in group:
                cs = child.get('data-cs', '')
                text = get_direct_text(child)[:30]
                style_str = f" [{cs}]" if cs else ""
                text_str = f' "{text}"' if text else ""
                lines.append(f"      {short_selector(child)}{style_str}{text_str}")

                # subtree 模式递归展开（限制 2 层）
                if scope == "subtree":
                    for sub_line in format_children(child, "children"):
                        lines.append(f"  {sub_line}")

    return lines


def format_useful_attrs(el) -> str:
    """提取有意义的 HTML 属性（排除 class/id/data-cs 已单独处理的）"""
    skip = {'class', 'id', 'data-cs'}
    useful = {k: v for k, v in el.attrs.items() if k not in skip and v}
    if not useful:
        return ''
    return '; '.join(f'{k}="{v}"' if isinstance(v, str) else f'{k}={v}'
                     for k, v in useful.items())


def short_selector(el) -> str:
    """短选择器：tag.class 或 tag#id"""
    s = el.name
    if el.get('id'):
        s += f"#{el['id']}"
    elif el.get('class'):
        s += '.' + '.'.join(el['class'])
    return s
```

#### 3.2.5 输出示例

**示例 1：CSS 选择器查询**

```
>> grep(query=".main-nav", scope="children")

[1] nav.main-nav
    Path: body > header.site-header > nav.main-nav
    Styles: d:flex;gap:24px;c:#333;fs:14px
    Children:
      a.nav-link × 5 [c:#0066cc;fw:500;p:8px 12px]
```

**示例 2：关键词搜索样式值**

```
>> grep(query="bg:#fff")

[1] body
    Path: body
    Styles: bg:#ffffff;c:#333;fs:16px;ff:"Microsoft YaHei",sans-serif

[2] div.widget × 3
    Path: body > main#content > aside.sidebar > div.widget
    Styles: bg:#ffffff;br:8px;p:16px;bs:0 1px 3px rgba(0,0,0,.08)
    Texts: 热门文章 | 标签云 | 关于作者
```

**示例 3：subtree 深度查询**

```
>> grep(query="aside.sidebar", scope="subtree")

[1] aside.sidebar
    Path: body > main#content > aside.sidebar
    Styles: w:300px;bg:#f9f9f9;p:20px
    Children:
      div.widget × 3 [bg:#fff;br:8px;p:16px;bs:0 1px 3px rgba(0,0,0,.08)]
        h3.widget-title [fs:16px;fw:600;c:#333] "热门文章"
        ul.widget-list [m:12px 0 0 0]
          li × 5 [p:8px 0;c:#666;fs:14px]
```

#### 3.2.6 设计要点

```
1. 查询自动检测
   - 含 . # [ ] > + ~ : 等字符 → CSS 选择器（BeautifulSoup.select）
   - 纯文字 → 关键词全文匹配（标签/class/id/文本/样式值）
   - 选择器语法错误时自动回退到关键词搜索

2. scope 三级控制
   - self：只返回匹配元素本身（最省 token，适合确认存在性）
   - children：含直接子元素（默认，平衡信息量和 token）
   - subtree：完整子树（慎用，用于深入了解某个小区域）

3. 相似折叠
   - 与 get_page_structure 的 group_similar 逻辑一致
   - tag + class + 子结构 相同的元素归组，× N 标记
   - 避免 5 个相同卡片占用 5 倍 token

4. 样式全量返回
   - 与 get_page_structure 不同，grep 返回完整 data-cs（不做详略筛选）
   - 因为模型 grep 某个元素就是要看它的全部样式细节

5. Token 保护
   - 目标 200-800 tokens/次
   - 超出 800 时自动降级：subtree → children → self
   - max_results 上限 20，默认 5
```

### 3.3 apply_styles（含原 save_preference）

将原来的 `apply_styles` 和 `save_preference` 合并为一个工具，用 mode 区分持久化级别：
`preview`（临时）→ `apply`（会话级）→ `save`（永久级）

```python
APPLY_STYLES_TOOL = {
    "name": "apply_styles",
    "description": """应用CSS样式到页面。

mode 说明：
- preview: 预览，可 rollback
- apply: 应用到当前会话（会话内持久，重新打开会话可恢复）
- save: 应用 + 永久保存（下次访问该域名自动应用）
- rollback: 回滚上一次 preview""",
    "input_schema": {
        "type": "object",
        "properties": {
            "css": {"type": "string", "description": "CSS代码"},
            "mode": {
                "type": "string",
                "enum": ["preview", "apply", "save", "rollback"],
                "description": "preview=预览可回滚, apply=应用到会话, save=永久保存, rollback=回滚"
            }
        },
        "required": ["css", "mode"]
    }
}

def run_apply_styles(css: str, mode: str) -> str:
    """
    纯注入 + 按 mode 持久化，不验证 CSS 正确性（由模型负责）。
    三个 mode 是递进关系：preview ⊂ apply ⊂ save。
    """
    if mode == "rollback":
        send_to_extension("rollback")
        return "已回滚"

    # 所有模式都注入到页面
    send_to_extension("inject_css", css)

    if mode in ("apply", "save"):
        # 写入会话样式文件（累积追加）
        append_css(current_session.styles_path, css)
        # 更新会话 meta 中的样式摘要（供 context 注入用）
        update_styles_summary(current_session)

    if mode == "save":
        # 注册到 Chrome Storage，该域名下次访问自动应用
        register_persistent_style(current_session.domain, css)

    return {
        "preview": "已预览，可 rollback",
        "apply": "已应用到当前会话",
        "save": f"已保存，下次访问 {current_session.domain} 自动应用"
    }[mode]
```

### 3.4 get_user_profile

```python
GET_USER_PROFILE_TOOL = {
    "name": "get_user_profile",
    "description": """获取用户的风格偏好画像。包含用户在历史对话中表现出的风格偏好。
新用户可能为空。建议在以下情况获取：
- 新会话开始时，了解用户已知偏好
- 用户请求模糊（如"好看点"），需参考历史偏好""",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

PROFILE_PATH = STORAGE_DIR / "user_profile.md"

def run_get_user_profile() -> str:
    """读取用户风格画像，原样返回。"""
    if not PROFILE_PATH.exists():
        return "(新用户，暂无风格偏好记录)"
    content = PROFILE_PATH.read_text().strip()
    if not content:
        return "(暂无风格偏好记录)"
    return content
```

### 3.5 update_user_profile

```python
UPDATE_USER_PROFILE_TOOL = {
    "name": "update_user_profile",
    "description": """记录从当前对话中学到的用户风格偏好。
当发现新的偏好信号时调用：
- 用户明确表达："我喜欢圆角"
- 用户通过修正暗示："太黑了，用深蓝" → 偏好深蓝不是纯黑
- 反复的选择模式

记录有意义的偏好洞察，不记录具体 CSS 代码。
content 为完整的画像内容（覆盖写入），应在读取现有画像基础上整合新洞察。""",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "完整的用户画像内容（覆盖写入）"
            }
        },
        "required": ["content"]
    }
}

def run_update_user_profile(content: str) -> str:
    """
    覆盖写入用户画像。
    选择覆盖而非追加：模型每次读取现有画像 → 整合新洞察 → 写回完整版本。
    模型自然会做信息压缩和去重，代码零复杂度。
    """
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(content)
    return "已更新用户画像"
```

#### 画像的自然演化过程

画像是自由文本（.md），模型全权管理内容和结构。以下是典型的演化轨迹：

**第 1 次使用后：**

```
偏好深蓝底色(#1a1a2e)的深色模式，不喜欢纯黑
```

**使用 5 次后：**

```
整体偏好：深色系、柔和对比度、扁平风格

配色：深蓝底色(#1a1a2e)为主，文字用 #e0e0e0 而非纯白，不喜欢纯黑(#000)
字体：偏好 16px+ 正文字号，行高 1.6+
形状：大圆角(12px+)，少阴影
```

**使用 20 次后：**

```
整体偏好：深色系、柔和对比度、扁平风格、注重可读性

配色：
- 底色偏好深蓝(#1a1a2e)或深灰蓝(#1e1e2e)，拒绝纯黑
- 文字用柔和浅色(#e0e0e0)，不用纯白
- 强调色偏好蓝紫系(#6c5ce7, #74b9ff)

字体：16px+ 正文，行高 1.6-1.8，偏好无衬线

形状：圆角 12px+，极少阴影，偏好 border 分隔

域名特殊偏好：
- GitHub: 极简，只改配色不改布局
- 新闻类网站: 大字体 + 宽行距，隐藏广告区域
- 文档类: 增加代码块对比度
```

### 3.6 load_skill（关键！）

```python
LOAD_SKILL_TOOL = {
    "name": "load_skill",
    "description": """加载领域知识。

可用的知识：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

当你需要专业知识时加载。""",
    "input_schema": {
        "type": "object",
        "properties": {
            "skill_name": {
                "type": "string",
                "description": "知识名称"
            }
        },
        "required": ["skill_name"]
    }
}

def run_load_skill(skill_name: str) -> str:
    """
    模型自己决定何时加载什么知识。
    不是代码预判，而是模型按需请求。
    """
    skills = {
        "dark-mode-template": SKILLS_DIR / "style-templates/dark-mode.md",
        "minimal-template": SKILLS_DIR / "style-templates/minimal.md",
        "design-principles": SKILLS_DIR / "design-principles.md",
        "color-theory": SKILLS_DIR / "color-theory.md",
        "css-selectors": SKILLS_DIR / "css-selectors-guide.md",
    }

    if skill_name not in skills:
        return f"未知知识: {skill_name}。可用: {list(skills.keys())}"

    return skills[skill_name].read_text()
```

---

## 四、Task（子智能体）

### 设计原则

```
Subagent 设计原则：
1. 隔离上下文 - 子智能体看不到父对话历史
2. 只给任务描述 - 不预设内部工作流
3. 返回摘要 - 父智能体只看到最终结果
```

### 4.1 Agent Types 注册表

```python
AGENT_TYPES = {
    "StyleGenerator": {
        "description": "样式生成专家。根据用户意图和页面结构生成CSS代码。",
        "tools": ["get_page_structure", "grep", "load_skill"],  # 可以获取页面信息、查询元素、加载知识
        "prompt": """你是样式生成专家。

任务：根据用户意图生成CSS代码

输入：
- 用户意图描述
- 页面结构信息（可能需要你主动获取）

输出格式（JSON）：
{
    "css": "生成的CSS代码",
    "affected_selectors": ["受影响的选择器"],
    "description": "样式描述"
}

你有完全的自由决定如何完成这个任务。
- 可以加载知识获得专业指导
- 可以多次获取页面信息
- 只返回最终结果，不要返回中间过程""",
    },
}
```

### 4.2 Task Tool 定义

```python
TASK_TOOL = {
    "name": "Task",
    "description": f"""调用子智能体处理复杂任务。

子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- StyleGenerator: 样式生成专家

使用场景：
- 需要复杂推理的任务
- 需要多次工具调用的任务
- 可能产生大量中间输出的任务""",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "任务简短描述（3-5字）"
            },
            "prompt": {
                "type": "string",
                "description": "详细的任务指令"
            },
            "agent_type": {
                "type": "string",
                "enum": ["StyleGenerator"],
                "description": "子智能体类型"
            }
        },
        "required": ["description", "prompt", "agent_type"]
    }
}
```

### 4.3 Subagent 执行

```python
def run_task(description: str, prompt: str, agent_type: str,
             client, model: str, base_tools: list, execute_tool) -> str:
    """
    执行子智能体任务。

    关键：
    1. ISOLATED HISTORY - 子智能体从零开始，看不到父对话
    2. FILTERED TOOLS - 根据类型限制工具
    3. 返回摘要 - 父智能体只看到最终结果
    """
    config = AGENT_TYPES[agent_type]

    # 子智能体的系统提示
    sub_system = f"""{config["prompt"]}

完成任务后返回清晰、简洁的摘要。"""

    # 过滤工具
    allowed = config["tools"]
    if allowed == "*":
        sub_tools = base_tools
    else:
        sub_tools = [t for t in base_tools if t["name"] in allowed]

    # 关键：隔离的消息历史！
    sub_messages = [{"role": "user", "content": prompt}]

    # 运行子智能体循环
    while True:
        response = client.messages.create(
            model=model,
            system=sub_system,
            messages=sub_messages,
            tools=sub_tools,
            max_tokens=8000,
        )

        if response.stop_reason != "tool_use":
            break

        # 执行工具
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = execute_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output
                })

        sub_messages.append({"role": "assistant", "content": response.content})
        sub_messages.append({"role": "user", "content": results})

    # 只返回最终文本
    for block in response.content:
        if hasattr(block, "text"):
            return block.text

    return "(子智能体无输出)"
```

---

## 五、TodoWrite（可选）

### 设计原则

```
TodoWrite 使用原则：
1. 模型自己决定是否使用，不强制
2. 简单任务不需要用
3. 复杂多分支任务才需要
4. 只追踪需要执行的动作，不追踪"理解意图"
```

### 5.1 Tool 定义

```python
TODO_WRITE_TOOL = {
    "name": "TodoWrite",
    "description": "更新任务列表。用于规划和追踪复杂任务的进度。简单任务不需要使用。",
    "input_schema": {
        "type": "object",
        "properties": {
            "todos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "任务描述"},
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                        "activeForm": {"type": "string", "description": "进行时形式"}
                    },
                    "required": ["content", "status", "activeForm"]
                }
            }
        },
        "required": ["todos"]
    }
}
```

---

## 六、Context（上下文管理）

### 6.1 四层上下文模型

```
Layer 0 — System Prompt（恒定，~200 tokens）
  身份 + 工作方式 + 工具列表

Layer 1 — Session Context（每次会话注入，~50-100 tokens）
  域名 + 会话标题 + 已有样式摘要 + 用户画像一句话提示

Layer 2 — Conversation History（动态增长，有 token 预算）
  用户消息 + Agent 回复 + 工具调用结果

Layer 3 — Tool Results（临时，各工具自控 token）
  get_page_structure: 500-2000 / grep: 200-800 / get_user_profile: 按画像大小
```

### 6.2 Layer 1 — Session Context 注入

在 system prompt 末尾追加，控制在 ~100 tokens 以内：

```python
def build_session_context(domain: str, session_meta: dict, profile_hint: str) -> str:
    """构建注入到 system prompt 的会话上下文"""
    ctx = f"\n[会话上下文]\n域名: {domain}\n会话: {session_meta.get('title', '新会话')}\n"

    if session_meta.get('active_styles_summary'):
        ctx += f"已应用样式: {session_meta['active_styles_summary']}\n"

    if profile_hint:
        ctx += f"用户风格偏好: {profile_hint} (详情可通过 get_user_profile 获取)\n"

    return ctx
```

`active_styles_summary` 是一句话描述（非完整 CSS），由 `apply_styles(mode="apply"|"save")` 时更新到 session meta。

`profile_hint` 取 user_profile.md 的第一行（模型自然会把摘要写在开头）：

```python
def get_profile_one_liner() -> str:
    """从用户画像中提取一行摘要，用于 context 注入"""
    if not PROFILE_PATH.exists():
        return ""
    first_line = PROFILE_PATH.read_text().strip().split("\n")[0]
    return first_line[:100]
```

实际注入效果：

```
[会话上下文]
域名: example.com
会话: 深色模式改造
已应用样式: 深色背景(#1a1a2e) + 浅色文字 + 导航栏半透明
用户风格偏好: 整体偏好：深色系、柔和对比度、扁平风格、注重可读性 (详情可通过 get_user_profile 获取)
```

### 6.3 Layer 2 — 对话历史与 Token 预算控制

对话历史是 context 中唯一会无限增长的部分。不用固定轮次计数，而是基于真实 token 用量做预算控制。

**核心机制：利用 API 返回的 `response.usage.input_tokens` 做零成本精确检测。**

```python
TOKEN_BUDGET = 50000  # 输入 token 预算（可配置，远低于模型上限，兼顾成本和质量）

def check_and_compress_history(history: list, last_input_tokens: int) -> list:
    """
    触发条件：上一次 API 调用的 input_tokens 超过预算。
    压缩策略：保留最近 10 轮，旧的部分用一次 LLM 调用生成摘要。
    """
    if last_input_tokens <= TOKEN_BUDGET:
        return history

    # 找到保留点：最近 10 轮用户消息的起始位置
    split = find_turn_boundary(history, keep_recent=10)
    old_part = history[:split]
    recent_part = history[split:]

    summary = summarize_old_turns(old_part)  # 一次额外 LLM 调用（可用便宜模型）
    summary_msg = {"role": "user", "content": f"[之前的对话摘要]\n{summary}"}

    return [summary_msg] + recent_part
```

**双触发点：**

| 触发时机 | 场景 | 检测方式 |
|---------|------|---------|
| 会话加载时 | 恢复一个长历史会话 | 粗估：`len(json.dumps(history)) / 4`，超预算则压缩 |
| 循环内响应后 | 当轮对话使 token 超预算 | 精确：读 `response.usage.input_tokens` |

```python
def load_and_prepare_history(domain: str, session_id: str) -> list:
    """加载历史，必要时在加载阶段就做压缩"""
    history = load_history(domain, session_id)
    if not history:
        return []

    estimated_tokens = len(json.dumps(history, ensure_ascii=False)) // 4
    if estimated_tokens > TOKEN_BUDGET:
        history = check_and_compress_history(history, estimated_tokens)

    return history
```

### 6.4 Context 保护原则

```
原则：Context 是珍贵的资源

策略：
1. Tools 返回精简结果（各工具有独立 token 预算）
2. Subagent 中间推理不进入主 context
3. 用户画像：context 只注入一行提示，完整内容通过 get_user_profile 按需获取
4. Skills 通过 load_skill 按需加载，不前置塞入
5. 对话历史基于真实 token 用量做预算控制，超预算自动压缩
6. 会话切换时 context 完全替换（不同会话的历史不混合）
```

---

## 七、Session（会话管理）

### 7.1 三级隔离模型

```
全局层: user_profile.md（唯一，跨域名的用户风格画像）
  │
  └── 域名层: domains/{domain}/（按 hostname 分割）
        ├── page.html（Chrome 插件采集的页面快照）
        │
        └── 会话层: sessions/{session_id}/（同域名可有多个会话）
              ├── history.json（对话历史）
              └── styles.css（该会话累积的样式产出）
```

**隔离规则：**
- 不同域名的会话完全隔离（历史、样式、页面快照均独立）
- 同域名的多个会话共享 page.html，但各自有独立的 history 和 styles
- user_profile.md 是全局唯一的，模型在其中自行标注域名差异

### 7.2 存储结构

```
storage/
├── user_profile.md                     # 全局用户风格画像（自由文本，模型全权管理）
└── domains/
    ├── example.com/
    │   ├── page.html                   # Chrome 插件采集的页面快照
    │   └── sessions/
    │       ├── index.json              # 会话索引
    │       ├── a1b2c3/
    │       │   ├── history.json        # 对话历史
    │       │   └── styles.css          # 累积样式
    │       └── d4e5f6/
    │           ├── history.json
    │           └── styles.css
    └── github.com/
        ├── page.html
        └── sessions/
            └── ...
```

**index.json 结构：**

```json
[
  {
    "id": "a1b2c3",
    "title": "深色模式改造",
    "created_at": "2026-03-02T10:00:00Z",
    "updated_at": "2026-03-02T10:30:00Z",
    "message_count": 8,
    "active_styles_summary": "深色背景 + 浅色文字 + 导航栏半透明"
  }
]
```

### 7.3 会话生命周期

会话的 CRUD 由 Chrome 插件 UI 负责，Agent 不参与会话管理逻辑。

```
用户打开插件（在 example.com 上）
│
├── 看到该域名的会话列表（从 index.json 读取）
│
├── [选择已有会话]
│   ├── 加载 history.json → 恢复对话
│   ├── 加载 styles.css → 注入页面恢复样式
│   └── 创建 SessionContext(domain, session_id) → Agent 就绪
│
├── [新建会话]
│   ├── 生成 session_id
│   ├── 创建空目录
│   └── 创建 SessionContext → Agent 就绪
│
└── [切换会话]
    ├── 卸载当前会话样式
    ├── 加载目标会话样式
    └── 替换 SessionContext
```

**会话标题自动生成（纳米级）：**

```python
def auto_title(session_meta: dict, first_user_message: str):
    """首轮对话后自动设置标题，取用户第一条消息的前 20 字"""
    if not session_meta.get("title"):
        session_meta["title"] = first_user_message[:20]
```

### 7.4 styles.css 的角色

`styles.css` 是会话的**累积样式产出**，是对话的"结晶"。

- **恢复会话时**：自动注入到页面，恢复上次的视觉效果
- **Agent 感知**：通过 session meta 的 `active_styles_summary` 知道"这个会话已做了什么"
- **与 save 模式的区别**：`styles.css` 是会话级的（只在该会话激活时生效），`save` 模式注册到 Chrome Storage 是域名级的（每次访问都生效）

### 7.5 对话历史持久化

```python
def save_history(history: list) -> None:
    """每轮对话结束后写入"""
    path = current_session.history_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(history, ensure_ascii=False))

def load_history() -> list:
    """加载会话历史"""
    path = current_session.history_path
    if not path.exists():
        return []
    return json.loads(path.read_text())
```

---

## 八、Agent Loop（核心循环）

```python
#!/usr/bin/env python3
"""
StyleSwift Agent - 基于 agent-builder 哲学的极简实现

核心变化（v3.2）：
- 会话感知：接收 domain + session_id，构建分层 context
- Token 预算：基于 API 返回的真实 token 用量做历史压缩
- 持久化：每轮对话结束后写入 history.json
"""

from anthropic import Anthropic
import json

client = Anthropic()
MODEL = "claude-sonnet-4-20250514"
TOKEN_BUDGET = 50000

# 系统提示 — 基础部分（Layer 0），Session Context 在运行时追加（Layer 1）
SYSTEM_BASE = """你是 StyleSwift，网页样式个性化智能体。

任务：帮助用户用一句话个性化网页样式。

工作方式：
- 使用工具完成任务
- 优先行动，而非长篇解释
- 完成后简要总结

可用工具：get_page_structure, grep, apply_styles, get_user_profile, update_user_profile, load_skill, Task, TodoWrite"""

# 工具定义
BASE_TOOLS = [
    GET_PAGE_STRUCTURE_TOOL,
    GREP_TOOL,
    APPLY_STYLES_TOOL,
    GET_USER_PROFILE_TOOL,
    UPDATE_USER_PROFILE_TOOL,
    LOAD_SKILL_TOOL,
    TODO_WRITE_TOOL,
]

TOOLS = BASE_TOOLS + [TASK_TOOL]


def execute_tool(name: str, args: dict) -> str:
    """执行工具调用。"""
    if name == "get_page_structure":
        return run_get_page_structure()
    if name == "grep":
        return run_grep(args["query"], args.get("scope", "children"), args.get("max_results", 5))
    if name == "apply_styles":
        return run_apply_styles(args["css"], args["mode"])
    if name == "get_user_profile":
        return run_get_user_profile()
    if name == "update_user_profile":
        return run_update_user_profile(args["content"])
    if name == "load_skill":
        return run_load_skill(args["skill_name"])
    if name == "TodoWrite":
        return "任务列表已更新"
    if name == "Task":
        return run_task(
            description=args["description"],
            prompt=args["prompt"],
            agent_type=args["agent_type"],
            client=client,
            model=MODEL,
            base_tools=BASE_TOOLS,
            execute_tool=execute_tool
        )
    return f"未知工具: {name}"


def agent_loop(prompt: str, domain: str, session_id: str) -> str:
    """
    主智能体循环 — 会话感知版本。

    关键变化：
    1. 从持久化存储加载历史（而非内存中的 list）
    2. 构建分层 system prompt（L0 + L1）
    3. 循环内检测 token 溢出并压缩历史
    4. 结束后持久化历史
    """
    global current_session
    current_session = SessionContext(domain, session_id)

    # 1. 加载并准备历史（加载时可能触发首次压缩）
    history = load_and_prepare_history(domain, session_id)

    # 2. 构建 system prompt = L0 基础 + L1 会话上下文
    session_meta = load_session_meta(domain, session_id)
    profile_hint = get_profile_one_liner()
    system = SYSTEM_BASE + build_session_context(domain, session_meta, profile_hint)

    # 3. Agent Loop
    history.append({"role": "user", "content": prompt})
    last_input_tokens = 0

    while True:
        response = client.messages.create(
            model=MODEL,
            system=system,
            messages=history,
            tools=TOOLS,
            max_tokens=8000,
        )

        last_input_tokens = response.usage.input_tokens
        history.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            break

        # 执行工具
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = execute_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output
                })

        history.append({"role": "user", "content": results})

        # Token 预算检测：超预算则在下一轮 API 调用前压缩历史
        if last_input_tokens > TOKEN_BUDGET:
            history = check_and_compress_history(history, last_input_tokens)

    # 4. 持久化
    save_history(history)

    # 5. 首轮自动生成标题
    if not session_meta.get("title"):
        session_meta["title"] = prompt[:20]
        save_session_meta(domain, session_id, session_meta)

    return "".join(b.text for b in response.content if hasattr(b, "text"))
```
```

---

## 九、交互流程示例

### 示例1：简单请求

```
用户: "太刺眼了"（在 example.com 上，新用户）

Agent:
├── get_user_profile()
│   ← "(新用户，暂无风格偏好记录)"
├── get_page_structure()
│   ← 返回页面原始结构
├── load_skill("dark-mode-template")
│   ← 加载深色模式知识
├── apply_styles(css, mode="preview")
│   ← 注入样式
└── 响应: "已切换深色模式，看看效果？"
```

### 示例2：偏好学习过程

```
用户: "不错，但底色用深蓝，别纯黑"

Agent:
├── apply_styles(navy_css, mode="preview")
│   ← 调整底色
├── get_user_profile()
│   ← "(新用户)"
├── update_user_profile("偏好深蓝底色(#1a1a2e)的深色模式，不喜欢纯黑")
│   ← 记录偏好洞察
└── 响应: "调整好了，底色换成了深蓝"

--- 几天后，用户在 github.com 新建会话 ---

用户: "深色模式"

Agent:（system prompt 中已有：用户风格偏好: 偏好深蓝底色...）
├── get_page_structure()
├── [直接使用深蓝底色生成 CSS]
├── apply_styles(css, mode="preview")
└── 响应: "已应用深色模式（用了你偏好的深蓝底色）"
```

### 示例3：复杂请求

```
用户: "把导航栏改成蓝色，文章区用大字体，侧边栏隐藏"

Agent:
├── TodoWrite([
│   {content: "修改导航栏颜色", status: "pending"},
│   {content: "放大文章区字体", status: "pending"},
│   {content: "隐藏侧边栏", status: "pending"}
│ ])
├── get_page_structure()
├── Task(StyleGenerator, "导航栏改成蓝色")
│   └── Subagent: 生成CSS → 返回摘要
├── apply_styles(css_nav, mode="preview")
├── TodoWrite([..., {content: "修改导航栏颜色", status: "completed"}, ...])
├── Task(StyleGenerator, "文章区用大字体")
│   └── Subagent: 生成CSS → 返回摘要
├── apply_styles(css_article, mode="preview")
├── ...
└── 响应: "已完成：导航栏蓝色、文章区放大、侧边栏隐藏"

用户: "不错，保存下来"

Agent:
├── apply_styles(combined_css, mode="save")
│   ← 注入 + 写入 session/styles.css + 注册 Chrome Storage
└── 响应: "已保存，下次访问 example.com 自动应用"
```

---

## 十、与原设计的对比

| 方面 | v2.0（错误） | v3.2（正确） |
|------|-------------|-------------|
| Skills 加载 | 代码预判，`load_relevant_skills(intent)` | 模型请求，`load_skill` 工具 |
| get_page_structure | 返回页面类型判断 | 返回原始结构，模型自己判断 |
| 元素信息获取 | `pick_element` 强制用户交互 | `grep` 模型主动查询 |
| Subagent | 预设内部工作流 | 只给任务描述，自由发挥 |
| TodoWrite | 每一步都更新 | 模型决定是否使用 |
| Context | 用户偏好常驻 context | 四层分离，画像一行提示 + 工具按需获取 |
| 样式保存 | `apply_styles` + `save_preference` 两个工具 | `apply_styles` 四模式递进（preview/apply/save/rollback） |
| 会话管理 | 单一内存 history | 域名隔离 + 多会话 + 持久化 |
| 偏好学习 | 无 | `get/update_user_profile` + 自由文本画像 |
| 历史控制 | 无限增长 | 基于真实 token 用量的预算控制 |
| 工具上下文 | 每次调 `get_active_tab_domain()` | `SessionContext` 会话启动时创建一次 |
| "理解意图" | 作为显式任务 | 不是任务，是模型能力 |

---

## 十一、项目结构

```
StyleSwift/
├── agent/
│   ├── style_agent.py           # 主智能体（Agent Loop + 工具注册）
│   ├── session.py               # SessionContext + 会话管理（加载/保存/压缩）
│   ├── profile.py               # 用户画像读写（get/update_user_profile）
│   └── skills/
│       ├── design-principles.md
│       ├── color-theory.md
│       └── style-templates/
│           ├── dark-mode.md
│           └── minimal.md
│
├── extension/
│   ├── manifest.json
│   ├── background/
│   │   └── agent_bridge.js      # Agent 与插件桥接
│   └── content/
│       └── protocol.js          # 页面交互
│
├── storage/                     # 运行时数据（不入 git）
│   ├── user_profile.md          # 全局用户风格画像
│   └── domains/
│       └── {domain}/
│           ├── page.html        # Chrome 插件采集的页面快照
│           └── sessions/
│               ├── index.json   # 会话索引
│               └── {session_id}/
│                   ├── history.json
│                   └── styles.css
│
└── doc/
    └── StyleSwift-Agent设计方案-v3.md
```

---

## 十二、设计原则总结

遵循 agent-builder 哲学：

| 原则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **模型即智能体** | 代码只提供能力 | 代码预判决策 |
| **能力原子化** | Tools 只做一件事 | Tools 包含推理 |
| **知识按需加载** | `load_skill` 工具 | 代码自动加载 |
| **推理隔离** | Subagent 隔离上下文 | 主循环处理复杂推理 |
| **信任模型** | 让模型自己决定 | 预设工作流 |
| **Context 珍贵** | 四层分离，按需获取 | 塞入所有信息 |
| **记忆即文本** | 自由文本画像，模型自己管理 | 结构化 JSON 限制表达 |
| **会话隔离** | 域名分割 + 多会话 | 单一全局 history |

> **The model already knows how to be an agent. Your job is to get out of the way.**
