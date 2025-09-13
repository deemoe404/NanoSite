import { fetchConfigWithYamlFallback } from './yaml.js';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'zh', 'ja'];

function sortLangKeys(obj) {
  const keys = Object.keys(obj || {});
  return keys.sort((a, b) => {
    const ia = PREFERRED_LANG_ORDER.indexOf(a);
    const ib = PREFERRED_LANG_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
}

function q(s) {
  // Double-quoted YAML scalar with basic escapes
  const str = String(s ?? '');
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\"/g, '\\"') + '"';
}

function toIndexYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/index.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(key => {
    const entry = data[key];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${key}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (Array.isArray(v)) {
        if (v.length <= 1) {
          const one = v[0] ?? '';
          lines.push(`  ${lang}: ${one ? one : '""'}`);
        } else {
          lines.push(`  ${lang}:`);
          v.forEach(p => lines.push(`    - ${p}`));
        }
      } else if (typeof v === 'string') {
        lines.push(`  ${lang}: ${v}`);
      }
    });
  });
  return lines.join('\n') + '\n';
}

function toTabsYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/tabs.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(tab => {
    const entry = data[tab];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${tab}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (v && typeof v === 'object') {
        const title = v.title ?? '';
        const loc = v.location ?? '';
        lines.push(`  ${lang}:`);
        lines.push(`    title: ${q(title)}`);
        lines.push(`    location: ${loc ? loc : '""'}`);
      }
    });
    lines.push('');
  });
  // Remove extra trailing blank line
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

function makeDragList(container, onReorder) {
  // Basic HTML5 drag for immediate children of container
  let dragEl = null;
  container.addEventListener('dragstart', (e) => {
    const li = e.target.closest('[data-key]');
    if (!li) return;
    dragEl = li;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.key);
    li.classList.add('dragging');
  });
  container.addEventListener('dragend', () => {
    if (dragEl) dragEl.classList.remove('dragging');
    dragEl = null;
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const after = getDragAfterElement(container, e.clientY);
    const li = dragEl;
    if (!li) return;
    if (after == null) container.appendChild(li);
    else container.insertBefore(li, after);
  });
  container.addEventListener('drop', () => {
    if (!onReorder) return;
    const order = Array.from(container.querySelectorAll('[data-key]')).map(el => el.dataset.key);
    onReorder(order);
  });
  function getDragAfterElement(c, y) {
    const els = [...c.querySelectorAll('[data-key]:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

function buildIndexUI(root, state) {
  root.innerHTML = '';
  const list = document.createElement('div');
  list.id = 'ciList';
  root.appendChild(list);

  const order = state.index.__order;
  order.forEach(key => {
    const entry = state.index[key] || {};
    const row = document.createElement('div');
    row.className = 'ci-item';
    row.setAttribute('data-key', key);
    row.setAttribute('draggable', 'true');
    row.innerHTML = `
      <div class="ci-head">
        <span class="ci-grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
        <strong class="ci-key">${key}</strong>
        <span class="ci-meta">${Object.keys(entry).length} lang</span>
        <span class="ci-actions">
          <button class="btn-secondary ci-expand" aria-expanded="false">Details</button>
          <button class="btn-secondary ci-del">Delete</button>
        </span>
      </div>
      <div class="ci-body" style="display:none;"></div>
    `;
    list.appendChild(row);

    const body = $('.ci-body', row);
    const btnExpand = $('.ci-expand', row);
    const btnDel = $('.ci-del', row);

    const renderBody = () => {
      body.innerHTML = '';
      const langs = sortLangKeys(entry);
      langs.forEach(lang => {
        const block = document.createElement('div');
        block.className = 'ci-lang';
        const val = entry[lang];
        // Normalize to array for UI
        const arr = Array.isArray(val) ? val.slice() : (val ? [val] : []);
        block.innerHTML = `
          <div class="ci-lang-head">
            <strong>${lang.toUpperCase()}</strong>
            <span class="ci-lang-actions">
              <button class="btn-secondary ci-lang-addver">+ Version</button>
              <button class="btn-secondary ci-lang-del">Remove Lang</button>
            </span>
          </div>
          <div class="ci-ver-list"></div>
        `;
        const verList = $('.ci-ver-list', block);
        const renderVers = () => {
          verList.innerHTML = '';
          arr.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'ci-ver-item';
            row.innerHTML = `
              <input class="ci-path" type="text" placeholder="post/.../file.md" value="${p || ''}" />
              <span class="ci-ver-actions">
                <button class="btn-secondary ci-up" title="Move up">↑</button>
                <button class="btn-secondary ci-down" title="Move down">↓</button>
                <button class="btn-secondary ci-remove" title="Remove">✕</button>
              </span>
            `;
            $('.ci-path', row).addEventListener('input', (e) => {
              arr[i] = e.target.value;
              entry[lang] = arr.slice();
            });
            $('.ci-up', row).addEventListener('click', () => {
              if (i <= 0) return; const tmp = arr[i-1]; arr[i-1] = arr[i]; arr[i] = tmp; renderVers(); entry[lang] = arr.slice();
            });
            $('.ci-down', row).addEventListener('click', () => {
              if (i >= arr.length - 1) return; const tmp = arr[i+1]; arr[i+1] = arr[i]; arr[i] = tmp; renderVers(); entry[lang] = arr.slice();
            });
            $('.ci-remove', row).addEventListener('click', () => {
              arr.splice(i, 1); renderVers(); entry[lang] = arr.slice();
            });
            verList.appendChild(row);
          });
        };
        renderVers();
        $('.ci-lang-addver', block).addEventListener('click', () => {
          arr.push(''); renderVers(); entry[lang] = arr.slice();
        });
        $('.ci-lang-del', block).addEventListener('click', () => {
          delete entry[lang]; row.querySelector('.ci-meta').textContent = `${Object.keys(entry).length} lang`; renderBody();
        });
        body.appendChild(block);
      });

      const addLangWrap = document.createElement('div');
      addLangWrap.className = 'ci-add-lang';
      addLangWrap.innerHTML = `
        <input class="ci-lang-code" type="text" placeholder="lang code, e.g., en" />
        <button class="btn-secondary ci-add-lang-btn">+ Add Language</button>
      `;
      $('.ci-add-lang-btn', addLangWrap).addEventListener('click', () => {
        const code = String($('.ci-lang-code', addLangWrap).value || '').trim();
        if (!code) return; if (entry[code]) return;
        entry[code] = [''];
        row.querySelector('.ci-meta').textContent = `${Object.keys(entry).length} lang`;
        renderBody();
      });
      body.appendChild(addLangWrap);
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      btnExpand.setAttribute('aria-expanded', String(!open));
    });
    btnDel.addEventListener('click', () => {
      const i = state.index.__order.indexOf(key);
      if (i >= 0) state.index.__order.splice(i, 1);
      delete state.index[key];
      row.remove();
    });
  });

  makeDragList(list, (newOrder) => { state.index.__order = newOrder; });
}

function buildTabsUI(root, state) {
  root.innerHTML = '';
  const list = document.createElement('div');
  list.id = 'ctList';
  root.appendChild(list);

  const order = state.tabs.__order;
  order.forEach(tab => {
    const entry = state.tabs[tab] || {};
    const row = document.createElement('div');
    row.className = 'ct-item';
    row.setAttribute('data-key', tab);
    row.setAttribute('draggable', 'true');
    row.innerHTML = `
      <div class="ct-head">
        <span class="ct-grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
        <strong class="ct-key">${tab}</strong>
        <span class="ct-meta">${Object.keys(entry).length} lang</span>
        <span class="ct-actions">
          <button class="btn-secondary ct-expand" aria-expanded="false">Details</button>
          <button class="btn-secondary ct-del">Delete</button>
        </span>
      </div>
      <div class="ct-body" style="display:none;"></div>
    `;
    list.appendChild(row);

    const body = $('.ct-body', row);
    const btnExpand = $('.ct-expand', row);
    const btnDel = $('.ct-del', row);

    const renderBody = () => {
      body.innerHTML = '';
      const langs = sortLangKeys(entry);
      langs.forEach(lang => {
        const v = entry[lang] || { title: '', location: '' };
        const block = document.createElement('div');
        block.className = 'ct-lang';
        block.innerHTML = `
          <div class="ct-lang-head">
            <strong>${lang.toUpperCase()}</strong>
            <span class="ct-lang-actions">
              <button class="btn-secondary ct-lang-del">Remove Lang</button>
            </span>
          </div>
          <div class="ct-fields">
            <label>Title <input class="ct-title" type="text" value="${v.title || ''}" /></label>
            <label>Location <input class="ct-loc" type="text" placeholder="tab/.../file.md" value="${v.location || ''}" /></label>
          </div>
        `;
        $('.ct-title', block).addEventListener('input', (e) => { entry[lang] = entry[lang] || {}; entry[lang].title = e.target.value; });
        $('.ct-loc', block).addEventListener('input', (e) => { entry[lang] = entry[lang] || {}; entry[lang].location = e.target.value; });
        $('.ct-lang-del', block).addEventListener('click', () => { delete entry[lang]; row.querySelector('.ct-meta').textContent = `${Object.keys(entry).length} lang`; renderBody(); });
        body.appendChild(block);
      });

      const addLangWrap = document.createElement('div');
      addLangWrap.className = 'ct-add-lang';
      addLangWrap.innerHTML = `
        <input class="ct-lang-code" type="text" placeholder="lang code, e.g., en" />
        <button class="btn-secondary ct-add-lang-btn">+ Add Language</button>
      `;
      $('.ct-add-lang-btn', addLangWrap).addEventListener('click', () => {
        const code = String($('.ct-lang-code', addLangWrap).value || '').trim();
        if (!code) return; if (entry[code]) return;
        entry[code] = { title: '', location: '' };
        row.querySelector('.ct-meta').textContent = `${Object.keys(entry).length} lang`;
        renderBody();
      });
      body.appendChild(addLangWrap);
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      btnExpand.setAttribute('aria-expanded', String(!open));
    });
    btnDel.addEventListener('click', () => {
      const i = state.tabs.__order.indexOf(tab);
      if (i >= 0) state.tabs.__order.splice(i, 1);
      delete state.tabs[tab];
      row.remove();
    });
  });

  makeDragList(list, (newOrder) => { state.tabs.__order = newOrder; });
}

function bindComposerUI(state) {
  // Mode switch (Editor <-> Composer)
  $$('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const onEditor = mode !== 'composer';
      $('#mode-editor').style.display = onEditor ? '' : 'none';
      $('#mode-composer').style.display = onEditor ? 'none' : '';
      $$('.mode-tab').forEach(b => {
        const isOn = b.dataset.mode === mode;
        b.classList.toggle('is-active', isOn);
        b.setAttribute('aria-selected', isOn ? 'true' : 'false');
      });
    });
  });

  // File switch (index.yaml <-> tabs.yaml)
  const links = $$('a.vt-btn[data-cfile]');
  const setFile = (name) => {
    const isIndex = name !== 'tabs';
    $('#composerIndex').style.display = isIndex ? 'block' : 'none';
    $('#composerTabs').style.display = isIndex ? 'none' : 'block';
    links.forEach(a => a.classList.toggle('active', a.dataset.cfile === (isIndex ? 'index' : 'tabs')));
    $('#btnAddItem').textContent = isIndex ? '+ Add Item' : '+ Add Tab';
  };
  links.forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); setFile(a.dataset.cfile); }));
  setFile('index');

  // Add item
  $('#btnAddItem').addEventListener('click', () => {
    const isIndex = $('#composerIndex').style.display !== 'none';
    if (isIndex) {
      const key = prompt('New post key (e.g., myPost)');
      if (!key) return;
      if (state.index[key]) { alert('Key exists.'); return; }
      state.index[key] = {};
      state.index.__order.push(key);
      buildIndexUI($('#composerIndex'), state);
    } else {
      const key = prompt('New tab name (e.g., About)');
      if (!key) return;
      if (state.tabs[key]) { alert('Tab exists.'); return; }
      state.tabs[key] = {};
      state.tabs.__order.push(key);
      buildTabsUI($('#composerTabs'), state);
    }
  });

  // Export YAML
  const exportArea = $('#yamlExportWrap');
  const exportTa = $('#yamlExport');
  $('#btnExport').addEventListener('click', () => {
    const isIndex = $('#composerIndex').style.display !== 'none';
    const text = isIndex ? toIndexYaml(state.index) : toTabsYaml(state.tabs);
    exportTa.value = text;
    exportArea.style.display = 'block';
  });

  // Download YAML
  $('#btnDownload').addEventListener('click', () => {
    const isIndex = $('#composerIndex').style.display !== 'none';
    const text = isIndex ? toIndexYaml(state.index) : toTabsYaml(state.tabs);
    const name = isIndex ? 'index.yaml' : 'tabs.yaml';
    const blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function showStatus(msg) { const el = $('#composerStatus'); if (el) el.textContent = msg || ''; }

document.addEventListener('DOMContentLoaded', async () => {
  const state = { index: {}, tabs: {} };
  showStatus('Loading config…');
  try {
    const site = await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
    const root = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
    window.__ns_content_root = root; // hint for other utils
    const [idx, tbs] = await Promise.all([
      fetchConfigWithYamlFallback([`${root}/index.yaml`, `${root}/index.yml`]),
      fetchConfigWithYamlFallback([`${root}/tabs.yaml`, `${root}/tabs.yml`])
    ]);
    // Copy and attach order arrays
    state.index = Object.assign({ __order: Object.keys(idx || {}) }, idx || {});
    state.tabs = Object.assign({ __order: Object.keys(tbs || {}) }, tbs || {});
  } catch (e) {
    console.warn('Composer: failed to load configs', e);
  }
  showStatus('');

  bindComposerUI(state);
  buildIndexUI($('#composerIndex'), state);
  buildTabsUI($('#composerTabs'), state);
});

// Minimal styles injected for composer behaviors
(function injectComposerStyles(){
  const css = `
  .ci-item,.ct-item{border:1px solid var(--border);border-radius:8px;background:var(--card);margin:.5rem 0;}
  .ci-head,.ct-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border);}
  .ci-body,.ct-body{padding:.5rem .6rem;}
  .ci-grip,.ct-grip{cursor:grab;user-select:none;opacity:.7}
  .ci-actions,.ct-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ci-meta,.ct-meta{color:var(--muted);font-size:.85rem}
  .ci-lang,.ct-lang{border:1px dashed var(--border);border-radius:8px;padding:.5rem;margin:.4rem 0;background:color-mix(in srgb, var(--text) 3%, transparent);}
  .ci-lang-head,.ct-lang-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .ci-lang-actions,.ct-lang-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ci-ver-item{display:flex;align-items:center;gap:.4rem;margin:.3rem 0}
  .ci-ver-item input.ci-path{flex:1 1 auto;min-width:0;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ct-fields{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .ct-fields input{width:100%;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang,.ct-add-lang{display:flex;align-items:center;gap:.5rem;margin-top:.5rem}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .dragging{opacity:.6}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
