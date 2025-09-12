import { createHiEditor } from './hieditor.js';
import { mdParse } from './markdown.js';
import { getContentRoot } from './utils.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';
import { fetchConfigWithYamlFallback } from './yaml.js';

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
    // Apply syntax highlighting and gutters to code blocks
    try { initSyntaxHighlighting(); } catch (_) {}
  } catch (_) {}
}

// ---- Local draft storage helpers ----
const DRAFT_KEY = (() => {
  try { return `nanosite:editor:md:${location.pathname || 'index'}`; } catch (_) { return 'nanosite:editor:md:index'; }
})();
function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
function lsSet(k, v) { try { localStorage.setItem(k, String(v || '')); } catch (_) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (_) {} }
function debounce(fn, ms = 500) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('mdInput');
  const editor = createHiEditor(ta, 'markdown', false);
  // Seed with a minimal template
  const seed = `# 新文章标题\n\n> 在左侧编辑 Markdown，切换到 Preview 查看渲染效果。\n\n- 支持代码块、表格、待办列表\n- 图片与视频语法\n\n\`\`\`js\nconsole.log('Hello, NanoSite!');\n\`\`\`\n`;
  // Restore draft if exists; otherwise apply seed if empty
  if (editor) {
    const existing = (editor.getValue() || '').trim();
    const saved = (lsGet(DRAFT_KEY) || '').trim();
    if (saved) {
      editor.setValue(saved);
      try { console.info('[Editor] Draft restored from local storage'); } catch (_) {}
    } else if (!existing) {
      editor.setValue(seed);
    }
  }
  const saveDraft = debounce((val) => lsSet(DRAFT_KEY, val || ''), 500);
  const update = () => renderPreview(editor ? editor.getValue() : (ta.value || ''));
  if (editor && editor.textarea) editor.textarea.addEventListener('input', () => {
    update();
    saveDraft(editor.getValue());
  });
  update();

  // View toggle
  document.querySelectorAll('.vt-btn').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = a.dataset.view;
      switchView(mode);
      if (mode === 'preview') update();
    });
  });

  // Clear draft action
  const clearBtn = document.getElementById('btnClearDraft');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ok = confirm('Clear saved draft? This cannot be undone.');
      if (!ok) return;
      lsDel(DRAFT_KEY);
      if (editor) editor.setValue(seed);
      update();
    });
  }

  // Flush latest content on unload
  window.addEventListener('beforeunload', () => {
    try { lsSet(DRAFT_KEY, editor ? editor.getValue() : (ta.value || '')); } catch (_) {}
  });

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
    const setCurrentFile = (p) => { if (currentFileEl) currentFileEl.textContent = p ? `Loaded: ${p}` : ''; };

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
          if (editor) editor.setValue(text);
          // Persist to local draft so reload keeps latest
          try { lsSet(DRAFT_KEY, text); } catch (_) {}
          // Set preview base dir to the directory of the loaded markdown file
          try {
            const lastSlash = relPath.lastIndexOf('/');
            const dir = lastSlash >= 0 ? relPath.slice(0, lastSlash + 1) : '';
            window.__ns_editor_base_dir = `${contentRoot}/${dir}`.replace(/\\+/g, '/');
          } catch (_) { window.__ns_editor_base_dir = `${contentRoot}/`; }
          renderPreview(text);
          setCurrentFile(`${relPath}`);
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

    const flattenIndex = (obj) => {
      const items = [];
      try {
        const langKey = /^(default|en|zh|ja|[a-z]{2})(?:-[a-z0-9]+)?$/i;
        for (const [group, val] of Object.entries(obj || {})) {
          if (typeof val === 'string') {
            items.push({ label: `${group} - ${basename(val)}`, path: String(val) });
          } else if (Array.isArray(val)) {
            val.forEach(p => { if (typeof p === 'string') items.push({ label: `${group} - ${basename(p)}`, path: p }); });
          } else if (val && typeof val === 'object') {
            for (const [lang, paths] of Object.entries(val)) {
              const langTag = langKey.test(lang) ? lang : lang;
              if (typeof paths === 'string') {
                items.push({ label: `${group} (${langTag}) - ${basename(paths)}`, path: paths });
              } else if (Array.isArray(paths)) {
                paths.forEach(p => { if (typeof p === 'string') items.push({ label: `${group} (${langTag}) - ${basename(p)}`, path: p }); });
              }
            }
          }
        }
      } catch (_) { /* noop */ }
      return items;
    };

    const flattenTabs = (obj) => {
      const items = [];
      try {
        for (const [tab, variants] of Object.entries(obj || {})) {
          if (typeof variants === 'string') {
            items.push({ label: `${tab} - ${basename(variants)}`, path: variants });
            continue;
          }
          if (!variants || typeof variants !== 'object') continue;
          for (const [lang, detail] of Object.entries(variants)) {
            if (typeof detail === 'string') {
              items.push({ label: `${tab} (${lang}) - ${basename(detail)}`, path: detail });
            } else if (detail && typeof detail === 'object') {
              const title = detail.title || tab;
              const loc = detail.location || '';
              if (loc) items.push({ label: `${title} (${lang}) - ${basename(loc)}`, path: loc });
            }
          }
        }
      } catch (_) { /* noop */ }
      return items;
    };

    const renderList = (ul, items) => {
      ul.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const it of items) frag.appendChild(makeLi(it.label, it.path));
      ul.appendChild(frag);
    };

    const applyFilter = (term) => {
      const q = String(term || '').trim().toLowerCase();
      const scope = activeGroup === 'tabs' ? '#groupTabs .file-item' : '#groupIndex .file-item';
      const all = document.querySelectorAll(scope);
      all.forEach(li => {
        if (!q) { li.style.display = ''; return; }
        const a = li.dataset.label || '';
        const b = li.dataset.file || '';
        li.style.display = (a.includes(q) || b.includes(q)) ? '' : 'none';
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
        contentRoot = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
      } catch (_) { contentRoot = 'wwwroot'; }
      // Keep a global hint for content root, and default editor base dir
      try { window.__ns_content_root = contentRoot; } catch (_) {}
      try { window.__ns_editor_base_dir = `${contentRoot}/`; } catch (_) {}

      try {
        setStatus('Loading index…');
        const idx = await fetchConfigWithYamlFallback([`${contentRoot}/index.yaml`, `${contentRoot}/index.yml`]);
        const items = flattenIndex(idx);
        renderList(listIndex, items);
      } catch (e) { console.warn('Failed to load index.yaml', e); }

      try {
        setStatus('Loading tabs…');
        const tjson = await fetchConfigWithYamlFallback([`${contentRoot}/tabs.yaml`, `${contentRoot}/tabs.yml`]);
        const titems = flattenTabs(tjson);
        renderList(listTabs, titems);
      } catch (e) { console.warn('Failed to load tabs.yaml', e); }

      setStatus('');
    })();
  })();
});
