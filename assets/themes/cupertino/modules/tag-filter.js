export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.cupertino-sidebar');
  if (!doc || !sidebar) return context;

  let tagView = sidebar.querySelector('#tagview');
  if (!tagView) {
    tagView = doc.createElement('div');
    tagView.id = 'tagview';
    tagView.className = 'cupertino-panel glass-panel';
    tagView.innerHTML = `
      <div class="panel-heading">
        <span class="panel-title">Tags</span>
      </div>
      <div class="panel-body">
        <div class="tag-grid" role="list"></div>
      </div>`;
    sidebar.appendChild(tagView);
  }

  context.regions = { ...regions, tagBox: tagView };
  return { regions: { ...regions, tagBox: tagView } };
}
