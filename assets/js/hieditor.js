import { simpleHighlight } from './syntax-highlight.js';

const editors = new Map();

function createLangLabel(text, onCopy) {
  const el = document.createElement('div');
  el.className = 'syntax-language-label';
  el.dataset.lang = (text || 'PLAIN').toUpperCase();
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', 'Copy code');
  el.textContent = el.dataset.lang;
  const copy = async () => {
    const ok = await (async () => {
      try { const txt = onCopy ? onCopy() : ''; await navigator.clipboard.writeText(txt); return true; } catch (_) {}
      try {
        const ta = document.createElement('textarea');
        ta.value = onCopy ? onCopy() : '';
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select(); const ok2 = document.execCommand('copy');
        document.body.removeChild(ta); return ok2;
      } catch (_) { return false; }
    })();
    const old = el.dataset.lang || 'PLAIN';
    el.classList.add('is-copied');
    el.textContent = ok ? 'COPIED' : 'FAILED';
    setTimeout(() => { el.classList.remove('is-copied'); el.textContent = old; }, 1000);
  };
  el.addEventListener('mouseenter', () => { el.classList.add('is-hover'); el.textContent = 'COPY'; });
  el.addEventListener('mouseleave', () => { el.classList.remove('is-hover'); el.textContent = el.dataset.lang || 'PLAIN'; });
  el.addEventListener('click', copy);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  return el;
}

function renderHighlight(codeEl, gutterEl, value, language) {
  const raw = String(value || '');
  // Update highlighted HTML
  codeEl.innerHTML = simpleHighlight(raw, language || 'plain');
  // Update line numbers
  const trimmed = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  const lineCount = trimmed ? (trimmed.match(/\n/g) || []).length + 1 : 1;
  if (!gutterEl) return;
  if (gutterEl.childElementCount !== lineCount) {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i++) { const s = document.createElement('span'); s.textContent = String(i); frag.appendChild(s); }
    gutterEl.innerHTML = ''; gutterEl.appendChild(frag);
  }
  const digits = String(lineCount).length;
  gutterEl.style.width = `${Math.max(3, digits + 2)}ch`;
}

function makeEditor(targetTextarea, language, readOnly) {
  const hiddenTa = targetTextarea; // keep for compatibility; hide it
  const id = hiddenTa.id;
  hiddenTa.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'hi-editor with-code-scroll';

  const scroll = document.createElement('div');
  scroll.className = 'code-scroll code-with-gutter';
  scroll.style.position = 'relative';

  const gutter = document.createElement('div');
  gutter.className = 'code-gutter';
  gutter.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'hi-body';

  const pre = document.createElement('pre');
  pre.className = 'hi-pre';
  // Background highlight layer for active/selected lines
  const hlLayer = document.createElement('div');
  hlLayer.className = 'hi-hl-layer';
  const code = document.createElement('code');
  code.className = `language-${(language || 'plain').toLowerCase()}`;
  pre.appendChild(hlLayer);
  pre.appendChild(code);

  const ta = document.createElement('textarea');
  ta.className = 'hi-ta';
  ta.spellcheck = false;
  ta.autocapitalize = 'off';
  ta.autocorrect = 'off';
  // default to soft wrap to avoid horizontal scrollbar
  ta.setAttribute('wrap', 'soft');
  if (readOnly) ta.setAttribute('readonly', 'readonly');

  body.appendChild(pre);
  body.appendChild(ta);
  scroll.appendChild(gutter);
  scroll.appendChild(body);
  container.appendChild(scroll);
  const label = createLangLabel(language || 'plain', () => ta.value || '');
  container.appendChild(label);

  // Insert after hidden textarea
  hiddenTa.parentNode.insertBefore(container, hiddenTa.nextSibling);

  // Initialize with current value
  ta.value = hiddenTa.value || '';
  renderHighlight(code, gutter, ta.value, language);
  // Sync wrap to code element initially
  try {
    const wrapSoft = (ta.getAttribute('wrap') || 'off') !== 'off';
    code.style.whiteSpace = wrapSoft ? 'pre-wrap' : 'pre';
  } catch (_) {}

  // Auto-resize to fit content height (no inner scrollbar)
  const applyHeights = () => {
    // Temporarily reset to auto to measure
    ta.style.height = 'auto';
    const minH = 0; // grow exactly with content height
    const h = Math.max(minH, ta.scrollHeight);
    ta.style.height = h + 'px';
    body.style.height = h + 'px';
    pre.style.height = h + 'px';
    // Ensure transforms are reset (no scroll-based sync)
    pre.style.transform = 'none';
    gutter.style.transform = 'none';
  };

  function getLineMetrics() {
    // Prefer code element metrics for exact alignment with rendered lines
    const cs = window.getComputedStyle(code);
    let lineH = parseFloat(cs.lineHeight);
    if (isNaN(lineH) || !isFinite(lineH)) {
      const fs = parseFloat(cs.fontSize) || 16;
      lineH = fs * 1.55;
    }
    const csPre = window.getComputedStyle(pre);
    const padTop = parseFloat(csPre.paddingTop) || 0;
    return { lineH, padTop };
  }

  function updateActiveLines() {
    try {
      const value = ta.value || '';
      const selStart = ta.selectionStart || 0;
      const selEnd = ta.selectionEnd || selStart;
      // Compute start/end line numbers (1-based)
      const beforeStart = value.slice(0, selStart);
      const beforeEnd = value.slice(0, selEnd);
      const startLine = (beforeStart.match(/\n/g) || []).length + 1;
      const endLine = (beforeEnd.match(/\n/g) || []).length + 1;
      const from = Math.min(startLine, endLine);
      const to = Math.max(startLine, endLine);
      // Update gutter classes and ensure exact line-height match
      const spans = gutter.querySelectorAll('span');
      const metrics = getLineMetrics();
      const lh = metrics.lineH;
      spans.forEach((s, idx) => {
        const lineNo = idx + 1;
        if (lineNo >= from && lineNo <= to) s.classList.add('is-active');
        else s.classList.remove('is-active');
        // Force pixel-precise line height
        s.style.lineHeight = `${lh}px`;
      });
      // Draw highlight block(s)
      const top = metrics.padTop + (from - 1) * lh;
      const height = Math.max(1, (to - from + 1)) * lh;
      hlLayer.innerHTML = '';
      const block = document.createElement('div');
      block.className = 'hi-hl-line';
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;
      hlLayer.appendChild(block);
    } catch (_) { /* noop */ }
  }

  // Sync: editor -> hidden textarea
  const onInput = () => {
    hiddenTa.value = ta.value;
    renderHighlight(code, gutter, ta.value, language);
    applyHeights();
    updateActiveLines();
  };
  ta.addEventListener('input', onInput);
  // No internal scrollbars; height grows with content
  ta.style.overflow = 'hidden';
  applyHeights();
  updateActiveLines();

  // Caret/selection changes
  const onSelChange = () => { updateActiveLines(); };
  ta.addEventListener('keyup', onSelChange);
  ta.addEventListener('click', onSelChange);
  ta.addEventListener('select', onSelChange);
  ta.addEventListener('keydown', (e) => {
    // defer until after key processes
    setTimeout(updateActiveLines, 0);
  });

  // Public API
  const api = {
    setValue(text) { ta.value = String(text || ''); hiddenTa.value = ta.value; renderHighlight(code, gutter, ta.value, language); applyHeights(); },
    getValue() { return ta.value || ''; },
    setWrap(on) {
      ta.setAttribute('wrap', on ? 'soft' : 'off');
      ta.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      code.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      // wrapping changes height; recompute
      applyHeights();
      updateActiveLines();
    },
    el: container,
    textarea: ta
  };
  editors.set(id, api);
  return api;
}

export function initSeoEditors() {
  const targets = [
    { id: 'sitemapOutput', lang: 'xml', readOnly: false },
    { id: 'robotsOutput', lang: 'robots', readOnly: false },
    { id: 'metaOutput', lang: 'html', readOnly: false },
    { id: 'configOutput', lang: 'yaml', readOnly: true }
  ];
  targets.forEach(t => {
    const ta = document.getElementById(t.id);
    if (ta && !editors.has(t.id)) makeEditor(ta, t.lang, t.readOnly);
  });
}

export function setEditorValue(id, text) {
  const ed = editors.get(id); if (ed) ed.setValue(text); else { const ta = document.getElementById(id); if (ta) ta.value = text; }
}
export function getEditorValue(id) {
  const ed = editors.get(id); if (ed) return ed.getValue(); const ta = document.getElementById(id); return ta ? (ta.value || '') : '';
}
export function toggleEditorWrap(id) {
  const ed = editors.get(id);
  if (!ed) return;
  const nowOff = !(ed.textarea.getAttribute('wrap') !== 'off');
  ed.setWrap(nowOff);
}

// Expose to window for other modules
try {
  window.__seoInitEditors = initSeoEditors;
  window.__seoEditorSet = setEditorValue;
  window.__seoEditorGet = getEditorValue;
  window.__seoEditorToggleWrap = toggleEditorWrap;
} catch (_) {}
