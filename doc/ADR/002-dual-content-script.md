# ADR-002: 双 Content Script 策略

## 状态

已采纳

## 背景

用户在页面上应用样式后刷新页面，会出现**闪烁问题（FOUC）**：页面先显示原始样式，几百毫秒后才恢复用户定制的样式。

## 决策

使用两个 Content Script，注入时机不同：

| 脚本 | 注入时机 | 职责 |
|------|---------|------|
| early-inject.js | `document_start` | 预注入活动会话样式 |
| content.js | `document_idle` | DOM 操作、工具执行、样式管理 |

## 原因分析

### 闪烁的根本原因

Content Script 默认在 `document_idle` 注入，此时 DOM 已解析完成，页面开始渲染。即使立即注入样式，用户也会看到原始样式的短暂闪现。

### 单脚本无法解决

无论单脚本注入多快，都无法早于 DOM 解析。`document_start` 注入时 DOM 不存在，无法执行 DOM 操作。

### 双脚本分工

```
页面加载时间线：
│
├── document_start
│   └── early-inject.js 注入
│       └── 读取 active_styles:{domain}
│       └── 创建 <style> 注入（DOM 尚不存在，追加到 documentElement）
│
├── DOM 开始解析
│   └── 样式已存在，渲染时直接应用 ✓ 无闪烁
│
├── document_idle
│   └── content.js 注入
│       └── 接管样式管理
│       └── 移除 early-inject 的 <style>
│       └── 创建新的 <style> 继续管理
│
└── 页面就绪
```

## 后果

### 优点

- 完全消除样式闪烁
- 用户体验无缝

### 缺点

- 两个脚本需要协调样式接管
- 存储中需要维护"活动会话样式镜像"

### 技术影响

- Manifest 需声明两个 content_scripts 入口
- `active_styles:{domain}` 需在每次样式变更时同步更新
- content.js 接管时需移除 early-inject 创建的 `<style>` 节点

## 替代方案

**单脚本 + CSS 注入优化**：在 `document_start` 注入空脚本，通过 `chrome.scripting.insertCSS` 注入样式。

放弃原因：
- `chrome.scripting.insertCSS` 需要 `scripting` 权限
- 样式来源需要额外管理
- 不如 Content Script 灵活（无法动态读取存储）
