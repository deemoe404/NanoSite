import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage } from './i18n.js';
import { applyLayoutConfig, registerLayoutPreset, registerLayoutComponent } from './layouts.js';

const PACK_LINK_ID = 'theme-pack';
const EXTRA_STYLE_ATTR = 'data-theme-pack-extra';
const THEME_BASE_PATH = 'assets/themes';
const DEFAULT_LAYOUT_PRESET = 'sidebar-right';

let activeThemeDisposers = [];
let currentThemeRequestId = 0;

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function toArray(input) {
  if (Array.isArray(input)) return input;
  if (input === undefined || input === null) return [];
  return [input];
}

function sanitizeResourcePath(path) {
  if (typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes('..')) return '';
  if (!/^[a-zA-Z0-9_./-]+$/.test(trimmed)) return '';
  return trimmed.replace(/^\/+/, '');
}

function encodeResourcePath(path) {
  return path.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
}

function buildThemeResourceUrl(pack, resourcePath) {
  const safePath = sanitizeResourcePath(resourcePath) || 'theme.css';
  const encodedPack = encodeURIComponent(pack);
  const encodedResource = encodeResourcePath(safePath);
  return `${THEME_BASE_PATH}/${encodedPack}/${encodedResource}`;
}

function clearExtraThemeStyles() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`link[${EXTRA_STYLE_ATTR}]`).forEach(link => {
    try { link.remove(); } catch (_) {}
  });
}

function applyLinkMetadata(link, meta) {
  if (!link || typeof link.setAttribute !== 'function') return;
  const m = meta && typeof meta === 'object' ? meta : {};
  const media = typeof m.media === 'string' ? m.media.trim() : '';
  if (media) link.setAttribute('media', media);
  else link.removeAttribute('media');
  const title = typeof m.title === 'string' ? m.title : '';
  if (title) link.setAttribute('title', title);
  else link.removeAttribute('title');
}

function normalizeStyleEntries(input) {
  const entries = [];
  const list = toArray(input);
  for (const item of list) {
    if (typeof item === 'string') {
      const href = sanitizeResourcePath(item);
      if (href) entries.push({ href, rel: 'stylesheet' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const href = sanitizeResourcePath(item.href || item.path || item.src);
    if (!href) continue;
    const rel = typeof item.rel === 'string' ? item.rel : 'stylesheet';
    const media = typeof item.media === 'string' ? item.media.trim() : undefined;
    const title = typeof item.title === 'string' ? item.title : undefined;
    entries.push({ href, rel, media, title });
  }
  if (!entries.length) entries.push({ href: 'theme.css', rel: 'stylesheet' });
  return entries;
}

function runThemeDisposers() {
  if (!Array.isArray(activeThemeDisposers)) { activeThemeDisposers = []; return; }
  while (activeThemeDisposers.length) {
    const disposer = activeThemeDisposers.pop();
    try { if (typeof disposer === 'function') disposer(); } catch (err) { console.error('[theme] Cleanup failed:', err); }
  }
}

async function fetchThemeManifest(pack) {
  const url = `${THEME_BASE_PATH}/${encodeURIComponent(pack)}/manifest.json`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return (data && typeof data === 'object') ? data : {};
  } catch (err) {
    console.warn(`[theme] Using fallback manifest for ${pack}:`, err);
    return {};
  }
}

function normalizeManifest(manifest) {
  const data = (manifest && typeof manifest === 'object') ? manifest : {};
  if (!data.assets || typeof data.assets !== 'object') data.assets = {};
  return data;
}

function applyThemeStyles(pack, manifest) {
  if (typeof document === 'undefined') return;
  const styles = normalizeStyleEntries(manifest && manifest.assets ? manifest.assets.styles : undefined);
  clearExtraThemeStyles();
  const head = document.head || document.querySelector('head');
  const primary = styles[0];
  const mainLink = document.getElementById(PACK_LINK_ID);
  if (mainLink) {
    mainLink.setAttribute('rel', primary.rel || 'stylesheet');
    mainLink.setAttribute('href', buildThemeResourceUrl(pack, primary.href));
    applyLinkMetadata(mainLink, primary);
  }
  for (let i = 1; i < styles.length; i += 1) {
    const entry = styles[i];
    const link = document.createElement('link');
    link.setAttribute('rel', entry.rel || 'stylesheet');
    link.setAttribute('href', buildThemeResourceUrl(pack, entry.href));
    link.setAttribute(EXTRA_STYLE_ATTR, pack);
    if (entry.media) link.setAttribute('media', entry.media);
    if (entry.title) link.setAttribute('title', entry.title);
    if (head) head.appendChild(link);
  }
}

async function loadLayoutModules(pack, layoutConfig) {
  const modules = [];
  const entries = [];
  if (layoutConfig && typeof layoutConfig === 'object') {
    entries.push(...toArray(layoutConfig.module || layoutConfig.modules));
  }
  for (const entry of entries) {
    const path = typeof entry === 'string' ? entry : (entry && (entry.path || entry.href || entry.src));
    const safePath = sanitizeResourcePath(path);
    if (!safePath) continue;
    const url = buildThemeResourceUrl(pack, safePath);
    try {
      const mod = await import(url);
      if (mod) modules.push(mod);
    } catch (err) {
      console.error(`[theme] Failed to load layout module ${url}:`, err);
    }
  }
  return modules;
}

async function applyThemeLayout(pack, manifest) {
  const rawLayout = (manifest && Object.prototype.hasOwnProperty.call(manifest, 'layout')) ? manifest.layout : DEFAULT_LAYOUT_PRESET;
  const layoutConfig = (rawLayout && typeof rawLayout === 'object') ? { ...rawLayout, zones: rawLayout.zones && typeof rawLayout.zones === 'object' ? { ...rawLayout.zones } : rawLayout.zones } : rawLayout || DEFAULT_LAYOUT_PRESET;

  runThemeDisposers();
  const modules = await loadLayoutModules(pack, layoutConfig);

  const baseContext = {
    pack,
    config: layoutConfig,
    registerLayoutPreset,
    registerLayoutComponent,
    applyLayoutConfig,
  };

  modules.forEach(mod => {
    if (mod && typeof mod.registerLayouts === 'function') {
      try { mod.registerLayouts(baseContext); } catch (err) { console.error('[theme] registerLayouts failed:', err); }
    }
  });

  modules.forEach(mod => {
    if (mod && typeof mod.beforeLayout === 'function') {
      try { mod.beforeLayout(baseContext); } catch (err) { console.error('[theme] beforeLayout failed:', err); }
    }
  });

  const applied = applyLayoutConfig(layoutConfig);
  const afterContext = { ...baseContext, applied };

  modules.forEach(mod => {
    if (mod && typeof mod.afterLayout === 'function') {
      try { mod.afterLayout(afterContext); } catch (err) { console.error('[theme] afterLayout failed:', err); }
    }
    const cleanup = mod && (mod.cleanup || mod.dispose);
    if (typeof cleanup === 'function') {
      activeThemeDisposers.push(() => {
        try { cleanup.call(mod); } catch (err) { console.error('[theme] Theme module cleanup failed:', err); }
      });
    }
  });

  return applied;
}

export async function loadThemePack(name) {
  const pack = sanitizePack(name);
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  const requestId = ++currentThemeRequestId;

  let manifest = await fetchThemeManifest(pack);
  if (requestId !== currentThemeRequestId) return manifest;
  manifest = normalizeManifest(manifest);

  try {
    applyThemeStyles(pack, manifest);
  } catch (err) {
    console.error('[theme] Failed to apply theme styles:', err);
    applyThemeStyles(pack, { assets: { styles: ['theme.css'] } });
  }

  try {
    await applyThemeLayout(pack, manifest);
  } catch (err) {
    console.error('[theme] Failed to apply theme layout:', err);
    applyLayoutConfig(DEFAULT_LAYOUT_PRESET);
  }

  return manifest;
}

export function getSavedThemePack() {
  try { return sanitizePack(localStorage.getItem('themePack')) || 'native'; } catch (_) { return 'native'; }
}

export function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (saved === 'light') document.documentElement.removeAttribute('data-theme');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) { /* ignore */ }
  // Ensure pack is applied too
  return loadThemePack(getSavedThemePack());
}

// Apply theme according to site config. When override = true, it forces the
// site-defined values and updates localStorage to keep UI in sync.
export function applyThemeConfig(siteConfig) {
  const cfg = siteConfig || {};
  const override = cfg.themeOverride !== false; // default true
  const mode = (cfg.themeMode || '').toLowerCase(); // 'dark' | 'light' | 'auto' | 'user'
  const pack = sanitizePack(cfg.themePack);
  const layoutOverrideRaw =
    Object.prototype.hasOwnProperty.call(cfg, 'themeLayout') ? cfg.themeLayout :
    (Object.prototype.hasOwnProperty.call(cfg, 'layout') ? cfg.layout :
    (Object.prototype.hasOwnProperty.call(cfg, 'layoutPreset') ? cfg.layoutPreset : undefined));
  const hasLayoutOverride = layoutOverrideRaw !== undefined && layoutOverrideRaw !== null && layoutOverrideRaw !== '';
  const applyLayoutOverride = () => {
    if (!hasLayoutOverride) return;
    try { applyLayoutConfig(layoutOverrideRaw); } catch (err) { console.error('[theme] Failed to apply layout override:', err); }
  };

  const setMode = (m) => {
    if (m === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch (_) {}
    } else if (m === 'light') {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'light'); } catch (_) {}
    } else { // auto
      // Remove explicit choice to allow system preference to drive
      try { localStorage.removeItem('theme'); } catch (_) {}
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  };

  if (override) {
    if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
    else if (mode === 'user') {
      // Respect user choice entirely; if none, fall back to system preference
      applySavedTheme();
    }
    if (pack) {
      // Force pack and persist
      try { localStorage.setItem('themePack', pack); } catch (_) {}
      const promise = loadThemePack(pack);
      if (hasLayoutOverride) promise.then(applyLayoutOverride).catch(applyLayoutOverride);
    } else {
      applyLayoutOverride();
    }
  } else {
    // Respect user choice; but if site provides a default and no user choice exists,
    // apply it once without persisting as an override
    const hasUserTheme = (() => { try { return !!localStorage.getItem('theme'); } catch (_) { return false; } })();
    const hasUserPack = (() => { try { return !!localStorage.getItem('themePack'); } catch (_) { return false; } })();
    if (!hasUserTheme) {
      if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
      // When mode is 'user' and there's no saved user theme, do nothing here;
      // the boot code/applySavedTheme already applied system preference as a soft default.
    }
    if (!hasUserPack && pack) {
      const promise = loadThemePack(pack);
      if (hasLayoutOverride) promise.then(applyLayoutOverride).catch(applyLayoutOverride);
    } else if (hasLayoutOverride) {
      applyLayoutOverride();
    }
  }
}

export function bindThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const setDark = (on) => {
    if (on) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', on ? 'dark' : 'light'); } catch (_) {}
  };
  btn.addEventListener('click', () => setDark(!isDark()));
}

export function bindPostEditor() {
  const btn = document.getElementById('postEditor');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.open('index_editor.html', '_blank');
  });
}

export function bindThemePackPicker() {
  const sel = document.getElementById('themePack');
  if (!sel) return;
  // Initialize selection
  const saved = getSavedThemePack();
  sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    loadThemePack(val);
  });
}

// Render theme tools UI (button + select) into the sidebar, before TOC.
// Options are sourced from assets/themes/packs.json; falls back to defaults.
export function mountThemeControls() {
  // If already present, do nothing
  if (document.getElementById('tools')) return;
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'box';
  wrapper.id = 'tools';
  wrapper.innerHTML = `
    <div class="section-title">${t('tools.sectionTitle')}</div>
    <div class="tools tools-panel">
      <div class="tool-item">
        <button id="themeToggle" class="btn icon-btn" aria-label="Toggle light/dark" title="${t('tools.toggleTheme')}"><span class="icon">🌓</span><span class="btn-text">${t('tools.toggleTheme')}</span></button>
      </div>
      <div class="tool-item">
        <button id="postEditor" class="btn icon-btn" aria-label="Open Markdown Editor" title="${t('tools.postEditor')}"><span class="icon">📝</span><span class="btn-text">${t('tools.postEditor')}</span></button>
      </div>
      <div class="tool-item">
        <label for="themePack" class="tool-label">${t('tools.themePack')}</label>
        <select id="themePack" aria-label="${t('tools.themePack')}" title="${t('tools.themePack')}"></select>
      </div>
      <div class="tool-item">
        <label for="langSelect" class="tool-label">${t('tools.language')}</label>
        <select id="langSelect" aria-label="${t('tools.language')}" title="${t('tools.language')}"></select>
      </div>
      <div class="tool-item">
        <button id="langReset" class="btn icon-btn" aria-label="${t('tools.resetLanguage')}" title="${t('tools.resetLanguage')}"><span class="icon">♻️</span><span class="btn-text">${t('tools.resetLanguage')}</span></button>
      </div>
    </div>`;

  const toc = document.getElementById('tocview');
  if (toc && toc.parentElement === sidebar) sidebar.insertBefore(wrapper, toc);
  else sidebar.appendChild(wrapper);

  // Populate theme packs
  const sel = wrapper.querySelector('#themePack');
  const saved = getSavedThemePack();
  const fallback = [
    { value: 'native', label: 'Native' },
    { value: 'github', label: 'GitHub' },
    { value: 'apple', label: 'Apple' },
    { value: 'openai', label: 'OpenAI' },
  ];

  // Try to load from JSON; if it fails, use fallback
  fetch('assets/themes/packs.json').then(r => r.ok ? r.json() : Promise.reject()).then(list => {
    try {
      sel.innerHTML = '';
      (Array.isArray(list) ? list : []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = sanitizePack(p.value);
        opt.textContent = String(p.label || p.value || 'Theme');
        sel.appendChild(opt);
      });
      if (!sel.options.length) throw new Error('empty options');
    } catch (_) {
      throw _;
    }
  }).catch(() => {
    sel.innerHTML = '';
    fallback.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.value;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
  }).finally(() => {
    sel.value = saved;
  });

  // Populate language selector
  const langSel = wrapper.querySelector('#langSelect');
  if (langSel) {
    const langs = getAvailableLangs();
    langSel.innerHTML = '';
    langs.forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = getLanguageLabel(code);
      langSel.appendChild(opt);
    });
    langSel.value = getCurrentLang();
    langSel.addEventListener('change', () => {
      const val = langSel.value || 'en';
      switchLanguage(val);
    });
  }

  // Bind language reset button
  const resetBtn = wrapper.querySelector('#langReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Clear saved language and drop URL param, then soft-reset without full reload
      try { localStorage.removeItem('lang'); } catch (_) {}
      try { const url = new URL(window.location.href); url.searchParams.delete('lang'); history.replaceState(history.state, document.title, url.toString()); } catch (_) {}
      try { (window.__ns_softResetLang && window.__ns_softResetLang()); } catch (_) { /* fall through */ }
      // If soft reset isn't available for some reason, fall back to reload
      if (!window.__ns_softResetLang) {
        try { window.location.reload(); } catch (_) {}
      }
    });
  }
}

// Rebuild language selector options based on current available content langs
export function refreshLanguageSelector() {
  const sel = document.getElementById('langSelect');
  if (!sel) return;
  const current = getCurrentLang();
  const langs = getAvailableLangs();
  sel.innerHTML = '';
  langs.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = getLanguageLabel(code);
    sel.appendChild(opt);
  });
  sel.value = current;
}
