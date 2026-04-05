# ADR-007: Tab 锁定机制

## 状态

已采纳

## 背景

Side Panel 是 **per-window** 的——同一浏览器窗口内切换 Tab，Side Panel 保持打开。

问题：Agent 运行期间用户可能切换 Tab，如何确保操作正确的页面？

## 决策

Agent 启动时**锁定当前 Tab**，全程操作该 Tab，不跟随用户切换。

## 原因分析

### 场景分析

```
时间线：

T1: 用户在 github.com 打开 Side Panel
T2: 用户发送 "改成深色模式"
T3: Agent 开始处理（调用 get_page_structure）
T4: 用户切换到 stackoverflow.com
T5: Agent 完成，注入样式

问题：样式应该注入到哪个页面？
```

### 选项对比

| 选项 | 行为 | 问题 |
|------|------|------|
| 跟随切换 | 样式注入到当前 Tab | 用户困惑（我在改 github，为什么 stackoverflow 变了？） |
| 锁定 Tab | 样式注入到锁定 Tab | 用户可能看到错误的页面 |

### 为什么选择锁定

**用户心智模型**："我在改这个页面"——指的是发送消息时的页面。

锁定 Tab 更符合用户预期：
- 用户在 github 发送消息
- 即使切换到其他页面，Agent 仍在处理 github
- 结果应用在 github

### 为什么不监听 Tab 切换

监听 Tab 切换需要 `tabs` 权限，会触发敏感提示：

> "此扩展可以读取和修改您的所有网站数据"
> "此扩展可以读取您的浏览历史记录"

这会让用户产生安全顾虑。

**当前方案**：
- 域名通过 Content Script 获取（`location.hostname`）
- 无需 `tabs` 权限
- 权限提示更友好

## 后果

### 优点

- 符合用户预期
- 无需敏感权限
- 实现简单

### 缺点

- 用户切换 Tab 后，Agent 完成时看不到效果
- 需要提示用户"正在处理 github.com"

### 技术影响

实现方式：
```
1. Agent 启动时调用 chrome.tabs.query({ active: true, currentWindow: true })
2. 获取当前 Tab ID，锁定
3. 所有工具调用发送到锁定的 Tab
4. Agent 完成后解锁
5. 下次用户发送新消息时，重新获取当前 Tab
```

UI 提示：
- 顶栏显示当前处理的域名
- 用户切换 Tab 时，Side Panel 保持显示处理中的域名

## 替代方案

### 方案 A：跟随切换

监听 `chrome.tabs.onActivated`，切换 Tab 时切换目标。

放弃原因：
- 用户困惑
- 需要 `tabs` 权限

### 方案 B：禁止切换

Agent 运行时禁用 Tab 切换。

放弃原因：
- 过于限制用户自由
- 技术上难以实现（无法阻止用户切换）

### 方案 C：多 Tab 并行

支持同时在多个 Tab 上运行 Agent。

放弃原因：
- 复杂度大增
- 用户通常一次只改一个页面
- API 调用成本翻倍
