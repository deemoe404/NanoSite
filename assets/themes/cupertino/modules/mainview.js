export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.cupertino-content');
  if (!doc || !content) return context;

  let mainview = content.querySelector('#mainview');
  if (!mainview) {
    mainview = doc.createElement('section');
    mainview.id = 'mainview';
    mainview.className = 'cupertino-stage';
    content.appendChild(mainview);
  } else if (!mainview.classList.contains('cupertino-stage')) {
    mainview.classList.add('cupertino-stage');
  }

  context.regions = { ...regions, mainview };
  return { regions: { ...regions, mainview } };
}
