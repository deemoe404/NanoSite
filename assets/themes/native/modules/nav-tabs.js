export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.content');
  if (!doc || !content) return context;

  let navBox = doc.getElementById('mapview');
  if (!navBox) {
    navBox = doc.createElement('div');
    navBox.className = 'box flex-split';
    navBox.id = 'mapview';
    content.appendChild(navBox);
  }

  let nav = doc.getElementById('tabsNav');
  if (!nav) {
    nav = doc.createElement('nav');
    nav.className = 'tabs';
    nav.id = 'tabsNav';
    nav.setAttribute('aria-label', 'Sections');
    navBox.appendChild(nav);
  }

  const updatedRegions = { ...regions, navBox, tabsNav: nav };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
