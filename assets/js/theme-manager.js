import { t, getLanguageLabel, getCurrentLang } from './i18n.js';

const THEME_ROOT_ID = 'ns-app-root';
const DEFAULT_TEMPLATE_ID = 'ns-default-layout';
const PACK_LINK_ID = 'theme-pack';
const EXTRA_STYLE_ATTR = 'data-theme-extra-style';
const EXTRA_STYLE_PREFIX = 'theme-extra:';

let activePack = null;
let activeManifest = null;
let activeHandlers = null;
let themeContext = null;
let lastSiteConfig = null;
let applyToken = 0;
const hydrators = new Set();
let registryCache = null;

export function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function sanitizeAssetPath(path) {
  if (!path) return null;
  const raw = String(path).trim();
  if (!raw) return null;
  if (raw.includes('..') || raw.includes('\\') || raw.startsWith('/')) return null;
  const clean = raw.replace(/[^a-zA-Z0-9_./-]/g, '');
  return clean || null;
}

function getThemeRoot() {
  let el = document.getElementById(THEME_ROOT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = THEME_ROOT_ID;
    document.body.insertBefore(el, document.body.firstChild || null);
  }
  return el;
}

function getDefaultLayoutHtml() {
  try {
    const tpl = document.getElementById(DEFAULT_TEMPLATE_ID);
    if (tpl && 'innerHTML' in tpl) {
      const html = tpl.innerHTML.trim();
      if (html) return html;
    }
  } catch (_) { /* ignore */ }
  return `
    <div class="container">
      <div class="content">
        <div class="box flex-split" id="mapview">
          <nav class="tabs" id="tabsNav" aria-label="Sections"></nav>
        </div>
        <div class="box" id="mainview"></div>
      </div>
      <div class="sidebar">
        <div class="box" id="searchbox">
          <input id="searchInput" type="search">
        </div>
        <div class="box site-card">
          <img class="avatar" alt="avatar" loading="lazy" decoding="async">
          <h3 class="site-title"></h3>
          <p class="site-subtitle"></p>
          <hr class="site-hr">
          <ul class="social-links"></ul>
        </div>
        <div class="box" id="tagview"></div>
        <div class="box" id="tocview"></div>
      </div>
    </div>
    <footer class="site-footer" role="contentinfo">
      <div class="footer-inner">
        <div class="footer-left">
          <span class="footer-copy">© <span id="footerYear"></span> <span class="footer-site">NanoSite</span></span>
          <span class="footer-sep">•</span>
          <nav class="footer-nav" id="footerNav" aria-label="Footer"></nav>
        </div>
        <div class="footer-right">
          <a href="#" class="top-link" id="footerTop">Top</a>
        </div>
      </div>
    </footer>`;
}

async function loadThemeManifest(pack) {
  const url = `assets/themes/${encodeURIComponent(pack)}/manifest.json`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return normalizeManifest(data, pack);
  } catch (err) {
    console.warn(`[theme] Falling back to legacy manifest for pack "${pack}"`, err);
    return {
      name: pack,
      version: 'legacy',
      styles: ['theme.css'],
      layout: null,
      entry: null,
      compatibilityMode: true
    };
  }
}

function normalizeManifest(manifest, pack) {
  const result = { ...manifest };
  if (!result || typeof result !== 'object') {
    return {
      name: pack,
      version: 'legacy',
      styles: ['theme.css'],
      layout: null,
      entry: null
    };
  }
  if (!Array.isArray(result.styles)) {
    const single = result.style || result.css || result.styles;
    result.styles = single ? [single] : ['theme.css'];
  }
  result.styles = result.styles
    .map(sanitizeAssetPath)
    .filter(Boolean);
  if (!result.styles.length) result.styles = ['theme.css'];
  const layout = result.layout && typeof result.layout === 'object'
    ? result.layout.template || result.layout.path || result.layout.file
    : result.layout;
  result.layout = sanitizeAssetPath(layout);
  const entry = result.entry || result.module || result.script;
  result.entry = sanitizeAssetPath(entry);
  result.name = result.name || pack;
  if (!result.version) result.version = '1.0.0';
  return result;
}

function clearExtraStyleLinks() {
  try {
    const extras = document.querySelectorAll(`link[${EXTRA_STYLE_ATTR}]`);
    extras.forEach(link => link.parentElement && link.parentElement.removeChild(link));
  } catch (_) { /* noop */ }
}

function applyStyles(pack, manifest) {
  const styles = Array.isArray(manifest.styles) && manifest.styles.length
    ? manifest.styles.slice()
    : ['theme.css'];
  const [primary, ...rest] = styles;
  const safePrimary = sanitizeAssetPath(primary) || 'theme.css';
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/${encodeURIComponent(safePrimary)}`;
  if (link) link.setAttribute('href', href);
  clearExtraStyleLinks();
  rest.forEach(path => {
    const safe = sanitizeAssetPath(path);
    if (!safe) return;
    const extra = document.createElement('link');
    extra.rel = 'stylesheet';
    extra.href = `assets/themes/${encodeURIComponent(pack)}/${encodeURIComponent(safe)}`;
    extra.setAttribute(EXTRA_STYLE_ATTR, `${EXTRA_STYLE_PREFIX}${pack}:${safe}`);
    document.head.appendChild(extra);
  });
  try {
    localStorage.setItem('themePackPrimaryStyle', safePrimary);
  } catch (_) { /* ignore */ }
}

async function fetchLayoutHtml(pack, manifest) {
  if (!manifest.layout) return getDefaultLayoutHtml();
  const url = `assets/themes/${encodeURIComponent(pack)}/${manifest.layout}`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } catch (err) {
    console.error(`[theme] Failed to load layout for pack "${pack}"`, err);
    return getDefaultLayoutHtml();
  }
}

function applyLayoutHtml(html) {
  const root = getThemeRoot();
  root.innerHTML = html;
}

function collectCoreElements(root) {
  return {
    container: root.querySelector('.container'),
    content: root.querySelector('.content'),
    sidebar: root.querySelector('.sidebar'),
    mapview: root.querySelector('#mapview'),
    tabsNav: root.querySelector('#tabsNav'),
    mainview: root.querySelector('#mainview'),
    searchbox: root.querySelector('#searchbox'),
    searchInput: root.querySelector('#searchInput'),
    siteCard: root.querySelector('.site-card'),
    tagview: root.querySelector('#tagview'),
    tocview: root.querySelector('#tocview'),
    footer: document.querySelector('.site-footer')
  };
}

function createContext(pack, manifest) {
  const root = getThemeRoot();
  const ctx = {
    pack,
    manifest,
    root,
    elements: {},
    getSiteConfig: () => lastSiteConfig,
    i18n: {
      t,
      getCurrentLang,
      getLanguageLabel
    }
  };
  return ctx;
}

function refreshContextElements(ctx) {
  if (!ctx) return;
  ctx.elements = collectCoreElements(ctx.root || getThemeRoot());
}

function safeInvoke(handler, payload) {
  if (typeof handler !== 'function') return;
  try {
    const maybePromise = handler(payload, themeContext);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(err => console.error('[theme] handler rejected', err));
    }
  } catch (err) {
    console.error('[theme] handler error', err);
  }
}

function runHydrators(ctx) {
  hydrators.forEach(fn => {
    try {
      fn(ctx);
    } catch (err) {
      console.error('[theme] hydrator error', err);
    }
  });
}

async function setupThemeModule(pack, manifest, ctx) {
  if (!manifest.entry) return null;
  try {
    const moduleUrl = new URL(`../themes/${pack}/${manifest.entry}`, import.meta.url);
    moduleUrl.searchParams.set('v', manifest.version || Date.now().toString());
    const mod = await import(moduleUrl.toString());
    let handlers = {};
    const candidate = mod && typeof mod.default !== 'undefined' ? mod.default : mod;
    if (typeof candidate === 'function') {
      const result = await candidate(ctx);
      if (result && typeof result === 'object') handlers = { ...handlers, ...result };
    } else if (candidate && typeof candidate === 'object') {
      handlers = { ...candidate };
    }
    if (typeof mod.setup === 'function') {
      const extra = await mod.setup(ctx);
      if (extra && typeof extra === 'object') handlers = { ...handlers, ...extra };
    }
    const allowed = ['onReady', 'onSiteConfig', 'onRouteChange', 'onContentRendered', 'teardown'];
    const normalized = {};
    allowed.forEach(key => {
      if (typeof handlers[key] === 'function') normalized[key] = handlers[key];
      else if (typeof mod[key] === 'function') normalized[key] = mod[key];
    });
    return normalized;
  } catch (err) {
    console.error(`[theme] Failed to load enhancement script for pack "${pack}"`, err);
    return null;
  }
}

function cleanupActiveTheme() {
  try {
    safeInvoke(activeHandlers && activeHandlers.teardown, { pack: activePack });
  } catch (_) { /* noop */ }
  activeHandlers = null;
  activeManifest = null;
  activePack = null;
  themeContext = null;
}

export function registerThemeHydrator(fn) {
  if (typeof fn === 'function') hydrators.add(fn);
}

export function unregisterThemeHydrator(fn) {
  if (hydrators.has(fn)) hydrators.delete(fn);
}

export async function applyThemePack(pack, options = {}) {
  const sanitized = sanitizePack(pack);
  const { persistSelection = false, force = false } = options;
  if (persistSelection) {
    try { localStorage.setItem('themePack', sanitized); } catch (_) { /* ignore */ }
  }
  if (!force && sanitized === activePack && themeContext) {
    return themeContext;
  }
  const token = ++applyToken;
  const manifest = await loadThemeManifest(sanitized);
  if (token !== applyToken) return themeContext;
  cleanupActiveTheme();
  applyStyles(sanitized, manifest);
  if (token !== applyToken) return themeContext;
  const html = await fetchLayoutHtml(sanitized, manifest);
  if (token !== applyToken) return themeContext;
  applyLayoutHtml(html);
  const ctx = createContext(sanitized, manifest);
  document.body.setAttribute('data-theme-pack', sanitized);
  ctx.root.dataset.themePack = sanitized;
  refreshContextElements(ctx);
  themeContext = ctx;
  runHydrators(ctx);
  refreshContextElements(ctx);
  const handlers = await setupThemeModule(sanitized, manifest, ctx);
  if (token !== applyToken) {
    if (handlers && typeof handlers.teardown === 'function') {
      try { handlers.teardown(ctx); } catch (_) { /* ignore */ }
    }
    return themeContext;
  }
  activePack = sanitized;
  activeManifest = manifest;
  activeHandlers = handlers;
  if (handlers && typeof handlers.onReady === 'function') {
    safeInvoke(handlers.onReady, { pack: sanitized, manifest });
  }
  return ctx;
}

export async function ensureInitialTheme(packHint) {
  const saved = packHint ? sanitizePack(packHint) : getSavedThemePack();
  const desired = saved || 'native';
  return applyThemePack(desired, { persistSelection: false, force: true });
}

export function getSavedThemePack() {
  try {
    const stored = localStorage.getItem('themePack');
    return sanitizePack(stored);
  } catch (_) {
    return 'native';
  }
}

export function getActiveThemeInfo() {
  return { pack: activePack, manifest: activeManifest, context: themeContext };
}

export function notifyThemeSiteConfig(cfg) {
  lastSiteConfig = cfg || null;
  if (activeHandlers && typeof activeHandlers.onSiteConfig === 'function') {
    safeInvoke(activeHandlers.onSiteConfig, cfg);
  }
}

export function notifyThemeRouteChange(route) {
  if (activeHandlers && typeof activeHandlers.onRouteChange === 'function') {
    safeInvoke(activeHandlers.onRouteChange, route);
  }
}

export function notifyThemeContentRendered(payload) {
  if (activeHandlers && typeof activeHandlers.onContentRendered === 'function') {
    safeInvoke(activeHandlers.onContentRendered, payload);
  }
}

export async function getThemeRegistry() {
  if (registryCache) return registryCache;
  try {
    const resp = await fetch('assets/themes/packs.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('Invalid registry payload');
    registryCache = data.map(item => ({
      value: sanitizePack(item && item.value),
      label: (item && item.label) ? String(item.label) : sanitizePack(item && item.value),
      description: item && item.description ? String(item.description) : ''
    })).filter(entry => entry.value);
  } catch (err) {
    console.warn('[theme] Falling back to default registry', err);
    registryCache = [
      { value: 'native', label: 'Native', description: 'NanoSite minimal layout' },
      { value: 'github', label: 'GitHub', description: 'GitHub-inspired presentation' }
    ];
  }
  return registryCache;
}

export function resetThemeRegistryCache() {
  registryCache = null;
}

export function getThemeContext() {
  return themeContext;
}

export function getLastSiteConfig() {
  return lastSiteConfig;
}
