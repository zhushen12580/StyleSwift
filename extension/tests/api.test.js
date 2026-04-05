/**
 * API Settings 单元测试
 * 
 * 测试 getSettings / saveSettings 功能，使用 mock chrome.storage.local
 * 
 * 测试标准：
 * - saveSettings 后 getSettings 返回正确值
 * - 无 Key 时抛出错误
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
const mockStorage = {
  data: {},
  
  async get(keys) {
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      const result = {};
      for (const key of keys) {
        if (this.data[key] !== undefined) {
          result[key] = this.data[key];
        }
      }
      return result;
    }
    // keys is object with default values
    const result = {};
    for (const [key, defaultValue] of Object.entries(keys)) {
      result[key] = this.data[key] !== undefined ? this.data[key] : defaultValue;
    }
    return result;
  },
  
  async set(items) {
    Object.assign(this.data, items);
  },
  
  async remove(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const key of keyArray) {
      delete this.data[key];
    }
  },
  
  clear() {
    this.data = {};
  }
};

// Mock chrome.permissions
const mockPermissions = {
  grantedOrigins: new Set(),
  
  async contains({ origins }) {
    return origins.every(origin => this.grantedOrigins.has(origin));
  },
  
  async request({ origins }) {
    // 模拟用户授权
    for (const origin of origins) {
      this.grantedOrigins.add(origin);
    }
    return true;
  },
  
  clear() {
    this.grantedOrigins.clear();
  }
};

// 设置全局 chrome mock
global.chrome = {
  storage: {
    local: mockStorage
  },
  permissions: mockPermissions
};

// 动态导入被测模块（在 mock 设置后）
const {
  DEFAULT_API_BASE,
  DEFAULT_MODEL,
  SETTINGS_KEY,
  getSettings,
  saveSettings,
  ensureApiPermission,
  checkFirstRun
} = await import('../sidepanel/api.js');

describe('API Settings', () => {
  beforeEach(() => {
    // 每个测试前清空存储
    mockStorage.clear();
    mockPermissions.clear();
  });

  describe('常量定义', () => {
    test('DEFAULT_API_BASE 应为有效的 API 地址', () => {
      expect(DEFAULT_API_BASE).toBeDefined();
      expect(typeof DEFAULT_API_BASE).toBe('string');
      expect(DEFAULT_API_BASE.startsWith('https://')).toBe(true);
    });

    test('DEFAULT_MODEL 应为有效的模型名称', () => {
      expect(DEFAULT_MODEL).toBeDefined();
      expect(typeof DEFAULT_MODEL).toBe('string');
      expect(DEFAULT_MODEL.length).toBeGreaterThan(0);
    });

    test('SETTINGS_KEY 应为 settings', () => {
      expect(SETTINGS_KEY).toBe('settings');
    });
  });

  describe('getSettings', () => {
    test('无 Key 时应抛出错误', async () => {
      await expect(getSettings()).rejects.toThrow('请先在设置中配置 API Key');
    });

    test('settings 对象不存在时应抛出错误', async () => {
      await expect(getSettings()).rejects.toThrow('请先在设置中配置 API Key');
    });

    test('apiKey 为空字符串时应抛出错误', async () => {
      await mockStorage.set({
        settings: {
          apiKey: '',
          apiBase: DEFAULT_API_BASE,
          model: DEFAULT_MODEL
        }
      });
      
      await expect(getSettings()).rejects.toThrow('请先在设置中配置 API Key');
    });

    test('有完整设置时应返回正确值', async () => {
      const testSettings = {
        apiKey: 'sk-ant-test123',
        apiBase: 'https://custom.api.com',
        model: 'claude-opus-4-20250514'
      };
      await mockStorage.set({ settings: testSettings });
      
      const result = await getSettings();
      expect(result.apiKey).toBe('sk-ant-test123');
      expect(result.apiBase).toBe('https://custom.api.com');
      expect(result.model).toBe('claude-opus-4-20250514');
    });

    test('缺少 apiBase 时应返回默认值', async () => {
      await mockStorage.set({
        settings: {
          apiKey: 'sk-ant-test',
          model: 'claude-sonnet-4-20250514'
        }
      });
      
      const result = await getSettings();
      expect(result.apiBase).toBe(DEFAULT_API_BASE);
    });

    test('缺少 model 时应返回默认值', async () => {
      await mockStorage.set({
        settings: {
          apiKey: 'sk-ant-test',
          apiBase: 'https://api.anthropic.com'
        }
      });
      
      const result = await getSettings();
      expect(result.model).toBe(DEFAULT_MODEL);
    });
  });

  describe('saveSettings', () => {
    test('首次保存应创建新设置', async () => {
      await saveSettings({ apiKey: 'sk-ant-new' });
      
      const { settings } = await mockStorage.get('settings');
      expect(settings.apiKey).toBe('sk-ant-new');
      expect(settings.apiBase).toBe(DEFAULT_API_BASE);
      expect(settings.model).toBe(DEFAULT_MODEL);
    });

    test('saveSettings 后 getSettings 返回正确值', async () => {
      await saveSettings({
        apiKey: 'sk-ant-full',
        apiBase: 'https://custom.api.com',
        model: 'claude-opus-4-20250514'
      });
      
      const result = await getSettings();
      expect(result.apiKey).toBe('sk-ant-full');
      expect(result.apiBase).toBe('https://custom.api.com');
      expect(result.model).toBe('claude-opus-4-20250514');
    });

    test('部分更新应保留已有设置', async () => {
      // 先保存完整设置
      await saveSettings({
        apiKey: 'sk-ant-original',
        apiBase: 'https://original.api.com',
        model: 'claude-sonnet-4-20250514'
      });
      
      // 只更新 model
      await saveSettings({ model: 'claude-opus-4-20250514' });
      
      const result = await getSettings();
      expect(result.apiKey).toBe('sk-ant-original');
      expect(result.apiBase).toBe('https://original.api.com');
      expect(result.model).toBe('claude-opus-4-20250514');
    });

    test('更新 apiKey 应保留其他设置', async () => {
      await saveSettings({
        apiKey: 'sk-ant-old',
        apiBase: 'https://custom.api.com'
      });
      
      await saveSettings({ apiKey: 'sk-ant-new' });
      
      const result = await getSettings();
      expect(result.apiKey).toBe('sk-ant-new');
      expect(result.apiBase).toBe('https://custom.api.com');
    });

    test('显式传入 undefined 应保留原值', async () => {
      await saveSettings({
        apiKey: 'sk-ant-test',
        apiBase: 'https://custom.api.com'
      });
      
      // 传入空对象不应改变设置
      await saveSettings({});
      
      const result = await getSettings();
      expect(result.apiKey).toBe('sk-ant-test');
      expect(result.apiBase).toBe('https://custom.api.com');
    });
  });

  describe('ensureApiPermission', () => {
    test('默认 API 地址应直接返回 true', async () => {
      const result = await ensureApiPermission(DEFAULT_API_BASE);
      expect(result).toBe(true);
    });

    test('自定义地址应检查权限', async () => {
      const customBase = 'https://custom.api.com';
      const result = await ensureApiPermission(customBase);
      expect(result).toBe(true);
      // 验证权限已被添加
      expect(mockPermissions.grantedOrigins.has(`${customBase}/*`)).toBe(true);
    });

    test('已有权限的自定义地址应直接返回 true', async () => {
      const customBase = 'https://existing.api.com';
      mockPermissions.grantedOrigins.add(`${customBase}/*`);
      
      const result = await ensureApiPermission(customBase);
      expect(result).toBe(true);
    });

    test('无效 URL 应返回 false', async () => {
      const result = await ensureApiPermission('not-a-valid-url');
      expect(result).toBe(false);
    });
  });

  describe('checkFirstRun', () => {
    test('无设置时应返回 needsSetup: true', async () => {
      const result = await checkFirstRun();
      expect(result.needsSetup).toBe(true);
    });

    test('有 apiKey 时应返回 needsSetup: false', async () => {
      await saveSettings({ apiKey: 'sk-ant-test' });
      
      const result = await checkFirstRun();
      expect(result.needsSetup).toBe(false);
    });

    test('有设置但无 apiKey 时应返回 needsSetup: true', async () => {
      await mockStorage.set({
        settings: {
          apiBase: DEFAULT_API_BASE,
          model: DEFAULT_MODEL
        }
      });
      
      const result = await checkFirstRun();
      expect(result.needsSetup).toBe(true);
    });
  });

  describe('完整流程测试', () => {
    test('首次配置 → 读取 → 部分更新流程', async () => {
      // 1. 检测首次运行
      let firstRun = await checkFirstRun();
      expect(firstRun.needsSetup).toBe(true);
      
      // 2. 首次配置
      await saveSettings({ apiKey: 'sk-ant-first' });
      
      // 3. 再次检测
      firstRun = await checkFirstRun();
      expect(firstRun.needsSetup).toBe(false);
      
      // 4. 读取验证
      let settings = await getSettings();
      expect(settings.apiKey).toBe('sk-ant-first');
      expect(settings.apiBase).toBe(DEFAULT_API_BASE);
      expect(settings.model).toBe(DEFAULT_MODEL);
      
      // 5. 部分更新
      await saveSettings({
        apiBase: 'https://proxy.example.com',
        model: 'claude-opus-4-20250514'
      });
      
      // 6. 再次读取验证
      settings = await getSettings();
      expect(settings.apiKey).toBe('sk-ant-first');
      expect(settings.apiBase).toBe('https://proxy.example.com');
      expect(settings.model).toBe('claude-opus-4-20250514');
    });

    test('多次部分更新应正确合并', async () => {
      // 初始配置
      await saveSettings({ apiKey: 'sk-ant-1' });
      
      // 更新 apiBase
      await saveSettings({ apiBase: 'https://custom1.com' });
      let settings = await getSettings();
      expect(settings.apiKey).toBe('sk-ant-1');
      expect(settings.apiBase).toBe('https://custom1.com');
      
      // 更新 model
      await saveSettings({ model: 'claude-opus-4-20250514' });
      settings = await getSettings();
      expect(settings.apiKey).toBe('sk-ant-1');
      expect(settings.apiBase).toBe('https://custom1.com');
      expect(settings.model).toBe('claude-opus-4-20250514');
      
      // 更新 apiKey
      await saveSettings({ apiKey: 'sk-ant-2' });
      settings = await getSettings();
      expect(settings.apiKey).toBe('sk-ant-2');
      expect(settings.apiBase).toBe('https://custom1.com');
      expect(settings.model).toBe('claude-opus-4-20250514');
    });
  });
});
