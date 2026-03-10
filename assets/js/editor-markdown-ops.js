export function insertImageMarkdownAtSelection(content, start, end, relativePath, altText) {
  const body = String(content == null ? '' : content);
  const safeStart = Number.isFinite(start) ? Math.max(0, Math.min(start, body.length)) : body.length;
  const safeEnd = Number.isFinite(end) ? Math.max(safeStart, Math.min(end, body.length)) : safeStart;
  const before = body.slice(0, safeStart);
  const after = body.slice(safeEnd);
  const alt = altText == null ? '' : String(altText);
  let prefix = '';
  if (before && !/\n$/.test(before)) prefix = '\n\n';
  let suffix = '';
  if (after) suffix = /^\n/.test(after) ? '' : '\n\n';
  else suffix = '\n';
  const core = `![${alt}](${relativePath})`;
  const snippet = `${prefix}${core}${suffix}`;
  const value = `${before}${snippet}${after}`;
  const altStart = before.length + prefix.length + 2;
  const altEnd = altStart + alt.length;
  const afterIndex = before.length + snippet.length;
  return { value, altStart, altEnd, afterIndex };
}

export function normalizeDateInputValue(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  const leadingDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|[Tt\s])/);
  if (leadingDateMatch) return leadingDateMatch[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return '';
  try {
    const date = new Date(parsed);
    if (Number.isNaN(date.getTime())) return '';
    return [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  } catch (_) {
    return '';
  }
}
