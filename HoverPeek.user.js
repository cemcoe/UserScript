// ==UserScript==     
// @name         HoverPeek
// @name:zh-CN   链接本页预览（悬停自动打开，可拖动+记忆位置大小）
// @namespace    https://github.com/cemcoe/UserScript
// @version      1.3.0
// @description  Hover links to preview in a draggable, resizable overlay (0.8s delay). Auto-remembers size/position. ESC closes. Some sites require new window due to iframe restrictions.
// @description:zh-CN  悬停链接可预览，浮层可拖动/缩放（默认 0.8 秒延迟），自动记忆位置和大小。ESC 关闭。部分网站需新窗口打开（iframe 限制）。
// @author       cemcoe
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
/*
📌 使用方法：
1. 鼠标悬停链接 > 0.8 秒，右下角弹出预览浮层
2. 工具栏按钮：新标签打开 / 关闭
3. ESC 可关闭浮层
4. 油猴菜单可设置悬停延迟 (秒)
5. 浮层位置和大小会自动记忆
*/

(function() {
    'use strict';

    // ================== 样式 ==================
    GM_addStyle(`
    .link-preview-overlay {
      position: fixed;
      border: 2px solid #666;
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
      z-index: 999999;
      resize: both;
      overflow: hidden;
      display: none;
    }
    .link-preview-header {
      background: #444;
      color: #fff;
      font-size: 12px;
      padding: 4px 8px;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .link-preview-header button {
      margin-left: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .link-preview-body {
      width: 100%;
      height: calc(100% - 24px);
      border: none;
    }
  `);

    // ================== 工具函数 ==================

    function getAnchor(el) {
        while (el && el.tagName && el.tagName.toLowerCase() !== 'a') {
            el = el.parentElement;
        }
        return el && el.tagName && el.tagName.toLowerCase() === 'a' ? el : null;
    }

    // ================== Overlay 构建 ==================
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'link-preview-overlay';

        const header = document.createElement('div');
        header.className = 'link-preview-header';
        header.innerHTML = `
      <span>预览</span>
      <div>
        <button data-act="newtab">新标签</button>
        <button data-act="newwindow">新窗口</button>
        <button data-act="close">关闭</button>
      </div>
    `;

        const iframe = document.createElement('iframe');
        iframe.className = 'link-preview-body';

        overlay.appendChild(header);
        overlay.appendChild(iframe);
        document.body.appendChild(overlay);

        // 记忆位置和大小
        const savedX = GM_getValue("overlay_x");
        const savedY = GM_getValue("overlay_y");
        const savedW = GM_getValue("overlay_w");
        const savedH = GM_getValue("overlay_h");

        overlay.style.width = savedW || "400px";
        overlay.style.height = savedH || "300px";
        overlay.style.left = savedX || (window.innerWidth - 420 + "px");
        overlay.style.top = savedY || (window.innerHeight - 320 + "px");

        function openNewWindow(iframe) {
          const width = 800;
          const height = 600;

          // 屏幕可用区域
          const screenX = window.screen.availLeft || 0;
          const screenY = window.screen.availTop || 0;
          const screenWidth = window.screen.availWidth;
          const screenHeight = window.screen.availHeight;

          // 右下角位置
          const left = screenX + screenWidth - width;
          const top = screenY + screenHeight - height;

          // 打开窗口
          window.open(
            iframe.src,
              "_blank",
              `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
          );
          
        }

        // 按钮点击
        header.addEventListener("click", (e) => {
            if (e.target.dataset.act === "close") {
                overlay.style.display = "none";
            } else if (e.target.dataset.act === "newtab") {
                window.open(iframe.src, "_blank");
            } else if (e.target.dataset.act === "newwindow") {
              openNewWindow(iframe)

          }
        });

        // 记录大小
        const observer = new ResizeObserver(() => {
            GM_setValue("overlay_w", overlay.style.width);
            GM_setValue("overlay_h", overlay.style.height);
        });
        observer.observe(overlay);

        // 拖动逻辑
        let dragging = false,
            startX, startY, startLeft, startTop;
        header.addEventListener("mousedown", (e) => {
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(overlay.style.left, 10);
            startTop = parseInt(overlay.style.top, 10);
            e.preventDefault();
        });
        document.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            overlay.style.left = startLeft + dx + "px";
            overlay.style.top = startTop + dy + "px";
        });
        document.addEventListener("mouseup", () => {
            if (dragging) {
                dragging = false;
                GM_setValue("overlay_x", overlay.style.left);
                GM_setValue("overlay_y", overlay.style.top);
            }
        });

        // ESC 键关闭
        document.addEventListener("keydown", (e) => {
            if (overlay.style.display === "block" && e.key === "Escape") {
                overlay.style.display = "none";
                e.stopPropagation(); // 阻止冒泡，减少对页面的影响
                e.preventDefault(); // 阻止默认行为
            }
        });


        return {
            show: (url) => {
                overlay.style.display = "block";
                iframe.src = url;

                // 延迟检查是否加载成功（CSP/跨域拦截不会触发 onerror）
                setTimeout(() => {
                    console.log("检查 iframe 是否加载成功");
                    console.log(iframe.src);
                    try {
                      const doc = iframe.contentDocument; // 如果跨域，会抛异常
                      console.log(doc);

                      if(!doc) {
                        console.log("iframe 加载失败");
                      }
                      
                    } catch (e) {
                        // 跨域访问报错（说明被 CSP/X-Frame 拦截了）
                        console.warn("iframe 跨域或 CSP 拦截，尝试简版模式");
                        overlay.style.display = "none";
                    }
                }, 1000); // 1 秒后检查
            },
            hide: () => {
                overlay.style.display = "none";
            }
        };
    }

    const overlay = createOverlay();

    // ================== Hover 逻辑 ==================
    let hoverAnchor = null;
    let hoverTimer = null;
    const DEFAULT_DELAY = 0.8; // 秒
    function getDelayMs() {
        return (GM_getValue("hover_delay", DEFAULT_DELAY)) * 1000;
    }

    function resolveLink(a) {
        if (!a || !a.href) return null;
        try {
            const url = new URL(a.href);

            // 常见跳转参数名
            const redirectKeys = ["target", "to", "url", "dest", "destination", "redirect"];

            for (const key of redirectKeys) {
                if (url.searchParams.has(key)) {
                    return decodeURIComponent(url.searchParams.get(key));
                }
            }

            // 兜底：从所有参数里找第一个 http/https 链接
            for (const [key, val] of url.searchParams.entries()) {
                if (/^https?:\/\//i.test(val)) {
                    return decodeURIComponent(val);
                }
            }

            // 有些站点直接把目标链接拼在 querystring 里
            const match = a.href.match(/https?:\/\/[^\s&#]+/);
            if (match) {
                return match[0];
            }

        } catch (e) {
            console.error("解析链接失败:", e);
        }
        return a.href;
    }

    document.addEventListener("mouseover", (e) => {
        const a = getAnchor(e.target);
        if (!a) return;
        const realUrl = resolveLink(a);
        if (!realUrl) return;

        hoverAnchor = a;
        clearTimeout(hoverTimer);
        console.log(realUrl);
        hoverTimer = setTimeout(() => overlay.show(realUrl), getDelayMs());
    }, {
        passive: true
    });


    document.addEventListener("mouseout", (e) => {
        const to = e.relatedTarget;
        const leavingAnchor = getAnchor(e.target);
        if (leavingAnchor && (!to || !getAnchor(to))) {
            clearTimeout(hoverTimer);
        }
    }, {
        passive: true
    });

    // ================== 设置菜单 ==================
    GM_registerMenuCommand("设置悬停延时 (秒)", () => {
        const current = GM_getValue("hover_delay", DEFAULT_DELAY);
        const input = prompt("请输入悬停延时（单位：秒）", current);
        if (input !== null) {
            const v = parseFloat(input);
            if (!isNaN(v) && v > 0) {
                GM_setValue("hover_delay", v);
                alert("已设置悬停延时为 " + v + " 秒");
            } else {
                alert("输入无效");
            }
        }
    });

})();