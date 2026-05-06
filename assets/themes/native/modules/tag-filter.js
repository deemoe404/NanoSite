export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let tagBox = sidebar.querySelector('[data-theme-region="tags"]') || sidebar.querySelector('.native-tagbox');
  if (!tagBox) {
    tagBox = doc.createElement('div');
    tagBox.className = 'box native-tagbox';
    tagBox.id = 'tagview';
    tagBox.setAttribute('data-theme-region', 'tags');
    sidebar.appendChild(tagBox);
  } else if (!tagBox.classList.contains('box')) {
    tagBox.classList.add('box');
  }
  tagBox.classList.add('native-tagbox');
  tagBox.setAttribute('data-theme-region', 'tags');

  if (typeof regions.register === 'function') {
    regions.register('tags', tagBox);
    regions.register('tagBox', tagBox);
  } else {
    regions.tags = tagBox;
    regions.tagBox = tagBox;
  }
  context.regions = regions;
  return { regions };
}
