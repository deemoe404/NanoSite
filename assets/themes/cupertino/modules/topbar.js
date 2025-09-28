function syncBrand(doc, titleEl, subtitleEl) {
  const apply = () => {
    const cardTitle = doc.querySelector('.site-card .site-title');
    const cardSubtitle = doc.querySelector('.site-card .site-subtitle');
    if (cardTitle && titleEl) {
      const text = cardTitle.textContent.trim();
      if (text) titleEl.textContent = text;
    }
    if (cardSubtitle && subtitleEl) {
      const text = cardSubtitle.textContent.trim();
      subtitleEl.textContent = text;
      subtitleEl.hidden = !text;
    }
  };

  const attachObservers = () => {
    const titleTarget = doc.querySelector('.site-card .site-title');
    const subtitleTarget = doc.querySelector('.site-card .site-subtitle');
    if (titleTarget) {
      const obs = new MutationObserver(apply);
      obs.observe(titleTarget, { childList: true, subtree: true, characterData: true });
      apply();
    }
    if (subtitleTarget) {
      const obs = new MutationObserver(apply);
      obs.observe(subtitleTarget, { childList: true, subtree: true, characterData: true });
      apply();
    }
  };

  if (!doc || !titleEl) return;
  apply();
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => attachObservers(), { once: true });
  } else {
    attachObservers();
  }

  if (!doc.querySelector('.site-card .site-title')) {
    const waitForCard = new MutationObserver((mutations, observer) => {
      if (doc.querySelector('.site-card .site-title')) {
        observer.disconnect();
        attachObservers();
      }
    });
    waitForCard.observe(doc.body, { childList: true, subtree: true });
  }
}

export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const header = regions.header || doc.querySelector('.cupertino-header');
  if (!doc || !header) return context;

  let topbar = header.querySelector('.cupertino-topbar');
  if (!topbar) {
    topbar = doc.createElement('div');
    topbar.className = 'cupertino-topbar';
    header.appendChild(topbar);
  }

  let brand = topbar.querySelector('.cupertino-brand');
  if (!brand) {
    brand = doc.createElement('a');
    brand.className = 'cupertino-brand';
    brand.href = './';
    brand.setAttribute('aria-label', 'Home');

    const badge = doc.createElement('span');
    badge.className = 'brand-badge';
    badge.setAttribute('aria-hidden', 'true');
    brand.appendChild(badge);

    const textWrap = doc.createElement('span');
    textWrap.className = 'brand-text';

    const brandTitle = doc.createElement('span');
    brandTitle.className = 'cupertino-brand-title';
    brandTitle.textContent = doc.title || 'NanoSite';
    textWrap.appendChild(brandTitle);

    const brandSubtitle = doc.createElement('span');
    brandSubtitle.className = 'cupertino-brand-subtitle';
    textWrap.appendChild(brandSubtitle);

    brand.appendChild(textWrap);
    topbar.appendChild(brand);
  }

  const titleEl = brand.querySelector('.cupertino-brand-title');
  const subtitleEl = brand.querySelector('.cupertino-brand-subtitle');
  if (titleEl && !titleEl.textContent.trim()) {
    titleEl.textContent = doc.title || 'NanoSite';
  }

  syncBrand(doc, titleEl, subtitleEl);

  let navBox = topbar.querySelector('#mapview');
  if (!navBox) {
    navBox = doc.createElement('div');
    navBox.id = 'mapview';
    navBox.className = 'cupertino-navbox';
    topbar.appendChild(navBox);
  }

  let nav = navBox.querySelector('#tabsNav');
  if (!nav) {
    nav = doc.createElement('nav');
    nav.id = 'tabsNav';
    nav.className = 'cupertino-tabs';
    nav.setAttribute('aria-label', 'Sections');
    navBox.appendChild(nav);
  }

  let searchBox = topbar.querySelector('#searchbox');
  if (!searchBox) {
    searchBox = doc.createElement('div');
    searchBox.id = 'searchbox';
    searchBox.className = 'cupertino-search';
    topbar.appendChild(searchBox);
  }

  let searchInput = searchBox.querySelector('#searchInput');
  if (!searchInput) {
    searchInput = doc.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'searchInput';
    searchInput.placeholder = 'Search';
    searchInput.setAttribute('aria-label', 'Search site');
    searchBox.appendChild(searchInput);
  }

  const updatedRegions = {
    ...regions,
    header,
    navBox,
    tabsNav: nav,
    searchBox,
    searchInput
  };

  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
