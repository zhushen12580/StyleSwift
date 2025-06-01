// 北京时间工具函数
function getBeijingTime() {
    const now = new Date();
    // 获取北京时间（UTC+8）
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return beijingTime;
}

function formatBeijingTime(date = null) {
    if (!date) date = getBeijingTime();
    return date.toISOString().replace('T', ' ').substring(0, 23) + ' CST';
}

function calculateDuration(startTime, endTime = null) {
    if (!endTime) endTime = new Date();
    return (endTime - startTime) / 1000; // 返回秒
}

let windowId = null;
// 添加点击扩展图标时的事件监听器
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

// 监听来自其他部分的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handleAsyncOperation = async () => {
        try {
            switch (request.action) {
                case "generateAndApplyElementStyle":
                    // 细节模式: 生成并应用元素样式
                    await handleGenerateAndApplyElementStyle(request, sendResponse);
                    break;
                case "generateAndApplyStyle":
                    // 站点模式: 生成并应用整站样式
                    await handleGenerateAndApplyStyle(request, sendResponse);
                    break;
                case "submitRating":
                    // 评分处理(两种模式通用)
                    await handleSubmitRating(request, sendResponse);
                    break;
                case "adjustPopupHeight":
                    // 弹窗高度调整(两种模式通用)
                    handleAdjustPopupHeight(request);
                    break;
                default:
                    sendResponse({ success: false, error: "Unknown action" });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    handleAsyncOperation().catch(error => {
        console.error('Async operation failed:', error);
        sendResponse({ success: false, error: error.message });
    });

    return true;
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
    const requestStartTime = getBeijingTime();
    console.log('=== Background: 收到站点模式样式生成请求 ===');
    console.log('请求时间:', formatBeijingTime(requestStartTime));
    console.log('请求数据:', {
        styleId: request.styleId,
        style: request.style,
        url: request.url,
        hasPageStructure: !!request.pageStructure,
        pageStructureLength: request.pageStructure ? request.pageStructure.length : 0,
        customDescription: request.customDescription
    });
    
    try {
        console.log('开始调用后端API...');
        const apiCallStart = getBeijingTime();
        
        const response = await fetch('http://127.0.0.1:5000/api/generate_ai_style', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        const apiCallEnd = getBeijingTime();
        const apiDuration = calculateDuration(apiCallStart, apiCallEnd);
        console.log(`后端API调用完成 - 耗时: ${apiDuration.toFixed(3)}秒`);
        
        const data = await response.json();
        console.log('API返回的样式数据:', {
            hasStyleCode: !!data.style_code,
            styleCodeLength: data.style_code ? data.style_code.length : 0,
            styleId: data.style_id,
            message: data.message
        });

        if (data.style_code) {
            console.log('开始寻找目标标签页...');
            // 获取当前活动的标签页
            const tabs = await chrome.tabs.query({});
            console.log('查询到标签页总数:', tabs.length);
            
            // 过滤出不是扩展页面的标签页
            const normalTabs = tabs.filter(tab => 
                !tab.url.startsWith('chrome-extension://') && 
                !tab.url.startsWith('chrome://')
            );
            console.log('过滤后的普通标签页数:', normalTabs.length);

            // 找到最后激活的普通标签页
            const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

            if (!targetTab) {
                throw new Error('没有找到可应用样式的标签页');
            }

            console.log('目标标签页:', {
                id: targetTab.id,
                url: targetTab.url,
                title: targetTab.title
            });

            // 确保内容脚本已注入
            console.log('检查并注入内容脚本...');
            const isInjected = await ensureContentScriptInjected(targetTab.id);
            if (!isInjected) {
                throw new Error('无法注入内容脚本');
            }
            console.log('内容脚本注入成功');

            // 保存样式到存储
            console.log('保存样式到本地存储...');
            const storageKey = new URL(request.url).hostname;
            await chrome.storage.local.set({
                [storageKey]: {
                    style_code: data.style_code,
                    style_id: request.styleId,
                    mode: 'site'
                }
            });
            console.log('样式已保存到存储, Key:', storageKey);

            // 应用样式到页面
            console.log('开始将样式发送到内容脚本...');
            const messageStart = getBeijingTime();
            await chrome.tabs.sendMessage(targetTab.id, {
                action: "applyStyle",
                style: data.style_code,
                styleId: request.styleId
            });
            const messageEnd = getBeijingTime();
            const messageDuration = calculateDuration(messageStart, messageEnd);
            console.log(`样式已发送到内容脚本 - 耗时: ${messageDuration.toFixed(3)}秒`);

            // 移除默认样式标志
            await chrome.storage.local.remove('defaultStyle');
            console.log('已移除默认样式标志');

            const requestEndTime = getBeijingTime();
            const totalDuration = calculateDuration(requestStartTime, requestEndTime);
            console.log('=== Background: 站点模式样式生成和应用完成 ===');
            console.log(`总耗时: ${totalDuration.toFixed(3)}秒`);

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

// 处理元素样式生成和应用
async function handleGenerateAndApplyElementStyle(request, sendResponse) {
    try {
        const tabs = await chrome.tabs.query({});
        const normalTabs = tabs.filter(tab => 
            !tab.url.startsWith('chrome-extension://') && 
            !tab.url.startsWith('chrome://')
        );
        const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

        if (!targetTab) {
            throw new Error('没有找到可应用样式的标签页');
        }

        // 获取本地存储中的样式信息
        const hostname = new URL(targetTab.url).hostname;
        const storageData = await chrome.storage.local.get(hostname);
        const existingStyle = storageData[hostname];

        // 使用传入的 styleId
        if (!request.styleId) {
            throw new Error('No style_id provided');
        }

        // 调用API生成样式
        const response = await fetch('http://127.0.0.1:5000/api/generate_element_style', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                elementDetails: request.elementDetails,
                description: request.description,
                url: targetTab.url,
                existingStyle: existingStyle,
                styleId: request.styleId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            // 应用生成的样式
            const applyResult = await chrome.tabs.sendMessage(targetTab.id, {
                action: "applyElementStyle",
                style: result.style,
                elementPath: request.elementDetails.elementInfo.path,
                styleId: result.styleId
            });

            if (!applyResult || !applyResult.success) {
                throw new Error('样式应用失败: ' + (applyResult?.error || '未知错误'));
            }

            sendResponse({ success: true });
        } else {
            throw new Error(result.error || '生成样式失败');
        }
    } catch (error) {
        console.error('Generate and apply element style error:', error);
        sendResponse({ success: false, error: error.message });
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

// 修改处理高度调整的函数
function handleAdjustPopupHeight(request) {
    if (windowId !== null) {
        try {
            chrome.windows.update(windowId, {
                height: request.height + 60
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('调整窗口高度失败:', chrome.runtime.lastError);
                }
            });
        } catch (error) {
            console.error('处理高度调整时出错:', error);
        }
    }
}

// 添加错误恢复处理
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension is being suspended');
});

// 添加安装或更新时的监听器
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});