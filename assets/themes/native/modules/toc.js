export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let toc = doc.getElementById('tocview');
  if (!toc) {
    toc = doc.createElement('div');
    toc.className = 'box';
    toc.id = 'tocview';
    sidebar.appendChild(toc);
  } else if (!toc.classList.contains('box')) {
    toc.classList.add('box');
  }

  const updatedRegions = { ...regions, tocBox: toc };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
