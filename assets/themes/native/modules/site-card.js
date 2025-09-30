export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  const sidebar = regions.sidebar || doc.querySelector('.sidebar');
  if (!doc || !sidebar) return context;

  let card = sidebar.querySelector('.site-card');
  if (!card) {
    card = doc.createElement('div');
    card.className = 'box site-card';
    sidebar.appendChild(card);
  } else if (!card.classList.contains('box')) {
    card.classList.add('box');
  }

  let avatar = card.querySelector('.avatar');
  if (!avatar) {
    avatar = doc.createElement('img');
    avatar.className = 'avatar';
    avatar.setAttribute('alt', 'avatar');
    avatar.setAttribute('loading', 'lazy');
    avatar.setAttribute('decoding', 'async');
    card.appendChild(avatar);
  }

  let title = card.querySelector('.site-title');
  if (!title) {
    title = doc.createElement('h3');
    title.className = 'site-title';
    card.appendChild(title);
  }

  let subtitle = card.querySelector('.site-subtitle');
  if (!subtitle) {
    subtitle = doc.createElement('p');
    subtitle.className = 'site-subtitle';
    card.appendChild(subtitle);
  }

  let hr = card.querySelector('.site-hr');
  if (!hr) {
    hr = doc.createElement('hr');
    hr.className = 'site-hr';
    card.appendChild(hr);
  }

  let list = card.querySelector('.social-links');
  if (!list) {
    list = doc.createElement('ul');
    list.className = 'social-links';
    card.appendChild(list);
  }

  const updatedRegions = { ...regions, siteCard: card };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
