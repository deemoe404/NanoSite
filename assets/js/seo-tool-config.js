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
    const getLocalizedValue = (val, fallback = 'Not set') => {
      if (!val) return fallback;
      if (typeof val === 'string') return val;
      return val.default || fallback;
    };
    if (previewEl) previewEl.innerHTML = `
      <h4>Site Configuration</h4>
      <div class="config-item"><span class="config-label">Site Title:</span> ${getLocalizedValue(state.currentSiteConfig.siteTitle)}</div>
      <div class="config-item"><span class="config-label">Resource URL:</span> ${state.currentSiteConfig.resourceURL || 'Not set'}</div>
      <div class="config-item"><span class="config-label">Description:</span> ${getLocalizedValue(state.currentSiteConfig.siteDescription)}</div>
      <div class="config-item"><span class="config-label">Keywords:</span> ${getLocalizedValue(state.currentSiteConfig.siteKeywords)}</div>
      <div class="config-item"><span class="config-label">Avatar:</span> ${state.currentSiteConfig.avatar || 'Not set'}</div>
      <div class="config-item"><span class="config-label">Content Root:</span> ${getContentRootFrom(state.currentSiteConfig)}</div>
    `;
    if (statusEl) statusEl.innerHTML = '<p class="success">✓ Configuration loaded.</p>';
  } catch (error) {
    console.error('Error loading site config:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error loading configuration: ${error.message}</p>`;
    if (previewEl) previewEl.innerHTML = '<h4>Failed to load configuration</h4>';
  }
}

// Expose for inline calls
window.loadSiteConfig = loadSiteConfig;
