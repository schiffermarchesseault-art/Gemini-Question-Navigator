(function initObserverModule() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  const SCROLL_CONTAINERS = [
    "main",
    '[role="main"]',
    '[class*="conversation"]',
    '[class*="chat"]',
    '[class*="scroll"]'
  ];

  class ConversationObserver {
    constructor(onBatchChange) {
      this.onBatchChange = onBatchChange;
      this.observer = null;
      this.pending = false;
      this.hasPotentialUpdate = false;
      this.scrollTimers = [];
      this.scrollTargets = [];
      this.lastMessageCount = 0;
      this.periodicTimer = null;
    }

    start() {
      if (this.observer || !document.body) {
        return;
      }
      this.observer = new MutationObserver((mutations) => {
        if (this.shouldProcessMutations(mutations)) {
          this.scheduleUpdate();
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this.watchScrollContainers();
      this.startPeriodicScan();
    }

    stop() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.observer = null;
      this.pending = false;
      this.hasPotentialUpdate = false;
      this.unwatchScroll();
      this.stopPeriodicScan();
    }

    shouldProcessMutations(mutations) {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          this.hasPotentialUpdate = true;
          return true;
        }
        if (mutation.type === "childList") {
          if (mutation.addedNodes.length || mutation.removedNodes.length) {
            this.hasPotentialUpdate = true;
            return true;
          }
        }
      }
      return false;
    }

    scheduleUpdate() {
      if (this.pending) {
        return;
      }
      this.pending = true;
      window.setTimeout(() => {
        this.pending = false;
        if (!this.hasPotentialUpdate) {
          return;
        }
        this.hasPotentialUpdate = false;
        this.onBatchChange();
      }, 180);
    }

    watchScrollContainers() {
      this.unwatchScroll();

      const handler = () => {
        this.onScrollActivity();
      };

      const targets = new Set();

      for (const sel of SCROLL_CONTAINERS) {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.scrollHeight > el.clientHeight) {
            targets.add(el);
          }
        });
      }

      const allScrollables = document.querySelectorAll("*");
      for (const el of allScrollables) {
        if (targets.size >= 5) break;
        const style = window.getComputedStyle(el);
        const ov = style.overflowY;
        if ((ov === "auto" || ov === "scroll") && el.scrollHeight > el.clientHeight + 200) {
          targets.add(el);
        }
      }

      for (const el of targets) {
        el.addEventListener("scroll", handler, { passive: true });
        this.scrollTargets.push({ el, handler });
      }
    }

    unwatchScroll() {
      for (const { el, handler } of this.scrollTargets) {
        el.removeEventListener("scroll", handler);
      }
      this.scrollTargets = [];
      for (const t of this.scrollTimers) {
        window.clearTimeout(t);
      }
      this.scrollTimers = [];
    }

    onScrollActivity() {
      for (const t of this.scrollTimers) {
        window.clearTimeout(t);
      }
      this.scrollTimers = [];

      const t1 = window.setTimeout(() => {
        this.onBatchChange();
      }, 400);

      const t2 = window.setTimeout(() => {
        this.onBatchChange();
      }, 1500);

      this.scrollTimers.push(t1, t2);
    }

    startPeriodicScan() {
      this.stopPeriodicScan();
      this.periodicTimer = window.setInterval(() => {
        this.onBatchChange();
      }, 3000);
    }

    stopPeriodicScan() {
      if (this.periodicTimer) {
        window.clearInterval(this.periodicTimer);
        this.periodicTimer = null;
      }
    }
  }

  globalState.ConversationObserver = ConversationObserver;
})();
