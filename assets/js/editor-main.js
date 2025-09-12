import { createHiEditor } from './hieditor.js';
import { mdParse } from './markdown.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';

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
    const { post } = mdParse(mdText || '', '');
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
});
