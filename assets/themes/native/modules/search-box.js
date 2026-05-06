export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let searchBox = sidebar.querySelector('[data-theme-region="search"]') || sidebar.querySelector('.native-searchbox');
  if (!searchBox) {
    searchBox = doc.createElement('press-search');
    searchBox.className = 'box native-searchbox';
    searchBox.id = 'searchbox';
    searchBox.setAttribute('data-theme-region', 'search');
    sidebar.appendChild(searchBox);
  } else if (!searchBox.classList.contains('box')) {
    searchBox.classList.add('box');
  }
  searchBox.classList.add('native-searchbox');
  searchBox.setAttribute('data-theme-region', 'search');

  const input = searchBox.input || searchBox.querySelector('input[type="search"]');
  if (typeof regions.register === 'function') {
    regions.register('search', searchBox);
    regions.register('searchBox', searchBox);
  } else {
    regions.search = searchBox;
    regions.searchBox = searchBox;
  }
  context.regions = regions;
  return { regions };
}
