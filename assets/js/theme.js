
import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage } from './i18n.js';

const PACK_LINK_ID = 'theme-pack';

function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function sanitizeModuleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function toClassArray(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/\s+/);
  return list.map(v => String(v || '').trim()).filter(Boolean);
}

const DEFAULT_AREAS = [
  { name: 'main', classes: ['content'], modules: ['tabs', 'main'] },
  { name: 'sidebar', classes: ['sidebar'], modules: ['search', 'site-card', 'tags', 'tools', 'toc'] }
];

const SINGLE_COLUMN_AREAS = [
  { name: 'main', classes: ['content'], modules: ['tabs', 'main', 'tags'] },
  { name: 'support', classes: ['sidebar'], modules: ['search', 'site-card', 'tools', 'toc'] }
];

const BASE_MANIFEST = {
  version: 1,
  name: 'native',
  label: 'Native Classic',
  description: 'Classic two-column layout with a right sidebar.',
  variables: {
    '--ns-shell-gap': '1.5rem',
    '--ns-shell-max-width': 'min(75rem, calc(100% - 2.5rem))'
  },
  shellClasses: ['container'],
  bodyClasses: [],
  layoutClasses: [],
  layout: {
    preset: 'two-column',
    sidebarPosition: 'right',
    variables: {
      '--ns-sidebar-width': 'min(20rem, 100%)'
    },
    areas: DEFAULT_AREAS.map(area => ({
      name: area.name,
      classes: [...area.classes],
      modules: [...area.modules],
      as: 'div'
    }))
  }
};

const MODULE_REGISTRY = new Map();
let modulesRegistered = false;
const manifestCache = new Map();
const appliedRootVars = new Set();
const appliedShellVars = new Set();
const appliedBodyClasses = new Set();
const appliedShellClasses = new Set();
let currentLayoutKey = '';
let currentPackName = '';
let currentLayoutOverride = null;

const DEFAULT_THEME_MANIFEST = normalizeManifest(BASE_MANIFEST, 'native');

function formatLabelFromPack(pack) {
  const slug = String(pack || '').replace(/[_-]+/g, ' ').trim();
  if (!slug) return 'Theme';
  return slug.replace(/\b\w/g, ch => ch.toUpperCase());
}

function cloneArea(area) {
  return {
    name: area.name,
    classes: Array.isArray(area.classes) ? [...area.classes] : toClassArray(area.classes),
    modules: Array.isArray(area.modules) ? [...area.modules] : [],
    as: area.as || 'div'
  };
}

function normalizeArea(area) {
  if (!area || typeof area !== 'object') return null;
  const modules = Array.isArray(area.modules)
    ? area.modules.map(sanitizeModuleKey).filter(Boolean)
    : [];
  const classes = toClassArray(area.classes || area.class);
  const tag = (typeof area.as === 'string' && area.as.trim()) ? area.as.trim() : 'div';
  const nameRaw = area.name != null ? String(area.name).trim() : '';
  const name = nameRaw ? nameRaw.toLowerCase() : '';
  return {
    name,
    classes,
    modules,
    as: tag
  };
}

function mergeLayoutSpec(base, override) {
  const baseLayout = base && typeof base === 'object' ? base : {};
  const src = override && typeof override === 'object' ? override : {};
  const preset = src.preset || baseLayout.preset || 'two-column';
  const mergedClasses = toClassArray(src.classes || src.class);
  const result = {
    preset,
    sidebarPosition: src.sidebarPosition || baseLayout.sidebarPosition || 'right',
    classes: mergedClasses.length ? mergedClasses : toClassArray(baseLayout.classes),
    variables: { ...(baseLayout.variables || {}) },
    hiddenModules: Array.isArray(src.hiddenModules)
      ? src.hiddenModules.map(sanitizeModuleKey).filter(Boolean)
      : Array.isArray(baseLayout.hiddenModules)
        ? baseLayout.hiddenModules.map(sanitizeModuleKey).filter(Boolean)
        : []
  };

  if (src.variables && typeof src.variables === 'object') {
    Object.assign(result.variables, src.variables);
  }

  if (src.maxWidth) result.maxWidth = String(src.maxWidth);
  else if (baseLayout.maxWidth) result.maxWidth = baseLayout.maxWidth;

  if (src.gap) result.gap = String(src.gap);
  else if (baseLayout.gap) result.gap = baseLayout.gap;

  const areasSource = Array.isArray(src.areas) && src.areas.length
    ? src.areas
    : (Array.isArray(baseLayout.areas) && baseLayout.areas.length
      ? baseLayout.areas
      : (preset === 'single-column' ? SINGLE_COLUMN_AREAS : DEFAULT_AREAS));

  result.areas = areasSource.map(cloneArea).map(normalizeArea).filter(Boolean);
  return result;
}

function normalizeManifest(raw, pack, base = BASE_MANIFEST) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const baseManifest = base && typeof base === 'object' ? base : {};
  const layout = mergeLayoutSpec(baseManifest.layout, src.layout);
  const variables = { ...(baseManifest.variables || {}) };
  if (src.variables && typeof src.variables === 'object') {
    Object.entries(src.variables).forEach(([key, value]) => {
      variables[String(key)] = value;
    });
  }

  const shellClasses = toClassArray(src.shellClasses);
  const bodyClasses = toClassArray(src.bodyClasses);
  const layoutClasses = toClassArray(src.layoutClasses);

  const name = src.name ? String(src.name) : (pack || baseManifest.name || 'theme');
  const label = src.label
    ? String(src.label)
    : (src.name ? String(src.name) : (pack && pack !== 'native' ? formatLabelFromPack(pack) : (baseManifest.label || formatLabelFromPack(pack))));
  const description = src.description != null ? String(src.description) : (baseManifest.description || '');

  return {
    version: src.version != null ? src.version : (baseManifest.version || 1),
    name,
    label,
    description,
    variables,
    shellClasses: shellClasses.length ? shellClasses : toClassArray(baseManifest.shellClasses),
    bodyClasses: bodyClasses.length ? bodyClasses : toClassArray(baseManifest.bodyClasses),
    layoutClasses: layoutClasses.length ? layoutClasses : toClassArray(baseManifest.layoutClasses),
    layout,
    pack: pack || src.pack || baseManifest.pack || 'native'
  };
}

function sanitizeLayoutOverride(value) {
  if (!value || typeof value !== 'object') return null;
  const override = { ...value };
  if (override.areas && Array.isArray(override.areas)) {
    override.areas = override.areas.map(normalizeArea).filter(Boolean);
  }
  if (override.hiddenModules && Array.isArray(override.hiddenModules)) {
    override.hiddenModules = override.hiddenModules.map(sanitizeModuleKey).filter(Boolean);
  }
  if (override.variables && typeof override.variables === 'object') {
    override.variables = { ...override.variables };
  }
  if (override.rootVariables && typeof override.rootVariables === 'object') {
    override.rootVariables = { ...override.rootVariables };
  }
  if (override.shellClasses) override.shellClasses = toClassArray(override.shellClasses);
  if (override.bodyClasses) override.bodyClasses = toClassArray(override.bodyClasses);
  if (override.layoutClasses) override.layoutClasses = toClassArray(override.layoutClasses);
  if (override.classes) override.classes = toClassArray(override.classes);
  return override;
}

function buildFinalManifest(manifest, override) {
  const base = manifest || DEFAULT_THEME_MANIFEST;
  const layoutOverride = sanitizeLayoutOverride(override);
  const result = {
    version: base.version,
    name: base.name,
    label: base.label,
    description: base.description,
    variables: { ...(base.variables || {}) },
    shellClasses: [...toClassArray(base.shellClasses)],
    bodyClasses: [...toClassArray(base.bodyClasses)],
    layoutClasses: [...toClassArray(base.layoutClasses)],
    layout: mergeLayoutSpec(base.layout, layoutOverride),
    pack: base.pack
  };

  if (layoutOverride) {
    if (layoutOverride.rootVariables) Object.assign(result.variables, layoutOverride.rootVariables);
    if (layoutOverride.shellClasses) result.shellClasses = [...layoutOverride.shellClasses];
    if (layoutOverride.bodyClasses) result.bodyClasses = [...layoutOverride.bodyClasses];
    if (layoutOverride.layoutClasses) result.layoutClasses = [...layoutOverride.layoutClasses];
    if (layoutOverride.classes) result.layout.classes = layoutOverride.classes;
  }

  return result;
}

function computeLayoutKey(manifest, pack) {
  try {
    return JSON.stringify({
      pack: pack || manifest.pack,
      layout: manifest.layout,
      variables: manifest.variables,
      shellClasses: manifest.shellClasses,
      bodyClasses: manifest.bodyClasses,
      layoutClasses: manifest.layoutClasses
    });
  } catch (_) {
    return `${pack || manifest.pack || 'theme'}::${Date.now()}`;
  }
}

function getShellElement() {
  return document.querySelector('[data-ns-shell]') || document.getElementById('ns-shell');
}

function ensureModulesRegistered() {
  if (modulesRegistered) return;
  modulesRegistered = true;
  document.querySelectorAll('[data-ns-module]').forEach((el) => {
    const key = sanitizeModuleKey(el.getAttribute('data-ns-module'));
    if (!key) return;
    MODULE_REGISTRY.set(key, el);
    el.classList.add('ns-module', `ns-module-${key.replace(/[^a-z0-9]+/g, '-')}`);
  });
}

function applyCssVariables(target, vars, tracker) {
  if (!target) return;
  const nextKeys = new Set();
  if (vars && typeof vars === 'object') {
    Object.entries(vars).forEach(([k, v]) => {
      const name = String(k).startsWith('--') ? String(k) : `--${String(k)}`;
      if (v == null) return;
      target.style.setProperty(name, String(v));
      nextKeys.add(name);
    });
  }
  tracker.forEach((key) => {
    if (!nextKeys.has(key)) target.style.removeProperty(key);
  });
  tracker.clear();
  nextKeys.forEach(key => tracker.add(key));
}

function applyClassSet(target, base, extras, tracker) {
  if (!target) return;
  const next = new Set(Array.isArray(base) ? base.map(String) : []);
  (Array.isArray(extras) ? extras : []).forEach(cls => {
    const val = String(cls || '').trim();
    if (val) next.add(val);
  });
  tracker.forEach(cls => {
    if (!next.has(cls)) target.classList.remove(cls);
  });
  next.forEach(cls => target.classList.add(cls));
  tracker.clear();
  next.forEach(cls => tracker.add(cls));
}

function applyThemeManifest(manifest, { pack, force } = {}) {
  ensureModulesRegistered();
  const shell = getShellElement();
  if (!shell) return manifest;

  const manifestKey = computeLayoutKey(manifest, pack);
  if (!force && manifestKey === currentLayoutKey) return manifest;
  currentLayoutKey = manifestKey;

  applyClassSet(document.body, ['ns-theme-ready'], manifest.bodyClasses, appliedBodyClasses);
  applyClassSet(shell, ['ns-shell'], manifest.shellClasses, appliedShellClasses);

  applyCssVariables(document.documentElement, manifest.variables, appliedRootVars);
  const layoutVars = (manifest.layout && manifest.layout.variables) || {};
  applyCssVariables(shell, layoutVars, appliedShellVars);

  if (manifest.layout && manifest.layout.maxWidth) {
    shell.style.setProperty('--ns-shell-max-width', manifest.layout.maxWidth);
  } else {
    shell.style.removeProperty('--ns-shell-max-width');
  }
  if (manifest.layout && manifest.layout.gap) {
    shell.style.setProperty('--ns-shell-gap', manifest.layout.gap);
  } else {
    shell.style.removeProperty('--ns-shell-gap');
  }

  const layout = manifest.layout || {};
  const preset = layout.preset || 'two-column';
  const orientation = layout.sidebarPosition || 'right';

  const layoutRoot = document.createElement('div');
  const layoutClasses = new Set(['ns-layout', `ns-layout-${preset}`]);
  layoutRoot.dataset.nsLayout = preset;
  if (orientation === 'left') layoutClasses.add('ns-sidebar-left');
  else layoutClasses.add('ns-sidebar-right');
  toClassArray(layout.classes || layout.class).forEach(cls => layoutClasses.add(cls));
  toClassArray(manifest.layoutClasses).forEach(cls => layoutClasses.add(cls));
  layoutClasses.forEach(cls => layoutRoot.classList.add(cls));

  shell.dataset.nsLayout = preset;
  shell.dataset.nsPack = pack || manifest.pack || 'native';

  const oldChildren = Array.from(shell.children);
  shell.insertBefore(layoutRoot, shell.firstChild || null);

  const hiddenSet = new Set((layout.hiddenModules || []).map(sanitizeModuleKey));
  MODULE_REGISTRY.forEach((el, key) => {
    if (hiddenSet.has(key)) {
      el.dataset.nsSuppressed = 'true';
      el.setAttribute('aria-hidden', 'true');
      el.hidden = true;
    } else {
      el.removeAttribute('data-ns-suppressed');
      el.removeAttribute('aria-hidden');
      if (!el.hasAttribute('data-ns-keep-hidden')) {
        el.hidden = false;
      }
    }
  });

  const assigned = new Set();
  const areas = Array.isArray(layout.areas) && layout.areas.length
    ? layout.areas
    : (preset === 'single-column'
      ? SINGLE_COLUMN_AREAS.map(cloneArea).map(normalizeArea)
      : DEFAULT_AREAS.map(cloneArea).map(normalizeArea));

  areas.forEach((area, index) => {
    if (!area) return;
    const areaEl = document.createElement(area.as || 'div');
    areaEl.classList.add('ns-area');
    const name = area.name || `area-${index}`;
    areaEl.dataset.nsArea = name;
    areaEl.classList.add(`ns-area-${name}`);
    (area.classes || []).forEach(cls => areaEl.classList.add(cls));
    layoutRoot.appendChild(areaEl);
    (area.modules || []).forEach(mod => {
      const key = sanitizeModuleKey(mod);
      const moduleEl = MODULE_REGISTRY.get(key);
      if (!moduleEl || hiddenSet.has(key)) return;
      assigned.add(key);
      areaEl.appendChild(moduleEl);
    });
  });

  const overflow = [];
  MODULE_REGISTRY.forEach((el, key) => {
    if (!hiddenSet.has(key) && !assigned.has(key)) {
      overflow.push({ key, el });
    }
  });

  if (overflow.length) {
    const extra = document.createElement('div');
    extra.classList.add('ns-area', 'ns-area-overflow');
    extra.dataset.nsArea = 'overflow';
    overflow.forEach(({ el }) => extra.appendChild(el));
    layoutRoot.appendChild(extra);
  }

  oldChildren.forEach(child => {
    if (child.parentElement === shell && child !== layoutRoot) {
      shell.removeChild(child);
    }
  });

  return manifest;
}

function getThemeManifest(pack) {
  const slug = sanitizePack(pack);
  if (slug === 'native') return Promise.resolve(DEFAULT_THEME_MANIFEST);
  if (manifestCache.has(slug)) return manifestCache.get(slug);
  const promise = fetch(`assets/themes/${encodeURIComponent(slug)}/manifest.json`, { cache: 'no-store' })
    .then(resp => resp.ok ? resp.json() : Promise.reject(new Error('manifest not found')))
    .then(json => normalizeManifest(json, slug))
    .catch(() => normalizeManifest({}, slug));
  manifestCache.set(slug, promise);
  return promise;
}

function applyThemeLayoutForPack(pack, options = {}) {
  const override = options.override !== undefined ? options.override : currentLayoutOverride;
  const force = !!options.force;
  return getThemeManifest(pack)
    .then(manifest => buildFinalManifest(manifest, override))
    .then(finalManifest => applyThemeManifest(finalManifest, { pack, force }))
    .catch(() => {
      const fallback = buildFinalManifest(DEFAULT_THEME_MANIFEST, override);
      applyThemeManifest(fallback, { pack: 'native', force: true });
      return fallback;
    });
}

function updateThemeMeta(manifest) {
  const meta = document.getElementById('themePackMeta');
  if (!meta) return;
  if (!manifest) {
    meta.textContent = '';
    meta.setAttribute('hidden', 'hidden');
    meta.removeAttribute('data-pack');
    return;
  }
  const label = manifest.label || formatLabelFromPack(manifest.pack);
  const desc = manifest.description ? String(manifest.description) : '';
  const parts = desc ? [label, desc] : [label];
  meta.textContent = parts.join(' — ');
  meta.dataset.pack = manifest.pack || '';
  if (meta.textContent.trim()) meta.removeAttribute('hidden');
  else meta.setAttribute('hidden', 'hidden');
}

export function initThemeSystem() {
  ensureModulesRegistered();
  applyThemeManifest(DEFAULT_THEME_MANIFEST, { pack: 'native', force: true });
  const saved = getSavedThemePack();
  currentPackName = saved;
  applyThemeLayoutForPack(saved, { force: true }).then(updateThemeMeta).catch(() => updateThemeMeta(null));
}

export function activateThemePack(name, options = {}) {
  const pack = sanitizePack(name);
  const persist = options.persist !== false;
  if (persist) {
    try { localStorage.setItem('themePack', pack); } catch (_) {}
  }
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
  currentPackName = pack;
  return applyThemeLayoutForPack(pack, { force: options.force, override: options.override })
    .then(manifest => { updateThemeMeta(manifest); return manifest; })
    .catch(err => { updateThemeMeta(null); throw err; });
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
  activateThemePack(getSavedThemePack()).catch(() => {});
}

export function applyThemeConfig(siteConfig) {
  const cfg = siteConfig || {};
  currentLayoutOverride = sanitizeLayoutOverride(cfg.themeLayout || cfg.themeLayoutOverride);
  const override = cfg.themeOverride !== false;
  const mode = (cfg.themeMode || '').toLowerCase();
  const configPack = sanitizePack(cfg.themePack);

  const setMode = (m) => {
    if (m === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch (_) {}
    } else if (m === 'light') {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'light'); } catch (_) {}
    } else if (m === 'auto') {
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
    else if (mode === 'user') applySavedTheme();
    if (configPack) {
      try { localStorage.setItem('themePack', configPack); } catch (_) {}
      activateThemePack(configPack, { force: true, override: currentLayoutOverride }).catch(() => {});
      return;
    }
    activateThemePack(getSavedThemePack(), { force: true, override: currentLayoutOverride }).catch(() => {});
    return;
  }

  const hasUserTheme = (() => { try { return !!localStorage.getItem('theme'); } catch (_) { return false; } })();
  const hasUserPack = (() => { try { return !!localStorage.getItem('themePack'); } catch (_) { return false; } })();

  if (!hasUserTheme) {
    if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
    else if (mode === 'user') applySavedTheme();
  }

  if (!hasUserPack && configPack) {
    activateThemePack(configPack, { force: true, override: currentLayoutOverride }).catch(() => {});
  } else {
    activateThemePack(getSavedThemePack(), { force: true, override: currentLayoutOverride }).catch(() => {});
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
  sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    sel.value = val;
    activateThemePack(val, { force: true }).catch(() => {});
  });
}

export function mountThemeControls() {
  const wrapper = document.querySelector('[data-ns-module="tools"]');
  if (!wrapper) return;
  wrapper.id = 'tools';
  wrapper.classList.add('box');
  wrapper.hidden = false;
  wrapper.removeAttribute('hidden');
  wrapper.removeAttribute('data-ns-keep-hidden');
  wrapper.innerHTML = `
    <div class="section-title">${t('tools.sectionTitle')}</div>
    <div class="tools tools-panel">
      <div class="tool-item">
        <button id="themeToggle" class="btn icon-btn" aria-label="${t('tools.toggleTheme')}" title="${t('tools.toggleTheme')}"><span class="icon">🌓</span><span class="btn-text">${t('tools.toggleTheme')}</span></button>
      </div>
      <div class="tool-item">
        <button id="postEditor" class="btn icon-btn" aria-label="${t('tools.postEditor')}" title="${t('tools.postEditor')}"><span class="icon">📝</span><span class="btn-text">${t('tools.postEditor')}</span></button>
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
    </div>
    <div class="tool-meta" id="themePackMeta" hidden></div>
  `;

  const sel = wrapper.querySelector('#themePack');
  const saved = getSavedThemePack();
  const fallback = [
    { value: 'native', label: 'Native' },
    { value: 'github', label: 'GitHub' },
    { value: 'magazine', label: 'Magazine' }
  ];

  const populateOptions = (list) => {
    if (!sel) return;
    sel.innerHTML = '';
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = sanitizePack(p.value);
      opt.textContent = String(p.label || p.value || 'Theme');
      sel.appendChild(opt);
    });
    sel.value = saved;
  };

  fetch('assets/themes/packs.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(list => Array.isArray(list) && list.length ? populateOptions(list) : populateOptions(fallback))
    .catch(() => populateOptions(fallback))
    .finally(() => {
      const pack = currentPackName || saved;
      getThemeManifest(pack).then(updateThemeMeta).catch(() => updateThemeMeta(null));
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
      try { (window.__ns_softResetLang && window.__ns_softResetLang()); } catch (_) {}
      if (!window.__ns_softResetLang) {
        try { window.location.reload(); } catch (_) {}
      }
    });
  }
}

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
