import { state } from './seo-tool-state.js';
import { fetchConfigWithYamlFallback } from './yaml.js';

// Attempt to load site config from site.yaml/yml
export async function loadSiteConfigFlex() {
  return await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
}

// Resolve content root from site config
export function getContentRootFrom(cfg) {
  const raw = (cfg && (cfg.contentRoot || cfg.contentBase || cfg.contentPath)) || 'wwwroot';
  return String(raw).replace(/^\/+|\/+$/g, '');
}

// Raw site.yaml text loader (for preview textarea)
export async function loadSiteYamlRaw() {
  const attempts = ['site.yaml', 'site.yml'];
  for (const p of attempts) {
    try {
      const r = await fetch(p);
      if (r.ok) return await r.text();
    } catch (_) {}
  }
  return '';
}

// UI: Load and preview site configuration
export async function loadSiteConfig() {
  const statusEl = document.getElementById('config-status');
  const previewEl = document.getElementById('configPreview');
  const outputEl = document.getElementById('configOutput');
  try {
    if (statusEl) statusEl.innerHTML = '<p>Loading configuration...</p>';
    state.currentSiteConfig = await loadSiteConfigFlex();
    const rawYaml = await loadSiteYamlRaw();
    if (outputEl) outputEl.value = rawYaml || '# site.yaml not found or failed to load';
    try { window.__seoEditorSet ? window.__seoEditorSet('configOutput', outputEl.value) : (window.__seoUpdatePreview && window.__seoUpdatePreview('configOutput')); } catch (_) {}
    // Load schema for tooltips
    async function loadSiteSchema() {
      try {
        const r = await fetch('assets/schema/site.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (_) { return null; }
    }
    const siteSchema = await loadSiteSchema();
    // Helpers for preview formatting and defaults
    const esc = (s) => String(s ?? '')
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[c]));
    const badge = (kind, text) => `<span class="badge ${kind}">${esc(text)}</span>`;
    const getLocalizedValue = (val, fallback = 'Not set') => {
      if (!val) return fallback;
      if (typeof val === 'string') return val;
      return val.default || fallback;
    };
    const cfg = state.currentSiteConfig || {};
    const contentRoot = getContentRootFrom(cfg);
    // Build description lookup from schema
    const desc = (() => {
      const map = {};
      const s = siteSchema || {};
      const P = (s.properties) || {};
      const put = (k, v) => { if (v && !map[k]) map[k] = String(v); };
      put('siteTitle', P.siteTitle && P.siteTitle.description);
      put('siteSubtitle', P.siteSubtitle && P.siteSubtitle.description);
      put('siteDescription', P.siteDescription && P.siteDescription.description);
      put('siteKeywords', P.siteKeywords && P.siteKeywords.description);
      put('resourceURL', P.resourceURL && P.resourceURL.description);
      put('contentRoot', P.contentRoot && P.contentRoot.description);
      put('avatar', P.avatar && P.avatar.description);
      put('profileLinks', P.profileLinks && P.profileLinks.description);
      try { const one = (P.links && P.links.oneOf) || []; const text = one.map(x => x && x.description).filter(Boolean).join(' / '); put('links', text || (P.links && P.links.description)); } catch (_) {}
      put('contentOutdatedDays', P.contentOutdatedDays && P.contentOutdatedDays.description);
      put('themeMode', P.themeMode && P.themeMode.description);
      put('themePack', P.themePack && P.themePack.description);
      put('themeOverride', P.themeOverride && P.themeOverride.description);
      put('cardCoverFallback', P.cardCoverFallback && P.cardCoverFallback.description);
      put('errorOverlay', P.errorOverlay && P.errorOverlay.description);
      put('pageSize', P.pageSize && P.pageSize.description);
      put('showAllPosts', P.showAllPosts && P.showAllPosts.description);
      put('enableAllPosts', P.enableAllPosts && P.enableAllPosts.description);
      put('disableAllPosts', P.disableAllPosts && P.disableAllPosts.description);
      put('landingTab', P.landingTab && P.landingTab.description);
      put('postsPerPage', P.postsPerPage && P.postsPerPage.description);
      put('defaultLanguage', P.defaultLanguage && P.defaultLanguage.description);
      const R = (P.repo && P.repo.properties) || {};
      put('repo.owner', R.owner && R.owner.description);
      put('repo.name', R.name && R.name.description);
      put('repo.branch', R.branch && R.branch.description);
      const AW = (P.assetWarnings && P.assetWarnings.properties) || {};
      const LI = (AW.largeImage && AW.largeImage.properties) || {};
      put('assetWarnings.largeImage.enabled', LI.enabled && LI.enabled.description);
      put('assetWarnings.largeImage.thresholdKB', LI.thresholdKB && LI.thresholdKB.description);
      // Extras (non-schema)
      put('reportIssueURL', 'Non-schema: explicit issue-creation URL used by this tool.');
      put('derived.reportIssueURL', 'Derived at runtime from repo owner/name (issues/new).');
      return (k) => map[k] || '';
    })();
    // Derived defaults from runtime logic
    const defaults = {
      resourceURL: `${window.location.origin}${window.location.pathname}`,
      contentRoot: 'wwwroot',
      pageSize: 8,
      postsPerPage: 8,
      showAllPosts: true,
      enableAllPosts: undefined,
      disableAllPosts: false,
      landingTab: 'posts',
      defaultLanguage: 'en',
      themeMode: 'user',
      themePack: 'native',
      themeOverride: true,
      cardCoverFallback: true,
      errorOverlay: false,
      contentOutdatedDays: 180,
      assetWarnings_largeImage_enabled: false,
      assetWarnings_largeImage_thresholdKB: 500,
    };
    // Posts visibility resolution (mirrors main.js postsEnabled)
    const postsEnabled = () => {
      try {
        if (typeof cfg.showAllPosts === 'boolean') return !!cfg.showAllPosts;
        if (typeof cfg.enableAllPosts === 'boolean') return !!cfg.enableAllPosts;
        if (typeof cfg.disableAllPosts === 'boolean') return !cfg.disableAllPosts;
      } catch (_) {}
      return true;
    };
    const formatLinksList = (linksVal) => {
      try {
        if (!linksVal) return `<em>Not set</em>`;
        let items = [];
        if (Array.isArray(linksVal)) {
          items = linksVal.map(l => {
            const href = esc(l.href);
            const label = esc(l.label);
            return `<li><span class="dim">${label} → </span><a href="${href}" target="_blank" rel="noopener">${href}</a></li>`;
          });
        } else if (typeof linksVal === 'object') {
          items = Object.entries(linksVal).map(([k,v]) => {
            const href = esc(String(v));
            const label = esc(String(k));
            return `<li><span class="dim">${label} → </span><a href="${href}" target="_blank" rel="noopener">${href}</a></li>`;
          });
        }
        if (!items.length) return `<em>Empty</em>`;
        return `<ul class="config-list">${items.join('')}</ul>`;
      } catch (_) { return `<em>Not set</em>`; }
    };
    const formatKeywords = (val) => {
      const s = (typeof val === 'string') ? val : (val && val.default) || '';
      const parts = String(s).split(',').map(t => t.trim()).filter(Boolean);
      if (!parts.length) return `<em>Not set</em>`;
      return `<div class="chips">${parts.map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div>`;
    };
    const makeLabel = (label, titleAttr, hint) => {
      const hintHtml = hint ? `<span class="config-label-hint"><span class="mini-badge">${esc(hint)}</span></span>` : '';
      return `<span class="config-label"${titleAttr}><span class="config-label-text">${esc(label)}:</span>${hintHtml}</span>`;
    };
    const show = (label, has, value, defText, kindWhenDefault = 'warn', keyForTip = '', hint = '') => {
      const tip = desc(keyForTip) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      const text = has ? esc(value) : esc(defText);
      const tail = has ? '' : ' ' + badge(kindWhenDefault, 'default');
      return `<div class="config-item">${makeLabel(label, titleAttr, hint)} <span class="config-value">${text}${tail}</span></div>`;
    };
    const showRaw = (label, has, htmlValue, defText, kindWhenDefault = 'warn', keyForTip = '', hint = '') => {
      const tip = desc(keyForTip) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      const tail = has ? '' : ' ' + badge(kindWhenDefault, 'default');
      const inner = has ? String(htmlValue) : esc(defText);
      return `<div class="config-item">${makeLabel(label, titleAttr, hint)} <span class="config-value">${inner}${tail}</span></div>`;
    };
    const showBool = (label, has, value, defVal, key) => {
      const tip = desc(key) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      const v = !!value;
      const d = !!defVal;
      const valHtml = has
        ? `<span class="bool ${v ? 'bool-true' : 'bool-false'}">${v ? 'true' : 'false'}</span>`
        : `<span class="bool ${d ? 'bool-true' : 'bool-false'}">${d ? 'true' : 'false'}</span> ${badge('warn','default')}`;
      return `<div class="config-item">${makeLabel(label, titleAttr, '')} <span class="config-value">${valHtml}</span></div>`;
    };
    const showNum = (label, has, value, defVal, key) => show(label, has, String(parseInt(value,10)), String(defVal), 'warn', key);
    const section = (title, bodyHtml) => `
      <div class="config-group">
        <div class="config-group-title">${esc(title)}</div>
        <div class="section-body">
          ${bodyHtml}
        </div>
      </div>`;
    // Two-pane helpers
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    const groups = [];
    const addGroup = (title, bodyHtml) => groups.push({ id: slug(title), title, bodyHtml: String(bodyHtml || '') });

    // Build groups
    addGroup('Identity & SEO', [
      show('Site Title', !!cfg.siteTitle, getLocalizedValue(cfg.siteTitle), 'Not set', 'warn', 'siteTitle'),
      show('Site Subtitle', !!cfg.siteSubtitle, getLocalizedValue(cfg.siteSubtitle), 'Not set', 'warn', 'siteSubtitle'),
      show('Description', !!cfg.siteDescription, getLocalizedValue(cfg.siteDescription), 'Not set', 'warn', 'siteDescription'),
      showRaw('Keywords', !!cfg.siteKeywords, formatKeywords(cfg.siteKeywords), 'Not set', 'warn', 'siteKeywords'),
      (() => {
        const has = !!cfg.resourceURL;
        const tip = esc(desc('resourceURL')||'');
        const titleAttr = tip ? ` title="${tip}"` : '';
        const href = has ? esc(cfg.resourceURL) : esc(defaults.resourceURL);
        const html = `<a href="${href}" target="_blank" rel="noopener">${href}</a>` + (has ? '' : ' ' + badge('warn','default'));
        return `<div class="config-item">${makeLabel('Resource URL', titleAttr, '')} <span class="config-value">${html}</span></div>`;
      })(),
      (() => {
        const has = !!cfg.avatar;
        const src = has ? esc(cfg.avatar) : '';
        const tip = esc(desc('avatar')||'');
        const titleAttr = tip ? ` title="${tip}"` : '';
        if (!has) return `<div class="config-item">${makeLabel('Avatar', titleAttr, '')} <span class="config-value">${esc('Generated fallback image')} ${badge('warn','default')}</span></div>`;
        const block = `
          <div class="config-avatar-block">
            <img class="config-avatar" src="${src}" alt="Avatar preview" loading="lazy"/>
            <div class="config-avatar-path"><code>${src}</code></div>
          </div>`;
        return `<div class="config-item">${makeLabel('Avatar', titleAttr, '')} <span class="config-value">${block}</span></div>`;
      })()
    ].join('\n'));

    addGroup('Content & Navigation', [
      (() => { const has = !!cfg.contentRoot; const tip = esc(desc('contentRoot')||''); const titleAttr = tip ? ` title="${tip}"` : ''; return `<div class="config-item"><span class="config-label"${titleAttr}>Content Root:</span> ${has ? esc(contentRoot) : (esc(defaults.contentRoot) + ' ' + badge('warn','default'))}</div>`; })(),
      showRaw('Profile Links', Array.isArray(cfg.profileLinks) && cfg.profileLinks.length > 0, formatLinksList(cfg.profileLinks), 'Not set', 'warn', 'profileLinks'),
      showRaw('Nav Links', (cfg.links && ((Array.isArray(cfg.links) && cfg.links.length) || (typeof cfg.links === 'object' && Object.keys(cfg.links).length))), formatLinksList(cfg.links), 'Not set', 'warn', 'links'),
      (() => { const has = !!cfg.landingTab; const def = postsEnabled() ? 'posts' : 'first static tab or search'; const tip = esc(desc('landingTab')||''); const titleAttr = tip ? ` title="${tip}"` : ''; return `<div class="config-item">${makeLabel('Landing Tab', titleAttr, '')} <span class="config-value">${has ? esc(cfg.landingTab) : (esc(def) + ' ' + badge('warn','default'))}</span></div>`; })(),
    ].join('\n'));

    addGroup('Posts & Pagination', [
      showBool('Show All Posts', typeof cfg.showAllPosts === 'boolean', cfg.showAllPosts, defaults.showAllPosts, 'showAllPosts'),
      showBool('Enable All Posts', typeof cfg.enableAllPosts === 'boolean', cfg.enableAllPosts, defaults.enableAllPosts, 'enableAllPosts', 'alias'),
      showBool('Disable All Posts', typeof cfg.disableAllPosts === 'boolean', cfg.disableAllPosts, defaults.disableAllPosts, 'disableAllPosts', 'inverse'),
      showNum('Page Size (pageSize)', Number.isFinite(Number(cfg.pageSize)), cfg.pageSize, defaults.pageSize, 'pageSize'),
      show('Posts Per Page', !!cfg.postsPerPage, String(parseInt(cfg.postsPerPage,10)), String(defaults.postsPerPage), 'warn', 'postsPerPage', 'alias')
    ].join('\n'));

    addGroup('Internationalization', [
      show('Default Language', !!cfg.defaultLanguage, cfg.defaultLanguage, defaults.defaultLanguage, 'warn', 'defaultLanguage')
    ].join('\n'));

    addGroup('Theme', [
      show('Theme Mode', !!cfg.themeMode, cfg.themeMode, defaults.themeMode, 'warn', 'themeMode'),
      show('Theme Pack', !!cfg.themePack, cfg.themePack, defaults.themePack, 'warn', 'themePack'),
      showBool('Theme Override', typeof cfg.themeOverride === 'boolean', cfg.themeOverride, defaults.themeOverride, 'themeOverride'),
      showBool('Card Cover Fallback', typeof cfg.cardCoverFallback === 'boolean', cfg.cardCoverFallback, defaults.cardCoverFallback, 'cardCoverFallback')
    ].join('\n'));

    addGroup('Repository & Errors', [
      show('Repo Owner', !!(cfg.repo && cfg.repo.owner), (cfg.repo && cfg.repo.owner) || '', 'Not set', 'warn', 'repo.owner'),
      show('Repo Name', !!(cfg.repo && cfg.repo.name), (cfg.repo && cfg.repo.name) || '', 'Not set', 'warn', 'repo.name'),
      show('Repo Branch', !!(cfg.repo && cfg.repo.branch), (cfg.repo && cfg.repo.branch) || '', 'Not set', 'warn', 'repo.branch'),
      (() => {
        let derived = '';
        try { const r = cfg.repo || {}; if (r.owner && r.name) derived = `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}/issues/new`; } catch (_) {}
        const has = !!derived;
        const val = has ? derived : `Not set ${badge('warn','derived')}`;
        const tip = esc(desc('derived.reportIssueURL')||'');
        const titleAttr = tip ? ` title="${tip}"` : '';
        return `<div class="config-item"><span class="config-label"${titleAttr}>Report Issue URL (derived):</span> ${val}</div>`;
      })(),
      (() => { const has = typeof cfg.reportIssueURL === 'string' && cfg.reportIssueURL.trim().length > 0; const val = has ? cfg.reportIssueURL : `Not set ${badge('warn','optional')}`; const tip = esc(desc('reportIssueURL')||''); const titleAttr = tip ? ` title="${tip}"` : ''; return `<div class="config-item"><span class="config-label"${titleAttr}>reportIssueURL (non-schema):</span> ${esc(val)}</div>`; })(),
      showBool('Error Overlay', typeof cfg.errorOverlay === 'boolean', cfg.errorOverlay, defaults.errorOverlay, 'errorOverlay')
    ].join('\n'));

    addGroup('Asset Warnings & Freshness', [
      showNum('Content Outdated Days', Number.isFinite(Number(cfg.contentOutdatedDays)), cfg.contentOutdatedDays, defaults.contentOutdatedDays),
      showBool('Large Image Warning', !!(cfg.assetWarnings && cfg.assetWarnings.largeImage && typeof cfg.assetWarnings.largeImage.enabled === 'boolean'), cfg.assetWarnings && cfg.assetWarnings.largeImage && cfg.assetWarnings.largeImage.enabled, defaults.assetWarnings_largeImage_enabled),
      showNum('Large Image Threshold (KB)', !!(cfg.assetWarnings && cfg.assetWarnings.largeImage && Number.isFinite(Number(cfg.assetWarnings.largeImage.thresholdKB))), cfg.assetWarnings && cfg.assetWarnings.largeImage && cfg.assetWarnings.largeImage.thresholdKB, defaults.assetWarnings_largeImage_thresholdKB)
    ].join('\n'));

    const nav = groups.map((g, i) => `<button class="cat-item${i===0?' active':''}" data-id="${esc(g.id)}">${esc(g.title)}</button>`).join('');
    const first = groups[0] || { id: '', title: '', bodyHtml: '' };
    const iconFor = (title) => {
      const t = String(title || '').toLowerCase();
      if (t.includes('identity')) return '🌐';
      if (t.includes('content')) return '📁';
      if (t.includes('post')) return '📝';
      if (t.includes('international')) return '🌍';
      if (t.includes('theme')) return '🎨';
      if (t.includes('repository') || t.includes('error')) return '🛠️';
      if (t.includes('asset')) return '🖼️';
      return '📄';
    };
    const navWithIcons = groups
      .map((g, i) => `<button class="cat-item${i===0?' active':''}" data-id="${esc(g.id)}"><span class="cat-icon">${iconFor(g.title)}</span><span class="cat-label">${esc(g.title)}</span></button>`)
      .join('');
    const html = [
      '<div class="config-header">',
      '  <div class="config-header-left"><h3>Site Configuration</h3><div class="view-toggle" aria-label="View switch"><span class="vt-label">View:</span><a href="#" class="vt-btn active" data-view-target="config" onclick="return __switchView(\'config\',\'friendly\', this)">Friendly</a><span class="dim" aria-hidden="true">/</span><a href="#" class="vt-btn" data-view-target="config" onclick="return __switchView(\'config\',\'source\', this)">Source</a></div></div>',
      '  <div class="status-inline">',
      '    <p class="success">✓ Loaded</p>',
      '    <button class="icon-btn" type="button" onclick="loadSiteConfig()" title="Refresh configuration" aria-label="Refresh configuration">',
      '      <svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/>',
      '        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
      '      </svg>',
      '    </button>',
      '  </div>',
      '</div>',
      '<div class="config-body">',
      '  <div class="config-split">',
      '    <nav class="config-cats" id="configCats">', navWithIcons, '</nav>',
      '    <div class="config-pane" id="configPane">',
      '      <div class="pane-title"><div class="pane-title-left"><span class="pane-icon">', iconFor(first.title), '</span><span class="pane-label">', esc(first.title || ''), '</span></div></div>',
      '      <div class="section-body">', first.bodyHtml, '</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    if (previewEl) previewEl.innerHTML = html;
    // Re-apply persisted view state to keep toggle/content consistent (friendly/source)
    try { if (window.__applyView) window.__applyView('config'); } catch (_) {}
    // Removed old modal-based source viewer; replaced by in-page toggle.
    // Wire category switching
    try {
      const catsEl = document.getElementById('configCats');
      const paneEl = document.getElementById('configPane');
      if (catsEl && paneEl) {
        catsEl.addEventListener('click', (e) => {
          const btn = e.target && e.target.closest('.cat-item');
          if (!btn) return;
          const id = btn.getAttribute('data-id');
          const found = groups.find(g => g.id === id);
          if (!found) return;
          Array.from(catsEl.querySelectorAll('.cat-item')).forEach(el => el.classList.remove('active'));
          btn.classList.add('active');
          const icon = iconFor(found.title);
          paneEl.innerHTML = `<div class=\"pane-title\"><div class=\"pane-title-left\"><span class=\"pane-icon\">${icon}</span><span class=\"pane-label\">${found.title || ''}</span></div></div><div class=\"section-body\">${found.bodyHtml}</div>`;
        });
      }
    } catch (_) {}
    if (statusEl) { try { statusEl.innerHTML = ''; } catch(_) {} }
  } catch (error) {
    console.error('Error loading site config:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error loading configuration: ${error.message}</p>`;
    if (previewEl) previewEl.innerHTML = '<h3>Failed to load configuration</h3>';
  }
}

// Expose for inline calls
window.loadSiteConfig = loadSiteConfig;
