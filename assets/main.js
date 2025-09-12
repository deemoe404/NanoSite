import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindSeoGenerator, bindThemePackPicker, mountThemeControls, refreshLanguageSelector, applyThemeConfig } from './js/theme.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, setBaseSiteTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, escapeHtml, formatDisplayDate, formatBytes, renderSkeletonArticle, isModifiedClick, getContentRoot } from './js/utils.js';
import { initI18n, t, withLangParam, loadLangJson, loadContentJson, loadTabsJson, getCurrentLang, normalizeLangKey } from './js/i18n.js';
import { updateSEO, extractSEOFromMarkdown } from './js/seo.js';
import { initErrorReporter, setReporterContext, showErrorOverlay } from './js/errors.js';
import { initSyntaxHighlighting } from './js/syntax-highlight.js';
import { fetchConfigWithYamlFallback } from './js/yaml.js';
import { applyMasonry, updateMasonryItem, calcAndSetSpan, toPx, debounce } from './js/masonry.js';
import { aggregateTags, renderTagSidebar, setupTagTooltips, attachHoverTooltip } from './js/tags.js';
import { installLightbox } from './js/lightbox.js';
import { renderPostNav } from './js/post-nav.js';
import { prefersReducedMotion, getArticleTitleFromMain } from './js/dom-utils.js';
import { renderPostMetaCard, renderOutdatedCard } from './js/templates.js';
import { applyLangHints } from './js/typography.js';

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

// --- UI helpers: smooth show/hide (height + opacity) ---

function smoothShow(el) {
  if (!el) return;
  const cs = window.getComputedStyle(el);
  if (cs.display !== 'none') { el.setAttribute('aria-hidden', 'false'); return; }
  if (prefersReducedMotion()) { el.style.display = 'block'; el.setAttribute('aria-hidden', 'false'); return; }
  // Restore margin/padding if previously saved, else use computed
  const savedMargin = el.dataset.prevMarginBottom || cs.marginBottom || '1.25rem';
  const savedPadTop = el.dataset.prevPaddingTop || cs.paddingTop || '1.25rem';
  const savedPadBottom = el.dataset.prevPaddingBottom || cs.paddingBottom || '1.25rem';
  // Persist for next cycle
  el.dataset.prevPaddingTop = savedPadTop;
  el.dataset.prevPaddingBottom = savedPadBottom;
  const prevMin = cs.minHeight;
  el.dataset.prevMinHeight = prevMin;
  el.style.display = 'block';
  el.style.overflow = 'hidden';
  el.style.minHeight = '0px';
  // Start with collapsed paddings and size
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  el.style.height = '0px';
  el.style.marginBottom = '0px';
  el.style.opacity = '0';
  el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
  // Measure target height including padding: temporarily set paddings
  el.style.paddingTop = savedPadTop;
  el.style.paddingBottom = savedPadBottom;
  void el.getBoundingClientRect();
  const target = el.scrollHeight;
  // Reset to collapsed paddings before animating
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  // Animate
  const HEIGHT_MS = 240; const MARGIN_MS = 240; const PADDING_MS = 240; const OPACITY_MS = 180; const BUFFER_MS = 80;
  el.style.transition = `height ${HEIGHT_MS}ms ease, margin-bottom ${MARGIN_MS}ms ease, padding-top ${PADDING_MS}ms ease, padding-bottom ${PADDING_MS}ms ease, opacity ${OPACITY_MS}ms ease-out`;
  el.style.height = target + 'px';
  el.style.paddingTop = savedPadTop;
  el.style.paddingBottom = savedPadBottom;
  el.style.marginBottom = savedMargin;
  el.style.opacity = '1';
  el.setAttribute('aria-hidden', 'false');
  const ended = new Set();
  let done = false;
  const finalize = () => {
    if (done) return; done = true;
    el.style.transition = '';
    el.style.height = '';
    el.style.overflow = '';
    el.style.willChange = '';
    el.style.minHeight = '';
    el.style.opacity = '';
    el.style.marginBottom = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.removeEventListener('transitionend', onEnd);
  };
  const onEnd = (e) => {
    if (!e || typeof e.propertyName !== 'string') return;
    const p = e.propertyName.trim();
    if (p === 'height' || p === 'padding-bottom') {
      ended.add(p);
      if (ended.has('height') && ended.has('padding-bottom')) finalize();
    }
  };
  el.addEventListener('transitionend', onEnd);
  // Fallback in case a transitionend is missed
  setTimeout(finalize, Math.max(HEIGHT_MS, PADDING_MS) + BUFFER_MS);
}

function smoothHide(el, onDone) {
  if (!el) return;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none') { el.setAttribute('aria-hidden', 'true'); if (typeof onDone === 'function') onDone(); return; }
  if (prefersReducedMotion()) { el.style.display = 'none'; el.setAttribute('aria-hidden', 'true'); if (typeof onDone === 'function') onDone(); return; }
  // Save current margin-bottom to restore on show
  el.dataset.prevMarginBottom = cs.marginBottom;
  el.dataset.prevPaddingTop = cs.paddingTop;
  el.dataset.prevPaddingBottom = cs.paddingBottom;
  const prevMin = cs.minHeight;
  el.dataset.prevMinHeight = prevMin;
  const startHeight = el.scrollHeight;
  el.style.overflow = 'hidden';
  el.style.minHeight = '0px';
  el.style.height = startHeight + 'px';
  el.style.marginBottom = cs.marginBottom;
  el.style.paddingTop = cs.paddingTop;
  el.style.paddingBottom = cs.paddingBottom;
  el.style.opacity = '1';
  el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
  // Reflow then collapse
  void el.getBoundingClientRect();
  const HEIGHT_MS = 240; const MARGIN_MS = 240; const PADDING_MS = 240; const OPACITY_MS = 180; const BUFFER_MS = 80;
  el.style.transition = `height ${HEIGHT_MS}ms ease, margin-bottom ${MARGIN_MS}ms ease, padding-top ${PADDING_MS}ms ease, padding-bottom ${PADDING_MS}ms ease, opacity ${OPACITY_MS}ms ease-out`;
  el.style.height = '0px';
  el.style.marginBottom = '0px';
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  el.style.opacity = '0';
  el.setAttribute('aria-hidden', 'true');
  let done = false;
  const ended = new Set();
  const finalize = () => {
    if (done) return; done = true;
    el.style.display = 'none';
    el.style.transition = '';
    el.style.height = '';
    el.style.opacity = '';
    el.style.overflow = '';
    el.style.willChange = '';
    el.style.minHeight = '';
    el.style.marginBottom = '';
    el.removeEventListener('transitionend', onEnd);
    if (typeof onDone === 'function') try { onDone(); } catch (_) {}
  };
  const onEnd = (e) => {
    if (!e || typeof e.propertyName !== 'string') return;
    const p = e.propertyName.trim();
    if (p === 'height' || p === 'margin-bottom' || p === 'padding-bottom') {
      ended.add(p);
      if (ended.has('height') && ended.has('margin-bottom') && ended.has('padding-bottom')) finalize();
    }
  };
  el.addEventListener('transitionend', onEnd);
  // Fallback in case transitionend is missed on some properties
  setTimeout(finalize, Math.max(HEIGHT_MS, MARGIN_MS, PADDING_MS) + BUFFER_MS);
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

// For critical UI images (like avatar), fetch with no-store and set a blob URL
function setImageSrcNoStore(img, src) {
  try {
    if (!img) return;
    const val = String(src || '').trim();
    if (!val) return;
    // data:/blob:/absolute URLs — leave as-is
    if (/^(data:|blob:)/i.test(val)) { img.setAttribute('src', val); return; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(val)) { img.setAttribute('src', val); return; }
    // Relative or same-origin absolute: fetch fresh and use an object URL
    let abs = val;
    try { abs = new URL(val, window.location.href).toString(); } catch (_) {}
    fetch(abs, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(b => {
        const url = URL.createObjectURL(b);
        try { const prev = img.dataset.blobUrl; if (prev) URL.revokeObjectURL(prev); } catch (_) {}
        img.dataset.blobUrl = url;
        img.setAttribute('src', url);
      })
      .catch(() => { img.setAttribute('src', val); });
  } catch (_) { try { img.setAttribute('src', src); } catch(__) {} }
}

function renderSiteLinks(cfg) {
  try {
    const root = document.querySelector('.site-card .social-links');
    if (!root) return;
    const linksVal = (cfg && (cfg.profileLinks || cfg.links)) || [];
    let items = [];
    if (Array.isArray(linksVal)) {
      items = linksVal
        .filter(x => x && x.href && x.label)
        .map(x => ({ href: String(x.href), label: String(x.label) }));
    } else if (linksVal && typeof linksVal === 'object') {
      items = Object.entries(linksVal).map(([label, href]) => ({ label: String(label), href: String(href) }));
    }
    if (!items.length) return;
    const sep = '<span class="link-sep">•</span>';
    const anchors = items.map(({ href, label }) => `<a href="${escapeHtml(href)}" target="_blank" rel="me noopener">${escapeHtml(label)}</a>`);
    root.innerHTML = `<li>${anchors.join(sep)}</li>`;
  } catch (_) { /* noop */ }
}

function renderSiteIdentity(cfg) {
  try {
    if (!cfg) return;
    const pick = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const lang = getCurrentLang && getCurrentLang();
        const langVal = (lang && val[lang]) || val.default || '';
        return typeof langVal === 'string' ? langVal : '';
      }
      return '';
    };
    const title = pick(cfg.siteTitle);
    const subtitle = pick(cfg.siteSubtitle);
    const avatar = pick(cfg.avatar);
    if (title) {
      const el = document.querySelector('.site-card .site-title');
      if (el) el.textContent = title;
      const fs = document.querySelector('.footer-site');
      if (fs) fs.textContent = title;
    }
    if (subtitle) {
      const el2 = document.querySelector('.site-card .site-subtitle');
      if (el2) el2.textContent = subtitle;
    }
    if (avatar) {
      const img = document.querySelector('.site-card .avatar');
      if (img) setImageSrcNoStore(img, avatar);
    }
  } catch (_) { /* noop */ }
}

// Ensure images defer offscreen loading for performance
function applyLazyLoadingIn(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return;
    const imgs = root.querySelectorAll('img');
    imgs.forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  } catch (_) {}
}

// Fade-in covers when each image loads; remove placeholder per-card
function hydrateCardCovers(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const wraps = root.querySelectorAll('.index .card-cover-wrap, .link-card .card-cover-wrap');
    wraps.forEach(wrap => {
      const img = wrap.querySelector('img.card-cover');
      if (!img) return;
      const ph = wrap.querySelector('.ph-skeleton');
      const done = () => {
        img.classList.add('is-loaded');
        if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
      };
      if (img.complete && img.naturalWidth > 0) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => { if (ph && ph.parentNode) ph.parentNode.removeChild(ph); img.style.opacity = '1'; }, { once: true });
      // Kick off loading immediately for link-card covers (index covers are loaded sequentially elsewhere)
      const inIndex = !!wrap.closest('.index');
      const ds = img.getAttribute('data-src');
      if (!inIndex && ds && !img.getAttribute('src')) {
        img.src = ds;
      }
    });
  } catch (_) {}
}

// Enhance post images: wrap with a reserved-ratio container + skeleton, fade-in when loaded
function hydratePostImages(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const candidates = Array.from(root.querySelectorAll('img'))
      .filter(img => !img.classList.contains('card-cover'))
      .filter(img => !img.closest('table'))
      .filter(img => !img.closest('figure'));
  candidates.forEach(img => {
      // Skip if already in a wrapper
      if (img.closest('.post-image-wrap')) return;
      // If the image lives inside a paragraph with other text, avoid restructuring
      const p = img.parentElement && img.parentElement.tagName === 'P' ? img.parentElement : null;
      const onlyThisImg = p ? (p.childElementCount === 1 && p.textContent.trim() === '') : false;

      // Helper to create wrapper + skeleton and wire lazy fade-in
      const setupWrap = (hostEl, nodeToMove) => {
        const wrap = document.createElement('div');
        wrap.className = 'post-image-wrap';
        // Prefer explicit attributes for ratio if present
        const wAttr = parseInt(img.getAttribute('width') || '', 10);
        const hAttr = parseInt(img.getAttribute('height') || '', 10);
        if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
          wrap.style.aspectRatio = `${wAttr} / ${hAttr}`;
        }
        const ph = document.createElement('div');
        ph.className = 'ph-skeleton';
        ph.setAttribute('aria-hidden', 'true');

        // Insert wrapper next to the image/link when in same parent; otherwise append
        try {
          if (nodeToMove && nodeToMove.parentElement === hostEl) hostEl.insertBefore(wrap, nodeToMove);
          else hostEl.appendChild(wrap);
        } catch (_) { hostEl.appendChild(wrap); }
        wrap.appendChild(ph);
        wrap.appendChild(nodeToMove || img);

        img.classList.add('post-img');
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

        const src = img.getAttribute('src');
        if (src) { img.setAttribute('data-src', src); img.removeAttribute('src'); }

        const done = () => {
          if (img.naturalWidth && img.naturalHeight) {
            wrap.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          }
          img.classList.add('is-loaded');
          if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
        };
        if (img.complete && img.naturalWidth > 0) { done(); }
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', () => { if (ph && ph.parentNode) ph.parentNode.removeChild(ph); img.style.opacity = '1'; }, { once: true });
        }

        const ds = img.getAttribute('data-src');
        if (ds) img.src = ds;
      };

      if (onlyThisImg) {
        // Upgrade to a semantic figure with figcaption using alt text
        const alt = (img.getAttribute('alt') || '').trim();
        const figure = document.createElement('figure');
        // Insert figure before the paragraph, then move image inside
        p.parentElement && p.parentElement.insertBefore(figure, p);
        // If image is wrapped in an anchor directly under <p>, move the anchor as a unit
        const link = (img.parentElement && img.parentElement.tagName === 'A' && img.parentElement.parentElement === p) ? img.parentElement : null;
        const nodeToMove = link || img;
        // Put skeleton wrapper inside figure and move node (img or link)
        setupWrap(figure, nodeToMove);
        // Remove empty paragraph shell
        try { if (p.parentElement) p.parentElement.removeChild(p); } catch (_) {}
        // Add caption only if we have non-empty alt
        if (alt) {
          const cap = document.createElement('figcaption');
          cap.textContent = alt;
          figure.appendChild(cap);
        }
      } else {
        // Regular inline/embedded image: wrap in a reserved-ratio container only
        const targetParent = img.parentElement;
        if (!targetParent) return;
        // Move any wrapping anchor along with the image if present
        const link = (img.parentElement && img.parentElement.tagName === 'A') ? img.parentElement : null;
        const nodeToMove = link || img;
        setupWrap(targetParent, nodeToMove);
      }
    });
  } catch (_) {}
}
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
          const name = url.split('/').pop() || url;
          const msg = (lang === 'zh' || lang?.startsWith('zh'))
            ? `发现大图资源：${name}（${formatBytes(size)}）已超过阈值 ${thresholdKB} KB`
            : (lang === 'ja')
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


// Auto-generate preview posters for videos to avoid gray screen before play
function hydratePostVideos(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    // Normalize raw HTML <video> markup to match NanoSite's generated structure
    const videos = Array.from(root.querySelectorAll('video'));
    videos.forEach(video => {
      try {
        if (!video.classList.contains('post-video')) video.classList.add('post-video');
        if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
        if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
        if (!video.hasAttribute('playsinline')) video.setAttribute('playsinline', '');
        if (!video.closest('.post-video-wrap')) {
          const wrap = document.createElement('div');
          wrap.className = 'post-video-wrap';
          const parent = video.parentElement;
          if (parent) {
            parent.insertBefore(wrap, video);
            wrap.appendChild(video);
          }
        }
        // Ensure browser re-evaluates sources after moving/normalizing
        try { video.load(); } catch (_) {}

        // Install a lightweight fallback overlay on error
        try {
          if (video.dataset.vfInstalled !== '1') {
            const wrap = video.closest('.post-video-wrap') || video.parentElement;
            const overlay = document.createElement('div');
            overlay.className = 'video-fallback';
            overlay.style.display = 'none';
            const toAbs = (s) => { try { return new URL(s, window.location.href).toString(); } catch(_) { return s; } };
            const sources = [video.getAttribute('src'), ...Array.from(video.querySelectorAll('source')).map(s => s.getAttribute('src'))].filter(Boolean);
            const first = sources.length ? toAbs(sources[0]) : '#';
            overlay.innerHTML = '<div class="vf-content">'
              + '<div class="vf-title">Video not available</div>'
              + '<div class="vf-actions">'
              + `<a class="vf-link primary" href="${first}" target="_blank" rel="noopener">Open file</a>`
              + '</div></div>';
            if (wrap && !wrap.querySelector('.video-fallback')) wrap.appendChild(overlay);
            const show = () => { overlay.style.display = 'flex'; };
            const hide = () => { overlay.style.display = 'none'; };
            video.addEventListener('error', show);
            video.addEventListener('loadeddata', hide);
            video.addEventListener('canplay', hide);
            video.addEventListener('play', hide);
            // If all sources error, show overlay soon
            Array.from(video.querySelectorAll('source')).forEach(s => { s.addEventListener('error', show); });
            video.dataset.vfInstalled = '1';
          }
        } catch(_) {}
      } catch (_) {}
    });
    const queue = Array.from(root.querySelectorAll('video'))
      .filter(video => video && !video.hasAttribute('poster') && video.dataset.autoposterDone !== '1');

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const waitForMetadata = (video) => new Promise(resolve => {
      if (!video) return resolve();
      if (video.readyState >= 2) return resolve(); // HAVE_CURRENT_DATA is safest for draw
      const onMeta = () => { /* keep waiting for data */ };
      const onData = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); resolve(); };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('loadeddata', onData);
        video.removeEventListener('error', onErr);
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      video.addEventListener('loadeddata', onData, { once: true });
      video.addEventListener('error', onErr, { once: true });
      // Safety timeout: if we only get metadata, proceed after 1200ms
      setTimeout(() => { cleanup(); resolve(); }, 1200);
    });

    const LITE_POSTER = true; // Avoid seeks/play to improve stability
    const processVideo = async (video) => {
      try {
        // Skip if already set
        if (!video || video.hasAttribute('poster') || video.dataset.autoposterDone === '1') return;
        // Ensure minimal attributes for better UX
  if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
  if (!video.hasAttribute('playsinline')) video.setAttribute('playsinline', '');

        await waitForMetadata(video);

  // Snapshot original state to safely restore after probing
  const origTime = (() => { try { return Number(video.currentTime) || 0; } catch(_) { return 0; } })();
  const wasPaused = !!video.paused;

        const drawPoster = () => {
          try {
            const w = Math.max(1, Number(video.videoWidth) || 0);
            const h = Math.max(1, Number(video.videoHeight) || 0);
            if (!w || !h) return false;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            ctx.drawImage(video, 0, 0, w, h);
            // Reject too-dark frames
            try {
              const small = document.createElement('canvas');
              small.width = 16; small.height = 16;
              const sctx = small.getContext('2d');
              if (sctx) {
                sctx.drawImage(canvas, 0, 0, 16, 16);
                const img = sctx.getImageData(0, 0, 16, 16);
                let sum = 0, n = img.data.length / 4;
                for (let i = 0; i < img.data.length; i += 4) {
                  const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
                  sum += 0.2126*r + 0.7152*g + 0.0722*b;
                }
                const avg = sum / n;
                if (avg < 10) return false;
              }
            } catch(_) {}
            const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
            if (dataUrl && dataUrl.startsWith('data:image')) {
              video.setAttribute('poster', dataUrl);
              video.dataset.autoposterDone = '1';
              return true;
            }
          } catch (_) {}
          return false;
        };

        const captureAt = (t) => new Promise((resolve) => {
          const cleanup = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
          };
          const onSeeked = () => {
            const ok = drawPoster();
            cleanup();
            // Restore position to avoid leaving the media in a probed time
            try { if (Number.isFinite(origTime)) video.currentTime = origTime; } catch(_) {}
            resolve(ok);
          };
          const onError = () => {
            cleanup();
            try { if (Number.isFinite(origTime)) video.currentTime = origTime; } catch(_) {}
            resolve(false);
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          video.addEventListener('error', onError, { once: true });
          try {
            // Only seek to times within seekable ranges
            const seekable = video.seekable;
            if (!seekable || seekable.length === 0) { cleanup(); resolve(false); return; }
            let target = Number.isFinite(t) ? t : 0;
            let clamped = false;
            for (let i = 0; i < seekable.length; i++) {
              const start = seekable.start(i);
              const end = seekable.end(i);
              if (target >= start && target <= end) { clamped = true; break; }
            }
            if (!clamped) {
              const start = seekable.start(0);
              // Push a small epsilon inside the range
              target = Math.min(seekable.end(0) - 0.01, start + 0.12);
            }
            if (!Number.isFinite(target) || target < 0) { cleanup(); resolve(false); return; }
            video.currentTime = target;
          } catch (_) {
            cleanup(); resolve(false);
          }
        });

        const captureWithRVFC = () => new Promise((resolve) => {
          try {
            if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
              resolve(false); return;
            }
            const rvfc = video.requestVideoFrameCallback.bind(video);
            const id = rvfc(() => { const ok = drawPoster(); resolve(!!ok); });
            setTimeout(() => { try { video.cancelVideoFrameCallback && video.cancelVideoFrameCallback(id); } catch(_){} resolve(false); }, 450);
          } catch (_) { resolve(false); }
        });

    const captureByPlayPause = async () => {
          const wasPaused = video.paused;
          const wasMuted = video.muted;
          try {
      // Only attempt if user has interacted, to avoid blocked autoplay states
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
            video.muted = true;
            await (video.play && video.play().catch(() => {}));
            await delay(180);
            const ok = drawPoster();
            if (ok) return true;
          } catch (_) {}
          finally {
            try { video.pause && video.pause(); } catch(_) {}
      try { if (Number.isFinite(origTime)) video.currentTime = origTime; } catch(_) {}
            video.muted = wasMuted;
            if (!wasPaused) { try { await video.play(); } catch(_) {} }
          }
          return false;
        };

        // Attempt strategies
        // Build offsets inside first seekable range
        const offsets = [];
        const seekable = video.seekable;
        const hasRange = seekable && seekable.length > 0;
        const rStart = hasRange ? seekable.start(0) : 0;
        const rEnd = hasRange ? seekable.end(0) : Math.max(1, Number(video.duration) || 1);
        const dur = Math.max(0, rEnd - rStart);
        const base = dur > 0.25 ? Math.min(rStart + 0.25, rStart + dur / 12) : rStart + 0.14;
        offsets.push(base);
        if (dur) {
          offsets.push(Math.min(rEnd - 0.5, rStart + dur * 0.05));
          offsets.push(Math.min(rEnd - 0.1, rStart + dur * 0.1));
        }

        if (drawPoster()) return;
        if (await captureWithRVFC()) return;
        if (LITE_POSTER) return; // Skip aggressive strategies in lite mode
        // Avoid aggressive seeks on iOS Safari or QuickTime MOV sources
        const ua = navigator.userAgent || '';
        const isIOS = /iP(hone|ad|od)/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document);
        const srcUrl = String(video.currentSrc || (video.querySelector('source') && video.querySelector('source').src) || '').toLowerCase();
        const isMov = srcUrl.endsWith('.mov') || srcUrl.includes('video/quicktime');
        if (isMov) {
          // Skip auto poster for MOV/QuickTime to avoid WebKit decode issues
        } else if (!isIOS) {
          for (const off of offsets) {
            const ok = await captureAt(off);
            if (ok) { return; }
          }
          const ok0 = await captureAt(0);
          if (ok0) { return; }
        }
        await captureByPlayPause();

        // Ensure final state is sane
        try { if (Number.isFinite(origTime)) video.currentTime = origTime; } catch(_) {}
        if (!wasPaused) { try { await video.play(); } catch(_) {} }
      } catch (_) { /* ignore per-video errors */ }
    };

    (async () => {
      for (const v of queue) {
        await processVideo(v);
        // brief gap between videos to reduce decoder contention
        await delay(80);
      }
    })();
  } catch (_) {}
}


// Transform standalone internal links (?id=...) into rich article cards
function hydrateInternalLinkCards(container) {
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
      try { const u = new URL(href, window.location.href); return u.searchParams.get('id'); } catch (_) { return null; }
    };

    // Simple cache to avoid refetching the same markdown multiple times per page
    const mdCache = new Map(); // location -> Promise<string>

    anchors.forEach(a => {
      const rawLoc = parseId(a.getAttribute('href') || '');
      if (!rawLoc) return;
      // Prefer current-language alias if available (e.g., link points to main_en.md but UI is zh)
      const aliased = (locationAliasMap && locationAliasMap.has(rawLoc)) ? locationAliasMap.get(rawLoc) : rawLoc;
      // Allow either the raw location or its alias (covers cross-language links)
      if (!allowedLocations.has(rawLoc) && !allowedLocations.has(aliased)) return;
      const loc = aliased;

      // Only convert when link is the only content in its block container (p/li/div)
      const parent = a.parentElement;
      const isStandalone = parent && ['P', 'LI', 'DIV'].includes(parent.tagName) && isWhitespaceOnlySiblings(a);
      const titleAttr = (a.getAttribute('title') || '').trim();
      const forceCard = /\b(card|preview)\b/i.test(titleAttr) || a.hasAttribute('data-card') || a.classList.contains('card');
      if (!isStandalone && !forceCard) return;

      // Lookup metadata from loaded index cache
  const title = postsByLocationTitle[loc] || loc;
  const meta = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => v && v.location === loc)?.[1] || {};
  const href = withLangParam(`?id=${encodeURIComponent(loc)}`);
      const tagsHtml = meta ? renderTags(meta.tag) : '';
      const dateHtml = meta && meta.date ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
      const draftHtml = meta && meta.draft ? `<span class="card-draft">${t('ui.draftBadge')}</span>` : '';
      // Allow relative frontmatter image (e.g., 'cover.jpg'); resolve against the post's folder
      const rawCover = meta && (meta.thumb || meta.cover || meta.image);
      let coverSrc = rawCover;
  if (rawCover && typeof rawCover === 'string' && !/^https?:\/\//i.test(rawCover) && !rawCover.startsWith('/') && !rawCover.includes('/')) {
        const baseLoc = (meta && meta.location) || loc; // use current link's location as base
        const lastSlash = String(baseLoc || '').lastIndexOf('/');
        const baseDir = lastSlash >= 0 ? String(baseLoc).slice(0, lastSlash + 1) : '';
        coverSrc = (baseDir + rawCover).replace(/\/+/, '/');
      }
      const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
      const cover = (coverSrc)
        ? `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(title)}" data-src="${cardImageSrc(coverSrc)}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`
        : (useFallbackCover ? fallbackCover(title) : '');

      const wrapper = document.createElement('div');
      wrapper.className = 'link-card-wrap';
      const initialMeta = [dateHtml, draftHtml].filter(Boolean).join('<span class="card-sep">•</span>');
      wrapper.innerHTML = `<a class="link-card" href="${href}">${cover}<div class="card-title">${escapeHtml(title)}</div><div class="card-excerpt">${t('ui.loading')}</div><div class="card-meta">${initialMeta}</div>${tagsHtml}</a>`;

      // If index metadata provides an explicit excerpt, prefer it immediately
      try {
        const exNode = wrapper.querySelector('.card-excerpt');
        if (exNode && meta && meta.excerpt) {
          exNode.textContent = String(meta.excerpt);
        }
      } catch (_) {}

      // Placement rules:
      // - If standalone in LI: replace the anchor to keep list structure
      // - If standalone in P/DIV: replace the container with the card
      // - If forced (title contains 'card' or similar) but not standalone:
      //   insert the card right after the parent block, remove the anchor;
      //   if the parent becomes empty, remove it too.
      if (parent.tagName === 'LI' && isStandalone) {
        a.replaceWith(wrapper);
      } else if (isStandalone && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        const target = parent;
        target.parentNode.insertBefore(wrapper, target);
        target.remove();
      } else {
        // forced-card, inline inside a block
        const after = parent.nextSibling;
        parent.parentNode.insertBefore(wrapper, after);
        // remove the anchor from inline text
        a.remove();
        // if paragraph becomes empty/whitespace, remove it
        if (!parent.textContent || !parent.textContent.trim()) {
          parent.remove();
        }
      }

      // Lazy-hydrate cover image
      hydrateCardCovers(wrapper);

      // Fetch markdown to compute excerpt + read time
      const ensureMd = (l) => {
        if (!mdCache.has(l)) mdCache.set(l, getFile(`${getContentRoot()}/${l}`).catch(() => ''));
        return mdCache.get(l);
      };
      ensureMd(loc).then(md => {
        if (!wrapper.isConnected) return;
        const ex = extractExcerpt(md, 50);
        const minutes = computeReadTime(md, 200);
        const card = wrapper.querySelector('a.link-card');
        if (!card) return;
        const exEl = card.querySelector('.card-excerpt');
  // Only override excerpt if no explicit excerpt in metadata
  if (exEl && !(meta && meta.excerpt)) exEl.textContent = ex;
        const metaEl = card.querySelector('.card-meta');
        if (metaEl) {
          // Rebuild meta using DOM nodes instead of HTML strings
          const items = [];
          const dateEl = metaEl.querySelector('.card-date');
          if (dateEl && dateEl.textContent.trim()) items.push(dateEl.cloneNode(true));
          const read = document.createElement('span');
          read.className = 'card-read';
          read.textContent = `${minutes} ${t('ui.minRead')}`;
          items.push(read);
          if (meta && meta.draft) {
            const d = document.createElement('span');
            d.className = 'card-draft';
            d.textContent = t('ui.draftBadge');
            items.push(d);
          }
          // Clear and append with separators
          metaEl.textContent = '';
          items.forEach((node, idx) => {
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

// Load cover images sequentially to reduce bandwidth contention
function sequentialLoadCovers(container, maxConcurrent = 1) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('.index img.card-cover'));
    let idx = 0;
    let active = 0;
    const startNext = () => {
      while (active < maxConcurrent && idx < imgs.length) {
        const img = imgs[idx++];
        if (!img || !img.isConnected) continue;
        const src = img.getAttribute('data-src');
        if (!src) continue;
        active++;
        const done = () => { active--; img.removeEventListener('load', done); img.removeEventListener('error', done); startNext(); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        // Kick off the actual request
        img.src = src;
      }
    };
    startNext();
  } catch (_) {}
}

// renderSkeletonArticle moved to utils.js

// RenderPostMetaCard moved to ./js/templates.js

// RenderOutdatedCard moved to ./js/templates.js

let hasInitiallyRendered = false;

function renderTabs(activeSlug, searchQuery) {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;

  // Safer helpers for building and injecting tabs without using innerHTML/DOMParser
  const buildSafeTrackFromHtml = (markup) => {
    const safeTrack = document.createElement('div');
    safeTrack.className = 'tabs-track';
    const src = String(markup || '');
    // Very small, purpose-built tokenizer for our generated <a/span class="tab ..." data-slug="...">label</...>
    const tagRe = /<(a|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    const getAttr = (attrs, name) => {
      const m = attrs.match(new RegExp(name + '="([^"]*)"', 'i'));
      return m ? m[1] : '';
    };
    const hasActive = (attrs) => /class="[^"]*\bactive\b[^"]*"/i.test(attrs);
    // Decode the small set of entities we produce via escapeHtml
    const decodeEntities = (text) => String(text || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    let m;
    while ((m = tagRe.exec(src)) !== null) {
      const tag = (m[1] || '').toLowerCase();
      const attrs = m[2] || '';
      const inner = m[3] || '';
      const slug = getAttr(attrs, 'data-slug');
      const href = tag === 'a' ? getAttr(attrs, 'href') : '';
      const el = document.createElement(tag);
      el.className = `tab${hasActive(attrs) ? ' active' : ''}`;
      if (slug) el.setAttribute('data-slug', slug);
      if (href && tag === 'a') el.setAttribute('href', href);
      // Strip any tags just in case (shouldn't be present) then decode basic entities
      const label = decodeEntities(inner.replace(/<[^>]*>/g, ''));
      el.textContent = label;
      safeTrack.appendChild(el);
    }
    return safeTrack;
  };

  const setTrackHtml = (targetNav, markup) => {
    const safeTrack = buildSafeTrackFromHtml(markup);
    const existing = targetNav.querySelector('.tabs-track');
    if (!existing) {
      while (targetNav.firstChild) targetNav.removeChild(targetNav.firstChild);
      targetNav.appendChild(safeTrack);
    } else {
      while (existing.firstChild) existing.removeChild(existing.firstChild);
      Array.from(safeTrack.children).forEach(ch => existing.appendChild(ch));
    }
  };
  
  const make = (slug, label) => {
    const href = withLangParam(`?tab=${encodeURIComponent(slug)}`);
  return `<a class="tab${activeSlug===slug?' active':''}" data-slug="${slug}" href="${href}">${escapeHtml(String(label || ''))}</a>`;
  };
  
  // Build full tab list first (home first, optionally include All Posts if enabled), then other tabs
  const homeSlug = getHomeSlug();
  const homeLabel = getHomeLabel();
  let html = make(homeSlug, homeLabel);
  if (postsEnabled() && homeSlug !== 'posts') {
    html += make('posts', t('ui.allPosts'));
  }
  for (const [slug, info] of Object.entries(tabsBySlug)) {
    if (slug === homeSlug) continue;
    html += make(slug, info.title);
  }
  if (activeSlug === 'search') {
    const sp = new URLSearchParams(window.location.search);
    const tag = (sp.get('tag') || '').trim();
    const q = (sp.get('q') || String(searchQuery || '')).trim();
    const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
    const label = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
  html += `<a class="tab active" data-slug="search" href="${href}">${escapeHtml(String(label || ''))}</a>`;
  } else if (activeSlug === 'post') {
    const raw = String(searchQuery || t('ui.postTab')).trim();
    const label = raw ? escapeHtml(raw.length > 28 ? raw.slice(0,25) + '…' : raw) : t('ui.postTab');
  html += `<span class="tab active" data-slug="post">${label}</span>`;
  }

  // Helper: measure width of given markup inside a temporary element
  const measureWidth = (markup) => {
    try {
      const tempNav = nav.cloneNode(false);
      setTrackHtml(tempNav, markup);
      tempNav.style.position = 'absolute';
      tempNav.style.visibility = 'hidden';
      tempNav.style.pointerEvents = 'none';
      tempNav.style.width = 'auto';
      tempNav.style.zIndex = '-1000';
      // Use the same parent to ensure identical CSS context
      (nav.parentNode || document.body).appendChild(tempNav);
      const w = tempNav.offsetWidth;
      tempNav.parentNode.removeChild(tempNav);
      return w;
    } catch (_) {
      return 0;
    }
  };

  // If full tab list doesn't fit, collapse to minimal: All Posts + active tab
  try {
    const containerWidth = ((nav.parentElement && nav.parentElement.getBoundingClientRect && nav.parentElement.getBoundingClientRect().width) || nav.clientWidth || 0);
    const fullWidth = measureWidth(html);
    // Build compact HTML candidate: Home + active only
    let compact = make(homeSlug, homeLabel);
    if (activeSlug === 'search') {
      const sp = new URLSearchParams(window.location.search);
      const tag = (sp.get('tag') || '').trim();
      const q = (sp.get('q') || String(searchQuery || '')).trim();
      const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
      const label = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
      compact += `<a class="tab active" data-slug="search" href="${href}">${escapeHtml(String(label || ''))}</a>`;
    } else if (activeSlug === 'post') {
      const raw = String(searchQuery || t('ui.postTab')).trim();
      const label = raw ? escapeHtml(raw.length > 28 ? raw.slice(0,25) + '…' : raw) : t('ui.postTab');
      compact += `<span class="tab active" data-slug="post">${label}</span>`;
    } else if (activeSlug && activeSlug !== 'posts') {
      // Active static tab from tabs.yaml
      const info = tabsBySlug[activeSlug];
      const label = info && info.title ? info.title : activeSlug;
      compact += make(activeSlug, label).replace('"tab ', '"tab active ');
    }
    // If compact still doesn't fit (e.g. very long post title), truncate active label harder
    if (containerWidth && measureWidth(compact) > containerWidth - 8) {
      if (activeSlug === 'post') {
        const raw = String(searchQuery || t('ui.postTab')).trim();
        const label = raw ? escapeHtml(raw.length > 16 ? raw.slice(0,13) + '…' : raw) : t('ui.postTab');
        compact = make(homeSlug, homeLabel) + `<span class="tab active" data-slug="post">${label}</span>`;
      } else if (activeSlug === 'search') {
        const sp = new URLSearchParams(window.location.search);
        const tag = (sp.get('tag') || '').trim();
        const q = (sp.get('q') || String(searchQuery || '')).trim();
        const labelRaw = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
        const label = escapeHtml(labelRaw.length > 16 ? labelRaw.slice(0,13) + '…' : labelRaw);
        const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
        compact = make(homeSlug, homeLabel) + `<a class="tab active" data-slug="search" href="${href}">${label}</a>`;
      }
    }

    // Hysteresis to avoid flicker on tiny viewport changes (e.g., mobile URL bar show/hide)
    const currentlyCompact = nav.classList.contains('compact');
    const fullFits = !!(containerWidth && fullWidth && (fullWidth <= containerWidth - 8));
    const fullFitsComfortably = !!(containerWidth && fullWidth && (fullWidth <= containerWidth - 40));

    let useCompact = currentlyCompact ? !fullFitsComfortably : !fullFits;
    // Choose markup accordingly
    if (useCompact) {
      html = compact;
      nav.classList.add('compact');
    } else {
      // Keep/return to full list
      nav.classList.remove('compact');
    }
  } catch (_) {
    // On any error, fall back to current mode without forcing reflow
  }
  
  // No transition on first load - just set content
  if (!hasInitiallyRendered) {
    // Create a persistent track so overlay (and ::before/::after) aren't recreated
    setTrackHtml(nav, html);
    // Create the highlight overlay element
    ensureHighlightOverlay(nav);
    hasInitiallyRendered = true;
    updateMovingHighlight(nav);
    return;
  }
  
  // Smooth transition only after initial render
  const currentTrack = nav.querySelector('.tabs-track');
  const currentMarkup = currentTrack ? currentTrack.innerHTML : '';
  if (currentMarkup !== html) {
    // Mark currently active tab for deactivation animation (only dynamic tabs)
    const currentActiveTab = nav.querySelector('.tab.active');
    if (currentActiveTab) {
      const curSlug = (currentActiveTab.dataset && currentActiveTab.dataset.slug) || '';
      if (curSlug === 'post' || curSlug === 'search') {
        currentActiveTab.classList.add('deactivating');
      }
    }
    
    // Measure current width only
    const currentWidth = nav.offsetWidth;
    
    // Create a temporary hidden element to measure new width
    const newWidth = measureWidth(html);
    
  // Set explicit width only and start transition (no opacity changes)
  nav.style.width = `${currentWidth}px`;
  const shrinking = newWidth < currentWidth;
  const growing = newWidth > currentWidth;
  // Faster expansion, slightly delayed shrink
  nav.style.transition = `${growing ? 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0s' : `width 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${shrinking ? '0.06s' : '0s'}`}`;
    
    // Use Apple-style timing for more elegant perception
  // Wait a bit longer so the deactivating animation can play smoothly
  setTimeout(() => {
      // Only replace inner track content, keep wrapper/overlay
      setTrackHtml(nav, html);
  // Ensure highlight overlay exists after content change
  ensureHighlightOverlay(nav);
  nav.style.width = `${newWidth}px`;
      
      // Update highlight immediately when content changes
      updateMovingHighlight(nav);
      // Trigger activating->in sequence only for dynamic tabs (post/search)
      try {
        const newActive = nav.querySelector('.tab.active');
        const newSlug = (newActive && newActive.dataset && newActive.dataset.slug) || '';
        if (newActive && (newSlug === 'post' || newSlug === 'search')) {
          newActive.classList.add('activating');
          // next frame add .in to play entrance animation
          requestAnimationFrame(() => {
            newActive.classList.add('in');
            // cleanup after animation completes
            setTimeout(() => {
              newActive.classList.remove('activating', 'in');
            }, 260);
          });
        }
      } catch (_) {}
      
  // Reset width to auto after transition
  const resetDelay = growing ? 380 : (shrinking ? 660 : 600);
  setTimeout(() => {
        nav.style.width = 'auto';
        nav.style.transition = ''; // Reset transition
  }, resetDelay); // Match the width transition duration used above
  }, 180); // Snappy swap timed with ~0.14–0.2s poof
  } else {
    // Just update highlight position if content hasn't changed
    updateMovingHighlight(nav);
  }
}

let _pendingHighlightRaf = 0;

// Ensure the highlight overlay element exists
function ensureHighlightOverlay(nav) {
  if (!nav) return;
  
  let overlay = nav.querySelector('.highlight-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'highlight-overlay';
    // Place overlay before the track so it sits visually beneath text but above background
    nav.appendChild(overlay);
  }
  return overlay;
}

// Update the moving highlight overlay position
function updateMovingHighlight(nav) {
  if (!nav) return;

  ensureHighlightOverlay(nav);

  // Coalesce multiple calls into a single rAF to avoid flicker
  if (_pendingHighlightRaf) cancelAnimationFrame(_pendingHighlightRaf);
  _pendingHighlightRaf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const activeTab = nav.querySelector('.tab.active');

      // Clean up any previous transition classes once per tick
      nav.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('activating', 'deactivating');
      });

      if (activeTab) {
        const tabRect = activeTab.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const left = Math.max(0, tabRect.left - navRect.left);
        const width = tabRect.width;

        nav.style.setProperty('--highlight-left', `${left}px`);
        nav.style.setProperty('--highlight-width', `${width}px`);
        nav.style.setProperty('--highlight-opacity', '1');

        nav.style.setProperty('--indicator-left', `${left}px`);
        nav.style.setProperty('--indicator-width', `${Math.max(0, width * 0.85)}px`);
        nav.style.setProperty('--indicator-opacity', '1');

        activeTab.classList.add('activating');
        setTimeout(() => activeTab.classList.remove('activating'), 420);
      } else {
        nav.style.setProperty('--highlight-opacity', '0');
        nav.style.setProperty('--indicator-opacity', '0');
      }

      setupTabHoverEffects(nav);
      _pendingHighlightRaf = 0;
    });
  });
}

// Setup hover preview effects for tabs
function setupTabHoverEffects(nav) {
  if (!nav) return;
  
  // Remove existing listeners
  nav.querySelectorAll('.tab').forEach(tab => {
    tab.removeEventListener('mouseenter', tab._hoverHandler);
    tab.removeEventListener('mouseleave', tab._leaveHandler);
  });
  
  nav.querySelectorAll('.tab').forEach(tab => {
    // Store handlers for cleanup
    tab._hoverHandler = function() {
      if (this.classList.contains('active')) return;
      
      const tabRect = this.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      
      // Show preview for both overlay and indicator
      nav.style.setProperty('--preview-left', `${left}px`);
      nav.style.setProperty('--preview-width', `${width * 0.85}px`);
      nav.style.setProperty('--preview-opacity', '0.4'); // More subtle Apple-style preview
    };
    
    tab._leaveHandler = function() {
      nav.style.setProperty('--preview-opacity', '0');
    };
    
    tab.addEventListener('mouseenter', tab._hoverHandler);
    tab.addEventListener('mouseleave', tab._leaveHandler);
  });
}

// Render footer navigation: Home (All Posts) + custom tabs
function renderFooterNav() {
  const nav = document.getElementById('footerNav');
  if (!nav) return;
  const defaultTab = getHomeSlug();
  const currentTab = (getQueryVariable('tab') || (getQueryVariable('id') ? 'post' : defaultTab)).toLowerCase();
  const make = (href, label, cls = '') => `<a class="${cls}" href="${withLangParam(href)}">${label}</a>`;
  const isActive = (slug) => currentTab === slug;
  let html = '';
  const homeSlug = getHomeSlug();
  const homeLabel = getHomeLabel();
  html += make(`?tab=${encodeURIComponent(homeSlug)}`, homeLabel, isActive(homeSlug) ? 'active' : '');
  if (postsEnabled() && homeSlug !== 'posts') {
    html += ' ' + make('?tab=posts', t('ui.allPosts'), isActive('posts') ? 'active' : '');
  }
  // (Search link intentionally omitted in footer)
  for (const [slug, info] of Object.entries(tabsBySlug)) {
    if (slug === homeSlug) continue;
    const href = `?tab=${encodeURIComponent(slug)}`;
    const label = info && info.title ? info.title : slug;
    html += ' ' + make(href, label, isActive(slug) ? 'active' : '');
  }
  nav.innerHTML = html;
}

// Re-evaluate and collapse/expand tabs on viewport changes (debounced)
let _tabsResizeTimer = 0;
function setupResponsiveTabsObserver() {
  try {
    if (setupResponsiveTabsObserver.__done) return;
    setupResponsiveTabsObserver.__done = true;
    const getCurrentPostTitle = () => {
      try {
        const el = document.querySelector('#mainview .post-meta-card .post-meta-title');
        const txt = (el && el.textContent) ? el.textContent.trim() : '';
        if (txt) return txt;
      } catch (_) {}
      try { return getArticleTitleFromMain() || ''; } catch (_) { return ''; }
    };
    const rerender = () => {
      try {
        const id = getQueryVariable('id');
        const tab = (getQueryVariable('tab') || '').toLowerCase();
        const q = getQueryVariable('q') || '';
        const tag = getQueryVariable('tag') || '';
        if (id) {
          // Preserve the current article title on responsive re-render
          const title = getCurrentPostTitle();
          renderTabs('post', title);
        } else if (tab === 'search') {
          renderTabs('search', tag || q);
        } else if (tab && tab !== 'posts' && tabsBySlug[tab]) {
          renderTabs(tab);
        } else {
          renderTabs('posts');
        }
      } catch (_) {}
    };
    const handler = () => {
      clearTimeout(_tabsResizeTimer);
      _tabsResizeTimer = setTimeout(rerender, 140);
    };
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler, { passive: true });
  } catch (_) {}
}

function displayPost(postname) {
  // Bump request token to invalidate any in-flight older renders
  const reqId = (++__activePostRequestId);
  // Add loading-state classes to keep layout stable
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  if (contentEl) contentEl.classList.add('loading', 'layout-stable');
  if (sidebarEl) sidebarEl.classList.add('loading');
  if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
  
  // Loading state for post view
  const toc = document.getElementById('tocview');
  if (toc) {
  toc.innerHTML = `<div class=\"toc-header\"><span>${t('ui.contents')}</span><span style=\"font-size:.85rem; color: var(--muted);\">${t('ui.loading')}</span></div>`
      + '<ul class="toc-skeleton">'
      + '<li><div class="skeleton-block skeleton-line w-90"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-80"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-85"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-70"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-60"></div></li>'
      + '</ul>';
  smoothShow(toc);
  ensureAutoHeight(toc);
  }
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();

  return getFile(`${getContentRoot()}/${postname}`).then(markdown => {
    // Ignore stale responses if a newer navigation started
    if (reqId !== __activePostRequestId) return;
    // Remove loading-state classes
    if (contentEl) contentEl.classList.remove('loading');
    if (sidebarEl) sidebarEl.classList.remove('loading');
    
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
  try { hydrateInternalLinkCards('#mainview'); } catch (_) {}
  try { hydratePostVideos('#mainview'); } catch (_) {}
  // Wire up copy-link buttons on all post meta cards
  try {
    const copyBtns = Array.from(document.querySelectorAll('#mainview .post-meta-card .post-meta-copy'));
    copyBtns.forEach((copyBtn) => {
      copyBtn.addEventListener('click', async () => {
        const url = String(location.href || '').split('#')[0];
        let ok = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url); ok = true;
          } else {
            const tmp = document.createElement('textarea');
            tmp.value = url; document.body.appendChild(tmp); tmp.select();
            ok = document.execCommand('copy'); document.body.removeChild(tmp);
          }
        } catch (_) { ok = false; }
        if (ok) {
          const prevTitle = copyBtn.getAttribute('title') || '';
          copyBtn.classList.add('copied');
          copyBtn.setAttribute('title', t('ui.linkCopied') || t('code.copied'));
          setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.setAttribute('title', prevTitle || t('ui.copyLink')); }, 1000);
        }
      });
    });
  } catch (_) {}
  // Attach floating tooltips to all AI flags (consistent with tag tooltips)
  try {
    const aiFlags = Array.from(document.querySelectorAll('#mainview .post-meta-card .ai-flag'));
    aiFlags.forEach((aiFlag) => attachHoverTooltip(aiFlag, () => t('ui.aiFlagTooltip'), { delay: 0 }));
  } catch (_) {}
  // Always use the localized title from index.yaml for display/meta/tab labels
  const articleTitle = fallback;
    // If title changed after parsing, update the card's title text
    try {
      const titleEls = Array.from(document.querySelectorAll('#mainview .post-meta-card .post-meta-title'));
      titleEls.forEach((titleEl) => {
        const ai = titleEl.querySelector('.ai-flag');
        const aiClone = ai ? ai.cloneNode(true) : null;
        // Rebuild title node content safely
        titleEl.textContent = '';
        if (aiClone) {
          // Avoid native title tooltip overlap
          aiClone.removeAttribute('title');
          titleEl.appendChild(aiClone);
          try { attachHoverTooltip(aiClone, () => t('ui.aiFlagTooltip'), { delay: 0 }); } catch (_) {}
        }
        titleEl.appendChild(document.createTextNode(String(articleTitle || '')));
      });
    } catch (_) {}
    
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
    const toc = document.getElementById('tocview');
    if (toc) {
      toc.innerHTML = `<div class=\"toc-header\"><span>${escapeHtml(articleTitle)}</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">${t('ui.top')}</a></div>${output.toc}`;
      smoothShow(toc);
  ensureAutoHeight(toc);
    }
    const searchBox = document.getElementById('searchbox');
    if (searchBox) smoothHide(searchBox);
  const tagBox = document.getElementById('tagview');
  if (tagBox) smoothHide(tagBox);
    try { setDocTitle(articleTitle); } catch (_) {}
    try { setupAnchors(); } catch (_) {}
    try { setupTOC(); } catch (_) {}
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
    if (contentEl) contentEl.classList.remove('loading');
    if (sidebarEl) sidebarEl.classList.remove('loading');
    
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

    document.getElementById('tocview').innerHTML = '';
    const backHref = withLangParam(`?tab=${encodeURIComponent(getHomeSlug())}`);
    const backText = postsEnabled() ? t('ui.backToAllPosts') : (t('ui.backToHome') || t('ui.backToAllPosts'));
    document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('errors.postNotFoundTitle')}</h3><p>${t('errors.postNotFoundBody')} <a href=\"${backHref}\">${backText}</a>.</p></div>`;
    setDocTitle(t('ui.notFound'));
    const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothHide(searchBox);
  const tagBox = document.getElementById('tagview');
  if (tagBox) smoothHide(tagBox);
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

  let html = '<div class="index">';
  for (const [key, value] of pageEntries) {
    const tag = value ? renderTags(value.tag) : '';
    // Prefer a smaller thumbnail if provided: `thumb` or `cover`; fallback to `image`
    let coverSrc = value && (value.thumb || value.cover || value.image);
  if (coverSrc && typeof coverSrc === 'string' && !/^https?:\/\//i.test(coverSrc) && !coverSrc.startsWith('/') && !coverSrc.includes('/')) {
      const baseLoc = value && value.location ? String(value.location) : '';
      const lastSlash = baseLoc.lastIndexOf('/');
      const baseDir = lastSlash >= 0 ? baseLoc.slice(0, lastSlash + 1) : '';
      coverSrc = (baseDir + coverSrc).replace(/\/+/, '/');
    }
    const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
    const cover = (value && coverSrc)
      ? `<div class=\"card-cover-wrap\"><div class=\"ph-skeleton\" aria-hidden=\"true\"></div><img class=\"card-cover\" alt=\"${key}\" data-src=\"${cardImageSrc(coverSrc)}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" width=\"1600\" height=\"1000\"></div>`
      : (useFallbackCover ? fallbackCover(key) : '');
    // pre-render meta line with date if available; read time appended after fetch
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class=\"card-date\">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    const verCount = (value && Array.isArray(value.versions)) ? value.versions.length : 0;
    const versionsHtml = verCount > 1 ? `<span class=\"card-versions\" title=\"${t('ui.versionLabel')}\">${t('ui.versionsCount', verCount)}</span>` : '';
    const draftHtml = (value && value.draft) ? `<span class=\"card-draft\">${t('ui.draftBadge')}</span>` : '';
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (versionsHtml) parts.push(versionsHtml);
    if (draftHtml) parts.push(draftHtml);
    const metaInner = parts.join('<span class=\"card-sep\">•</span>');
    html += `<a href=\"${withLangParam(`?id=${encodeURIComponent(value['location'])}`)}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div><div class=\"card-meta\">${metaInner}</div>${tag}</a>`;
  }
  html += '</div>';
  // Pagination controls
  if (totalPages > 1) {
    const makeLink = (p, label, cls = '') => `<a class=\"${cls}\" href=\"${withLangParam(`?tab=posts&page=${p}`)}\">${label}</a>`;
    const makeSpan = (label, cls = '') => `<span class=\"${cls}\">${label}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, t('ui.prev'), 'page-prev') : makeSpan(t('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class=\"page-num active\">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, t('ui.next'), 'page-next') : makeSpan(t('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }
  document.getElementById('mainview').innerHTML = html;
  hydrateCardCovers('#mainview');
  applyLazyLoadingIn('#mainview');
  // Check potential large thumbnails on index view
  try {
    const cfg = (siteConfig && siteConfig.assetWarnings && siteConfig.assetWarnings.largeImage) || {};
    warnLargeImagesIn('#mainview', cfg);
  } catch (_) {}
  sequentialLoadCovers('#mainview', 1);
  // Apply masonry layout after initial paint
  requestAnimationFrame(() => applyMasonry('.index'));

  setupSearch(entries);
  try { renderTagSidebar(postsIndexCache); } catch (_) {}
  renderTabs('posts');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothShow(searchBox);
  const tagBox = document.getElementById('tagview');
  if (tagBox) smoothShow(tagBox);
  setDocTitle(t('titles.allPosts'));

  const cards = Array.from(document.querySelectorAll('.index a'));
  pageEntries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    const el = cards[idx];
    if (!el) return;
    const exEl = el.querySelector('.card-excerpt');
    // Prefer explicit excerpt from index.yaml when available
    if (exEl && meta && meta.excerpt) {
      try { exEl.textContent = String(meta.excerpt); } catch (_) {}
    }
    getFile(`${getContentRoot()}/${loc}`).then(md => {
      const ex = extractExcerpt(md, 50);
      // Only set excerpt from markdown if no explicit excerpt in metadata
      if (exEl && !(meta && meta.excerpt)) exEl.textContent = ex;
      // compute and render read time
      const minutes = computeReadTime(md, 200);
      const metaEl = el.querySelector('.card-meta');
      if (metaEl) {
        const items = [];
        const dateEl = metaEl.querySelector('.card-date');
        if (dateEl && dateEl.textContent.trim()) items.push(dateEl.cloneNode(true));
        const read = document.createElement('span');
        read.className = 'card-read';
        read.textContent = `${minutes} ${t('ui.minRead')}`;
        items.push(read);
        const verCount = (meta && Array.isArray(meta.versions)) ? meta.versions.length : 0;
        if (verCount > 1) {
          const v = document.createElement('span');
          v.className = 'card-versions';
          v.setAttribute('title', t('ui.versionLabel'));
          v.textContent = t('ui.versionsCount', verCount);
          items.push(v);
        }
        if (meta && meta.draft) {
          const d = document.createElement('span');
          d.className = 'card-draft';
          d.textContent = t('ui.draftBadge');
          items.push(d);
        }
        metaEl.textContent = '';
        items.forEach((node, idx) => {
          if (idx > 0) {
            const sep = document.createElement('span');
            sep.className = 'card-sep';
            sep.textContent = '•';
            metaEl.appendChild(sep);
          }
          metaEl.appendChild(node);
        });
      }
  // Recompute masonry span for the updated card
  const container = document.querySelector('.index');
  if (container && el) updateMasonryItem(container, el);
    }).catch(() => {});
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

  let html = '<div class="index">';
  for (const [key, value] of pageEntries) {
    const tag = value ? renderTags(value.tag) : '';
    let coverSrc = value && (value.thumb || value.cover || value.image);
  if (coverSrc && typeof coverSrc === 'string' && !/^https?:\/\//i.test(coverSrc) && !coverSrc.startsWith('/') && !coverSrc.includes('/')) {
      const baseLoc = value && value.location ? String(value.location) : '';
      const lastSlash = baseLoc.lastIndexOf('/');
      const baseDir = lastSlash >= 0 ? baseLoc.slice(0, lastSlash + 1) : '';
      coverSrc = (baseDir + coverSrc).replace(/\/+/, '/');
    }
    const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
    const cover = (value && coverSrc)
      ? `<div class=\"card-cover-wrap\"><div class=\"ph-skeleton\" aria-hidden=\"true\"></div><img class=\"card-cover\" alt=\"${key}\" data-src=\"${cardImageSrc(coverSrc)}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" width=\"1600\" height=\"1000\"></div>`
      : (useFallbackCover ? fallbackCover(key) : '');
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class=\"card-date\">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    const verCount = (value && Array.isArray(value.versions)) ? value.versions.length : 0;
    const versionsHtml = verCount > 1 ? `<span class=\"card-versions\" title=\"${t('ui.versionLabel')}\">${t('ui.versionsCount', verCount)}</span>` : '';
    const draftHtml = (value && value.draft) ? `<span class=\"card-draft\">${t('ui.draftBadge')}</span>` : '';
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (versionsHtml) parts.push(versionsHtml);
    if (draftHtml) parts.push(draftHtml);
    const metaInner = parts.join('<span class=\"card-sep\">•</span>');
    html += `<a href=\"${withLangParam(`?id=${encodeURIComponent(value['location'])}`)}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div><div class=\"card-meta\">${metaInner}</div>${tag}</a>`;
  }
  html += '</div>';

  if (total === 0) {
    const backHref = withLangParam(`?tab=${encodeURIComponent(getHomeSlug())}`);
    const backText = postsEnabled() ? t('ui.backToAllPosts') : (t('ui.backToHome') || t('ui.backToAllPosts'));
    html = `<div class=\"notice\"><h3>${t('ui.noResultsTitle')}</h3><p>${t('ui.noResultsBody', escapeHtml(q))} <a href=\"${backHref}\">${backText}</a>.</p></div>`;
  } else if (totalPages > 1) {
    const encQ = encodeURIComponent(q);
    const makeLink = (p, label, cls = '') => `<a class=\"${cls}\" href=\"${withLangParam(`?tab=search&q=${encQ}&page=${p}`)}\">${label}</a>`;
    const makeSpan = (label, cls = '') => `<span class=\"${cls}\">${label}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, t('ui.prev'), 'page-prev') : makeSpan(t('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class=\"page-num active\">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, t('ui.next'), 'page-next') : makeSpan(t('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }

  document.getElementById('mainview').innerHTML = html;
  hydrateCardCovers('#mainview');
  sequentialLoadCovers('#mainview', 1);
  // Check potential large thumbnails on search view
  try {
    const cfg = (siteConfig && siteConfig.assetWarnings && siteConfig.assetWarnings.largeImage) || {};
    warnLargeImagesIn('#mainview', cfg);
  } catch (_) {}
  renderTabs('search', tagFilter ? t('ui.tagSearch', tagFilter) : q);
  const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothShow(searchBox);
  const tagBox = document.getElementById('tagview');
  if (tagBox) smoothShow(tagBox);
  const input = document.getElementById('searchInput');
  if (input) input.value = q;
  setupSearch(Object.entries(postsIndexCache || {}));
  setDocTitle(tagFilter ? t('ui.tagSearch', tagFilter) : t('titles.search', q));
  // Apply masonry after search render
  requestAnimationFrame(() => applyMasonry('.index'));
  try { renderTagSidebar(postsIndexCache); } catch (_) {}

  const cards = Array.from(document.querySelectorAll('.index a'));
  pageEntries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    const el = cards[idx];
    if (!el) return;
    const exEl = el.querySelector('.card-excerpt');
    // Prefer explicit excerpt from index.yaml when available
    if (exEl && meta && meta.excerpt) {
      try { exEl.textContent = String(meta.excerpt); } catch (_) {}
    }
    getFile(`${getContentRoot()}/${loc}`).then(md => {
      const ex = extractExcerpt(md, 50);
      // Only set excerpt from markdown if no explicit excerpt in metadata
      if (exEl && !(meta && meta.excerpt)) exEl.textContent = ex;
      const minutes = computeReadTime(md, 200);
      const metaEl = el.querySelector('.card-meta');
      if (metaEl) {
        const items = [];
        const dateEl = metaEl.querySelector('.card-date');
        if (dateEl && dateEl.textContent.trim()) items.push(dateEl.cloneNode(true));
        const read = document.createElement('span');
        read.className = 'card-read';
        read.textContent = `${minutes} ${t('ui.minRead')}`;
        items.push(read);
        const verCount = (meta && Array.isArray(meta.versions)) ? meta.versions.length : 0;
        if (verCount > 1) {
          const v = document.createElement('span');
          v.className = 'card-versions';
          v.setAttribute('title', t('ui.versionLabel'));
          v.textContent = t('ui.versionsCount', verCount);
          items.push(v);
        }
        if (meta && meta.draft) {
          const d = document.createElement('span');
          d.className = 'card-draft';
          d.textContent = t('ui.draftBadge');
          items.push(d);
        }
        metaEl.textContent = '';
        items.forEach((node, idx) => {
          if (idx > 0) {
            const sep = document.createElement('span');
            sep.className = 'card-sep';
            sep.textContent = '•';
            metaEl.appendChild(sep);
          }
          metaEl.appendChild(node);
        });
      }
  const container = document.querySelector('.index');
  if (container && el) updateMasonryItem(container, el);
    }).catch(() => {});
  });
}

// --- Masonry helpers: keep gaps consistent while letting cards auto-height ---
// Recalculate on resize for responsive columns
window.addEventListener('resize', debounce(() => applyMasonry('.index'), 150));

// Re-apply masonry after fonts load (text metrics can change heights slightly)
try {
  if (document && document.fonts && !window.__masonryFontsReadyApplied) {
    window.__masonryFontsReadyApplied = true;
    document.fonts.ready.then(() => applyMasonry('.index')).catch(() => {});
  }
} catch (_) { /* noop */ }

// debounce and toPx are imported from './js/masonry.js'

function displayStaticTab(slug) {
  const tab = tabsBySlug[slug];
  if (!tab) return displayIndex({});
  
  // Add loading state class to maintain layout stability
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  if (contentEl) contentEl.classList.add('loading', 'layout-stable');
  if (sidebarEl) sidebarEl.classList.add('loading');
  if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
  
  const toc = document.getElementById('tocview');
  if (toc) { smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} }); }
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();
  const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothHide(searchBox);
  const tagBox = document.getElementById('tagview');
  if (tagBox) smoothHide(tagBox);
  renderTabs(slug);
  getFile(`${getContentRoot()}/${tab.location}`)
    .then(md => {
      // 移除加载状态类
      if (contentEl) contentEl.classList.remove('loading');
      if (sidebarEl) sidebarEl.classList.remove('loading');
      
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
  try { hydrateInternalLinkCards('#mainview'); } catch (_) {}
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
      if (contentEl) contentEl.classList.remove('loading');
      if (sidebarEl) sidebarEl.classList.remove('loading');
      
      // Surface an overlay for missing static tab page
      try {
        const url = `${getContentRoot()}/${tab.location}`;
        const msg = (t('errors.pageUnavailableBody') || 'Could not load this tab.') + (e && e.message ? ` (${e.message})` : '');
        const err = new Error(msg);
        try { err.name = 'Warning'; } catch(_) {}
        showErrorOverlay(err, { message: msg, origin: 'view.tab.unavailable', tagName: 'md', filename: url, assetUrl: url, tab: slug });
      } catch (_) {}

      document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('errors.pageUnavailableTitle')}</h3><p>${t('errors.pageUnavailableBody')}</p></div>`;
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



// Enhanced smooth click feedback with immediate highlight movement
function addTabClickAnimation(tab) {
  if (!tab || !tab.classList.contains('tab')) return;
  
  // Immediate visual feedback before navigation
  const nav = tab.closest('#tabsNav');
  if (nav && nav.id === 'tabsNav') {
    // Mark current active tab for deactivation
    const currentActive = nav.querySelector('.tab.active');
    if (currentActive && currentActive !== tab) {
      currentActive.classList.add('deactivating');
    }
    
    // Pre-move highlight to clicked tab for immediate feedback
    if (!tab.classList.contains('active')) {
      const tabRect = tab.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      
      // Immediately start moving the highlight overlay
      nav.style.setProperty('--highlight-left', `${left}px`);
      nav.style.setProperty('--highlight-width', `${width}px`);
      nav.style.setProperty('--highlight-opacity', '0.7'); // Slightly dimmer during transition for Apple-style elegance
      
      // Also move the bottom indicator
      nav.style.setProperty('--indicator-left', `${left}px`);
      nav.style.setProperty('--indicator-width', `${width * 0.85}px`);
      
      tab.classList.add('activating');
    }
  }
}

// Intercept in-app navigation and use History API
// isModifiedClick moved to utils.js

document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a') : null;
  // Handle outdated card close button
  const closeBtn = e.target && e.target.closest ? e.target.closest('.post-outdated-close') : null;
  if (closeBtn) {
    const card = closeBtn.closest('.post-outdated-card');
    if (card) {
      // Animate height collapse + fade/translate, then remove
      const startHeight = card.scrollHeight;
      card.style.height = startHeight + 'px';
      // Force reflow so the browser acknowledges the starting height
      // eslint-disable-next-line no-unused-expressions
      card.getBoundingClientRect();
      card.classList.add('is-dismissing');
      // Next frame, set height to 0 to trigger transition
      requestAnimationFrame(() => {
        card.style.height = '0px';
      });
      const cleanup = () => { card.remove(); };
      card.addEventListener('transitionend', cleanup, { once: true });
      // Fallback removal in case transitionend doesn't fire
      setTimeout(cleanup, 500);
    }
    return;
  }
  if (!a) return;
  
  // Add animation for tab clicks
  if (a.classList.contains('tab')) {
    addTabClickAnimation(a);
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
  updateMovingHighlight(nav);
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
initI18n({ defaultLang, persist: false });
// Expose translate helper for modules that don't import i18n directly
try { window.__ns_t = (key) => t(key); } catch (_) { /* no-op */ }

// Install error reporter early to catch resource 404s (e.g., theme CSS, images)
try { initErrorReporter({}); } catch (_) {}

// Ensure theme controls are present, then apply and bind
mountThemeControls();
applySavedTheme();
bindThemeToggle();
bindSeoGenerator();
bindThemePackPicker();
// Install lightweight image viewer (delegated; safe to call once)
try { installLightbox({ root: '#mainview' }); } catch (_) {}
// Localize search placeholder ASAP
try { const input = document.getElementById('searchInput'); if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder')); } catch (_) {}
// Observe viewport changes for responsive tabs
setupResponsiveTabsObserver();

// Soft reset to the site's default language without full reload
async function softResetToSiteDefaultLanguage() {
  try {
    const def = (siteConfig && (siteConfig.defaultLanguage || siteConfig.defaultLang)) || defaultLang || 'en';
    // Switch language immediately (do not persist to mimic reset semantics)
    initI18n({ lang: String(def), persist: false });
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
      bindSeoGenerator();
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
  .then(cfg => {
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
          initI18n({ lang: String(cfgDefaultLang) });
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
    
    // 为mainview容器添加稳定性类
    const mainviewContainer = document.getElementById('mainview')?.closest('.box');
    if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
    
  routeAndRender();
  })
  .catch((e) => {
    document.getElementById('tocview').innerHTML = '';
    document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('ui.indexUnavailable')}</h3><p>${t('errors.indexUnavailableBody')}</p></div>`;
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
