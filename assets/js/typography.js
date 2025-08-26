// Typography utilities
// - applyLangHints: add lang="en" to long Latin tokens inside CJK pages
//   to improve hyphenation without touching code blocks or links.

export function applyLangHints(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    // Only apply when page lang is CJK or container/ancestors indicate CJK
    const docLang = (document.documentElement && (document.documentElement.lang || document.documentElement.getAttribute('lang'))) || '';
    const isCJK = /^(zh|ja)/i.test(docLang);
    if (!isCJK) return;
    // Avoid repeated work
    if (root.__langHintsApplied) return; root.__langHintsApplied = true;
    const SKIP_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'SCRIPT', 'STYLE']);
    const MAX_WRAPS = 200; // safety cap
    let wraps = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        try {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
          const t = node.nodeValue;
          if (!/[A-Za-z]/.test(t)) return NodeFilter.FILTER_REJECT; // no Latin letters
          const p = node.parentElement;
          if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.closest('pre, code, kbd, samp, var, .code-scroll, .code-block')) return NodeFilter.FILTER_REJECT;
          if (p.closest('a')) return NodeFilter.FILTER_SKIP; // avoid altering links
          return NodeFilter.FILTER_ACCEPT;
        } catch { return NodeFilter.FILTER_REJECT; }
      }
    });
    const re = /([A-Za-z][A-Za-z\-]{4,})/g; // long-ish Latin tokens (>=5 chars incl. hyphen)
    const batch = [];
    let n;
    while ((n = walker.nextNode())) {
      const text = n.nodeValue;
      if (!re.test(text)) continue;
      batch.push(n);
      if (batch.length > 2000) break; // hard cap for performance
    }
    for (const node of batch) {
      if (wraps >= MAX_WRAPS) break;
      const text = node.nodeValue;
      const parts = text.split(re);
      if (!parts || parts.length <= 1) continue;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < parts.length; i++) {
        const s = parts[i];
        if (!s) continue;
        if (re.test(s)) {
          const span = document.createElement('span');
          span.setAttribute('lang', 'en');
          span.textContent = s;
          frag.appendChild(span);
          wraps++;
          if (wraps >= MAX_WRAPS) break;
        } else {
          frag.appendChild(document.createTextNode(s));
        }
      }
      node.parentNode.replaceChild(frag, node);
      if (wraps >= MAX_WRAPS) break;
    }
  } catch (_) { /* noop */ }
}

