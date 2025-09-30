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
        <div class="arcus-header__brand">
          <a class="arcus-brand" href="?tab=posts" data-site-home>
            <div class="arcus-brand__mark arcus-brand__mark--placeholder">
              <img class="arcus-brand__logo" data-site-logo alt="" loading="lazy" decoding="async" hidden />
            </div>
            <div class="arcus-brand__text">
              <div class="arcus-brand__title" data-site-title></div>
              <div class="arcus-brand__subtitle" data-site-subtitle></div>
            </div>
          </a>
          <section class="arcus-utility__links" aria-label="Profile links">
            <ul class="arcus-linklist" data-site-links></ul>
          </section>
        </div>
        <div class="arcus-header__divider" aria-hidden="true"></div>
        <div class="arcus-nav__scroller" data-overflow="none">
          <nav id="${NAV_ID}" class="arcus-nav" aria-label="Primary navigation"></nav>
        </div>
        <div class="arcus-utility__credit arcus-footer__credit arcus-header__credit" aria-label="Site credit"></div>
      </div>`;
    return el;
  });

  const headerInner = header.querySelector('.arcus-header__inner');
  const brandWrapper = headerInner.querySelector('.arcus-header__brand') || (() => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'arcus-header__brand';
    const brandLink = headerInner.querySelector('.arcus-brand');
    if (brandLink) {
      headerInner.insertBefore(wrapper, brandLink);
      wrapper.appendChild(brandLink);
    } else {
      headerInner.insertBefore(wrapper, headerInner.firstChild);
    }
    return wrapper;
  })();

  const brandLink = brandWrapper.querySelector('.arcus-brand') || headerInner.querySelector('.arcus-brand');
  if (brandLink && brandLink.parentElement !== brandWrapper) {
    brandWrapper.insertBefore(brandLink, brandWrapper.firstChild);
  }

  let profileLinks = brandWrapper.querySelector('.arcus-utility__links[aria-label="Profile links"]');
  if (!profileLinks) {
    profileLinks = headerInner.querySelector('.arcus-utility__links[aria-label="Profile links"]')
      || container.querySelector('.arcus-utility__links[aria-label="Profile links"]');
    if (profileLinks) {
      brandWrapper.appendChild(profileLinks);
    } else {
      profileLinks = doc.createElement('section');
      profileLinks.className = 'arcus-utility__links';
      profileLinks.setAttribute('aria-label', 'Profile links');
      profileLinks.innerHTML = '<ul class="arcus-linklist" data-site-links></ul>';
      brandWrapper.appendChild(profileLinks);
    }
  } else if (profileLinks.parentElement !== brandWrapper) {
    brandWrapper.appendChild(profileLinks);
  }

  let headerCredit = headerInner.querySelector('.arcus-utility__credit');

  if (!headerCredit) {
    const existingCredit = container.querySelector('.arcus-utility .arcus-utility__credit');
    if (existingCredit) {
      headerCredit = existingCredit;
      headerCredit.classList.add('arcus-header__credit');
      headerInner.appendChild(headerCredit);
    }
  } else {
    headerCredit.classList.add('arcus-header__credit');
  }

  if (!headerCredit) {
    headerCredit = doc.createElement('div');
    headerCredit.className = 'arcus-utility__credit arcus-footer__credit arcus-header__credit';
    headerCredit.setAttribute('aria-label', 'Site credit');
    headerInner.appendChild(headerCredit);
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

  ensureElement(container, '[data-arcus-backtotop]', () => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'arcus-backtotop';
    button.setAttribute('data-arcus-backtotop', '');
    button.setAttribute('aria-label', 'Back to top');
    button.setAttribute('title', 'Back to top');
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
    button.innerHTML = `
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
        <path d="M12 4.25a1 1 0 0 1 .78.36l6 7a1 1 0 1 1-1.56 1.28L13 7.72V19a1 1 0 1 1-2 0V7.72l-4.22 5.17a1 1 0 1 1-1.56-1.28l6-7a1 1 0 0 1 .78-.36Z" fill="currentColor" />
      </svg>`;
    return button;
  });

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
        <section class="arcus-utility__tools" aria-label="Quick tools">
          <div id="toolsPanel" class="arcus-tools"></div>
        </section>
      </div>`;
    return el;
  });

  const searchSection = ensureElement(rightColumn, '.arcus-utility__search', () => {
    const el = doc.createElement('section');
    el.className = 'arcus-utility__search';
    el.setAttribute('aria-label', 'Search');
    el.innerHTML = `
      <label class="arcus-search" for="searchInput">
        <span class="arcus-search__icon" aria-hidden="true">🔍</span>
        <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
      </label>`;
    return el;
  });

  if (!searchSection.querySelector('.arcus-search')) {
    searchSection.innerHTML = `
      <label class="arcus-search" for="searchInput">
        <span class="arcus-search__icon" aria-hidden="true">🔍</span>
        <input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search" />
      </label>`;
  }

  if (searchSection.parentElement !== rightColumn) {
    rightColumn.insertBefore(searchSection, rightColumn.firstElementChild);
  } else {
    const firstElement = rightColumn.firstElementChild;
    if (firstElement && firstElement !== searchSection) {
      rightColumn.insertBefore(searchSection, firstElement);
    }
  }

  let searchToggle = container.querySelector('.arcus-search-toggle');
  if (!searchToggle) {
    searchToggle = doc.createElement('button');
  }

  searchToggle.type = 'button';
  searchToggle.className = 'arcus-search-toggle';
  searchToggle.setAttribute('aria-expanded', searchToggle.getAttribute('aria-expanded') || 'false');
  searchToggle.setAttribute('aria-controls', 'searchInput');
  searchToggle.innerHTML = `
    <span class="arcus-search-toggle__icon" aria-hidden="true">🔍</span>
    <span class="arcus-search-toggle__label">Search</span>`;

  const searchToggleContainer = ensureElement(main, '.arcus-main__search-toggle', () => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'arcus-main__search-toggle';
    return wrapper;
  });

  if (!searchToggleContainer.contains(searchToggle)) {
    searchToggleContainer.appendChild(searchToggle);
  }

  if (searchToggleContainer.nextElementSibling !== mainview) {
    main.insertBefore(searchToggleContainer, mainview);
  }

  if (!searchSection.dataset.toggleBound) {
    searchSection.dataset.toggleBound = 'true';

    const getInput = () => searchSection.querySelector('input[type="search"]');
    const setOpen = (open) => {
      const isOpen = Boolean(open);
      searchSection.classList.toggle('is-open', isOpen);
      searchToggle.classList.toggle('is-active', isOpen);
      searchToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        const input = getInput();
        if (input) {
          input.focus({ preventScroll: true });
        }
      } else if (doc.activeElement && searchSection.contains(doc.activeElement)) {
        doc.activeElement.blur();
      }
    };

    searchToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const nextState = !searchSection.classList.contains('is-open');
      setOpen(nextState);
    });

    searchSection.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        searchToggle.focus({ preventScroll: true });
      }
    });

    searchSection.addEventListener('focusin', () => {
      setOpen(true);
    });

    doc.addEventListener('click', (event) => {
      if (!searchSection.classList.contains('is-open')) return;
      const target = event.target;
      if (searchSection.contains(target)) return;
      if (searchToggle.contains(target)) return;
      setOpen(false);
    });
  }

  const orphanCredit = utilities.querySelector('.arcus-utility__credit');
  if (orphanCredit && orphanCredit !== headerCredit) {
    orphanCredit.remove();
  }

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
