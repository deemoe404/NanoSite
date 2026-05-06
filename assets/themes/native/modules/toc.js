export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let toc = sidebar.querySelector('[data-theme-region="toc"]') || sidebar.querySelector('.native-toc');
  if (!toc) {
    toc = doc.createElement('press-toc');
    toc.className = 'box native-toc';
    toc.setAttribute('data-theme-region', 'toc');
    sidebar.appendChild(toc);
  } else if (!toc.classList.contains('box')) {
    toc.classList.add('box');
  }
  toc.classList.add('native-toc');
  toc.setAttribute('data-theme-region', 'toc');

  if (typeof regions.register === 'function') {
    regions.register('toc', toc);
    regions.register('tocBox', toc);
  } else {
    regions.toc = toc;
    regions.tocBox = toc;
  }
  context.regions = regions;
  return { regions };
}
