// Helpers for generating excerpts/snippets from markdown
export function stripMarkdownToText(md) {
  const lines = String(md || '').split('\n');
  let text = [];
  let inCode = false, inBigCode = false;
  for (let raw of lines) {
    if (raw.startsWith('````')) { inBigCode = !inBigCode; continue; }
    if (inBigCode) continue;
    if (raw.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (raw.trim().startsWith('|')) continue; // skip tables for snippet
    if (/^\s*#+\s*/.test(raw)) continue; // skip titles entirely for snippet
    if (/^\s*>/.test(raw)) raw = raw.replace(/^\s*>\s?/, '');
  // strip list markers (unordered and ordered)
  raw = raw.replace(/^\s*[-*+]\s+/, '');
  raw = raw.replace(/^\s*\d{1,9}[\.)]\s+/, '');
    // images -> alt text
    raw = raw.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // links -> text
    raw = raw.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
    // inline code/emphasis markers
    raw = raw.replace(/`([^`]*)`/g, '$1')
             .replace(/\*\*([^*]+)\*\*/g, '$1')
             .replace(/\*([^*]+)\*/g, '$1')
             .replace(/~~([^~]+)~~/g, '$1')
             .replace(/_([^_]+)_/g, '$1');
    text.push(raw.trim());
  }
  return text.join(' ').replace(/\s+/g, ' ').trim();
}

export function limitWords(text, n) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= n) return String(text || '');
  return words.slice(0, n).join(' ') + '…';
}

export function extractExcerpt(md, wordLimit = 50) {
  // First try to extract from front matter
  const { frontMatter, content } = parseFrontMatter(md);
  
  if (frontMatter.excerpt) {
    return limitWords(frontMatter.excerpt, wordLimit);
  }
  
  // Fallback to extracting from content
  const lines = String(content || '').split('\n');
  // find first heading index
  let firstH = -1, secondH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) { firstH = i; break; }
  }
  if (firstH === -1) {
    const text = stripMarkdownToText(content);
    return limitWords(text, wordLimit);
  }
  for (let j = firstH + 1; j < lines.length; j++) {
    if (/^\s*#/.test(lines[j])) { secondH = j; break; }
  }
  const segment = lines.slice(firstH + 1, secondH === -1 ? lines.length : secondH).join('\n');
  const text = stripMarkdownToText(segment);
  return limitWords(text, wordLimit);
}

// Compute predicted read time (in whole minutes, min 1)
export function computeReadTime(md, wpm = 200) {
  // Strip front matter before computing read time
  const { content } = parseFrontMatter(md);
  const text = stripMarkdownToText(content);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / Math.max(100, Number(wpm) || 200)));
  return minutes; // caller formats e.g., `${minutes} min read`
}

// Parse YAML front matter from markdown content
export function parseFrontMatter(content) {
  const raw = String(content || '');
  // Must start with '---' on first line
  if (!/^---\s*(?:\n|\r\n)/.test(raw)) {
    return { frontMatter: {}, content: raw.trim() };
  }

  const lines = raw.split('\n');
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIndex = i; break; }
  }
  if (endIndex === -1) return { frontMatter: {}, content: raw.trim() };

  const frontMatterLines = lines.slice(1, endIndex);
  const contentLines = lines.slice(endIndex + 1);

  const fm = {};
  let currentArray = null;

  // Remove wrapping quote-like characters (ASCII and common Unicode)
  const stripQuoteLike = (s) => {
    let out = String(s || '');
    const pairs = [["\"","\""],["'","'"],["“","”"],["‘","’"],["«","»"]];
    for (const [L,R] of pairs) {
      if (out.startsWith(L) && out.endsWith(R)) { out = out.slice(L.length, out.length - R.length); break; }
    }
    return out;
  };

  for (const line0 of frontMatterLines) {
    const line = line0.replace(/\r$/, '');
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    // Array item
    if (/^-\s+/.test(t)) {
      if (currentArray) currentArray.push(stripQuoteLike(t.slice(2).trim()));
      continue;
    }
    // key: value
    const m = t.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1];
      const val = m[2];
      currentArray = null;
      if (val === '' || val == null) {
        currentArray = [];
        fm[key] = currentArray;
      } else {
        const v = stripQuoteLike(val.trim());
        if (/^(true|false)$/i.test(v)) fm[key] = /^true$/i.test(v);
        else fm[key] = v;
      }
      continue;
    }
  }

  // Fallback pass: scan block to fill missing fields
  const block = frontMatterLines.join('\n');
  const ensure = (k, get) => { if (fm[k] == null) { try { const v = get(); if (v != null) fm[k] = v; } catch(_) {} } };
  ensure('title', () => { const m = block.match(/^title\s*:\s*(.+)$/mi); return m ? stripQuoteLike(m[1].trim()) : null; });
  ensure('date', () => { const m = block.match(/^date\s*:\s*(.+)$/mi); return m ? m[1].trim() : null; });
  ensure('tags', () => {
    const m = block.match(/^tags\s*:\s*([\s\S]*?)(?:\n[A-Za-z0-9_.-]+\s*:|$)/mi);
    if (!m) return null; const part = m[1] || ''; const list = [];
    part.split(/\n/).forEach(l => { const mm = l.match(/^\s*-\s*(.+)$/); if (mm) list.push(stripQuoteLike(mm[1].trim())); });
    return list.length ? list : null;
  });

  return { frontMatter: fm, content: contentLines.join('\n').trim() };
}

// Extract content without front matter
export function stripFrontMatter(content) {
  const { content: strippedContent } = parseFrontMatter(content);
  return strippedContent;
}
