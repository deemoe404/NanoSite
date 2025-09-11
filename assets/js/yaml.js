// Minimal YAML parser for NanoSite config (subset of YAML)
// Supports:
// - Mappings: key: value and key: (nested block)
// - Sequences: - item (scalars or nested mappings)
// - Scalars: strings (quoted/unquoted), numbers, booleans, null
// - Comments (# ...) and blank lines
// Limitations: no anchors, no multiline (|, >), no complex types

function stripBom(s) { return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

function stripInlineComment(s) {
  let out = '';
  let inS = false, inD = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (!inS && ch === '"') { inD = !inD; out += ch; continue; }
    if (!inD && ch === "'") { inS = !inS; out += ch; continue; }
    if (!inS && !inD && ch === '#') break; // comment start
    out += ch;
  }
  return out.trimEnd();
}

function isBlank(line) {
  return !line || !line.trim() || line.trim().startsWith('#');
}

function indentOf(line) {
  let n = 0; for (let i = 0; i < line.length; i++) { if (line[i] === ' ') n++; else break; }
  return n;
}

function parseScalar(raw) {
  const s = stripInlineComment(String(raw).trim());
  if (s === '' || s === '~' || /^null$/i.test(s)) return null;
  if (/^true$/i.test(s)) return true;
  if (/^false$/i.test(s)) return false;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) { const n = Number(s); if (!Number.isNaN(n)) return n; }
  // Quoted strings
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const q = s[0];
    const body = s.slice(1, -1);
    if (q === '"') return body.replace(/\\([\\"ntbrf])/g, (m, c) => ({'\\': '\\', '"': '"', n: '\n', t: '\t', b: '\b', r: '\r', f: '\f'}[c] || c));
    return body; // single quotes: minimal unescape
  }
  // Try inline JSON object/array
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try { return JSON.parse(s); } catch (_) {}
  }
  return s; // plain string
}

function parseBlock(lines, start, baseIndent) {
  // Decide if this block is a sequence starting at baseIndent
  let i = start;
  while (i < lines.length && isBlank(lines[i])) i++;
  if (i < lines.length) {
    const line = lines[i];
    const ind = indentOf(line);
    if (ind === baseIndent && line.trimStart().startsWith('- ')) {
      return parseArray(lines, i, baseIndent);
    }
  }
  const obj = {};
  let i2 = start;
  let lastKey = null;
  while (i2 < lines.length) {
    let line = lines[i2];
    if (isBlank(line)) { i2++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent) break; // parent ends
    if (ind > baseIndent) {
      // Nested block for previous key
      if (lastKey == null) { /* skip stray indent */ i2++; continue; }
      const { value, next } = parseBlock(lines, i2, ind);
      obj[lastKey] = value;
      i2 = next;
      lastKey = null;
      continue;
    }
    // At baseIndent
    const trimmed = stripInlineComment(line.trim());
    if (!trimmed) { i2++; continue; }
    if (trimmed.startsWith('- ')) {
      // This level is actually a sequence not a mapping; parse and return
      const { value, next } = parseArray(lines, i2, baseIndent);
      return { value, next };
    }
    const m = /^([^:#][^:]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) { i2++; continue; }
    const key = m[1].trim();
    const rest = m[2];
    if (rest === '') {
      // Determine child type by looking ahead
      let j = i2 + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j < lines.length && indentOf(lines[j]) > baseIndent) {
        const childIndent = indentOf(lines[j]);
        const childTrim = lines[j].trimStart();
        if (childTrim.startsWith('- ')) {
          const { value, next } = parseArray(lines, j, childIndent);
          obj[key] = value; i2 = next; lastKey = null; continue;
        } else {
          const { value, next } = parseBlock(lines, j, childIndent);
          obj[key] = value; i2 = next; lastKey = null; continue;
        }
      } else {
        obj[key] = null; lastKey = null; i2++; continue;
      }
    } else {
      obj[key] = parseScalar(rest);
      lastKey = key;
      i2++;
    }
  }
  return { value: obj, next: i2 };
}

function parseArray(lines, start, baseIndent) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    let line = lines[i];
    if (isBlank(line)) { i++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent) break; // end of this array
    if (ind > baseIndent) {
      // Nested content for previous item
      const lastIdx = arr.length - 1;
      if (lastIdx >= 0 && (arr[lastIdx] === null || typeof arr[lastIdx] === 'object')) {
        const { value, next } = parseBlock(lines, i, ind);
        if (arr[lastIdx] === null) arr[lastIdx] = value;
        else if (Array.isArray(arr[lastIdx])) arr[lastIdx].push(value);
        else Object.assign(arr[lastIdx], value);
        i = next; continue;
      }
      const { value, next } = parseBlock(lines, i, ind);
      arr.push(value); i = next; continue;
    }
    // ind === baseIndent
    const t = stripInlineComment(line.trim());
    if (!t.startsWith('- ')) break; // another structure
    const rest = t.slice(2).trim();
    if (!rest) {
      // Item with nested block
      // Look ahead for nested indent
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j < lines.length && indentOf(lines[j]) > baseIndent) {
        const { value, next } = parseBlock(lines, j, indentOf(lines[j]));
        arr.push(value); i = next; continue;
      } else {
        arr.push(null); i++; continue;
      }
    }
    // Handle inline mapping like: - key: val
    if (/^[^:#][^:]*\s*:/.test(rest)) {
      const fakeLine = ' '.repeat(baseIndent + 2) + rest;
      const { value, next } = parseBlock([fakeLine, ...lines.slice(i + 1)], 0, baseIndent + 2);
      arr.push(value);
      // Adjust i to consumed lines (next excludes the injected fake line)
      i += next; continue;
    }
    // Simple scalar item
    arr.push(parseScalar(rest));
    i++;
  }
  return { value: arr, next: i };
}

export function parseYAML(text) {
  const src = stripBom(String(text || ''))
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const { value } = parseBlock(src, 0, 0);
  return value;
}

export async function fetchConfigWithYamlFallback(names) {
  const candidates = Array.isArray(names) ? names : [String(names || 'site.yaml')];
  // Try JSON first if present in candidates
  for (const name of candidates) {
    try {
      const r = await fetch(name, { cache: 'no-store' });
      if (!r.ok) continue;
      const lc = name.toLowerCase();
      if (lc.endsWith('.json')) {
        return await r.json();
      } else if (lc.endsWith('.yaml') || lc.endsWith('.yml')) {
        const text = await r.text();
        try { return parseYAML(text); } catch (_) { /* try next */ }
      }
    } catch (_) { /* try next */ }
  }
  return {};
}
