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
      return documentRef.querySelector('.bivium-mainpanel');
    case 'container':
      return documentRef.querySelector('.bivium-shell');
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
  if (!element) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  element.classList.remove('is-visible');
  const finish = () => {
    element.classList.add(CLASS_HIDDEN);
    element.hidden = true;
    if (typeof onDone === 'function') onDone();
  };
  if (prefersReducedMotion && prefersReducedMotion()) {
    finish();
  } else {
    element.addEventListener('transitionend', finish, { once: true });
    const timer = setTimeout(finish, 320);
    element.addEventListener('transitioncancel', () => clearTimeout(timer), { once: true });
  }
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
      return `<div class="bivium-card__cover"><span class="ph-skeleton" aria-hidden="true"></span><img class="card-cover" src="${escapeHtml(resolved)}" alt="${escapeHtml(String(alt || ''))}" loading="lazy" decoding="async" fetchpriority="low" /></div>`;
    }
  }
  if (allowFallback) {
    const fallback = fallbackCover(heading);
    return `<div class="bivium-card__cover card-cover-wrap">${fallback}</div>`;
  }
  return '';
}

function buildCard({ title, meta, translate, link, siteConfig }) {
  const safeTitle = escapeHtml(String(title || 'Untitled'));
  const excerpt = meta && meta.excerpt ? escapeHtml(String(meta.excerpt)) : '';
  const date = meta && meta.date ? formatDisplayDate(meta.date) : '';
  const tags = meta ? renderTags(meta.tag) : '';
  const coverHtml = renderCardCover(meta, title, siteConfig);
  const classes = ['bivium-card'];
  if (coverHtml) classes.push('bivium-card--with-cover');
  return `<article class="${classes.join(' ')}">
    <a class="bivium-card__link" href="${escapeHtml(link)}">
      ${coverHtml}
      <div class="bivium-card__body">
        <h3 class="bivium-card__title">${safeTitle}</h3>
        ${date ? `<div class="bivium-card__meta">${escapeHtml(date)}</div>` : ''}
        ${excerpt ? `<p class="bivium-card__excerpt">${excerpt}</p>` : ''}
        ${tags ? `<div class="bivium-card__tags">${tags}</div>` : ''}
      </div>
    </a>
  </article>`;
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
    items.push(`<a class="bivium-page${i === page ? ' is-current' : ''}" href="${escapeHtml(href)}">${i}</a>`);
  }
  const prevHref = page > 1 ? mkHref(page - 1) : '';
  const nextHref = page < totalPages ? mkHref(page + 1) : '';
  return `<nav class="bivium-pagination" aria-label="${t('ui.pagination')}">
    <a class="bivium-page prev${prevHref ? '' : ' is-disabled'}" href="${prevHref ? escapeHtml(prevHref) : '#'}" ${prevHref ? '' : 'aria-disabled="true"'}>${t('ui.prev')}</a>
    <div class="bivium-page__list">${items.join('')}</div>
    <a class="bivium-page next${nextHref ? '' : ' is-disabled'}" href="${nextHref ? escapeHtml(nextHref) : '#'}" ${nextHref ? '' : 'aria-disabled="true"'}>${t('ui.next')}</a>
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
        const temp = defaultDocument.createElement('textarea');
        temp.value = href;
        temp.setAttribute('readonly', '');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        defaultDocument.body.appendChild(temp);
        temp.select();
        try { defaultDocument.execCommand('copy'); ok = true; } catch (_) {}
        defaultDocument.body.removeChild(temp);
      }
      if (ok) {
        copyBtn.classList.add('copied');
        copyBtn.textContent = translate('ui.linkCopied');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = translate('ui.copyLink');
        }, 2200);
      }
    });
  }

  const aiFlags = Array.from(container.querySelectorAll('.post-meta-card .ai-flag'));
  aiFlags.forEach(flag => attachHoverTooltip(flag, () => translate('ui.aiFlagTooltip'), { delay: 0 }));

  try {
    if (typeof utilities.hydratePostImages === 'function') utilities.hydratePostImages(container);
    if (typeof utilities.hydratePostVideos === 'function') utilities.hydratePostVideos(container);
    if (typeof utilities.applyLazyLoadingIn === 'function') utilities.applyLazyLoadingIn(container);
  } catch (_) {}
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
  nav.innerHTML = items.map(item => `<a class="bivium-nav__item${item.slug === activeSlug ? ' is-current' : ''}" data-tab="${escapeHtml(item.slug)}" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('');
  nav.setAttribute('data-active', activeSlug || homeSlug);
}

function renderFooterLinks(root, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel) {
  if (!root) return;
  const links = [];
  const homeSlug = getHomeSlug();
  const homeLabel = getHomeLabel();
  if (postsEnabled()) {
    links.push({ href: withLangParam(`?tab=${encodeURIComponent(homeSlug)}`), label: homeLabel });
  }
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    const label = info && info.title ? String(info.title) : slug;
    links.push({ href: withLangParam(`?tab=${encodeURIComponent(slug)}`), label });
  });
  links.push({ href: withLangParam('?tab=search'), label: t('ui.searchTab') });
  root.innerHTML = `<ul class="bivium-footernav__list">${links.map(link => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>`;
}

function renderLinksList(root, cfg) {
  if (!root) return;
  const list = Array.isArray(cfg && cfg.profileLinks) ? cfg.profileLinks : [];
  if (!list.length) {
    root.innerHTML = `<li class="bivium-links__empty">${t('editor.site.noLinks')}</li>`;
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
    { value: 'solstice', label: 'Solstice' }
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
    ensureSavedOptionVisible();
  };

  try {
    const packsData = windowRef && windowRef.__ns_themePacks ? windowRef.__ns_themePacks : null;
    if (Array.isArray(packsData)) {
      applyOptions(packsData);
    } else {
      applyOptions(null);
    }
  } catch (_) {
    applyOptions(null);
  }

  ensureSavedOptionVisible();
  return true;
}

function setupToolsPanel(documentRef = defaultDocument, windowRef = defaultWindow) {
  const panel = documentRef && documentRef.getElementById('toolsPanel');
  if (!panel) return false;
  panel.innerHTML = `
    <div class="bivium-tools" id="tools">
      <button id="themeToggle" class="bivium-tool" type="button" aria-label="${t('tools.toggleTheme')}">
        <span class="bivium-tool__icon">🌓</span>
        <span class="bivium-tool__label">${t('tools.toggleTheme')}</span>
      </button>
      <button id="postEditor" class="bivium-tool" type="button" aria-label="${t('tools.postEditor')}">
        <span class="bivium-tool__icon">📝</span>
        <span class="bivium-tool__label">${t('tools.postEditor')}</span>
      </button>
      <label class="bivium-tool bivium-tool--select" for="themePack">
        <span class="bivium-tool__label">${t('tools.themePack')}</span>
        <select id="themePack"></select>
      </label>
      <label class="bivium-tool bivium-tool--select" for="langSelect">
        <span class="bivium-tool__label">${t('tools.language')}</span>
        <select id="langSelect"></select>
      </label>
      <button id="langReset" class="bivium-tool" type="button" aria-label="${t('tools.resetLanguage')}">
        <span class="bivium-tool__icon">♻️</span>
        <span class="bivium-tool__label">${t('tools.resetLanguage')}</span>
      </button>
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

function showToc(tocEl, tocHtml, articleTitle) {
  if (!tocEl) return;
  if (!tocHtml) {
    tocEl.innerHTML = '';
    tocEl.hidden = true;
    return;
  }
  tocEl.innerHTML = `<div class="bivium-toc__inner"><div class="bivium-toc__title">${escapeHtml(articleTitle || t('ui.tableOfContents'))}</div>${tocHtml}</div>`;
  tocEl.hidden = false;
  fadeIn(tocEl);
}

function renderLoader(target, message) {
  if (!target) return;
  target.innerHTML = `<div class="bivium-loader" role="status">
    <div class="bivium-loader__spinner"></div>
    <div class="bivium-loader__text">${escapeHtml(message || t('ui.loading'))}</div>
  </div>`;
}

function renderStaticView(container, title, html) {
  if (!container) return;
  const safeHtml = html != null ? html : '';
  container.innerHTML = `<article class="bivium-static">
    <header class="bivium-static__header">
      <h1>${escapeHtml(title || '')}</h1>
    </header>
    <div class="bivium-static__body">${safeHtml}</div>
  </article>`;
}

function renderPostArticle({
  container,
  title,
  markdownHtml,
  tocHtml,
  markdown,
  postMetadata,
  siteConfig,
  translate,
  utilities
}) {
  if (!container) return { decorated: false, title };
  const safeTitle = escapeHtml(String(title || 'Untitled Post'));
  const metaHtml = renderPostMetaCard(title, postMetadata, markdown);
  const outdated = renderOutdatedCard(postMetadata, siteConfig);
  const cover = renderCardCover(postMetadata, title, siteConfig);
  const hero = cover ? `<div class="bivium-article__hero">${cover}</div>` : '';
  container.innerHTML = `<article class="bivium-article">
    <header class="bivium-article__header">
      ${hero}
      <h1 class="bivium-article__title">${safeTitle}</h1>
      ${metaHtml}
    </header>
    <div class="bivium-article__content">${markdownHtml}</div>
    ${outdated}
  </article>`;
  if (tocHtml) {
    const tocEl = getRoleElement('toc');
    showToc(tocEl, tocHtml, title);
  }
  decorateArticle(container, translate, utilities, markdown, postMetadata, title);
  return { decorated: true, title };
}

function handleDocumentClick(event, documentRef = defaultDocument) {
  if (!event || !documentRef) return false;
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('.bivium-nav__item')) return false;
  return false;
}

function scrollViewportToTop(documentRef = defaultDocument, windowRef = defaultWindow) {
  const behavior = prefersReducedMotion && prefersReducedMotion() ? 'auto' : 'smooth';
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) {}
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo(0, 0);
      return true;
    }
  } catch (_) {}
  try {
    if (documentRef) {
      if (documentRef.documentElement) documentRef.documentElement.scrollTop = 0;
      if (documentRef.body) documentRef.body.scrollTop = 0;
      return true;
    }
  } catch (_) {}
  return false;
}

function mountHooks(documentRef = defaultDocument, windowRef = defaultWindow) {
  const hooks = {};

  hooks.resolveViewContainers = ({ view }) => ({
    view,
    mainElement: getRoleElement('main', documentRef),
    tocElement: getRoleElement('toc', documentRef),
    sidebarElement: getRoleElement('sidebar', documentRef),
    contentElement: getRoleElement('content', documentRef),
    containerElement: getRoleElement('container', documentRef)
  });

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
      ? `<div class="bivium-error__actions">${actions.map(a => `<a class="bivium-btn" href="${escapeHtml(withLangParam(a.href || '#'))}">${escapeHtml(a.label || '')}</a>`).join('')}</div>`
      : '';
    const heading = title || t('errors.pageUnavailableTitle');
    const body = message || t('errors.pageUnavailableBody');
    target.innerHTML = `<section class="bivium-error" role="alert">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </section>`;
    return true;
  };

  hooks.handleViewChange = ({ view }) => {
    if (!documentRef || !documentRef.body) return;
    documentRef.body.setAttribute('data-bivium-view', view || 'posts');
    const toc = getRoleElement('toc', documentRef);
    if (toc && view !== 'post') {
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

  hooks.renderFooterNav = ({ tabsBySlug, getHomeSlug, getHomeLabel, postsEnabled }) => {
    const nav = documentRef.querySelector('.bivium-footernav');
    if (!nav) return false;
    renderFooterLinks(nav, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel);
    return true;
  };

  hooks.renderPostLoadingState = ({ containers, translator }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    renderLoader(main, translator('ui.loading'));
    return true;
  };

  hooks.renderPostView = ({ containers, markdownHtml, tocHtml, markdown, fallbackTitle, postMetadata, siteConfig, translate, utilities }) => {
    const main = containers && containers.mainElement ? containers.mainElement : getRoleElement('main', documentRef);
    const title = (postMetadata && postMetadata.title) || fallbackTitle;
    return renderPostArticle({
      container: main,
      title,
      markdownHtml,
      tocHtml,
      markdown,
      postMetadata,
      siteConfig,
      translate,
      utilities
    });
  };

  hooks.decoratePostView = ({ container, translate, utilities, markdown, postMetadata, articleTitle }) => {
    decorateArticle(container, translate, utilities, markdown, postMetadata, articleTitle);
    return true;
  };

  hooks.scrollToHash = ({ hash }) => {
    if (!hash) return false;
    const target = documentRef.getElementById(hash);
    if (!target) return false;
    target.scrollIntoView({ behavior: prefersReducedMotion && prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return true;
  };

  hooks.paginateEntries = ({ entries, page, pageSize }) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return { pageEntries: entries.slice(start, end), page };
  };

  hooks.renderIndexView = ({ container, pageEntries, page, totalPages, withLangParam, translate, siteConfig }) => {
    if (!container) return false;
    const cards = pageEntries.map(([title, meta]) => buildCard({
      title,
      meta,
      translate,
      link: withLangParam(`?id=${encodeURIComponent(meta.location || '')}`),
      siteConfig
    })).join('');
    const pagination = buildPagination({
      page,
      totalPages,
      baseHref: withLangParam('?tab=posts'),
      query: {}
    });
    container.innerHTML = `<div class="bivium-index">
      <div class="bivium-cardgrid">${cards || `<p class="bivium-empty">${translate('ui.noResultsTitle') || 'No posts yet.'}</p>`}</div>
      ${pagination}
    </div>`;
    return true;
  };

  hooks.afterIndexRender = ({ containerElement }) => {
    try { if (typeof hydrateCardCovers === 'function') hydrateCardCovers(containerElement); } catch (_) {}
    return true;
  };

  hooks.filterSearchEntries = ({ entries, query, tagFilter, utilities }) => {
    const filter = utilities && typeof utilities.defaultFilter === 'function'
      ? utilities.defaultFilter
      : ((list, q, tag) => list);
    return filter(entries, query, tagFilter);
  };

  hooks.renderSearchResults = ({ container, pageEntries, total, query, tagFilter, translate, withLangParam, page, totalPages }) => {
    if (!container) return false;
    const cards = pageEntries.map(([title, meta]) => buildCard({
      title,
      meta,
      translate,
      link: withLangParam(`?id=${encodeURIComponent(meta.location || '')}`),
      siteConfig: currentSiteConfig || {}
    })).join('');
    const summary = query
      ? translate('titles.search', query) || `Search: ${escapeHtml(query)}`
      : (tagFilter ? (translate('ui.tagSearch', tagFilter) || `Tag: ${escapeHtml(tagFilter)}`) : translate('ui.searchTab'));
    const countText = `${total} ${total === 1 ? 'result' : 'results'}`;
    const pagination = buildPagination({
      page,
      totalPages,
      baseHref: withLangParam('?tab=search'),
      query: { q: query, tag: tagFilter }
    });
    container.innerHTML = `<div class="bivium-search">
      <header class="bivium-search__header">
        <h2>${summary}</h2>
        <p>${countText}</p>
      </header>
      <div class="bivium-cardgrid">${cards || `<p class="bivium-empty">${translate('ui.noResultsBody', query) || 'No results found.'}</p>`}</div>
      ${pagination}
    </div>`;
    return true;
  };

  hooks.afterSearchRender = ({ containerElement }) => {
    try { if (typeof hydrateCardCovers === 'function') hydrateCardCovers(containerElement); } catch (_) {}
    return true;
  };

  hooks.renderStaticTabLoadingState = ({ container }) => {
    renderLoader(container, t('ui.loading'));
    return true;
  };

  hooks.renderStaticTabView = ({ container, title, html }) => {
    renderStaticView(container, title, html);
    return true;
  };

  hooks.handleDocumentClick = ({ event }) => handleDocumentClick(event, documentRef);

  hooks.handleRouteScroll = ({ document: doc, window: win } = {}) => {
    const scrolled = scrollViewportToTop(doc || documentRef, win || windowRef);
    return scrolled ? true : undefined;
  };

  hooks.handleWindowResize = () => true;

  hooks.setupThemeControls = () => setupToolsPanel(documentRef, windowRef);
  hooks.resetThemeControls = () => resetToolsPanel(documentRef, windowRef);
  hooks.updateSearchPlaceholder = () => { updateSearchPlaceholder(documentRef); return true; };

  hooks.setupResponsiveTabsObserver = () => {
    const shell = documentRef.querySelector('.bivium-shell');
    if (!shell || typeof IntersectionObserver === 'undefined') return false;
    const nav = documentRef.querySelector('.bivium-nav');
    if (!nav) return false;
    const sentinel = documentRef.createElement('div');
    sentinel.className = 'bivium-nav-sentinel';
    shell.insertBefore(sentinel, shell.firstChild);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        nav.classList.toggle('is-floating', !entry.isIntersecting);
      });
    });
    observer.observe(sentinel);
    return true;
  };

  hooks.reflectThemeConfig = ({ config }) => {
    const root = documentRef.querySelector('.bivium-shell');
    if (root && config && config.themePack) {
      root.setAttribute('data-theme-pack', config.themePack);
    }
    return true;
  };

  hooks.setupFooter = () => {
    const meta = documentRef.querySelector('.bivium-footer__credit');
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
  return context;
}
