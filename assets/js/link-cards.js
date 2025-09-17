import { renderTags, escapeHtml, formatDisplayDate, cardImageSrc, fallbackCover, getContentRoot } from './utils.js';
import { extractExcerpt, computeReadTime } from './content.js';
import { hydrateCardCovers } from './post-render.js';

const DEFAULT_STRINGS = {
  'ui.loading': 'Loading…',
  'ui.minRead': 'min read',
  'ui.draftBadge': 'Draft'
};

const mdCache = new Map();

const defaultTranslate = (key) => DEFAULT_STRINGS[key] || key;
const defaultMakeHref = (loc) => `?id=${encodeURIComponent(loc)}`;
const defaultFetchMarkdown = (loc) => {
  try {
    const url = `${getContentRoot()}/${loc}`;
    return fetch(url, { cache: 'no-store' }).then(resp => (resp && resp.ok) ? resp.text() : '');
  } catch (_) {
    return Promise.resolve('');
  }
};

function resolveMetaForLocation(loc, postsIndexCache, postsByLocationTitle) {
  if (!loc) return {};
  if (postsIndexCache && typeof postsIndexCache === 'object') {
    // Fast path: location is stored directly in entries
    for (const [title, meta] of Object.entries(postsIndexCache)) {
      if (meta && meta.location === loc) return { title, meta };
      if (meta && Array.isArray(meta.versions)) {
        const hit = meta.versions.find(v => v && v.location === loc);
        if (hit) return { title, meta: { ...meta, ...hit } };
      }
    }
  }
  if (postsByLocationTitle && postsByLocationTitle[loc]) {
    const title = postsByLocationTitle[loc];
    const meta = postsIndexCache && postsIndexCache[title];
    if (meta) return { title, meta };
  }
  return { title: loc, meta: {} };
}

function ensureMarkdown(loc, fetchMarkdown) {
  if (!loc) return Promise.resolve('');
  if (!mdCache.has(loc)) {
    mdCache.set(loc, Promise.resolve(fetchMarkdown(loc)).catch(() => ''));
  }
  return mdCache.get(loc);
}

export function hydrateInternalLinkCards(container, options = {}) {
  const {
    allowedLocations = null,
    locationAliasMap = new Map(),
    postsByLocationTitle = {},
    postsIndexCache = {},
    siteConfig = {},
    fetchMarkdown = defaultFetchMarkdown,
    translate = defaultTranslate,
    makeHref = defaultMakeHref
  } = options || {};

  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const anchors = Array.from(root.querySelectorAll('a[href^="?id="]'));
    if (!anchors.length) return;

    const isWhitespaceOnlySiblings = (el) => {
      const p = el && el.parentNode;
      if (!p) return false;
      const nodes = Array.from(p.childNodes || []);
      return nodes.every(n => (n === el) || (n.nodeType === Node.TEXT_NODE && !String(n.textContent || '').trim()));
    };

    const parseId = (href) => {
      try { const u = new URL(href, window.location.href); return u.searchParams.get('id'); }
      catch (_) { return null; }
    };

    anchors.forEach(a => {
      const rawLoc = parseId(a.getAttribute('href') || '');
      if (!rawLoc) return;
      const aliased = locationAliasMap.has(rawLoc) ? locationAliasMap.get(rawLoc) : rawLoc;
      const allowSet = allowedLocations instanceof Set ? allowedLocations : null;
      if (allowSet && allowSet.size > 0) {
        if (!allowSet.has(rawLoc) && !allowSet.has(aliased)) return;
      }
      const loc = aliased;

      const parent = a.parentElement;
      const isStandalone = parent && ['P', 'LI', 'DIV'].includes(parent.tagName) && isWhitespaceOnlySiblings(a);
      const titleAttr = (a.getAttribute('title') || '').trim();
      const forceCard = /\b(card|preview)\b/i.test(titleAttr) || a.hasAttribute('data-card') || a.classList.contains('card');
      if (!isStandalone && !forceCard) return;

      const { title: resolvedTitle = loc, meta = {} } = resolveMetaForLocation(loc, postsIndexCache, postsByLocationTitle) || {};
      const href = makeHref(loc);
      const tagsHtml = renderTags(meta.tag);
      const dateHtml = meta && meta.date ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
      const draftHtml = meta && meta.draft ? `<span class="card-draft">${escapeHtml(translate('ui.draftBadge'))}</span>` : '';
      const rawCover = meta && (meta.thumb || meta.cover || meta.image);
      let coverSrc = rawCover;
      if (rawCover && typeof rawCover === 'string' && !/^https?:\/\//i.test(rawCover) && !rawCover.startsWith('/') && !rawCover.includes('/')) {
        const baseLoc = (meta && meta.location) || loc;
        const lastSlash = String(baseLoc || '').lastIndexOf('/');
        const baseDir = lastSlash >= 0 ? String(baseLoc).slice(0, lastSlash + 1) : '';
        coverSrc = (baseDir + rawCover).replace(/\/+/g, '/');
      }
      const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
      const cover = coverSrc
        ? `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(resolvedTitle)}" src="${escapeHtml(cardImageSrc(coverSrc))}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`
        : (useFallbackCover ? fallbackCover(resolvedTitle) : '');

      const wrapper = document.createElement('div');
      wrapper.className = 'link-card-wrap';
      const initialMeta = [dateHtml, draftHtml].filter(Boolean).join('<span class="card-sep">•</span>');
      wrapper.innerHTML = `<a class="link-card" href="${href}">${cover}<div class="card-title">${escapeHtml(resolvedTitle)}</div><div class="card-excerpt">${escapeHtml(translate('ui.loading'))}</div><div class="card-meta">${initialMeta}</div>${tagsHtml}</a>`;

      try {
        const exNode = wrapper.querySelector('.card-excerpt');
        if (exNode && meta && meta.excerpt) {
          exNode.textContent = String(meta.excerpt);
        }
      } catch (_) {}

      if (parent.tagName === 'LI' && isStandalone) {
        a.replaceWith(wrapper);
      } else if (isStandalone && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        const target = parent;
        target.parentNode.insertBefore(wrapper, target);
        target.remove();
      } else {
        const after = parent.nextSibling;
        parent.parentNode.insertBefore(wrapper, after);
        a.remove();
        if (!parent.textContent || !parent.textContent.trim()) {
          parent.remove();
        }
      }

      hydrateCardCovers(wrapper);

      ensureMarkdown(loc, fetchMarkdown).then(md => {
        if (!wrapper.isConnected) return;
        const ex = extractExcerpt(String(md || ''), 50);
        const minutes = computeReadTime(String(md || ''), 200);
        const card = wrapper.querySelector('a.link-card');
        if (!card) return;
        const exEl = card.querySelector('.card-excerpt');
        if (exEl && !(meta && meta.excerpt)) exEl.textContent = ex;
        const metaEl = card.querySelector('.card-meta');
        if (metaEl) {
          const fragments = [];
          const dateEl = metaEl.querySelector('.card-date');
          if (dateEl && dateEl.textContent.trim()) fragments.push(dateEl.cloneNode(true));
          const read = document.createElement('span');
          read.className = 'card-read';
          read.textContent = `${minutes} ${translate('ui.minRead')}`;
          fragments.push(read);
          if (meta && meta.draft) {
            const d = document.createElement('span');
            d.className = 'card-draft';
            d.textContent = translate('ui.draftBadge');
            fragments.push(d);
          }
          metaEl.textContent = '';
          fragments.forEach((node, idx) => {
            if (idx > 0) {
              const sep = document.createElement('span');
              sep.className = 'card-sep';
              sep.textContent = '•';
              metaEl.appendChild(sep);
            }
            metaEl.appendChild(node);
          });
        }
      }).catch(() => {});
    });
  } catch (_) {}
}
