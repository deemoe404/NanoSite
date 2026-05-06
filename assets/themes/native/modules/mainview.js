export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const content = regions.content || doc.querySelector('.content');
  if (!doc || !content) return context;

  let mainview = content.querySelector('[data-theme-region="main"]') || content.querySelector('.native-mainview');
  if (!mainview) {
    mainview = doc.createElement('div');
    mainview.className = 'box native-mainview';
    mainview.id = 'mainview';
    mainview.setAttribute('data-theme-region', 'main');
    content.appendChild(mainview);
  } else if (!mainview.classList.contains('box')) {
    mainview.classList.add('box');
  }
  mainview.classList.add('native-mainview');
  mainview.setAttribute('data-theme-region', 'main');

  if (typeof regions.register === 'function') {
    regions.register('main', mainview);
    regions.register('mainview', mainview);
  } else {
    regions.main = mainview;
    regions.mainview = mainview;
  }
  context.regions = regions;
  return { regions };
}
