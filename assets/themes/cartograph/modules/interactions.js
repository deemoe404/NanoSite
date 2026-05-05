import { t, withLangParam, getCurrentLang } from '../../../js/i18n.js';
import { escapeHtml, sanitizeUrl, sanitizeImageUrl } from '../../../js/utils.js';
import {
  mountThemeControls,
  applySavedTheme
} from '../../../js/theme.js';
import { renderTagSidebar as renderDefaultTags } from '../../../js/tags.js';
import { prefersReducedMotion } from '../../../js/dom-utils.js';
import {
  renderPostView,
  renderIndexView,
  renderSearchResults,
  renderStaticTabView,
  renderLoadingState,
  renderErrorState,
  renderContentLegend,
  resetContentLegend
} from './views.js';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;
const defaultDocument = typeof document !== 'undefined' ? document : undefined;

function safe(value) {
  return escapeHtml(String(value ?? '')) || '';
}

function localized(config, key) {
  if (!config || !key) return '';
  const value = config[key];
  if (!value) return '';
  if (typeof value === 'string') return value;
  const lang = typeof getCurrentLang === 'function' ? getCurrentLang() : '';
  return (lang && value[lang]) || value.default || '';
}

function getScrollContainer(documentRef = defaultDocument) {
  return documentRef && documentRef.querySelector ? documentRef.querySelector('.cartograph-scroll') : null;
}

function getRoleElement(role, documentRef = defaultDocument) {
  if (!documentRef) return null;
  switch (role) {
    case 'container':
      return documentRef.querySelector('.cartograph-shell');
    case 'content':
      return documentRef.querySelector('.cartograph-board');
    case 'main':
      return documentRef.getElementById('mainview');
    case 'toc':
      return documentRef.getElementById('tocview');
    case 'sidebar':
      return documentRef.querySelector('.cartograph-legend');
    case 'search':
      return documentRef.querySelector('nano-search.cartograph-search');
    case 'nav':
      return documentRef.getElementById('tabsNav');
    case 'tags':
      return documentRef.getElementById('tagview');
    case 'footer':
      return documentRef.querySelector('.cartograph-footer');
    default:
      return null;
  }
}

function scrollToTop(documentRef = defaultDocument, windowRef = defaultWindow, behavior = 'auto') {
  const scroller = getScrollContainer(documentRef);
  try {
    if (scroller && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) {}
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) {}
  return false;
}

function getScrollState(documentRef = defaultDocument, windowRef = defaultWindow) {
  const scroller = getScrollContainer(documentRef);
  try {
    if (scroller) {
      return {
        top: Math.max(0, Math.round(scroller.scrollTop || 0)),
        left: Math.max(0, Math.round(scroller.scrollLeft || 0))
      };
    }
  } catch (_) {}
  try {
    return {
      top: Math.max(0, Math.round(windowRef && typeof windowRef.scrollY === 'number' ? windowRef.scrollY : 0)),
      left: Math.max(0, Math.round(windowRef && typeof windowRef.scrollX === 'number' ? windowRef.scrollX : 0))
    };
  } catch (_) {
    return { top: 0, left: 0 };
  }
}

function restoreScrollState(params = {}, documentRef = defaultDocument, windowRef = defaultWindow) {
  const top = Math.max(0, Math.round(Number(params.top) || 0));
  const left = Math.max(0, Math.round(Number(params.left) || 0));
  const scroller = getScrollContainer(documentRef);
  try {
    if (scroller && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top, left, behavior: 'auto' });
      return true;
    }
  } catch (_) {}
  try {
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      windowRef.scrollTo({ top, left, behavior: 'auto' });
      return true;
    }
  } catch (_) {}
  return false;
}

function showElement(element) {
  if (!element) return false;
  try {
    element.hidden = false;
    element.classList.remove('is-hidden');
    requestAnimationFrame(() => element.classList.add('is-visible'));
    return true;
  } catch (_) {
    return false;
  }
}

function hideElement(element, onDone) {
  if (!element) {
    if (typeof onDone === 'function') onDone();
    return true;
  }
  const finish = () => {
    try {
      element.classList.add('is-hidden');
      element.hidden = true;
    } catch (_) {}
    if (typeof onDone === 'function') onDone();
  };
  try {
    element.classList.remove('is-visible');
    if (prefersReducedMotion()) {
      finish();
    } else {
      element.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 260);
    }
    return true;
  } catch (_) {
    finish();
    return true;
  }
}

function updateSearchPlaceholder(documentRef = defaultDocument) {
  const search = documentRef && documentRef.querySelector ? documentRef.querySelector('nano-search.cartograph-search') : null;
  if (search && typeof search.setPlaceholder === 'function') {
    search.setPlaceholder(t('sidebar.searchPlaceholder'));
    return true;
  }
  const input = search && search.input ? search.input : null;
  if (input) {
    input.setAttribute('placeholder', t('sidebar.searchPlaceholder'));
    return true;
  }
  return false;
}

function setupToolsPanel(documentRef = defaultDocument) {
  const panel = documentRef && documentRef.getElementById('toolsPanel');
  if (!panel) return false;
  try { mountThemeControls({ host: panel, variant: 'cartograph' }); } catch (_) {}
  try { applySavedTheme(); } catch (_) {}
  return true;
}

function resetToolsPanel(documentRef = defaultDocument) {
  const panel = documentRef && documentRef.getElementById('toolsPanel');
  if (!panel) return false;
  panel.innerHTML = '';
  return setupToolsPanel(documentRef);
}

function renderLinksList(root, config) {
  if (!root) return;
  const links = Array.isArray(config && config.profileLinks) ? config.profileLinks : [];
  if (!links.length) {
    root.innerHTML = `<li class="cartograph-linklist__empty">${safe(t('editor.site.noLinks'))}</li>`;
    return;
  }
  root.innerHTML = links.map((item) => {
    if (!item || !item.href) return '';
    const href = sanitizeUrl(String(item.href));
    if (!href) return '';
    const label = item.label || item.href;
    return `<li><a href="${safe(href)}" target="_blank" rel="noopener">${safe(label)}</a></li>`;
  }).join('');
}

function renderNavLinks(nav, tabsBySlug, activeSlug, postsEnabled, getHomeSlug) {
  if (!nav) return false;
  const items = [];
  const homeSlug = typeof getHomeSlug === 'function' ? getHomeSlug() : 'posts';
  if (!postsEnabled || postsEnabled()) {
    items.push({ slug: 'posts', label: t('ui.allPosts'), href: withLangParam('?tab=posts') });
  }
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    const label = info && info.title ? String(info.title) : slug;
    items.push({ slug, label, href: withLangParam(`?tab=${encodeURIComponent(slug)}`) });
  });
  nav.innerHTML = items.map((item) => {
    const current = item.slug === activeSlug || (!activeSlug && item.slug === homeSlug);
    return `<a class="cartograph-nav__item${current ? ' is-current' : ''}" data-tab="${safe(item.slug)}" href="${safe(item.href)}">${safe(item.label)}</a>`;
  }).join('');
  nav.setAttribute('data-active', activeSlug || homeSlug);
  updateNavOverflow(nav);
  return true;
}

function renderFooterLinks(root, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel) {
  if (!root) return false;
  const links = [];
  const homeSlug = typeof getHomeSlug === 'function' ? getHomeSlug() : 'posts';
  const homeLabel = typeof getHomeLabel === 'function' ? getHomeLabel() : t('ui.allPosts');
  links.push({ href: withLangParam(`?tab=${encodeURIComponent(homeSlug)}`), label: homeLabel });
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    links.push({ href: withLangParam(`?tab=${encodeURIComponent(slug)}`), label: (info && info.title) || slug });
  });
  if (!postsEnabled || postsEnabled()) links.push({ href: withLangParam('?tab=search'), label: t('ui.searchTab') });
  root.innerHTML = links.map((link) => `<a href="${safe(link.href)}">${safe(link.label)}</a>`).join('');
  return true;
}

function updateNavOverflow(nav) {
  if (!nav) return;
  const max = Math.max(0, (nav.scrollWidth || 0) - (nav.clientWidth || 0));
  const state = max <= 1
    ? 'none'
    : (nav.scrollLeft <= 1 ? 'end' : (nav.scrollLeft >= max - 1 ? 'start' : 'both'));
  nav.setAttribute('data-overflow', state);
}

function setupNavOverflow(documentRef = defaultDocument, windowRef = defaultWindow) {
  const nav = documentRef && documentRef.getElementById('tabsNav');
  if (!nav) return false;
  if (typeof nav.__cartographOverflowCleanup === 'function') {
    try { nav.__cartographOverflowCleanup(); } catch (_) {}
  }
  const update = () => updateNavOverflow(nav);
  nav.addEventListener('scroll', update, { passive: true });
  if (windowRef && typeof windowRef.addEventListener === 'function') windowRef.addEventListener('resize', update);
  update();
  nav.__cartographOverflowCleanup = () => {
    try { nav.removeEventListener('scroll', update); } catch (_) {}
    try { if (windowRef) windowRef.removeEventListener('resize', update); } catch (_) {}
    delete nav.__cartographOverflowCleanup;
  };
  return true;
}

function setupReadingProgress(documentRef = defaultDocument, windowRef = defaultWindow) {
  const root = documentRef && documentRef.querySelector ? documentRef.querySelector('.cartograph-shell') : null;
  const scroller = getScrollContainer(documentRef);
  if (!root || !scroller) return false;
  if (typeof root.__cartographProgressCleanup === 'function') {
    try { root.__cartographProgressCleanup(); } catch (_) {}
  }
  let frame = 0;
  const update = () => {
    frame = 0;
    const max = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
    const progress = max > 0 ? Math.max(0, Math.min(1, (scroller.scrollTop || 0) / max)) : 0;
    root.style.setProperty('--cartograph-progress', progress.toFixed(4));
  };
  const schedule = () => {
    if (frame) return;
    const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : requestAnimationFrame;
    frame = raf(update);
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  if (windowRef && typeof windowRef.addEventListener === 'function') windowRef.addEventListener('resize', schedule);
  update();
  root.__cartographProgressCleanup = () => {
    try { scroller.removeEventListener('scroll', schedule); } catch (_) {}
    try { if (windowRef) windowRef.removeEventListener('resize', schedule); } catch (_) {}
    if (frame && windowRef && typeof windowRef.cancelAnimationFrame === 'function') {
      try { windowRef.cancelAnimationFrame(frame); } catch (_) {}
    }
    delete root.__cartographProgressCleanup;
  };
  return true;
}

function getWindowScrollTop(documentRef = defaultDocument, windowRef = defaultWindow) {
  try {
    if (windowRef && typeof windowRef.scrollY === 'number') return windowRef.scrollY;
  } catch (_) {}
  try {
    const docEl = documentRef && documentRef.documentElement;
    const body = documentRef && documentRef.body;
    return Math.max(docEl && docEl.scrollTop || 0, body && body.scrollTop || 0);
  } catch (_) {
    return 0;
  }
}

function shouldUseCartographScroller(scroller, windowRef = defaultWindow) {
  if (!scroller) return false;
  try {
    const style = windowRef && typeof windowRef.getComputedStyle === 'function'
      ? windowRef.getComputedStyle(scroller)
      : null;
    const overflowY = style && style.overflowY ? String(style.overflowY) : '';
    if (overflowY === 'visible' || overflowY === 'clip') return false;
  } catch (_) {}
  return true;
}

function keepTocLinkVisible(toc, link) {
  if (!toc || !link || typeof toc.getBoundingClientRect !== 'function' || typeof link.getBoundingClientRect !== 'function') return;
  try {
    const tocRect = toc.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const topLimit = tocRect.top + 12;
    const bottomLimit = tocRect.bottom - 12;
    if (linkRect.top < topLimit) {
      toc.scrollTop -= topLimit - linkRect.top;
    } else if (linkRect.bottom > bottomLimit) {
      toc.scrollTop += linkRect.bottom - bottomLimit;
    }
  } catch (_) {}
}

function setupCartographTocSync(documentRef = defaultDocument, windowRef = defaultWindow) {
  if (!documentRef) return false;
  const toc = documentRef.getElementById('tocview');
  const root = documentRef.getElementById('mainview');
  if (!toc || !root) return false;

  if (typeof toc.__cartographTocSyncCleanup === 'function') {
    try { toc.__cartographTocSyncCleanup(); } catch (_) {}
  }

  if (toc.hidden) return false;

  const linksById = new Map();
  toc.querySelectorAll('a[href^="#"]:not(.toc-anchor):not(.toc-top)').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const id = href.replace(/^#/, '');
    if (id) linksById.set(id, link);
  });
  if (!linksById.size) return false;

  const scroller = getScrollContainer(documentRef);
  const useElementScroller = shouldUseCartographScroller(scroller, windowRef);
  const scrollSource = useElementScroller ? scroller : windowRef;
  let positions = [];
  let frame = 0;
  let lastActiveId = '';
  let observer = null;

  const getRaf = () => (
    windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (callback) => setTimeout(callback, 16)
  );
  const getCancelRaf = () => (
    windowRef && typeof windowRef.cancelAnimationFrame === 'function'
      ? windowRef.cancelAnimationFrame.bind(windowRef)
      : clearTimeout
  );

  const getScrollTop = () => {
    if (useElementScroller && scroller) return scroller.scrollTop || 0;
    return getWindowScrollTop(documentRef, windowRef);
  };

  const getViewportHeight = () => {
    if (useElementScroller && scroller) return scroller.clientHeight || 0;
    return windowRef && windowRef.innerHeight ? windowRef.innerHeight : 0;
  };

  const getHeadingTop = (heading) => {
    if (!heading || typeof heading.getBoundingClientRect !== 'function') return 0;
    try {
      if (useElementScroller && scroller && typeof scroller.getBoundingClientRect === 'function') {
        return heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top + (scroller.scrollTop || 0);
      }
      return heading.getBoundingClientRect().top + getWindowScrollTop(documentRef, windowRef);
    } catch (_) {
      return 0;
    }
  };

  const computePositions = () => {
    positions = Array.from(linksById.keys())
      .map((id) => {
        const heading = documentRef.getElementById(id);
        if (!heading || !root.contains(heading)) return null;
        return heading ? { id, top: getHeadingTop(heading) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top);
  };

  const setActive = (id, force = false) => {
    if (!id || (!force && id === lastActiveId)) return;
    lastActiveId = id;
    if (typeof toc._setActive === 'function') {
      try { toc._setActive(id); } catch (_) {}
    } else {
      toc.querySelectorAll('a.active').forEach((link) => link.classList.remove('active'));
      const link = linksById.get(id);
      if (link) link.classList.add('active');
    }
    keepTocLinkVisible(toc, linksById.get(id));
  };

  const updateActive = (force = false) => {
    if (!positions.length) computePositions();
    if (!positions.length) return;
    const viewportHeight = getViewportHeight();
    const offset = Math.min(160, Math.max(72, viewportHeight * 0.18 || 120));
    const y = getScrollTop() + offset;
    let currentId = positions[0] ? positions[0].id : '';
    for (let i = 0; i < positions.length; i += 1) {
      if (positions[i].top <= y) currentId = positions[i].id;
      else break;
    }
    setActive(currentId, force);
  };

  const schedule = () => {
    if (frame) return;
    frame = getRaf()(() => {
      frame = 0;
      updateActive(false);
    });
  };

  const recompute = () => {
    computePositions();
    updateActive(true);
  };

  computePositions();
  updateActive(true);

  if (scrollSource && typeof scrollSource.addEventListener === 'function') {
    scrollSource.addEventListener('scroll', schedule, { passive: true });
  }
  if (windowRef && typeof windowRef.addEventListener === 'function') {
    windowRef.addEventListener('resize', recompute);
    windowRef.addEventListener('load', recompute);
  }
  if (windowRef && typeof windowRef.ResizeObserver === 'function') {
    try {
      observer = new windowRef.ResizeObserver(recompute);
      observer.observe(root);
    } catch (_) {
      observer = null;
    }
  }

  toc.__cartographTocSyncUpdate = recompute;
  toc.__cartographTocSyncCleanup = () => {
    try {
      if (scrollSource && typeof scrollSource.removeEventListener === 'function') {
        scrollSource.removeEventListener('scroll', schedule);
      }
    } catch (_) {}
    try {
      if (windowRef && typeof windowRef.removeEventListener === 'function') {
        windowRef.removeEventListener('resize', recompute);
        windowRef.removeEventListener('load', recompute);
      }
    } catch (_) {}
    try { if (observer) observer.disconnect(); } catch (_) {}
    if (frame) {
      try { getCancelRaf()(frame); } catch (_) {}
    }
    delete toc.__cartographTocSyncUpdate;
    delete toc.__cartographTocSyncCleanup;
  };
  return true;
}

function refreshCartographTocSync(documentRef = defaultDocument, windowRef = defaultWindow) {
  const toc = documentRef && documentRef.getElementById ? documentRef.getElementById('tocview') : null;
  if (toc && typeof toc.__cartographTocSyncUpdate === 'function') {
    try {
      toc.__cartographTocSyncUpdate();
      return true;
    } catch (_) {}
  }
  return setupCartographTocSync(documentRef, windowRef);
}

function mountHooks(documentRef = defaultDocument, windowRef = defaultWindow) {
  const hooks = {};

  hooks.resolveViewContainers = ({ view } = {}) => ({
    view,
    mainElement: getRoleElement('main', documentRef),
    tocElement: getRoleElement('toc', documentRef),
    sidebarElement: getRoleElement('sidebar', documentRef),
    contentElement: getRoleElement('content', documentRef),
    containerElement: getRoleElement('container', documentRef)
  });

  hooks.getViewContainer = ({ role } = {}) => getRoleElement(role, documentRef);
  hooks.getScrollState = () => getScrollState(documentRef, windowRef);
  hooks.restoreScrollState = (params = {}) => restoreScrollState(params, documentRef, windowRef);
  hooks.showElement = ({ element } = {}) => showElement(element);
  hooks.hideElement = ({ element, onDone } = {}) => hideElement(element, onDone);

  hooks.renderSiteIdentity = ({ config } = {}) => {
    const title = localized(config, 'siteTitle') || 'NanoSite';
    const subtitle = localized(config, 'siteSubtitle');
    documentRef.querySelectorAll('[data-site-title], [data-site-title-rail]').forEach((node) => { node.textContent = title; });
    documentRef.querySelectorAll('[data-site-subtitle], [data-site-subtitle-rail]').forEach((node) => { node.textContent = subtitle || ''; });

    const mark = documentRef.querySelector('.cartograph-brand__mark');
    const logo = documentRef.querySelector('[data-site-logo]');
    let logoSrc = '';
    if (typeof (config && config.avatar) === 'string') logoSrc = config.avatar;
    else if (config && config.avatar && typeof config.avatar === 'object') {
      const lang = typeof getCurrentLang === 'function' ? getCurrentLang() : '';
      logoSrc = (lang && config.avatar[lang]) || config.avatar.default || '';
    }
    const safeLogo = logoSrc && typeof sanitizeImageUrl === 'function' ? sanitizeImageUrl(logoSrc) : logoSrc;
    if (logo) {
      if (safeLogo) {
        logo.src = safeLogo;
        logo.alt = title;
        logo.hidden = false;
        if (mark) mark.classList.remove('cartograph-brand__mark--empty');
      } else {
        logo.removeAttribute('src');
        logo.alt = '';
        logo.hidden = true;
        if (mark) mark.classList.add('cartograph-brand__mark--empty');
      }
    }
    return true;
  };

  hooks.renderSiteLinks = ({ config } = {}) => {
    renderLinksList(documentRef.querySelector('[data-site-links]'), config);
    return true;
  };

  hooks.updateLayoutLoadingState = ({ isLoading } = {}) => {
    const root = getRoleElement('container', documentRef);
    if (root) root.classList.toggle('is-loading', !!isLoading);
    return true;
  };

  hooks.renderPostTOC = (params = {}) => {
    const result = renderContentLegend({
      ...params,
      document: documentRef,
      window: windowRef
    });
    setupCartographTocSync(documentRef, windowRef);
    return result;
  };

  hooks.renderErrorState = (params = {}) => renderErrorState({
    ...params,
    document: documentRef,
    window: windowRef
  });

  hooks.handleViewChange = ({ view, context } = {}) => {
    if (documentRef && documentRef.body) documentRef.body.setAttribute('data-active-view', view || 'posts');
    const search = documentRef.querySelector('nano-search.cartograph-search');
    const queryValue = context && context.queryValue != null ? String(context.queryValue || '') : '';
    if (search) search.value = view === 'search' ? queryValue : '';
    return true;
  };

  hooks.renderTagSidebar = ({ postsIndex, utilities } = {}) => {
    const render = utilities && typeof utilities.renderTagSidebar === 'function'
      ? utilities.renderTagSidebar
      : renderDefaultTags;
    try { render(postsIndex || {}); } catch (_) {}
    const tagBox = documentRef.getElementById('tagview');
    if (tagBox) tagBox.hidden = false;
    return true;
  };

  hooks.enhanceIndexLayout = (params = {}) => {
    const target = params.containerElement || getRoleElement('main', documentRef);
    try { if (typeof params.hydrateCardCovers === 'function') params.hydrateCardCovers(target); } catch (_) {}
    try { if (typeof params.applyLazyLoadingIn === 'function') params.applyLazyLoadingIn(target); } catch (_) {}
    try { if (typeof params.setupSearch === 'function') params.setupSearch(params.allEntries || []); } catch (_) {}
    try { if (typeof params.renderTagSidebar === 'function') params.renderTagSidebar(params.postsIndexMap || {}); } catch (_) {}
    return true;
  };

  hooks.renderTabs = ({ tabsBySlug, activeSlug, getHomeSlug, postsEnabled } = {}) => {
    return renderNavLinks(documentRef.getElementById('tabsNav'), tabsBySlug, activeSlug, postsEnabled, getHomeSlug);
  };

  hooks.renderFooterNav = ({ tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel } = {}) => {
    return renderFooterLinks(documentRef.getElementById('footerNav'), tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel);
  };

  hooks.renderPostLoadingState = (params = {}) => renderLoadingState({
    ...params,
    document: documentRef,
    window: windowRef
  });

  hooks.renderStaticTabLoadingState = hooks.renderPostLoadingState;

  hooks.renderPostView = (params = {}) => {
    const result = renderPostView({
      ...params,
      document: documentRef,
      window: windowRef
    });
    setupCartographTocSync(documentRef, windowRef);
    return result;
  };

  hooks.renderIndexView = (params = {}) => renderIndexView({
    ...params,
    document: documentRef,
    window: windowRef
  });

  hooks.renderSearchResults = (params = {}) => renderSearchResults({
    ...params,
    document: documentRef,
    window: windowRef
  });

  hooks.renderStaticTabView = (params = {}) => {
    const result = renderStaticTabView({
      ...params,
      document: documentRef,
      window: windowRef
    });
    setupCartographTocSync(documentRef, windowRef);
    return result;
  };

  hooks.decoratePostView = () => true;

  hooks.resetTOC = () => {
    const toc = documentRef.getElementById('tocview');
    if (toc && typeof toc.__cartographTocSyncCleanup === 'function') {
      try { toc.__cartographTocSyncCleanup(); } catch (_) {}
    }
    resetContentLegend(documentRef);
    return true;
  };

  hooks.scrollToHash = ({ hash } = {}) => {
    if (!hash) return false;
    const target = documentRef.getElementById(hash);
    if (!target) return false;
    try {
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => refreshCartographTocSync(documentRef, windowRef), 80);
      return true;
    } catch (_) {
      return false;
    }
  };

  hooks.handleRouteScroll = () => scrollToTop(documentRef, windowRef, prefersReducedMotion() ? 'auto' : 'smooth');
  hooks.handleDocumentClick = () => false;
  hooks.handleWindowResize = () => {
    setupReadingProgress(documentRef, windowRef);
    updateNavOverflow(documentRef.getElementById('tabsNav'));
    refreshCartographTocSync(documentRef, windowRef);
    return true;
  };

  hooks.setupThemeControls = () => setupToolsPanel(documentRef);
  hooks.resetThemeControls = () => resetToolsPanel(documentRef);
  hooks.updateSearchPlaceholder = () => updateSearchPlaceholder(documentRef);
  hooks.setupResponsiveTabsObserver = () => setupNavOverflow(documentRef, windowRef);

  hooks.reflectThemeConfig = ({ config } = {}) => {
    const root = getRoleElement('container', documentRef);
    if (root && config && config.themePack) root.setAttribute('data-theme-pack', config.themePack);
    return true;
  };

  hooks.setupFooter = ({ config } = {}) => {
    const credit = documentRef.querySelector('.cartograph-footer__credit');
    if (credit) {
      const title = localized(config, 'siteTitle') || documentRef.querySelector('[data-site-title]')?.textContent || 'NanoSite';
      credit.textContent = `${new Date().getFullYear()} / ${title}`;
    }
    return true;
  };

  hooks.afterIndexRender = (params = {}) => hooks.enhanceIndexLayout(params);
  hooks.afterSearchRender = (params = {}) => hooks.enhanceIndexLayout(params);

  if (windowRef) {
    windowRef.__ns_themeHooks = Object.assign({}, windowRef.__ns_themeHooks || {}, hooks);
  }
  return hooks;
}

export function mount(context = {}) {
  const doc = context.document || defaultDocument;
  const win = (doc && doc.defaultView) || defaultWindow;
  const hooks = mountHooks(doc, win);
  setupToolsPanel(doc);
  updateSearchPlaceholder(doc);
  setupReadingProgress(doc, win);
  setupNavOverflow(doc, win);
  return {
    hooks,
    views: {
      post: hooks.renderPostView,
      posts: hooks.renderIndexView,
      search: hooks.renderSearchResults,
      tab: hooks.renderStaticTabView
    },
    effects: hooks
  };
}

export default {
  mount,
  unmount() {},
  regions: {},
  views: {
    post: renderPostView,
    posts: renderIndexView,
    search: renderSearchResults,
    tab: renderStaticTabView
  },
  components: {},
  effects: {}
};
