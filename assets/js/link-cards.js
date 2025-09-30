import { renderTags, escapeHtml, formatDisplayDate, cardImageSrc, fallbackCover, getContentRoot } from './utils.js';
import { extractExcerpt, computeReadTime, parseFrontMatter } from './content.js';
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

function resolveCoverSrc(meta, loc) {
  if (!meta || typeof meta !== 'object') return '';
  const rawCover = meta.thumb || meta.cover || meta.image;
  if (!rawCover || typeof rawCover !== 'string') return '';
  if (/^https?:\/\//i.test(rawCover) || rawCover.startsWith('/') || rawCover.includes('/')) {
    return rawCover;
  }
  const baseLoc = meta.location || loc || '';
  const lastSlash = String(baseLoc).lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? String(baseLoc).slice(0, lastSlash + 1) : '';
  return (baseDir + rawCover).replace(/\/+/g, '/');
}

function mergeMetaWithFrontMatter(baseMeta, frontMatter, loc) {
  const meta = (baseMeta && typeof baseMeta === 'object') ? { ...baseMeta } : {};
  const fm = (frontMatter && typeof frontMatter === 'object') ? frontMatter : {};

  if (!meta.location) meta.location = loc;

  if (fm.title && (!meta.title || meta.title === loc)) {
    meta.title = fm.title;
  }
  if (fm.excerpt && !meta.excerpt) {
    meta.excerpt = fm.excerpt;
  }
  if (fm.date && !meta.date) {
    meta.date = fm.date;
  }

  const fmTags = (() => {
    if (Array.isArray(fm.tags)) return fm.tags;
    if (Array.isArray(fm.tag)) return fm.tag;
    if (typeof fm.tags === 'string') return fm.tags.split(',');
    if (typeof fm.tag === 'string') return fm.tag.split(',');
    return null;
  })();
  if ((!meta.tag || (Array.isArray(meta.tag) && meta.tag.length === 0)) && fmTags) {
    meta.tag = fmTags;
  }

  const fmCover = fm.cover || fm.image || fm.thumb || fm.thumbnail || fm.coverImage || fm.cover_image || fm.hero || fm.banner;
  if (fmCover && !meta.cover && !meta.image && !meta.thumb) {
    meta.cover = fmCover;
  }

  if (fm.draft != null && meta.draft == null) {
    if (typeof fm.draft === 'boolean') meta.draft = fm.draft;
    else if (typeof fm.draft === 'number') meta.draft = fm.draft !== 0;
    else if (typeof fm.draft === 'string') {
      const norm = fm.draft.trim().toLowerCase();
      if (['true', 'yes', '1', 'draft'].includes(norm)) meta.draft = true;
      else if (['false', 'no', '0', 'published'].includes(norm)) meta.draft = false;
    }
  }

  return meta;
}

function buildCoverHtml(meta, loc, title, siteConfig) {
  const src = resolveCoverSrc(meta, loc);
  if (src) {
    return `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(title)}" src="${escapeHtml(cardImageSrc(src))}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`;
  }
  const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
  return useFallbackCover ? fallbackCover(title) : '';
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
    const anchors = Array.from(root.querySelectorAll('a[href]'));
    if (!anchors.length) return;

    const isWhitespaceOnlySiblings = (el) => {
      const p = el && el.parentNode;
      if (!p) return false;
      const nodes = Array.from(p.childNodes || []);
      return nodes.every(n => (n === el) || (n.nodeType === Node.TEXT_NODE && !String(n.textContent || '').trim()));
    };

    const parseInternalLink = (href) => {
      if (!href) return null;
      const trimmed = String(href).trim();
      if (!trimmed || trimmed.startsWith('#')) return null;
      if (/^(mailto:|javascript:)/i.test(trimmed)) return null;

      const startsWithQuery = trimmed.startsWith('?');
      let url;
      try {
        url = new URL(trimmed, window.location.href);
      } catch (_) {
        return null;
      }

      if (!startsWithQuery && url.origin !== window.location.origin) return null;

      const id = url.searchParams.get('id');
      if (!id) return null;

      return { id, url, startsWithQuery, originalHref: trimmed };
    };

    const buildCardHref = (loc, parsed) => {
      let baseHref = '';
      try {
        baseHref = makeHref ? makeHref(loc, parsed) : defaultMakeHref(loc);
      } catch (_) {
        baseHref = defaultMakeHref(loc);
      }
      if (baseHref == null || baseHref === false) baseHref = '';
      baseHref = String(baseHref);

      if (!parsed || !parsed.url) {
        return baseHref || defaultMakeHref(loc);
      }

      let extras = '';
      try {
        const params = new URLSearchParams(parsed.url.search || '');
        params.delete('id');
        extras = params.toString();
      } catch (_) {
        extras = '';
      }

      const originalHash = (parsed.url && parsed.url.hash) || '';
      let base = baseHref;
      let baseHash = '';
      const hashIdx = base.indexOf('#');
      if (hashIdx >= 0) {
        baseHash = base.slice(hashIdx);
        base = base.slice(0, hashIdx);
      }

      if (!base) {
        try {
          const clone = new URL(parsed.url.href);
          clone.searchParams.set('id', loc);
          if (!extras) {
            // extras already included via clone search params
          }
          if (parsed.startsWithQuery) {
            return `${clone.search || ''}${clone.hash || ''}` || defaultMakeHref(loc);
          }
          if (clone.origin === window.location.origin) {
            return `${clone.pathname}${clone.search}${clone.hash || ''}` || defaultMakeHref(loc);
          }
          return clone.href || defaultMakeHref(loc);
        } catch (_) {
          return parsed.originalHref || defaultMakeHref(loc);
        }
      }

      if (extras) {
        if (base.includes('?')) {
          base += (base.endsWith('?') || base.endsWith('&')) ? extras : `&${extras}`;
        } else {
          base += `?${extras}`;
        }
      }

      const hashToUse = baseHash || (originalHash && !baseHash ? originalHash : '');
      return `${base}${hashToUse}`;
    };

    anchors.forEach(a => {
      const parsed = parseInternalLink(a.getAttribute('href') || '');
      if (!parsed) return;
      const rawLoc = parsed.id;
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
      const href = buildCardHref(loc, parsed);
      const tagsHtml = renderTags(meta.tag);
      const dateHtml = meta && meta.date ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
      const draftHtml = meta && meta.draft ? `<span class="card-draft">${escapeHtml(translate('ui.draftBadge'))}</span>` : '';
      const cover = buildCoverHtml(meta, loc, resolvedTitle, siteConfig);

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
        const { frontMatter } = parseFrontMatter(String(md || ''));
        const mergedMeta = mergeMetaWithFrontMatter(meta, frontMatter, loc);
        const finalTitle = mergedMeta.title || resolvedTitle || loc;

        const existingCover = card.querySelector('.card-cover-wrap');
        const nextCoverHtml = buildCoverHtml(mergedMeta, loc, finalTitle, siteConfig);
        if (existingCover || nextCoverHtml) {
          if (existingCover) existingCover.remove();
          if (nextCoverHtml) {
            const temp = document.createElement('div');
            temp.innerHTML = nextCoverHtml;
            const nextCover = temp.firstElementChild;
            if (nextCover) {
              card.insertBefore(nextCover, card.firstChild);
            }
          }
        }

        const titleEl = card.querySelector('.card-title');
        if (titleEl && finalTitle) {
          titleEl.textContent = finalTitle;
        }

        const exEl = card.querySelector('.card-excerpt');
        if (exEl) {
          const preferredExcerpt = mergedMeta && mergedMeta.excerpt ? String(mergedMeta.excerpt) : ex;
          exEl.textContent = preferredExcerpt;
        }

        const metaEl = card.querySelector('.card-meta');
        if (metaEl) {
          const fragments = [];
          if (mergedMeta && mergedMeta.date) {
            const date = document.createElement('span');
            date.className = 'card-date';
            try {
              date.textContent = formatDisplayDate(mergedMeta.date);
            } catch (_) {
              date.textContent = String(mergedMeta.date);
            }
            fragments.push(date);
          }
          const read = document.createElement('span');
          read.className = 'card-read';
          read.textContent = `${minutes} ${translate('ui.minRead')}`;
          fragments.push(read);
          if (mergedMeta && mergedMeta.draft) {
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

        const nextTagsHtml = renderTags(mergedMeta && mergedMeta.tag);
        const existingTags = card.querySelector('.tags');
        if (nextTagsHtml) {
          const temp = document.createElement('div');
          temp.innerHTML = nextTagsHtml;
          const nextTags = temp.firstElementChild;
          if (nextTags) {
            if (existingTags) existingTags.replaceWith(nextTags);
            else card.appendChild(nextTags);
          }
        } else if (existingTags) {
          existingTags.remove();
        }

        hydrateCardCovers(wrapper);
      }).catch(() => {});
    });
  } catch (_) {}
}
