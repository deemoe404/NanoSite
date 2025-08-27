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

// Wrap toggle for textareas
export function toggleWrap(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const nowOff = el.getAttribute('wrap') !== 'off' ? 'off' : 'soft';
  el.setAttribute('wrap', nowOff);
  try { showToast('ok', nowOff === 'off' ? 'Wrap: off' : 'Wrap: on'); } catch (_) {}
}
window.toggleWrap = toggleWrap;

// Tab switching; auto trigger generators when switching
export function switchTab(tabName) {
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
  try {
    if (tabName === 'sitemap' && window.generateSitemap) window.generateSitemap();
    if (tabName === 'robots' && window.generateRobots) window.generateRobots();
    if (tabName === 'meta' && window.generateMetaTags) window.generateMetaTags();
  } catch (_) {}
}
window.switchTab = switchTab;

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

// Fullscreen editor overlay
(function initEditorOverlay(){
  const overlay = document.getElementById('editor-overlay');
  const titleEl = document.getElementById('editor-title');
  const ta = document.getElementById('editor-textarea');
  const applyBtn = document.getElementById('editor-apply');
  const closeBtn = document.getElementById('editor-close');
  if (!overlay || !titleEl || !ta || !applyBtn || !closeBtn) return;
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
    try { window.__seoToolState && (window.__seoToolState.currentEditorTargetId = null, window.__seoToolState.currentEditorFilename=''); } catch (_) {}
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
  }
  window.openFullscreenEditor = function(targetId, filename){
    try { window.__seoToolState && (window.__seoToolState.currentEditorTargetId = targetId, window.__seoToolState.currentEditorFilename = filename || 'Editor'); } catch (_) {}
    titleEl.textContent = filename || 'Editor';
    const src = document.getElementById(targetId);
    ta.value = src ? (src.value || '') : '';
    open();
  }
  applyBtn.addEventListener('click', ()=>{
    const id = (window.__seoToolState && window.__seoToolState.currentEditorTargetId) || null;
    if (id){ const dst = document.getElementById(id); if (dst) dst.value = ta.value; }
    try { showToast('ok', 'Changes applied'); } catch (_) {}
    close();
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  overlay.querySelector('.gh-modal')?.addEventListener('click', (e)=> e.stopPropagation());
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && overlay.classList.contains('open')) close(); });
})();

// Footer year
try { document.getElementById('footer-year').textContent = new Date().getFullYear(); } catch (_) {}

