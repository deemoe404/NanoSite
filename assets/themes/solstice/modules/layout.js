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
        <nav id="${NAV_ID}" class="solstice-nav" data-theme-region="nav" aria-label="Primary navigation"></nav>
      </div>`;
    return el;
  });

  const main = ensureElement(container, '.solstice-main', () => {
    const el = doc.createElement('main');
    el.className = 'solstice-main';
    el.setAttribute('role', 'main');
    return el;
  });

  const mainview = ensureElement(main, '[data-theme-region="main"], .solstice-mainview', () => {
    const el = doc.createElement('section');
    el.id = MAINVIEW_ID;
    el.className = 'solstice-mainview';
    el.setAttribute('data-theme-region', 'main');
    el.setAttribute('tabindex', '-1');
    return el;
  });
  mainview.setAttribute('data-theme-region', 'main');

  const tocview = ensureElement(main, '[data-theme-region="toc"], .solstice-toc', () => {
    const el = doc.createElement('nano-toc');
    el.id = TOCVIEW_ID;
    el.className = 'solstice-toc';
    el.setAttribute('data-theme-region', 'toc');
    el.setAttribute('aria-label', 'Table of contents');
    el.hidden = true;
    return el;
  });
  tocview.setAttribute('data-theme-region', 'toc');
  if (tocview.tagName && tocview.tagName.toLowerCase() === 'nano-toc') {
    tocview.setAttribute('inner-class', 'solstice-toc__inner');
    tocview.setAttribute('title-class', 'solstice-toc__title');
    tocview.setAttribute('show-top', 'false');
  }

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
          <nano-search class="solstice-footer__search" field-class="solstice-search" icon-class="solstice-search__icon" icon="&#128269;" aria-label="Search"></nano-search>
        </section>
      </div>`;
    return el;
  });
  const footerSearch = footer.querySelector('nano-search');
  if (footerSearch) {
    footerSearch.setAttribute('field-class', 'solstice-search');
    footerSearch.setAttribute('icon-class', 'solstice-search__icon');
    footerSearch.setAttribute('icon', '\uD83D\uDD0D');
    footerSearch.removeAttribute('variant');
  }

  let tagBand = container.querySelector('[data-theme-region="tags"], .solstice-tagband');
  if (!tagBand) {
    tagBand = doc.createElement('section');
    tagBand.id = TAGVIEW_ID;
  }

  tagBand.className = 'solstice-tagband solstice-footer__tagband';
  tagBand.setAttribute('data-theme-region', 'tags');
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
    nav: header.querySelector('[data-theme-region="nav"], .solstice-nav'),
    search: footerSearch,
    searchInput: footerSearch?.input || footer.querySelector('input[type="search"]'),
    toc: tocview,
    footer,
    footerNav: footer.querySelector(`#${FOOTER_NAV_ID}`),
    tags: tagBand,
    tagBand,
    toolsPanel: footer.querySelector('#toolsPanel')
  };

  return context;
}
