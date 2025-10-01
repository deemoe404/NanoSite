import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage, ensureLanguageBundle } from './i18n.js';

const PACK_LINK_ID = 'theme-pack';

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
    const current = getSavedThemePack();
    if (val === current) return;
    loadThemePack(val);
    try { window.location.reload(); } catch (_) {}
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
    { value: 'native', label: 'Native' }
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
    try { ensureLanguageBundle(getCurrentLang()).catch(() => {}); } catch (_) {}
    const langs = getAvailableLangs();
    langSel.innerHTML = '';
    langs.forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = getLanguageLabel(code);
      langSel.appendChild(opt);
    });
    langSel.value = getCurrentLang();
    langSel.addEventListener('change', async () => {
      const val = langSel.value || 'en';
      try {
        await ensureLanguageBundle(val);
      } catch (_) {}
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
