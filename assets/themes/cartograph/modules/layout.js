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
            <span class="cartograph-brand__title" data-site-title>Press</span>
            <span class="cartograph-brand__subtitle" data-site-subtitle></span>
          </span>
        </a>
      </div>
      <nav class="cartograph-nav" data-theme-region="nav" aria-label="Primary navigation"></nav>
      <press-search class="cartograph-search" data-theme-region="search" render-root="shadow" field-class="cartograph-search__field" icon-class="cartograph-search__icon" icon="/" aria-label="Search"></press-search>
      <section class="cartograph-tools" data-theme-region="toolsPanel" aria-label="Site tools"></section>
    </header>
    <div class="cartograph-progress" aria-hidden="true"><span></span></div>
    <div class="cartograph-scroll" data-cartograph-scroll data-theme-region="scrollContainer">
      <div class="cartograph-board" data-theme-region="content">
        <aside class="cartograph-rail" data-theme-region="rail" aria-label="Site dossier">
          <section class="cartograph-rail__card cartograph-rail__card--identity">
            <div class="cartograph-rail__label">origin</div>
            <div class="cartograph-rail__title" data-site-title-rail>Press</div>
            <div class="cartograph-rail__subtitle" data-site-subtitle-rail></div>
          </section>
          <section class="cartograph-rail__card cartograph-rail__card--links">
            <div class="cartograph-rail__label">signals</div>
            <ul class="cartograph-linklist" data-site-links></ul>
          </section>
        </aside>
        <main class="cartograph-main" role="main">
          <section class="cartograph-mainview" data-theme-region="main" tabindex="-1"></section>
        </main>
        <aside class="cartograph-legend" data-theme-region="legend" aria-label="Route legend">
          <press-toc class="cartograph-toc" data-theme-region="toc" inner-class="cartograph-toc__inner" title-class="cartograph-toc__title" show-top="false" aria-label="Table of contents" hidden></press-toc>
          <section class="cartograph-panel cartograph-panel--route" data-theme-region="routeMap" data-cartograph-route-map hidden></section>
          <section class="cartograph-panel cartograph-panel--media" data-theme-region="mediaPanel" data-cartograph-media hidden></section>
          <section class="cartograph-panel cartograph-panel--links" data-theme-region="linksPanel" data-cartograph-links hidden></section>
          <section class="cartograph-panel cartograph-tagband" data-theme-region="tags" aria-label="Tag filters" hidden></section>
        </aside>
      </div>
    </div>
    <footer class="cartograph-footer" role="contentinfo">
      <div class="cartograph-footer__credit">Press</div>
      <nav class="cartograph-footer__nav" data-theme-region="footerNav" aria-label="Secondary navigation"></nav>
    </footer>`;

  const search = shell.querySelector('press-search');
  const findRegion = (name) => shell.querySelector(`[data-theme-region="${name}"]`);
  const regions = {
    container: shell,
    content: findRegion('content'),
    commandStrip: shell.querySelector('.cartograph-command'),
    footer: shell.querySelector('.cartograph-footer'),
    footerNav: findRegion('footerNav'),
    header: shell.querySelector('.cartograph-command'),
    legend: findRegion('legend'),
    main: findRegion('main'),
    nav: findRegion('nav'),
    navBox: findRegion('nav'),
    scrollContainer: findRegion('scrollContainer'),
    search,
    searchBox: search,
    sidebar: findRegion('legend'),
    tags: findRegion('tags'),
    tagBand: findRegion('tags'),
    toc: findRegion('toc'),
    toolsPanel: findRegion('toolsPanel'),
    utilities: findRegion('legend'),
    routeMap: findRegion('routeMap'),
    mediaPanel: findRegion('mediaPanel'),
    linksPanel: findRegion('linksPanel')
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
