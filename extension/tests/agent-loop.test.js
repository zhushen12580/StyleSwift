/**
 * Agent Loop 单元测试
 * 
 * 测试 SYSTEM_BASE 常量定义
 * 
 * 测试标准：
 * - SYSTEM_BASE 包含所有关键指引
 */

import { describe, test, expect } from 'vitest';

// Import constants to test
import { SYSTEM_BASE } from '../sidepanel/agent-loop.js';

describe('SYSTEM_BASE 常量', () => {
  test('SYSTEM_BASE 定义为字符串', () => {
    expect(typeof SYSTEM_BASE).toBe('string');
    expect(SYSTEM_BASE.length).toBeGreaterThan(100);
  });

  test('包含身份定义', () => {
    expect(SYSTEM_BASE).toContain('StyleSwift');
    expect(SYSTEM_BASE).toContain('网页样式个性化');
  });

  test('包含工作方式指引', () => {
    expect(SYSTEM_BASE).toContain('工作方式');
    expect(SYSTEM_BASE).toContain('使用工具');
    expect(SYSTEM_BASE).toContain('优先行动');
  });

  test('包含可用工具列表', () => {
    expect(SYSTEM_BASE).toContain('get_page_structure');
    expect(SYSTEM_BASE).toContain('grep');
    expect(SYSTEM_BASE).toContain('apply_styles');
    expect(SYSTEM_BASE).toContain('get_user_profile');
    expect(SYSTEM_BASE).toContain('update_user_profile');
    expect(SYSTEM_BASE).toContain('load_skill');
    expect(SYSTEM_BASE).toContain('save_style_skill');
    expect(SYSTEM_BASE).toContain('list_style_skills');
    expect(SYSTEM_BASE).toContain('delete_style_skill');
    expect(SYSTEM_BASE).toContain('Task');
    expect(SYSTEM_BASE).toContain('TodoWrite');
  });

  test('包含 CSS 生成规则', () => {
    expect(SYSTEM_BASE).toContain('生成 CSS 时遵循');
    expect(SYSTEM_BASE).toContain('具体选择器');
    expect(SYSTEM_BASE).toContain('!important');
    expect(SYSTEM_BASE).toContain('hex 或 rgba');
  });

  test('包含风格技能指引', () => {
    expect(SYSTEM_BASE).toContain('风格技能');
    expect(SYSTEM_BASE).toContain('save_style_skill');
    expect(SYSTEM_BASE).toContain('抽象特征');
    expect(SYSTEM_BASE).toContain('视觉一致性');
  });
});

describe('工具数组导出验证', () => {
  test('可以从 agent-loop.js 导入 SYSTEM_BASE', async () => {
    // 验证模块可以正常导入
    const agentLoop = await import('../sidepanel/agent-loop.js');
    expect(agentLoop.SYSTEM_BASE).toBeDefined();
    expect(typeof agentLoop.SYSTEM_BASE).toBe('string');
  });

  test('agent-loop.js 导出 BASE_TOOLS 和 ALL_TOOLS', async () => {
    // 验证模块导出
    const agentLoop = await import('../sidepanel/agent-loop.js');
    
    // 这两个变量应该被导出
    expect(agentLoop).toHaveProperty('BASE_TOOLS');
    expect(agentLoop).toHaveProperty('ALL_TOOLS');
  });
});
