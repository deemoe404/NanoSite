export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.content');
  if (!doc || !content) return context;

  let mainview = doc.getElementById('mainview');
  if (!mainview) {
    mainview = doc.createElement('div');
    mainview.className = 'box';
    mainview.id = 'mainview';
    content.appendChild(mainview);
  } else if (!mainview.classList.contains('box')) {
    mainview.classList.add('box');
  }

  const updatedRegions = { ...regions, mainview };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
