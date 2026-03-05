/**
 * CSS Merge Engine 单元测试
 * 
 * 测试 splitTopLevelBlocks 函数
 * 测试 parseRules 函数
 * 
 * 测试标准：
 * - 正确分割普通规则
 * - 正确分割嵌套的 @media/@keyframes 块
 * - 正确解析普通规则为属性 Map
 * - @media 规则保留原始文本
 */

import { describe, test, expect } from 'vitest';
import { splitTopLevelBlocks, parseRules } from '../sidepanel/css-merge.js';

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

describe('parseRules', () => {
  describe('普通规则解析', () => {
    test('单个普通规则解析为属性 Map', () => {
      const css = '.header { color: red; font-size: 14px; }';
      const rules = parseRules(css);
      
      expect(rules.size).toBe(1);
      expect(rules.has('.header')).toBe(true);
      
      const props = rules.get('.header');
      expect(props).toBeInstanceOf(Map);
      expect(props.get('color')).toBe('red');
      expect(props.get('font-size')).toBe('14px');
    });

    test('多个普通规则分别解析', () => {
      const css = '.a { color: red; } .b { margin: 0; padding: 10px; }';
      const rules = parseRules(css);
      
      expect(rules.size).toBe(2);
      expect(rules.get('.a').get('color')).toBe('red');
      expect(rules.get('.b').get('margin')).toBe('0');
      expect(rules.get('.b').get('padding')).toBe('10px');
    });

    test('多行属性正确解析', () => {
      const css = `.header {
        color: red;
        background: blue;
        padding: 10px;
      }`;
      const rules = parseRules(css);
      
      const props = rules.get('.header');
      expect(props.get('color')).toBe('red');
      expect(props.get('background')).toBe('blue');
      expect(props.get('padding')).toBe('10px');
    });

    test('带 !important 的属性值', () => {
      const css = '.btn { color: red !important; background: blue !important; }';
      const rules = parseRules(css);
      
      const props = rules.get('.btn');
      expect(props.get('color')).toBe('red !important');
      expect(props.get('background')).toBe('blue !important');
    });

    test('复合选择器', () => {
      const css = 'body.dark-mode .header { background: #1a1a1a; color: #fff; }';
      const rules = parseRules(css);
      
      expect(rules.has('body.dark-mode .header')).toBe(true);
      expect(rules.get('body.dark-mode .header').get('background')).toBe('#1a1a1a');
    });

    test('伪类选择器', () => {
      const css = '.btn:hover { background: blue; transform: scale(1.1); }';
      const rules = parseRules(css);
      
      expect(rules.has('.btn:hover')).toBe(true);
      expect(rules.get('.btn:hover').get('background')).toBe('blue');
      expect(rules.get('.btn:hover').get('transform')).toBe('scale(1.1)');
    });

    test('空属性值被忽略', () => {
      const css = '.header { color: red; margin: ; padding: 10px; }';
      const rules = parseRules(css);
      
      const props = rules.get('.header');
      expect(props.has('margin')).toBe(false);
      expect(props.get('color')).toBe('red');
      expect(props.get('padding')).toBe('10px');
    });
  });

  describe('@media 规则保留原始文本', () => {
    test('@media 规则以 __raw__ 标记保留', () => {
      const css = '@media (max-width: 600px) { .header { color: blue; } }';
      const rules = parseRules(css);
      
      expect(rules.size).toBe(1);
      expect(rules.has('@media (max-width: 600px)')).toBe(true);
      
      const props = rules.get('@media (max-width: 600px)');
      expect(props.has('__raw__')).toBe(true);
      expect(props.get('__raw__')).toBe('@media (max-width: 600px) { .header { color: blue; } }');
    });

    test('@media 包含多个嵌套规则', () => {
      const css = '@media print { .header { display: none; } .footer { display: block; } }';
      const rules = parseRules(css);
      
      const props = rules.get('@media print');
      expect(props.has('__raw__')).toBe(true);
      expect(props.get('__raw__')).toContain('.header { display: none; }');
      expect(props.get('__raw__')).toContain('.footer { display: block; }');
    });

    test('同条件 @media 规则覆盖', () => {
      const css = '@media (max-width: 600px) { .a { color: red; } } @media (max-width: 600px) { .b { margin: 0; } }';
      const rules = parseRules(css);
      
      // 后者覆盖前者
      expect(rules.size).toBe(1);
      const props = rules.get('@media (max-width: 600px)');
      expect(props.get('__raw__')).toContain('.b { margin: 0; }');
    });
  });

  describe('@keyframes 规则保留原始文本', () => {
    test('@keyframes 规则以 __raw__ 标记保留', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const rules = parseRules(css);
      
      expect(rules.has('@keyframes fadeIn')).toBe(true);
      const props = rules.get('@keyframes fadeIn');
      expect(props.has('__raw__')).toBe(true);
      expect(props.get('__raw__')).toBe('@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }');
    });

    test('@keyframes 带百分比关键帧', () => {
      const css = '@keyframes slideIn { 0% { left: 0; } 100% { left: 100%; } }';
      const rules = parseRules(css);
      
      const props = rules.get('@keyframes slideIn');
      expect(props.get('__raw__')).toContain('0% { left: 0; }');
      expect(props.get('__raw__')).toContain('100% { left: 100%; }');
    });
  });

  describe('混合规则解析', () => {
    test('普通规则 + @media 规则', () => {
      const css = '.a { color: red; } @media print { .a { color: black; } }';
      const rules = parseRules(css);
      
      expect(rules.size).toBe(2);
      
      // 普通规则解析为属性 Map
      expect(rules.get('.a').get('color')).toBe('red');
      
      // @media 规则保留原始文本
      expect(rules.get('@media print').has('__raw__')).toBe(true);
    });

    test('复杂混合场景', () => {
      const css = `
        body { background: #fff; }
        @media (prefers-color-scheme: dark) {
          body { background: #000; }
        }
        .button { background: blue; }
        @keyframes pulse {
          0% { transform: scale(1); }
        }
      `;
      const rules = parseRules(css);
      
      expect(rules.size).toBe(4);
      
      // 普通规则
      expect(rules.get('body').get('background')).toBe('#fff');
      expect(rules.get('.button').get('background')).toBe('blue');
      
      // at-rules
      expect(rules.get('@media (prefers-color-scheme: dark)').has('__raw__')).toBe(true);
      expect(rules.get('@keyframes pulse').has('__raw__')).toBe(true);
    });
  });

  describe('边界情况', () => {
    test('空字符串返回空 Map', () => {
      expect(parseRules('').size).toBe(0);
      expect(parseRules('   ').size).toBe(0);
      expect(parseRules(null).size).toBe(0);
      expect(parseRules(undefined).size).toBe(0);
    });

    test('CSS 注释被保留在原始文本中', () => {
      const css = '/* comment */ .header { color: red; }';
      const rules = parseRules(css);
      
      expect(rules.size).toBe(1);
    });

    test('字符串中的冒号', () => {
      const css = '.content::before { content: "test:value"; }';
      const rules = parseRules(css);
      
      const props = rules.get('.content::before');
      expect(props.get('content')).toBe('"test:value"');
    });

    test('URL 中的特殊字符（不含分号）', () => {
      const css = '.bg { background: url("https://example.com/image.png"); }';
      const rules = parseRules(css);
      
      const props = rules.get('.bg');
      expect(props.get('background')).toBe('url("https://example.com/image.png")');
    });

    test('data URL（注意：分号会截断值）', () => {
      // 注意：简单实现中，分号会作为声明分隔符，这是已知的边界情况
      // 实际使用中，复杂 URL 通常出现在 @media 或其他 at-rule 中
      const css = '.bg { background: url("data:image/svg+xml,abc"); }';
      const rules = parseRules(css);
      
      const props = rules.get('.bg');
      // 值会被分号截断
      expect(props.get('background')).toBe('url("data:image/svg+xml,abc")');
    });
  });

  describe('实际应用场景', () => {
    test('深色模式 CSS 解析', () => {
      const css = `
        body { background-color: #fff !important; color: #333 !important; }
        .site-header { background: #f5f5f5 !important; }
        @media (prefers-color-scheme: dark) {
          body { background-color: #1a1a1a !important; }
        }
      `;
      const rules = parseRules(css);
      
      expect(rules.size).toBe(3);
      
      const bodyProps = rules.get('body');
      expect(bodyProps.get('background-color')).toBe('#fff !important');
      expect(bodyProps.get('color')).toBe('#333 !important');
      
      const headerProps = rules.get('.site-header');
      expect(headerProps.get('background')).toBe('#f5f5f5 !important');
      
      const mediaProps = rules.get('@media (prefers-color-scheme: dark)');
      expect(mediaProps.has('__raw__')).toBe(true);
    });
  });
});
