import { getSavedThemePack, loadThemePack } from './theme.js';
import {
  t,
  withLangParam,
  getCurrentLang,
  switchLanguage,
  ensureLanguageBundle,
  getAvailableLangs,
  getLanguageLabel
} from './i18n.js?v=20260506theme';
import {
  createThemeRegionRegistry,
  ensureThemeRegionRegistry,
  getThemeLayoutContext as readThemeLayoutContext,
  getThemeRegion,
  mergeThemeRegions,
  setThemeLayoutContext
} from './theme-regions.js';

let activePack = null;
let layoutPromise = null;

const DEFAULT_PACK = 'native';
const CONTRACT_VERSION = 1;

const EFFECT_VIEW_NAMES = {
  renderPostView: 'post',
  renderIndexView: 'posts',
  renderSearchResults: 'search',
  renderStaticTabView: 'tab',
  renderErrorState: 'error',
  renderPostLoadingState: 'loading',
  renderStaticTabLoadingState: 'loading'
};

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

function isThemeDevMode() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('themeDev') === '1' || params.has('themeDev')) return true;
  } catch (_) {}
  try {
    if (window.__press_themeDevMode === true) return true;
  } catch (_) {}
  try {
    return window.localStorage && window.localStorage.getItem('press_theme_dev_mode') === '1';
  } catch (_) {
    return false;
  }
}

function themeDevWarn(...args) {
  if (!isThemeDevMode()) return;
  try { console.warn('[theme-dev]', ...args); } catch (_) {}
}

function asStringList(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export function createThemeI18nContext() {
  return {
    t,
    withLangParam,
    getCurrentLang,
    switchLanguage,
    ensureLanguageBundle,
    getAvailableLangs,
    getLanguageLabel,
    lang: typeof getCurrentLang === 'function' ? getCurrentLang() : ''
  };
}

function validateManifestContract(pack, manifest) {
  if (!isThemeDevMode()) return;
  const contractVersion = manifest && manifest.contractVersion;
  if (contractVersion !== CONTRACT_VERSION) {
    themeDevWarn(`Theme "${pack}" declares unsupported contract version`, contractVersion);
  }
  if (!manifest.version) {
    themeDevWarn(`Theme "${pack}" has no top-level version field in theme.json.`);
  }
  ['styles', 'modules', 'components'].forEach((key) => {
    if (manifest[key] != null && !Array.isArray(manifest[key])) {
      themeDevWarn(`Theme "${pack}" ${key} should be an array.`);
    }
  });
  if (!asObject(manifest.views)) {
    themeDevWarn(`Theme "${pack}" should declare top-level views.`);
  }
  if (!asObject(manifest.regions)) {
    themeDevWarn(`Theme "${pack}" should declare top-level regions.`);
  }
  if (!manifest.content) {
    themeDevWarn(`Theme "${pack}" should declare supported content shapes.`);
    return;
  }
  const content = manifest.content;
  if (content && typeof content === 'object') {
    const shapes = asStringList(content.shapes || content.provides || []);
    ['html', 'blocks', 'tocTree'].forEach((shape) => {
      if (shapes.length && !shapes.includes(shape)) {
        themeDevWarn(`Theme "${pack}" content.shapes should include "${shape}".`);
      }
    });
    if (content.markdown && content.markdown !== 'html') {
      themeDevWarn(`Theme "${pack}" content.markdown should currently be "html".`);
    }
    if (content.toc && content.toc !== 'html') {
      themeDevWarn(`Theme "${pack}" content.toc should currently be "html".`);
    }
  }
}

function getDeclaredRegionNames(manifest) {
  const topLevel = manifest && manifest.regions;
  if (Array.isArray(topLevel)) return asStringList(topLevel);
  if (topLevel && typeof topLevel === 'object') return Object.keys(topLevel).filter(Boolean);
  return [];
}

function safeThemeAssetPath(pack, entry, extension) {
  const safeEntry = String(entry || '').replace(/^[./]+/, '').trim();
  if (!safeEntry || safeEntry.includes('..') || safeEntry.includes('\\') || !safeEntry.endsWith(extension)) {
    return '';
  }
  return `assets/themes/${encodeURIComponent(pack)}/${safeEntry}`;
}

function applyManifestStyles(pack, manifest) {
  const styles = asStringList(manifest && manifest.styles);
  const declared = styles.length ? styles : ['theme.css'];
  const hrefs = declared.map((entry) => safeThemeAssetPath(pack, entry, '.css')).filter(Boolean);
  if (!hrefs.length) return;
  const primary = hrefs[0];
  try {
    const link = document.getElementById('theme-pack');
    if (link && link.getAttribute('href') !== primary) link.setAttribute('href', primary);
  } catch (_) {}
  try {
    document.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => node.remove());
    hrefs.slice(1).forEach((href, index) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-theme-pack-extra-style', `${pack}:${index + 1}`);
      document.head.appendChild(link);
    });
  } catch (_) {}
}

function warnUndeclaredRegions(pack, manifest, regions) {
  if (!isThemeDevMode()) return;
  const declared = new Set(getDeclaredRegionNames(manifest));
  if (!declared.size || !regions || typeof regions !== 'object') return;
  Object.keys(regions).forEach((key) => {
    if (!declared.has(key)) {
      themeDevWarn(`Theme "${pack}" returned undeclared region "${key}".`);
    }
  });
}

function warnMissingRegions(pack, manifest, context) {
  if (!isThemeDevMode()) return;
  const regions = ensureThemeRegionRegistry(context && context.regions);
  getDeclaredRegionNames(manifest).forEach((key) => {
    const region = regions.get(key);
    if (!region) {
      themeDevWarn(`Theme "${pack}" declares missing mounted region "${key}".`);
    }
  });
}

function createThemeApi(pack, manifest) {
  const api = {
    name: String((manifest && manifest.name) || pack || ''),
    version: String((manifest && manifest.version) || ''),
    contractVersion: firstDefined(manifest && manifest.contractVersion, CONTRACT_VERSION),
    manifest,
    mount: null,
    unmount: null,
    regions: asObject(manifest && manifest.regions) || {},
    views: {},
    components: {},
    effects: {}
  };

  const declaredViews = asObject(manifest && manifest.views);
  if (declaredViews) {
    Object.keys(declaredViews).forEach((key) => { api.views[key] = null; });
  }

  return api;
}

function mergeFunctionMap(target, source) {
  if (!target || !source || typeof source !== 'object') return target;
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === 'function') target[key] = value;
  });
  return target;
}

function mergeThemeApi(target, source) {
  if (!target || !source || typeof source !== 'object') return target;
  if (typeof source.mount === 'function') target.mount = source.mount;
  if (typeof source.unmount === 'function') target.unmount = source.unmount;
  if (source.regions && typeof source.regions === 'object') {
    target.regions = { ...target.regions, ...source.regions };
  }
  mergeFunctionMap(target.views, source.views);
  mergeFunctionMap(target.components, source.components);
  mergeFunctionMap(target.effects, source.effects);
  return target;
}

function extractThemeApi(mod) {
  if (!mod || typeof mod !== 'object') return null;
  const explicit = asObject(mod.theme) || asObject(mod.themeApi) || asObject(mod.api);
  const fromDefault = asObject(mod.default);
  const direct = (
    asObject(mod.views)
    || asObject(mod.components)
    || asObject(mod.effects)
    || asObject(mod.regions)
    || typeof mod.mount === 'function'
    || typeof mod.unmount === 'function'
  ) ? mod : null;
  const source = explicit || fromDefault || direct;
  if (!source) return null;
  if (
    typeof source.mount === 'function'
    || typeof source.unmount === 'function'
    || asObject(source.views)
    || asObject(source.components)
    || asObject(source.effects)
    || asObject(source.regions)
  ) {
    return source;
  }
  return null;
}

async function loadManifest(pack) {
  const base = `assets/themes/${encodeURIComponent(pack)}/theme.json`;
  const resp = await fetch(base, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid manifest');
  const list = Array.isArray(data.modules) ? data.modules : [];
  if (!list.length) throw new Error('Empty module list');
  const manifest = { ...data, modules: list.map(x => String(x)) };
  validateManifestContract(pack, manifest);
  return manifest;
}

async function mountModule(pack, entry, context, manifest) {
  const safeEntry = String(entry || '').replace(/^[./]+/, '').trim();
  if (!safeEntry) return;
  if (safeEntry.includes('..') || safeEntry.includes('\\')) return;
  const path = `../themes/${encodeURIComponent(pack)}/${safeEntry}`;
  const mod = await import(path);
  const modApi = extractThemeApi(mod);
  if (modApi) mergeThemeApi(context.theme, modApi);
  const fn = typeof mod.mount === 'function'
    ? mod.mount
    : (modApi && typeof modApi.mount === 'function'
        ? modApi.mount
        : (typeof mod.default === 'function' ? mod.default : null));
  if (!fn) return;
  context.regions = ensureThemeRegionRegistry(context.regions);
  const result = await fn(context);
  if (result && typeof result === 'object') {
    const resultApi = extractThemeApi(result);
    if (resultApi) mergeThemeApi(context.theme, resultApi);
    if (result.regions && typeof result.regions === 'object') {
      warnUndeclaredRegions(pack, manifest, result.regions);
      context.regions = mergeThemeRegions(context.regions, result.regions);
    }
    if (result.document && !context.document) {
      context.document = result.document;
    }
  }
  context.regions = ensureThemeRegionRegistry(context.regions);
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
    i18n: createThemeI18nContext(),
    regions: createThemeRegionRegistry(),
    pack,
    manifest,
    theme: createThemeApi(pack, manifest),
    utilities: {
      getRegion: getThemeRegion,
      warn: themeDevWarn
    }
  };

  applyManifestStyles(pack, manifest);

  for (const entry of manifest.modules) {
    try {
      await mountModule(pack, entry, context, manifest);
    } catch (err) {
      console.error('[theme] Failed to mount module', entry, err);
      if (allowFallback && pack !== DEFAULT_PACK) {
        forceNativePack();
        return mountPack(DEFAULT_PACK, false);
      }
    }
  }

  document.body.dataset.themeLayout = pack;
  warnMissingRegions(pack, manifest, context);
  setThemeLayoutContext(context);
  return context;
}

export async function ensureThemeLayout() {
  const pack = getSavedThemePack();
  const cachedContext = readThemeLayoutContext();
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
  return readThemeLayoutContext();
}

export function getThemeApiHandler(name) {
  const hookName = String(name || '').trim();
  if (!hookName) return null;
  const context = readThemeLayoutContext();
  const api = context && context.theme;
  if (api && typeof api === 'object') {
    const viewName = EFFECT_VIEW_NAMES[hookName];
    if (viewName && api.views && typeof api.views[viewName] === 'function') {
      return api.views[viewName];
    }
    if (api.effects && typeof api.effects[hookName] === 'function') {
      return api.effects[hookName];
    }
  }
  return null;
}

export { getThemeRegion };
