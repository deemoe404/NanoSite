import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage } from './i18n.js';

const PACK_LINK_ID = 'theme-pack';

let themeEventTarget;
try {
  themeEventTarget = window.__ns_themeEvents || new EventTarget();
  window.__ns_themeEvents = themeEventTarget;
} catch (_) {
  themeEventTarget = new EventTarget();
}

const manifestCache = new Map();
let activeThemeRuntime = null;
let activeSiteConfig = null;
let activePackToken = 0;

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function createCleanupStack() {
  const stack = [];
  return {
    push(fn) {
      if (typeof fn === 'function') stack.push(fn);
    },
    run() {
      while (stack.length) {
        const fn = stack.pop();
        try { fn(); } catch (_) { /* noop */ }
      }
    }
  };
}

function rememberPlacement(el) {
  if (!el || !el.parentNode) return null;
  return { el, parent: el.parentNode, next: el.nextSibling };
}

function restorePlacement(record) {
  if (!record || !record.parent) return;
  const { parent, next, el } = record;
  if (!parent) return;
  if (next && next.parentNode === parent) parent.insertBefore(el, next);
  else parent.appendChild(el);
}

function createLayoutHelper(stack) {
  return {
    move(el, target, { position = 'append' } = {}) {
      if (!el || !target) return;
      const placement = rememberPlacement(el);
      if (!placement || !placement.parent) return;
      stack.push(() => restorePlacement(placement));
      if (position === 'prepend') target.insertBefore(el, target.firstChild);
      else target.appendChild(el);
    },
    before(el, reference) {
      if (!el || !reference || !reference.parentNode) return;
      const placement = rememberPlacement(el);
      if (!placement || !placement.parent) return;
      stack.push(() => restorePlacement(placement));
      reference.parentNode.insertBefore(el, reference);
    },
    after(el, reference) {
      if (!el || !reference || !reference.parentNode) return;
      const placement = rememberPlacement(el);
      if (!placement || !placement.parent) return;
      stack.push(() => restorePlacement(placement));
      reference.parentNode.insertBefore(el, reference.nextSibling);
    },
    wrap(el, wrapper) {
      if (!el || !wrapper) return null;
      const placement = rememberPlacement(el);
      if (!placement || !placement.parent) return null;
      const parent = placement.parent;
      stack.push(() => {
        restorePlacement(placement);
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      });
      parent.insertBefore(wrapper, placement.next);
      wrapper.appendChild(el);
      return wrapper;
    }
  };
}

function getLocalizedValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      const lang = getCurrentLang && getCurrentLang();
      if (lang && Object.prototype.hasOwnProperty.call(value, lang)) {
        const v = value[lang];
        if (typeof v === 'string') return v;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'default')) {
        const dv = value.default;
        if (typeof dv === 'string') return dv;
      }
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = value[k];
        if (typeof v === 'string') return v;
      }
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

function createThemeContext(pack, manifest) {
  const stack = createCleanupStack();
  const doc = (typeof document !== 'undefined') ? document : null;
  const root = doc ? doc.documentElement : null;
  const body = doc ? doc.body : null;
  const container = doc ? doc.querySelector('.container') : null;
  const context = {
    pack,
    manifest,
    document: doc,
    window: (typeof window !== 'undefined') ? window : null,
    root,
    body,
    container,
    content: container ? container.querySelector('.content') : (doc ? doc.querySelector('.content') : null),
    sidebar: container ? container.querySelector('.sidebar') : (doc ? doc.querySelector('.sidebar') : null),
    main: doc ? doc.getElementById('mainview') : null,
    nav: doc ? doc.getElementById('tabsNav') : null,
    toc: doc ? doc.getElementById('tocview') : null,
    tags: doc ? doc.getElementById('tagview') : null,
    tools: doc ? doc.getElementById('tools') : null,
    registerCleanup(fn) { stack.push(fn); },
    addBodyClass(cls) {
      if (body && cls) {
        body.classList.add(cls);
        stack.push(() => body.classList.remove(cls));
      }
    },
    addRootClass(cls) {
      if (root && cls) {
        root.classList.add(cls);
        stack.push(() => root.classList.remove(cls));
      }
    },
    setRootAttribute(name, value) {
      if (!root || !name) return;
      const prev = root.getAttribute(name);
      if (value === null || value === undefined) root.removeAttribute(name);
      else root.setAttribute(name, String(value));
      stack.push(() => {
        if (prev === null || prev === undefined) root.removeAttribute(name);
        else root.setAttribute(name, prev);
      });
    },
    layout: createLayoutHelper(stack),
    events: {
      on(eventName, handler, options) {
        if (!eventName || typeof handler !== 'function') return;
        const listener = (evt) => {
          try { handler(evt?.detail, evt); } catch (_) { /* swallow */ }
        };
        themeEventTarget.addEventListener(eventName, listener, options);
        stack.push(() => themeEventTarget.removeEventListener(eventName, listener, options));
      },
      emit(eventName, detail) {
        if (!eventName) return;
        try { themeEventTarget.dispatchEvent(new CustomEvent(eventName, { detail })); } catch (_) { /* noop */ }
      }
    },
    getLocalized(value, fallback = '') {
      return getLocalizedValue(value, fallback);
    },
    site: {
      getConfig: () => activeSiteConfig
    }
  };
  return { context, cleanup: () => stack.run() };
}

function cleanupRuntime(runtime) {
  if (!runtime) return;
  try {
    if (runtime.controller && typeof runtime.controller.deactivate === 'function') {
      runtime.controller.deactivate();
    }
  } catch (_) { /* ignore deactivate errors */ }
  try { if (typeof runtime.cleanup === 'function') runtime.cleanup(); } catch (_) { /* ignore cleanup errors */ }
}

async function fetchManifest(pack) {
  if (!pack) return null;
  if (manifestCache.has(pack)) return manifestCache.get(pack);
  const url = `assets/themes/${encodeURIComponent(pack)}/manifest.json`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  manifestCache.set(pack, json);
  return json;
}

async function activateRuntime(pack) {
  const manifest = await fetchManifest(pack).catch(() => null);
  const { context, cleanup } = createThemeContext(pack, manifest || {});
  let controller = null;
  if (manifest && manifest.entry) {
    const base = `../themes/${encodeURIComponent(pack)}/${manifest.entry}`;
    const cacheBust = manifest.version ? `?v=${encodeURIComponent(manifest.version)}` : `?v=${Date.now()}`;
    try {
      const module = await import(`${base}${cacheBust}`);
      const activator = (module && module.activate)
        || (module && module.default && typeof module.default === 'function' ? module.default : null)
        || (module && module.default && typeof module.default.activate === 'function' ? module.default.activate : null);
      if (typeof activator === 'function') {
        const result = await activator(context);
        if (result && typeof result === 'object') controller = result;
      }
    } catch (err) {
      console.warn('[NanoSite] Failed to initialize theme runtime', err);
      themeEventTarget.dispatchEvent(new CustomEvent('theme:error', { detail: { pack, error: err } }));
    }
  }
  return { pack, manifest, context, controller, cleanup };
}

function applySiteConfigToRuntime(runtime, cfg) {
  if (!runtime || !runtime.controller || typeof runtime.controller.applySiteConfig !== 'function') return;
  try { runtime.controller.applySiteConfig(cfg); } catch (_) { /* ignore */ }
}

function setActiveSiteConfig(cfg) {
  activeSiteConfig = cfg || null;
  applySiteConfigToRuntime(activeThemeRuntime, activeSiteConfig);
  notifyThemeRuntime('site:config', activeSiteConfig);
}

function enrichThemeOptions(selectEl) {
  if (!selectEl) return;
  const options = Array.from(selectEl.options || []);
  options.forEach((opt) => {
    const pack = sanitizePack(opt.value);
    fetchManifest(pack).then((manifest) => {
      if (!manifest) return;
      try {
        if (manifest.name && typeof manifest.name === 'string') {
          const name = manifest.name.trim();
          if (name) opt.textContent = name;
        }
        if (manifest.description && typeof manifest.description === 'string') {
          const desc = manifest.description.trim();
          if (desc) opt.setAttribute('title', desc);
        }
      } catch (_) { /* ignore option enrich errors */ }
    }).catch(() => {});
  });
}

export function notifyThemeRuntime(eventName, detail) {
  if (!eventName) return;
  try { themeEventTarget.dispatchEvent(new CustomEvent(eventName, { detail })); } catch (_) { /* ignore */ }
  const runtime = activeThemeRuntime;
  if (!runtime || !runtime.controller || typeof runtime.controller.handleEvent !== 'function') return;
  try { runtime.controller.handleEvent(eventName, detail); } catch (_) { /* ignore handler errors */ }
}

export function loadThemePack(name) {
  const pack = sanitizePack(name);
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  if (link) link.setAttribute('href', href);
  try { document.documentElement.setAttribute('data-theme-pack', pack); } catch (_) { /* ignore */ }

  const token = ++activePackToken;
  const previous = activeThemeRuntime ? activeThemeRuntime.pack : null;
  notifyThemeRuntime('theme:will-activate', { next: pack, previous });
  cleanupRuntime(activeThemeRuntime);
  activeThemeRuntime = null;

  const promise = activateRuntime(pack).then((runtime) => {
    if (token !== activePackToken) {
      cleanupRuntime(runtime);
      return;
    }
    activeThemeRuntime = runtime;
    applySiteConfigToRuntime(activeThemeRuntime, activeSiteConfig);
    notifyThemeRuntime('theme:activated', { pack, manifest: runtime ? runtime.manifest : null });
  }).catch((err) => {
    console.warn('[NanoSite] Failed to load theme pack', err);
    notifyThemeRuntime('theme:error', { pack, error: err });
  });

  return promise;
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

  setActiveSiteConfig(cfg);
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
  enrichThemeOptions(sel);
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    sel.value = val;
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
    enrichThemeOptions(sel);
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
