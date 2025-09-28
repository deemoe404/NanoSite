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

    const avatar = doc.createElement('img');
    avatar.className = 'brand-avatar';
    avatar.alt = '';
    avatar.loading = 'lazy';
    avatar.decoding = 'async';
    avatar.classList.add('is-empty');
    brand.appendChild(avatar);

    const textWrap = doc.createElement('span');
    textWrap.className = 'brand-text';

    const brandTitle = doc.createElement('span');
    brandTitle.className = 'cupertino-brand-title';
    brandTitle.textContent = doc.title || 'NanoSite';
    textWrap.appendChild(brandTitle);

    const brandSubtitle = doc.createElement('span');
    brandSubtitle.className = 'cupertino-brand-subtitle';
    brandSubtitle.hidden = true;
    textWrap.appendChild(brandSubtitle);

    brand.appendChild(textWrap);
    topbar.appendChild(brand);
  } else {
    if (!brand.querySelector('.brand-avatar')) {
      const avatar = doc.createElement('img');
      avatar.className = 'brand-avatar';
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.decoding = 'async';
      avatar.classList.add('is-empty');
      brand.insertBefore(avatar, brand.firstChild);
    }
  }

  const titleEl = brand.querySelector('.cupertino-brand-title');
  const subtitleEl = brand.querySelector('.cupertino-brand-subtitle');
  if (titleEl && !titleEl.textContent.trim()) {
    titleEl.textContent = doc.title || 'NanoSite';
  }
  if (subtitleEl) {
    subtitleEl.hidden = !subtitleEl.textContent.trim();
  }

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
