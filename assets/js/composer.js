import { fetchConfigWithYamlFallback } from './yaml.js';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'zh', 'ja'];

// --- Persisted UI state keys ---
const LS_KEYS = {
  mode: 'ns_editor_mode',       // 'editor' | 'composer'
  cfile: 'ns_composer_file'     // 'index' | 'tabs'
};

// Default Markdown template for new post files (index.yaml related flows)
function makeDefaultMdTemplate(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local date
  const lines = [
    '---',
    'title: ',
    `date: ${dateStr}`,
  ];
  if (options.version) lines.push(`version: ${String(options.version)}`);
  lines.push(
    'tags: ',
    'excerpt: ',
    'author: ',
    'ai: false',
    'draft: true',
    '---',
    ''
  );
  return lines.join('\n');
}

// Read desired mode from URL hash/query or localStorage (fallback to 'editor')
function getInitialMode() {
  try {
    const h = String(location.hash || '').toLowerCase();
    if (h.includes('composer')) return 'composer';
    if (h.includes('editor')) return 'editor';
  } catch (_) {}
  try {
    const url = new URL(location.href);
    const p = (url.searchParams.get('mode') || '').toLowerCase();
    if (p === 'composer' || p === 'editor') return p;
  } catch (_) {}
  try {
    const v = (localStorage.getItem(LS_KEYS.mode) || '').toLowerCase();
    if (v === 'composer' || v === 'editor') return v;
  } catch (_) {}
  return 'editor';
}

function setPersistedMode(mode) {
  // Persist and reflect in URL hash (non-destructive)
  try { localStorage.setItem(LS_KEYS.mode, mode); } catch (_) {}
  try {
    const url = new URL(location.href);
    url.hash = mode === 'composer' ? '#composer' : '#editor';
    history.replaceState(null, '', url);
  } catch (_) {}
}

function applyMode(mode) {
  const onEditor = mode !== 'composer';
  try { $('#mode-editor').style.display = onEditor ? '' : 'none'; } catch (_) {}
  try { $('#mode-composer').style.display = onEditor ? 'none' : ''; } catch (_) {}
  try {
    $$('.mode-tab').forEach(b => {
      const isOn = (b.dataset.mode === mode);
      b.classList.toggle('is-active', isOn);
      b.setAttribute('aria-selected', isOn ? 'true' : 'false');
    });
  } catch (_) {}
  // Sync preload attribute so CSS with !important stops forcing previous mode
  try {
    if (mode === 'composer') document.documentElement.setAttribute('data-init-mode', 'composer');
    else document.documentElement.removeAttribute('data-init-mode');
  } catch (_) {}
}

function getInitialComposerFile() {
  try {
    const v = (localStorage.getItem(LS_KEYS.cfile) || '').toLowerCase();
    if (v === 'tabs' || v === 'index') return v;
  } catch (_) {}
  return 'index';
}

function applyComposerFile(name) {
  const isIndex = name !== 'tabs';
  try { $('#composerIndex').style.display = isIndex ? 'block' : 'none'; } catch (_) {}
  try { $('#composerTabs').style.display = isIndex ? 'none' : 'block'; } catch (_) {}
  try {
    $$('a.vt-btn[data-cfile]').forEach(a => {
      a.classList.toggle('active', a.dataset.cfile === (isIndex ? 'index' : 'tabs'));
    });
  } catch (_) {}
  try {
    const btn = $('#btnAddItem');
    if (btn) btn.textContent = isIndex ? 'New Post Wizard' : 'New Tab Wizard';
  } catch (_) {}
  // Sync preload attribute to avoid CSS forcing the wrong sub-file
  try {
    if (!isIndex) document.documentElement.setAttribute('data-init-cfile', 'tabs');
    else document.documentElement.removeAttribute('data-init-cfile');
  } catch (_) {}
}

// Apply initial state as early as possible to avoid flash on reload
(() => {
  try { applyMode(getInitialMode()); } catch (_) {}
  try { applyComposerFile(getInitialComposerFile()); } catch (_) {}
})();

// Robust clipboard helper available to all composer flows
async function nsCopyToClipboard(text) {
  const val = String(text || '');
  // Prefer async Clipboard API when in a secure context
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Intentionally do not await in callers to better preserve user-activation
      await navigator.clipboard.writeText(val);
      return true;
    }
  } catch (_) { /* fall through to legacy */ }
  // Legacy fallback: temporary textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = val;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    try { document.body.removeChild(ta); } catch (_) {}
    return ok;
  } catch (_) { return false; }
}

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

// Localized display names for languages in UI menus
function displayLangName(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'en') return 'English';
  if (c === 'zh') return '中文';
  if (c === 'ja') return '日本語';
  return c.toUpperCase();
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
      <div class="ci-body"><div class="ci-body-inner"></div></div>
    `;
    list.appendChild(row);

    const body = $('.ci-body', row);
    const bodyInner = $('.ci-body-inner', row);
    const btnExpand = $('.ci-expand', row);
    const btnDel = $('.ci-del', row);

    const renderBody = () => {
      bodyInner.innerHTML = '';
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
        bodyInner.appendChild(block);
      });

      // Add-language via custom dropdown showing only missing languages
      const supportedLangs = PREFERRED_LANG_ORDER.slice();
      const available = supportedLangs.filter(l => !entry[l]);
      if (available.length > 0) {
        const addLangWrap = document.createElement('div');
        addLangWrap.className = 'ci-add-lang has-menu';
        addLangWrap.innerHTML = `
          <button type="button" class="btn-secondary ci-add-lang-btn" aria-haspopup="listbox" aria-expanded="false">+ Add Language</button>
          <div class="ci-lang-menu ns-menu" role="listbox" hidden>
            ${available.map(l => `<button type="button" role="option" class="ns-menu-item" data-lang="${l}">${displayLangName(l)}</button>`).join('')}
          </div>
        `;
        const btn = $('.ci-add-lang-btn', addLangWrap);
        const menu = $('.ci-lang-menu', addLangWrap);
        function closeMenu(){
          if (menu.hidden) return;
          // animate out, then hide
          const finish = () => {
            menu.hidden = true;
            btn.classList.remove('is-open');
            addLangWrap.classList.remove('is-open');
            btn.setAttribute('aria-expanded','false');
            document.removeEventListener('mousedown', onDocDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            menu.classList.remove('is-closing');
          };
          try {
            menu.classList.add('is-closing');
            const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
            menu.addEventListener('animationend', onEnd, { once: true });
            // safety timeout
            setTimeout(finish, 180);
          } catch(_) { finish(); }
        }
        function openMenu(){
          if (!menu.hidden) return;
          menu.hidden = false;
          try { menu.classList.remove('is-closing'); } catch(_){}
          btn.classList.add('is-open');
          addLangWrap.classList.add('is-open');
          btn.setAttribute('aria-expanded','true');
          try { menu.querySelector('.ns-menu-item')?.focus(); } catch(_){}
          document.addEventListener('mousedown', onDocDown, true);
          document.addEventListener('keydown', onKeyDown, true);
        }
        function onDocDown(e){ if (!addLangWrap.contains(e.target)) closeMenu(); }
        function onKeyDown(e){ if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } }
        btn.addEventListener('click', () => { btn.classList.contains('is-open') ? closeMenu() : openMenu(); });
        menu.querySelectorAll('.ns-menu-item').forEach(it => {
          it.addEventListener('click', () => {
            const code = String(it.getAttribute('data-lang')||'').trim();
            if (!code || entry[code]) return;
            entry[code] = [''];
            row.querySelector('.ci-meta').textContent = `${Object.keys(entry).length} lang`;
            closeMenu();
            renderBody();
          });
        });
        bodyInner.appendChild(addLangWrap);
      }
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const isOpen = body.classList.contains('is-open');
      body.classList.toggle('is-open', !isOpen);
      btnExpand.setAttribute('aria-expanded', String(!isOpen));
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
      <div class="ct-body"><div class="ct-body-inner"></div></div>
    `;
    list.appendChild(row);

    const body = $('.ct-body', row);
    const bodyInner = $('.ct-body-inner', row);
    const btnExpand = $('.ct-expand', row);
    const btnDel = $('.ct-del', row);

    const renderBody = () => {
      bodyInner.innerHTML = '';
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
        bodyInner.appendChild(block);
      });

      // Add-language via custom dropdown showing only missing languages
      const supportedLangs = PREFERRED_LANG_ORDER.slice();
      const available = supportedLangs.filter(l => !entry[l]);
      if (available.length > 0) {
        const addLangWrap = document.createElement('div');
        addLangWrap.className = 'ct-add-lang has-menu';
        addLangWrap.innerHTML = `
          <button type="button" class="btn-secondary ct-add-lang-btn" aria-haspopup="listbox" aria-expanded="false">+ Add Language</button>
          <div class="ct-lang-menu ns-menu" role="listbox" hidden>
            ${available.map(l => `<button type=\"button\" role=\"option\" class=\"ns-menu-item\" data-lang=\"${l}\">${displayLangName(l)}</button>`).join('')}
          </div>
        `;
        const btn = $('.ct-add-lang-btn', addLangWrap);
        const menu = $('.ct-lang-menu', addLangWrap);
        function closeMenu(){
          if (menu.hidden) return;
          const finish = () => {
            menu.hidden = true;
            btn.classList.remove('is-open');
            addLangWrap.classList.remove('is-open');
            btn.setAttribute('aria-expanded','false');
            document.removeEventListener('mousedown', onDocDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            menu.classList.remove('is-closing');
          };
          try {
            menu.classList.add('is-closing');
            const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
            menu.addEventListener('animationend', onEnd, { once: true });
            setTimeout(finish, 180);
          } catch(_) { finish(); }
        }
        function openMenu(){
          if (!menu.hidden) return;
          menu.hidden = false;
          try { menu.classList.remove('is-closing'); } catch(_){}
          btn.classList.add('is-open');
          addLangWrap.classList.add('is-open');
          btn.setAttribute('aria-expanded','true');
          try { menu.querySelector('.ns-menu-item')?.focus(); } catch(_){}
          document.addEventListener('mousedown', onDocDown, true);
          document.addEventListener('keydown', onKeyDown, true);
        }
        function onDocDown(e){ if (!addLangWrap.contains(e.target)) closeMenu(); }
        function onKeyDown(e){ if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } }
        btn.addEventListener('click', () => { btn.classList.contains('is-open') ? closeMenu() : openMenu(); });
        menu.querySelectorAll('.ns-menu-item').forEach(it => {
          it.addEventListener('click', () => {
            const code = String(it.getAttribute('data-lang')||'').trim();
            if (!code || entry[code]) return;
            entry[code] = { title: '', location: '' };
            row.querySelector('.ct-meta').textContent = `${Object.keys(entry).length} lang`;
            closeMenu();
            renderBody();
          });
        });
        bodyInner.appendChild(addLangWrap);
      }
    };
    renderBody();

    btnExpand.addEventListener('click', () => {
      const isOpen = body.classList.contains('is-open');
      body.classList.toggle('is-open', !isOpen);
      btnExpand.setAttribute('aria-expanded', String(!isOpen));
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
      applyMode(mode);
      setPersistedMode(mode);
    });
  });

  // File switch (index.yaml <-> tabs.yaml)
  const links = $$('a.vt-btn[data-cfile]');
  const setFile = (name) => {
    applyComposerFile(name);
    try { localStorage.setItem(LS_KEYS.cfile, (name === 'tabs') ? 'tabs' : 'index'); } catch (_) {}
  };
  links.forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); setFile(a.dataset.cfile); }));
  // Respect persisted selection on load
  setFile(getInitialComposerFile());

  // ----- Composer: New Post Wizard -----
  // Build a small guided flow to:
  // 1) Set metadata (key, languages, filename)
  // 2) Guide creating folder + file on GitHub
  // 3) Add entry to index.yaml via Composer, then export YAML
  (function buildComposerGuide(){
    const host = document.getElementById('mode-composer');
    if (!host) return;
    const section = host.querySelector('section.editor-main');
    if (!section) return;
    const toolbar = section.querySelector('.toolbar');

    const wrap = document.createElement('div');
    wrap.id = 'composerGuide';
    wrap.className = 'comp-guide';
    wrap.innerHTML = `
      <div class="comp-guide-head">
        <strong>Composer Wizard - Post</strong>
        <span class="muted">Create files on GitHub and update YAML</span>
      </div>
      <div class="comp-form">
        <label>Key <input id="compKey" type="text" placeholder="e.g., myPost" /></label>
        <div id="compTitlesWrap" class="comp-titles" style="display:none;"></div>
        <label>Filename <input id="compFilename" type="text" value="main.md" /></label>
        <div class="comp-langs">
          <span class="lab">Languages</span>
          <label><input type="checkbox" value="en" id="compLangEN" checked><span>EN</span></label>
          <label><input type="checkbox" value="zh" id="compLangZH"><span>ZH</span></label>
          <label><input type="checkbox" value="ja" id="compLangJA"><span>JA</span></label>
        </div>
        <div class="comp-actions">
          <button class="btn-secondary" id="compGen">Generate Steps</button>
        </div>
      </div>
      <div class="comp-divider" id="compDivider" hidden></div>
      <div class="comp-steps" id="compSteps" hidden></div>
      <div class="comp-footer" style="display:flex; justify-content:flex-end; gap:.5rem; margin-top:.5rem;">
        <span id="compHint" class="comp-hint" hidden>Wait for GitHub Pages to finish deploying (may take a few minutes) before verifying.</span>
        <button class="btn-primary" id="compFinish" hidden>Verify Setup</button>
      </div>
    `;
    // Create a modal container and mount the wizard inside
    const modal = document.createElement('div');
    modal.id = 'compModal';
    modal.className = 'ns-modal';
    modal.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'ns-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'compGuideTitle');

    // Add close button
    const btnClose = document.createElement('button');
    btnClose.className = 'ns-modal-close btn-secondary';
    btnClose.type = 'button';
    btnClose.setAttribute('aria-label', 'Cancel');
    btnClose.textContent = 'Cancel';

    // Label the title for a11y and restructure header to include the close button
    const headStrong = document.createElement('strong');
    headStrong.id = 'compGuideTitle';
    headStrong.textContent = 'Composer Wizard - Post';
    const head = wrap.querySelector('.comp-guide-head');
    if (head) {
      const muted = head.querySelector('.muted');
      const left = document.createElement('div');
      left.className = 'comp-head-left';
      left.appendChild(headStrong);
      if (muted) left.appendChild(muted);
      head.innerHTML = '';
      head.appendChild(left);
      head.appendChild(btnClose);
    }

    dialog.appendChild(wrap);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Modal behaviors
    const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastActive = null;
    let compMode = 'index'; // 'index' | 'tabs'
    function getActiveTarget(){ try { return ($('#composerIndex').style.display !== 'none') ? 'index' : 'tabs'; } catch(_) { return 'index'; } }

    function openModal() {
      lastActive = document.activeElement;
      const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
      // Ensure we start clean
      try { modal.classList.remove('ns-anim-out'); } catch(_) {}
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('ns-modal-open');
      if (!reduce) {
        try {
          // Trigger enter animation
          modal.classList.add('ns-anim-in');
          const onEnd = () => { try { modal.classList.remove('ns-anim-in'); } catch(_) {}; dialog.removeEventListener('animationend', onEnd); };
          dialog.addEventListener('animationend', onEnd, { once: true });
        } catch(_) {}
      }
      // Default to Cancel until verification passes
      try { btnClose.textContent = 'Cancel'; btnClose.setAttribute('aria-label', 'Cancel'); } catch(_){}
      // Unlock form controls for a new session
      try { if (typeof setFormLocked === 'function') setFormLocked(false); } catch(_){}
      // Clear any floating bubble
      try { if (typeof hideKeyBubble === 'function') hideKeyBubble(); } catch(_){}
      // Hide Verify until steps are generated again
      try { if (typeof setVerifyVisible === 'function') setVerifyVisible(false); } catch(_){}
      // Clear any title bubble
      try { if (typeof hideTitleBubble === 'function') hideTitleBubble(); } catch(_){}
      // Adapt header and fields by active file type
      try {
        compMode = getActiveTarget();
        if (compMode === 'tabs') {
          headStrong.textContent = 'Composer Wizard - Tab';
          updateTitlesUI();
        } else {
          headStrong.textContent = 'Composer Wizard - Post';
          updateTitlesUI();
        }
      } catch(_) {}
      setTimeout(() => { try { wrap.querySelector('#compKey')?.focus(); } catch(_){} }, 0);
    }
    function closeModal() {
      const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
      if (reduce) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ns-modal-open');
        try { lastActive && lastActive.focus(); } catch(_){}
        return;
      }
      try { modal.classList.remove('ns-anim-in'); } catch(_) {}
      try { modal.classList.add('ns-anim-out'); } catch(_) {}
      const finish = () => {
        try { modal.classList.remove('ns-anim-out'); } catch(_) {}
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ns-modal-open');
        try { lastActive && lastActive.focus(); } catch(_){}
      };
      try {
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); finish(); };
        dialog.addEventListener('animationend', onEnd, { once: true });
        // Safety net in case animationend doesn't fire
        setTimeout(finish, 220);
      } catch(_) { finish(); }
    }

    modal.__open = openModal;
    modal.__close = closeModal;
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Tab') {
        const focusables = Array.from(dialog.querySelectorAll(focusableSelector)).filter(el => el.offsetParent !== null || el === document.activeElement);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    const compKey = $('#compKey', wrap);
    const compFilename = $('#compFilename', wrap);
    const compTitlesWrap = $('#compTitlesWrap', wrap);
    const titlesStore = Object.create(null); // { lang: title }

    function langNameFor(code){
      const c = String(code||'').toLowerCase();
      if (c==='en') return 'EN';
      if (c==='zh') return 'ZH';
      if (c==='ja') return 'JA';
      return c.toUpperCase();
    }

    function getSelectedLangs(){
      const arr = [];
      try { const el = wrap.querySelector('#compLangEN'); if (el && el.checked) arr.push('en'); } catch(_){}
      try { const el = wrap.querySelector('#compLangZH'); if (el && el.checked) arr.push('zh'); } catch(_){}
      try { const el = wrap.querySelector('#compLangJA'); if (el && el.checked) arr.push('ja'); } catch(_){}
      // keep preferred order
      const set = Array.from(new Set(arr));
      return set.sort((a,b)=>{
        const ia = PREFERRED_LANG_ORDER.indexOf(a);
        const ib = PREFERRED_LANG_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.localeCompare(b);
      });
    }

    function updateTitlesUI(){
      if (!compTitlesWrap) return;
      const isTabs = compMode === 'tabs';
      compTitlesWrap.style.display = isTabs ? '' : 'none';
      if (!isTabs) { compTitlesWrap.innerHTML = ''; return; }
      const langs = getSelectedLangs();
      // preserve existing input values
      try {
        Array.from(compTitlesWrap.querySelectorAll('input[data-lang]')).forEach(inp=>{
          const l = inp.getAttribute('data-lang');
          if (l) titlesStore[l] = inp.value;
        });
      } catch(_){}
      compTitlesWrap.innerHTML = '';
      langs.forEach(l => {
        const label = document.createElement('label');
        label.setAttribute('data-title-item', l);
        label.innerHTML = `Title (${langNameFor(l)}) <input type="text" data-lang="${l}" placeholder="Title for ${l.toUpperCase()}" />`;
        const inp = label.querySelector('input');
        inp.value = titlesStore[l] || '';
        inp.addEventListener('input', () => { titlesStore[l] = inp.value; });
        compTitlesWrap.appendChild(label);
      });
    }

    function getTitlesMap(){
      const out = Object.create(null);
      try {
        (compTitlesWrap?.querySelectorAll('input[data-lang]') || []).forEach(inp => {
          const l = inp.getAttribute('data-lang');
          if (l) out[l] = String(inp.value || '').trim();
        });
      } catch(_) {}
      return out;
    }
    const compLangEN = $('#compLangEN', wrap);
    const compLangZH = $('#compLangZH', wrap);
    const compLangJA = $('#compLangJA', wrap);
    const compGen = $('#compGen', wrap);
    const steps = $('#compSteps', wrap);
    const compDivider = $('#compDivider', wrap);
    const compFinish = $('#compFinish', wrap);
    const compHint = $('#compHint', wrap);

    // Enforce at least one language selected
    const langCheckboxes = [compLangEN, compLangZH, compLangJA];
    function enforceMinOneLang(e) {
      try {
        if (!langCheckboxes.some(cb => cb && cb.checked)) {
          // Re-check the toggled one back on
          const cb = e && e.target && e.target instanceof HTMLElement ? e.target : langCheckboxes[0];
          if (cb) cb.checked = true;
        }
      } catch (_) {}
    }
    langCheckboxes.forEach(cb => { try { cb.addEventListener('change', enforceMinOneLang); cb.addEventListener('change', updateTitlesUI); } catch(_){} });

    // Lock/unlock the top form after generating steps
    function setFormLocked(locked) {
      try {
        compKey.disabled = !!locked;
        compFilename.disabled = !!locked;
        if (compTitlesWrap) compTitlesWrap.querySelectorAll('input').forEach(inp => { try { inp.disabled = !!locked; } catch(_){} });
        compLangEN.disabled = !!locked;
        compLangZH.disabled = !!locked;
        compLangJA.disabled = !!locked;
        compGen.disabled = !!locked;
      } catch (_) {}
    }

    // Helper to flip top-right button label based on validation state
    function setCloseBtnReady(ready) {
      if (!btnClose) return;
      if (ready) { btnClose.textContent = 'Finish'; btnClose.setAttribute('aria-label', 'Finish'); }
      else { btnClose.textContent = 'Cancel'; btnClose.setAttribute('aria-label', 'Cancel'); }
    }

    // Show/hide Verify Setup button
    function setVerifyVisible(visible) {
      try {
        if (compFinish) {
          // Toggle both [hidden] and inline display to avoid being overridden by CSS
          compFinish.hidden = !visible;
          compFinish.style.display = visible ? '' : 'none';
        }
        if (compHint) {
          compHint.hidden = !visible;
          compHint.style.display = visible ? '' : 'none';
        }
      } catch (_) {}
    }
    // Hide Verify initially until steps are generated
    setVerifyVisible(false);

    // Show/hide steps and divider together
    function setStepsVisible(visible) {
      try {
        if (steps) steps.hidden = !visible;
        if (compDivider) compDivider.hidden = !visible;
      } catch(_) {}
    }

    // Reset wizard inputs and generated steps
    function resetWizard() {
      try {
        compKey.value = '';
        compFilename.value = 'main.md';
        // Clear stored titles and UI
        for (const k in titlesStore) { if (Object.prototype.hasOwnProperty.call(titlesStore, k)) delete titlesStore[k]; }
        if (compTitlesWrap) compTitlesWrap.innerHTML = '';
        compLangEN.checked = true;
        compLangZH.checked = false;
        compLangJA.checked = false;
        steps.innerHTML = '';
        steps.hidden = true;
        setFormLocked(false);
        setCloseBtnReady(false);
        setVerifyVisible(false);
        // Clear any bubble
        try { if (typeof hideKeyBubble === 'function') hideKeyBubble(); } catch(_) {}
        try { if (typeof hideTitleBubble === 'function') hideTitleBubble(); } catch(_) {}
      } catch (_) {}
    }

    // Close button: on Cancel -> reset, on Finish -> just close
    btnClose.addEventListener('click', () => {
      const label = (btnClose.textContent || '').trim().toLowerCase();
      if (label === 'cancel' || label === 'finish') {
        resetWizard();
      }
      closeModal();
    });

    // Read repo/contentRoot from previously loaded context
    const siteRepo = (window.__ns_site_repo) || {};
    const contentRoot = (window.__ns_content_root) || 'wwwroot';

    function buildGhNewLink(owner, repo, branch, folderPath, filename) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      // GitHub new file page for a folder; user can type filename there
      const clean = String(folderPath || '').replace(/^\/+/, '');
      const base = `https://github.com/${enc(owner)}/${enc(repo)}/new/${enc(branch)}/${clean}`;
      if (filename) return `${base}?filename=${enc(filename)}`;
      return base;
    }
    function buildGhEditFileLink(owner, repo, branch, filePath) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(filePath || '').replace(/^\/+/, '');
      return `https://github.com/${enc(owner)}/${enc(repo)}/edit/${enc(branch)}/${clean}`;
    }
    function buildGhBlobFileLink(owner, repo, branch, filePath) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(filePath || '').replace(/^\/+/, '');
      return `https://github.com/${enc(owner)}/${enc(repo)}/blob/${enc(branch)}/${clean}`;
    }
    function buildGhTreeLink(owner, repo, branch, folderPath) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(folderPath || '').replace(/^\/+/, '');
      return `https://github.com/${enc(owner)}/${enc(repo)}/tree/${enc(branch)}/${clean}`;
    }

    function getLangs() {
      const langs = [];
      if (compLangEN.checked) langs.push('en');
      if (compLangZH.checked) langs.push('zh');
      if (compLangJA.checked) langs.push('ja');
      // Unique and in preferred order if possible
      const set = Array.from(new Set(langs));
      return set.sort((a,b)=>{
        const ia = PREFERRED_LANG_ORDER.indexOf(a);
        const ib = PREFERRED_LANG_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.localeCompare(b);
      });
    }

    function safeKey(v){
      const s = String(v || '').trim();
      // allow letters, numbers, dash, underscore; must start with letter/number
      const ok = /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s);
      return ok ? s : '';
    }
    function safeFilename(v){
      let s = String(v || '').trim();
      if (!s) s = 'main.md';
      if (!/\.md$/i.test(s)) s = s + '.md';
      // collapse slashes, avoid leading slash
      s = s.replace(/\\+/g,'/').replace(/^\/+/, '');
      return s;
    }
    function withLangSuffix(fname, lang) {
      const s = safeFilename(fname);
      const i = s.lastIndexOf('.');
      if (i > 0) return s.slice(0, i) + '_' + String(lang || '').toLowerCase() + s.slice(i);
      return s + '_' + String(lang || '').toLowerCase() + '.md';
    }

    // use global helper

    function showKeyBubble(msg) {
      try {
        // Remove any existing bubble
        const existing = document.getElementById('compKeyBubble');
        if (existing && existing.parentElement) {
          try {
            dialog?.removeEventListener('scroll', existing.__reposition);
            window?.removeEventListener('resize', existing.__reposition);
          } catch(_) {}
          existing.remove();
        }
        const target = compKey;
        if (!target) return;
        const tip = document.createElement('div');
        tip.id = 'compKeyBubble';
        tip.className = 'comp-bubble is-floating';
        tip.role = 'alert';
        tip.textContent = msg || 'Please enter a valid key';
        // Attach to the modal overlay to avoid clipping by dialog overflow
        (modal || document.body).appendChild(tip);

        function position() {
          try {
            const rect = target.getBoundingClientRect();
            const bw = tip.offsetWidth;
            const bh = tip.offsetHeight;
            const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
            const margin = 8;
            let left = rect.left;
            let top = rect.top - bh - 10;
            // Clamp within viewport horizontally
            if (left + bw > vw - margin) left = vw - margin - bw;
            if (left < margin) left = margin;
            // If not enough space above, place below input
            if (top < margin) top = rect.bottom + 10;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
          } catch(_) {}
        }
        tip.style.position = 'fixed';
        tip.style.visibility = 'hidden';
        // Initial paint then position
        requestAnimationFrame(() => {
          position();
          tip.style.visibility = 'visible';
        });
        // Reposition on dialog scroll and window resize
        tip.__reposition = position;
        try { dialog?.addEventListener('scroll', position, { passive: true }); } catch(_) {}
        try { window?.addEventListener('resize', position, { passive: true }); } catch(_) {}
      } catch (_) {}
    }
    function hideKeyBubble() {
      try {
        const tip = document.getElementById('compKeyBubble');
        if (tip) {
          try {
            dialog?.removeEventListener('scroll', tip.__reposition);
            window?.removeEventListener('resize', tip.__reposition);
          } catch(_) {}
          tip.remove();
        }
      } catch(_) {}
    }

    // Floating bubble for missing tab titles, anchored to a specific input
    function showTitleBubble(targetInput, msg) {
      try {
        const existing = document.getElementById('compTitleBubble');
        if (existing && existing.parentElement) {
          try {
            dialog?.removeEventListener('scroll', existing.__reposition);
            window?.removeEventListener('resize', existing.__reposition);
          } catch(_) {}
          existing.remove();
        }
        if (!targetInput) return;
        const tip = document.createElement('div');
        tip.id = 'compTitleBubble';
        tip.className = 'comp-bubble is-floating';
        tip.role = 'alert';
        tip.textContent = msg || 'Please enter a title for this language';
        (modal || document.body).appendChild(tip);

        function position() {
          try {
            const rect = targetInput.getBoundingClientRect();
            const bw = tip.offsetWidth;
            const bh = tip.offsetHeight;
            const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
            const margin = 8;
            let left = rect.left;
            let top = rect.top - bh - 10;
            if (left + bw > vw - margin) left = vw - margin - bw;
            if (left < margin) left = margin;
            if (top < margin) top = rect.bottom + 10;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
          } catch(_) {}
        }
        tip.style.position = 'fixed';
        tip.style.visibility = 'hidden';
        requestAnimationFrame(() => { position(); tip.style.visibility = 'visible'; });
        tip.__reposition = position;
        try { dialog?.addEventListener('scroll', position, { passive: true }); } catch(_) {}
        try { window?.addEventListener('resize', position, { passive: true }); } catch(_) {}
      } catch(_) {}
    }
    function hideTitleBubble() {
      try {
        const tip = document.getElementById('compTitleBubble');
        if (tip) {
          try {
            dialog?.removeEventListener('scroll', tip.__reposition);
            window?.removeEventListener('resize', tip.__reposition);
          } catch(_) {}
          tip.remove();
        }
      } catch(_) {}
    }

  compKey.addEventListener('input', hideKeyBubble);
  try { compTitlesWrap?.addEventListener('input', hideTitleBubble); } catch(_) {}

    function renderSteps(){
      const key = safeKey(compKey.value);
      const fname = safeFilename(compFilename.value);
      const langs = getLangs();
      steps.innerHTML = '';
      if (!key) {
        // keep form interactive, do not lock; show floating bubble over the key input
        setStepsVisible(false);
        showKeyBubble('Please enter a valid key (letters/numbers/-/_).');
        setVerifyVisible(false);
        return;
      }
      const baseFolder = (compMode === 'tabs') ? 'tab' : 'post';
      const relFolder = `${baseFolder}/${key}`;
      const relFile = `${relFolder}/${fname}`;
      const fullFolder = `${contentRoot.replace(/\\+/g,'/').replace(/\/?$/, '')}/${relFolder}`;
      const ghOwner = siteRepo.owner || '';
      const ghName = siteRepo.name || '';
      const ghBranch = siteRepo.branch || 'main';
      const hasGh = !!(ghOwner && ghName);

      const frag = document.createDocumentFragment();
      const langMeta = (l) => {
        const code = String(l || '').toLowerCase();
        if (code === 'en') return { name: 'English', emoji: '🇺🇸' };
        if (code === 'zh') return { name: 'Chinese', emoji: '🇨🇳' };
        if (code === 'ja') return { name: 'Japanese', emoji: '🇯🇵' };
        return { name: code.toUpperCase(), emoji: '📝' };
      };
      const makeStep = (n, title, body) => {
        const div = document.createElement('div');
        div.className = 'comp-step';
        div.innerHTML = `<div class="num">${n}</div><div class="body"><div class="title">${title}</div></div>`;
        const bodyHost = div.querySelector('.body');
        if (body instanceof Node) bodyHost.appendChild(body);
        else if (typeof body === 'string') { const p = document.createElement('div'); p.className = 'desc'; p.textContent = body; bodyHost.appendChild(p); }
        frag.appendChild(div);
      };

      // Steps 1..N: per language, copy filename and open GitHub to create file
      let stepNum = 1;
      (langs.length ? langs : ['en']).forEach(lang => {
        const s = document.createElement('div'); s.className = 'kv';
        const p = document.createElement('p'); p.className = 'desc';
        p.textContent = 'Instructions: Click “Create File on GitHub” to open a new file with a pre-filled filename, paste your content, and commit the change.';
        const fnameLang = withLangSuffix(fname, lang);
        const actions = document.createElement('div'); actions.className = 'actions';
        const a1 = document.createElement('a'); a1.className = hasGh ? 'btn-secondary btn-github' : 'btn-secondary'; a1.target = '_blank'; a1.rel = 'noopener';
        if (hasGh) {
          // For index.yaml (posts) flow, prefill the editor with a front-matter template
          let href = buildGhNewLink(ghOwner, ghName, ghBranch, fullFolder, fnameLang);
          if (compMode !== 'tabs') {
            try { href += `&value=${encodeURIComponent(makeDefaultMdTemplate())}`; } catch(_) {}
          }
          a1.href = href;
        } else {
          a1.href = '#';
        }
        if (hasGh) {
          a1.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg><span class="btn-label">Create File</span>';
        } else {
          a1.textContent = 'No repo configured (site.yaml -> repo)';
        }
        actions.appendChild(a1);
        s.appendChild(p); s.appendChild(actions);
        const { name, emoji } = langMeta(lang);
        makeStep(stepNum, `Step ${stepNum} – Create ${name} File ${emoji}`, s);
        stepNum++;
      });
      // Final: Update index.yaml and commit on GitHub
      {
        const s = document.createElement('div'); s.className = 'kv';
        const p = document.createElement('p'); p.className = 'desc';
        const yamlName = (compMode === 'tabs') ? 'tabs.yaml' : 'index.yaml';
        p.textContent = `We will copy the YAML for you, then open ${yamlName} on GitHub. In the editor, select all and paste to replace, then commit.`;
        const actions = document.createElement('div'); actions.className = 'actions';
        const filePath = `${contentRoot.replace(/\\+/g,'/').replace(/\/?$/, '')}/${yamlName}`;
        const aEdit = document.createElement('a'); aEdit.className = hasGh ? 'btn-secondary btn-github' : 'btn-secondary'; aEdit.target = '_blank'; aEdit.rel = 'noopener';
        aEdit.href = hasGh ? buildGhEditFileLink(ghOwner, ghName, ghBranch, filePath) : '#';
        if (hasGh) {
          const label = (compMode === 'tabs') ? 'Edit tabs.yaml' : 'Edit index.yaml';
          aEdit.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg><span class="btn-label">' + label + '</span>';
        } else {
          aEdit.textContent = '—';
        }
        aEdit.title = 'We will copy YAML to your clipboard. On GitHub, select all and paste to replace, then commit.';
        // On click, auto-copy YAML draft to clipboard, then open GitHub edit page
        aEdit.addEventListener('click', async (e) => {
          if (!hasGh) return;
          try { e.preventDefault(); } catch(_) {}
          try {
            // Build a merged draft that includes current form entry even if not clicked "Add" button
            const keyDraft = safeKey(compKey.value);
            const fnameDraft = safeFilename(compFilename.value);
            const langsDraft = getLangs();
            const titlesMap = getTitlesMap();
            if (compMode === 'tabs') {
              const draft = {};
              Object.keys(state.tabs || {}).forEach(k => { if (k !== '__order') draft[k] = state.tabs[k]; });
              let order = Array.isArray(state.tabs.__order) ? state.tabs.__order.slice() : Object.keys(draft);
              if (keyDraft) {
                const entry = {};
                (langsDraft.length ? langsDraft : ['en']).forEach(l => {
                  const fLang = (typeof withLangSuffix === 'function') ? withLangSuffix(fnameDraft, l) : fnameDraft;
                  const t = String(titlesMap[l] || '').trim() || keyDraft;
                  entry[l] = { title: t, location: `tab/${keyDraft}/${fLang}` };
                });
                draft[keyDraft] = entry;
                const pos = order.indexOf(keyDraft);
                if (pos >= 0) order.splice(pos, 1);
                order.unshift(keyDraft);
              }
              draft.__order = order;
              const text = toTabsYaml(draft);
              try { nsCopyToClipboard(text); } catch(_) { /* ignore */ }
            } else {
              const draft = {};
              Object.keys(state.index || {}).forEach(k => { if (k !== '__order') draft[k] = state.index[k]; });
              let order = Array.isArray(state.index.__order) ? state.index.__order.slice() : Object.keys(draft);
              if (keyDraft) {
                const entry = {};
                (langsDraft.length ? langsDraft : ['en']).forEach(l => {
                  const fLang = (typeof withLangSuffix === 'function') ? withLangSuffix(fnameDraft, l) : fnameDraft;
                  entry[l] = `post/${keyDraft}/${fLang}`;
                });
                draft[keyDraft] = entry;
                const pos = order.indexOf(keyDraft);
                if (pos >= 0) order.splice(pos, 1);
                order.unshift(keyDraft);
              }
              draft.__order = order;
              const text = toIndexYaml(draft);
              try { nsCopyToClipboard(text); } catch(_) { /* ignore */ }
            }
          } catch(_) { /* ignore */ }
          try { window.open(aEdit.href, '_blank', 'noopener'); } catch(_) { location.href = aEdit.href; }
        });
        actions.appendChild(aEdit);
        s.appendChild(p);
        s.appendChild(actions);
        makeStep(stepNum, (compMode === 'tabs') ? `Step ${stepNum} – Update Tabs Index 📑` : `Step ${stepNum} – Update Post Index 📑`, s);
      }
      steps.appendChild(frag);
      setStepsVisible(true);
      setVerifyVisible(true);
      // steps generated

      // Bind copy buttons
      steps.querySelectorAll('button[data-copy]')?.forEach(btn => {
        btn.addEventListener('click', () => nsCopyToClipboard(btn.getAttribute('data-copy')));
      });
    }

    compGen.addEventListener('click', async () => {
      // Clear any previous bubble
      try { if (typeof hideKeyBubble === 'function') hideKeyBubble(); } catch(_) {}

      const key = safeKey(compKey.value);
      const fname = safeFilename(compFilename.value);
      const langs = getLangs();
      const mode = (function(){ try { return ($('#composerIndex').style.display !== 'none') ? 'index' : 'tabs'; } catch(_) { return 'index'; } })();
      const rootNorm = (contentRoot || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');

      // Invalid or empty key -> show bubble and do not proceed
      if (!key) {
        steps.innerHTML = '';
        setStepsVisible(false);
        setVerifyVisible(false);
        setFormLocked(false);
        showKeyBubble('Please enter a valid key (letters/numbers/-/_).');
        try { wrap.querySelector('#compKey')?.focus(); } catch(_) {}
        return;
      }

      // Duplicate key in existing YAML -> show bubble and block
      try {
        const coll = (mode === 'tabs') ? state.tabs : state.index;
        if (coll && Object.prototype.hasOwnProperty.call(coll, key)) {
          steps.innerHTML = '';
          setStepsVisible(false);
          setVerifyVisible(false);
          setFormLocked(false);
          showKeyBubble(mode === 'tabs' ? 'This key already exists in tabs.yaml. Please choose a new key.' : 'This key already exists in index.yaml. Please choose a new key.');
          try { wrap.querySelector('#compKey')?.focus(); } catch(_) {}
          return;
        }
      } catch(_) {}

      // In tabs mode, require non-empty titles for all selected languages
      if (mode === 'tabs') {
        try {
          const langsList = (langs.length ? langs : ['en']);
          let missing = '';
          let target = null;
          for (const l of langsList) {
            const inp = compTitlesWrap?.querySelector(`input[data-lang="${l}"]`);
            const val = String((inp && inp.value) || '').trim();
            if (!val) { missing = l; target = inp; break; }
          }
          if (missing) {
            steps.innerHTML = '';
            setStepsVisible(false);
            setVerifyVisible(false);
            setFormLocked(false);
            showTitleBubble(target, `Please enter the title for ${missing.toUpperCase()}.`);
            try { target?.focus(); } catch(_) {}
            return;
          }
        } catch(_) {}
      }

      // Check if any target file already exists -> show bubble and block
      const baseFolder = (mode === 'tabs') ? 'tab' : 'post';
      const relFolder = `${baseFolder}/${key}`;
      let existingPath = '';
      try {
        const langList = (langs.length ? langs : ['en']);
        for (const lang of langList) {
          const fLang = withLangSuffix(fname, lang);
          const url = `${rootNorm}/${relFolder}/${fLang}`;
          try {
            const r = await fetch(url, { cache: 'no-store' });
            if (r && r.ok) { existingPath = `${relFolder}/${fLang}`; break; }
          } catch(_) { /* ignore fetch errors here */ }
        }
      } catch(_) {}
      if (existingPath) {
        steps.innerHTML = '';
        setStepsVisible(false);
        setVerifyVisible(false);
        setFormLocked(false);
        showKeyBubble(`File already exists: ${existingPath}. Choose a different key or filename.`);
        try { wrap.querySelector('#compKey')?.focus(); } catch(_) {}
        return;
      }

      // All good -> render steps and lock form
      renderSteps();
      if (safeKey(compKey.value)) setFormLocked(true); else setFormLocked(false);
    });
    // Validate created files and index.yaml before closing
    compFinish.addEventListener('click', async () => {
      if (compFinish.disabled) return;
      const prevText = compFinish.textContent;
      try {
        compFinish.disabled = true;
        compFinish.textContent = 'Verifying…';
        compFinish.setAttribute('aria-busy', 'true');
      } catch (_) {}
      // Ensure steps are rendered so we can annotate results
      if (!steps || steps.children.length === 0 || steps.hidden) {
        renderSteps();
      }

      const key = safeKey(compKey.value);
      const fname = safeFilename(compFilename.value);
      const langs = getLangs();
      const mode = (function(){ try { return ($('#composerIndex').style.display !== 'none') ? 'index' : 'tabs'; } catch(_) { return 'index'; } })();
      const relFolder = key ? `${mode === 'tabs' ? 'tab' : 'post'}/${key}` : '';
      const rootNorm = (contentRoot || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');

      const stepEls = Array.from(steps.querySelectorAll('.comp-step'));

      function setStepStatus(el, ok, msg) {
        if (!el) return;
        el.classList.remove('ok', 'err');
        const host = el.querySelector('.body') || el;
        // remove any existing status areas inside this card
        const oldWarn = el.querySelector('.comp-warn'); if (oldWarn) oldWarn.remove();
        const oldOk = el.querySelector('.comp-ok'); if (oldOk) oldOk.remove();
        const s = el.querySelector('.comp-status'); if (s) s.remove();

        if (ok) {
          // create success note section inside the card at bottom
          const okBox = document.createElement('div');
          okBox.className = 'comp-ok';
          const p = document.createElement('div');
          p.className = 'comp-ok-text';
          p.textContent = msg || 'OK';
          okBox.appendChild(p);
          el.appendChild(okBox);
          el.classList.add('ok');
        } else {
          // create warning section inside the card at bottom
          const warn = document.createElement('div');
          warn.className = 'comp-warn';
          const p = document.createElement('div');
          p.className = 'comp-warn-text';
          p.textContent = msg || 'Validation failed';
          warn.appendChild(p);
          el.appendChild(warn);
          el.classList.add('err');
        }
      }

      // Clear previous statuses
      stepEls.forEach(el => {
        el.classList.remove('ok', 'err');
        const s = el.querySelector('.comp-status'); if (s) s.remove();
        const w = el.querySelector('.comp-warn'); if (w) w.remove();
        const o = el.querySelector('.comp-ok'); if (o) o.remove();
      });

      let hadError = false;

      // Check each language file existence
      const langList = (langs.length ? langs : ['en']);
      await Promise.all(langList.map(async (lang, idx) => {
        const fLang = withLangSuffix(fname, lang);
        const fileRel = `${relFolder}/${fLang}`;
        const url = `${rootNorm}/${fileRel}`;
        const stepEl = stepEls[idx];
        if (!key) {
          hadError = true;
          setStepStatus(stepEl, false, 'Invalid key. Please enter a valid key.');
          return;
        }
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) {
            hadError = true;
            setStepStatus(stepEl, false, `File not found: ${url}`);
          } else {
            setStepStatus(stepEl, true, `Found: ${fileRel}`);
          }
        } catch (e) {
          hadError = true;
          setStepStatus(stepEl, false, `Cannot access: ${url}`);
        }
      }));

      // Check index.yaml/tabs.yaml content
      const yamlStepEl = stepEls[langList.length];
      try {
        const baseName = (mode === 'tabs') ? 'tabs' : 'index';
        const idxObj = await fetchConfigWithYamlFallback([
          `${rootNorm}/${baseName}.yaml`, `${rootNorm}/${baseName}.yml`
        ]);
        let yamlOk = true;
        let msg = '';
        if (!key) {
          yamlOk = false; msg = 'Invalid key';
        } else if (!idxObj || typeof idxObj !== 'object' || !idxObj[key]) {
          yamlOk = false; msg = `${baseName}.yaml missing key: ${key}`;
        } else {
          if (mode === 'tabs') {
            for (const lang of langList) {
              const expected = `${relFolder}/${withLangSuffix(fname, lang)}`;
              const val = idxObj[key][lang];
              if (!val || typeof val !== 'object') { yamlOk = false; msg = `Language ${lang} entry missing`; break; }
              if (String(val.location || '') !== expected) { yamlOk = false; msg = `Language ${lang} location mismatch. Expected: ${expected}`; break; }
              const titleStr = String(val.title ?? '').trim();
              if (!titleStr) { yamlOk = false; msg = `Language ${lang} title missing`; break; }
            }
          } else {
            for (const lang of langList) {
              const expected = `${relFolder}/${withLangSuffix(fname, lang)}`;
              const val = idxObj[key][lang];
              if (Array.isArray(val)) {
                if (!val.includes(expected)) { yamlOk = false; msg = `Language ${lang} missing path: ${expected}`; break; }
              } else if (typeof val === 'string') {
                if (val !== expected) { yamlOk = false; msg = `Language ${lang} path mismatch. Expected: ${expected}`; break; }
              } else {
                yamlOk = false; msg = `Language ${lang} path not set`; break;
              }
            }
          }
        }
        if (!yamlOk) { hadError = true; setStepStatus(yamlStepEl, false, msg || `${baseName}.yaml validation failed`); }
        else { setStepStatus(yamlStepEl, true, `${baseName}.yaml validated`); }
      } catch (e) {
        hadError = true;
        const baseName = (mode === 'tabs') ? 'tabs' : 'index';
        setStepStatus(yamlStepEl, false, `${baseName}.yaml read failed`);
      }

      if (!hadError) {
        // Verification passed: flip close button to Finish
        setCloseBtnReady(true);
      } else {
        // Verification failed: keep close button as Cancel
        setCloseBtnReady(false);
        // Focus first error section for convenience
        const firstErr = steps.querySelector('.comp-warn');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      try {} finally {
        try {
          compFinish.disabled = false;
          compFinish.textContent = prevText || 'Verify Setup';
          compFinish.removeAttribute('aria-busy');
        } catch (_) {}
      }
    });
  })();

  // Add item (Post or Tab) -> open unified composer wizard
  $('#btnAddItem').addEventListener('click', () => {
    const modal = document.getElementById('compModal');
    if (modal && typeof modal.__open === 'function') modal.__open();
  });

  // Verify Setup: check all referenced files exist; if ok, check YAML drift
  (function bindVerifySetup(){
    const btn = document.getElementById('btnVerify');
    if (!btn) return;
    const btnLabel = btn.querySelector('.btn-label');

    // Minimal toast utility for this page
    function ensureToastRoot(){
      let r = document.getElementById('toast-root');
      if (!r) { r = document.createElement('div'); r.id = 'toast-root'; r.style.position='fixed'; r.style.top='14px'; r.style.right='14px'; r.style.zIndex='10000'; document.body.appendChild(r); }
      return r;
    }
    function showToast(kind, text){
      try {
        const root = ensureToastRoot();
        const el = document.createElement('div');
        el.className = `toast ${kind||''}`;
        el.textContent = text || '';
        // light styles if global theme lacks toast
        el.style.background = 'color-mix(in srgb, var(--text) 8%, var(--card))';
        el.style.color = 'var(--text)';
        el.style.border = '1px solid var(--border)';
        el.style.borderRadius = '8px';
        el.style.padding = '.45rem .7rem';
        el.style.boxShadow = 'var(--shadow)';
        el.style.marginTop = '.35rem';
        el.style.transition = 'opacity .3s ease';
        root.appendChild(el);
        setTimeout(()=>{ el.style.opacity='0'; }, 2000);
        setTimeout(()=>{ try { el.remove(); } catch(_) {} }, 2400);
      } catch(_) { try { alert(text); } catch(_) {} }
    }

    // Helper: extract version segment like v1.2.3 from a path
    function extractVersion(p){
      try { const m = String(p||'').match(/(?:^|\/)v\d+(?:\.\d+)*(?=\/|$)/i); return m ? m[0].split('/').pop() : ''; } catch(_) { return ''; }
    }
    function dirname(p){ try { const s=String(p||''); const i=s.lastIndexOf('/'); return i>=0? s.slice(0,i) : ''; } catch(_) { return ''; } }
    function basename(p){ try { const s=String(p||''); const i=s.lastIndexOf('/'); return i>=0? s.slice(i+1) : s; } catch(_) { return String(p||''); } }
    function uniq(arr){ return Array.from(new Set(arr||[])); }

    function buildGhNewLink(owner, repo, branch, folderPath, filename) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(folderPath || '').replace(/^\/+/, '');
      const base = `https://github.com/${enc(owner)}/${enc(repo)}/new/${enc(branch)}/${clean}`;
      if (filename) return `${base}?filename=${enc(filename)}`;
      return base;
    }
    function buildGhEditFileLink(owner, repo, branch, filePath) {
      const enc = (s) => encodeURIComponent(String(s || ''));
      const clean = String(filePath || '').replace(/^\/+/, '');
      return `https://github.com/${enc(owner)}/${enc(repo)}/edit/${enc(branch)}/${clean}`;
    }

    function getActiveCFile(){
      try {
        const a = document.querySelector('a.vt-btn[data-cfile].active');
        const t = a && a.dataset && a.dataset.cfile;
        return t === 'tabs' ? 'tabs' : 'index';
      } catch (_) { return 'index'; }
    }

    async function computeMissingFiles(){
      const contentRoot = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
      const out = [];
      const target = getActiveCFile();
      // Fetch existence in parallel batches
      const tasks = [];
      if (target === 'tabs') {
        const tbs = state.tabs || {};
        const keys = Object.keys(tbs).filter(k => k !== '__order');
        for (const key of keys){
          const langsObj = tbs[key] || {};
          const langs = sortLangKeys(langsObj);
          for (const lang of langs){
            const obj = langsObj[lang];
            const rel = obj && typeof obj === 'object' ? obj.location : '';
            if (!rel) continue; // skip empty
            const url = `${contentRoot}/${String(rel||'')}`;
            tasks.push((async () => {
              try {
                const r = await fetch(url, { cache: 'no-store' });
                if (!r || !r.ok) {
                  out.push({ key, lang, path: rel, version: extractVersion(rel), folder: dirname(rel), filename: basename(rel) });
                }
              } catch(_) { out.push({ key, lang, path: rel, version: extractVersion(rel), folder: dirname(rel), filename: basename(rel) }); }
            })());
          }
        }
      } else {
        const idx = state.index || {};
        const keys = Object.keys(idx).filter(k => k !== '__order');
        for (const key of keys){
          const langsObj = idx[key] || {};
          const langs = sortLangKeys(langsObj);
          for (const lang of langs){
            const val = langsObj[lang];
            const paths = Array.isArray(val) ? val.slice() : (typeof val === 'string' ? [val] : []);
            for (const rel of paths){
              const url = `${contentRoot}/${String(rel||'')}`;
              tasks.push((async () => {
                try {
                  const r = await fetch(url, { cache: 'no-store' });
                  if (!r || !r.ok) {
                    out.push({ key, lang, path: rel, version: extractVersion(rel), folder: dirname(rel), filename: basename(rel) });
                  }
                } catch(_) { out.push({ key, lang, path: rel, version: extractVersion(rel), folder: dirname(rel), filename: basename(rel) }); }
              })());
            }
          }
        }
      }
      await Promise.all(tasks);
      return out;
    }

    function openVerifyModal(missing){
      // Build modal
      const modal = document.createElement('div');
      modal.className = 'ns-modal'; modal.setAttribute('aria-hidden', 'true');
      const dialog = document.createElement('div'); dialog.className = 'ns-modal-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
      const head = document.createElement('div'); head.className = 'comp-guide-head';
      const left = document.createElement('div'); left.className='comp-head-left';
      const title = document.createElement('strong'); title.textContent = 'Verify Setup – Missing Files'; title.id='verifyTitle';
      const sub = document.createElement('span'); sub.className='muted'; sub.textContent = 'Create missing files on GitHub, then Verify again';
      left.appendChild(title); left.appendChild(sub);
      const btnClose = document.createElement('button'); btnClose.className = 'ns-modal-close btn-secondary'; btnClose.type = 'button'; btnClose.textContent = 'Cancel'; btnClose.setAttribute('aria-label','Cancel');
      head.appendChild(left); head.appendChild(btnClose);
      dialog.appendChild(head);

      const body = document.createElement('div'); body.className = 'comp-guide';
      const listWrap = document.createElement('div'); listWrap.style.margin = '.4rem 0';

      function renderList(items){
        listWrap.innerHTML = '';
        if (!items || !items.length){
          const p = document.createElement('p'); p.textContent = 'All files are present.'; listWrap.appendChild(p); return;
        }
        // Group: key -> lang -> entries
        const byKey = new Map();
        for (const it of items){
          if (!byKey.has(it.key)) byKey.set(it.key, new Map());
          const g = byKey.get(it.key);
          if (!g.has(it.lang)) g.set(it.lang, []);
          g.get(it.lang).push(it);
        }
        // Render groups
        for (const [key, g] of byKey.entries()){
          const sec = document.createElement('section');
          sec.style.border='1px solid var(--border)';
          sec.style.borderRadius='8px';
          sec.style.padding='.5rem';
          sec.style.margin='.5rem 0';
          sec.style.background='var(--card)';
          // Emphasize error groups with a subtle red border
          sec.style.borderColor = '#fecaca';
          const h = document.createElement('div'); h.style.display='flex'; h.style.alignItems='center'; h.style.gap='.5rem';
          const title = document.createElement('strong'); title.textContent = key; h.appendChild(title);
          // Badges
          const meta = document.createElement('span'); meta.className='summary-badges';
          const langs = Array.from(g.keys()); if (langs.length){ const b=document.createElement('span'); b.className='badge badge-lang'; b.textContent = langs.map(x=>String(x).toUpperCase()).join(' '); meta.appendChild(b); }
          h.appendChild(meta);
          sec.appendChild(h);
          for (const [lang, arr] of g.entries()){
            const langBox = document.createElement('div'); langBox.className='ci-lang';
            const lh = document.createElement('div'); lh.className='ci-lang-head';
            const lab = document.createElement('span'); lab.textContent = `Language: ${String(lang).toUpperCase()}`; lh.appendChild(lab);
            langBox.appendChild(lh);
            arr.sort((a,b)=>{
              const av = a.version || ''; const bv = b.version || '';
              if (av && bv && av!==bv){
                // compare version desc
                const vp = (v)=>String(v||'').replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0);
                const aa=vp(av), bb=vp(bv); const L=Math.max(aa.length, bb.length);
                for (let i=0;i<L;i++){ const x=aa[i]||0, y=bb[i]||0; if (x!==y) return y-x; }
              }
              return String(a.path).localeCompare(String(b.path));
            });
            for (const it of arr){
              const row = document.createElement('div'); row.className='ci-ver-item';
              const badge = document.createElement('span'); badge.className='badge badge-ver'; badge.textContent = it.version ? it.version : '—'; row.appendChild(badge);
              const p = document.createElement('code'); p.textContent = it.path; p.style.flex='1 1 auto'; row.appendChild(p);
              const actions = document.createElement('div'); actions.className='ci-ver-actions'; actions.style.display='inline-flex'; actions.style.gap='.35rem';
              const siteRepo = window.__ns_site_repo || {}; const root = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
              const aNew = document.createElement('a');
              const canGh = !!(siteRepo.owner && siteRepo.name);
              aNew.className = canGh ? 'btn-secondary btn-github' : 'btn-secondary'; aNew.target='_blank'; aNew.rel='noopener';
              if (canGh) {
                aNew.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg><span class="btn-label">Create File</span>';
              } else {
                aNew.textContent = 'Create File';
              }
              // For missing files under post/..., prefill with default front-matter
              if (canGh) {
                let href = buildGhNewLink(siteRepo.owner, siteRepo.name, siteRepo.branch||'main', `${root}/${it.folder}`, it.filename);
                try {
                  if (String(it.folder || '').replace(/^\/+/, '').startsWith('post/')) {
                    const ver = it && it.version ? String(it.version) : '';
                    href += `&value=${encodeURIComponent(makeDefaultMdTemplate(ver ? { version: ver } : undefined))}`;
                  }
                } catch(_) {}
                aNew.href = href;
              } else {
                aNew.href = '#';
              }
              aNew.title = 'Open GitHub new file page with prefilled filename';
              actions.appendChild(aNew);
              row.appendChild(actions);
              langBox.appendChild(row);
            }
            sec.appendChild(langBox);
          }
          // Card-bottom red banner like the new post wizard
          const groupCount = Array.from(g.values()).reduce((acc,arr)=>acc + (Array.isArray(arr)?arr.length:0), 0);
          const warn = document.createElement('div'); warn.className='comp-warn';
          const wt = document.createElement('div'); wt.className='comp-warn-text';
          wt.textContent = `${groupCount} missing item(s) remain for this key. Create the files above on GitHub, then Verify again.`;
          warn.appendChild(wt);
          sec.appendChild(warn);
          listWrap.appendChild(sec);
        }
      }

      renderList(missing);

      body.appendChild(listWrap);
      dialog.appendChild(body);
      const foot = document.createElement('div'); foot.style.display='flex'; foot.style.justifyContent='flex-end'; foot.style.gap='.5rem'; foot.style.marginTop='.5rem';
      const btnVerify = document.createElement('button'); btnVerify.className='btn-primary'; btnVerify.textContent='Verify';
      foot.appendChild(btnVerify);
      dialog.appendChild(foot);
      modal.appendChild(dialog);
      document.body.appendChild(modal);

      function open(){
        const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
        try { modal.classList.remove('ns-anim-out'); } catch(_) {}
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden','false');
        document.body.classList.add('ns-modal-open');
        if (!reduce) {
          try {
            modal.classList.add('ns-anim-in');
            const onEnd = () => { try { modal.classList.remove('ns-anim-in'); } catch(_) {}; dialog.removeEventListener('animationend', onEnd); };
            dialog.addEventListener('animationend', onEnd, { once: true });
          } catch(_) {}
        }
      }
      function close(){
        const reduce = (function(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(_) { return false; } })();
        const done = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('ns-modal-open'); try { modal.remove(); } catch(_) {} };
        if (reduce) { done(); return; }
        try { modal.classList.remove('ns-anim-in'); } catch(_) {}
        try { modal.classList.add('ns-anim-out'); } catch(_) {}
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); try { modal.classList.remove('ns-anim-out'); } catch(_) {}; done(); };
        try {
          dialog.addEventListener('animationend', onEnd, { once: true });
          setTimeout(onEnd, 200);
        } catch(_) { onEnd(); }
      }

      btnClose.addEventListener('click', close);
      modal.addEventListener('mousedown', (e)=>{ if (e.target === modal) close(); });
      modal.addEventListener('keydown', (e)=>{ if ((e.key||'').toLowerCase()==='escape') close(); });
      btnVerify.addEventListener('click', async ()=>{
        btnVerify.disabled = true; btnVerify.textContent = 'Verifying…';
        try {
          // Also copy YAML snapshot here to leverage the user gesture
          try {
            const target = (function(){ try { const a=document.querySelector('a.vt-btn[data-cfile].active'); return (a&&a.dataset&&a.dataset.cfile)==='tabs'?'tabs':'index'; } catch(_){ return 'index'; } })();
            const text = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
            nsCopyToClipboard(text);
          } catch(_) {}
          const now = await computeMissingFiles();
          if (!now.length){ close(); await afterAllGood(); }
          else { renderList(now); /* no toast: inline red banner shows status */ }
        } finally {
          try { btnVerify.disabled = false; btnVerify.textContent = 'Verify'; } catch(_) {}
        }
      });

      open();
    }

    async function afterAllGood(){
      // Compare current in-memory YAML vs remote file; open GitHub edit if differs
      const contentRoot = (window.__ns_content_root || 'wwwroot').replace(/\\+/g,'/').replace(/\/?$/, '');
      const target = getActiveCFile();
      const desired = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
      async function fetchText(url){ try { const r = await fetch(url, { cache: 'no-store' }); if (r && r.ok) return await r.text(); } catch(_){} return ''; }
      const baseName = target === 'tabs' ? 'tabs' : 'index';
      const url1 = `${contentRoot}/${baseName}.yaml`; const url2 = `${contentRoot}/${baseName}.yml`;
      const cur = (await fetchText(url1)) || (await fetchText(url2));
      const norm = (s)=>String(s||'').replace(/\r\n/g,'\n').trim();
      if (norm(cur) === norm(desired)) { showToast('success', `${baseName}.yaml is up to date`); return; }
      // Need update -> copy and open GitHub edit/new page
      try { nsCopyToClipboard(desired); } catch(_) {}
      const siteRepo = window.__ns_site_repo || {}; const owner = siteRepo.owner||''; const name = siteRepo.name||''; const branch = siteRepo.branch||'main';
      if (owner && name){
        let href = '';
        if (cur) href = buildGhEditFileLink(owner, name, branch, `${contentRoot}/${baseName}.yaml`);
        else href = buildGhNewLink(owner, name, branch, `${contentRoot}`, `${baseName}.yaml`);
        try { window.open(href, '_blank', 'noopener'); } catch(_) { location.href = href; }
      } else {
        showToast('info', 'YAML copied. Configure repo in site.yaml to open GitHub.');
      }
    }

    btn.addEventListener('click', async () => {
      // Perform first pass; if any missing, show modal list; otherwise go to YAML check
      try {
        btn.disabled = true;
        if (btnLabel) btnLabel.textContent = 'Verifying…'; else btn.textContent = 'Verifying…';
      } catch(_) {}
      try {
        // Copy YAML snapshot up-front to retain user-activation for clipboard
        try {
          const target = getActiveCFile();
          const text = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
          nsCopyToClipboard(text);
        } catch(_) {}
        const missing = await computeMissingFiles();
        if (missing.length) openVerifyModal(missing);
        else await afterAllGood();
      } finally {
        try {
          btn.disabled = false;
          // Restore original label
          if (btnLabel) btnLabel.textContent = 'Synchronize'; else btn.textContent = 'Synchronize';
        } catch(_) {}
      }
    });
  })();
}

function showStatus(msg) { const el = $('#composerStatus'); if (el) el.textContent = msg || ''; }

document.addEventListener('DOMContentLoaded', async () => {
  const state = { index: {}, tabs: {} };
  showStatus('Loading config…');
  try {
    const site = await fetchConfigWithYamlFallback(['site.yaml', 'site.yml']);
    const root = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
    window.__ns_content_root = root; // hint for other utils
    try {
      const repo = (site && site.repo) || {};
      window.__ns_site_repo = { owner: String(repo.owner || ''), name: String(repo.name || ''), branch: String(repo.branch || 'main') };
    } catch(_) { window.__ns_site_repo = { owner: '', name: '', branch: 'main' }; }
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
  .ci-body,.ct-body{padding:0 .6rem;}
  .ci-body.is-open,.ct-body.is-open{padding:.5rem .6rem;}
  .ci-body-inner,.ct-body-inner{overflow:hidden;max-height:0;opacity:0;transition:max-height 480ms cubic-bezier(.45,0,.25,1),opacity 480ms cubic-bezier(.45,0,.25,1)}
  .ci-body.is-open .ci-body-inner,.ct-body.is-open .ct-body-inner{max-height:2000px;opacity:1;overflow:visible}
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
  /* Add Language row: compact button, keep menu aligned to trigger width */
  .ci-add-lang,.ct-add-lang{display:inline-flex;align-items:center;gap:.5rem;margin-top:.5rem;position:relative}
  .ci-add-lang .btn-secondary,.ct-add-lang .btn-secondary{justify-content:center;border-bottom:0 !important}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang select,.ct-add-lang select{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .has-menu{overflow:visible}
  .has-menu.is-open{z-index:100}
  /* Button when open looks attached to menu */
  .ci-add-lang .btn-secondary.is-open,.ct-add-lang .btn-secondary.is-open{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb, var(--text) 5%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border));border-bottom:0 !important}
  /* Custom menu popup */
  .ns-menu{position:absolute;top:calc(100% - 1px);left:0;right:auto;z-index:101;border:1px solid var(--border);background:var(--card);box-shadow:var(--shadow);width:100%;min-width:0;border-top:none;border-bottom-left-radius:8px;border-bottom-right-radius:8px;border-top-left-radius:0;border-top-right-radius:0;transform-origin: top left;}
  .has-menu.is-open > .ns-menu{animation: ns-menu-in 160ms ease-out both}
  @keyframes ns-menu-in{from{opacity:0; transform: translateY(-4px) scale(0.98);} to{opacity:1; transform: translateY(0) scale(1);} }
  /* Closing animation */
  .ns-menu.is-closing{animation: ns-menu-out 130ms ease-in both !important}
  @keyframes ns-menu-out{from{opacity:1; transform: translateY(0) scale(1);} to{opacity:0; transform: translateY(-4px) scale(0.98);} }
  .ns-menu .ns-menu-item{display:block;width:100%;text-align:left;background:transparent;color:var(--text);border:0 !important;border-bottom:0 !important;padding:.4rem .6rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Only draw a single divider: use top border on following items */
  .ns-menu .ns-menu-item + .ns-menu-item{border-top:1px solid color-mix(in srgb, var(--text) 16%, var(--border))}
  .ns-menu .ns-menu-item:hover{background:color-mix(in srgb, var(--text) 6%, var(--card))}
  /* Make selects look like secondary buttons */
  .btn-like-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding:.45rem .8rem;height:2.25rem;line-height:1}
  .btn-like-select:focus-visible{outline:2px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset:2px}
  .dragging{opacity:.96}
  .drag-placeholder{border:1px dashed var(--border);border-radius:8px;background:transparent}
  .is-dragging-list{touch-action:none}
  body.ns-noselect{user-select:none;cursor:grabbing}
  /* Simple badges for verify modal */
  .badge{display:inline-flex;align-items:center;gap:.25rem;border:1px solid var(--border);background:var(--card);color:var(--muted);font-size:.72rem;padding:.05rem .4rem;border-radius:999px}
  .badge-ver{ color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  .badge-lang{}
  /* Caret arrow for Details buttons */
  .ci-expand .caret,.ct-expand .caret{display:inline-block;width:0;height:0;border-style:solid;border-width:5px 0 5px 7px;border-color:transparent transparent transparent currentColor;margin-right:.35rem;transform:rotate(0deg);transform-origin:50% 50%;transition:transform 480ms cubic-bezier(.45,0,.25,1)}
  .ci-expand[aria-expanded="true"] .caret,.ct-expand[aria-expanded="true"] .caret{transform:rotate(90deg)}
  @media (prefers-reduced-motion: reduce){
    .ci-body-inner,.ct-body-inner{transition:none}
    .ci-expand .caret,.ct-expand .caret{transition:none}
  }
  /* Composer Guide */
  .comp-guide{border:1px dashed var(--border);border-radius:8px;background:color-mix(in srgb, var(--text) 3%, transparent);padding:.6rem .6rem .2rem;margin:.6rem 0 .8rem}
  .comp-guide-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .comp-guide-head .muted{color:var(--muted);font-size:.88rem}
  /* Titlebar-like header inside modal */
  .ns-modal-dialog .comp-guide-head{
    display:flex;align-items:center;justify-content:space-between;gap:.6rem;
    background: color-mix(in srgb, var(--text) 6%, var(--card));
    border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
    /* Pull to dialog edges to resemble an app title bar */
    /* Remove top gap by not offsetting beyond dialog top */
    margin: 0 -.85rem .9rem;
    padding: .65rem .85rem;
    border-top-left-radius: 12px; border-top-right-radius: 12px;
    position: sticky; top: 0; z-index: 2;
  }
  .ns-modal-dialog .comp-head-left{display:flex;align-items:baseline;gap:.6rem;min-width:0}
  .ns-modal-dialog .comp-guide-head strong{font-weight:700}
  .ns-modal-dialog .comp-guide-head .muted{opacity:.9}
  .comp-form{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;align-items:end;margin-bottom:.5rem}
  .comp-form label{display:flex;flex-direction:column;gap:.25rem;font-weight:600}
  .comp-form label{position:relative}
  .comp-form input[type=text]{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .comp-langs{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .comp-langs .lab{font-weight:600; margin-right:.25rem}
  .comp-langs label{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border);border-radius:999px;padding:.18rem .5rem;background:var(--card);color:var(--text);cursor:pointer;user-select:none}
  .comp-langs label:hover{background:color-mix(in srgb, var(--text) 5%, transparent)}
  .comp-langs label input{display:none}
  .comp-langs label:has(input:checked){background:color-mix(in srgb, var(--primary) 16%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border))}
  .comp-langs label span{font-weight:400;font-size:.85rem}
  /* Disabled states for form + language chips */
  .comp-form input[disabled]{opacity:.6;cursor:not-allowed;background:color-mix(in srgb, var(--text) 4%, var(--card))}
  .comp-langs label:has(input[disabled]){opacity:.5;cursor:not-allowed;pointer-events:none}
  .comp-langs label:has(input[disabled]):hover{background:var(--card)}
  /* Floating bubble over inputs */
  .comp-bubble{position:absolute;bottom:calc(100% + 6px);left:0;z-index:3;padding:.28rem .5rem;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;font-size:.88rem;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.05);max-width:min(72vw,560px);pointer-events:none}
  .comp-bubble::after{content:'';position:absolute;top:100%;left:14px;border-width:6px;border-style:solid;border-color:#fee2e2 transparent transparent transparent}
  /* Floating variant appended to modal to avoid clipping */
  .comp-bubble.is-floating{position:fixed;z-index:100000;bottom:auto;left:auto}
  .comp-actions{display:flex;gap:.5rem;}
  .comp-steps{margin-top:.25rem}
  /* Divider between form and steps */
  .comp-divider{height:1px;background:var(--border);opacity:.8;margin:1.5rem 0}
  .comp-step{display:grid;grid-template-columns:1.6rem 1fr;column-gap:.6rem;align-items:start;margin:.4rem 0;padding:.4rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
  .comp-step > .num{grid-column:1}
  .comp-step > .body{grid-column:2}
  .comp-step > .comp-warn{grid-column:1 / -1}
  .comp-step > .comp-ok{grid-column:1 / -1}
  .comp-step .num{flex:0 0 auto;width:1.6rem;height:1.6rem;border-radius:999px;background:color-mix(in srgb, var(--primary) 14%, var(--card));border:1px solid color-mix(in srgb, var(--primary) 36%, var(--border));display:grid;place-items:center;font-weight:700;color:var(--text)}
  .comp-step .title{font-weight:700;margin-bottom:.15rem}
  .comp-step .desc{color:var(--muted);font-size:.92rem;margin:.1rem 0}
  .comp-step .actions{display:flex;gap:.4rem;margin-top:.25rem}
  .comp-step code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Ubuntu Mono', monospace; background: color-mix(in srgb, var(--text) 10%, transparent); padding: .08rem .35rem; border-radius: 6px; font-size: .9em;}
  /* Footer hint next to Verify */
  .comp-footer .comp-hint{color:var(--muted);font-size:.9rem;align-self:center}
  /* Validation status */
  .comp-step.ok{border-color: color-mix(in srgb, #16a34a 60%, var(--border));}
  .comp-step.err{border-color: color-mix(in srgb, #dc2626 60%, var(--border));}
  .comp-status{margin-top:.2rem;font-size:.9rem;color:var(--muted)}
  .comp-status[data-state="ok"]{color:#16a34a}
  /* Warning area at card bottom */
  .comp-warn{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #fecaca; background:#fee2e2; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#7f1d1d}
  .comp-warn .comp-warn-text{font-size:.92rem; line-height:1.35}
  /* Success note at card bottom */
  .comp-ok{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #bbf7d0; background:#dcfce7; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#065f46}
  .comp-ok .comp-ok-text{font-size:.92rem; line-height:1.35}
  .btn-compact{height:1.9rem;padding:.2rem .55rem;font-size:.9rem}
  /* Unify button styles inside modal (anchors and buttons) */
  .ns-modal-dialog .btn-secondary,
  .ns-modal-dialog a.btn-secondary,
  .ns-modal-dialog button.btn-secondary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none; border:1px solid var(--border); background:var(--card); color:var(--text);
  }
  .ns-modal-dialog a.btn-secondary:visited { color: var(--text); }
  .ns-modal-dialog .btn-secondary:hover { background: color-mix(in srgb, var(--text) 5%, var(--card)); }
  /* GitHub green button variant (overrides theme packs) */
  .ns-modal-dialog .btn-github,
  .ns-modal-dialog a.btn-github,
  .ns-modal-dialog button.btn-github {
    background:#428646 !important; color:#ffffff !important; border:1px solid #3d7741 !important; border-radius:8px !important;
  }
  .ns-modal-dialog a.btn-github:visited { color:#ffffff !important; }
  .ns-modal-dialog .btn-github:hover { background:#3d7741 !important; }
  .ns-modal-dialog .btn-github:active { background:#298e46 !important; }
  .ns-modal-dialog .btn-secondary[disabled],
  .ns-modal-dialog button.btn-secondary[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .ns-modal-dialog .btn-primary,
  .ns-modal-dialog a.btn-primary,
  .ns-modal-dialog button.btn-primary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none;
  }
  .ns-modal-dialog .btn-primary[disabled],
  .ns-modal-dialog button.btn-primary[disabled]{opacity:.6;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .ns-modal-dialog a.btn-primary:visited { color: white; }

  /* Simple modal for the Composer wizard */
  .ns-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9999;padding:1rem}
  .ns-modal.is-open{display:flex}
  /* Nudge modal upward on short viewports */
  @media (max-height: 820px){
    .ns-modal{align-items:flex-start;padding-top:calc(max(12px, env(safe-area-inset-top)) + 24px)}
  }
  /* Remove top padding so sticky header can sit flush */
  .ns-modal-dialog{position:relative;background:var(--card);color:var(--text);border:1px solid color-mix(in srgb, var(--primary) 28%, var(--border));border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,0.18),0 6px 18px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06);width:min(92vw, 760px);max-height:min(90vh, 720px);overflow:auto;padding:0 .85rem .85rem}
  .ns-modal-close{position:absolute;top:.5rem;right:.6rem;z-index:3}
  /* When close button is inside the header, make it part of the flow */
  .ns-modal-dialog .comp-guide-head .ns-modal-close{position:static;top:auto;right:auto;margin-left:auto}
  body.ns-modal-open{overflow:hidden}
  .ns-modal-dialog .comp-guide{border:none;background:transparent;padding:0;margin:0}

  /* Modal animations */
  @keyframes nsModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes nsModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
  @keyframes nsModalSlideIn { from { transform: translateY(10px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
  @keyframes nsModalSlideOut { from { transform: translateY(0) scale(1); opacity: 1 } to { transform: translateY(8px) scale(.98); opacity: 0 } }
  .ns-modal.ns-anim-in { animation: nsModalFadeIn 160ms ease both; }
  .ns-modal.ns-anim-out { animation: nsModalFadeOut 160ms ease both; }
  .ns-modal.ns-anim-in .ns-modal-dialog { animation: nsModalSlideIn 200ms cubic-bezier(.2,.95,.4,1) both; }
  .ns-modal.ns-anim-out .ns-modal-dialog { animation: nsModalSlideOut 160ms ease both; }
  @media (prefers-reduced-motion: reduce){
    .ns-modal.ns-anim-in,
    .ns-modal.ns-anim-out,
    .ns-modal.ns-anim-in .ns-modal-dialog,
    .ns-modal.ns-anim-out .ns-modal-dialog { animation: none !important; }
  }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
