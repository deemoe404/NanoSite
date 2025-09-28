export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.cupertino-sidebar');
  if (!doc || !sidebar) return context;

  let toc = sidebar.querySelector('#tocview');
  if (!toc) {
    toc = doc.createElement('div');
    toc.id = 'tocview';
    toc.className = 'cupertino-panel glass-panel toc-panel';
    sidebar.appendChild(toc);
  } else {
    toc.classList.add('cupertino-panel', 'glass-panel', 'toc-panel');
  }

  context.regions = { ...regions, tocBox: toc };
  return { regions: { ...regions, tocBox: toc } };
}
