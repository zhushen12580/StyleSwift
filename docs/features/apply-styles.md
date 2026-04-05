# 样式应用

## 功能概述

注入 CSS 到页面，支持增量添加、撤销最后一步（回滚到上一次保存的样式）与全部回滚。

---

## 为什么需要

这是 Agent 改变页面外观的核心能力。用户说"改成深色模式"，最终通过此功能注入 CSS。

---

## 设计目标

| 目标 | 说明 |
|------|------|
| 可靠覆盖 | 生成的样式必须覆盖页面原有样式 |
| 可回滚 | 支持撤销，恢复页面原貌 |
| 持久化 | 刷新页面后样式自动恢复 |
| 去重合并 | 多次添加的样式合并，避免冗余 |

---

## 功能设计

### 模式

| 模式 | 用途 |
|------|------|
| `save` | 添加新样式，持久化到会话 |
| `rollback_last` | 撤销最近一次 `save`（回滚到上一次保存的完整 CSS） |
| `rollback_all` | 回滚当前会话的全部样式（清空当前会话 CSS 与历史栈） |

### 输入

| 参数 | 说明 |
|------|------|
| css | CSS 文本（save 模式必填） |
| mode | 操作模式 |

### CSS 特异性保障

**问题**：生成的样式可能被页面原有样式覆盖。

**策略**：

**1. 选择器引导（System Prompt）**
- 使用具体选择器（`.site-header`），不用通配符
- 不使用 `@import`
- 颜色用 hex 或 rgba，不用 CSS 变量

**2. 注入层级**

```
页面原有样式              ← 特异性由页面决定
    ↓
styleswift-active-persistent  ← 活动会话镜像（early-inject 预注入）
    ↓
styleswift-active            ← 当前会话样式
    ↓
!important                 ← 所有规则加 !important
```

注入位置在 `<head>` 末尾，天然晚于页面 `<link>` 和 `<style>`。

**3. CSP 兼容**

严格 CSP 页面可能禁止 `<style>` 标签：
- 优先使用 `<style>` 标签
- 失败时降级到 `adoptedStyleSheets` API
- 极端情况返回降级信号，由 Side Panel 用 `chrome.scripting.insertCSS` 注入

### 样式持久化

```
注入流程：
1. Content Script 注入 CSS 到页面
2. Side Panel 将 CSS 写入会话存储
3. 同步到 active_styles:{domain}（活动镜像）

刷新恢复：
1. early-inject.js 读取 active_styles:{domain}
2. 在 document_start 阶段预注入
```

### 撤销（rollback_last）的实现语义

`rollback_last` 的“最后一步”定义为：**最近一次 `apply_styles(mode="save")` 保存后的完整 CSS 状态**。

- 每次 `save` 后，Side Panel 会把“合并后的完整 CSS” push 进当前会话的历史栈 `sessions:{domain}:{sessionId}:styles_history`
- `rollback_last` 会从历史栈 pop 掉最后一个状态，并把新的栈顶 CSS 用 `replace_css` 同步到页面
- 历史栈默认最多保留 **20** 层（超过会丢弃最旧的）

这使得撤销语义稳定、可预期，不依赖于“LLM 在一次回复里调用了多少次工具”。

### 样式合并

多次调用 `save` 时，合并 CSS：

```
第一次：.header { background: #fff; }
第二次：.header { background: #000; }

合并后：.header { background: #000; }

规则：相同选择器 + 相同属性 → 后者覆盖前者
```

### 输出

成功时返回**结果提示文本**（例如“样式已应用”“已回滚到上一次样式”）。

如需读取当前完整 CSS，请使用 `get_current_styles`。

---

## 目标效果

| 场景 | 效果 |
|------|------|
| 用户说"改背景色" | CSS 注入，立即生效 |
| 用户说"撤销上一步" | 回滚到上一次保存的样式状态 |
| 用户说"全部撤销" | 回滚所有样式，恢复原貌 |
| 刷新页面 | 样式自动恢复，无闪烁 |
| 多次修改 | CSS 合并，无冗余 |

---

## 什么时候用 rollback_last，什么时候用 edit_css

| 需求 | 推荐工具 | 原因 |
|---|---|---|
| “刚刚那次改得不对，撤销一下” | `apply_styles(mode="rollback_last")` | 快速回到上一次保存状态 |
| “只把标题再亮一点” | `edit_css` | 精准替换，改动面更小、更省 token |
| “全部重来” | `apply_styles(mode="rollback_all")` | 清空会话样式后重新生成 |

---

## 边界情况

| 情况 | 处理 |
|------|------|
| CSS 语法错误 | 返回错误，不注入 |
| 选择器不匹配 | CSS 注入但不生效（LLM 负责修正） |
| CSP 限制 | 降级到替代注入方式 |
| 存储已满 | 返回错误，提示清理 |
