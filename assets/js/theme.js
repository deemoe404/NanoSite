import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage, ensureLanguageBundle } from './i18n.js?v=20260506theme';
import { getThemeRegion } from './theme-regions.js';

const PACK_LINK_ID = 'theme-pack';
const THEME_CONTROLS_BOUND = Symbol('nanoThemeControlsBound');
const THEME_CONTROLS_I18N_BOUND = Symbol('nanoThemeControlsI18nBound');
let componentsReady = null;

function ensureNanoComponents() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof customElements === 'undefined') return null;
  try {
    if (customElements.get('nano-theme-controls')) return null;
  } catch (_) {
    return null;
  }
  if (!componentsReady) {
    componentsReady = import('./components.js').catch((err) => {
      console.warn('[theme] Failed to load nano components', err);
      return null;
    });
  }
  return componentsReady;
}

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

export function loadThemePack(name) {
  const pack = sanitizePack(name);
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  if (link) link.setAttribute('href', href);
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
      loadThemePack(pack);
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
    if (!hasUserPack && pack) loadThemePack(pack);
  }
}

export function bindThemeToggle() {
  if (document.querySelector('nano-theme-controls')) return;
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
  if (document.querySelector('nano-theme-controls')) return;
  const btn = document.getElementById('postEditor');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const editorUrl = 'index_editor.html';
    let popup = null;
    try {
      popup = window.open(editorUrl, '_blank');
    } catch (_) {
      popup = null;
    }
    if (!popup) {
      window.location.href = editorUrl;
      return;
    }
    try { popup.opener = null; } catch (_) {}
    try { popup.focus(); } catch (_) {}
  });
}

export function bindThemePackPicker() {
  if (document.querySelector('nano-theme-controls')) return;
  const sel = document.getElementById('themePack');
  if (!sel) return;
  // Initialize selection
  const saved = getSavedThemePack();
  sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    const current = getSavedThemePack();
    if (val === current) return;
    loadThemePack(val);
    try { window.location.reload(); } catch (_) {}
  });
}

function getThemeControlsElement(root = document) {
  return root && root.querySelector ? root.querySelector('nano-theme-controls') : null;
}

function getThemeControlLabels() {
  return {
    sectionTitle: t('tools.sectionTitle'),
    toggleTheme: t('tools.toggleTheme'),
    postEditor: t('tools.postEditor'),
    themePack: t('tools.themePack'),
    language: t('tools.language'),
    resetLanguage: t('tools.resetLanguage')
  };
}

function normalizePackList(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (!item) return;
    const value = sanitizePack(item.value || item.slug || item.name);
    if (!value || seen.has(value)) return;
    out.push({ value, label: String(item.label || item.name || value) });
    seen.add(value);
  });
  if (!out.length) out.push({ value: 'native', label: 'Native' });
  return out;
}

function getLanguageOptions() {
  try { ensureLanguageBundle(getCurrentLang()).catch(() => {}); } catch (_) {}
  return getAvailableLangs().map(code => ({
    value: code,
    label: getLanguageLabel(code)
  }));
}

function refreshThemeControlsLanguages(component) {
  if (!component || typeof component.setLanguages !== 'function') return;
  try { component.setLabels(getThemeControlLabels()); } catch (_) {}
  try { component.setLanguages(getLanguageOptions(), getCurrentLang()); } catch (_) {}
}

function openPostEditor() {
  const editorUrl = 'index_editor.html';
  let popup = null;
  try {
    popup = window.open(editorUrl, '_blank');
  } catch (_) {
    popup = null;
  }
  if (!popup) {
    window.location.href = editorUrl;
    return;
  }
  try { popup.opener = null; } catch (_) {}
  try { popup.focus(); } catch (_) {}
}

function bindThemeControlsComponent(component) {
  if (!component || component[THEME_CONTROLS_BOUND]) return;
  component[THEME_CONTROLS_BOUND] = true;
  if (!component[THEME_CONTROLS_I18N_BOUND] && typeof window !== 'undefined') {
    component[THEME_CONTROLS_I18N_BOUND] = true;
    window.addEventListener('ns:i18n-bundle-loaded', () => {
      try {
        if (!component.isConnected) return;
        refreshThemeControlsLanguages(component);
      } catch (_) {}
    });
  }
  component.addEventListener('nano:theme-toggle', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (dark) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('theme', dark ? 'light' : 'dark'); } catch (_) {}
  });
  component.addEventListener('nano:open-editor', () => openPostEditor());
  component.addEventListener('nano:theme-pack-change', (event) => {
    const detail = event && event.detail ? event.detail : {};
    const val = sanitizePack(detail.value) || 'native';
    const current = getSavedThemePack();
    if (val === current) return;
    loadThemePack(val);
    try { window.location.reload(); } catch (_) {}
  });
  component.addEventListener('nano:language-change', async (event) => {
    const detail = event && event.detail ? event.detail : {};
    const val = detail.value || 'en';
    try { await ensureLanguageBundle(val); } catch (_) {}
    switchLanguage(val);
  });
  component.addEventListener('nano:language-reset', () => {
    try { localStorage.removeItem('lang'); } catch (_) {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('lang');
      history.replaceState(history.state, document.title, url.toString());
    } catch (_) {}
    try {
      if (window.__ns_softResetLang) {
        window.__ns_softResetLang();
        return;
      }
    } catch (_) {}
    try { window.location.reload(); } catch (_) {}
  });
}

function populateThemeControls(component) {
  if (!component) return;
  refreshThemeControlsLanguages(component);
  try {
    ensureLanguageBundle(getCurrentLang())
      .then(() => { refreshThemeControlsLanguages(component); })
      .catch(() => {});
  } catch (_) {}
  try {
    fetch('assets/themes/packs.json')
      .then(r => r && r.ok ? r.json() : Promise.reject())
      .then(list => {
        component.setThemePacks(normalizePackList(list), getSavedThemePack());
      })
      .catch(() => {
        component.setThemePacks(normalizePackList([
          { value: 'native', label: 'Native' },
          { value: 'arcus', label: 'Arcus' },
          { value: 'solstice', label: 'Solstice' }
        ]), getSavedThemePack());
      });
  } catch (_) {
    component.setThemePacks(normalizePackList([{ value: 'native', label: 'Native' }]), getSavedThemePack());
  }
}

// Render theme tools UI through <nano-theme-controls>. Options are sourced from
// assets/themes/packs.json; legacy button/select binders remain below for older
// custom themes that have not migrated yet.
export function mountThemeControls(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const variant = String(opts.variant || document.body.dataset.themeLayout || 'native').toLowerCase();
  const componentImport = ensureNanoComponents();
  let component = null;
  const host = opts.host || null;

  if (host && host.matches && host.matches('nano-theme-controls')) {
    component = host;
  } else if (host && host.querySelector) {
    component = host.querySelector('nano-theme-controls');
    if (!component) {
      host.textContent = '';
      component = document.createElement('nano-theme-controls');
      host.appendChild(component);
    }
  } else {
    component = getThemeControlsElement(document);
    if (!component) {
      const legacyTools = document.getElementById('tools');
      if (legacyTools && legacyTools.parentElement) {
        component = document.createElement('nano-theme-controls');
        legacyTools.parentElement.replaceChild(component, legacyTools);
      }
    }
    if (!component) {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      component = document.createElement('nano-theme-controls');
      const toc = getThemeRegion(['toc', 'tocBox', 'tocview'], '#tocview');
      if (toc && toc.parentElement === sidebar) sidebar.insertBefore(component, toc);
      else sidebar.appendChild(component);
    }
  }

  const finish = () => {
    component.setAttribute('variant', variant);
    const upgraded = typeof component.render === 'function' && typeof component.setLabels === 'function';
    if (!upgraded && componentImport) return;
    try { if (typeof component.render === 'function') component.render(); } catch (_) {}
    bindThemeControlsComponent(component);
    if (upgraded) populateThemeControls(component);
  };
  finish();
  if (componentImport && typeof componentImport.then === 'function') {
    componentImport.then(() => {
      try { finish(); } catch (_) {}
    });
  }
  return component;
}

// Rebuild language selector options based on supported UI languages
export function refreshLanguageSelector() {
  const component = getThemeControlsElement(document);
  if (component && typeof component.setLanguages === 'function') {
    try {
      refreshThemeControlsLanguages(component);
      component.setCurrentPack(getSavedThemePack());
      return;
    } catch (_) {}
  }
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

try {
  window.addEventListener('ns:i18n-bundle-loaded', (event) => {
    const sel = document.getElementById('langSelect');
    if (!sel) return;
    const detail = event && event.detail ? event.detail : {};
    const lang = (detail.lang || '').toLowerCase();
    if (!lang) return;
    const current = (getCurrentLang && getCurrentLang()) || '';
    if ((sel.value && sel.value.toLowerCase() === lang) || (current && current.toLowerCase() === lang)) {
      try { refreshLanguageSelector(); } catch (_) {}
    }
  });
} catch (_) {}
