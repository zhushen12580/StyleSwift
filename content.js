// 添加一个全局变量来跟踪评分状态
let ratingSubmitted = false;

// 添加元素选择功能
let isSelecting = false;
let highlightElement = null;

// 创建一个高亮显示的元素，用于在鼠标悬停时突出显示页面元素
function createHighlightElement() {
    const el = document.createElement('div');
    // 设置高亮元素的样式
    el.style.cssText = `
        position: fixed;          /* 固定定位，不随页面滚动 */
        pointer-events: none;     /* 禁用鼠标事件，使其不影响下方元素的交互 */
        z-index: 10000;          /* 确保高亮显示在最上层 */
        border: 2px solid #007bff;  /* 蓝色边框 */
        background-color: rgba(0, 123, 255, 0.1);  /* 半透明的蓝色背景 */
        transition: all 0.2s ease;  /* 添加平滑过渡效果 */
    `;
    document.body.appendChild(el);  // 将高亮元素添加到页面
    return el;
}

// 开始元素选择模式
function startElementSelection() {
    isSelecting = true;  // 设置选择状态为开启
    highlightElement = createHighlightElement();  // 创建高亮元素
    
    // 添加鼠标移动和点击事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleElementClick);
    
    // 将鼠标样式改为十字准线，提示用户正在选择模式
    document.body.style.cursor = 'crosshair';
}

// 停止元素选择模式
function stopElementSelection() {
    isSelecting = false;  // 关闭选择状态
    // 如果存在高亮元素，则移除它
    if (highlightElement) {
        highlightElement.remove();
        highlightElement = null;
    }
    
    // 移除事件监听器
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleElementClick);
    
    // 恢复默认鼠标样式
    document.body.style.cursor = 'default';
}

// 处理鼠标移动事件
function handleMouseMove(e) {
    if (!isSelecting) return;  // 如果不在选择模式，直接返回
    
    const target = e.target;  // 获取鼠标当前悬停的元素
    // 获取目标元素的位置和尺寸信息
    const rect = target.getBoundingClientRect();
    
    // 更新高亮元素的位置和大小，使其完全覆盖目标元素
    highlightElement.style.top = `${rect.top}px`;
    highlightElement.style.left = `${rect.left}px`;
    highlightElement.style.width = `${rect.width}px`;
    highlightElement.style.height = `${rect.height}px`;
}

// 处理元素点击事件
function handleElementClick(e) {
    if (!isSelecting) return;  // 如果不在选择模式，直接返回
    
    // 阻止默认点击行为和事件冒泡
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;  // 获取被点击的元素
    // 收集元素的详细信息
    const elementInfo = {
        tagName: target.tagName.toLowerCase(),  // 标签名（小写）
        id: target.id,                         // 元素ID
        className: target.className,           // 类名
        computedStyle: window.getComputedStyle(target),  // 计算后的样式
        innerHTML: target.innerHTML,           // 内部HTML内容
        outerHTML: target.outerHTML           // 包含元素本身的HTML
    };
    
    // 在控制台输出收集到的元素信息
    console.log('Selected Element Info:', elementInfo);
    
    // 选择完成，停止选择模式
    stopElementSelection();
}

// 在文件开头添加上下文检查函数
function isExtensionContextValid() {
    try {
        // 尝试访问 chrome.runtime
        return chrome.runtime && chrome.runtime.id;
    } catch (e) {
        return false;
    }
}

// 监听来自扩展程序的消息
function initializeContentScript() {
    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;

    function tryInitialize() {
        if (!isExtensionContextValid()) {
            console.warn('Extension context is invalid during initialization, attempt:', retryCount + 1);
            
            if (retryCount < maxRetries) {
                retryCount++;
                // 延迟 500ms 后重试
                setTimeout(tryInitialize, 500);
                return;
            } else {
                console.error('Extension initialization failed after', maxRetries, 'attempts');
                return;
            }
        }

        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === "startElementSelection") {
                    try {
                        console.log('Starting element selection...');
                        startElementSelection();
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Error in startElementSelection:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                    return true; // 保持消息通道开放
                }
                // 添加错误处理
                try {
                    if (!isExtensionContextValid()) {
                        throw new Error('Extension context invalidated');
                    }

                    if (request.action === "ping") {
                        // 响应ping请求,返回状态ok
                        sendResponse({status: "ok"});
                    } else if (request.action === "applyStyle") {
                        // 应用新的样式
                        applyStyle(request.style, request.styleId);
                        sendResponse({success: true});
                    } else if (request.action === "getPageStructure") {
                        // 获取页面结构
                        const pageStructure = getPageStructure();
                        sendResponse({pageStructure: pageStructure, url: window.location.href});
                    } else if (request.action === "removeAllStyles") {
                        // 移除所有应用的样式
                        const success = removeAllAppliedStyles();
                        sendResponse({success: success});
                    }
                } catch (error) {
                    console.error('Content script error:', error);
                    sendResponse({ success: false, error: error.message });
                }
                return true; // 保持消息通道开放,以便异步响应
            });

            // 添加错误处理的监听器
            chrome.runtime.onMessageExternal?.addListener(() => {
                if (!isExtensionContextValid()) {
                    console.warn('Extension context invalidated');
                    return;
                }
            });

            // 监听扩展上下文失效
            chrome.runtime.onSuspend?.addListener(() => {
                console.warn('Extension is being suspended');
            });

            // 在初始化时检查并应用样式
            checkAndApplyStyle();

            // 确保样式优先级
            ensureStylePriority();

            // 添加一个 MutationObserver 来监听 DOM 变化
            const observer = new MutationObserver(() => {
                checkAndApplyStyle();
                ensureStylePriority();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            console.log('Content script initialized');

            // 重置评分状态
            ratingSubmitted = false;

            // 确保在初始化完成后再检查样式
            setTimeout(checkAndApplyStyle, 100);

        } catch (error) {
            console.error('Error in initializeContentScript:', error);
            
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryInitialize, 500);
            }
        }
    }

    tryInitialize();
}

// 应用样式
function applyStyle(style, styleId) {
    const newStyleElement = document.createElement('style');
    newStyleElement.id = 'beautifier-style';
    newStyleElement.textContent = style;
    newStyleElement.setAttribute('data-style-id', styleId);  // 添加 styleId 作为属性

    const oldStyleElement = document.getElementById('beautifier-style');
    if (oldStyleElement && oldStyleElement !== newStyleElement) {
        oldStyleElement.remove();
    }

    document.head.appendChild(newStyleElement);

    chrome.storage.local.set({
        [window.location.hostname]: {
            style_code: style,
            style_id: styleId
        }
    });

    chrome.storage.local.remove('defaultStyle');

    // 在应用新样式后，添加评分容器
    if (!document.getElementById('beautifier-rating')) {
        addRatingStars();
    }
}

// 移除所有应用的样式
function removeAllAppliedStyles() {
    try {
        // 只移除由扩展添加的样式元素
        const styleElement = document.getElementById('beautifier-style');
        if (styleElement) {
            styleElement.remove();
        }

        // 移除所有由扩展添加的类
        document.body.classList.remove('beautifier-applied');

        // 移除评分容器
        const ratingContainer = document.getElementById('beautifier-rating');
        if (ratingContainer) {
            ratingContainer.remove();
        }

        // 从 chrome.storage.local 中移除该网站的样式
        chrome.storage.local.remove(window.location.hostname, function() {
            if (chrome.runtime.lastError) {
                console.error('移除存储的样式时出错:', chrome.runtime.lastError);
                return;
            }
            console.log('所有应用的样式已被移除');
        });

        return true; // 表示成功移除样式
    } catch (error) {
        console.error('移除样式时出错:', error);
        return false; // 表示移除样式失败
    }
}

// 检查并应用样式
function checkAndApplyStyle() {
    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;

    function tryCheck() {
        if (!isExtensionContextValid()) {
            console.warn('Extension context is invalid, attempt:', retryCount + 1);
            
            if (retryCount < maxRetries) {
                retryCount++;
                // 延迟 500ms 后重试
                setTimeout(tryCheck, 500);
                return;
            } else {
                console.error('Extension context validation failed after', maxRetries, 'attempts');
                return;
            }
        }

        try {
            chrome.storage.local.get(['defaultStyle', window.location.hostname], function(data) {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    return;
                }
                
                if (data.defaultStyle) {
                    removeAllAppliedStyles();
                } else if (data[window.location.hostname]) {
                    const { style_code, style_id } = data[window.location.hostname];
                    applyStyle(style_code, style_id);
                }
            });
        } catch (error) {
            console.error('Error in checkAndApplyStyle:', error);
            
            // 如果是扩展上下文相关的错误，尝试重新初始化
            if (error.message.includes('Extension context invalid')) {
                initializeContentScript();
            }
        }
    }

    tryCheck();
}

// 获取页面结构和关键CSS
function getPageStructure() {
    // 截断文本,超过最大长度时添加省略号
    function truncateText(text, maxLength = 50) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength) + "...";
    }

    // 提取元素的关键CSS
    function getKeyCSS(element) {
        const computedStyle = window.getComputedStyle(element);
        const keyProperties = [
            'display', 'position', 'float', 'clear',
            'flex', 'flex-direction', 'justify-content', 'align-items',
            'grid', 'grid-template-columns', 'grid-template-rows',
            'width', 'height', 'max-width', 'max-height',
            'margin', 'padding', 'border',
            'background-color', 'color', 'font-size', 'font-weight'
        ];

        return keyProperties.reduce((css, prop) => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
                css[prop] = value;
            }
            return css;
        }, {});
    }

    // 提取页面的最小结构和关键CSS
    function extractMinimalStructureAndCSS(element, seenElements = new Set()) {
        // 处理文本节点
        if (element.nodeType === Node.TEXT_NODE) {
            return element.textContent.trim();
        }

        // 忽略非元素节点
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }

        // 创建元素的唯一标识
        const elementStructure = [element.tagName, ...Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`)].join('');
        
        // 跳过重复元素
        if (seenElements.has(elementStructure)) {
            return "";  // Skip duplicate elements
        }
        seenElements.add(elementStructure);

        // 提取重要属性
        const importantAttrs = ['id', 'class', 'style', 'title'];
        const attributes = Array.from(element.attributes)
            .filter(attr => importantAttrs.includes(attr.name))
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(' ');

        // 提取关键CSS
        const keyCSS = getKeyCSS(element);
        const cssString = Object.entries(keyCSS)
            .map(([prop, value]) => `${prop}:${value}`)
            .join(';');

        // 提取元素信息
        const elementInfo = getElementInfo(element);

        // 构建开始标签，包含关键CSS和元素信息
        const openingTag = `<${element.tagName.toLowerCase()} ${attributes} style="${cssString}" data-info='${JSON.stringify(elementInfo)}'>`;
        
        // 处理子节点
        const content = Array.from(element.childNodes)
            .map(child => {
                // 跳过注释节点
                if (child.nodeType === Node.COMMENT_NODE) {
                    return "";  // Skip comments
                }
                // 递归处理重要的子元素
                if (child.nodeType === Node.ELEMENT_NODE && ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                                                         'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img', 
                                                         'form', 'input', 'button', 'section', 'article', 'nav', 
                                                         'header', 'footer', 'aside', 'main', 'center', 'blockquote'].includes(child.tagName.toLowerCase())) {
                    return extractMinimalStructureAndCSS(child, seenElements);
                }
                // 处理文本节点
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    return truncateText(child.textContent.trim());
                }
                return "";
            })
            .join('');

        // 构建结束标签
        const closingTag = `</${element.tagName.toLowerCase()}>`;
        return `${openingTag}${content}${closingTag}`;
    }

    // 移除包含 shadow root 的 div 元素
    function removeShadowRootDivs() {
        const allDivs = document.querySelectorAll('div');

        allDivs.forEach(div => {
            if (div.shadowRoot) {
                div.parentNode.removeChild(div);
            }
        });
    }

    // 先移除包含 shadow root 的 div 元素
    removeShadowRootDivs();

    // 获取视口尺寸
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };

    // 取body元素并提取结构和关键CSS
    const body = document.body;
    const pageStructure = body ? extractMinimalStructureAndCSS(body) : "No body found in the HTML";

    return {
        viewport: viewport,
        structure: pageStructure
    };
}

// 在页面加载时检查是否有缓存的样式
chrome.storage.local.get(window.location.hostname, function(data) {
    if (data[window.location.hostname]) {
        const { style_code, style_id } = data[window.location.hostname];
        if (style_code) {
            applyStyle(style_code, style_id);
        }
    }
});

// 添加评分星星
function addRatingStars() {
    const styleElement = document.getElementById('beautifier-style');
    const styleId = styleElement ? styleElement.getAttribute('data-style-id') : null;

    // 检查这个样式是否已经被评分过
    chrome.storage.local.get(['ratedStyles'], function(result) {
        const ratedStyles = result.ratedStyles || {};
        if (styleId && ratedStyles[styleId]) {
            // 如果这个样式已经被评分过，不添加评分容器
            return;
        }

        // 如果评分容器已存在，不再添加
        if (document.getElementById('beautifier-rating')) {
            return;
        }

        // 创建评分容器
        const ratingContainer = document.createElement('div');
        ratingContainer.id = 'beautifier-rating';

        // 创建 Shadow DOM
        const shadow = ratingContainer.attachShadow({mode: 'closed'});

        // 添加样式到 Shadow DOM
        const style = document.createElement('style');
        style.textContent = getRatingStyles();
        shadow.appendChild(style);

        // 添加内容到 Shadow DOM
        const content = document.createElement('div');
        content.innerHTML = `
            <ul class="feedback">
                <li class="angry" data-rating="1">
                    <div>
                        <svg class="eye left"><use xlink:href="#eye"></use></svg>
                        <svg class="eye right"><use xlink:href="#eye"></use></svg>
                        <svg class="mouth"><use xlink:href="#mouth"></use></svg>
                    </div>
                </li>
                <li class="sad" data-rating="2">
                    <div>
                        <svg class="eye left"><use xlink:href="#eye"></use></svg>
                        <svg class="eye right"><use xlink:href="#eye"></use></svg>
                        <svg class="mouth"><use xlink:href="#mouth"></use></svg>
                    </div>
                </li>
                <li class="ok" data-rating="3">
                    <div></div>
                </li>
                <li class="good" data-rating="4">
                    <div>
                        <svg class="eye left"><use xlink:href="#eye"></use></svg>
                        <svg class="eye right"><use xlink:href="#eye"></use></svg>
                        <svg class="mouth"><use xlink:href="#mouth"></use></svg>
                    </div>
                </li>
                <li class="happy" data-rating="5">
                    <div>
                        <svg class="eye left"><use xlink:href="#eye"></use></svg>
                        <svg class="eye right"><use xlink:href="#eye"></use></svg>
                    </div>
                </li>
            </ul>
            <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
                <symbol xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 4" id="eye">
                    <path d="M1,1 C1.83333333,2.16666667 2.66666667,2.75 3.5,2.75 C4.33333333,2.75 5.16666667,2.16666667 6,1"></path>
                </symbol>
                <symbol xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 7" id="mouth">
                    <path d="M1,5.5 C3.66666667,2.5 6.33333333,1 9,1 C11.6666667,1 14.3333333,2.5 17,5.5"></path>
                </symbol>
            </svg>
        `;
        shadow.appendChild(content);

        // 将评分容器添加到页面
        document.body.appendChild(ratingContainer);

        // 为每个表情添加点击事件
        const feedbackItems = shadow.querySelectorAll('.feedback li');
        feedbackItems.forEach(item => {
            item.addEventListener('click', function() {
                const rating = this.dataset.rating;
                submitRating(styleId, rating);
                feedbackItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');
            });
        });
    });
}

// 添加一个新函数来移除评分容器
function removeRatingContainer() {
    const ratingContainer = document.getElementById('beautifier-rating');
    if (ratingContainer) {
        ratingContainer.remove();
    }
    // 移除相关的样式
    const ratingStyle = document.getElementById('beautifier-rating-style');
    if (ratingStyle) {
        ratingStyle.remove();
    }
}

// 改提交评分函数
function submitRating(styleId, rating) {
    // 发送评分到后台
    chrome.runtime.sendMessage({
        action: "submitRating",
        rating: rating,
        styleId: styleId
    }, function(response) {
        if (response.success) {
            // 评分成功
            showFeedback('感谢您的评分！', 'success');
            // 记录这个样式已被评分
            chrome.storage.local.get(['ratedStyles'], function(result) {
                const ratedStyles = result.ratedStyles || {};
                ratedStyles[styleId] = true;
                chrome.storage.local.set({ratedStyles: ratedStyles}, function() {
                    console.log('样式评分状态已更新');
                });
            });
            // 在一段时间后移除评分容器
            setTimeout(removeRatingContainer, 3000);
        } else {
            // 评分失败
            showFeedback('评分提交失败，请稍后再试。', 'error');
        }
    });
}

// 新增函数：显示反馈信息
function showFeedback(message, type) {
    const feedbackElement = document.createElement('div');
    feedbackElement.textContent = message;
    feedbackElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: white;
        z-index: 10000;
        transition: opacity 0.3s ease-in-out;
    `;

    if (type === 'success') {
        feedbackElement.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        feedbackElement.style.backgroundColor = '#F44336';
    }

    document.body.appendChild(feedbackElement);

    // 3秒后淡出并移除反馈元素
    setTimeout(() => {
        feedbackElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(feedbackElement);
        }, 300);
    }, 3000);
}

// 确保样式优先级
function ensureStylePriority() {
    const styleElement = document.getElementById('beautifier-style');
    if (styleElement) {
        // 将样式元素移动到 <head> 的最后,确保它有最高优先级
        document.head.appendChild(styleElement);
    }
}

function getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    return {
        tag: element.tagName,
        id: element.id,
        class: element.className,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
    };
}

// 确保在页面加载完成后初始化
if (document.readyState === 'loading') {
    // 如果页面还在加载,等待DOMContentLoaded事件
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    // 如果页面已经加载完成,直接初始化
    initializeContentScript();
}

function getRatingStyles() {
    return `
        :host {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            background-color: rgb(255 255 255 / 20%) !important;
            color: #333 !important;
            padding: 10px !important;
            border-radius: 5px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            z-index: 9999 !important;
        }
        .feedback {
            --normal: #ECEAF3;
            --normal-shadow: #D9D8E3;
            --normal-mouth: #9795A4;
            --normal-eye: #595861;
            --active: #F8DA69;
            --active-shadow: #F4B555;
            --active-mouth: #F05136;
            --active-eye: #313036;
            --active-tear: #76b5e7;
            --active-shadow-angry: #e94f1d;
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
        }
        .feedback li {
            position: relative;
            border-radius: 50%;
            background: var(--sb, var(--normal));
            box-shadow: inset 3px -3px 4px var(--sh, var(--normal-shadow));
            transition: background .4s, box-shadow .4s, transform .3s;
            -webkit-tap-highlight-color: transparent;
        }
        .feedback li:not(:last-child) {
            margin-right: 20px;
        }
        .feedback li div {
            width: 40px;
            height: 40px;
            position: relative;
            transform: perspective(240px) translateZ(4px);
        }
        .feedback li div svg,
        .feedback li div:before,
        .feedback li div:after {
            display: block;
            position: absolute;
            left: var(--l, 9px);
            top: var(--t, 13px);
            width: var(--w, 8px);
            height: var(--h, 2px);
            transform: rotate(var(--r, 0deg)) scale(var(--sc, 1)) translateZ(0);
        }
        .feedback li div svg {
            fill: none;
            stroke: var(--s);
            stroke-width: 2px;
            stroke-linecap: round;
            stroke-linejoin: round;
            transition: stroke .4s;
        }
        .feedback li div svg.eye {
            --s: var(--e, var(--normal-eye));
            --t: 17px;
            --w: 7px;
            --h: 4px;
        }
        .feedback li div svg.eye.right {
            --l: 23px;
        }
        .feedback li div svg.mouth {
            --s: var(--m, var(--normal-mouth));
            --l: 11px;
            --t: 23px;
            --w: 18px;
            --h: 7px;
        }
        .feedback li div:before,
        .feedback li div:after {
            content: '';
            z-index: var(--zi, 1);
            border-radius: var(--br, 1px);
            background: var(--b, var(--e, var(--normal-eye)));
            transition: background .4s;
        }
        .feedback li.angry {
            --step-1-rx: -24deg;
            --step-1-ry: 20deg;
            --step-2-rx: -24deg;
            --step-2-ry: -20deg;
        }
        .feedback li.angry div:before {
            --r: 20deg;
        }
        .feedback li.angry div:after {
            --l: 23px;
            --r: -20deg;
        }
        .feedback li.angry div svg.eye {
            stroke-dasharray: 4.55;
            stroke-dashoffset: 8.15;
        }
        .feedback li.angry.active {
            animation: angry 1s linear;
        }
        .feedback li.angry.active div:before {
            --middle-y: -2px;
            --middle-r: 22deg;
            animation: toggle .8s linear forwards;
        }
        .feedback li.angry.active div:after {
            --middle-y: 1px;
            --middle-r: -18deg;
            animation: toggle .8s linear forwards;
        }
        .feedback li.sad {
            --step-1-rx: 20deg;
            --step-1-ry: -12deg;
            --step-2-rx: -18deg;
            --step-2-ry: 14deg;
        }
        .feedback li.sad div:before,
        .feedback li.sad div:after {
            --b: var(--active-tear);
            --sc: 0;
            --w: 5px;
            --h: 5px;
            --t: 15px;
            --br: 50%;
        }
        .feedback li.sad div:after {
            --l: 25px;
        }
        .feedback li.sad div svg.eye {
            --t: 16px;
        }
        .feedback li.sad div svg.mouth {
            --t: 24px;
            stroke-dasharray: 9.5;
            stroke-dashoffset: 33.25;
        }
        .feedback li.sad.active div:before,
        .feedback li.sad.active div:after {
            animation: tear .6s linear forwards;
        }
        .feedback li.ok {
            --step-1-rx: 4deg;
            --step-1-ry: -22deg;
            --step-1-rz: 6deg;
            --step-2-rx: 4deg;
            --step-2-ry: 22deg;
            --step-2-rz: -6deg;
        }
        .feedback li.ok div:before {
            --l: 12px;
            --t: 17px;
            --h: 4px;
            --w: 4px;
            --br: 50%;
            box-shadow: 12px 0 0 var(--e, var(--normal-eye));
        }
        .feedback li.ok div:after {
            --l: 13px;
            --t: 26px;
            --w: 14px;
            --h: 2px;
            --br: 1px;
            --b: var(--m, var(--normal-mouth));
        }
        .feedback li.ok.active div:before {
            --middle-s-y: .35;
            animation: toggle .2s linear forwards;
        }
        .feedback li.ok.active div:after {
            --middle-s-x: .5;
            animation: toggle .7s linear forwards;
        }
        .feedback li.good {
            --step-1-rx: -14deg;
            --step-1-rz: 10deg;
            --step-2-rx: 10deg;
            --step-2-rz: -8deg;
        }
        .feedback li.good div:before {
            --b: var(--m, var(--normal-mouth));
            --w: 5px;
            --h: 5px;
            --br: 50%;
            --t: 22px;
            --zi: 0;
            opacity: .5;
            box-shadow: 16px 0 0 var(--b);
            filter: blur(2px);
        }
        .feedback li.good div:after {
            --sc: 0;
        }
        .feedback li.good div svg.eye {
            --t: 15px;
            --sc: -1;
            stroke-dasharray: 4.55;
            stroke-dashoffset: 8.15;
        }
        .feedback li.good div svg.mouth {
            --t: 22px;
            --sc: -1;
            stroke-dasharray: 13.3;
            stroke-dashoffset: 23.75;
        }
        .feedback li.good.active div svg.mouth {
            --middle-y: 1px;
            --middle-s: -1;
            animation: toggle .8s linear forwards;
        }
        .feedback li.happy div {
            --step-1-rx: 18deg;
            --step-1-ry: 24deg;
            --step-2-rx: 18deg;
            --step-2-ry: -24deg;
        }
        .feedback li.happy div:before {
            --sc: 0;
        }
        .feedback li.happy div:after {
            --b: var(--m, var(--normal-mouth));
            --l: 11px;
            --t: 23px;
            --w: 18px;
            --h: 8px;
            --br: 0 0 8px 8px;
        }
        .feedback li.happy div svg.eye {
            --t: 14px;
            --sc: -1;
        }
        .feedback li.happy.active div:after {
            --middle-s-x: .95;
            --middle-s-y: .75;
            animation: toggle .8s linear forwards;
        }
        .feedback li:not(.active) {
            cursor: pointer;
        }
        .feedback li:not(.active):active {
            transform: scale(.925);
        }
        .feedback li.active {
            --sb: var(--active);
            --sh: var(--active-shadow);
            --m: var(--active-mouth);
            --e: var(--active-eye);
        }
        .feedback li.active div {
            animation: shake .8s linear forwards;
        }
        @keyframes shake {
            30% {
                transform: perspective(240px) rotateX(var(--step-1-rx, 0deg)) rotateY(var(--step-1-ry, 0deg)) rotateZ(var(--step-1-rz, 0deg)) translateZ(10px);
            }
            60% {
                transform: perspective(240px) rotateX(var(--step-2-rx, 0deg)) rotateY(var(--step-2-ry, 0deg)) rotateZ(var(--step-2-rz, 0deg)) translateZ(10px);
            }
            100% {
                transform: perspective(240px) translateZ(4px);
            }
        }
        @keyframes tear {
            0% {
                opacity: 0;
                transform: translateY(-2px) scale(0) translateZ(0);
            }
            50% {
                transform: translateY(12px) scale(.6, 1.2) translateZ(0);
            }
            20%, 80% {
                opacity: 1;
            }
            100% {
                opacity: 0;
                transform: translateY(24px) translateX(4px) rotateZ(-30deg) scale(.7, 1.1) translateZ(0);
            }
        }
        @keyframes toggle {
            50% {
                transform: translateY(var(--middle-y, 0)) scale(var(--middle-s-x, var(--middle-s, 1)), var(--middle-s-y, var(--middle-s, 1))) rotate(var(--middle-r, 0deg));
            }
        }
        @keyframes angry {
            40% {
                background: var(--active);
            }
            45% {
                box-shadow: inset 3px -3px 4px var(--active-shadow), inset 0 8px 10px var(--active-shadow-angry);
            }
        }
    `;
}

