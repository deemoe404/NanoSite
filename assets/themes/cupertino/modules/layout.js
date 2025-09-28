export function mount(context = {}) {
  const doc = context.document || document;
  if (!doc || !doc.body) return context;

  let shell = doc.querySelector('[data-theme-root="container"]');
  if (!shell) {
    shell = doc.createElement('div');
    shell.dataset.themeRoot = 'container';
    shell.className = 'cupertino-shell';
    const anchor = doc.body.firstChild;
    if (anchor) doc.body.insertBefore(shell, anchor);
    else doc.body.appendChild(shell);
  } else if (!shell.classList.contains('cupertino-shell')) {
    shell.classList.add('cupertino-shell');
  }

  let header = shell.querySelector('.cupertino-header');
  if (!header) {
    header = doc.createElement('header');
    header.className = 'cupertino-header';
    header.id = 'siteHeader';
    shell.appendChild(header);
  }

  let main = shell.querySelector('main.cupertino-main');
  if (!main) {
    main = doc.createElement('main');
    main.className = 'cupertino-main';
    shell.appendChild(main);
  }

  let content = main.querySelector('.cupertino-content');
  if (!content) {
    content = doc.createElement('div');
    content.className = 'cupertino-content';
    main.appendChild(content);
  }

  let utility = shell.querySelector('.cupertino-utility');
  if (!utility) {
    utility = doc.createElement('section');
    utility.className = 'cupertino-utility';
    shell.appendChild(utility);
  }

  let utilityInner = utility.querySelector('.utility-inner');
  if (!utilityInner) {
    utilityInner = doc.createElement('div');
    utilityInner.className = 'utility-inner';
    utility.appendChild(utilityInner);
  }

  let sidebar = utilityInner.querySelector('.sidebar');
  if (!sidebar) {
    sidebar = doc.createElement('div');
    sidebar.className = 'sidebar cupertino-sidebar';
    sidebar.setAttribute('role', 'complementary');
    utilityInner.appendChild(sidebar);
  }

  let footer = doc.querySelector('footer.site-footer');
  if (!footer) {
    footer = doc.createElement('footer');
    footer.className = 'site-footer cupertino-footer';
    footer.setAttribute('role', 'contentinfo');
  } else if (!footer.classList.contains('cupertino-footer')) {
    footer.classList.add('cupertino-footer');
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

  const regions = {
    container: shell,
    header,
    main,
    content,
    sidebar,
    footer
  };

  context.document = doc;
  context.regions = { ...(context.regions || {}), ...regions };
  return { regions };
}
