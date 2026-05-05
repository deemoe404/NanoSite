export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let toc = doc.getElementById('tocview');
  if (!toc) {
    toc = doc.createElement('nano-toc');
    toc.className = 'box';
    toc.id = 'tocview';
    toc.setAttribute('variant', 'native');
    sidebar.appendChild(toc);
  } else if (!toc.classList.contains('box')) {
    toc.classList.add('box');
  }
  if (toc.tagName && toc.tagName.toLowerCase() === 'nano-toc') {
    toc.setAttribute('variant', 'native');
  }

  const updatedRegions = { ...regions, tocBox: toc };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
