import { t, withLangParam, getCurrentLang, switchLanguage } from '../../../js/i18n.js';
import {
  renderTags,
  escapeHtml,
  formatDisplayDate,
  cardImageSrc,
  fallbackCover,
  getContentRoot,
  getQueryVariable,
  sanitizeUrl,
  sanitizeImageUrl
} from '../../../js/utils.js';
import {
  applySavedTheme,
  bindThemeToggle,
  bindThemePackPicker,
  bindPostEditor,
  refreshLanguageSelector,
  getSavedThemePack
} from '../../../js/theme.js';
import { hydratePostImages, hydratePostVideos, applyLazyLoadingIn, hydrateCardCovers } from '../../../js/post-render.js';
import { renderPostMetaCard, renderOutdatedCard } from '../../../js/templates.js';
import { attachHoverTooltip, renderTagSidebar as renderDefaultTags } from '../../../js/tags.js';
import { prefersReducedMotion } from '../../../js/dom-utils.js';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;
const defaultDocument = typeof document !== 'undefined' ? document : undefined;

const CLASS_HIDDEN = 'is-hidden';

let currentSiteConfig = null;

function getScrollContainer(documentRef = defaultDocument) {
  if (!documentRef || typeof documentRef.querySelector !== 'function') return null;
  return documentRef.querySelector('.arcus-rightcol');
}

function scrollElementToTop(element, behavior) {
  if (!element) return false;
  try {
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: 0, behavior });
      return true;
    }
  } catch (_) { /* fall back to direct assignment */ }
  try {
    element.scrollTop = 0;
    return true;
  } catch (_) { /* ignore */ }
  return false;
}

function scrollViewportToTop(documentRef = defaultDocument, windowRef = defaultWindow) {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const scroller = getScrollContainer(documentRef);
  let didScroll = false;
  if (scroller && scrollElementToTop(scroller, behavior)) {
    didScroll = true;
  }
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) { /* fall through to legacy handling */ }
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo(0, 0);
      return true;
    }
  } catch (_) { /* fall through to DOM fallback */ }
  try {
    if (documentRef) {
      if (documentRef.documentElement) documentRef.documentElement.scrollTop = 0;
      if (documentRef.body) documentRef.body.scrollTop = 0;
      return true;
    }
  } catch (_) { /* no-op */ }
  return didScroll;
}

function setupDynamicBackground(documentRef = defaultDocument, windowRef = defaultWindow) {
  const root = documentRef && documentRef.querySelector ? documentRef.querySelector('.arcus-shell') : null;
  if (!root) return false;

  if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) {
    root.style.setProperty('--arcus-scroll-offset', '0px');
    root.style.setProperty('--arcus-scroll-tilt', '0deg');
    return false;
  }

  const scroller = getScrollContainer(documentRef);
  let frame = null;

  const readScrollPosition = () => {
    frame = null;
    let scrollY = 0;
    const canUseScroller = scroller && (scroller.scrollHeight - scroller.clientHeight > 1);
    if (canUseScroller) {
      scrollY = scroller.scrollTop || 0;
    } else if (windowRef && typeof windowRef.scrollY === 'number') {
      scrollY = windowRef.scrollY;
    } else if (documentRef && documentRef.documentElement) {
      scrollY = documentRef.documentElement.scrollTop || 0;
    }
    const clampedOffset = Math.max(-800, Math.min(1600, scrollY));
    const tilt = Math.max(-6, Math.min(10, clampedOffset * 0.01));
    root.style.setProperty('--arcus-scroll-offset', `${clampedOffset}px`);
    root.style.setProperty('--arcus-scroll-tilt', `${tilt}deg`);
  };

  const queueUpdate = () => {
    if (frame != null) return;
    if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
      frame = windowRef.requestAnimationFrame(readScrollPosition);
    } else if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(readScrollPosition);
    } else {
      frame = setTimeout(readScrollPosition, 16);
    }
  };

  readScrollPosition();
  queueUpdate();

  if (scroller && typeof scroller.addEventListener === 'function') {
    scroller.addEventListener('scroll', queueUpdate, { passive: true });
  }

  if (windowRef && typeof windowRef.addEventListener === 'function') {
    windowRef.addEventListener('scroll', queueUpdate, { passive: true });
    windowRef.addEventListener('resize', queueUpdate);
  }

  return true;
}

function setupBackToTop(documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef || typeof documentRef.querySelector !== 'function') return false;
  const button = documentRef.querySelector('[data-arcus-backtotop]');
  if (!button) return false;

  let frame = null;
  let lastVisible = false;

  const getMetrics = () => {
    const scroller = getScrollContainer(documentRef);
    if (scroller && scroller.scrollHeight - scroller.clientHeight > 32) {
      return {
        scroller,
        offset: scroller.scrollTop || 0,
        hasOverflow: true,
        maxScroll: Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      };
    }
    const docEl = documentRef.documentElement;
    const body = documentRef.body;
    const offset = windowRef && typeof windowRef.scrollY === 'number'
      ? windowRef.scrollY
      : (docEl && typeof docEl.scrollTop === 'number' ? docEl.scrollTop : (body ? body.scrollTop || 0 : 0));
    const viewport = windowRef && typeof windowRef.innerHeight === 'number'
      ? windowRef.innerHeight
      : (docEl ? docEl.clientHeight : 0);
    const fullHeight = docEl ? docEl.scrollHeight : (body ? body.scrollHeight : 0);
    return {
      scroller: null,
      offset,
      hasOverflow: fullHeight - viewport > 48,
      maxScroll: Math.max(0, fullHeight - viewport)
    };
  };

  const updateVisibility = () => {
    frame = null;
    const { offset, hasOverflow, maxScroll } = getMetrics();
    const available = typeof maxScroll === 'number' ? maxScroll : 0;
    const baseThreshold = available > 0 ? Math.min(320, Math.max(160, available * 0.35)) : 320;
    const reachableThreshold = available > 0 ? Math.min(baseThreshold, Math.max(56, available - 24)) : baseThreshold;
    const threshold = Math.max(56, reachableThreshold);
    const shouldShow = hasOverflow && offset > threshold;
    if (shouldShow !== lastVisible) {
      lastVisible = shouldShow;
      button.classList.toggle('is-visible', shouldShow);
      button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      button.tabIndex = shouldShow ? 0 : -1;
    }
  };

  const requestUpdate = () => {
    if (frame != null) return;
    const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    if (raf) {
      frame = raf(() => {
        frame = null;
        updateVisibility();
      });
    } else {
      frame = setTimeout(() => {
        frame = null;
        updateVisibility();
      }, 120);
    }
  };

  updateVisibility();

  const scroller = getScrollContainer(documentRef);
  if (scroller && typeof scroller.addEventListener === 'function') {
    scroller.addEventListener('scroll', requestUpdate, { passive: true });
  }
  if (windowRef && typeof windowRef.addEventListener === 'function') {
    windowRef.addEventListener('scroll', requestUpdate, { passive: true });
    windowRef.addEventListener('resize', requestUpdate);
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    scrollViewportToTop(documentRef, windowRef);
    requestUpdate();
  });

  return true;
}

function resolveCoverSource(meta = {}, siteConfig = {}) {
  const allowFallback = !(siteConfig && siteConfig.cardCoverFallback === false);
  if (!meta) return { coverSrc: '', allowFallback };

  const preferred = meta.thumb || meta.cover || meta.image;
  let coverSrc = '';
  if (typeof preferred === 'string') {
    coverSrc = preferred.trim();
  } else if (preferred && typeof preferred === 'object') {
    const maybeString = preferred.src || preferred.url || '';
    coverSrc = typeof maybeString === 'string' ? maybeString.trim() : '';
  }

  if (coverSrc) {
    const isProtocolRelative = coverSrc.startsWith('//');
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(coverSrc);
    if (!hasScheme && !isProtocolRelative && !coverSrc.startsWith('/') && !coverSrc.startsWith('#')) {
      const hasDirectorySegment = coverSrc.includes('/');
      const isDotRelative = coverSrc.startsWith('./') || coverSrc.startsWith('../');
      if (isDotRelative || !hasDirectorySegment) {
        const baseLoc = meta && meta.location ? String(meta.location) : '';
        const lastSlash = baseLoc.lastIndexOf('/');
        const baseDir = lastSlash >= 0 ? baseLoc.slice(0, lastSlash + 1) : '';
        if (isDotRelative) {
          try {
            const resolved = new URL(coverSrc, `https://example.invalid/${baseDir}`);
            coverSrc = resolved.pathname.replace(/^\/+/, '');
          } catch (_) {
            coverSrc = `${baseDir}${coverSrc}`.replace(/\/+/g, '/');
          }
        } else {
          coverSrc = `${baseDir}${coverSrc}`.replace(/\/+/g, '/');
        }
      }
    }
    const root = typeof getContentRoot === 'function' ? getContentRoot() : '';
    const normalizedRoot = String(root || '').replace(/^\/+|\/+$/g, '');
    if (normalizedRoot && coverSrc.startsWith(`${normalizedRoot}/`)) {
      coverSrc = coverSrc.slice(normalizedRoot.length + 1);
    }
    const safeSrc = sanitizeImageUrl ? sanitizeImageUrl(coverSrc) : coverSrc;
    if (safeSrc) {
      return { coverSrc: safeSrc, allowFallback };
    }
  }

  return { coverSrc: '', allowFallback };
}

function applyArcusCoverClass(markup) {
  if (!markup) return '';
  if (markup.includes('arcus-card__cover')) return markup;
  if (markup.includes('card-cover-wrap')) {
    return markup.replace('card-cover-wrap', 'card-cover-wrap arcus-card__cover');
  }
  return `<div class="arcus-card__cover">${markup}</div>`;
}

function normalizeCoverUrl(coverSrc) {
  if (!coverSrc) return '';
  if (/^(?:https?:|data:|blob:)/i.test(coverSrc)) return coverSrc;
  return cardImageSrc(coverSrc);
}

function renderCardCover(meta, title, siteConfig) {
  const heading = typeof title === 'string' ? title : '';
  const { coverSrc, allowFallback } = resolveCoverSource(meta, siteConfig);
  if (coverSrc) {
    const resolved = normalizeCoverUrl(coverSrc);
    if (resolved) {
      const alt = meta && meta.coverAlt ? meta.coverAlt : heading;
      return `<div class="arcus-card__cover card-cover-wrap"><span class="ph-skeleton" aria-hidden="true"></span><img class="card-cover" src="${escapeHtml(resolved)}" alt="${escapeHtml(String(alt || ''))}" loading="lazy" decoding="async" fetchpriority="low" /></div>`;
    }
  }
  if (allowFallback) {
    const fallback = fallbackCover(heading);
    return applyArcusCoverClass(fallback);
  }
  return '';
}

function renderHeroImage(meta, title, siteConfig) {
  const heading = typeof title === 'string' ? title : '';
  const { coverSrc } = resolveCoverSource(meta, siteConfig);
  if (!coverSrc) return '';
  const resolved = normalizeCoverUrl(coverSrc);
  if (!resolved) return '';
  const alt = meta && meta.coverAlt ? meta.coverAlt : heading;
  return `<div class="arcus-article__hero"><img src="${escapeHtml(resolved)}" alt="${escapeHtml(String(alt || ''))}" loading="lazy" decoding="async" /></div>`;
}

function localized(cfg, key) {
  if (!cfg) return '';
  const val = cfg[key];
  if (!val) return '';
  if (typeof val === 'string') return val;
  const lang = getCurrentLang && getCurrentLang();
  if (lang && val[lang]) return val[lang];
  return val.default || '';
}

function getRoleElement(role, documentRef = defaultDocument) {
  if (!documentRef) return null;
  switch (role) {
    case 'main':
      return documentRef.getElementById('mainview');
    case 'toc':
      return documentRef.getElementById('tocview');
    case 'sidebar':
      return documentRef.getElementById('tagview');
    case 'content':
      return documentRef.querySelector('.arcus-main');
    case 'container':
      return documentRef.querySelector('.arcus-shell');
    default:
      return null;
  }
}

function fadeIn(element) {
  if (!element) return;
  element.classList.remove(CLASS_HIDDEN);
  element.hidden = false;
  element.style.removeProperty('display');
  requestAnimationFrame(() => {
    element.classList.add('is-visible');
  });
}

function fadeOut(element, onDone) {
  if (!element) { if (typeof onDone === 'function') onDone(); return; }
  element.classList.remove('is-visible');
  const finish = () => {
    element.classList.add(CLASS_HIDDEN);
    element.hidden = true;
    if (typeof onDone === 'function') onDone();
  };
  if (prefersReducedMotion()) {
    finish();
  } else {
    element.addEventListener('transitionend', finish, { once: true });
    const timer = setTimeout(finish, 320);
    element.addEventListener('transitioncancel', () => clearTimeout(timer), { once: true });
  }
}

function buildCard({ title, meta, translate, link, siteConfig }) {
  const safeTitle = escapeHtml(String(title || 'Untitled'));
  const excerpt = meta && meta.excerpt ? escapeHtml(String(meta.excerpt)) : '';
  const date = meta && meta.date ? formatDisplayDate(meta.date) : '';
  const tags = meta ? renderTags(meta.tag) : '';
  const coverHtml = renderCardCover(meta, title, siteConfig);
  const hasCover = Boolean(coverHtml);
  const cardClasses = `arcus-card${hasCover ? ' arcus-card--with-cover' : ''}`;
  const metaLine = () => {
    if (!date && !tags) return '';
    let html = '<div class="arcus-card__meta-line">';
    if (date) html += `<span class="arcus-card__meta-date">${escapeHtml(date)}</span>`;
    if (date && tags) html += '<span class="arcus-card__meta-separator" aria-hidden="true">·</span>';
    if (tags) html += `<div class="arcus-card__tags">${tags}</div>`;
    html += '</div>';
    return html;
  };
  return `<article class="${cardClasses}">
    <a class="arcus-card__link" href="${escapeHtml(link)}">
      ${coverHtml}
      <div class="arcus-card__body">
        ${metaLine()}
        <h3 class="arcus-card__title">${safeTitle}</h3>
        ${excerpt ? `<p class="arcus-card__excerpt"><span class="arcus-card__excerpt-tilt">${excerpt}</span></p>` : ''}
      </div>
    </a>
  </article>`;
}

function ensureArcusExcerptNode(card, documentRef = defaultDocument) {
  if (!card || !documentRef) return null;
  let excerptEl = card.querySelector('.arcus-card__excerpt');
  if (!excerptEl) {
    const body = card.querySelector('.arcus-card__body');
    if (!body) return null;
    excerptEl = documentRef.createElement('p');
    excerptEl.className = 'arcus-card__excerpt';
    const span = documentRef.createElement('span');
    span.className = 'arcus-card__excerpt-tilt';
    excerptEl.appendChild(span);
    body.appendChild(excerptEl);
  }
  return excerptEl.querySelector('.arcus-card__excerpt-tilt') || excerptEl;
}

function hydrateArcusCardExcerpts(entries = [], context = {}) {
  const documentRef = context.document || defaultDocument;
  if (!documentRef) return;
  const root = context.container || documentRef;
  const cards = Array.from(root.querySelectorAll('.arcus-card'));
  const getFile = typeof context.getFile === 'function' ? context.getFile : null;
  const getContentRoot = typeof context.getContentRoot === 'function' ? context.getContentRoot : null;
  const extractExcerpt = typeof context.extractExcerpt === 'function' ? context.extractExcerpt : null;

  entries.forEach(([title, meta], idx) => {
    const card = cards[idx];
    if (!card) return;
    const preset = meta && meta.excerpt ? String(meta.excerpt) : '';
    if (preset) {
      const node = ensureArcusExcerptNode(card, documentRef);
      if (node) node.textContent = preset;
      card.dataset.arcusExcerptHydrated = '1';
      return;
    }

    if (card.dataset.arcusExcerptHydrated === 'pending' || card.dataset.arcusExcerptHydrated === '1') return;

    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc || !getFile || !getContentRoot || !extractExcerpt) return;

    card.dataset.arcusExcerptHydrated = 'pending';
    getFile(`${getContentRoot()}/${loc}`).then(md => {
      const text = String(extractExcerpt(md, 50) || '').trim();
      if (!text) { delete card.dataset.arcusExcerptHydrated; return; }
      const node = ensureArcusExcerptNode(card, documentRef);
      if (node) {
        node.textContent = text;
        card.dataset.arcusExcerptHydrated = '1';
      } else {
        delete card.dataset.arcusExcerptHydrated;
      }
    }).catch(() => {
      delete card.dataset.arcusExcerptHydrated;
    });
  });
}

function buildPagination({ page, totalPages, baseHref, query }) {
  if (!totalPages || totalPages <= 1) return '';
  const mkHref = (p) => {
    try {
      const url = new URL(baseHref, defaultWindow ? defaultWindow.location.href : (typeof location !== 'undefined' ? location.href : ''));
      url.searchParams.set('page', p);
      if (query && query.q) {
        if (query.q) url.searchParams.set('q', query.q);
        else url.searchParams.delete('q');
      }
      if (query && query.tag) {
        if (query.tag) url.searchParams.set('tag', query.tag);
        else url.searchParams.delete('tag');
      }
      return url.toString();
    } catch (_) {
      return baseHref;
    }
  };
  const items = [];
  for (let i = 1; i <= totalPages; i++) {
    const href = mkHref(i);
    items.push(`<a class="arcus-page${i === page ? ' is-current' : ''}" href="${escapeHtml(href)}">${i}</a>`);
  }
  const prevHref = page > 1 ? mkHref(page - 1) : '';
  const nextHref = page < totalPages ? mkHref(page + 1) : '';
  return `<nav class="arcus-pagination" aria-label="${t('ui.pagination')}">
    <a class="arcus-page prev${prevHref ? '' : ' is-disabled'}" href="${prevHref ? escapeHtml(prevHref) : '#'}" ${prevHref ? '' : 'aria-disabled="true"'}>${t('ui.prev')}</a>
    <div class="arcus-page__list">${items.join('')}</div>
    <a class="arcus-page next${nextHref ? '' : ' is-disabled'}" href="${nextHref ? escapeHtml(nextHref) : '#'}" ${nextHref ? '' : 'aria-disabled="true"'}>${t('ui.next')}</a>
  </nav>`;
}

function decorateArticle(container, translate, utilities, markdown, meta, title) {
  if (!container) return;
  const copyBtn = container.querySelector('.post-meta-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const loc = defaultWindow && defaultWindow.location ? defaultWindow.location.href : (typeof location !== 'undefined' ? location.href : '');
      const href = String(loc || '').split('#')[0];
      let ok = false;
      try {
        const nav = defaultWindow && defaultWindow.navigator;
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
          await nav.clipboard.writeText(href);
          ok = true;
        }
      } catch (_) {}
      if (!ok && defaultDocument && defaultDocument.execCommand) {
        const tmp = defaultDocument.createElement('textarea');
        tmp.value = href;
        defaultDocument.body.appendChild(tmp);
        tmp.select();
        ok = defaultDocument.execCommand('copy');
        defaultDocument.body.removeChild(tmp);
      }
      if (ok) {
        copyBtn.classList.add('copied');
        copyBtn.setAttribute('data-status', 'copied');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.removeAttribute('data-status');
        }, 1200);
      }
    });
  }

  const versionSelect = container.querySelector('.post-version-select');
  if (versionSelect) {
    versionSelect.addEventListener('change', () => {
      const target = versionSelect.value;
      if (!target) return;
      const href = withLangParam(`?id=${encodeURIComponent(target)}`);
      if (defaultWindow) {
        defaultWindow.location.href = href;
      } else {
        location.href = href; // eslint-disable-line no-restricted-globals
      }
    });
  }

  const outdated = container.querySelector('.post-outdated-card');
  if (outdated) {
    const close = outdated.querySelector('.post-outdated-close');
    if (close) close.addEventListener('click', () => outdated.remove());
  }

  try {
    const aiFlags = Array.from(container.querySelectorAll('.ai-flag'));
    aiFlags.forEach(flag => attachHoverTooltip(flag, () => translate('ui.aiFlagTooltip'), { delay: 0 }));
  } catch (_) {}

  try {
    if (typeof utilities.hydratePostImages === 'function') utilities.hydratePostImages(container);
    if (typeof utilities.hydratePostVideos === 'function') utilities.hydratePostVideos(container);
    if (typeof utilities.applyLazyLoadingIn === 'function') utilities.applyLazyLoadingIn(container);
  } catch (_) {}
}

const NAV_OVERFLOW_NONE = 'none';
const NAV_OVERFLOW_START = 'start';
const NAV_OVERFLOW_END = 'end';
const NAV_OVERFLOW_BOTH = 'both';

function getNavScroller(nav) {
  if (!nav || typeof nav.closest !== 'function') return null;
  return nav.closest('.arcus-nav__scroller');
}

function computeNavOverflowState(nav) {
  if (!nav) return NAV_OVERFLOW_NONE;
  const maxScroll = (nav.scrollHeight || 0) - (nav.clientHeight || 0);
  if (maxScroll <= 1) return NAV_OVERFLOW_NONE;
  const top = nav.scrollTop <= 1;
  const bottom = nav.scrollTop >= maxScroll - 1;
  if (top && bottom) return NAV_OVERFLOW_NONE;
  if (top) return NAV_OVERFLOW_END;
  if (bottom) return NAV_OVERFLOW_START;
  return NAV_OVERFLOW_BOTH;
}

function updateNavOverflowState(nav, scroller) {
  if (!nav) return;
  const target = scroller || getNavScroller(nav);
  if (!target) return;
  const state = computeNavOverflowState(nav);
  target.setAttribute('data-overflow', state);
}

function observeNavOverflow(nav, windowRef = defaultWindow) {
  if (!nav) return;
  if (typeof nav.__arcusOverflowCleanup === 'function') {
    try { nav.__arcusOverflowCleanup(); } catch (_) { /* ignore */ }
  }
  const scroller = getNavScroller(nav);
  if (!scroller) return;
  const update = () => updateNavOverflowState(nav, scroller);
  const onScroll = () => update();
  nav.addEventListener('scroll', onScroll, { passive: true });
  const ResizeObserverCtor = windowRef && typeof windowRef.ResizeObserver === 'function'
    ? windowRef.ResizeObserver
    : (typeof ResizeObserver === 'function' ? ResizeObserver : undefined);
  let resizeObserver;
  let resizeHandler;
  if (typeof ResizeObserverCtor === 'function') {
    try {
      resizeObserver = new ResizeObserverCtor(() => update());
      resizeObserver.observe(nav);
    } catch (_) {
      resizeObserver = undefined;
    }
  }
  if (!resizeObserver && windowRef && typeof windowRef.addEventListener === 'function') {
    resizeHandler = () => update();
    windowRef.addEventListener('resize', resizeHandler);
  }
  update();
  if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
    windowRef.requestAnimationFrame(update);
  } else if (typeof setTimeout === 'function') {
    setTimeout(update, 0);
  }
  nav.__arcusOverflowCleanup = () => {
    nav.removeEventListener('scroll', onScroll);
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') {
      resizeObserver.disconnect();
    }
    if (resizeHandler && windowRef && typeof windowRef.removeEventListener === 'function') {
      windowRef.removeEventListener('resize', resizeHandler);
    }
    delete nav.__arcusOverflowCleanup;
  };
}

function renderNavLinks(nav, tabsBySlug, activeSlug, postsEnabled, getHomeSlug) {
  if (!nav) return;
  const items = [];
  const homeSlug = typeof getHomeSlug === 'function' ? getHomeSlug() : 'posts';
  if (postsEnabled()) {
    items.push({ slug: 'posts', label: t('ui.allPosts'), href: withLangParam('?tab=posts') });
  }
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    const label = info && info.title ? String(info.title) : slug;
    items.push({ slug, label, href: withLangParam(`?tab=${encodeURIComponent(slug)}`) });
  });
  nav.innerHTML = items.map(item => `<a class="arcus-nav__item${item.slug === activeSlug ? ' is-current' : ''}" data-tab="${escapeHtml(item.slug)}" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('');
  nav.setAttribute('data-active', activeSlug || homeSlug);
  observeNavOverflow(nav);
}

function renderFooterLinks(root, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel) {
  if (!root) return;
  const links = [];
  const homeSlug = getHomeSlug();
  const homeLabel = getHomeLabel();
  links.push({ href: withLangParam(`?tab=${encodeURIComponent(homeSlug)}`), label: homeLabel });
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    const label = info && info.title ? String(info.title) : slug;
    links.push({ href: withLangParam(`?tab=${encodeURIComponent(slug)}`), label });
  });
  links.push({ href: withLangParam('?tab=search'), label: t('ui.searchTab') });
  root.innerHTML = `<ul class="arcus-footer__list">${links.map(link => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>`;
}

function renderLinksList(root, cfg) {
  if (!root) return;
  const list = Array.isArray(cfg && cfg.profileLinks) ? cfg.profileLinks : [];
  if (!list.length) {
    root.innerHTML = `<li class="arcus-linklist__empty">${t('editor.site.noLinks')}</li>`;
    return;
  }
  root.innerHTML = list.map(item => {
    if (!item || !item.href) return '';
    const label = item.label || item.href;
    const href = sanitizeUrl(String(item.href));
    if (!href) return '';
    return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`;
  }).join('');
}

function updateSearchPlaceholder(documentRef = defaultDocument) {
  const input = documentRef ? documentRef.getElementById('searchInput') : null;
  if (!input) return;
  input.setAttribute('placeholder', t('sidebar.searchPlaceholder'));
}

function sanitizePackValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function prettifyPackLabel(value, label) {
  if (label && String(label).trim()) return String(label).trim();
  if (!value) return '';
  return value.replace(/[-_]+/g, ' ').replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}

function populateThemePackOptions(documentRef = defaultDocument, windowRef = defaultWindow) {
  const select = documentRef ? documentRef.getElementById('themePack') : null;
  if (!select || !documentRef) return false;

  const fallbackOptions = [
    { value: 'native', label: 'Native' },
    { value: 'solstice', label: 'Solstice' },
    { value: 'arcus', label: 'Arcus' }
  ];

  const seen = new Set();

  const appendOption = (value, label) => {
    const sanitized = sanitizePackValue(value);
    if (!sanitized || seen.has(sanitized)) return;
    const option = documentRef.createElement('option');
    option.value = sanitized;
    option.textContent = prettifyPackLabel(sanitized, label);
    select.appendChild(option);
    seen.add(sanitized);
  };

  const ensureSavedOptionVisible = () => {
    let saved = '';
    try {
      saved = getSavedThemePack ? getSavedThemePack() : '';
    } catch (_) {
      saved = '';
    }
    const normalized = sanitizePackValue(saved) || (select.options[0] ? select.options[0].value : '');
    if (normalized && !Array.from(select.options).some(opt => opt.value === normalized)) {
      appendOption(normalized, null);
    }
    if (normalized) {
      select.value = normalized;
    } else if (select.options.length) {
      select.selectedIndex = 0;
    }
  };

  const applyOptions = (options) => {
    select.innerHTML = '';
    seen.clear();
    (options || []).forEach(item => {
      if (!item) return;
      const sourceValue = item.value != null ? item.value : (item.slug != null ? item.slug : item.name);
      appendOption(sourceValue, item.label);
    });
    if (!select.options.length) {
      fallbackOptions.forEach(item => appendOption(item.value, item.label));
    }
  };

  const fetcher = (windowRef && typeof windowRef.fetch === 'function')
    ? windowRef.fetch.bind(windowRef)
    : (typeof fetch === 'function' ? fetch : null);

  if (!fetcher) {
    applyOptions(fallbackOptions);
    ensureSavedOptionVisible();
    return true;
  }

  try {
    fetcher('assets/themes/packs.json')
      .then(response => {
        if (!response || !response.ok) throw new Error('packs.json fetch failed');
        return response.json();
      })
      .then(list => {
        if (Array.isArray(list) && list.length) {
          applyOptions(list);
        } else {
          applyOptions(fallbackOptions);
        }
      })
      .catch(() => {
        applyOptions(fallbackOptions);
      })
      .finally(() => {
        ensureSavedOptionVisible();
      });
  } catch (_) {
    applyOptions(fallbackOptions);
    ensureSavedOptionVisible();
  }

  return true;
}

function setupToolsPanel(documentRef = defaultDocument, windowRef = defaultWindow) {
  const panel = documentRef && documentRef.getElementById('toolsPanel');
  if (!panel) return false;
  panel.innerHTML = `
    <div class="arcus-tools__groups" id="tools">
      <div class="arcus-tools__group" role="group" data-group="theme" aria-label="${t('tools.toggleTheme')} & ${t('tools.themePack')}">
        <button id="themeToggle" class="arcus-tool" type="button" aria-label="${t('tools.toggleTheme')}">
          <span class="arcus-tool__icon">🌓</span>
          <span class="arcus-tool__label">${t('tools.toggleTheme')}</span>
        </button>
        <label class="arcus-tool arcus-tool--select" for="themePack">
          <span class="arcus-tool__label">${t('tools.themePack')}</span>
          <select id="themePack"></select>
        </label>
      </div>
      <div class="arcus-tools__group" role="group" data-group="language" aria-label="${t('tools.language')} & ${t('tools.resetLanguage')}">
        <label class="arcus-tool arcus-tool--select" for="langSelect">
          <span class="arcus-tool__label">${t('tools.language')}</span>
          <select id="langSelect"></select>
        </label>
        <button id="langReset" class="arcus-tool" type="button" aria-label="${t('tools.resetLanguage')}">
          <span class="arcus-tool__icon">♻️</span>
          <span class="arcus-tool__label">${t('tools.resetLanguage')}</span>
        </button>
      </div>
      <div class="arcus-tools__group arcus-tools__group--solo" role="group" data-group="editor" aria-label="${t('tools.postEditor')}">
        <button id="postEditor" class="arcus-tool" type="button" aria-label="${t('tools.postEditor')}">
          <span class="arcus-tool__icon">📝</span>
          <span class="arcus-tool__label">${t('tools.postEditor')}</span>
        </button>
      </div>
    </div>`;
  try { applySavedTheme(); } catch (_) {}
  try { bindThemeToggle(); } catch (_) {}
  try { bindPostEditor(); } catch (_) {}
  try { populateThemePackOptions(documentRef, windowRef); } catch (_) {}
  try { bindThemePackPicker(); } catch (_) {}
  try { refreshLanguageSelector(); } catch (_) {}
  try {
    const langSel = documentRef.getElementById('langSelect');
    if (langSel) {
      langSel.addEventListener('change', () => {
        const val = langSel.value || 'en';
        switchLanguage(val);
      });
    }
    const reset = documentRef.getElementById('langReset');
    if (reset) {
      reset.addEventListener('click', () => {
        try { localStorage.removeItem('lang'); } catch (_) {}
        try {
          const url = new URL(windowRef ? windowRef.location.href : window.location.href);
          url.searchParams.delete('lang');
          if (windowRef && windowRef.history && windowRef.history.replaceState) {
            windowRef.history.replaceState(windowRef.history.state, documentRef.title, url.toString());
          }
        } catch (_) {}
        try {
          if (windowRef && windowRef.__ns_softResetLang) {
            windowRef.__ns_softResetLang();
            return;
          }
        } catch (_) {}
        try {
          if (windowRef && windowRef.location) {
            windowRef.location.reload();
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
  return true;
}

function resetToolsPanel(documentRef = defaultDocument, windowRef = defaultWindow) {
  const panel = documentRef && documentRef.getElementById('toolsPanel');
  if (!panel) return false;
  panel.innerHTML = '';
  return setupToolsPanel(documentRef, windowRef);
}

function enhanceArcusTocDock(tocEl) {
  if (!tocEl || !tocEl.classList || !tocEl.classList.contains('arcus-toc')) return null;

  const docRef = tocEl.ownerDocument || defaultDocument;
  const winRef = docRef ? (docRef.defaultView || defaultWindow) : defaultWindow;

  const srContainer = tocEl.querySelector('.arcus-toc__inner');
  if (!srContainer) return null;

  srContainer.classList.add('arcus-toc__inner--sr');
  srContainer.setAttribute('aria-hidden', 'true');

  const anchors = Array.from(srContainer.querySelectorAll('a[href^="#"]:not(.toc-anchor):not(.toc-top)'));
  if (!anchors.length) return null;

  const dock = docRef.createElement('nav');
  dock.className = 'arcus-toc-dock';
  dock.setAttribute('role', 'navigation');

  const titleEl = srContainer.querySelector('.arcus-toc__title');
  const dockLabel = titleEl && titleEl.textContent ? titleEl.textContent.trim() : '';
  if (dockLabel) {
    dock.setAttribute('aria-label', dockLabel);
  } else {
    dock.setAttribute('aria-label', t('ui.tableOfContents'));
  }

  dock.setAttribute('data-arcus-toc-dock', '');

  const list = docRef.createElement('ol');
  list.className = 'arcus-toc-dock__list';
  dock.appendChild(list);

  const host = docRef && docRef.body ? docRef.body : tocEl;
  host.appendChild(dock);

  const items = anchors.map((anchor, index) => {
    const labelText = anchor.textContent ? anchor.textContent.trim() : '';
    const item = docRef.createElement('li');
    item.className = 'arcus-toc-dock__item';
    item.dataset.index = String(index);

    const dot = docRef.createElement('a');
    dot.className = 'arcus-toc-dock__dot';
    dot.href = anchor.getAttribute('href') || '#';
    dot.dataset.index = String(index);
    dot.setAttribute('role', 'link');
    if (labelText) {
      dot.setAttribute('aria-label', labelText);
      dot.title = labelText;
    } else {
      dot.setAttribute('aria-label', t('ui.tableOfContents'));
    }

    const label = docRef.createElement('span');
    label.className = 'arcus-toc-dock__label';
    label.textContent = labelText;

    item.appendChild(dot);
    item.appendChild(label);
    list.appendChild(item);

    const handleClick = (event) => {
      event.preventDefault();
      scrollToHeading(index);
    };

    const handleEnter = () => setHover(index);
    const handleLeave = () => {
      if (!dock.matches(':hover')) clearHover();
    };

    dot.addEventListener('click', handleClick);
    dot.addEventListener('mouseenter', handleEnter);
    dot.addEventListener('focus', handleEnter);
    dot.addEventListener('mouseleave', clearHover);
    dot.addEventListener('blur', handleLeave);

    return {
      anchor,
      item,
      dot,
      cleanup() {
        dot.removeEventListener('click', handleClick);
        dot.removeEventListener('mouseenter', handleEnter);
        dot.removeEventListener('focus', handleEnter);
        dot.removeEventListener('mouseleave', clearHover);
        dot.removeEventListener('blur', handleLeave);
      }
    };
  });

  const setHover = (index) => {
    items.forEach(({ item }, idx) => {
      item.classList.toggle('is-hover', idx === index);
      item.classList.toggle('is-near', idx === index - 1 || idx === index + 1);
    });
  };

  function clearHover() {
    items.forEach(({ item }) => {
      item.classList.remove('is-hover');
      item.classList.remove('is-near');
    });
  }

  dock.addEventListener('mouseleave', clearHover);

  const headings = items.map(({ anchor }) => {
    const href = anchor.getAttribute('href') || '';
    if (!href.startsWith('#')) return null;
    const id = href.slice(1);
    return id ? docRef.getElementById(id) : null;
  });

  function scrollToHeading(index) {
    if (index == null || index < 0 || index >= headings.length) return false;
    const target = headings[index];
    if (!target) return false;

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const scrollIntoViewOptions = { behavior, block: 'start', inline: 'nearest' };
    let scrolled = false;

    try {
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView(scrollIntoViewOptions);
        scrolled = true;
      }
    } catch (_) { /* ignore */ }

    if (!scrolled) {
      const rect = target.getBoundingClientRect();
      const absoluteTop = rect.top + getScrollTop();
      if (scroller && typeof scroller.scrollTo === 'function') {
        try {
          scroller.scrollTo({ top: absoluteTop, behavior });
          scrolled = true;
        } catch (_) { /* ignore */ }
      }
      if (!scrolled && winRef && typeof winRef.scrollTo === 'function') {
        try {
          winRef.scrollTo({ top: absoluteTop, behavior });
          scrolled = true;
        } catch (_) { /* ignore */ }
      }
      if (!scrolled) {
        try { target.scrollIntoView(); } catch (_) {}
      }
    }

    const id = target.getAttribute('id');
    if (!id) return scrolled;
    const hash = `#${id}`;
    try {
      if (winRef && winRef.history && typeof winRef.history.replaceState === 'function') {
        const loc = winRef.location;
        const base = loc ? `${loc.pathname || ''}${loc.search || ''}` : '';
        winRef.history.replaceState(null, '', `${base}${hash}`);
      } else if (winRef && winRef.location) {
        winRef.location.hash = id;
      } else if (docRef && docRef.location) {
        docRef.location.hash = id;
      }
    } catch (_) { /* ignore */ }
    return scrolled;
  }

  const scroller = docRef ? docRef.querySelector('.arcus-rightcol') : null;

  const alignDockToViewport = () => {
    if (!dock || !dock.style) return;
    const visualViewport = winRef && winRef.visualViewport;
    if (visualViewport) {
      const midpoint = (visualViewport.offsetTop || 0) + visualViewport.height / 2;
      dock.style.setProperty('--arcus-toc-dock-top', `${midpoint}px`);
    } else if (winRef && typeof winRef.innerHeight === 'number') {
      dock.style.setProperty('--arcus-toc-dock-top', `${winRef.innerHeight / 2}px`);
    } else {
      const viewportHeight = getViewportHeight();
      if (viewportHeight) {
        dock.style.setProperty('--arcus-toc-dock-top', `${viewportHeight / 2}px`);
      }
    }
  };

  const getScrollTop = () => {
    if (scroller) return scroller.scrollTop || 0;
    if (winRef && typeof winRef.scrollY === 'number') return winRef.scrollY;
    const docEl = docRef && docRef.documentElement;
    const body = docRef && docRef.body;
    return (docEl && docEl.scrollTop) || (body && body.scrollTop) || 0;
  };

  const getViewportHeight = () => {
    if (scroller) return scroller.clientHeight || 0;
    if (winRef && typeof winRef.innerHeight === 'number') return winRef.innerHeight;
    const docEl = docRef && docRef.documentElement;
    return (docEl && docEl.clientHeight) || 0;
  };

  let positions = [];

  const computePositions = () => {
    const scrollTop = getScrollTop();
    positions = headings.map((node) => {
      if (!node) return Number.POSITIVE_INFINITY;
      const rect = node.getBoundingClientRect();
      return rect.top + scrollTop;
    });
  };

  let currentIndex = -1;

  const updateCurrent = () => {
    if (!positions.length) return;
    const offset = getScrollTop() + Math.max(120, Math.min(getViewportHeight() * 0.4, 320));
    const available = positions
      .map((pos, idx) => ({ pos, idx }))
      .filter(({ pos }) => Number.isFinite(pos));
    if (!available.length) {
      if (currentIndex !== -1) {
        currentIndex = -1;
        items.forEach(({ item }) => item.classList.remove('is-current'));
      }
      return;
    }
    let nextIndex = available[0].idx;
    for (let i = 0; i < available.length; i += 1) {
      if (available[i].pos <= offset) {
        nextIndex = available[i].idx;
      } else {
        break;
      }
    }
    if (nextIndex === currentIndex) return;
    currentIndex = nextIndex;
    items.forEach(({ item }, idx) => {
      item.classList.toggle('is-current', idx === currentIndex);
    });
  };

  let pendingFrame = null;
  let frameIsTimeout = false;

  const scheduleUpdate = () => {
    if (pendingFrame != null) return;
    const raf = winRef && typeof winRef.requestAnimationFrame === 'function'
      ? winRef.requestAnimationFrame.bind(winRef)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    if (raf) {
      frameIsTimeout = false;
      pendingFrame = raf(() => {
        pendingFrame = null;
        updateCurrent();
      });
    } else {
      frameIsTimeout = true;
      pendingFrame = setTimeout(() => {
        pendingFrame = null;
        updateCurrent();
      }, 16);
    }
  };

  const handleScroll = () => {
    scheduleUpdate();
  };

  const handleResize = () => {
    computePositions();
    updateCurrent();
    alignDockToViewport();
  };

  const handleLoad = () => {
    computePositions();
    updateCurrent();
    alignDockToViewport();
  };

  if (scroller && typeof scroller.addEventListener === 'function') {
    scroller.addEventListener('scroll', handleScroll, { passive: true });
  } else if (winRef && typeof winRef.addEventListener === 'function') {
    winRef.addEventListener('scroll', handleScroll, { passive: true });
  }

  if (winRef && typeof winRef.addEventListener === 'function') {
    winRef.addEventListener('resize', handleResize);
    winRef.addEventListener('orientationchange', handleResize);
    winRef.addEventListener('load', handleLoad);
    if (winRef.visualViewport && typeof winRef.visualViewport.addEventListener === 'function') {
      winRef.visualViewport.addEventListener('resize', alignDockToViewport);
      winRef.visualViewport.addEventListener('scroll', alignDockToViewport, { passive: true });
    }
    if (typeof winRef.setTimeout === 'function') {
      winRef.setTimeout(() => {
        computePositions();
        updateCurrent();
        alignDockToViewport();
      }, 80);
    }
  }

  computePositions();
  updateCurrent();
  alignDockToViewport();

  const observer = (typeof ResizeObserver !== 'undefined' && headings.some(Boolean))
    ? new ResizeObserver(() => {
        computePositions();
        updateCurrent();
      })
    : null;
  if (observer) {
    headings.filter(Boolean).forEach(node => observer.observe(node));
  }

  return () => {
    items.forEach(({ cleanup }) => cleanup());
    dock.removeEventListener('mouseleave', clearHover);
    if (scroller && typeof scroller.removeEventListener === 'function') {
      scroller.removeEventListener('scroll', handleScroll);
    } else if (winRef && typeof winRef.removeEventListener === 'function') {
      winRef.removeEventListener('scroll', handleScroll);
    }
    if (winRef && typeof winRef.removeEventListener === 'function') {
      winRef.removeEventListener('resize', handleResize);
      winRef.removeEventListener('orientationchange', handleResize);
      winRef.removeEventListener('load', handleLoad);
      if (winRef.visualViewport && typeof winRef.visualViewport.removeEventListener === 'function') {
        winRef.visualViewport.removeEventListener('resize', alignDockToViewport);
        winRef.visualViewport.removeEventListener('scroll', alignDockToViewport);
      }
    }
    if (observer) observer.disconnect();
    if (pendingFrame != null) {
      if (!frameIsTimeout && winRef && typeof winRef.cancelAnimationFrame === 'function') {
        winRef.cancelAnimationFrame(pendingFrame);
      } else if (frameIsTimeout) {
        clearTimeout(pendingFrame);
      }
      pendingFrame = null;
    }
    if (dock && typeof dock.remove === 'function') {
      dock.remove();
    }
  };
}

function showToc(tocEl, tocHtml, articleTitle) {
  if (!tocEl) return;
  if (typeof tocEl.__arcusTocCleanup === 'function') {
    try { tocEl.__arcusTocCleanup(); } catch (_) {}
    tocEl.__arcusTocCleanup = null;
  }
  if (!tocHtml) {
    tocEl.innerHTML = '';
    tocEl.hidden = true;
    return;
  }
  tocEl.innerHTML = `<div class="arcus-toc__inner"><div class="arcus-toc__title">${escapeHtml(articleTitle || t('ui.tableOfContents'))}</div>${tocHtml}</div>`;
  tocEl.hidden = false;
  fadeIn(tocEl);
  const cleanup = enhanceArcusTocDock(tocEl);
  if (cleanup) tocEl.__arcusTocCleanup = cleanup;
}

function renderLoader(target, message) {
  if (!target) return;
  target.innerHTML = `<div class="arcus-loader" role="status">
    <div class="arcus-loader__spinner"></div>
    <div class="arcus-loader__text">${escapeHtml(message || t('ui.loading'))}</div>
  </div>`;
}

function renderStaticView(container, title, html) {
  if (!container) return;
  const safeHtml = html != null ? html : '';
  container.innerHTML = `<article class="arcus-static">
    <header class="arcus-static__header">
      <h1>${escapeHtml(title || '')}</h1>
    </header>
    <div class="arcus-static__body">${safeHtml}</div>
  </article>`;
}

function mountHooks(documentRef = defaultDocument, windowRef = defaultWindow) {
  const hooks = {};

  hooks.resolveViewContainers = ({ view }) => {
    return {
      view,
      mainElement: getRoleElement('main', documentRef),
      tocElement: getRoleElement('toc', documentRef),
      sidebarElement: getRoleElement('sidebar', documentRef),
      contentElement: getRoleElement('content', documentRef),
      containerElement: getRoleElement('container', documentRef)
    };
  };

  hooks.getViewContainer = ({ role }) => getRoleElement(role, documentRef);

  hooks.showElement = ({ element }) => fadeIn(element);
  hooks.hideElement = ({ element, onDone }) => { fadeOut(element, onDone); return true; };

  hooks.renderSiteIdentity = ({ config }) => {
    currentSiteConfig = config || currentSiteConfig;
    const title = localized(config, 'siteTitle');
    const subtitle = localized(config, 'siteSubtitle');
    const titleEl = documentRef.querySelector('[data-site-title]');
    const subtitleEl = documentRef.querySelector('[data-site-subtitle]');
    if (titleEl) titleEl.textContent = title || 'NanoSite';
    if (subtitleEl) subtitleEl.textContent = subtitle || '';

    const markEl = documentRef.querySelector('.arcus-brand__mark');
    const logoEl = documentRef.querySelector('[data-site-logo]');
    let logoSrc = '';
    if (config && typeof config.avatar === 'string') {
      logoSrc = config.avatar;
    } else if (config && config.avatar && typeof config.avatar === 'object') {
      const lang = typeof getCurrentLang === 'function' ? getCurrentLang() : null;
      logoSrc = (lang && config.avatar[lang]) || config.avatar.default || '';
    }
    const safeLogoSrc = logoSrc && typeof sanitizeImageUrl === 'function' ? sanitizeImageUrl(logoSrc) : logoSrc;

    if (logoEl) {
      if (safeLogoSrc) {
        logoEl.setAttribute('src', safeLogoSrc);
        logoEl.setAttribute('alt', title ? `${title}` : 'Site logo');
        logoEl.removeAttribute('hidden');
        if (markEl) markEl.classList.remove('arcus-brand__mark--placeholder');
      } else {
        logoEl.removeAttribute('src');
        logoEl.setAttribute('alt', '');
        logoEl.setAttribute('hidden', '');
        if (markEl) markEl.classList.add('arcus-brand__mark--placeholder');
      }
    } else if (markEl && !safeLogoSrc) {
      markEl.classList.add('arcus-brand__mark--placeholder');
    }
  };

  hooks.renderSiteLinks = ({ config }) => {
    const root = documentRef.querySelector('[data-site-links]');
    renderLinksList(root, config);
  };

  hooks.updateLayoutLoadingState = ({ isLoading, containerElement }) => {
    const target = containerElement || getRoleElement('content', documentRef);
    if (!target) return;
    target.classList.toggle('is-loading', !!isLoading);
  };

  hooks.renderPostTOC = ({ tocElement, tocHtml, articleTitle }) => {
    const toc = tocElement || getRoleElement('toc', documentRef);
    showToc(toc, tocHtml, articleTitle);
    return true;
  };

  hooks.renderErrorState = ({ targetElement, title, message, actions }) => {
    const target = targetElement || getRoleElement('main', documentRef);
    if (!target) return false;
    const actionHtml = Array.isArray(actions) && actions.length
      ? `<div class="arcus-error__actions">${actions.map(a => `<a class="arcus-btn" href="${escapeHtml(withLangParam(a.href || '#'))}">${escapeHtml(a.label || '')}</a>`).join('')}</div>`
      : '';
    const heading = title || t('errors.pageUnavailableTitle');
    const body = message || t('errors.pageUnavailableBody');
    target.innerHTML = `<section class="arcus-error" role="alert">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </section>`;
    return true;
  };

  hooks.handleViewChange = ({ view }) => {
    if (!documentRef || !documentRef.body) return;
    documentRef.body.setAttribute('data-active-view', view || 'posts');
    const toc = getRoleElement('toc', documentRef);
    if (toc && view !== 'post') {
      if (typeof toc.__arcusTocCleanup === 'function') {
        try { toc.__arcusTocCleanup(); } catch (_) {}
        toc.__arcusTocCleanup = null;
      }
      toc.hidden = true;
      toc.innerHTML = '';
    }
    const input = documentRef.getElementById('searchInput');
    if (input) input.value = view === 'search' ? (getQueryVariable('q') || '') : '';
  };

  hooks.renderTagSidebar = ({ postsIndex, utilities }) => {
    const render = utilities && typeof utilities.renderTagSidebar === 'function'
      ? utilities.renderTagSidebar
      : renderDefaultTags;
    try { render(postsIndex || {}); } catch (_) {}
    return true;
  };

  hooks.enhanceIndexLayout = (params = {}) => {
    const container = params.containerElement || getRoleElement('main', documentRef);
    try { if (typeof hydrateCardCovers === 'function') hydrateCardCovers(container); } catch (_) {}
    try { if (typeof applyLazyLoadingIn === 'function') applyLazyLoadingIn(container); } catch (_) {}
    try { if (typeof params.setupSearch === 'function') params.setupSearch(params.allEntries || []); } catch (_) {}
    try { if (typeof params.renderTagSidebar === 'function') params.renderTagSidebar(params.postsIndexMap || {}); } catch (_) {}
    return true;
  };

  hooks.renderTabs = ({ tabsBySlug, activeSlug, getHomeSlug, postsEnabled }) => {
    const nav = documentRef.getElementById('tabsNav');
    if (!nav) return false;
    renderNavLinks(nav, tabsBySlug, activeSlug, postsEnabled, getHomeSlug);
    return true;
  };

  hooks.renderFooterNav = ({ tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel }) => {
    const footerNav = documentRef.getElementById('footerNav');
    if (!footerNav) return false;
    renderFooterLinks(footerNav, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel);
    return true;
  };

  hooks.renderPostLoadingState = ({ containers }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    renderLoader(main, t('ui.loading'));
    return true;
  };

  hooks.renderPostView = ({ containers, markdownHtml, fallbackTitle, postMetadata, markdown, postsIndex, postId, siteConfig, translate, utilities, tocHtml }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    if (!main) return;
    const title = (postMetadata && postMetadata.title) || fallbackTitle || '';
    const hero = renderHeroImage(postMetadata, title, siteConfig);
    const date = postMetadata && postMetadata.date ? formatDisplayDate(postMetadata.date) : '';
    const tagMarkup = postMetadata ? renderTags(postMetadata.tag) : '';
    const metaCard = renderPostMetaCard(title, postMetadata || {}, markdown);
    const outdatedCard = renderOutdatedCard(postMetadata || {}, siteConfig);

    main.innerHTML = `
      <article class="arcus-article" data-post-id="${escapeHtml(postId || '')}">
        <header class="arcus-article__header">
          ${hero || ''}
          <div class="arcus-article__heading">
            <p class="arcus-article__meta-line">${date ? escapeHtml(date) : ''}</p>
            <h1 class="arcus-article__title">${escapeHtml(title)}</h1>
            ${tagMarkup ? `<div class="arcus-article__tags">${tagMarkup}</div>` : ''}
          </div>
          <div class="arcus-article__meta">
            ${outdatedCard || ''}
            ${metaCard || ''}
          </div>
        </header>
        <div class="arcus-article__body">${markdownHtml}</div>
        <footer class="arcus-article__footer">
          <div class="arcus-article__nav" data-post-nav></div>
        </footer>
      </article>`;

    const tocTarget = containers && containers.tocElement ? containers.tocElement : getRoleElement('toc', documentRef);
    try {
      if (utilities && typeof utilities.renderPostTOC === 'function') {
        utilities.renderPostTOC({ tocElement: tocTarget, tocHtml, articleTitle: title });
      } else {
        showToc(tocTarget, tocHtml, title);
      }
    } catch (_) {
      showToc(tocTarget, tocHtml, title);
    }

    try { if (utilities && typeof utilities.renderPostNav === 'function') utilities.renderPostNav(main.querySelector('[data-post-nav]'), postsIndex || {}, postMetadata && postMetadata.location); } catch (_) {}
    decorateArticle(main, translate || t, { hydratePostImages, hydratePostVideos, applyLazyLoadingIn }, markdown, postMetadata, title);
    scrollViewportToTop(documentRef, windowRef);
    return { decorated: true, title };
  };

  hooks.decoratePostView = ({ container, translate, utilities, markdown, postMetadata, articleTitle }) => {
    decorateArticle(container || getRoleElement('main', documentRef), translate || t, utilities || { hydratePostImages, hydratePostVideos, applyLazyLoadingIn }, markdown, postMetadata, articleTitle);
    return true;
  };

  hooks.scrollToHash = ({ hash }) => {
    if (!hash) return false;
    try {
      const target = documentRef.getElementById(hash) || documentRef.querySelector(`[id='${hash}']`);
      if (!target) return false;
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return true;
    } catch (_) { return false; }
  };

  hooks.renderIndexView = ({ container, pageEntries, page, totalPages, siteConfig }) => {
    if (!container) container = getRoleElement('main', documentRef);
    if (!container) return false;
    const cards = (pageEntries || []).map(([title, meta]) => {
      const href = meta && meta.location ? withLangParam(`?id=${encodeURIComponent(meta.location)}`) : '#';
      return buildCard({ title, meta, translate: t, link: href, siteConfig });
    }).join('');
    const baseHref = withLangParam('?tab=posts');
    container.innerHTML = `<div class="arcus-index index">
      <div class="arcus-index__grid">${cards || `<p class="arcus-empty">${t('ui.noResultsTitle')}</p>`}</div>
      ${buildPagination({ page, totalPages, baseHref, query: {} })}
    </div>`;
    scrollViewportToTop(documentRef, windowRef);
    return true;
  };

  hooks.afterIndexRender = (params = {}) => {
    const target = params.container || getRoleElement('main', documentRef);
    try {
      if (target) hydrateCardCovers(target);
      else hydrateCardCovers(getRoleElement('main', documentRef));
    } catch (_) {}
    try {
      hydrateArcusCardExcerpts(params.entries || [], { ...params, container: target, document: documentRef });
    } catch (_) {}
    return true;
  };

  hooks.renderSearchResults = ({ container, entries, query, totalPages, page, siteConfig, tagFilter }) => {
    if (!container) container = getRoleElement('main', documentRef);
    if (!container) return false;
    const cards = (entries || []).map(([title, meta]) => {
      const href = meta && meta.location ? withLangParam(`?id=${encodeURIComponent(meta.location)}`) : '#';
      return buildCard({ title, meta, translate: t, link: href, siteConfig });
    }).join('');
    const baseHref = withLangParam('?tab=search');
    const summary = query
      ? `${t('ui.searchTab')} · ${escapeHtml(query)}`
      : tagFilter
        ? `${t('ui.tags')} · ${escapeHtml(tagFilter)}`
        : t('ui.searchTab');
    container.innerHTML = `<div class="arcus-index arcus-index--search index">
      <header class="arcus-index__header"><h2>${escapeHtml(summary)}</h2></header>
      <div class="arcus-index__grid">${cards || `<p class="arcus-empty">${t('ui.noResultsTitle')}</p>`}</div>
      ${buildPagination({ page, totalPages, baseHref, query: { q: query, tag: tagFilter } })}
    </div>`;
    scrollViewportToTop(documentRef, windowRef);
    return true;
  };

  hooks.afterSearchRender = (params = {}) => {
    const target = params.container || getRoleElement('main', documentRef);
    try {
      if (target) hydrateCardCovers(target);
      else hydrateCardCovers(getRoleElement('main', documentRef));
    } catch (_) {}
    try {
      hydrateArcusCardExcerpts(params.entries || [], { ...params, container: target, document: documentRef });
    } catch (_) {}
    return true;
  };

  hooks.renderStaticTabLoadingState = ({ containers }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    renderLoader(main, t('ui.loading'));
    return true;
  };

  hooks.renderStaticTabView = ({
    containers,
    title,
    html,
    markdownHtml,
    tocHtml,
    tab,
    translate,
    utilities,
    allowedLocations,
    locationAliasMap,
    postsByLocationTitle,
    postsIndex,
    siteConfig
  }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    if (!main) return false;
    const heading = title || (tab && tab.title) || '';
    const bodyHtml = markdownHtml != null ? markdownHtml : html;
    renderStaticView(main, heading, bodyHtml);
    scrollViewportToTop(documentRef, windowRef);

    const body = main.querySelector('.arcus-static__body') || main;
    try { if (utilities && typeof utilities.hydratePostImages === 'function') utilities.hydratePostImages(body); } catch (_) {}
    try { if (utilities && typeof utilities.hydratePostVideos === 'function') utilities.hydratePostVideos(body); } catch (_) {}
    try { if (utilities && typeof utilities.applyLazyLoadingIn === 'function') utilities.applyLazyLoadingIn(body); } catch (_) {}
    try { if (utilities && typeof utilities.applyLangHints === 'function') utilities.applyLangHints(body); } catch (_) {}
    try {
      if (utilities && typeof utilities.hydrateInternalLinkCards === 'function') {
        const makeHref = utilities.makeLangHref || ((loc) => withLangParam(`?id=${encodeURIComponent(loc)}`));
        const fetchMarkdown = utilities.fetchMarkdown || (() => Promise.resolve(''));
        utilities.hydrateInternalLinkCards(body, {
          allowedLocations: allowedLocations || new Set(),
          locationAliasMap: locationAliasMap || new Map(),
          postsByLocationTitle: postsByLocationTitle || {},
          postsIndexCache: postsIndex || {},
          siteConfig: siteConfig || {},
          translate: translate || t,
          makeHref,
          fetchMarkdown
        });
      }
    } catch (_) {}

    const toc = containers && containers.tocElement ? containers.tocElement : getRoleElement('toc', documentRef);
    if (toc) {
      if (tocHtml) {
        showToc(toc, tocHtml, heading);
      } else {
        if (typeof toc.__arcusTocCleanup === 'function') {
          try { toc.__arcusTocCleanup(); } catch (_) {}
          toc.__arcusTocCleanup = null;
        }
        toc.innerHTML = '';
        toc.hidden = true;
      }
    }
    return true;
  };

  hooks.handleDocumentClick = ({ event }) => {
    const target = event && event.target;
    if (!target) return false;
    if (target.closest('.arcus-nav__item')) {
      return false;
    }
    return false;
  };

  hooks.handleRouteScroll = ({ document: doc, window: win } = {}) => {
    const scrolled = scrollViewportToTop(doc || documentRef, win || windowRef);
    return scrolled ? true : undefined;
  };

  hooks.handleWindowResize = () => {
    return true;
  };

  hooks.setupThemeControls = () => setupToolsPanel(documentRef, windowRef);
  hooks.resetThemeControls = () => resetToolsPanel(documentRef, windowRef);
  hooks.updateSearchPlaceholder = () => { updateSearchPlaceholder(documentRef); return true; };

  hooks.setupResponsiveTabsObserver = () => {
    const header = documentRef.querySelector('.arcus-header');
    if (!header || typeof IntersectionObserver === 'undefined') return false;
    let sentinel = documentRef.querySelector('.arcus-header-sentinel');
    if (!sentinel) {
      sentinel = documentRef.createElement('div');
      sentinel.className = 'arcus-header-sentinel';
      header.parentElement.insertBefore(sentinel, header);
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        header.classList.toggle('is-condensed', !entry.isIntersecting);
      });
    });
    observer.observe(sentinel);
    return true;
  };

  hooks.reflectThemeConfig = ({ siteConfig }) => {
    const root = documentRef.querySelector('.arcus-shell');
    if (root && siteConfig && siteConfig.themePack) {
      root.setAttribute('data-theme-pack', siteConfig.themePack);
    }
    return true;
  };

  hooks.setupFooter = () => {
    const meta = documentRef.querySelector('.arcus-footer__credit');
    if (meta) {
      const year = new Date().getFullYear();
      const siteTitle = localized(currentSiteConfig || {}, 'siteTitle') || 'NanoSite';
      meta.textContent = `© ${year} ${siteTitle}`;
    }
    return true;
  };

  if (windowRef) {
    windowRef.__ns_themeHooks = Object.assign({}, windowRef.__ns_themeHooks || {}, hooks);
  }
  return hooks;
}

export function mount(context = {}) {
  const doc = context.document || defaultDocument;
  const win = (context.document && context.document.defaultView) || defaultWindow;
  mountHooks(doc, win);
  updateSearchPlaceholder(doc);
  setupToolsPanel(doc, win);
  setupDynamicBackground(doc, win);
  setupBackToTop(doc, win);
  return context;
}
