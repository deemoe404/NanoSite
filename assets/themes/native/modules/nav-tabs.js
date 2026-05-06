export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.content');
  if (!doc || !content) return context;

  let navBox = content.querySelector('[data-theme-region="navBox"]') || content.querySelector('.native-navbox');
  if (!navBox) {
    navBox = doc.createElement('div');
    navBox.className = 'box flex-split native-navbox';
    navBox.setAttribute('data-theme-region', 'navBox');
    content.appendChild(navBox);
  }
  navBox.classList.add('native-navbox');
  navBox.setAttribute('data-theme-region', 'navBox');

  let nav = navBox.querySelector('[data-theme-region="nav"]') || navBox.querySelector('.native-tabs');
  if (!nav) {
    nav = doc.createElement('nav');
    nav.className = 'tabs native-tabs';
    nav.setAttribute('data-theme-region', 'nav');
    nav.setAttribute('aria-label', 'Sections');
    navBox.appendChild(nav);
  }
  nav.classList.add('native-tabs');
  nav.setAttribute('data-theme-region', 'nav');

  if (typeof regions.register === 'function') {
    regions.register('nav', nav);
    regions.register('navBox', navBox);
  } else {
    regions.nav = nav;
    regions.navBox = navBox;
  }
  context.regions = regions;
  return { regions };
}
