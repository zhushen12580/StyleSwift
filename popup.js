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

// 添加DOMContentLoaded事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 获取页面上的各个元素
    const styleSelector = document.getElementById('styleSelector');
    const applyButton = document.getElementById('applyStyle');
    const previewImage = document.getElementById('previewImage');
    const customStyleInput = document.getElementById('customStyleInput');
    const customStyleDescription = document.getElementById('customStyleDescription');
    const customCSSInput = document.getElementById('customCSSInput');
    const customCSS = document.getElementById('customCSS');
    const selectElementBtn = document.getElementById('selectElement');

    // 定义不同样式对应的预览图片
    const styleImages = {
        default: "./images/default_style.jpg",
        modern: "./images/default_style.jpg",
        retro: "./images/default_style.jpg",
        eyecare: "./images/default_style.jpg",
        cute: "./images/default_style.jpg",
        custom: "./images/default_style.jpg"
    };

    // 当样式选择器的值改变时
    styleSelector.addEventListener('change', function() {
        const selectedStyle = this.value;
        // 根据选择的样式显示或隐藏相应的输入框,并更新预览图片
        if (selectedStyle === 'custom') {
            customStyleInput.style.display = 'block';
            customCSSInput.style.display = 'none';
            previewImage.src = styleImages.custom;
        } else if (selectedStyle === 'custom-css') {
            customStyleInput.style.display = 'none';
            customCSSInput.style.display = 'block';
            previewImage.src = styleImages.custom;
        } else {
            customStyleInput.style.display = 'none';
            customCSSInput.style.display = 'none';
            previewImage.src = styleImages[selectedStyle];
        }
    });

    // 当点击"一键美化"按钮时
    applyButton.addEventListener('click', function() {
        const selectedStyle = styleSelector.value;
        const customDescription = customStyleDescription.value;
        
        console.log('=== 用户发起站点模式样式请求 ===');
        console.log('操作时间:', formatBeijingTime());
        console.log('选择的样式:', selectedStyle);
        console.log('自定义描述:', customDescription);
        
        // 为所有情况都显示加载提示并使用Promise链
        console.log('显示加载指示器...');
        document.getElementById('loadingIndicator').style.display = 'block';
        
        // 禁用按钮，防止重复点击
        applyButton.disabled = true;
        console.log('已禁用应用按钮，防止重复请求');
        
        // 调用生成并应用样式的函数
        generateAndApplyStyle(selectedStyle, customDescription)
            .then(() => {
                console.log('样式生成和应用流程完成');
                // 样式应用完成后，隐藏加载提示
                document.getElementById('loadingIndicator').style.display = 'none';
            })
            .catch((error) => {
                console.error('生成样式时出错:', error);
                console.log('隐藏加载指示器（出错）');
                // 出错时也要隐藏加载提示
                document.getElementById('loadingIndicator').style.display = 'none';
            })
            .finally(() => {
                console.log('重新启用应用按钮');
                // 无论成功还是失败，都要重新启用按钮
                applyButton.disabled = false;
            });
    });

    // 获取scope相关元素
    const scopeRadios = document.getElementsByName('scope');
    const detailsMode = document.getElementById('detailsMode');
    const siteMode = document.getElementById('siteMode');
    const allSitesMode = document.getElementById('allSitesMode');

    // 监听scope选择变化
    scopeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'details') {
                detailsMode.style.display = 'block';
                siteMode.style.display = 'none';
                allSitesMode.style.display = 'none';
            } else if (this.value === 'all') {
                detailsMode.style.display = 'none';
                siteMode.style.display = 'none';
                allSitesMode.style.display = 'block';
            } else {
                detailsMode.style.display = 'none';
                siteMode.style.display = 'block';
                allSitesMode.style.display = 'none';
            }
        });
    });

    // 处理全站点模式的代码编辑器标签切换
    const codeTabs = document.querySelectorAll('.code-tab');
    const codeEditors = document.querySelectorAll('.code-editor');
    
    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有活动状态
            codeTabs.forEach(t => t.classList.remove('active'));
            codeEditors.forEach(e => e.classList.remove('active'));
            
            // 添加当前选中标签的活动状态
            tab.classList.add('active');
            
            // 修改这里的逻辑，确保正确获取对应的编辑器
            let editorId;
            switch(tab.dataset.tab) {
                case 'html':
                    editorId = 'customHTML';
                    break;
                case 'css':
                    editorId = 'customCSSAll';
                    break;
                case 'js':
                    editorId = 'customJS';
                    break;
            }
            
            if (editorId) {
                const editor = document.getElementById(editorId);
                if (editor) {
                    editor.classList.add('active');
                }
            }
        });
    });

    // 处理全站点模式的挂件选择
    const widgetSelector = document.getElementById('widgetSelector');
    const customWidgetInput = document.getElementById('customWidgetInput');
    const customCodeInput = document.getElementById('customCodeInput');

    widgetSelector.addEventListener('change', function() {
        const selectedWidget = this.value;
        if (selectedWidget === 'custom-widget') {
            customWidgetInput.style.display = 'block';
            customCodeInput.style.display = 'none';
        } else if (selectedWidget === 'custom-code') {
            customWidgetInput.style.display = 'none';
            customCodeInput.style.display = 'block';
        } else {
            customWidgetInput.style.display = 'none';
            customCodeInput.style.display = 'none';
        }
    });

    // 处理全站点模式的应用按钮
    document.getElementById('applyAllSites').addEventListener('click', function() {
        const selectedWidget = widgetSelector.value;
        if (selectedWidget === 'custom-code') {
            const customHTML = document.getElementById('customHTML').value;
            const customCSS = document.getElementById('customCSSAll').value;
            const customJS = document.getElementById('customJS').value;
            
            applyCustomCodeToAllSites(customHTML, customCSS, customJS);
        } else {
            applyWidgetToAllSites(selectedWidget);
        }
    });

    // 选择元素按钮点击事件
    if (selectElementBtn) {
        selectElementBtn.addEventListener('click', function() {
            const isSelected = this.textContent === '取消选中';
            
            if (isSelected) {
                chrome.storage.local.remove('selectedElement', () => {
                    this.textContent = '定位元素';
                    this.classList.remove('bg-gray-500');
                    this.classList.add('bg-blue-500');
                });
                return;
            }
            
            // 查询所有标签页
            chrome.tabs.query({}, function(tabs) {
                // 过滤出不是扩展页面的标签页
                const normalTabs = tabs.filter(tab => 
                    !tab.url.startsWith('chrome-extension://') && 
                    !tab.url.startsWith('chrome://') &&
                    !tab.url.startsWith('edge://') &&
                    tab.url !== ''
                );

                // 找到最后激活的普通标签页
                const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

                if (!targetTab) {
                    console.error('没有找到可用的标签页');
                    return;
                }

                // 确保目标标签页处于激活状态，但不关闭扩展窗口
                chrome.tabs.update(targetTab.id, { active: true }, () => {
                    // 使用回调函数方式发送消息
                    chrome.tabs.sendMessage(
                        targetTab.id,
                        { action: "startElementSelection" },
                        function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('Failed to send message:', chrome.runtime.lastError);
                                // 如果是因为content script未注入导致的错误，尝试注入content script
                                chrome.scripting.executeScript({
                                    target: { tabId: targetTab.id },
                                    files: ['content.js']
                                }, function() {
                                    if (chrome.runtime.lastError) {
                                        console.error('Failed to inject content script:', chrome.runtime.lastError);
                                        return;
                                    }
                                    
                                    // 等待一小段时间确保content script初始化完成
                                    setTimeout(() => {
                                        // 重试发送消息
                                        chrome.tabs.sendMessage(
                                            targetTab.id,
                                            { action: "startElementSelection" },
                                            function(retryResponse) {
                                                if (chrome.runtime.lastError) {
                                                    console.error('Retry failed:', chrome.runtime.lastError);
                                                }
                                            }
                                        );
                                    }, 200);
                                });
                            }
                        }
                    );
                });
            });
        });
    }

    // 处理元素样式应用
    document.getElementById('applyElementStyle').addEventListener('click', async function() {
        const description = document.getElementById('elementStyleDescription').value;
        if (!description) {
            alert('请描述您想要的样式效果');
            return;
        }

        // 获取选中的元素信息
        const data = await chrome.storage.local.get(['selectedElement']);
        if (!data.selectedElement) {
            alert('请先选择要美化的元素');
            return;
        }

        // 调用统一的生成和应用样式函数
        const result = await generateAndApplyElementStyle(
            data.selectedElement.details,
            description
        );

        if (!result.success) {
            alert('应用样式失败：' + (result.error || '未知错误'));
        }
    });

    // 修改 adjustPopupHeight 函数，添加重试机制
    function adjustPopupHeight() {
        // 获取内容的实际高度
        const contentHeight = document.querySelector('.container').scrollHeight;
        
        // 添加重试机制发送消息
        const tryAdjustHeight = (retryCount = 0) => {
            chrome.runtime.sendMessage({
                action: "adjustPopupHeight",
                height: contentHeight
            }, response => {
                if (chrome.runtime.lastError && retryCount < 3) {
                    // 如果发送失败且未超过重试次数，等待100ms后重试
                    setTimeout(() => tryAdjustHeight(retryCount + 1), 100);
                }
            });
        };

        tryAdjustHeight();
    }

    // 添加定期检查和调整高度的功能
    function setupHeightAdjustment() {
        // 初始调整
        adjustPopupHeight();

        // 监听内容变化
        const observer = new MutationObserver(() => {
            adjustPopupHeight();
        });

        observer.observe(document.querySelector('.container'), {
            childList: true,
            subtree: true,
            attributes: true
        });

        // 添加定期检查机制
        setInterval(adjustPopupHeight, 1000); // 每秒检查一次

        // 监听用户交互事件
        document.addEventListener('click', () => {
            setTimeout(adjustPopupHeight, 100);
        });

        document.addEventListener('input', () => {
            setTimeout(adjustPopupHeight, 100);
        });

        // 监听选择器变化
        document.getElementById('styleSelector')?.addEventListener('change', () => {
            setTimeout(adjustPopupHeight, 100);
        });

        document.getElementById('widgetSelector')?.addEventListener('change', () => {
            setTimeout(adjustPopupHeight, 100);
        });

        // 监听单选按钮变化
        document.querySelectorAll('input[name="scope"]').forEach(radio => {
            radio.addEventListener('change', () => {
                setTimeout(adjustPopupHeight, 100);
            });
        });
    }

    // 确保在 DOM 加载完成后初始化高度调整
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHeightAdjustment);
    } else {
        setupHeightAdjustment();
    }

    // 在DOMContentLoaded事件监听器中添加：
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateElementButton") {
            const selectBtn = document.getElementById('selectElement');
            if (selectBtn) {
                selectBtn.textContent = message.selected ? '取消选中' : '定位元素';
                selectBtn.classList.toggle('bg-blue-500', !message.selected);
                selectBtn.classList.toggle('bg-gray-500', message.selected);
            }
        }
    });
});

// 添加生成 style_id 的函数
function generateStyleId() {
    return `style_${Date.now()}`;
}

// 生成并应用样式的函数
function generateAndApplyStyle(style, customDescription = '') {
    console.log('=== generateAndApplyStyle 函数开始 ===');
    console.log('参数 - 样式:', style);
    console.log('参数 - 描述:', customDescription);
    
    return new Promise((resolve, reject) => {
        // 获取扩展窗口的 ID
        chrome.windows.getCurrent(currentWindow => {
            console.log('获取当前窗口完成');
            // 查询所有标签页，找到不是扩展页面的活动标签页
            chrome.tabs.query({}, function(tabs) {
                console.log('查询到标签页数量:', tabs.length);
                // 过滤出不是扩展页面的标签页
                const normalTabs = tabs.filter(tab => 
                    !tab.url.startsWith('chrome-extension://') && 
                    !tab.url.startsWith('chrome://')
                );
                console.log('过滤后的普通标签页数量:', normalTabs.length);

                // 找到最后激活的普通标签页
                const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

                if (!targetTab) {
                    const error = new Error('没有找到可应用样式的标签页');
                    console.error(error.message);
                    reject(error);
                    return;
                }
                
                console.log('目标标签页:', {
                    id: targetTab.id,
                    url: targetTab.url,
                    title: targetTab.title
                });

                try {
                    // 激活目标标签页
                    chrome.tabs.update(targetTab.id, { active: true }, () => {
                        handleStyleApplication(targetTab.id, style, customDescription, resolve, reject);
                    });
                } catch (error) {
                    console.error('应用样式时出错:', error);
                    reject(error);
                }
            });
        });
    });
}

// 处理样式应用函数
function handleStyleApplication(tabId, style, customDescription, resolve, reject) {
    // 如果选择了自定义CSS
    if (style === 'custom-css') {
        const customCSS = document.getElementById('customCSS');
        if (customCSS) {
            applyCustomCSS(tabId, customCSS.value, resolve, reject);
        } else {
            reject(new Error('自定义CSS输入框未找到'));
        }
    } 
    // 如果选择了默认样式
    else if (style === 'default') {
        // 发送消息给内容脚本,移除所有已应用的样式
        chrome.tabs.sendMessage(tabId, { action: "removeAllStyles" }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('移除样式时出错:', chrome.runtime.lastError);
                alert('移除样式失败，请刷新页面后重试');
                reject(new Error('移除样式失败'));
                return;
            }

            if (!response || !response.success) {
                console.error('移除样式失败');
                alert('移除样式失败，请刷新页面后重试');
                reject(new Error('移除样式失败'));
                return;
            }

            // 在本地存储中设置默认样式标志
            chrome.storage.local.set({defaultStyle: true}, function() {
                if (chrome.runtime.lastError) {
                    console.error('设置默认样式标志时出错:', chrome.runtime.lastError);
                    reject(new Error('设置默认样式标志时出错'));
                    return;
                }
                console.log('默认样式标志已设置');
            });
            
            // 获取当前标签页的URL并移除其存储的样式
            chrome.tabs.get(tabId, function(tab) {
                if (chrome.runtime.lastError) {
                    console.error('获取标签页信息失败:', chrome.runtime.lastError);
                    reject(new Error('获取标签页信息失败'));
                    return;
                }
                chrome.storage.local.remove(tab.url, function() {
                    if (chrome.runtime.lastError) {
                        console.error('移除存储的样式时出错:', chrome.runtime.lastError);
                        reject(new Error('移除存储的样式时出错'));
                        return;
                    }
                    console.log('保存的样式已移除');
                    resolve();
                });
            });
        });
    } 
    // 如果选择了其他预设样式
    else {
        // 获取页面结构并生成相应的样式
        getPageStructureAndGenerateStyle(tabId, style, customDescription, resolve, reject);
    }
}

// 获取页面结构并生成样式的函数
function getPageStructureAndGenerateStyle(tabId, style, customDescription, resolve, reject) {
    console.log('=== 获取页面结构并生成样式 ===');
    console.log('目标标签页ID:', tabId);
    console.log('样式类型:', style);
    console.log('自定义描述:', customDescription);
    
    const styleId = generateStyleId();
    console.log('生成的样式ID:', styleId);
    
    try {
        console.log('发送获取页面结构消息到内容脚本...');
        chrome.tabs.sendMessage(tabId, {
            action: "getPageStructure"
        }, function(response) {
            console.log('收到页面结构响应:', response ? '成功' : '失败');
            if (chrome.runtime.lastError) {
                console.log('内容脚本未注入，开始注入...');
                // 如果内容脚本未注入，先注入内容脚本
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }, function() {
                    if (chrome.runtime.lastError) {
                        console.error('注入内容脚本失败:', chrome.runtime.lastError);
                        alert('无法在此页面应用样式');
                        reject(new Error('注入内容脚本失败'));
                        return;
                    }
                    console.log('内容脚本注入成功，重试获取页面结构...');
                    // 重试获取页面结构
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                            action: "getPageStructure"
                        }, (response) => handlePageStructureResponse(response, resolve, reject));
                    }, 100);
                });
                return;
            }
            handlePageStructureResponse(response, resolve, reject);
        });
    } catch (error) {
        console.error('获页面结构时出错:', error);
        reject(error);
    }

    function handlePageStructureResponse(response, resolve, reject) {
        if (!response || !response.pageStructure) {
            console.error('获取页面结构失败');
            reject(new Error('获取页面结构失败'));
            return;
        }

        console.log('页面结构获取成功:', {
            url: response.url,
            structureLength: JSON.stringify(response.pageStructure).length
        });

        try {
            console.log('发送生成样式请求到 Background...');
            const backgroundRequestStart = new Date();
            
            chrome.runtime.sendMessage({
                action: "generateAndApplyStyle",
                pageStructure: JSON.stringify(response.pageStructure, null, 2),
                style: style,
                customDescription: customDescription,
                url: response.url,
                styleId: styleId
            }, function(response) {
                const backgroundRequestEnd = new Date();
                const backgroundDuration = calculateDuration(backgroundRequestStart, backgroundRequestEnd);
                
                if (chrome.runtime.lastError) {
                    console.error('生成样式失败:', chrome.runtime.lastError);
                    reject(new Error('生成样式失败'));
                } else {
                    console.log(`Background 处理完成 - 耗时: ${backgroundDuration.toFixed(3)}秒`);
                    console.log('Background 响应:', response);
                    resolve();
                }
                
                chrome.storage.local.remove('defaultStyle');
                console.log('=== 整个样式生成流程完成 ===');
            });
        } catch (error) {
            console.error('生成并应用样式时出错:', error);
            reject(error);
        }
    }
}

// 应用自定义CSS的函数
function applyCustomCSS(tabId, css, resolve, reject) {
    // 先确保内容脚本已注入
    ensureContentScriptInjected(tabId).then(isInjected => {
        if (!isInjected) {
            console.error('无法注入内容脚本');
            reject(new Error('无法注入内容脚本'));
            return;
        }

        const styleId = generateStyleId();
        
        // 使用 chrome.tabs.sendMessage 之前先检查标签页是否存在
        chrome.tabs.get(tabId, function(tab) {
            if (chrome.runtime.lastError) {
                console.error('标签页不存在:', chrome.runtime.lastError);
                reject(new Error('标签页不存在'));
                return;
            }

            // 添加重试机制
            const tryApplyStyle = (retryCount = 0) => {
                chrome.tabs.sendMessage(tabId, {
                    action: "applyStyle",
                    style: css,
                    styleId: styleId
                }, response => {
                    if (chrome.runtime.lastError) {
                        if (retryCount < 3) {
                            // 延迟 500ms 后重试
                            setTimeout(() => tryApplyStyle(retryCount + 1), 500);
                        } else {
                            console.error('应用自定义CSS失败，已重试3次:', chrome.runtime.lastError);
                            reject(new Error('应用自定义CSS失败'));
                        }
                        return;
                    }

                    console.log('自定义CSS应用成功');
                    chrome.storage.local.remove('defaultStyle');
                    saveCustomCSSToDatabase(css, styleId);
                    resolve();
                });
            };

            tryApplyStyle();
        });
    }).catch(error => {
        console.error('确保内容脚本注入失败:', error);
        reject(error);
    });
}

// 确保内容脚本已注入的函数
async function ensureContentScriptInjected(tabId) {
    try {
        // 尝试发送测试消息
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        return true;
    } catch (error) {
        // 如果消息发送失败，尝试注入内容脚本
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

// 保存自定义CSS到数据库的函数
function saveCustomCSSToDatabase(css, styleId) {
    getActiveTab(function(tab) {
        fetch('http://127.0.0.1:5000/api/save_custom_css', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                css: css,
                url: tab.url,
                styleId: styleId
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('自定义CSS保存成功:', data);
        })
        .catch((error) => {
            console.error('保存自定义CSS时出错:', error);
            alert('保存自定义CSS失败，请稍后再试。');
        });
    });
}

// 生成唯一样式ID的函数
function generateUniqueStyleId() {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000000);
    const userSpecificInfo = getUserSpecificInfo(); // 这个函数需要另外实现
    return `style_${timestamp}_${randomNum}_${userSpecificInfo}`;
  }

// 获取用户特定信息的函数
function getUserSpecificInfo() {
    // 这里可以返回一些用户特定的信息，比如用户ID（如果有的话）
    // 如果没有用户特定信息，可以返回一个随机字符串
    return Math.random().toString(36).substring(2, 15);
  }

// 添加应用代码到所有站点的函数
function applyCustomCodeToAllSites(html, css, js) {
    // 这里实现将代码应用到所有站点的逻辑
    chrome.storage.local.set({
        globalCustomCode: {
            html: html,
            css: css,
            js: js
        }
    }, function() {
        console.log('全局自定义代码已保存');
    });
}

// 添加应用挂件到所有站点的函数
function applyWidgetToAllSites(widgetType) {
    // 这里实现将挂件应用到所有站点的逻辑
    chrome.storage.local.set({
        globalWidget: widgetType
    }, function() {
        console.log('全局挂件设置已保存');
    });
}

// 获取当前活动标签页的函数
function getActiveTab(callback) {
    chrome.tabs.query({}, function(tabs) {
        const normalTabs = tabs.filter(tab => 
            !tab.url.startsWith('chrome-extension://') && 
            !tab.url.startsWith('chrome://')
        );
        const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];
        if (targetTab) {
            callback(targetTab);
        } else {
            console.error('没有找到可用的标签页');
        }
    });
}

// 处理元素样式生成和应用的统一函数
async function generateAndApplyElementStyle(elementDetails, description) {
    try {
        console.log('=== generateAndApplyElementStyle 函数开始 ===');
        console.log('细节模式样式生成时间:', formatBeijingTime());
        
        // 获取当前标签页
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
        
        console.log('细节模式 - 现有样式信息:', existingStyle);
        
        // 重要：使用现有的 style_id，这样可以保持评分状态的一致性
        const styleId = existingStyle?.style_id || generateStyleId();
        console.log('细节模式 - 使用的样式ID:', styleId);
        console.log('细节模式 - 是否复用现有ID:', !!existingStyle?.style_id);

        // 准备发送到后端的数据
        const requestData = {
            elementDetails: elementDetails,
            description: description,
            url: targetTab.url,
            styleId: styleId,
            existingStyle: existingStyle
        };

        // 显示加载提示
        document.getElementById('loadingIndicator').style.display = 'block';
        
        // 确保内容脚本已注入
        const isInjected = await ensureContentScriptInjected(targetTab.id);
        if (!isInjected) {
            throw new Error('无法注入内容脚本');
        }

        // 发送生成样式的请求
        const response = await fetch('http://127.0.0.1:5000/api/generate_element_style', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '生成样式失败');
        }

        console.log('细节模式 - 后端返回的样式ID:', data.styleId);

        // 应用生成的样式到页面
        await chrome.tabs.sendMessage(targetTab.id, {
            action: "applyElementStyle",
            style: data.style,
            elementPath: elementDetails.elementInfo.path,
            styleId: styleId  // 确保使用一致的样式ID
        });

        console.log('细节模式 - 样式应用完成，使用样式ID:', styleId);

        // 不再单独保存元素样式，避免破坏主样式的状态
        // 主样式的更新由 applyElementStyle 函数在 content.js 中处理

        console.log('=== generateAndApplyElementStyle 函数完成 ===');
        return { success: true };

    } catch (error) {
        console.error('生成并应用元素样式时出错:', error);
        return { success: false, error: error.message };
    } finally {
        // 隐藏加载提示
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}
