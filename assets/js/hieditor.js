import { simpleHighlight } from './syntax-highlight.js';

function escapeHtmlInline(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function xmlFallbackHighlight(raw) {
  const MARK = (t, s) => `__H__${t}__${s}__E__`;
  let tmp = String(raw || '');
  try {
    // PI
    tmp = tmp.replace(/<\?[\s\S]*?\?>/g, (m) => MARK('preprocessor', m));
    // Comments
    tmp = tmp.replace(/<!--[\s\S]*?-->/g, (m) => MARK('comment', m));
    // CDATA
    tmp = tmp.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => MARK('comment', m));
    // Attribute values (keep simple)
    tmp = tmp.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => MARK('string', m));
    // Dates and times as whole tokens
    tmp = tmp.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => MARK('number', m));
    tmp = tmp.replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, (m) => MARK('number', m));
    // General numbers (integers/decimals)
    tmp = tmp.replace(/\b\d+(?:\.\d+)?\b/g, (m) => MARK('number', m));
    // Tags (keep last so it wraps the "<...>" blocks)
    tmp = tmp.replace(/<\/?[\w\-:.]+(?:\s+[\w\-:.]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g, (m) => MARK('tag', m));
    // Escape and unwrap
    tmp = escapeHtmlInline(tmp);
    tmp = tmp.replace(/__H__(\w+)__([\s\S]*?)__E__/g, (m, type, content) => `<span class="syntax-${type}">${content}</span>`);
    return tmp;
  } catch (_) { return escapeHtmlInline(raw || ''); }
}

function robotsFallbackHighlight(raw) {
  try {
    const lines = String(raw || '').split('\n');
    const spanWrap = (cls, txt) => `<span class="syntax-${cls}">${txt}</span>`;
    const protectedReplaceHTML = (input, regex, wrapFn) => {
      let out = '';
      let i = 0;
      const spanRe = /<span[^>]*>[\s\S]*?<\/span>/gi;
      let m;
      while ((m = spanRe.exec(input)) !== null) {
        const start = m.index;
        const end = spanRe.lastIndex;
        const before = input.slice(i, start);
        out += before.replace(regex, wrapFn);
        out += m[0];
        i = end;
      }
      out += input.slice(i).replace(regex, wrapFn);
      return out;
    };
    const out = lines.map((line) => {
      let esc = escapeHtmlInline(line);
      // Whole-line comments
      if (/^\s*#/.test(line)) {
        return spanWrap('comment', esc);
      }
      // Line-leading directive + first colon
      esc = esc.replace(/^(\s*)([A-Za-z][A-Za-z-]*\s*:)/, (m, g1, g2) => `${g1}${spanWrap('keyword', g2)}`);
      // URLs
      esc = protectedReplaceHTML(esc, /(https?:\/\/[^\s#]+)/gi, (m) => spanWrap('string', m));
      // Numbers
      esc = protectedReplaceHTML(esc, /\b\d+\b/g, (m) => spanWrap('number', m));
      // Wildcards/punctuation
      esc = protectedReplaceHTML(esc, /[/*$]/g, (m) => spanWrap('punctuation', m));
      return esc;
    }).join('\n');
    return out;
  } catch (_) {
    return escapeHtmlInline(raw || '');
  }
}

function cleanupMarkerArtifacts(html) {
  if (!html) return html;
  // Convert any leftover marker tokens into spans (defensive guard)
  let out = String(html);
  // Generic: only convert well-formed markers that include an explicit terminator
  out = out.replace(/__H[A-Z]*?__([A-Za-z-]+)__([\s\S]*?)(?:__END__|__E__)/gi, (m, t, c) => `<span class="syntax-${t.toLowerCase()}">${c}</span>`);
  // Specific known forms
  out = out.replace(/__HIGHLIGHTED__(\w+)__([\s\S]*?)__END__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__H__(\w+)__([\s\S]*?)__E__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__HILIGHTED__(\w+)__([\s\S]*?)__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  // Remove stray type tokens like __tag__ / __number__ if they remain
  out = out.replace(/__(tag|string|number|comment|operator|punctuation|property|selector|preprocessor|variables|keyword|attributes)__+/gi, '');
  // Absolute safety: strip any remaining start/end tokens so UI never shows raw markers
  out = out.replace(/__H[A-Z_]*__/g, '');
  out = out.replace(/__(?:END|E)__/g, '');
  return out;
}

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
  let html;
  if ((language || '').toLowerCase() === 'robots') {
    // Force robots-specific highlighter for reliable result
    html = robotsFallbackHighlight(raw);
    if (!/syntax-\w+/.test(html)) html = escapeHtmlInline(raw);
  } else {
    // Update highlighted HTML; rely on main highlighter. If nothing matched, show plain escaped.
    html = simpleHighlight(raw, language || 'plain') || '';
    if (!/syntax-\w+/.test(html)) {
      html = escapeHtmlInline(raw);
    }
  }
  // Final guard: ensure no marker artifacts leak to UI
  let safeHtml = cleanupMarkerArtifacts(html);
  if (/__H[A-Z_]/.test(safeHtml) || /tag__/.test(safeHtml)) {
    // Fallback to plain escaped if markers still leak
    safeHtml = escapeHtmlInline(raw);
  }
  codeEl.innerHTML = safeHtml;
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
  // force wrap off to avoid line wrapping
  ta.setAttribute('wrap', 'off');
  ta.style.whiteSpace = 'pre';
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
    // always keep white-space as pre (no wrap)
    code.style.whiteSpace = 'pre';
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
    setWrap(_) {
      // ignore external requests; enforce no-wrap
      ta.setAttribute('wrap', 'off');
      ta.style.whiteSpace = 'pre';
      code.style.whiteSpace = 'pre';
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
  // always force off
  ed.setWrap(false);
}

// Expose to window for other modules
try {
  window.__seoInitEditors = initSeoEditors;
  window.__seoEditorSet = setEditorValue;
  window.__seoEditorGet = getEditorValue;
  window.__seoEditorToggleWrap = toggleEditorWrap;
} catch (_) {}
