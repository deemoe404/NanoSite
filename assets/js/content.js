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
  const lines = String(md || '').split('\n');
  // find first heading index
  let firstH = -1, secondH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) { firstH = i; break; }
  }
  if (firstH === -1) {
    const text = stripMarkdownToText(md);
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
  const text = stripMarkdownToText(md);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / Math.max(100, Number(wpm) || 200)));
  return minutes; // caller formats e.g., `${minutes} min read`
}
