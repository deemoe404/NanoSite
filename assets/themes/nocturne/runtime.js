function firstCharacter(text, fallback = 'N') {
  if (!text) return fallback;
  try {
    const chars = Array.from(String(text).trim());
    if (chars.length) return chars[0].toUpperCase();
  } catch (_) { /* ignore */ }
  return fallback;
}

function describeRoute(detail) {
  if (!detail) return { type: 'OVERVIEW', label: 'All content' };
  const type = (detail.type || detail.view || '').toString().trim().toUpperCase() || 'VIEW';
  let label = '';
  if (detail.type === 'post' || detail.view === 'post') {
    label = detail.title || (detail.metadata && detail.metadata.title) || (detail.metadata && detail.metadata.location) || 'Post';
  } else if (detail.type === 'search' || detail.view === 'search') {
    if (detail.tag) label = `Tag · ${detail.tag}`;
    else if (detail.query) label = `Search · ${detail.query}`;
    else label = 'Search results';
  } else if (detail.type === 'index' || detail.view === 'posts') {
    label = detail.title || 'All posts';
  } else if (detail.type === 'tab' || detail.view === 'tab') {
    label = detail.title || detail.slug || 'Page';
  } else if (detail.type === 'error') {
    label = detail.label || 'Something went wrong';
  }
  return { type, label: label || type.charAt(0) + type.slice(1).toLowerCase() };
}

export function activate(context) {
  if (!context) return {};
  const { addBodyClass, registerCleanup, container, sidebar, content, layout, root } = context;
  addBodyClass('theme-nocturne');
  if (root) {
    root.setAttribute('data-theme-shell', 'nocturne');
    registerCleanup(() => {
      if (root.getAttribute('data-theme-shell') === 'nocturne') root.removeAttribute('data-theme-shell');
    });
  }

  const hero = document.createElement('header');
  hero.className = 'nocturne-hero';
  hero.innerHTML = `
    <div class="nocturne-brand">
      <div class="nocturne-brand-mark" aria-hidden="true"></div>
      <div class="nocturne-brand-copy">
        <div class="nocturne-brand-title"></div>
        <div class="nocturne-brand-subtitle"></div>
      </div>
    </div>
    <div class="nocturne-route">
      <span class="nocturne-route-type"></span>
      <span class="nocturne-route-label"></span>
    </div>`;
  const parent = container && container.parentNode;
  if (parent) parent.insertBefore(hero, container);
  registerCleanup(() => { hero.remove(); });

  const grid = document.createElement('div');
  grid.className = 'nocturne-grid';
  if (container) container.appendChild(grid);
  registerCleanup(() => { grid.remove(); });

  const asideShell = document.createElement('aside');
  asideShell.className = 'nocturne-aside';
  const mainShell = document.createElement('div');
  mainShell.className = 'nocturne-main';
  grid.appendChild(asideShell);
  grid.appendChild(mainShell);

  if (sidebar) layout.move(sidebar, asideShell);
  if (content) layout.move(content, mainShell);

  const brandMark = hero.querySelector('.nocturne-brand-mark');
  const brandTitle = hero.querySelector('.nocturne-brand-title');
  const brandSubtitle = hero.querySelector('.nocturne-brand-subtitle');
  const routeType = hero.querySelector('.nocturne-route-type');
  const routeLabel = hero.querySelector('.nocturne-route-label');

  const applySite = (cfg) => {
    const title = context.getLocalized(cfg && cfg.siteTitle, 'NanoSite');
    const subtitle = context.getLocalized(cfg && cfg.siteDescription, 'A zero-build publishing system.');
    if (brandTitle) brandTitle.textContent = title || 'NanoSite';
    if (brandSubtitle) brandSubtitle.textContent = subtitle;
    if (brandMark) brandMark.textContent = firstCharacter(title, 'N');
  };

  const applyRoute = (detail) => {
    const { type, label } = describeRoute(detail || {});
    if (routeType) routeType.textContent = type;
    if (routeLabel) routeLabel.textContent = label;
  };

  applySite(context.site && typeof context.site.getConfig === 'function' ? context.site.getConfig() : null);
  applyRoute(null);

  return {
    applySiteConfig: applySite,
    handleEvent(eventName, detail) {
      if (eventName === 'content:rendered') {
        applyRoute(detail);
      } else if (eventName === 'content:error') {
        applyRoute({ type: 'error', label: 'Unavailable' });
      } else if (eventName === 'route:change') {
        applyRoute(detail);
      }
    },
    deactivate() {
      if (routeType) routeType.textContent = '';
      if (routeLabel) routeLabel.textContent = '';
    }
  };
}
