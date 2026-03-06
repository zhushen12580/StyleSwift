/**
 * StyleSwift - 用户画像管理
 * 
 * 用户风格偏好画像的读写操作
 * 画像存储在 chrome.storage.local 的 userProfile key 中
 */

/**
 * 获取用户风格偏好画像
 * 
 * @returns {Promise<string>} 用户画像内容，无画像时返回默认提示
 * 
 * @example
 * const profile = await runGetUserProfile();
 * // 有画像：返回画像内容
 * // 无画像：返回 '(新用户，暂无风格偏好记录)'
 */
async function runGetUserProfile() {
  try {
    const { userProfile } = await chrome.storage.local.get('userProfile');
    
    // 检查画像是否存在且非空
    if (!userProfile?.trim()) {
      return '(新用户，暂无风格偏好记录)';
    }
    
    return userProfile;
  } catch (error) {
    console.error('[Profile] Failed to get user profile:', error);
    // 出错时返回默认提示，不中断流程
    return '(新用户，暂无风格偏好记录)';
  }
}

/**
 * 更新用户风格偏好画像
 * 
 * @param {string} content - 完整的用户画像内容（覆盖写入）
 * @returns {Promise<string>} 操作结果消息
 * 
 * @example
 * await runUpdateUserProfile('用户偏好：深色模式、圆角设计、现代简约风格');
 * // 返回: '已更新用户画像'
 */
async function runUpdateUserProfile(content) {
  try {
    await chrome.storage.local.set({ userProfile: content });
    return '已更新用户画像';
  } catch (error) {
    console.error('[Profile] Failed to update user profile:', error);
    throw new Error(`更新用户画像失败: ${error.message}`);
  }
}

/**
 * 获取画像的第一行（用于 Session Context L1 注入）
 * 
 * @returns {Promise<string>} 画像第一行内容，最多 100 字
 * 
 * @example
 * const oneLiner = await getProfileOneLiner();
 * // 有画像：返回第一行（最多 100 字）
 * // 无画像：返回空字符串
 */
async function getProfileOneLiner() {
  try {
    const profile = await runGetUserProfile();
    
    // 无画像或默认提示时返回空字符串
    if (!profile || profile === '(新用户，暂无风格偏好记录)') {
      return '';
    }
    
    // 获取第一行并截断到 100 字
    const firstLine = profile.split('\n')[0];
    return firstLine.length > 100 ? firstLine.slice(0, 100) : firstLine;
  } catch (error) {
    console.error('[Profile] Failed to get profile one-liner:', error);
    return '';
  }
}
