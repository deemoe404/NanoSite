import { installLightbox } from '../../../js/lightbox.js';
import { t, withLangParam, getCurrentLang } from '../../../js/i18n.js';
import { slugifyTab, escapeHtml, getQueryVariable, renderTags, cardImageSrc, fallbackCover, formatDisplayDate, formatBytes, sanitizeImageUrl, renderSkeletonArticle } from '../../../js/utils.js';
import { attachHoverTooltip } from '../../../js/tags.js';
import { prefersReducedMotion, getArticleTitleFromMain } from '../../../js/dom-utils.js';
import { renderPostMetaCard, renderOutdatedCard } from '../../../js/templates.js';
import { showErrorOverlay } from '../../../js/errors.js';
import { renderPostNav } from '../../../js/post-nav.js';
import { hydratePostImages, hydratePostVideos, applyLazyLoadingIn } from '../../../js/post-render.js';
import { hydrateInternalLinkCards } from '../../../js/link-cards.js';
import { applyLangHints } from '../../../js/typography.js';
import { mountThemeControls, applySavedTheme, bindThemeToggle, bindThemePackPicker, bindPostEditor } from '../../../js/theme.js';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;
const defaultDocument = typeof document !== 'undefined' ? document : undefined;

let hasInitiallyRendered = false;
let pendingHighlightRaf = 0;
let tabsResizeTimer = 0;
let responsiveObserverBound = false;
let lightboxInstalled = false;
let masonryHandlersBound = false;

function getUtility(params = {}, key, fallback) {
  try {
    const utils = params && params.utilities;
    const value = utils && utils[key];
    return typeof value === 'function' ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function getFetcher(windowRef = defaultWindow) {
  const candidate = windowRef && typeof windowRef.fetch === 'function'
    ? windowRef.fetch.bind(windowRef)
    : (typeof fetch === 'function' ? fetch : null);
  return candidate || null;
}

function getContainerByRole(role, documentRef = defaultDocument) {
  if (!documentRef) return null;
  try {
    switch (role) {
      case 'main':
        return documentRef.getElementById('mainview');
      case 'toc':
        return documentRef.getElementById('tocview');
      case 'sidebar':
        return documentRef.querySelector('.sidebar');
      case 'content':
        return documentRef.querySelector('.content');
      case 'container': {
        const main = getContainerByRole('main', documentRef);
        return main ? main.closest('.box') : null;
      }
      default:
        return null;
    }
  } catch (_) {
    return null;
  }
}

function resolveViewContainersNative(params = {}, documentRef = defaultDocument) {
  const view = params.view;
  const base = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const result = { view };
  if (base.mainElement) result.mainElement = base.mainElement;
  if (base.tocElement) result.tocElement = base.tocElement;
  if (base.sidebarElement) result.sidebarElement = base.sidebarElement;
  if (base.contentElement) result.contentElement = base.contentElement;
  if (base.containerElement) result.containerElement = base.containerElement;
  if (!result.mainElement) result.mainElement = getContainerByRole('main', documentRef);
  if (!result.tocElement) result.tocElement = getContainerByRole('toc', documentRef);
  if (!result.sidebarElement) result.sidebarElement = getContainerByRole('sidebar', documentRef);
  if (!result.contentElement) result.contentElement = getContainerByRole('content', documentRef);
  if (!result.containerElement) result.containerElement = getContainerByRole('container', documentRef);
  return result;
}

function updateSearchPlaceholderNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  const input = documentRef.getElementById('searchInput');
  if (!input) return false;
  const placeholder = params && params.placeholder != null ? String(params.placeholder) : '';
  input.setAttribute('placeholder', placeholder);
  return true;
}

function setupThemeControlsNative(params = {}) {
  const mount = typeof params.mountThemeControls === 'function' ? params.mountThemeControls : mountThemeControls;
  const apply = typeof params.applySavedTheme === 'function' ? params.applySavedTheme : applySavedTheme;
  const bindToggle = typeof params.bindThemeToggle === 'function' ? params.bindThemeToggle : bindThemeToggle;
  const bindEditor = typeof params.bindPostEditor === 'function' ? params.bindPostEditor : bindPostEditor;
  const bindPack = typeof params.bindThemePackPicker === 'function' ? params.bindThemePackPicker : bindThemePackPicker;
  try { mount(); } catch (_) {}
  try { apply(); } catch (_) {}
  try { bindToggle(); } catch (_) {}
  try { bindEditor(); } catch (_) {}
  try { bindPack(); } catch (_) {}
  return true;
}

function handleWindowResizeNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const nav = documentRef ? documentRef.getElementById('tabsNav') : null;
  if (!nav) return false;
  updateMovingHighlight(nav, windowRef, documentRef);
  return true;
}

async function checkImageSizeNative(url, timeoutMs = 4000, windowRef = defaultWindow) {
  const fetcher = getFetcher(windowRef);
  if (!fetcher) return null;
  const AbortCtor = (windowRef && windowRef.AbortController) ? windowRef.AbortController : (typeof AbortController !== 'undefined' ? AbortController : null);
  const controller = AbortCtor ? new AbortCtor() : null;
  const timer = (typeof setTimeout === 'function') ? setTimeout(() => {
    if (controller && typeof controller.abort === 'function') controller.abort();
  }, timeoutMs) : null;
  try {
    const headInit = controller ? { method: 'HEAD', signal: controller.signal } : { method: 'HEAD' };
    const headResp = await fetcher(url, headInit);
    if (timer) clearTimeout(timer);
    if (!headResp || !headResp.ok) throw new Error('HEAD failed');
    const len = headResp.headers && headResp.headers.get ? headResp.headers.get('content-length') : null;
    return len ? parseInt(len, 10) : null;
  } catch (_) {
    if (timer) clearTimeout(timer);
    try {
      const getResp = await fetcher(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      const cr = getResp && getResp.headers && getResp.headers.get ? getResp.headers.get('content-range') : null;
      if (cr) {
        const match = /\/(\d+)$/.exec(cr);
        if (match) return parseInt(match[1], 10);
      }
      const len = getResp && getResp.headers && getResp.headers.get ? getResp.headers.get('content-length') : null;
      return len ? parseInt(len, 10) : null;
    } catch (err) {
      return null;
    }
  }
}

async function warnLargeImagesInNative(containerSelector, cfg = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  try {
    if (!cfg || !cfg.enabled) return;
    const root = typeof containerSelector === 'string'
      ? (documentRef ? documentRef.querySelector(containerSelector) : null)
      : (containerSelector || documentRef);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return;
    const seen = new Set();
    const baseUrl = (windowRef && windowRef.location && windowRef.location.href)
      || ((typeof window !== 'undefined' && window.location) ? window.location.href : '');
    const toAbs = (value) => {
      if (!value) return value;
      try { return new URL(value, baseUrl).toString(); } catch (_) { return value; }
    };
    const tasks = imgs
      .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter(Boolean)
      .map(src => toAbs(src))
      .filter(src => {
        if (seen.has(src)) return false;
        seen.add(src);
        return true;
      });
    if (!tasks.length) return;
    const thresholdKB = Math.max(1, parseInt(cfg.thresholdKB != null ? cfg.thresholdKB : 500, 10));
    const limit = 4;
    let i = 0;
    const next = async () => {
      const idx = i++;
      if (idx >= tasks.length) return;
      const url = tasks[idx];
      const size = await checkImageSizeNative(url, 4000, windowRef);
      if (typeof size === 'number' && size > thresholdKB * 1024) {
        try {
          const langAttr = documentRef && documentRef.documentElement
            ? documentRef.documentElement.getAttribute('lang')
            : (windowRef && windowRef.navigator ? windowRef.navigator.language : 'en');
          const normalized = (langAttr || 'en').toLowerCase();
          const filename = url.split('/').pop() || url;
          const isZhCn = normalized === 'zh' || normalized === 'zh-cn' || normalized.startsWith('zh-cn') || normalized === 'zh-hans' || normalized.startsWith('zh-hans') || normalized === 'zh-sg' || normalized === 'zh-my';
          const isZhTw = normalized === 'zh-tw' || normalized.startsWith('zh-tw') || normalized === 'zh-hant' || normalized.startsWith('zh-hant');
          const isZhHk = normalized === 'zh-hk' || normalized.startsWith('zh-hk') || normalized === 'zh-mo' || normalized.startsWith('zh-mo');
          const message = isZhCn
            ? `发现大图资源：${filename}（${formatBytes(size)}）已超过阈值 ${thresholdKB} KB`
            : isZhTw
              ? `發現大型圖片資源：${filename}（${formatBytes(size)}）超過門檻 ${thresholdKB} KB`
              : isZhHk
                ? `發現大型圖片資源：${filename}（${formatBytes(size)}）超出上限 ${thresholdKB} KB`
                : (normalized === 'ja' || normalized.startsWith('ja'))
                  ? `大きな画像を検出: ${filename}（${formatBytes(size)}）はしきい値 ${thresholdKB} KB を超えています`
                  : `Large image detected: ${filename} (${formatBytes(size)}) exceeds threshold ${thresholdKB} KB`;
          const err = new Error(message);
          try { err.name = 'Warning'; } catch (_) {}
          if (typeof showErrorOverlay === 'function') {
            showErrorOverlay(err, {
              message,
              origin: 'asset.watchdog',
              kind: 'image',
              thresholdKB,
              sizeBytes: size,
              url
            });
          }
        } catch (_) {}
      }
      return next();
    };
    const starters = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
    await Promise.all(starters);
  } catch (_) {}
}

function bindPostVersionSelectorsNative(documentRef = defaultDocument, windowRef = defaultWindow) {
  try {
    const root = documentRef ? documentRef.getElementById('mainview') : null;
    if (!root) return;
    const selects = Array.from(root.querySelectorAll('select.post-version-select'));
    if (!selects.length) return;
    selects.forEach((sel) => {
      if (!sel || sel.dataset && sel.dataset.nsVersionBound === '1') return;
      if (sel.dataset) sel.dataset.nsVersionBound = '1';
      sel.addEventListener('change', (event) => {
        try {
          const target = event && event.target ? event.target : sel;
          const loc = target && target.value ? String(target.value).trim() : '';
          if (!loc) return;
          const win = windowRef || (typeof window !== 'undefined' ? window : undefined);
          if (!win || !win.location) return;
          const url = new URL(win.location.href);
          url.searchParams.set('id', loc);
          const lang = (typeof getCurrentLang === 'function' && getCurrentLang()) || (win.document && win.document.documentElement && win.document.documentElement.getAttribute('lang')) || 'en';
          if (lang) url.searchParams.set('lang', lang);
          try {
            win.history.pushState({}, '', url.toString());
            try {
              const evt = typeof win.PopStateEvent === 'function'
                ? new win.PopStateEvent('popstate')
                : (win.document && typeof win.document.createEvent === 'function'
                  ? (function () {
                    const e = win.document.createEvent('Event');
                    e.initEvent('popstate', true, true);
                    return e;
                  })()
                  : null);
              if (evt) win.dispatchEvent(evt);
            } catch (_) {}
            try { win.scrollTo(0, 0); } catch (_) {}
          } catch (_) {
            try { win.location.assign(url.toString()); } catch (__) {}
          }
        } catch (_) {}
      });
    });
  } catch (_) {}
}

function showElementNative(params = {}, windowRef = defaultWindow) {
  const el = params.element;
  if (!el) return false;
  const fallback = typeof params.fallback === 'function' ? params.fallback : ((target) => {
    if (!target) return;
    target.style.display = 'block';
    target.setAttribute('aria-hidden', 'false');
  });
  try {
    const cs = windowRef && typeof windowRef.getComputedStyle === 'function'
      ? windowRef.getComputedStyle(el)
      : null;
    if (!cs || cs.display !== 'none') {
      el.setAttribute('aria-hidden', 'false');
      return true;
    }
    if (prefersReducedMotion(windowRef)) {
      fallback(el);
      return true;
    }
    const savedMargin = el.dataset.prevMarginBottom || (cs && cs.marginBottom) || '1.25rem';
    const savedPadTop = el.dataset.prevPaddingTop || (cs && cs.paddingTop) || '1.25rem';
    const savedPadBottom = el.dataset.prevPaddingBottom || (cs && cs.paddingBottom) || '1.25rem';
    el.dataset.prevPaddingTop = savedPadTop;
    el.dataset.prevPaddingBottom = savedPadBottom;
    const prevMin = cs ? cs.minHeight : '';
    if (prevMin) el.dataset.prevMinHeight = prevMin;
    el.style.display = 'block';
    el.style.overflow = 'hidden';
    el.style.minHeight = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.style.height = '0px';
    el.style.marginBottom = '0px';
    el.style.opacity = '0';
    el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
    el.style.paddingTop = savedPadTop;
    el.style.paddingBottom = savedPadBottom;
    void el.getBoundingClientRect();
    const target = el.scrollHeight;
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
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
    const delay = (windowRef && typeof windowRef.setTimeout === 'function') ? windowRef.setTimeout.bind(windowRef) : setTimeout;
    delay(finalize, Math.max(HEIGHT_MS, PADDING_MS) + BUFFER_MS);
    return true;
  } catch (_) {
    try { fallback(el); } catch (__) {}
    return true;
  }
}

function hideElementNative(params = {}, windowRef = defaultWindow) {
  const el = params.element;
  const onDone = typeof params.onDone === 'function' ? params.onDone : null;
  if (!el) { if (onDone) onDone(); return false; }
  const fallback = typeof params.fallback === 'function' ? params.fallback : ((target, done) => {
    if (!target) return;
    target.style.display = 'none';
    target.setAttribute('aria-hidden', 'true');
    if (typeof done === 'function') done();
  });
  try {
    const cs = windowRef && typeof windowRef.getComputedStyle === 'function'
      ? windowRef.getComputedStyle(el)
      : null;
    if (!cs || cs.display === 'none') {
      el.setAttribute('aria-hidden', 'true');
      if (onDone) onDone();
      return true;
    }
    if (prefersReducedMotion(windowRef)) {
      fallback(el, onDone);
      return true;
    }
    el.dataset.prevMarginBottom = cs.marginBottom;
    el.dataset.prevPaddingTop = cs.paddingTop;
    el.dataset.prevPaddingBottom = cs.paddingBottom;
    el.dataset.prevMinHeight = cs.minHeight;
    const startHeight = el.scrollHeight;
    el.style.overflow = 'hidden';
    el.style.minHeight = '0px';
    el.style.height = startHeight + 'px';
    el.style.marginBottom = cs.marginBottom;
    el.style.paddingTop = cs.paddingTop;
    el.style.paddingBottom = cs.paddingBottom;
    el.style.opacity = '1';
    el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
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
      if (onDone) { try { onDone(); } catch (_) {} }
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
    const delay = (windowRef && typeof windowRef.setTimeout === 'function') ? windowRef.setTimeout.bind(windowRef) : setTimeout;
    delay(finalize, Math.max(HEIGHT_MS, MARGIN_MS, PADDING_MS) + BUFFER_MS);
    return true;
  } catch (_) {
    try { fallback(el, onDone); } catch (__) {}
    return true;
  }
}

function updateLayoutLoadingStateNative(params = {}, documentRef = defaultDocument) {
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const content = scope.contentElement || params.contentElement || (documentRef && documentRef.querySelector('.content'));
  const sidebar = scope.sidebarElement || params.sidebarElement || (documentRef && documentRef.querySelector('.sidebar'));
  const container = scope.containerElement || params.containerElement || (documentRef && documentRef.getElementById('mainview')?.closest('.box'));
  const extra = Array.isArray(params.extraContentClasses) ? params.extraContentClasses : [];
  const toggle = (element, base = []) => {
    if (!element || !element.classList) return;
    const classes = base.concat(extra);
    classes.forEach(cls => {
      if (!cls) return;
      if (params.isLoading) element.classList.add(cls);
      else element.classList.remove(cls);
    });
  };
  toggle(content, ['loading', 'layout-stable']);
  toggle(sidebar, ['loading']);
  toggle(container, ['mainview-container']);
  return !!(content || sidebar || container);
}

function resetTOCNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const toc = scope.tocElement || params.tocElement || (documentRef ? documentRef.getElementById('tocview') : null);
  if (!toc) return false;
  const clear = () => { try { toc.innerHTML = ''; } catch (_) {}; };
  if (params.immediate) {
    clear();
    try { toc.setAttribute('aria-hidden', 'true'); } catch (_) {}
    try { toc.style.display = 'none'; } catch (_) {}
    try { toc.hidden = true; } catch (_) {}
    return true;
  }
  const smoothHideFn = typeof params.smoothHide === 'function' ? params.smoothHide : null;
  if (smoothHideFn) {
    try { smoothHideFn(toc, clear); return true; } catch (_) {}
  }
  try {
    hideElementNative({ element: toc, onDone: clear }, windowRef);
    return true;
  } catch (_) {}
  clear();
  return true;
}

function renderPostTOCNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const toc = scope.tocElement || params.tocElement || (documentRef ? documentRef.getElementById('tocview') : null);
  if (!toc) return false;
  const translate = params.translate || params.translator || t;
  const title = params.articleTitle != null ? String(params.articleTitle) : '';
  const tocHtml = params.tocHtml || '';
  if (!tocHtml) {
    toc.innerHTML = '';
    return true;
  }
  const topLabel = translate('ui.top');
  const aria = translate('ui.backToTop') || translate('ui.top') || 'Back to top';
  const safeTitle = title ? `<span>${escapeHtml(title)}</span>` : '';
  toc.innerHTML = `<div class="toc-header">${safeTitle}<button type="button" class="toc-top" aria-label="${escapeHtml(String(aria || 'Back to top'))}">${escapeHtml(String(topLabel || 'Top'))}</button></div>${tocHtml}`;
  const btn = toc.querySelector('.toc-top');
  if (btn) {
    btn.addEventListener('click', (e) => {
      try { if (e) e.preventDefault(); } catch (_) {}
      if (!windowRef || typeof windowRef.scrollTo !== 'function') return;
      const behavior = prefersReducedMotion(windowRef) ? 'auto' : 'smooth';
      try { windowRef.scrollTo({ top: 0, behavior }); } catch (_) {
        try { windowRef.scrollTo(0, 0); } catch (__) {}
      }
    });
  }
  return true;
}

function renderErrorStateNative(params = {}, documentRef = defaultDocument) {
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const target = scope.mainElement || params.targetElement || (documentRef ? documentRef.getElementById('mainview') : null);
  if (!target) return false;
  const variant = String(params.variant || 'error').trim() || 'error';
  const title = params.title != null ? String(params.title) : '';
  const message = params.message != null ? String(params.message) : '';
  const actions = Array.isArray(params.actions) ? params.actions : [];
  const translate = params.translate || params.translator || t;
  const titleHtml = title ? `<h3>${escapeHtml(title)}</h3>` : '';
  const messageHtml = message ? `<p>${escapeHtml(message)}</p>` : '';
  let actionsHtml = '';
  if (actions.length) {
    const intro = translate('ui.actionsLabel') || '';
    const links = actions.map(action => {
      if (!action || !action.href || !action.label) return '';
      const href = escapeHtml(String(action.href));
      const label = escapeHtml(String(action.label));
      const rel = action.rel ? ` rel="${escapeHtml(String(action.rel))}"` : '';
      const targetAttr = action.target ? ` target="${escapeHtml(String(action.target))}"` : '';
      return `<a href="${href}"${rel}${targetAttr}>${label}</a>`;
    }).filter(Boolean);
    if (links.length) {
      const prefix = intro ? `${escapeHtml(intro)} ` : '';
      actionsHtml = `<p>${prefix}${links.join(' ')}</p>`;
    }
  }
  target.innerHTML = `<div class="notice ${variant}">${titleHtml}${messageHtml}${actionsHtml}</div>`;
  return true;
}

function handleViewChangeNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const context = params && params.context && typeof params.context === 'object' ? params.context : {};
  const search = context.searchElement || params.searchElement || (documentRef ? documentRef.getElementById('searchbox') : null);
  const tags = context.tagElement || params.tagElement || (documentRef ? documentRef.getElementById('tagview') : null);
  const input = context.searchInput || params.searchInput || (documentRef ? documentRef.getElementById('searchInput') : null);
  const showSearch = context.showSearch != null ? !!context.showSearch : !!params.showSearch;
  const showTags = context.showTags != null ? !!context.showTags : !!params.showTags;
  const queryValue = context.queryValue != null ? context.queryValue : params.queryValue;

  if (search) {
    if (showSearch) showElementNative({ element: search }, windowRef);
    else hideElementNative({ element: search }, windowRef);
  }
  if (tags) {
    if (showTags) showElementNative({ element: tags }, windowRef);
    else hideElementNative({ element: tags }, windowRef);
  }
  if (input && typeof queryValue === 'string') {
    try { input.value = queryValue; } catch (_) {}
  }
  return !!(search || tags || input);
}

function renderTagSidebarNative(params = {}, documentRef = defaultDocument) {
  const renderer = getUtility(params, 'renderTagSidebar');
  if (typeof renderer !== 'function') return false;
  try { renderer(params.postsIndex || {}); } catch (_) {}
  return true;
}

function initializeSyntaxHighlightingNative(params = {}) {
  const init = typeof params.initSyntaxHighlighting === 'function' ? params.initSyntaxHighlighting : null;
  if (!init) return false;
  try { init(); } catch (_) {}
  return true;
}

function sequentialLoadCoversNative(containerSelector, documentRef = defaultDocument, windowRef = defaultWindow, maxConcurrent = 1) {
  try {
    const root = typeof containerSelector === 'string'
      ? (documentRef ? documentRef.querySelector(containerSelector) : null)
      : containerSelector;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('.index img.card-cover'));
    let idx = 0;
    let active = 0;
    const limit = Math.max(1, maxConcurrent || 1);
    const startNext = () => {
      while (active < limit && idx < imgs.length) {
        const img = imgs[idx++];
        if (!img || !img.isConnected) continue;
        const src = img.getAttribute('data-src');
        if (!src) continue;
        active++;
        const done = () => {
          active--;
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          startNext();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setImageSrcNoStore(img, src, windowRef);
      }
    };
    startNext();
  } catch (_) {}
}

function enhanceIndexLayoutNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const containerEl = params.containerElement || getContainerByRole('main', documentRef);
  const indexEl = params.indexElement || (containerEl ? containerEl.querySelector('.index') : null);
  const containerSelector = params.containerSelector || (containerEl && containerEl.id ? `#${containerEl.id}` : '#mainview');
  const indexSelector = params.indexSelector || (containerSelector ? `${containerSelector} .index` : '.index');
  if (typeof params.hydrateCardCovers === 'function') {
    try { params.hydrateCardCovers(containerEl || containerSelector); } catch (_) {}
  }
  if (typeof params.applyLazyLoadingIn === 'function') {
    try { params.applyLazyLoadingIn(containerEl || containerSelector); } catch (_) {}
  }
  try {
    const cfg = (params.siteConfig && params.siteConfig.assetWarnings && params.siteConfig.assetWarnings.largeImage) || {};
    warnLargeImagesInNative(containerEl || containerSelector, cfg, documentRef, windowRef).catch(() => {});
  } catch (_) {}
  sequentialLoadCoversNative(containerEl || containerSelector, documentRef, windowRef, 1);
  if (typeof params.setupSearch === 'function') {
    try { params.setupSearch(Array.isArray(params.allEntries) ? params.allEntries : []); } catch (_) {}
  }
  if (typeof params.renderTagSidebar === 'function') {
    try { params.renderTagSidebar(params.postsIndexMap || {}); } catch (_) {}
  }
  const runMasonry = () => {
    if (typeof params.applyMasonry === 'function') {
      try {
        if (indexEl) params.applyMasonry(indexSelector);
        else params.applyMasonry(indexSelector);
      } catch (_) {}
    }
  };
  if (typeof params.applyMasonry === 'function') {
    if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
      windowRef.requestAnimationFrame(runMasonry);
    } else {
      runMasonry();
    }
    if (!masonryHandlersBound) {
      masonryHandlersBound = true;
      const handler = (typeof params.debounce === 'function')
        ? params.debounce(runMasonry, 150)
        : runMasonry;
      try { windowRef && windowRef.addEventListener && windowRef.addEventListener('resize', handler, { passive: true }); } catch (_) {}
      try {
        if (documentRef && documentRef.fonts && typeof documentRef.fonts.ready?.then === 'function') {
          documentRef.fonts.ready.then(runMasonry).catch(() => {});
        }
      } catch (_) {}
    }
  }
  return true;
}

function decoratePostViewNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const container = scope.mainElement || params.container || documentRef.getElementById('mainview');
  if (!container) return false;
  const translate = params.translate || params.t || t;
  const articleTitle = params.articleTitle != null ? String(params.articleTitle) : '';
  let handled = false;

  try {
    const copyBtns = Array.from(container.querySelectorAll('.post-meta-card .post-meta-copy'));
    copyBtns.forEach((copyBtn) => {
      copyBtn.addEventListener('click', async () => {
        const loc = windowRef && windowRef.location ? windowRef.location.href : (typeof location !== 'undefined' ? location.href : '');
        const url = String(loc || '').split('#')[0];
        let ok = false;
        try {
          const nav = windowRef && windowRef.navigator;
          if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            await nav.clipboard.writeText(url);
            ok = true;
          } else if (documentRef) {
            const tmp = documentRef.createElement('textarea');
            tmp.value = url;
            documentRef.body.appendChild(tmp);
            tmp.select();
            ok = documentRef.execCommand ? documentRef.execCommand('copy') : false;
            documentRef.body.removeChild(tmp);
          }
        } catch (_) { ok = false; }
        if (ok) {
          const prevTitle = copyBtn.getAttribute('title') || '';
          copyBtn.classList.add('copied');
          copyBtn.setAttribute('title', translate('ui.linkCopied') || translate('code.copied'));
          const delay = windowRef && typeof windowRef.setTimeout === 'function' ? windowRef.setTimeout.bind(windowRef) : setTimeout;
          delay(() => {
            copyBtn.classList.remove('copied');
            copyBtn.setAttribute('title', prevTitle || translate('ui.copyLink'));
          }, 1000);
        }
      });
    });
    if (copyBtns.length) handled = true;
  } catch (_) {}

  try {
    const aiFlags = Array.from(container.querySelectorAll('.post-meta-card .ai-flag'));
    aiFlags.forEach((aiFlag) => attachHoverTooltip(aiFlag, () => translate('ui.aiFlagTooltip'), { delay: 0 }));
    if (aiFlags.length) handled = true;
  } catch (_) {}

  try {
    const titleEls = Array.from(container.querySelectorAll('.post-meta-card .post-meta-title'));
    titleEls.forEach((titleEl) => {
      const ai = titleEl.querySelector('.ai-flag');
      const aiClone = ai ? ai.cloneNode(true) : null;
      titleEl.textContent = '';
      if (aiClone) {
        aiClone.removeAttribute('title');
        titleEl.appendChild(aiClone);
        try { attachHoverTooltip(aiClone, () => translate('ui.aiFlagTooltip'), { delay: 0 }); } catch (_) {}
      }
      titleEl.appendChild(documentRef.createTextNode(String(articleTitle || '')));
    });
    if (titleEls.length) handled = true;
  } catch (_) {}

  return handled;
}

function handleDocumentClickNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const event = params.event;
  if (!event) return false;
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return false;
  const closeBtn = target.closest('.post-outdated-close');
  if (!closeBtn) return false;
  const card = closeBtn.closest('.post-outdated-card');
  if (!card) return false;
  try { event.preventDefault(); } catch (_) {}
  try { event.stopPropagation(); } catch (_) {}
  try { event.stopImmediatePropagation && event.stopImmediatePropagation(); } catch (_) {}
  const startHeight = card.scrollHeight;
  card.style.height = `${startHeight}px`;
  try { void card.getBoundingClientRect(); } catch (_) {}
  card.classList.add('is-dismissing');
  const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
    ? windowRef.requestAnimationFrame.bind(windowRef)
    : (cb) => setTimeout(cb, 16);
  raf(() => { card.style.height = '0px'; });
  const cleanup = () => { try { card.remove(); } catch (_) {} };
  card.addEventListener('transitionend', cleanup, { once: true });
  const delay = windowRef && typeof windowRef.setTimeout === 'function' ? windowRef.setTimeout.bind(windowRef) : setTimeout;
  delay(cleanup, 500);
  return true;
}

function setImageSrcNoStore(img, src, windowRef = defaultWindow) {
  try {
    if (!img) return;
    const val = String(src || '').trim();
    if (!val) return;
    const safeVal = sanitizeImageUrl(val);
    if (!safeVal) return;
    if (/^(data:|blob:)/i.test(safeVal)) { img.setAttribute('src', safeVal); return; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(safeVal)) { img.setAttribute('src', safeVal); return; }
    let abs = safeVal;
    try { abs = new URL(safeVal, windowRef && windowRef.location ? windowRef.location.href : undefined).toString(); } catch (_) {}
    fetch(abs, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(b => {
        const url = URL.createObjectURL(b);
        try { const prev = img.dataset.blobUrl; if (prev) URL.revokeObjectURL(prev); } catch (_) {}
        img.dataset.blobUrl = url;
        img.setAttribute('src', url);
      })
      .catch(() => { img.setAttribute('src', safeVal); });
  } catch (_) {
    try { img.setAttribute('src', sanitizeImageUrl(src)); } catch (__) {}
  }
}

function renderSiteLinksNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  const cfg = params.config;
  const root = documentRef.querySelector('.site-card .social-links');
  if (!root || !cfg) return false;
  const linksVal = (cfg && (cfg.profileLinks || cfg.links)) || [];
  let items = [];
  if (Array.isArray(linksVal)) {
    items = linksVal
      .filter(x => x && x.href && x.label)
      .map(x => ({ href: String(x.href), label: String(x.label) }));
  } else if (linksVal && typeof linksVal === 'object') {
    items = Object.entries(linksVal).map(([label, href]) => ({ label: String(label), href: String(href) }));
  }
  if (!items.length) { root.innerHTML = ''; return true; }
  const sep = '<span class="link-sep">•</span>';
  const anchors = items.map(({ href, label }) => `<a href="${escapeHtml(href)}" target="_blank" rel="me noopener">${escapeHtml(String(label || ''))}</a>`);
  root.innerHTML = `<li>${anchors.join(sep)}</li>`;
  return true;
}

function renderSiteIdentityNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const cfg = params.config;
  if (!cfg) return false;
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
    const el = documentRef.querySelector('.site-card .site-title');
    if (el) el.textContent = title;
    const fs = documentRef.querySelector('.footer-site');
    if (fs) fs.textContent = title;
  }
  if (subtitle) {
    const el2 = documentRef.querySelector('.site-card .site-subtitle');
    if (el2) el2.textContent = subtitle;
  }
  if (avatar) {
    const img = documentRef.querySelector('.site-card .avatar');
    if (img) setImageSrcNoStore(img, avatar, windowRef);
  }
  return true;
}

function reflectThemeConfigNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  const cfg = params.config || params.siteConfig;
  if (!cfg || typeof cfg !== 'object') return false;
  const sel = documentRef.getElementById('themePack');
  if (!sel) return false;
  if (cfg.themeOverride === false) return false;
  const pack = cfg.themePack;
  if (!pack) return false;
  try { sel.value = String(pack); } catch (_) {}
  return true;
}

function renderFooterNavNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const nav = documentRef.getElementById('footerNav');
  if (!nav) return false;
  const tabs = params.tabsBySlug || {};
  const getHome = typeof params.getHomeSlug === 'function'
    ? params.getHomeSlug
    : () => getHomeSlug(tabs, windowRef);
  const getLabel = typeof params.getHomeLabel === 'function'
    ? params.getHomeLabel
    : () => computeHomeLabel(getHome(), tabs);
  const postsEnabledFn = typeof params.postsEnabled === 'function'
    ? params.postsEnabled
    : () => postsEnabled(windowRef);
  const queryGetter = typeof params.getQueryVariable === 'function'
    ? params.getQueryVariable
    : (name) => getQueryVariable(name, windowRef);
  const makeLangUrl = typeof params.withLangParam === 'function' ? params.withLangParam : withLangParam;
  const translate = params.t || params.translate || t;

  const homeSlug = (() => { try { return slugifyTab(getHome()) || 'posts'; } catch (_) { return 'posts'; }})();
  const defaultTab = homeSlug || 'posts';
  const currentTabRaw = queryGetter ? (queryGetter('tab') || (queryGetter('id') ? 'post' : defaultTab)) : defaultTab;
  const currentTab = String(currentTabRaw || '').toLowerCase();
  const makeLink = (href, label, cls = '') => `<a class="${cls}" href="${makeLangUrl(href)}">${escapeHtml(String(label || ''))}</a>`;
  const isActive = (slug) => currentTab === slug;
  let html = '';
  const homeLabel = (() => {
    try { const lbl = getLabel(); return lbl || computeHomeLabel(homeSlug, tabs); } catch (_) { return computeHomeLabel(homeSlug, tabs); }
  })();
  html += makeLink(`?tab=${encodeURIComponent(homeSlug)}`, homeLabel, isActive(homeSlug) ? 'active' : '');
  if (postsEnabledFn() && homeSlug !== 'posts') {
    html += ' ' + makeLink('?tab=posts', translate('ui.allPosts'), isActive('posts') ? 'active' : '');
  }
  for (const [slug, info] of Object.entries(tabs)) {
    if (slug === homeSlug) continue;
    const label = info && info.title ? info.title : slug;
    html += ' ' + makeLink(`?tab=${encodeURIComponent(slug)}`, label, isActive(slug) ? 'active' : '');
  }
  nav.innerHTML = html;
  return true;
}

function renderPostLoadingStateNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const toc = scope.tocElement || params.tocElement || documentRef.getElementById('tocview');
  const main = scope.mainElement || params.mainElement || documentRef.getElementById('mainview');
  const translate = params.translator || params.t || t;
  const renderSkeleton = typeof params.renderSkeletonArticle === 'function' ? params.renderSkeletonArticle : renderSkeletonArticle;
  const ensureAutoHeight = typeof params.ensureAutoHeight === 'function' ? params.ensureAutoHeight : (() => {});
  const show = typeof params.showElement === 'function' ? params.showElement : ((el) => { if (el) { el.style.display = ''; el.setAttribute('aria-hidden', 'false'); } });

  if (toc) {
    toc.innerHTML = `<div class="toc-header"><span>${escapeHtml(translate('ui.contents'))}</span><span class="toc-loading">${escapeHtml(translate('ui.loading'))}</span></div>`
      + '<ul class="toc-skeleton">'
      + '<li><div class="skeleton-block skeleton-line w-90"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-80"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-85"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-70"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-60"></div></li>'
      + '</ul>';
    show(toc);
    ensureAutoHeight(toc);
  }
  if (main) main.innerHTML = renderSkeleton();
  return true;
}

function renderStaticTabLoadingStateNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const main = scope.mainElement || params.mainElement || documentRef.getElementById('mainview');
  const renderSkeleton = typeof params.renderSkeletonArticle === 'function' ? params.renderSkeletonArticle : renderSkeletonArticle;
  if (main) main.innerHTML = renderSkeleton();
  return !!main;
}

function renderPostViewNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return { handled: false, title: params && params.fallbackTitle ? String(params.fallbackTitle) : '' };
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const container = scope.mainElement || params.container || documentRef.getElementById('mainview');
  if (!container) return { handled: false, title: params && params.fallbackTitle ? String(params.fallbackTitle) : '' };

  const markdownHtml = params.markdownHtml || '';
  const fallbackTitle = params.fallbackTitle != null ? String(params.fallbackTitle) : '';
  const metadata = params.postMetadata || {};
  const metadataTitle = metadata && metadata.title != null ? String(metadata.title) : '';
  const markdown = params.markdown || '';
  const translate = params.translate || params.t || t;
  const siteConfig = params.siteConfig || {};
  const postsIndex = params.postsIndex || {};
  const postsByLocationTitle = params.postsByLocationTitle || {};
  const allowedLocations = params.allowedLocations || new Set();
  const locationAliasMap = params.locationAliasMap || new Map();
  const postId = params.postId || '';

  const renderMetaFn = typeof params.renderPostMetaCard === 'function' ? params.renderPostMetaCard : renderPostMetaCard;
  const renderOutdatedFn = typeof params.renderOutdatedCard === 'function' ? params.renderOutdatedCard : renderOutdatedCard;

  let topMeta = '';
  let bottomMeta = '';
  try {
    const titleForMeta = metadataTitle || fallbackTitle;
    topMeta = renderMetaFn(titleForMeta, metadata, markdown) || '';
    if (topMeta) bottomMeta = topMeta.replace('post-meta-card', 'post-meta-card post-meta-bottom');
  } catch (_) {
    topMeta = '';
    bottomMeta = '';
  }
  let outdated = '';
  try { outdated = renderOutdatedFn(metadata, siteConfig) || ''; } catch (_) { outdated = ''; }

  container.innerHTML = `${outdated}${topMeta}${markdownHtml}${bottomMeta}`;

  const renderNav = getUtility(params, 'renderPostNav', renderPostNav);
  try { renderNav('#mainview', postsIndex, postId); } catch (_) {}

  const hydrateImages = getUtility(params, 'hydratePostImages', (selector) => hydratePostImages(selector));
  try { hydrateImages('#mainview'); } catch (_) {}

  const lazyLoad = getUtility(params, 'applyLazyLoadingIn', (selector) => applyLazyLoadingIn(selector));
  try { lazyLoad('#mainview'); } catch (_) {}

  const langHints = getUtility(params, 'applyLangHints', (selector) => applyLangHints(selector));
  try { langHints('#mainview'); } catch (_) {}

  const hydrateVideos = getUtility(params, 'hydratePostVideos', (selector) => hydratePostVideos(selector));
  try { hydrateVideos('#mainview'); } catch (_) {}

  try {
    const cfg = (siteConfig && siteConfig.assetWarnings && siteConfig.assetWarnings.largeImage) || {};
    warnLargeImagesInNative('#mainview', cfg, documentRef, windowRef).catch(() => {});
  } catch (_) {}

  const hydrateLinks = getUtility(params, 'hydrateInternalLinkCards', (selector, opts) => hydrateInternalLinkCards(selector, opts));
  const fetchMarkdown = getUtility(params, 'fetchMarkdown', () => Promise.resolve(''));
  const makeHref = getUtility(params, 'makeLangHref', (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`));
  try {
    hydrateLinks('#mainview', {
      allowedLocations,
      locationAliasMap,
      postsByLocationTitle,
      postsIndexCache: postsIndex,
      siteConfig,
      translate,
      makeHref,
      fetchMarkdown
    });
  } catch (_) {}

  const ensureHeight = getUtility(params, 'ensureAutoHeight', (el) => {
    if (!el) return;
    try {
      el.style.height = '';
      el.style.minHeight = '';
      el.style.overflow = '';
    } catch (_) {}
  });

  const tocHtml = params.tocHtml || '';
  const tocElement = documentRef.getElementById('tocview');
  const { headingEl: firstHeadingEl, headingText: firstHeadingText } = (() => {
    try {
      const el = documentRef.querySelector('#mainview h1, #mainview h2, #mainview h3');
      if (!el) return { headingEl: null, headingText: '' };
      const clone = el.cloneNode(true);
      const anchors = clone.querySelectorAll('a.anchor');
      anchors.forEach(a => a.remove());
      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim().replace(/^#+\s*/, '').trim();
      return { headingEl: el, headingText: text };
    } catch (_) {
      return { headingEl: null, headingText: '' };
    }
  })();
  const preferredTitle = metadataTitle || fallbackTitle;
  const articleTitle = (() => {
    if (!firstHeadingText) return preferredTitle;
    const fallbackLooksLikePath = /\//.test(preferredTitle || '');
    if (preferredTitle && preferredTitle.trim() && !fallbackLooksLikePath) {
      const level = firstHeadingEl && firstHeadingEl.tagName ? String(firstHeadingEl.tagName).toLowerCase() : '';
      if (level && level !== 'h1') return preferredTitle;
    }
    return firstHeadingText || preferredTitle;
  })();

  let tocHandled = false;
  if (tocElement) {
    if (tocHtml) {
      renderPostTOCNative({ tocElement, articleTitle, tocHtml, translate }, documentRef, windowRef);
      try { showElementNative({ element: tocElement }, windowRef); } catch (_) { try { tocElement.style.display = ''; } catch (_) {} }
      try { ensureHeight(tocElement); } catch (_) {}
      const setupAnchorsFn = getUtility(params, 'setupAnchors', null);
      const setupTocFn = getUtility(params, 'setupTOC', null);
      try { if (typeof setupAnchorsFn === 'function') setupAnchorsFn(); } catch (_) {}
      try { if (typeof setupTocFn === 'function') setupTocFn(); } catch (_) {}
    } else {
      try { hideElementNative({ element: tocElement }, windowRef); } catch (_) { try { tocElement.style.display = 'none'; } catch (_) {} }
      try { tocElement.innerHTML = ''; } catch (_) {}
    }
    tocHandled = true;
  }

  try {
    decoratePostViewNative({
      container,
      articleTitle,
      postMetadata: metadata,
      markdown,
      translate
    }, documentRef, windowRef);
  } catch (_) {}

  try { bindPostVersionSelectorsNative(documentRef, windowRef); } catch (_) {}

  return { handled: true, tocHandled, decorated: true, title: articleTitle };
}

function renderStaticTabViewNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return { handled: false, title: params && params.tab && params.tab.title ? String(params.tab.title) : '' };
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const container = scope.mainElement || params.container || documentRef.getElementById('mainview');
  if (!container) return { handled: false, title: params && params.tab && params.tab.title ? String(params.tab.title) : '' };

  const markdownHtml = params.markdownHtml || '';
  container.innerHTML = markdownHtml;

  const hydrateImages = getUtility(params, 'hydratePostImages', (selector) => hydratePostImages(selector));
  try { hydrateImages('#mainview'); } catch (_) {}

  const lazyLoad = getUtility(params, 'applyLazyLoadingIn', (selector) => applyLazyLoadingIn(selector));
  try { lazyLoad('#mainview'); } catch (_) {}

  const langHints = getUtility(params, 'applyLangHints', (selector) => applyLangHints(selector));
  try { langHints('#mainview'); } catch (_) {}

  const hydrateVideos = getUtility(params, 'hydratePostVideos', (selector) => hydratePostVideos(selector));
  try { hydrateVideos('#mainview'); } catch (_) {}

  try {
    const cfg = (params.siteConfig && params.siteConfig.assetWarnings && params.siteConfig.assetWarnings.largeImage) || {};
    warnLargeImagesInNative('#mainview', cfg, documentRef, windowRef).catch(() => {});
  } catch (_) {}

  const hydrateLinks = getUtility(params, 'hydrateInternalLinkCards', (selector, opts) => hydrateInternalLinkCards(selector, opts));
  const fetchMarkdown = getUtility(params, 'fetchMarkdown', () => Promise.resolve(''));
  const makeHref = getUtility(params, 'makeLangHref', (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`));
  try {
    hydrateLinks('#mainview', {
      allowedLocations: params.allowedLocations || new Set(),
      locationAliasMap: params.locationAliasMap || new Map(),
      postsByLocationTitle: params.postsByLocationTitle || {},
      postsIndexCache: params.postsIndex || {},
      siteConfig: params.siteConfig || {},
      translate: params.translate || params.t || t,
      makeHref,
      fetchMarkdown
    });
  } catch (_) {}

  const tocElement = documentRef.getElementById('tocview');
  if (tocElement) {
    try { hideElementNative({ element: tocElement }, windowRef); } catch (_) { try { tocElement.style.display = 'none'; } catch (_) {} }
    try { tocElement.innerHTML = ''; } catch (_) {}
  }

  const articleTitle = (() => {
    const tabTitle = params.tab && params.tab.title ? String(params.tab.title) : '';
    try {
      const derived = getArticleTitleFromMain();
      return derived || tabTitle;
    } catch (_) {
      return tabTitle;
    }
  })();

  return { handled: true, tocHandled: true, title: articleTitle };
}

function resetThemeControlsNative(params = {}, documentRef = defaultDocument) {
  const mount = typeof params.mountThemeControls === 'function' ? params.mountThemeControls : (() => {});
  const applyTheme = typeof params.applySavedTheme === 'function' ? params.applySavedTheme : (() => {});
  const bindToggle = typeof params.bindThemeToggle === 'function' ? params.bindThemeToggle : (() => {});
  const bindPack = typeof params.bindThemePackPicker === 'function' ? params.bindThemePackPicker : (() => {});
  const refreshLang = typeof params.refreshLanguageSelector === 'function' ? params.refreshLanguageSelector : (() => {});
  if (documentRef) {
    try {
      const tools = documentRef.getElementById('tools');
      if (tools && tools.parentElement) tools.parentElement.removeChild(tools);
    } catch (_) {}
  }
  try { mount(); } catch (_) {}
  try { applyTheme(); } catch (_) {}
  try { bindToggle(); } catch (_) {}
  try { bindPack(); } catch (_) {}
  try { refreshLang(); } catch (_) {}
  return true;
}

function setupFooterNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const translate = params.translate || params.t || t;
  const yearEl = documentRef && documentRef.getElementById('footerYear');
  if (yearEl) {
    try { yearEl.textContent = String(new Date().getFullYear()); } catch (_) {}
  }
  const topEl = documentRef && documentRef.getElementById('footerTop');
  if (topEl) {
    try { topEl.textContent = translate('ui.top') || 'Top'; } catch (_) { topEl.textContent = 'Top'; }
    const handler = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!windowRef || typeof windowRef.scrollTo !== 'function') return;
      const behavior = prefersReducedMotion(windowRef) ? 'auto' : 'smooth';
      try { windowRef.scrollTo({ top: 0, behavior }); } catch (_) {
        try { windowRef.scrollTo(0, 0); } catch (__) {}
      }
    };
    try { topEl.onclick = handler; } catch (_) { topEl.onclick = handler; }
  }
  return true;
}

function resolveCoverSource(value = {}, siteConfig = {}) {
  let coverSrc = value && (value.thumb || value.cover || value.image);
  if (coverSrc && typeof coverSrc === 'string' && !/^https?:\/\//i.test(coverSrc) && !coverSrc.startsWith('/') && !coverSrc.includes('/')) {
    const baseLoc = value && value.location ? String(value.location) : '';
    const lastSlash = baseLoc.lastIndexOf('/');
    const baseDir = lastSlash >= 0 ? baseLoc.slice(0, lastSlash + 1) : '';
    coverSrc = (baseDir + coverSrc).replace(/\/+/, '/');
  }
  const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
  return { coverSrc, useFallbackCover };
}

function renderIndexViewNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const container = scope.mainElement || params.container || documentRef.getElementById('mainview');
  if (!container) return false;
  const pageEntries = Array.isArray(params.pageEntries) ? params.pageEntries : [];
  const totalPages = Math.max(1, parseInt(params.totalPages || 1, 10));
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const translate = params.translate || params.t || t;
  const makeLangUrl = typeof params.withLangParam === 'function' ? params.withLangParam : withLangParam;
  const siteConfig = params.siteConfig || {};

  let html = '<div class="index">';
  for (const [key, value] of pageEntries) {
    const tag = value ? renderTags(value.tag) : '';
    const { coverSrc, useFallbackCover } = resolveCoverSource(value, siteConfig);
    const cover = (value && coverSrc)
      ? `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(String(key || ''))}" data-src="${escapeHtml(cardImageSrc(coverSrc))}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`
      : (useFallbackCover ? fallbackCover(key) : '');
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class="card-date">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    const verCount = (value && Array.isArray(value.versions)) ? value.versions.length : 0;
    const versionsHtml = verCount > 1 ? `<span class="card-versions" title="${escapeHtml(translate('ui.versionLabel'))}">${escapeHtml(translate('ui.versionsCount', verCount))}</span>` : '';
    const draftHtml = (value && value.draft) ? `<span class="card-draft">${escapeHtml(translate('ui.draftBadge'))}</span>` : '';
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (versionsHtml) parts.push(versionsHtml);
    if (draftHtml) parts.push(draftHtml);
    const metaInner = parts.join('<span class="card-sep">•</span>');
    const href = makeLangUrl(`?id=${encodeURIComponent(value && value.location ? String(value.location) : '')}`);
    html += `<a href="${href}" data-idx="${escapeHtml(encodeURIComponent(key))}">${cover}<div class="card-title">${escapeHtml(String(key || ''))}</div><div class="card-excerpt"></div><div class="card-meta">${metaInner}</div>${tag}</a>`;
  }
  html += '</div>';
  if (totalPages > 1) {
    const makeLink = (p, label, cls = '') => `<a class="${cls}" href="${makeLangUrl(`?tab=posts&page=${p}`)}">${escapeHtml(String(label || ''))}</a>`;
    const makeSpan = (label, cls = '') => `<span class="${cls}">${escapeHtml(String(label || ''))}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, translate('ui.prev'), 'page-prev') : makeSpan(translate('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class="page-num active">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, translate('ui.next'), 'page-next') : makeSpan(translate('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }
  container.innerHTML = html;
  return true;
}

function updateCardMetadata(entries = [], context = {}) {
  const documentRef = context.document || defaultDocument;
  if (!documentRef) return;
  const translate = context.translate || t;
  const cards = Array.from(documentRef.querySelectorAll('.index a'));
  entries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    const el = cards[idx];
    if (!el) return;
    const exEl = el.querySelector('.card-excerpt');
    if (exEl && meta && meta.excerpt) {
      try { exEl.textContent = String(meta.excerpt); } catch (_) {}
    }
    if (typeof context.getFile !== 'function' || typeof context.getContentRoot !== 'function' || typeof context.extractExcerpt !== 'function' || typeof context.computeReadTime !== 'function') return;
    context.getFile(`${context.getContentRoot()}/${loc}`).then(md => {
      const ex = context.extractExcerpt(md, 50);
      if (exEl && !(meta && meta.excerpt)) exEl.textContent = ex;
      const minutes = context.computeReadTime(md, 200);
      const metaEl = el.querySelector('.card-meta');
      if (metaEl) {
        const items = [];
        const dateEl = metaEl.querySelector('.card-date');
        if (dateEl && dateEl.textContent.trim()) items.push(dateEl.cloneNode(true));
        const read = documentRef.createElement('span');
        read.className = 'card-read';
        read.textContent = `${minutes} ${translate('ui.minRead')}`;
        items.push(read);
        const verCount = (meta && Array.isArray(meta.versions)) ? meta.versions.length : 0;
        if (verCount > 1) {
          const v = documentRef.createElement('span');
          v.className = 'card-versions';
          v.setAttribute('title', translate('ui.versionLabel'));
          v.textContent = translate('ui.versionsCount', verCount);
          items.push(v);
        }
        if (meta && meta.draft) {
          const d = documentRef.createElement('span');
          d.className = 'card-draft';
          d.textContent = translate('ui.draftBadge');
          items.push(d);
        }
        metaEl.textContent = '';
        items.forEach((node, nodeIdx) => {
          if (nodeIdx > 0) {
            const sep = documentRef.createElement('span');
            sep.className = 'card-sep';
            sep.textContent = '•';
            metaEl.appendChild(sep);
          }
          metaEl.appendChild(node);
        });
      }
      if (typeof context.updateMasonryItem === 'function') {
        const container = documentRef.querySelector('.index');
        if (container && el) context.updateMasonryItem(container, el);
      }
    }).catch(() => {});
  });
}

function afterIndexRenderNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  updateCardMetadata(params.entries || [], { ...params, document: documentRef });
  return true;
}

function renderSearchResultsNative(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const scope = params.containers && typeof params.containers === 'object' ? params.containers : {};
  const container = scope.mainElement || params.container || documentRef.getElementById('mainview');
  if (!container) return false;
  const entries = Array.isArray(params.entries) ? params.entries : [];
  const total = parseInt(params.total || entries.length, 10);
  const totalPages = Math.max(1, parseInt(params.totalPages || 1, 10));
  const page = Math.max(1, parseInt(params.page || 1, 10));
  const query = String(params.query || '');
  const tagFilter = String(params.tagFilter || '');
  const translate = params.translate || params.t || t;
  const makeLangUrl = typeof params.withLangParam === 'function' ? params.withLangParam : withLangParam;
  const siteConfig = params.siteConfig || {};

  if (total === 0) {
    const backHref = makeLangUrl(`?tab=${encodeURIComponent(typeof params.getHomeSlug === 'function' ? params.getHomeSlug() : getHomeSlug({}, windowRef))}`);
    const backText = (typeof params.postsEnabled === 'function' ? params.postsEnabled() : postsEnabled(windowRef))
      ? translate('ui.backToAllPosts')
      : (translate('ui.backToHome') || translate('ui.backToAllPosts'));
    container.innerHTML = `<div class="notice"><h3>${escapeHtml(translate('ui.noResultsTitle'))}</h3><p>${escapeHtml(translate('ui.noResultsBody', query))} <a href="${backHref}">${escapeHtml(backText)}</a>.</p></div>`;
    return true;
  }

  let html = '<div class="index">';
  for (const [key, value] of entries) {
    const tag = value ? renderTags(value.tag) : '';
    const { coverSrc, useFallbackCover } = resolveCoverSource(value, siteConfig);
    const cover = (value && coverSrc)
      ? `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(String(key || ''))}" data-src="${escapeHtml(cardImageSrc(coverSrc))}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`
      : (useFallbackCover ? fallbackCover(key) : '');
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class="card-date">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    const verCount = (value && Array.isArray(value.versions)) ? value.versions.length : 0;
    const versionsHtml = verCount > 1 ? `<span class="card-versions" title="${escapeHtml(translate('ui.versionLabel'))}">${escapeHtml(translate('ui.versionsCount', verCount))}</span>` : '';
    const draftHtml = (value && value.draft) ? `<span class="card-draft">${escapeHtml(translate('ui.draftBadge'))}</span>` : '';
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (versionsHtml) parts.push(versionsHtml);
    if (draftHtml) parts.push(draftHtml);
    const metaInner = parts.join('<span class="card-sep">•</span>');
    const href = makeLangUrl(`?id=${encodeURIComponent(value && value.location ? String(value.location) : '')}`);
    html += `<a href="${href}" data-idx="${escapeHtml(encodeURIComponent(key))}">${cover}<div class="card-title">${escapeHtml(String(key || ''))}</div><div class="card-excerpt"></div><div class="card-meta">${metaInner}</div>${tag}</a>`;
  }
  html += '</div>';

  if (totalPages > 1) {
    const encQ = encodeURIComponent(query);
    const makeLink = (p, label, cls = '') => `<a class="${cls}" href="${makeLangUrl(`?tab=search&q=${encQ}&page=${p}`)}">${escapeHtml(String(label || ''))}</a>`;
    const makeSpan = (label, cls = '') => `<span class="${cls}">${escapeHtml(String(label || ''))}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, translate('ui.prev'), 'page-prev') : makeSpan(translate('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class="page-num active">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, translate('ui.next'), 'page-next') : makeSpan(translate('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }

  container.innerHTML = html;
  return true;
}

function afterSearchRenderNative(params = {}, documentRef = defaultDocument) {
  if (!documentRef) return false;
  updateCardMetadata(params.entries || [], { ...params, document: documentRef });
  return true;
}

function getHomeSlug(tabs, windowRef = defaultWindow) {
  if (windowRef && typeof windowRef.__ns_get_home_slug === 'function') {
    try { return windowRef.__ns_get_home_slug(); } catch (_) {}
  }
  if (tabs && typeof tabs === 'object') {
    if (tabs.posts) return 'posts';
    const first = Object.keys(tabs)[0];
    if (first) return first;
  }
  return 'posts';
}

function postsEnabled(windowRef = defaultWindow) {
  if (windowRef && typeof windowRef.__ns_posts_enabled === 'function') {
    try { return !!windowRef.__ns_posts_enabled(); } catch (_) {}
  }
  return true;
}

function computeHomeLabel(slug, tabs) {
  if (slug === 'posts') return t('ui.allPosts');
  if (slug === 'search') return t('ui.searchTab');
  const info = tabs && tabs[slug];
  if (info && info.title) return info.title;
  return slug;
}

function ensureHighlightOverlay(nav, documentRef = defaultDocument) {
  if (!nav) return null;
  let overlay = nav.querySelector('.highlight-overlay');
  if (!overlay && documentRef) {
    overlay = documentRef.createElement('div');
    overlay.className = 'highlight-overlay';
    nav.appendChild(overlay);
  }
  return overlay;
}

function setupTabHoverEffects(nav) {
  if (!nav) return;
  nav.querySelectorAll('.tab').forEach((tab) => {
    if (tab._hoverHandler) tab.removeEventListener('mouseenter', tab._hoverHandler);
    if (tab._leaveHandler) tab.removeEventListener('mouseleave', tab._leaveHandler);
  });

  nav.querySelectorAll('.tab').forEach((tab) => {
    tab._hoverHandler = function hoverHandler() {
      if (this.classList.contains('active')) return;
      const tabRect = this.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      nav.style.setProperty('--preview-left', `${left}px`);
      nav.style.setProperty('--preview-width', `${width * 0.85}px`);
      nav.style.setProperty('--preview-opacity', '0.4');
    };
    tab._leaveHandler = function leaveHandler() {
      nav.style.setProperty('--preview-opacity', '0');
    };
    tab.addEventListener('mouseenter', tab._hoverHandler);
    tab.addEventListener('mouseleave', tab._leaveHandler);
  });
}

function updateMovingHighlight(nav, windowRef = defaultWindow, documentRef = defaultDocument) {
  if (!nav) return;
  ensureHighlightOverlay(nav, documentRef);

  const raf = (windowRef && typeof windowRef.requestAnimationFrame === 'function')
    ? windowRef.requestAnimationFrame.bind(windowRef)
    : (fn) => setTimeout(fn, 16);
  const cancel = (windowRef && typeof windowRef.cancelAnimationFrame === 'function')
    ? windowRef.cancelAnimationFrame.bind(windowRef)
    : clearTimeout;
  const delay = (windowRef && typeof windowRef.setTimeout === 'function')
    ? windowRef.setTimeout.bind(windowRef)
    : setTimeout;

  if (pendingHighlightRaf) cancel(pendingHighlightRaf);
  pendingHighlightRaf = raf(() => {
    raf(() => {
      const activeTab = nav.querySelector('.tab.active');
      nav.querySelectorAll('.tab').forEach(tab => tab.classList.remove('activating', 'deactivating'));

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
        delay(() => activeTab.classList.remove('activating'), 420);
      } else {
        nav.style.setProperty('--highlight-opacity', '0');
        nav.style.setProperty('--indicator-opacity', '0');
      }

      setupTabHoverEffects(nav);
      pendingHighlightRaf = 0;
    });
  });
}

function buildSafeTrackFromHtml(markup, documentRef = defaultDocument, windowRef = defaultWindow, searchQuery = '') {
  const safeTrack = documentRef ? documentRef.createElement('div') : document.createElement('div');
  safeTrack.className = 'tabs-track';
  const src = String(markup || '');
  const tagRe = /<(a|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const getAttr = (attrs, name) => {
    const m = attrs.match(new RegExp(name + '="([^"]*)"', 'i'));
    return m ? m[1] : '';
  };
  const hasActive = (attrs) => /class="[^"]*\bactive\b[^"]*"/i.test(attrs);
  const decodeEntities = (text) => String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');

  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const tagRaw = (m[1] || '').toLowerCase();
    const tag = (tagRaw === 'a') ? 'a' : 'span';
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const slug = getAttr(attrs, 'data-slug');
    let href = '';
    if (tag === 'a') {
      try {
        const safeSlug = slugifyTab(slug);
        if (safeSlug === 'search') {
          const search = windowRef && windowRef.location ? windowRef.location.search : '';
          const sp = new URLSearchParams(search);
          const tagParam = (sp.get('tag') || '').trim();
          const qParam = (sp.get('q') || String(searchQuery || '')).trim();
          href = withLangParam(`?tab=search${tagParam ? `&tag=${encodeURIComponent(tagParam)}` : (qParam ? `&q=${encodeURIComponent(qParam)}` : '')}`);
        } else if (safeSlug) {
          href = withLangParam(`?tab=${encodeURIComponent(safeSlug)}`);
        }
      } catch (_) {}
    }
    const el = (documentRef || document).createElement(tag);
    el.className = `tab${hasActive(attrs) ? ' active' : ''}`;
    if (slug) {
      try {
        const safeSlug = slugifyTab(slug);
        if (safeSlug) el.setAttribute('data-slug', safeSlug);
      } catch (_) {
        const fallback = String(slug || '').toLowerCase().replace(/[^a-z0-9\-]/g, '').slice(0, 64);
        if (fallback) el.setAttribute('data-slug', fallback);
      }
    }
    if (href && tag === 'a') el.setAttribute('href', href);
    el.textContent = decodeEntities(inner);
    safeTrack.appendChild(el);
  }
  return safeTrack;
}

function setTrackHtml(nav, markup, documentRef = defaultDocument, windowRef = defaultWindow, searchQuery = '') {
  const safeTrack = buildSafeTrackFromHtml(markup, documentRef, windowRef, searchQuery);
  const existing = nav.querySelector('.tabs-track');
  if (!existing) {
    while (nav.firstChild) nav.removeChild(nav.firstChild);
    nav.appendChild(safeTrack);
  } else {
    while (existing.firstChild) existing.removeChild(existing.firstChild);
    Array.from(safeTrack.children).forEach(ch => existing.appendChild(ch));
  }
}

function renderTabsNative(params = {}) {
  const windowRef = params.window || defaultWindow;
  const documentRef = params.document || defaultDocument;
  const nav = params.nav || (documentRef ? documentRef.getElementById('tabsNav') : null);
  if (!nav) return;
  const tabs = params.tabsBySlug || {};
  const activeSlug = params.activeSlug;
  const searchQuery = params.searchQuery;

  const getHomeFn = typeof params.getHomeSlug === 'function'
    ? params.getHomeSlug
    : () => getHomeSlug(tabs, windowRef);
  let homeSlugRaw;
  try { homeSlugRaw = getHomeFn(); } catch (_) { homeSlugRaw = getHomeSlug(tabs, windowRef); }
  const safeHome = slugifyTab(homeSlugRaw);
  const homeSlug = safeHome || homeSlugRaw || 'posts';
  const getHomeLabelFn = typeof params.getHomeLabel === 'function'
    ? params.getHomeLabel
    : () => computeHomeLabel(homeSlugRaw || homeSlug, tabs);
  let homeLabel;
  try { homeLabel = getHomeLabelFn(); } catch (_) { homeLabel = computeHomeLabel(homeSlugRaw || homeSlug, tabs); }
  if (!homeLabel) homeLabel = computeHomeLabel(homeSlugRaw || homeSlug, tabs);
  const postsEnabledFn = typeof params.postsEnabled === 'function'
    ? params.postsEnabled
    : () => postsEnabled(windowRef);
  const makeLangUrl = typeof params.withLangParam === 'function' ? params.withLangParam : withLangParam;

  const make = (slug, label) => {
    const safeSlug = slugifyTab(slug) || slug;
    const href = makeLangUrl(`?tab=${encodeURIComponent(safeSlug)}`);
    return `<a class="tab${activeSlug === slug ? ' active' : ''}" data-slug="${escapeHtml(safeSlug)}" href="${href}">${escapeHtml(String(label || ''))}</a>`;
  };

  let html = '';
  html += make(homeSlug, homeLabel);
  if (postsEnabledFn() && homeSlug !== 'posts') {
    html += make('posts', t('ui.allPosts'));
  }
  for (const [slug, info] of Object.entries(tabs)) {
    if (slug === homeSlug) continue;
    const label = info && info.title ? info.title : slug;
    html += make(slug, label);
  }

  if (activeSlug === 'search') {
    const search = windowRef && windowRef.location ? windowRef.location.search : '';
    const sp = new URLSearchParams(search);
    const tag = (sp.get('tag') || '').trim();
    const q = (sp.get('q') || String(searchQuery || '')).trim();
    const href = makeLangUrl(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
    const label = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
    html += `<a class="tab active" data-slug="search" href="${href}">${escapeHtml(String(label || ''))}</a>`;
  } else if (activeSlug === 'post') {
    const raw = String(searchQuery || t('ui.postTab')).trim();
    const label = raw ? escapeHtml(raw.length > 28 ? `${raw.slice(0, 25)}…` : raw) : t('ui.postTab');
    html += `<span class="tab active" data-slug="post">${label}</span>`;
  }

  const measureWidth = (markup) => {
    try {
      const tempNav = nav.cloneNode(false);
      setTrackHtml(tempNav, markup, documentRef, windowRef, searchQuery);
      tempNav.style.position = 'absolute';
      tempNav.style.visibility = 'hidden';
      tempNav.style.pointerEvents = 'none';
      tempNav.style.width = 'auto';
      tempNav.style.zIndex = '-1000';
      (nav.parentNode || (documentRef ? documentRef.body : document.body)).appendChild(tempNav);
      const width = tempNav.offsetWidth;
      tempNav.parentNode.removeChild(tempNav);
      return width;
    } catch (_) {
      return 0;
    }
  };

  try {
    const containerWidth = ((nav.parentElement && nav.parentElement.getBoundingClientRect && nav.parentElement.getBoundingClientRect().width) || nav.clientWidth || 0);
    const fullWidth = measureWidth(html);
    let compact = make(homeSlug, homeLabel);
    if (activeSlug === 'search') {
      const search = windowRef && windowRef.location ? windowRef.location.search : '';
      const sp = new URLSearchParams(search);
      const tag = (sp.get('tag') || '').trim();
      const q = (sp.get('q') || String(searchQuery || '')).trim();
      const href = makeLangUrl(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
      const label = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
      compact += `<a class="tab active" data-slug="search" href="${href}">${escapeHtml(String(label || ''))}</a>`;
    } else if (activeSlug === 'post') {
      const raw = String(searchQuery || t('ui.postTab')).trim();
      const label = raw ? escapeHtml(raw.length > 28 ? `${raw.slice(0, 25)}…` : raw) : t('ui.postTab');
      compact += `<span class="tab active" data-slug="post">${label}</span>`;
    } else if (activeSlug && activeSlug !== 'posts') {
      const info = tabs[activeSlug];
      const label = info && info.title ? info.title : activeSlug;
      compact += make(activeSlug, label).replace('"tab ', '"tab active ');
    }
    if (containerWidth && measureWidth(compact) > containerWidth - 8) {
      if (activeSlug === 'post') {
        const raw = String(searchQuery || t('ui.postTab')).trim();
        const label = raw ? escapeHtml(raw.length > 16 ? `${raw.slice(0, 13)}…` : raw) : t('ui.postTab');
        compact = make(homeSlug, homeLabel) + `<span class="tab active" data-slug="post">${label}</span>`;
      } else if (activeSlug === 'search') {
        const search = windowRef && windowRef.location ? windowRef.location.search : '';
        const sp = new URLSearchParams(search);
        const tag = (sp.get('tag') || '').trim();
        const q = (sp.get('q') || String(searchQuery || '')).trim();
        const labelRaw = tag ? t('ui.tagSearch', tag) : (q ? t('titles.search', q) : t('ui.searchTab'));
        const label = escapeHtml(labelRaw.length > 16 ? `${labelRaw.slice(0, 13)}…` : labelRaw);
        const href = makeLangUrl(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
        compact = make(homeSlug, homeLabel) + `<a class="tab active" data-slug="search" href="${href}">${label}</a>`;
      }
    }
    const currentlyCompact = nav.classList.contains('compact');
    const fullFits = !!(containerWidth && fullWidth && (fullWidth <= containerWidth - 8));
    const fullFitsComfortably = !!(containerWidth && fullWidth && (fullWidth <= containerWidth - 40));
    const useCompact = currentlyCompact ? !fullFitsComfortably : !fullFits;
    if (useCompact) {
      html = compact;
      nav.classList.add('compact');
    } else {
      nav.classList.remove('compact');
    }
  } catch (_) {}

  if (!hasInitiallyRendered) {
    setTrackHtml(nav, html, documentRef, windowRef, searchQuery);
    ensureHighlightOverlay(nav, documentRef);
    hasInitiallyRendered = true;
    updateMovingHighlight(nav, windowRef, documentRef);
    return;
  }

  const currentTrack = nav.querySelector('.tabs-track');
  const currentMarkup = currentTrack ? currentTrack.innerHTML : '';
  if (currentMarkup !== html) {
    const currentActiveTab = nav.querySelector('.tab.active');
    if (currentActiveTab) {
      const curSlug = (currentActiveTab.dataset && currentActiveTab.dataset.slug) || '';
      if (curSlug === 'post' || curSlug === 'search') {
        currentActiveTab.classList.add('deactivating');
      }
    }

    const currentWidth = nav.offsetWidth;
    const newWidth = measureWidth(html);

    nav.style.width = `${currentWidth}px`;
    const shrinking = newWidth < currentWidth;
    const growing = newWidth > currentWidth;
    nav.style.transition = `${growing ? 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0s' : `width 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${shrinking ? '0.06s' : '0s'}`}`;

    const delay = (windowRef && typeof windowRef.setTimeout === 'function') ? windowRef.setTimeout.bind(windowRef) : setTimeout;

    delay(() => {
      setTrackHtml(nav, html, documentRef, windowRef, searchQuery);
      ensureHighlightOverlay(nav, documentRef);
      nav.style.width = `${newWidth}px`;
      updateMovingHighlight(nav, windowRef, documentRef);
      try {
        const newActive = nav.querySelector('.tab.active');
        const newSlug = (newActive && newActive.dataset && newActive.dataset.slug) || '';
        if (newActive && (newSlug === 'post' || newSlug === 'search')) {
          newActive.classList.add('activating');
          const raf = (windowRef && typeof windowRef.requestAnimationFrame === 'function')
            ? windowRef.requestAnimationFrame.bind(windowRef)
            : (fn) => setTimeout(fn, 16);
          raf(() => {
            newActive.classList.add('in');
            delay(() => { newActive.classList.remove('activating', 'in'); }, 260);
          });
        }
      } catch (_) {}

      const resetDelay = growing ? 380 : (shrinking ? 660 : 600);
      delay(() => {
        nav.style.width = 'auto';
        nav.style.transition = '';
      }, resetDelay);
    }, 180);
  } else {
    updateMovingHighlight(nav, windowRef, documentRef);
  }
}

function addTabClickAnimation(tab, windowRef = defaultWindow) {
  if (!tab || !tab.classList || !tab.classList.contains('tab')) return;
  const nav = tab.closest('#tabsNav');
  if (nav && nav.id === 'tabsNav') {
    const currentActive = nav.querySelector('.tab.active');
    if (currentActive && currentActive !== tab) {
      currentActive.classList.add('deactivating');
    }
    if (!tab.classList.contains('active')) {
      const tabRect = tab.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      nav.style.setProperty('--highlight-left', `${left}px`);
      nav.style.setProperty('--highlight-width', `${width}px`);
      nav.style.setProperty('--highlight-opacity', '0.7');
      nav.style.setProperty('--indicator-left', `${left}px`);
      nav.style.setProperty('--indicator-width', `${width * 0.85}px`);
      tab.classList.add('activating');
      const delay = (windowRef && typeof windowRef.setTimeout === 'function') ? windowRef.setTimeout.bind(windowRef) : setTimeout;
      delay(() => tab.classList.remove('activating'), 320);
    }
  }
}

function setupResponsiveTabsObserverNative(params = {}) {
  const windowRef = params.window || defaultWindow;
  const documentRef = params.document || defaultDocument;
  if (!windowRef || responsiveObserverBound) return;
  responsiveObserverBound = true;

  const getTabs = typeof params.getTabs === 'function'
    ? params.getTabs
    : () => params.tabsBySlug || {};

  const delay = (windowRef && typeof windowRef.setTimeout === 'function') ? windowRef.setTimeout.bind(windowRef) : setTimeout;
  const clearDelay = (windowRef && typeof windowRef.clearTimeout === 'function') ? windowRef.clearTimeout.bind(windowRef) : clearTimeout;

  const getCurrentPostTitle = () => {
    if (!documentRef) return '';
    try {
      const el = documentRef.querySelector('#mainview .post-meta-card .post-meta-title');
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
      const tabs = getTabs() || {};
      const base = { window: windowRef, document: documentRef, tabsBySlug: tabs };
      if (id) {
        const title = getCurrentPostTitle();
        renderTabsNative({ ...base, activeSlug: 'post', searchQuery: title });
      } else if (tab === 'search') {
        renderTabsNative({ ...base, activeSlug: 'search', searchQuery: tag || q });
      } else if (tab && tab !== 'posts' && tabs[tab]) {
        renderTabsNative({ ...base, activeSlug: tab });
      } else {
        renderTabsNative({ ...base, activeSlug: 'posts' });
      }
    } catch (_) {}
  };

  const handler = () => {
    clearDelay(tabsResizeTimer);
    tabsResizeTimer = delay(rerender, 140);
  };

  windowRef.addEventListener('resize', handler, { passive: true });
  windowRef.addEventListener('orientationchange', handler, { passive: true });
}

export function mount(context = {}) {
  const windowRef = context.window || defaultWindow;
  const documentRef = context.document || defaultDocument;

  hasInitiallyRendered = false;
  pendingHighlightRaf = 0;
  tabsResizeTimer = 0;
  responsiveObserverBound = false;
  masonryHandlersBound = false;

  if (!lightboxInstalled) {
    try { installLightbox({ root: '#mainview' }); lightboxInstalled = true; } catch (_) {}
  }

  const hooks = (windowRef && windowRef.__ns_themeHooks) || {};
  hooks.getViewContainer = (params = {}) => getContainerByRole(params.role, documentRef);
  hooks.resolveViewContainers = (params = {}) => resolveViewContainersNative(params, documentRef);
  hooks.showElement = (params = {}) => showElementNative(params, windowRef);
  hooks.hideElement = (params = {}) => hideElementNative(params, windowRef);
  hooks.renderSiteLinks = (params = {}) => renderSiteLinksNative(params, documentRef);
  hooks.renderSiteIdentity = (params = {}) => renderSiteIdentityNative(params, documentRef, windowRef);
  hooks.renderFooterNav = (params = {}) => renderFooterNavNative(params, documentRef, windowRef);
  hooks.renderTabs = (params = {}) => renderTabsNative({ ...params, window: windowRef, document: documentRef });
  hooks.updateTabHighlight = (nav) => updateMovingHighlight(nav, windowRef, documentRef);
  hooks.ensureTabOverlay = (nav) => ensureHighlightOverlay(nav, documentRef);
  hooks.setupResponsiveTabsObserver = (params = {}) => setupResponsiveTabsObserverNative({ ...params, window: windowRef, document: documentRef });
  hooks.onTabClick = (tab) => addTabClickAnimation(tab, windowRef);
  hooks.handleWindowResize = (params = {}) => handleWindowResizeNative(params, documentRef, windowRef);
  hooks.updateLayoutLoadingState = (params = {}) => updateLayoutLoadingStateNative(params, documentRef);
  hooks.renderPostTOC = (params = {}) => renderPostTOCNative(params, documentRef, windowRef);
  hooks.renderErrorState = (params = {}) => renderErrorStateNative(params, documentRef);
  hooks.handleViewChange = (params = {}) => handleViewChangeNative(params, documentRef, windowRef);
  hooks.renderTagSidebar = (params = {}) => renderTagSidebarNative(params, documentRef);
  hooks.initializeSyntaxHighlighting = (params = {}) => initializeSyntaxHighlightingNative(params);
  hooks.updateSearchPlaceholder = (params = {}) => updateSearchPlaceholderNative(params, documentRef);
  hooks.renderPostLoadingState = (params = {}) => renderPostLoadingStateNative(params, documentRef);
  hooks.renderPostView = (params = {}) => renderPostViewNative(params, documentRef, windowRef);
  hooks.renderStaticTabLoadingState = (params = {}) => renderStaticTabLoadingStateNative(params, documentRef);
  hooks.renderStaticTabView = (params = {}) => renderStaticTabViewNative(params, documentRef, windowRef);
  hooks.renderIndexView = (params = {}) => renderIndexViewNative(params, documentRef, windowRef);
  hooks.afterIndexRender = (params = {}) => afterIndexRenderNative(params, documentRef);
  hooks.renderSearchResults = (params = {}) => renderSearchResultsNative(params, documentRef, windowRef);
  hooks.afterSearchRender = (params = {}) => afterSearchRenderNative(params, documentRef);
  hooks.enhanceIndexLayout = (params = {}) => enhanceIndexLayoutNative(params, documentRef, windowRef);
  hooks.decoratePostView = (params = {}) => decoratePostViewNative(params, documentRef, windowRef);
  hooks.handleDocumentClick = (params = {}) => handleDocumentClickNative(params, documentRef, windowRef);
  hooks.resetTOC = (params = {}) => resetTOCNative(params, documentRef, windowRef);
  hooks.setupThemeControls = (params = {}) => setupThemeControlsNative(params);
  hooks.resetThemeControls = (params = {}) => resetThemeControlsNative(params, documentRef);
  hooks.reflectThemeConfig = (params = {}) => reflectThemeConfigNative(params, documentRef);
  hooks.setupFooter = (params = {}) => setupFooterNative(params, documentRef, windowRef);
  if (windowRef) windowRef.__ns_themeHooks = hooks;

  return context;
}
