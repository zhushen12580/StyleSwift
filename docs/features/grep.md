# 元素搜索

## 功能概述

在页面中搜索元素，返回匹配元素的详细信息。

---

## 为什么需要

用户可能只说"标题太暗了"，Agent 需要定位具体是哪个元素。

页面结构获取返回的是全貌，而元素搜索用于精准定位。

---

## 设计目标

| 目标 | 说明 |
|------|------|
| 灵活搜索 | 支持选择器和关键词两种方式 |
| 精准定位 | 返回完整样式和路径 |
| 按需详情 | 可控制返回信息的详细程度 |

---

## 功能设计

### 输入

| 参数 | 说明 |
|------|------|
| query | CSS 选择器或关键词 |
| scope | 详情范围：`self`（仅自身）/ `children`（含子元素）/ `subtree`（含所有后代） |
| max_results | 最大返回数量（默认 5，最大 20） |

### 搜索方式自动检测

**CSS 选择器模式**：
- 以 `.`、`#`、`[` 开头
- 包含 `>`、`+`、`~` 组合符
- 直接使用 `querySelectorAll` 搜索

**关键词模式**：
- 在标签名中匹配
- 在 class 名中匹配
- 在 id 中匹配
- 在文本内容中匹配
- 在样式值中匹配（如颜色）

### 输出

输出为**格式化文本**（非 JSON 列表）。每个匹配元素包含：
- 序号
- 选择器（含分组计数）
- 完整路径选择器（从 body 到该元素）
- 全量计算样式
- HTML 属性
- 直接文本

### 相似元素折叠

搜索结果中相同签名的元素折叠显示：

```
[1] button.btn × 3
    Path: body > main > section > button.btn
    Styles: background:#0066cc; color:#fff; border-radius:4px
    Text: 提交|保存|取消
```

### 输出示例

```
>> 搜索 "h1"

[1] h1.site-title
    Path: body > header.site-header > h1.site-title
    Styles: font-size:24px; font-weight:700; color:#333; margin:0
    Text: "StyleSwift"

>> 搜索 ".btn"

[1] button.btn-primary × 2
    Path: body > main > form > button.btn-primary
    Styles: background:#0066cc; color:#fff; padding:8px 16px; border-radius:4px
    Text: 提交|确认

[2] button.btn-secondary
    Path: body > main > form > button.btn-secondary
    Styles: background:#fff; color:#0066cc; border:1px solid #0066cc
    Text: 取消
```

---

## 目标效果

| 场景 | 效果 |
|------|------|
| 用户说"标题太暗" | Agent 搜索 "h1" 或 "title"，找到目标元素 |
| 用户说"按钮太小" | Agent 搜索 "button" 或 ".btn"，查看当前尺寸 |
| 用户说"侧边栏" | Agent 搜索 "sidebar" 或 "aside"，定位元素 |

---

## 与页面结构获取的区别

| | 页面结构获取 | 元素搜索 |
|---|---|---|
| 目的 | 了解页面全貌 | 精准定位元素 |
| 输出 | 树形结构 | 匹配元素列表 |
| 样式 | 简化展示 | 完整展示 |
| 使用时机 | Agent 初始了解页面 | 已知目标后深入查看 |

---

## 边界情况

| 情况 | 处理 |
|------|------|
| 无匹配结果 | 返回提示文本 `未找到匹配: {query}` |
| 匹配过多 | 限制返回数量，提示"还有 N 个未显示" |
| 输出过长 | 自动降级 scope（subtree → children → self） |
