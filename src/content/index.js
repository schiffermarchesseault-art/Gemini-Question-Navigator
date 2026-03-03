(function bootstrapGeminiQuestionNavigator() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  if (globalState.__bootstrapped) {
    return;
  }
  globalState.__bootstrapped = true;

  if (!globalState.MessageIndexer || !globalState.ui || !globalState.ConversationObserver) {
    return;
  }

  const { MessageIndexer } = globalState;
  const {
    SidePanel,
    clearTemporaryHighlights,
    highlightElementTemporarily,
    TEMP_HIGHLIGHT_CLASS,
    HOVER_HIGHLIGHT_CLASS
  } = globalState.ui;
  const { ConversationObserver } = globalState;

  const SETTINGS_KEY = "gqn_settings";
  const BOOKMARKS_KEY = "gqn_bookmarks";
  const LOCATION_POLL_INTERVAL_MS = 1200;
  let currentUrl = location.href;
  let panel = null;
  let observer = null;
  const indexer = new MessageIndexer();

  let bookmarkStore = {};

  function getConversationKey() {
    return location.pathname + location.search;
  }

  function injectPageHighlightStyle() {
    const styleId = "gqn-page-highlight-style";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .${TEMP_HIGHLIGHT_CLASS} {
        outline: 2px solid #f59e0b !important;
        outline-offset: 2px !important;
        transition: outline-color 180ms ease;
      }
      .${HOVER_HIGHLIGHT_CLASS} {
        outline: 2px dashed #60a5fa !important;
        outline-offset: 2px !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function persistSettings() {
    if (!panel || !chrome.storage || !chrome.storage.local) {
      return;
    }
    const payload = {
      collapsed: panel.state.collapsed,
      autoFollow: panel.state.autoFollow,
      panelWidth: panel.panelWidth,
      panelTop: panel.panelTop,
      panelHeight: panel.panelHeight
    };
    chrome.storage.local.set({ [SETTINGS_KEY]: payload }, () => void chrome.runtime?.lastError);
  }

  function restoreSettings() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get([SETTINGS_KEY], (result) => {
        resolve(result[SETTINGS_KEY] || {});
      });
    });
  }

  function persistBookmarks() {
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarkStore }, () => void chrome.runtime?.lastError);
  }

  function restoreBookmarks() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get([BOOKMARKS_KEY], (result) => {
        resolve(result[BOOKMARKS_KEY] || {});
      });
    });
  }

  function textHash(text) {
    let hash = 0;
    const str = (text || "").slice(0, 320);
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  function getBookmarkedMessageIds() {
    const convKey = getConversationKey();
    const convBookmarks = bookmarkStore[convKey] || {};
    const messages = indexer.getMessages();
    const ids = new Set();
    for (const msg of messages) {
      const th = textHash(msg.text);
      if (convBookmarks[th]) {
        ids.add(msg.id);
      }
    }
    return ids;
  }

  function handleBookmarkToggle(messageId, isBookmarked, messageText) {
    const convKey = getConversationKey();
    if (!bookmarkStore[convKey]) {
      bookmarkStore[convKey] = {};
    }
    const th = textHash(messageText);
    if (isBookmarked) {
      bookmarkStore[convKey][th] = { preview: messageText.slice(0, 60), ts: Date.now() };
    } else {
      delete bookmarkStore[convKey][th];
    }
    persistBookmarks();
  }

  function syncMessagesToPanel() {
    const beforeCount = indexer.getMessages().length;
    indexer.rebuildIndex();
    const messages = indexer.getMessages();
    const newMessageAppeared = messages.length > beforeCount;
    panel.setBookmarkedIds(getBookmarkedMessageIds());
    panel.setMessages(messages, { autoScrollToBottom: newMessageAppeared });
  }

  function jumpToMessage(messageId) {
    const element = indexer.getElementById(messageId);
    if (!element) {
      return;
    }
    clearTemporaryHighlights();
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
    highlightElementTemporarily(element, TEMP_HIGHLIGHT_CLASS, 1200);
  }

  function hoverMessage(messageId) {
    const element = indexer.getElementById(messageId);
    if (!element) {
      return;
    }
    highlightElementTemporarily(element, HOVER_HIGHLIGHT_CLASS, 0);
  }

  function clearHoverMessage(messageId) {
    const element = indexer.getElementById(messageId);
    if (!element) {
      return;
    }
    element.classList.remove(HOVER_HIGHLIGHT_CLASS);
  }

  function watchUrlChange() {
    window.setInterval(() => {
      if (location.href === currentUrl) {
        return;
      }
      currentUrl = location.href;
      window.setTimeout(() => {
        syncMessagesToPanel();
      }, 350);
    }, LOCATION_POLL_INTERVAL_MS);
  }

  function setupKeyboardShortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        e.stopPropagation();
        if (panel) {
          panel.toggleCollapse();
          persistSettings();
        }
      }
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "gqn-toggle-sidebar" && panel) {
        panel.toggleCollapse();
        persistSettings();
      }
    });
  }

  async function boot() {
    injectPageHighlightStyle();

    bookmarkStore = await restoreBookmarks();

    panel = new SidePanel({
      onJump: jumpToMessage,
      onHover: hoverMessage,
      onHoverEnd: clearHoverMessage,
      onBookmarkToggle: handleBookmarkToggle
    });
    await panel.mount();

    const settings = await restoreSettings();
    panel.state.collapsed = Boolean(settings.collapsed);
    panel.state.autoFollow = settings.autoFollow !== false;
    if (settings.panelWidth > 0) {
      panel.panelWidth = settings.panelWidth;
    }
    if (settings.panelTop > 0) {
      panel.panelTop = settings.panelTop;
    }
    if (settings.panelHeight > 0) {
      panel.panelHeight = settings.panelHeight;
    }
    if (panel.autoFollowToggle) {
      panel.autoFollowToggle.checked = panel.state.autoFollow;
    }
    panel.render();

    const originalRender = panel.render.bind(panel);
    panel.render = () => {
      originalRender();
      persistSettings();
    };

    syncMessagesToPanel();

    observer = new ConversationObserver(() => {
      syncMessagesToPanel();
    });
    observer.start();

    window.setTimeout(() => syncMessagesToPanel(), 2000);
    window.setTimeout(() => syncMessagesToPanel(), 5000);
    window.setTimeout(() => syncMessagesToPanel(), 10000);

    watchUrlChange();
    setupKeyboardShortcut();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    });
  } else {
    void boot();
  }
})();
