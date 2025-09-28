import { getSavedThemePack, loadThemePack } from './theme.js';

let activePack = null;
let layoutPromise = null;
let cachedContext = null;

const DEFAULT_PACK = 'native';

const FALLBACK_MANIFEST = {
  modules: [
    'modules/layout.js',
    'modules/nav-tabs.js',
    'modules/interactions.js',
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
  const resp = await fetch(base, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid manifest');
  const list = Array.isArray(data.modules) ? data.modules : [];
  if (!list.length) throw new Error('Empty module list');
  return { modules: list.map(x => String(x)) };
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

function forceNativePack() {
  try {
    loadThemePack(DEFAULT_PACK);
  } catch (err) {
    console.error('[theme] Failed to force native pack', err);
  }
}

async function mountPack(pack, allowFallback = true) {
  let manifest;
  try {
    manifest = await loadManifest(pack);
  } catch (err) {
    console.error(`[theme] Failed to load manifest for "${pack}"`, err);
    if (allowFallback && pack !== DEFAULT_PACK) {
      forceNativePack();
      return mountPack(DEFAULT_PACK, false);
    }
    manifest = FALLBACK_MANIFEST;
  }

  const context = {
    document: document,
    regions: {},
    pack
  };

  for (const entry of manifest.modules) {
    try {
      await mountModule(pack, entry, context);
    } catch (err) {
      console.error('[theme] Failed to mount module', entry, err);
      if (allowFallback && pack !== DEFAULT_PACK) {
        forceNativePack();
        return mountPack(DEFAULT_PACK, false);
      }
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
  layoutPromise = mountPack(pack).then((context) => {
    const resolvedPack = (context && context.pack) || document.body.dataset.themeLayout || DEFAULT_PACK;
    activePack = resolvedPack;
    return context;
  });
  return layoutPromise;
}

export function getThemeLayoutContext() {
  return cachedContext;
}
