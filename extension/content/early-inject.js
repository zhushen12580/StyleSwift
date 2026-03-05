/**
 * early-inject.js —— 永久样式自动注入
 * 
 * 在 document_start 阶段执行，在页面渲染之前注入永久样式，防止闪烁（FOUC）
 * 读取 chrome.storage.local 中的 persistent:{domain} 数据并注入到页面
 */

(async () => {
  // 获取当前页面域名
  const domain = location.hostname;
  
  // 构建存储 key
  const key = `persistent:${domain}`;
  
  // 从 chrome.storage.local 读取永久样式
  const result = await chrome.storage.local.get(key);
  
  // 如果没有永久样式，直接返回（不注入 <style> 元素）
  if (!result[key]) {
    return;
  }
  
  // 创建 <style> 元素
  const style = document.createElement('style');
  style.id = 'styleswift-persistent';
  style.textContent = result[key];
  
  // 注入到 DOM
  // document_start 时 <head> 可能还不存在，需要降级处理
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.documentElement.appendChild(style);
  }
})();
