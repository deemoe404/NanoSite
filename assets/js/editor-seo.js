import './seo-tool-state.js';
import {
  generateSitemap,
  generateRobots,
  generateMetaTags,
  copySitemap,
  copyRobots,
  copyMetaTags,
  downloadSitemap,
  downloadRobots,
  downloadMetaTags
} from './seo-tool-generators.js?v=2';
import { getEditorValue, setEditorValue } from './hieditor.js';

const SEO_FILES = {
  sitemap: {
    path: 'sitemap.xml',
    label: 'sitemap.xml',
    outputId: 'sitemapOutput',
    statusId: 'seoStatus-sitemap',
    badgeId: 'seoStatusBadge-sitemap',
    loadBtn: 'seoLoadSitemap',
    generateBtn: 'seoGenerateSitemap',
    copyBtn: 'seoCopySitemap',
    downloadBtn: 'seoDownloadSitemap',
    resetBtn: 'seoResetSitemap',
    generator: generateSitemap,
    copier: copySitemap,
    downloader: downloadSitemap,
    loaded: false,
    loading: null,
    cachedContent: '',
    liveExists: null
  },
  robots: {
    path: 'robots.txt',
    label: 'robots.txt',
    outputId: 'robotsOutput',
    statusId: 'seoStatus-robots',
    badgeId: 'seoStatusBadge-robots',
    loadBtn: 'seoLoadRobots',
    generateBtn: 'seoGenerateRobots',
    copyBtn: 'seoCopyRobots',
    downloadBtn: 'seoDownloadRobots',
    resetBtn: 'seoResetRobots',
    generator: generateRobots,
    copier: copyRobots,
    downloader: downloadRobots,
    loaded: false,
    loading: null,
    cachedContent: '',
    liveExists: null
  },
  meta: {
    path: 'meta-tags.html',
    label: 'meta-tags.html',
    outputId: 'metaOutput',
    statusId: 'seoStatus-meta',
    badgeId: 'seoStatusBadge-meta',
    loadBtn: 'seoLoadMeta',
    generateBtn: 'seoGenerateMeta',
    copyBtn: 'seoCopyMeta',
    downloadBtn: 'seoDownloadMeta',
    resetBtn: 'seoResetMeta',
    generator: generateMetaTags,
    copier: copyMetaTags,
    downloader: downloadMetaTags,
    loaded: false,
    loading: null,
    cachedContent: '',
    liveExists: null
  }
};

let seoModeInitialized = false;

const STATUS_BADGE_LABELS = {
  idle: 'Not checked yet',
  loading: 'In progress…',
  clean: 'Up to date',
  dirty: 'Update ready',
  empty: 'Not published',
  error: 'Needs attention'
};

function composerApi() {
  try {
    return window.__nsSeoDraftApi || {};
  } catch (_) {
    return {};
  }
}

function setBaseline(kind, text, meta) {
  const api = composerApi();
  if (typeof api.setBaseline === 'function') api.setBaseline(kind, text, meta);
}

function setContent(kind, text, meta) {
  const api = composerApi();
  if (typeof api.setContent === 'function') api.setContent(kind, text, meta);
}

function resetDraft(kind) {
  const api = composerApi();
  if (typeof api.reset === 'function') api.reset(kind);
}

function getDraft(kind) {
  const api = composerApi();
  if (typeof api.get === 'function') return api.get(kind);
  return null;
}

function statusBadgeText(state) {
  return STATUS_BADGE_LABELS[state] || STATUS_BADGE_LABELS.idle;
}

function updateStatus(kind, message, state = 'idle') {
  const info = SEO_FILES[kind];
  if (!info) return;
  const statusEl = document.getElementById(info.statusId);
  const badgeEl = info.badgeId ? document.getElementById(info.badgeId) : null;
  const cardEl = document.querySelector(`[data-seo-kind="${kind}"]`);
  if (statusEl && message != null) statusEl.textContent = message;
  if (!state) return;
  if (statusEl) statusEl.dataset.state = state;
  if (badgeEl) {
    badgeEl.dataset.state = state;
    badgeEl.textContent = statusBadgeText(state);
  }
  if (cardEl) cardEl.dataset.state = state;
}

function refreshStatus(kind) {
  const info = SEO_FILES[kind];
  if (!info) return;
  const entry = getDraft(kind);

  if (!info.loaded) {
    updateStatus(kind, 'Check the live file to see if it needs an update.', 'idle');
    return;
  }

  if (!entry) {
    updateStatus(kind, 'Check the live file to see if it needs an update.', 'idle');
    return;
  }

  if (entry.dirty) {
    const msg = entry.exists
      ? 'A newer version is ready. Include it in your next sync to update the live file.'
      : 'This file is new. Sync it to publish on your site.';
    updateStatus(kind, msg, 'dirty');
    return;
  }

  if (entry.exists) {
    updateStatus(kind, 'The live file already matches the latest generated version.', 'clean');
  } else {
    updateStatus(kind, 'This file is not on the site yet. Generate it to add it to your next sync.', 'empty');
  }
}

function refreshAllStatuses() {
  Object.keys(SEO_FILES).forEach((kind) => refreshStatus(kind));
}

async function loadExisting(kind, options = {}) {
  const info = SEO_FILES[kind];
  if (!info) return '';
  if (info.loading) return info.loading;
  if (info.loaded && !options.force) return info.cachedContent;

  updateStatus(kind, 'Checking the live file…', 'loading');
  const loader = (async () => {
    let content = '';
    let exists = false;
    try {
      const response = await fetch(info.path, { cache: 'no-store' });
      if (response.status === 404) {
        content = '';
        exists = false;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        content = await response.text();
        exists = true;
      }
    } catch (err) {
      updateStatus(kind, `Failed to load (${err.message || 'error'})`, 'error');
      info.loaded = false;
      info.liveExists = null;
      throw err;
    }

    setBaseline(kind, content, { exists, path: info.path, label: info.label });

    info.liveExists = exists;

    const textarea = document.getElementById(info.outputId);
    if (textarea) textarea.value = content;
    try { setEditorValue(info.outputId, content); } catch (_) {}

    info.loaded = true;
    info.cachedContent = content;
    refreshStatus(kind);
    return content;
  })().finally(() => {
    info.loading = null;
  });

  info.loading = loader;
  return loader;
}

function handleTextareaInput(kind) {
  const info = SEO_FILES[kind];
  if (!info) return;
  const textarea = document.getElementById(info.outputId);
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    const value = textarea.value || '';
    setContent(kind, value, { path: info.path, label: info.label });
    refreshStatus(kind);
  });
}

function extractEditorValue(kind) {
  const info = SEO_FILES[kind];
  if (!info) return '';
  let value = '';
  try { value = getEditorValue(info.outputId) || ''; }
  catch (_) { value = ''; }
  if (!value) {
    const textarea = document.getElementById(info.outputId);
    if (textarea) value = textarea.value || '';
  }
  return value;
}

function attachButtonHandlers(kind) {
  const info = SEO_FILES[kind];
  if (!info) return;

  const loadBtn = document.getElementById(info.loadBtn);
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadExisting(kind, { force: true }).catch(() => {});
    });
  }

  const generateBtn = document.getElementById(info.generateBtn);
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      if (!info.loaded) {
        try { await loadExisting(kind); }
        catch (_) { /* swallow load errors; generation may still proceed */ }
      }
      updateStatus(kind, 'Generating a fresh version…', 'loading');
      try {
        await info.generator();
      } catch (err) {
        updateStatus(kind, `Generation failed (${err && err.message ? err.message : 'error'})`, 'error');
        return;
      }
      const value = extractEditorValue(kind);
      setContent(kind, value, { path: info.path, label: info.label });
      info.cachedContent = value;
      refreshStatus(kind);
    });
  }

  const copyBtn = document.getElementById(info.copyBtn);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      try { info.copier(); }
      catch (_) {}
    });
  }

  const downloadBtn = document.getElementById(info.downloadBtn);
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      try { info.downloader(); }
      catch (_) {}
    });
  }

  const resetBtn = document.getElementById(info.resetBtn);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const entryBefore = getDraft(kind);
      resetDraft(kind);
      const entryAfter = getDraft(kind) || entryBefore;
      const original = entryAfter ? entryAfter.original || '' : '';
      try { setEditorValue(info.outputId, original); } catch (_) {}
      const textarea = document.getElementById(info.outputId);
      if (textarea) textarea.value = original;
      info.cachedContent = original;
      refreshStatus(kind);
    });
  }
}

async function initializeSeoMode() {
  if (seoModeInitialized) {
    refreshAllStatuses();
    return;
  }
  seoModeInitialized = true;
  Object.keys(SEO_FILES).forEach((kind) => {
    handleTextareaInput(kind);
    attachButtonHandlers(kind);
  });
  refreshAllStatuses();
  await Promise.all(Object.keys(SEO_FILES).map((kind) => loadExisting(kind).catch(() => {})));
}

document.addEventListener('DOMContentLoaded', () => {
  const activeTab = document.querySelector('.mode-tab.is-active');
  if (activeTab && activeTab.dataset.mode === 'seo') {
    initializeSeoMode().catch(() => {});
  } else {
    refreshAllStatuses();
  }
});

document.addEventListener('ns:mode-changed', (event) => {
  const detail = event && event.detail;
  if (!detail) return;
  if (detail.mode === 'seo') {
    initializeSeoMode().catch(() => {});
  }
});

document.addEventListener('ns:seo-draft-change', (event) => {
  const detail = event && event.detail;
  if (!detail || !detail.kind) {
    refreshAllStatuses();
    return;
  }
  refreshStatus(detail.kind);
});
