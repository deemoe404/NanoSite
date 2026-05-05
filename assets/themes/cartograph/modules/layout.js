const NAV_ID = 'tabsNav';
const MAINVIEW_ID = 'mainview';
const TOCVIEW_ID = 'tocview';
const TAGVIEW_ID = 'tagview';
const FOOTER_NAV_ID = 'footerNav';
const SEARCH_ID = 'searchInput';

function getOrCreateShell(doc) {
  let shell = doc.querySelector('[data-theme-root="container"]');
  if (!shell) {
    shell = doc.createElement('div');
    shell.setAttribute('data-theme-root', 'container');
    doc.body.insertBefore(shell, doc.body.firstChild || null);
  }
  return shell;
}

function registerRegions(context, regions) {
  if (context.regions && typeof context.regions.registerMany === 'function') {
    context.regions.registerMany(regions);
    return context.regions;
  }
  context.regions = { ...(context.regions || {}), ...regions };
  return context.regions;
}

export function mount(context = {}) {
  const doc = context.document || document;
  if (!doc || !doc.body) return context;

  const shell = getOrCreateShell(doc);
  shell.className = 'cartograph-shell';
  shell.innerHTML = `
    <header class="cartograph-command" role="banner">
      <div class="cartograph-command__brand">
        <a class="cartograph-brand" href="?tab=posts" data-site-home>
          <span class="cartograph-brand__mark cartograph-brand__mark--empty" aria-hidden="true">
            <img class="cartograph-brand__logo" data-site-logo alt="" loading="lazy" decoding="async" hidden />
          </span>
          <span class="cartograph-brand__copy">
            <span class="cartograph-brand__title" data-site-title>NanoSite</span>
            <span class="cartograph-brand__subtitle" data-site-subtitle></span>
          </span>
        </a>
      </div>
      <nav id="${NAV_ID}" class="cartograph-nav" aria-label="Primary navigation"></nav>
      <nano-search class="cartograph-search" id="searchBox" render-root="shadow" field-class="cartograph-search__field" icon-class="cartograph-search__icon" icon="/" aria-label="Search"></nano-search>
      <input id="${SEARCH_ID}" class="cartograph-search__legacy" type="search" tabindex="-1" aria-hidden="true" hidden />
      <section id="toolsPanel" class="cartograph-tools" aria-label="Site tools"></section>
    </header>
    <div class="cartograph-progress" aria-hidden="true"><span></span></div>
    <div class="cartograph-scroll" data-cartograph-scroll>
      <div class="cartograph-board">
        <aside class="cartograph-rail" aria-label="Site dossier">
          <section class="cartograph-rail__card cartograph-rail__card--identity">
            <div class="cartograph-rail__label">origin</div>
            <div class="cartograph-rail__title" data-site-title-rail>NanoSite</div>
            <div class="cartograph-rail__subtitle" data-site-subtitle-rail></div>
          </section>
          <section class="cartograph-rail__card cartograph-rail__card--links">
            <div class="cartograph-rail__label">signals</div>
            <ul class="cartograph-linklist" data-site-links></ul>
          </section>
        </aside>
        <main class="cartograph-main" role="main">
          <section id="${MAINVIEW_ID}" class="cartograph-mainview" tabindex="-1"></section>
        </main>
        <aside class="cartograph-legend" aria-label="Route legend">
          <nano-toc id="${TOCVIEW_ID}" class="cartograph-toc" inner-class="cartograph-toc__inner" title-class="cartograph-toc__title" show-top="false" aria-label="Table of contents" hidden></nano-toc>
          <section class="cartograph-panel cartograph-panel--media" data-cartograph-media hidden></section>
          <section class="cartograph-panel cartograph-panel--links" data-cartograph-links hidden></section>
          <section id="${TAGVIEW_ID}" class="cartograph-panel cartograph-tagband" aria-label="Tag filters" hidden></section>
        </aside>
      </div>
    </div>
    <footer class="cartograph-footer" role="contentinfo">
      <div class="cartograph-footer__credit">NanoSite</div>
      <nav id="${FOOTER_NAV_ID}" class="cartograph-footer__nav" aria-label="Secondary navigation"></nav>
    </footer>`;

  const search = shell.querySelector('nano-search');
  const regions = {
    container: shell,
    content: shell.querySelector('.cartograph-board'),
    commandStrip: shell.querySelector('.cartograph-command'),
    footer: shell.querySelector('.cartograph-footer'),
    footerNav: shell.querySelector(`#${FOOTER_NAV_ID}`),
    header: shell.querySelector('.cartograph-command'),
    legend: shell.querySelector('.cartograph-legend'),
    main: shell.querySelector(`#${MAINVIEW_ID}`),
    mainview: shell.querySelector(`#${MAINVIEW_ID}`),
    nav: shell.querySelector(`#${NAV_ID}`),
    navBox: shell.querySelector(`#${NAV_ID}`),
    scrollContainer: shell.querySelector('.cartograph-scroll'),
    search,
    searchBox: search,
    searchInput: (search && search.input) || shell.querySelector(`#${SEARCH_ID}`),
    sidebar: shell.querySelector('.cartograph-legend'),
    tags: shell.querySelector(`#${TAGVIEW_ID}`),
    tagBand: shell.querySelector(`#${TAGVIEW_ID}`),
    toc: shell.querySelector(`#${TOCVIEW_ID}`),
    tocview: shell.querySelector(`#${TOCVIEW_ID}`),
    toolsPanel: shell.querySelector('#toolsPanel'),
    utilities: shell.querySelector('.cartograph-legend')
  };

  context.document = doc;
  registerRegions(context, regions);
  return { regions };
}

export default {
  mount,
  unmount() {},
  regions: {},
  views: {},
  components: {},
  effects: {}
};
