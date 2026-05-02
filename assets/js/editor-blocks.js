const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'code', 'card', 'source']);

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripFrontMatterIfPresent(markdown) {
  const text = normalizeText(markdown);
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return text;
  const after = text.slice(end + 4);
  return after.startsWith('\n') ? after.slice(1) : after;
}

function makeBlock(type, raw, data = {}) {
  const safeType = BLOCK_TYPES.has(type) ? type : 'source';
  const id = data.id || `block-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    type: safeType,
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

function isBlankLine(line) {
  return /^\s*\n?$/.test(line || '');
}

function splitMarkdownLines(text) {
  const input = normalizeText(text);
  if (!input) return [];
  const matches = input.match(/[^\n]*(?:\n|$)/g) || [];
  return matches.filter((line, index) => !(line === '' && index === matches.length - 1));
}

function detachBlockTerminator(raw, after) {
  if (raw.endsWith('\n')) {
    return { raw: raw.slice(0, -1), after: `\n${after || ''}` };
  }
  return { raw, after: after || '' };
}

function extractChunks(markdown) {
  const lines = splitMarkdownLines(stripFrontMatterIfPresent(markdown));
  const chunks = [];
  let index = 0;
  let leading = '';

  while (index < lines.length && isBlankLine(lines[index])) {
    leading += lines[index];
    index += 1;
  }

  while (index < lines.length) {
    const start = index;
    const first = lines[index] || '';
    const trimmed = first.trimStart();

    if (trimmed.startsWith('```') || trimmed.startsWith('````')) {
      const fence = trimmed.startsWith('````') ? '````' : '```';
      index += 1;
      while (index < lines.length) {
        const candidate = (lines[index] || '').trimStart();
        index += 1;
        if (candidate.startsWith(fence)) break;
      }
    } else {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index])) index += 1;
    }

    let raw = lines.slice(start, index).join('');
    let after = '';
    while (index < lines.length && isBlankLine(lines[index])) {
      after += lines[index];
      index += 1;
    }

    const detached = detachBlockTerminator(raw, after);
    chunks.push({
      raw: detached.raw,
      after: detached.after,
      before: chunks.length ? '' : leading
    });
    leading = '';
  }

  if (leading && !chunks.length) chunks.push({ raw: leading, after: '', before: '' });
  return chunks;
}

function parseImageBlock(raw) {
  const match = raw.match(/^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"([^"\n]*)")?\)$/);
  if (!match) return null;
  return { alt: match[1] || '', src: match[2] || '', title: match[3] || '' };
}

function parseCardBlock(raw) {
  const match = raw.match(/^\[([^\]\n]+)\]\(\?id=([^) \n]+)(?:\s+"([^"\n]*)")?\)$/);
  if (!match) return null;
  const title = match[3] || '';
  return {
    label: match[1] || '',
    location: decodeURIComponent(match[2] || ''),
    title,
    forceCard: /\b(card|preview)\b/i.test(title)
  };
}

function parseCodeBlock(raw) {
  const lines = raw.split('\n');
  if (lines.length < 2) return null;
  const open = lines[0].match(/^```([^\n`]*)$/);
  if (!open) return null;
  if (!/^```\s*$/.test(lines[lines.length - 1])) return null;
  return {
    lang: (open[1] || '').trim(),
    text: lines.slice(1, -1).join('\n')
  };
}

function parseListBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length) return null;
  let type = '';
  const items = [];
  for (const line of lines) {
    if (/^\s/.test(line)) return null;
    let match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      if (type && type !== 'task') return null;
      type = 'task';
      items.push({ checked: match[1].toLowerCase() === 'x', text: match[2] || '' });
      continue;
    }
    match = line.match(/^[-*+]\s+(.+)$/);
    if (match) {
      if (type && type !== 'ul') return null;
      type = 'ul';
      items.push({ text: match[1] || '' });
      continue;
    }
    match = line.match(/^(\d{1,9})[\.)]\s+(.+)$/);
    if (match) {
      if (type && type !== 'ol') return null;
      type = 'ol';
      items.push({ number: Number(match[1]), text: match[2] || '' });
      continue;
    }
    return null;
  }
  return type && items.length ? { listType: type, items } : null;
}

function parseQuoteBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length || !lines.every(line => line.startsWith('>'))) return null;
  const first = lines[0].slice(1).trim();
  if (/^\[!\w+\]/.test(first)) return null;
  return { text: lines.map(line => line.replace(/^>\s?/, '')).join('\n') };
}

function isRiskyParagraph(raw) {
  if (!raw.trim()) return false;
  if (/^\|/.test(raw.trimStart())) return true;
  if (/\n\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*(?:\n|$)/.test(raw)) return true;
  if (/^\s+[-*+]\s+/m.test(raw) || /^\s+\d{1,9}[\.)]\s+/m.test(raw)) return true;
  if (/!\[[^\]]*\]\([^)]+\)/.test(raw)) return true;
  if (/<[A-Za-z][^>]*>/.test(raw)) return true;
  return false;
}

function classifyChunk(raw, data = {}) {
  const text = String(raw || '');
  const trimmed = text.trim();
  if (!trimmed) return makeBlock('source', text, data);

  const code = parseCodeBlock(text);
  if (code) return makeBlock('code', text, { ...data, ...code });
  if (/^```/.test(trimmed)) return makeBlock('source', text, data);

  const heading = text.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    return makeBlock('heading', text, { ...data, level: heading[1].length, text: heading[2] || '' });
  }

  const image = parseImageBlock(trimmed);
  if (image && trimmed === text) return makeBlock('image', text, { ...data, ...image });

  const card = parseCardBlock(trimmed);
  if (card && trimmed === text) return makeBlock('card', text, { ...data, ...card });

  const quote = parseQuoteBlock(text);
  if (quote) return makeBlock('quote', text, { ...data, ...quote });
  if (text.trimStart().startsWith('>')) return makeBlock('source', text, data);

  const list = parseListBlock(text);
  if (list) return makeBlock('list', text, { ...data, ...list });

  if (isRiskyParagraph(text)) return makeBlock('source', text, data);
  return makeBlock('paragraph', text, { ...data, text });
}

export function parseMarkdownBlocks(markdown) {
  return extractChunks(markdown).map(chunk => classifyChunk(chunk.raw, {
    before: chunk.before || '',
    after: chunk.after || ''
  }));
}

function escapeMarkdownInline(value) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function serializeImage(data = {}) {
  const alt = String(data.alt || '');
  const src = String(data.src || '').trim() || 'assets/image.png';
  const title = String(data.title || '').trim();
  return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
}

function serializeCard(data = {}) {
  const label = String(data.label || data.location || 'Article').trim() || 'Article';
  const location = encodeURIComponent(String(data.location || '').trim()).replace(/%2F/g, '/');
  const title = data.forceCard || data.title ? ` "${String(data.title || 'card').trim() || 'card'}"` : '';
  return `[${label}](?id=${location || 'post/example.md'}${title})`;
}

function serializeBlock(block) {
  if (!block || typeof block !== 'object') return '';
  if (!block.dirty && typeof block.raw === 'string') return block.raw;
  const data = block.data || {};
  switch (block.type) {
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(data.level) || 2));
      return `${'#'.repeat(level)} ${String(data.text || '').trim()}`;
    }
    case 'image':
      return serializeImage(data);
    case 'list': {
      const items = Array.isArray(data.items) ? data.items : [];
      const listType = data.listType === 'ol' || data.listType === 'task' ? data.listType : 'ul';
      return items.map((item, index) => {
        const text = String(item && item.text != null ? item.text : '').trim() || 'List item';
        if (listType === 'ol') return `${index + 1}. ${text}`;
        if (listType === 'task') return `- [${item && item.checked ? 'x' : ' '}] ${text}`;
        return `- ${text}`;
      }).join('\n');
    }
    case 'quote':
      return String(data.text || '').split('\n').map(line => `> ${line}`).join('\n');
    case 'code': {
      const lang = String(data.lang || '').trim();
      return `\`\`\`${lang}\n${String(data.text || '')}\n\`\`\``;
    }
    case 'card':
      return serializeCard(data);
    case 'source':
      return String(data.text != null ? data.text : block.raw || '');
    case 'paragraph':
    default:
      return String(data.text || '').trim();
  }
}

export function serializeMarkdownBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(block => {
    const before = block && block.data && block.data.before ? String(block.data.before) : '';
    const after = block && block.data && block.data.after != null ? String(block.data.after) : '\n\n';
    return `${before}${serializeBlock(block)}${after}`;
  }).join('');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[ch]);
}

function renderInlineMarkdown(text) {
  const input = String(text || '');
  let out = '';
  let index = 0;
  const emit = (value) => { out += escapeHtml(value); };

  while (index < input.length) {
    const rest = input.slice(index);
    const link = rest.match(/^\[([^\]\n]+)\]\(([^)\s\n]+)\)/);
    if (link) {
      out += `<a href="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`;
      index += link[0].length;
      continue;
    }
    const patterns = [
      ['**', '**', 'strong'],
      ['~~', '~~', 's'],
      ['`', '`', 'code'],
      ['*', '*', 'em']
    ];
    let matched = false;
    for (const [open, close, tag] of patterns) {
      if (!rest.startsWith(open)) continue;
      const end = input.indexOf(close, index + open.length);
      if (end <= index + open.length) continue;
      const body = input.slice(index + open.length, end);
      out += `<${tag}>${escapeHtml(body)}</${tag}>`;
      index = end + close.length;
      matched = true;
      break;
    }
    if (matched) continue;
    emit(input[index]);
    index += 1;
  }
  return out;
}

function serializeInlineDom(root) {
  const walk = (node) => {
    if (!node) return '';
    if (node.nodeType === 3) return escapeMarkdownInline(node.nodeValue || '');
    if (node.nodeType !== 1) return '';
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'br') return '\n';
    const inner = Array.from(node.childNodes || []).map(walk).join('');
    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
    if (tag === 'em' || tag === 'i') return `*${inner}*`;
    if (tag === 's' || tag === 'del' || tag === 'strike') return `~~${inner}~~`;
    if (tag === 'code') return `\`${inner.replace(/`/g, '\\`')}\``;
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      return `[${inner}](${href})`;
    }
    if (tag === 'div' || tag === 'p') {
      const suffix = tag === 'div' ? '\n' : '';
      return `${inner}${suffix}`;
    }
    return inner;
  };
  return Array.from(root.childNodes || []).map(walk).join('').replace(/\n$/, '');
}

function setPlainContentEditableValue(el, value) {
  if (!el) return;
  el.innerHTML = renderInlineMarkdown(value);
}

function button(label, className = 'blocks-btn') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

function inputValue(input) {
  return input ? String(input.value || '') : '';
}

function editableText(el) {
  if (!el) return '';
  return serializeInlineDom(el).replace(/\n{3,}/g, '\n\n').trim();
}

function splitEditableTextAtSelection(el) {
  const fallback = editableText(el);
  try {
    const sel = window.getSelection && window.getSelection();
    if (!el || !sel || !sel.rangeCount) return { before: fallback, after: '' };
    const range = sel.getRangeAt(0);
    if (!nodeContains(el, range.startContainer) || !nodeContains(el, range.endContainer)) {
      return { before: fallback, after: '' };
    }
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const afterRange = document.createRange();
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);
    return {
      before: serializeInlineDom(beforeRange.cloneContents()).replace(/\n{3,}/g, '\n\n').trim(),
      after: serializeInlineDom(afterRange.cloneContents()).replace(/\n{3,}/g, '\n\n').trim()
    };
  } catch (_) {
    return { before: fallback, after: '' };
  }
}

function isEditableSelectionAtStart(el) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!el || !sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed || !nodeContains(el, range.startContainer)) return false;
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    return serializeInlineDom(beforeRange.cloneContents()).trim() === '';
  } catch (_) {
    return false;
  }
}

function placeCaretAtEnd(el) {
  try {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection && window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {}
}

function getEditableCaretTextOffset(el) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!el || !sel || !sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    if (!range.collapsed || !nodeContains(el, range.startContainer)) return 0;
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    return String(beforeRange.toString() || '').length;
  } catch (_) {
    return 0;
  }
}

function placeCaretAtTextOffset(el, offset) {
  try {
    if (!el) return;
    const targetOffset = Math.max(0, Number(offset) || 0);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let remaining = targetOffset;
    while (node) {
      const length = String(node.nodeValue || '').length;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection && window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= length;
      node = walker.nextNode();
    }
    placeCaretAtEnd(el);
  } catch (_) {}
}

function caretRectForEditable(el) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!el || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!range.collapsed || !nodeContains(el, range.startContainer)) return null;
    const rect = range.getBoundingClientRect && range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) return rect;
    const restoreRange = range.cloneRange();
    const markerRange = range.cloneRange();
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    markerRange.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.remove();
    sel.removeAllRanges();
    sel.addRange(restoreRange);
    return markerRect;
  } catch (_) {
    return null;
  }
}

function isEditableCaretOnEdgeLine(el, direction) {
  try {
    const caretRect = caretRectForEditable(el);
    if (!caretRect) return true;
    const lineRects = Array.from(el.getClientRects ? el.getClientRects() : [])
      .filter(rect => rect && rect.width > 0 && rect.height > 0)
      .sort((a, b) => a.top - b.top);
    if (lineRects.length <= 1) return true;
    const tolerance = Math.max(3, caretRect.height * 0.6);
    const caretTop = caretRect.top;
    if (direction === 'up') return Math.abs(caretTop - lineRects[0].top) <= tolerance;
    return Math.abs(caretTop - lineRects[lineRects.length - 1].top) <= tolerance;
  } catch (_) {
    return true;
  }
}

function placeCaretAtVisualLine(el, x, edge, fallbackOffset = 0) {
  try {
    const lineRects = Array.from(el && el.getClientRects ? el.getClientRects() : [])
      .filter(rect => rect && rect.width > 0 && rect.height > 0)
      .sort((a, b) => a.top - b.top);
    if (!lineRects.length) {
      placeCaretAtTextOffset(el, fallbackOffset);
      return;
    }
    const line = edge === 'last' ? lineRects[lineRects.length - 1] : lineRects[0];
    const targetX = Math.max(line.left + 1, Math.min(Number(x) || line.left, line.right - 1));
    const targetY = line.top + (line.height / 2);
    let range = null;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(targetX, targetY);
      if (pos && nodeContains(el, pos.offsetNode)) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    if (!range && document.caretRangeFromPoint) {
      const pointRange = document.caretRangeFromPoint(targetX, targetY);
      if (pointRange && nodeContains(el, pointRange.startContainer)) range = pointRange;
    }
    if (!range) {
      placeCaretAtTextOffset(el, fallbackOffset);
      return;
    }
    range.collapse(true);
    const sel = window.getSelection && window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {
    placeCaretAtTextOffset(el, fallbackOffset);
  }
}

function codeEditableText(el) {
  if (!el) return '';
  return String(el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').replace(/\n$/, '');
}

function nodeContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

function getSelectionText() {
  try {
    const sel = window.getSelection && window.getSelection();
    return sel ? String(sel.toString() || '') : '';
  } catch (_) {
    return '';
  }
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function insertInlineHtml(html) {
  try {
    if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
      document.execCommand('insertHTML', false, html);
      return true;
    }
  } catch (_) {}
  try {
    const sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const wrap = document.createElement('span');
    wrap.innerHTML = html;
    const frag = document.createDocumentFragment();
    let last = null;
    while (wrap.firstChild) {
      last = wrap.firstChild;
      frag.appendChild(last);
    }
    range.insertNode(frag);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return true;
  } catch (_) {
    return false;
  }
}

export function createMarkdownBlocksEditor(root, options = {}) {
  if (!root) return null;
  const labels = options.labels || {};
  const text = (key, fallback) => labels[key] || fallback;
  const state = {
    blocks: [],
    activeIndex: -1,
    activeEditable: null,
    activeSync: null,
    pendingListFocus: null,
    cardEntries: [],
    cardPickerOpen: false
  };

  root.classList.add('markdown-blocks-shell');
  root.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'blocks-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', text('toolbarAria', 'Block tools'));

  const inlineToolbar = document.createElement('div');
  inlineToolbar.className = 'blocks-inline-toolbar';
  inlineToolbar.setAttribute('role', 'toolbar');
  inlineToolbar.setAttribute('aria-label', text('inlineToolbarAria', 'Inline formatting'));

  const list = document.createElement('div');
  list.className = 'blocks-list';
  list.setAttribute('aria-label', text('listAria', 'Markdown blocks'));

  const picker = document.createElement('div');
  picker.className = 'blocks-card-picker';
  picker.hidden = true;
  picker.setAttribute('aria-hidden', 'true');

  root.append(toolbar, inlineToolbar, picker, list);

  const markDirty = (block) => {
    if (!block) return;
    block.dirty = true;
    if (block.data && block.data.after == null) block.data.after = '\n\n';
  };

  const emit = () => {
    if (typeof options.onChange === 'function') {
      options.onChange(serializeMarkdownBlocks(state.blocks));
    }
  };

  const updateFromControl = (block, patch, renderAfter = false) => {
    if (!block) return;
    Object.assign(block.data, patch || {});
    markDirty(block);
    if (renderAfter) render();
    emit();
  };

  const syncActiveEditable = () => {
    try {
      if (typeof state.activeSync === 'function') state.activeSync();
    } catch (_) {}
  };

  const setActive = (index, editable = null, sync = null) => {
    const maxIndex = state.blocks.length - 1;
    const numericIndex = Number.isFinite(Number(index)) ? Number(index) : -1;
    state.activeIndex = maxIndex >= 0 ? Math.max(-1, Math.min(numericIndex, maxIndex)) : -1;
    if (editable) {
      state.activeEditable = editable;
      state.activeSync = sync;
    }
    Array.from(list.querySelectorAll('.blocks-block')).forEach((el, idx) => {
      el.classList.toggle('is-active', idx === state.activeIndex);
    });
  };

  const getBaseDir = () => {
    try {
      if (typeof options.getBaseDir === 'function') return options.getBaseDir() || '';
    } catch (_) {}
    return '';
  };

  const resolveAssetSrc = (src) => {
    try {
      if (typeof options.resolveImageSrc === 'function') return options.resolveImageSrc(src, getBaseDir());
    } catch (_) {}
    return String(src || '').trim();
  };

  const hydrateImages = (node) => {
    try {
      if (typeof options.hydrateImages === 'function') options.hydrateImages(node);
    } catch (_) {}
  };

  const hydrateCard = (node) => {
    try {
      if (typeof options.hydrateCard === 'function') options.hydrateCard(node);
    } catch (_) {}
  };

  const insertBlock = (type, data = {}, index = state.activeIndex + 1) => {
    const safeIndex = Math.max(0, Math.min(index, state.blocks.length));
    const block = makeBlock(type, '', { after: '\n\n', dirty: true, ...data });
    block.dirty = true;
    state.blocks.splice(safeIndex, 0, block);
    render();
    setActive(safeIndex);
    emit();
    return block;
  };

  const applyInlineCommand = (kind) => {
    const editable = state.activeEditable;
    if (!editable || !nodeContains(root, editable)) return;
    try { editable.focus(); } catch (_) {}
    if (kind === 'bold' || kind === 'italic' || kind === 'strikeThrough') {
      try { document.execCommand(kind, false, null); } catch (_) {}
      syncActiveEditable();
      return;
    }
    const selected = getSelectionText();
    if (!selected) return;
    if (kind === 'code') {
      insertInlineHtml(`<code>${escapeHtml(selected)}</code>`);
      syncActiveEditable();
      return;
    }
    if (kind === 'link') {
      let href = '';
      try { href = window.prompt(text('linkPrompt', 'Link URL'), ''); } catch (_) {}
      href = String(href || '').trim();
      if (!href) return;
      insertInlineHtml(`<a href="${escapeAttribute(href)}">${escapeHtml(selected)}</a>`);
      syncActiveEditable();
    }
  };

  [
    ['B', 'bold', 'inlineBold', 'Bold'],
    ['I', 'italic', 'inlineItalic', 'Italic'],
    ['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'],
    ['`', 'code', 'inlineCode', 'Inline code'],
    ['Link', 'link', 'inlineLink', 'Link']
  ].forEach(([label, command, key, fallback]) => {
    const btn = button(label, 'blocks-inline-btn');
    btn.title = text(key, fallback);
    btn.setAttribute('aria-label', text(key, fallback));
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => applyInlineCommand(command));
    inlineToolbar.appendChild(btn);
  });

  const renderCardPicker = () => {
    picker.innerHTML = '';
    if (!state.cardPickerOpen) {
      picker.hidden = true;
      picker.setAttribute('aria-hidden', 'true');
      return;
    }
    picker.hidden = false;
    picker.setAttribute('aria-hidden', 'false');
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'blocks-card-search';
    search.placeholder = text('cardSearch', 'Search articles...');
    const results = document.createElement('div');
    results.className = 'blocks-card-results';
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      results.innerHTML = '';
      const entries = state.cardEntries.filter(entry => {
        if (!query) return true;
        return String(entry.search || `${entry.title || ''} ${entry.key || ''} ${entry.location || ''}`).toLowerCase().includes(query);
      });
      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'blocks-empty';
        empty.textContent = text('cardEmpty', 'No matching articles');
        results.appendChild(empty);
        return;
      }
      entries.slice(0, 30).forEach(entry => {
        const item = button(entry.title || entry.key || entry.location || text('articleCard', 'Article Card'), 'blocks-card-result');
        item.addEventListener('click', () => {
          insertBlock('card', {
            label: entry.title || entry.key || entry.location || 'Article',
            location: entry.location || '',
            title: 'card',
            forceCard: true
          });
          state.cardPickerOpen = false;
          renderCardPicker();
        });
        const meta = document.createElement('span');
        meta.textContent = entry.location || '';
        item.appendChild(meta);
        results.appendChild(item);
      });
    };
    search.addEventListener('input', draw);
    picker.append(search, results);
    draw();
    setTimeout(() => {
      try { search.focus(); } catch (_) {}
    }, 0);
  };

  const addButtons = [
    ['paragraph', 'paragraph', 'Paragraph', { text: 'New paragraph' }],
    ['heading', 'heading', 'Heading', { level: 2, text: 'Heading' }],
    ['image', 'image', 'Image', { alt: '', src: 'assets/image.png' }],
    ['list', 'list', 'List', { listType: 'ul', items: [{ text: 'List item' }] }],
    ['quote', 'quote', 'Quote', { text: 'Quote' }],
    ['code', 'code', 'Code', { lang: '', text: '' }],
    ['source', 'source', 'Markdown', { text: '' }]
  ];

  addButtons.forEach(([key, type, fallback, data]) => {
    const btn = button(text(key, fallback));
    btn.addEventListener('click', () => insertBlock(type, data));
    toolbar.appendChild(btn);
  });

  const cardBtn = button(text('articleCard', 'Article Card'));
  cardBtn.addEventListener('click', () => {
    if (!state.cardEntries.length) {
      insertBlock('card', { label: 'Article', location: '', title: 'card', forceCard: true });
      return;
    }
    state.cardPickerOpen = !state.cardPickerOpen;
    renderCardPicker();
  });
  toolbar.appendChild(cardBtn);

  const uploadBtn = button(text('uploadImage', 'Upload Image'));
  uploadBtn.addEventListener('click', () => {
    if (typeof options.requestImageUpload === 'function') {
      options.requestImageUpload({ index: state.activeIndex + 1 });
    } else {
      insertBlock('image', { alt: '', src: 'assets/image.png' });
    }
  });
  toolbar.appendChild(uploadBtn);

  const createRichEditable = (tagName, block, key, className, index) => {
    const editable = document.createElement(tagName);
    editable.className = className || 'blocks-rich-editable';
    editable.contentEditable = 'true';
    editable.spellcheck = true;
    setPlainContentEditableValue(editable, block.data[key] || '');
    const sync = () => updateFromControl(block, { [key]: editableText(editable) });
    editable.addEventListener('input', sync);
    editable.addEventListener('focus', () => setActive(index, editable, sync));
    editable.addEventListener('click', (event) => {
      if (event.target && event.target.closest && event.target.closest('a')) event.preventDefault();
      setActive(index, editable, sync);
    });
    return editable;
  };

  const renderHeadingBlock = (body, block, index) => {
    const row = document.createElement('div');
    row.className = 'blocks-heading-controls';
    const select = document.createElement('select');
    select.className = 'blocks-heading-level';
    [1, 2, 3, 4, 5, 6].forEach(level => {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = `H${level}`;
      select.appendChild(option);
    });
    select.value = String(block.data.level || 2);
    select.addEventListener('change', () => updateFromControl(block, { level: Number(select.value) || 2 }, true));
    const level = Math.max(1, Math.min(6, Number(block.data.level) || 2));
    const heading = createRichEditable(`h${level}`, block, 'text', `blocks-rich-editable blocks-heading-text blocks-heading-h${level}`, index);
    row.appendChild(select);
    body.append(row, heading);
  };

  const renderImageBlock = (body, block) => {
    const figure = document.createElement('figure');
    figure.className = 'blocks-image-figure';
    const img = document.createElement('img');
    img.className = 'blocks-image-preview';
    img.alt = block.data.alt || '';
    const resolved = resolveAssetSrc(block.data.src || '');
    if (resolved) img.src = resolved;
    img.loading = 'lazy';
    img.decoding = 'async';
    const caption = document.createElement('figcaption');
    caption.textContent = block.data.alt || block.data.src || text('imagePath', 'Image path');
    figure.append(img, caption);

    const controls = document.createElement('div');
    controls.className = 'blocks-inspector blocks-image-inspector';
    const alt = document.createElement('input');
    alt.type = 'text';
    alt.value = block.data.alt || '';
    alt.placeholder = text('imageAlt', 'Alt text');
    const src = document.createElement('input');
    src.type = 'text';
    src.value = block.data.src || '';
    src.placeholder = text('imagePath', 'Image path');
    const title = document.createElement('input');
    title.type = 'text';
    title.value = block.data.title || '';
    title.placeholder = text('imageTitle', 'Image title');
    const update = () => {
      updateFromControl(block, { alt: inputValue(alt), src: inputValue(src), title: inputValue(title) });
      img.alt = block.data.alt || '';
      const nextSrc = resolveAssetSrc(block.data.src || '');
      if (nextSrc) img.src = nextSrc;
      caption.textContent = block.data.alt || block.data.src || text('imagePath', 'Image path');
      hydrateImages(figure);
    };
    alt.addEventListener('input', update);
    src.addEventListener('input', update);
    title.addEventListener('input', update);
    controls.append(alt, src, title);
    body.append(figure, controls);
    hydrateImages(figure);
  };

  const createListTypeSelect = (block) => {
    const select = document.createElement('select');
    select.className = 'blocks-list-type-select';
    select.title = text('listType', 'List type');
    [['ul', text('unordered', 'Bulleted')], ['ol', text('ordered', 'Numbered')], ['task', text('task', 'Checklist')]].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = block.data.listType || 'ul';
    select.addEventListener('change', () => updateFromControl(block, { listType: select.value }, true));
    return select;
  };

  const renderListBlock = (body, block, index) => {
    const items = Array.isArray(block.data.items) && block.data.items.length
      ? block.data.items
      : [{ text: 'List item', checked: false }];
    const listType = block.data.listType === 'ol' || block.data.listType === 'task' ? block.data.listType : 'ul';
    const listEl = document.createElement(listType === 'ol' ? 'ol' : 'ul');
    listEl.className = `blocks-visual-list blocks-visual-list-${listType}`;
    items.forEach((item, itemIndex) => {
      const li = document.createElement('li');
      li.className = 'blocks-list-item';
      if (listType === 'task') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        checkbox.addEventListener('change', () => {
          const next = items.slice();
          next[itemIndex] = { ...next[itemIndex], checked: checkbox.checked };
          updateFromControl(block, { items: next });
        });
        li.appendChild(checkbox);
      }
      const span = document.createElement('span');
      span.className = 'blocks-rich-editable blocks-list-text';
      span.contentEditable = 'true';
      span.spellcheck = true;
      setPlainContentEditableValue(span, item.text || '');
      const sync = () => {
        const next = items.slice();
        next[itemIndex] = { ...next[itemIndex], text: editableText(span) };
        updateFromControl(block, { items: next });
      };
      span.addEventListener('input', sync);
      span.addEventListener('keydown', (event) => {
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          const split = splitEditableTextAtSelection(span);
          const next = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
          next[itemIndex] = { ...next[itemIndex], text: split.before };
          next.splice(itemIndex + 1, 0, { text: split.after, checked: false });
          state.pendingListFocus = { blockId: block.id, itemIndex: itemIndex + 1, atEnd: true };
          updateFromControl(block, { items: next }, true);
          return;
        }
        if ((event.key === 'Backspace' || event.key === 'Delete') && itemIndex > 0 && isEditableSelectionAtStart(span)) {
          event.preventDefault();
          const currentText = editableText(span);
          const next = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
          if (currentText) {
            const previous = next[itemIndex - 1] || { text: '', checked: false };
            next[itemIndex - 1] = { ...previous, text: `${previous.text || ''}${currentText}` };
          }
          next.splice(itemIndex, 1);
          state.pendingListFocus = { blockId: block.id, itemIndex: itemIndex - 1, atEnd: true };
          updateFromControl(block, { items: next.length ? next : [{ text: '', checked: false }] }, true);
          return;
        }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && items.length > 1) {
          const nextIndex = event.key === 'ArrowUp' ? itemIndex - 1 : itemIndex + 1;
          if (nextIndex < 0 || nextIndex >= items.length) return;
          if (!isEditableCaretOnEdgeLine(span, event.key === 'ArrowUp' ? 'up' : 'down')) return;
          event.preventDefault();
          const caretOffset = getEditableCaretTextOffset(span);
          const caretRect = caretRectForEditable(span);
          sync();
          const target = listEl.querySelector(`.blocks-list-item:nth-child(${nextIndex + 1}) .blocks-list-text`);
          if (!target) return;
          try { target.focus(); } catch (_) {}
          placeCaretAtVisualLine(target, caretRect ? caretRect.left : 0, event.key === 'ArrowUp' ? 'last' : 'first', caretOffset);
          setActive(index);
        }
      });
      span.addEventListener('focus', () => setActive(index, span, sync));
      span.addEventListener('click', (event) => {
        if (event.target && event.target.closest && event.target.closest('a')) event.preventDefault();
        setActive(index, span, sync);
      });
      li.appendChild(span);
      if (state.pendingListFocus && state.pendingListFocus.blockId === block.id && state.pendingListFocus.itemIndex === itemIndex) {
        queueMicrotask(() => {
          if (!nodeContains(root, span)) return;
          const pending = state.pendingListFocus;
          state.pendingListFocus = null;
          try { span.focus(); } catch (_) {}
          if (pending && pending.atEnd) placeCaretAtEnd(span);
          setActive(index, span, sync);
        });
      }
      listEl.appendChild(li);
    });
    body.appendChild(listEl);
  };

  const renderCodeBlock = (body, block, index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-inspector blocks-code-inspector';
    const lang = document.createElement('input');
    lang.type = 'text';
    lang.value = block.data.lang || '';
    lang.placeholder = text('codeLanguage', 'Language');
    lang.addEventListener('input', () => updateFromControl(block, { lang: inputValue(lang) }));
    controls.appendChild(lang);

    const pre = document.createElement('pre');
    pre.className = 'blocks-code-preview';
    const code = document.createElement('code');
    code.contentEditable = 'true';
    code.spellcheck = false;
    code.textContent = block.data.text || '';
    const sync = () => updateFromControl(block, { text: codeEditableText(code) });
    code.addEventListener('input', sync);
    code.addEventListener('focus', () => setActive(index, code, sync));
    pre.appendChild(code);
    body.append(controls, pre);
  };

  const renderCardBlock = (body, block) => {
    const preview = document.createElement('div');
    preview.className = 'blocks-card-preview';
    const href = `?id=${encodeURIComponent(String(block.data.location || '').trim())}`;
    const label = String(block.data.label || block.data.location || text('articleCard', 'Article Card')).trim() || text('articleCard', 'Article Card');
    preview.innerHTML = `<a href="${escapeAttribute(href)}" title="card">${escapeHtml(label)}</a>`;
    body.appendChild(preview);
    hydrateCard(preview);

    const controls = document.createElement('div');
    controls.className = 'blocks-inspector blocks-card-inspector';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = block.data.label || '';
    labelInput.placeholder = text('cardLabel', 'Card label');
    const location = document.createElement('input');
    location.type = 'text';
    location.value = block.data.location || '';
    location.placeholder = text('cardLocation', 'post/path/file.md');
    const update = () => updateFromControl(block, {
      label: inputValue(labelInput),
      location: inputValue(location),
      title: 'card',
      forceCard: true
    }, true);
    labelInput.addEventListener('input', update);
    location.addEventListener('input', update);
    controls.append(labelInput, location);
    body.appendChild(controls);
  };

  const renderBlockBody = (block, index) => {
    const body = document.createElement('div');
    body.className = 'blocks-block-body blocks-visual-body';
    if (block.type === 'heading') {
      renderHeadingBlock(body, block, index);
    } else if (block.type === 'paragraph') {
      body.appendChild(createRichEditable('p', block, 'text', 'blocks-rich-editable blocks-paragraph-text', index));
    } else if (block.type === 'quote') {
      const quote = document.createElement('blockquote');
      quote.className = 'blocks-quote-preview';
      quote.appendChild(createRichEditable('p', block, 'text', 'blocks-rich-editable blocks-quote-text', index));
      body.appendChild(quote);
    } else if (block.type === 'image') {
      renderImageBlock(body, block);
    } else if (block.type === 'list') {
      renderListBlock(body, block, index);
    } else if (block.type === 'code') {
      renderCodeBlock(body, block, index);
    } else if (block.type === 'card') {
      renderCardBlock(body, block);
    } else {
      const area = document.createElement('textarea');
      area.className = 'blocks-textarea blocks-source-textarea';
      area.spellcheck = false;
      area.value = block.data.text != null ? block.data.text : block.raw || '';
      area.addEventListener('input', () => updateFromControl(block, { text: area.value }));
      body.appendChild(area);
    }
    body.addEventListener('click', () => setActive(index));
    return body;
  };

  function render() {
    list.innerHTML = '';
    if (!state.blocks.length) {
      const empty = document.createElement('div');
      empty.className = 'blocks-empty';
      empty.textContent = text('empty', 'No blocks yet.');
      list.appendChild(empty);
      return;
    }
    state.blocks.forEach((block, index) => {
      const item = document.createElement('section');
      item.className = `blocks-block blocks-block-${block.type}`;
      item.dataset.type = block.type;
      item.tabIndex = -1;
      const head = document.createElement('div');
      head.className = 'blocks-block-head';
      const type = document.createElement('span');
      type.className = 'blocks-block-type';
      type.textContent = text(block.type, block.type);
      const actions = document.createElement('div');
      actions.className = 'blocks-block-actions';
      const up = button('↑', 'blocks-icon-btn');
      up.title = text('moveUp', 'Move up');
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        if (index <= 0) return;
        const [moved] = state.blocks.splice(index, 1);
        state.blocks.splice(index - 1, 0, moved);
        moved.dirty = true;
        render();
        setActive(index - 1);
        emit();
      });
      const down = button('↓', 'blocks-icon-btn');
      down.title = text('moveDown', 'Move down');
      down.disabled = index === state.blocks.length - 1;
      down.addEventListener('click', () => {
        if (index >= state.blocks.length - 1) return;
        const [moved] = state.blocks.splice(index, 1);
        state.blocks.splice(index + 1, 0, moved);
        moved.dirty = true;
        render();
        setActive(index + 1);
        emit();
      });
      const remove = button('×', 'blocks-icon-btn blocks-delete-btn');
      remove.title = text('delete', 'Delete');
      remove.addEventListener('click', () => {
        state.blocks.splice(index, 1);
        render();
        setActive(Math.min(index, state.blocks.length - 1));
        emit();
      });
      actions.append(up, down, remove);
      head.appendChild(type);
      if (block.type === 'list') {
        head.appendChild(createListTypeSelect(block));
      }
      head.appendChild(actions);
      item.append(head, renderBlockBody(block, index));
      item.addEventListener('focusin', () => setActive(index));
      list.appendChild(item);
    });
    setActive(state.activeIndex);
  }

  const api = {
    setMarkdown(markdown) {
      state.blocks = parseMarkdownBlocks(markdown);
      state.activeIndex = -1;
      state.activeEditable = null;
      state.activeSync = null;
      render();
    },
    getMarkdown() {
      return serializeMarkdownBlocks(state.blocks);
    },
    insertImageBlock(src, alt, index = state.activeIndex + 1) {
      const block = insertBlock('image', { src, alt: alt || '', title: '' }, index);
      return { index: state.blocks.indexOf(block) };
    },
    setCardEntries(entries) {
      state.cardEntries = Array.isArray(entries) ? entries.slice() : [];
      if (state.cardPickerOpen) renderCardPicker();
    },
    focus() {
      const active = list.querySelector('.blocks-block.is-active [contenteditable="true"], .blocks-block.is-active input, .blocks-block.is-active textarea');
      try { if (active) active.focus(); } catch (_) {}
    },
    requestLayout() {
      render();
    }
  };

  api.setMarkdown('');
  return api;
}
