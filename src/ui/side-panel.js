(function initSidePanel() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  const PANEL_HOST_ID = "gemini-question-navigator-host";
  const TEMP_HIGHLIGHT_CLASS = "gqn-target-highlight";
  const HOVER_HIGHLIGHT_CLASS = "gqn-hover-highlight";
  const ITEM_ESTIMATED_HEIGHT_PX = 48;
  const VIRTUALIZATION_THRESHOLD = 300;

  function formatRelativeTime(timestampMs, nowMs) {
    const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
    if (diffSec < 10) {
      return "刚刚";
    }
    if (diffSec < 60) {
      return `${diffSec}秒前`;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `${diffMin}分钟前`;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return `${diffHour}小时前`;
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) {
      return "昨天";
    }
    return `${diffDay}天前`;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  class SidePanel {
    constructor(options) {
      this.onJump = options.onJump;
      this.onHover = options.onHover;
      this.onHoverEnd = options.onHoverEnd;
      this.onBookmarkToggle = options.onBookmarkToggle || (() => {});
      this.state = {
        collapsed: false,
        autoFollow: true,
        messages: [],
        searchQuery: "",
        filterMode: "all",
        bookmarkedIds: new Set()
      };
      this.relativeNow = Date.now();
      this.renderRange = { start: 0, end: 0 };
      this.refreshClockTimer = null;
      this.currentHoverId = null;

      this.panelWidth = 240;
      this.panelTop = 72;
      this.panelHeight = 0;

      this.host = null;
      this.shadowRoot = null;
      this.wrapper = null;
      this.searchInput = null;
      this.filterTabAll = null;
      this.filterTabBookmarked = null;
      this.listContainer = null;
      this.virtualSpacer = null;
      this.listInner = null;
      this.collapseButton = null;
      this.autoFollowToggle = null;
      this.emptyState = null;
      this.noResultsState = null;
      this.shortcutHint = null;
      this.collapsedTab = null;
      this.resizeLeft = null;
      this.resizeTop = null;
      this.resizeBottom = null;
    }

    async mount() {
      if (document.getElementById(PANEL_HOST_ID)) {
        return;
      }

      this.host = document.createElement("div");
      this.host.id = PANEL_HOST_ID;
      this.host.setAttribute("data-collapsed", "false");
      document.body.appendChild(this.host);

      this.shadowRoot = this.host.attachShadow({ mode: "open" });
      await this.injectStyles();
      this.createLayout();
      this.startClockRefresh();
      this.render();
    }

    async injectStyles() {
      const style = document.createElement("style");
      style.textContent = `:host { all: initial; }`;
      this.shadowRoot.appendChild(style);

      let cssText = "";
      try {
        const cssUrl = chrome.runtime.getURL("src/ui/styles.css");
        const response = await fetch(cssUrl);
        if (response.ok) {
          cssText = await response.text();
        }
      } catch (error) {
        cssText = "";
      }

      if (!cssText) {
        cssText = `
          .gqn-panel{position:fixed;right:16px;top:72px;width:240px;max-height:76vh;background:#111827;color:#f9fafb;border:1px solid rgba(255,255,255,.12);border-radius:12px;display:flex;flex-direction:column;z-index:2147483647;box-shadow:0 16px 40px rgba(0,0,0,.35);font-family:Inter,Arial,sans-serif}
          .gqn-panel[data-collapsed="true"]{width:24px;overflow:hidden}
          .gqn-header{display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid rgba(255,255,255,.1);font-size:12px}
          .gqn-title{font-weight:600;white-space:nowrap}
          .gqn-controls{display:flex;gap:8px;align-items:center}
          .gqn-list{overflow:auto;position:relative}
          .gqn-empty{padding:16px 12px;color:#9ca3af;font-size:12px}
          .gqn-item{height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;gap:8px}
          .gqn-item:hover{background:rgba(255,255,255,.08)}
          .gqn-item-left{display:flex;gap:8px;min-width:0}
          .gqn-index{color:#9ca3af;font-size:11px;width:24px;text-align:right;flex:none}
          .gqn-preview{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .gqn-time{font-size:11px;color:#9ca3af;flex:none}
          .gqn-search-row{padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
          .gqn-search-input{width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:#1f2937;color:#f3f4f6;font-size:12px;outline:none}
          .gqn-search-input::placeholder{color:#6b7280}
          .gqn-search-input:focus{border-color:#60a5fa}
          .gqn-filter-row{display:flex;gap:0;padding:0 10px;border-bottom:1px solid rgba(255,255,255,.08)}
          .gqn-filter-tab{flex:1;padding:5px 0;background:none;border:none;border-bottom:2px solid transparent;color:#9ca3af;font-size:11px;cursor:pointer;text-align:center}
          .gqn-filter-tab:hover{color:#e5e7eb}
          .gqn-filter-tab[data-active="true"]{color:#60a5fa;border-bottom-color:#60a5fa}
          .gqn-star{flex:none;width:20px;height:20px;background:none;border:none;cursor:pointer;padding:0;font-size:14px;line-height:20px;text-align:center;color:#4b5563;border-radius:4px}
          .gqn-star:hover{color:#fbbf24;background:rgba(251,191,36,.1)}
          .gqn-star[data-bookmarked="true"]{color:#fbbf24}
          .gqn-shortcut-hint{padding:4px 10px 6px;font-size:10px;color:#6b7280;text-align:center;border-top:1px solid rgba(255,255,255,.06)}
          .gqn-shortcut-hint kbd{background:#1f2937;border:1px solid rgba(255,255,255,.16);border-radius:3px;padding:1px 4px;font-family:inherit;font-size:10px}
          .gqn-no-results{padding:12px;color:#6b7280;font-size:12px;text-align:center}
          .gqn-item-right{display:flex;align-items:center;gap:4px;flex:none}
        `;
      }

      const externalStyle = document.createElement("style");
      externalStyle.textContent = cssText;
      this.shadowRoot.appendChild(externalStyle);
    }

    createLayout() {
      const wrapper = document.createElement("div");
      wrapper.className = "gqn-panel";
      wrapper.style.setProperty("--gqn-width", `${this.panelWidth}px`);
      wrapper.setAttribute("data-collapsed", String(this.state.collapsed));
      this.wrapper = wrapper;

      this.resizeLeft = document.createElement("div");
      this.resizeLeft.className = "gqn-resize-handle gqn-resize-left";
      wrapper.appendChild(this.resizeLeft);

      this.resizeTop = document.createElement("div");
      this.resizeTop.className = "gqn-resize-handle gqn-resize-top";
      wrapper.appendChild(this.resizeTop);

      this.resizeBottom = document.createElement("div");
      this.resizeBottom.className = "gqn-resize-handle gqn-resize-bottom";
      wrapper.appendChild(this.resizeBottom);

      this.setupResizeHandles();

      this.collapsedTab = document.createElement("div");
      this.collapsedTab.className = "gqn-collapsed-tab";
      this.collapsedTab.textContent = "提问导航";
      this.collapsedTab.title = "点击展开 (Ctrl+Shift+Q)";
      this.collapsedTab.addEventListener("click", () => {
        this.toggleCollapse();
      });
      wrapper.appendChild(this.collapsedTab);

      const header = document.createElement("div");
      header.className = "gqn-header";

      const title = document.createElement("div");
      title.className = "gqn-title";
      title.textContent = "提问导航";
      header.appendChild(title);

      const controls = document.createElement("div");
      controls.className = "gqn-controls";

      const autoFollowLabel = document.createElement("label");
      autoFollowLabel.className = "gqn-autofollow";
      autoFollowLabel.title = "新提问出现时自动滚动到列表底部";
      autoFollowLabel.innerHTML = `<input type="checkbox" checked />跟随`;
      this.autoFollowToggle = autoFollowLabel.querySelector("input");
      this.autoFollowToggle.addEventListener("change", () => {
        this.state.autoFollow = this.autoFollowToggle.checked;
      });
      controls.appendChild(autoFollowLabel);

      this.collapseButton = document.createElement("button");
      this.collapseButton.className = "gqn-collapse";
      this.collapseButton.textContent = "↔";
      this.collapseButton.title = "折叠/展开 (Ctrl+Shift+Q)";
      this.collapseButton.addEventListener("click", () => {
        this.toggleCollapse();
      });
      controls.appendChild(this.collapseButton);

      header.appendChild(controls);

      const searchRow = document.createElement("div");
      searchRow.className = "gqn-search-row";
      this.searchInput = document.createElement("input");
      this.searchInput.className = "gqn-search-input";
      this.searchInput.type = "text";
      this.searchInput.placeholder = "搜索提问...";
      this.searchInput.addEventListener("input", () => {
        this.state.searchQuery = this.searchInput.value;
        this.renderVirtualizedItems();
      });
      searchRow.appendChild(this.searchInput);

      const filterRow = document.createElement("div");
      filterRow.className = "gqn-filter-row";

      this.filterTabAll = document.createElement("button");
      this.filterTabAll.className = "gqn-filter-tab";
      this.filterTabAll.textContent = "全部";
      this.filterTabAll.setAttribute("data-active", "true");
      this.filterTabAll.addEventListener("click", () => {
        this.state.filterMode = "all";
        this.updateFilterTabs();
        this.renderVirtualizedItems();
      });

      this.filterTabBookmarked = document.createElement("button");
      this.filterTabBookmarked.className = "gqn-filter-tab";
      this.filterTabBookmarked.textContent = "收藏";
      this.filterTabBookmarked.setAttribute("data-active", "false");
      this.filterTabBookmarked.addEventListener("click", () => {
        this.state.filterMode = "bookmarked";
        this.updateFilterTabs();
        this.renderVirtualizedItems();
      });

      filterRow.appendChild(this.filterTabAll);
      filterRow.appendChild(this.filterTabBookmarked);

      this.listContainer = document.createElement("div");
      this.listContainer.className = "gqn-list";
      this.listContainer.addEventListener("scroll", () => this.renderVirtualizedItems());

      this.virtualSpacer = document.createElement("div");
      this.virtualSpacer.className = "gqn-spacer";
      this.listInner = document.createElement("div");
      this.listInner.className = "gqn-list-inner";
      this.virtualSpacer.appendChild(this.listInner);
      this.listContainer.appendChild(this.virtualSpacer);

      this.emptyState = document.createElement("div");
      this.emptyState.className = "gqn-empty";
      this.emptyState.textContent = "还没有识别到你的提问，发送一条消息后会显示。";

      this.noResultsState = document.createElement("div");
      this.noResultsState.className = "gqn-no-results";
      this.noResultsState.textContent = "没有匹配的提问";
      this.noResultsState.style.display = "none";

      this.shortcutHint = document.createElement("div");
      this.shortcutHint.className = "gqn-shortcut-hint";
      this.shortcutHint.innerHTML = `<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd> 切换侧栏`;

      wrapper.appendChild(header);
      wrapper.appendChild(searchRow);
      wrapper.appendChild(filterRow);
      wrapper.appendChild(this.listContainer);
      wrapper.appendChild(this.emptyState);
      wrapper.appendChild(this.noResultsState);
      wrapper.appendChild(this.shortcutHint);
      this.shadowRoot.appendChild(wrapper);
    }

    updateFilterTabs() {
      this.filterTabAll.setAttribute("data-active", String(this.state.filterMode === "all"));
      this.filterTabBookmarked.setAttribute("data-active", String(this.state.filterMode === "bookmarked"));
    }

    toggleCollapse() {
      this.state.collapsed = !this.state.collapsed;
      this.render();
    }

    setupResizeHandles() {
      const self = this;

      function attachDrag(handle, cursorStyle, onMove, onEnd) {
        handle.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          handle.classList.add("gqn-resizing");
          document.body.style.cursor = cursorStyle;
          document.body.style.userSelect = "none";

          const move = (ev) => onMove(ev, startX, startY);
          const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            handle.classList.remove("gqn-resizing");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            if (onEnd) onEnd();
          };
          document.addEventListener("mousemove", move);
          document.addEventListener("mouseup", up);
        });
      }

      const startWidth = () => this.panelWidth;
      const startTop = () => this.panelTop;
      const startHeight = () => this.panelHeight || this.wrapper.offsetHeight;

      attachDrag(this.resizeLeft, "ew-resize", (e, sx) => {
        const dx = sx - e.clientX;
        const w = Math.max(160, Math.min(window.innerWidth * 0.5, startWidth() + dx));
        this.panelWidth = w;
        this.wrapper.style.setProperty("--gqn-width", `${w}px`);
      }, () => { this.renderVirtualizedItems(); });

      let cachedStartTop = 72;
      let cachedStartH = 0;

      this.resizeTop.addEventListener("mousedown", () => {
        cachedStartTop = this.panelTop;
        cachedStartH = this.panelHeight || this.wrapper.offsetHeight;
      });
      attachDrag(this.resizeTop, "ns-resize", (e, _sx, sy) => {
        const dy = e.clientY - sy;
        const newTop = Math.max(8, cachedStartTop + dy);
        const newH = Math.max(200, cachedStartH - dy);
        this.panelTop = newTop;
        this.panelHeight = newH;
        this.wrapper.style.setProperty("--gqn-top", `${newTop}px`);
        this.wrapper.style.setProperty("--gqn-height", `${newH}px`);
        this.wrapper.style.setProperty("--gqn-max-height", `${newH}px`);
      }, () => { this.renderVirtualizedItems(); });

      let cachedBottomH = 0;
      this.resizeBottom.addEventListener("mousedown", () => {
        cachedBottomH = this.panelHeight || this.wrapper.offsetHeight;
      });
      attachDrag(this.resizeBottom, "ns-resize", (e, _sx, sy) => {
        const dy = e.clientY - sy;
        const maxH = window.innerHeight - this.panelTop - 16;
        const newH = Math.max(200, Math.min(maxH, cachedBottomH + dy));
        this.panelHeight = newH;
        this.wrapper.style.setProperty("--gqn-height", `${newH}px`);
        this.wrapper.style.setProperty("--gqn-max-height", `${newH}px`);
      }, () => { this.renderVirtualizedItems(); });
    }

    startClockRefresh() {
      this.stopClockRefresh();
      this.refreshClockTimer = window.setInterval(() => {
        this.relativeNow = Date.now();
        this.renderVirtualizedItems();
      }, 60 * 1000);
    }

    stopClockRefresh() {
      if (this.refreshClockTimer) {
        window.clearInterval(this.refreshClockTimer);
        this.refreshClockTimer = null;
      }
    }

    setBookmarkedIds(ids) {
      this.state.bookmarkedIds = new Set(ids);
    }

    setMessages(messages, options = {}) {
      this.state.messages = messages.slice();
      this.relativeNow = Date.now();
      this.render();
      if (options.autoScrollToBottom && this.state.autoFollow) {
        this.listContainer.scrollTop = this.listContainer.scrollHeight;
      }
    }

    getFilteredMessages() {
      let msgs = this.state.messages;

      if (this.state.filterMode === "bookmarked") {
        msgs = msgs.filter((m) => this.state.bookmarkedIds.has(m.id));
      }

      const query = (this.state.searchQuery || "").trim();
      if (query) {
        const pattern = new RegExp(escapeRegex(query), "i");
        msgs = msgs.filter((m) => pattern.test(m.text));
      }

      return msgs;
    }

    render() {
      const panel = this.wrapper;
      panel.setAttribute("data-collapsed", String(this.state.collapsed));
      panel.style.setProperty("--gqn-width", `${this.panelWidth}px`);

      const expandedEls = [
        this.resizeLeft,
        this.resizeTop,
        this.resizeBottom,
        this.shadowRoot.querySelector(".gqn-header"),
        this.searchInput?.closest(".gqn-search-row"),
        this.filterTabAll?.closest(".gqn-filter-row"),
        this.listContainer,
        this.emptyState,
        this.noResultsState,
        this.shortcutHint
      ];

      if (this.state.collapsed) {
        for (const el of expandedEls) {
          if (el) el.style.display = "none";
        }
        return;
      }

      for (const el of expandedEls) {
        if (el) el.style.display = "";
      }
      this.resizeLeft.style.display = "block";
      this.resizeTop.style.display = "block";
      this.resizeBottom.style.display = "block";

      if (this.panelTop) {
        panel.style.setProperty("--gqn-top", `${this.panelTop}px`);
      }
      if (this.panelHeight > 0) {
        panel.style.setProperty("--gqn-height", `${this.panelHeight}px`);
        panel.style.setProperty("--gqn-max-height", `${this.panelHeight}px`);
      }

      const hasMessages = this.state.messages.length > 0;
      this.emptyState.style.display = hasMessages ? "none" : "block";
      this.listContainer.style.display = hasMessages ? "block" : "none";
      this.noResultsState.style.display = "none";

      if (hasMessages) {
        this.renderVirtualizedItems();
      }
    }

    renderVirtualizedItems() {
      const allMessages = this.state.messages;
      if (!allMessages.length || this.state.collapsed) {
        this.listInner.innerHTML = "";
        return;
      }

      const messages = this.getFilteredMessages();

      if (!messages.length) {
        this.listInner.innerHTML = "";
        this.noResultsState.style.display = "block";
        this.listContainer.style.display = "none";
        return;
      }

      this.noResultsState.style.display = "none";
      this.listContainer.style.display = "block";

      const useVirtualization = messages.length > VIRTUALIZATION_THRESHOLD;
      const containerHeight = this.listContainer.clientHeight || 420;
      const totalHeight = messages.length * ITEM_ESTIMATED_HEIGHT_PX;
      let start = 0;
      let end = messages.length;

      if (useVirtualization) {
        const scrollTop = this.listContainer.scrollTop;
        const buffer = 10;
        start = Math.max(0, Math.floor(scrollTop / ITEM_ESTIMATED_HEIGHT_PX) - buffer);
        end = Math.min(messages.length, Math.ceil((scrollTop + containerHeight) / ITEM_ESTIMATED_HEIGHT_PX) + buffer);
      }

      this.renderRange = { start, end };
      this.virtualSpacer.style.height = useVirtualization ? `${totalHeight}px` : "auto";
      this.listInner.style.transform = useVirtualization ? `translateY(${start * ITEM_ESTIMATED_HEIGHT_PX}px)` : "none";
      this.listInner.innerHTML = "";

      const allMsgIndex = new Map();
      for (let i = 0; i < allMessages.length; i += 1) {
        allMsgIndex.set(allMessages[i].id, i);
      }

      for (let i = start; i < end; i += 1) {
        const message = messages[i];
        const globalIndex = allMsgIndex.get(message.id);
        const item = document.createElement("div");
        item.className = "gqn-item";
        item.dataset.messageId = message.id;
        item.title = message.text;

        const left = document.createElement("div");
        left.className = "gqn-item-left";

        const index = document.createElement("span");
        index.className = "gqn-index";
        index.textContent = `${globalIndex != null ? globalIndex + 1 : i + 1}.`;
        left.appendChild(index);

        const preview = document.createElement("span");
        preview.className = "gqn-preview";
        preview.textContent = message.preview;
        left.appendChild(preview);

        const right = document.createElement("div");
        right.className = "gqn-item-right";

        const time = document.createElement("span");
        time.className = "gqn-time";
        time.textContent = formatRelativeTime(message.createdAt, this.relativeNow);
        right.appendChild(time);

        const star = document.createElement("button");
        star.className = "gqn-star";
        const isBookmarked = this.state.bookmarkedIds.has(message.id);
        star.setAttribute("data-bookmarked", String(isBookmarked));
        star.textContent = isBookmarked ? "★" : "☆";
        star.title = isBookmarked ? "取消收藏" : "收藏此提问";
        star.addEventListener("click", (e) => {
          e.stopPropagation();
          const nowBookmarked = !this.state.bookmarkedIds.has(message.id);
          if (nowBookmarked) {
            this.state.bookmarkedIds.add(message.id);
          } else {
            this.state.bookmarkedIds.delete(message.id);
          }
          this.onBookmarkToggle(message.id, nowBookmarked, message.text);
          this.renderVirtualizedItems();
        });
        right.appendChild(star);

        item.appendChild(left);
        item.appendChild(right);

        item.addEventListener("mouseenter", () => {
          this.currentHoverId = message.id;
          this.onHover(message.id);
        });
        item.addEventListener("mouseleave", () => {
          if (this.currentHoverId === message.id) {
            this.currentHoverId = null;
          }
          this.onHoverEnd(message.id);
        });
        item.addEventListener("click", () => {
          this.onJump(message.id);
        });

        this.listInner.appendChild(item);
      }
    }
  }

  function clearTemporaryHighlights() {
    document.querySelectorAll(`.${TEMP_HIGHLIGHT_CLASS}`).forEach((node) => {
      node.classList.remove(TEMP_HIGHLIGHT_CLASS);
    });
    document.querySelectorAll(`.${HOVER_HIGHLIGHT_CLASS}`).forEach((node) => {
      node.classList.remove(HOVER_HIGHLIGHT_CLASS);
    });
  }

  function highlightElementTemporarily(element, className, durationMs) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    element.classList.add(className);
    if (durationMs > 0) {
      window.setTimeout(() => {
        element.classList.remove(className);
      }, durationMs);
    }
  }

  globalState.ui = {
    SidePanel,
    clearTemporaryHighlights,
    highlightElementTemporarily,
    TEMP_HIGHLIGHT_CLASS,
    HOVER_HIGHLIGHT_CLASS
  };
})();
