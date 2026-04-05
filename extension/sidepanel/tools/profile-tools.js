/**
 * StyleSwift - Profile Tools
 *
 * Tools for user profile management.
 */

// =============================================================================
// get_user_profile - 获取用户画像
// =============================================================================

export const GET_USER_PROFILE_TOOL = {
  name: "get_user_profile",
  description: `获取用户的风格偏好画像。包含用户在历史对话中表现出的风格偏好。
新用户可能为空。建议在以下情况获取：
- 新会话开始时，了解用户已知偏好
- 用户请求模糊（如"好看点"），需参考历史偏好`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// =============================================================================
// update_user_profile - 更新用户画像
// =============================================================================

export const UPDATE_USER_PROFILE_TOOL = {
  name: "update_user_profile",
  description: `记录从当前对话中学到的用户风格偏好。
当发现新的偏好信号时调用：
- 用户明确表达："我喜欢圆角"
- 用户通过修正暗示："太黑了，用深蓝" → 偏好深蓝不是纯黑
- 反复的选择模式

记录有意义的偏好洞察，不记录具体 CSS 代码。
content 为完整的画像内容（覆盖写入），应在读取现有画像基础上整合新洞察。`,
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "完整的用户画像内容（覆盖写入）",
      },
    },
    required: ["content"],
  },
};

/**
 * Profile tools handler factory
 * @returns {object} Handlers for profile tools
 */
export function createProfileToolHandlers() {
  return {
    get_user_profile: async () => {
      const { runGetUserProfile } = await import("../profile.js");
      return await runGetUserProfile();
    },

    update_user_profile: async (args) => {
      const { runUpdateUserProfile } = await import("../profile.js");
      return await runUpdateUserProfile(args.content);
    },
  };
}