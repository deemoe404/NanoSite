import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindThemePackPicker, mountThemeControls, refreshLanguageSelector, applyThemeConfig, bindPostEditor } from './js/theme.js';
import { ensureThemeLayout } from './js/theme-layout.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, setBaseSiteTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, formatDisplayDate, formatBytes, renderSkeletonArticle, isModifiedClick, getContentRoot, sanitizeImageUrl, sanitizeUrl } from './js/utils.js';
import { initI18n, t, withLangParam, loadLangJson, loadContentJson, loadTabsJson, getCurrentLang, normalizeLangKey } from './js/i18n.js';
import { updateSEO, extractSEOFromMarkdown } from './js/seo.js';
import { initErrorReporter, setReporterContext, showErrorOverlay } from './js/errors.js';
import { initSyntaxHighlighting } from './js/syntax-highlight.js';
import { fetchConfigWithYamlFallback } from './js/yaml.js';
import { applyMasonry, updateMasonryItem, calcAndSetSpan, toPx, debounce } from './js/masonry.js';
import { aggregateTags, renderTagSidebar, setupTagTooltips } from './js/tags.js';
import { renderPostNav } from './js/post-nav.js';
import { getArticleTitleFromMain } from './js/dom-utils.js';
import { renderPostMetaCard, renderOutdatedCard } from './js/templates.js';
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
// Default page size; can be overridden by site.yaml (pageSize/postsPerPage)
let PAGE_SIZE = 8;
// Guard against overlapping post loads (rapid version switches/back-forward)
let __activePostRequestId = 0;
// Track last route to harmonize scroll behavior on back/forward
let __lastRouteKey = '';

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

// --- UI helpers: smooth show/hide delegated to theme ---

function basicShow(el) {
  if (!el) return;
  el.style.display = '';
  el.style.removeProperty('overflow');
  el.style.removeProperty('height');
  el.setAttribute('aria-hidden', 'false');
}

function basicHide(el) {
  if (!el) return;
  el.style.display = 'none';
  el.style.removeProperty('overflow');
  el.style.removeProperty('height');
  el.setAttribute('aria-hidden', 'true');
}

function smoothShow(el) {
  if (!el) return;
  const handled = callThemeHook('showElement', { element: el, fallback: basicShow });
  if (!handled) basicShow(el);
}

function smoothHide(el, onDone) {
  if (!el) { if (typeof onDone === 'function') onDone(); return; }
  const handled = callThemeHook('hideElement', { element: el, onDone, fallback: (target, done) => {
    basicHide(target);
    if (typeof done === 'function') done();
  } });
  if (!handled) {
    basicHide(el);
    if (typeof onDone === 'function') onDone();
  }
}

// Global delegate for version selector changes to survive re-renders
try {
  if (!window.__ns_version_select_bound) {
    window.__ns_version_select_bound = true;
    const handler = (e) => {
      try {
        const el = e && e.target;
        if (!el || !el.classList || !el.classList.contains('post-version-select')) return;
        const loc = String(el.value || '').trim();
        if (!loc) return;
        const url = new URL(window.location.href);
        url.searchParams.set('id', loc);
        const lang = (getCurrentLang && getCurrentLang()) || 'en';
        url.searchParams.set('lang', lang);
        // Use SPA navigation so back/forward keeps the selector in sync
        try {
          history.pushState({}, '', url.toString());
          // Dispatch a popstate event so the unified handler routes and renders once
          try { window.dispatchEvent(new PopStateEvent('popstate')); } catch (_) { /* older browsers may not support constructor */ }
          // Scroll to top for a consistent version switch experience
          try { window.scrollTo(0, 0); } catch (_) {}
        } catch (_) {
          // Fallback to full navigation if History API fails
          window.location.assign(url.toString());
        }
      } catch (_) {}
    };
    document.addEventListener('change', handler, true);
    document.addEventListener('input', handler, true);
  }
} catch (_) {}

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

// Fade-in covers when each image loads; remove placeholder per-card
// --- Asset watchdog: warn when image assets exceed configured threshold ---
async function checkImageSize(url, timeoutMs = 4000) {
  // Try HEAD first; fall back to range request when HEAD not allowed
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HEAD ${r.status}`);
    const len = r.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch (_) {
    clearTimeout(t);
    // Range fetch 0-0 to read Content-Range when possible
    try {
      const r = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' } });
      const cr = r.headers.get('content-range');
      if (cr) {
        const m = /\/(\d+)$/.exec(cr);
        if (m) return parseInt(m[1], 10);
      }
      const len = r.headers.get('content-length');
      return len ? parseInt(len, 10) : null;
    } catch (_) {
      return null;
    }
  }
}

// formatBytes moved to utils.js

async function warnLargeImagesIn(container, cfg = {}) {
  try {
    const enabled = !!(cfg && cfg.enabled);
    const thresholdKB = Math.max(1, parseInt((cfg && cfg.thresholdKB) || 500, 10));
    if (!enabled) return;
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('img'));
    const seen = new Set();
    // Resolve relative to page for consistent fetch URLs
    const toAbs = (s) => {
      try { return new URL(s, window.location.href).toString(); } catch { return s; }
    };
    const tasks = imgs
      .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter(Boolean)
      .map(u => toAbs(u))
      .filter(u => { if (seen.has(u)) return false; seen.add(u); return true; });
    const limit = 4;
    let i = 0;
    const next = async () => {
      const idx = i++;
      if (idx >= tasks.length) return;
      const url = tasks[idx];
      const size = await checkImageSize(url);
      if (typeof size === 'number' && size > thresholdKB * 1024) {
        try {
          const lang = (document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
          const normalized = String(lang || '').toLowerCase();
          const name = url.split('/').pop() || url;
          const isZhCn = normalized === 'zh' || normalized === 'zh-cn' || normalized.startsWith('zh-cn') || normalized === 'zh-hans' || normalized.startsWith('zh-hans') || normalized === 'zh-sg' || normalized === 'zh-my';
          const isZhTw = normalized === 'zh-tw' || normalized.startsWith('zh-tw') || normalized === 'zh-hant' || normalized.startsWith('zh-hant');
          const isZhHk = normalized === 'zh-hk' || normalized.startsWith('zh-hk') || normalized === 'zh-mo' || normalized.startsWith('zh-mo');
          const msg = isZhCn
            ? `发现大图资源：${name}（${formatBytes(size)}）已超过阈值 ${thresholdKB} KB`
            : isZhTw
              ? `發現大型圖片資源：${name}（${formatBytes(size)}）超過門檻 ${thresholdKB} KB`
              : isZhHk
                ? `發現大型圖片資源：${name}（${formatBytes(size)}）超出上限 ${thresholdKB} KB`
              : (normalized === 'ja' || normalized.startsWith('ja'))
                ? `大きな画像を検出: ${name}（${formatBytes(size)}）はしきい値 ${thresholdKB} KB を超えています`
                : `Large image detected: ${name} (${formatBytes(size)}) exceeds threshold ${thresholdKB} KB`;
          const e = new Error(msg);
          try { e.name = 'Warning'; } catch(_) {}
          showErrorOverlay(e, {
            message: msg,
            origin: 'asset.watchdog',
            kind: 'image',
            thresholdKB,
            sizeBytes: size,
            url
          });
        } catch (_) {}
      }
      return next();
    };
    const starters = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
    await Promise.all(starters);
  } catch (_) { /* silent */ }
}


// Transform standalone internal links (?id=...) into rich article cards
// Load cover images sequentially to reduce bandwidth contention
function updateLayoutLoadingState({ view, contentElement, sidebarElement, containerElement } = {}, isLoading) {
  return callThemeHook('updateLayoutLoadingState', {
    view,
    isLoading,
    contentElement,
    sidebarElement,
    containerElement,
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
  view
} = {}) {
  return callThemeHook('renderErrorState', {
    targetElement,
    variant,
    title,
    message,
    actions,
    view,
    translate: t,
    document,
    window
  });
}

function updateSearchPanels({
  showSearch,
  showTags,
  queryValue,
  tagFilter,
  view
} = {}) {
  return callThemeHook('updateSearchPanels', {
    showSearch,
    showTags,
    queryValue,
    tagFilter,
    view,
    document,
    window
  });
}

function enhanceIndexLayout(params = {}) {
  callThemeHook('enhanceIndexLayout', {
    ...params,
    hydrateCardCovers,
    applyLazyLoadingIn,
    warnLargeImagesIn,
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
  // Add loading-state classes to keep layout stable
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  updateLayoutLoadingState({
    view: 'post',
    contentElement: contentEl,
    sidebarElement: sidebarEl,
    containerElement: mainviewContainer
  }, true);
  
  // Loading state for post view
  const toc = document.getElementById('tocview');
  const main = document.getElementById('mainview');
  const handledLoading = callThemeHook('renderPostLoadingState', {
    tocElement: toc,
    mainElement: main,
    translator: t,
    renderSkeletonArticle,
    ensureAutoHeight,
    showElement: basicShow,
    hideElement: basicHide,
    document,
    window
  });
  if (!handledLoading) {
    if (toc) {
      toc.innerHTML = '';
      smoothShow(toc);
      ensureAutoHeight(toc);
    }
    if (main) main.innerHTML = renderSkeletonArticle();
  }

  return getFile(`${getContentRoot()}/${postname}`).then(markdown => {
    // Ignore stale responses if a newer navigation started
    if (reqId !== __activePostRequestId) return;
    // Remove loading-state classes
    updateLayoutLoadingState({
      view: 'post',
      contentElement: contentEl,
      sidebarElement: sidebarEl,
      containerElement: mainviewContainer
    }, false);
    
    const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
    const baseDir = `${getContentRoot()}/${dir}`;
  const output = mdParse(markdown, baseDir);
  // Compute fallback title using index cache before rendering
  const fallback = postsByLocationTitle[postname] || postname;
  // Try to get metadata for this post from index cache. Support versioned entries.
  let postEntry = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => v && v.location === postname);
  let postMetadata = postEntry ? postEntry[1] : {};
  if (!postEntry) {
    const found = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => Array.isArray(v && v.versions) && v.versions.some(ver => ver && ver.location === postname));
    if (found) {
      const baseMeta = found[1];
      const match = (baseMeta.versions || []).find(ver => ver.location === postname) || {};
      postMetadata = { ...match, versions: baseMeta.versions || [] };
    }
  }
  // Tentatively render meta card with fallback title first; we'll update title after reading h1
  const preTitle = fallback;
  const outdatedCardHtml = renderOutdatedCard(postMetadata, siteConfig);
  const metaCardHtml = renderPostMetaCard(preTitle, postMetadata, markdown);
  // Clone meta card for bottom and add a modifier class for styling hooks
  const bottomMetaCardHtml = (metaCardHtml || '').replace('post-meta-card', 'post-meta-card post-meta-bottom');
  // Render outdated card + meta card + main content + bottom meta card
  const mainEl = document.getElementById('mainview');
  if (mainEl) mainEl.innerHTML = outdatedCardHtml + metaCardHtml + output.post + bottomMetaCardHtml;
  try { renderPostNav('#mainview', postsIndexCache, postname); } catch (_) {}
  try { hydratePostImages('#mainview'); } catch (_) {}
    try { applyLazyLoadingIn('#mainview'); } catch (_) {}
    try { applyLangHints('#mainview'); } catch (_) {}
    // After images are in DOM, run large-image watchdog if enabled in site config
    try {
      const cfg = (siteConfig && siteConfig.assetWarnings && siteConfig.assetWarnings.largeImage) || {};
      warnLargeImagesIn('#mainview', cfg);
    } catch (_) {}
  try { hydrateInternalLinkCards('#mainview', {
    allowedLocations,
    locationAliasMap,
    postsByLocationTitle,
    postsIndexCache,
    siteConfig,
    translate: t,
    makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`),
    fetchMarkdown: (loc) => getFile(`${getContentRoot()}/${loc}`)
  }); } catch (_) {}
  try { hydratePostVideos('#mainview'); } catch (_) {}
  const articleTitle = fallback;
    // Update SEO meta tags for the post
    try {
      const seoData = extractSEOFromMarkdown(markdown, { 
        ...postMetadata, 
        title: articleTitle,
        // Ensure location present for relative image resolution
        location: postname
      }, siteConfig);
      updateSEO(seoData, siteConfig);
    } catch (_) { /* ignore SEO errors */ }
    
  renderTabs('post', articleTitle);
  callThemeHook('decoratePostView', {
    container: mainEl,
    articleTitle,
    postMetadata,
    markdown,
    translate: t,
    document,
    window
  });
  const tocTarget = document.getElementById('tocview');
  if (tocTarget) {
    if (output.toc) {
      renderPostTOCBlock({ tocElement: tocTarget, articleTitle, tocHtml: output.toc });
      smoothShow(tocTarget);
      ensureAutoHeight(tocTarget);
      try { setupAnchors(); } catch (_) {}
      try { setupTOC(); } catch (_) {}
    } else {
      smoothHide(tocTarget, () => { try { tocTarget.innerHTML = ''; } catch (_) {}; });
    }
  }
  updateSearchPanels({ view: 'post', showSearch: false, showTags: false });
  try { setDocTitle(articleTitle); } catch (_) {}
  try { initSyntaxHighlighting(); } catch (_) {}
  try { renderTagSidebar(postsIndexCache); } catch (_) {}
    // If URL contains a hash, try to jump to it; if missing in this version, clear hash and scroll to top
    const currentHash = (location.hash || '').replace(/^#/, '');
    if (currentHash) {
      const target = document.getElementById(currentHash);
      if (target) {
        requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); });
      } else {
        // Remove stale anchor to avoid unexpected jumps on future navigations
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
    updateLayoutLoadingState({
      view: 'post',
      contentElement: contentEl,
      sidebarElement: sidebarEl,
      containerElement: mainviewContainer
    }, false);

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

    const tocView = document.getElementById('tocview');
    if (tocView) {
      smoothHide(tocView, () => { try { tocView.innerHTML = ''; } catch (_) {}; });
    }
    const backHref = withLangParam(`?tab=${encodeURIComponent(getHomeSlug())}`);
    const backText = postsEnabled() ? t('ui.backToAllPosts') : (t('ui.backToHome') || t('ui.backToAllPosts'));
    renderErrorState(document.getElementById('mainview'), {
      title: t('errors.postNotFoundTitle'),
      message: t('errors.postNotFoundBody'),
      actions: [{ href: backHref, label: backText }],
      view: 'post'
    });
    setDocTitle(t('ui.notFound'));
    updateSearchPanels({ view: 'post', showSearch: false, showTags: false });
  });
}

function displayIndex(parsed) {
  const toc = document.getElementById('tocview');
  smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} });

  const entries = Object.entries(parsed || {});
  const total = entries.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageEntries = entries.slice(start, end);

  const mainview = document.getElementById('mainview');
  const handled = callThemeHook('renderIndexView', {
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
  if (!handled && mainview) mainview.innerHTML = '';

  enhanceIndexLayout({
    view: 'posts',
    containerSelector: '#mainview',
    indexSelector: '.index',
    allEntries: entries,
    pageEntries,
    total,
    page,
    totalPages,
    postsIndexMap: postsIndexCache,
    siteConfig
  });

  renderTabs('posts');
  updateSearchPanels({ view: 'posts', showSearch: true, showTags: true, queryValue: '' });
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

  const toc = document.getElementById('tocview');
  smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} });

  // Filter by title or tags; if tagFilter present, restrict to exact tag match (case-insensitive)
  const allEntries = Object.entries(postsIndexCache || {});
  const ql = q.toLowerCase();
  const tagl = tagFilter.toLowerCase();
  const filtered = allEntries.filter(([title, meta]) => {
    const tagVal = meta && meta.tag;
    const tags = Array.isArray(tagVal)
      ? tagVal.map(x => String(x))
      : (typeof tagVal === 'string' ? String(tagVal).split(',') : (tagVal != null ? [String(tagVal)] : []));
    const normTags = tags.map(s => s.trim()).filter(Boolean);
    if (tagFilter) {
      return normTags.some(tg => tg.toLowerCase() === tagl);
    }
    const inTitle = String(title || '').toLowerCase().includes(ql);
    const inTags = normTags.some(tg => tg.toLowerCase().includes(ql));
    return inTitle || inTags;
  });

  const total = filtered.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageEntries = filtered.slice(start, end);

  const mainview = document.getElementById('mainview');
  const handled = callThemeHook('renderSearchResults', {
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
  if (!handled && mainview) mainview.innerHTML = '';

  enhanceIndexLayout({
    view: 'search',
    containerSelector: '#mainview',
    indexSelector: '.index',
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
  updateSearchPanels({ view: 'search', showSearch: true, showTags: true, queryValue: q, tagFilter });
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
  
  // Add loading state class to maintain layout stability
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  updateLayoutLoadingState({
    view: 'tab',
    contentElement: contentEl,
    sidebarElement: sidebarEl,
    containerElement: mainviewContainer
  }, true);
  
  const toc = document.getElementById('tocview');
  if (toc) { smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} }); }
  const main = document.getElementById('mainview');
  const handledLoading = callThemeHook('renderStaticTabLoadingState', {
    mainElement: main,
    renderSkeletonArticle,
    document,
    window
  });
  if (!handledLoading && main) main.innerHTML = renderSkeletonArticle();
  updateSearchPanels({ view: 'tab', showSearch: false, showTags: false });
  renderTabs(slug);
  getFile(`${getContentRoot()}/${tab.location}`)
    .then(md => {
      // 移除加载状态类
      updateLayoutLoadingState({
        view: 'tab',
        contentElement: contentEl,
        sidebarElement: sidebarEl,
        containerElement: mainviewContainer
      }, false);
      
      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `${getContentRoot()}/${dir}`;
      const output = mdParse(md, baseDir);
  const mv = document.getElementById('mainview');
  if (mv) mv.innerHTML = output.post;
  try { hydratePostImages('#mainview'); } catch (_) {}
      try { applyLazyLoadingIn('#mainview'); } catch (_) {}
      // After images are in DOM, run large-image watchdog if enabled in site config
      try {
        const cfg = (siteConfig && siteConfig.assetWarnings && siteConfig.assetWarnings.largeImage) || {};
        warnLargeImagesIn('#mainview', cfg);
      } catch (_) {}
  try { hydrateInternalLinkCards('#mainview', {
    allowedLocations,
    locationAliasMap,
    postsByLocationTitle,
    postsIndexCache,
    siteConfig,
    translate: t,
    makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`),
    fetchMarkdown: (loc) => getFile(`${getContentRoot()}/${loc}`)
  }); } catch (_) {}
  try { hydratePostVideos('#mainview'); } catch (_) {}
  try { initSyntaxHighlighting(); } catch (_) {}
  try { renderTagSidebar(postsIndexCache); } catch (_) {}
  // Always use the title defined in tabs.yaml for the browser/SEO title,
  // instead of deriving it from the first heading in the markdown.
  const pageTitle = tab.title;
      
      // Update SEO meta tags for the tab page
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
      updateLayoutLoadingState({
        view: 'tab',
        contentElement: contentEl,
        sidebarElement: sidebarEl,
        containerElement: mainviewContainer
      }, false);
      
      // Surface an overlay for missing static tab page
      try {
        const url = `${getContentRoot()}/${tab.location}`;
        const msg = (t('errors.pageUnavailableBody') || 'Could not load this tab.') + (e && e.message ? ` (${e.message})` : '');
        const err = new Error(msg);
        try { err.name = 'Warning'; } catch(_) {}
        showErrorOverlay(err, { message: msg, origin: 'view.tab.unavailable', tagName: 'md', filename: url, assetUrl: url, tab: slug });
      } catch (_) {}

      renderErrorState(document.getElementById('mainview'), {
        title: t('errors.pageUnavailableTitle'),
        message: t('errors.pageUnavailableBody'),
        view: 'tab'
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

  // Add animation for tab clicks
  if (a.classList.contains('tab')) {
    callThemeHook('onTabClick', a);
  }
  
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
    history.pushState({}, '', url.toString());
    routeAndRender();
    window.scrollTo(0, 0);
  } catch (_) {
    // If URL parsing fails, fall through to default navigation
  }
});

window.addEventListener('popstate', () => {
  const prevKey = __lastRouteKey || '';
  routeAndRender();
  try { renderTagSidebar(postsIndexCache); } catch (_) {}
  // Normalize scroll behavior: if navigating between different post IDs, scroll to top
  try {
    const id = getQueryVariable('id');
    const tab = (getQueryVariable('tab') || 'posts').toLowerCase();
    const curKey = id ? `post:${id}` : `tab:${tab}`;
    if (prevKey && prevKey.startsWith('post:') && curKey.startsWith('post:') && prevKey !== curKey) {
      try { window.scrollTo(0, 0); } catch (_) {}
    }
    __lastRouteKey = curKey;
  } catch (_) {}
});

// Update sliding indicator on window resize
window.addEventListener('resize', () => {
  const nav = document.getElementById('tabsNav');
  if (nav) {
    callThemeHook('updateTabHighlight', nav);
  }
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

// Build layout according to the active theme pack before binding UI logic
await ensureThemeLayout();

// Ensure theme controls are present, then apply and bind
mountThemeControls();
applySavedTheme();
bindThemeToggle();
bindPostEditor();
bindThemePackPicker();
// Localize search placeholder ASAP
try { const input = document.getElementById('searchInput'); if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder')); } catch (_) {}
// Observe viewport changes for responsive tabs
callThemeHook('setupResponsiveTabsObserver', {
  getTabs: () => tabsBySlug,
  document,
  window,
  renderTabs
});

// Soft reset to the site's default language without full reload
async function softResetToSiteDefaultLanguage() {
  try {
    const def = (siteConfig && (siteConfig.defaultLanguage || siteConfig.defaultLang)) || defaultLang || 'en';
    // Switch language immediately (do not persist to mimic reset semantics)
    await initI18n({ lang: String(def), persist: false });
    // Reflect placeholder promptly
    try { const input = document.getElementById('searchInput'); if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder')); } catch (_) {}
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
  // Wire up version selector(s) (if multiple versions available)
  try {
    const verSels = Array.from(document.querySelectorAll('#mainview .post-meta-card select.post-version-select'));
    verSels.forEach((verSel) => {
      verSel.addEventListener('change', (e) => {
        try {
          const loc = String(e.target.value || '').trim();
          if (!loc) return;
          // Build an explicit URL to avoid any helper side effects
          const url = new URL(window.location.href);
          url.searchParams.set('id', loc);
          const lang = (getCurrentLang && getCurrentLang()) || 'en';
          url.searchParams.set('lang', lang);
          window.location.assign(url.toString());
        } catch (_) {}
      });
    });
  } catch (_) {}
    }
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
      const tools = document.getElementById('tools');
      if (tools && tools.parentElement) tools.parentElement.removeChild(tools);
      // Recreate and rebind controls
      mountThemeControls();
      applySavedTheme();
      bindThemeToggle();
      bindThemePackPicker();
      refreshLanguageSelector();
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
  } catch (_) {
    try { window.location.reload(); } catch (__) {}
  }
}
// Expose as a global so the UI can call it
try { window.__ns_softResetLang = () => softResetToSiteDefaultLanguage(); } catch (_) {}

// Load site config first so we can honor defaultLanguage before fetching localized content
loadSiteConfig()
  .then(async (cfg) => {
    siteConfig = cfg || {};
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
          // Force language to site default, not just the fallback
          await initI18n({ lang: String(cfgDefaultLang) });
          try { const input = document.getElementById('searchInput'); if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder')); } catch (_) {}
        }
      }
    } catch (_) { /* ignore site default application errors */ }

    // Now fetch localized content and tabs for the (possibly updated) language
    return Promise.allSettled([
      loadContentJson(getContentRoot(), 'index'),
      loadTabsJson(getContentRoot(), 'tabs'),
      (async () => {
        try {
          const cr = getContentRoot();
          const obj = await fetchConfigWithYamlFallback([`${cr}/index.yaml`,`${cr}/index.yml`]);
          return (obj && typeof obj === 'object') ? obj : null;
        } catch (_) { return null; }
      })()
    ]);
  })
  .then(results => {
    const posts = results[0].status === 'fulfilled' ? (results[0].value || {}) : {};
    const tabs = results[1].status === 'fulfilled' ? (results[1].value || {}) : {};
    const rawIndex = results[2] && results[2].status === 'fulfilled' ? (results[2].value || null) : null;
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
      // If site enforces a specific pack, ensure the selector reflects it
      const sel = document.getElementById('themePack');
      if (sel && siteConfig && siteConfig.themeOverride !== false && siteConfig.themePack) {
        sel.value = siteConfig.themePack;
      }
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
  })
  .catch((e) => {
    const tocView = document.getElementById('tocview');
    if (tocView) {
      smoothHide(tocView, () => { try { tocView.innerHTML = ''; } catch (_) {}; });
    }
    renderErrorState(document.getElementById('mainview'), {
      title: t('ui.indexUnavailable'),
      message: t('errors.indexUnavailableBody'),
      view: 'boot'
    });
    updateSearchPanels({ view: 'boot', showSearch: false, showTags: false });
    // Surface an overlay for boot/index failures (network/unified JSON issues)
    try {
      const err = new Error((t('errors.indexUnavailableBody') || 'Could not load the post index.'));
      try { err.name = 'Warning'; } catch(_) {}
      showErrorOverlay(err, { message: err.message, origin: 'boot.indexUnavailable', error: (e && e.message) || String(e || '') });
    } catch (_) {}
  });

// Footer: set dynamic year once
try {
  const y = document.getElementById('footerYear');
  if (y) y.textContent = String(new Date().getFullYear());
  const top = document.getElementById('footerTop');
  if (top) {
    top.textContent = t('ui.top');
    top.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
} catch (_) {}
