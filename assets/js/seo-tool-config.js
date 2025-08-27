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
    const show = (label, has, value, defText, kindWhenDefault = 'warn', keyForTip = '') => {
      const val = has ? value : `${esc(defText)} ${badge(kindWhenDefault, 'default')}`;
      const tip = desc(keyForTip) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      return `<div class="config-item"><span class="config-label"${titleAttr}>${esc(label)}:</span> ${has ? esc(value) : val}</div>`;
    };
    const showRaw = (label, has, htmlValue, defText, kindWhenDefault = 'warn', keyForTip = '') => {
      const val = has ? htmlValue : `${esc(defText)} ${badge(kindWhenDefault, 'default')}`;
      const tip = desc(keyForTip) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      return `<div class="config-item"><span class="config-label"${titleAttr}>${esc(label)}:</span> ${val}</div>`;
    };
    const showBool = (label, has, value, defVal, key) => {
      const tip = desc(key) || '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      const v = !!value;
      const d = !!defVal;
      const valHtml = has
        ? `<span class="bool ${v ? 'bool-true' : 'bool-false'}">${v ? 'true' : 'false'}</span>`
        : `<span class="bool ${d ? 'bool-true' : 'bool-false'}">${d ? 'true' : 'false'}</span> ${badge('warn','default')}`;
      return `<div class="config-item"><span class="config-label"${titleAttr}>${esc(label)}:</span> ${valHtml}</div>`;
    };
    const showNum = (label, has, value, defVal, key) => show(label, has, String(parseInt(value,10)), String(defVal), 'warn', key);
    const section = (title, bodyHtml, open = false) => `
      <details ${open ? 'open' : ''}>
        <summary>${esc(title)}</summary>
        <div class="section-body">
          ${bodyHtml}
        </div>
      </details>`;

    // Build preview HTML
    const html = [
      '<div class="config-header">',
      '  <h3>Current Configuration</h3>',
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

      // Identity & SEO (default open)
      section('Identity & SEO', [
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
          return `<div class="config-item"><span class="config-label"${titleAttr}>Resource URL:</span> ${html}</div>`;
        })(),
        (() => {
          const has = !!cfg.avatar;
          const src = has ? esc(cfg.avatar) : '';
          const tip = esc(desc('avatar')||'');
          const titleAttr = tip ? ` title="${tip}"` : '';
          if (!has) return `<div class="config-item"><span class="config-label"${titleAttr}>Avatar:</span> ${esc('Generated fallback image')} ${badge('warn','default')}` + `</div>`;
          const block = `
            <div class="config-avatar-block">
              <img class="config-avatar" src="${src}" alt="Avatar preview" loading="lazy"/>
              <div class="config-avatar-path"><code>${src}</code></div>
            </div>`;
          return `<div class="config-item"><span class="config-label"${titleAttr}>Avatar:</span> ${block}</div>`;
        })()
      ].join('\n'), true),

      // Content & Navigation
      section('Content & Navigation', [
        (() => { const has = !!cfg.contentRoot; const tip = esc(desc('contentRoot')||''); const titleAttr = tip ? ` title="${tip}"` : ''; return `<div class="config-item"><span class="config-label"${titleAttr}>Content Root:</span> ${has ? esc(contentRoot) : (esc(defaults.contentRoot) + ' ' + badge('warn','default'))}</div>`; })(),
        showRaw('Profile Links', Array.isArray(cfg.profileLinks) && cfg.profileLinks.length > 0, formatLinksList(cfg.profileLinks), 'Not set', 'warn', 'profileLinks'),
        showRaw('Nav Links', (cfg.links && ((Array.isArray(cfg.links) && cfg.links.length) || (typeof cfg.links === 'object' && Object.keys(cfg.links).length))), formatLinksList(cfg.links), 'Not set', 'warn', 'links'),
        (() => { const has = !!cfg.landingTab; const def = postsEnabled() ? 'posts' : 'first static tab or search'; const tip = esc(desc('landingTab')||''); const titleAttr = tip ? ` title="${tip}"` : ''; return `<div class="config-item"><span class="config-label"${titleAttr}>Landing Tab:</span> ${has ? esc(cfg.landingTab) : (esc(def) + ' ' + badge('warn','default'))}</div>`; })(),
      ].join('\n')),

      // Posts & Pagination
      section('Posts & Pagination', [
        showBool('Show All Posts', typeof cfg.showAllPosts === 'boolean', cfg.showAllPosts, defaults.showAllPosts, 'showAllPosts'),
        showBool('Enable All Posts (alias)', typeof cfg.enableAllPosts === 'boolean', cfg.enableAllPosts, defaults.enableAllPosts, 'enableAllPosts'),
        showBool('Disable All Posts (inverse)', typeof cfg.disableAllPosts === 'boolean', cfg.disableAllPosts, defaults.disableAllPosts, 'disableAllPosts'),
        showNum('Page Size (pageSize)', Number.isFinite(Number(cfg.pageSize)), cfg.pageSize, defaults.pageSize, 'pageSize'),
        showNum('Posts Per Page (alias)', Number.isFinite(Number(cfg.postsPerPage)), cfg.postsPerPage, defaults.postsPerPage, 'postsPerPage')
      ].join('\n')),

      // Internationalization
      section('Internationalization', [
        show('Default Language', !!cfg.defaultLanguage, cfg.defaultLanguage, defaults.defaultLanguage, 'warn', 'defaultLanguage')
      ].join('\n')),

      // Theme
      section('Theme', [
        show('Theme Mode', !!cfg.themeMode, cfg.themeMode, defaults.themeMode, 'warn', 'themeMode'),
        show('Theme Pack', !!cfg.themePack, cfg.themePack, defaults.themePack, 'warn', 'themePack'),
        showBool('Theme Override', typeof cfg.themeOverride === 'boolean', cfg.themeOverride, defaults.themeOverride, 'themeOverride'),
        showBool('Card Cover Fallback', typeof cfg.cardCoverFallback === 'boolean', cfg.cardCoverFallback, defaults.cardCoverFallback, 'cardCoverFallback')
      ].join('\n')),

      // Repository & Errors
      section('Repository & Errors', [
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
      ].join('\n')),

      // Asset Warnings & Freshness
      section('Asset Warnings & Freshness', [
        showNum('Content Outdated Days', Number.isFinite(Number(cfg.contentOutdatedDays)), cfg.contentOutdatedDays, defaults.contentOutdatedDays),
        showBool('Large Image Warning', !!(cfg.assetWarnings && cfg.assetWarnings.largeImage && typeof cfg.assetWarnings.largeImage.enabled === 'boolean'), cfg.assetWarnings && cfg.assetWarnings.largeImage && cfg.assetWarnings.largeImage.enabled, defaults.assetWarnings_largeImage_enabled),
        showNum('Large Image Threshold (KB)', !!(cfg.assetWarnings && cfg.assetWarnings.largeImage && Number.isFinite(Number(cfg.assetWarnings.largeImage.thresholdKB))), cfg.assetWarnings && cfg.assetWarnings.largeImage && cfg.assetWarnings.largeImage.thresholdKB, defaults.assetWarnings_largeImage_thresholdKB)
      ].join('\n')),
    ].join('\n');

    if (previewEl) previewEl.innerHTML = html;
    if (statusEl) { try { statusEl.innerHTML = ''; } catch(_) {} }
  } catch (error) {
    console.error('Error loading site config:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error loading configuration: ${error.message}</p>`;
    if (previewEl) previewEl.innerHTML = '<h3>Failed to load configuration</h3>';
  }
}

// Expose for inline calls
window.loadSiteConfig = loadSiteConfig;
