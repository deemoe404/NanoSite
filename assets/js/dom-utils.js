// DOM-related pure helpers (no side effects)

// Read-only media preference: prefers-reduced-motion
export function prefersReducedMotion() {
  try {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch (_) {
    return false;
  }
}

// Extract the first heading text within #mainview (H1/H2/H3)
export function getArticleTitleFromMain() {
  const h = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
  if (!h) return null;
  const clone = h.cloneNode(true);
  const anchors = clone.querySelectorAll('a.anchor');
  anchors.forEach(a => a.remove());
  const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  return text.replace(/^#+\s*/, '').trim();
}

