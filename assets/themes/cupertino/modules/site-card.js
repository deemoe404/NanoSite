export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.cupertino-sidebar');
  if (!doc || !sidebar) return context;

  let card = sidebar.querySelector('.site-card');
  if (!card) {
    card = doc.createElement('div');
    card.className = 'site-card glass-panel';
    card.innerHTML = `
      <div class="site-card-header">
        <img class="avatar" alt="avatar" loading="lazy" decoding="async" />
        <div class="site-card-meta">
          <h2 class="site-title">${doc.title || ''}</h2>
          <p class="site-subtitle"></p>
        </div>
      </div>
      <hr class="site-divider" />
      <ul class="social-links" aria-label="Social links"></ul>`;
    sidebar.appendChild(card);
  }

  context.regions = { ...regions, siteCard: card };
  return { regions: { ...regions, siteCard: card } };
}
