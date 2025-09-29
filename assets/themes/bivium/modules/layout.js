const NAV_ID = 'tabsNav';
const MAINVIEW_ID = 'mainview';
const TOCVIEW_ID = 'tocview';
const FOOTER_NAV_ID = 'footerNav';
const TAGVIEW_ID = 'tagview';

function ensureElement(parent, selector, creator) {
  const existing = parent.querySelector(selector);
  if (existing) return existing;
  const el = creator();
  parent.appendChild(el);
  return el;
}

export function mount(context = {}) {
  const doc = context.document || document;
  if (!doc || !doc.body) return context;

  let container = doc.querySelector('[data-theme-root="container"]');
  if (!container) {
    container = doc.createElement('div');
    container.setAttribute('data-theme-root', 'container');
    doc.body.insertBefore(container, doc.body.firstChild);
  }
  container.className = 'bivium-shell';

  const sidebar = ensureElement(container, '.bivium-sidebar', () => {
    const el = doc.createElement('aside');
    el.className = 'bivium-sidebar';
    el.setAttribute('role', 'complementary');
    el.innerHTML = `
      <div class="bivium-sidebar__inner">
        <a class="bivium-brand" href="?tab=posts" data-site-home>
          <div class="bivium-brand__emblem" aria-hidden="true"></div>
          <div class="bivium-brand__text">
            <div class="bivium-brand__title" data-site-title></div>
            <div class="bivium-brand__subtitle" data-site-subtitle></div>
          </div>
        </a>
        <div class="bivium-sidebar__info">
          <ul class="bivium-links" data-site-links></ul>
        </div>
        <nav id="${NAV_ID}" class="bivium-nav" aria-label="Primary navigation"></nav>
        <div id="toolsPanel" class="bivium-sidebar__tools" aria-label="Quick controls"></div>
      </div>`;
    return el;
  });

  const body = ensureElement(container, '.bivium-body', () => {
    const el = doc.createElement('div');
    el.className = 'bivium-body';
    return el;
  });

  const bodyInner = ensureElement(body, '.bivium-body__inner', () => {
    const el = doc.createElement('div');
    el.className = 'bivium-body__inner';
    return el;
  });

  const mainPanel = ensureElement(bodyInner, '.bivium-mainpanel', () => {
    const el = doc.createElement('div');
    el.className = 'bivium-mainpanel';
    el.innerHTML = `
      <header class="bivium-toolbar" aria-label="Site toolbar">
        <label class="bivium-search" for="searchInput">
          <span class="bivium-search__icon" aria-hidden="true">🔍</span>
          <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
        </label>
      </header>`;
    return el;
  });

  const mainview = ensureElement(mainPanel, `#${MAINVIEW_ID}`, () => {
    const el = doc.createElement('section');
    el.id = MAINVIEW_ID;
    el.className = 'bivium-mainview';
    el.setAttribute('tabindex', '-1');
    el.setAttribute('role', 'main');
    return el;
  });

  let tagBand = doc.getElementById(TAGVIEW_ID);
  if (!tagBand) {
    tagBand = doc.createElement('section');
    tagBand.id = TAGVIEW_ID;
  }
  tagBand.className = 'bivium-tagpanel';
  tagBand.setAttribute('aria-label', 'Tag filters');
  if (tagBand.parentElement !== mainPanel) {
    mainPanel.appendChild(tagBand);
  }

  const tocview = ensureElement(bodyInner, `#${TOCVIEW_ID}`, () => {
    const el = doc.createElement('aside');
    el.id = TOCVIEW_ID;
    el.className = 'bivium-toc';
    el.setAttribute('aria-label', 'Table of contents');
    el.hidden = true;
    return el;
  });

  const footer = ensureElement(body, '.bivium-footer', () => {
    const el = doc.createElement('footer');
    el.className = 'bivium-footer';
    el.setAttribute('role', 'contentinfo');
    el.innerHTML = `
      <div class="bivium-footer__inner">
        <div class="bivium-footer__nav" aria-label="Secondary navigation">
          <div id="${FOOTER_NAV_ID}" class="bivium-footernav"></div>
        </div>
        <div class="bivium-footer__meta">
          <div class="bivium-footer__credit">NanoSite</div>
        </div>
      </div>`;
    return el;
  });

  context.document = doc;
  context.regions = {
    container,
    sidebar,
    main: mainPanel,
    content: mainPanel,
    mainview,
    toc: tocview,
    footer,
    footerNav: footer.querySelector(`#${FOOTER_NAV_ID}`),
    tagBand,
    toolsPanel: sidebar.querySelector('#toolsPanel')
  };

  return context;
}
