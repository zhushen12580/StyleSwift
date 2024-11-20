let windowId = null;

chrome.action.onClicked.addListener(async () => {
    // 如果窗口已经打开，就关闭它
    if (windowId !== null) {
        chrome.windows.remove(windowId);
        windowId = null;
        return;
    }

    try {
        // 获取屏幕信息
        const screen = await chrome.system.display.getInfo();
        const primaryDisplay = screen[0];
        
        // 设置窗口的宽度和高度
        const windowWidth = 400;
        const windowHeight = 600;
        
        // 计算右中部位置
        const left = primaryDisplay.workArea.width - windowWidth - 20;
        const top = (primaryDisplay.workArea.height - windowHeight) / 2;

        // 创建新窗口，设置位置在右中部
        const popup = await chrome.windows.create({
            url: 'popup.html',
            type: 'popup',
            width: windowWidth,
            height: windowHeight,
            left: left,
            top: top,
            focused: true
        });
        
        windowId = popup.id;
    } catch (error) {
        console.error('创建窗口时出错:', error);
        const popup = await chrome.windows.create({
            url: 'popup.html',
            type: 'popup',
            width: 400,
            height: 600,
            focused: true
        });
        
        windowId = popup.id;
    }
});

// 监听窗口关闭事件
chrome.windows.onRemoved.addListener((closedWindowId) => {
    if (closedWindowId === windowId) {
        windowId = null;
    }
});

// 确保内容脚本已注入并准备就绪
async function ensureContentScriptInjected(tabId) {
    try {
        console.log('检查内容脚本是否已注入到标签页:', tabId);
        
        // 尝试发送ping消息来检查内容脚本是否已注入
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        console.log('内容脚本已存在');
        return true;
    } catch (error) {
        console.log('内容脚本未注入，尝试注入...');
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            // 等待内容脚本初始化
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 再次验证内容脚本是否成功注入
            try {
                await chrome.tabs.sendMessage(tabId, { action: "ping" });
                console.log('内容脚本注入成功');
                return true;
            } catch (verifyError) {
                console.error('内容脚本注入后验证失败:', verifyError);
                return false;
            }
        } catch (injectionError) {
            console.error('注入内容脚本失败:', injectionError);
            return false;
        }
    }
}

// 监听来自其他部分的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "applyStyle") {
        handleApplyStyle(request, sendResponse);
        return true;
    } else if (request.action === "generateAndApplyStyle") {
        handleGenerateAndApplyStyle(request, sendResponse);
        return true;
    } else if (request.action === "submitRating") {
        handleSubmitRating(request, sendResponse);
        return true;
    } else if (request.action === "adjustPopupHeight") {
        handleAdjustPopupHeight(request);
        return false;
    } else if (request.action === "generateElementStyle") {
        handleGenerateElementStyle(request.data, sendResponse);
        return true;
    }
});

// 处理应用样式的请求
async function handleApplyStyle(request, sendResponse) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        if (!activeTab) {
            throw new Error('没有找到活动标签页');
        }

        // 确保内容脚本已注入
        const isInjected = await ensureContentScriptInjected(activeTab.id);
        if (!isInjected) {
            throw new Error('无法注入内容脚本');
        }

        const response = await fetch('http://127.0.0.1:5000/api/apply_style', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style_id: request.style })
        });

        const data = await response.json();
        if (data.style_code) {
            await chrome.tabs.sendMessage(activeTab.id, {
                action: "applyStyle",
                style: data.style_code,
                styleId: request.styleId
            });
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('应用样式时出错:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 处理生成并应用样式的请求
async function handleGenerateAndApplyStyle(request, sendResponse) {
    try {
        console.log('开始生成样式，请求数据:', request);

        const response = await fetch('http://127.0.0.1:5000/api/generate_ai_style', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        const data = await response.json();
        console.log('API返回的样式数据:', data);

        if (data.style_code) {
            // 获取当前活动的标签页
            const tabs = await chrome.tabs.query({});
            
            // 过滤出不是扩展页面的标签页
            const normalTabs = tabs.filter(tab => 
                !tab.url.startsWith('chrome-extension://') && 
                !tab.url.startsWith('chrome://')
            );

            // 找到最后激活的普通标签页
            const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

            if (!targetTab) {
                throw new Error('没有找到可应用样式的标签页');
            }

            console.log('目标标签页:', targetTab);

            // 确保内容脚本已注入
            const isInjected = await ensureContentScriptInjected(targetTab.id);
            if (!isInjected) {
                throw new Error('无法注入内容脚本');
            }

            // 保存样式到存储
            await chrome.storage.local.set({
                [request.url]: {
                    style_code: data.style_code,
                    style_id: request.styleId
                }
            });
            console.log('样式已保存到存储');

            // 应用样式到页面
            await chrome.tabs.sendMessage(targetTab.id, {
                action: "applyStyle",
                style: data.style_code,
                styleId: request.styleId
            });
            console.log('样式已发送到内容脚本');

            // 移除默认样式标志
            await chrome.storage.local.remove('defaultStyle');

            sendResponse({ success: true });
        } else {
            throw new Error('API返回的数据中没有样式代码');
        }
    } catch (error) {
        console.error('生成并应用样式时出错:', error);
        // 尝试重新注入内容脚本并重试
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];
            
            if (activeTab && !activeTab.url.startsWith('chrome-extension://')) {
                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js']
                });
                
                // 等待内容脚本初始化
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 重试发送消息
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: "applyStyle",
                    style: data.style_code,
                    styleId: request.styleId
                });
                
                sendResponse({ success: true });
                return;
            }
        } catch (retryError) {
            console.error('重试失败:', retryError);
        }
        
        sendResponse({ 
            success: false, 
            error: error.message,
            details: {
                originalError: error,
                stack: error.stack
            }
        });
    }
}

// 处理提交评分的请求
async function handleSubmitRating(request, sendResponse) {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/submit_rating', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style_id: request.styleId,
                rating: request.rating
            })
        });

        if (!response.ok) {
            throw new Error('评分提交失败');
        }

        const data = await response.json();
        sendResponse({ success: true, data: data });
    } catch (error) {
        console.error('提交评分时出错:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 处理调整弹出窗口高度的请求
function handleAdjustPopupHeight(request) {
    if (windowId !== null) {
        chrome.windows.update(windowId, {
            height: request.height + 60
        });
    }
}

// 添加错误恢复处理
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension is being suspended');
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});

// 修改消息处理函数
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 包装异步操作处理
    const handleAsyncOperation = async () => {
        try {
            if (request.action === "applyStyle") {
                await handleApplyStyle(request, sendResponse);
            } else if (request.action === "generateAndApplyStyle") {
                await handleGenerateAndApplyStyle(request, sendResponse);
            } else if (request.action === "submitRating") {
                await handleSubmitRating(request, sendResponse);
            } else if (request.action === "adjustPopupHeight") {
                handleAdjustPopupHeight(request);
            } else if (request.action === "generateElementStyle") {
                await handleGenerateElementStyle(request.data, sendResponse);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    // 启动异步操作
    handleAsyncOperation().catch(error => {
        console.error('Async operation failed:', error);
        sendResponse({ success: false, error: error.message });
    });

    return true; // 保持消息通道开放
});

// 添加处理元素样式生成的函数
async function handleGenerateElementStyle(data, sendResponse) {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/generate_element_style', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            sendResponse({
                success: true,
                style: result.style
            });
        } else {
            throw new Error(result.error || '生成样式失败');
        }
    } catch (error) {
        console.error('Generate element style error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}
