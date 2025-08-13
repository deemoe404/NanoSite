const PACK_LINK_ID = 'theme-pack';

export function loadThemePack(name) {
  const pack = (name || '').trim() || 'native';
  try { localStorage.setItem('themePack', pack); } catch (_) {}
  const link = document.getElementById(PACK_LINK_ID);
  const href = `assets/themes/${pack}/theme.css`;
  if (link) link.setAttribute('href', href);
}

export function getSavedThemePack() {
  try { return localStorage.getItem('themePack') || 'native'; } catch (_) { return 'native'; }
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

export function bindThemePackPicker() {
  const sel = document.getElementById('themePack');
  if (!sel) return;
  // Initialize selection
  const saved = getSavedThemePack();
  sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sel.value || 'native';
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
    <div class="section-title">Function Area</div>
    <div class="tools">
      <button id="themeToggle" class="btn" aria-label="Toggle light/dark">Toggle Theme</button>
      <label for="themePack" class="visually-hidden">Theme Pack</label>
      <select id="themePack" aria-label="Theme pack"></select>
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
        opt.value = String(p.value || '').trim() || 'native';
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
}
