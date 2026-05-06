import { escapeHtml, sanitizeUrl, sanitizeImageUrl } from '../../../js/utils.js';
import {
  mountThemeControls,
  applySavedTheme
} from '../../../js/theme.js';
import { renderTagSidebar as renderDefaultTags } from '../../../js/tags.js';
import { prefersReducedMotion } from '../../../js/dom-utils.js';
import {
  renderContentLegend,
  resetContentLegend
} from './views.js';

const defaultWindow = typeof window !== 'undefined' ? window : undefined;
const defaultDocument = typeof document !== 'undefined' ? document : undefined;

function safe(value) {
  return escapeHtml(String(value ?? '')) || '';
}

function translate(context = {}, params = {}) {
  if (typeof params.translate === 'function') return params.translate;
  if (typeof params.translator === 'function') return params.translator;
  try {
    if (context.i18n && typeof context.i18n.t === 'function') return context.i18n.t;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && typeof window.__press_t === 'function') return window.__press_t;
  } catch (_) {}
  return (key, ...args) => (args.length ? `${key} ${args.join(' ')}` : String(key || ''));
}

function currentLang(context = {}, params = {}) {
  if (params && typeof params.lang === 'string' && params.lang.trim()) return params.lang.trim();
  try {
    const url = new URL((context.window || defaultWindow).location.href);
    const lang = url.searchParams.get('lang');
    if (lang) return lang;
  } catch (_) {}
  try {
    const stored = (context.window || defaultWindow).localStorage.getItem('lang');
    if (stored) return stored;
  } catch (_) {}
  try {
    const docLang = (context.document || defaultDocument).documentElement.getAttribute('lang');
    if (docLang) return docLang;
  } catch (_) {}
  return 'en';
}

function withLang(context = {}, params = {}) {
  if (typeof params.withLangParam === 'function') return params.withLangParam;
  try {
    if (context.i18n && typeof context.i18n.withLangParam === 'function') return context.i18n.withLangParam;
  } catch (_) {}
  return (href) => {
    try {
      const win = context.window || defaultWindow;
      const url = new URL(String(href || ''), win.location.href);
      const lang = currentLang(context, params);
      if (lang) url.searchParams.set('lang', lang);
      if (url.origin === win.location.origin && url.pathname === win.location.pathname) {
        return `${url.search}${url.hash}`;
      }
      return url.toString();
    } catch (_) {
      return href;
    }
  };
}

function localized(context, config, key) {
  if (!config || !key) return '';
  const value = config[key];
  if (!value) return '';
  if (typeof value === 'string') return value;
  const lang = currentLang(context);
  return (lang && value[lang]) || value.default || '';
}

function getRegion(context = {}, names, fallbackSelector = '') {
  const list = Array.isArray(names) ? names : [names];
  const regions = context.regions;
  if (regions && typeof regions.get === 'function') {
    for (const name of list) {
      const region = regions.get(name);
      if (region) return region;
    }
  }
  if (fallbackSelector) {
    try { return (context.document || defaultDocument).querySelector(fallbackSelector); } catch (_) {}
  }
  return null;
}

function viewContext(context = {}, params = {}) {
  return {
    ...params,
    ctx: {
      ...((params && params.ctx) || {}),
      document: context.document || defaultDocument,
      window: context.window || defaultWindow,
      regions: context.regions,
      i18n: {
        t: translate(context, params),
        lang: currentLang(context, params),
        withLangParam: withLang(context, params)
      }
    }
  };
}

function getScrollContainer(context = {}) {
  return getRegion(context, 'scrollContainer', '.cartograph-scroll');
}

function scrollToTop(context = {}, behavior = 'auto') {
  const scroller = getScrollContainer(context);
  const win = context.window || defaultWindow;
  try {
    if (scroller && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) {}
  try {
    if (win && typeof win.scrollTo === 'function') {
      win.scrollTo({ top: 0, left: 0, behavior });
      return true;
    }
  } catch (_) {}
  return false;
}

function getScrollState(context = {}) {
  const scroller = getScrollContainer(context);
  const win = context.window || defaultWindow;
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
      top: Math.max(0, Math.round(win && typeof win.scrollY === 'number' ? win.scrollY : 0)),
      left: Math.max(0, Math.round(win && typeof win.scrollX === 'number' ? win.scrollX : 0))
    };
  } catch (_) {
    return { top: 0, left: 0 };
  }
}

function restoreScrollState(context = {}, params = {}) {
  const top = Math.max(0, Math.round(Number(params.top) || 0));
  const left = Math.max(0, Math.round(Number(params.left) || 0));
  const scroller = getScrollContainer(context);
  const win = context.window || defaultWindow;
  try {
    if (scroller && typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top, left, behavior: 'auto' });
      return true;
    }
  } catch (_) {}
  try {
    if (win && typeof win.scrollTo === 'function') {
      win.scrollTo({ top, left, behavior: 'auto' });
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

function updateSearchPlaceholder(context = {}, params = {}) {
  const search = getRegion(context, ['search', 'searchBox'], 'press-search.cartograph-search');
  const placeholder = params.placeholder || translate(context, params)('sidebar.searchPlaceholder');
  if (search && typeof search.setPlaceholder === 'function') {
    search.setPlaceholder(placeholder);
    return true;
  }
  return false;
}

function setupToolsPanel(context = {}) {
  const panel = getRegion(context, 'toolsPanel', '.cartograph-tools');
  if (!panel) return false;
  try { mountThemeControls({ host: panel, variant: 'cartograph' }); } catch (_) {}
  try { applySavedTheme(); } catch (_) {}
  return true;
}

function resetToolsPanel(context = {}) {
  const panel = getRegion(context, 'toolsPanel', '.cartograph-tools');
  if (!panel) return false;
  panel.innerHTML = '';
  return setupToolsPanel(context);
}

function renderLinksList(root, config, context) {
  const t = translate(context);
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

function renderNavLinks(nav, tabsBySlug, activeSlug, postsEnabled, getHomeSlug, context, params) {
  if (!nav) return false;
  const t = translate(context, params);
  const makeHref = withLang(context, params);
  const items = [];
  const homeSlug = typeof getHomeSlug === 'function' ? getHomeSlug() : 'posts';
  if (!postsEnabled || postsEnabled()) {
    items.push({ slug: 'posts', label: t('ui.allPosts'), href: makeHref('?tab=posts') });
  }
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    const label = info && info.title ? String(info.title) : slug;
    items.push({ slug, label, href: makeHref(`?tab=${encodeURIComponent(slug)}`) });
  });
  nav.innerHTML = items.map((item) => {
    const current = item.slug === activeSlug || (!activeSlug && item.slug === homeSlug);
    return `<a class="cartograph-nav__item${current ? ' is-current' : ''}" data-tab="${safe(item.slug)}" href="${safe(item.href)}">${safe(item.label)}</a>`;
  }).join('');
  nav.setAttribute('data-active', activeSlug || homeSlug);
  updateNavOverflow(nav);
  return true;
}

function renderFooterLinks(root, tabsBySlug, postsEnabled, getHomeSlug, getHomeLabel, context, params) {
  if (!root) return false;
  const t = translate(context, params);
  const makeHref = withLang(context, params);
  const links = [];
  const homeSlug = typeof getHomeSlug === 'function' ? getHomeSlug() : 'posts';
  const homeLabel = typeof getHomeLabel === 'function' ? getHomeLabel() : t('ui.allPosts');
  links.push({ href: makeHref(`?tab=${encodeURIComponent(homeSlug)}`), label: homeLabel });
  Object.entries(tabsBySlug || {}).forEach(([slug, info]) => {
    links.push({ href: makeHref(`?tab=${encodeURIComponent(slug)}`), label: (info && info.title) || slug });
  });
  if (!postsEnabled || postsEnabled()) links.push({ href: makeHref('?tab=search'), label: t('ui.searchTab') });
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

function setupNavOverflow(context = {}) {
  const nav = getRegion(context, ['nav', 'navBox'], '.cartograph-nav');
  const win = context.window || defaultWindow;
  if (!nav) return false;
  if (typeof nav.__cartographOverflowCleanup === 'function') {
    try { nav.__cartographOverflowCleanup(); } catch (_) {}
  }
  const update = () => updateNavOverflow(nav);
  nav.addEventListener('scroll', update, { passive: true });
  if (win && typeof win.addEventListener === 'function') win.addEventListener('resize', update);
  update();
  nav.__cartographOverflowCleanup = () => {
    try { nav.removeEventListener('scroll', update); } catch (_) {}
    try { if (win) win.removeEventListener('resize', update); } catch (_) {}
    delete nav.__cartographOverflowCleanup;
  };
  return true;
}

function setupReadingProgress(context = {}) {
  const root = getRegion(context, 'container', '.cartograph-shell');
  const scroller = getScrollContainer(context);
  const win = context.window || defaultWindow;
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
    const raf = win && typeof win.requestAnimationFrame === 'function'
      ? win.requestAnimationFrame.bind(win)
      : requestAnimationFrame;
    frame = raf(update);
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  if (win && typeof win.addEventListener === 'function') win.addEventListener('resize', schedule);
  update();
  root.__cartographProgressCleanup = () => {
    try { scroller.removeEventListener('scroll', schedule); } catch (_) {}
    try { if (win) win.removeEventListener('resize', schedule); } catch (_) {}
    if (frame && win && typeof win.cancelAnimationFrame === 'function') {
      try { win.cancelAnimationFrame(frame); } catch (_) {}
    }
    delete root.__cartographProgressCleanup;
  };
  return true;
}

function enhanceIndexLayoutFor(localContext, params = {}) {
  const target = params.containerElement || getRegion(localContext, 'main', '.cartograph-mainview');
  try { if (typeof params.hydrateCardCovers === 'function') params.hydrateCardCovers(target); } catch (_) {}
  try { if (typeof params.applyLazyLoadingIn === 'function') params.applyLazyLoadingIn(target); } catch (_) {}
  try { if (typeof params.setupSearch === 'function') params.setupSearch(params.allEntries || []); } catch (_) {}
  try { if (typeof params.renderTagSidebar === 'function') params.renderTagSidebar(params.postsIndexMap || {}); } catch (_) {}
  return true;
}

function createEffects(context = {}) {
  const doc = context.document || defaultDocument;
  const win = (doc && doc.defaultView) || context.window || defaultWindow;
  const localContext = { ...context, document: doc, window: win };

  return {
    resolveViewContainers({ view } = {}) {
      return {
        view,
        mainElement: getRegion(localContext, 'main', '.cartograph-mainview'),
        tocElement: getRegion(localContext, 'toc', '.cartograph-toc'),
        sidebarElement: getRegion(localContext, ['sidebar', 'legend'], '.cartograph-legend'),
        contentElement: getRegion(localContext, 'content', '.cartograph-board'),
        containerElement: getRegion(localContext, 'container', '.cartograph-shell')
      };
    },

    getViewContainer({ role } = {}) {
      const roleMap = {
        main: ['main'],
        toc: ['toc'],
        sidebar: ['sidebar', 'legend'],
        content: ['content'],
        container: ['container'],
        search: ['search', 'searchBox'],
        nav: ['nav', 'navBox'],
        tags: ['tags', 'tagBand'],
        footer: ['footer']
      };
      return getRegion(localContext, roleMap[role] || role);
    },

    getScrollState() {
      return getScrollState(localContext);
    },

    restoreScrollState(params = {}) {
      return restoreScrollState(localContext, params);
    },

    showElement({ element } = {}) {
      return showElement(element);
    },

    hideElement({ element, onDone } = {}) {
      return hideElement(element, onDone);
    },

    renderSiteIdentity({ config } = {}) {
      const title = localized(localContext, config, 'siteTitle') || 'Press';
      const subtitle = localized(localContext, config, 'siteSubtitle');
      doc.querySelectorAll('[data-site-title], [data-site-title-rail]').forEach((node) => { node.textContent = title; });
      doc.querySelectorAll('[data-site-subtitle], [data-site-subtitle-rail]').forEach((node) => { node.textContent = subtitle || ''; });

      const mark = doc.querySelector('.cartograph-brand__mark');
      const logo = doc.querySelector('[data-site-logo]');
      let logoSrc = '';
      if (typeof (config && config.avatar) === 'string') logoSrc = config.avatar;
      else if (config && config.avatar && typeof config.avatar === 'object') {
        const lang = currentLang(localContext);
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
    },

    renderSiteLinks({ config } = {}) {
      renderLinksList(doc.querySelector('[data-site-links]'), config, localContext);
      return true;
    },

    updateLayoutLoadingState({ isLoading } = {}) {
      const root = getRegion(localContext, 'container', '.cartograph-shell');
      if (root) root.classList.toggle('is-loading', !!isLoading);
      return true;
    },

    renderPostTOC(params = {}) {
      return renderContentLegend(viewContext(localContext, params));
    },

    handleViewChange({ view, context: routeContext } = {}) {
      if (doc && doc.body) doc.body.setAttribute('data-active-view', view || 'posts');
      const search = getRegion(localContext, ['search', 'searchBox'], 'press-search.cartograph-search');
      const queryValue = routeContext && routeContext.queryValue != null ? String(routeContext.queryValue || '') : '';
      if (search) search.value = view === 'search' ? queryValue : '';
      return true;
    },

    renderTagSidebar({ postsIndex, utilities } = {}) {
      const render = utilities && typeof utilities.renderTagSidebar === 'function'
        ? utilities.renderTagSidebar
        : renderDefaultTags;
      try { render(postsIndex || {}); } catch (_) {}
      const tagBox = getRegion(localContext, ['tags', 'tagBand'], '.cartograph-tagband');
      if (tagBox) tagBox.hidden = false;
      return true;
    },

    enhanceIndexLayout(params = {}) {
      return enhanceIndexLayoutFor(localContext, params);
    },

    renderTabs(params = {}) {
      return renderNavLinks(
        getRegion(localContext, ['nav', 'navBox'], '.cartograph-nav'),
        params.tabsBySlug,
        params.activeSlug,
        params.postsEnabled,
        params.getHomeSlug,
        localContext,
        params
      );
    },

    renderFooterNav(params = {}) {
      return renderFooterLinks(
        getRegion(localContext, 'footerNav', '.cartograph-footer__nav'),
        params.tabsBySlug,
        params.postsEnabled,
        params.getHomeSlug,
        params.getHomeLabel,
        localContext,
        params
      );
    },

    resetTOC() {
      resetContentLegend(viewContext(localContext));
      return true;
    },

    scrollToHash({ hash } = {}) {
      if (!hash) return false;
      const target = doc.getElementById(hash);
      if (!target) return false;
      try {
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        return true;
      } catch (_) {
        return false;
      }
    },

    handleRouteScroll() {
      return scrollToTop(localContext, prefersReducedMotion() ? 'auto' : 'smooth');
    },

    handleDocumentClick() {
      return false;
    },

    handleWindowResize() {
      setupReadingProgress(localContext);
      updateNavOverflow(getRegion(localContext, ['nav', 'navBox'], '.cartograph-nav'));
      const toc = getRegion(localContext, 'toc', '.cartograph-toc');
      try { if (toc && typeof toc.enhance === 'function') toc.enhance(); } catch (_) {}
      return true;
    },

    setupThemeControls() {
      return setupToolsPanel(localContext);
    },

    resetThemeControls() {
      return resetToolsPanel(localContext);
    },

    updateSearchPlaceholder(params = {}) {
      return updateSearchPlaceholder(localContext, params);
    },

    setupResponsiveTabsObserver() {
      return setupNavOverflow(localContext);
    },

    reflectThemeConfig({ config } = {}) {
      const root = getRegion(localContext, 'container', '.cartograph-shell');
      if (root && config && config.themePack) root.setAttribute('data-theme-pack', config.themePack);
      return true;
    },

    setupFooter({ config } = {}) {
      const credit = doc.querySelector('.cartograph-footer__credit');
      if (credit) {
        const title = localized(localContext, config, 'siteTitle') || doc.querySelector('[data-site-title]')?.textContent || 'Press';
        credit.textContent = `${new Date().getFullYear()} / ${title}`;
      }
      return true;
    },

    afterIndexRender(params = {}) {
      return enhanceIndexLayoutFor(localContext, params);
    },

    afterSearchRender(params = {}) {
      return enhanceIndexLayoutFor(localContext, params);
    }
  };
}

export function mount(context = {}) {
  const effects = createEffects(context);
  setupToolsPanel(context);
  updateSearchPlaceholder(context);
  setupReadingProgress(context);
  setupNavOverflow(context);
  return {
    effects,
    components: {}
  };
}

export default {
  mount,
  unmount() {},
  regions: {},
  views: {},
  components: {},
  effects: {}
};
