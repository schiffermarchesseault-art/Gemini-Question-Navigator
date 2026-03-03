(function initObserverModule() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  class ConversationObserver {
    constructor(onBatchChange) {
      this.onBatchChange = onBatchChange;
      this.observer = null;
      this.pending = false;
      this.hasPotentialUpdate = false;
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
    }

    stop() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.observer = null;
      this.pending = false;
      this.hasPotentialUpdate = false;
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
  }

  globalState.ConversationObserver = ConversationObserver;
})();
