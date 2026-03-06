/**
 * StyleSwift - Tool Definitions
 * 定义所有工具的 JSON Schema，供 Agent Loop 使用
 */

// 导入依赖模块
import { currentSession, updateStylesSummary } from './session.js';
import { mergeCSS } from './css-merge.js';
import { StyleSkillStore } from './style-skill.js';

// =============================================================================
// §3.1 get_page_structure - 获取页面结构
// =============================================================================

const GET_PAGE_STRUCTURE_TOOL = {
  name: 'get_page_structure',
  description: '获取当前页面的结构概览。返回树形结构，包含标签、选择器、关键样式。',
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};

// =============================================================================
// §3.2 grep - 元素搜索
// =============================================================================

const GREP_TOOL = {
  name: 'grep',
  description: `在当前页面中搜索元素，返回匹配元素的详细信息（完整样式、属性、子元素）。

搜索方式（自动检测）：
- CSS 选择器：".sidebar", "nav > a.active", "#main h2"
- 关键词：在标签名、class、id、文本内容、样式值中匹配

典型用途：
- 看完 get_page_structure 概览后，深入查看某个区域的详情
- 查找具有特定样式值的元素
- 确认某个选择器是否存在、有多少匹配`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'CSS 选择器或关键词' },
      scope: {
        type: 'string',
        enum: ['self', 'children', 'subtree'],
        description: '返回详情范围：self=仅匹配元素本身，children=含直接子元素（默认），subtree=含完整子树（慎用）'
      },
      max_results: { type: 'integer', description: '最多返回几个匹配元素，默认 5，最大 20' }
    },
    required: ['query']
  }
};

// =============================================================================
// §3.3 apply_styles - 应用/回滚样式
// =============================================================================

const APPLY_STYLES_TOOL = {
  name: 'apply_styles',
  description: `应用或回滚CSS样式。

mode 说明：
- save: 注入CSS到页面并永久保存（下次访问该域名自动应用）
- rollback_last: 撤销最后一次样式修改（保留之前的修改）
- rollback_all: 回滚所有已应用的样式

使用流程：
1. 生成CSS后直接 save 应用并保存
2. 用户对最近一次修改不满意 → rollback_last 撤销最后一步
3. 用户想全部重来 → rollback_all 清除所有样式`,
  input_schema: {
    type: 'object',
    properties: {
      css: { type: 'string', description: 'CSS代码（save 模式必填，rollback 模式不需要）' },
      mode: {
        type: 'string',
        enum: ['save', 'rollback_last', 'rollback_all'],
        description: 'save=应用并保存, rollback_last=撤销最后一次, rollback_all=全部回滚'
      }
    },
    required: ['mode']
  }
};

// =============================================================================
// §3.4 get_user_profile - 获取用户画像
// =============================================================================

const GET_USER_PROFILE_TOOL = {
  name: 'get_user_profile',
  description: `获取用户的风格偏好画像。包含用户在历史对话中表现出的风格偏好。
新用户可能为空。建议在以下情况获取：
- 新会话开始时，了解用户已知偏好
- 用户请求模糊（如"好看点"），需参考历史偏好`,
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};

// =============================================================================
// §3.5 update_user_profile - 更新用户画像
// =============================================================================

const UPDATE_USER_PROFILE_TOOL = {
  name: 'update_user_profile',
  description: `记录从当前对话中学到的用户风格偏好。
当发现新的偏好信号时调用：
- 用户明确表达："我喜欢圆角"
- 用户通过修正暗示："太黑了，用深蓝" → 偏好深蓝不是纯黑
- 反复的选择模式

记录有意义的偏好洞察，不记录具体 CSS 代码。
content 为完整的画像内容（覆盖写入），应在读取现有画像基础上整合新洞察。`,
  input_schema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '完整的用户画像内容（覆盖写入）' }
    },
    required: ['content']
  }
};

// =============================================================================
// §3.6 load_skill - 加载领域知识/风格技能
// =============================================================================

const LOAD_SKILL_TOOL = {
  name: 'load_skill',
  description: `加载领域知识或用户保存的风格技能。

内置知识：
- dark-mode-template: 深色模式CSS模板
- minimal-template: 极简风格模板
- design-principles: 设计原则（对比度、层级、留白）
- color-theory: 配色理论
- css-selectors: CSS选择器最佳实践

用户风格技能（通过 save_style_skill 创建）：
- 通过 list_style_skills 查看可用的用户技能
- 使用 skill:{id} 格式加载，如 skill:a1b2c3d4

加载用户风格技能后，根据其中的色彩方案、排版、视觉效果等描述，
结合当前页面的 DOM 结构，生成适配的 CSS。不要直接复制参考 CSS 中的选择器。`,
  input_schema: {
    type: 'object',
    properties: {
      skill_name: { type: 'string', description: '内置知识名称，或 skill:{id} 加载用户风格技能' }
    },
    required: ['skill_name']
  }
};

// =============================================================================
// §3.7 save_style_skill - 保存风格技能
// =============================================================================

const SAVE_STYLE_SKILL_TOOL = {
  name: 'save_style_skill',
  description: `从当前会话中提取视觉风格特征，保存为可复用的风格技能。

调用时机：
- 用户对当前风格满意，希望在其他网站复用
- 用户明确说"保存这个风格" / "把这个风格做成模板"

你需要自己分析当前会话的 CSS 和对话意图，提炼出风格技能文档。`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '风格名称，如"赛博朋克"、"清新日式"' },
      mood: { type: 'string', description: '一句话风格描述' },
      skill_content: {
        type: 'string',
        description: `风格技能文档（markdown 格式），必须包含：
1. 风格描述（自然语言，说明整体视觉感受和设计理念）
2. 色彩方案（列出背景/文字/强调/边框等具体色值）
3. 排版（标题/正文/代码的字体、字重、行高偏好）
4. 视觉效果（圆角、阴影、过渡、特殊效果）
5. 设计意图（用户想要达到的效果，为什么做这些选择）
6. 参考 CSS（当前会话生成的 CSS 片段，标注选择器不可直接复用）

重点：提取抽象的风格特征，不是复制具体 CSS。选择器是页面特定的，色彩/排版/效果才是可迁移的。`
      }
    },
    required: ['name', 'skill_content']
  }
};

// =============================================================================
// §3.8 list_style_skills - 列出风格技能
// =============================================================================

const LIST_STYLE_SKILLS_TOOL = {
  name: 'list_style_skills',
  description: `列出用户保存的所有风格技能。
当用户提到"我之前保存的风格"、"用我的XX风格"时，先调用此工具查看可用技能。`,
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
};

// =============================================================================
// §3.9 delete_style_skill - 删除风格技能
// =============================================================================

const DELETE_STYLE_SKILL_TOOL = {
  name: 'delete_style_skill',
  description: '删除一个用户保存的风格技能。',
  input_schema: {
    type: 'object',
    properties: {
      skill_id: { type: 'string', description: '要删除的技能 ID' }
    },
    required: ['skill_id']
  }
};

// =============================================================================
// §五、TodoWrite - 任务列表管理
// =============================================================================

const TODO_WRITE_TOOL = {
  name: 'TodoWrite',
  description: '更新任务列表。用于规划和追踪复杂任务的进度。简单任务不需要使用。',
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '任务描述' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            activeForm: { type: 'string', description: '进行时形式' }
          },
          required: ['content', 'status', 'activeForm']
        }
      }
    },
    required: ['todos']
  }
};

// =============================================================================
// §4.2 Task Tool - 子智能体调用
// =============================================================================

const TASK_TOOL = {
  name: 'Task',
  description: `调用子智能体处理复杂任务。
子智能体在隔离上下文中运行，不会污染主对话历史。

可用的子智能体：
- StyleGenerator: 样式生成专家

使用场景：
- 需要复杂推理的任务
- 需要多次工具调用的任务
- 可能产生大量中间输出的任务`,
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: '任务简短描述（3-5字）' },
      prompt: { type: 'string', description: '详细的任务指令' },
      agent_type: { type: 'string', enum: ['StyleGenerator'], description: '子智能体类型' }
    },
    required: ['description', 'prompt', 'agent_type']
  }
};

// =============================================================================
// 导出所有工具定义
// =============================================================================

const BASE_TOOLS = [
  GET_PAGE_STRUCTURE_TOOL,
  GREP_TOOL,
  APPLY_STYLES_TOOL,
  GET_USER_PROFILE_TOOL,
  UPDATE_USER_PROFILE_TOOL,
  LOAD_SKILL_TOOL,
  SAVE_STYLE_SKILL_TOOL,
  LIST_STYLE_SKILLS_TOOL,
  DELETE_STYLE_SKILL_TOOL,
  TODO_WRITE_TOOL
];

const ALL_TOOLS = [
  ...BASE_TOOLS,
  TASK_TOOL
];

// 导出常量供其他模块使用
const SKILL_PATHS = {
  'dark-mode-template': 'skills/style-templates/dark-mode.md',
  'minimal-template':   'skills/style-templates/minimal.md',
  'design-principles':  'skills/design-principles.md',
  'color-theory':       'skills/color-theory.md',
  'css-selectors':      'skills/css-selectors-guide.md',
};

// =============================================================================
// §2.5 多 Tab 场景处理 - Tab 锁定机制
// =============================================================================

/**
 * 锁定的 Tab ID
 * Agent 启动时锁定当前 Tab，全程操作该 Tab，不跟随用户切换
 */
let lockedTabId = null;

/**
 * 获取目标 Tab ID
 * 优先返回锁定的 Tab ID，否则获取当前活跃 Tab
 * @returns {Promise<number>} Tab ID
 */
async function getTargetTabId() {
  if (lockedTabId) return lockedTabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.id;
}

/**
 * 锁定指定 Tab
 * @param {number} tabId - 要锁定的 Tab ID
 */
function lockTab(tabId) {
  lockedTabId = tabId;
}

/**
 * 解锁 Tab
 */
function unlockTab() {
  lockedTabId = null;
}

/**
 * 通过 Content Script 获取目标 Tab 的域名
 * 不需要 tabs 权限读取 tab.url，通过 Content Script 的 location.hostname 获取
 * @returns {Promise<string>} 域名，失败时返回 'unknown'
 */
async function getTargetDomain() {
  const tabId = await getTargetTabId();
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { tool: 'get_domain' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('getTargetDomain failed:', chrome.runtime.lastError.message);
        resolve('unknown');
      } else {
        resolve(response || 'unknown');
      }
    });
  });
}

/**
 * 发送消息到 Content Script
 * 始终发送给锁定的 Tab
 * @param {object} message - 要发送的消息对象
 * @returns {Promise<any>} Content Script 的响应
 * @throws {Error} Content Script 不可用时抛出错误
 */
async function sendToContentScript(message) {
  const tabId = await getTargetTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Content Script 不可用: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

// =============================================================================
// §3.3.2 Side Panel 端：runApplyStyles - 工具执行 + 持久化
// =============================================================================

/**
 * 应用或回滚 CSS 样式
 * 
 * 跨 Side Panel 和 Content Script 两个执行环境的样式管理函数。
 * 
 * **模式说明：**
 * - `save`: 注入 CSS 到页面并永久保存（下次访问该域名自动应用）
 * - `rollback_last`: 撤销最后一次样式修改（保留之前的修改）
 * - `rollback_all`: 回滚所有已应用的样式
 * 
 * **持久化策略：**
 * - `stylesKey` (sessions:{domain}:{sessionId}:styles): 会话级样式，仅当前会话使用
 * - `persistKey` (persistent:{domain}): 域名级永久样式，所有会话共享
 * 
 * @param {string} css - CSS 代码（save 模式必填，rollback 模式不需要）
 * @param {string} mode - 模式：'save' | 'rollback_last' | 'rollback_all'
 * @returns {Promise<string>} 操作结果消息
 * @throws {Error} 当 Content Script 不可用或存储操作失败时抛出错误
 * 
 * @example
 * // save 模式：注入并保存 CSS
 * await runApplyStyles('body { background: #000 !important; }', 'save');
 * // → '已保存，下次访问 github.com 自动应用'
 * 
 * @example
 * // rollback_last 模式：撤销最后一次修改
 * await runApplyStyles(null, 'rollback_last');
 * // → '已撤销最后一次样式修改'
 * 
 * @example
 * // rollback_all 模式：回滚所有样式
 * await runApplyStyles(null, 'rollback_all');
 * // → '已回滚所有样式'
 */
async function runApplyStyles(css, mode) {
  // 检查是否有当前会话
  if (!currentSession) {
    throw new Error('[runApplyStyles] 没有活动的会话');
  }
  
  try {
    // === rollback_all 模式 ===
    if (mode === 'rollback_all') {
      // 1. 通知 Content Script 回滚所有 CSS
      await sendToContentScript({ tool: 'rollback_css', args: { scope: 'all' } });
      
      // 2. 删除会话样式和永久样式
      const sKey = currentSession.stylesKey;
      const pKey = currentSession.persistKey;
      await chrome.storage.local.remove([sKey, pKey]);
      
      // 3. 更新样式摘要
      await updateStylesSummary();
      
      return '已回滚所有样式';
    }
    
    // === rollback_last 模式 ===
    if (mode === 'rollback_last') {
      // 1. 通知 Content Script 回滚最后一条 CSS
      await sendToContentScript({ tool: 'rollback_css', args: { scope: 'last' } });
      
      // 2. 从 Content Script 获取当前剩余的 CSS
      const remainingCSS = await sendToContentScript({ tool: 'get_active_css' });
      
      // 3. 同步更新存储
      const sKey = currentSession.stylesKey;
      const pKey = currentSession.persistKey;
      
      if (remainingCSS && remainingCSS.trim()) {
        // 如果还有剩余 CSS，更新存储
        await chrome.storage.local.set({ 
          [sKey]: remainingCSS, 
          [pKey]: remainingCSS 
        });
      } else {
        // 如果没有剩余 CSS，删除存储
        await chrome.storage.local.remove([sKey, pKey]);
      }
      
      // 4. 更新样式摘要
      await updateStylesSummary();
      
      return '已撤销最后一次样式修改';
    }
    
    // === save 模式 ===
    if (mode === 'save') {
      // 检查 CSS 参数
      if (!css || !css.trim()) {
        throw new Error('[runApplyStyles] save 模式需要提供 CSS 代码');
      }
      
      // 1. 注入 CSS 到页面
      await sendToContentScript({ tool: 'inject_css', args: { css } });
      
      // 2. 合并并写入会话样式
      const sKey = currentSession.stylesKey;
      const { [sKey]: existing = '' } = await chrome.storage.local.get(sKey);
      const merged = mergeCSS(existing, css);
      await chrome.storage.local.set({ [sKey]: merged });
      
      // 3. 合并并写入永久样式
      const pKey = currentSession.persistKey;
      const { [pKey]: existingP = '' } = await chrome.storage.local.get(pKey);
      const mergedP = mergeCSS(existingP, css);
      await chrome.storage.local.set({ [pKey]: mergedP });
      
      // 4. 更新样式摘要
      await updateStylesSummary();
      
      return `已保存，下次访问 ${currentSession.domain} 自动应用`;
    }
    
    // 未知模式
    throw new Error(`[runApplyStyles] 未知模式: ${mode}`);
    
  } catch (error) {
    console.error('[runApplyStyles] 执行失败:', error);
    throw error;
  }
}

// =============================================================================
// §3.6 Side Panel 端：runLoadSkill - 加载领域知识/风格技能
// =============================================================================

/**
 * 加载领域知识或用户保存的风格技能
 * 
 * 支持两种技能类型：
 * 1. 内置静态知识：通过 chrome.runtime.getURL + fetch 加载打包的 .md 文件
 * 2. 用户动态风格技能：通过 StyleSkillStore.load 从 chrome.storage.local 加载
 * 
 * **内置知识列表：**
 * - dark-mode-template: 深色模式 CSS 模板
 * - minimal-template: 极简风格模板
 * - design-principles: 设计原则（对比度、层级、留白）
 * - color-theory: 配色理论
 * - css-selectors: CSS 选择器最佳实践
 * 
 * **用户技能格式：**
 * - 使用 skill:{id} 格式加载，如 skill:a1b2c3d4
 * - 通过 list_style_skills 查看可用的用户技能
 * 
 * @param {string} skillName - 内置知识名称，或 skill:{id} 加载用户风格技能
 * @returns {Promise<string>} 技能内容（markdown 格式）或错误提示
 * 
 * @example
 * // 加载内置知识
 * const content = await runLoadSkill('dark-mode-template');
 * // → 返回 dark-mode.md 文件内容
 * 
 * @example
 * // 加载用户技能
 * const content = await runLoadSkill('skill:a1b2c3d4');
 * // → 返回用户保存的技能内容
 * 
 * @example
 * // 未知名称
 * const content = await runLoadSkill('unknown');
 * // → 返回可用技能列表提示
 */
async function runLoadSkill(skillName) {
  // === 用户动态风格技能 ===
  if (skillName.startsWith('skill:')) {
    const id = skillName.slice(6);
    const content = await StyleSkillStore.load(id);
    
    if (!content) {
      return `未找到风格技能: ${id}。使用 list_style_skills 查看可用技能。`;
    }
    
    return content;
  }
  
  // === 内置静态知识 ===
  const path = SKILL_PATHS[skillName];
  if (!path) {
    // 未知名称：返回可用列表
    const userSkills = await StyleSkillStore.list();
    const userSkillsHint = userSkills.length > 0
      ? `\n用户风格技能: ${userSkills.map(s => `skill:${s.id} (${s.name})`).join(', ')}`
      : '';
    
    return `未知知识: ${skillName}。可用: ${Object.keys(SKILL_PATHS).join(', ')}${userSkillsHint}`;
  }
  
  // Side Panel 中通过 chrome.runtime.getURL 访问扩展内静态资源
  const url = chrome.runtime.getURL(path);
  const resp = await fetch(url);
  return await resp.text();
}

// =============================================================================
// §3.7 Side Panel 端：runSaveStyleSkill - 保存风格技能
// =============================================================================

/**
 * 从当前会话中提取视觉风格特征，保存为可复用的风格技能
 * 
 * **工作流程：**
 * 1. 生成 8 位 UUID 作为技能 ID
 * 2. 获取当前域名作为来源
 * 3. 组装 header（名称、来源、日期、风格描述）
 * 4. 调用 StyleSkillStore.save 保存技能内容和索引
 * 
 * **Header 格式：**
 * ```markdown
 * # {name}
 * 
 * > 来源: {domain} | 创建: {date}
 * > 风格: {mood}
 * 
 * {skillContent}
 * ```
 * 
 * 如果 skillContent 已经以 `# ` 开头，则不重复添加 header。
 * 
 * @param {string} name - 风格名称，如"赛博朋克"、"清新日式"
 * @param {string} mood - 一句话风格描述（可选）
 * @param {string} skillContent - 风格技能文档（markdown 格式）
 * @returns {Promise<string>} 成功消息，包含技能 ID 和使用方法
 * 
 * @example
 * const result = await runSaveStyleSkill(
 *   '赛博朋克',
 *   '深色背景+霓虹色调的高科技感',
 *   '## 风格描述\n深色背景配合霓虹色调...'
 * );
 * // → '已保存风格技能「赛博朋克」(id: a1b2c3d4)，可在任意网站通过 load_skill('skill:a1b2c3d4') 加载使用。'
 */
async function runSaveStyleSkill(name, mood, skillContent) {
  // 1. 生成 8 位 UUID
  const id = crypto.randomUUID().slice(0, 8);
  
  // 2. 获取来源域名
  const sourceDomain = currentSession?.domain || 'unknown';
  
  // 3. 组装 header
  const header = `# ${name}\n\n> 来源: ${sourceDomain} | 创建: ${new Date().toLocaleDateString()}\n> 风格: ${mood || ''}\n\n`;
  
  // 4. 处理完整内容（避免重复添加 header）
  const fullContent = skillContent.startsWith('# ') ? skillContent : header + skillContent;
  
  // 5. 保存技能
  await StyleSkillStore.save(id, name, mood || '', sourceDomain, fullContent);
  
  // 6. 返回成功消息
  return `已保存风格技能「${name}」(id: ${id})，可在任意网站通过 load_skill('skill:${id}') 加载使用。`;
}

// =============================================================================
// 导出函数
// =============================================================================

export {
  getTargetTabId,
  lockTab,
  unlockTab,
  getTargetDomain,
  sendToContentScript,
  runApplyStyles,
  runLoadSkill,
  runSaveStyleSkill
};
