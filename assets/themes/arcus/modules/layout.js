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
  container.className = 'arcus-shell';

  const header = ensureElement(container, '.arcus-header', () => {
    const el = doc.createElement('header');
    el.className = 'arcus-header';
    el.setAttribute('role', 'banner');
    el.innerHTML = `
      <div class="arcus-header__inner">
        <a class="arcus-brand" href="?tab=posts" data-site-home>
          <div class="arcus-brand__mark" aria-hidden="true"></div>
          <div class="arcus-brand__text">
            <div class="arcus-brand__title" data-site-title></div>
            <div class="arcus-brand__subtitle" data-site-subtitle></div>
          </div>
        </a>
        <div class="arcus-header__divider" aria-hidden="true"></div>
        <nav id="${NAV_ID}" class="arcus-nav" aria-label="Primary navigation"></nav>
        <section class="arcus-header__search" aria-label="Search">
          <label class="arcus-search" for="searchInput">
            <span class="arcus-search__icon" aria-hidden="true">🔍</span>
            <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
          </label>
        </section>
        <section class="arcus-header__tools" aria-label="Quick tools">
          <div id="toolsPanel" class="arcus-tools"></div>
        </section>
        <section class="arcus-header__links" aria-label="Profile links">
          <ul class="arcus-linklist" data-site-links></ul>
        </section>
        <div class="arcus-header__credit arcus-footer__credit" aria-label="Site credit"></div>
      </div>`;
    return el;
  });

  const main = ensureElement(container, '.arcus-main', () => {
    const el = doc.createElement('main');
    el.className = 'arcus-main';
    el.setAttribute('role', 'main');
    return el;
  });

  const mainview = ensureElement(main, `#${MAINVIEW_ID}`, () => {
    const el = doc.createElement('section');
    el.id = MAINVIEW_ID;
    el.className = 'arcus-mainview';
    el.setAttribute('tabindex', '-1');
    return el;
  });

  const tocview = ensureElement(main, `#${TOCVIEW_ID}`, () => {
    const el = doc.createElement('aside');
    el.id = TOCVIEW_ID;
    el.className = 'arcus-toc';
    el.setAttribute('aria-label', 'Table of contents');
    el.hidden = true;
    return el;
  });

  const tagBand = ensureElement(container, `#${TAGVIEW_ID}`, () => {
    const el = doc.createElement('section');
    el.id = TAGVIEW_ID;
    return el;
  });
  tagBand.className = 'arcus-tagband';
  tagBand.setAttribute('aria-label', 'Tag filters');

  const footer = ensureElement(container, '.arcus-footer', () => {
    const el = doc.createElement('footer');
    el.className = 'arcus-footer';
    el.setAttribute('role', 'contentinfo');
    el.innerHTML = `
      <div class="arcus-footer__inner">
        <nav class="arcus-footer__nav" aria-label="Secondary navigation">
          <div id="${FOOTER_NAV_ID}" class="arcus-footer-nav"></div>
        </nav>
      </div>`;
    return el;
  });

  if (tagBand.parentElement !== container || tagBand.nextElementSibling !== footer) {
    container.insertBefore(tagBand, footer);
  }

  context.document = doc;
  context.regions = {
    container,
    header,
    main,
    content: main,
    mainview,
    toc: tocview,
    footer,
    footerNav: footer.querySelector(`#${FOOTER_NAV_ID}`),
    tagBand,
    toolsPanel: header.querySelector('#toolsPanel')
  };

  return context;
}
