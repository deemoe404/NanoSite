export function setupSearch(entries){
  const input = document.getElementById('searchInput');
  if (!input) return;
  // Preserve existing value if arriving from search tab
  // On Enter, navigate to global search view
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
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
  };
}
