export default function registerAuroraTheme(context) {
  const { root, i18n } = context || {};
  const langBadge = root ? root.querySelector('[data-lang-indicator]') : null;
  const routeBadge = root ? root.querySelector('[data-route-label]') : null;
  const getLabel = (view) => {
    const safeView = view || '';
    const tryT = (key, fallback) => {
      if (!i18n || typeof i18n.t !== 'function') return fallback;
      try {
        const val = i18n.t(key);
        return (val && val !== key) ? val : fallback;
      } catch (_) { return fallback; }
    };
    if (safeView === 'posts') return tryT('ui.allPosts', 'Posts');
    if (safeView === 'post') return tryT('ui.article', 'Article');
    if (safeView === 'tab') return tryT('ui.page', 'Page');
    if (safeView === 'search') return tryT('ui.searchTab', 'Search');
    return safeView;
  };

  const formatLang = () => {
    if (!langBadge || !i18n) return;
    const code = (i18n.getCurrentLang && i18n.getCurrentLang()) || 'en';
    const label = (i18n.getLanguageLabel && i18n.getLanguageLabel(code)) || code.toUpperCase();
    langBadge.textContent = label;
  };

  const formatRoute = (route) => {
    if (!routeBadge) return;
    if (!route || typeof route !== 'object') {
      routeBadge.textContent = '';
      return;
    }
    const view = route.view || 'posts';
    const label = getLabel(view);
    let extra = '';
    if (view === 'tab' && route.title) extra = route.title;
    if (view === 'post' && route.title) extra = route.title;
    if (view === 'search' && route.q) extra = route.q;
    routeBadge.textContent = extra ? `${label}: ${extra}` : label;
    try {
      root.dataset.routeView = view;
    } catch (_) {}
  };

  const pulseMain = (payload) => {
    try {
      const el = payload && payload.element ? payload.element : document.getElementById('mainview');
      if (!el) return;
      el.classList.remove('aurora-pulse');
      void el.offsetWidth;
      el.classList.add('aurora-pulse');
      setTimeout(() => el.classList.remove('aurora-pulse'), 400);
    } catch (_) {}
  };

  return {
    onReady() {
      formatLang();
    },
    onSiteConfig() {
      formatLang();
    },
    onRouteChange(route) {
      formatRoute(route);
    },
    onContentRendered(payload) {
      pulseMain(payload);
      if (payload && payload.route) formatRoute(payload.route);
      else if (payload && payload.view) formatRoute({ view: payload.view });
      formatLang();
    }
  };
}
