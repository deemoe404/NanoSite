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
