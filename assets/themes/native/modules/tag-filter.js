export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let tagBox = doc.getElementById('tagview');
  if (!tagBox) {
    tagBox = doc.createElement('div');
    tagBox.className = 'box';
    tagBox.id = 'tagview';
    sidebar.appendChild(tagBox);
  } else if (!tagBox.classList.contains('box')) {
    tagBox.classList.add('box');
  }

  const updatedRegions = { ...regions, tagBox };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
