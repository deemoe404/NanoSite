// UI helpers and overlays for SEO tool

// Toasts
export function showToast(kind, text) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind || ''}`;
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 1800);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
}

// Expose for inline handlers
window.showToast = showToast;

// Toolbar More toggle
export function toggleToolbarMore(btn){
  const bar = btn && btn.closest('.toolbar');
  if (!bar) return;
  const expanded = bar.classList.toggle('expanded');
  btn.setAttribute('aria-expanded', String(expanded));
  try { btn.textContent = expanded ? 'Less ▴' : 'More ▾'; } catch (_) {}
}
window.toggleToolbarMore = toggleToolbarMore;

// (wrap toggle removed; editors are fixed to no-wrap)

// Persisted view state helpers (per section)
const __viewState = (function(){
  try { return (window.__seoViewState = window.__seoViewState || {}); } catch (_) { return {}; }
})();
function __viewKey(sec){ return `seo_view_${String(sec||'').toLowerCase()}`; }
function __saveView(sec, view){
  const v = (String(view||'friendly').toLowerCase() === 'source') ? 'source' : 'friendly';
  try { __viewState[sec] = v; } catch (_) {}
  try { localStorage.setItem(__viewKey(sec), v); } catch (_) {}
}
function __loadView(sec){
  const s = String(sec||'').toLowerCase();
  try { if (__viewState[s]) return __viewState[s]; } catch (_) {}
  try { const v = localStorage.getItem(__viewKey(s)); if (v) return v; } catch (_) {}
  return 'friendly';
}

// Apply a section's view state to DOM (id convention: `${sec}Preview` / `${sec}Output`)
export function applyView(section){
  try {
    const sec = String(section||'').toLowerCase();
    if (!sec) return;
    const mode = __loadView(sec);
    const previewId = `${sec}Preview`;
    const outputId = `${sec}Output`;
    const previewEl = document.getElementById(previewId);
    const ta = document.getElementById(outputId);
    const outWrap = ta ? (ta.closest('.output-group') || ta.parentElement) : null;
    const showSource = mode === 'source';
    // Keep header visible; only toggle body area inside preview
    if (previewEl) {
      const bodies = previewEl.querySelectorAll('.config-body');
      bodies.forEach(b => { b.style.display = showSource ? 'none' : ''; });
      previewEl.style.display = '';
    }
    if (outWrap) outWrap.style.display = showSource ? '' : 'none';
    // Sync toggle buttons' active state
    try {
      const root = (previewEl && previewEl.querySelector('.view-toggle')) || document;
      const peers = root ? root.querySelectorAll(`[data-view-target="${sec}"]`) : [];
      peers.forEach(el => {
        const label = (el.textContent || '').trim().toLowerCase();
        const isActive = (mode === 'source') ? (label === 'source') : (label === 'friendly');
        if (isActive) el.classList.add('active'); else el.classList.remove('active');
      });
    } catch (_) {}
    // Ensure editor layout updates when becoming visible
    if (showSource && window.__seoEditorToggleWrap) {
      setTimeout(() => { try { window.__seoEditorToggleWrap(outputId); } catch (_) {} }, 0);
    }
  } catch (_) {}
}
try { window.__applyView = applyView; } catch (_) {}

// In-page view toggle between friendly preview and source editor
export function switchView(section, view, btn) {
  try {
    const sec = String(section || '').toLowerCase();
    const v = String(view || 'friendly').toLowerCase();
    __saveView(sec, v);
    applyView(sec);
  } catch (_) {}
  return false;
}
window.__switchView = switchView;

// Tab switching; auto trigger generators when switching
export function switchTab(tabName, opts) {
  const silent = !!(opts && opts.silent);
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  const panel = document.getElementById(tabName + '-tab');
  if (panel) panel.classList.add('active');
  if (window.event && event.target) {
    event.target.classList.add('active');
  } else {
    const btn = document.querySelector(`.tabs .tab[onclick*="'${tabName}'"]`);
    if (btn) btn.classList.add('active');
  }
  // Persist selected tab in history (Back/Forward navigates between tabs)
  try {
    const url = new URL(window.location.href);
    const desired = `tab=${encodeURIComponent(tabName)}`;
    url.hash = `#${desired}`;
    if (!silent) {
      history.pushState(history.state, document.title, url.toString());
    } else {
      history.replaceState(history.state, document.title, url.toString());
    }
  } catch (_) { if (!silent) { try { window.location.hash = `#tab=${tabName}`; } catch (_) {} } }
  // When a tab becomes visible, refresh its editor layout so
  // hidden-at-init textareas expand to full height and accept clicks.
  try {
    const map = {
      sitemap: 'sitemapOutput',
      robots: 'robotsOutput',
      meta: 'metaOutput',
      config: 'configOutput'
    };
    const id = map[tabName];
    if (id && window.__seoEditorToggleWrap) {
      // Defer to next tick to ensure CSS display changes are applied
      setTimeout(() => { try { window.__seoEditorToggleWrap(id); } catch (_) {} }, 0);
    }
  } catch (_) {}
  // Re-apply view mode for this tab if supported (keeps indicator/content in sync)
  try { if (typeof applyView === 'function') applyView(tabName); else if (window.__applyView) window.__applyView(tabName); } catch (_) {}
  // Only generate on first visit; subsequent visits won't auto-regenerate.
  // Users can force refresh via the toolbar "icon-refresh" buttons.
  try {
    const gen = (window.__seoGenerated = window.__seoGenerated || {});
    if (tabName === 'sitemap' && window.generateSitemap && !gen.sitemap) {
      window.generateSitemap();
    }
    if (tabName === 'robots' && window.generateRobots && !gen.robots) {
      window.generateRobots();
    }
    if (tabName === 'meta' && window.generateMetaTags && !gen.meta) {
      window.generateMetaTags();
    }
  } catch (_) {}
}
window.switchTab = switchTab;

// On load, restore tab from URL hash (e.g., #tab=sitemap)
(function restoreTabFromHash(){
  try {
    const m = String(window.location.hash || '').match(/tab=([a-z]+)/i);
    const tab = m && m[1] ? m[1].toLowerCase() : '';
    if (tab && document.getElementById(`${tab}-tab`)) {
      setTimeout(() => { try { window.switchTab(tab, { silent: true }); } catch (_) {} }, 0);
    }
  } catch (_) {}
})();

// Listen for Back/Forward navigation and restore tab accordingly
window.addEventListener('popstate', () => {
  try {
    const m = String(window.location.hash || '').match(/tab=([a-z]+)/i);
    const tab = m && m[1] ? m[1].toLowerCase() : '';
    const active = document.querySelector('.tabs .tab.active');
    const activeName = active && (active.getAttribute('onclick') || '').match(/switchTab\('([a-z]+)'\)/i);
    const current = activeName && activeName[1] ? activeName[1].toLowerCase() : '';
    if (tab && tab !== current && document.getElementById(`${tab}-tab`)) {
      window.switchTab(tab, { silent: true });
    }
  } catch (_) {}
});

// GitHub destination help overlay
(function initGhHelpOverlay(){
  const btn = document.getElementById('gh-help-btn');
  const overlay = document.getElementById('gh-help-overlay');
  const closeBtn = document.getElementById('gh-help-close');
  if (!btn || !overlay || !closeBtn) return;
  function setVvh(){ document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`); }
  setVvh();
  window.addEventListener('resize', setVvh, { passive: true });
  let scrollY = 0;
  function close(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    btn.setAttribute('aria-expanded','false');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }
  function open(){
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    btn.setAttribute('aria-expanded','true');
  }
  btn.addEventListener('click', (e)=>{ e.preventDefault(); (overlay.classList.contains('open')? close:open)(); });
  closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); close(); });
  overlay.addEventListener('click', close);
  overlay.querySelector('.gh-modal')?.addEventListener('click', (e)=> e.stopPropagation());
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && overlay.classList.contains('open')) close(); });
})();

// Fullscreen tab help overlay
(function initTabHelpOverlay(){
  const overlay = document.getElementById('tab-help-overlay');
  const titleEl = document.getElementById('tab-help-title');
  const bodyEl = document.getElementById('tab-help-body');
  const closeBtn = document.getElementById('tab-help-close');
  const sitemapBtn = document.getElementById('sitemap-help-btn');
  const robotsBtn = document.getElementById('robots-help-btn');
  const metaBtn = document.getElementById('meta-help-btn');
  if (!overlay || !titleEl || !bodyEl || !closeBtn) return;
  let scrollY = 0;
  function close(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }
  function openWith(title, html){
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
  }
  function onClick(btn, title, html){ if (btn) btn.addEventListener('click', (e)=>{ e.stopPropagation(); openWith(title, html); }); }
  const sitemapHtml = `
    <p>📄 A sitemap lists all the pages on your site so search engines can find them.</p>
    <p><b>How to use:</b></p>
    <ul>
      <li>Click <b>Refresh</b> to generate a new sitemap from your site’s content.</li>
    </ul>
    <p><b>How to apply:</b></p>
    <ul>
      <li><b>Save into your site folder</b>
        <ul>
          <li>Copy or download the generated text.</li>
          <li>Place it as <code>sitemap.xml</code> in your project root.</li>
          <li>Commit and push like a normal file.</li>
        </ul>
      </li>
      <li><b>Edit directly on GitHub</b>
        <ul>
          <li>Click <b>Open on GitHub</b>.</li>
          <li>A GitHub editor tab opens for <code>sitemap.xml</code>.</li>
          <li>Paste the content and commit changes.</li>
        </ul>
      </li>
    </ul>`;
  const robotsHtml = `
    <p>🤖 Robots.txt tells search engines what to crawl and where to find your sitemap.</p>
    <p><b>How to use:</b></p>
    <ul>
      <li>Click <b>Refresh</b> to generate a <code>robots.txt</code> based on your site settings.</li>
    </ul>
    <p><b>How to apply:</b></p>
    <ul>
      <li><b>Save into your site folder</b>
        <ul>
          <li>Copy or download the text.</li>
          <li>Place it as <code>robots.txt</code> in your project root.</li>
          <li>Commit and push like any other file.</li>
        </ul>
      </li>
      <li><b>Edit directly on GitHub</b>
        <ul>
          <li>Click <b>Open on GitHub</b>.</li>
          <li>A GitHub editor tab opens for <code>robots.txt</code>.</li>
          <li>Paste the content and commit changes.</li>
        </ul>
      </li>
    </ul>`;
  const metaHtml = `
    <p>🏷 Meta tags help search engines and social media display your site correctly.</p>
    <p><b>How to use:</b></p>
    <ul>
      <li>Click <b>Refresh</b> to generate tags from your <code>site.yaml</code>.</li>
    </ul>
    <p><b>How to apply:</b></p>
    <ul>
      <li><b>Save into your site folder</b>
        <ul>
          <li>Copy the generated <code>&lt;meta&gt;</code> tags.</li>
          <li>Insert them into the <code>&lt;head&gt;</code> section of your <code>index.html</code>.</li>
          <li>Commit and push the updated file.</li>
        </ul>
      </li>
      <li><b>Edit directly on GitHub</b>
        <ul>
          <li>Click <b>Open index.html on GitHub</b>.</li>
          <li>A GitHub editor tab opens for <code>index.html</code>.</li>
          <li>Paste the tags into the <code>&lt;head&gt;</code> and commit changes.</li>
        </ul>
      </li>
    </ul>`;
  onClick(sitemapBtn, 'Sitemap.xml Guide', sitemapHtml);
  onClick(robotsBtn, 'Robots.txt Guide', robotsHtml);
  onClick(metaBtn, 'Meta Tags Guide', metaHtml);
  overlay.addEventListener('click', close);
  overlay.querySelector('.gh-modal')?.addEventListener('click', (e)=> e.stopPropagation());
  closeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); close(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
})();

// (Fullscreen editor removed by request)

// Footer year
try { document.getElementById('footer-year').textContent = new Date().getFullYear(); } catch (_) {}
