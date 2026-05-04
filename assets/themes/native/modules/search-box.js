export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let searchBox = doc.getElementById('searchbox');
  if (!searchBox) {
    searchBox = doc.createElement('nano-search');
    searchBox.className = 'box';
    searchBox.id = 'searchbox';
    searchBox.setAttribute('variant', 'native');
    sidebar.appendChild(searchBox);
  } else if (!searchBox.classList.contains('box')) {
    searchBox.classList.add('box');
  }
  if (searchBox.tagName && searchBox.tagName.toLowerCase() === 'nano-search') {
    searchBox.setAttribute('variant', 'native');
  }

  const updatedRegions = { ...regions, searchBox, searchInput: searchBox.input || searchBox.querySelector('input[type="search"]') };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
