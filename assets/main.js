import './js/cache-control.js';
import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindThemePackPicker, mountThemeControls, refreshLanguageSelector, applyThemeConfig, bindPostEditor } from './js/theme.js';
import { ensureThemeLayout } from './js/theme-layout.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, setBaseSiteTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, formatDisplayDate, isModifiedClick, getContentRoot, sanitizeImageUrl, sanitizeUrl } from './js/utils.js';
import {
  initI18n,
  t,
  withLangParam,
  loadLangJson,
  loadContentJson,
  loadTabsJson,
  getCurrentLang,
  normalizeLangKey,
  POSTS_METADATA_READY_EVENT
} from './js/i18n.js';
import { updateSEO, extractSEOFromMarkdown } from './js/seo.js';
import { initErrorReporter, setReporterContext, showErrorOverlay } from './js/errors.js';
import { initSyntaxHighlighting } from './js/syntax-highlight.js';
import { fetchConfigWithYamlFallback } from './js/yaml.js';
import { applyMasonry, updateMasonryItem, calcAndSetSpan, toPx, debounce } from './js/masonry.js';
import { aggregateTags, renderTagSidebar, setupTagTooltips } from './js/tags.js';
import { renderPostNav } from './js/post-nav.js';
import { getArticleTitleFromMain } from './js/dom-utils.js';
import { applyLangHints } from './js/typography.js';

import { applyLazyLoadingIn, hydratePostImages, hydratePostVideos, hydrateCardCovers } from './js/post-render.js';
import { hydrateInternalLinkCards } from './js/link-cards.js';

// Lightweight fetch helper (bypass caches without version params)
const getFile = (filename) => fetch(String(filename || ''), { cache: 'no-store' })
  .then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });

let postsByLocationTitle = {};
let tabsBySlug = {};
// Map a stable base slug (language-agnostic) -> current language slug
let stableToCurrentTabSlug = {};
let postsIndexCache = {};
let allowedLocations = new Set();
// Cross-language location aliases: any known variant -> preferred for current lang
let locationAliasMap = new Map();
// Raw unified index.yaml object (for preserving author-defined order across async updates)
let rawIndexCache = null;
let postsMetadataListenerBound = false;
// Default page size; can be overridden by site.yaml (pageSize/postsPerPage)
let PAGE_SIZE = 8;
// Guard against overlapping post loads (rapid version switches/back-forward)
let __activePostRequestId = 0;
// Track last route to harmonize scroll behavior on back/forward
let __lastRouteKey = '';

// Compute a simple route key to help unify scroll behavior across navigations
function getCurrentRouteKey() {
  try {
    const id = getQueryVariable('id');
    if (id) return `post:${id}`;
    const tab = (getQueryVariable('tab') || 'posts').toLowerCase();
    return `tab:${tab}`;
  } catch (_) { return ''; }
}

function getThemeHook(name) {
  try {
    const hooks = (typeof window !== 'undefined') ? window.__ns_themeHooks : null;
    const fn = hooks && hooks[name];
    return typeof fn === 'function' ? fn : null;
  } catch (_) { return null; }
}

function callThemeHook(name, ...args) {
  const fn = getThemeHook(name);
  if (!fn) return undefined;
  try { return fn(...args); } catch (_) { return undefined; }
}

function handlePostsMetadataReady(event) {
  const detail = event && event.detail;
  const entries = (detail && typeof detail === 'object') ? detail.entries : null;
  if (!entries || typeof entries !== 'object') return;

  try {
    const current = normalizeLangKey(getCurrentLang && getCurrentLang());
    const eventLang = detail && typeof detail.lang === 'string' ? normalizeLangKey(detail.lang) : '';
    if (eventLang && current && eventLang !== current) {
      return;
    }
  } catch (_) {
    // If language comparison fails, continue and apply the update
  }

  postsIndexCache = entries;

  const newAllowed = new Set();
  const byLocation = {};

  for (const [title, meta] of Object.entries(entries)) {
    if (!meta || typeof meta !== 'object') continue;
    const canonical = (meta.location != null ? String(meta.location) : '').trim();
    if (canonical) {
      newAllowed.add(canonical);
      byLocation[canonical] = title;
    }
    if (Array.isArray(meta.versions)) {
      meta.versions.forEach((ver) => {
        if (!ver || ver.location == null) return;
        const loc = String(ver.location).trim();
        if (!loc) return;
        newAllowed.add(loc);
        byLocation[loc] = title;
      });
    }
  }

  allowedLocations = newAllowed;
  postsByLocationTitle = byLocation;

  try {
    callThemeHook('handlePostsMetadataUpdate', {
      entries,
      lang: detail && detail.lang,
      document,
      window
    });
  } catch (_) { /* ignore theme hook errors */ }

  const rawId = getQueryVariable('id');
  const tabParam = (getQueryVariable('tab') || '').toLowerCase();
  const homeSlug = getHomeSlug();
  const onSearch = tabParam === 'search';
  const onPosts = !rawId && (tabParam ? tabParam === 'posts' : homeSlug === 'posts');

  if (onPosts) {
    displayIndex(postsIndexCache);
  } else if (onSearch) {
    const q = getQueryVariable('q') || '';
    displaySearch(q);
  }
}

function bindPostsMetadataListener() {
  if (postsMetadataListenerBound) return;
  if (typeof window === 'undefined') return;
  try {
    window.addEventListener(POSTS_METADATA_READY_EVENT, handlePostsMetadataReady);
    postsMetadataListenerBound = true;
  } catch (_) { /* ignore */ }
}

function getViewContainer(view, role) {
  try {
    const fromHook = callThemeHook('getViewContainer', {
      view,
      role,
      document,
      window
    });
    return fromHook || null;
  } catch (_) {
    return null;
  }
}

function getViewContainers(view) {
  const container = {
    view,
    mainElement: null,
    tocElement: null,
    sidebarElement: null,
    contentElement: null,
    containerElement: null
  };
  try {
    const hookResult = callThemeHook('resolveViewContainers', {
      view,
      document,
      window
    });
    if (hookResult && typeof hookResult === 'object') {
      if (hookResult.mainElement) container.mainElement = hookResult.mainElement;
      if (hookResult.tocElement) container.tocElement = hookResult.tocElement;
      if (hookResult.sidebarElement) container.sidebarElement = hookResult.sidebarElement;
      if (hookResult.contentElement) container.contentElement = hookResult.contentElement;
      if (hookResult.containerElement) container.containerElement = hookResult.containerElement;
    }
  } catch (_) {}
  if (!container.mainElement) container.mainElement = getViewContainer(view, 'main');
  if (!container.tocElement) container.tocElement = getViewContainer(view, 'toc');
  if (!container.sidebarElement) container.sidebarElement = getViewContainer(view, 'sidebar');
  if (!container.contentElement) container.contentElement = getViewContainer(view, 'content');
  if (!container.containerElement) container.containerElement = getViewContainer(view, 'container');
  return container;
}

// --- UI helpers: smooth show/hide delegated to theme ---

function smoothShow(el, options) {
  if (!el) return;
  const payload = { element: el, document, window };
  if (options && typeof options === 'object') Object.assign(payload, options);
  callThemeHook('showElement', payload);
}

function smoothHide(el, onDone, options) {
  if (!el) { if (typeof onDone === 'function') { try { onDone(); } catch (_) {} } return; }
  const payload = { element: el, onDone, document, window };
  if (options && typeof options === 'object') Object.assign(payload, options);
  const handled = callThemeHook('hideElement', payload);
  if (!handled && typeof onDone === 'function') {
    try { onDone(); } catch (_) {}
  }
}

// Ensure element height fully resets to its natural auto height
function ensureAutoHeight(el) {
  if (!el) return;
  try {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.height = '';
        el.style.minHeight = '';
        el.style.overflow = '';
      });
    });
  } catch (_) {}
}

// --- Site config (root-level site.yaml) ---
let siteConfig = {};

// --- Feature helpers: landing tab and posts visibility ---
function postsEnabled() {
  try {
    // Support multiple config keys for flexibility: showAllPosts (preferred), enableAllPosts, disableAllPosts
    if (siteConfig && typeof siteConfig.showAllPosts === 'boolean') return !!siteConfig.showAllPosts;
    if (siteConfig && typeof siteConfig.enableAllPosts === 'boolean') return !!siteConfig.enableAllPosts;
    if (siteConfig && typeof siteConfig.disableAllPosts === 'boolean') return !siteConfig.disableAllPosts;
  } catch (_) {}
  return true; // default: enabled
}

function resolveLandingSlug() {
  try {
    const v = siteConfig && (siteConfig.landingTab || siteConfig.landing || siteConfig.homeTab || siteConfig.home);
    if (!v) return null;
    const wanted = String(v).trim().toLowerCase();
    if (!wanted) return null;
    // Prefer direct slug match
    if (tabsBySlug && tabsBySlug[wanted]) return wanted;
    // Fallback: match by displayed title (case-insensitive)
    for (const [slug, info] of Object.entries(tabsBySlug || {})) {
      const title = (info && info.title ? String(info.title) : '').trim().toLowerCase();
      if (title && title === wanted) return slug;
    }
  } catch (_) {}
  return null;
}

function getHomeSlug() {
  try {
    // Always prefer explicit landingTab when provided
    const explicit = resolveLandingSlug();
    if (explicit) return explicit;
    // Otherwise, default to posts when enabled, else first static tab or search
    if (postsEnabled()) return 'posts';
    return Object.keys(tabsBySlug || {})[0] || 'search';
  } catch (_) { return 'search'; }
}

function getHomeLabel() {
  const slug = getHomeSlug();
  if (slug === 'posts') return t('ui.allPosts');
  if (slug === 'search') return t('ui.searchTab');
  try { return (tabsBySlug && tabsBySlug[slug] && tabsBySlug[slug].title) || slug; } catch (_) { return slug; }
}

// Expose a minimal API that other modules can consult if needed
try { window.__ns_get_home_slug = () => getHomeSlug(); } catch (_) {}
try { window.__ns_posts_enabled = () => postsEnabled(); } catch (_) {}
async function loadSiteConfig() {
  try {
    // YAML only
    return await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
  } catch (_) { return {}; }
}

function renderSiteLinks(cfg) {
  try {
    callThemeHook('renderSiteLinks', {
      config: cfg,
      document,
      window
    });
  } catch (_) { /* noop */ }
}

function renderSiteIdentity(cfg) {
  try {
    callThemeHook('renderSiteIdentity', {
      config: cfg,
      document,
      window
    });
  } catch (_) { /* noop */ }
}

// Transform standalone internal links (?id=...) into rich article cards
// Load cover images sequentially to reduce bandwidth contention
function updateLayoutLoadingState(view, isLoading, containers = null) {
  const ctx = containers || getViewContainers(view);
  return callThemeHook('updateLayoutLoadingState', {
    view,
    isLoading,
    contentElement: ctx.contentElement,
    sidebarElement: ctx.sidebarElement,
    containerElement: ctx.containerElement,
    containers: ctx,
    document,
    window
  });
}

function renderPostTOCBlock({
  tocElement,
  articleTitle,
  tocHtml
} = {}) {
  return callThemeHook('renderPostTOC', {
    tocElement,
    articleTitle,
    tocHtml,
    translate: t,
    document,
    window
  });
}

function renderErrorState(targetElement, {
  variant = 'error',
  title,
  message,
  actions = [],
  view,
  containers
} = {}) {
  return callThemeHook('renderErrorState', {
    targetElement,
    variant,
    title,
    message,
    actions,
    view,
    containers,
    translate: t,
    document,
    window
  });
}

function notifyThemeViewChange(view, context = {}) {
  return callThemeHook('handleViewChange', {
    view,
    context,
    document,
    window
  });
}

function refreshTagSidebar({
  view,
  containers,
  postsIndex
} = {}) {
  callThemeHook('renderTagSidebar', {
    view,
    containers,
    postsIndex: postsIndex === undefined ? postsIndexCache : postsIndex,
    utilities: {
      aggregateTags,
      renderTagSidebar,
      setupTagTooltips
    },
    document,
    window
  });
}

function initializeSyntaxHighlightingForView(view, { containers } = {}) {
  const handled = callThemeHook('initializeSyntaxHighlighting', {
    view,
    containers,
    initSyntaxHighlighting,
    document,
    window
  });
  if (handled === undefined) {
    try { initSyntaxHighlighting(); } catch (_) {}
  }
}

function resetTOCView(view, containers, { reason, immediate } = {}) {
  const handled = callThemeHook('resetTOC', {
    view,
    containers,
    reason,
    immediate,
    smoothHide,
    document,
    window
  });
  if (handled === undefined) {
    const toc = (containers && containers.tocElement) || getViewContainer(view, 'toc');
    if (!toc) return;
    const clear = () => { try { toc.innerHTML = ''; } catch (_) {}; };
    if (immediate) {
      clear();
      try { toc.hidden = true; } catch (_) {}
      try { toc.style.display = 'none'; } catch (_) {}
      try { toc.setAttribute('aria-hidden', 'true'); } catch (_) {}
      return;
    }
    smoothHide(toc, clear);
  }
}

function enhanceIndexLayout(params = {}) {
  callThemeHook('enhanceIndexLayout', {
    ...params,
    hydrateCardCovers,
    applyLazyLoadingIn,
    applyMasonry,
    debounce,
    renderTagSidebar,
    setupSearch,
    document,
    window
  });
}

// renderSkeletonArticle moved to utils.js

// RenderPostMetaCard moved to ./js/templates.js

// RenderOutdatedCard moved to ./js/templates.js

function renderTabs(activeSlug, searchQuery) {
  callThemeHook('renderTabs', {
    activeSlug,
    searchQuery,
    tabsBySlug,
    getHomeSlug: () => getHomeSlug(),
    getHomeLabel: () => getHomeLabel(),
    postsEnabled: () => postsEnabled(),
    document,
    window
  });
}

// Render footer navigation: Home (All Posts) + custom tabs
function renderFooterNav() {
  callThemeHook('renderFooterNav', {
    tabsBySlug,
    getHomeSlug: () => getHomeSlug(),
    getHomeLabel: () => getHomeLabel(),
    postsEnabled: () => postsEnabled(),
    getQueryVariable,
    withLangParam,
    t,
    document,
    window
  });
}

function displayPost(postname) {
  // Bump request token to invalidate any in-flight older renders
  const reqId = (++__activePostRequestId);
  const containers = getViewContainers('post');

  updateLayoutLoadingState('post', true, containers);

  callThemeHook('renderPostLoadingState', {
    view: 'post',
    containers,
    translator: t,
    ensureAutoHeight,
    showElement: smoothShow,
    hideElement: smoothHide,
    document,
    window
  });

  notifyThemeViewChange('post', { showSearch: false, showTags: false });

  return getFile(`${getContentRoot()}/${postname}`).then(markdown => {
    // Ignore stale responses if a newer navigation started
    if (reqId !== __activePostRequestId) return;
    // Remove loading-state classes
    updateLayoutLoadingState('post', false, containers);

    const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
    const baseDir = `${getContentRoot()}/${dir}`;
    const output = mdParse(markdown, baseDir);
    const fallbackTitle = postsByLocationTitle[postname] || postname;

    let postEntry = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => v && v.location === postname);
    let postMetadata = postEntry ? { ...postEntry[1] } : {};
    if (postMetadata && Array.isArray(postMetadata.versions)) {
      postMetadata.versions = postMetadata.versions.map(ver => ({ ...ver }));
    }
    if (!postEntry) {
      const found = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => Array.isArray(v && v.versions) && v.versions.some(ver => ver && ver.location === postname));
      if (found) {
        const baseMeta = found[1] || {};
        const match = (baseMeta.versions || []).find(ver => ver.location === postname) || {};
        postMetadata = { ...match };
        postMetadata.versions = Array.isArray(baseMeta.versions) ? baseMeta.versions.map(ver => ({ ...ver })) : [];
        if (baseMeta && baseMeta.title && !postMetadata.title) {
          postMetadata.title = baseMeta.title;
        }
      }
    }
    if (postMetadata && !postMetadata.title) {
      const resolvedTitle = postsByLocationTitle[postname] || fallbackTitle;
      if (resolvedTitle) postMetadata.title = resolvedTitle;
    }

    const hookResult = callThemeHook('renderPostView', {
      view: 'post',
      containers,
      markdownHtml: output.post,
      tocHtml: output.toc,
      markdown,
      fallbackTitle,
      postMetadata,
      postId: postname,
      siteConfig,
      postsIndex: postsIndexCache,
      postsByLocationTitle,
      allowedLocations,
      locationAliasMap,
      translate: t,
      document,
      window,
      utilities: {
        renderPostNav,
        hydratePostImages,
        hydratePostVideos,
        hydrateInternalLinkCards,
        applyLazyLoadingIn,
        applyLangHints,
        renderPostTOC: (opts) => renderPostTOCBlock(opts),
        renderTagSidebar,
        getArticleTitleFromMain,
        setupAnchors,
        setupTOC,
        ensureAutoHeight,
        getFile,
        getContentRoot,
        withLangParam,
        fetchMarkdown: (loc) => getFile(`${getContentRoot()}/${loc}`),
        makeLangHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
      }
    }) || {};

    let articleTitle = fallbackTitle;
    let decorated = false;
    if (typeof hookResult === 'object') {
      decorated = !!hookResult.decorated;
      if (hookResult.title) articleTitle = String(hookResult.title);
    }

    if (!decorated) {
      const mainEl = containers.mainElement || getViewContainer('post', 'main');
      callThemeHook('decoratePostView', {
        view: 'post',
        container: mainEl,
        articleTitle,
        postMetadata,
        markdown,
        translate: t,
        document,
        window
      });
    }

    notifyThemeViewChange('post', { showSearch: false, showTags: false });
    try { setDocTitle(articleTitle); } catch (_) {}
    initializeSyntaxHighlightingForView('post', { containers });
    refreshTagSidebar({ view: 'post', containers, postsIndex: postsIndexCache });

    try {
      const seoData = extractSEOFromMarkdown(markdown, {
        ...postMetadata,
        title: articleTitle,
        location: postname
      }, siteConfig);
      updateSEO(seoData, siteConfig);
    } catch (_) { /* ignore SEO errors */ }

    renderTabs('post', articleTitle);

    // Let theme handle hash-based scrolling if desired; fallback to previous behavior
    const currentHash = (location.hash || '').replace(/^#/, '');
    const handledHash = callThemeHook('scrollToHash', {
      hash: currentHash,
      view: 'post',
      containers,
      document,
      window
    });
    if (handledHash === undefined && currentHash) {
      const target = document.getElementById(currentHash);
      if (target) {
        requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); });
      } else {
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          history.replaceState({}, '', url.toString());
        } catch (_) {}
        try { window.scrollTo(0, 0); } catch (_) {}
      }
    }
  }).catch(() => {
    // Ignore stale errors if a newer navigation started
    if (reqId !== __activePostRequestId) return;
    // Remove loading-state classes even on error
    updateLayoutLoadingState('post', false, containers);

    // Surface an overlay for missing post (e.g., 404)
    try {
      const err = new Error((t('errors.postNotFoundBody') || 'The requested post could not be loaded.'));
      try { err.name = 'Warning'; } catch(_) {}
      showErrorOverlay(err, {
        message: err.message,
        origin: 'view.post.notfound',
        filename: `${getContentRoot()}/${postname}`,
        assetUrl: `${getContentRoot()}/${postname}`,
        id: postname
      });
    } catch (_) {}

    resetTOCView('post', containers, { reason: 'postError' });
    const backHref = withLangParam(`?tab=${encodeURIComponent(getHomeSlug())}`);
    const backText = postsEnabled() ? t('ui.backToAllPosts') : (t('ui.backToHome') || t('ui.backToAllPosts'));
    renderErrorState(containers.mainElement || getViewContainer('post', 'main'), {
      title: t('errors.postNotFoundTitle'),
      message: t('errors.postNotFoundBody'),
      actions: [{ href: backHref, label: backText }],
      view: 'post',
      containers
    });
    setDocTitle(t('ui.notFound'));
    notifyThemeViewChange('post', { showSearch: false, showTags: false });
  });
}

function displayIndex(parsed) {
  const containers = getViewContainers('posts');
  resetTOCView('posts', containers, { reason: 'index' });

  // Build an entries array strictly following index.yaml order when available
  const entries = (function entriesInIndexYamlOrder(map) {
    try {
      const source = map && typeof map === 'object' ? map : {};
      // If we don't have the raw index, fall back to object insertion order
      if (!rawIndexCache || typeof rawIndexCache !== 'object') return Object.entries(source);

      const cur = (getCurrentLang && getCurrentLang()) || 'en';
      const curNorm = normalizeLangKey(cur);
      const siteDef = (typeof siteConfig === 'object' && (siteConfig.defaultLanguage || siteConfig.defaultLang)) || 'en';
      const defNorm = normalizeLangKey(siteDef);

      const RESERVED = new Set(['tag','tags','image','date','excerpt','thumb','cover']);
      const seen = new Set();
      const ordered = [];

      const pickPreferred = (entry) => {
        const variants = [];
        try {
          for (const [k, v] of Object.entries(entry || {})) {
            if (RESERVED.has(k)) continue;
            const nk = normalizeLangKey(k);
            if (k === 'location' && typeof v === 'string') {
              variants.push({ lang: 'default', location: String(v) });
            } else if (typeof v === 'string') {
              variants.push({ lang: nk, location: String(v) });
            } else if (Array.isArray(v)) {
              v.forEach(item => { if (typeof item === 'string') variants.push({ lang: nk, location: String(item) }); });
            } else if (v && typeof v === 'object' && typeof v.location === 'string') {
              variants.push({ lang: nk, location: String(v.location) });
            }
          }
        } catch (_) {}
        if (!variants.length) return '';
        const findBy = (langs) => variants.find(x => langs.includes(x.lang));
        const cand = findBy([curNorm]) || findBy([defNorm]) || findBy(['en']) || findBy(['default']) || variants[0];
        return (cand && cand.location) ? String(cand.location) : '';
      };

      // Iterate raw index keys in author-defined order
      for (const [, rawEntry] of Object.entries(rawIndexCache)) {
        if (!rawEntry || typeof rawEntry !== 'object') continue;
        const prefLoc = pickPreferred(rawEntry);
        if (!prefLoc) continue;
        const title = postsByLocationTitle[prefLoc];
        if (!title) continue;
        if (seen.has(title)) continue;
        const meta = source[title];
        if (!meta) continue;
        seen.add(title);
        ordered.push([title, meta]);
      }

      // Append any remaining entries not present in raw index (defensive)
      for (const [title, meta] of Object.entries(source)) {
        if (seen.has(title)) continue;
        ordered.push([title, meta]);
      }
      return ordered;
    } catch (_) {
      return Object.entries(map || {});
    }
  })(parsed);
  const total = entries.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  let totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  let pageEntries = entries.slice(start, end);
  // Allow theme to customize pagination behavior (e.g., infinite scroll)
  try {
    const paginated = callThemeHook('paginateEntries', {
      view: 'posts',
      entries,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      document,
      window
    });
    if (paginated && typeof paginated === 'object') {
      if (Array.isArray(paginated.pageEntries)) pageEntries = paginated.pageEntries;
      if (typeof paginated.page === 'number' && !isNaN(paginated.page)) {
        // Keep local variables in sync so renderers receive consistent values
        const newPage = Math.max(1, paginated.page);
        if (newPage !== page) {
          page = newPage;
          totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          const npStart = (newPage - 1) * PAGE_SIZE;
          const npEnd = npStart + PAGE_SIZE;
          if (!Array.isArray(paginated.pageEntries)) pageEntries = entries.slice(npStart, npEnd);
        }
      }
      if (typeof paginated.totalPages === 'number' && !isNaN(paginated.totalPages)) {
        totalPages = Math.max(1, paginated.totalPages);
      }
    }
  } catch (_) { /* ignore pagination hook issues */ }

  const mainview = containers.mainElement || getViewContainer('posts', 'main');
  callThemeHook('renderIndexView', {
    view: 'posts',
    containers,
    container: mainview,
    entries,
    pageEntries,
    page,
    total,
    totalPages,
    pageSize: PAGE_SIZE,
    siteConfig,
    withLangParam,
    translate: t,
    getHomeSlug: () => getHomeSlug(),
    postsEnabled: () => postsEnabled(),
    window,
    document
  });
  enhanceIndexLayout({
    view: 'posts',
    containers,
    containerElement: mainview,
    allEntries: entries,
    pageEntries,
    total,
    page,
    totalPages,
    postsIndexMap: postsIndexCache,
    siteConfig
  });

  renderTabs('posts');
  notifyThemeViewChange('posts', { showSearch: true, showTags: true, queryValue: '' });
  setDocTitle(t('titles.allPosts'));

  callThemeHook('afterIndexRender', {
    entries: pageEntries,
    translate: t,
    getFile,
    getContentRoot,
    extractExcerpt,
    computeReadTime,
    document,
    window,
    updateMasonryItem,
    siteConfig
  });
}

function displaySearch(query) {
  const rawTag = getQueryVariable('tag');
  const q = String(query || '').trim();
  const tagFilter = rawTag ? String(rawTag).trim() : '';
  if (!q && !tagFilter) return displayIndex(postsIndexCache);

  const containers = getViewContainers('search');
  resetTOCView('search', containers, { reason: 'search' });

  // Filter by title or tags; allow theme to override
  const allEntries = Object.entries(postsIndexCache || {});
  const defaultFilter = (entries, query, tag) => {
    const ql = String(query || '').toLowerCase();
    const tagl = String(tag || '').toLowerCase();
    return entries.filter(([title, meta]) => {
      const tagVal = meta && meta.tag;
      const tags = Array.isArray(tagVal)
        ? tagVal.map(x => String(x))
        : (typeof tagVal === 'string' ? String(tagVal).split(',') : (tagVal != null ? [String(tagVal)] : []));
      const normTags = tags.map(s => s.trim()).filter(Boolean);
      if (tag) {
        return normTags.some(tg => tg.toLowerCase() === tagl);
      }
      const inTitle = String(title || '').toLowerCase().includes(ql);
      const inTags = normTags.some(tg => tg.toLowerCase().includes(ql));
      return inTitle || inTags;
    });
  };
  let filtered = null;
  try {
    const themed = callThemeHook('filterSearchEntries', {
      view: 'search',
      entries: allEntries,
      query: q,
      tagFilter,
      postsIndexMap: postsIndexCache,
      siteConfig,
      utilities: { defaultFilter },
      document,
      window
    });
    if (Array.isArray(themed)) filtered = themed;
  } catch (_) { /* ignore search hook issues */ }
  if (!Array.isArray(filtered)) filtered = defaultFilter(allEntries, q, tagFilter);

  const total = filtered.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  let totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  let pageEntries = filtered.slice(start, end);
  try {
    const paginated = callThemeHook('paginateEntries', {
      view: 'search',
      entries: filtered,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      query: q,
      tagFilter,
      document,
      window
    });
    if (paginated && typeof paginated === 'object') {
      if (Array.isArray(paginated.pageEntries)) pageEntries = paginated.pageEntries;
      if (typeof paginated.page === 'number' && !isNaN(paginated.page)) {
        const newPage = Math.max(1, paginated.page);
        if (newPage !== page) {
          page = newPage;
          totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          const npStart = (newPage - 1) * PAGE_SIZE;
          const npEnd = npStart + PAGE_SIZE;
          if (!Array.isArray(paginated.pageEntries)) pageEntries = filtered.slice(npStart, npEnd);
        }
      }
      if (typeof paginated.totalPages === 'number' && !isNaN(paginated.totalPages)) {
        totalPages = Math.max(1, paginated.totalPages);
      }
    }
  } catch (_) { /* ignore pagination hook issues */ }

  const mainview = containers.mainElement || getViewContainer('search', 'main');
  callThemeHook('renderSearchResults', {
    view: 'search',
    containers,
    container: mainview,
    entries: pageEntries,
    total,
    page,
    totalPages,
    query: q,
    tagFilter,
    siteConfig,
    withLangParam,
    translate: t,
    getHomeSlug: () => getHomeSlug(),
    postsEnabled: () => postsEnabled(),
    window,
    document
  });
  enhanceIndexLayout({
    view: 'search',
    containers,
    containerElement: mainview,
    allEntries: Object.entries(postsIndexCache || {}),
    pageEntries,
    total,
    page,
    totalPages,
    postsIndexMap: postsIndexCache,
    siteConfig,
    query: q,
    tagFilter
  });

  renderTabs('search', tagFilter ? t('ui.tagSearch', tagFilter) : q);
  notifyThemeViewChange('search', { showSearch: true, showTags: true, queryValue: q, tagFilter });
  setDocTitle(tagFilter ? t('ui.tagSearch', tagFilter) : t('titles.search', q));

  callThemeHook('afterSearchRender', {
    entries: pageEntries,
    translate: t,
    getFile,
    getContentRoot,
    extractExcerpt,
    computeReadTime,
    document,
    window,
    updateMasonryItem,
    siteConfig
  });
}

function displayStaticTab(slug) {
  const tab = tabsBySlug[slug];
  if (!tab) return displayIndex({});

  const containers = getViewContainers('tab');

  updateLayoutLoadingState('tab', true, containers);

  resetTOCView('tab', containers, { reason: 'staticTab' });
  const main = containers.mainElement || getViewContainer('tab', 'main');
  callThemeHook('renderStaticTabLoadingState', {
    view: 'tab',
    containers,
    document,
    window
  });
  notifyThemeViewChange('tab', { showSearch: false, showTags: false });
  renderTabs(slug);
  getFile(`${getContentRoot()}/${tab.location}`)
    .then(md => {
      // 移除加载状态类
      updateLayoutLoadingState('tab', false, containers);

      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `${getContentRoot()}/${dir}`;
      const output = mdParse(md, baseDir);

      const hookResult = callThemeHook('renderStaticTabView', {
        view: 'tab',
        containers,
        markdownHtml: output.post,
        tocHtml: output.toc,
        markdown: md,
        tab,
        slug,
        siteConfig,
        postsByLocationTitle,
        allowedLocations,
        locationAliasMap,
        translate: t,
        document,
        window,
        utilities: {
          hydratePostImages,
          hydratePostVideos,
          hydrateInternalLinkCards,
          applyLazyLoadingIn,
          applyLangHints,
          renderPostTOC: (opts) => renderPostTOCBlock(opts),
          renderTagSidebar,
          getArticleTitleFromMain,
          setupAnchors,
          setupTOC,
          ensureAutoHeight,
          getFile,
          getContentRoot,
          withLangParam,
          fetchMarkdown: (loc) => getFile(`${getContentRoot()}/${loc}`),
          makeLangHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
        }
      }) || {};

      let pageTitle = tab.title;
      if (typeof hookResult === 'object') {
        if (hookResult.title) pageTitle = String(hookResult.title);
      }

      initializeSyntaxHighlightingForView('tab', { containers });
      refreshTagSidebar({ view: 'tab', containers, postsIndex: postsIndexCache });

      try {
        const seoData = extractSEOFromMarkdown(md, {
          title: pageTitle,
          author: tab.author || 'NanoSite',
          location: tab.location
        }, siteConfig);
        updateSEO(seoData, siteConfig);
      } catch (_) {}

      try { setDocTitle(pageTitle); } catch (_) {}
    })
    .catch((e) => {
      // 移除加载状态类，即使出错也要移除
      updateLayoutLoadingState('tab', false, containers);

      // Surface an overlay for missing static tab page
      try {
        const url = `${getContentRoot()}/${tab.location}`;
        const msg = (t('errors.pageUnavailableBody') || 'Could not load this tab.') + (e && e.message ? ` (${e.message})` : '');
        const err = new Error(msg);
        try { err.name = 'Warning'; } catch(_) {}
        showErrorOverlay(err, { message: msg, origin: 'view.tab.unavailable', tagName: 'md', filename: url, assetUrl: url, tab: slug });
      } catch (_) {}

      renderErrorState(containers.mainElement || getViewContainer('tab', 'main'), {
        title: t('errors.pageUnavailableTitle'),
        message: t('errors.pageUnavailableBody'),
        view: 'tab',
        containers
      });
      setDocTitle(t('ui.pageUnavailable'));
    });
}

// Simple router: render based on current URL
function routeAndRender() {
  const rawId = getQueryVariable('id');
  // Always apply cross-language aliasing when available so switching language rewrites to the correct variant
  const id = (rawId && locationAliasMap.has(rawId)) ? locationAliasMap.get(rawId) : rawId;
  // Reflect remapped ID in the URL without triggering navigation
  try {
    if (id && rawId && id !== rawId) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      history.replaceState({}, '', url.toString());
    }
  } catch (_) {}
  const tabParam = (getQueryVariable('tab') || '').toLowerCase();
  const homeSlug = getHomeSlug();
  let tab = tabParam || homeSlug;
  // If posts are disabled but someone navigates to ?tab=posts, treat it as home
  if (!postsEnabled() && tab === 'posts') tab = homeSlug;
  const isValidId = (x) => typeof x === 'string' && !x.includes('..') && !x.startsWith('/') && !x.includes('\\') && allowedLocations.has(x);

  // Capture current navigation state for error reporting
  try {
    const route = (() => {
      if (isValidId(id)) {
        return { view: 'post', id, title: postsByLocationTitle[id] || null };
      }
      if (tab === 'search') {
        const q = getQueryVariable('q') || '';
        return { view: 'search', q };
      }
      if (tab !== 'posts' && tabsBySlug[tab]) {
        return { view: 'tab', tab, title: (tabsBySlug[tab] && tabsBySlug[tab].title) || tab };
      }
      const page = parseInt(getQueryVariable('page') || '1', 10);
      return { view: 'posts', page: isNaN(page) ? 1 : page };
    })();
    setReporterContext({ route, routeUpdatedAt: new Date().toISOString() });
  } catch (_) { /* ignore */ }

  if (isValidId(id)) {
    renderTabs('post');
    displayPost(id);
  } else if (tab === 'search') {
    const q = getQueryVariable('q') || '';
    const tag = getQueryVariable('tag') || '';
  renderTabs('search', tag || q);
    displaySearch(q);
    // Update SEO for search page
    try {
      const localizedTitle = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
      const baseSite = (() => { try { return document.title.split('·').slice(1).join('·').trim(); } catch { return ''; } })();
      const title = baseSite ? `${localizedTitle} - ${baseSite}` : localizedTitle;
      updateSEO({
        title,
        description: tag ? `Posts tagged "${tag}"` : (q ? `Search results for "${q}"` : 'Search through blog posts and content'),
        type: 'website'
      }, siteConfig);
    } catch (_) { /* ignore SEO errors to avoid breaking UI */ }
  } else if (tab !== 'posts' && tabsBySlug[tab]) {
    displayStaticTab(tab);
  } else {
    renderTabs('posts');
    displayIndex(postsIndexCache);
    // Update SEO for home/posts page
    const page = parseInt(getQueryVariable('page') || '1', 10);
    const lang = getCurrentLang && getCurrentLang();
    const getLocalizedValue = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      return (lang && val[lang]) || val.default || '';
    };
    
    try {
      updateSEO({
        title: page > 1 ? 
          `${getLocalizedValue(siteConfig.siteTitle) || 'All Posts'} - Page ${page}` : 
          getLocalizedValue(siteConfig.siteTitle) || 'NanoSite - Zero-Dependency Static Blog',
        description: getLocalizedValue(siteConfig.siteDescription) || 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.',
        type: 'website',
        url: window.location.href
      }, siteConfig);
    } catch (_) { /* ignore SEO errors to avoid breaking UI */ }
  }
  // Keep footer nav in sync as route/tabs may impact labels
  renderFooterNav();
}


// Intercept in-app navigation and use History API
// isModifiedClick moved to utils.js

document.addEventListener('click', (e) => {
  if (callThemeHook('handleDocumentClick', { event: e, document, window })) return;
  const a = e.target && e.target.closest ? e.target.closest('a') : null;
  if (!a) return;

  if (isModifiedClick(e)) return;
  const hrefAttr = a.getAttribute('href') || '';
  // Allow any in-page hash links (e.g., '#', '#heading' or '?id=...#heading')
  if (hrefAttr.includes('#')) return;
  // External targets or explicit new tab
  if (a.target && a.target === '_blank') return;
  try {
    const url = new URL(a.href, window.location.href);
    // Only handle same-origin and same-path navigations
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== window.location.pathname) return;
    const sp = url.searchParams;
    const hasInAppParams = sp.has('id') || sp.has('tab') || url.search === '';
    if (!hasInAppParams) return;
    e.preventDefault();
    const prevKey = __lastRouteKey || getCurrentRouteKey();
    history.pushState({}, '', url.toString());
    routeAndRender();
    const nextKey = getCurrentRouteKey();
    const handled = callThemeHook('handleRouteScroll', {
      reason: 'push',
      prevKey,
      nextKey,
      document,
      window
    });
    if (handled === undefined) {
      try { window.scrollTo(0, 0); } catch (_) {}
    }
    __lastRouteKey = nextKey;
  } catch (_) {
    // If URL parsing fails, fall through to default navigation
  }
});

window.addEventListener('popstate', () => {
  const prevKey = __lastRouteKey || getCurrentRouteKey();
  routeAndRender();
  refreshTagSidebar({ postsIndex: postsIndexCache });
  try {
    const curKey = getCurrentRouteKey();
    const handled = callThemeHook('handleRouteScroll', {
      reason: 'popstate',
      prevKey,
      nextKey: curKey,
      document,
      window
    });
    if (handled === undefined) {
      // Fallback: if navigating between different post IDs, scroll to top
      if (prevKey && prevKey.startsWith('post:') && curKey.startsWith('post:') && prevKey !== curKey) {
        try { window.scrollTo(0, 0); } catch (_) {}
      }
    }
    __lastRouteKey = curKey;
  } catch (_) {}
});

// Update sliding indicator on window resize
window.addEventListener('resize', (event) => {
  callThemeHook('handleWindowResize', { event, document, window });
});

// Boot
// Boot sequence overview:
// 1) Initialize i18n (detects ?lang → localStorage → browser → default or <html lang>)
// 2) Mount theme tools and apply saved theme
// 3) Load localized index/tabs JSON with fallback chain and render
// Initialize i18n first so localized UI renders correctly
const defaultLang = (document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
// Bootstrap i18n without persisting to localStorage so site.yaml can
// still override the default language on first load.
await initI18n({ defaultLang, persist: false });
// Expose translate helper for modules that don't import i18n directly
try { window.__ns_t = (key) => t(key); } catch (_) { /* no-op */ }

// Install error reporter early to catch resource 404s (e.g., theme CSS, images)
try { initErrorReporter({}); } catch (_) {}

let siteConfigResult = {};
try {
  siteConfigResult = await loadSiteConfig();
} catch (_) {
  siteConfigResult = {};
}
siteConfig = siteConfigResult || {};

// Apply content root override early so subsequent loads honor it
try {
  const rawRoot = (siteConfig && (siteConfig.contentRoot || siteConfig.contentBase || siteConfig.contentPath)) || 'wwwroot';
  if (typeof window !== 'undefined') window.__ns_content_root = String(rawRoot).replace(/^\/+|\/+$/g, '');
} catch (_) {}

// Apply site-configured defaults early
try {
  // 1) Page size (pagination)
  const cfgPageSize = (siteConfig && (siteConfig.pageSize || siteConfig.postsPerPage));
  if (cfgPageSize != null) {
    const n = parseInt(cfgPageSize, 10);
    if (!isNaN(n) && n > 0) PAGE_SIZE = n;
  }
  // 2) Default language: honor only when user hasn't chosen via URL/localStorage
  const cfgDefaultLang = (siteConfig && (siteConfig.defaultLanguage || siteConfig.defaultLang));
  if (cfgDefaultLang) {
    let hasUrlLang = false;
    try { const u = new URL(window.location.href); hasUrlLang = !!u.searchParams.get('lang'); } catch (_) {}
    let savedLang = '';
    try { savedLang = String(localStorage.getItem('lang') || ''); } catch (_) {}
    const hasSaved = !!savedLang;
    const htmlDefault = String(defaultLang || 'en').toLowerCase();
    const savedIsHtmlDefault = savedLang && savedLang.toLowerCase() === htmlDefault;
    if (!hasUrlLang && (!hasSaved || savedIsHtmlDefault)) {
      await initI18n({ lang: String(cfgDefaultLang) });
    }
  }
} catch (_) { /* ignore site default application errors */ }

// Apply site-controlled theme after loading config
try {
  applyThemeConfig(siteConfig);
} catch (_) {}

// Build layout according to the active theme pack before binding UI logic
await ensureThemeLayout();

// Ensure theme controls are present, then apply and bind
const controlsHandled = callThemeHook('setupThemeControls', {
  mountThemeControls,
  applySavedTheme,
  bindThemeToggle,
  bindPostEditor,
  bindThemePackPicker,
  document,
  window
});
if (controlsHandled === undefined) {
  try { applySavedTheme(); } catch (_) {}
}

// Localize search placeholder ASAP
callThemeHook('updateSearchPlaceholder', {
  placeholder: t('sidebar.searchPlaceholder'),
  document,
  window
});

// Observe viewport changes for responsive tabs
callThemeHook('setupResponsiveTabsObserver', {
  getTabs: () => tabsBySlug,
  document,
  window,
  renderTabs
});

// Reflect theme config in the layout (e.g., data attributes)
try {
  callThemeHook('reflectThemeConfig', {
    config: siteConfig,
    document,
    window
  });
} catch (_) {}

// Soft reset to the site's default language without full reload
async function softResetToSiteDefaultLanguage() {
  try {
    const def = (siteConfig && (siteConfig.defaultLanguage || siteConfig.defaultLang)) || defaultLang || 'en';
    // Switch language immediately (do not persist to mimic reset semantics)
    await initI18n({ lang: String(def), persist: false });
    // Reflect placeholder promptly
    callThemeHook('updateSearchPlaceholder', {
      placeholder: t('sidebar.searchPlaceholder'),
      document,
      window
    });
    // Update URL to drop any lang param so defaults apply going forward
    try { const u = new URL(window.location.href); u.searchParams.delete('lang'); history.replaceState(history.state, document.title, u.toString()); } catch (_) {}
  } catch (_) {}
  // Reload localized content and tabs for the new language, then rerender
  try {
    const results = await Promise.allSettled([
      loadContentJson(getContentRoot(), 'index'),
      loadTabsJson(getContentRoot(), 'tabs'),
      (async () => { try { const cr = getContentRoot(); const obj = await fetchConfigWithYamlFallback([`${cr}/index.yaml`,`${cr}/index.yml`]); return (obj && typeof obj === 'object') ? obj : null; } catch (_) { return null; } })()
    ]);
    const posts = results[0].status === 'fulfilled' ? (results[0].value || {}) : {};
    const tabs = results[1].status === 'fulfilled' ? (results[1].value || {}) : {};
    const rawIndex = results[2] && results[2].status === 'fulfilled' ? (results[2].value || null) : null;
    // Cache raw index for stable ordering
    rawIndexCache = rawIndex && typeof rawIndex === 'object' ? rawIndex : null;

    // Rebuild tabs and caches (mirrors boot path)
    tabsBySlug = {};
    stableToCurrentTabSlug = {};
    for (const [title, cfg] of Object.entries(tabs)) {
      const unifiedSlug = (cfg && typeof cfg === 'object' && cfg.slug) ? String(cfg.slug) : null;
      const slug = unifiedSlug || slugifyTab(title);
      const loc = typeof cfg === 'string' ? cfg : String(cfg.location || '');
      if (!loc) continue;
      tabsBySlug[slug] = { title, location: loc };
      const baseKey = (unifiedSlug ? unifiedSlug : slug);
      stableToCurrentTabSlug[baseKey] = slug;
    }

    const baseAllowed = new Set();
    Object.values(posts).forEach(v => {
      if (!v) return;
      if (v.location) baseAllowed.add(String(v.location));
      if (Array.isArray(v.versions)) v.versions.forEach(ver => { if (ver && ver.location) baseAllowed.add(String(ver.location)); });
    });
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      try {
        for (const [, entry] of Object.entries(rawIndex)) {
          if (!entry || typeof entry !== 'object') continue;
          for (const [k, v] of Object.entries(entry)) {
            if (['tag','tags','image','date','excerpt','thumb','cover'].includes(k)) continue;
            if (k === 'location' && typeof v === 'string') { baseAllowed.add(String(v)); continue; }
            if (Array.isArray(v)) { v.forEach(item => { if (typeof item === 'string') baseAllowed.add(String(item)); }); continue; }
            if (v && typeof v === 'object' && typeof v.location === 'string') baseAllowed.add(String(v.location));
            else if (typeof v === 'string') baseAllowed.add(String(v));
          }
        }
      } catch (_) {}
    }
  // Wire up version selector(s) (if multiple versions available)
    allowedLocations = baseAllowed;
    postsByLocationTitle = {};
    for (const [title, meta] of Object.entries(posts)) {
      if (meta && meta.location) postsByLocationTitle[meta.location] = title;
      if (meta && Array.isArray(meta.versions)) meta.versions.forEach(ver => { if (ver && ver.location) postsByLocationTitle[ver.location] = title; });
    }
    postsIndexCache = posts;
    locationAliasMap = new Map();
    try {
      if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
        const cur = (getCurrentLang && getCurrentLang()) || 'en';
        const curNorm = normalizeLangKey(cur);
        for (const [, entry] of Object.entries(rawIndex)) {
          if (!entry || typeof entry !== 'object') continue;
          const reserved = new Set(['tag','tags','image','date','excerpt','thumb','cover']);
          const variants = [];
          for (const [k, v] of Object.entries(entry)) {
            if (reserved.has(k)) continue;
            const nk = normalizeLangKey(k);
            if (k === 'location' && typeof v === 'string') {
              variants.push({ lang: 'default', location: String(v) });
            } else if (typeof v === 'string') {
              variants.push({ lang: nk, location: String(v) });
            } else if (Array.isArray(v)) {
              // For version arrays, include all paths for aliasing
              v.forEach(item => { if (typeof item === 'string') variants.push({ lang: nk, location: String(item) }); });
            } else if (v && typeof v === 'object' && typeof v.location === 'string') {
              variants.push({ lang: nk, location: String(v.location) });
            }
          }
          if (!variants.length) continue;
          const findBy = (langs) => variants.find(x => langs.includes(x.lang));
          // Prefer the primary location for the current language as computed in postsIndexCache
          let chosen = null;
          let chosenLocation = null;
          try {
            const seed = findBy([curNorm]) || findBy(['en']) || findBy(['default']) || variants[0];
            if (seed && postsByLocationTitle && postsIndexCache) {
              const title = postsByLocationTitle[seed.location];
              const meta = title ? postsIndexCache[title] : null;
              if (meta && meta.location) chosenLocation = String(meta.location);
            }
          } catch (_) {}
          if (chosenLocation) {
            chosen = { lang: curNorm, location: chosenLocation };
          } else {
            chosen = findBy([curNorm]) || findBy(['en']) || findBy(['default']) || variants[0];
            if (!chosen) chosen = variants[0];
          }
          variants.forEach(v => { if (v.location && chosen.location && v.lang !== curNorm) locationAliasMap.set(v.location, chosen.location); });
        }
      }
    } catch (_) {}
    try { refreshLanguageSelector(); } catch (_) {}
    // Rebuild the Tools panel so all labels reflect the new language
    try {
      callThemeHook('resetThemeControls', {
        document,
        window,
        mountThemeControls,
        applySavedTheme,
        bindThemeToggle,
        bindThemePackPicker,
        refreshLanguageSelector
      });
    } catch (_) {}
    try {
      renderSiteIdentity(siteConfig);
      const cfgTitle = (function pick(val){
        if (!val) return '';
        if (typeof val === 'string') return val;
        const lang = getCurrentLang && getCurrentLang();
        const v = (lang && val[lang]) || val.default || '';
        return typeof v === 'string' ? v : '';
      })(siteConfig && siteConfig.siteTitle);
      if (cfgTitle) setBaseSiteTitle(cfgTitle);
    } catch (_) {}
    try { renderSiteLinks(siteConfig); } catch (_) {}
    try {
      const lang = getCurrentLang && getCurrentLang();
      const getLocalizedValue = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang && val[lang]) || val.default || '';
      };
      updateSEO({
        title: getLocalizedValue(siteConfig.siteTitle) || 'NanoSite - Zero-Dependency Static Blog',
        description: getLocalizedValue(siteConfig.siteDescription) || 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.',
        type: 'website', url: window.location.href
      }, siteConfig);
    } catch (_) {}
    routeAndRender();
    bindPostsMetadataListener();
  } catch (_) {
    try { window.location.reload(); } catch (__) {}
  }
}
// Expose as a global so the UI can call it
try { window.__ns_softResetLang = () => softResetToSiteDefaultLanguage(); } catch (_) {}

// Now fetch localized content and tabs for the (possibly updated) language
const loadResults = await Promise.allSettled([
  loadContentJson(getContentRoot(), 'index'),
  loadTabsJson(getContentRoot(), 'tabs'),
  (async () => {
    try {
      const cr = getContentRoot();
      const obj = await fetchConfigWithYamlFallback([`${cr}/index.yaml`, `${cr}/index.yml`]);
      return (obj && typeof obj === 'object') ? obj : null;
    } catch (_) { return null; }
  })()
]);

try {
  const posts = loadResults[0].status === 'fulfilled' ? (loadResults[0].value || {}) : {};
  const tabs = loadResults[1].status === 'fulfilled' ? (loadResults[1].value || {}) : {};
  const rawIndex = loadResults[2] && loadResults[2].status === 'fulfilled' ? (loadResults[2].value || null) : null;
  // Cache raw index for stable ordering
  rawIndexCache = rawIndex && typeof rawIndex === 'object' ? rawIndex : null;
    tabsBySlug = {};
    stableToCurrentTabSlug = {};
    for (const [title, cfg] of Object.entries(tabs)) {
      // Prefer a stable slug coming from unified tabs (when available); fallback to computed slug
      const unifiedSlug = (cfg && typeof cfg === 'object' && cfg.slug) ? String(cfg.slug) : null;
      const slug = unifiedSlug || slugifyTab(title);
      const loc = typeof cfg === 'string' ? cfg : String(cfg.location || '');
      if (!loc) continue;
      tabsBySlug[slug] = { title, location: loc };
      // Map stable base slug to current slug to preserve active tab across language switches
      const baseKey = (unifiedSlug ? unifiedSlug : slug);
      stableToCurrentTabSlug[baseKey] = slug;
    }
    // Build a whitelist of allowed post file paths. Start with the current-language
    // transformed entries, then include any language-variant locations discovered
    // from the raw unified index.yaml (if present).
    const baseAllowed = new Set();
    Object.values(posts).forEach(v => {
      if (!v) return;
      if (v.location) baseAllowed.add(String(v.location));
      if (Array.isArray(v.versions)) v.versions.forEach(ver => { if (ver && ver.location) baseAllowed.add(String(ver.location)); });
    });
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      try {
        for (const [, entry] of Object.entries(rawIndex)) {
          if (!entry || typeof entry !== 'object') continue;
          for (const [k, v] of Object.entries(entry)) {
            // Skip known non-variant keys
            if (['tag','tags','image','date','excerpt','thumb','cover'].includes(k)) continue;
            const nk = normalizeLangKey(k);
            const cur = (getCurrentLang && getCurrentLang()) || 'en';
            const curNorm = normalizeLangKey(cur);
            const allowLang = (nk === 'default' || nk === curNorm || k === 'location');
            if (!allowLang) continue;
            // Support both unified and legacy shapes (only for allowed languages)
            if (k === 'location' && typeof v === 'string') { baseAllowed.add(String(v)); continue; }
            if (Array.isArray(v)) { v.forEach(item => { if (typeof item === 'string') baseAllowed.add(String(item)); }); continue; }
            if (v && typeof v === 'object' && typeof v.location === 'string') baseAllowed.add(String(v.location));
            else if (typeof v === 'string') baseAllowed.add(String(v));
          }
        }
      } catch (_) { /* ignore parse issues */ }
    }
    allowedLocations = baseAllowed;
    postsByLocationTitle = {};
    for (const [title, meta] of Object.entries(posts)) {
      if (meta && meta.location) postsByLocationTitle[meta.location] = title;
      if (meta && Array.isArray(meta.versions)) meta.versions.forEach(ver => { if (ver && ver.location) postsByLocationTitle[ver.location] = title; });
    }
    postsIndexCache = posts;
    // Build cross-language location alias map so switching languages keeps the same article
    locationAliasMap = new Map();
    try {
      if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
        const cur = (getCurrentLang && getCurrentLang()) || 'en';
        const curNorm = normalizeLangKey(cur);
        for (const [, entry] of Object.entries(rawIndex)) {
          if (!entry || typeof entry !== 'object') continue;
          const reserved = new Set(['tag','tags','image','date','excerpt','thumb','cover']);
          const variants = [];
          for (const [k, v] of Object.entries(entry)) {
            if (reserved.has(k)) continue;
            const nk = normalizeLangKey(k);
            if (k === 'location' && typeof v === 'string') {
              variants.push({ lang: 'default', location: String(v) });
            } else if (typeof v === 'string') {
              variants.push({ lang: nk, location: String(v) });
            } else if (Array.isArray(v)) {
              v.forEach(item => { if (typeof item === 'string') variants.push({ lang: nk, location: String(item) }); });
            } else if (v && typeof v === 'object' && typeof v.location === 'string') {
              variants.push({ lang: nk, location: String(v.location) });
            }
          }
          if (!variants.length) continue;
          const findBy = (langs) => variants.find(x => langs.includes(x.lang));
          // Prefer the primary location for the current language as computed in postsIndexCache
          let chosen = null;
          let chosenLocation = null;
          try {
            const seed = findBy([curNorm]) || findBy(['en']) || findBy(['default']) || variants[0];
            if (seed && postsByLocationTitle && postsIndexCache) {
              const title = postsByLocationTitle[seed.location];
              const meta = title ? postsIndexCache[title] : null;
              if (meta && meta.location) chosenLocation = String(meta.location);
            }
          } catch (_) {}
          if (chosenLocation) {
            chosen = { lang: curNorm, location: chosenLocation };
          } else {
            chosen = findBy([curNorm]) || findBy(['en']) || findBy(['default']) || variants[0];
            if (!chosen) chosen = variants[0];
          }
          variants.forEach(v => { if (v.location && chosen.location && v.lang !== curNorm) locationAliasMap.set(v.location, chosen.location); });
        }
      }
    } catch (_) { /* ignore alias build errors */ }
  // Reflect available content languages in the UI selector (for unified index)
    try { refreshLanguageSelector(); } catch (_) {}
    // Render site identity and profile links from site config
    try {
      renderSiteIdentity(siteConfig);
      // Also update the base document title (tab suffix) from config
      const cfgTitle = (function pick(val){
        if (!val) return '';
        if (typeof val === 'string') return val;
        const lang = getCurrentLang && getCurrentLang();
        const v = (lang && val[lang]) || val.default || '';
        return typeof v === 'string' ? v : '';
      })(siteConfig && siteConfig.siteTitle);
      if (cfgTitle) setBaseSiteTitle(cfgTitle);
    } catch (_) {}
    try { renderSiteLinks(siteConfig); } catch (_) {}

    // Apply site-controlled theme after loading config
    try {
      applyThemeConfig(siteConfig);
      callThemeHook('reflectThemeConfig', {
        config: siteConfig,
        document,
        window
      });
    } catch (_) {}

    // Initialize global error reporter with optional report URL from site config
    try {
      const pick = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        const lang = getCurrentLang && getCurrentLang();
        const v = (lang && val[lang]) || val.default || '';
        return typeof v === 'string' ? v : '';
      };
      const resolveReportUrl = (cfg) => {
        try {
          if (!cfg || typeof cfg !== 'object') return null;
          // Derive from repo fields when available
          const repo = cfg.repo || {};
          const owner = repo && typeof repo.owner === 'string' ? repo.owner.trim() : '';
          const name = repo && typeof repo.name === 'string' ? repo.name.trim() : '';
          if (owner && name) return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/new`;
          return null;
        } catch (_) { return null; }
      };
      initErrorReporter({
        reportUrl: resolveReportUrl(siteConfig),
        siteTitle: pick(siteConfig && siteConfig.siteTitle) || 'NanoSite',
        enableOverlay: !!(siteConfig && siteConfig.errorOverlay === true)
      });
    } catch (_) {}
    
    // Set up default SEO with site config
    try {
      const lang = getCurrentLang && getCurrentLang();
      const getLocalizedValue = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang && val[lang]) || val.default || '';
      };
      
      // Update initial page meta tags with site config
      updateSEO({
        title: getLocalizedValue(siteConfig.siteTitle) || 'NanoSite - Zero-Dependency Static Blog',
        description: getLocalizedValue(siteConfig.siteDescription) || 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.',
        type: 'website',
        url: window.location.href
      }, siteConfig);
    } catch (_) {}
    
  routeAndRender();
  bindPostsMetadataListener();
} catch (e) {
  const bootContainers = getViewContainers('boot');
  resetTOCView('boot', bootContainers, { reason: 'bootError' });
  renderErrorState(bootContainers.mainElement || getViewContainer('boot', 'main'), {
    title: t('ui.indexUnavailable'),
    message: t('errors.indexUnavailableBody'),
    view: 'boot',
    containers: bootContainers
  });
  notifyThemeViewChange('boot', { showSearch: false, showTags: false });
  try {
    const err = new Error((t('errors.indexUnavailableBody') || 'Could not load the post index.'));
    try { err.name = 'Warning'; } catch(_) {}
    showErrorOverlay(err, { message: err.message, origin: 'boot.indexUnavailable', error: (e && e.message) || String(e || '') });
  } catch (_) {}
}

// Footer: set dynamic year once
try {
  callThemeHook('setupFooter', { translate: t, document, window });
} catch (_) {}
