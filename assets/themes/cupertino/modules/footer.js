export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  let footer = regions.footer || doc.querySelector('.cupertino-footer');
  if (!doc || !footer) return context;

  footer.classList.add('cupertino-footer');
  footer.setAttribute('role', 'contentinfo');

  let inner = footer.querySelector('.cupertino-footer-inner');
  if (!inner) {
    inner = doc.createElement('div');
    inner.className = 'cupertino-footer-inner';
    footer.appendChild(inner);
  }

  let brand = inner.querySelector('.footer-brand');
  if (!brand) {
    brand = doc.createElement('div');
    brand.className = 'footer-brand';
    brand.innerHTML = `
      <span class="footer-mark" aria-hidden="true"></span>
      <span class="footer-copy">© <span id="footerYear"></span> <span class="footer-site">NanoSite</span></span>`;
    inner.appendChild(brand);
  }

  let nav = inner.querySelector('#footerNav');
  if (!nav) {
    nav = doc.createElement('nav');
    nav.id = 'footerNav';
    nav.className = 'footer-nav';
    nav.setAttribute('aria-label', 'Footer links');
    inner.appendChild(nav);
  }

  let socials = inner.querySelector('.footer-social');
  if (!socials) {
    socials = doc.createElement('div');
    socials.className = 'footer-social';
    const list = doc.createElement('ul');
    list.className = 'social-links';
    list.setAttribute('aria-label', 'Social links');
    socials.appendChild(list);
    inner.appendChild(socials);
  }

  let actions = inner.querySelector('.footer-actions');
  if (!actions) {
    actions = doc.createElement('div');
    actions.className = 'footer-actions';
    inner.appendChild(actions);
  }

  if (socials && actions && socials.nextSibling !== actions) {
    inner.insertBefore(socials, actions);
  }

  if (!actions.querySelector('#footerTop')) {
    const top = doc.createElement('a');
    top.id = 'footerTop';
    top.className = 'footer-top';
    top.href = '#';
    top.textContent = 'Back to top';
    actions.appendChild(top);
  }

  context.regions = { ...regions, footer, footerNav: nav };
  return { regions: { ...regions, footer, footerNav: nav } };
}
