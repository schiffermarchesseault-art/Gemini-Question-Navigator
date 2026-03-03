(function initMessageIndexer() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  if (!globalState.selectors) {
    throw new Error("Gemini Question Navigator: selectors module is missing.");
  }

  const { normalizeText, extractCandidateText, collectUserMessageElements } = globalState.selectors;

  function truncatePreview(text, maxLength = 60) {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `${hash}`;
  }

  class MessageIndexer {
    constructor() {
      this.messages = [];
      this.nextId = 1;
      this.elementToId = new WeakMap();
      this.idToElement = new Map();
      this.signatureToId = new Map();
      this.lastAddedMessageId = null;
    }

    getMessages() {
      return this.messages.slice();
    }

    getElementById(id) {
      return this.idToElement.get(id) || null;
    }

    removeDisconnected() {
      const retained = [];
      for (const message of this.messages) {
        const element = this.idToElement.get(message.id);
        if (element && element.isConnected) {
          retained.push(message);
          continue;
        }
        this.idToElement.delete(message.id);
      }
      this.messages = retained;
    }

    ingestElement(element, timestampMs, options = {}) {
      const text = normalizeText(extractCandidateText(element));
      if (!text) {
        return null;
      }

      const existingId = this.elementToId.get(element);
      if (existingId) {
        const idx = this.messages.findIndex((msg) => msg.id === existingId);
        if (idx >= 0) {
          this.messages[idx].text = text;
          this.messages[idx].preview = truncatePreview(text);
          return this.messages[idx];
        }
      }

      const signature = hashText(text.slice(0, 320));
      const knownId = this.signatureToId.get(signature);
      if (knownId && !options.allowDuplicateText) {
        const oldElement = this.idToElement.get(knownId);
        if (!oldElement || !oldElement.isConnected) {
          this.elementToId.set(element, knownId);
          this.idToElement.set(knownId, element);
          const idx = this.messages.findIndex((msg) => msg.id === knownId);
          if (idx >= 0) {
            this.messages[idx].text = text;
            this.messages[idx].preview = truncatePreview(text);
            return this.messages[idx];
          }
        }
      }

      const createdAt = Number.isFinite(timestampMs) ? timestampMs : Date.now();
      const id = `q-${this.nextId}`;
      this.nextId += 1;
      this.elementToId.set(element, id);
      this.idToElement.set(id, element);
      this.signatureToId.set(signature, id);

      const message = {
        id,
        text,
        preview: truncatePreview(text),
        createdAt
      };
      this.messages.push(message);
      this.lastAddedMessageId = id;
      return message;
    }

    rebuildIndex() {
      this.removeDisconnected();
      const now = Date.now();
      const elements = collectUserMessageElements(document);
      for (const element of elements) {
        this.ingestElement(element, now);
      }
      return this.getMessages();
    }
  }

  globalState.MessageIndexer = MessageIndexer;
})();
