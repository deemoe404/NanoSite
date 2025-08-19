// Masonry layout utilities: dynamic grid row spans based on content height

// Convert a CSS length to pixels; supports px, rem, em
export function toPx(val, ctxEl) {
  const s = String(val || '').trim();
  if (!s) return 0;
  if (s.endsWith('px')) return parseFloat(s);
  if (s.endsWith('rem')) return parseFloat(s) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (s.endsWith('em')) return parseFloat(s) * parseFloat(getComputedStyle(ctxEl || document.documentElement).fontSize);
  // Fallback: try parseFloat assuming pixels
  return parseFloat(s) || 0;
}

// Simple debounce utility
export function debounce(fn, wait) {
  let t;
  return function debounced() {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, arguments), wait);
  };
}

// Compute and set the grid row span for one item
export function calcAndSetSpan(container, item, row, gapPx) {
  if (!container || !item) return;
  item.style.gridRowEnd = 'auto';
  // Measure with sub-pixel precision and always round up to avoid short spans
  const rect = item.getBoundingClientRect();
  const height = Math.max(0, rect.height || 0);
  // Include vertical margins explicitly since they're outside the box height
  const cs = getComputedStyle(item);
  const mt = parseFloat(cs.marginTop) || 0;
  const mb = parseFloat(cs.marginBottom) || 0;
  const total = height + mt + mb + gapPx; // include the grid gap once per item
  const denom = row + gapPx;
  const span = Math.max(1, Math.ceil(total / (denom > 0 ? denom : 1)));
  item.style.gridRowEnd = `span ${span}`;
}

// Apply Masonry layout to all items under a container selector
export function applyMasonry(selector = '.index') {
  try {
    const container = document.querySelector(selector);
    if (!container) return;
    const cs = getComputedStyle(container);
    const gap = toPx(cs.rowGap || cs.gap || '0', container);
    const rowStr = String(cs.gridAutoRows || '0');
    const row = toPx(rowStr, container);
    if (!row) return;
    const items = Array.from(container.querySelectorAll('a'));
    items.forEach(item => calcAndSetSpan(container, item, row, gap));
    // Re-run once images load to account for cover height
    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      if (img.complete) {
        const a = img.closest('a');
        if (a) calcAndSetSpan(container, a, row, gap);
      } else {
        img.addEventListener('load', () => {
          const a = img.closest('a');
          if (a) calcAndSetSpan(container, a, row, gap);
        }, { once: true });
      }
    });
  } catch (_) {}
}

// Recompute Masonry span for a single item when its content changes
export function updateMasonryItem(container, item) {
  try {
    if (!container || !item) return;
    const cs = getComputedStyle(container);
    const gap = toPx(cs.rowGap || cs.gap || '0', container);
    const rowStr = String(cs.gridAutoRows || '0');
    const row = toPx(rowStr, container);
    if (!row) return;
    calcAndSetSpan(container, item, row, gap);
  } catch (_) {}
}
