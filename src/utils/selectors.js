(function initSelectorsNamespace() {
  const NAMESPACE = "__geminiQuestionNavigator";
  const globalState = (window[NAMESPACE] = window[NAMESPACE] || {});

  const DIRECT_USER_SELECTORS = [
    '[data-message-author-role="user"]',
    '[data-author="user"]',
    '[data-role="user"]',
    '[aria-label*="You"]',
    '[aria-label*="你"]',
    '[class*="user"][class*="message"]',
    '[class*="query"][class*="bubble"]',
    'user-query',
    'message[user]'
  ];

  function normalizeText(raw) {
    return (raw || "").replace(/\s+/g, " ").trim();
  }

  function isVisibleElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (!element.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return true;
  }

  function hasLikelyUserTrait(element) {
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
    const role = (
      element.getAttribute("data-message-author-role") ||
      element.getAttribute("data-author") ||
      element.getAttribute("data-role") ||
      ""
    ).toLowerCase();
    const classes = (element.className || "").toString().toLowerCase();
    const testBlob = `${ariaLabel} ${role} ${classes}`;
    return /\b(user|you|me|query|ask|prompt|提问|你)\b/.test(testBlob);
  }

  const STRIP_PREFIXES = [
    /^你说\s*/,
    /^You said\s*/i,
    /^You:\s*/i,
    /^你：\s*/,
  ];

  function stripKnownPrefixes(text) {
    let result = text;
    for (const pattern of STRIP_PREFIXES) {
      result = result.replace(pattern, "");
    }
    return result;
  }

  function extractCandidateText(element) {
    const textSource = element.innerText || element.textContent || "";
    return stripKnownPrefixes(normalizeText(textSource));
  }

  function isReasonableMessageElement(element) {
    if (!isVisibleElement(element)) {
      return false;
    }

    const text = extractCandidateText(element);
    if (!text || text.length < 2) {
      return false;
    }
    if (text.length > 8000) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.height < 20 || rect.width < 80) {
      return false;
    }

    return true;
  }

  function collectByDirectSelectors(root) {
    const results = [];
    const seen = new Set();
    for (const selector of DIRECT_USER_SELECTORS) {
      const found = root.querySelectorAll(selector);
      for (const node of found) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        if (seen.has(node)) {
          continue;
        }
        if (!isReasonableMessageElement(node)) {
          continue;
        }
        seen.add(node);
        results.push(node);
      }
    }
    return results;
  }

  function collectByHeuristics(root) {
    const main = root.querySelector("main") || root;
    const broadCandidates = main.querySelectorAll("article, section, div, li");
    const results = [];
    for (const node of broadCandidates) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }
      if (!isReasonableMessageElement(node)) {
        continue;
      }
      if (!hasLikelyUserTrait(node)) {
        continue;
      }
      results.push(node);
    }
    return results;
  }

  function stableSortByDocumentOrder(elements) {
    return [...elements].sort((a, b) => {
      if (a === b) {
        return 0;
      }
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });
  }

  function collectUserMessageElements(root = document) {
    const direct = collectByDirectSelectors(root);
    const fallback = direct.length > 0 ? [] : collectByHeuristics(root);
    const merged = new Set([...direct, ...fallback]);
    return stableSortByDocumentOrder([...merged]);
  }

  globalState.selectors = {
    normalizeText,
    extractCandidateText,
    collectUserMessageElements
  };
})();
