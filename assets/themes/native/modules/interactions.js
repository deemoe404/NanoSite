import { installLightbox } from '../../../js/lightbox.js';
import { t, withLangParam } from '../../../js/i18n.js';
import { slugifyTab, escapeHtml, getQueryVariable } from '../../../js/utils.js';
import { getArticleTitleFromMain } from '../../../js/dom-utils.js';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;
const defaultDocument = typeof document !== 'undefined' ? document : undefined;

let hasInitiallyRendered = false;
let pendingHighlightRaf = 0;
let tabsResizeTimer = 0;
let responsiveObserverBound = false;
let lightboxInstalled = false;

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

  const homeSlug = getHomeSlug(tabs, windowRef);
  const homeLabel = computeHomeLabel(homeSlug, tabs);

  const make = (slug, label) => {
    const safeSlug = slugifyTab(slug) || slug;
    const href = withLangParam(`?tab=${encodeURIComponent(safeSlug)}`);
    return `<a class="tab${activeSlug === slug ? ' active' : ''}" data-slug="${escapeHtml(safeSlug)}" href="${href}">${escapeHtml(String(label || ''))}</a>`;
  };

  let html = '';
  html += make(homeSlug, homeLabel);
  if (postsEnabled(windowRef) && homeSlug !== 'posts') {
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
    const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
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
      const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
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
        const href = withLangParam(`?tab=search${tag ? `&tag=${encodeURIComponent(tag)}` : (q ? `&q=${encodeURIComponent(q)}` : '')}`);
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

  if (!lightboxInstalled) {
    try { installLightbox({ root: '#mainview' }); lightboxInstalled = true; } catch (_) {}
  }

  const hooks = (windowRef && windowRef.__ns_themeHooks) || {};
  hooks.renderTabs = (params = {}) => renderTabsNative({ ...params, window: windowRef, document: documentRef });
  hooks.updateTabHighlight = (nav) => updateMovingHighlight(nav, windowRef, documentRef);
  hooks.ensureTabOverlay = (nav) => ensureHighlightOverlay(nav, documentRef);
  hooks.setupResponsiveTabsObserver = (params = {}) => setupResponsiveTabsObserverNative({ ...params, window: windowRef, document: documentRef });
  hooks.onTabClick = (tab) => addTabClickAnimation(tab, windowRef);
  if (windowRef) windowRef.__ns_themeHooks = hooks;

  return context;
}
