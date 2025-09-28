export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const stageAside = regions.stageAside || doc.querySelector('.cupertino-stage-aside');
  const sidebar = regions.sidebar || doc.querySelector('.cupertino-sidebar');
  const host = stageAside || sidebar;
  if (!doc || !host) return context;

  let toc = host.querySelector('#tocview');
  if (!toc) {
    toc = doc.createElement('div');
    toc.id = 'tocview';
    toc.className = 'cupertino-panel glass-panel toc-panel';
    host.appendChild(toc);
  } else {
    toc.classList.add('cupertino-panel', 'glass-panel', 'toc-panel');
  }

  context.regions = { ...regions, tocBox: toc };
  return { regions: { ...regions, tocBox: toc } };
}
