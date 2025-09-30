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
          <div class="arcus-brand__mark arcus-brand__mark--placeholder">
            <img class="arcus-brand__logo" data-site-logo alt="" loading="lazy" decoding="async" hidden />
          </div>
          <div class="arcus-brand__text">
            <div class="arcus-brand__title" data-site-title></div>
            <div class="arcus-brand__subtitle" data-site-subtitle></div>
          </div>
        </a>
        <div class="arcus-header__divider" aria-hidden="true"></div>
        <nav id="${NAV_ID}" class="arcus-nav" aria-label="Primary navigation"></nav>
      </div>`;
    return el;
  });

  const headerInner = header.querySelector('.arcus-header__inner') || header;
  let siteCredit = container.querySelector('.arcus-utility__credit.arcus-footer__credit');
  if (!siteCredit) {
    siteCredit = doc.createElement('div');
    siteCredit.className = 'arcus-utility__credit arcus-footer__credit';
    siteCredit.setAttribute('aria-label', 'Site credit');
  }
  siteCredit.classList.add('arcus-header__credit');
  if (siteCredit.parentElement !== headerInner) {
    headerInner.appendChild(siteCredit);
  } else if (siteCredit.nextElementSibling) {
    headerInner.appendChild(siteCredit);
  }

  const rightColumn = ensureElement(container, '.arcus-rightcol', () => {
    const el = doc.createElement('div');
    el.className = 'arcus-rightcol';
    el.setAttribute('data-arcus-scroll', 'content');
    return el;
  });

  if (rightColumn.parentElement !== container) {
    container.appendChild(rightColumn);
  }

  let main = rightColumn.querySelector('.arcus-main');
  if (!main) {
    const existingMain = container.querySelector('.arcus-main');
    if (existingMain) {
      main = existingMain;
    } else {
      main = doc.createElement('main');
      main.className = 'arcus-main';
      main.setAttribute('role', 'main');
    }
    rightColumn.insertBefore(main, rightColumn.firstChild);
  }

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

  let tagBand = rightColumn.querySelector(`#${TAGVIEW_ID}`);
  if (!tagBand) {
    tagBand = container.querySelector(`#${TAGVIEW_ID}`) || doc.createElement('section');
    tagBand.id = TAGVIEW_ID;
    if (!tagBand.parentElement || tagBand.parentElement !== rightColumn) {
      rightColumn.appendChild(tagBand);
    }
  }
  tagBand.className = 'arcus-tagband';
  tagBand.setAttribute('aria-label', 'Tag filters');

  let footer = rightColumn.querySelector('.arcus-footer');
  if (!footer) {
    footer = container.querySelector('.arcus-footer') || doc.createElement('footer');
    footer.className = 'arcus-footer';
    footer.setAttribute('role', 'contentinfo');
    if (!footer.querySelector(`#${FOOTER_NAV_ID}`)) {
      footer.innerHTML = `
        <div class="arcus-footer__inner">
          <nav class="arcus-footer__nav" aria-label="Secondary navigation">
            <div id="${FOOTER_NAV_ID}" class="arcus-footer-nav"></div>
          </nav>
        </div>`;
    }
    rightColumn.appendChild(footer);
  }

  if (main.nextElementSibling !== tagBand) {
    rightColumn.insertBefore(tagBand, footer);
  }

  const utilities = ensureElement(rightColumn, '.arcus-utility', () => {
    const el = doc.createElement('section');
    el.className = 'arcus-utility';
    el.setAttribute('aria-label', 'Site utilities');
    el.innerHTML = `
      <div class="arcus-utility__inner">
        <section class="arcus-utility__search" aria-label="Search">
          <label class="arcus-search" for="searchInput">
            <span class="arcus-search__icon" aria-hidden="true">🔍</span>
            <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
          </label>
        </section>
        <section class="arcus-utility__tools" aria-label="Quick tools">
          <div id="toolsPanel" class="arcus-tools"></div>
        </section>
        <section class="arcus-utility__links" aria-label="Profile links">
          <ul class="arcus-linklist" data-site-links></ul>
        </section>
      </div>`;
    return el;
  });

  if (utilities.parentElement !== rightColumn) {
    rightColumn.insertBefore(utilities, footer);
  } else if (utilities.nextElementSibling !== footer) {
    rightColumn.insertBefore(utilities, footer);
  }

  if (footer.parentElement !== rightColumn) {
    rightColumn.appendChild(footer);
  } else if (footer.nextElementSibling) {
    rightColumn.appendChild(footer);
  }

  context.document = doc;
  context.regions = {
    container,
    header,
    rightColumn,
    main,
    content: main,
    mainview,
    toc: tocview,
    footer,
    utilities,
    footerNav: footer.querySelector(`#${FOOTER_NAV_ID}`),
    tagBand,
    toolsPanel: utilities.querySelector('#toolsPanel'),
    scrollContainer: rightColumn
  };

  return context;
}
