import { createHiEditor } from './hieditor.js';
import { mdParse } from './markdown.js';
import { getContentRoot, setSafeHtml } from './utils.js';
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
    // Safely render the sanitized Markdown HTML without using innerHTML
    setSafeHtml(target, post || '', baseDir);
    // Apply syntax highlighting and gutters to code blocks
    try { initSyntaxHighlighting(); } catch (_) {}
  } catch (_) {}
}

// ---- Local draft storage removed (temporary) ----

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('mdInput');
  const editor = createHiEditor(ta, 'markdown', false);
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

  let assignCurrentFileLabel = (label) => {
    const current = document.getElementById('currentFile');
    if (current) current.textContent = label ? `Loaded: ${label}` : '';
  };

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
    requestLayout: () => { requestLayout(); }
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
    assignCurrentFileLabel = (p) => { if (currentFileEl) currentFileEl.textContent = p ? `Loaded: ${p}` : ''; };

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
        contentRoot = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
      } catch (_) { contentRoot = 'wwwroot'; }
      // Keep a global hint for content root, and default editor base dir
      try { window.__ns_content_root = contentRoot; } catch (_) {}
      try { window.__ns_editor_base_dir = `${contentRoot}/`; } catch (_) {}

      try {
        setStatus('Loading index…');
        const idx = await fetchConfigWithYamlFallback([`${contentRoot}/index.yaml`, `${contentRoot}/index.yml`]);
        renderGroupedIndex(listIndex, idx);
      } catch (e) { console.warn('Failed to load index.yaml', e); }

      try {
        setStatus('Loading tabs…');
        const tjson = await fetchConfigWithYamlFallback([`${contentRoot}/tabs.yaml`, `${contentRoot}/tabs.yml`]);
        renderGroupedTabs(listTabs, tjson);
      } catch (e) { console.warn('Failed to load tabs.yaml', e); }

      setStatus('');
    })();
  })();
});
