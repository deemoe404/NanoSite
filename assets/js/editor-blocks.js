const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'code', 'card', 'source']);

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isFrontMatterFence(line) {
  return /^---\s*$/.test(String(line || ''));
}

function frontMatterLinesHaveKey(lines) {
  return (Array.isArray(lines) ? lines : []).some(line => /^[A-Za-z_][A-Za-z0-9_.-]*\s*:/.test(String(line || '')));
}

function findFrontMatterEndIndex(lines, start) {
  if (!Array.isArray(lines) || !isFrontMatterFence(lines[start])) return -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!isFrontMatterFence(lines[index])) continue;
    return frontMatterLinesHaveKey(lines.slice(start + 1, index)) ? index : -1;
  }
  return -1;
}

function isFrontMatterBlock(raw) {
  const lines = normalizeText(raw).split('\n');
  if (lines.length < 3 || !isFrontMatterFence(lines[0])) return false;
  if (!isFrontMatterFence(lines[lines.length - 1])) return false;
  return frontMatterLinesHaveKey(lines.slice(1, -1));
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

function lineWithoutTerminator(line) {
  return String(line || '').replace(/\n$/, '');
}

function parseFenceStartLine(line) {
  const trimmed = lineWithoutTerminator(line).trimStart();
  const match = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  const marker = match[1] || '';
  return { marker, char: marker[0], length: marker.length, info: match[2] || '' };
}

function isFenceStartLine(line) {
  return !!parseFenceStartLine(line);
}

function isFenceEndLine(line, fence) {
  if (!fence || !fence.char || !fence.length) return false;
  const marker = fence.char === '`' ? '`' : '~';
  const text = lineWithoutTerminator(line).trimStart();
  const re = new RegExp(`^${marker}{${fence.length},}\\s*$`);
  return re.test(text);
}

function isHeadingLine(line) {
  return /^(#{1,6})\s+.+$/.test(lineWithoutTerminator(line));
}

function isListItemLine(line) {
  const text = lineWithoutTerminator(line);
  return /^([ \t]*)([-*])\s+\[([ xX])\]\s+.+$/.test(text)
    || /^([ \t]*)([-*+])\s+.+$/.test(text)
    || /^([ \t]*)(\d{1,9})([\.)])\s+.+$/.test(text);
}

function isQuoteLine(line) {
  return lineWithoutTerminator(line).startsWith('>');
}

function isStandaloneMediaLine(line) {
  const text = lineWithoutTerminator(line);
  const trimmed = text.trim();
  return trimmed === text && !!(parseImageBlock(trimmed) || parseCardBlock(trimmed));
}

function startsMarkdownBlock(line) {
  return isFenceStartLine(line)
    || isHeadingLine(line)
    || isListItemLine(line)
    || isQuoteLine(line)
    || isStandaloneMediaLine(line);
}

function extractChunks(markdown) {
  const lines = splitMarkdownLines(markdown);
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
    const frontMatterEnd = !chunks.length && !leading && start === 0 ? findFrontMatterEndIndex(lines, start) : -1;

    if (frontMatterEnd >= 0) {
      index = frontMatterEnd + 1;
    } else if (isFenceStartLine(first)) {
      const fence = parseFenceStartLine(first);
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index] || '';
        index += 1;
        if (isFenceEndLine(candidate, fence)) break;
      }
    } else if (isHeadingLine(first) || isStandaloneMediaLine(first)) {
      index += 1;
    } else if (isListItemLine(first)) {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && isListItemLine(lines[index])) index += 1;
    } else if (isQuoteLine(first)) {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && isQuoteLine(lines[index])) index += 1;
    } else {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && !startsMarkdownBlock(lines[index])) index += 1;
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
    location: decodeCardLocation(match[2] || ''),
    title,
    forceCard: /\b(card|preview)\b/i.test(title)
  };
}

function decodeCardLocation(value) {
  const raw = String(value || '');
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw;
  }
}

function parseCodeBlock(raw) {
  const lines = raw.split('\n');
  if (lines.length < 2) return null;
  const open = parseFenceStartLine(lines[0]);
  if (!open) return null;
  if (!isFenceEndLine(lines[lines.length - 1], open)) return null;
  return {
    lang: (open.info || '').trim(),
    text: lines.slice(1, -1).join('\n')
  };
}

function indentationColumn(value) {
  return String(value || '').replace(/\t/g, '    ').length;
}

function parseListLineInfo(line) {
  const text = String(line || '');
  let match = text.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
  if (match) return { kind: 'task', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)([-*+])\s+(.+)$/);
  if (match) return { kind: 'ul', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
  if (match) return { kind: 'ol', indentColumn: indentationColumn(match[1]) };
  return null;
}

function parseListBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length) return null;
  let type = '';
  const items = [];
  for (const line of lines) {
    let match = line.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      if (type && type !== 'task') return null;
      type = 'task';
      items.push({
        checked: match[3].toLowerCase() === 'x',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)([-*+])\s+(.+)$/);
    if (match) {
      if (type && type !== 'ul') return null;
      type = 'ul';
      items.push({
        text: match[3] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
    if (match) {
      if (type && type !== 'ol') return null;
      type = 'ol';
      items.push({
        number: Number(match[2]),
        delimiter: match[3] || '.',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1])
      });
      continue;
    }
    return null;
  }
  const indentColumns = [...new Set(items.map(item => item.indentColumn || 0))].sort((a, b) => a - b);
  if (indentColumns[0] !== 0) return null;
  items.forEach(item => {
    item.indent = Math.max(0, indentColumns.indexOf(item.indentColumn || 0));
    delete item.indentColumn;
  });
  return type && items.length ? { listType: type, items } : null;
}

function parseQuoteBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length || !lines.every(line => line.startsWith('>'))) return null;
  const first = lines[0].slice(1).trim();
  if (/^\[!\w+\]/.test(first)) return null;
  return { text: lines.map(line => line.replace(/^>\s?/, '')).join('\n') };
}

function maskInlineCodeSpans(raw) {
  const text = String(raw || '');
  let output = '';
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '`') {
      output += text[index];
      index += 1;
      continue;
    }

    const start = index;
    while (index < text.length && text[index] === '`') index += 1;
    const marker = text.slice(start, index);
    const close = text.indexOf(marker, index);
    if (close < 0) {
      output += marker;
      continue;
    }

    const end = close + marker.length;
    output += ' '.repeat(end - start);
    index = end;
  }
  return output;
}

function riskyParagraphReason(raw) {
  if (!raw.trim()) return '';
  const visible = maskInlineCodeSpans(raw);
  const listLines = normalizeText(visible).split('\n').filter(line => !isBlankLine(line));
  const listInfos = listLines.map(parseListLineInfo);
  if (listInfos.length && listInfos.every(Boolean)) {
    const indentColumns = [...new Set(listInfos.map(item => item.indentColumn || 0))].sort((a, b) => a - b);
    const kinds = new Set(listInfos.map(item => item.kind));
    if (kinds.size > 1) return 'mixedList';
    if (indentColumns[0] !== 0) return 'indentedList';
  }
  if (/^\|/.test(visible.trimStart())) return 'table';
  if (/\n\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*(?:\n|$)/.test(visible)) return 'table';
  if (/^\s+[-*+]\s+/m.test(visible) || /^\s+\d{1,9}[\.)]\s+/m.test(visible)) return 'indentedList';
  if (/!\[[^\]]*\]\([^)]+\)/.test(visible)) return 'image';
  if (/<[A-Za-z][^>]*>/.test(visible)) return 'rawHtml';
  return '';
}

function makeSourceBlock(raw, data = {}, sourceReason = 'unsupported') {
  return makeBlock('source', raw, { ...data, sourceReason });
}

function classifyChunk(raw, data = {}) {
  const text = String(raw || '');
  const trimmed = text.trim();
  if (!trimmed) return makeSourceBlock(text, data, 'blank');
  if (isFrontMatterBlock(text)) return makeSourceBlock(text, data, 'frontMatter');

  const code = parseCodeBlock(text);
  if (code) return makeBlock('code', text, { ...data, ...code });
  if (parseFenceStartLine(trimmed.split('\n')[0])) return makeSourceBlock(text, data, 'unclosedFence');

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
  if (text.trimStart().startsWith('>')) return makeSourceBlock(text, data, 'callout');

  const list = parseListBlock(text);
  if (list) return makeBlock('list', text, { ...data, ...list });

  const reason = riskyParagraphReason(text);
  if (reason) return makeSourceBlock(text, data, reason);
  return makeBlock('paragraph', text, { ...data, text });
}

export function parseMarkdownBlocks(markdown) {
  return extractChunks(markdown).map(chunk => classifyChunk(chunk.raw, {
    before: chunk.before || '',
    after: chunk.after || ''
  }));
}

function removeIndentColumns(line, columns) {
  const target = Math.max(0, Number(columns) || 0);
  if (!target) return String(line || '');
  const text = String(line || '');
  let index = 0;
  let removed = 0;
  while (index < text.length && removed < target) {
    const char = text[index];
    if (char === ' ') {
      index += 1;
      removed += 1;
      continue;
    }
    if (char === '\t') {
      if (removed + 4 > target) break;
      index += 1;
      removed += 4;
      continue;
    }
    break;
  }
  return text.slice(index);
}

function dedentIndentedListSource(raw) {
  const lines = normalizeText(raw).split('\n');
  const indents = [];
  lines.forEach(line => {
    const match = String(line || '').match(/^([ \t]+)(?:[-*]\s+\[[ xX]\]\s+|[-*+]\s+|\d{1,9}[\.)]\s+)/);
    if (match) indents.push(indentationColumn(match[1] || ''));
  });
  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (minIndent <= 0) return '';
  return lines.map(line => removeIndentColumns(line, minIndent)).join('\n');
}

function sourceBlockText(block) {
  if (!block || typeof block !== 'object') return '';
  const data = block.data || {};
  return String(data.text != null ? data.text : block.raw || '');
}

export function autofixMarkdownSourceBlock(block) {
  if (!block || block.type !== 'source') return [];
  const data = block.data || {};
  const reason = String(data.sourceReason || '');
  let fixed = '';
  if (reason === 'indentedList') fixed = dedentIndentedListSource(sourceBlockText(block));
  if (!fixed) return [];

  const nextBlocks = parseMarkdownBlocks(fixed);
  if (!nextBlocks.length || nextBlocks.some(next => next.type === 'source')) return [];
  nextBlocks.forEach((next, index) => {
    next.dirty = true;
    next.data = next.data || {};
    if (index === 0) next.data.before = data.before || '';
    if (index === nextBlocks.length - 1) next.data.after = data.after != null ? data.after : '\n\n';
  });
  return nextBlocks;
}

function escapeMarkdownInline(value) {
  const text = String(value == null ? '' : value).replace(/\u00a0/g, ' ');
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, (match, offset) => shouldEscapePlainUnderscore(text, offset) ? '\\_' : match)
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function codeSpanFenceForText(value) {
  const runs = String(value == null ? '' : value).match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(1, longest + 1));
}

function serializeMarkdownCodeSpan(value) {
  const text = String(value == null ? '' : value).replace(/\u00a0/g, ' ');
  const fence = codeSpanFenceForText(text);
  const body = text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text;
  return `${fence}${body}${fence}`;
}

function normalizeMarkdownCodeSpanText(value) {
  const text = String(value == null ? '' : value).replace(/\n/g, ' ');
  if (text.length >= 2 && text.startsWith(' ') && text.endsWith(' ') && /\S/.test(text)) {
    return text.slice(1, -1);
  }
  return text;
}

function sanitizeEditorLinkHref(value) {
  const href = String(value == null ? '' : value).trim();
  const protocol = href.toLowerCase().match(/^([a-z][a-z0-9+.-]*):/);
  if (!protocol) return href;
  return ['http', 'https', 'mailto', 'tel'].includes(protocol[1]) ? href : '#';
}

function sanitizeEditorLinkTitle(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeMarkdownLinkTitle(value) {
  return sanitizeEditorLinkTitle(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isInlineWordChar(value) {
  return /^[\p{L}\p{N}]$/u.test(String(value || ''));
}

function isIntrawordUnderscore(text, index) {
  return isInlineWordChar(text[index - 1]) && isInlineWordChar(text[index + 1]);
}

function shouldEscapePlainUnderscore(text, index) {
  return !isIntrawordUnderscore(String(text || ''), index);
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

function codeFenceForText(text) {
  const runs = String(text || '').match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
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
        const rawText = String(item && item.text != null ? item.text : '');
        const text = rawText === '' ? 'List item' : rawText;
        const indent = item && typeof item.indentText === 'string'
          ? item.indentText
          : '  '.repeat(Math.max(0, Number(item && item.indent) || 0));
        if (listType === 'ol') {
          const number = Number(item && item.number) > 0 ? Number(item.number) : index + 1;
          const delimiter = item && /^[.)]$/.test(item.delimiter || '') ? item.delimiter : '.';
          return `${indent}${number}${delimiter} ${text}`;
        }
        const marker = item && /^[-*+]$/.test(item.marker || '') ? item.marker : '-';
        if (listType === 'task') return `${indent}${marker === '+' ? '-' : marker} [${item && item.checked ? 'x' : ' '}] ${text}`;
        return `${indent}${marker} ${text}`;
      }).join('\n');
    }
    case 'quote':
      return String(data.text || '').split('\n').map(line => `> ${line}`).join('\n');
    case 'code': {
      const lang = String(data.lang || '').trim();
      const text = String(data.text || '');
      const fence = codeFenceForText(text);
      return `${fence}${lang}\n${text}\n${fence}`;
    }
    case 'card':
      return serializeCard(data);
    case 'source':
      return String(data.text != null ? data.text : block.raw || '');
    case 'paragraph':
    default:
      return String(data.text || '');
  }
}

export function serializeMarkdownBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(block => {
    const before = block && block.data && block.data.before ? String(block.data.before) : '';
    const after = block && block.data && block.data.after != null ? String(block.data.after) : '\n\n';
    return `${before}${serializeBlock(block)}${after}`;
  }).join('');
}

function defaultListItems() {
  return [{ text: 'List item', checked: false }];
}

function editableListItems(items) {
  return Array.isArray(items) && items.length ? items : defaultListItems();
}

export function patchListItem(items, itemIndex, patch = {}) {
  const next = editableListItems(items).slice();
  const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, next.length - 1));
  next[safeIndex] = { ...(next[safeIndex] || {}), ...(patch || {}) };
  return next;
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

function inlineRun(text, marks = {}) {
  const link = marks.link ? sanitizeEditorLinkHref(marks.link) : '';
  const run = {
    text: String(text == null ? '' : text),
    bold: !!marks.bold,
    italic: !!marks.italic,
    strike: !!marks.strike,
    code: !!marks.code,
    link,
    linkTitle: link ? sanitizeEditorLinkTitle(marks.linkTitle) : ''
  };
  if (run.code) {
    run.bold = false;
    run.italic = false;
    run.strike = false;
    run.link = '';
    run.linkTitle = '';
  }
  return run;
}

function sameInlineMarks(a = {}, b = {}) {
  return !!a.bold === !!b.bold
    && !!a.italic === !!b.italic
    && !!a.strike === !!b.strike
    && !!a.code === !!b.code
    && String(a.link || '') === String(b.link || '')
    && String(a.linkTitle || '') === String(b.linkTitle || '');
}

function appendInlineRun(runs, text, marks = {}) {
  const run = inlineRun(text, marks);
  if (!run.text) return runs;
  const previous = runs[runs.length - 1];
  if (previous && sameInlineMarks(previous, run)) {
    previous.text += run.text;
  } else {
    runs.push(run);
  }
  return runs;
}

function mergeInlineRuns(runs) {
  return (Array.isArray(runs) ? runs : []).reduce((out, run) => {
    appendInlineRun(out, run && run.text, run || {});
    return out;
  }, []);
}

function findUnescaped(input, needle, start = 0) {
  const text = String(input || '');
  let index = Math.max(0, Number(start) || 0);
  while (index < text.length) {
    const found = text.indexOf(needle, index);
    if (found < 0) return -1;
    let slashCount = 0;
    for (let cursor = found - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashCount += 1;
    if (slashCount % 2 === 0) return found;
    index = found + needle.length;
  }
  return -1;
}

function isMarkdownEscapablePunctuation(value) {
  return /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(String(value || ''));
}

function findInlineLink(input, start) {
  const text = String(input || '');
  if (text[start] !== '[') return null;
  const labelEnd = findMarkdownLinkLabelEnd(text, start + 1);
  if (labelEnd < 0 || text[labelEnd + 1] !== '(') return null;
  const hrefStart = labelEnd + 2;
  const hrefEnd = findMarkdownLinkDestinationEnd(text, hrefStart);
  if (hrefEnd <= hrefStart) return null;
  const parsed = parseMarkdownLinkDestination(text.slice(hrefStart, hrefEnd));
  if (!parsed) return null;
  return {
    label: text.slice(start + 1, labelEnd),
    href: parsed.href,
    title: parsed.title,
    end: hrefEnd + 1
  };
}

function findMarkdownLinkLabelEnd(input, start) {
  const text = String(input || '');
  let depth = 0;
  for (let index = Math.max(0, Number(start) || 0); index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '\\') {
      index += 1;
      continue;
    }
    if (ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === ']') {
      if (depth <= 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function findMarkdownLinkDestinationEnd(input, start) {
  const text = String(input || '');
  let depth = 0;
  let quote = '';
  let angle = false;
  for (let index = Math.max(0, Number(start) || 0); index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '\\') {
      index += 1;
      continue;
    }
    if (angle) {
      if (ch === '>') angle = false;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '<') {
      angle = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      if (depth <= 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function parseMarkdownLinkDestination(value) {
  const body = String(value || '').trim();
  if (!body) return null;
  if (body.startsWith('<')) {
    const close = findUnescaped(body, '>', 1);
    if (close <= 1) return null;
    const title = parseMarkdownLinkTitle(body.slice(close + 1).trim());
    if (title == null) return null;
    return { href: body.slice(1, close), title };
  }
  if (!/\s/.test(body)) return { href: body, title: '' };
  const match = body.match(/^(\S+)\s+(.+)$/);
  if (!match) return null;
  const title = parseMarkdownLinkTitle(match[2]);
  return title == null ? null : { href: match[1] || '', title };
}

function parseMarkdownLinkTitle(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
  if (!match) return null;
  return match[1] != null ? match[1] : match[2] != null ? match[2] : match[3] || '';
}

function canOpenInlineMarker(text, index, marker) {
  if (marker !== '_') return true;
  return !isInlineWordChar(String(text || '')[index - 1]);
}

function canCloseInlineMarker(text, index, marker) {
  if (marker !== '_') return true;
  return !isInlineWordChar(String(text || '')[index + marker.length]);
}

function findInlineMarkerEnd(text, marker, start) {
  let search = start;
  while (search < text.length) {
    const end = findUnescaped(text, marker, search);
    if (end < 0) return -1;
    if (end > start && canCloseInlineMarker(text, end, marker)) return end;
    search = end + marker.length;
  }
  return -1;
}

function backtickRunLength(text, start) {
  let end = start;
  while (end < text.length && text[end] === '`') end += 1;
  return end - start;
}

function findCodeSpanEnd(text, start, length) {
  let search = start;
  while (search < text.length) {
    if (text[search] !== '`') {
      search += 1;
      continue;
    }
    const candidateLength = backtickRunLength(text, search);
    if (candidateLength === length) return search;
    search += candidateLength;
  }
  return -1;
}

function parseInlineRunsInternal(input, marks = {}) {
  const text = String(input || '');
  const runs = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      if (isMarkdownEscapablePunctuation(text[index + 1])) {
        appendInlineRun(runs, text[index + 1], marks);
        index += 2;
      } else {
        appendInlineRun(runs, text[index], marks);
        index += 1;
      }
      continue;
    }

    const link = findInlineLink(text, index);
    if (link) {
      parseInlineRunsInternal(link.label, { ...marks, link: link.href, linkTitle: link.title }).forEach(run => appendInlineRun(runs, run.text, run));
      index = link.end;
      continue;
    }

    if (text[index] === '`') {
      const fenceLength = backtickRunLength(text, index);
      const end = findCodeSpanEnd(text, index + fenceLength, fenceLength);
      if (end >= index + fenceLength) {
        appendInlineRun(runs, normalizeMarkdownCodeSpanText(text.slice(index + fenceLength, end)), { code: true });
        index = end + fenceLength;
        continue;
      }
    }

    const patterns = [
      ['**', { bold: true }],
      ['~~', { strike: true }],
      ['_', { italic: true }],
      ['*', { italic: true }]
    ];
    let matched = false;
    for (const [marker, patch] of patterns) {
      if (!text.startsWith(marker, index)) continue;
      if (!canOpenInlineMarker(text, index, marker)) continue;
      const end = findInlineMarkerEnd(text, marker, index + marker.length);
      if (end <= index + marker.length) continue;
      const body = text.slice(index + marker.length, end);
      parseInlineRunsInternal(body, { ...marks, ...patch }).forEach(run => appendInlineRun(runs, run.text, run));
      index = end + marker.length;
      matched = true;
      break;
    }
    if (matched) continue;

    appendInlineRun(runs, text[index], marks);
    index += 1;
  }

  return mergeInlineRuns(runs);
}

export function parseInlineRuns(markdown) {
  return parseInlineRunsInternal(String(markdown || ''), {});
}

function escapeMarkdownLinkHref(value) {
  const href = sanitizeEditorLinkHref(value).replace(/\s+/g, '%20');
  const out = [];
  const openIndexes = [];
  for (const ch of href) {
    if (ch === '(') {
      openIndexes.push(out.length);
      out.push(ch);
    } else if (ch === ')') {
      if (openIndexes.length) {
        openIndexes.pop();
        out.push(ch);
      } else {
        out.push('%29');
      }
    } else {
      out.push(ch);
    }
  }
  openIndexes.forEach(index => { out[index] = '%28'; });
  return out.join('');
}

function linkTitleForRun(run) {
  const explicit = sanitizeEditorLinkTitle(run && run.linkTitle);
  if (explicit) return explicit;
  const fallback = sanitizeEditorLinkTitle(run && run.text);
  return fallback || sanitizeEditorLinkTitle(run && run.link);
}

function serializeInlineRun(run) {
  const text = String(run && run.text != null ? run.text : '');
  if (!text) return '';
  if (run && run.code) return serializeMarkdownCodeSpan(text);
  let out = escapeMarkdownInline(text);
  if (run && run.italic) out = `_${out}_`;
  if (run && run.bold) out = `**${out}**`;
  if (run && run.strike) out = `~~${out}~~`;
  if (run && run.link) out = `[${out}](${escapeMarkdownLinkHref(run.link)} "${escapeMarkdownLinkTitle(linkTitleForRun(run))}")`;
  return out;
}

export function serializeInlineRuns(runs) {
  return mergeInlineRuns(runs).map(serializeInlineRun).join('');
}

function appendInlineNode(parent, run) {
  const textNode = document.createTextNode(String(run && run.text != null ? run.text : ''));
  let node = textNode;
  const wrap = (tagName, attrs = {}) => {
    const el = document.createElement(tagName);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    el.appendChild(node);
    node = el;
  };
  if (run && run.code) {
    wrap('code');
  } else {
    if (run && run.italic) wrap('em');
    if (run && run.bold) wrap('strong');
    if (run && run.strike) wrap('s');
    if (run && run.link) wrap('a', { href: sanitizeEditorLinkHref(run.link), title: linkTitleForRun(run) });
  }
  parent.appendChild(node);
}

function renderInlineRunsInto(root, runs) {
  if (!root) return;
  root.innerHTML = '';
  mergeInlineRuns(runs).forEach(run => {
    const lines = String(run.text || '').split('\n');
    lines.forEach((line, index) => {
      if (index > 0) root.appendChild(document.createElement('br'));
      if (line) appendInlineNode(root, { ...run, text: line });
    });
  });
}

function inlineRunsFromDom(root) {
  const runs = [];
  const walk = (node, marks = {}) => {
    if (!node) return;
    if (node.nodeType === 3) {
      appendInlineRun(runs, node.nodeValue || '', marks);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'br') {
      appendInlineRun(runs, '\n', marks);
      return;
    }
    let nextMarks = { ...marks };
    if (tag === 'strong' || tag === 'b') nextMarks.bold = true;
    if (tag === 'em' || tag === 'i') nextMarks.italic = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') nextMarks.strike = true;
    if (tag === 'code') nextMarks = { code: true };
    if (tag === 'a' && !nextMarks.code) {
      nextMarks.link = node.getAttribute('href') || '';
      nextMarks.linkTitle = node.getAttribute('title') || '';
    }
    Array.from(node.childNodes || []).forEach(child => walk(child, nextMarks));
    if (tag === 'div') appendInlineRun(runs, '\n', marks);
  };
  Array.from(root && root.childNodes ? root.childNodes : []).forEach(child => walk(child, {}));
  return mergeInlineRuns(runs);
}

function serializeInlineDom(root) {
  return serializeInlineRuns(inlineRunsFromDom(root));
}

function setPlainContentEditableValue(el, value) {
  if (!el) return;
  renderInlineRunsInto(el, parseInlineRuns(value));
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

function normalizeEditableMarkdownText(value) {
  return String(value == null ? '' : value).replace(/\n{3,}/g, '\n\n');
}

function editableText(el) {
  if (!el) return '';
  return normalizeEditableMarkdownText(serializeInlineDom(el));
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
      before: normalizeEditableMarkdownText(serializeInlineDom(beforeRange.cloneContents())),
      after: normalizeEditableMarkdownText(serializeInlineDom(afterRange.cloneContents()))
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

function placeCaretAtStart(el) {
  try {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
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

const CARET_POINT_MEASURE_LIMIT = 12000;

function caretBoundaryDistance(rect, boundaryX, x, y) {
  if (!rect) return Number.POSITIVE_INFINITY;
  const dx = Number(x) - boundaryX;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return (dx * dx) + (dy * dy * 4);
}

function measuredTextOffsetDetailsFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
  try {
    if (!el) return null;
    const doc = el.ownerDocument || document;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = doc.createRange();
    let node = walker.nextNode();
    let offset = 0;
    let bestOffset = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let insideTextRect = false;
    let textRectCount = 0;
    while (node) {
      const value = String(node.nodeValue || '');
      if (offset + value.length > limit) {
        range.detach && range.detach();
        return null;
      }
      for (let i = 0; i < value.length; i += 1) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rects = Array.from(range.getClientRects ? range.getClientRects() : [])
          .filter(rect => rect && rect.width >= 0 && rect.height > 0);
        rects.forEach(rect => {
          textRectCount += 1;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) insideTextRect = true;
          const startDistance = caretBoundaryDistance(rect, rect.left, x, y);
          if (startDistance < bestDistance) {
            bestDistance = startDistance;
            bestOffset = offset + i;
          }
          const endDistance = caretBoundaryDistance(rect, rect.right, x, y);
          if (endDistance < bestDistance) {
            bestDistance = endDistance;
            bestOffset = offset + i + 1;
          }
        });
      }
      offset += value.length;
      node = walker.nextNode();
    }
    range.detach && range.detach();
    if (offset === 0) return { offset: 0, distance: 0, insideTextRect: false, textRectCount: 0 };
    if (bestOffset == null) return null;
    return { offset: bestOffset, distance: bestDistance, insideTextRect, textRectCount };
  } catch (_) {
    return null;
  }
}

function measuredTextOffsetFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
  const details = measuredTextOffsetDetailsFromPoint(el, x, y, limit);
  return details ? details.offset : null;
}

function textareaTextOffsetDetailsFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
  const value = String(area && area.value != null ? area.value : '');
  if (!area || !document.body) return null;
  if (!value) return { offset: 0, distance: 0, insideTextRect: false, textRectCount: 0 };
  if (value.length > limit) return null;
  const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : null;
  if (!rect) return null;
  const computed = window.getComputedStyle ? window.getComputedStyle(area) : null;
  const mirror = document.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.position = 'fixed';
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.minHeight = `${rect.height}px`;
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.zIndex = '-1';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordBreak = computed ? computed.wordBreak : 'normal';
  mirror.style.boxSizing = computed ? computed.boxSizing : 'border-box';
  [
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'lineHeight',
    'letterSpacing',
    'tabSize',
    'textTransform',
    'textIndent',
    'textAlign',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth'
  ].forEach(prop => {
    if (computed && computed[prop]) mirror.style[prop] = computed[prop];
  });
  mirror.textContent = value;
  document.body.appendChild(mirror);
  const details = measuredTextOffsetDetailsFromPoint(mirror, x, y, limit);
  mirror.remove();
  if (!details) return null;
  return {
    ...details,
    offset: Math.max(0, Math.min(value.length, details.offset))
  };
}

function textareaTextOffsetFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
  const details = textareaTextOffsetDetailsFromPoint(area, x, y, limit);
  return details ? details.offset : null;
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

function closestElement(node, selector) {
  try {
    const start = node && node.nodeType === 1 ? node : node && node.parentElement;
    return start && start.closest ? start.closest(selector) : null;
  } catch (_) {
    return null;
  }
}

function selectionEditableInRoot(root) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!root || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
    for (const candidate of candidates) {
      const editable = closestElement(candidate, '.blocks-rich-editable');
      if (editable && nodeContains(root, editable)) return editable;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function inlineMarksFromDomNode(node, editable) {
  const marks = { bold: false, italic: false, strike: false, code: false, link: '' };
  try {
    let current = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (current && nodeContains(editable, current)) {
      const tag = String(current.tagName || '').toLowerCase();
      if (tag === 'code') {
        marks.code = true;
        marks.bold = false;
        marks.italic = false;
        marks.strike = false;
        marks.link = '';
      } else if (!marks.code) {
        if (tag === 'strong' || tag === 'b') marks.bold = true;
        if (tag === 'em' || tag === 'i') marks.italic = true;
        if (tag === 's' || tag === 'del' || tag === 'strike') marks.strike = true;
        if (tag === 'a') {
          marks.link = current.getAttribute('href') || '';
          marks.linkTitle = current.getAttribute('title') || '';
        }
      }
      if (current === editable) break;
      current = current.parentElement;
    }
  } catch (_) {}
  return marks;
}

function inlineMarksFromPointerEvent(event, editable) {
  let node = event && event.target;
  try {
    if (event && document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (position && position.offsetNode) node = position.offsetNode;
    } else if (event && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (range && range.startContainer) node = range.startContainer;
    }
  } catch (_) {}
  return inlineMarksFromDomNode(node, editable);
}

function textRangeForDomNode(editable, node) {
  try {
    if (!editable || !node || !nodeContains(editable, node)) return null;
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(editable);
    beforeRange.setEndBefore(node);
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);
    const start = String(beforeRange.toString() || '').length;
    const length = String(nodeRange.toString() || '').length;
    if (length <= 0) return null;
    return { start, end: start + length };
  } catch (_) {
    return null;
  }
}

function linkForTextRange(editable, start, end) {
  try {
    const safeStart = Math.max(0, Number(start) || 0);
    const safeEnd = Math.max(safeStart, Number(end) || 0);
    return Array.from(editable ? editable.querySelectorAll('a') : []).find(link => {
      const range = textRangeForDomNode(editable, link);
      return range && range.start === safeStart && range.end === safeEnd;
    }) || null;
  } catch (_) {
    return null;
  }
}

function inlineMarkedDomRangeFromNode(editable, node, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  if (command !== 'code') return null;
  const code = closestElement(node, 'code');
  return code && nodeContains(editable, code) ? textRangeForDomNode(editable, code) : null;
}

function inlineMarkedDomRangeFromSelection(editable, mark) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!editable || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!nodeContains(editable, range.startContainer)) return null;
    return inlineMarkedDomRangeFromNode(editable, range.startContainer, mark);
  } catch (_) {
    return null;
  }
}

function inlineMarkedDomRangeFromPointerEvent(event, editable, mark) {
  let node = event && event.target;
  try {
    if (event && document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (position && position.offsetNode) node = position.offsetNode;
    } else if (event && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (range && range.startContainer) node = range.startContainer;
    }
  } catch (_) {}
  return inlineMarkedDomRangeFromNode(editable, node, mark);
}

function selectionLinkInEditable(editable) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!editable || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!nodeContains(editable, range.commonAncestorContainer)) return null;
    const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
    for (const candidate of candidates) {
      const link = closestElement(candidate, 'a[href]');
      if (link && nodeContains(editable, link)) return link;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function inlineRunsTextLength(runs) {
  return mergeInlineRuns(runs).reduce((total, run) => total + String(run.text || '').length, 0);
}

function inlineMarksAtOffset(runs, offset) {
  const safeRuns = mergeInlineRuns(runs);
  const target = Math.max(0, Number(offset) || 0);
  let cursor = 0;
  let previous = null;
  for (const run of safeRuns) {
    const length = String(run.text || '').length;
    if (!length) continue;
    const next = cursor + length;
    if (target === cursor || (target > cursor && target < next)) return { ...run, text: '' };
    if (target === next) previous = run;
    cursor += length;
  }
  return { ...(previous || safeRuns[safeRuns.length - 1] || {}), text: '' };
}

function inlineMarkedRangeAtOffset(runs, offset, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  const target = Math.max(0, Number(offset) || 0);
  let cursor = 0;
  const ranges = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const length = text.length;
    if (!length) return;
    const next = cursor + length;
    ranges.push({
      start: cursor,
      end: next,
      marked: command === 'link' ? !!run.link : !!run[command]
    });
    cursor = next;
  });

  let index = -1;
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (range.marked && (target === range.start || target === range.end || (target > range.start && target < range.end))) {
      index = i;
      break;
    }
    if (target < range.end) break;
  }
  if (index < 0) return null;
  let startIndex = index;
  let endIndex = index;
  while (startIndex > 0 && ranges[startIndex - 1].marked) startIndex -= 1;
  while (endIndex + 1 < ranges.length && ranges[endIndex + 1].marked) endIndex += 1;
  return { start: ranges[startIndex].start, end: ranges[endIndex].end };
}

function inlineRangeText(runs, start, end) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  let out = '';
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd) {
      out += text.slice(Math.max(0, safeStart - cursor), Math.max(0, safeEnd - cursor));
    }
    cursor = next;
  });
  return out;
}

function rangeHasInlineText(runs, start, end) {
  return inlineRangeText(runs, start, end).length > 0;
}

function mutateInlineRunsInRange(runs, start, end, mutator) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  const out = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (!text || next <= safeStart || cursor >= safeEnd) {
      appendInlineRun(out, text, run);
      cursor = next;
      return;
    }
    const beforeEnd = Math.max(0, safeStart - cursor);
    const selectedStart = Math.max(0, safeStart - cursor);
    const selectedEnd = Math.min(text.length, safeEnd - cursor);
    if (beforeEnd > 0) appendInlineRun(out, text.slice(0, beforeEnd), run);
    if (selectedEnd > selectedStart) {
      const selected = mutator({ ...run, text: text.slice(selectedStart, selectedEnd) });
      appendInlineRun(out, selected.text, selected);
    }
    if (selectedEnd < text.length) appendInlineRun(out, text.slice(selectedEnd), run);
    cursor = next;
  });
  return mergeInlineRuns(out);
}

function inlineRangeFullyMarked(runs, start, end, mark) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (safeEnd <= safeStart) return false;
  let cursor = 0;
  let sawText = false;
  for (const run of mergeInlineRuns(runs)) {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd) {
      sawText = true;
      if (mark === 'link') {
        if (!run.link) return false;
      } else if (!run[mark]) {
        return false;
      }
    }
    cursor = next;
  }
  return sawText;
}

function inlineRangeAnyMarked(runs, start, end, mark) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (safeEnd <= safeStart) return false;
  let cursor = 0;
  for (const run of mergeInlineRuns(runs)) {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd && !!run[mark]) return true;
    cursor = next;
  }
  return false;
}

function removeInlineMarkInRange(runs, start, end, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  return mutateInlineRunsInRange(runs, start, end, run => {
    if (command === 'code') return inlineRun(run.text, {});
    if (run.code) return run;
    return inlineRun(run.text, { ...run, [command]: command === 'link' ? '' : false, ...(command === 'link' ? { linkTitle: '' } : {}) });
  });
}

export function toggleInlineMarkOnRuns(runs, start, end, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  if (!['bold', 'italic', 'strike', 'code'].includes(command) || !rangeHasInlineText(runs, start, end)) {
    return mergeInlineRuns(runs);
  }
  const shouldApply = command === 'code'
    ? !inlineRangeFullyMarked(runs, start, end, command)
    : !inlineRangeAnyMarked(runs, start, end, command);
  return mutateInlineRunsInRange(runs, start, end, run => {
    if (command === 'code') return shouldApply ? inlineRun(run.text, { code: true }) : inlineRun(run.text, {});
    if (run.code) return run;
    return inlineRun(run.text, { ...run, [command]: shouldApply });
  });
}

export function removeInlineMarkAroundOffset(runs, offset, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  if (!['bold', 'italic', 'strike', 'code', 'link'].includes(command)) return mergeInlineRuns(runs);
  const range = inlineMarkedRangeAtOffset(runs, offset, command);
  if (!range) return mergeInlineRuns(runs);
  return removeInlineMarkInRange(runs, range.start, range.end, command);
}

export function insertInlineRunsAtRange(runs, start, end, insertRuns = []) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  let inserted = false;
  const out = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next <= safeStart || cursor >= safeEnd) {
      if (!inserted && cursor >= safeEnd) {
        mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
        inserted = true;
      }
      appendInlineRun(out, text, run);
      cursor = next;
      return;
    }
    if (cursor < safeStart) appendInlineRun(out, text.slice(0, safeStart - cursor), run);
    if (!inserted) {
      mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
      inserted = true;
    }
    if (next > safeEnd) appendInlineRun(out, text.slice(safeEnd - cursor), run);
    cursor = next;
  });
  if (!inserted) mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
  return mergeInlineRuns(out);
}

export function applyInlineLinkToRuns(runs, start, end, href, replacementText = null, title = '') {
  const safeHref = sanitizeEditorLinkHref(href);
  const safeTitle = sanitizeEditorLinkTitle(title);
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (replacementText != null) {
    const marks = inlineMarksAtOffset(runs, safeEnd > safeStart ? safeStart + 1 : safeStart);
    const replacement = inlineRun(String(replacementText || ''), { ...marks, code: false, link: safeHref, linkTitle: safeTitle });
    return insertInlineRunsAtRange(runs, safeStart, safeEnd, replacement.text ? [replacement] : []);
  }
  return mutateInlineRunsInRange(runs, safeStart, safeEnd, run => {
    if (run.code) return run;
    return inlineRun(run.text, { ...run, link: safeHref, linkTitle: safeTitle });
  });
}

function getEditableSelectionOffsets(el) {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!el || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!nodeContains(el, range.startContainer) || !nodeContains(el, range.endContainer)) return null;
    const startRange = document.createRange();
    startRange.selectNodeContents(el);
    startRange.setEnd(range.startContainer, range.startOffset);
    const endRange = document.createRange();
    endRange.selectNodeContents(el);
    endRange.setEnd(range.endContainer, range.endOffset);
    const start = String(startRange.toString() || '').length;
    const end = String(endRange.toString() || '').length;
    return { start, end, collapsed: start === end, text: String(range.toString() || ''), range };
  } catch (_) {
    return null;
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
    activeLink: null,
    activeLinkHoldUntil: 0,
    linkEditMode: '',
    linkSelection: null,
    lastInlineMarks: null,
    lastInlineMarkedRange: null,
    pendingInline: {},
    pendingListFocus: null,
    suppressNextBlockContainerClickUntil: 0,
    cardEntries: [],
    cardPickerOpen: false,
    reorderAnimating: false,
    openActionMenu: null,
    openInlineMenu: null
  };

  root.classList.add('markdown-blocks-shell');
  root.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'blocks-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', text('toolbarAria', 'Block tools'));

  const list = document.createElement('div');
  list.className = 'blocks-list';
  list.setAttribute('aria-label', text('listAria', 'Markdown blocks'));

  const picker = document.createElement('div');
  picker.className = 'blocks-card-picker';
  picker.hidden = true;
  picker.setAttribute('aria-hidden', 'true');

  root.append(toolbar, picker, list);
  const editableSyncMap = new WeakMap();

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

  const blockElements = () => Array.from(list.children).filter(el => el && el.classList && el.classList.contains('blocks-block'));

  const clearNativeSelection = () => {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel) sel.removeAllRanges();
    } catch (_) {}
  };

  const prefersReducedReorderMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const captureBlockRects = (indexes = null) => {
    const allowed = Array.isArray(indexes) ? new Set(indexes) : null;
    const rects = new Map();
    blockElements().forEach((el, index) => {
      if (allowed && !allowed.has(index)) return;
      const id = el.dataset ? el.dataset.blockId : '';
      if (id && el.getBoundingClientRect) rects.set(id, el.getBoundingClientRect());
    });
    return rects;
  };

  const animateBlockReorder = (beforeRects) => {
    try {
      if (!beforeRects || !beforeRects.size) {
        state.reorderAnimating = false;
        return;
      }
      const moves = blockElements().map((el) => {
        const id = el.dataset ? el.dataset.blockId : '';
        const before = id ? beforeRects.get(id) : null;
        if (!before || !el.getBoundingClientRect) return null;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
        return { el, dx, dy };
      }).filter(Boolean);
      if (!moves.length) {
        state.reorderAnimating = false;
        return;
      }
      let remaining = moves.length;
      let finished = false;
      let fallbackTimer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        moves.forEach((item) => {
          item.el.removeEventListener('transitionend', item.done);
          item.el.classList.remove('is-reordering');
          item.el.style.transition = '';
          item.el.style.transform = '';
        });
        state.reorderAnimating = false;
      };
      moves.forEach((item) => {
        item.done = (event) => {
          if (event && event.target !== item.el) return;
          item.el.removeEventListener('transitionend', item.done);
          remaining -= 1;
          if (remaining <= 0) finish();
        };
        item.el.classList.add('is-reordering');
        item.el.style.transition = 'none';
        item.el.style.transform = `translate3d(${item.dx}px, ${item.dy}px, 0)`;
        item.el.addEventListener('transitionend', item.done);
      });
      list.getBoundingClientRect();
      requestAnimationFrame(() => {
        moves.forEach((item) => {
          item.el.style.transition = '';
          item.el.style.transform = 'translate3d(0, 0, 0)';
        });
      });
      fallbackTimer = window.setTimeout ? window.setTimeout(finish, 360) : null;
    } catch (_) {
      state.reorderAnimating = false;
    }
  };

  const moveBlockInState = (index, direction) => {
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || index >= state.blocks.length || targetIndex >= state.blocks.length) return null;
    const [moved] = state.blocks.splice(index, 1);
    state.blocks.splice(targetIndex, 0, moved);
    state.activeIndex = targetIndex;
    return { targetIndex };
  };

  const commitBlockMove = (index, direction) => {
    if (!moveBlockInState(index, direction)) return;
    render();
    emit();
  };

  const moveBlock = (index, direction) => {
    try {
      const targetIndex = index + direction;
      const shouldMoveNow = !Number.isInteger(index)
        || !Number.isInteger(targetIndex)
        || targetIndex < 0
        || index < 0
        || targetIndex >= state.blocks.length;
      if (shouldMoveNow) return;
      if (state.reorderAnimating || prefersReducedReorderMotion()) {
        if (!state.reorderAnimating) commitBlockMove(index, direction);
        return;
      }
      const beforeRects = captureBlockRects([index, targetIndex]);
      state.reorderAnimating = true;
      const moved = moveBlockInState(index, direction);
      if (!moved) {
        state.reorderAnimating = false;
        return;
      }
      if (!replaceAdjacentBlockElements(index, targetIndex)) {
        render();
        state.reorderAnimating = false;
        emit();
        return;
      }
      emit();
      animateBlockReorder(beforeRects);
    } catch (_) {
      state.reorderAnimating = false;
      commitBlockMove(index, direction);
    }
  };

  const closeBlockActionMenu = (restoreFocus = false) => {
    const current = state.openActionMenu;
    if (!current) return;
    state.openActionMenu = null;
    try { current.menu.hidden = true; } catch (_) {}
    try { current.trigger.setAttribute('aria-expanded', 'false'); } catch (_) {}
    try { current.wrap.classList.remove('is-open'); } catch (_) {}
    try { document.removeEventListener('mousedown', current.onDocDown, true); } catch (_) {}
    try { document.removeEventListener('keydown', current.onKeyDown, true); } catch (_) {}
    if (restoreFocus) {
      try { current.trigger.focus(); } catch (_) {}
    }
  };

  const closeInlineMoreMenu = (restoreFocus = false) => {
    const current = state.openInlineMenu;
    if (!current) return;
    state.openInlineMenu = null;
    try { current.menu.hidden = true; } catch (_) {}
    try { current.trigger.setAttribute('aria-expanded', 'false'); } catch (_) {}
    try { current.wrap.classList.remove('is-open'); } catch (_) {}
    try { document.removeEventListener('mousedown', current.onDocDown, true); } catch (_) {}
    try { document.removeEventListener('keydown', current.onKeyDown, true); } catch (_) {}
    if (restoreFocus) {
      try { current.trigger.focus(); } catch (_) {}
    }
  };

  const deleteBlockAt = (index) => {
    state.blocks.splice(index, 1);
    render();
    setActive(Math.min(index, state.blocks.length - 1));
    emit();
  };

  const createBlockActionMenu = (index) => {
    const wrap = document.createElement('div');
    wrap.className = 'blocks-block-actions';
    const trigger = button('⋯', 'blocks-icon-btn blocks-action-trigger');
    const actionsLabel = text('actions', 'More actions');
    trigger.title = actionsLabel;
    trigger.setAttribute('aria-label', actionsLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'blocks-action-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const makeItem = (label, className, disabled, handler) => {
      const item = button(label, `blocks-action-menu-item${className ? ` ${className}` : ''}`);
      item.setAttribute('role', 'menuitem');
      item.disabled = !!disabled;
      item.addEventListener('click', () => {
        if (item.disabled) return;
        closeBlockActionMenu(false);
        handler();
      });
      menu.appendChild(item);
      return item;
    };

    makeItem(text('moveUp', 'Move up'), '', index === 0, () => moveBlock(index, -1));
    makeItem(text('moveDown', 'Move down'), '', index === state.blocks.length - 1, () => moveBlock(index, 1));
    makeItem(text('delete', 'Delete'), 'blocks-action-menu-delete', false, () => deleteBlockAt(index));

    const openMenu = () => {
      if (state.openActionMenu && state.openActionMenu.menu === menu) return;
      closeBlockActionMenu(false);
      const onDocDown = (event) => {
        if (nodeContains(wrap, event.target)) return;
        closeBlockActionMenu(false);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeBlockActionMenu(true);
        }
      };
      state.openActionMenu = { wrap, trigger, menu, onDocDown, onKeyDown };
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      wrap.classList.add('is-open');
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      const firstEnabled = menu.querySelector('.blocks-action-menu-item:not(:disabled)');
      try { firstEnabled?.focus(); } catch (_) {}
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (state.openActionMenu && state.openActionMenu.menu === menu) {
        closeBlockActionMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  };

  const sourceReasonText = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : 'unsupported';
    return text(`sourceReason.${reason}`, text('sourceReason.unsupported', 'This Markdown is kept as source because the block editor cannot safely convert it to a visual block without changing the original structure.'));
  };

  const createSourceReasonHelp = (block, index) => {
    const wrap = document.createElement('span');
    wrap.className = 'blocks-source-help-wrap';
    const help = button('?', 'blocks-source-help');
    const tooltipId = `blocks-source-help-${block && block.id ? block.id : index}`;
    const message = sourceReasonText(block);
    help.setAttribute('aria-label', message);
    help.setAttribute('aria-describedby', tooltipId);
    const bubble = document.createElement('span');
    bubble.id = tooltipId;
    bubble.className = 'blocks-source-help-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = message;
    wrap.append(help, bubble);
    return wrap;
  };

  const sourceAutofixLabel = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : '';
    return text(`sourceAutofix.${reason}`, text('sourceAutofix.unsupported', 'Autofix'));
  };

  const canAutofixSourceBlock = (block) => !!(block && block.type === 'source' && block.data && block.data.sourceReason === 'indentedList');

  const applySourceAutofix = (index) => {
    const block = state.blocks[index];
    const nextBlocks = autofixMarkdownSourceBlock(block);
    if (!nextBlocks.length) return;
    state.blocks.splice(index, 1, ...nextBlocks);
    state.activeIndex = index;
    render();
    setActive(index);
    emit();
  };

  const createSourceAutofixButton = (block, index) => {
    const label = sourceAutofixLabel(block);
    const autofix = button('', 'blocks-source-autofix');
    autofix.innerHTML = '<span aria-hidden="true">★</span><span class="blocks-source-autofix-label"></span>';
    const labelSpan = autofix.querySelector('.blocks-source-autofix-label');
    if (labelSpan) labelSpan.textContent = text('sourceAutofix.label', 'Autofix');
    autofix.title = label;
    autofix.setAttribute('aria-label', label);
    autofix.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
      applySourceAutofix(index);
    });
    return autofix;
  };

  const syncActiveEditable = () => {
    try {
      if (typeof state.activeSync === 'function') state.activeSync();
    } catch (_) {}
  };

  const clearStickyBlockHeads = (except = null) => {
    Array.from(list.querySelectorAll('.blocks-block-head.is-stuck')).forEach(head => {
      if (head === except) return;
      head.classList.remove('is-stuck');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    });
  };

  const editorStickyToolbarBottom = () => {
    try {
      const panel = root.closest ? root.closest('#editorMarkdownPanel') : null;
      const fileToolbar = panel ? panel.querySelector(':scope > .toolbar') : document.querySelector('#editorMarkdownPanel > .toolbar');
      const rect = fileToolbar && fileToolbar.getBoundingClientRect ? fileToolbar.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    try {
      const styles = getComputedStyle(document.documentElement);
      const offset = parseFloat(styles.getPropertyValue('--editor-toolbar-offset'));
      if (Number.isFinite(offset)) return offset;
    } catch (_) {}
    return 0;
  };

  const editorViewportBottom = () => {
    try {
      const pane = document.getElementById('editorContentPane');
      const rect = pane && pane.getBoundingClientRect ? pane.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    return window.innerHeight || document.documentElement.clientHeight || 0;
  };

  const findVerticalScrollParent = (node) => {
    let el = node && node.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      try {
        const cs = window.getComputedStyle(el);
        if (/(auto|scroll|overlay)/.test(cs.overflowY || '') && el.scrollHeight > el.clientHeight + 1) return el;
      } catch (_) {}
      el = el.parentElement;
    }
    return document.getElementById('editorContentPane') || document.scrollingElement || document.documentElement;
  };

  const wheelDeltaYForScroll = (event, scrollParent) => {
    let deltaY = event && Number.isFinite(event.deltaY) ? event.deltaY : 0;
    if (!deltaY) return 0;
    if (event.deltaMode === 1) deltaY *= 16;
    else if (event.deltaMode === 2) deltaY *= (scrollParent && scrollParent.clientHeight) || window.innerHeight || 600;
    return deltaY;
  };

  const forwardBlockHeadWheel = (event) => {
    if (!event || !event.deltaY) return;
    const absX = Math.abs(event.deltaX || 0);
    const absY = Math.abs(event.deltaY || 0);
    if (absX > absY) return;
    const scrollParent = findVerticalScrollParent(root);
    if (!scrollParent) return;
    const deltaY = wheelDeltaYForScroll(event, scrollParent);
    if (!deltaY) return;
    const before = scrollParent.scrollTop;
    scrollParent.scrollTop = before + deltaY;
    if (scrollParent.scrollTop !== before) event.preventDefault();
  };

  const updateStickyBlockHead = () => {
    const blockNodes = Array.from(list.querySelectorAll('.blocks-block'));
    const activeBlock = blockNodes[state.activeIndex] || null;
    const head = activeBlock ? activeBlock.querySelector('.blocks-block-head') : null;
    clearStickyBlockHeads(head);
    if (!activeBlock || !head || !nodeContains(root, activeBlock) || root.hidden) {
      clearStickyBlockHeads();
      return;
    }

    const wasStuck = head.classList.contains('is-stuck');
    if (wasStuck) {
      head.classList.remove('is-stuck');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    }

    const blockRect = activeBlock.getBoundingClientRect ? activeBlock.getBoundingClientRect() : null;
    if (!blockRect || blockRect.width <= 0 || blockRect.height <= 0) return;
    const headHeight = head.offsetHeight || 0;
    const headWidth = head.offsetWidth || 0;
    if (headHeight <= 0 || headWidth <= 0) return;

    const gap = 8;
    const stickyTop = editorStickyToolbarBottom() + gap;
    const viewportBottom = editorViewportBottom();
    const naturalTop = blockRect.top + (head.offsetTop || 0) - (headHeight * 1.12);
    const blockBottomLimit = blockRect.bottom - headHeight - gap;
    const blockBottomInViewport = blockRect.top < stickyTop && blockRect.bottom > stickyTop && blockRect.bottom <= viewportBottom;
    if (blockRect.bottom <= stickyTop || viewportBottom <= stickyTop) return;

    const margin = 8;
    const left = Math.max(margin, Math.min(blockRect.left + (head.offsetLeft || 0), window.innerWidth - headWidth - margin));
    const viewportBottomLimit = Math.max(stickyTop, viewportBottom - headHeight - gap);
    const blockBottomTop = Math.min(viewportBottomLimit, blockRect.bottom + gap);
    const top = blockBottomInViewport
      ? Math.max(stickyTop, blockBottomTop)
      : Math.min(blockBottomLimit, Math.max(stickyTop, naturalTop));
    head.classList.add('is-stuck');
    head.style.top = `${top}px`;
    head.style.left = `${left}px`;
  };

  let stickyBlockHeadFrame = 0;
  const requestStickyBlockHeadUpdate = () => {
    if (stickyBlockHeadFrame) return;
    const run = () => {
      stickyBlockHeadFrame = 0;
      updateStickyBlockHead();
    };
    if (typeof requestAnimationFrame === 'function') stickyBlockHeadFrame = requestAnimationFrame(run);
    else {
      stickyBlockHeadFrame = setTimeout(run, 16);
    }
  };

  const activeListItemIndex = (block, index) => {
    const activeBlock = state.blocks[index];
    if (!block || activeBlock !== block) return 0;
    const item = closestElement(state.activeEditable, '.blocks-list-item');
    if (!item) return 0;
    const itemIndex = Number(item.dataset.itemIndex);
    return Number.isFinite(itemIndex) ? itemIndex : 0;
  };

  const indentListItem = (block, index, delta) => {
    if (!block || block.type !== 'list') return;
    const items = Array.isArray(block.data.items) && block.data.items.length
      ? block.data.items.slice()
      : [{ text: 'List item', checked: false }];
    const itemIndex = Math.max(0, Math.min(activeListItemIndex(block, index), items.length - 1));
    const current = items[itemIndex] || {};
    const currentIndent = Math.max(0, Number(current.indent) || 0);
    const nextIndent = Math.max(0, currentIndent + delta);
    if (nextIndent === currentIndent) return;
    items[itemIndex] = {
      ...current,
      indent: nextIndent,
      indentText: '  '.repeat(nextIndent)
    };
    state.pendingListFocus = { blockId: block.id, itemIndex, atEnd: false };
    updateFromControl(block, { items }, true);
  };

  const positionLinkEditor = (link) => {
    try {
      if (!link || !nodeContains(root, link)) return;
      const linkRect = link.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const editorRect = linkEditor.getBoundingClientRect();
      const gap = 6;
      const minLeft = 0;
      const maxLeft = Math.max(minLeft, rootRect.width - editorRect.width);
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, linkRect.left - rootRect.left));
      linkEditor.style.left = `${nextLeft}px`;
      linkEditor.style.top = `${linkRect.bottom - rootRect.top + gap}px`;
    } catch (_) {}
  };

  const positionLinkEditorAtRect = (rect) => {
    try {
      if (!rect) return;
      const rootRect = root.getBoundingClientRect();
      const editorRect = linkEditor.getBoundingClientRect();
      const gap = 6;
      const minLeft = 0;
      const maxLeft = Math.max(minLeft, rootRect.width - editorRect.width);
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, rect.left - rootRect.left));
      linkEditor.style.left = `${nextLeft}px`;
      linkEditor.style.top = `${rect.bottom - rootRect.top + gap}px`;
    } catch (_) {}
  };

  let refreshLinkEditor = () => {};

  const setActive = (index, editable = null, sync = null) => {
    const maxIndex = state.blocks.length - 1;
    const numericIndex = Number.isFinite(Number(index)) ? Number(index) : -1;
    state.activeIndex = maxIndex >= 0 ? Math.max(-1, Math.min(numericIndex, maxIndex)) : -1;
    const blockNodes = Array.from(list.querySelectorAll('.blocks-block'));
    const activeBlock = blockNodes[state.activeIndex] || null;
    if (editable) {
      if (editable !== state.activeEditable) {
        state.pendingInline = {};
        state.linkEditMode = '';
        state.linkSelection = null;
        state.lastInlineMarks = null;
        state.lastInlineMarkedRange = null;
      }
      state.activeEditable = editable;
      state.activeSync = sync;
    } else {
      const keepEditable = state.activeEditable && activeBlock && nodeContains(activeBlock, state.activeEditable);
      if (!keepEditable) {
        try {
          const focused = document.activeElement;
          if (focused && state.activeEditable && nodeContains(state.activeEditable, focused) && typeof focused.blur === 'function') {
            focused.blur();
          }
        } catch (_) {}
        state.activeEditable = null;
        state.activeSync = null;
        state.activeLink = null;
        state.activeLinkHoldUntil = 0;
        state.linkEditMode = '';
        state.linkSelection = null;
        state.lastInlineMarks = null;
        state.lastInlineMarkedRange = null;
        state.pendingInline = {};
      }
    }
    blockNodes.forEach((el, idx) => {
      el.classList.toggle('is-active', idx === state.activeIndex);
    });
    refreshLinkEditor();
    updateInlineToolbarState();
    requestStickyBlockHeadUpdate();
  };

  const shouldSuppressRoutedBlockContainerClick = () => {
    if (!state.suppressNextBlockContainerClickUntil) return false;
    if (Date.now() > state.suppressNextBlockContainerClickUntil) {
      state.suppressNextBlockContainerClickUntil = 0;
      return false;
    }
    state.suppressNextBlockContainerClickUntil = 0;
    return true;
  };

  const isBlocksCaretInteractiveTarget = (target) => {
    return !!closestElement(target, [
      '.blocks-block-head',
      '.blocks-toolbar',
      '.blocks-link-editor',
      '.blocks-card-picker',
      '.blocks-inspector',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      'a[href]',
      '[contenteditable="true"]'
    ].join(','));
  };

  const rectDistanceSquared = (rect, x, y) => {
    if (!rect) return Number.POSITIVE_INFINITY;
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return (dx * dx) + (dy * dy);
  };

  const nearestRectForPoint = (el, x, y) => {
    const rects = Array.from(el && el.getClientRects ? el.getClientRects() : [])
      .filter(rect => rect && (rect.width > 0 || rect.height > 0));
    if (!rects.length && el && el.getBoundingClientRect) rects.push(el.getBoundingClientRect());
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    rects.forEach(rect => {
      const distance = rectDistanceSquared(rect, x, y);
      if (distance < bestDistance) {
        best = rect;
        bestDistance = distance;
      }
    });
    return best;
  };

  const editableCaretCandidates = () => {
    const blockNodes = Array.from(list.querySelectorAll('.blocks-block'));
    const candidates = [];
    blockNodes.forEach((blockEl, index) => {
      const listTexts = blockEl.querySelectorAll('.blocks-list-item .blocks-list-text');
      listTexts.forEach(editable => {
        candidates.push({
          editable,
          hitTarget: closestElement(editable, '.blocks-list-item') || editable,
          index,
          sync: editableSyncMap.get(editable) || null
        });
      });
      const editables = blockEl.querySelectorAll('.blocks-rich-editable:not(.blocks-list-text), .blocks-code-preview code[contenteditable="true"], .blocks-source-textarea');
      editables.forEach(editable => {
        candidates.push({
          editable,
          hitTarget: editable,
          index,
          sync: editableSyncMap.get(editable) || null
        });
      });
    });
    return candidates;
  };

  const nearestEditableFromPoint = (x, y) => {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    editableCaretCandidates().forEach(candidate => {
      const rect = nearestRectForPoint(candidate.hitTarget || candidate.editable, x, y);
      const distance = rectDistanceSquared(rect, x, y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    return best;
  };

  const setContentEditableCaretFromPoint = (editable, x, y, hitTarget = editable) => {
    const setRangeFromPoint = (targetX, targetY) => {
      let range = null;
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(targetX, targetY);
        if (pos && pos.offsetNode && pos.offsetNode.nodeType === Node.TEXT_NODE && nodeContains(editable, pos.offsetNode)) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
        }
      }
      if (!range && document.caretRangeFromPoint) {
        const pointRange = document.caretRangeFromPoint(targetX, targetY);
        if (pointRange && pointRange.startContainer && pointRange.startContainer.nodeType === Node.TEXT_NODE && nodeContains(editable, pointRange.startContainer)) range = pointRange;
      }
      if (!range) return false;
      range.collapse(true);
      const sel = window.getSelection && window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    };
    const rect = editable.getBoundingClientRect ? editable.getBoundingClientRect() : null;
    const hitRect = hitTarget && hitTarget.getBoundingClientRect ? hitTarget.getBoundingClientRect() : rect;
    const pointInsideEditableRect = !rect || (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
    if (pointInsideEditableRect && setRangeFromPoint(x, y)) return;
    const measuredOffset = measuredTextOffsetFromPoint(editable, x, y);
    if (measuredOffset != null) {
      placeCaretAtTextOffset(editable, measuredOffset);
      return;
    }
    const nearestRect = nearestRectForPoint(editable, x, y);
    if (nearestRect) {
      const targetX = Math.max(nearestRect.left + 1, Math.min(Number(x) || nearestRect.left, nearestRect.right - 1));
      const targetY = nearestRect.top + (nearestRect.height / 2);
      if (setRangeFromPoint(targetX, targetY)) return;
    }
    if (hitRect && y < hitRect.top + (hitRect.height / 2)) placeCaretAtTextOffset(editable, 0);
    else placeCaretAtEnd(editable);
  };

  const setTextareaCaretFromPoint = (area, x, y) => {
    try {
      const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : null;
      const valueLength = String(area.value || '').length;
      const measuredOffset = textareaTextOffsetFromPoint(area, x, y);
      const fallbackOffset = rect && y < rect.top + (rect.height / 2) ? 0 : valueLength;
      const offset = measuredOffset != null ? measuredOffset : fallbackOffset;
      area.setSelectionRange(offset, offset);
      autoSizeTextarea(area);
    } catch (_) {}
  };

  const routeDirectQuoteCaretFromPointer = (editable, index, sync, event) => {
    if (!event || event.defaultPrevented || event.button !== 0 || event.isPrimary === false) return false;
    if (!editable || !(editable.classList && editable.classList.contains('blocks-quote-text'))) return false;
    const details = measuredTextOffsetDetailsFromPoint(editable, event.clientX, event.clientY);
    if (!details || details.insideTextRect) return false;
    event.preventDefault();
    state.suppressNextBlockContainerClickUntil = Date.now() + 500;
    try { editable.focus({ preventScroll: true }); }
    catch (_) {
      try { editable.focus(); } catch (__) {}
    }
    placeCaretAtTextOffset(editable, details.offset);
    setActive(index, editable, sync);
    updateInlineToolbarState();
    return true;
  };

  const routeBlocksCaretFromPointer = (event) => {
    if (!event || event.defaultPrevented || event.button !== 0) return;
    if (event.isPrimary === false) return;
    if (isBlocksCaretInteractiveTarget(event.target)) return;
    const imageBlock = closestElement(event.target, '.blocks-block-image');
    if (imageBlock) {
      const imageIndex = blockElements().indexOf(imageBlock);
      if (imageIndex >= 0) {
        event.preventDefault();
        state.suppressNextBlockContainerClickUntil = Date.now() + 500;
        try { imageBlock.focus({ preventScroll: true }); }
        catch (_) {
          try { imageBlock.focus(); } catch (__) {}
        }
        clearNativeSelection();
        setActive(imageIndex);
        return;
      }
    }
    const candidate = nearestEditableFromPoint(event.clientX, event.clientY);
    if (!candidate || !candidate.editable) return;
    event.preventDefault();
    state.suppressNextBlockContainerClickUntil = Date.now() + 500;
    const { editable, hitTarget, index, sync } = candidate;
    try { editable.focus({ preventScroll: true }); }
    catch (_) {
      try { editable.focus(); } catch (__) {}
    }
    if (editable.matches && editable.matches('textarea')) {
      setTextareaCaretFromPoint(editable, event.clientX, event.clientY);
    } else {
      setContentEditableCaretFromPoint(editable, event.clientX, event.clientY, hitTarget);
    }
    setActive(index, editable, sync);
  };

  list.addEventListener('pointerdown', routeBlocksCaretFromPointer);
  window.addEventListener('scroll', requestStickyBlockHeadUpdate, true);
  window.addEventListener('resize', requestStickyBlockHeadUpdate);

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

  const inlineCommandMark = (kind) => (kind === 'strikeThrough' ? 'strike' : kind);
  const hasPendingInlineMarks = () => !!(state.pendingInline.bold
    || state.pendingInline.italic
    || state.pendingInline.strike
    || state.pendingInline.link);
  let updateInlineToolbarState = () => {};
  let openLinkEditorForSelection = () => {};

  const applyRunsToEditable = (editable, runs, caretOffset = null) => {
    renderInlineRunsInto(editable, runs);
    if (caretOffset != null) placeCaretAtTextOffset(editable, caretOffset);
    syncActiveEditable();
    updateInlineToolbarState();
  };

  const togglePendingInlineMark = (kind) => {
    const mark = inlineCommandMark(kind);
    if (mark === 'code') return;
    const active = !!state.pendingInline[mark];
    state.pendingInline = { ...state.pendingInline, code: false, [mark]: !active };
    updateInlineToolbarState();
  };

  const applyInlineCommand = (kind) => {
    const editable = state.activeEditable;
    if (!editable || !nodeContains(root, editable)) return;
    try { editable.focus(); } catch (_) {}
    if (kind === 'link') {
      openLinkEditorForSelection();
      return;
    }
    const offsets = getEditableSelectionOffsets(editable);
    const runs = inlineRunsFromDom(editable);
    const mark = inlineCommandMark(kind);
    if (mark === 'code') {
      const selectedCodeRange = inlineMarkedDomRangeFromSelection(editable, mark);
      const rememberedCodeRange = state.lastInlineMarkedRange
        && state.lastInlineMarkedRange.editable === editable
        && state.lastInlineMarkedRange.mark === mark
        ? state.lastInlineMarkedRange
        : null;
      const codeRange = selectedCodeRange || rememberedCodeRange;
      if ((!offsets || offsets.collapsed) && codeRange) {
        state.pendingInline = {};
        state.lastInlineMarks = null;
        state.lastInlineMarkedRange = null;
        const nextRuns = removeInlineMarkInRange(runs, codeRange.start, codeRange.end, mark);
        applyRunsToEditable(editable, nextRuns, offsets ? offsets.start : codeRange.start);
        return;
      }
    }
    if (!offsets) return;
    if (offsets.collapsed) {
      if (mark === 'code' && inlineMarksAtOffset(runs, offsets.start).code) {
        state.pendingInline = {};
        state.lastInlineMarks = null;
        state.lastInlineMarkedRange = null;
        const nextRuns = removeInlineMarkAroundOffset(runs, offsets.start, mark);
        applyRunsToEditable(editable, nextRuns, offsets.start);
        return;
      }
      if (mark === 'code') return;
      togglePendingInlineMark(kind);
      return;
    }
    state.pendingInline = {};
    const nextRuns = toggleInlineMarkOnRuns(runs, offsets.start, offsets.end, inlineCommandMark(kind));
    applyRunsToEditable(editable, nextRuns, offsets.end);
  };

  const inlineControls = [
    ['B', 'bold', 'inlineBold', 'Bold'],
    ['I', 'italic', 'inlineItalic', 'Italic'],
    ['Link', 'link', 'inlineLink', 'Link']
  ];
  const inlineMoreControls = [
    ['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'],
    ['`', 'code', 'inlineCode', 'Inline code']
  ];

  const createInlineCommandButton = (label, command, key, fallback, index, className = 'blocks-inline-btn') => {
    const btn = button(label, className);
    btn.dataset.inlineCommand = command;
    btn.title = text(key, fallback);
    btn.setAttribute('aria-label', text(key, fallback));
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      setActive(index);
      applyInlineCommand(command);
    });
    return btn;
  };

  const createInlineMoreMenu = (index) => {
    const wrap = document.createElement('div');
    wrap.className = 'blocks-inline-more';
    const trigger = button('Aa', 'blocks-inline-btn blocks-inline-more-trigger');
    const moreLabel = text('inlineMore', 'More formatting');
    trigger.title = moreLabel;
    trigger.setAttribute('aria-label', moreLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'blocks-inline-more-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    inlineMoreControls.forEach(([_label, command, key, fallback]) => {
      const item = createInlineCommandButton(text(key, fallback), command, key, fallback, index, 'blocks-inline-menu-item');
      item.setAttribute('role', 'menuitem');
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => closeInlineMoreMenu(false));
      menu.appendChild(item);
    });

    const openMenu = () => {
      if (state.openInlineMenu && state.openInlineMenu.menu === menu) return;
      closeInlineMoreMenu(false);
      const onDocDown = (event) => {
        if (nodeContains(wrap, event.target)) return;
        closeInlineMoreMenu(false);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeInlineMoreMenu(true);
        }
      };
      state.openInlineMenu = { wrap, trigger, menu, onDocDown, onKeyDown };
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      wrap.classList.add('is-open');
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      const firstEnabled = menu.querySelector('.blocks-inline-menu-item:not(:disabled)');
      try { firstEnabled?.focus(); } catch (_) {}
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (state.openInlineMenu && state.openInlineMenu.menu === menu) {
        closeInlineMoreMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  };

  const createInlineControls = (index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-inline-controls';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', text('inlineToolbarAria', 'Inline formatting'));
    inlineControls.forEach(([label, command, key, fallback]) => {
      const btn = createInlineCommandButton(label, command, key, fallback, index);
      controls.appendChild(btn);
    });
    controls.appendChild(createInlineMoreMenu(index));
    return controls;
  };

  const linkEditor = document.createElement('div');
  linkEditor.className = 'blocks-link-editor';
  linkEditor.hidden = true;
  linkEditor.setAttribute('aria-hidden', 'true');
  const linkText = document.createElement('input');
  linkText.type = 'text';
  linkText.className = 'blocks-link-text';
  linkText.placeholder = text('linkText', 'Link text');
  linkText.setAttribute('aria-label', text('linkText', 'Link text'));
  const linkHref = document.createElement('input');
  linkHref.type = 'text';
  linkHref.className = 'blocks-link-href';
  linkHref.placeholder = text('linkHref', 'Link URL');
  linkHref.setAttribute('aria-label', text('linkHref', 'Link URL'));
  const linkTitle = document.createElement('input');
  linkTitle.type = 'text';
  linkTitle.className = 'blocks-link-title';
  linkTitle.placeholder = text('linkTitle', 'Link title');
  linkTitle.setAttribute('aria-label', text('linkTitle', 'Link title'));
  const unlink = button(text('unlink', 'Unlink'), 'blocks-inline-btn blocks-unlink-btn');
  unlink.title = text('unlink', 'Unlink');
  unlink.setAttribute('aria-label', text('unlink', 'Unlink'));
  const linkEditorFocused = () => {
    try { return linkEditor.contains(document.activeElement); } catch (_) { return false; }
  };
  const hideLinkEditor = () => {
    state.activeLink = null;
    state.linkEditMode = '';
    state.linkSelection = null;
    linkEditor.hidden = true;
    linkEditor.setAttribute('aria-hidden', 'true');
  };
  const isLinkEditorInternalTarget = (target) => {
    if (nodeContains(linkEditor, target)) return true;
    const clickedLink = closestElement(target, 'a[href]');
    return !!(clickedLink && state.activeEditable && nodeContains(state.activeEditable, clickedLink));
  };
  const handleLinkEditorOutsidePointer = (event) => {
    if (linkEditor.hidden) return;
    const target = event && event.target;
    if (!target || isLinkEditorInternalTarget(target)) return;
    hideLinkEditor();
    updateInlineToolbarState();
  };
  const selectionAnchorRect = (editable, offsets) => {
    try {
      const rect = offsets && offsets.range && offsets.range.getBoundingClientRect && offsets.range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
      return caretRectForEditable(editable);
    } catch (_) {
      return caretRectForEditable(editable);
    }
  };
  const applyLinkEditor = () => {
    const href = sanitizeEditorLinkHref(inputValue(linkHref));
    const title = sanitizeEditorLinkTitle(inputValue(linkTitle));
    if (state.linkEditMode === 'pending') {
      state.pendingInline = { ...state.pendingInline, code: false, link: href, linkTitle: title };
      updateInlineToolbarState();
      return;
    }
    if (state.linkEditMode === 'range') {
      const selection = state.linkSelection;
      if (!selection || !selection.editable || !nodeContains(root, selection.editable)) return;
      const runs = inlineRunsFromDom(selection.editable);
      const currentText = inlineRangeText(runs, selection.start, selection.end);
      const nextText = inputValue(linkText);
      const replacementText = nextText !== currentText ? nextText : null;
      const nextRuns = applyInlineLinkToRuns(runs, selection.start, selection.end, href, replacementText, title);
      const nextEnd = selection.start + (replacementText != null ? nextText.length : currentText.length);
      renderInlineRunsInto(selection.editable, nextRuns);
      state.linkSelection = { ...selection, end: nextEnd, text: nextText };
      syncActiveEditable();
      updateInlineToolbarState();
      return;
    }
    const link = state.activeLink;
    if (!link || !state.activeEditable || !nodeContains(state.activeEditable, link)) return;
    const linkRange = textRangeForDomNode(state.activeEditable, link);
    if (!linkRange) return;
    const runs = inlineRunsFromDom(state.activeEditable);
    const currentText = inlineRangeText(runs, linkRange.start, linkRange.end);
    const nextText = inputValue(linkText);
    const replacementText = nextText !== currentText ? nextText : null;
    const nextRuns = applyInlineLinkToRuns(runs, linkRange.start, linkRange.end, href, replacementText, title);
    const nextEnd = linkRange.start + (replacementText != null ? nextText.length : currentText.length);
    renderInlineRunsInto(state.activeEditable, nextRuns);
    state.activeLink = linkForTextRange(state.activeEditable, linkRange.start, nextEnd);
    syncActiveEditable();
    updateInlineToolbarState();
  };
  linkText.addEventListener('input', applyLinkEditor);
  linkHref.addEventListener('input', applyLinkEditor);
  linkTitle.addEventListener('input', applyLinkEditor);
  unlink.addEventListener('mousedown', (event) => event.preventDefault());
  unlink.addEventListener('click', () => {
    if (state.linkEditMode === 'pending') {
      state.pendingInline = { ...state.pendingInline, link: '', linkTitle: '' };
      hideLinkEditor();
      updateInlineToolbarState();
      return;
    }
    if (state.linkEditMode === 'range') {
      linkHref.value = '';
      applyLinkEditor();
      hideLinkEditor();
      updateInlineToolbarState();
      return;
    }
    const link = state.activeLink;
    if (!link || !state.activeEditable || !nodeContains(state.activeEditable, link)) return;
    const linkRange = textRangeForDomNode(state.activeEditable, link);
    if (!linkRange) return;
    const nextRuns = applyInlineLinkToRuns(inlineRunsFromDom(state.activeEditable), linkRange.start, linkRange.end, '');
    renderInlineRunsInto(state.activeEditable, nextRuns);
    state.activeLink = null;
    try {
      state.activeEditable.focus();
      placeCaretAtTextOffset(state.activeEditable, linkRange.end);
    } catch (_) {}
    syncActiveEditable();
    hideLinkEditor();
    updateInlineToolbarState();
  });
  openLinkEditorForSelection = () => {
    const editable = state.activeEditable;
    if (!editable || !nodeContains(root, editable)) return;
    const existingLink = selectionLinkInEditable(editable);
    if (existingLink) {
      state.linkEditMode = 'dom';
      state.linkSelection = null;
      refreshLinkEditor(existingLink);
      setTimeout(() => {
        try { linkHref.focus(); linkHref.select(); } catch (_) {}
      }, 0);
      return;
    }
    const offsets = getEditableSelectionOffsets(editable);
    if (!offsets) return;
    const anchorRect = selectionAnchorRect(editable, offsets);
    state.activeLink = null;
    state.linkEditMode = offsets.collapsed ? 'pending' : 'range';
    state.linkSelection = { editable, start: offsets.start, end: offsets.end, text: offsets.text, anchorRect };
    linkText.value = offsets.collapsed ? '' : offsets.text;
    linkHref.value = offsets.collapsed ? (state.pendingInline.link || '') : '';
    linkTitle.value = offsets.collapsed ? (state.pendingInline.linkTitle || '') : '';
    linkEditor.hidden = false;
    linkEditor.setAttribute('aria-hidden', 'false');
    positionLinkEditorAtRect(anchorRect);
    setTimeout(() => {
      try { linkHref.focus(); linkHref.select(); } catch (_) {}
    }, 0);
    updateInlineToolbarState();
  };

  updateInlineToolbarState = () => {
    const buttons = root.querySelectorAll('[data-inline-command]');
    if (!buttons.length) return;
    const blockNodes = Array.from(list.querySelectorAll('.blocks-block'));
    const selectionEditable = selectionEditableInRoot(root);
    if (selectionEditable) {
      const selectionBlock = closestElement(selectionEditable, '.blocks-block');
      const selectionIndex = blockNodes.indexOf(selectionBlock);
      if (selectionIndex >= 0) {
        state.activeIndex = selectionIndex;
        state.activeEditable = selectionEditable;
        state.activeSync = editableSyncMap.get(selectionEditable) || state.activeSync;
        blockNodes.forEach((el, idx) => {
          el.classList.toggle('is-active', idx === state.activeIndex);
        });
      }
    }
    const editable = state.activeEditable;
    const activeBlock = blockNodes[state.activeIndex] || null;
    const offsets = editable && nodeContains(root, editable) ? getEditableSelectionOffsets(editable) : null;
    const runs = editable && nodeContains(root, editable) ? inlineRunsFromDom(editable) : [];
    const pending = hasPendingInlineMarks();
    const fallbackMarks = state.lastInlineMarks
      && state.lastInlineMarks.editable === editable
      ? state.lastInlineMarks.marks
      : null;
    const rememberedCodeRange = state.lastInlineMarkedRange
      && state.lastInlineMarkedRange.editable === editable
      && state.lastInlineMarkedRange.mark === 'code'
      ? state.lastInlineMarkedRange
      : null;
    buttons.forEach(btn => {
      if (!activeBlock || !activeBlock.contains(btn)) {
        btn.classList.remove('is-active');
        btn.classList.remove('is-disabled');
        btn.setAttribute('aria-pressed', 'false');
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        btn.tabIndex = 0;
        return;
      }
      const command = btn.dataset.inlineCommand || '';
      const mark = inlineCommandMark(command);
      let active = false;
      let disabled = false;
      if (offsets && command === 'link') {
        active = !!state.pendingInline.link
          || !!selectionLinkInEditable(editable)
          || (!offsets.collapsed && inlineRangeFullyMarked(runs, offsets.start, offsets.end, 'link'));
      } else if (mark === 'code') {
        if (offsets && offsets.collapsed) {
          const marks = inlineMarksAtOffset(runs, offsets.start);
          active = !!(marks.code || (fallbackMarks && fallbackMarks.code));
          disabled = !active;
        } else if (offsets) {
          active = inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
          disabled = !rangeHasInlineText(runs, offsets.start, offsets.end);
        } else {
          active = !!(fallbackMarks && fallbackMarks.code);
          disabled = !rememberedCodeRange;
        }
      } else if (offsets && offsets.collapsed) {
        const marks = inlineMarksAtOffset(runs, offsets.start);
        active = pending ? !!state.pendingInline[mark] : !!(marks[mark] || (fallbackMarks && fallbackMarks[mark]));
      } else if (offsets) {
        active = ['bold', 'italic', 'strike'].includes(mark)
          ? inlineRangeAnyMarked(runs, offsets.start, offsets.end, mark)
          : inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
      } else if (fallbackMarks && ['bold', 'italic', 'strike', 'code'].includes(mark)) {
        active = !!fallbackMarks[mark];
      }
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('is-disabled', disabled);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.disabled = false;
      btn.tabIndex = disabled ? -1 : 0;
      if (disabled) {
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.removeAttribute('aria-disabled');
      }
    });
  };
  linkEditor.append(linkText, linkHref, linkTitle, unlink);
  root.appendChild(linkEditor);

  refreshLinkEditor = (explicitLink = null) => {
    if (state.linkEditMode === 'range' || state.linkEditMode === 'pending') {
      if (!linkEditor.hidden && state.linkSelection && state.linkSelection.anchorRect) {
        positionLinkEditorAtRect(state.linkSelection.anchorRect);
      }
      updateInlineToolbarState();
      return;
    }
    const link = explicitLink && state.activeEditable && nodeContains(state.activeEditable, explicitLink)
      ? explicitLink
      : selectionLinkInEditable(state.activeEditable);
    if (link) {
      state.activeLink = link;
      if (explicitLink) state.activeLinkHoldUntil = Date.now() + 800;
    } else if (!linkEditorFocused()) {
      const keepClickedLink = state.activeLink
        && state.activeEditable
        && nodeContains(state.activeEditable, state.activeLink)
        && Date.now() < state.activeLinkHoldUntil;
      if (!keepClickedLink) state.activeLink = null;
    }
    const activeLink = state.activeLink && state.activeEditable && nodeContains(state.activeEditable, state.activeLink)
      ? state.activeLink
      : null;
    if (!activeLink) {
      if (!linkEditorFocused()) hideLinkEditor();
      updateInlineToolbarState();
      return;
    }
    state.linkEditMode = 'dom';
    state.linkSelection = null;
    linkEditor.hidden = false;
    linkEditor.setAttribute('aria-hidden', 'false');
    if (!linkEditorFocused()) {
      linkText.value = activeLink.textContent || '';
      linkHref.value = activeLink.getAttribute('href') || '';
      linkTitle.value = activeLink.getAttribute('title') || '';
    }
    positionLinkEditor(activeLink);
    updateInlineToolbarState();
  };

  root.addEventListener('keyup', refreshLinkEditor);
  root.addEventListener('mouseup', refreshLinkEditor);
  root.addEventListener('focusin', refreshLinkEditor);
  document.addEventListener('pointerdown', handleLinkEditorOutsidePointer, true);
  document.addEventListener('mousedown', handleLinkEditorOutsidePointer, true);
  window.addEventListener('resize', refreshLinkEditor);
  window.addEventListener('scroll', refreshLinkEditor, true);
  document.addEventListener('selectionchange', () => {
    if (!state.activeEditable || !nodeContains(root, state.activeEditable)) return;
    refreshLinkEditor();
  });

  const insertPendingInlineText = (editable, value) => {
    const textValue = String(value || '');
    if (!editable || !textValue || !hasPendingInlineMarks()) return false;
    const offsets = getEditableSelectionOffsets(editable);
    if (!offsets) return false;
    const runs = inlineRunsFromDom(editable);
    const insertRun = inlineRun(textValue, state.pendingInline);
    const nextRuns = insertInlineRunsAtRange(runs, offsets.start, offsets.end, [insertRun]);
    applyRunsToEditable(editable, nextRuns, offsets.start + textValue.length);
    return true;
  };

  const wireInlineEditable = (editable, index, sync) => {
    editable.addEventListener('beforeinput', (event) => {
      if (event.isComposing || !hasPendingInlineMarks()) return;
      if (event.inputType !== 'insertText' || event.data == null) return;
      event.preventDefault();
      setActive(index, editable, sync);
      insertPendingInlineText(editable, event.data);
    });
    editable.addEventListener('paste', (event) => {
      if (!hasPendingInlineMarks()) return;
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!pasted) return;
      event.preventDefault();
      setActive(index, editable, sync);
      insertPendingInlineText(editable, pasted);
    });
    editable.addEventListener('keyup', () => updateInlineToolbarState());
    editable.addEventListener('mouseup', () => updateInlineToolbarState());
  };

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
    editableSyncMap.set(editable, sync);
    editable.addEventListener('input', () => {
      sync();
      updateInlineToolbarState();
    });
    editable.addEventListener('focus', () => setActive(index, editable, sync));
    editable.addEventListener('pointerdown', (event) => {
      routeDirectQuoteCaretFromPointer(editable, index, sync, event);
    });
    editable.addEventListener('click', (event) => {
      const clickedLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (clickedLink) event.preventDefault();
      setActive(index, editable, sync);
      const pointerMarks = inlineMarksFromPointerEvent(event, editable);
      state.lastInlineMarks = { editable, marks: pointerMarks };
      const pointerCodeRange = pointerMarks.code ? inlineMarkedDomRangeFromPointerEvent(event, editable, 'code') : null;
      state.lastInlineMarkedRange = pointerCodeRange ? { editable, mark: 'code', ...pointerCodeRange } : null;
      updateInlineToolbarState();
      if (clickedLink) refreshLinkEditor(clickedLink);
    });
    wireInlineEditable(editable, index, sync);
    return editable;
  };

  const createHeadingLevelSelect = (block) => {
    const select = document.createElement('select');
    select.className = 'blocks-heading-level';
    select.title = text('headingLevel', 'Heading level');
    [1, 2, 3, 4, 5, 6].forEach(level => {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = `H${level}`;
      select.appendChild(option);
    });
    select.value = String(block.data.level || 2);
    select.addEventListener('change', () => updateFromControl(block, { level: Number(select.value) || 2 }, true));
    return select;
  };

  const syncRenderedImageBlock = (block) => {
    const blockEl = blockElements().find(el => el && el.dataset && el.dataset.blockId === block.id);
    if (!blockEl) return;
    const img = blockEl.querySelector('.blocks-image-preview');
    const caption = blockEl.querySelector('.blocks-image-figure figcaption');
    if (img) {
      img.alt = block.data.alt || '';
      const nextSrc = resolveAssetSrc(block.data.src || '');
      if (nextSrc) img.src = nextSrc;
      else img.removeAttribute('src');
    }
    if (caption) {
      caption.textContent = block.data.alt || '';
      caption.hidden = !block.data.alt;
    }
    hydrateImages(blockEl);
  };

  const createImageMetadataControls = (block, index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-image-meta-controls';
    const alt = document.createElement('input');
    alt.type = 'text';
    alt.className = 'blocks-image-alt';
    alt.value = block.data.alt || '';
    alt.placeholder = text('imageAlt', 'Alt text');
    alt.setAttribute('aria-label', text('imageAlt', 'Alt text'));
    const replace = button(text('replaceImage', 'Replace image'), 'blocks-btn blocks-image-replace');
    replace.title = text('replaceImage', 'Replace image');
    replace.setAttribute('aria-label', text('replaceImage', 'Replace image'));
    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'blocks-image-title';
    title.value = block.data.title || '';
    title.placeholder = text('imageTitle', 'Image title');
    title.setAttribute('aria-label', text('imageTitle', 'Image title'));
    const update = () => {
      updateFromControl(block, { alt: inputValue(alt), title: inputValue(title) });
      syncRenderedImageBlock(block);
    };
    alt.addEventListener('input', update);
    title.addEventListener('input', update);
    replace.addEventListener('mousedown', (event) => event.preventDefault());
    replace.addEventListener('click', () => {
      setActive(index);
      if (typeof options.requestImageUpload === 'function') {
        options.requestImageUpload({ replaceIndex: index });
      }
    });
    controls.append(alt, title, replace);
    return controls;
  };

  const renderHeadingBlock = (body, block, index) => {
    const level = Math.max(1, Math.min(6, Number(block.data.level) || 2));
    const heading = createRichEditable(`h${level}`, block, 'text', `blocks-rich-editable blocks-heading-text blocks-heading-h${level}`, index);
    body.appendChild(heading);
  };

  const renderImageBlock = (body, block, index) => {
    const figure = document.createElement('figure');
    figure.className = 'blocks-image-figure';
    const selectImageBlock = (event) => {
      if (!event || event.defaultPrevented) return;
      if (event.type === 'pointerdown' && (event.button !== 0 || event.isPrimary === false)) return;
      event.preventDefault();
      event.stopPropagation();
      state.suppressNextBlockContainerClickUntil = Date.now() + 500;
      clearNativeSelection();
      setActive(index);
    };
    figure.addEventListener('pointerdown', selectImageBlock);
    figure.addEventListener('click', selectImageBlock);
    const img = document.createElement('img');
    img.className = 'blocks-image-preview';
    img.alt = block.data.alt || '';
    const resolved = resolveAssetSrc(block.data.src || '');
    if (resolved) img.src = resolved;
    img.loading = 'lazy';
    img.decoding = 'async';
    const caption = document.createElement('figcaption');
    caption.textContent = block.data.alt || '';
    caption.hidden = !block.data.alt;
    figure.append(img, caption);

    body.append(figure);
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

  const createListIndentControls = (block, index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-list-indent-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', text('listIndentControls', 'List indentation'));
    [
      ['←', -1, 'listOutdent', 'Decrease list indent'],
      ['→', 1, 'listIndent', 'Increase list indent']
    ].forEach(([label, delta, key, fallback]) => {
      const btn = button(label, 'blocks-icon-btn blocks-list-indent-btn');
      btn.title = text(key, fallback);
      btn.setAttribute('aria-label', text(key, fallback));
      btn.addEventListener('mousedown', (event) => event.preventDefault());
      btn.addEventListener('click', () => {
        setActive(index);
        indentListItem(block, index, delta);
      });
      controls.appendChild(btn);
    });
    return controls;
  };

  const createCodeLanguageInput = (block) => {
    const lang = document.createElement('input');
    lang.className = 'blocks-code-language';
    lang.type = 'text';
    lang.value = block.data.lang || '';
    lang.placeholder = text('codeLanguage', 'Language');
    lang.title = text('codeLanguage', 'Language');
    lang.setAttribute('aria-label', text('codeLanguage', 'Language'));
    lang.addEventListener('input', () => updateFromControl(block, { lang: inputValue(lang) }));
    return lang;
  };

  const autoSizeTextarea = (area) => {
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };

  const renderListBlock = (body, block, index) => {
    const items = editableListItems(block.data.items);
    const listType = block.data.listType === 'ol' || block.data.listType === 'task' ? block.data.listType : 'ul';
    const listEl = document.createElement(listType === 'ol' ? 'ol' : 'ul');
    listEl.className = `blocks-visual-list blocks-visual-list-${listType}`;
    items.forEach((item, itemIndex) => {
      const li = document.createElement('li');
      li.className = 'blocks-list-item';
      li.dataset.itemIndex = String(itemIndex);
      const itemIndent = Math.max(0, Number(item && item.indent) || 0);
      li.dataset.indent = String(itemIndent);
      if (itemIndent) li.style.marginLeft = `${itemIndent * 1.75}rem`;
      if (listType === 'task') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        checkbox.addEventListener('change', () => {
          const next = patchListItem(block.data.items, itemIndex, { checked: checkbox.checked });
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
        const next = patchListItem(block.data.items, itemIndex, { text: editableText(span) });
        updateFromControl(block, { items: next });
      };
      editableSyncMap.set(span, sync);
      span.addEventListener('input', () => {
        sync();
        updateInlineToolbarState();
      });
      span.addEventListener('keydown', (event) => {
        if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
          event.preventDefault();
          indentListItem(block, index, event.shiftKey ? -1 : 1);
          return;
        }
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          const split = splitEditableTextAtSelection(span);
          const next = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
          next[itemIndex] = { ...next[itemIndex], text: split.before };
          const current = next[itemIndex] || {};
          const currentIndent = Math.max(0, Number(current.indent) || 0);
          next.splice(itemIndex + 1, 0, {
            text: split.after,
            checked: false,
            indent: currentIndent,
            indentText: typeof current.indentText === 'string' ? current.indentText : '  '.repeat(currentIndent),
            marker: current.marker,
            delimiter: current.delimiter
          });
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
        const clickedLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (clickedLink) event.preventDefault();
        setActive(index, span, sync);
        const pointerMarks = inlineMarksFromPointerEvent(event, span);
        state.lastInlineMarks = { editable: span, marks: pointerMarks };
        const pointerCodeRange = pointerMarks.code ? inlineMarkedDomRangeFromPointerEvent(event, span, 'code') : null;
        state.lastInlineMarkedRange = pointerCodeRange ? { editable: span, mark: 'code', ...pointerCodeRange } : null;
        updateInlineToolbarState();
        if (clickedLink) refreshLinkEditor(clickedLink);
      });
      wireInlineEditable(span, index, sync);
      li.appendChild(span);
      if (state.pendingListFocus && state.pendingListFocus.blockId === block.id && state.pendingListFocus.itemIndex === itemIndex) {
        queueMicrotask(() => {
          if (!nodeContains(root, span)) return;
          const pending = state.pendingListFocus;
          state.pendingListFocus = null;
          try { span.focus(); } catch (_) {}
          if (pending && pending.atEnd) placeCaretAtEnd(span);
          else if (pending) placeCaretAtStart(span);
          setActive(index, span, sync);
        });
      }
      listEl.appendChild(li);
    });
    body.appendChild(listEl);
  };

  const renderCodeBlock = (body, block, index) => {
    const pre = document.createElement('pre');
    pre.className = 'blocks-code-preview';
    const code = document.createElement('code');
    code.contentEditable = 'true';
    code.spellcheck = false;
    code.textContent = block.data.text || '';
    const sync = () => updateFromControl(block, { text: codeEditableText(code) });
    editableSyncMap.set(code, sync);
    code.addEventListener('input', sync);
    code.addEventListener('focus', () => setActive(index, code, sync));
    pre.appendChild(code);
    body.appendChild(pre);
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
      renderImageBlock(body, block, index);
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
      area.rows = 1;
      area.value = block.data.text != null ? block.data.text : block.raw || '';
      const sync = () => updateFromControl(block, { text: area.value });
      let sourcePointer = null;
      editableSyncMap.set(area, sync);
      area.addEventListener('input', () => {
        sync();
        autoSizeTextarea(area);
      });
      area.addEventListener('pointerdown', (event) => {
        if (!event || event.button !== 0 || event.isPrimary === false) return;
        const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY);
        if (details && !details.insideTextRect) {
          event.preventDefault();
          sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: true };
          try { area.focus({ preventScroll: true }); }
          catch (_) {
            try { area.focus(); } catch (__) {}
          }
          try {
            area.setSelectionRange(details.offset, details.offset);
            autoSizeTextarea(area);
            setActive(index, area, sync);
          } catch (_) {}
          return;
        }
        sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: false };
      });
      area.addEventListener('pointermove', (event) => {
        if (!sourcePointer) return;
        const dx = event.clientX - sourcePointer.x;
        const dy = event.clientY - sourcePointer.y;
        if ((dx * dx) + (dy * dy) > 16) sourcePointer.moved = true;
      });
      area.addEventListener('click', (event) => {
        const pointer = sourcePointer;
        sourcePointer = null;
        if (!pointer || pointer.moved || pointer.corrected) return;
        const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY);
        if (!details || details.insideTextRect) return;
        try {
          area.setSelectionRange(details.offset, details.offset);
          autoSizeTextarea(area);
          setActive(index, area, sync);
        } catch (_) {}
      });
      area.addEventListener('blur', () => { sourcePointer = null; });
      area.addEventListener('focus', () => {
        autoSizeTextarea(area);
        setActive(index, area, sync);
      });
      queueMicrotask(() => autoSizeTextarea(area));
      body.appendChild(area);
    }
    body.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) {
        event.stopPropagation();
        return;
      }
      setActive(index);
    });
    return body;
  };

  const renderBlockElement = (block, index) => {
    const item = document.createElement('section');
    item.className = `blocks-block blocks-block-${block.type}`;
    if (index === state.activeIndex) item.classList.add('is-active');
    item.dataset.type = block.type;
    item.dataset.blockId = block.id;
    item.tabIndex = -1;
    const head = document.createElement('div');
    head.className = 'blocks-block-head';
    const type = document.createElement('span');
    type.className = 'blocks-block-type';
    type.textContent = text(block.type, block.type);
    const actions = createBlockActionMenu(index);
    head.appendChild(type);
    head.addEventListener('wheel', forwardBlockHeadWheel, { passive: false });
    if (block.type === 'source') {
      head.appendChild(createSourceReasonHelp(block, index));
      if (canAutofixSourceBlock(block)) head.appendChild(createSourceAutofixButton(block, index));
    }
    if (block.type === 'heading') {
      head.appendChild(createHeadingLevelSelect(block));
    }
    if (block.type === 'list') {
      head.appendChild(createListTypeSelect(block));
      head.appendChild(createListIndentControls(block, index));
    }
    if (block.type === 'code') {
      head.appendChild(createCodeLanguageInput(block));
    }
    if (block.type === 'image') {
      head.appendChild(createImageMetadataControls(block, index));
    }
    if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'list') {
      head.appendChild(createInlineControls(index));
    }
    head.appendChild(actions);
    item.append(head, renderBlockBody(block, index));
    item.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) return;
      if (closestElement(event.target, '.blocks-block-head')) return;
      setActive(index);
    });
    item.addEventListener('focusin', () => setActive(index));
    return item;
  };

  const replaceAdjacentBlockElements = (index, targetIndex) => {
    const firstIndex = Math.min(index, targetIndex);
    const secondIndex = Math.max(index, targetIndex);
    const nodes = blockElements();
    const firstOld = nodes[firstIndex];
    const secondOld = nodes[secondIndex];
    if (!firstOld || !secondOld || !firstOld.parentNode || !secondOld.parentNode) return false;
    const firstNew = renderBlockElement(state.blocks[firstIndex], firstIndex);
    const secondNew = renderBlockElement(state.blocks[secondIndex], secondIndex);
    list.insertBefore(firstNew, firstOld);
    firstOld.remove();
    list.insertBefore(secondNew, secondOld);
    secondOld.remove();
    setActive(state.activeIndex);
    return true;
  };

  function render() {
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    list.innerHTML = '';
    if (!state.blocks.length) {
      const empty = document.createElement('div');
      empty.className = 'blocks-empty';
      empty.textContent = text('empty', 'No blocks yet.');
      list.appendChild(empty);
      return;
    }
    state.blocks.forEach((block, index) => {
      list.appendChild(renderBlockElement(block, index));
    });
    setActive(state.activeIndex);
    requestStickyBlockHeadUpdate();
  }

  const api = {
    setMarkdown(markdown) {
      state.blocks = parseMarkdownBlocks(markdown);
      state.activeIndex = -1;
      state.activeEditable = null;
      state.activeSync = null;
      state.activeLink = null;
      state.linkEditMode = '';
      state.linkSelection = null;
      state.pendingInline = {};
      state.lastInlineMarkedRange = null;
      render();
    },
    getMarkdown() {
      return serializeMarkdownBlocks(state.blocks);
    },
    insertImageBlock(src, alt, index = state.activeIndex + 1) {
      const block = insertBlock('image', { src, alt: alt || '', title: '' }, index);
      return { index: state.blocks.indexOf(block) };
    },
    replaceImageBlock(src, index = state.activeIndex) {
      const safeIndex = Math.max(0, Math.min(Number(index) || 0, state.blocks.length - 1));
      const block = state.blocks[safeIndex];
      if (!block || block.type !== 'image') return null;
      updateFromControl(block, { src });
      syncRenderedImageBlock(block);
      setActive(safeIndex);
      return { index: safeIndex };
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
