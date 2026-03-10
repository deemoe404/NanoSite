export const FRONT_MATTER_FIELD_DEFS = [
  { id: 'title', keys: ['title'], type: 'text', section: 'common', labelKey: 'editor.frontMatter.fields.title', fallbackLabel: 'Title', hintKey: 'editor.frontMatter.hints.title' },
  { id: 'excerpt', keys: ['excerpt'], type: 'textarea', section: 'common', labelKey: 'editor.frontMatter.fields.excerpt', fallbackLabel: 'Excerpt', hintKey: 'editor.frontMatter.hints.excerpt' },
  { id: 'author', keys: ['author'], type: 'text', section: 'common', labelKey: 'editor.frontMatter.fields.author', fallbackLabel: 'Author' },
  { id: 'date', keys: ['date'], type: 'date', section: 'common', labelKey: 'editor.frontMatter.fields.date', fallbackLabel: 'Date', hintKey: 'editor.frontMatter.hints.date' },
  { id: 'tags', keys: ['tags', 'tag'], type: 'list', section: 'common', labelKey: 'editor.frontMatter.fields.tags', fallbackLabel: 'Tags', hintKey: 'editor.frontMatter.hints.tags' },
  { id: 'image', keys: ['image', 'thumb', 'thumbnail', 'cover', 'coverImage', 'cover_image', 'hero', 'banner'], type: 'text', section: 'advanced', labelKey: 'editor.frontMatter.fields.image', fallbackLabel: 'Primary image', hintKey: 'editor.frontMatter.hints.image' },
  { id: 'draft', keys: ['draft', 'wip', 'unfinished', 'inprogress'], type: 'boolean', section: 'common', labelKey: 'editor.frontMatter.fields.draft', fallbackLabel: 'Draft', hintKey: 'editor.frontMatter.hints.draft' },
  { id: 'version', keys: ['version'], type: 'text', section: 'advanced', labelKey: 'editor.frontMatter.fields.version', fallbackLabel: 'Version', hintKey: 'editor.frontMatter.hints.version' },
  { id: 'ai', keys: ['ai', 'aiGenerated', 'llm'], type: 'boolean', section: 'advanced', labelKey: 'editor.frontMatter.fields.ai', fallbackLabel: 'AI generated', hintKey: 'editor.frontMatter.hints.ai' }
];

export const FRONT_MATTER_ALIAS_TO_ID = new Map();
FRONT_MATTER_FIELD_DEFS.forEach((def) => {
  def.keys.forEach((key) => {
    if (!FRONT_MATTER_ALIAS_TO_ID.has(key)) FRONT_MATTER_ALIAS_TO_ID.set(key, def.id);
  });
});

export const normalizeLineEndings = (text) => String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const cloneFrontMatterData = (source) => {
  try {
    return JSON.parse(JSON.stringify(source || {}));
  } catch (_) {
    const clone = {};
    if (source && typeof source === 'object') {
      Object.keys(source).forEach((key) => {
        clone[key] = source[key];
      });
    }
    return clone;
  }
};

export const valueIsPresent = (value) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((item) => valueIsPresent(item));
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const KEY_LINE_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;
const BOOLEAN_TRUE_RE = /^(?:true|yes|1|y|on|enabled|draft)$/i;
const BOOLEAN_FALSE_RE = /^(?:false|no|0|n|off|disabled|published)$/i;
const FRONT_MATTER_FENCE_RE = /^---\s*$/;

const stripInlineComment = (text) => {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  const raw = String(text || '');
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (!inDouble && ch === '\'') {
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === '#') break;
    out += ch;
  }
  return out.trimEnd();
};

const stripQuoteLike = (input) => {
  let out = String(input == null ? '' : input);
  const pairs = [['"', '"'], ['\'', '\''], ['“', '”'], ['‘', '’'], ['«', '»']];
  for (const [left, right] of pairs) {
    if (out.startsWith(left) && out.endsWith(right)) {
      out = out.slice(left.length, out.length - right.length);
      break;
    }
  }
  return out;
};

const parseQuotedString = (raw) => {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }
  if (text.startsWith('\'') && text.endsWith('\'')) {
    return text.slice(1, -1).replace(/''/g, '\'');
  }
  return stripQuoteLike(text);
};

const leadingIndent = (line) => {
  let count = 0;
  while (count < line.length && line[count] === ' ') count += 1;
  return count;
};

const cloneLines = (lines) => Array.isArray(lines) ? lines.slice() : [];

const arraysEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (!isSameValue(left[i], right[i])) return false;
  }
  return true;
};

const objectsEqual = (left, right) => {
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!isSameValue(left[key], right[key])) return false;
  }
  return true;
};

const isSameValue = (left, right) => {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (Array.isArray(left) || Array.isArray(right)) return arraysEqual(left, right);
  if (typeof left === 'object' || typeof right === 'object') return objectsEqual(left, right);
  return false;
};

const decodeBlockScalar = (style, bodyLines) => {
  const nonEmptyIndents = bodyLines
    .filter((line) => line.trim() !== '')
    .map((line) => leadingIndent(line));
  const baseIndent = nonEmptyIndents.length ? Math.min(...nonEmptyIndents) : 0;
  const dedented = bodyLines.map((line) => {
    if (!baseIndent) return line;
    if (!line.trim()) return '';
    return line.startsWith(' '.repeat(baseIndent)) ? line.slice(baseIndent) : line.trimStart();
  });
  if (style === '|') return dedented.join('\n');
  let result = '';
  for (let i = 0; i < dedented.length; i += 1) {
    const line = dedented[i];
    if (!line) {
      result += '\n';
      continue;
    }
    if (!result) {
      result = line;
      continue;
    }
    const previous = dedented[i - 1] || '';
    result += previous ? ` ${line}` : line;
  }
  return result;
};

const parseInlineList = (raw) => {
  const text = String(raw == null ? '' : raw).trim();
  if (!text.startsWith('[') || !text.endsWith(']')) return null;
  const inner = text.slice(1, -1).trim();
  if (!inner) return [];
  const values = [];
  let buffer = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (escaped) {
      buffer += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      buffer += ch;
      escaped = true;
      continue;
    }
    if (!inDouble && ch === '\'') {
      inSingle = !inSingle;
      buffer += ch;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      buffer += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === ',') {
      const item = parseQuotedString(buffer.trim());
      if (item) values.push(item);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  const finalItem = parseQuotedString(buffer.trim());
  if (finalItem) values.push(finalItem);
  return values;
};

const parseListItems = (bodyLines) => {
  const values = [];
  for (const rawLine of bodyLines) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const trimmed = rawLine.trimStart();
    if (!trimmed.startsWith('- ')) return null;
    const value = stripInlineComment(trimmed.slice(2));
    values.push(parseQuotedString(value));
  }
  return values;
};

const parseEntryValue = (entry, def) => {
  if (!entry || !def || !Array.isArray(entry.bodyLines) || !entry.bodyLines.length) return undefined;
  const match = KEY_LINE_RE.exec(entry.bodyLines[0]);
  if (!match) return undefined;
  const rawRest = match[2] || '';
  const rest = stripInlineComment(rawRest).trim();
  const continuation = entry.bodyLines.slice(1);
  if (/^[|>]/.test(rest)) {
    const style = rest[0] === '>' ? '>' : '|';
    return decodeBlockScalar(style, continuation);
  }
  if (def.type === 'boolean') {
    const parsedScalar = parseQuotedString(rest);
    const normalizedScalar = typeof parsedScalar === 'string' ? parsedScalar.trim() : '';
    if (typeof parsedScalar === 'boolean') return parsedScalar;
    if (BOOLEAN_TRUE_RE.test(normalizedScalar)) return true;
    if (BOOLEAN_FALSE_RE.test(normalizedScalar)) return false;
    return undefined;
  }
  if (def.type === 'list') {
    if (rest) {
      const inline = parseInlineList(rest);
      if (inline) return inline;
      const scalar = parseQuotedString(rest);
      if (!scalar) return [];
      return String(scalar)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    const items = parseListItems(continuation);
    return Array.isArray(items) ? items : undefined;
  }
  if (!rest) return undefined;
  return parseQuotedString(rest);
};

const formatYamlScalar = (value) => {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : `"${String(value)}"`;
  const str = String(value);
  if (str === '') return '""';
  const needsQuotes = /^[\s]|[\s]$/.test(str)
    || /[:#]/.test(str)
    || /^[-?](?:\s|$)/.test(str)
    || /^(?:true|false|null)$/i.test(str)
    || /^\d+(?:\.\d+)?$/.test(str)
    || str.includes('"');
  if (needsQuotes) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
};

const emitKnownEntryLines = (key, value) => {
  if (!valueIsPresent(value)) return [];
  if (Array.isArray(value)) {
    const items = value.filter((item) => valueIsPresent(item));
    if (!items.length) return [];
    const lines = [`${key}:`];
    items.forEach((item) => {
      if (typeof item === 'string' && item.includes('\n')) {
        lines.push('  - |');
        normalizeLineEndings(item).split('\n').forEach((line) => {
          lines.push(`    ${line}`);
        });
      } else {
        lines.push(`  - ${formatYamlScalar(item)}`);
      }
    });
    return lines;
  }
  if (typeof value === 'string' && value.includes('\n')) {
    const lines = [`${key}: |`];
    normalizeLineEndings(value).split('\n').forEach((line) => {
      lines.push(`  ${line}`);
    });
    return lines;
  }
  return [`${key}: ${formatYamlScalar(value)}`];
};

const buildDesiredKnownKeys = (values, bindings, fieldDefs) => {
  const present = [];
  const seen = new Set();
  const defs = fieldDefs || FRONT_MATTER_FIELD_DEFS;
  Object.keys(values || {}).forEach((key) => {
    const defId = FRONT_MATTER_ALIAS_TO_ID.get(key);
    if (!defId || seen.has(key) || !valueIsPresent(values[key])) return;
    present.push(key);
    seen.add(key);
  });
  defs.forEach((def) => {
    const key = bindings && bindings.get(def.id) ? bindings.get(def.id) : def.keys[0];
    if (!key || seen.has(key) || !valueIsPresent(values[key])) return;
    present.push(key);
    seen.add(key);
  });
  return present;
};

const isKnownStateUnchanged = (document, values) => {
  if (!document || !document.hasFrontMatter) return false;
  const knownCurrentKeys = Object.keys(values || {})
    .filter((key) => FRONT_MATTER_ALIAS_TO_ID.has(key) && valueIsPresent(values[key]));
  const knownOriginalKeys = Object.keys(document.originalKnownData || {})
    .filter((key) => FRONT_MATTER_ALIAS_TO_ID.has(key) && valueIsPresent(document.originalKnownData[key]));
  if (knownCurrentKeys.length !== knownOriginalKeys.length) return false;
  const currentSet = new Set(knownCurrentKeys);
  const originalSet = new Set(knownOriginalKeys);
  for (const key of currentSet) {
    if (!originalSet.has(key)) return false;
    if (!isSameValue(values[key], document.originalKnownData[key])) return false;
  }
  return true;
};

const collectOriginalBindings = (entries) => {
  const bindings = new Map();
  (entries || []).forEach((entry) => {
    if (!entry || !entry.isKnown) return;
    if (!bindings.has(entry.defId)) bindings.set(entry.defId, entry.key);
  });
  return bindings;
};

export function resolveFrontMatterBindings(data, document) {
  const bindings = new Map();
  const presentKeys = Object.keys(data || {});
  const presentByDef = new Map();

  presentKeys.forEach((key) => {
    const defId = FRONT_MATTER_ALIAS_TO_ID.get(key);
    if (!defId || presentByDef.has(defId)) return;
    presentByDef.set(defId, key);
  });

  if (document && document.originalBindings instanceof Map) {
    document.originalBindings.forEach((key, defId) => {
      if (key && Object.prototype.hasOwnProperty.call(data || {}, key) && valueIsPresent(data[key])) {
        bindings.set(defId, key);
      } else if (presentByDef.has(defId)) {
        bindings.set(defId, presentByDef.get(defId));
      } else {
        bindings.set(defId, key);
      }
    });
  }

  FRONT_MATTER_FIELD_DEFS.forEach((def) => {
    if (bindings.has(def.id)) return;
    if (presentByDef.has(def.id)) bindings.set(def.id, presentByDef.get(def.id));
    else bindings.set(def.id, def.keys[0]);
  });

  return bindings;
}

const parseFrontMatterEntries = (blockNormalized) => {
  const lines = blockNormalized ? blockNormalized.split('\n') : [];
  const entries = [];
  let prefixLines = [];
  let pendingLines = [];
  const isTopLevelKeyLine = (line) => !!KEY_LINE_RE.exec(line) && leadingIndent(line) === 0;
  const isTopLevelComment = (line) => leadingIndent(line) === 0 && line.trimStart().startsWith('#');
  const consumeEntry = (startIndex) => {
    const firstLine = lines[startIndex];
    const bodyLines = [firstLine];
    const match = KEY_LINE_RE.exec(firstLine);
    const rest = stripInlineComment(match && match[2] ? match[2] : '').trim();
    if (rest && !/^[|>]/.test(rest)) {
      return { bodyLines, nextIndex: startIndex + 1 };
    }
    let nextIndex = startIndex + 1;
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex];
      if (isTopLevelKeyLine(nextLine) || isTopLevelComment(nextLine)) break;
      bodyLines.push(nextLine);
      nextIndex += 1;
    }
    return { bodyLines, nextIndex };
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const match = KEY_LINE_RE.exec(line);
    const isTopLevelKey = !!match && leadingIndent(line) === 0;
    if (!isTopLevelKey) {
      pendingLines.push(line);
      index += 1;
      continue;
    }
    const consumed = consumeEntry(index);
    if (!entries.length) prefixLines = cloneLines(pendingLines);
    entries.push({
        key: match[1],
        leadingLines: cloneLines(entries.length ? pendingLines : []),
        bodyLines: cloneLines(consumed.bodyLines),
        defId: FRONT_MATTER_ALIAS_TO_ID.get(match[1]) || null,
        isKnown: FRONT_MATTER_ALIAS_TO_ID.has(match[1])
      });
    pendingLines = [];
    index = consumed.nextIndex;
  }

  const suffixLines = entries.length ? cloneLines(pendingLines) : [];
  if (!entries.length) prefixLines = cloneLines(pendingLines);
  return { prefixLines, entries, suffixLines };
};

export function parseMarkdownFrontMatter(raw, options = {}) {
  const original = String(raw == null ? '' : raw);
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = normalizeLineEndings(original);
  const trimContent = !!options.trimContent;
  const trailingNewline = normalized.endsWith('\n');
  const lines = normalized.split('\n');
  const emptyDocument = {
    hasFrontMatter: false,
    eol,
    prefixLines: [],
    entries: [],
    suffixLines: [],
    originalInner: '',
    originalFull: '',
    originalKnownData: {},
    originalBindings: new Map(),
    knownOrder: []
  };
  if (!lines.length || !FRONT_MATTER_FENCE_RE.test(lines[0])) {
    const body = trimContent ? normalized.trim() : normalized;
    return {
      hasFrontMatter: false,
      content: body,
      frontMatter: {},
      eol,
      trailingNewline,
      document: emptyDocument
    };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (FRONT_MATTER_FENCE_RE.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    const body = trimContent ? normalized.trim() : normalized;
    return {
      hasFrontMatter: false,
      content: body,
      frontMatter: {},
      eol,
      trailingNewline,
      document: emptyDocument
    };
  }

  const innerLines = lines.slice(1, endIndex);
  const bodyLines = lines.slice(endIndex + 1);
  const bodyNormalized = bodyLines.join('\n');
  const parsedEntries = parseFrontMatterEntries(innerLines.join('\n'));
  const frontMatter = {};
  parsedEntries.entries.forEach((entry) => {
    if (!entry.isKnown) return;
    const def = FRONT_MATTER_FIELD_DEFS.find((item) => item.id === entry.defId);
    if (!def) return;
    const value = parseEntryValue(entry, def);
    if (value !== undefined) frontMatter[entry.key] = value;
  });

  const originalBindings = collectOriginalBindings(parsedEntries.entries);
  const knownOrder = parsedEntries.entries
    .filter((entry) => entry && entry.isKnown)
    .map((entry) => entry.key);

  const innerOriginal = original
    .slice(original.indexOf(eol) + eol.length)
    .split(eol)
    .slice(0, innerLines.length)
    .join(eol);
  const originalFull = original
    .split(eol)
    .slice(0, endIndex + 1)
    .join(eol);

  const document = {
    hasFrontMatter: true,
    eol,
    prefixLines: parsedEntries.prefixLines,
    entries: parsedEntries.entries,
    suffixLines: parsedEntries.suffixLines,
    originalInner: innerOriginal,
    originalFull,
    originalKnownData: cloneFrontMatterData(frontMatter),
    originalBindings,
    knownOrder
  };

  return {
    hasFrontMatter: true,
    content: trimContent ? bodyNormalized.trim() : bodyNormalized,
    frontMatter,
    eol,
    trailingNewline,
    document
  };
}

export function buildMarkdownWithFrontMatter(document, bodyRaw, values, options = {}) {
  const doc = document && typeof document === 'object'
    ? document
    : {
        hasFrontMatter: false,
        eol: options.eol || '\n',
        prefixLines: [],
        entries: [],
        suffixLines: [],
        originalInner: '',
        originalFull: '',
        originalKnownData: {},
        originalBindings: new Map(),
        knownOrder: []
      };
  const eol = options.eol || doc.eol || '\n';
  const bindings = options.bindings instanceof Map ? options.bindings : new Map();
  const bodyNormalized = normalizeLineEndings(bodyRaw || '');
  const bodyOut = eol === '\n' ? bodyNormalized : bodyNormalized.split('\n').join(eol);

  if (isKnownStateUnchanged(doc, values || {})) {
    let unchanged = doc.originalFull || '';
    if (bodyOut) unchanged += `${eol}${bodyOut}`;
    const shouldEndWithNewline = bodyNormalized.endsWith('\n') || (!bodyNormalized && options.trailingNewline);
    if (shouldEndWithNewline && unchanged && !unchanged.endsWith(eol)) unchanged += eol;
    return unchanged || bodyOut;
  }

  const desiredKeys = buildDesiredKnownKeys(values || {}, bindings, FRONT_MATTER_FIELD_DEFS);
  const desiredSet = new Set(desiredKeys);
  const entryKeys = new Set();
  (doc.entries || []).forEach((entry) => {
    if (entry && entry.isKnown) entryKeys.add(entry.key);
  });
  const pendingNewKeys = desiredKeys.filter((key) => !entryKeys.has(key));
  const rankByKey = new Map();
  FRONT_MATTER_FIELD_DEFS.forEach((def, index) => {
    def.keys.forEach((key) => {
      rankByKey.set(key, index);
    });
  });

  const outputLines = cloneLines(doc.prefixLines);
  const emitted = new Set();

  const emitGeneratedBefore = (currentKnownKey) => {
    const currentRank = currentKnownKey && rankByKey.has(currentKnownKey)
      ? rankByKey.get(currentKnownKey)
      : FRONT_MATTER_FIELD_DEFS.length;
    pendingNewKeys.forEach((key) => {
      if (emitted.has(key)) return;
      const rank = rankByKey.has(key) ? rankByKey.get(key) : FRONT_MATTER_FIELD_DEFS.length;
      if (rank >= currentRank) return;
      const entryLines = emitKnownEntryLines(key, values[key]);
      if (!entryLines.length) {
        emitted.add(key);
        return;
      }
      outputLines.push(...entryLines);
      emitted.add(key);
    });
  };

  doc.entries.forEach((entry) => {
    if (!entry || !entry.isKnown) {
      if (entry) {
        outputLines.push(...cloneLines(entry.leadingLines));
        outputLines.push(...cloneLines(entry.bodyLines));
      }
      return;
    }
    emitGeneratedBefore(entry.key);
    if (!desiredSet.has(entry.key)) return;
    outputLines.push(...cloneLines(entry.leadingLines));
    const originalValue = doc.originalKnownData ? doc.originalKnownData[entry.key] : undefined;
    if (isSameValue(values[entry.key], originalValue)) {
      outputLines.push(...cloneLines(entry.bodyLines));
    } else {
      outputLines.push(...emitKnownEntryLines(entry.key, values[entry.key]));
    }
    emitted.add(entry.key);
  });

  pendingNewKeys.forEach((key) => {
    if (emitted.has(key)) return;
    outputLines.push(...emitKnownEntryLines(key, values[key]));
    emitted.add(key);
  });

  outputLines.push(...cloneLines(doc.suffixLines));
  const innerBlock = outputLines.length ? outputLines.join('\n') : '';
  let result = '';
  if (innerBlock) {
    const blockOut = eol === '\n' ? innerBlock : innerBlock.split('\n').join(eol);
    result = `---${eol}${blockOut}${eol}---`;
    if (bodyOut) result += `${eol}${bodyOut}`;
    else result += eol;
  } else {
    result = bodyOut;
  }

  const shouldEndWithNewline = bodyNormalized.endsWith('\n') || (!bodyNormalized && options.trailingNewline);
  if (shouldEndWithNewline && result && !result.endsWith(eol)) result += eol;
  return result;
}
