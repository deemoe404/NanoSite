const LEGACY_SEARCH_BOUND = Symbol('nanoLegacySearchBound');
let componentSearchBound = false;

export function navigateSearch(query) {
  const q = String(query || '').trim();
  const url = new URL(window.location.href);
  if (q) {
    url.searchParams.set('tab', 'search');
    url.searchParams.set('q', q);
    url.searchParams.delete('tag');
    url.searchParams.delete('id');
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('tab', 'posts');
    url.searchParams.delete('q');
    url.searchParams.delete('tag');
    url.searchParams.delete('id');
    url.searchParams.delete('page');
  }
  history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function bindSearchEvents(root = document) {
  if (!componentSearchBound && root && typeof root.addEventListener === 'function') {
    root.addEventListener('nano:search', (event) => {
      const detail = event && event.detail ? event.detail : {};
      navigateSearch(detail.query || '');
    });
    componentSearchBound = true;
  }
}

export function setupSearch() {
  bindSearchEvents(document);

  const input = document.getElementById('searchInput');
  if (!input || input.closest('nano-search') || input[LEGACY_SEARCH_BOUND]) return;
  input[LEGACY_SEARCH_BOUND] = true;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') navigateSearch(input.value);
  });
}
