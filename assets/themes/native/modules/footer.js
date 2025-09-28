export function mount(context = {}) {
  const doc = context.document || document;
  const regions = context.regions || {};
  let footer = regions.footer || doc.querySelector('footer.site-footer');
  if (!doc || !footer) return context;

  if (!footer.getAttribute('role')) {
    footer.setAttribute('role', 'contentinfo');
  }

  let inner = footer.querySelector('.footer-inner');
  if (!inner) {
    inner = doc.createElement('div');
    inner.className = 'footer-inner';
    footer.appendChild(inner);
  }

  let left = inner.querySelector('.footer-left');
  if (!left) {
    left = doc.createElement('div');
    left.className = 'footer-left';
    inner.appendChild(left);
  }

  if (!left.querySelector('.footer-copy')) {
    const copy = doc.createElement('span');
    copy.className = 'footer-copy';
    copy.innerHTML = '© <span id="footerYear"></span> <span class="footer-site">NanoSite</span>';
    left.appendChild(copy);
  }

  if (!left.querySelector('.footer-sep')) {
    const sep = doc.createElement('span');
    sep.className = 'footer-sep';
    sep.textContent = '•';
    left.appendChild(sep);
  }

  let nav = left.querySelector('#footerNav');
  if (!nav) {
    nav = doc.createElement('nav');
    nav.className = 'footer-nav';
    nav.id = 'footerNav';
    nav.setAttribute('aria-label', 'Footer');
    left.appendChild(nav);
  }

  let right = inner.querySelector('.footer-right');
  if (!right) {
    right = doc.createElement('div');
    right.className = 'footer-right';
    inner.appendChild(right);
  }

  if (!right.querySelector('#footerTop')) {
    const top = doc.createElement('a');
    top.href = '#';
    top.className = 'top-link';
    top.id = 'footerTop';
    top.textContent = 'Top';
    right.appendChild(top);
  }

  const updatedRegions = { ...regions, footer, footerNav: nav };
  context.regions = updatedRegions;
  return { regions: updatedRegions };
}
