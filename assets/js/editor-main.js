import './cache-control.js';
import { createHiEditor } from './hieditor.js';
import { mdParse } from './markdown.js';
import { getContentRoot, setSafeHtml } from './utils.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';
import { applyLazyLoadingIn, hydratePostImages, hydratePostVideos } from './post-render.js';
import { hydrateInternalLinkCards } from './link-cards.js';
import { applyLangHints } from './typography.js';
import { fetchConfigWithYamlFallback } from './yaml.js';
import { t, withLangParam, loadContentJson, getCurrentLang, normalizeLangKey } from './i18n.js';

const LS_WRAP_KEY = 'ns_editor_wrap_enabled';

const previewAssetBuckets = new Map();
let previewAssetCurrentPath = '';

const getContentRootPrefix = () => {
  try {
    const raw = String(getContentRoot() || '').trim();
    if (!raw) return '';
    return raw
      .replace(/[\\]/g, '/')
      .replace(/\/+$/, '');
  } catch (_) {
    return '';
  }
};

const safePreviewMime = (mime) => {
  try {
    const raw = String(mime || '').trim().toLowerCase();
    if (!raw) return 'image/png';
    return raw.startsWith('image/') ? raw : 'image/png';
  } catch (_) {
    return 'image/png';
  }
};

const makePreviewDataUrl = (base64, mime) => {
  try {
    const data = String(base64 || '').trim();
    if (!data) return '';
    const type = safePreviewMime(mime);
    return `data:${type};base64,${data}`;
  } catch (_) {
    return '';
  }
};

const normalizePreviewKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:)/i.test(raw)) return raw;
  let input = raw;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
      const url = new URL(input, window.location.href);
      input = url.pathname || '';
    }
  } catch (_) {
    /* ignore URL parse errors */
  }
  return input
    .replace(/^[?#]+/, '')
    .replace(/[\\]/g, '/')
    .replace(/\/+/, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
};

const normalizePreviewPath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[\\]/g, '/');
  const parts = cleaned.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  let normalized = stack.join('/');
  const prefix = getContentRootPrefix();
  if (prefix) {
    if (normalized === prefix) return '';
    if (normalized.startsWith(`${prefix}/`)) {
      normalized = normalized.slice(prefix.length + 1);
    }
  }
  return normalized;
};

const buildPreviewKeysForAsset = (asset) => {
  const keys = new Set();
  const commit = normalizePreviewKey(asset && (asset.path || asset.commitPath));
  const rel = normalizePreviewKey(asset && asset.relativePath);
  const prefix = getContentRootPrefix();
  const join = (base, suffix) => {
    if (!base) return suffix;
    return `${base}/${suffix}`.replace(/\/+/, '/');
  };
  if (commit) {
    keys.add(commit);
    if (prefix) keys.add(join(prefix, commit));
  }
  if (rel) {
    keys.add(rel);
    if (prefix) keys.add(join(prefix, rel));
  }
  return Array.from(keys).filter(Boolean);
};

const updatePreviewAssetBucket = (path, assets) => {
  const norm = normalizePreviewPath(path);
  if (!norm) {
    if (path) previewAssetBuckets.delete(norm);
    return;
  }
  let bucket = previewAssetBuckets.get(norm);
  if (!bucket) {
    bucket = new Map();
    previewAssetBuckets.set(norm, bucket);
  }
  const list = Array.isArray(assets) ? assets : [];
  if (!list.length) {
    bucket.clear();
    previewAssetBuckets.delete(norm);
    return;
  }
  const keep = new Set();
  list.forEach((asset) => {
    if (!asset) return;
    const base64 = typeof asset.base64 === 'string' ? asset.base64.trim() : '';
    if (!base64) return;
    const url = makePreviewDataUrl(base64, asset.mime);
    if (!url) return;
    const keys = buildPreviewKeysForAsset(asset);
    if (!keys.length) return;
    keys.forEach((key) => {
      if (!key) return;
      bucket.set(key, { url, mime: safePreviewMime(asset.mime) });
      keep.add(key);
    });
  });
  Array.from(bucket.keys()).forEach((key) => {
    if (!keep.has(key)) bucket.delete(key);
  });
  if (!bucket.size) previewAssetBuckets.delete(norm);
};

const lookupPreviewAsset = (bucket, key) => {
  if (!bucket || !key) return null;
  const direct = bucket.get(key);
  if (direct) return direct;
  const prefix = getContentRootPrefix();
  if (prefix && key.startsWith(`${prefix}/`)) {
    const trimmed = key.slice(prefix.length + 1);
    return bucket.get(trimmed) || null;
  }
  return null;
};

const applyPreviewAssetOverrides = (container, markdownPath) => {
  const normPath = normalizePreviewPath(markdownPath || previewAssetCurrentPath);
  if (!normPath) return;
  const bucket = previewAssetBuckets.get(normPath);
  if (!bucket || !bucket.size) return;
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) return;

  const rewriteAttr = (node, attr) => {
    if (!node) return;
    const raw = node.getAttribute(attr);
    if (!raw) return;
    const key = normalizePreviewKey(raw);
    if (!key) return;
    const asset = lookupPreviewAsset(bucket, key);
    if (!asset || !asset.url) return;
    if (node.getAttribute(attr) === asset.url) return;
    node.setAttribute(attr, asset.url);
  };

  const rewriteSrcset = (node, attr) => {
    if (!node) return;
    const raw = node.getAttribute(attr);
    if (!raw) return;
    const parts = raw.split(',');
    let changed = false;
    const next = parts.map((part) => {
      const seg = part.trim();
      if (!seg) return '';
      const bits = seg.split(/\s+/);
      const url = bits.shift();
      const asset = lookupPreviewAsset(bucket, normalizePreviewKey(url));
      if (asset && asset.url) {
        changed = true;
        return [asset.url, ...bits].join(' ');
      }
      return seg;
    });
    if (changed) node.setAttribute(attr, next.filter(Boolean).join(', '));
  };

  root.querySelectorAll('img').forEach((img) => {
    rewriteAttr(img, 'src');
    rewriteAttr(img, 'data-src');
    rewriteAttr(img, 'data-original');
    rewriteSrcset(img, 'srcset');
  });
  root.querySelectorAll('source').forEach((source) => {
    rewriteAttr(source, 'src');
    rewriteSrcset(source, 'srcset');
  });
  root.querySelectorAll('video').forEach((video) => {
    rewriteAttr(video, 'poster');
    rewriteAttr(video, 'src');
    rewriteSrcset(video, 'srcset');
  });
};

const refreshPreviewAssetOverrides = () => {
  const target = document.getElementById('mainview');
  if (!target) return;
  applyPreviewAssetOverrides(target, previewAssetCurrentPath);
};

const fetchMarkdownForLinkCard = (loc) => {
  try {
    const url = `${getContentRoot()}/${loc}`;
    return fetch(url, { cache: 'no-store' }).then(resp => (resp && resp.ok) ? resp.text() : '');
  } catch (_) {
    return Promise.resolve('');
  }
};

const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getPlainText = (() => {
  const entityMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const knownTags = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
    'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
    'legend', 'li', 'link', 'main', 'map', 'mark', 'meta', 'meter', 'nav', 'noscript', 'object',
    'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby',
    's', 'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style',
    'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th',
    'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
  ]);
  const spacedTags = new Set([
    'article', 'aside', 'blockquote', 'br', 'div', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'footer',
    'form', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'title', 'tr', 'ul', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);
  const decodeEntity = (entity) => {
    if (!entity) return '&';
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const num = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(num)) {
        try {
          return String.fromCodePoint(num);
        } catch (_) {
          return `&${entity};`;
        }
      }
      return `&${entity};`;
    }
    const mapped = entityMap[entity.toLowerCase()];
    return mapped != null ? mapped : `&${entity};`;
  };

  return (value) => {
    if (value == null) return '';
    const input = String(value);
    let result = '';
    let entityBuffer = '';
    let capturingEntity = false;
    let pendingSpace = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (capturingEntity) {
        if (ch === ';') {
          result += decodeEntity(entityBuffer);
          entityBuffer = '';
          capturingEntity = false;
        } else if (/^[0-9a-zA-Z#]$/.test(ch) && entityBuffer.length < 32) {
          entityBuffer += ch;
        } else {
          result += `&${entityBuffer}${ch}`;
          entityBuffer = '';
          capturingEntity = false;
        }
        continue;
      }

      if (ch === '&') {
        capturingEntity = true;
        entityBuffer = '';
        continue;
      }

      if (ch === '<') {
        const close = input.indexOf('>', i + 1);
        if (close === -1) {
          result += '<';
        } else {
          const tagContent = input.slice(i + 1, close).trim();
          const appendGap = () => { if (result && !/\s$/.test(result)) result += ' '; };
          if (tagContent.startsWith('!--') || tagContent.toLowerCase().startsWith('!doctype')) {
            appendGap();
            pendingSpace = true;
            i = close;
            continue;
          }
          const tagMatch = tagContent.match(/^\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/);
          const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;
          if (tagName && (knownTags.has(tagName) || tagName.includes('-'))) {
            if (spacedTags.has(tagName)) {
              appendGap();
              pendingSpace = true;
            }
            i = close;
            continue;
          }
          result += '<';
        }
        continue;
      }

      if (/\s/.test(ch)) {
        if (!result || !/\s$/.test(result)) result += ' ';
        pendingSpace = false;
        continue;
      }

      if (pendingSpace && result && !/\s$/.test(result)) {
        result += ' ';
      }
      pendingSpace = false;

      result += ch;
    }

    if (capturingEntity) result += `&${entityBuffer}`;

    return result.replace(/\s+/g, ' ').trim();
  };
})();

let editorSiteConfig = {};
let editorPostsIndexCache = {};
let editorAllowedLocations = null;
let editorLocationAliasMap = new Map();
let editorPostsByLocationTitle = {};
let linkCardReady = false;
let editorPostPickerEntries = [];
const editorLinkCardContextListeners = new Set();

function rebuildLinkCardContext(posts, rawIndex) {
  try {
    const allowed = new Set();
    if (posts && typeof posts === 'object') {
      Object.values(posts).forEach(meta => {
        if (!meta) return;
        if (meta.location) allowed.add(String(meta.location));
        if (Array.isArray(meta.versions)) {
          meta.versions.forEach(ver => { if (ver && ver.location) allowed.add(String(ver.location)); });
        }
      });
    }
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      for (const entry of Object.values(rawIndex)) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [key, val] of Object.entries(entry)) {
          if (['tag','tags','image','date','excerpt','thumb','cover'].includes(key)) continue;
          if (key === 'location' && typeof val === 'string') { allowed.add(String(val)); continue; }
          if (Array.isArray(val)) { val.forEach(item => { if (typeof item === 'string') allowed.add(String(item)); }); continue; }
          if (val && typeof val === 'object' && typeof val.location === 'string') { allowed.add(String(val.location)); continue; }
          if (typeof val === 'string') { allowed.add(String(val)); }
        }
      }
    }

    const byLocation = {};
    for (const [title, meta] of Object.entries(posts || {})) {
      if (!meta) continue;
      if (meta.location) byLocation[String(meta.location)] = title;
      if (Array.isArray(meta.versions)) {
        meta.versions.forEach(ver => { if (ver && ver.location) byLocation[String(ver.location)] = title; });
      }
    }

    const alias = new Map();
    const reserved = new Set(['tag','tags','image','date','excerpt','thumb','cover']);
    const currentLang = normalizeLangKey((getCurrentLang && getCurrentLang()) || 'en');
    const pickerEntries = new Map();
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      for (const [entryKey, entry] of Object.entries(rawIndex)) {
        if (!entry || typeof entry !== 'object') continue;
        const variants = [];
        for (const [key, val] of Object.entries(entry)) {
          if (reserved.has(key)) continue;
          if (key === 'location' && typeof val === 'string') {
            variants.push({ lang: 'default', location: String(val) });
            continue;
          }
          const nk = normalizeLangKey(key);
          if (typeof val === 'string') {
            variants.push({ lang: nk, location: String(val) });
          } else if (Array.isArray(val)) {
            val.forEach(item => { if (typeof item === 'string') variants.push({ lang: nk, location: String(item) }); });
          } else if (val && typeof val === 'object' && typeof val.location === 'string') {
            variants.push({ lang: nk, location: String(val.location) });
          }
        }
        if (!variants.length) continue;
        const findBy = (langs) => variants.find(v => langs.includes(v.lang));
        let canonical = null;
        const preferred = findBy([currentLang]) || findBy(['en']) || findBy(['default']) || variants[0];
        if (preferred) {
          const refTitle = byLocation[preferred.location];
          const refMeta = refTitle ? posts[refTitle] : null;
          if (refMeta && refMeta.location) canonical = String(refMeta.location);
        }
        if (!canonical && preferred) canonical = preferred.location;
        if (!canonical && variants[0]) canonical = variants[0].location;
        if (!canonical) continue;
        variants.forEach(v => {
          if (v.location && v.location !== canonical) alias.set(v.location, canonical);
        });
        const displayTitle = byLocation[canonical] || entry.title || entryKey;
        const aliasLocations = variants
          .map(v => v.location)
          .filter(loc => loc && loc !== canonical);
        pickerEntries.set(canonical, {
          key: entryKey,
          title: displayTitle || entryKey,
          location: canonical,
          aliases: aliasLocations
        });
      }
    }

    editorAllowedLocations = allowed;
    editorPostsByLocationTitle = byLocation;
    editorLocationAliasMap = alias;
    editorPostsIndexCache = posts || {};
    editorPostPickerEntries = Array.from(pickerEntries.values()).map(item => {
      const tokens = new Set();
      if (item.key) tokens.add(String(item.key));
      if (item.title) tokens.add(String(item.title));
      if (item.location) tokens.add(String(item.location));
      (item.aliases || []).forEach(loc => { if (loc) tokens.add(String(loc)); });
      return {
        key: item.key,
        title: item.title,
        location: item.location,
        aliases: item.aliases || [],
        search: Array.from(tokens).map(t => t.toLowerCase()).join(' ')
      };
    }).sort((a, b) => {
      const at = (a.title || '').toLowerCase();
      const bt = (b.title || '').toLowerCase();
      if (at === bt) return (a.key || '').localeCompare(b.key || '');
      return at.localeCompare(bt);
    });
    editorLinkCardContextListeners.forEach(fn => {
      try { fn(editorPostPickerEntries); }
      catch (_) { /* noop */ }
    });
    linkCardReady = true;
  } catch (_) {
    editorAllowedLocations = editorAllowedLocations || new Set();
  }
}

function $(sel) { return document.querySelector(sel); }

function switchView(mode) {
  const editorWrap = $('#editor-wrap');
  const previewWrap = $('#preview-wrap');
  const btnEdit = document.querySelector('.vt-btn[data-view="edit"]');
  const btnPreview = document.querySelector('.vt-btn[data-view="preview"]');
  if (!editorWrap || !previewWrap) return;
  if (mode === 'preview') {
    editorWrap.style.display = 'none';
    previewWrap.style.display = '';
    btnEdit && btnEdit.classList.remove('active');
    btnPreview && btnPreview.classList.add('active');
  } else {
    previewWrap.style.display = 'none';
    editorWrap.style.display = '';
    btnPreview && btnPreview.classList.remove('active');
    btnEdit && btnEdit.classList.add('active');
  }
}

function renderPreview(mdText) {
  try {
    const target = document.getElementById('mainview');
    if (!target) return;
    // Use the current markdown file directory (if known) as baseDir
    // so relative image/link paths resolve correctly in preview.
    const baseDir = (window.__ns_editor_base_dir && String(window.__ns_editor_base_dir))
      || (`${getContentRoot()}/`);
    const { post } = mdParse(mdText || '', baseDir);
    setSafeHtml(target, post || '', baseDir, { alreadySanitized: true });
    try { hydratePostImages(target); } catch (_) {}
    try { applyLazyLoadingIn(target); } catch (_) {}
    try { applyLangHints(target); } catch (_) {}
    try { hydrateInternalLinkCards(target, {
      allowedLocations: linkCardReady ? editorAllowedLocations : null,
      locationAliasMap: linkCardReady ? editorLocationAliasMap : new Map(),
      postsByLocationTitle: linkCardReady ? editorPostsByLocationTitle : {},
      postsIndexCache: linkCardReady ? editorPostsIndexCache : {},
      siteConfig: editorSiteConfig,
      translate: t,
      makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`),
      fetchMarkdown: fetchMarkdownForLinkCard
    }); } catch (_) {}
    try { hydratePostVideos(target); } catch (_) {}
    try { initSyntaxHighlighting(); } catch (_) {}
    try { applyPreviewAssetOverrides(target, previewAssetCurrentPath); } catch (_) {}
  } catch (_) {}
}

// ---- Local draft storage removed (temporary) ----

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('mdInput');
  const editor = createHiEditor(ta, 'markdown', false);
  const imageButton = document.getElementById('btnInsertImage');
  const imageInput = document.getElementById('editorImageInput');
  const editorToolbarEl = document.getElementById('editorToolbar');
  const cardButton = document.getElementById('btnInsertCard');
  const cardPopover = document.getElementById('editorCardPicker');
  const cardSearchInput = document.getElementById('cardPickerSearch');
  const cardListEl = document.getElementById('cardPickerList');
  const cardEmptyEl = document.getElementById('cardPickerEmpty');
  const wrapToggle = document.getElementById('wrapToggle');
  const wrapToggleButtons = wrapToggle ? Array.from(wrapToggle.querySelectorAll('[data-wrap]')) : [];
  const editorLayoutEl = document.getElementById('mode-editor');
  const editorMainEl = editorLayoutEl ? editorLayoutEl.querySelector('.editor-main') : null;
  const editorEmptyStateEl = document.getElementById('editorEmptyState');
  let wrapEnabled = false;

  const applyEditorEmptyState = (isEmpty) => {
    const empty = !!isEmpty;
    if (editorLayoutEl) editorLayoutEl.classList.toggle('is-empty', empty);
    if (editorMainEl) {
      if (empty) editorMainEl.setAttribute('hidden', '');
      else editorMainEl.removeAttribute('hidden');
    }
    if (editorEmptyStateEl) {
      if (empty) {
        editorEmptyStateEl.removeAttribute('hidden');
        editorEmptyStateEl.removeAttribute('aria-hidden');
      } else {
        editorEmptyStateEl.setAttribute('hidden', '');
        editorEmptyStateEl.setAttribute('aria-hidden', 'true');
      }
    }
  };
  applyEditorEmptyState(true);

  const readWrapState = () => {
    try {
      const raw = localStorage.getItem(LS_WRAP_KEY);
      if (!raw) return false;
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return Boolean(JSON.parse(raw));
    } catch (_) {
      return false;
    }
  };

  const persistWrapState = (on) => {
    try { localStorage.setItem(LS_WRAP_KEY, on ? '1' : '0'); }
    catch (_) {}
  };

  const syncWrapToggle = (on) => {
    const enabled = !!on;
    if (wrapToggle) {
      wrapToggle.setAttribute('data-state', enabled ? 'on' : 'off');
    }
    wrapToggleButtons.forEach((btn) => {
      const isOn = (btn.dataset.wrap || '').toLowerCase() === 'on';
      const active = isOn === enabled;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  const applyWrapState = (value, opts = {}) => {
    const on = !!value;
    wrapEnabled = on;
    if (editor && typeof editor.setWrap === 'function') {
      editor.setWrap(on);
    } else if (ta) {
      try {
        ta.setAttribute('wrap', on ? 'soft' : 'off');
        ta.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      } catch (_) {}
    }
    syncWrapToggle(on);
    if (opts.persist !== false) persistWrapState(on);
  };

  const handleWrapSelection = (state) => {
    const next = String(state || '').toLowerCase() === 'on';
    applyWrapState(next);
  };

  wrapToggleButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      handleWrapSelection(btn.dataset.wrap);
    });
    btn.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        handleWrapSelection(btn.dataset.wrap);
      }
    });
  });

  applyWrapState(readWrapState(), { persist: false });

  const seed = `# 新文章标题\n\n> 在左侧编辑 Markdown，切换到 Preview 查看渲染效果。\n\n- 支持代码块、表格、待办列表\n- 图片与视频语法\n\n\`\`\`js\nconsole.log('Hello, NanoSite!');\n\`\`\`\n`;

  const changeListeners = new Set();
  const notifyChange = (value) => {
    changeListeners.forEach((fn) => {
      try { fn(value); } catch (_) {}
    });
  };

  const handleAssetPreviewEvent = (event) => {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const markdownPath = normalizePreviewPath(detail.markdownPath || detail.path || '');
    updatePreviewAssetBucket(markdownPath, detail.assets || []);
    if (!markdownPath) {
      refreshPreviewAssetOverrides();
      return;
    }
    if (markdownPath === normalizePreviewPath(previewAssetCurrentPath)) {
      refreshPreviewAssetOverrides();
    }
  };

  try { window.addEventListener('ns-editor-asset-preview', handleAssetPreviewEvent); }
  catch (_) {}

  const requestLayout = () => {
    try {
      if (editor && typeof editor.refreshLayout === 'function') {
        editor.refreshLayout();
        return;
      }
      if (!ta) return;
      ta.style.height = '0px';
      // eslint-disable-next-line no-unused-expressions
      ta.offsetHeight;
      ta.style.height = `${ta.scrollHeight}px`;
    } catch (_) {}
  };

  const getValue = () => {
    if (editor) return editor.getValue() || '';
    if (ta) return ta.value || '';
    return '';
  };

  const refreshPreview = () => {
    try { renderPreview(getValue()); } catch (_) {}
  };

  const setValue = (value, opts = {}) => {
    const text = value == null ? '' : String(value);
    const { preview = true, notify = true } = opts;
    if (editor) editor.setValue(text);
    else if (ta) ta.value = text;
    requestLayout();
    if (preview) renderPreview(text);
    if (notify) notifyChange(text);
  };

  const setBaseDir = (dir) => {
    const fallback = `${getContentRoot()}/`;
    try {
      const raw = (dir == null ? '' : String(dir)).trim();
      const normalized = raw
        ? raw.replace(/\\+/g, '/').replace(/\/?$/, '/')
        : fallback;
      window.__ns_editor_base_dir = normalized;
    } catch (_) {
      try { window.__ns_editor_base_dir = fallback; } catch (__) {}
    }
  };

  const STATUS_LABEL_KEYS = {
    checking: 'editor.currentFile.status.checking',
    existing: 'editor.currentFile.status.existing',
    missing: 'editor.currentFile.status.missing',
    error: 'editor.currentFile.status.error'
  };

  const STATUS_STATES = new Set(['checking', 'existing', 'missing', 'error']);
  let currentFileInfo = { path: '', status: null, dirty: false, draft: null, draftState: '', loaded: false };
  let currentFileElRef = null;

  const getEditorTextarea = () => {
    if (editor && editor.textarea) return editor.textarea;
    return ta;
  };

  let lastSelectionRange = { start: 0, end: 0 };
  let suppressSelectionTracking = false;
  let formattingButtons = [];
  let cardPopoverOpen = false;
  let cardPopoverClosing = false;
  let cardPopoverCloseTimer = null;
  let cardPopoverTransitionHandler = null;

  const tooltipButtons = new Set();

  function applyButtonTooltipState(button, disabled) {
    if (!button) return;
    const baseTitle = (() => {
      const titleKey = button.dataset.enabledTitleKey || button.getAttribute('data-i18n-title');
      if (titleKey) {
        const translated = t(titleKey);
        if (translated != null) {
          button.dataset.enabledTitle = translated;
          return translated;
        }
      }
      if (!button.dataset.enabledTitle) {
        const current = button.getAttribute('title') || button.textContent || '';
        if (current) button.dataset.enabledTitle = current;
        else button.dataset.enabledTitle = '';
      }
      return button.dataset.enabledTitle || '';
    })();
    const hintKey = button.dataset.disabledHintKey;
    const disabledHint = (() => {
      if (hintKey) {
        const translatedHint = t(hintKey);
        if (translatedHint != null) {
          button.dataset.disabledHint = translatedHint;
          return translatedHint;
        }
        button.dataset.disabledHint = '';
        return '';
      }
      return button.dataset.disabledHint || '';
    })();
    if (disabled) {
      if (disabledHint) button.setAttribute('title', disabledHint);
      else if (baseTitle) button.setAttribute('title', baseTitle);
      button.setAttribute('data-disabled', 'true');
    } else {
      if (baseTitle) button.setAttribute('title', baseTitle);
      else button.removeAttribute('title');
      button.removeAttribute('data-disabled');
    }
  }

  function registerButtonTooltip(button, disabledHintKey) {
    if (!button) return;
    if (disabledHintKey) button.dataset.disabledHintKey = disabledHintKey;
    const titleKey = button.getAttribute('data-i18n-title');
    if (titleKey) button.dataset.enabledTitleKey = titleKey;
    tooltipButtons.add(button);
    applyButtonTooltipState(button, !!button.disabled);
  }

  const updateFormattingToolbarState = () => {
    const textarea = getEditorTextarea();
    const selection = lastSelectionRange || { start: 0, end: 0 };
    const caretOnEmptyLine = isCaretOnEmptyLine(textarea, selection);
    const hasSelection = selection.end > selection.start;
    formattingButtons.forEach(btn => {
      if (!btn || !btn.el) return;
      let enabled = false;
      if (typeof btn.isEnabled === 'function') {
        enabled = !!btn.isEnabled(selection, textarea);
      } else {
        const requiresSelection = btn.requiresSelection !== false;
        enabled = requiresSelection ? hasSelection : true;
      }
      btn.el.disabled = !enabled;
      applyButtonTooltipState(btn.el, !!btn.el.disabled);
    });
    if (cardButton) {
      const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
      const allowCardInsertion = hasEntries && caretOnEmptyLine;
      cardButton.disabled = !allowCardInsertion;
      if (allowCardInsertion) cardButton.removeAttribute('aria-disabled');
      else cardButton.setAttribute('aria-disabled', 'true');
      applyButtonTooltipState(cardButton, !!cardButton.disabled);
    }
  };

  const getNormalizedSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return { start: 0, end: 0 };
    let start = textarea.selectionStart ?? 0;
    let end = textarea.selectionEnd ?? start;
    if (end < start) { const tmp = start; start = end; end = tmp; }
    return { start, end };
  };

  const isCaretOnEmptyLine = (textarea, selection) => {
    if (!textarea || !selection) return false;
    const { start, end } = selection;
    if (end !== start) return false;
    const value = textarea.value || '';
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    return line.trim().length === 0;
  };

  const recordSelection = () => {
    if (suppressSelectionTracking) return;
    const textarea = getEditorTextarea();
    if (!textarea) return;
    lastSelectionRange = getNormalizedSelection();
    updateFormattingToolbarState();
  };

  const restoreSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return null;
    suppressSelectionTracking = true;
    try {
      try { textarea.focus(); }
      catch (_) {}
      if (lastSelectionRange) {
        const { start, end } = lastSelectionRange;
        if (typeof start === 'number' && typeof end === 'number') {
          try { textarea.setSelectionRange(start, end); }
          catch (_) {}
        }
      }
    } finally {
      suppressSelectionTracking = false;
    }
    return textarea;
  };

  const applyInlineFormat = (prefix, suffix) => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const { start, end } = getNormalizedSelection();
    if (end <= start) return;
    const value = textarea.value || '';
    const selected = value.slice(start, end);
    const startTag = String(prefix ?? '');
    const endTag = String(suffix ?? '');
    let replacement;
    if (
      selected.startsWith(startTag)
      && selected.endsWith(endTag)
      && selected.length >= startTag.length + endTag.length
    ) {
      replacement = selected.slice(startTag.length, selected.length - endTag.length);
    } else {
      replacement = `${startTag}${selected}${endTag}`;
    }
    textarea.setRangeText(replacement, start, end, 'end');
    const newEnd = start + replacement.length;
    textarea.setSelectionRange(start, newEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const toggleLinePrefix = (prefix) => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const normalizedPrefix = String(prefix ?? '');
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const wasCollapsed = end <= start;
    const wasCaretOnEmptyLine = wasCollapsed && isCaretOnEmptyLine(textarea, selection);
    const value = textarea.value || '';
    if (end <= start) {
      if (!wasCaretOnEmptyLine) return;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      start = lineStart;
      end = lineEnd;
    }
    if (end < start) return;
    const blockStart = value.lastIndexOf('\n', start - 1) + 1;
    let blockEnd = value.indexOf('\n', end);
    if (blockEnd === -1) blockEnd = value.length;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split('\n');
    const shouldRemove = lines.every(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      return line.slice(indent.length).startsWith(normalizedPrefix);
    });
    const updated = lines.map(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      const content = line.slice(indent.length);
      if (shouldRemove) {
        if (content.startsWith(normalizedPrefix)) {
          return indent + content.slice(normalizedPrefix.length);
        }
        return line;
      }
      if (content.startsWith(normalizedPrefix)) return line;
      if (!content) return indent + normalizedPrefix;
      return indent + normalizedPrefix + content;
    });
    const replacement = updated.join('\n');
    textarea.setSelectionRange(blockStart, blockEnd);
    textarea.setRangeText(replacement, blockStart, blockEnd, 'end');
    const newEnd = blockStart + replacement.length;
    if (wasCaretOnEmptyLine && wasCollapsed && !shouldRemove) {
      const firstLine = replacement.split('\n', 1)[0] || '';
      const indentMatch = firstLine.match(/^\s*/);
      const indentLength = indentMatch ? indentMatch[0].length : 0;
      const caretOffset = indentLength + normalizedPrefix.length;
      const caretPos = blockStart + caretOffset;
      textarea.setSelectionRange(caretPos, caretPos);
    } else {
      textarea.setSelectionRange(blockStart, newEnd);
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const applyCodeBlockFormat = () => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const value = textarea.value || '';
    if (end <= start) {
      if (!isCaretOnEmptyLine(textarea, selection)) return;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      const beforeChar = lineStart > 0 ? value.charAt(lineStart - 1) : '';
      const afterChar = lineEnd < value.length ? value.charAt(lineEnd) : '';
      const prefix = beforeChar && beforeChar !== '\n' ? '\n' : '';
      const suffix = afterChar && afterChar !== '\n' ? '\n' : '';
      const block = '```\n\n```';
      textarea.setSelectionRange(lineStart, lineEnd);
      textarea.setRangeText(`${prefix}${block}${suffix}`, lineStart, lineEnd, 'end');
      const caretPos = lineStart + prefix.length + 4;
      textarea.setSelectionRange(caretPos, caretPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      recordSelection();
      return;
    }
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let block = `\`\`\`\n${selected}\n\`\`\``;
    let prefixAdded = false;
    let suffixAdded = false;
    if (start > 0 && !before.endsWith('\n')) {
      block = `\n${block}`;
      prefixAdded = true;
    }
    if (after && !after.startsWith('\n')) {
      block = `${block}\n`;
      suffixAdded = true;
    }
    textarea.setRangeText(block, start, end, 'end');
    const selectionStart = start + (prefixAdded ? 1 : 0);
    const selectionEnd = start + block.length - (suffixAdded ? 1 : 0);
    textarea.setSelectionRange(selectionStart, Math.max(selectionStart, selectionEnd));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const insertCardLink = (entry) => {
    if (!entry || !entry.location) return;
    const location = String(entry.location).trim();
    if (!location) return;
    const textarea = restoreSelection();
    if (!textarea) return;
    const value = textarea.value || '';
    const { start, end } = getNormalizedSelection();
    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(0, Math.min(end, value.length));
    const hasSelection = safeEnd > safeStart;
    const fallbackLabel = entry.key || entry.title || location;
    let linkLabel = fallbackLabel;
    if (hasSelection) {
      const selected = value.slice(safeStart, safeEnd);
      if (selected.trim()) linkLabel = selected;
    }
    const linkMarkdown = `[${linkLabel}](?id=${location})`;
    let insertText = linkMarkdown;
    let selectionStart = safeStart;
    let selectionEnd = safeStart + linkMarkdown.length;
    if (!hasSelection) {
      const before = value.slice(0, safeStart);
      const after = value.slice(safeStart);
      const needsLeading = safeStart > 0 && !before.endsWith('\n');
      const needsTrailing = after && !after.startsWith('\n');
      const leading = needsLeading ? '\n' : '';
      const trailing = needsTrailing ? '\n' : '';
      insertText = `${leading}${linkMarkdown}${trailing}`;
      selectionStart = safeStart + leading.length;
      selectionEnd = selectionStart + linkMarkdown.length;
    }
    textarea.setSelectionRange(safeStart, safeEnd);
    textarea.setRangeText(insertText, safeStart, safeEnd, 'end');
    textarea.setSelectionRange(selectionStart, selectionEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const renderCardPickerList = (term = '') => {
    if (!cardListEl) return;
    const query = String(term || '').trim().toLowerCase();
    cardListEl.innerHTML = '';
    const entries = (Array.isArray(editorPostPickerEntries) ? editorPostPickerEntries : [])
      .filter(entry => {
        if (!query) return true;
        return typeof entry.search === 'string' ? entry.search.includes(query) : false;
      });
    if (!entries.length) {
      if (cardEmptyEl) cardEmptyEl.removeAttribute('hidden');
      return;
    }
    if (cardEmptyEl) cardEmptyEl.setAttribute('hidden', '');
    const frag = document.createDocumentFragment();
    entries.forEach(entry => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-picker-item';
      btn.setAttribute('role', 'option');
      const titleEl = document.createElement('span');
      titleEl.className = 'card-picker-item-title';
      titleEl.textContent = entry.title || entry.key || entry.location;
      const metaEl = document.createElement('span');
      metaEl.className = 'card-picker-item-meta';
      if (entry.key && entry.key !== titleEl.textContent) {
        metaEl.textContent = `${entry.key} · ${entry.location}`;
      } else {
        metaEl.textContent = entry.location;
      }
      btn.append(titleEl, metaEl);
      btn.addEventListener('click', () => {
        insertCardLink(entry);
        closeCardPopover();
      });
      frag.appendChild(btn);
    });
    cardListEl.appendChild(frag);
    cardListEl.scrollTop = 0;
  };

  const positionCardPopover = (anchor) => {
    if (!cardPopover || !editorToolbarEl || !anchor) return;
    const toolbarRect = editorToolbarEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const top = Math.max(0, anchorRect.bottom - toolbarRect.top + 6);
    let left = anchorRect.left - toolbarRect.left;
    cardPopover.style.top = `${top}px`;
    cardPopover.style.right = 'auto';
    cardPopover.style.left = `${Math.max(0, left)}px`;
    const popWidth = cardPopover.offsetWidth || 0;
    const maxLeft = Math.max(0, toolbarRect.width - popWidth);
    if (left > maxLeft) {
      cardPopover.style.left = `${maxLeft}px`;
    }
  };

  const handleCardRelayout = () => {
    if (cardPopoverOpen) positionCardPopover(cardButton);
  };

  const clearCardPopoverCloseWatcher = () => {
    if (cardPopoverCloseTimer) {
      clearTimeout(cardPopoverCloseTimer);
      cardPopoverCloseTimer = null;
    }
    if (cardPopover && cardPopoverTransitionHandler) {
      cardPopover.removeEventListener('transitionend', cardPopoverTransitionHandler);
    }
    cardPopoverTransitionHandler = null;
  };

  const finalizeCardPopoverClose = () => {
    clearCardPopoverCloseWatcher();
    cardPopoverClosing = false;
    if (cardPopover) {
      cardPopover.classList.remove('is-visible');
      cardPopover.classList.remove('is-closing');
      cardPopover.setAttribute('aria-hidden', 'true');
      cardPopover.setAttribute('hidden', '');
      cardPopover.style.left = '';
      cardPopover.style.right = '';
      cardPopover.style.top = '';
    }
  };

  const closeCardPopover = () => {
    if (!cardPopoverOpen && !cardPopoverClosing) return;
    cardPopoverOpen = false;
    cardPopoverClosing = true;
    if (cardButton) cardButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', handleCardOutsideClick, true);
    document.removeEventListener('keydown', handleCardKeydown, true);
    window.removeEventListener('resize', handleCardRelayout, true);
    window.removeEventListener('scroll', handleCardRelayout, true);
    if (!cardPopover) {
      finalizeCardPopoverClose();
      if (cardSearchInput) cardSearchInput.value = '';
      return;
    }
    clearCardPopoverCloseWatcher();
    cardPopover.setAttribute('aria-hidden', 'true');
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.add('is-closing');
    const handleTransitionEnd = (event) => {
      if (event.target !== cardPopover) return;
      if (event.propertyName && event.propertyName !== 'opacity') return;
      finalizeCardPopoverClose();
    };
    cardPopoverTransitionHandler = handleTransitionEnd;
    cardPopover.addEventListener('transitionend', handleTransitionEnd);
    cardPopoverCloseTimer = window.setTimeout(finalizeCardPopoverClose, 360);
    if (cardSearchInput) cardSearchInput.value = '';
  };

  const openCardPopover = () => {
    if (!cardButton || !cardPopover) return;
    const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
    if (!hasEntries) return;
    renderCardPickerList('');
    if (cardSearchInput) cardSearchInput.value = '';
    clearCardPopoverCloseWatcher();
    cardPopoverClosing = false;
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.remove('is-closing');
    cardPopover.removeAttribute('hidden');
    cardPopover.setAttribute('aria-hidden', 'false');
    positionCardPopover(cardButton);
    void cardPopover.offsetWidth;
    cardPopover.classList.add('is-visible');
    cardButton.setAttribute('aria-expanded', 'true');
    cardPopoverOpen = true;
    setTimeout(() => {
      if (cardSearchInput) {
        try { cardSearchInput.focus(); }
        catch (_) {}
      }
    }, 0);
    document.addEventListener('mousedown', handleCardOutsideClick, true);
    document.addEventListener('keydown', handleCardKeydown, true);
    window.addEventListener('resize', handleCardRelayout, true);
    window.addEventListener('scroll', handleCardRelayout, true);
  };

  function handleCardOutsideClick(event) {
    if (!cardPopoverOpen) return;
    const target = event.target;
    if (!cardPopover) return;
    if (cardPopover.contains(target)) return;
    if (cardButton && cardButton.contains(target)) return;
    closeCardPopover();
  }

  function handleCardKeydown(event) {
    if (!cardPopoverOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCardPopover();
      restoreSelection();
    }
  }

  const handleCardContextUpdate = () => {
    updateFormattingToolbarState();
    const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
    const textarea = getEditorTextarea();
    const selection = lastSelectionRange || { start: 0, end: 0 };
    const allowCardInsertion = hasEntries && isCaretOnEmptyLine(textarea, selection);
    if ((!hasEntries || !allowCardInsertion) && cardPopoverOpen) {
      closeCardPopover();
      return;
    }
    if (cardPopoverOpen) {
      renderCardPickerList(cardSearchInput ? cardSearchInput.value : '');
      positionCardPopover(cardButton);
    }
  };

  const BUTTON_DISABLED_HINT_KEYS = {
    btnFmtBold: 'editor.editorTools.hints.bold',
    btnFmtItalic: 'editor.editorTools.hints.italic',
    btnFmtStrike: 'editor.editorTools.hints.strike',
    btnFmtHeading: 'editor.editorTools.hints.heading',
    btnFmtQuote: 'editor.editorTools.hints.quote',
    btnFmtCode: 'editor.editorTools.hints.code',
    btnFmtCodeBlock: 'editor.editorTools.hints.codeBlock',
    btnInsertCard: 'editor.editorTools.hints.insertCard'
  };

  if (cardButton) registerButtonTooltip(cardButton, BUTTON_DISABLED_HINT_KEYS.btnInsertCard);

  const selectionOrEmptyLineEnabled = (selection, textarea) => {
    if (!selection) return false;
    if (selection.end > selection.start) return true;
    return isCaretOnEmptyLine(textarea, selection);
  };

  const formattingActions = [
    { id: 'btnFmtBold', handler: () => applyInlineFormat('**', '**') },
    { id: 'btnFmtItalic', handler: () => applyInlineFormat('*', '*') },
    { id: 'btnFmtStrike', handler: () => applyInlineFormat('~~', '~~') },
    { id: 'btnFmtHeading', handler: () => toggleLinePrefix('# '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtQuote', handler: () => toggleLinePrefix('> '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtCode', handler: () => applyInlineFormat('`', '`') },
    { id: 'btnFmtCodeBlock', handler: () => applyCodeBlockFormat(), isEnabled: selectionOrEmptyLineEnabled }
  ];

  formattingButtons = formattingActions.map(action => {
    const el = document.getElementById(action.id);
    if (!el) return null;
    registerButtonTooltip(el, BUTTON_DISABLED_HINT_KEYS[action.id]);
    el.addEventListener('click', (event) => {
      event.preventDefault();
      action.handler();
    });
    const requiresSelection = action.requiresSelection !== undefined ? action.requiresSelection : true;
    return { ...action, el, requiresSelection };
  }).filter(Boolean);

  const selectionTarget = getEditorTextarea();
  if (selectionTarget) {
    ['select', 'keyup', 'mouseup', 'input'].forEach(evt => {
      selectionTarget.addEventListener(evt, recordSelection);
    });
    selectionTarget.addEventListener('focus', recordSelection);
  }
  recordSelection();

  document.addEventListener('ns-editor-language-applied', () => {
    tooltipButtons.forEach(btn => applyButtonTooltipState(btn, !!btn.disabled));
    renderCurrentFileIndicator();
  });

  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', () => {
      renderCardPickerList(cardSearchInput.value);
    });
    cardSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = cardListEl ? cardListEl.querySelector('.card-picker-item') : null;
        if (first) first.click();
      }
    });
  }

  if (cardButton) {
    cardButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (cardPopoverOpen) closeCardPopover();
      else openCardPopover();
    });
  }

  editorLinkCardContextListeners.add(handleCardContextUpdate);
  handleCardContextUpdate();

  const getCurrentMarkdownPath = () => {
    if (currentFileInfo && currentFileInfo.path) return String(currentFileInfo.path);
    return '';
  };

  const emitEditorToast = (kind, message) => {
    const text = message == null ? '' : String(message);
    if (!text) return;
    try {
      window.dispatchEvent(new CustomEvent('ns-editor-toast', { detail: { kind: kind || 'info', message: text } }));
    } catch (_) {}
  };

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unexpected file data.'));
          return;
        }
        const comma = result.indexOf(',');
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        if (!base64) {
          reject(new Error('Image data is empty.'));
          return;
        }
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read image.'));
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });

  const slugifyAssetBase = (value) => {
    const input = String(value == null ? '' : value).toLowerCase();
    const cleaned = input.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned ? cleaned.slice(0, 48) : 'image';
  };

  const inferAssetExtension = (file) => {
    if (!file) return '.png';
    const name = typeof file.name === 'string' ? file.name : '';
    const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
    let ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
    const normalize = (value) => (value && value.startsWith('.') ? value : `.${value || ''}`);
    const type = (file.type || '').toLowerCase();
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/avif': '.avif',
      'image/bmp': '.bmp',
      'image/heic': '.heic',
      'image/heif': '.heif'
    };
    if (!ext && typeMap[type]) ext = typeMap[type];
    if (!ext && type.includes('jpeg')) ext = '.jpg';
    if (!ext && type.includes('png')) ext = '.png';
    if (!ext) ext = '.png';
    ext = normalize(ext.toLowerCase());
    return ext.replace(/[^.a-z0-9]/g, '') || '.png';
  };

  const buildAssetFileMeta = (file) => {
    const original = file && typeof file.name === 'string' ? file.name : '';
    const dot = original.lastIndexOf('.');
    const baseRaw = dot > 0 ? original.slice(0, dot) : original;
    const slug = slugifyAssetBase(baseRaw);
    const ext = inferAssetExtension(file);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    const fileName = `${slug}-${timestamp}${random ? `-${random}` : ''}${ext}`;
    const altText = baseRaw && baseRaw.trim() ? baseRaw.trim() : slug.replace(/-/g, ' ').trim();
    return { fileName, altText: altText || slug };
  };

  const computeAssetPaths = (markdownPath, fileName) => {
    const normalized = String(markdownPath || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
    const idx = normalized.lastIndexOf('/');
    const dir = idx >= 0 ? normalized.slice(0, idx) : '';
    const assetDir = dir ? `${dir}/assets` : 'assets';
    const commitPath = `${assetDir}/${fileName}`.replace(/\/+/g, '/');
    const relativePath = `assets/${fileName}`;
    return { commitPath, relativePath };
  };

  const insertImageMarkdown = (relativePath, altText) => {
    const target = getEditorTextarea();
    const content = getValue();
    const start = target && Number.isFinite(target.selectionStart) ? target.selectionStart : content.length;
    const end = target && Number.isFinite(target.selectionEnd) ? target.selectionEnd : start;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const alt = altText == null ? '' : String(altText);
    let prefix = '';
    if (before && !/\n$/.test(before)) prefix = '\n\n';
    let suffix = '';
    if (after) suffix = /^\n/.test(after) ? '' : '\n\n';
    else suffix = '\n';
    const core = `![${alt}](${relativePath})`;
    const snippet = `${prefix}${core}${suffix}`;
    const next = `${before}${snippet}${after}`;
    const altStart = before.length + prefix.length + 2;
    const altEnd = altStart + alt.length;
    const afterIndex = before.length + snippet.length;
    setValue(next, { notify: true });
    return { altStart, altEnd, afterIndex };
  };

  const isImageFile = (file) => {
    if (!file) return false;
    if (file.type) return file.type.startsWith('image/');
    const name = typeof file.name === 'string' ? file.name : '';
    return /\.(?:png|jpe?g|gif|bmp|webp|svg|avif|heic|heif)$/i.test(name);
  };

  const containsImageFile = (dataTransfer) => {
    if (!dataTransfer) return false;
    const files = dataTransfer.files;
    if (files && files.length) {
      for (let i = 0; i < files.length; i += 1) {
        if (isImageFile(files[i])) return true;
      }
    }
    if (dataTransfer.items && dataTransfer.items.length) {
      for (let i = 0; i < dataTransfer.items.length; i += 1) {
        const item = dataTransfer.items[i];
        if (item && item.kind === 'file') {
          try {
            const file = item.getAsFile();
            if (isImageFile(file)) return true;
          } catch (_) { /* ignore */ }
        }
      }
    }
    return false;
  };

  const handleImageFiles = async (fileList, options = {}) => {
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) {
      emitEditorToast('warn', 'Open a markdown file before inserting images.');
      return;
    }
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) {
      if (fileList && fileList.length) emitEditorToast('warn', 'Only image files can be inserted.');
      return;
    }

    const textarea = getEditorTextarea();
    let lastSelection = null;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (lastSelection && textarea) {
        try { textarea.setSelectionRange(lastSelection.afterIndex, lastSelection.afterIndex); }
        catch (_) {}
      }
      let base64;
      try {
        base64 = await readFileAsBase64(file);
      } catch (err) {
        console.error('Failed to read image for insertion', err);
        emitEditorToast('error', err && err.message ? err.message : 'Failed to read image file.');
        continue;
      }

      const meta = buildAssetFileMeta(file);
      const paths = computeAssetPaths(markdownPath, meta.fileName);
      const selection = insertImageMarkdown(paths.relativePath, meta.altText);
      lastSelection = selection;

      if (textarea) {
        try {
          textarea.focus();
          textarea.setSelectionRange(selection.altStart, selection.altEnd);
        } catch (_) {}
      }

      try {
        window.dispatchEvent(new CustomEvent('ns-editor-asset-added', {
          detail: {
            markdownPath,
            fileName: meta.fileName,
            commitPath: paths.commitPath,
            relativePath: paths.relativePath,
            base64,
            mime: file.type || '',
            size: file.size || 0,
            originalName: file.name || '',
            altText: meta.altText,
            source: options.source || 'picker',
            silent: true
          }
        }));
      } catch (err) {
        console.error('Failed to dispatch asset-added event', err);
      }

      emitEditorToast('success', `Inserted ${paths.relativePath}`);
    }
  };

  const ensureCurrentFileElement = () => {
    if (currentFileElRef && document.body.contains(currentFileElRef)) return currentFileElRef;
    currentFileElRef = document.getElementById('currentFile');
    return currentFileElRef;
  };

  const formatStatusTimestamp = (ms) => {
    if (!Number.isFinite(ms)) return '';
    try {
      const fmt = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return fmt.format(new Date(ms));
    } catch (_) {
      try { return new Date(ms).toLocaleString(); }
      catch (__) { return ''; }
    }
  };

  const resolveRelativeTimeLocales = () => {
    const lang = normalizeLangKey(getCurrentLang());
    if (!lang) return null;
    if (lang === 'zh') return ['zh-CN', 'zh', 'en'];
    if (lang === 'zh-tw') return ['zh-TW', 'zh-Hant', 'zh', 'en'];
    if (lang === 'zh-hk') return ['zh-HK', 'zh-Hant', 'zh', 'en'];
    if (lang === 'ja') return ['ja-JP', 'ja', 'en'];
    if (lang === 'en') return ['en'];
    if (/^[a-z]{2}(?:-[a-z0-9-]+)?$/i.test(lang)) return [lang, 'en'];
    return null;
  };

  const formatRelativeTime = (ms) => {
    if (!Number.isFinite(ms)) return '';
    const diff = Date.now() - ms;
    const abs = Math.abs(diff);
    const sec = Math.round(abs / 1000);
    const minute = 60;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    const locales = resolveRelativeTimeLocales();
    const rtf = (() => {
      try {
        if (locales && locales.length) return new Intl.RelativeTimeFormat(locales, { numeric: 'auto' });
        return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      } catch (_) {
        try { return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }); }
        catch (__) { return null; }
      }
    })();
    const format = (value, unit) => {
      if (rtf) {
        return rtf.format(value, unit);
      }
      const units = { second: 'second', minute: 'minute', hour: 'hour', day: 'day', week: 'week', month: 'month', year: 'year' };
      const label = units[unit] || unit;
      const plural = Math.abs(value) === 1 ? '' : 's';
      return value < 0 ? `${Math.abs(value)} ${label}${plural} from now` : `${Math.abs(value)} ${label}${plural} ago`;
    };
    if (sec < 45) return t('editor.currentFile.draft.justNow');
    if (sec < 90) return format(diff < 0 ? 1 : -1, 'minute');
    if (sec < 45 * minute) return format(Math.round(diff / (1000 * minute) * -1), 'minute');
    if (sec < 90 * minute) return format(diff < 0 ? 1 : -1, 'hour');
    if (sec < 22 * hour) return format(Math.round(diff / (1000 * hour) * -1), 'hour');
    if (sec < 36 * hour) return format(diff < 0 ? 1 : -1, 'day');
    if (sec < 10 * day) return format(Math.round(diff / (1000 * day) * -1), 'day');
    if (sec < 14 * day) return format(diff < 0 ? 1 : -1, 'week');
    if (sec < 8 * week) return format(Math.round(diff / (1000 * week) * -1), 'week');
    if (sec < 18 * month) return format(Math.round(diff / (1000 * month) * -1), 'month');
    return format(Math.round(diff / (1000 * year) * -1), 'year');
  };

  const normalizeStatusPayload = (value) => {
    if (!value || typeof value !== 'object') return null;
    const rawState = String(value.state || '').trim().toLowerCase();
    const state = STATUS_STATES.has(rawState) ? rawState : '';
    const normalized = {};
    if (state) normalized.state = state;

    let checkedAt = value.checkedAt;
    if (checkedAt instanceof Date) checkedAt = checkedAt.getTime();
    else if (typeof checkedAt === 'string') {
      const trimmed = checkedAt.trim();
      if (trimmed) {
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) checkedAt = asNumber;
        else {
          const parsed = Date.parse(trimmed);
          checkedAt = Number.isFinite(parsed) ? parsed : null;
        }
      } else {
        checkedAt = null;
      }
    }
    if (Number.isFinite(checkedAt)) normalized.checkedAt = Math.floor(checkedAt);

    if (value.message) normalized.message = String(value.message);
    if (value.code != null && value.code !== '') {
      const codeNum = Number(value.code);
      if (Number.isFinite(codeNum)) normalized.code = codeNum;
    }

    return Object.keys(normalized).length ? normalized : (state ? { state } : null);
  };

  const normalizeCurrentFilePayload = (input) => {
    if (typeof input === 'string') {
      return { path: String(input || '').trim(), status: null, dirty: false, draft: null, draftState: '', loaded: false };
    }
    if (input && typeof input === 'object') {
      const path = input.path != null ? String(input.path || '').trim() : '';
      const status = normalizeStatusPayload(input.status);
      const dirty = !!input.dirty;
      const loaded = !!input.loaded;
      let draft = null;
      let draftState = '';
      if (input.draft && typeof input.draft === 'object') {
        const savedAtRaw = Number(input.draft.savedAt);
        const savedAt = Number.isFinite(savedAtRaw) ? savedAtRaw : null;
        const conflict = !!input.draft.conflict;
        const hasContent = !!input.draft.hasContent;
        if (hasContent) {
          draft = { savedAt, conflict, hasContent };
          draftState = conflict ? 'conflict' : 'saved';
        }
      }
      return { path, status, dirty, draft, draftState, loaded };
    }
    return { path: '', status: null, dirty: false, draft: null, draftState: '', loaded: false };
  };

  const describeStatusLabel = (status) => {
    if (!status || !status.state) return '';
    const key = STATUS_LABEL_KEYS[status.state];
    const base = key ? t(key) : status.state;
    if (status.state === 'error') {
      const detail = [];
      if (status.message) detail.push(String(status.message));
      if (Number.isFinite(status.code)) detail.push(`HTTP ${status.code}`);
      return detail.length ? `${base} (${detail.join(' · ')})` : base;
    }
    return base;
  };

  const formatStatusMeta = (status) => {
    if (!status || !status.state) return '';
    if (status.state === 'checking') {
      if (Number.isFinite(status.checkedAt)) {
        const ts = formatStatusTimestamp(status.checkedAt);
        return ts
          ? t('editor.currentFile.meta.checkingStarted', { time: ts })
          : t('editor.currentFile.meta.checking');
      }
      return t('editor.currentFile.meta.checking');
    }
    if (Number.isFinite(status.checkedAt)) {
      const ts = formatStatusTimestamp(status.checkedAt);
      return ts ? t('editor.currentFile.meta.lastChecked', { time: ts }) : '';
    }
    return '';
  };

  const renderCurrentFileIndicator = () => {
    const path = currentFileInfo.path ? String(currentFileInfo.path) : '';
    applyEditorEmptyState(!path);
    const el = ensureCurrentFileElement();
    if (!el) return;
    if (!path) {
      el.textContent = '';
      el.removeAttribute('data-file-state');
      el.removeAttribute('data-last-checked');
      el.removeAttribute('title');
      el.removeAttribute('data-dirty');
      el.removeAttribute('data-draft-state');
      return;
    }

    const status = currentFileInfo.status || null;
    const dirty = !!currentFileInfo.dirty;
    const draft = currentFileInfo.draft;
    const draftState = currentFileInfo.draftState || '';
    const statusLabel = describeStatusLabel(status);
    const meta = formatStatusMeta(status);
    const mainPieces = [];
    mainPieces.push(`<span class="cf-path">${escapeHtml(path)}</span>`);
    if (statusLabel) {
      mainPieces.push('<span aria-hidden="true">—</span>');
      mainPieces.push(`<span class="cf-status">${escapeHtml(statusLabel)}</span>`);
    }
    const mainHtml = `<span class="cf-line-main">${mainPieces.join(' ')}</span>`;

    const metaPieces = [];
    if (meta) metaPieces.push(`<span class="cf-remote">${escapeHtml(meta)}</span>`);
    let draftLabel = '';
    if (draft && draft.hasContent) {
      if (Number.isFinite(draft.savedAt)) {
        const rel = formatRelativeTime(draft.savedAt);
        draftLabel = draft.conflict
          ? (rel
            ? t('editor.currentFile.draft.savedConflictHtml', { time: escapeHtml(rel) })
            : t('editor.currentFile.draft.conflict'))
          : (rel
            ? t('editor.currentFile.draft.savedHtml', { time: escapeHtml(rel) })
            : t('editor.currentFile.draft.saved'));
      } else {
        draftLabel = draft.conflict
          ? t('editor.currentFile.draft.conflict')
          : t('editor.currentFile.draft.available');
      }
      if (!draftLabel) draftLabel = '';
      metaPieces.push(`<span class="cf-draft">${draftLabel}</span>`);
    }
    const metaHtml = metaPieces.length ? `<span class="cf-line-meta">${metaPieces.join('<span aria-hidden="true">·</span>')}</span>` : '';
    el.innerHTML = `${mainHtml}${metaHtml}`;

    const tooltipParts = [path, statusLabel, meta, draftLabel]
      .map(part => getPlainText(part))
      .filter(Boolean);
    el.setAttribute('title', tooltipParts.join(' — '));
    if (status && status.state) el.setAttribute('data-file-state', status.state);
    else el.removeAttribute('data-file-state');
    if (status && Number.isFinite(status.checkedAt)) el.setAttribute('data-last-checked', String(status.checkedAt));
    else el.removeAttribute('data-last-checked');
    if (dirty) el.setAttribute('data-dirty', '1');
    else el.removeAttribute('data-dirty');
    if (draftState) el.setAttribute('data-draft-state', draftState);
    else el.removeAttribute('data-draft-state');
  };

  const bindCurrentFileElement = (el) => {
    currentFileElRef = el || null;
    renderCurrentFileIndicator();
  };

  const assignCurrentFileLabel = (input) => {
    currentFileInfo = normalizeCurrentFilePayload(input);
    previewAssetCurrentPath = normalizePreviewPath(currentFileInfo.path || '');
    renderCurrentFileIndicator();
    refreshPreviewAssetOverrides();
  };

  renderCurrentFileIndicator();

  const handleInput = () => {
    const val = getValue();
    renderPreview(val);
    notifyChange(val);
  };

  if (editor && editor.textarea) editor.textarea.addEventListener('input', handleInput);
  else if (ta) ta.addEventListener('input', handleInput);

  // If empty, seed default text; otherwise render current content once.
  const initial = (getValue() || '').trim();
  if (!initial) {
    setValue(seed, { notify: false });
  } else {
    renderPreview(initial);
  }

  setBaseDir('');

  if (imageButton) {
    imageButton.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (!getCurrentMarkdownPath()) {
        emitEditorToast('warn', 'Open a markdown file before inserting images.');
        return;
      }
      if (imageInput) {
        try { imageInput.click(); }
        catch (_) {
          try { imageInput.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
          catch (__) {}
        }
      }
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const files = imageInput.files;
      if (files && files.length) {
        handleImageFiles(files, { source: 'picker' }).catch((err) => {
          console.error('Image insertion failed', err);
        });
      }
      imageInput.value = '';
    });
  }

  const markdownTextarea = getEditorTextarea();
  if (markdownTextarea) {
    markdownTextarea.addEventListener('dragover', (event) => {
      if (!event || !event.dataTransfer) return;
      if (!containsImageFile(event.dataTransfer)) return;
      event.preventDefault();
      try { event.dataTransfer.dropEffect = 'copy'; }
      catch (_) {}
    });
    markdownTextarea.addEventListener('drop', (event) => {
      if (!event || !event.dataTransfer) return;
      if (!containsImageFile(event.dataTransfer)) return;
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files && files.length) {
        handleImageFiles(files, { source: 'drop' }).catch((err) => {
          console.error('Image drop failed', err);
        });
      }
    });
  }

  // View toggle
  document.querySelectorAll('.vt-btn[data-view]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = a.dataset.view;
      switchView(mode);
      if (mode === 'preview') renderPreview(getValue());
    });
  });

  const primaryEditorApi = {
    getValue,
    setValue: (value, opts = {}) => setValue(value, opts),
    focus: () => {
      try {
        if (editor && typeof editor.focus === 'function') editor.focus();
        else if (ta && typeof ta.focus === 'function') ta.focus();
      } catch (_) {}
    },
    setView: (mode) => {
      switchView(mode === 'preview' ? 'preview' : 'edit');
      if (mode === 'preview') renderPreview(getValue());
      else requestLayout();
    },
    setBaseDir: (dir) => setBaseDir(dir),
    setCurrentFileLabel: (label) => assignCurrentFileLabel(label),
    onChange: (fn) => {
      if (typeof fn !== 'function') return () => {};
      changeListeners.add(fn);
      return () => { changeListeners.delete(fn); };
    },
    refreshPreview: () => { renderPreview(getValue()); },
    requestLayout: () => { requestLayout(); },
    setWrap: (value, opts = {}) => { applyWrapState(value, opts); },
    isWrapEnabled: () => wrapEnabled
  };

  try { window.__ns_primary_editor = primaryEditorApi; } catch (_) {}

  // Clear draft action removed (no local storage drafts)

  // Draft persistence on unload removed

  // Default to editor view
  switchView('edit');

  // Back-to-top button behavior
  (function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    try { btn.hidden = false; } catch (_) {}
    const threshold = 260;
    const toggle = () => {
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (y > threshold) btn.classList.add('show');
      else btn.classList.remove('show');
    };
    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', () => {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (_) { window.scrollTo(0, 0); }
    });
    toggle();
  })();

  // ----- Article browser (sidebar) -----
  (function initArticleBrowser() {
    const listIndex = document.getElementById('listIndex');
    const listTabs = document.getElementById('listTabs');
    const statusEl = document.getElementById('sidebarStatus');
    const currentFileEl = document.getElementById('currentFile');
    const searchInput = document.getElementById('fileSearch');
    let currentActive = null;
    let contentRoot = 'wwwroot';
    // Track current markdown base directory for resolving relative assets
    // Expose to window so renderPreview can access outside this closure
    try { if (!window.__ns_editor_base_dir) window.__ns_editor_base_dir = `${contentRoot}/`; } catch (_) {}
    let activeGroup = 'index';

    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ''; };
    bindCurrentFileElement(currentFileEl);

    const basename = (p) => {
      try { const s = String(p || ''); const i = s.lastIndexOf('/'); return i >= 0 ? s.slice(i + 1) : s; } catch (_) { return String(p || ''); }
    };
    const toUrl = (p) => {
      const s = String(p || '').trim();
      if (!s) return '';
      if (/^(https?:)?\//i.test(s)) return s; // absolute or protocol-relative
      return `${contentRoot}/${s}`.replace(/\\+/g, '/');
    };

    const makeLi = (label, relPath) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.dataset.rel = relPath;
      li.dataset.label = label.toLowerCase();
      li.dataset.file = relPath.toLowerCase();
      li.innerHTML = `
        <div class="file-main">
          <span class="file-label">${label}</span>
          <span class="file-path">${relPath}</span>
        </div>`;
      li.addEventListener('click', async () => {
        const url = toUrl(relPath);
        if (!url) return;
        try {
          setStatus('Loading…');
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const text = await r.text();
          try {
            const lastSlash = relPath.lastIndexOf('/');
            const dir = lastSlash >= 0 ? relPath.slice(0, lastSlash + 1) : '';
            const base = `${contentRoot}/${dir}`.replace(/\\+/g, '/');
            setBaseDir(base);
          } catch (_) {
            setBaseDir(`${contentRoot}/`);
          }
          setValue(text);
          assignCurrentFileLabel(`${relPath}`);
          if (currentActive) currentActive.classList.remove('is-active');
          currentActive = li; currentActive.classList.add('is-active');
          switchView('edit');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setStatus('');
        } catch (err) {
          console.error('Failed to load markdown:', err);
          setStatus(`Failed to load: ${relPath}`);
          alert(`Failed to load file\n${relPath}\n${err}`);
        }
      });
      return li;
    };

    // ---- Grouped rendering helpers ----
    const extractVersion = (p) => {
      try {
        const m = String(p || '').match(/(?:^|\/)v\d+(?:\.\d+)*(?=\/|$)/i);
        return m ? m[0].split('/').pop() : '';
      } catch (_) { return ''; }
    };
    const versionParts = (v) => {
      try {
        const s = String(v || '').replace(/^v/i, '');
        return s.split('.').map(x => parseInt(x, 10)).map(n => (Number.isFinite(n) ? n : 0));
      } catch (_) { return [0]; }
    };
    const compareVersionDesc = (a, b) => {
      const aa = versionParts(a); const bb = versionParts(b);
      const len = Math.max(aa.length, bb.length);
      for (let i = 0; i < len; i++) {
        const x = aa[i] || 0; const y = bb[i] || 0;
        if (x !== y) return y - x; // desc
      }
      return 0;
    };

    const makeGroupHeader = (title, open = false, meta = null) => {
      const details = document.createElement('details');
      details.className = 'file-group';
      if (open) details.setAttribute('open', '');
      const summary = document.createElement('summary');
      summary.className = 'file-group-header';
      // Title section
      const sTitle = document.createElement('span');
      sTitle.className = 'file-group-title';
      sTitle.textContent = title;
      summary.appendChild(sTitle);
      // Badges/meta
      if (meta) {
        const wrap = document.createElement('span');
        wrap.className = 'summary-badges';
        if (typeof meta.versionsCount === 'number' && meta.versionsCount > 0) {
          const b = document.createElement('span');
          b.className = 'badge badge-ver';
          b.textContent = `v${meta.versionsCount}`;
          wrap.appendChild(b);
        }
        if (Array.isArray(meta.langs) && meta.langs.length) {
          const b = document.createElement('span');
          b.className = 'badge badge-lang';
          b.textContent = meta.langs.map(x => String(x).toUpperCase()).join(' ');
          wrap.appendChild(b);
        }
        summary.appendChild(wrap);
      }
      const ul = document.createElement('ul');
      ul.className = 'file-sublist';
      details.appendChild(summary);
      details.appendChild(ul);
      const li = document.createElement('li');
      li.appendChild(details);

      // ----- Smooth expand/collapse helpers -----
      const ANIM_MS = 480; // slower, consistent open/close duration (ms)
      const ease = 'cubic-bezier(0.45, 0, 0.25, 1)'; // gentle ease-in-out
      const animateExpand = (panel) => {
        if (!panel) return;
        try {
          panel.style.overflow = 'hidden';
          panel.style.height = '0px';
          panel.style.opacity = '0';
          // Force style flush to ensure transition kicks in cleanly
          void panel.getBoundingClientRect();
          panel.style.transition = `height ${ANIM_MS}ms ${ease}, opacity ${ANIM_MS}ms ${ease}`;
          const target = panel.scrollHeight;
          // next frame
          requestAnimationFrame(() => {
            panel.style.height = `${target}px`;
            panel.style.opacity = '1';
          });
          const cleanup = (ev) => {
            if (ev && ev.propertyName && ev.propertyName !== 'height') return; // wait for height
            panel.style.transition = '';
            panel.style.height = '';
            panel.style.overflow = '';
            panel.style.opacity = '';
            panel.removeEventListener('transitionend', cleanup);
          };
          panel.addEventListener('transitionend', cleanup);
        } catch (_) {}
      };
      const animateCollapse = (panel, after) => {
        if (!panel) { if (after) after(); return; }
        try {
          const start = panel.scrollHeight;
          panel.style.overflow = 'hidden';
          panel.style.height = `${start}px`;
          panel.style.opacity = '1';
          panel.style.transition = `height ${ANIM_MS}ms ${ease}, opacity ${ANIM_MS}ms ${ease}`;
          // next frame
          requestAnimationFrame(() => {
            panel.style.height = '0px';
            panel.style.opacity = '0';
          });
          const done = (ev) => {
            if (ev && ev.propertyName && ev.propertyName !== 'height') return; // wait for height
            panel.style.transition = '';
            panel.style.height = '';
            panel.style.overflow = '';
            panel.style.opacity = '';
            panel.removeEventListener('transitionend', done);
            if (after) after();
          };
          panel.addEventListener('transitionend', done);
        } catch (_) { if (after) after(); }
      };

      // Intercept close to animate before collapsing the <details>
      summary.addEventListener('click', (evt) => {
        try {
          if (!details.open) return; // it will open; let default handle
          // It is currently open and will close: prevent default and animate
          evt.preventDefault();
          animateCollapse(ul, () => { try { details.removeAttribute('open'); } catch (_) {} });
        } catch (_) {}
      });

      // Accordion + animate on open
      details.addEventListener('toggle', (e) => {
        try {
          if (details.open) {
            // Animate this group's expansion
            animateExpand(ul);
            // Only enforce accordion for user-initiated toggles
            if (!e || e.isTrusted !== false) {
              const list = details.closest('.file-list');
              if (list) {
                const openGroups = list.querySelectorAll('details.file-group[open]');
                openGroups.forEach(d => {
                  if (d !== details) {
                    const p = d.querySelector('.file-sublist');
                    animateCollapse(p, () => { try { d.removeAttribute('open'); } catch (_) {} });
                  }
                });
              }
            }
          }
        } catch (_) { /* noop */ }
      });
      return { container: li, sublist: ul, details };
    };

    const makeSubHeader = (title) => {
      const li = document.createElement('li');
      li.className = 'file-subgroup';
      const div = document.createElement('div');
      div.className = 'file-subheader';
      div.textContent = title;
      const ul = document.createElement('ul');
      ul.className = 'file-sublist';
      li.appendChild(div);
      li.appendChild(ul);
      return { container: li, sublist: ul };
    };

    const renderGroupedIndex = (ul, data) => {
      if (!ul) return;
      ul.innerHTML = '';
      const frag = document.createDocumentFragment();
      try {
        const groups = Object.entries(data || {});
        for (const [postKey, val] of groups) {
          // Compute meta: languages + version count
          const langsSet = new Set();
          const verSet = new Set();
          if (typeof val === 'string') {
            const v = extractVersion(val); if (v) verSet.add(v);
          } else if (Array.isArray(val)) {
            val.forEach(p => { const v = extractVersion(p); if (v) verSet.add(v); });
          } else if (val && typeof val === 'object') {
            for (const [lang, paths] of Object.entries(val)) {
              langsSet.add(lang);
              if (typeof paths === 'string') {
                const v = extractVersion(paths); if (v) verSet.add(v);
              } else if (Array.isArray(paths)) {
                paths.forEach(p => { const v = extractVersion(p); if (v) verSet.add(v); });
              }
            }
          }
          const meta = { langs: Array.from(langsSet), versionsCount: verSet.size };
          const { container, sublist } = makeGroupHeader(postKey, false, meta);
          if (typeof val === 'string') {
            sublist.appendChild(makeLi(`${postKey} - ${basename(val)}`, val));
          } else if (Array.isArray(val)) {
            // No language info; list as is
            val.forEach(p => { if (typeof p === 'string') sublist.appendChild(makeLi(`${basename(p)}`, p)); });
          } else if (val && typeof val === 'object') {
            const langs = Object.entries(val);
            // Deterministic language order: en, zh, zh-tw, ja, then others
            const langOrder = { en: 1, zh: 2, 'zh-tw': 3, 'zh-hk': 4, ja: 5 };
            const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
            langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
            for (const [lang, paths] of langs) {
              const { container: sub, sublist: vs } = makeSubHeader(String(lang).toUpperCase());
              const items = [];
              if (typeof paths === 'string') {
                items.push({ v: extractVersion(paths) || '', path: paths, name: basename(paths) });
              } else if (Array.isArray(paths)) {
                for (const p of paths) {
                  if (typeof p === 'string') items.push({ v: extractVersion(p) || '', path: p, name: basename(p) });
                }
              }
              // Sort by version desc, then by name
              items.sort((a, b) => {
                const c = compareVersionDesc(a.v, b.v);
                if (c !== 0) return c;
                return a.name.localeCompare(b.name);
              });
              for (const it of items) {
                const label = it.v ? `${it.v} - ${it.name}` : it.name;
                vs.appendChild(makeLi(label, it.path));
              }
              sublist.appendChild(sub);
            }
          }
          frag.appendChild(container);
        }
      } catch (_) { /* noop */ }
      ul.appendChild(frag);
    };

    const renderGroupedTabs = (ul, data) => {
      if (!ul) return;
      ul.innerHTML = '';
      const frag = document.createDocumentFragment();
      try {
        const groups = Object.entries(data || {});
        for (const [tabKey, variants] of groups) {
          // Compute meta for tabs: languages + versions (if any detected)
          const langsSet = new Set();
          const verSet = new Set();
          if (typeof variants === 'string') {
            const v = extractVersion(variants); if (v) verSet.add(v);
          } else if (variants && typeof variants === 'object') {
            for (const [lang, detail] of Object.entries(variants)) {
              langsSet.add(lang);
              if (typeof detail === 'string') {
                const v = extractVersion(detail); if (v) verSet.add(v);
              } else if (detail && typeof detail === 'object') {
                const loc = detail.location || '';
                const v = extractVersion(loc); if (v) verSet.add(v);
              }
            }
          }
          const meta = { langs: Array.from(langsSet), versionsCount: verSet.size };
          const { container, sublist } = makeGroupHeader(tabKey, false, meta);
          if (typeof variants === 'string') {
            sublist.appendChild(makeLi(`${tabKey} - ${basename(variants)}`, variants));
          } else if (variants && typeof variants === 'object') {
            const langs = Object.entries(variants);
            const langOrder = { en: 1, zh: 2, 'zh-tw': 3, 'zh-hk': 4, ja: 5 };
            const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
            langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
            for (const [lang, detail] of langs) {
              if (typeof detail === 'string') {
                sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${basename(detail)}`, detail));
              } else if (detail && typeof detail === 'object') {
                const title = detail.title || tabKey;
                const loc = detail.location || '';
                if (loc) sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${title}`, loc));
              }
            }
          }
          frag.appendChild(container);
        }
      } catch (_) { /* noop */ }
      ul.appendChild(frag);
    };

    const applyFilter = (term) => {
      const q = String(term || '').trim().toLowerCase();
      const groupRoot = activeGroup === 'tabs' ? document.getElementById('groupTabs') : document.getElementById('groupIndex');
      if (!groupRoot) return;
      const items = groupRoot.querySelectorAll('.file-item');
      items.forEach(li => {
        if (!q) { li.style.display = ''; return; }
        const a = li.dataset.label || '';
        const b = li.dataset.file || '';
        li.style.display = (a.includes(q) || b.includes(q)) ? '' : 'none';
      });
      // Hide language subgroups with no visible items
      const subgroups = groupRoot.querySelectorAll('.file-subgroup');
      subgroups.forEach(sg => {
        const anyVisible = !!sg.querySelector('.file-item:not([style*="display: none"])');
        sg.style.display = anyVisible || !q ? '' : 'none';
      });
      // Hide whole groups with no visible items
      const groups = groupRoot.querySelectorAll('details.file-group');
      groups.forEach(g => {
        const anyVisible = !!g.querySelector('.file-item:not([style*="display: none"])');
        g.parentElement.style.display = anyVisible || !q ? '' : 'none';
        // Auto-expand matched groups when searching
        if (q && anyVisible) {
          try { g.setAttribute('open', ''); } catch (_) {}
        }
      });
    };
    if (searchInput) {
      searchInput.addEventListener('input', () => applyFilter(searchInput.value));
    }

    // Tabs switching (Posts <-> Tabs)
    const sideTabs = document.querySelectorAll('.sidebar-tab');
    const groupIndex = document.getElementById('groupIndex');
    const groupTabs = document.getElementById('groupTabs');
    const switchGroup = (name) => {
      activeGroup = name === 'tabs' ? 'tabs' : 'index';
      if (groupIndex) groupIndex.hidden = activeGroup !== 'index';
      if (groupTabs) groupTabs.hidden = activeGroup !== 'tabs';
      sideTabs.forEach(btn => {
        const tgt = btn.getAttribute('data-target');
        const on = tgt === activeGroup;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      // Re-apply current filter for visible list only
      applyFilter(searchInput ? searchInput.value : '');
    };
    sideTabs.forEach(btn => btn.addEventListener('click', () => switchGroup(btn.dataset.target)));
    switchGroup('index');

    (async () => {
      try {
        setStatus('Loading site config…');
        const site = await fetchConfigWithYamlFallback(['site.yaml','site.yml']);
        editorSiteConfig = site || {};
        contentRoot = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
      } catch (_) {
        editorSiteConfig = {};
        contentRoot = 'wwwroot';
      }
      // Keep a global hint for content root, and default editor base dir
      try { window.__ns_content_root = contentRoot; } catch (_) {}
      try { window.__ns_editor_base_dir = `${contentRoot}/`; } catch (_) {}

      try {
        setStatus('Loading index…');
        const [idxResult, postsResult] = await Promise.allSettled([
          fetchConfigWithYamlFallback([`${contentRoot}/index.yaml`, `${contentRoot}/index.yml`]),
          loadContentJson(contentRoot, 'index')
        ]);
        const rawIndex = idxResult.status === 'fulfilled' ? (idxResult.value || {}) : {};
        const posts = postsResult.status === 'fulfilled' ? (postsResult.value || {}) : {};
        renderGroupedIndex(listIndex, rawIndex);
        rebuildLinkCardContext(posts, rawIndex);
        if (linkCardReady) refreshPreview();
        if (idxResult.status === 'rejected') console.warn('Failed to load index.yaml', idxResult.reason);
        if (postsResult.status === 'rejected') console.warn('Failed to load index metadata', postsResult.reason);
      } catch (err) {
        console.warn('Failed to load index data', err);
      }

      try {
        setStatus('Loading tabs…');
        const tjson = await fetchConfigWithYamlFallback([`${contentRoot}/tabs.yaml`, `${contentRoot}/tabs.yml`]);
        renderGroupedTabs(listTabs, tjson);
      } catch (e) { console.warn('Failed to load tabs.yaml', e); }

      setStatus('');
    })();
  })();
});
