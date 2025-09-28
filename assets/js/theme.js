import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage, normalizeLangKey } from './i18n.js';

const PACK_LINK_ID = 'theme-pack';
const LAYOUT_STATE_KEY = '__ns_theme_layout_state';
const THEME_MANIFEST_URL = 'assets/themes/packs.json';

const DEFAULT_THEME_MANIFEST = [
  { id: 'native', label: 'Native', description: 'Balanced default layout with a right-aligned sidebar.' },
  { id: 'github', label: 'GitHub', description: 'GitHub-inspired list layout with flatter surfaces.' }
];

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

const themeConfigCache = new Map();
let themeManifest = DEFAULT_THEME_MANIFEST.map(entry => ({ ...entry }));
let manifestPromise = null;
let activeThemeVariables = new Set();
let activeThemeBodyClasses = new Set();

function resolveTextByLang(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const lang = (getCurrentLang && getCurrentLang()) || 'en';
    const normalized = normalizeLangKey ? normalizeLangKey(lang) : lang;
    const candidates = [lang, normalized, normalized?.replace('_', '-'), 'default', 'en'];
    for (const key of candidates) {
      if (!key) continue;
      if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) {
        return String(value[key]);
      }
    }
    const first = Object.values(value).find(v => v != null);
    return first != null ? String(first) : '';
  }
  return '';
}

function sanitizeBodyClass(cls) {
  const token = String(cls || '').trim();
  if (!token) return '';
  const clean = token.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean ? clean.toLowerCase() : '';
}

function sanitizeSidebar(value) {
  const val = String(value || '').toLowerCase();
  if (val === 'left') return 'left';
  if (val === 'hidden' || val === 'none' || val === 'off') return 'hidden';
  if (val === 'right') return 'right';
  return '';
}

function clearAppliedThemeDecorations() {
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return;
  activeThemeVariables.forEach(name => root.style.removeProperty(name));
  activeThemeVariables.clear();
  activeThemeBodyClasses.forEach(cls => {
    body.classList.remove(cls);
    root.classList.remove(cls);
  });
  activeThemeBodyClasses.clear();
  delete body.dataset.layoutSidebar;
}

function persistLayoutState(state) {
  try {
    const payload = { pack: sanitizePack(state.pack) };
    if (state.sidebar) payload.sidebar = sanitizeSidebar(state.sidebar);
    if (state.vars && Object.keys(state.vars).length) payload.vars = state.vars;
    if (state.bodyClasses && state.bodyClasses.length) payload.bodyClasses = state.bodyClasses;
    localStorage.setItem(LAYOUT_STATE_KEY, JSON.stringify(payload));
  } catch (_) { /* ignore */ }
}

function restoreLayoutState(pack) {
  if (!pack) return false;
  try {
    const raw = localStorage.getItem(LAYOUT_STATE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || sanitizePack(data.pack) !== pack) return false;
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return false;
    clearAppliedThemeDecorations();
    const sidebar = sanitizeSidebar(data.sidebar);
    if (sidebar) body.dataset.layoutSidebar = sidebar;
    if (data.vars && typeof data.vars === 'object') {
      for (const [key, value] of Object.entries(data.vars)) {
        const name = String(key || '').trim();
        if (!name.startsWith('--')) continue;
        const val = String(value ?? '');
        root.style.setProperty(name, val);
        activeThemeVariables.add(name);
      }
    }
    if (Array.isArray(data.bodyClasses)) {
      data.bodyClasses.map(sanitizeBodyClass).filter(Boolean).forEach(cls => {
        document.body.classList.add(cls);
        activeThemeBodyClasses.add(cls);
      });
    }
    return true;
  } catch (_) {
    return false;
  }
}

function normalizeThemeEntry(entry) {
  if (!entry) return null;
  const rawId = entry.id ?? entry.value ?? entry.name ?? entry.slug ?? entry.pack;
  const id = sanitizePack(rawId);
  if (!id) return null;
  return {
    id,
    label: entry.label ?? entry.name ?? rawId ?? id,
    description: entry.description ?? entry.desc ?? '',
    order: typeof entry.order === 'number' ? entry.order : 0
  };
}

function loadThemeManifestOnce() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(THEME_MANIFEST_URL, { cache: 'no-store' })
    .then(resp => (resp.ok ? resp.json() : Promise.reject()))
    .then(json => {
      const arr = Array.isArray(json) ? json : [];
      const normalized = arr.map(normalizeThemeEntry).filter(Boolean);
      if (!normalized.length) return DEFAULT_THEME_MANIFEST.map(entry => ({ ...entry }));
      normalized.sort((a, b) => (a.order - b.order) || resolveTextByLang(a.label).localeCompare(resolveTextByLang(b.label)));
      themeManifest = normalized;
      return normalized;
    })
    .catch(() => {
      themeManifest = DEFAULT_THEME_MANIFEST.map(entry => ({ ...entry }));
      return themeManifest;
    });
  return manifestPromise;
}

function fetchThemeConfig(pack) {
  if (!pack) return Promise.resolve(null);
  if (themeConfigCache.has(pack)) {
    const cached = themeConfigCache.get(pack);
    if (cached && typeof cached.then === 'function') return cached;
    return Promise.resolve(cached);
  }
  const url = `assets/themes/${encodeURIComponent(pack)}/theme.json`;
  const promise = fetch(url, { cache: 'no-store' })
    .then(resp => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    })
    .then(json => {
      const cfg = (json && typeof json === 'object' && !Array.isArray(json)) ? json : null;
      themeConfigCache.set(pack, cfg);
      return cfg;
    })
    .catch(() => {
      themeConfigCache.set(pack, null);
      return null;
    });
  themeConfigCache.set(pack, promise);
  return promise;
}

function applyThemePresentation(pack, cfg) {
  const config = (cfg && typeof cfg === 'object') ? cfg : {};
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) {
    persistLayoutState({ pack });
    return;
  }
  clearAppliedThemeDecorations();
  const state = { pack };
  const layout = config.layout || {};
  const sidebar = sanitizeSidebar(layout.sidebar ?? layout.sidebarPosition ?? layout.position);
  if (sidebar) {
    body.dataset.layoutSidebar = sidebar;
    state.sidebar = sidebar;
  }
  const vars = config.variables;
  if (vars && typeof vars === 'object') {
    const appliedVars = {};
    for (const [key, value] of Object.entries(vars)) {
      const name = String(key || '').trim();
      if (!name.startsWith('--')) continue;
      if (value == null) continue;
      const strVal = String(value);
      root.style.setProperty(name, strVal);
      activeThemeVariables.add(name);
      appliedVars[name] = strVal;
    }
    if (Object.keys(appliedVars).length) state.vars = appliedVars;
  }
  const rawClasses = config.bodyClass ?? config.bodyClasses ?? config.classes;
  const tokens = Array.isArray(rawClasses)
    ? rawClasses
    : typeof rawClasses === 'string'
      ? rawClasses.split(/\s+/)
      : [];
  const appliedClasses = tokens.map(sanitizeBodyClass).filter(Boolean);
  appliedClasses.forEach(cls => {
    body.classList.add(cls);
    root.classList.add(cls);
    activeThemeBodyClasses.add(cls);
  });
  if (appliedClasses.length) state.bodyClasses = appliedClasses;
  persistLayoutState(state);
}

function updateThemePackOptions(selectedId) {
  const sel = document.getElementById('themePack');
  if (!sel) return;
  const targetValue = sanitizePack(selectedId || sel.value || getSavedThemePack());
  sel.innerHTML = '';
  themeManifest.forEach(entry => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = resolveTextByLang(entry.label) || entry.id;
    sel.appendChild(opt);
  });
  if (!sel.options.length) return;
  const match = Array.from(sel.options).some(opt => opt.value === targetValue);
  sel.value = match ? targetValue : sel.options[0].value;
  updateThemeDescription(sel.value);
}

function updateThemeDescription(packId) {
  const note = document.getElementById('themePackDescription');
  if (!note) return;
  const id = sanitizePack(packId || getSavedThemePack());
  const entry = themeManifest.find(item => item.id === id);
  let desc = entry ? resolveTextByLang(entry.description) : '';
  const cached = themeConfigCache.get(id);
  if (!desc && cached && typeof cached === 'object' && !(cached instanceof Promise)) {
    desc = resolveTextByLang(cached.description);
  }
  note.textContent = desc || '';
  note.style.display = desc ? '' : 'none';
}

export function loadThemePack(name) {
  const pack = sanitizePack(name);
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
  const restored = restoreLayoutState(pack);
  if (!restored) {
    clearAppliedThemeDecorations();
    persistLayoutState({ pack });
  }
  updateThemeDescription(pack);
  fetchThemeConfig(pack)
    .then(cfg => {
      if (cfg) {
        applyThemePresentation(pack, cfg);
        updateThemeDescription(pack);
      } else {
        persistLayoutState({ pack });
      }
    })
    .catch(() => {
      persistLayoutState({ pack });
    });
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
      applySavedTheme();
    }
    if (pack) {
      try { localStorage.setItem('themePack', pack); } catch (_) {}
      loadThemePack(pack);
    }
  } else {
    const hasUserTheme = (() => { try { return !!localStorage.getItem('theme'); } catch (_) { return false; } })();
    const hasUserPack = (() => { try { return !!localStorage.getItem('themePack'); } catch (_) { return false; } })();
    if (!hasUserTheme) {
      if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
    }
    if (!hasUserPack && pack) loadThemePack(pack);
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
  const saved = getSavedThemePack();
  if (sel.value !== saved) sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    loadThemePack(val);
    updateThemeDescription(val);
  });
}

// Render theme tools UI (button + select) into the sidebar, before TOC.
export function mountThemeControls() {
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
        <p class="tool-note" id="themePackDescription" aria-live="polite"></p>
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

  updateThemePackOptions(getSavedThemePack());
  loadThemeManifestOnce().then(() => {
    updateThemePackOptions(getSavedThemePack());
  });

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

  const resetBtn = wrapper.querySelector('#langReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try { localStorage.removeItem('lang'); } catch (_) {}
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('lang');
        history.replaceState(history.state, document.title, url.toString());
      } catch (_) {}
      try { (window.__ns_softResetLang && window.__ns_softResetLang()); } catch (_) { /* fall through */ }
      if (!window.__ns_softResetLang) {
        try { window.location.reload(); } catch (_) {}
      }
    });
  }
}

// Rebuild language selector options based on current available content langs
export function refreshLanguageSelector() {
  const sel = document.getElementById('langSelect');
  if (sel) {
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
  updateThemePackOptions();
}
