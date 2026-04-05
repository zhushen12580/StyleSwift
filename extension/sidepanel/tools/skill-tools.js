/**
 * StyleSwift - Skill Tools
 *
 * Tools for loading, saving, listing, and deleting style skills.
 */

// =============================================================================
// load_skill - 加载领域知识/风格技能
// =============================================================================

export const LOAD_SKILL_TOOL = {
  name: "load_skill",
  description: `加载领域知识或用户保存的风格技能。

内置知识（自动发现）：
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
    type: "object",
    properties: {
      skill_name: {
        type: "string",
        description: "内置知识名称，或 skill:{id} 加载用户风格技能",
      },
    },
    required: ["skill_name"],
  },
};

// =============================================================================
// save_style_skill - 保存风格技能
// =============================================================================

export const SAVE_STYLE_SKILL_TOOL = {
  name: "save_style_skill",
  description: `从当前会话中提取视觉风格特征，保存为可复用的风格技能。

⚠️ 重要：此工具**只能**在用户**明确要求**时调用！

必须等待用户说以下类似的话才能调用：
- "保存这个风格" / "保存当前风格"
- "把这个风格做成模板" / "创建风格模板"
- "我想在其他网站也用这个风格"
- "帮我保存风格技能"

❌ 禁止自动调用：即使你对当前样式效果很满意，也不能主动保存，必须等待用户明确请求。`,
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: '风格名称，如"赛博朋克"、"清新日式"',
      },
      mood: { type: "string", description: "一句话风格描述" },
      skill_content: {
        type: "string",
        description: `风格技能文档（markdown 格式），必须包含：
1. 风格描述（自然语言，说明整体视觉感受和设计理念）
2. 色彩方案（列出背景/文字/强调/边框等具体色值）
3. 排版（标题/正文/代码的字体、字重、行高偏好）
4. 视觉效果（圆角、阴影、过渡、特殊效果）
5. 设计意图（用户想要达到的效果，为什么做这些选择）
6. 参考 CSS（当前会话生成的 CSS 片段，标注选择器不可直接复用）

重点：提取抽象的风格特征，不是复制具体 CSS。选择器是页面特定的，色彩/排版/效果才是可迁移的。`,
      },
    },
    required: ["name", "skill_content"],
  },
};

// =============================================================================
// list_style_skills - 列出风格技能
// =============================================================================

export const LIST_STYLE_SKILLS_TOOL = {
  name: "list_style_skills",
  description: `列出用户保存的所有风格技能。
当用户提到"我之前保存的风格"、"用我的XX风格"时，先调用此工具查看可用技能。`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// delete_style_skill - 删除风格技能
// =============================================================================

export const DELETE_STYLE_SKILL_TOOL = {
  name: "delete_style_skill",
  description: "删除一个用户保存的风格技能。",
  input_schema: {
    type: "object",
    properties: {
      skill_id: { type: "string", description: "要删除的技能 ID" },
    },
    required: ["skill_id"],
  },
};

/**
 * Skill tools handler factory
 * @param {object} deps - Dependencies
 * @param {function} deps.runLoadSkill - Load skill function
 * @param {function} deps.runSaveStyleSkill - Save style skill function
 * @param {function} deps.runListStyleSkills - List style skills function
 * @param {function} deps.runDeleteStyleSkill - Delete style skill function
 * @returns {object} Handlers for skill tools
 */
export function createSkillToolHandlers({ runLoadSkill, runSaveStyleSkill, runListStyleSkills, runDeleteStyleSkill }) {
  return {
    load_skill: async (args) => await runLoadSkill(args.skill_name),

    save_style_skill: async (args) =>
      await runSaveStyleSkill(args.name, args.mood, args.skill_content),

    list_style_skills: async () => await runListStyleSkills(),

    delete_style_skill: async (args) => await runDeleteStyleSkill(args.skill_id),
  };
}