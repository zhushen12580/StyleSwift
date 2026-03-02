/**
 * StyleSwift - Chrome Extension 消息协议
 *
 * 定义 Agent 后端与 Chrome 插件各部分之间的通信协议
 */

// =============================================================================
// 消息类型定义
// =============================================================================

/**
 * 消息类型枚举
 */
const MessageType = {
  // 用户交互
  USER_INPUT: 'USER_INPUT',

  // 页面结构
  GET_PAGE_STRUCTURE: 'GET_PAGE_STRUCTURE',
  PAGE_STRUCTURE_RESPONSE: 'PAGE_STRUCTURE_RESPONSE',

  // 元素选择
  PICK_ELEMENT: 'PICK_ELEMENT',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  CANCEL_PICK: 'CANCEL_PICK',

  // 样式操作
  APPLY_STYLES: 'APPLY_STYLES',
  STYLES_APPLIED: 'STYLES_APPLIED',
  ROLLBACK_STYLES: 'ROLLBACK_STYLES',

  // 偏好管理
  SAVE_PREFERENCE: 'SAVE_PREFERENCE',
  LOAD_PREFERENCES: 'LOAD_PREFERENCES',
  PREFERENCES_LOADED: 'PREFERENCES_LOADED',

  // 进度更新
  UPDATE_PROGRESS: 'UPDATE_PROGRESS',

  // Agent 状态
  AGENT_RESPONSE: 'AGENT_RESPONSE',
  AGENT_THINKING: 'AGENT_THINKING'
};


// =============================================================================
// 消息结构
// =============================================================================

/**
 * 基础消息结构
 * @typedef {Object} BaseMessage
 * @property {string} type - 消息类型
 * @property {string} [requestId] - 请求ID，用于匹配响应
 * @property {Object} [payload] - 消息负载
 * @property {number} [timestamp] - 时间戳
 */

/**
 * 用户输入消息
 * @typedef {Object} UserInputMessage
 * @property {string} type - 'USER_INPUT'
 * @property {Object} payload
 * @property {string} payload.text - 用户输入的文本
 * @property {string} [payload.selectedElement] - 预选中的元素选择器
 * @property {string} payload.url - 当前页面URL
 */

/**
 * 页面结构请求
 * @typedef {Object} GetPageStructureMessage
 * @property {string} type - 'GET_PAGE_STRUCTURE'
 * @property {string} requestId - 请求ID
 */

/**
 * 页面结构响应
 * @typedef {Object} PageStructureResponse
 * @property {string} type - 'PAGE_STRUCTURE_RESPONSE'
 * @property {string} requestId - 对应的请求ID
 * @property {Object} payload
 * @property {string} payload.url - 页面URL
 * @property {string} payload.title - 页面标题
 * @property {string} payload.type - 页面类型 (news/blog/ecommerce/...)
 * @property {Array<{selector: string, type: string, visibility: string}>} payload.semanticZones - 语义区域
 * @property {Array<{selector: string, tag: string, type: string}>} payload.keyElements - 关键元素
 * @property {Object} payload.themeHints - 当前主题提示
 */

/**
 * 元素选择请求
 * @typedef {Object} PickElementMessage
 * @property {string} type - 'PICK_ELEMENT'
 * @property {Object} payload
 * @property {string} payload.prompt - 提示文本
 */

/**
 * 元素选中响应
 * @typedef {Object} ElementSelectedMessage
 * @property {string} type - 'ELEMENT_SELECTED'
 * @property {Object} payload
 * @property {string} payload.selector - 元素选择器
 * @property {string} payload.tag - 元素标签
 * @property {string} payload.type - 元素类型
 * @property {Object} payload.currentStyles - 当前样式
 * @property {string} payload.parentContext - 父级上下文描述
 */

/**
 * 应用样式请求
 * @typedef {Object} ApplyStylesMessage
 * @property {string} type - 'APPLY_STYLES'
 * @property {Object} payload
 * @property {string} payload.css - CSS代码
 * @property {string} payload.mode - 应用模式 (preview/apply/rollback)
 * @property {string} [payload.description] - 样式描述
 */

/**
 * 进度更新消息
 * @typedef {Object} UpdateProgressMessage
 * @property {string} type - 'UPDATE_PROGRESS'
 * @property {Object} payload
 * @property {Array<{content: string, status: string, activeForm: string}>} payload.todos - 任务列表
 * @property {string} [payload.current] - 当前正在进行的任务
 */

/**
 * Agent 响应消息
 * @typedef {Object} AgentResponseMessage
 * @property {string} type - 'AGENT_RESPONSE'
 * @property {Object} payload
 * @property {string} payload.text - Agent 的回复文本
 * @property {boolean} [payload.needsConfirmation] - 是否需要用户确认
 * @property {string} [payload.previewId] - 预览ID
 */


// =============================================================================
// 页面结构提取器
// =============================================================================

/**
 * 页面结构分析器
 * 在 Content Script 中运行
 */
class PageStructureExtractor {

  /**
   * 提取页面结构
   * @returns {Object} 页面结构信息
   */
  extract() {
    return {
      url: window.location.href,
      title: document.title,
      type: this.detectPageType(),
      semanticZones: this.extractSemanticZones(),
      keyElements: this.extractKeyElements(),
      themeHints: this.extractThemeHints()
    };
  }

  /**
   * 检测页面类型
   */
  detectPageType() {
    // 基于 URL 和 DOM 结构判断页面类型
    const url = window.location.href;
    const host = window.location.hostname;

    // URL 模式匹配
    if (host.includes('news') || host.includes('article')) return 'news';
    if (host.includes('shop') || host.includes('store')) return 'ecommerce';
    if (host.includes('blog')) return 'blog';
    if (host.includes('github')) return 'developer';
    if (host.includes('youtube') || host.includes('video')) return 'video';

    // DOM 结构判断
    if (document.querySelector('article, .article, .post')) return 'article';
    if (document.querySelector('.product, .products, [itemtype*="Product"]')) return 'ecommerce';
    if (document.querySelector('.sidebar, aside')) return 'content-with-sidebar';

    return 'generic';
  }

  /**
   * 提取语义区域
   */
  extractSemanticZones() {
    const zones = [];
    const zoneSelectors = [
      { selector: 'header, .header, #header', type: 'header' },
      { selector: 'nav, .nav, .navigation, .navbar', type: 'navigation' },
      { selector: 'main, .main, #main, article', type: 'main-content' },
      { selector: 'aside, .sidebar, .side', type: 'sidebar' },
      { selector: 'footer, .footer, #footer', type: 'footer' },
      { selector: '.comments, #comments', type: 'comments' },
      { selector: '.related, .recommend', type: 'recommendations' }
    ];

    for (const { selector, type } of zoneSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        zones.push({
          selector: this.generateSelector(el),
          type: type,
          visibility: this.getVisibility(el)
        });
      });
    }

    return zones;
  }

  /**
   * 提取关键元素
   */
  extractKeyElements() {
    const elements = [];
    const importantSelectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'button, .btn, [role="button"]',
      'a[href]',
      'img[src]',
      'input, textarea, select',
      'table'
    ];

    for (const selector of importantSelectors) {
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        // 只保留可见元素
        if (!this.isVisible(el)) return;

        elements.push({
          selector: this.generateSelector(el),
          tag: el.tagName.toLowerCase(),
          type: this.getElementType(el),
          text: el.textContent?.trim().slice(0, 50)
        });
      });
    }

    // 限制数量，避免信息过多
    return elements.slice(0, 50);
  }

  /**
   * 提取主题提示
   */
  extractThemeHints() {
    const body = document.body;
    const computedStyle = window.getComputedStyle(body);

    return {
      bgColor: computedStyle.backgroundColor,
      textColor: computedStyle.color,
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      isDark: this.isDarkBackground(computedStyle.backgroundColor)
    };
  }

  /**
   * 生成元素选择器
   */
  generateSelector(element) {
    // 优先使用 ID
    if (element.id) {
      return `#${element.id}`;
    }

    // 尝试使用独特的 class 组合
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/);
      if (classes.length > 0) {
        const selector = '.' + classes.join('.');
        // 验证唯一性
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // 使用路径选择器
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/);
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }

      // 添加 nth-child
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        if (siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * 获取元素可见性评分
   */
  getVisibility(element) {
    const rect = element.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const elementArea = rect.width * rect.height;

    if (elementArea === 0) return 'hidden';

    const visibleRatio = elementArea / viewportArea;
    if (visibleRatio > 0.3) return 'high';
    if (visibleRatio > 0.1) return 'medium';
    return 'low';
  }

  /**
   * 检查元素是否可见
   */
  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  /**
   * 获取元素类型
   */
  getElementType(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    if (role) return role;

    const typeMap = {
      h1: 'heading', h2: 'heading', h3: 'heading',
      h4: 'heading', h5: 'heading', h6: 'heading',
      p: 'paragraph',
      button: 'button',
      a: 'link',
      img: 'image',
      input: 'input',
      textarea: 'input',
      table: 'table',
      nav: 'navigation',
      header: 'header',
      footer: 'footer',
      article: 'article',
      aside: 'sidebar'
    };

    return typeMap[tag] || 'element';
  }

  /**
   * 判断是否深色背景
   */
  isDarkBackground(color) {
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;

    const [r, g, b] = rgb.map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  }
}


// =============================================================================
// 样式注入器
// =============================================================================

/**
 * 样式注入器
 * 在 Content Script 中运行
 */
class StyleInjector {
  constructor() {
    this.styleElement = null;
    this.previewElement = null;
    this.appliedStyles = {};
  }

  /**
   * 应用样式
   * @param {string} css - CSS代码
   * @param {string} mode - 应用模式
   */
  apply(css, mode = 'preview') {
    if (mode === 'preview') {
      // 预览模式：创建临时样式元素
      this.removePreview();

      this.previewElement = document.createElement('style');
      this.previewElement.id = 'styleswift-preview';
      this.previewElement.textContent = this.wrapCSS(css);
      document.head.appendChild(this.previewElement);

      return { success: true, mode: 'preview' };
    }

    if (mode === 'apply') {
      // 正式应用：移除预览，创建持久样式
      this.removePreview();

      if (!this.styleElement) {
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'styleswift-styles';
        document.head.appendChild(this.styleElement);
      }

      // 追加样式而不是替换
      this.styleElement.textContent += '\n' + this.wrapCSS(css);
      this.appliedStyles[Date.now()] = css;

      return { success: true, mode: 'apply' };
    }

    if (mode === 'rollback') {
      this.removePreview();
      return { success: true, mode: 'rollback' };
    }

    return { success: false, error: 'Unknown mode' };
  }

  /**
   * 移除预览样式
   */
  removePreview() {
    if (this.previewElement) {
      this.previewElement.remove();
      this.previewElement = null;
    }
  }

  /**
   * 回滚所有样式
   */
  rollbackAll() {
    this.removePreview();
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    this.appliedStyles = {};
  }

  /**
   * 包装CSS，添加特异性前缀
   */
  wrapCSS(css) {
    // 添加 !important 到每个属性
    let processed = css.replace(/;(\s*})/g, ' !important$1');
    processed = processed.replace(/;(\s*[^\s}])/g, ' !important;$1');

    // 添加注释标记
    return `/* StyleSwift Generated Styles */\n${processed}`;
  }
}


// =============================================================================
// 元素选择器
// =============================================================================

/**
 * 元素选择器
 * 在 Content Script 中运行
 */
class ElementPicker {
  constructor() {
    this.active = false;
    this.highlightedElement = null;
    this.overlay = null;
  }

  /**
   * 开始选择模式
   * @param {string} prompt - 提示文本
   * @param {Function} onSelect - 选择回调
   */
  start(prompt, onSelect) {
    this.active = true;
    this.onSelect = onSelect;

    // 创建高亮覆盖层
    this.overlay = document.createElement('div');
    this.overlay.id = 'styleswift-picker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #4A90D9;
      background: rgba(74, 144, 217, 0.1);
      z-index: 2147483647;
      transition: all 0.1s ease;
    `;
    document.body.appendChild(this.overlay);

    // 显示提示
    this.showPrompt(prompt);

    // 绑定事件
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('mouseout', this.handleMouseOut);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 停止选择模式
   */
  stop() {
    this.active = false;

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.highlightedElement) {
      this.highlightedElement.style.outline = '';
    }

    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);

    this.hidePrompt();
  }

  handleMouseOver = (e) => {
    if (!this.active) return;
    e.stopPropagation();

    const target = e.target;
    if (target === this.overlay) return;

    this.highlightedElement = target;

    // 更新覆盖层位置
    const rect = target.getBoundingClientRect();
    this.overlay.style.left = rect.left + 'px';
    this.overlay.style.top = rect.top + 'px';
    this.overlay.style.width = rect.width + 'px';
    this.overlay.style.height = rect.height + 'px';
  };

  handleMouseOut = (e) => {
    if (!this.active) return;

    if (e.target === this.highlightedElement) {
      this.highlightedElement = null;
    }
  };

  handleClick = (e) => {
    if (!this.active) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (target === this.overlay) return;

    this.stop();

    // 返回选中元素的信息
    if (this.onSelect) {
      const extractor = new PageStructureExtractor();
      this.onSelect({
        selector: extractor.generateSelector(target),
        tag: target.tagName.toLowerCase(),
        type: extractor.getElementType(target),
        currentStyles: this.extractStyles(target),
        parentContext: this.getParentContext(target)
      });
    }
  };

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.stop();
      if (this.onSelect) {
        this.onSelect(null); // 取消选择
      }
    }
  };

  extractStyles(element) {
    const computed = window.getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      padding: computed.padding,
      margin: computed.margin,
      borderRadius: computed.borderRadius
    };
  }

  getParentContext(element) {
    const parent = element.parentElement;
    if (!parent) return '';

    const extractor = new PageStructureExtractor();
    const parentType = extractor.getElementType(parent);
    return `位于 ${parentType} 区域内`;
  }

  showPrompt(text) {
    const prompt = document.createElement('div');
    prompt.id = 'styleswift-picker-prompt';
    prompt.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    prompt.textContent = text + ' (按 ESC 取消)';
    document.body.appendChild(prompt);
  }

  hidePrompt() {
    const prompt = document.getElementById('styleswift-picker-prompt');
    if (prompt) prompt.remove();
  }
}


// =============================================================================
// 导出
// =============================================================================

// 用于 Node.js 环境 (Background script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MessageType,
    PageStructureExtractor,
    StyleInjector,
    ElementPicker
  };
}

// 用于浏览器环境 (Content script)
if (typeof window !== 'undefined') {
  window.StyleSwift = {
    MessageType,
    PageStructureExtractor,
    StyleInjector,
    ElementPicker
  };
}
