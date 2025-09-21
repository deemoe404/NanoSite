import { createHiEditor } from './hieditor.js';
import { mdParse } from './markdown.js';
import { getContentRoot } from './utils.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';
import { applyLazyLoadingIn, hydratePostImages, hydratePostVideos } from './post-render.js';
import { hydrateInternalLinkCards } from './link-cards.js';
import { applyLangHints } from './typography.js';
import { fetchConfigWithYamlFallback } from './yaml.js';
import { t, withLangParam, loadContentJson, getCurrentLang, normalizeLangKey } from './i18n.js';

const LS_WRAP_KEY = 'ns_editor_wrap_enabled';

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

let editorSiteConfig = {};
let editorPostsIndexCache = {};
let editorAllowedLocations = null;
let editorLocationAliasMap = new Map();
let editorPostsByLocationTitle = {};
let linkCardReady = false;

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
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      for (const entry of Object.values(rawIndex)) {
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
      }
    }

    editorAllowedLocations = allowed;
    editorPostsByLocationTitle = byLocation;
    editorLocationAliasMap = alias;
    editorPostsIndexCache = posts || {};
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
    target.innerHTML = post || '';
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
  } catch (_) {}
}

// ---- Local draft storage removed (temporary) ----

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('mdInput');
  const editor = createHiEditor(ta, 'markdown', false);
  const wrapToggle = document.getElementById('editorWrapToggle');
  let wrapEnabled = false;

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
    if (!wrapToggle) return;
    const checked = !!on;
    wrapToggle.checked = checked;
    wrapToggle.setAttribute('aria-checked', checked ? 'true' : 'false');
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

  const handleWrapToggle = () => {
    const next = wrapToggle ? wrapToggle.checked : !wrapEnabled;
    applyWrapState(next);
  };

  if (wrapToggle) {
    wrapToggle.addEventListener('change', handleWrapToggle);
    wrapToggle.addEventListener('input', handleWrapToggle);
    wrapToggle.addEventListener('click', () => {
      if (!wrapToggle.matches(':focus-visible')) {
        try { wrapToggle.blur(); } catch (_) {}
      }
    });
  }

  applyWrapState(readWrapState(), { persist: false });

  const seed = `# 新文章标题\n\n> 在左侧编辑 Markdown，切换到 Preview 查看渲染效果。\n\n- 支持代码块、表格、待办列表\n- 图片与视频语法\n\n\`\`\`js\nconsole.log('Hello, NanoSite!');\n\`\`\`\n`;

  const changeListeners = new Set();
  const notifyChange = (value) => {
    changeListeners.forEach((fn) => {
      try { fn(value); } catch (_) {}
    });
  };

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

  const STATUS_LABELS = {
    checking: 'Checking file…',
    existing: 'Existing file',
    missing: 'New file',
    error: 'Failed to load file'
  };

  const STATUS_STATES = new Set(['checking', 'existing', 'missing', 'error']);
  let currentFileInfo = { path: '', status: null, dirty: false, draft: null, draftState: '', loaded: false };
  let currentFileElRef = null;

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
    const rtf = (() => {
      try { return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }); }
      catch (_) { return null; }
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
    if (sec < 45) return 'just now';
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
    const base = STATUS_LABELS[status.state] || status.state;
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
        return ts ? `Checking… started ${ts}` : 'Checking…';
      }
      return 'Checking…';
    }
    if (Number.isFinite(status.checkedAt)) {
      const ts = formatStatusTimestamp(status.checkedAt);
      return ts ? `Last checked: ${ts}` : '';
    }
    return '';
  };

  const renderCurrentFileIndicator = () => {
    const el = ensureCurrentFileElement();
    if (!el) return;
    const path = currentFileInfo.path ? String(currentFileInfo.path) : '';
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
          ? (rel ? `Local draft saved ${escapeHtml(rel)} (remote updated)` : 'Local draft (remote updated)')
          : (rel ? `Local draft saved ${escapeHtml(rel)}` : 'Local draft saved');
      } else {
        draftLabel = draft.conflict ? 'Local draft (remote updated)' : 'Local draft available';
      }
      metaPieces.push(`<span class="cf-draft">${draftLabel}</span>`);
    }
    const metaHtml = metaPieces.length ? `<span class="cf-line-meta">${metaPieces.join('<span aria-hidden="true">·</span>')}</span>` : '';
    el.innerHTML = `${mainHtml}${metaHtml}`;

    const tooltipParts = [path];
    if (statusLabel) tooltipParts.push(statusLabel);
    if (meta) tooltipParts.push(meta);
    if (draftLabel) tooltipParts.push(draftLabel.replace(/<[^>]+>/g, ''));
    el.setAttribute('title', tooltipParts.filter(Boolean).join(' — '));
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
    renderCurrentFileIndicator();
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
    if (!listIndex || !listTabs) return;

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
            // Deterministic language order: en, zh, ja, then others
            const langOrder = { en: 1, zh: 2, ja: 3 };
            langs.sort(([a], [b]) => (langOrder[a] || 9) - (langOrder[b] || 9) || a.localeCompare(b));
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
            const langOrder = { en: 1, zh: 2, ja: 3 };
            langs.sort(([a], [b]) => (langOrder[a] || 9) - (langOrder[b] || 9) || a.localeCompare(b));
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
