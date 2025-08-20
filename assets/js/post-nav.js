import { withLangParam, t } from './i18n.js';
import { escapeHtml } from './utils.js';

export function renderPostNav(container, postsIndex, postname) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return;
    const entries = Object.entries(postsIndex || {});
    const idx = entries.findIndex(([, meta]) => meta && meta.location === postname);
    const prevTuple = (idx > 0) ? entries[idx - 1] : null;
    const nextTuple = (idx >= 0 && idx < entries.length - 1) ? entries[idx + 1] : null;
    const makeNavLink = (tuple, label, cls) => {
      if (!tuple || !tuple[1] || !tuple[1].location) {
        return `<span class="${cls} disabled" aria-disabled="true"><span class="nav-label">${label}</span></span>`;
      }
      const [title, meta] = tuple;
      const href = withLangParam(`?id=${encodeURIComponent(meta.location)}`);
      const safeTitle = escapeHtml(String(title || ''));
      return `<a class="${cls}" href="${href}" aria-label="${label}: ${safeTitle}"><span class="nav-label">${label}</span><span class="nav-title">${safeTitle}</span></a>`;
    };
    const navHtml = `<nav class="post-nav" aria-label="Post navigation">${
      makeNavLink(prevTuple, t('ui.prev'), 'post-nav-prev')
    }${
      makeNavLink(nextTuple, t('ui.next'), 'post-nav-next')
    }</nav>`;
    root.insertAdjacentHTML('beforeend', navHtml);
  } catch (_) { /* silent */ }
}

