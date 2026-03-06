/**
 * Session 管理单元测试
 * 
 * 测试 getOrCreateSession 会话索引管理
 * 
 * 测试标准：
 * - 首次调用创建新会话并返回 id
 * - 再次调用返回已存在的最近会话
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

// Mock crypto.randomUUID
let uuidCounter = 0;
const mockRandomUUID = () => {
  uuidCounter++;
  return `test-uuid-${uuidCounter}`;
};

// Setup mocks before importing the module
vi.stubGlobal('chrome', {
  storage: {
    local: mockStorage
  }
});

vi.stubGlobal('crypto', {
  randomUUID: mockRandomUUID
});

// Import function under test
const { getOrCreateSession } = await import('../sidepanel/session.js');

describe('getOrCreateSession', () => {
  beforeEach(() => {
    mockStorage.clear();
    uuidCounter = 0;
  });
  
  test('首次调用创建新会话并返回 id', async () => {
    const domain = 'github.com';
    const sessionId = await getOrCreateSession(domain);
    
    // 应返回有效的 session id
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId).toBe('test-uuid-1');
    
    // 验证索引已创建
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index } = await mockStorage.get(indexKey);
    
    expect(index).toBeDefined();
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBe(1);
    expect(index[0].id).toBe(sessionId);
    expect(index[0].created_at).toBeDefined();
    expect(typeof index[0].created_at).toBe('number');
  });
  
  test('再次调用返回已存在的最近会话', async () => {
    const domain = 'github.com';
    
    // 第一次调用：创建会话
    const sessionId1 = await getOrCreateSession(domain);
    expect(sessionId1).toBe('test-uuid-1');
    
    // 第二次调用：应返回相同的会话
    const sessionId2 = await getOrCreateSession(domain);
    expect(sessionId2).toBe(sessionId1);
    expect(sessionId2).toBe('test-uuid-1');
    
    // 验证索引只有一个会话
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index } = await mockStorage.get(indexKey);
    expect(index.length).toBe(1);
  });
  
  test('返回最新创建的会话（按 created_at 降序）', async () => {
    const domain = 'example.com';
    
    // 手动插入多个会话，模拟已存在的索引
    const indexKey = `sessions:${domain}:index`;
    const now = Date.now();
    const existingIndex = [
      { id: 'old-session-1', created_at: now - 2000 },
      { id: 'new-session-1', created_at: now - 500 },  // 最新
      { id: 'old-session-2', created_at: now - 1000 }
    ];
    await mockStorage.set({ [indexKey]: existingIndex });
    
    // 调用 getOrCreateSession
    const sessionId = await getOrCreateSession(domain);
    
    // 应返回最新的会话（new-session-1）
    expect(sessionId).toBe('new-session-1');
    
    // 索引不应改变
    const { [indexKey]: index } = await mockStorage.get(indexKey);
    expect(index.length).toBe(3);
  });
  
  test('不同域名的会话独立管理', async () => {
    const domain1 = 'github.com';
    const domain2 = 'stackoverflow.com';
    
    // 为 domain1 创建会话
    const sessionId1 = await getOrCreateSession(domain1);
    expect(sessionId1).toBe('test-uuid-1');
    
    // 为 domain2 创建会话
    const sessionId2 = await getOrCreateSession(domain2);
    expect(sessionId2).toBe('test-uuid-2');
    expect(sessionId2).not.toBe(sessionId1);
    
    // 验证两个域名有独立的索引
    const index1 = (await mockStorage.get(`sessions:${domain1}:index`))[`sessions:${domain1}:index`];
    const index2 = (await mockStorage.get(`sessions:${domain2}:index`))[`sessions:${domain2}:index`];
    
    expect(index1.length).toBe(1);
    expect(index2.length).toBe(1);
    expect(index1[0].id).toBe(sessionId1);
    expect(index2[0].id).toBe(sessionId2);
  });
  
  test('处理空索引（非数组）', async () => {
    const domain = 'test.com';
    const indexKey = `sessions:${domain}:index`;
    
    // 手动设置一个非数组值
    await mockStorage.set({ [indexKey]: null });
    
    // 应创建新会话
    const sessionId = await getOrCreateSession(domain);
    expect(sessionId).toBe('test-uuid-1');
    
    // 验证索引已更新为数组
    const { [indexKey]: index } = await mockStorage.get(indexKey);
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBe(1);
  });
  
  test('新创建的会话包含正确的元数据', async () => {
    const domain = 'newsite.com';
    const beforeCreate = Date.now();
    
    const sessionId = await getOrCreateSession(domain);
    const afterCreate = Date.now();
    
    const indexKey = `sessions:${domain}:index`;
    const { [indexKey]: index } = await mockStorage.get(indexKey);
    
    expect(index[0].id).toBe(sessionId);
    expect(index[0].created_at).toBeGreaterThanOrEqual(beforeCreate);
    expect(index[0].created_at).toBeLessThanOrEqual(afterCreate);
  });
});
