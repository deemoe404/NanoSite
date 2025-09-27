import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage } from './i18n.js';

const PACK_LINK_ID = 'theme-pack';
const AUTO_LAYOUT_VALUE = '__theme_auto__';
const MANIFEST_CACHE = new Map();
const ACTIVE_EXTRA_STYLE_ATTR = 'data-theme-extra';
const ACTIVE_LAYOUT_STYLE_ATTR = 'data-theme-layout-style';

let activeThemePack = null;
let activeThemeManifest = null;
let activeLayoutId = null;
let layoutCleanup = null;
let layoutStyleCleanupFns = [];
let themeExtraLinks = [];
let themeLoadToken = 0;
let siteLayoutPreference = null; // { pack: string|null, layout: string }
let siteLayoutLock = false;

let layoutSelectRef = null;
let layoutSelectWrapRef = null;

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function sanitizeLayoutId(input) {
  if (input == null) return '';
  const s = String(input).toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean;
}

function sanitizeResourcePath(input) {
  if (!input && input !== 0) return '';
  const s = String(input).trim();
  if (!s) return '';
  if (s.includes('..') || s.includes('\\') || s.startsWith('/')) return '';
  if (!/^[a-zA-Z0-9_./-]+$/.test(s)) return '';
  return s.replace(/\\/g, '/');
}

function createFallbackManifest(pack) {
  const id = sanitizePack(pack);
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    description: '',
    additionalStyles: [],
    layouts: [{ id: 'default', label: 'Default', module: '', styles: [] }],
    defaultLayout: 'default'
  };
}

function normalizeLayoutEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const id = sanitizeLayoutId(entry);
    if (!id) return null;
    return { id, label: entry, module: '', styles: [] };
  }
  if (typeof entry !== 'object') return null;
  const id = sanitizeLayoutId(entry.id || entry.value || entry.layout || '');
  if (!id) return null;
  const labelSource = entry.label || entry.name || entry.title || id;
  const label = String(labelSource).trim() || id;
  const module = sanitizeResourcePath(entry.module || entry.script || '');
  const stylesRaw = Array.isArray(entry.styles) ? entry.styles : (typeof entry.style === 'string' ? [entry.style] : []);
  const styles = stylesRaw.map(sanitizeResourcePath).filter(Boolean);
  return {
    id,
    label,
    module,
    styles
  };
}

function normalizeManifest(pack, raw) {
  const base = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const manifest = createFallbackManifest(pack);
  if (base && typeof base === 'object') {
    if (typeof base.id === 'string') manifest.id = sanitizePack(base.id) || manifest.id;
    if (typeof base.label === 'string' && base.label.trim()) manifest.label = base.label.trim();
    else if (typeof base.name === 'string' && base.name.trim()) manifest.label = base.name.trim();
    if (typeof base.description === 'string') manifest.description = base.description.trim();
    const extras = Array.isArray(base.additionalStyles) ? base.additionalStyles :
      (typeof base.styles === 'string' ? [base.styles] : []);
    manifest.additionalStyles = extras.map(sanitizeResourcePath).filter(Boolean);
    const layouts = Array.isArray(base.layouts) ? base.layouts.map(normalizeLayoutEntry).filter(Boolean) : [];
    if (layouts.length) manifest.layouts = layouts;
    const def = sanitizeLayoutId(base.defaultLayout || base.default);
    if (def) manifest.defaultLayout = def;
  }
  // Ensure unique layout IDs
  const seen = new Set();
  manifest.layouts = manifest.layouts.filter((layout) => {
    if (!layout || !layout.id) return false;
    if (seen.has(layout.id)) return false;
    seen.add(layout.id);
    return true;
  });
  if (!manifest.layouts.length) {
    manifest.layouts = [{ id: 'default', label: 'Default', module: '', styles: [] }];
  }
  if (!manifest.defaultLayout || !manifest.layouts.some(l => l.id === manifest.defaultLayout)) {
    manifest.defaultLayout = manifest.layouts[0].id;
  }
  return manifest;
}

async function loadThemeManifest(pack) {
  const sanitized = sanitizePack(pack);
  if (!MANIFEST_CACHE.has(sanitized)) {
    const url = `assets/themes/${encodeURIComponent(sanitized)}/manifest.json`;
    const promise = fetch(url).then(resp => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    }).then(data => normalizeManifest(sanitized, data)).catch(() => createFallbackManifest(sanitized));
    MANIFEST_CACHE.set(sanitized, promise);
  }
  try {
    return await MANIFEST_CACHE.get(sanitized);
  } catch (_) {
    return createFallbackManifest(sanitized);
  }
}

function getLayoutFromManifest(manifest, id) {
  if (!manifest || !manifest.layouts) return null;
  const target = sanitizeLayoutId(id);
  if (!target) return null;
  return manifest.layouts.find(layout => layout.id === target) || null;
}

function storageKeyForLayout(pack) {
  return `themeLayout:${sanitizePack(pack)}`;
}

function getSavedLayout(pack) {
  try {
    const key = storageKeyForLayout(pack);
    const raw = localStorage.getItem(key);
    return sanitizeLayoutId(raw || '');
  } catch (_) {
    return '';
  }
}

function setSavedLayout(pack, layoutId) {
  const key = storageKeyForLayout(pack);
  try {
    if (!layoutId) localStorage.removeItem(key);
    else localStorage.setItem(key, sanitizeLayoutId(layoutId));
  } catch (_) { /* ignore */ }
}

function ensureLayoutControls() {
  if (!layoutSelectRef) {
    layoutSelectRef = document.getElementById('themeLayout');
  }
  if (!layoutSelectWrapRef) {
    layoutSelectWrapRef = document.getElementById('themeLayoutControl');
  }
}

function removeExtraStyleLinks(list) {
  (list || []).forEach((link) => {
    if (!link) return;
    try { if (link.parentNode) link.parentNode.removeChild(link); } catch (_) {}
  });
}

function applyAdditionalStyles(manifest, pack) {
  removeExtraStyleLinks(themeExtraLinks);
  themeExtraLinks = [];
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head || !manifest || !Array.isArray(manifest.additionalStyles)) return;
  manifest.additionalStyles.forEach(stylePath => {
    if (!stylePath) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(ACTIVE_EXTRA_STYLE_ATTR, pack);
    link.href = `assets/themes/${encodeURIComponent(pack)}/${stylePath}`;
    head.appendChild(link);
    themeExtraLinks.push(link);
  });
}

function cleanupLayoutStyles() {
  removeExtraStyleLinks(layoutStyleCleanupFns);
  layoutStyleCleanupFns = [];
}

function cleanupLayout() {
  cleanupLayoutStyles();
  if (typeof layoutCleanup === 'function') {
    try { layoutCleanup(); } catch (_) { /* ignore */ }
  }
  layoutCleanup = null;
  activeLayoutId = null;
}

function createLayoutContext(pack, manifest, layout) {
  const cleanupTasks = [];
  const ctx = {
    pack,
    manifest,
    layout,
    root: document.documentElement,
    body: document.body,
    container: document.querySelector('.container'),
    content: document.querySelector('.content'),
    sidebar: document.querySelector('.sidebar'),
    main: document.getElementById('mainview'),
    nav: document.getElementById('tabsNav'),
    mapview: document.getElementById('mapview'),
    tagview: document.getElementById('tagview'),
    tocview: document.getElementById('tocview'),
    tools: document.getElementById('tools'),
    onCleanup(fn) { if (typeof fn === 'function') cleanupTasks.push(fn); },
    addClass(el, cls) {
      if (!el || !cls) return;
      const classes = String(cls).split(/\s+/).filter(Boolean);
      classes.forEach((c) => {
        if (!c) return;
        try {
          el.classList.add(c);
          cleanupTasks.push(() => { try { el.classList.remove(c); } catch (_) {} });
        } catch (_) {}
      });
    },
    setAttribute(el, name, value) {
      if (!el || !name) return;
      const prev = el.getAttribute(name);
      try { el.setAttribute(name, value); } catch (_) {}
      cleanupTasks.push(() => {
        try {
          if (prev == null) el.removeAttribute(name);
          else el.setAttribute(name, prev);
        } catch (_) {}
      });
    }
  };
  ctx.cleanup = () => {
    cleanupTasks.reverse().forEach((fn) => {
      try { fn(); } catch (_) { /* ignore */ }
    });
  };
  return ctx;
}

async function applyLayoutStyles(pack, layout) {
  cleanupLayoutStyles();
  if (!layout || !Array.isArray(layout.styles) || !layout.styles.length) return;
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  layout.styles.forEach((stylePath) => {
    if (!stylePath) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(ACTIVE_LAYOUT_STYLE_ATTR, `${pack}:${layout.id}`);
    link.href = `assets/themes/${encodeURIComponent(pack)}/${stylePath}`;
    head.appendChild(link);
    layoutStyleCleanupFns.push(link);
  });
}

async function runLayoutModule(pack, manifest, layout) {
  cleanupLayout();
  if (!layout) {
    activeLayoutId = null;
    return;
  }
  await applyLayoutStyles(pack, layout);
  const ctx = createLayoutContext(pack, manifest, layout);
  let applied = false;
  if (layout.module) {
    try {
      const moduleUrl = new URL(`../themes/${encodeURIComponent(pack)}/${layout.module}`, import.meta.url);
      const mod = await import(moduleUrl.href);
      const handler = (mod && typeof mod.apply === 'function') ? mod.apply :
        (mod && typeof mod.default === 'function' ? mod.default : null);
      if (handler) {
        const result = await handler(ctx);
        if (typeof result === 'function') ctx.onCleanup(result);
        applied = true;
      }
    } catch (_) { /* ignore module errors */ }
  }
  if (!applied) {
    // No module or failed to apply; ensure cleanup still works
  }
  layoutCleanup = () => {
    ctx.cleanup();
  };
  activeLayoutId = layout.id;
  try { document.documentElement.setAttribute('data-theme-layout', layout.id); } catch (_) {}
}

function isSitePreferenceApplicable(pack) {
  if (!siteLayoutPreference || !siteLayoutPreference.layout) return false;
  if (siteLayoutPreference.pack && siteLayoutPreference.pack !== pack) return false;
  return true;
}

function getSitePreferredLayout(manifest, pack) {
  if (!isSitePreferenceApplicable(pack)) return null;
  return getLayoutFromManifest(manifest, siteLayoutPreference.layout);
}

function isLayoutLockedForActivePack() {
  if (!activeThemePack || !siteLayoutLock || !siteLayoutPreference || !siteLayoutPreference.layout) return false;
  if (siteLayoutPreference.pack && siteLayoutPreference.pack !== activeThemePack) return false;
  if (!activeThemeManifest) return false;
  return !!getLayoutFromManifest(activeThemeManifest, siteLayoutPreference.layout);
}

function parseConfigLayout(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    const splitter = raw.includes('/') ? '/' : (raw.includes(':') ? ':' : null);
    if (splitter) {
      const [packPart, layoutPart] = raw.split(splitter, 2);
      const layout = sanitizeLayoutId(layoutPart);
      if (!layout) return null;
      const pack = sanitizePack(packPart);
      return { pack: pack || null, layout };
    }
    const layout = sanitizeLayoutId(raw);
    if (!layout) return null;
    return { pack: null, layout };
  }
  if (value && typeof value === 'object') {
    const layout = sanitizeLayoutId(value.layout || value.id || value.value || '');
    if (!layout) return null;
    const packCandidate = value.pack != null ? value.pack : (value.themePack != null ? value.themePack : null);
    const pack = packCandidate ? sanitizePack(packCandidate) : null;
    return { pack: pack || null, layout };
  }
  return null;
}

function reapplyActiveLayout(reason, requestedLayoutId) {
  if (!activeThemePack) return;
  applyLayoutForPack(activeThemePack, requestedLayoutId || '', { reason, token: themeLoadToken }).catch(() => {});
}

function handleLayoutSelection(value) {
  ensureLayoutControls();
  if (!layoutSelectRef) return;
  if (!activeThemePack) {
    layoutSelectRef.value = AUTO_LAYOUT_VALUE;
    return;
  }
  if (isLayoutLockedForActivePack()) {
    // Revert to locked layout
    const lockedId = siteLayoutPreference && siteLayoutPreference.layout;
    if (lockedId && layoutSelectRef.value !== lockedId) {
      layoutSelectRef.value = lockedId;
    }
    reapplyActiveLayout('site-lock', lockedId || '');
    return;
  }
  if (value === AUTO_LAYOUT_VALUE || !value) {
    setSavedLayout(activeThemePack, '');
    reapplyActiveLayout('user-auto', '');
    return;
  }
  const sanitized = sanitizeLayoutId(value);
  if (!sanitized) {
    setSavedLayout(activeThemePack, '');
    reapplyActiveLayout('user-auto', '');
    return;
  }
  setSavedLayout(activeThemePack, sanitized);
  applyLayoutForPack(activeThemePack, sanitized, { reason: 'user', token: themeLoadToken }).catch(() => {});
}

function updateLayoutSelectorUI(manifest, layout, options = {}) {
  ensureLayoutControls();
  if (!layoutSelectRef || !layoutSelectWrapRef) return;
  const layouts = (manifest && manifest.layouts) ? manifest.layouts : [];
  const shouldShow = layouts.length > 1 || options.alwaysShow || options.locked || !!siteLayoutPreference;
  if (!shouldShow) {
    layoutSelectWrapRef.hidden = true;
    layoutSelectRef.innerHTML = '';
    return;
  }

  layoutSelectWrapRef.hidden = false;
  layoutSelectRef.innerHTML = '';

  const activeLayoutLabel = layout ? layout.label : '';
  const autoOption = document.createElement('option');
  let autoLabel = t('tools.themeLayoutAuto');
  if (!options.locked && options.selectionValue === AUTO_LAYOUT_VALUE && activeLayoutLabel) {
    autoLabel = `${autoLabel} (${activeLayoutLabel})`;
  }
  autoOption.value = AUTO_LAYOUT_VALUE;
  autoOption.textContent = autoLabel;
  layoutSelectRef.appendChild(autoOption);

  layouts.forEach((entry) => {
    if (!entry || !entry.id) return;
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.label || entry.id;
    layoutSelectRef.appendChild(opt);
  });

  const selection = options.selectionValue || AUTO_LAYOUT_VALUE;
  layoutSelectRef.value = layouts.some(l => l.id === selection) || selection === AUTO_LAYOUT_VALUE ? selection : AUTO_LAYOUT_VALUE;
  layoutSelectRef.disabled = !!options.locked;
  layoutSelectRef.title = options.locked ? t('tools.themeLayoutLocked') : t('tools.themeLayout');
  layoutSelectWrapRef.dataset.locked = options.locked ? '1' : '0';
}

async function applyLayoutForPack(pack, requestedLayoutId, options = {}) {
  const manifest = await loadThemeManifest(pack);
  if (themeLoadToken !== options.token) return { manifest, layout: null, source: 'stale' };
  activeThemeManifest = manifest;

  const siteCandidate = getSitePreferredLayout(manifest, pack);
  const savedLayout = getSavedLayout(pack);
  const savedCandidate = getLayoutFromManifest(manifest, savedLayout);
  const requestedCandidate = requestedLayoutId ? getLayoutFromManifest(manifest, requestedLayoutId) : null;

  let layout = null;
  let source = 'auto';

  if (siteLayoutLock && siteCandidate) {
    layout = siteCandidate;
    source = 'site-lock';
  } else if (requestedCandidate) {
    layout = requestedCandidate;
    source = options.reason === 'user' ? 'user' : 'requested';
  } else if (savedCandidate) {
    layout = savedCandidate;
    source = 'saved';
  } else if (siteCandidate) {
    layout = siteCandidate;
    source = 'config-default';
  } else {
    layout = getLayoutFromManifest(manifest, manifest.defaultLayout) || (manifest.layouts ? manifest.layouts[0] : null);
    source = 'auto';
  }

  if (!layout && manifest.layouts && manifest.layouts.length) {
    layout = manifest.layouts[0];
    source = 'auto';
  }

  if (!layout) {
    cleanupLayout();
    try { document.documentElement.removeAttribute('data-theme-layout'); } catch (_) {}
    updateLayoutSelectorUI(manifest, null, { selectionValue: AUTO_LAYOUT_VALUE, locked: siteLayoutLock && !!siteCandidate });
    return { manifest, layout: null, source };
  }

  if (activeThemePack === pack && activeLayoutId === layout.id) {
    const selectionValue = (source === 'user' || source === 'saved' || source === 'site-lock') ? layout.id : AUTO_LAYOUT_VALUE;
    updateLayoutSelectorUI(manifest, layout, { selectionValue, locked: siteLayoutLock && siteCandidate && siteCandidate.id === layout.id });
    try { document.documentElement.setAttribute('data-theme-layout', layout.id); } catch (_) {}
    return { manifest, layout, source };
  }

  await runLayoutModule(pack, manifest, layout);
  const selectionValue = (source === 'user' || source === 'saved' || source === 'site-lock' || source === 'requested') ? layout.id : AUTO_LAYOUT_VALUE;
  updateLayoutSelectorUI(manifest, layout, { selectionValue, locked: siteLayoutLock && siteCandidate && siteCandidate.id === layout.id });
  return { manifest, layout, source };
}

function setThemePackLink(pack) {
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
}

async function activateThemePack(pack, options = {}) {
  const token = ++themeLoadToken;
  const sanitized = sanitizePack(pack);
  setThemePackLink(sanitized);
  try { document.documentElement.setAttribute('data-theme-pack', sanitized); } catch (_) {}
  if (activeThemePack && activeThemePack !== sanitized) {
    cleanupLayout();
    removeExtraStyleLinks(themeExtraLinks);
    themeExtraLinks = [];
  }
  activeThemePack = sanitized;
  const manifest = await loadThemeManifest(sanitized);
  if (token !== themeLoadToken) return;
  activeThemeManifest = manifest;
  applyAdditionalStyles(manifest, sanitized);
  await applyLayoutForPack(sanitized, options.layout || '', { reason: options.reason, token });
}

export function loadThemePack(name, options = {}) {
  const pack = sanitizePack(name);
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  activateThemePack(pack, options).catch(() => {});
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
  loadThemePack(getSavedThemePack());
}

// Apply theme according to site config. When override = true, it forces the
// site-defined values and updates localStorage to keep UI in sync.
export function applyThemeConfig(siteConfig) {
  const cfg = siteConfig || {};
  const override = cfg.themeOverride !== false; // default true
  const mode = (cfg.themeMode || '').toLowerCase(); // 'dark' | 'light' | 'auto' | 'user'
  const pack = sanitizePack(cfg.themePack);
  const layoutPref = parseConfigLayout(cfg.themeLayout);
  siteLayoutPreference = layoutPref;
  siteLayoutLock = !!(layoutPref && cfg.themeLayoutOverride !== false);

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
      loadThemePack(pack, { reason: 'site-config' });
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
    if (!hasUserPack && pack) loadThemePack(pack, { reason: 'site-config' });
  }

  if (layoutPref) {
    if (siteLayoutLock) reapplyActiveLayout('site-lock', layoutPref.layout);
    else reapplyActiveLayout('config-default', '');
  } else {
    siteLayoutLock = false;
    reapplyActiveLayout('auto', '');
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
    sel.value = val;
    loadThemePack(val, { reason: 'user' });
  });
}

export function bindThemeLayoutPicker() {
  ensureLayoutControls();
  if (!layoutSelectRef) return;
  if (!layoutSelectRef.__nsLayoutBound) {
    layoutSelectRef.addEventListener('change', () => {
      handleLayoutSelection(layoutSelectRef.value);
    });
    layoutSelectRef.__nsLayoutBound = true;
  }
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
      <div class="tool-item" id="themeLayoutControl">
        <label for="themeLayout" class="tool-label">${t('tools.themeLayout')}</label>
        <select id="themeLayout" aria-label="${t('tools.themeLayout')}" title="${t('tools.themeLayout')}"></select>
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
  layoutSelectRef = wrapper.querySelector('#themeLayout');
  layoutSelectWrapRef = wrapper.querySelector('#themeLayoutControl');
  if (layoutSelectRef) {
    layoutSelectRef.innerHTML = '';
    layoutSelectRef.value = AUTO_LAYOUT_VALUE;
  }
  if (layoutSelectWrapRef) {
    layoutSelectWrapRef.hidden = true;
  }
  const saved = getSavedThemePack();
  const fallback = [
    { value: 'native', label: 'Native' },
    { value: 'github', label: 'GitHub' },
    { value: 'atlas', label: 'Atlas' },
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

  bindThemeLayoutPicker();

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
