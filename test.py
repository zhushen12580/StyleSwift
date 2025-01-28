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
  <html><script type="text/javascript" async="" src="https://www.google-analytics.com/analytics.js"></script><script type="text/javascript" async="" src="https://www.googletagmanager.com/gtag/js?id=G-DR8Q7CR9MT&amp;l=dataLayer&amp;cx=c"></script><script src="https://hm.baidu.com/hm.js?27a2aa12c46221214eee1efc6ce72241"></script><head><style>body {transition: opacity ease-in 0.2s; } 
  body[unresolved] {opacity: 0; display: block; overflow: hidden; position: relative; } 
  </style>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta charset="utf-8">
  <meta name="renderer" content="webkit">
  <script src="//static2.youzack.com/statics/js/es6-promise-4.2.8/es6-promise.min.js"></script>
  <script src="//static2.youzack.com/statics/js/polyfill-7.12.1/polyfill.min.js"></script>
      <title>YouZack-英语听力精听、背单词</title>
      <link rel="stylesheet" href="https://res.wx.qq.com/open/libs/weui/1.1.3/weui.min.css">
      <script type="text/javascript" src="https://res.wx.qq.com/open/libs/weuijs/1.1.4/weui.min.js"></script>
          <link rel="manifest" href="/manifest.json">
  <script src="/scripts/md5.min.js" type="text/javascript"></script>
  <script src="/scripts/visitedlinks.js?v201200720_1" type="text/javascript"></script>

  <script async="" src="https://www.googletagmanager.com/gtag/js?id=UA-145818773-1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());

    gtag('config', 'UA-145818773-1');
  </script>

  <script>
    var _hmt = _hmt || [];
    (function ()
    {
      var hm = document.createElement("script");
      hm.src = "https://hm.baidu.com/hm.js?27a2aa12c46221214eee1efc6ce72241";
      var s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(hm, s);
    })();
  </script>
  <script async="" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4201992839576454" crossorigin="anonymous"></script>
      <style>
          .cover {
              float: left;
              margin: 10px;
          }

              .cover img {
                  width: 400px;
                  height: 223px;
              }

              .cover p {
                  text-align: center;
              }
      </style>
  <style id="_goober"> .go1475592160{height:0;}.go1671063245{height:auto;}.go1888806478{display:flex;flex-wrap:wrap;flex-grow:1;}@media (min-width:600px){.go1888806478{flex-grow:initial;min-width:288px;}}.go167266335{background-color:#313131;font-size:0.875rem;line-height:1.43;letter-spacing:0.01071em;color:#fff;align-items:center;padding:6px 16px;border-radius:4px;box-shadow:0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0px rgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12);}.go3162094071{padding-left:20px;}.go3844575157{background-color:#313131;}.go1725278324{background-color:#43a047;}.go3651055292{background-color:#d32f2f;}.go4215275574{background-color:#ff9800;}.go1930647212{background-color:#2196f3;}.go946087465{display:flex;align-items:center;padding:8px 0;}.go703367398{display:flex;align-items:center;margin-left:auto;padding-left:16px;margin-right:-8px;}.go3963613292{width:100%;position:relative;transform:translateX(0);top:0;right:0;bottom:0;left:0;min-width:288px;}.go1141946668{box-sizing:border-box;display:flex;max-height:100%;position:fixed;z-index:1400;height:auto;width:auto;transition:top 300ms ease 0ms,right 300ms ease 0ms,bottom 300ms ease 0ms,left 300ms ease 0ms,max-width 300ms ease 0ms;pointer-events:none;max-width:calc(100% - 40px);}.go1141946668 .notistack-CollapseWrapper{padding:6px 0px;transition:padding 300ms ease 0ms;}@media (max-width:599.95px){.go1141946668{width:100%;max-width:calc(100% - 32px);}}.go3868796639 .notistack-CollapseWrapper{padding:2px 0px;}.go3118922589{top:14px;flex-direction:column;}.go1453831412{bottom:14px;flex-direction:column-reverse;}.go4027089540{left:20px;}@media (min-width:600px){.go4027089540{align-items:flex-start;}}@media (max-width:599.95px){.go4027089540{left:16px;}}.go2989568495{right:20px;}@media (min-width:600px){.go2989568495{align-items:flex-end;}}@media (max-width:599.95px){.go2989568495{right:16px;}}.go4034260886{left:50%;transform:translateX(-50%);}@media (min-width:600px){.go4034260886{align-items:center;}}</style><style>#monica-content-root{position:relative;z-index:2147483646 !important}#doubao-ai-assistant{position:relative;z-index:2147483646 !important}</style><style type="text/css">.DraggableTags {
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
  </style><meta property="pagenote:url" content="https://www.youzack.com/"><meta property="pagenote:pageUrl" content="https://www.youzack.com/"><meta property="pagenote:table" content="html"><style id="init-pagenote-style">
      pagenote-root{
          display: none; // pagenote 插件启动时会自动覆盖这里的样式
      }
      </style><meta property="pagenote:did" content="91076e2c-d6a3-4cc0-b6fe-ce8059714952"><meta property="pagenote:version" content="0.29.21"><meta property="pagenote:platform" content="chrome"><style data-source="custom-pagenote-style">undefined</style><meta property="pagenote:pageKey" content="https://www.youzack.com/"><style data-id="immersive-translate-input-injected-css">.immersive-translate-input {
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


  .immersive-translate-search-recomend {
    border: 1px solid #dadce0;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    position: relative;
    font-size: 16px;
  }

  .immersive-translate-search-enhancement-en-title {
    color: #4d5156;
  }



  .immersive-translate-search-settings {
    position: absolute;
    top: 16px;
    right: 16px;
    cursor: pointer;
  }

  .immersive-translate-search-recomend::before {
    /* content: " "; */
    /* width: 20px; */
    /* height: 20px; */
    /* top: 16px; */
    /* position: absolute; */
    /* background: center / contain url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAxlBMVEUAAADpTInqTIjpSofnSIfqS4nfS4XqS4nqTIjsTYnrTInqTIroS4jvQIDqTIn////+/v7rSYjpTIn8/v7uaZzrTIr9/f3wfansWJL88/b85e73qc39+/v3xNnylrvrVI/98fb62Obva5/8+fr76vH4y9zpSIj74e353Oj1ocTzm77xhK/veKbtYpjsXJTqU47oTInxjrXyh7L99fj40eH2ttH1udD3sc31ssz1rMnykLXucqPtbqD85e/1xdn2u9DzqcXrUY6FaJb8AAAADnRSTlMA34BgIM8Q37/fz7+/EGOHcVQAAAGhSURBVDjLhZPncuowEEZFTW7bXVU7xsYYTO/p7bb3f6lICIOYJOT4h7/VnFmvrBFjrF3/CR/SajBHswafctG0Qg3O8O0Xa8BZ6uw7eLjqr30SofCDVSkemMinfL1ecy20r5ygR5zz3ArcAqJExPTPKhDENEmS30Q9+yo4lEQkqVTiIEAHCT10xWERRdH0Bq0aCOPZNDV3s0xaYce1lHEoDHU8wEh3qRJypNcTAeKUIjgKMeGLDoRCLVLTVf+Ownj8Kk6H9HM6QXPgYjQSB0F00EJEu10ILQrs/QeP77BSSr0MzLOyuJJQbnUoOOIUI/A8EeJk9E4YUHUWiRyTVKGgQUB8/3e/NpdGlfI+FMQyWsCBWyz4A/ZyHXyiiz0Ne5aGZssoxRmcChw8/EFKQ5JwwkUo3FRT5yXS7q+Y/rHDZmFktzpGMvO+5QofA4FPpEmGw+EWRCFvnaof7Zhe8NuYSLR0xErKLThUSs8gnODh87ssy6438yzbLzxl012HS19vfCf3CNhnbWOL1eEsDda+gDPUvri8tSZzNFrwIZf1NmNvqC1I/t8j7nYAAAAASUVORK5CYII='); */
  }

  .immersive-translate-search-title {}

  .immersive-translate-search-title-wrapper {}

  .immersive-translate-search-time {
    font-size: 12px;
    margin: 4px 0 24px;
    color: #70757a;
  }

  .immersive-translate-expand-items {
    display: none;
  }

  .immersive-translate-search-more {
    margin-top: 16px;
    font-size: 14px;
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
    position: relative
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
  .immersive-translate-btn:disabled{
    opacity: 0.6;
    cursor: not-allowed;
  }
  .immersive-translate-btn:disabled:hover{
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
    color: #EA4C89;
    border: 1px solid #EA4C89
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
    -webkit-tap-highlight-color: rgba(0, 0, 0, .1);
  }

  .immersive-translate-primary-link {
    cursor: pointer;
    user-select: none;
    -webkit-user-drag: none;
    text-decoration: none;
    color: #ea4c89;
    -webkit-tap-highlight-color: rgba(0, 0, 0, .1);
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
    background-color: rgba(0, 0, 0, 0.50) !important;
    display: flex !important;
    flex-direction: column !important; 
    align-items: center !important;
    justify-content: center !important;
    border-radius: 16px !important;
  }
  .imt-image-status img,.imt-image-status svg, .imt-img-loading {
    width: 28px !important;
    height: 28px !important;
    margin: 0 0 8px 0 !important;
    min-height: 28px !important;
    min-width: 28px !important;
  }
  .imt-img-loading {
    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAtFBMVEUAAAD////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////oK74hAAAAPHRSTlMABBMIDyQXHwyBfFdDMSw+OjXCb+5RG51IvV/k0rOqlGRM6KKMhdvNyZBz9MaupmxpWyj437iYd/yJVNZeuUC7AAACt0lEQVRIx53T2XKiUBCA4QYOiyCbiAsuuGBcYtxiYtT3f6/pbqoYHVFO5r+iivpo6DpAWYpqeoFfr9f90DsYAuRSWkFnPO50OgR9PwiCUFcl2GEcx+N/YBh6pvKaefHlUgZd1zVe0NbYcQjGBfzrPE8Xz8aF+71D8gG6DHFPpc4a7xFiCDuhaWgKgGIJQ3d5IMGDrpS4S5KgpIm+en9f6PlAhKby4JwEIxlYJV9h5k5nee9GoxHJ2IDSNB0dwdad1NAxDJ/uXDHYmebdk4PdbkS58CIVHdYSUHTYYRWOJblWSyu2lmy3KNFVJNBhxcuGW4YBVCbYGRZwIooipHsNqjM4FbgOQqQqSKQQU9V8xmi1QlgHqQQ6DDBvRUVCDirs+EzGDGOQTCATgtYTnbCVLgsVgRE0T1QE0qHCFAht2z6dLvJQs3Lo2FQoDxWNUiBhaP4eRgwNkI+dAjVOA/kUrIDwf3CG8NfNOE0eiFotSuo+rBiq8tD9oY4Qzc6YJw99hl1wzpQvD7ef2M8QgnOGJfJw+EltQc+oX2yn907QB22WZcvlUpd143dqQu+8pCJZuGE4xCuPXJqqcs5sNpsI93Rmzym1k4Npk+oD1SH3/a3LOK/JpUBpWfqNySxWzCfNCUITuDG5dtuphrUJ1myeIE9bIsPiKrfqTai5WZxbhtNphYx6GEIHihyGFTI69lje/rxajdh0s0msZ0zYxyPLhYCb1CyHm9Qsd2H37Y3lugVwL9kNh8Ot8cha6fUNQ8nuXi5z9/ExsAO4zQrb/ev1yrCB7lGyQzgYDGuxq1toDN/JGvN+HyWNHKB7zEoK+PX11e12G431erGYzwmytAWU56fkMHY5JJnDRR2eZji3AwtIcrEV8Cojat/BdQ7XOwGV1e1hDjGGjXbdArm8uJZtCH5MbcctVX8A1WpqumJHwckAAAAASUVORK5CYII=");
    background-size: 28px 28px;
    animation: image-loading-rotate 1s linear infinite !important;
  }

  .imt-image-status span {
    color: var(--bg-2, #FFF) !important;
    font-size: 14px !important;
    line-height: 14px !important;
    font-weight: 500 !important;
  }

  @keyframes image-loading-rotate {
    from {
      transform: rotate(360deg);
    }
    to {
      transform: rotate(0deg);
    }
  }
  </style></head>
  <body data-pagenote="1">
      <div class="weui-cells__title">
          YouZack-英语听力精听、背单词
      </div>
      <div class="weui-cells">
          <div class="cover">
              <a href="/ListeningExercise/ListeningIndex/" style="color: cadetblue;">
                  <img src="/images/tl.jpg">
                  <p>英语听力逐句精听</p>
              </a>
          </div>
          <div class="cover">
              <a href="https://bdc2.youzack.com">
                  <img src="/images/bdcv2.jpg">
                  <p>背单词</p>
              </a>
          </div>
          <div class="cover">
              <a href="/wxmp.html" target="_blank">
                  <img src="/images/xcxcover.png">
                  <p>微信小程序</p>
              </a>
          </div>
          <div class="cover">
              <a href="/aboutme.html" target="_blank">
                  <img src="/images/aboutme.png">
                  <p>联系我</p>
              </a>
          </div>
      </div>
          <div style="margin-top:30px">
              <strong>友情链接：</strong>
                  <a href="https://haicoder.net/" target="_blank" style="margin:6px;">嗨客网</a>
                  <a href="https://dotnet9.com/" target="_blank" style="margin:6px;">DotNet9</a>
                  <a href="https://www.iai88.com/" target="_blank" style="margin:6px;">爱AI导航</a>
              交换友链请联系yangzhongke8@gmail.com
          </div>
          <div style="margin-top:20px">
              <a id="tucao" href="/Suggestions.html">建议</a>
              <span style="margin-left:10px;margin-right:10px;">|</span>
              <a href="/aboutme.html" target="_blank">联系我</a>
              <span style="margin-left:10px;margin-right:10px;">|</span>
              <a href="https://space.bilibili.com/27948784" target="_blank">我的B站</a>
          <span style="margin-left:10px;margin-right:10px;">|</span>
          <a href="/disclaimer.html" target="_blank" style="margin-left:10px;margin-right:10px;">Disclaimer</a>|
          <a href="/PrivacyPolicy.html" target="_blank">Privacy</a>
      </div>
  <div style="margin-left:auto;margin-right:auto;margin-top:20px;margin-bottom:50px;text-align:center;width:300px;">
      <a target="_blank" href="https://beian.miit.gov.cn/">京ICP备13044576号-3</a>
  </div>
  <script>
      console.log('1421');
  </script>


  <div id="screenity-ui"><div class="screenity-shadow-dom"><div><div class="screenity-scrollbar"></div><div class="screenity-scrollbar"></div></div><style type="text/css">
        #screenity-ui, #screenity-ui div {
          background-color: unset;
          padding: unset;
          width: unset;
          box-shadow: unset;
          display: unset;
          margin: unset;
          border-radius: unset;
        }
        .screenity-outline {
          position: absolute;
          z-index: 99999999999;
          border: 2px solid #3080F8;
          outline-offset: -2px;
          pointer-events: none;
          border-radius: 5px!important;
        }
      .screenity-blur {
        filter: blur(10px)!important;
      }
        .screenity-shadow-dom * {
          transition: unset;
        }
        .screenity-shadow-dom .TooltipContent {
    border-radius: 30px!important;
    background-color: #29292F!important;
    padding: 10px 15px!important;
    font-size: 12px;
    margin-bottom: 10px!important;
    bottom: 100px;
    line-height: 1;
    font-family: 'Satoshi-Medium', sans-serif;
    z-index: 99999999!important;
    color: #FFF;
    box-shadow: hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px!important;
    user-select: none;
    transition: opacity 0.3 ease-in-out;
    will-change: transform, opacity;
    animation-duration: 400ms;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, opacity;
  }

  .screenity-shadow-dom .hide-tooltip {
    display: none!important;
  }

  .screenity-shadow-dom .tooltip-tall {
    margin-bottom: 20px;
  }

  .screenity-shadow-dom .tooltip-small {
    margin-bottom: 5px;
  }

  .screenity-shadow-dom .TooltipContent[data-state='delayed-open'][data-side='top'] {
    animation-name: slideDownAndFade;
  }
  .screenity-shadow-dom .TooltipContent[data-state='delayed-open'][data-side='right'] {
    animation-name: slideLeftAndFade;
  }
  .screenity-shadow-dom.TooltipContent[data-state='delayed-open'][data-side='bottom'] {
    animation-name: slideUpAndFade;
  }
  .screenity-shadow-dom.TooltipContent[data-state='delayed-open'][data-side='left'] {
    animation-name: slideRightAndFade;
  }

  @keyframes slideUpAndFade {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideRightAndFade {
    from {
      opacity: 0;
      transform: translateX(-2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideDownAndFade {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideLeftAndFade {
    from {
      opacity: 0;
      transform: translateX(2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  #screenity-ui [data-radix-popper-content-wrapper] { z-index: 999999999999!important; } 

  .screenity-shadow-dom .CanvasContainer {
    position: fixed;
    pointer-events: all!important;
    top: 0px!important;
    left: 0px!important;
    z-index: 99999999999!important;
  }
  .screenity-shadow-dom .canvas {
    position: fixed;
    top: 0px!important;
    left: 0px!important;
    z-index: 99999999999!important;
    background: transparent!important;
  }
  .screenity-shadow-dom .canvas-container {
    top: 0px!important;
    left: 0px!important;
    z-index: 99999999999;
    position: fixed!important;
    background: transparent!important;
  }

  .ScreenityDropdownMenuContent {
    z-index: 99999999999!important;
    min-width: 200px;
    background-color: white;
    margin-top: 4px;
    margin-right: 8px;
    padding-top: 12px;
    padding-bottom: 12px;
    border-radius: 15px;
    z-index: 99999;
    font-family: 'Satoshi-Medium', sans-serif;
    color: #29292F;
    box-shadow: 0px 10px 38px -10px rgba(22, 23, 24, 0.35),
      0px 10px 20px -15px rgba(22, 23, 24, 0.2);
    animation-duration: 400ms;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, opacity;
  }
  .ScreenityDropdownMenuContent[data-side="top"] {
    animation-name: slideDownAndFade;
  }
  .ScreenityDropdownMenuContent[data-side="right"] {
    animation-name: slideLeftAndFade;
  }
  .ScreenityDropdownMenuContent[data-side="bottom"] {
    animation-name: slideUpAndFade;
  }
  .ScreenityDropdownMenuContent[data-side="left"] {
    animation-name: slideRightAndFade;
  }
  .ScreenityItemIndicator {
    position: absolute;
    right: 12px; 
    width: 18px;
    height: 18px;
    background: #3080F8;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ScreenityDropdownMenuItem,
  .ScreenityDropdownMenuRadioItem {
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 5px;
    position: relative;
    padding-left: 22px;
    padding-right: 22px;
    user-select: none;
    outline: none;
  }
  .ScreenityDropdownMenuItem:hover {
      background-color: #F6F7FB !important;
      cursor: pointer;
  }
  .ScreenityDropdownMenuItem[data-disabled] {
    color: #6E7684; !important;
    cursor: not-allowed;
    background-color: #F6F7FB !important;
  }



  @keyframes slideUpAndFade {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideRightAndFade {
    from {
      opacity: 0;
      transform: translateX(-2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideDownAndFade {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideLeftAndFade {
    from {
      opacity: 0;
      transform: translateX(2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  </style></div></div><pagenote-root><pagenote-bar data-pagenote="sidebar"></pagenote-bar><pagenote-annotations></pagenote-annotations></pagenote-root></body><plasmo-csui id="aitdk-csui"></plasmo-csui></html>

"""

# result = extract_minimal_structure(html_content)
# print(json.dumps(result, indent=2))



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
    model="deepseek-reasoner",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False
)

print(response.choices[0].message.content)