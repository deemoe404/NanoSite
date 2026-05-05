// DOM-related pure helpers (no side effects)
import { getThemeRegion } from './theme-regions.js';

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

// Extract the first heading text within the article region (H1/H2/H3)
export function getArticleTitleFromMain() {
  const root = getThemeRegion(['main', 'mainview'], '#mainview') || document;
  const h = root.querySelector('h1, h2, h3');
  if (!h) return null;
  const clone = h.cloneNode(true);
  const anchors = clone.querySelectorAll('a.anchor');
  anchors.forEach(a => a.remove());
  const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  return text.replace(/^#+\s*/, '').trim();
}
