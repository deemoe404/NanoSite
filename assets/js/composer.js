import { fetchConfigWithYamlFallback } from './yaml.js';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'zh', 'ja'];

// Smooth expand/collapse for details panels
const __activeAnims = new WeakMap();
const SLIDE_OPEN_DUR = 320;   // slower, smoother
const SLIDE_CLOSE_DUR = 280;  // slightly faster than open
function slideToggle(el, toOpen) {
  if (!el) return;
  const isReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isOpen = el.style.display !== 'none';
  const open = (typeof toOpen === 'boolean') ? toOpen : !isOpen;
  if (open === isOpen) return;

  // Cancel any running animation
  const running = __activeAnims.get(el);
  if (running) { try { running.cancel(); } catch (_) {} __activeAnims.delete(el); }

  if (isReduced) {
    // No animation; just toggle
    el.style.display = open ? 'block' : 'none';
    el.dataset.open = open ? '1' : '0';
    return;
  }

  if (open) {
    // EXPAND
    el.style.display = 'block';
    const endH = el.scrollHeight;
    try {
      el.style.overflow = 'hidden';
      const anim = el.animate([
        { height: '0px', opacity: 0 },
        { height: endH + 'px', opacity: 1 }
      ], { duration: SLIDE_OPEN_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, anim);
      anim.onfinish = () => {
        el.style.overflow = '';
        el.style.height = '';
        el.style.opacity = '';
        el.dataset.open = '1';
        __activeAnims.delete(el);
      };
      anim.oncancel = () => {
        el.style.overflow = '';
        el.style.height = '';
        el.style.opacity = '';
        __activeAnims.delete(el);
      };
    } catch (_) {
      // Fallback: CSS transition
      el.style.overflow = 'hidden';
      el.style.height = '0px';
      el.style.opacity = '0';
      // force reflow
      void el.offsetHeight;
      el.style.transition = `height ${SLIDE_OPEN_DUR}ms ease, opacity ${SLIDE_OPEN_DUR}ms ease`;
      el.style.height = endH + 'px';
      el.style.opacity = '1';
      const clear = () => {
        el.style.transition = '';
        el.style.height = '';
        el.style.opacity = '';
        el.style.overflow = '';
        el.dataset.open = '1';
        el.removeEventListener('transitionend', clear);
      };
      el.addEventListener('transitionend', clear);
    }
  } else {
    // COLLAPSE
    const startH = el.getBoundingClientRect().height;
    try {
      el.style.overflow = 'hidden';
      const anim = el.animate([
        { height: startH + 'px', opacity: 1 },
        { height: '0px', opacity: 0 }
      ], { duration: SLIDE_CLOSE_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, anim);
      anim.onfinish = () => {
        el.style.display = 'none';
        el.style.overflow = '';
        el.style.height = '';
        el.style.opacity = '';
        el.dataset.open = '0';
        __activeAnims.delete(el);
      };
      anim.oncancel = () => {
        el.style.overflow = '';
        el.style.height = '';
        el.style.opacity = '';
        __activeAnims.delete(el);
      };
    } catch (_) {
      // Fallback: CSS transition
      el.style.overflow = 'hidden';
      el.style.height = startH + 'px';
      el.style.opacity = '1';
      // force reflow
      void el.offsetHeight;
      el.style.transition = `height ${SLIDE_CLOSE_DUR}ms ease, opacity ${SLIDE_CLOSE_DUR}ms ease`;
      el.style.height = '0px';
      el.style.opacity = '0';
      const clear = () => {
        el.style.display = 'none';
        el.style.transition = '';
        el.style.height = '';
        el.style.opacity = '';
        el.style.overflow = '';
        el.dataset.open = '0';
        el.removeEventListener('transitionend', clear);
      };
      el.addEventListener('transitionend', clear);
    }
  }
}

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
  // Pointer-driven drag that moves the original element; siblings animate via FLIP
  const keySelector = '[data-key]';
  const getKey = (el) => el && el.getAttribute && el.getAttribute('data-key');
  const childItems = () => Array.from(container.querySelectorAll(keySelector));

  let dragging = null;
  let placeholder = null;
  let offsetX = 0, offsetY = 0;

  // Utility: snapshot and animate siblings (ignore the dragged element)
  const snapshotRects = () => {
    const m = new Map();
    childItems().forEach(el => { m.set(getKey(el), el.getBoundingClientRect()); });
    return m;
  };
  const animateFrom = (prevRects) => {
    childItems().forEach(el => {
      if (el === dragging) return;
      const key = getKey(el);
      const prev = prevRects.get(key);
      if (!prev) return;
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (dx || dy) {
        try {
          el.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ], { duration: 240, easing: 'ease', composite: 'replace' });
        } catch (_) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform 240ms ease';
            el.style.transform = '';
            const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear); };
            el.addEventListener('transitionend', clear);
          });
        }
      }
    });
  };

  const getAfterByY = (c, y) => {
    const els = [...c.querySelectorAll(`${keySelector}:not(.dragging)`)];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return; // left click or touch only
    const target = e.target;
    if (target.closest('button, input, textarea, select, a')) return; // don't start drag from controls
    const li = target.closest(keySelector);
    if (!li || !container.contains(li)) return;

    e.preventDefault();

    dragging = li;
    const r = li.getBoundingClientRect();
    offsetX = e.clientX - r.left;
    offsetY = e.clientY - r.top;

    // placeholder keeps layout
    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = r.height + 'px';
    placeholder.style.margin = getComputedStyle(li).margin;
    li.parentNode.insertBefore(placeholder, li.nextSibling);

    // elevate original element and follow pointer
    li.style.width = r.width + 'px';
    li.style.height = r.height + 'px';
    li.style.position = 'fixed';
    li.style.left = (e.clientX - offsetX) + 'px';
    li.style.top = (e.clientY - offsetY) + 'px';
    li.style.zIndex = '2147483646';
    li.style.pointerEvents = 'none';
    li.style.willChange = 'transform, top, left';
    li.classList.add('dragging');
    container.classList.add('is-dragging-list');
    document.body.classList.add('ns-noselect');

    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    dragging.style.left = (e.clientX - offsetX) + 'px';
    dragging.style.top = (e.clientY - offsetY) + 'px';

    const prev = snapshotRects();
    const after = getAfterByY(container, e.clientY);
    if (after == null) container.appendChild(placeholder);
    else container.insertBefore(placeholder, after);
    animateFrom(prev);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    // current visual position of the fixed element (origin)
    const origin = dragging.getBoundingClientRect();
    // target position equals the placeholder's rect
    const target = placeholder.getBoundingClientRect();
    const dx = origin.left - target.left;
    const dy = origin.top - target.top;

    // place the element where the placeholder sits in DOM order
    placeholder.parentNode.insertBefore(dragging, placeholder);
    placeholder.remove();
    placeholder = null;

    // reset positioning to re-enter normal flow
    dragging.style.position = '';
    dragging.style.left = '';
    dragging.style.top = '';
    dragging.style.width = '';
    dragging.style.height = '';
    dragging.style.zIndex = '';
    dragging.style.pointerEvents = '';
    dragging.style.willChange = '';
    dragging.classList.remove('dragging');

    // animate the snap from origin -> target (FLIP on the dragged element)
    try {
      dragging.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: 240, easing: 'ease' });
    } catch (_) {
      // Fallback: CSS transition
      dragging.style.transition = 'none';
      dragging.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        dragging.style.transition = 'transform 240ms ease';
        dragging.style.transform = '';
        const clear = () => { dragging.style.transition = ''; dragging.removeEventListener('transitionend', clear); };
        dragging.addEventListener('transitionend', clear);
      });
    }

    container.classList.remove('is-dragging-list');
    document.body.classList.remove('ns-noselect');
    window.removeEventListener('pointermove', onPointerMove);

    const order = childItems().map(el => el.dataset.key);
    if (onReorder) onReorder(order);
    dragging = null;
  };

  // Disable native HTML5 DnD on this container
  container.addEventListener('dragstart', (e) => e.preventDefault());
  container.addEventListener('pointerdown', onPointerDown);
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
          <button class="btn-secondary ci-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>Details</button>
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
        // Stable IDs for FLIP animations across re-renders
        let verIds = arr.map(() => Math.random().toString(36).slice(2));

        const snapRects = () => {
          const map = new Map();
          verList.querySelectorAll('.ci-ver-item').forEach(el => {
            const id = el.getAttribute('data-id');
            if (!id) return;
            map.set(id, el.getBoundingClientRect());
          });
          return map;
        };

        const animateFrom = (prev) => {
          if (!prev) return;
          verList.querySelectorAll('.ci-ver-item').forEach(el => {
            const id = el.getAttribute('data-id');
            const r0 = id && prev.get(id);
            if (!r0) return;
            const r1 = el.getBoundingClientRect();
            const dx = r0.left - r1.left;
            const dy = r0.top - r1.top;
            if (dx || dy) {
              try {
                el.animate([
                  { transform: `translate(${dx}px, ${dy}px)` },
                  { transform: 'translate(0, 0)' }
                ], { duration: 240, easing: 'ease', composite: 'replace' });
              } catch (_) {
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(() => {
                  el.style.transition = 'transform 240ms ease';
                  el.style.transform = '';
                  const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear); };
                  el.addEventListener('transitionend', clear);
                });
              }
            }
          });
        };

        const renderVers = (prevRects = null) => {
          verList.innerHTML = '';
          arr.forEach((p, i) => {
            const id = verIds[i] || (verIds[i] = Math.random().toString(36).slice(2));
            const row = document.createElement('div');
            row.className = 'ci-ver-item';
            row.setAttribute('data-id', id);
            row.innerHTML = `
              <input class="ci-path" type="text" placeholder="post/.../file.md" value="${p || ''}" />
              <span class="ci-ver-actions">
                <button class="btn-secondary ci-up" title="Move up">↑</button>
                <button class="btn-secondary ci-down" title="Move down">↓</button>
                <button class="btn-secondary ci-remove" title="Remove">✕</button>
              </span>
            `;
            const up = $('.ci-up', row);
            const down = $('.ci-down', row);
            // Disable ↑ for first, ↓ for last
            if (i === 0) up.setAttribute('disabled', ''); else up.removeAttribute('disabled');
            if (i === arr.length - 1) down.setAttribute('disabled', ''); else down.removeAttribute('disabled');

            $('.ci-path', row).addEventListener('input', (e) => {
              arr[i] = e.target.value;
              entry[lang] = arr.slice();
            });
            up.addEventListener('click', () => {
              if (i <= 0) return;
              const prev = snapRects();
              [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
              [verIds[i - 1], verIds[i]] = [verIds[i], verIds[i - 1]];
              entry[lang] = arr.slice();
              renderVers(prev);
            });
            down.addEventListener('click', () => {
              if (i >= arr.length - 1) return;
              const prev = snapRects();
              [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
              [verIds[i + 1], verIds[i]] = [verIds[i], verIds[i + 1]];
              entry[lang] = arr.slice();
              renderVers(prev);
            });
            $('.ci-remove', row).addEventListener('click', () => {
              const prev = snapRects();
              arr.splice(i, 1);
              verIds.splice(i, 1);
              entry[lang] = arr.slice();
              renderVers(prev);
            });
            verList.appendChild(row);
          });
          animateFrom(prevRects);
        };
        renderVers();
        $('.ci-lang-addver', block).addEventListener('click', () => {
          const prev = snapRects();
          arr.push('');
          verIds.push(Math.random().toString(36).slice(2));
          entry[lang] = arr.slice();
          renderVers(prev);
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
      slideToggle(body, !open);
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
          <button class="btn-secondary ct-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>Details</button>
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
      slideToggle(body, !open);
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
  .ci-ver-actions button:disabled{opacity:.5;cursor:not-allowed}
  .ct-fields{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .ct-fields input{width:100%;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang,.ct-add-lang{display:flex;align-items:center;gap:.5rem;margin-top:.5rem}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .dragging{opacity:.96}
  .drag-placeholder{border:1px dashed var(--border);border-radius:8px;background:transparent}
  .is-dragging-list{touch-action:none}
  body.ns-noselect{user-select:none;cursor:grabbing}
  /* Caret arrow for Details buttons */
  .ci-expand .caret,.ct-expand .caret{display:inline-block;width:0;height:0;border-style:solid;border-width:5px 0 5px 7px;border-color:transparent transparent transparent currentColor;margin-right:.35rem;transform:rotate(0deg);transform-origin:50% 50%;transition:transform 320ms ease}
  .ci-expand[aria-expanded="true"] .caret,.ct-expand[aria-expanded="true"] .caret{transform:rotate(90deg)}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
