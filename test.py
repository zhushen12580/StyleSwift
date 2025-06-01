# -*- coding: utf-8 -*-
from bs4 import BeautifulSoup, Comment
import json

def truncate_text(text, max_length=50):
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."

def get_key_css(element):
    # 注意:BeautifulSoup不能直接获取计算样式,这里只是一个示例
    # 实际使用时可能需要其他库来获取计算样式
    key_properties = [
        'display', 'position', 'float', 'clear',
        'flex', 'flex-direction', 'justify-content', 'align-items',
        'grid', 'grid-template-columns', 'grid-template-rows',
        'width', 'height', 'max-width', 'max-height',
        'margin', 'padding', 'border',
        'background-color', 'color', 'font-size', 'font-weight'
    ]
    
    css = {}
    style = element.get('style', '')
    for prop in key_properties:
        if prop in style:
            css[prop] = style[prop]
    return css

def get_element_info(element):
    # 注意:BeautifulSoup不能直接获取元素位置信息,这里只是一个示例
    return {
        'tag': element.name,
        'id': element.get('id', ''),
        'class': element.get('class', ''),
        'x': 0,
        'y': 0,
        'width': 0,
        'height': 0
    }

def extract_minimal_structure(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    
    def extract_element(element, seen_elements=None):
        if seen_elements is None:
            seen_elements = set()
        
        if element.name is None:
            return truncate_text(element.strip())
        
        # Convert list attribute values to tuples
        attrs = {k: tuple(v) if isinstance(v, list) else v for k, v in element.attrs.items()}
        element_structure = (element.name, frozenset(attrs.items()))
        
        if element_structure in seen_elements:
            return ""  # Skip duplicate elements
        seen_elements.add(element_structure)
        
        important_attrs = ['id', 'class', 'style', 'title']
        attributes = []
        for k, v in attrs.items():
            if k in important_attrs:
                if isinstance(v, tuple):
                    v = ' '.join(v)
                attributes.append(f'{k}="{v}"')
        
        attributes_str = ' '.join(attributes)
        opening_tag = f"<{element.name} {attributes_str}>" if attributes_str else f"<{element.name}>"
        
        content = []
        for child in element.children:
            if isinstance(child, Comment):
                continue  # Skip comments
            if child.name in ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                              'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img', 
                              'form', 'input', 'button', 'section', 'article', 'nav', 
                              'header', 'footer', 'aside', 'main', 'center', 'blockquote']:
                content.append(extract_element(child, seen_elements))
            elif isinstance(child, str) and child.strip():
                content.append(truncate_text(child.strip()))
        
        closing_tag = f"</{element.name}>"
        return f"{opening_tag}{''.join(content)}{closing_tag}"
    
    def remove_shadow_root_divs(soup):
        shadow_root_divs = soup.find_all('div', attrs={'shadowroot': True})
        for div in shadow_root_divs:
            div.decompose()
    
    remove_shadow_root_divs(soup)
    
    body = soup.find('body')
    structure = extract_element(body) if body else "No body found in the HTML"
    
    viewport = {
        'width': 0,  # 实际使用时需要获取真实的视口宽度
        'height': 0  # 实际使用时需要获取真实的视口高度
    }
    
    return {
        'viewport': viewport,
        'structure': structure
    }

# 使用示例
html_content = """
<html lang="zh-CN" class="ua-windows ua-webkit"><plasmo-csui></plasmo-csui><head><style>body {transition: opacity ease-in 0.2s; } 
body[unresolved] {opacity: 0; display: block; overflow: hidden; position: relative; } 
</style>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="renderer" content="webkit">
    <meta name="referrer" content="always">
    <meta name="google-site-verification" content="ok0wCgT20tBBgo9_zat2iAcimtN4Ftf5ccsh092Xeyw">
    <title>
        豆瓣电影
</title>
    
    <meta name="baidu-site-verification" content="cZdR4xxR7RxmM4zE">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="Sun, 6 Mar 2006 01:00:00 GMT">
    
    <meta http-equiv="mobile-agent" content="format=xhtml; url=https://m.douban.com/movie/">
    <meta property="qc:admins" content="13753521351564752166375">
    
    
    <meta name="keywords" content="电影、经典电影、热映、电视剧、美剧、影评、电影院、电影票、排行、推荐">
    <meta name="description" content="豆瓣电影提供最新的电影介绍及评论包括上映影片的影讯查询及购票服务。你可以记录想看、在看和看过的电影电视剧，顺便打分、写影评。根据你的口味，豆瓣电影会推荐好电影给你。">

    <link rel="apple-touch-icon" href="https://img1.doubanio.com/cuphead/movie-static/pics/apple-touch-icon.png">
    <link href="https://img1.doubanio.com/f/vendors/e92483e5e4c9c60cc75cbd8b700a2fd5b5fdf7b0/css/douban.css" rel="stylesheet" type="text/css">
    <link href="https://img1.doubanio.com/f/vendors/ee6598d46af0bc554cecec9bcbf525b9b0582cb0/css/separation/_all.css" rel="stylesheet" type="text/css">
    <link href="https://img1.doubanio.com/cuphead/movie-static/base/init.15f4b.css" rel="stylesheet">
    <script type="text/javascript" defer="" async="" src="https://img3.doubanio.com/dae/fundin/piwik.js"></script><script type="text/javascript" src="//img1.doubanio.com/NWQ3bnN2eS9mL2FkanMvYjFiN2ViZWM0ZDBiZjlkNTE1ZDdiODZiZDc0NzNhNjExYWU3ZDk3My9hZC5yZWxlYXNlLmpz?company_token=kX69T8w1wyOE-dale" async="true"></script><script type="text/javascript">var _head_start = new Date();</script>
    <script type="text/javascript" src="https://img1.doubanio.com/f/vendors/0511abe9863c2ea7084efa7e24d1d86c5b3974f1/js/jquery-1.10.2.min.js"></script>
    <script type="text/javascript" src="https://img1.doubanio.com/f/vendors/e258329ca4b2122b4efe53fddc418967441e0e7f/js/douban.js"></script>
    <script type="text/javascript" src="https://img1.doubanio.com/f/vendors/b0d3faaf7a432605add54908e39e17746824d6cc/js/separation/_all.js"></script>
    
    <link rel="stylesheet" href="https://img1.doubanio.com/cuphead/movie-static/homepage/index.d8a60.css">
    <link rel="stylesheet" href="https://img1.doubanio.com/cuphead/movie-static/common/screening.d89dc.css">
    
  <script type="text/javascript">
  var _vwo_code = (function() {
    var account_id = 249272,
      settings_tolerance = 0,
      library_tolerance = 2500,
      use_existing_jquery = false,
      // DO NOT EDIT BELOW THIS LINE
      f=false,d=document;return{use_existing_jquery:function(){return use_existing_jquery;},library_tolerance:function(){return library_tolerance;},finish:function(){if(!f){f=true;var a=d.getElementById('_vis_opt_path_hides');if(a)a.parentNode.removeChild(a);}},finished:function(){return f;},load:function(a){var b=d.createElement('script');b.src=a;b.type='text/javascript';b.innerText;b.onerror=function(){_vwo_code.finish();};d.getElementsByTagName('head')[0].appendChild(b);},init:function(){settings_timer=setTimeout('_vwo_code.finish()',settings_tolerance);var a=d.createElement('style'),b='body{opacity:0 !important;filter:alpha(opacity=0) !important;background:none !important;}',h=d.getElementsByTagName('head')[0];a.setAttribute('id','_vis_opt_path_hides');a.setAttribute('type','text/css');if(a.styleSheet)a.styleSheet.cssText=b;else a.appendChild(d.createTextNode(b));h.appendChild(a);this.load('//dev.visualwebsiteoptimizer.com/j.php?a='+account_id+'&u='+encodeURIComponent(d.URL)+'&r='+Math.random());return settings_timer;}};}());

  +function () {
    var bindEvent = function (el, type, handler) {
        var $ = window.jQuery || window.Zepto || window.$
       if ($ && $.fn && $.fn.on) {
           $(el).on(type, handler)
       } else if($ && $.fn && $.fn.bind) {
           $(el).bind(type, handler)
       } else if (el.addEventListener){
         el.addEventListener(type, handler, false);
       } else if (el.attachEvent){
         el.attachEvent("on" + type, handler);
       } else {
         el["on" + type] = handler;
       }
     }

    var _origin_load = _vwo_code.load
    _vwo_code.load = function () {
      var args = [].slice.call(arguments)
      bindEvent(window, 'load', function () {
        _origin_load.apply(_vwo_code, args)
      })
    }
  }()

  _vwo_settings_timer = _vwo_code.init();
  </script>


    <style type="text/css"></style>
    <style type="text/css">img { max-width: 100%; }</style>
    <script type="text/javascript"></script>
    <link rel="stylesheet" href="https://img1.doubanio.com/misc/mixed_static/2cf85b142cd6be63.css">

    <link rel="shortcut icon" href="https://img1.doubanio.com/favicon.ico" type="image/x-icon">
<script src="https://ssl.google-analytics.com/ga.js" async="true"></script><style>
        :root {
          --primary-color: #6d28d9;
          --primary-dark: #5b21b6;
          --primary-light: #8b5cf6;
          --black: #18181b;
          --white: #ffffff;
          --gray-100: #f4f4f5;
          --shadow-offset: 4px;
        }
        
        #ratio-screenshot-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: transparent;
          z-index: 9999;
          cursor: crosshair;
          /* pointer-events已通过JavaScript控制 */
        }
        
        #ratio-screenshot-selection {
          position: fixed;
          border: 3px solid var(--white);
          background-color: transparent;
          box-shadow: none;
          z-index: 10000;
          pointer-events: auto;
          box-sizing: border-box;
          /* 添加外层阴影效果使边框在任何背景下都清晰可见 */
          outline: 1px solid rgba(0, 0, 0, 0.5);
        }
        
        #ratio-screenshot-info {
          position: absolute;
          left: 0;
          background-color: rgba(24, 24, 27, 0.7);
          color: var(--white);
          padding: 2px 6px;
          border-radius: 2px;
          font-size: 11px;
          font-weight: normal;
          white-space: nowrap;
          z-index: 10002;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
          bottom: -25px; /* 默认显示在底部外侧 */
          opacity: 0.85;
          font-family: 'Consolas', monospace;
          transition: opacity 0.2s;
        }
        
        #ratio-screenshot-info:hover {
          opacity: 1;
        }
        
        .ratio-screenshot-shortcut-info {
          display: flex;
          align-items: center;
          margin-left: 10px;
          font-size: 11px;
          color: var(--black);
          white-space: nowrap;
          opacity: 0.9;
          background-color: rgba(244, 244, 245, 0.9);
          padding: 4px 8px;
          border: 2px solid var(--black);
          box-shadow: 2px 2px 0 var(--black);
        }
        
        .ratio-screenshot-shortcut-info span {
          display: inline-block;
          background-color: rgba(109, 40, 217, 0.2);
          border: 1px solid var(--primary-color);
          border-radius: 2px;
          padding: 1px 4px;
          margin: 0 2px;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
        }
        
        .ratio-screenshot-selection-saved {
          position: absolute;
          border: 3px dashed var(--primary-color);
          background-color: rgba(139, 92, 246, 0.1);
          z-index: 9998;
          pointer-events: none;
        }
        
        #ratio-screenshot-toolbar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(250, 250, 252, 0.75);
          border-radius: 8px;
          border: 2px solid var(--black);
          box-shadow: 3px 3px 0 var(--black);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 10001;
          max-width: calc(100% - 40px);
          backdrop-filter: blur(4px);
        }
        
        .ratio-screenshot-toolbar-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }
        
        /* 按钮分组容器 */
        .ratio-screenshot-button-group {
          display: flex;
          gap: 4px;
          margin: 0 4px;
          position: relative;
        }
        
        /* 分隔线 */
        .ratio-screenshot-divider {
          width: 1px;
          background-color: rgba(0, 0, 0, 0.2);
          margin: 0 4px;
        }
        
        .ratio-screenshot-button {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          border: 2px solid var(--black);
          cursor: pointer;
          background-color: rgba(244, 244, 245, 0.92);
          color: var(--black);
          box-shadow: 2px 2px 0 var(--black);
          transition: all 0.2s ease;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .ratio-screenshot-button:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--black);
          background-color: rgba(250, 250, 252, 1);
        }
        
        .ratio-screenshot-button:active {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0 var(--black);
        }
        
        .ratio-screenshot-button.primary {
          background-color: rgba(109, 40, 217, 0.92);
          color: var(--white);
        }
        
        .ratio-screenshot-button.primary:hover {
          background-color: rgba(124, 58, 237, 0.95);
        }
        
        /* 按钮图标 */
        .ratio-screenshot-button-icon {
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        select.ratio-screenshot-button {
          padding: 6px 24px 6px 12px;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23000' d='M0 0l4 4 4-4z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }
        
        .ratio-screenshot-selection-info {
          position: absolute;
          bottom: -25px;
          left: 0;
          color: var(--white);
          background-color: var(--primary-color);
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid var(--black);
        }
        
        .ratio-screenshot-magnetic-guide {
          position: fixed;
          z-index: 10002;
          pointer-events: none;
          opacity: 0; /* 隐藏磁性辅助线 */
        }
        
        .ratio-screenshot-magnetic-guide.horizontal {
          height: 1px;
          background-color: #00e5ff;
          width: 100%;
          box-shadow: 0 0 2px rgba(0, 229, 255, 0.8);
        }
        
        .ratio-screenshot-magnetic-guide.vertical {
          width: 1px;
          background-color: #00e5ff;
          height: 100%;
          box-shadow: 0 0 2px rgba(0, 229, 255, 0.8);
        }
        
        .ratio-screenshot-element-highlight {
          position: absolute;
          border: 1px solid rgba(0, 229, 255, 0.5);
          background-color: rgba(0, 229, 255, 0.1);
          pointer-events: none;
          z-index: 9997;
          opacity: 0; /* 隐藏元素高亮 */
        }
        
        .ratio-screenshot-resize-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background-color: var(--white);
          border: 2px solid var(--primary-color);
          z-index: 10003;
        }
        
        .ratio-screenshot-resize-handle.top-left {
          top: -7px;
          left: -7px;
          cursor: nwse-resize;
        }
        
        .ratio-screenshot-resize-handle.top-right {
          top: -7px;
          right: -7px;
          cursor: nesw-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom-left {
          bottom: -7px;
          left: -7px;
          cursor: nesw-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom-right {
          bottom: -7px;
          right: -7px;
          cursor: nwse-resize;
        }
        
        .ratio-screenshot-resize-handle.top {
          top: -7px;
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        
        .ratio-screenshot-resize-handle.right {
          top: 50%;
          right: -7px;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom {
          bottom: -7px;
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        
        .ratio-screenshot-resize-handle.left {
          top: 50%;
          left: -7px;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
        
        .ratio-screenshot-notification {
          position: fixed;
          bottom: 20px;
          top: auto;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(109, 40, 217, 0.9);
          color: var(--white);
          padding: 12px 18px;
          border-radius: 0;
          z-index: 10002;
          font-size: 14px;
          font-weight: bold;
          border: 3px solid var(--black);
          box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--black);
          transition: opacity 0.3s ease;
          max-width: 80%;
          text-align: center;
        }
        
        .ratio-screenshot-move-hint {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.7);
          text-align: center;
          padding-top: 4px;
        }
      </style><style>
        :root {
          --primary-color: #6d28d9;
          --primary-dark: #5b21b6;
          --primary-light: #8b5cf6;
          --black: #18181b;
          --white: #ffffff;
          --gray-100: #f4f4f5;
          --shadow-offset: 4px;
        }
        
        #ratio-screenshot-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: transparent;
          z-index: 9999;
          cursor: crosshair;
          /* pointer-events已通过JavaScript控制 */
        }
        
        #ratio-screenshot-selection {
          position: fixed;
          border: 3px solid var(--white);
          background-color: transparent;
          box-shadow: none;
          z-index: 10000;
          pointer-events: auto;
          box-sizing: border-box;
          /* 添加外层阴影效果使边框在任何背景下都清晰可见 */
          outline: 1px solid rgba(0, 0, 0, 0.5);
        }
        
        #ratio-screenshot-info {
          position: absolute;
          left: 0;
          background-color: rgba(24, 24, 27, 0.7);
          color: var(--white);
          padding: 2px 6px;
          border-radius: 2px;
          font-size: 11px;
          font-weight: normal;
          white-space: nowrap;
          z-index: 10002;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
          bottom: -25px; /* 默认显示在底部外侧 */
          opacity: 0.85;
          font-family: 'Consolas', monospace;
          transition: opacity 0.2s;
        }
        
        #ratio-screenshot-info:hover {
          opacity: 1;
        }
        
        .ratio-screenshot-shortcut-info {
          display: flex;
          align-items: center;
          margin-left: 10px;
          font-size: 11px;
          color: var(--black);
          white-space: nowrap;
          opacity: 0.9;
          background-color: rgba(244, 244, 245, 0.9);
          padding: 4px 8px;
          border: 2px solid var(--black);
          box-shadow: 2px 2px 0 var(--black);
        }
        
        .ratio-screenshot-shortcut-info span {
          display: inline-block;
          background-color: rgba(109, 40, 217, 0.2);
          border: 1px solid var(--primary-color);
          border-radius: 2px;
          padding: 1px 4px;
          margin: 0 2px;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
        }
        
        .ratio-screenshot-selection-saved {
          position: absolute;
          border: 3px dashed var(--primary-color);
          background-color: rgba(139, 92, 246, 0.1);
          z-index: 9998;
          pointer-events: none;
        }
        
        #ratio-screenshot-toolbar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(250, 250, 252, 0.75);
          border-radius: 8px;
          border: 2px solid var(--black);
          box-shadow: 3px 3px 0 var(--black);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 10001;
          max-width: calc(100% - 40px);
          backdrop-filter: blur(4px);
        }
        
        .ratio-screenshot-toolbar-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }
        
        /* 按钮分组容器 */
        .ratio-screenshot-button-group {
          display: flex;
          gap: 4px;
          margin: 0 4px;
          position: relative;
        }
        
        /* 分隔线 */
        .ratio-screenshot-divider {
          width: 1px;
          background-color: rgba(0, 0, 0, 0.2);
          margin: 0 4px;
        }
        
        .ratio-screenshot-button {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          border: 2px solid var(--black);
          cursor: pointer;
          background-color: rgba(244, 244, 245, 0.92);
          color: var(--black);
          box-shadow: 2px 2px 0 var(--black);
          transition: all 0.2s ease;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .ratio-screenshot-button:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 var(--black);
          background-color: rgba(250, 250, 252, 1);
        }
        
        .ratio-screenshot-button:active {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0 var(--black);
        }
        
        .ratio-screenshot-button.primary {
          background-color: rgba(109, 40, 217, 0.92);
          color: var(--white);
        }
        
        .ratio-screenshot-button.primary:hover {
          background-color: rgba(124, 58, 237, 0.95);
        }
        
        /* 按钮图标 */
        .ratio-screenshot-button-icon {
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        select.ratio-screenshot-button {
          padding: 6px 24px 6px 12px;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23000' d='M0 0l4 4 4-4z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }
        
        .ratio-screenshot-selection-info {
          position: absolute;
          bottom: -25px;
          left: 0;
          color: var(--white);
          background-color: var(--primary-color);
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid var(--black);
        }
        
        .ratio-screenshot-magnetic-guide {
          position: fixed;
          z-index: 10002;
          pointer-events: none;
          opacity: 0; /* 隐藏磁性辅助线 */
        }
        
        .ratio-screenshot-magnetic-guide.horizontal {
          height: 1px;
          background-color: #00e5ff;
          width: 100%;
          box-shadow: 0 0 2px rgba(0, 229, 255, 0.8);
        }
        
        .ratio-screenshot-magnetic-guide.vertical {
          width: 1px;
          background-color: #00e5ff;
          height: 100%;
          box-shadow: 0 0 2px rgba(0, 229, 255, 0.8);
        }
        
        .ratio-screenshot-element-highlight {
          position: absolute;
          border: 1px solid rgba(0, 229, 255, 0.5);
          background-color: rgba(0, 229, 255, 0.1);
          pointer-events: none;
          z-index: 9997;
          opacity: 0; /* 隐藏元素高亮 */
        }
        
        .ratio-screenshot-resize-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background-color: var(--white);
          border: 2px solid var(--primary-color);
          z-index: 10003;
        }
        
        .ratio-screenshot-resize-handle.top-left {
          top: -7px;
          left: -7px;
          cursor: nwse-resize;
        }
        
        .ratio-screenshot-resize-handle.top-right {
          top: -7px;
          right: -7px;
          cursor: nesw-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom-left {
          bottom: -7px;
          left: -7px;
          cursor: nesw-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom-right {
          bottom: -7px;
          right: -7px;
          cursor: nwse-resize;
        }
        
        .ratio-screenshot-resize-handle.top {
          top: -7px;
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        
        .ratio-screenshot-resize-handle.right {
          top: 50%;
          right: -7px;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
        
        .ratio-screenshot-resize-handle.bottom {
          bottom: -7px;
          left: 50%;
          transform: translateX(-50%);
          cursor: ns-resize;
        }
        
        .ratio-screenshot-resize-handle.left {
          top: 50%;
          left: -7px;
          transform: translateY(-50%);
          cursor: ew-resize;
        }
        
        .ratio-screenshot-notification {
          position: fixed;
          bottom: 20px;
          top: auto;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(109, 40, 217, 0.9);
          color: var(--white);
          padding: 12px 18px;
          border-radius: 0;
          z-index: 10002;
          font-size: 14px;
          font-weight: bold;
          border: 3px solid var(--black);
          box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--black);
          transition: opacity 0.3s ease;
          max-width: 80%;
          text-align: center;
        }
        
        .ratio-screenshot-move-hint {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.7);
          text-align: center;
          padding-top: 4px;
        }
      </style><style type="text/css">.DraggableTags {
  position: relative;
  height: 100%;
  touch-action: none;
}
.DraggableTags::after {
  content: '';
  display: block;
  clear: both;
}
.DraggableTags-tag {
  display: inline-block;
  position: relative;
  color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.DraggableTags-undraggable {
  cursor: no-drop;
}
.DraggableTags-tag-drag {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1;
}
.hotspot-9485743 {
  cursor: move;
}
.excludedInHotspot-9485743 {
  cursor: default;
}
</style><script src="//dev.visualwebsiteoptimizer.com/j.php?a=249272&amp;u=https%3A%2F%2Fmovie.douban.com%2F&amp;r=0.15080705785352155" type="text/javascript"></script><meta property="pagenote:url" content="https://movie.douban.com/"><meta property="pagenote:pageUrl" content="https://movie.douban.com/"><meta property="pagenote:table" content="html"><style id="init-pagenote-style">
    pagenote-root{
        display: none; // pagenote 插件启动时会自动覆盖这里的样式
    }
    </style><meta property="pagenote:did" content="d805892c-e86b-4123-af9b-f8a2727d4703"><meta property="pagenote:version" content="0.29.22"><meta property="pagenote:platform" content="chrome"><meta property="pagenote:pageKey" content="https://movie.douban.com/"><style data-source="custom-pagenote-style">undefined</style><style data-id="immersive-translate-input-injected-css">.immersive-translate-input {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  z-index: 2147483647;
  display: flex;
  justify-content: center;
  align-items: center;
}
.immersive-translate-attach-loading::after {
  content: " ";

  --loading-color: #f78fb6;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  margin: 12px auto;
  position: relative;
  color: white;
  left: -100px;
  box-sizing: border-box;
  animation: immersiveTranslateShadowRolling 1.5s linear infinite;

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-2000%, -50%);
  z-index: 100;
}

.immersive-translate-loading-spinner {
  vertical-align: middle !important;
  width: 10px !important;
  height: 10px !important;
  display: inline-block !important;
  margin: 0 4px !important;
  border: 2px rgba(221, 244, 255, 0.6) solid !important;
  border-top: 2px rgba(0, 0, 0, 0.375) solid !important;
  border-left: 2px rgba(0, 0, 0, 0.375) solid !important;
  border-radius: 50% !important;
  padding: 0 !important;
  -webkit-animation: immersive-translate-loading-animation 0.6s infinite linear !important;
  animation: immersive-translate-loading-animation 0.6s infinite linear !important;
}

@-webkit-keyframes immersive-translate-loading-animation {
  from {
    -webkit-transform: rotate(0deg);
  }

  to {
    -webkit-transform: rotate(359deg);
  }
}

@keyframes immersive-translate-loading-animation {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(359deg);
  }
}

.immersive-translate-input-loading {
  --loading-color: #f78fb6;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  margin: 12px auto;
  position: relative;
  color: white;
  left: -100px;
  box-sizing: border-box;
  animation: immersiveTranslateShadowRolling 1.5s linear infinite;
}

@keyframes immersiveTranslateShadowRolling {
  0% {
    box-shadow: 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0),
      0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  12% {
    box-shadow: 100px 0 var(--loading-color), 0px 0 rgba(255, 255, 255, 0),
      0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  25% {
    box-shadow: 110px 0 var(--loading-color), 100px 0 var(--loading-color),
      0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  36% {
    box-shadow: 120px 0 var(--loading-color), 110px 0 var(--loading-color),
      100px 0 var(--loading-color), 0px 0 rgba(255, 255, 255, 0);
  }

  50% {
    box-shadow: 130px 0 var(--loading-color), 120px 0 var(--loading-color),
      110px 0 var(--loading-color), 100px 0 var(--loading-color);
  }

  62% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 130px 0 var(--loading-color),
      120px 0 var(--loading-color), 110px 0 var(--loading-color);
  }

  75% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0),
      130px 0 var(--loading-color), 120px 0 var(--loading-color);
  }

  87% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0),
      200px 0 rgba(255, 255, 255, 0), 130px 0 var(--loading-color);
  }

  100% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0),
      200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0);
  }
}

.immersive-translate-toast {
  display: flex;
  position: fixed;
  z-index: 2147483647;
  left: 0;
  right: 0;
  top: 1%;
  width: fit-content;
  padding: 12px 20px;
  margin: auto;
  overflow: auto;
  background: #fef6f9;
  box-shadow: 0px 4px 10px 0px rgba(0, 10, 30, 0.06);
  font-size: 15px;
  border-radius: 8px;
  color: #333;
}

.immersive-translate-toast-content {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.immersive-translate-toast-hidden {
  margin: 0 20px 0 72px;
  text-decoration: underline;
  cursor: pointer;
}

.immersive-translate-toast-close {
  color: #666666;
  font-size: 20px;
  font-weight: bold;
  padding: 0 10px;
  cursor: pointer;
}

@media screen and (max-width: 768px) {
  .immersive-translate-toast {
    top: 0;
    padding: 12px 0px 0 10px;
  }
  .immersive-translate-toast-content {
    flex-direction: column;
    text-align: center;
  }
  .immersive-translate-toast-hidden {
    margin: 10px auto;
  }
}

.immersive-translate-modal {
  display: none;
  position: fixed;
  z-index: 2147483647;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgb(0, 0, 0);
  background-color: rgba(0, 0, 0, 0.4);
  font-size: 15px;
}

.immersive-translate-modal-content {
  background-color: #fefefe;
  margin: 10% auto;
  padding: 40px 24px 24px;
  border: 1px solid #888;
  border-radius: 10px;
  width: 80%;
  max-width: 270px;
  font-family: system-ui, -apple-system, "Segoe UI", "Roboto", "Ubuntu",
    "Cantarell", "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
  position: relative;
}

@media screen and (max-width: 768px) {
  .immersive-translate-modal-content {
    margin: 50% auto !important;
  }
}

.immersive-translate-modal .immersive-translate-modal-content-in-input {
  max-width: 500px;
}
.immersive-translate-modal-content-in-input .immersive-translate-modal-body {
  text-align: left;
  max-height: unset;
}

.immersive-translate-modal-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #333333;
}

.immersive-translate-modal-body {
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  color: #333333;
  word-break: break-all;
  margin-top: 24px;
}

@media screen and (max-width: 768px) {
  .immersive-translate-modal-body {
    max-height: 250px;
    overflow-y: auto;
  }
}

.immersive-translate-close {
  color: #666666;
  position: absolute;
  right: 16px;
  top: 16px;
  font-size: 20px;
  font-weight: bold;
}

.immersive-translate-close:hover,
.immersive-translate-close:focus {
  color: black;
  text-decoration: none;
  cursor: pointer;
}

.immersive-translate-modal-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
}

.immersive-translate-btn {
  width: fit-content;
  color: #fff;
  background-color: #ea4c89;
  border: none;
  font-size: 16px;
  margin: 0 8px;
  padding: 9px 30px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.immersive-translate-btn:hover {
  background-color: #f082ac;
}
.immersive-translate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.immersive-translate-btn:disabled:hover {
  background-color: #ea4c89;
}

.immersive-translate-cancel-btn {
  /* gray color */
  background-color: rgb(89, 107, 120);
}

.immersive-translate-cancel-btn:hover {
  background-color: hsl(205, 20%, 32%);
}

.immersive-translate-action-btn {
  background-color: transparent;
  color: #ea4c89;
  border: 1px solid #ea4c89;
}

.immersive-translate-btn svg {
  margin-right: 5px;
}

.immersive-translate-link {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  text-decoration: none;
  color: #007bff;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

.immersive-translate-primary-link {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  text-decoration: none;
  color: #ea4c89;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

.immersive-translate-modal input[type="radio"] {
  margin: 0 6px;
  cursor: pointer;
}

.immersive-translate-modal label {
  cursor: pointer;
}

.immersive-translate-close-action {
  position: absolute;
  top: 2px;
  right: 0px;
  cursor: pointer;
}

.imt-image-status {
  background-color: rgba(0, 0, 0, 0.5) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 16px !important;
}
.imt-image-status img,
.imt-image-status svg,
.imt-img-loading {
  width: 28px !important;
  height: 28px !important;
  margin: 0 0 8px 0 !important;
  min-height: 28px !important;
  min-width: 28px !important;
  position: relative !important;
}
.imt-img-loading {
  background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAtFBMVEUAAAD////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////oK74hAAAAPHRSTlMABBMIDyQXHwyBfFdDMSw+OjXCb+5RG51IvV/k0rOqlGRM6KKMhdvNyZBz9MaupmxpWyj437iYd/yJVNZeuUC7AAACt0lEQVRIx53T2XKiUBCA4QYOiyCbiAsuuGBcYtxiYtT3f6/pbqoYHVFO5r+iivpo6DpAWYpqeoFfr9f90DsYAuRSWkFnPO50OgR9PwiCUFcl2GEcx+N/YBh6pvKaefHlUgZd1zVe0NbYcQjGBfzrPE8Xz8aF+71D8gG6DHFPpc4a7xFiCDuhaWgKgGIJQ3d5IMGDrpS4S5KgpIm+en9f6PlAhKby4JwEIxlYJV9h5k5nee9GoxHJ2IDSNB0dwdad1NAxDJ/uXDHYmebdk4PdbkS58CIVHdYSUHTYYRWOJblWSyu2lmy3KNFVJNBhxcuGW4YBVCbYGRZwIooipHsNqjM4FbgOQqQqSKQQU9V8xmi1QlgHqQQ6DDBvRUVCDirs+EzGDGOQTCATgtYTnbCVLgsVgRE0T1QE0qHCFAht2z6dLvJQs3Lo2FQoDxWNUiBhaP4eRgwNkI+dAjVOA/kUrIDwf3CG8NfNOE0eiFotSuo+rBiq8tD9oY4Qzc6YJw99hl1wzpQvD7ef2M8QgnOGJfJw+EltQc+oX2yn907QB22WZcvlUpd143dqQu+8pCJZuGE4xCuPXJqqcs5sNpsI93Rmzym1k4Npk+oD1SH3/a3LOK/JpUBpWfqNySxWzCfNCUITuDG5dtuphrUJ1myeIE9bIsPiKrfqTai5WZxbhtNphYx6GEIHihyGFTI69lje/rxajdh0s0msZ0zYxyPLhYCb1CyHm9Qsd2H37Y3lugVwL9kNh8Ot8cha6fUNQ8nuXi5z9/ExsAO4zQrb/ev1yrCB7lGyQzgYDGuxq1toDN/JGvN+HyWNHKB7zEoK+PX11e12G431erGYzwmytAWU56fkMHY5JJnDRR2eZji3AwtIcrEV8Cojat/BdQ7XOwGV1e1hDjGGjXbdArm8uJZtCH5MbcctVX8A1WpqumJHwckAAAAASUVORK5CYII=");
  background-size: 28px 28px;
  animation: image-loading-rotate 1s linear infinite !important;
}

.imt-image-status span {
  color: var(--bg-2, #fff) !important;
  font-size: 14px !important;
  line-height: 14px !important;
  font-weight: 500 !important;
  font-family: "PingFang SC", Arial, sans-serif !important;
}

@keyframes image-loading-rotate {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}
</style><style data-id="bilin-input-injected-css">.bilin-input {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  z-index: 2147483647;
  display: flex;
  justify-content: center;
  align-items: center;
}
.bilin-attach-loading::after {
  content: " ";

  --loading-color: #f78fb6;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  margin: 12px auto;
  position: relative;
  color: white;
  left: -100px;
  box-sizing: border-box;
  animation: immersiveTranslateShadowRolling 1.5s linear infinite;

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-2000%, -50%);
  z-index: 100;
}

.bilin-loading-spinner {
  vertical-align: middle !important;
  width: 10px !important;
  height: 10px !important;
  display: inline-block !important;
  margin: 0 4px !important;
  border: 2px rgba(221, 244, 255, 0.6) solid !important;
  border-top: 2px rgba(0, 0, 0, 0.375) solid !important;
  border-left: 2px rgba(0, 0, 0, 0.375) solid !important;
  border-radius: 50% !important;
  padding: 0 !important;
  -webkit-animation: bilin-loading-animation 0.6s infinite linear !important;
  animation: bilin-loading-animation 0.6s infinite linear !important;
}

@-webkit-keyframes bilin-loading-animation {
  from {
    -webkit-transform: rotate(0deg);
  }

  to {
    -webkit-transform: rotate(359deg);
  }
}

@keyframes bilin-loading-animation {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(359deg);
  }
}


.bilin-input-loading {
  --loading-color: #f78fb6;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  margin: 12px auto;
  position: relative;
  color: white;
  left: -100px;
  box-sizing: border-box;
  animation: immersiveTranslateShadowRolling 1.5s linear infinite;
}

@keyframes immersiveTranslateShadowRolling {
  0% {
    box-shadow: 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  12% {
    box-shadow: 100px 0 var(--loading-color), 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  25% {
    box-shadow: 110px 0 var(--loading-color), 100px 0 var(--loading-color), 0px 0 rgba(255, 255, 255, 0), 0px 0 rgba(255, 255, 255, 0);
  }

  36% {
    box-shadow: 120px 0 var(--loading-color), 110px 0 var(--loading-color), 100px 0 var(--loading-color), 0px 0 rgba(255, 255, 255, 0);
  }

  50% {
    box-shadow: 130px 0 var(--loading-color), 120px 0 var(--loading-color), 110px 0 var(--loading-color), 100px 0 var(--loading-color);
  }

  62% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 130px 0 var(--loading-color), 120px 0 var(--loading-color), 110px 0 var(--loading-color);
  }

  75% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0), 130px 0 var(--loading-color), 120px 0 var(--loading-color);
  }

  87% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0), 130px 0 var(--loading-color);
  }

  100% {
    box-shadow: 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0), 200px 0 rgba(255, 255, 255, 0);
  }
}


.bilin-search-recomend {
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  position: relative;
  font-size: 16px;
}

.bilin-search-enhancement-en-title {
  color: #4d5156;
}



.bilin-search-settings {
  position: absolute;
  top: 16px;
  right: 16px;
  cursor: pointer;
}

.bilin-search-recomend::before {
  /* content: " "; */
  /* width: 20px; */
  /* height: 20px; */
  /* top: 16px; */
  /* position: absolute; */
  /* background: center / contain url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAxlBMVEUAAADpTInqTIjpSofnSIfqS4nfS4XqS4nqTIjsTYnrTInqTIroS4jvQIDqTIn////+/v7rSYjpTIn8/v7uaZzrTIr9/f3wfansWJL88/b85e73qc39+/v3xNnylrvrVI/98fb62Obva5/8+fr76vH4y9zpSIj74e353Oj1ocTzm77xhK/veKbtYpjsXJTqU47oTInxjrXyh7L99fj40eH2ttH1udD3sc31ssz1rMnykLXucqPtbqD85e/1xdn2u9DzqcXrUY6FaJb8AAAADnRSTlMA34BgIM8Q37/fz7+/EGOHcVQAAAGhSURBVDjLhZPncuowEEZFTW7bXVU7xsYYTO/p7bb3f6lICIOYJOT4h7/VnFmvrBFjrF3/CR/SajBHswafctG0Qg3O8O0Xa8BZ6uw7eLjqr30SofCDVSkemMinfL1ecy20r5ygR5zz3ArcAqJExPTPKhDENEmS30Q9+yo4lEQkqVTiIEAHCT10xWERRdH0Bq0aCOPZNDV3s0xaYce1lHEoDHU8wEh3qRJypNcTAeKUIjgKMeGLDoRCLVLTVf+Ownj8Kk6H9HM6QXPgYjQSB0F00EJEu10ILQrs/QeP77BSSr0MzLOyuJJQbnUoOOIUI/A8EeJk9E4YUHUWiRyTVKGgQUB8/3e/NpdGlfI+FMQyWsCBWyz4A/ZyHXyiiz0Ne5aGZssoxRmcChw8/EFKQ5JwwkUo3FRT5yXS7q+Y/rHDZmFktzpGMvO+5QofA4FPpEmGw+EWRCFvnaof7Zhe8NuYSLR0xErKLThUSs8gnODh87ssy6438yzbLzxl012HS19vfCf3CNhnbWOL1eEsDda+gDPUvri8tSZzNFrwIZf1NmNvqC1I/t8j7nYAAAAASUVORK5CYII='); */
}

.bilin-search-title {}

.bilin-search-title-wrapper {}

.bilin-search-time {
  font-size: 12px;
  margin: 4px 0 24px;
  color: #70757a;
}

.bilin-expand-items {
  display: none;
}

.bilin-search-more {
  margin-top: 16px;
  font-size: 14px;
}

.bilin-modal {
  display: none;
  position: fixed;
  z-index: 2147483647;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgb(0, 0, 0);
  background-color: rgba(0, 0, 0, 0.4);
  font-size: 15px;
}

.bilin-modal-content {
  background-color: #fefefe;
  margin: 10% auto;
  padding: 40px 24px 24px;
  border: 1px solid #888;
  border-radius: 10px;
  width: 80%;
  max-width: 270px;
  font-family: system-ui, -apple-system, "Segoe UI", "Roboto", "Ubuntu",
    "Cantarell", "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
  position: relative
}

@media screen and (max-width: 768px) {
  .bilin-modal-content {
    margin: 50% auto !important;
  }
}

.bilin-modal .bilin-modal-content-in-input {
  max-width: 500px;
}
.bilin-modal-content-in-input .bilin-modal-body {
  text-align: left;
  max-height: unset;
}

.bilin-modal-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #333333;
}

.bilin-modal-body {
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  color: #333333;
  word-break: break-all;
  margin-top: 24px;
}

@media screen and (max-width: 768px) {
  .bilin-modal-body {
    max-height: 250px;
    overflow-y: auto;
  }
}

.bilin-close {
  color: #666666;
  position: absolute;
  right: 16px;
  top: 16px;
  font-size: 20px;
  font-weight: bold;
}

.bilin-close:hover,
.bilin-close:focus {
  color: black;
  text-decoration: none;
  cursor: pointer;
}

.bilin-modal-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
}

.bilin-btn {
  width: fit-content;
  color: #fff;
  background-color: #ea4c89;
  border: none;
  font-size: 16px;
  margin: 0 8px;
  padding: 9px 30px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.bilin-btn:hover {
  background-color: #f082ac;
}
.bilin-btn:disabled{
  opacity: 0.6;
  cursor: not-allowed;
}
.bilin-btn:disabled:hover{
  background-color: #ea4c89;
}

.bilin-cancel-btn {
  /* gray color */
  background-color: rgb(89, 107, 120);
}


.bilin-cancel-btn:hover {
  background-color: hsl(205, 20%, 32%);
}

.bilin-action-btn {
  background-color: transparent;
  color: #EA4C89;
  border: 1px solid #EA4C89
}

.bilin-btn svg {
  margin-right: 5px;
}

.bilin-link {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  text-decoration: none;
  color: #007bff;
  -webkit-tap-highlight-color: rgba(0, 0, 0, .1);
}

.bilin-primary-link {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  text-decoration: none;
  color: #ea4c89;
  -webkit-tap-highlight-color: rgba(0, 0, 0, .1);
}

.bilin-modal input[type="radio"] {
  margin: 0 6px;
  cursor: pointer;
}

.bilin-modal label {
  cursor: pointer;
}

.bilin-close-action {
  position: absolute;
  top: 2px;
  right: 0px;
  cursor: pointer;
}
</style></head>

<body style="" data-pagenote="1">
  
    <script type="text/javascript">var _body_start = new Date();</script>

    
    



    <link href="//img3.doubanio.com/dae/accounts/resources/851ead1/shire/bundle.css" rel="stylesheet" type="text/css">



<div id="db-global-nav" class="global-nav">
  <div class="bd">
    
<div class="top-nav-info">
  <a href="https://accounts.douban.com/passport/login?source=movie" class="nav-login" rel="nofollow">登录/注册</a>
</div>


    <div class="top-nav-doubanapp">
  <a href="https://www.douban.com/doubanapp/app?channel=top-nav" class="lnk-doubanapp">下载豆瓣客户端</a>
  <div id="doubanapp-tip">
    <a href="https://www.douban.com/doubanapp/app?channel=qipao" class="tip-link">豆瓣 <span class="version">6.0</span> 全新发布</a>
    <a href="javascript: void 0;" class="tip-close">×</a>
  </div>
  <div id="top-nav-appintro" class="more-items">
    <p class="appintro-title">豆瓣</p>
    <p class="qrcode">扫码直接下载</p>
    <div class="download">
      <a href="https://www.douban.com/doubanapp/redirect?channel=top-nav&amp;direct_dl=1&amp;download=iOS">iPhone</a>
      <span>·</span>
      <a href="https://www.douban.com/doubanapp/redirect?channel=top-nav&amp;direct_dl=1&amp;download=Android" class="download-android">Android</a>
    </div>
  </div>
</div>

    


<div class="global-nav-items">
  <ul>
    <li class="">
      <a href="https://www.douban.com" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-main&quot;,&quot;uid&quot;:&quot;0&quot;}">豆瓣</a>
    </li>
    <li class="">
      <a href="https://book.douban.com" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-book&quot;,&quot;uid&quot;:&quot;0&quot;}">读书</a>
    </li>
    <li class="on">
      <a href="https://movie.douban.com" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-movie&quot;,&quot;uid&quot;:&quot;0&quot;}">电影</a>
    </li>
    <li class="">
      <a href="https://music.douban.com" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-music&quot;,&quot;uid&quot;:&quot;0&quot;}">音乐</a>
    </li>
    <li class="">
      <a href="https://www.douban.com/location" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-location&quot;,&quot;uid&quot;:&quot;0&quot;}">同城</a>
    </li>
    <li class="">
      <a href="https://www.douban.com/group" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-group&quot;,&quot;uid&quot;:&quot;0&quot;}">小组</a>
    </li>
    <li class="">
      <a href="https://read.douban.com/?dcs=top-nav&amp;dcm=douban" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-read&quot;,&quot;uid&quot;:&quot;0&quot;}">阅读</a>
    </li>
    <li class="">
      <a href="https://fm.douban.com/?from_=shire_top_nav" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-fm&quot;,&quot;uid&quot;:&quot;0&quot;}">FM</a>
    </li>
    <li class="">
      <a href="https://time.douban.com/?dt_time_source=douban-web_top_nav" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-time&quot;,&quot;uid&quot;:&quot;0&quot;}">时间</a>
    </li>
    <li class="">
      <a href="https://market.douban.com/?utm_campaign=douban_top_nav&amp;utm_source=douban&amp;utm_medium=pc_web" target="_blank" data-moreurl-dict="{&quot;from&quot;:&quot;top-nav-click-market&quot;,&quot;uid&quot;:&quot;0&quot;}">豆品</a>
    </li>
  </ul>
</div>

  </div>
</div>
<script>
  ;window._GLOBAL_NAV = {
    DOUBAN_URL: "https://www.douban.com",
    N_NEW_NOTIS: 0,
    N_NEW_DOUMAIL: 0
  };
</script>



    <script src="//img3.doubanio.com/dae/accounts/resources/851ead1/shire/bundle.js" defer="defer"></script>




    



    <link href="//img3.doubanio.com/dae/accounts/resources/851ead1/movie/bundle.css" rel="stylesheet" type="text/css">




<div id="db-nav-movie" class="nav">
  <div class="nav-wrap">
  <div class="nav-primary">
    <div class="nav-logo">
      <a href="https://movie.douban.com">豆瓣电影</a>
    </div>
    <div class="nav-search">
      <form action="https://search.douban.com/movie/subject_search" method="get">
        <fieldset>
          <legend>搜索：</legend>
          <label for="inp-query">
          </label>
          <div class="inp"><input id="inp-query" name="search_text" size="22" maxlength="60" placeholder="搜索电影、电视剧、综艺、影人" value="" autocomplete="off"></div>
          <div class="inp-btn"><input type="submit" value="搜索"></div>
          <input type="hidden" name="cat" value="1002">
        </fieldset>
      </form>
    </div>
  </div>
  </div>
  <div class="nav-secondary">
    

<div class="nav-items">
  <ul>
    <li><a href="https://movie.douban.com/cinema/nowplaying/">影讯&amp;购票</a>
    </li>
    <li><a href="https://movie.douban.com/explore">选电影</a>
    </li>
    <li><a href="https://movie.douban.com/tv/">选剧集</a>
    </li>
    <li><a href="https://movie.douban.com/chart">排行榜</a>
    </li>
    <li><a href="https://movie.douban.com/review/best/">影评</a>
    </li>
    <li><a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;dt_from=movie_navigation">2024年度榜单</a>
    </li>
    <li><a href="https://c9.douban.com/app/standbyme-2024/?autorotate=false&amp;fullscreen=true&amp;hidenav=true&amp;monitor_screenshot=true&amp;df_from=web_navigation" target="_blank">2024年度报告</a>
    </li>
  </ul>
</div>

    <a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;source=movie_navigation_logo" class="movieannual"></a>
  </div>
</div>

<script id="suggResult" type="text/x-jquery-tmpl">
  <li data-link="{{= url}}">
            <a href="{{= url}}" onclick="moreurl(this, {from:'movie_search_sugg', query:'{{= keyword }}', subject_id:'{{= id}}', i: '{{= index}}', type: '{{= type}}'})">
            <img src="{{= img}}" width="40" />
            <p>
                <em>{{= title}}</em>
                {{if year}}
                    <span>{{= year}}</span>
                {{/if}}
                {{if sub_title}}
                    <br /><span>{{= sub_title}}</span>
                {{/if}}
                {{if address}}
                    <br /><span>{{= address}}</span>
                {{/if}}
                {{if episode}}
                    {{if episode=="unknow"}}
                        <br /><span>集数未知</span>
                    {{else}}
                        <br /><span>共{{= episode}}集</span>
                    {{/if}}
                {{/if}}
            </p>
        </a>
        </li>
  </script>




    <script src="//img3.doubanio.com/dae/accounts/resources/851ead1/movie/bundle.js" defer="defer"></script>





    
    <div id="wrapper">
        

        
    <div id="content">
        

        <div class="grid-16-8 clearfix">
            
    <div id="dale_movie_homepage_top_large" ad-status="loaded"></div>

            
            <div class="article">
                
    <script id="db-tmpl-subject-tip" type="text/x-jquery-tmpl">
        <div id="subject-tip">
            <div class="subject-tip-hd">
                <h3>{{= title}}<span class="release-year">{{= release}}</span></h3>
                <p class="star">
                    <span class="allstar{{= star}}"></span>
                    {{if star != '00' }}
                        <span class="subject-rating">{{= parseFloat(rate).toFixed(1)}}</span>
                    {{/if}}
                    {{if enough}}
                        <span class="rater-num">({{= rater}}人评价)</span>
                    {{/if}}
                </p>
            </div>
            <div class="subject-tip-bd">
                <ul>
                    <li><span>{{= duration}}</span><span>{{= type}}</span><span>{{= region}}</span></li>
                    <li class="director"><span class="label">导演</span><span>{{= director}}</span></li>
                    <li class="actors"><span class="label">主演</span><span>{{= actors}}</span></li>
                </ul>
                {{if intro}}
                    <div class="subject-intro">
                        {{= intro}}
                    </div>
                {{/if}}
            </div>
        </div>
    </script>

    

    
    
    
    <div id="screening" class="s" data-dstat-areaid="70" data-dstat-mode="click,expose">
        <div class="screening-hd">
                <div class="ui-slide-control">
                    <span class="prev-btn"><a class="btn-prev" href="javascript:void(0)"></a></span>
                    <span class="next-btn"><a class="btn-next" href="javascript:void(0)"></a></span>
                </div>
                <div class="slide-tip"><span class="ui-slide-index">1</span> / <span class="ui-slide-max">8</span></div>
            <h2>正在热映<span><a onclick="moreurl(this, {from:'mv_l_a'})" href="/cinema/nowplaying/">全部正在热映»</a></span><span><a onclick="moreurl(this, {from:'mv_l_w'})" href="./later/">即将上映»</a></span></h2>
        </div>
        <div class="screening-bd">
            <ul class="ui-slide-content" data-slide-index="1" data-index-max="8" style="left: -700px;"><li class="ui-slide-item s" data-dstat-areaid="70_8" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="日本的西多妮 Sidonie au Japon" data-release="2023" data-rate="5.8" data-star="30" data-trailer="https://movie.douban.com/subject/35430651/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35430651" data-duration="95分钟" data-region="法国" data-director="厄利斯·吉拉德" data-actors="伊莎贝尔·于佩尔 / 伊原刚志 / 奥古斯特·迪赫" data-intro="" data-enough="true" data-rater="910">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35430651/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2905101063.webp" alt="日本的西多妮" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35430651/?from=showing">日本的西多妮...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35430651" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="惺惺相惜 Sauvages" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/35730137/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35730137" data-duration="87分钟" data-region="瑞士" data-director="克洛德·巴拉斯" data-actors="Babette / Martin / 利蒂希亚·多施" data-intro="" data-enough="false" data-rater="108">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35730137/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920483840.webp" alt="惺惺相惜" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35730137/?from=showing">惺惺相惜</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35730137" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="我的马塞洛 Marcello Mio" data-release="2024" data-rate="5.9" data-star="30" data-trailer="https://movie.douban.com/subject/36117859/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36117859" data-duration="120分钟" data-region="法国" data-director="克里斯托夫·奥诺雷" data-actors="齐雅拉·马斯楚安尼 / 凯瑟琳·德纳芙 / 法布莱斯·鲁奇尼" data-intro="" data-enough="true" data-rater="880">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36117859/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2907625924.webp" alt="我的马塞洛" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36117859/?from=showing">我的马塞洛</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.9</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36117859" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="三个火枪手：米莱迪 Les Trois Mousquetaires: Milady" data-release="2023" data-rate="5.8" data-star="30" data-trailer="https://movie.douban.com/subject/35360551/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35360551" data-duration="" data-region="法国" data-director="马丁·布尔布隆" data-actors="伊娃·格林 / 文森特·卡索 / 薇姬·克里普斯" data-intro="" data-enough="true" data-rater="773">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35360551/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2908207508.webp" alt="三个火枪手：米莱迪" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35360551/?from=showing">三个火枪手：...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35360551" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="潮" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36909229/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36909229" data-duration="92分钟" data-region="中国大陆" data-director="万波" data-actors="王铮 / 刘陆 / 陈雨浓" data-intro="" data-enough="false" data-rater="859">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36909229/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2918487354.webp" alt="潮" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36909229/?from=showing">潮</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36909229" target="_blank">选座购票</a></span></li>
                        </ul>
            </li>
                        
                        
                    <li class="ui-slide-item s" data-dstat-areaid="70_1" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="大风杀" data-release="2025" data-rate="7.0" data-star="35" data-trailer="https://movie.douban.com/subject/36512371/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36512371" data-duration="131分钟" data-region="中国大陆" data-director="张琪" data-actors="白客 / 辛柏青 / 郎月婷" data-intro="" data-enough="true" data-rater="33036">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36512371/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921057784.webp" alt="大风杀" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36512371/?from=showing">大风杀</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">7.0</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36512371" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="水饺皇后" data-release="2025" data-rate="6.6" data-star="35" data-trailer="https://movie.douban.com/subject/33414470/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=33414470" data-duration="119分钟" data-region="中国大陆" data-director="刘伟强" data-actors="马丽 / 惠英红 / 朱亚文" data-intro="" data-enough="true" data-rater="50611">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/33414470/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919557624.webp" alt="水饺皇后" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/33414470/?from=showing">水饺皇后</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.6</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=33414470" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="雷霆特攻队* Thunderbolts*" data-release="2025" data-rate="6.8" data-star="35" data-trailer="https://movie.douban.com/subject/35927475/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35927475" data-duration="127分钟" data-region="美国" data-director="杰克·施莱尔" data-actors="弗洛伦丝·皮尤 / 塞巴斯蒂安·斯坦 / 茱莉亚·路易斯-德瑞弗斯" data-intro="" data-enough="true" data-rater="51285">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35927475/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920193988.webp" alt="雷霆特攻队*" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35927475/?from=showing">雷霆特攻队*...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35927475" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="幽灵公主 もののけ姫" data-release="1997" data-rate="8.9" data-star="45" data-trailer="https://movie.douban.com/subject/1297359/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=1297359" data-duration="134分钟" data-region="日本" data-director="宫崎骏" data-actors="松田洋治 / 石田百合子 / 田中裕子" data-intro="人与自然的战争史诗。" data-enough="true" data-rater="612398">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/1297359/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920895053.webp" alt="幽灵公主" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/1297359/?from=showing">幽灵公主</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.9</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=1297359" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="猎金游戏" data-release="2025" data-rate="6.3" data-star="35" data-trailer="https://movie.douban.com/subject/35929258/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35929258" data-duration="129分钟" data-region="中国大陆" data-director="邱礼涛" data-actors="刘德华 / 欧豪 / 倪妮" data-intro="" data-enough="true" data-rater="20318">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35929258/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920302215.webp" alt="猎金游戏" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35929258/?from=showing">猎金游戏</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.3</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35929258" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_2" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="人生开门红" data-release="2025" data-rate="6.6" data-star="35" data-trailer="https://movie.douban.com/subject/36988926/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36988926" data-duration="114分钟" data-region="中国大陆" data-director="易小星" data-actors="常远 / 邓家佳 / 王耀庆" data-intro="" data-enough="true" data-rater="18217">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36988926/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921314015.webp" alt="人生开门红" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36988926/?from=showing">人生开门红</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.6</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36988926" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="孤独摇滚(上) 劇場総集編ぼっち・ざ・ろっく！ Re:" data-release="2024" data-rate="8.2" data-star="45" data-trailer="https://movie.douban.com/subject/36415357/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36415357" data-duration="90分钟(中国大陆)" data-region="日本" data-director="斋藤圭一郎" data-actors="青山吉能 / 铃代纱弓 / 水野朔" data-intro="" data-enough="true" data-rater="7520">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36415357/?from=showing">
                                    <img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920430281.webp" alt="孤独摇滚(上)" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36415357/?from=showing">孤独摇滚(上...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.2</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36415357" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="苍茫的天涯是我的爱" data-release="2025" data-rate="5.8" data-star="30" data-trailer="https://movie.douban.com/subject/36978067/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36978067" data-duration="108分钟" data-region="中国大陆" data-director="陈孝良" data-actors="曾毅 / 周奇 / 孙艺洲" data-intro="" data-enough="true" data-rater="10831">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36978067/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920694943.webp" alt="苍茫的天涯是我的爱" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36978067/?from=showing">苍茫的天涯是...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36978067" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="荒蛮故事 Relatos salvajes" data-release="2014" data-rate="8.8" data-star="45" data-trailer="https://movie.douban.com/subject/24750126/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=24750126" data-duration="122分钟" data-region="阿根廷" data-director="达米安·斯兹弗隆" data-actors="达里奥·葛兰帝内提 / 玛丽娅·玛努尔 / 莫妮卡·维拉" data-intro="始于荒诞，止于更荒诞。" data-enough="true" data-rater="498828">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/24750126/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919686972.webp" alt="荒蛮故事" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/24750126/?from=showing">荒蛮故事</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=24750126" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="孤独的美食家 剧场版 劇映画 孤独のグルメ" data-release="2024" data-rate="8.1" data-star="40" data-trailer="https://movie.douban.com/subject/36959346/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36959346" data-duration="110分钟" data-region="日本" data-director="松重丰" data-actors="松重丰 / 内田有纪 / 矶村勇斗" data-intro="" data-enough="true" data-rater="15722">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36959346/?from=showing">
                                    <img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919802971.webp" alt="孤独的美食家 剧场版" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36959346/?from=showing">孤独的美食家...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">8.1</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36959346" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_3" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="黎明的一切 夜明けのすべて" data-release="2024" data-rate="7.8" data-star="40" data-trailer="https://movie.douban.com/subject/36135198/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36135198" data-duration="120分钟" data-region="日本" data-director="三宅唱" data-actors="松村北斗 / 上白石萌音 / 涩川清彦" data-intro="" data-enough="true" data-rater="25455">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36135198/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919738979.webp" alt="黎明的一切" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36135198/?from=showing">黎明的一切</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">7.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36135198" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="向阳·花" data-release="2025" data-rate="6.4" data-star="35" data-trailer="https://movie.douban.com/subject/36954004/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36954004" data-duration="124分钟" data-region="中国大陆" data-director="冯小刚" data-actors="赵丽颖 / 兰西雅 / 啜妮" data-intro="" data-enough="true" data-rater="89997">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36954004/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2918982408.webp" alt="向阳·花" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36954004/?from=showing">向阳·花</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.4</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36954004" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="地上的云朵" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36075486/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36075486" data-duration="85分钟" data-region="中国大陆" data-director="刘帼轶" data-actors="艾尔肯 / 管小燕" data-intro="" data-enough="false" data-rater="182">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36075486/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920898753.webp" alt="地上的云朵" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36075486/?from=showing">地上的云朵</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36075486" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="怒火营救" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/37006395/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=37006395" data-duration="88分钟" data-region="中国大陆" data-director="王清亭" data-actors="陈虎 / 母其弥雅 / 王清亭" data-intro="" data-enough="false" data-rater="42">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/37006395/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2921194500.webp" alt="怒火营救" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/37006395/?from=showing">怒火营救</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=37006395" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="我的世界大电影 A Minecraft Movie" data-release="2025" data-rate="5.7" data-star="30" data-trailer="https://movie.douban.com/subject/26149750/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=26149750" data-duration="101分钟" data-region="美国" data-director="杰瑞德·赫斯" data-actors="杰森·莫玛 / 杰克·布莱克 / 塞巴斯蒂安·尤金·汉森" data-intro="" data-enough="true" data-rater="30489">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/26149750/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919803217.webp" alt="我的世界大电影" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/26149750/?from=showing">我的世界大电...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.7</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=26149750" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_4" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="不说话的爱" data-release="2025" data-rate="7.0" data-star="35" data-trailer="https://movie.douban.com/subject/35907663/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35907663" data-duration="111分钟" data-region="中国大陆" data-director="沙漠" data-actors="张艺兴 / 李珞桉 / 黄尧" data-intro="" data-enough="true" data-rater="43807">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35907663/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919278762.webp" alt="不说话的爱" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35907663/?from=showing">不说话的爱</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">7.0</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35907663" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="摇滚诗人：未知的传奇 A Complete Unknown" data-release="2024" data-rate="6.5" data-star="35" data-trailer="https://movie.douban.com/subject/34940704/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=34940704" data-duration="141分钟" data-region="美国" data-director="詹姆斯·曼高德" data-actors="提莫西·查拉梅 / 爱德华·诺顿 / 艾丽·范宁" data-intro="" data-enough="true" data-rater="12144">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/34940704/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920430814.webp" alt="摇滚诗人：未知的传奇" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/34940704/?from=showing">摇滚诗人：未...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.5</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=34940704" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="此心安处 Here" data-release="2024" data-rate="7.4" data-star="40" data-trailer="https://movie.douban.com/subject/35782224/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35782224" data-duration="104分钟" data-region="美国" data-director="罗伯特·泽米吉斯" data-actors="汤姆·汉克斯 / 罗宾·怀特 / 保罗·贝坦尼" data-intro="" data-enough="true" data-rater="12181">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35782224/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919083962.webp" alt="此心安处" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35782224/?from=showing">此心安处</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">7.4</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35782224" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="猎狐·行动" data-release="2025" data-rate="4.6" data-star="25" data-trailer="https://movie.douban.com/subject/26938697/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=26938697" data-duration="105分钟" data-region="中国大陆" data-director="张立嘉" data-actors="段奕宏 / 梁朝伟 / 夏侯云姗" data-intro="" data-enough="true" data-rater="10010">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/26938697/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919832188.webp" alt="猎狐·行动" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/26938697/?from=showing">猎狐·行动</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar25"></span><span class="subject-rate">4.6</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=26938697" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="有病才会喜欢你 有病才會喜歡你" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36803483/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36803483" data-duration="111分钟" data-region="中国台湾" data-director="许富翔" data-actors="詹怀云 / 江齐 / 刘修甫" data-intro="" data-enough="false" data-rater="1267">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36803483/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920076467.webp" alt="有病才会喜欢你" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36803483/?from=showing">有病才会喜欢...</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36803483" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_5" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="海底小纵队：海啸大危机" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/37298398/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=37298398" data-duration="" data-region="中国大陆" data-director="虞嘉尧" data-actors="" data-intro="" data-enough="false" data-rater="379">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/37298398/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919980437.webp" alt="海底小纵队：海啸大危机" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/37298398/?from=showing">海底小纵队：...</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=37298398" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="开心超人之逆世营救" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36851305/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36851305" data-duration="99分钟" data-region="中国大陆" data-director="黄伟明" data-actors="刘红韵 / 祖晴 / 严彦子" data-intro="" data-enough="false" data-rater="239">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36851305/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920250165.webp" alt="开心超人之逆世营救" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36851305/?from=showing">开心超人之逆...</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36851305" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="机动战士高达：跨时之战 機動戦士Gundam GQuuuuuuX -Beginning-" data-release="2025" data-rate="6.7" data-star="35" data-trailer="https://movie.douban.com/subject/37143373/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=37143373" data-duration="82分钟" data-region="日本" data-director="鹤卷和哉" data-actors="黑泽朋世 / 石川由依 / 土屋神叶" data-intro="" data-enough="true" data-rater="9639">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/37143373/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919535626.webp" alt="机动战士高达：跨时之战" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/37143373/?from=showing">机动战士高达...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.7</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=37143373" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="猫猫的奇幻漂流 Straume" data-release="2024" data-rate="8.5" data-star="45" data-trailer="https://movie.douban.com/subject/35603727/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35603727" data-duration="85分钟" data-region="拉脱维亚" data-director="金兹·兹巴洛迪斯" data-actors="" data-intro="" data-enough="true" data-rater="124444">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35603727/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2917594343.webp" alt="猫猫的奇幻漂流" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35603727/?from=showing">猫猫的奇幻漂...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.5</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35603727" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="荣耀" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36597308/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36597308" data-duration="" data-region="中国大陆" data-director="常晓阳" data-actors="李健 / 刘筠燃 / 董李无忧" data-intro="" data-enough="false" data-rater="51">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36597308/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2913774287.webp" alt="荣耀" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36597308/?from=showing">荣耀</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36597308" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_6" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="午时三刻" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36097598/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36097598" data-duration="90分钟" data-region="中国大陆" data-director="童辉" data-actors="罗立群 / 黄小超 / 刘官琪" data-intro="" data-enough="false" data-rater="754">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36097598/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2913620444.webp" alt="午时三刻" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36097598/?from=showing">午时三刻</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36097598" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="速度与激情7 Furious 7" data-release="2015" data-rate="8.4" data-star="45" data-trailer="https://movie.douban.com/subject/23761370/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=23761370" data-duration="137分钟" data-region="美国" data-director="温子仁" data-actors="范·迪塞尔 / 保罗·沃克 / 杰森·斯坦森" data-intro="" data-enough="true" data-rater="501210">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/23761370/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919524094.webp" alt="速度与激情7" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/23761370/?from=showing">速度与激情7...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.4</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=23761370" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="基督山伯爵 Le Comte de Monte-Cristo" data-release="2024" data-rate="6.6" data-star="35" data-trailer="https://movie.douban.com/subject/36284215/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36284215" data-duration="178分钟" data-region="法国" data-director="亚历山大·德·拉·巴特里耶" data-actors="皮埃尔·尼内 / 阿娜伊斯·德穆斯蒂埃 / 皮耶尔弗兰切斯科·法维诺" data-intro="" data-enough="true" data-rater="9059">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36284215/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2907276940.webp" alt="基督山伯爵" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36284215/?from=showing">基督山伯爵</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.6</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36284215" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="火星特快 Mars Express" data-release="2023" data-rate="8.1" data-star="40" data-trailer="https://movie.douban.com/subject/35691849/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35691849" data-duration="85分钟" data-region="法国" data-director="杰里米·佩林" data-actors="蕾雅·德吕盖 / 马修·阿马立克 / 丹尼尔·洛贝" data-intro="" data-enough="true" data-rater="16060">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35691849/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2891905146.webp" alt="火星特快" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35691849/?from=showing">火星特快</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">8.1</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35691849" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="感谢生命中有个你" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/37337603/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=37337603" data-duration="85分钟" data-region="中国大陆" data-director="秦宇" data-actors="秦宇 / 李芷珺 / 英壮" data-intro="" data-enough="false" data-rater="0">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/37337603/?from=showing">
                                    <img src="https://img2.doubanio.com/cuphead/movie-static/pics/movie_default_large.png" alt="感谢生命中有个你" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/37337603/?from=showing">感谢生命中有...</a>
                                    <span class="new-show"></span>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=37337603" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_7" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="动物王国 Le règne animal" data-release="2023" data-rate="7.3" data-star="40" data-trailer="https://movie.douban.com/subject/35779956/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35779956" data-duration="128分钟" data-region="法国" data-director="托马斯·卡耶" data-actors="罗曼·杜里斯 / 保罗·基尔舍 / 阿黛尔·艾克萨勒霍布洛斯" data-intro="" data-enough="true" data-rater="10530">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35779956/?from=showing">
                                    <img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2902844121.webp" alt="动物王国" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35779956/?from=showing">动物王国</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">7.3</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35779956" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="夜半凶宅" data-release="2025" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/34800604/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=34800604" data-duration="" data-region="中国大陆" data-director="王盈希" data-actors="陈美行 / 王成钧 / 孙杨" data-intro="" data-enough="false" data-rater="172">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/34800604/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2917516472.webp" alt="夜半凶宅" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/34800604/?from=showing">夜半凶宅</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=34800604" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="我的罪行 Mon Crime" data-release="2023" data-rate="7.4" data-star="40" data-trailer="https://movie.douban.com/subject/35891597/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35891597" data-duration="102分钟" data-region="法国" data-director="弗朗索瓦·欧容" data-actors="娜迪亚·特列什科维奇 / 丽贝卡·马德 / 伊莎贝尔·于佩尔" data-intro="" data-enough="true" data-rater="8859">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35891597/?from=showing">
                                    <img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2886288431.webp" alt="我的罪行" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35891597/?from=showing">我的罪行</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar40"></span><span class="subject-rate">7.4</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35891597" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="天啦 Vingt Dieux" data-release="2024" data-rate="6.9" data-star="35" data-trailer="https://movie.douban.com/subject/36721134/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36721134" data-duration="90分钟" data-region="法国" data-director="路易丝·库沃西耶" data-actors="迈文娜·巴泰勒米 / Dimitri / Mathis" data-intro="" data-enough="true" data-rater="791">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36721134/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915148249.webp" alt="天啦" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36721134/?from=showing">天啦</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.9</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36721134" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="波尔多囚犯 La prisonnière de Bordeaux" data-release="2024" data-rate="7.1" data-star="35" data-trailer="https://movie.douban.com/subject/35943271/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35943271" data-duration="108分钟" data-region="法国" data-director="帕特里西亚·玛佐" data-actors="伊莎贝尔·于佩尔 / 阿弗西娅·埃尔奇 / Noor" data-intro="" data-enough="true" data-rater="2249">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35943271/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2910406938.webp" alt="波尔多囚犯" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35943271/?from=showing">波尔多囚犯</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">7.1</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35943271" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item s" data-dstat-areaid="70_8" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="日本的西多妮 Sidonie au Japon" data-release="2023" data-rate="5.8" data-star="30" data-trailer="https://movie.douban.com/subject/35430651/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35430651" data-duration="95分钟" data-region="法国" data-director="厄利斯·吉拉德" data-actors="伊莎贝尔·于佩尔 / 伊原刚志 / 奥古斯特·迪赫" data-intro="" data-enough="true" data-rater="910">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35430651/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2905101063.webp" alt="日本的西多妮" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35430651/?from=showing">日本的西多妮...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35430651" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="惺惺相惜 Sauvages" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/35730137/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35730137" data-duration="87分钟" data-region="瑞士" data-director="克洛德·巴拉斯" data-actors="Babette / Martin / 利蒂希亚·多施" data-intro="" data-enough="false" data-rater="108">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35730137/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920483840.webp" alt="惺惺相惜" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35730137/?from=showing">惺惺相惜</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35730137" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="我的马塞洛 Marcello Mio" data-release="2024" data-rate="5.9" data-star="30" data-trailer="https://movie.douban.com/subject/36117859/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36117859" data-duration="120分钟" data-region="法国" data-director="克里斯托夫·奥诺雷" data-actors="齐雅拉·马斯楚安尼 / 凯瑟琳·德纳芙 / 法布莱斯·鲁奇尼" data-intro="" data-enough="true" data-rater="880">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36117859/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2907625924.webp" alt="我的马塞洛" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36117859/?from=showing">我的马塞洛</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.9</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36117859" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="三个火枪手：米莱迪 Les Trois Mousquetaires: Milady" data-release="2023" data-rate="5.8" data-star="30" data-trailer="https://movie.douban.com/subject/35360551/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35360551" data-duration="" data-region="法国" data-director="马丁·布尔布隆" data-actors="伊娃·格林 / 文森特·卡索 / 薇姬·克里普斯" data-intro="" data-enough="true" data-rater="773">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35360551/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2908207508.webp" alt="三个火枪手：米莱迪" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35360551/?from=showing">三个火枪手：...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar30"></span><span class="subject-rate">5.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35360551" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="潮" data-release="2024" data-rate="" data-star="00" data-trailer="https://movie.douban.com/subject/36909229/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36909229" data-duration="92分钟" data-region="中国大陆" data-director="万波" data-actors="王铮 / 刘陆 / 陈雨浓" data-intro="" data-enough="false" data-rater="859">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36909229/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2918487354.webp" alt="潮" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36909229/?from=showing">潮</a>
                            </li>
                            <li>
                                    

                                        <span class="text-tip">暂无评分</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36909229" target="_blank">选座购票</a></span></li>
                        </ul>
            </li><li class="ui-slide-item s" data-dstat-areaid="70_1" data-dstat-mode="click,expose" data-dstat-watch=".ui-slide-content" data-dstat-viewport=".screening-bd" data-title="大风杀" data-release="2025" data-rate="7.0" data-star="35" data-trailer="https://movie.douban.com/subject/36512371/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=36512371" data-duration="131分钟" data-region="中国大陆" data-director="张琪" data-actors="白客 / 辛柏青 / 郎月婷" data-intro="" data-enough="true" data-rater="33036">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/36512371/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921057784.webp" alt="大风杀" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/36512371/?from=showing">大风杀</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">7.0</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=36512371" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="水饺皇后" data-release="2025" data-rate="6.6" data-star="35" data-trailer="https://movie.douban.com/subject/33414470/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=33414470" data-duration="119分钟" data-region="中国大陆" data-director="刘伟强" data-actors="马丽 / 惠英红 / 朱亚文" data-intro="" data-enough="true" data-rater="50611">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/33414470/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919557624.webp" alt="水饺皇后" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/33414470/?from=showing">水饺皇后</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.6</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=33414470" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="雷霆特攻队* Thunderbolts*" data-release="2025" data-rate="6.8" data-star="35" data-trailer="https://movie.douban.com/subject/35927475/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35927475" data-duration="127分钟" data-region="美国" data-director="杰克·施莱尔" data-actors="弗洛伦丝·皮尤 / 塞巴斯蒂安·斯坦 / 茱莉亚·路易斯-德瑞弗斯" data-intro="" data-enough="true" data-rater="51285">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35927475/?from=showing">
                                    <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920193988.webp" alt="雷霆特攻队*" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35927475/?from=showing">雷霆特攻队*...</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.8</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35927475" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="幽灵公主 もののけ姫" data-release="1997" data-rate="8.9" data-star="45" data-trailer="https://movie.douban.com/subject/1297359/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=1297359" data-duration="134分钟" data-region="日本" data-director="宫崎骏" data-actors="松田洋治 / 石田百合子 / 田中裕子" data-intro="人与自然的战争史诗。" data-enough="true" data-rater="612398">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/1297359/?from=showing">
                                    <img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920895053.webp" alt="幽灵公主" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/1297359/?from=showing">幽灵公主</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar45"></span><span class="subject-rate">8.9</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=1297359" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li><li class="ui-slide-item" data-title="猎金游戏" data-release="2025" data-rate="6.3" data-star="35" data-trailer="https://movie.douban.com/subject/35929258/trailer" data-ticket="https://movie.douban.com/ticket/redirect/?movie_id=35929258" data-duration="129分钟" data-region="中国大陆" data-director="邱礼涛" data-actors="刘德华 / 欧豪 / 倪妮" data-intro="" data-enough="true" data-rater="20318">
                        <ul>
                            <li class="poster">
                                <a onclick="moreurl(this, {from:'mv_a_pst'})" href="https://movie.douban.com/subject/35929258/?from=showing">
                                    <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920302215.webp" alt="猎金游戏" rel="nofollow">
                                </a>
                            </li>
                            <li class="title">
                                <a onclick="moreurl(this, {from:'mv_a_tl'})" href="https://movie.douban.com/subject/35929258/?from=showing">猎金游戏</a>
                            </li>
                            <li>
                                    <span class="rating-star allstar35"></span><span class="subject-rate">6.3</span>
                            </li>
                                <li class="ticket_btn"><span><a onclick="moreurl(this, {from:'mv_b_tc'})" href="https://movie.douban.com/ticket/redirect/?movie_id=35929258" target="_blank">选座购票</a></span></li>
                        </ul>
                        
                        
                    </li></ul>
        </div>
    </div>
    <script src="https://img3.doubanio.com/cuphead/movie-static/common/slide.a4f13.js"></script>
    <script src="https://img3.doubanio.com/cuphead/movie-static/mod/subject_detail_tip.5d3fa.js"></script>
    <script src="https://img2.doubanio.com/cuphead/movie-static/gallery/index.75f9e.js"></script>
    <script>
        $(function(){
            var screeningSlide = new Slide({
                autoplay: true,
                wrap: $('#screening .screening-bd'),
                speed: 600,
                duration: 20000,
                itemsPerSlide: 5,
                lazyload: false
            });
            $('#screening .ui-slide-item img').subjectTip('.ui-slide-item', 'screening');
        });
    </script>


    <!-- douban ad begin -->
    <div id="movie_home_left_bottom" class="mb20 s" data-dstat-areaid="72" data-dstat-mode="click,expose" ad-status="loaded"></div>
    <!-- douban ad end -->
        <div id="recent-hot"><div class="recent-hot"><div class="recent-hot-movie"><div class="recent-hot-item is_movie"><div class="recent-hot-item-header"><div class="recent-hot-item-title">最近热门电影</div><div class="recent-hot-item-tags"><div class="recent-hot-item-tag tag-selected">热门</div><div class="recent-hot-item-tag">最新</div><div class="recent-hot-item-tag">豆瓣高分</div><div class="recent-hot-item-tag">冷门佳片</div><div class="recent-hot-item-tag">华语</div><div class="recent-hot-item-tag">欧美</div><div class="recent-hot-item-tag">韩国</div><div class="recent-hot-item-tag">日本</div></div><div class="recent-hot-item-more"><a href="/explore?support_type=movie&amp;is_all=false&amp;category=%E7%83%AD%E9%97%A8&amp;type=%E5%85%A8%E9%83%A8" target="_blank">更多»</a></div></div><div class="recent-hot-item-swiper swiper-container swiper-container-horizontal"><div class="swiper-wrapper" style="transform: translate3d(-675px, 0px, 0px); transition-duration: 0ms;"><div class="swiper-slide swiper-slide-duplicate swiper-slide-prev" data-swiper-slide-index="4" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36452788" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919174641.jpg" alt="评估"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">评估</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35815771" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2916533607.jpg" alt="误杀3"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">误杀3</span><span class="subject-card-item-rating-score">6.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36687720" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2911534490.jpg" alt="隔壁房间"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">隔壁房间</span><span class="subject-card-item-rating-score">7.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35087675" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2914269857.jpg" alt="毒液：最后一舞"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">毒液：最后一舞</span><span class="subject-card-item-rating-score">6.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36624248" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2910990607.jpg" alt="落凡尘"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">落凡尘</span><span class="subject-card-item-rating-score">7.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/27606065" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919389603.jpg" alt="电幻国度"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">电幻国度</span><span class="subject-card-item-rating-score">6.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35861916" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2912565143.jpg" alt="六个说谎的大学生"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">六个说谎的大学生</span><span class="subject-card-item-rating-score">5.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36421884" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2914777370.jpg" alt="焚城"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">焚城</span><span class="subject-card-item-rating-score">6.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36439490" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2913298291.jpg" alt="异教徒"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">异教徒</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36803039" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919344324.jpg" alt="便衣警察"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">便衣警察</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div></div><div class="swiper-slide swiper-slide-active" data-swiper-slide-index="0" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36776989" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918622737.jpg" alt="战·争"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">战·争</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35367384" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918852122.jpg" alt="毒劫"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">毒劫</span><span class="subject-card-item-rating-score">5.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36657738" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2905637791.jpg" alt="亲爱的家"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">亲爱的家</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36737061" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918395852.jpg" alt="直到黎明"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">直到黎明</span><span class="subject-card-item-rating-score">6.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36750653" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2906452100.jpg" alt="数分钟的赞歌"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">数分钟的赞歌</span><span class="subject-card-item-rating-score">6.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36282639" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2917556416.jpg" alt="唐探1900"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">唐探1900</span><span class="subject-card-item-rating-score">6.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36415357" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920430281.jpg" alt="孤独摇滚(上)"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">孤独摇滚(上)</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36680228" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2913920082.jpg" alt="最后的里程"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">最后的里程</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36960439" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2912425407.jpg" alt="昨日青春"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">昨日青春</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35948807" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915820688.jpg" alt="秘密会议"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">秘密会议</span><span class="subject-card-item-rating-score">7.5</span></span></div></a></div></div><div class="swiper-slide swiper-slide-next" data-swiper-slide-index="1" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36712987" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2915837972.jpg" alt="破·地狱"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">破·地狱</span><span class="subject-card-item-rating-score">8.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36787874" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2914398374.jpg" alt="隔空投送"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">隔空投送</span><span class="subject-card-item-rating-score">5.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36802241" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919972775.jpg" alt="新干线惊爆倒数"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">新干线惊爆倒数</span><span class="subject-card-item-rating-score">6.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35512487" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2921021260.jpg" alt="我仍在此"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">我仍在此</span><span class="subject-card-item-rating-score">7.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36253688" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2918193721.jpg" alt="爱的暂停键"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">爱的暂停键</span><span class="subject-card-item-rating-score">7.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35900116" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920421952.jpg" alt="再帮个小忙"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">再帮个小忙</span><span class="subject-card-item-rating-score">5.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/34429795" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2918518301.jpg" alt="编号17"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">编号17</span><span class="subject-card-item-rating-score">6.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/34940704" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920430814.jpg" alt="摇滚诗人：未知的传奇"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">摇滚诗人：未知的传奇</span><span class="subject-card-item-rating-score">6.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/30334963" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2910991612.jpg" alt="女儿的女儿"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">女儿的女儿</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35364691" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2917676972.jpg" alt="诡才之道"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">诡才之道</span><span class="subject-card-item-rating-score">7.7</span></span></div></a></div></div><div class="swiper-slide" data-swiper-slide-index="2" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36639612" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2914011396.jpg" alt="秋日何时来"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">秋日何时来</span><span class="subject-card-item-rating-score">8.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/30388206" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2916648316.jpg" alt="粗野派"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">粗野派</span><span class="subject-card-item-rating-score">7.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36934908" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915350868.jpg" alt="因果报应"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">因果报应</span><span class="subject-card-item-rating-score">8.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/26656728" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2910815887.jpg" alt="泳者之心"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">泳者之心</span><span class="subject-card-item-rating-score">9.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35603727" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2917594343.jpg" alt="猫猫的奇幻漂流"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">猫猫的奇幻漂流</span><span class="subject-card-item-rating-score">8.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36765646" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2914342253.jpg" alt="蓦然回首"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">蓦然回首</span><span class="subject-card-item-rating-score">8.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36618568" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2916309843.jpg" alt="无痛凯恩"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">无痛凯恩</span><span class="subject-card-item-rating-score">6.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36341345" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919354350.jpg" alt="独角兽之死"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">独角兽之死</span><span class="subject-card-item-rating-score">5.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35882838" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2912441039.jpg" alt="某种物质"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">某种物质</span><span class="subject-card-item-rating-score">7.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/33415953" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919596073.jpg" alt="制暴：无限杀机"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">制暴：无限杀机</span><span class="subject-card-item-rating-score">5.5</span></span></div></a></div></div><div class="swiper-slide" data-swiper-slide-index="3" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36248012" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915997930.jpg" alt="工作细胞 真人版"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">工作细胞 真人版</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36126098" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2921085850.jpg" alt="角头：大桥头"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">角头：大桥头</span><span class="subject-card-item-rating-score">5.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36467821" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2921273221.jpg" alt="蜗牛回忆录"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">蜗牛回忆录</span><span class="subject-card-item-rating-score">8.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35782224" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919083962.jpg" alt="此心安处"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">此心安处</span><span class="subject-card-item-rating-score">7.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35295339" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2916136841.jpg" alt="峡谷"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">峡谷</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36117334" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2917731188.jpg" alt="性梦爱三部曲：梦"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">性梦爱三部曲：梦</span><span class="subject-card-item-rating-score">8.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36195543" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2912764859.jpg" alt="阿诺拉"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">阿诺拉</span><span class="subject-card-item-rating-score">6.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36689857" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2913022141.jpg" alt="荒野机器人"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">荒野机器人</span><span class="subject-card-item-rating-score">8.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36851291" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918817493.jpg" alt="名侦探柯南：独眼的残像"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">名侦探柯南：独眼的残像</span><span class="subject-card-item-rating-score">7.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36421270" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2917240601.jpg" alt="完美伴侣"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">完美伴侣</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div></div><div class="swiper-slide swiper-slide-duplicate-prev" data-swiper-slide-index="4" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36452788" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919174641.jpg" alt="评估"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">评估</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35815771" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2916533607.jpg" alt="误杀3"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">误杀3</span><span class="subject-card-item-rating-score">6.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36687720" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2911534490.jpg" alt="隔壁房间"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">隔壁房间</span><span class="subject-card-item-rating-score">7.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35087675" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2914269857.jpg" alt="毒液：最后一舞"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">毒液：最后一舞</span><span class="subject-card-item-rating-score">6.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36624248" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2910990607.jpg" alt="落凡尘"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">落凡尘</span><span class="subject-card-item-rating-score">7.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/27606065" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919389603.jpg" alt="电幻国度"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">电幻国度</span><span class="subject-card-item-rating-score">6.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35861916" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2912565143.jpg" alt="六个说谎的大学生"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">六个说谎的大学生</span><span class="subject-card-item-rating-score">5.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36421884" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2914777370.jpg" alt="焚城"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">焚城</span><span class="subject-card-item-rating-score">6.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36439490" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2913298291.jpg" alt="异教徒"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">异教徒</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36803039" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919344324.jpg" alt="便衣警察"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">便衣警察</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div></div><div class="swiper-slide swiper-slide-duplicate swiper-slide-duplicate-active" data-swiper-slide-index="0" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36776989" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918622737.jpg" alt="战·争"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">战·争</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35367384" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918852122.jpg" alt="毒劫"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">毒劫</span><span class="subject-card-item-rating-score">5.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36657738" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2905637791.jpg" alt="亲爱的家"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">亲爱的家</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36737061" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918395852.jpg" alt="直到黎明"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">直到黎明</span><span class="subject-card-item-rating-score">6.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36750653" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2906452100.jpg" alt="数分钟的赞歌"></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">数分钟的赞歌</span><span class="subject-card-item-rating-score">6.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36282639" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2917556416.jpg" alt="唐探1900"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">唐探1900</span><span class="subject-card-item-rating-score">6.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36415357" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920430281.jpg" alt="孤独摇滚(上)"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">孤独摇滚(上)</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36680228" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2913920082.jpg" alt="最后的里程"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">最后的里程</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/36960439" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2912425407.jpg" alt="昨日青春"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">昨日青春</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/movie/35948807" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915820688.jpg" alt="秘密会议"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">秘密会议</span><span class="subject-card-item-rating-score">7.5</span></span></div></a></div></div></div><div class="swiper-nav"><div class="swiper-button-prev"></div><div class="swiper-pagination swiper-pagination-clickable swiper-pagination-bullets"><span class="swiper-pagination-bullet swiper-pagination-bullet-active"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span></div><div class="swiper-button-next"></div></div></div></div></div><div class="recent-hot-tv"><div class="recent-hot-item"><div class="recent-hot-item-header"><div class="recent-hot-item-title">最近热门电视剧</div><div class="recent-hot-item-tags"><div class="recent-hot-item-tag tag-selected">综合</div><div class="recent-hot-item-tag">国产剧</div><div class="recent-hot-item-tag">综艺</div><div class="recent-hot-item-tag">欧美剧</div><div class="recent-hot-item-tag">日剧</div><div class="recent-hot-item-tag">韩剧</div><div class="recent-hot-item-tag">动画</div><div class="recent-hot-item-tag">纪录片</div></div><div class="recent-hot-item-more"><a href="/tv?support_type=tv&amp;is_all=false&amp;category=tv&amp;type=tv" target="_blank">更多»</a></div></div><div class="recent-hot-item-swiper swiper-container swiper-container-horizontal"><div class="swiper-wrapper" style="transform: translate3d(-675px, 0px, 0px); transition-duration: 0ms;"><div class="swiper-slide swiper-slide-duplicate swiper-slide-prev" data-swiper-slide-index="4" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36139877" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918315047.jpg" alt="树下有片红房子"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">树下有片红房子</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/34908109" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920898301.jpg" alt="落花时节又逢君"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">落花时节又逢君</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35914829" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919073011.jpg" alt="安多 第二季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">安多 第二季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36404196" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2899317610.jpg" alt="仙台有树"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">仙台有树</span><span class="subject-card-item-rating-score">7.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36329086" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919791844.jpg" alt="你 第五季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">你 第五季</span><span class="subject-card-item-rating-score">7.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35874151" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2918313491.jpg" alt="难哄"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">难哄</span><span class="subject-card-item-rating-score">5.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/37260781" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920520077.jpg" alt="我的事说来话长～2025春～"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">我的事说来话长～2025春～</span><span class="subject-card-item-rating-score">8.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/37149182" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919490101.jpg" alt="泰版我让最想被拥抱的男人给威胁了"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">泰版我让最想被拥抱的男人给威胁了</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36723310" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920457675.jpg" alt="四季情"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">四季情</span><span class="subject-card-item-rating-score">7.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36449287" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918105112.jpg" alt="余烬之上"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">余烬之上</span><span class="subject-card-item-rating-score">7.2</span></span></div></a></div></div><div class="swiper-slide swiper-slide-active" data-swiper-slide-index="0" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35496391" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920419581.jpg" alt="无忧渡"><div class="subject-card-item-episodes-info">36集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">无忧渡</span><span class="subject-card-item-rating-score">7.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36656706" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920542088.jpg" alt="无尽的尽头"><div class="subject-card-item-episodes-info">24集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">无尽的尽头</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35923772" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920983910.jpg" alt="淮水竹亭"><div class="subject-card-item-episodes-info">更新至26集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">淮水竹亭</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36680595" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920558631.jpg" alt="蛮好的人生"><div class="subject-card-item-episodes-info">更新至34集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">蛮好的人生</span><span class="subject-card-item-rating-score">6.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36053256" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919197538.jpg" alt="苦尽柑来遇见你"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">苦尽柑来遇见你</span><span class="subject-card-item-rating-score">9.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36305412" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919690721.jpg" alt="沙尘暴"><div class="subject-card-item-episodes-info">12集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">沙尘暴</span><span class="subject-card-item-rating-score">8.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36653963" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920242376.jpg" alt="黑镜 第七季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">黑镜 第七季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36217758" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920433932.jpg" alt="借命而生"><div class="subject-card-item-episodes-info">13集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">借命而生</span><span class="subject-card-item-rating-score">6.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35633615" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920916026.jpg" alt="绝密较量"><div class="subject-card-item-episodes-info">更新至16集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">绝密较量</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36820950" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2918781186.jpg" alt="混沌少年时 第一季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">混沌少年时 第一季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div></div><div class="swiper-slide swiper-slide-next" data-swiper-slide-index="1" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36449461" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919567069.jpg" alt="棋士"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">棋士</span><span class="subject-card-item-rating-score">7.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36544596" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919524981.jpg" alt="恶缘"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">恶缘</span><span class="subject-card-item-rating-score">8.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35442247" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920826387.jpg" alt="狮城山海"><div class="subject-card-item-episodes-info">更新至22集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">狮城山海</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36516580" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919509359.jpg" alt="雁回时"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">雁回时</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35873709" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2909791091.jpg" alt="刑警的日子"><div class="subject-card-item-episodes-info">更新至10集</div></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">刑警的日子</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36209845" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2907293968.jpg" alt="念无双"><div class="subject-card-item-episodes-info">36集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">念无双</span><span class="subject-card-item-rating-score">6.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36883141" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918935503.jpg" alt="幸福伽菜子的快乐杀手生活"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">幸福伽菜子的快乐杀手生活</span><span class="subject-card-item-rating-score">8.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36230209" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2918873218.jpg" alt="白宫杀人事件"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">白宫杀人事件</span><span class="subject-card-item-rating-score">8.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36161782" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2917818973.jpg" alt="白莲花度假村 第三季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">白莲花度假村 第三季</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/37111999" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920954149.jpg" alt="姜颂"><div class="subject-card-item-episodes-info">更新至18集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">姜颂</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div></div><div class="swiper-slide" data-swiper-slide-index="2" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35693315" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2907282326.jpg" alt="北上"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">北上</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36678456" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919077718.jpg" alt="狂医魔徒"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">狂医魔徒</span><span class="subject-card-item-rating-score">8.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36221305" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919586166.jpg" alt="最后生还者 第二季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">最后生还者 第二季</span><span class="subject-card-item-rating-score">7.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36722432" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919591685.jpg" alt="比天堂还美丽"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">比天堂还美丽</span><span class="subject-card-item-rating-score">8.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36753435" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921230836.jpg" alt="执法者们"><div class="subject-card-item-episodes-info">更新至6集</div></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">执法者们</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36449849" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2909784518.jpg" alt="亲爱的仇敌"><div class="subject-card-item-episodes-info">更新至6集</div></div><div class="subject-card-item-info"><div class="subject-card-item-new">新</div><span class="subject-card-item-title"><span class="subject-card-item-title-text">亲爱的仇敌</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36782612" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919300890.jpg" alt="善意的竞争"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">善意的竞争</span><span class="subject-card-item-rating-score">8.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36553916" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918640953.jpg" alt="滤镜"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">滤镜</span><span class="subject-card-item-rating-score">7.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36406476" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919785185.jpg" alt="画江湖之不良人7"><div class="subject-card-item-episodes-info">更新至8集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">画江湖之不良人7</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36652878" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920831247.jpg" alt="榜上佳婿"><div class="subject-card-item-episodes-info">更新至27集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">榜上佳婿</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div></div><div class="swiper-slide" data-swiper-slide-index="3" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36250591" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920022670.jpg" alt="乌云之上"><div class="subject-card-item-episodes-info">17集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">乌云之上</span><span class="subject-card-item-rating-score">6.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36512372" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919361401.jpg" alt="黄雀"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">黄雀</span><span class="subject-card-item-rating-score">7.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36691469" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2919302033.jpg" alt="掩耳盗邻 第一季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">掩耳盗邻 第一季</span><span class="subject-card-item-rating-score">8.3</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36467839" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919948836.jpg" alt="永航员 第一季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">永航员 第一季</span><span class="subject-card-item-rating-score">6.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36563542" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920453377.jpg" alt="悬镜"><div class="subject-card-item-episodes-info">18集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">悬镜</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36484600" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2912843417.jpg" alt="以美之名"><div class="subject-card-item-episodes-info">29集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">以美之名</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35567827" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921047726.jpg" alt="灭罪"><div class="subject-card-item-episodes-info">24集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">灭罪</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36722668" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919964308.jpg" alt="值得爱"><div class="subject-card-item-episodes-info">26集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">值得爱</span><span class="subject-card-item-rating-score">6.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/26920387" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2918882215.jpg" alt="爱你"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">爱你</span><span class="subject-card-item-rating-score">6.8</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35634021" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919473910.jpg" alt="三命"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">三命</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div></div><div class="swiper-slide swiper-slide-duplicate-prev" data-swiper-slide-index="4" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36139877" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918315047.jpg" alt="树下有片红房子"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">树下有片红房子</span><span class="subject-card-item-rating-score">7.9</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/34908109" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920898301.jpg" alt="落花时节又逢君"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">落花时节又逢君</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35914829" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919073011.jpg" alt="安多 第二季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">安多 第二季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36404196" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2899317610.jpg" alt="仙台有树"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">仙台有树</span><span class="subject-card-item-rating-score">7.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36329086" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2919791844.jpg" alt="你 第五季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">你 第五季</span><span class="subject-card-item-rating-score">7.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35874151" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2918313491.jpg" alt="难哄"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">难哄</span><span class="subject-card-item-rating-score">5.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/37260781" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920520077.jpg" alt="我的事说来话长～2025春～"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">我的事说来话长～2025春～</span><span class="subject-card-item-rating-score">8.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/37149182" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919490101.jpg" alt="泰版我让最想被拥抱的男人给威胁了"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">泰版我让最想被拥抱的男人给威胁了</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36723310" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920457675.jpg" alt="四季情"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">四季情</span><span class="subject-card-item-rating-score">7.6</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36449287" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918105112.jpg" alt="余烬之上"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">余烬之上</span><span class="subject-card-item-rating-score">7.2</span></span></div></a></div></div><div class="swiper-slide swiper-slide-duplicate swiper-slide-duplicate-active" data-swiper-slide-index="0" style="width: 675px;"><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35496391" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920419581.jpg" alt="无忧渡"><div class="subject-card-item-episodes-info">36集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">无忧渡</span><span class="subject-card-item-rating-score">7.4</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36656706" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920542088.jpg" alt="无尽的尽头"><div class="subject-card-item-episodes-info">24集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">无尽的尽头</span><span class="subject-card-item-rating-score">8.2</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35923772" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2920983910.jpg" alt="淮水竹亭"><div class="subject-card-item-episodes-info">更新至26集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">淮水竹亭</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36680595" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920558631.jpg" alt="蛮好的人生"><div class="subject-card-item-episodes-info">更新至34集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">蛮好的人生</span><span class="subject-card-item-rating-score">6.1</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36053256" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2919197538.jpg" alt="苦尽柑来遇见你"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">苦尽柑来遇见你</span><span class="subject-card-item-rating-score">9.5</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36305412" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2919690721.jpg" alt="沙尘暴"><div class="subject-card-item-episodes-info">12集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">沙尘暴</span><span class="subject-card-item-rating-score">8.0</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36653963" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920242376.jpg" alt="黑镜 第七季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">黑镜 第七季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36217758" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920433932.jpg" alt="借命而生"><div class="subject-card-item-episodes-info">13集全</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">借命而生</span><span class="subject-card-item-rating-score">6.7</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/35633615" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2920916026.jpg" alt="绝密较量"><div class="subject-card-item-episodes-info">更新至16集</div></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">绝密较量</span><span class="subject-card-item-rating-score subject-card-item-rating-score-zero">暂无评分</span></span></div></a></div><div class="subject-card"><a href="https://www.douban.com/doubanapp/dispatch?uri=/tv/36820950" class="subject-card-item"><div class="subject-card-item-cover"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2918781186.jpg" alt="混沌少年时 第一季"></div><div class="subject-card-item-info"><span class="subject-card-item-title"><span class="subject-card-item-title-text">混沌少年时 第一季</span><span class="subject-card-item-rating-score">8.7</span></span></div></a></div></div></div><div class="swiper-nav"><div class="swiper-button-prev"></div><div class="swiper-pagination swiper-pagination-clickable swiper-pagination-bullets"><span class="swiper-pagination-bullet swiper-pagination-bullet-active"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span><span class="swiper-pagination-bullet"></span></div><div class="swiper-button-next"></div></div></div></div></div></div></div>
        
        
<link rel="stylesheet" href="https://img3.doubanio.com/cuphead/movie-static/gallery/index.3f4ef.css">
<div id="gallery-frames">
    <div class="gallery-hd">
            <div class="gallery-ui-slide-control">
                <span class="prev-btn"><a class="gallery-btn-prev" href="javascript:void(0)"></a></span>
                <span class="next-btn"><a class="gallery-btn-next" href="javascript:void(0)"></a></span>
            </div>
            <div class="slide-tip"><span class="gallery-ui-slide-index">2</span> / <span class="gallery-ui-slide-max">2</span></div>
            <h2>热门推荐</h2>
    </div>
    <div id="hot-gallery">
        <ul class="ui-slide-content" style="left: -1350px;"><li class="ui-slide-item">
                    
<div class="gallery-frame">
        <a href="https://m.douban.com/page2/XW55qbNkdKkI3wM?fullscreen=1&amp;dt_dapp=1?from=gallery" target="_blank" data-fid="3826">
            <img src="https://img9.doubanio.com/view/movie_gallery_frame_hot_rec/m/public/69aed4e75516965.jpg" alt="定格于她｜豆瓣2024年度女性影人访谈" width="350" height="240">
        </a>
    <div class="gallery-detail">
        <div class="gallery-hd">
                <a href="https://m.douban.com/page2/XW55qbNkdKkI3wM?fullscreen=1&amp;dt_dapp=1?from=gallery" target="_blank" data-fid="3826">
                    <h3>定格于她｜豆瓣2024年度女性影人访谈</h3>
                </a>
        </div>
        <div class="gallery-bd">
            <p>
                年度焦点，定格于她。
            </p>
        </div>
    </div>
</div>

                </li>
                <li class="ui-slide-item">
                    
<div class="gallery-frame">
        <a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;dt_from=doubanmovie?from=gallery" target="_blank" data-fid="3824">
            <img src="https://img2.doubanio.com/view/movie_gallery_frame_hot_rec/m/public/488bb42f0ea9b51.jpg" alt="「豆瓣2024年度电影榜单」正式上线" width="350" height="240">
        </a>
    <div class="gallery-detail">
        <div class="gallery-hd">
                <a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;dt_from=doubanmovie?from=gallery" target="_blank" data-fid="3824">
                    <h3>「豆瓣2024年度电影榜单」正式上线</h3>
                </a>
        </div>
        <div class="gallery-bd">
            <p>
                点击查看完整榜单，开启全年好片、佳剧大赏。友情提示：文末可测你的年度电影人格！
            </p>
        </div>
    </div>
</div>

                </li>
                <li class="ui-slide-item">
                    
<div class="gallery-frame">
        <a href="https://m.douban.com/page2/XW55qbNkdKkI3wM?fullscreen=1&amp;dt_dapp=1?from=gallery" target="_blank" data-fid="3826">
            <img src="https://img9.doubanio.com/view/movie_gallery_frame_hot_rec/m/public/69aed4e75516965.jpg" alt="定格于她｜豆瓣2024年度女性影人访谈" width="350" height="240">
        </a>
    <div class="gallery-detail">
        <div class="gallery-hd">
                <a href="https://m.douban.com/page2/XW55qbNkdKkI3wM?fullscreen=1&amp;dt_dapp=1?from=gallery" target="_blank" data-fid="3826">
                    <h3>定格于她｜豆瓣2024年度女性影人访谈</h3>
                </a>
        </div>
        <div class="gallery-bd">
            <p>
                年度焦点，定格于她。
            </p>
        </div>
    </div>
</div>

                </li>
        <li class="ui-slide-item">
                    
<div class="gallery-frame">
        <a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;dt_from=doubanmovie?from=gallery" target="_blank" data-fid="3824">
            <img src="https://img2.doubanio.com/view/movie_gallery_frame_hot_rec/m/public/488bb42f0ea9b51.jpg" alt="「豆瓣2024年度电影榜单」正式上线" width="350" height="240">
        </a>
    <div class="gallery-detail">
        <div class="gallery-hd">
                <a href="https://movie.douban.com/annual/2024/?fullscreen=1&amp;dt_from=doubanmovie?from=gallery" target="_blank" data-fid="3824">
                    <h3>「豆瓣2024年度电影榜单」正式上线</h3>
                </a>
        </div>
        <div class="gallery-bd">
            <p>
                点击查看完整榜单，开启全年好片、佳剧大赏。友情提示：文末可测你的年度电影人格！
            </p>
        </div>
    </div>
</div>

                </li></ul>
    </div>
</div>


    

    
    
    
    <div id="reviews" data-dstat-areaid="77" data-dstat-mode="click,expose">
        <div class="reviews-hd">
            <h2>最受欢迎的影评<span><a href="/review/best/">更多热门影评»</a></span><span><a href="/review/latest/">新片影评»</a></span></h2>
        </div>
        <div class="reviews-bd">
                
    <div class="review ">
        <div class="review-hd">
            <a href="https://movie.douban.com/subject/36415357/?from=reviews">
                <img class="lazy" data-original="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920430281.webp" src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2920430281.webp" alt="孤独摇滚(上)" style="display: inline;">
            </a>
        </div>
        <div class="review-bd">
            <h3><a href="https://movie.douban.com/review/16683399/">（有感而发非影评）在影院的天花板上，我看到东京的晨曦</a></h3>
            <div class="review-meta">
                <a href="https://www.douban.com/people/253308073/">花绿青馅饺子</a> 评论
                <a href="https://movie.douban.com/subject/36415357/?from=reviews">《孤独摇滚(上)》</a>

                <span class="allstar50"></span>
            </div>
            <div class="review-content">
                如果给近五年来看过的乐队番排名，我大概会给出《孤独摇滚》＞gbc＞mygo＞＞＞颂乐人偶的排名，原因就在于孤独摇滚实在是优秀到难以置信。把体量缩小确实节奏有所改变，不过对新观众特别友好，也让我这样的铁粉高...
                <a href="https://movie.douban.com/review/16683399/">(全文)</a>
            </div>
        </div>
    </div>

                
    <div class="review ">
        <div class="review-hd">
            <a href="https://movie.douban.com/subject/36512371/?from=reviews">
                <img class="lazy" data-original="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921057784.webp" src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2921057784.webp" alt="大风杀" style="display: inline;">
            </a>
        </div>
        <div class="review-bd">
            <h3><a href="https://movie.douban.com/review/16675241/">与导演张琪畅聊《大风杀》：与其困在风中，不如且听风吟</a></h3>
            <div class="review-meta">
                <a href="https://www.douban.com/people/151607980/">拜见冥王</a> 评论
                <a href="https://movie.douban.com/subject/36512371/?from=reviews">《大风杀》</a>

                <span class="allstar40"></span>
            </div>
            <div class="review-content">
                今年，有部入围北影节主竞赛单元的片子，蛮有意思—— 《大风杀》 上世纪九十年代边陲小镇，在极端恶劣的风沙气候下，44名悍匪卷土重来，3名地方警察严阵以待…… 孤绝环境下全员狠人的硬碰硬，失落之境中孤警悍...
                <a href="https://movie.douban.com/review/16675241/">(全文)</a>
            </div>
        </div>
    </div>

                
    <div class="review ">
        <div class="review-hd">
            <a href="https://movie.douban.com/subject/1293821/?from=reviews">
                <img class="lazy" data-original="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p1481521592.webp" src="https://img2.doubanio.com/cuphead/movie-static/pics/grey.gif" alt="希德姐妹帮">
            </a>
        </div>
        <div class="review-bd">
            <h3><a href="https://movie.douban.com/review/16686869/">JD i'm crazy for you</a></h3>
            <div class="review-meta">
                <a href="https://www.douban.com/people/275262330/">无语凝噎鸡</a> 评论
                <a href="https://movie.douban.com/subject/1293821/?from=reviews">《希德姐妹帮》</a>

                <span class="allstar50"></span>
            </div>
            <div class="review-content">
                必须要在疯狂的状态下快点写完这个！ JD! 我是眉控吗？我太喜欢他的眉毛，以及眉眼。JD长得很清秀，JD的眼睛亮亮的，JD的眉毛很细长，很挑，很锋利，很不羁，他一出场眯着眼睛我就被迷的死死的。我经常看到眉毛又...
                <a href="https://movie.douban.com/review/16686869/">(全文)</a>
            </div>
        </div>
    </div>

                
    <div class="review last">
        <div class="review-hd">
            <a href="https://movie.douban.com/subject/36851291/?from=reviews">
                <img class="lazy" data-original="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2918817493.webp" src="https://img2.doubanio.com/cuphead/movie-static/pics/grey.gif" alt="名侦探柯南：独眼的残像">
            </a>
        </div>
        <div class="review-bd">
            <h3><a href="https://movie.douban.com/review/16669809/">日常纯吐槽观后感</a></h3>
            <div class="review-meta">
                <a href="https://www.douban.com/people/115767448/">Andres_C</a> 评论
                <a href="https://movie.douban.com/subject/36851291/?from=reviews">《名侦探柯南：独眼的残像》</a>

                <span class="allstar40"></span>
            </div>
            <div class="review-content">
                重要的事情说三遍 本文为本人一年一度的柯南剧场无逻辑纯吐槽，有大量剧透，在意的朋友慎入！ 本文为本人一年一度的柯南剧场无逻辑纯吐槽，有大量剧透，在意的朋友慎入！ 本文为本人一年一度的柯南剧场无逻辑纯吐...
                <a href="https://movie.douban.com/review/16669809/">(全文)</a>
            </div>
        </div>
    </div>

        </div>
    </div>

    



            </div>
            <div class="aside">
                
    
    

    
    

    <div class="rating_answer">
        <ul>
            <li>
                <a href="https://blog.douban.com/douban/2015/12/18/3060/" target="_blank">豆瓣电影评分八问</a>
            </li>
        </ul>
    </div>


    <!-- douban ad begin -->
    <div id="dale_movie_home_top_right" class="s" data-dstat-areaid="71" data-dstat-mode="click,expose" ad-status="loaded"></div>
    <!-- douban ad end -->

    
  
  
  


    
    <link rel="stylesheet" href="https://img3.doubanio.com/cuphead/movie-static/mod/billboard.cc362.css">
    <div id="billboard" class="s" data-dstat-areaid="75" data-dstat-mode="click,expose">
        <div class="billboard-hd">
            <h2>一周口碑榜<span><a href="/chart">更多榜单»</a></span></h2>
        </div>
        <div class="billboard-bd">
            <table>
                    <tbody><tr>
                        <td class="order">1</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36415357/">孤独摇滚(上)</a></td>
                    </tr>
                    <tr>
                        <td class="order">2</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36959346/">孤独的美食家 剧场版</a></td>
                    </tr>
                    <tr>
                        <td class="order">3</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36135198/">黎明的一切</a></td>
                    </tr>
                    <tr>
                        <td class="order">4</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36253688/">爱的暂停键</a></td>
                    </tr>
                    <tr>
                        <td class="order">5</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36837690/">共同的语言</a></td>
                    </tr>
                    <tr>
                        <td class="order">6</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36680228/">最后的里程</a></td>
                    </tr>
                    <tr>
                        <td class="order">7</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36512371/">大风杀</a></td>
                    </tr>
                    <tr>
                        <td class="order">8</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/35927475/">雷霆特攻队*</a></td>
                    </tr>
                    <tr>
                        <td class="order">9</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/36802241/">新干线惊爆倒数</a></td>
                    </tr>
                    <tr>
                        <td class="order">10</td>
                        <td class="title"><a onclick="moreurl(this, {from:'mv_rk'})" href="https://movie.douban.com/subject/30334963/">女儿的女儿</a></td>
                    </tr>
            </tbody></table>
        </div>
    </div>


    <!-- douban ad begin -->
    <div id="dale_movie_home_bottom_right" ad-status="loaded"></div>
    <!-- douban ad end -->

    
    

    <div id="doulist">
        <h2>热门片单</h2>
        <ul>
            <li>
            <span>88推荐</span>
            <div class="title"><a target="_blank" href="https://www.douban.com/doulist/19387465/">豆瓣7.5分以上泰劇</a></div>
            </li>
            <li>
            <span>11推荐</span>
            <div class="title"><a target="_blank" href="https://www.douban.com/doulist/3304094/">当我没工作时我在做什么②(英剧)</a></div>
            </li>
        </ul>
    </div>


    
    <div id="contact-and-cooperation">
        <div class="contact-and-cooperation-hd">
            <h2>合作联系</h2>
        </div>
        <div class="contact-and-cooperation-bd">
            <ul>
                    <li>电影合作邮箱：<img src="https://img2.doubanio.com/cuphead/movie-static/pics/email_movie.png"></li>
                    <li>电视剧合作邮箱：
                        <img src="https://img1.doubanio.com/cuphead/movie-static/pics/email_tv.png">
                        <img src="https://img1.doubanio.com/f/vendors/486503da8c82ffdbecec41c065927f96cbf02e4f/pics/icon/ic_new.png" class="new">
                    </li>
            </ul>
        </div>
    </div>
    

    <br>
    
    <link rel="stylesheet" href="https://img9.doubanio.com/cuphead/movie-static/mod/social-icon.ad046.css">
    <div class="contact mod">
        <h2>关注我们</h2>
        <ul class="embassy-list clearfix">
            <li>
                <a href="https://weibo.com/doubanfilm" target="_blank" class="icon-embassy-weibo"></a>
                <a href="https://weibo.com/doubanfilm" target="_blank" class="primary-link">微博</a>
            </li>
            <li>
                <a class="icon-embassy-weixin">
                    <div class="hover"><img src="https://img1.doubanio.com/cuphead/movie-static/pics/home_wechat_qrcode@2x.jpg" width="130px" height="130px"></div>
                </a>
                <a class="primary-link" href="javascript:;">微信</a>
            </li>
            <li>
                <a href="https://weibo.com/doubanzui" target="_blank" class="icon-embassy-bite-me"></a>
                <a href="https://weibo.com/doubanzui" target="_blank" class="primary-link">瓣嘴</a>
            </li>
            <li>
                <a href="https://www.douban.com/people/nobodyfilm/" target="_blank" class="icon-embassy-club-site"></a>
                <a href="https://www.douban.com/people/nobodyfilm/" target="_blank" class="primary-link">光影club</a>
            </li>
        </ul>
    </div>

    <!-- douban ad begin -->
    <div id="dale_movie_home_inner_bottom" ad-status="loaded"></div>
    <!-- douban ad end -->

            </div>
            <div class="extra">
                
    <!-- douban ad begin -->
    <div id="dale_movie_homepage_bottom" ad-status="loaded"></div>
    <!-- douban ad end -->

            </div>
        </div>
    </div>

        
    <div id="footer">
            <div class="footer-extra"></div>
        
<span id="icp" class="fleft gray-link">
    © 2005－2025 douban.com, all rights reserved 北京豆网科技有限公司
</span>

<a href="https://www.douban.com/hnypt/variformcyst.py" style="display: none;"></a>

<span class="fright">
    <a href="https://www.douban.com/about">关于豆瓣</a>
    · <a href="https://www.douban.com/jobs">在豆瓣工作</a>
    · <a href="https://www.douban.com/about?topic=contactus">联系我们</a>
    · <a href="https://www.douban.com/about/legal">法律声明</a>
    
    · <a href="https://help.douban.com/?app=movie" target="_blank">帮助中心</a>
    · <a href="https://www.douban.com/doubanapp/">移动应用</a>
</span>

    </div>

    </div>
    <script type="text/javascript">
      $('.hot_link').find('a').click(function(){
          var buzz_id = $(this).data("bid");
          $.post_withck('/j/misc/buzz/click_count', { buzz_id: buzz_id })
      });
  </script>
        
        
    <link rel="stylesheet" type="text/css" href="https://img1.doubanio.com/f/vendors/e8a7261937da62636d22ca4c579efc4a4d759b1b/css/ui/dialog.css">
    <link rel="stylesheet" type="text/css" href="https://img1.doubanio.com/cuphead/movie-static/mod/login_pop.b2f60.css">
    <script type="text/javascript" src="https://img1.doubanio.com/f/vendors/f25ae221544f39046484a823776f3aa01769ee10/js/ui/dialog.js"></script>
    <script type="text/javascript">
        var HTTPS_DB = "https://www.douban.com"
    </script>
    <script type="text/javascript" src="https://img3.doubanio.com/cuphead/movie-static/mod/login_pop.6e027.js"></script>

    
    <!-- douban ad begin -->
    
    




    
<script type="text/javascript">
    (function (global) {
        var newNode = global.document.createElement('script'),
            existingNode = global.document.getElementsByTagName('script')[0],
            adSource = '//erebor.douban.com/',
            userId = '',
            browserId = 'FnMIUanH5mM',
            criteria = '3:/',
            preview = '',
            debug = false,
            adSlots = ['dale_movie_homepage_top_large', 'dale_movie_home_top_right', 'dale_movie_home_bottom_right', 'dale_movie_homepage_bottom', 'movie_home_left_bottom', 'dale_movie_home_inner_bottom'];

        global.DoubanAdRequest = {src: adSource, uid: userId, bid: browserId, crtr: criteria, prv: preview, debug: debug};
        global.DoubanAdSlots = (global.DoubanAdSlots || []).concat(adSlots);

        newNode.setAttribute('type', 'text/javascript');
        newNode.setAttribute('src', '//img1.doubanio.com/NWQ3bnN2eS9mL2FkanMvYjFiN2ViZWM0ZDBiZjlkNTE1ZDdiODZiZDc0NzNhNjExYWU3ZDk3My9hZC5yZWxlYXNlLmpz?company_token=kX69T8w1wyOE-dale');
        newNode.setAttribute('async', true);
        existingNode.parentNode.insertBefore(newNode, existingNode);
    })(this);
</script>







    <!-- douban ad end -->
    <script src="https://img1.doubanio.com/f/vendors/86ce1c9488263b806c4ff1ab61a4168666b82911/js/separation/prettyfield.js"></script>
    <script src="https://img1.doubanio.com/f/vendors/2040963202fd9ead9d95bb4bc6732d6c3e156061/js/core/moreurl.js"></script>
    <script src="https://img1.doubanio.com/f/vendors/5688df2ab9b7ba25e651e0d1b87daeaf8c54dd93/js/jquery.lazyload.min.js"></script>
    <script src="https://img1.doubanio.com/f/vendors/bd6325a12f40c34cbf2668aafafb4ccd60deab7e/vendors.js"></script>
    <script src="https://img1.doubanio.com/f/vendors/6242a400cfd25992da35ace060e58f160efc9c50/shared_rc.js"></script>
    <script src="https://img2.doubanio.com/cuphead/movie-static/libs/underscore.js"></script>
    <script type="text/javascript">
        var gaiaConfig = [{
            type: 'movie',
            source: 'index',
            selector: '.gaia-movie',
            hashbang: false,
            fixFilter: false,
            slide: {
              pageCount: 5,
              pageLimit: 10,
              slideWidth: 700,
              slideHeight: 426,
            },
            is_mobile: "False"
        }, {
            type: 'tv',
            source: 'index',
            selector: '.gaia-tv',
            hashbang: false,
            fixFilter: false,
            slide: {
              pageCount: 5,
              pageLimit: 10,
              slideWidth: 700,
              slideHeight: 426,
            },
            is_mobile: "False"
        }];
        window.gaiaConfig = gaiaConfig

        $(function(){
        $('.lazy').lazyload({threshold: 350, effect: 'fadeIn'});

        $('#city-id').bind('click', function(e){
            $('#cinemas-suggestion-input input').blur();
            return false;
        });

        $(document)
            .delegate('.poster img', 'mouseenter', function(e){
                $('#cities-list').hide();
                $('#cinemas-suggestion-input input').blur();
            });

        $('#cinemas-suggestion-input input').val('').blur();
        });
        var _CONFIG = {
            login: false
        }
    </script>
    <script src="https://img9.doubanio.com/cuphead/movie-static/homepage/index.13c36.js"></script>

    
    









<script type="text/javascript">
var _paq = _paq || [];
_paq.push(['trackPageView']);
_paq.push(['enableLinkTracking']);
(function() {
    var p=(('https:' == document.location.protocol) ? 'https' : 'http'), u=p+'://fundin.douban.com/';
    _paq.push(['setTrackerUrl', u+'piwik']);
    _paq.push(['setSiteId', '100001']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.type='text/javascript';
    g.defer=true;
    g.async=true;
    g.src=p+'://img3.doubanio.com/dae/fundin/piwik.js';
    s.parentNode.insertBefore(g,s);
})();
</script>

<script type="text/javascript">
var setMethodWithNs = function(namespace) {
  var ns = namespace ? namespace + '.' : ''
    , fn = function(string) {
        if(!ns) {return string}
        return ns + string
      }
  return fn
}

var gaWithNamespace = function(fn, namespace) {
  var method = setMethodWithNs(namespace)
  fn.call(this, method)
}

var _gaq = _gaq || []
  , accounts = [
      { id: 'UA-7019765-1', namespace: 'douban' }
    , { id: 'UA-7019765-19', namespace: '' }
    ]
  , gaInit = function(account) {
      gaWithNamespace(function(method) {
        gaInitFn.call(this, method, account)
      }, account.namespace)
    }
  , gaInitFn = function(method, account) {
      _gaq.push([method('_setAccount'), account.id]);
      _gaq.push([method('_setSampleRate'), '5']);

      
  _gaq.push([method('_addOrganic'), 'google', 'q'])
  _gaq.push([method('_addOrganic'), 'baidu', 'wd'])
  _gaq.push([method('_addOrganic'), 'soso', 'w'])
  _gaq.push([method('_addOrganic'), 'youdao', 'q'])
  _gaq.push([method('_addOrganic'), 'so.360.cn', 'q'])
  _gaq.push([method('_addOrganic'), 'sogou', 'query'])
  if (account.namespace) {
    _gaq.push([method('_addIgnoredOrganic'), '豆瓣'])
    _gaq.push([method('_addIgnoredOrganic'), 'douban'])
    _gaq.push([method('_addIgnoredOrganic'), '豆瓣网'])
    _gaq.push([method('_addIgnoredOrganic'), 'www.douban.com'])
  }

      if (account.namespace === 'douban') {
        _gaq.push([method('_setDomainName'), '.douban.com'])
      }

        _gaq.push([method('_setCustomVar'), 1, 'responsive_view_mode', 'desktop', 3])

        _gaq.push([method('_setCustomVar'), 2, 'login_status', '0', 2]);

      _gaq.push([method('_trackPageview')])
    }

for(var i = 0, l = accounts.length; i < l; i++) {
  var account = accounts[i]
  gaInit(account)
}


;(function() {
    var ga = document.createElement('script');
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    ga.setAttribute('async', 'true');
    document.documentElement.firstChild.appendChild(ga);
})()
</script>








      

    <!-- dae-web-movie--default-68d4577765-b6dlf-->

  <script>_SPLITTEST=''</script>





<div id="search_suggest" style="display: none; top: 78px; left: 174.4px;"><ul></ul></div><pagenote-root><pagenote-bar data-pagenote="sidebar"></pagenote-bar><pagenote-annotations></pagenote-annotations></pagenote-root><exec-ui data-wxt-shadow-root="" data-react-shadow-host="holy-trick-exec-shadow-host" style="z-index: 1000000; overflow: visible; position: relative; width: 0px; height: 0px; display: block;"></exec-ui></body><plasmo-csui id="aitdk-csui"></plasmo-csui><div id="immersive-translate-popup" style="all: initial"></div><div id="bilin-panel" style="all: initial"></div><div id="bilin-popup" style="all: initial"></div></html>
"""

result = extract_minimal_structure(html_content)
print(json.dumps(result, indent=2))



# from zhipuai import ZhipuAI
# client = ZhipuAI(api_key="8f95650c401390fe78bb6b19b5274b41.VPS5f5f0aDAtOu4Z")  # 请填写您自己的APIKey
# response = client.chat.completions.create(
#     model="glm-4-flash",  # 请填写您要调用的模型名称
#     messages=[
#         {"role": "user", "content": "作为一名营销专家，请为我的产品创作一个吸引人的口号"},
#         {"role": "assistant", "content": "当然，要创作一个吸引人的口号，请告诉我一些关于您产品的信息"},
#         {"role": "user", "content": "智谱AI开放平台"},
#         {"role": "assistant", "content": "点燃未来，智谱AI绘制无限，让创新触手可及！"},
#         {"role": "user", "content": "创作一个更精准且吸引人的口号"}
#     ],
# )
# print(response.choices[0].message)


# Please install OpenAI SDK first: `pip3 install openai`

from openai import OpenAI

client = OpenAI(api_key="sk-a76edfa9a4fa4bab8a25eb030738e14d", base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False
)

print(response.choices[0].message.content)