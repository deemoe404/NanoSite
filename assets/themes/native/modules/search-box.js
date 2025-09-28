export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let searchBox = doc.getElementById('searchbox');
  if (!searchBox) {
    searchBox = doc.createElement('div');
    searchBox.className = 'box';
    searchBox.id = 'searchbox';
    sidebar.appendChild(searchBox);
  } else if (!searchBox.classList.contains('box')) {
    searchBox.classList.add('box');
  }

  let input = doc.getElementById('searchInput');
  if (!input) {
    input = doc.createElement('input');
    input.type = 'search';
    input.id = 'searchInput';
    searchBox.appendChild(input);
  }

  const updatedRegions = { ...regions, searchBox, searchInput: input };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
