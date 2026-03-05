/**
 * CSS Merge Engine 单元测试
 * 
 * 测试 splitTopLevelBlocks 函数
 * 
 * 测试标准：
 * - 正确分割普通规则
 * - 正确分割嵌套的 @media/@keyframes 块
 */

import { describe, test, expect } from 'vitest';
import { splitTopLevelBlocks } from '../sidepanel/css-merge.js';

describe('splitTopLevelBlocks', () => {
  describe('普通规则', () => {
    test('单个普通规则', () => {
      const css = '.header { color: red; }';
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe('.header { color: red; }');
    });

    test('多个普通规则', () => {
      const css = '.a { color: red; } .b { margin: 0; } .c { padding: 10px; }';
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toBe('.a { color: red; }');
      expect(blocks[1]).toBe('.b { margin: 0; }');
      expect(blocks[2]).toBe('.c { padding: 10px; }');
    });

    test('带多行属性的规则', () => {
      const css = `.header {
        color: red;
        background: blue;
        padding: 10px;
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('color: red');
      expect(blocks[0]).toContain('background: blue');
      expect(blocks[0]).toContain('padding: 10px');
    });

    test('空字符串', () => {
      expect(splitTopLevelBlocks('')).toEqual([]);
      expect(splitTopLevelBlocks('   ')).toEqual([]);
    });
  });

  describe('@media 嵌套规则', () => {
    test('单个 @media 规则', () => {
      const css = '@media (max-width: 600px) { .header { color: blue; } }';
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe('@media (max-width: 600px) { .header { color: blue; } }');
    });

    test('@media 包含多个嵌套规则', () => {
      const css = `@media print {
        .header { display: none; }
        .footer { display: block; }
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('@media print');
      expect(blocks[0]).toContain('.header { display: none; }');
      expect(blocks[0]).toContain('.footer { display: block; }');
    });

    test('@media 深层嵌套', () => {
      const css = `@media screen and (max-width: 768px) {
        .container {
          width: 100%;
        }
        .sidebar {
          display: none;
        }
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('@media screen');
      expect(blocks[0]).toContain('.container');
      expect(blocks[0]).toContain('.sidebar');
    });
  });

  describe('@keyframes 动画规则', () => {
    test('单个 @keyframes 规则', () => {
      const css = `@keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('@keyframes fadeIn');
      expect(blocks[0]).toContain('from { opacity: 0; }');
      expect(blocks[0]).toContain('to { opacity: 1; }');
    });

    test('@keyframes 带百分比关键帧', () => {
      const css = `@keyframes slideIn {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(0); }
        100% { transform: translateX(100%); }
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('0% { transform: translateX(-100%); }');
      expect(blocks[0]).toContain('50% { transform: translateX(0); }');
      expect(blocks[0]).toContain('100% { transform: translateX(100%); }');
    });
  });

  describe('混合规则', () => {
    test('普通规则 + @media 规则', () => {
      const css = '.a { color: red; } @media print { .a { color: black; } }';
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe('.a { color: red; }');
      expect(blocks[1]).toBe('@media print { .a { color: black; } }');
    });

    test('普通规则 + @media + @keyframes', () => {
      const css = `.header { color: red; }
        @media (max-width: 600px) { .header { color: blue; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .footer { margin: 0; }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(4);
      expect(blocks[0]).toContain('.header { color: red; }');
      expect(blocks[1]).toContain('@media');
      expect(blocks[2]).toContain('@keyframes fadeIn');
      expect(blocks[3]).toContain('.footer { margin: 0; }');
    });

    test('复杂混合场景', () => {
      const css = `
        body { background: #fff; }
        
        @media (prefers-color-scheme: dark) {
          body { background: #000; }
          .text { color: #fff; }
        }
        
        .button {
          background: blue;
          transition: all 0.3s;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(4);
      // body 规则
      expect(blocks[0]).toContain('body { background: #fff; }');
      // @media 规则（包含两个嵌套规则）
      expect(blocks[1]).toContain('@media (prefers-color-scheme: dark)');
      expect(blocks[1]).toContain('body { background: #000; }');
      expect(blocks[1]).toContain('.text { color: #fff; }');
      // .button 规则
      expect(blocks[2]).toContain('.button');
      expect(blocks[2]).toContain('background: blue');
      // @keyframes 规则
      expect(blocks[3]).toContain('@keyframes pulse');
      expect(blocks[3]).toContain('transform: scale(1)');
    });
  });

  describe('边界情况', () => {
    test('CSS 注释不应影响分割', () => {
      const css = `/* 这是一个注释 */
        .header { color: red; }
        /* 另一个注释 */`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('.header { color: red; }');
    });

    test('字符串中的花括号', () => {
      const css = `.content::before { content: "{}"; }`;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toContain('content: "{}"');
    });

    test('多行空格和换行', () => {
      const css = `
        
        .a { color: red; }
        
        
        
        .b { margin: 0; }
        
      `;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe('.a { color: red; }');
      expect(blocks[1]).toBe('.b { margin: 0; }');
    });

    test('嵌套选择器（非标准，但需要处理）', () => {
      // 某些预处理器生成的嵌套 CSS
      const css = `.parent {
        .child { color: red; }
      }`;
      const blocks = splitTopLevelBlocks(css);
      
      // 整体应被识别为一个块（depth 最终回到 0）
      expect(blocks).toHaveLength(1);
    });
  });

  describe('实际应用场景', () => {
    test('深色模式 CSS', () => {
      const css = `
        body { background-color: #fff !important; color: #333 !important; }
        
        .site-header { background: #f5f5f5 !important; border-bottom: 1px solid #ddd !important; }
        
        @media (prefers-color-scheme: dark) {
          body { background-color: #1a1a1a !important; color: #e0e0e0 !important; }
          .site-header { background: #2a2a2a !important; border-color: #444 !important; }
        }
      `;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toContain('body { background-color: #fff');
      expect(blocks[1]).toContain('.site-header');
      expect(blocks[2]).toContain('@media (prefers-color-scheme: dark)');
    });

    test('带动画的按钮样式', () => {
      const css = `
        .btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
        }
      `;
      const blocks = splitTopLevelBlocks(css);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toContain('.btn {');
      expect(blocks[1]).toContain('.btn:hover {');
      expect(blocks[2]).toContain('@keyframes pulse');
    });
  });
});
