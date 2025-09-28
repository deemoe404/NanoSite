import { getSavedThemePack } from './theme.js';

let activePack = null;
let layoutPromise = null;
let cachedContext = null;

const FALLBACK_MANIFEST = {
  modules: [
    'modules/layout.js',
    'modules/nav-tabs.js',
    'modules/mainview.js',
    'modules/search-box.js',
    'modules/site-card.js',
    'modules/tag-filter.js',
    'modules/toc.js',
    'modules/footer.js'
  ]
};

async function loadManifest(pack) {
  const base = `assets/themes/${encodeURIComponent(pack)}/theme.json`;
  try {
    const resp = await fetch(base, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid manifest');
    const list = Array.isArray(data.modules) ? data.modules : [];
    if (!list.length) throw new Error('Empty module list');
    return { modules: list.map(x => String(x)) };
  } catch (_) {
    return FALLBACK_MANIFEST;
  }
}

async function mountModule(pack, entry, context) {
  const safeEntry = String(entry || '').replace(/^[./]+/, '').trim();
  if (!safeEntry) return;
  if (safeEntry.includes('..') || safeEntry.includes('\\')) return;
  const path = `../themes/${encodeURIComponent(pack)}/${safeEntry}`;
  const mod = await import(path);
  const fn = typeof mod.mount === 'function' ? mod.mount : (typeof mod.default === 'function' ? mod.default : null);
  if (!fn) return;
  const result = await fn(context);
  if (result && typeof result === 'object') {
    if (result.regions && typeof result.regions === 'object') {
      context.regions = { ...context.regions, ...result.regions };
    }
    if (result.document && !context.document) {
      context.document = result.document;
    }
  }
}

async function mountPack(pack) {
  const manifest = await loadManifest(pack);
  const context = {
    document: document,
    regions: {}
  };
  for (const entry of manifest.modules) {
    try {
      await mountModule(pack, entry, context);
    } catch (err) {
      console.error('[theme] Failed to mount module', entry, err);
    }
  }
  document.body.dataset.themeLayout = pack;
  cachedContext = context;
  return context;
}

export async function ensureThemeLayout() {
  const pack = getSavedThemePack();
  if (cachedContext && document.body.dataset.themeLayout === pack) {
    return cachedContext;
  }
  if (layoutPromise && activePack === pack) {
    return layoutPromise;
  }
  activePack = pack;
  layoutPromise = mountPack(pack);
  return layoutPromise;
}

export function getThemeLayoutContext() {
  return cachedContext;
}
