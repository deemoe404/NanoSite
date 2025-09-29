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
  container.className = 'solstice-shell';

  const header = ensureElement(container, '.solstice-header', () => {
    const el = doc.createElement('header');
    el.className = 'solstice-header';
    el.setAttribute('role', 'banner');
    el.innerHTML = `
      <div class="solstice-header__inner">
        <a class="solstice-brand" href="?tab=posts" data-site-home>
          <div class="solstice-brand__title" data-site-title></div>
          <div class="solstice-brand__subtitle" data-site-subtitle></div>
        </a>
        <nav id="${NAV_ID}" class="solstice-nav" aria-label="Primary navigation"></nav>
      </div>`;
    return el;
  });

  const main = ensureElement(container, '.solstice-main', () => {
    const el = doc.createElement('main');
    el.className = 'solstice-main';
    el.setAttribute('role', 'main');
    return el;
  });

  const mainview = ensureElement(main, `#${MAINVIEW_ID}`, () => {
    const el = doc.createElement('section');
    el.id = MAINVIEW_ID;
    el.className = 'solstice-mainview';
    el.setAttribute('tabindex', '-1');
    return el;
  });

  const tocview = ensureElement(main, `#${TOCVIEW_ID}`, () => {
    const el = doc.createElement('aside');
    el.id = TOCVIEW_ID;
    el.className = 'solstice-toc';
    el.setAttribute('aria-label', 'Table of contents');
    el.hidden = true;
    return el;
  });

  const footer = ensureElement(container, '.solstice-footer', () => {
    const el = doc.createElement('footer');
    el.className = 'solstice-footer';
    el.setAttribute('role', 'contentinfo');
    el.innerHTML = `
      <div class="solstice-footer__inner">
        <div class="solstice-footer__columns">
          <div class="solstice-footer__column solstice-footer__column--tools" data-footer-column="tools">
            <section class="solstice-footer__tools" id="toolsPanel" aria-label="Quick tools"></section>
          </div>
          <div class="solstice-footer__column solstice-footer__column--nav" data-footer-column="nav">
            <section class="solstice-footer__nav" aria-label="Secondary navigation">
              <div id="${FOOTER_NAV_ID}" class="solstice-footer-nav"></div>
            </section>
          </div>
          <div class="solstice-footer__column solstice-footer__column--links" data-footer-column="links">
            <section class="solstice-footer__links" aria-label="Profile links">
              <ul class="solstice-linklist" data-site-links></ul>
            </section>
          </div>
        </div>
        <section class="solstice-footer__meta" aria-label="Site meta">
          <div class="solstice-footer__credit">NanoSite</div>
          <section class="solstice-footer__search" aria-label="Search">
            <label class="solstice-search" for="searchInput">
              <span class="solstice-search__icon" aria-hidden="true">🔍</span>
              <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
            </label>
          </section>
        </section>
      </div>`;
    return el;
  });

  let tagBand = doc.getElementById(TAGVIEW_ID);
  if (!tagBand) {
    tagBand = doc.createElement('section');
    tagBand.id = TAGVIEW_ID;
  }

  tagBand.className = 'solstice-tagband solstice-footer__tagband';
  tagBand.setAttribute('aria-label', 'Tag filters');

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
    toolsPanel: footer.querySelector('#toolsPanel')
  };

  return context;
}
