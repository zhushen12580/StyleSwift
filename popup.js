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
        
        // 如果选择的是默认样式或自定义CSS，直接调用函数而不显示加载提示
        if (selectedStyle === 'default' || selectedStyle === 'custom-css') {
            generateAndApplyStyle(selectedStyle, customDescription);
        } else {
            // 显示加载提示
            document.getElementById('loadingIndicator').style.display = 'block';
            
            // 禁用按钮，防止重复点击
            applyButton.disabled = true;
            
            // 调用生成并应用样式的函数
            generateAndApplyStyle(selectedStyle, customDescription)
                .then(() => {
                    // 样式应用完成后，隐藏加载提示
                    document.getElementById('loadingIndicator').style.display = 'none';
                })
                .catch((error) => {
                    console.error('生成样式时出错:', error);
                    // 出错时也要隐藏加载提示
                    document.getElementById('loadingIndicator').style.display = 'none';
                })
                .finally(() => {
                    // 无论成功还是失败，都要重新启用按钮
                    applyButton.disabled = false;
                });
        }
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
    document.getElementById('applyElementStyle').addEventListener('click', function() {
        const description = document.getElementById('elementStyleDescription').value;
        if (!description) {
            alert('请描述您想要的样式效果');
            return;
        }

        // 显示加载提示
        document.getElementById('loadingIndicator').style.display = 'block';

        // 获取选中的元素信息
        chrome.storage.local.get(['selectedElement'], function(data) {
            if (!data.selectedElement) {
                alert('请先选择要美化的元素');
                document.getElementById('loadingIndicator').style.display = 'none';
                return;
            }

            // 准备发送到后端的数据
            const requestData = {
                elementDetails: data.selectedElement.details,
                description: description,
                url: window.location.href // 使用当前页面的URL
            };

            // 通过background script发送请求
            chrome.runtime.sendMessage({
                action: "generateElementStyle",
                data: requestData
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    document.getElementById('loadingIndicator').style.display = 'none';
                    alert('发送请求失败，请重试');
                    return;
                }

                if (response && response.success) {
                    // 应用生成的样式
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: "applyElementStyle",
                                style: response.style,
                                elementPath: data.selectedElement.details.elementInfo.path
                            }, function(applyResponse) {
                                document.getElementById('loadingIndicator').style.display = 'none';
                                if (chrome.runtime.lastError || !applyResponse || !applyResponse.success) {
                                    alert('应用样式失败，请重试');
                                }
                            });
                        }
                    });
                } else {
                    document.getElementById('loadingIndicator').style.display = 'none';
                    alert('生成样式失败：' + (response ? response.error : '未知错误'));
                }
            });
        });
    });

    // 在文档加载完成后计算并设置适当的高度
    function adjustPopupHeight() {
        // 获取内容的实际高度
        const contentHeight = document.querySelector('.container').scrollHeight;
        
        // 发送消息给background script来调整窗口高度
        chrome.runtime.sendMessage({
            action: "adjustPopupHeight",
            height: contentHeight
        });
    }

    // 初始调整
    adjustPopupHeight();

    // 监听内容变化时重新调整高度
    // 例如在切换不同模式时
    const observer = new MutationObserver(adjustPopupHeight);
    observer.observe(document.querySelector('.container'), {
        childList: true,
        subtree: true,
        attributes: true
    });

    // 监听选择器变化
    document.getElementById('styleSelector')?.addEventListener('change', () => {
        setTimeout(adjustPopupHeight, 100); // 给DOM更新一些时间
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
});

// 生成并应用样式的函数
function generateAndApplyStyle(style, customDescription = '') {
    // 获取扩展窗口的 ID
    chrome.windows.getCurrent(currentWindow => {
        // 查询所有标签页，找到不是扩展页面的活动标签页
        chrome.tabs.query({}, function(tabs) {
            // 过滤出不是扩展页面的标签页
            const normalTabs = tabs.filter(tab => 
                !tab.url.startsWith('chrome-extension://') && 
                !tab.url.startsWith('chrome://')
            );

            // 找到最后激活的普通标签页
            const targetTab = normalTabs.find(tab => tab.active) || normalTabs[0];

            if (!targetTab) {
                console.error('没有找到可应用样式的标签页');
                return;
            }

            // 创建或获取加载指示器
            let loadingIndicator = document.getElementById('loadingIndicator');
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.id = 'loadingIndicator';
                loadingIndicator.innerHTML = `
                    <p>正在生成样式，请稍候...</p>
                    <div class="spinner"></div>
                `;
                document.querySelector('main').appendChild(loadingIndicator);
            }
            loadingIndicator.style.display = 'block';

            // 禁用应用按钮
            const applyButton = document.getElementById('applyStyle');
            if (applyButton) {
                applyButton.disabled = true;
            }

            try {
                // 激活目标标签页
                chrome.tabs.update(targetTab.id, { active: true }, () => {
                    handleStyleApplication(targetTab.id, style, customDescription);
                });
            } catch (error) {
                console.error('应用样式时出错:', error);
            } finally {
                // 隐藏加载提示
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                // 重新启用应用按钮
                if (applyButton) {
                    applyButton.disabled = false;
                }
            }
        });
    });
}

// 处理样式应用函数
function handleStyleApplication(tabId, style, customDescription) {
    // 如果选择了自定义CSS
    if (style === 'custom-css') {
        const customCSS = document.getElementById('customCSS');
        if (customCSS) {
            applyCustomCSS(tabId, customCSS.value);
        }
    } 
    // 如果选择了默认样式
    else if (style === 'default') {
        // 发送消息给内容脚本,移除所有已应用的样式
        chrome.tabs.sendMessage(tabId, { action: "removeAllStyles" }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('移除样式时出错:', chrome.runtime.lastError);
                alert('移除样式失败，请刷新页面后重试');
                return;
            }

            if (!response || !response.success) {
                console.error('移除样式失败');
                alert('移除样式失败，请刷新页面后重试');
                return;
            }

            // 在本地存储中设置默认样式标志
            chrome.storage.local.set({defaultStyle: true}, function() {
                if (chrome.runtime.lastError) {
                    console.error('设置默认样式标志时出错:', chrome.runtime.lastError);
                    return;
                }
                console.log('默认样式标志已设置');
            });
            
            // 获取当前标签页的URL并移除其存储的样式
            chrome.tabs.get(tabId, function(tab) {
                if (chrome.runtime.lastError) {
                    console.error('获取标签页信息失败:', chrome.runtime.lastError);
                    return;
                }
                chrome.storage.local.remove(tab.url, function() {
                    if (chrome.runtime.lastError) {
                        console.error('移除存储的样式时出错:', chrome.runtime.lastError);
                        return;
                    }
                    console.log('保存的样式已移除');
                });
            });
        });
    } 
    // 如果选择了其他预设样式
    else {
        // 获取页面结构并生成相应的样式
        getPageStructureAndGenerateStyle(tabId, style, customDescription);
    }
}

// 获取页面结构并生成样式的函数
function getPageStructureAndGenerateStyle(tabId, style, customDescription) {
    const styleId = generateUniqueStyleId();
    
    // 获取或创建加载指示器
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.innerHTML = `
            <p>正在生成样式，请稍候...</p>
            <div class="spinner"></div>
        `;
        document.querySelector('main').appendChild(loadingIndicator);
    }
    loadingIndicator.style.display = 'block';
    
    try {
        chrome.tabs.sendMessage(tabId, {
            action: "getPageStructure"
        }, function(response) {
            if (chrome.runtime.lastError) {
                // 如果内容脚本未注入，先注入内容脚本
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }, function() {
                    if (chrome.runtime.lastError) {
                        console.error('注入内容脚本失败:', chrome.runtime.lastError);
                        alert('无法在此页面应用样式');
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                        return;
                    }
                    // 重试获取页面结构
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                            action: "getPageStructure"
                        }, handlePageStructureResponse);
                    }, 100);
                });
                return;
            }
            handlePageStructureResponse(response);
        });
    } catch (error) {
        console.error('获页面结构时出错:', error);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    function handlePageStructureResponse(response) {
        if (!response || !response.pageStructure) {
            console.error('获取页面结构失败');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            return;
        }

        try {
            chrome.runtime.sendMessage({
                action: "generateAndApplyStyle",
                pageStructure: JSON.stringify(response.pageStructure, null, 2),
                style: style,
                customDescription: customDescription,
                url: response.url,
                styleId: styleId
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('生成样式失败:', chrome.runtime.lastError);
                }
                chrome.storage.local.remove('defaultStyle');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
            });
        } catch (error) {
            console.error('生成并应用样式时出错:', error);
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    }
}

// 应用自定义CSS的函数
function applyCustomCSS(tabId, css) {
    // 先确保内容脚本已注入
    ensureContentScriptInjected(tabId).then(isInjected => {
        if (!isInjected) {
            console.error('无法注入内容脚本');
            return;
        }

        const styleId = generateUniqueStyleId();
        
        // 使用 chrome.tabs.sendMessage 之前先检查标签页是否存在
        chrome.tabs.get(tabId, function(tab) {
            if (chrome.runtime.lastError) {
                console.error('标签页不存在:', chrome.runtime.lastError);
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
                        }
                        return;
                    }

                    console.log('自定义CSS应用成功');
                    chrome.storage.local.remove('defaultStyle');
                    saveCustomCSSToDatabase(css, styleId);
                });
            };

            tryApplyStyle();
        });
    });
}

// 添加 ensureContentScriptInjected 函数
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

function generateUniqueStyleId() {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000000);
    const userSpecificInfo = getUserSpecificInfo(); // 这个函数需要另外实现
    return `style_${timestamp}_${randomNum}_${userSpecificInfo}`;
  }
  
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
