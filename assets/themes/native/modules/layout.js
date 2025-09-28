export function mount(context = {}) {
  const doc = context.document || document;
  if (!doc || !doc.body) return context;

  let container = doc.querySelector('[data-theme-root="container"]');
  if (!container) {
    container = doc.createElement('div');
    container.className = 'container';
    container.setAttribute('data-theme-root', 'container');
    const anchor = doc.body.firstChild;
    if (anchor) doc.body.insertBefore(container, anchor);
    else doc.body.appendChild(container);
  }

  let content = container.querySelector('.content');
  if (!content) {
    content = doc.createElement('div');
    content.className = 'content';
    container.appendChild(content);
  }

  let sidebar = container.querySelector('.sidebar');
  if (!sidebar) {
    sidebar = doc.createElement('div');
    sidebar.className = 'sidebar';
    container.appendChild(sidebar);
  }

  let footer = doc.querySelector('footer.site-footer');
  if (!footer) {
    footer = doc.createElement('footer');
    footer.className = 'site-footer';
    footer.setAttribute('role', 'contentinfo');
  }

  if (!footer.parentElement) {
    const scriptAnchor = Array.from(doc.body.querySelectorAll('script')).find((el) => {
      const src = el.getAttribute('src') || '';
      return /assets\/main\.js$/.test(src);
    });
    if (scriptAnchor) {
      doc.body.insertBefore(footer, scriptAnchor);
    } else {
      doc.body.appendChild(footer);
    }
  }

  context.document = doc;
  context.regions = {
    container,
    content,
    sidebar,
    footer
  };
  return context;
}
