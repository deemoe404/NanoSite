import { escapeHtml } from './utils.js';
export { renderPressPostCardHtml } from './post-card-html.js';

const safe = (value) => escapeHtml(String(value ?? '')) || '';
const asBool = (value) => value === true || value === 'true' || value === '';
const isDomElement = (value) => value && typeof value === 'object' && value.nodeType === 1;
let pressSearchId = 0;

function defineElement(name, ctor) {
  try {
    if (typeof customElements !== 'undefined' && !customElements.get(name)) {
      customElements.define(name, ctor);
    }
  } catch (_) {}
}

function dispatchPressEvent(element, name, detail = {}) {
  try {
    element.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true
    }));
  } catch (_) {}
}

function wantsShadowRoot(element) {
  if (!element || typeof element.getAttribute !== 'function') return false;
  return element.hasAttribute('use-shadow') || element.getAttribute('render-root') === 'shadow';
}

function ensureShadowRoot(element) {
  if (!wantsShadowRoot(element) || element.shadowRoot || typeof element.attachShadow !== 'function') {
    return element && element.shadowRoot ? element.shadowRoot : null;
  }
  try {
    return element.attachShadow({ mode: 'open' });
  } catch (_) {
    return null;
  }
}

function getRenderRoot(element) {
  return (element && (element.shadowRoot || ensureShadowRoot(element))) || element;
}

function hasAssignedSlot(element, name) {
  try {
    return !!(element && element.querySelector(`[slot="${name}"]`));
  } catch (_) {
    return false;
  }
}

export class PressSearch extends HTMLElement {
  static get observedAttributes() {
    return ['placeholder', 'value', 'label', 'field-class', 'icon-class', 'icon', 'use-shadow', 'render-root'];
  }

  constructor() {
    super();
    this._input = null;
    this._inputId = `press-search-input-${++pressSearchId}`;
    this._inputHandler = (event) => this._handleKeydown(event);
    this._toggleCleanup = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this._unbindInput();
    this._cleanupToggle();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected) return;
    if (['field-class', 'icon-class', 'icon', 'use-shadow', 'render-root'].includes(name) && oldValue !== newValue) {
      this.render();
      return;
    }
    if (name === 'value') {
      this._syncInputState();
      return;
    }
    const input = this.input;
    if (!input) return;
    if (name === 'placeholder') {
      if (newValue == null) input.removeAttribute('placeholder');
      else input.setAttribute('placeholder', String(newValue));
      return;
    }
    if (name === 'label') {
      input.setAttribute('aria-label', String(newValue || 'Search'));
    }
  }

  get input() {
    const root = getRenderRoot(this);
    return root && typeof root.querySelector === 'function' ? root.querySelector('input[type="search"]') : null;
  }

  get value() {
    const input = this.input;
    return input ? input.value : (this.getAttribute('value') || '');
  }

  set value(nextValue) {
    const value = String(nextValue || '');
    this.setAttribute('value', value);
    const input = this.input;
    if (input && input.value !== value) input.value = value;
  }

  render() {
    const previous = this.input ? this.input.value : (this.getAttribute('value') || '');
    this._unbindInput();
    const root = getRenderRoot(this);
    if (root && root !== this) {
      this.textContent = '';
      root.innerHTML = this._markup();
    } else {
      this.innerHTML = this._markup();
    }
    this._input = this.input;
    this._syncInputState(previous);
    this._bindInput();
  }

  setPlaceholder(placeholder) {
    this.setAttribute('placeholder', String(placeholder || ''));
  }

  focusInput(options = {}) {
    const input = this.input;
    if (!input) return false;
    try {
      input.focus(options);
      return true;
    } catch (_) {
      try {
        input.focus();
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  bindToggle(toggle, options = {}) {
    this._cleanupToggle();
    if (!toggle || typeof toggle.addEventListener !== 'function') return;
    const doc = this.ownerDocument || document;
    const toggleActiveClass = options.toggleActiveClass || 'is-active';
    const openClass = options.openClass || 'is-open';
    const onClick = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      this.setOpen(!this.classList.contains(openClass), { toggle, toggleActiveClass, openClass });
    };
    const onKeydown = (event) => {
      if (event.key !== 'Escape') return;
      this.setOpen(false, { toggle, toggleActiveClass, openClass });
      try { toggle.focus({ preventScroll: true }); } catch (_) {}
    };
    const onFocusIn = () => this.setOpen(true, { toggle, toggleActiveClass, openClass, skipFocus: true });
    const onDocClick = (event) => {
      const target = event && event.target;
      if (!this.classList.contains(openClass)) return;
      if (target && (this.contains(target) || toggle.contains(target))) return;
      this.setOpen(false, { toggle, toggleActiveClass, openClass });
    };
    toggle.addEventListener('click', onClick);
    this.addEventListener('keydown', onKeydown);
    this.addEventListener('focusin', onFocusIn);
    doc.addEventListener('click', onDocClick);
    this._toggleCleanup = () => {
      try { toggle.removeEventListener('click', onClick); } catch (_) {}
      try { this.removeEventListener('keydown', onKeydown); } catch (_) {}
      try { this.removeEventListener('focusin', onFocusIn); } catch (_) {}
      try { doc.removeEventListener('click', onDocClick); } catch (_) {}
    };
  }

  setOpen(open, options = {}) {
    const toggle = options.toggle || null;
    const openClass = options.openClass || 'is-open';
    const toggleActiveClass = options.toggleActiveClass || 'is-active';
    const isOpen = !!open;
    this.classList.toggle(openClass, isOpen);
    if (toggle) {
      toggle.classList.toggle(toggleActiveClass, isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if (isOpen && !options.skipFocus) this.focusInput({ preventScroll: true });
    if (!isOpen && this.ownerDocument && this.ownerDocument.activeElement && this.contains(this.ownerDocument.activeElement)) {
      try { this.ownerDocument.activeElement.blur(); } catch (_) {}
    }
  }

  _markup() {
    const placeholder = safe(this.getAttribute('placeholder') || '');
    const label = safe(this.getAttribute('label') || 'Search');
    const fieldClass = safe(this.getAttribute('field-class') || 'press-search__field');
    const iconClass = safe(this.getAttribute('icon-class') || 'press-search__icon');
    const icon = this.hasAttribute('icon') ? safe(this.getAttribute('icon') || '') : '';
    const iconHtml = icon ? `<span class="${iconClass}" part="icon" aria-hidden="true">${icon}</span>` : '';
    const inputId = safe(this._inputId || `press-search-input-${++pressSearchId}`);
    const input = `<input id="${inputId}" part="input" type="search" autocomplete="off" spellcheck="false" aria-label="${label}" placeholder="${placeholder}" />`;
    return `<label class="${fieldClass}" part="label" for="${inputId}">${iconHtml}${input}</label>`;
  }

  _syncInputState(valueOverride) {
    const input = this.input;
    if (!input) return;
    const placeholder = this.getAttribute('placeholder');
    if (placeholder != null) input.setAttribute('placeholder', placeholder);
    const label = this.getAttribute('label') || 'Search';
    input.setAttribute('aria-label', label);
    const value = valueOverride != null ? String(valueOverride) : (this.getAttribute('value') || '');
    if (input.value !== value) input.value = value;
  }

  _bindInput() {
    const input = this.input;
    if (!input) return;
    input.addEventListener('keydown', this._inputHandler);
  }

  _unbindInput() {
    const input = this._input || this.input;
    if (!input) return;
    try { input.removeEventListener('keydown', this._inputHandler); } catch (_) {}
    this._input = null;
  }

  _cleanupToggle() {
    if (typeof this._toggleCleanup === 'function') {
      try { this._toggleCleanup(); } catch (_) {}
    }
    this._toggleCleanup = null;
  }

  _handleKeydown(event) {
    if (!event || event.key !== 'Enter') return;
    const input = event.target && event.target.closest ? event.target.closest('input[type="search"]') : this.input;
    const query = input ? String(input.value || '').trim() : '';
    dispatchPressEvent(this, 'press:search', { query });
  }
}

export class PressThemeControls extends HTMLElement {
  constructor() {
    super();
    this._labels = {};
    this._themePacks = [];
    this._languages = [];
    this._currentPack = '';
    this._currentLang = '';
    this._clickHandler = (event) => this._handleClick(event);
    this._changeHandler = (event) => this._handleChange(event);
    this._eventsBound = false;
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
  }

  disconnectedCallback() {
    this._unbindEvents();
  }

  setLabels(labels = {}) {
    this._labels = { ...this._labels, ...(labels || {}) };
    if (this.isConnected) this.render();
  }

  setThemePacks(packs = [], current = '') {
    this._themePacks = Array.isArray(packs) ? packs.slice() : [];
    this._currentPack = String(current || this._currentPack || '');
    this._populateThemePacks();
  }

  setLanguages(languages = [], current = '') {
    this._languages = Array.isArray(languages) ? languages.slice() : [];
    this._currentLang = String(current || this._currentLang || '');
    this._populateLanguages();
  }

  setCurrentPack(value) {
    this._currentPack = String(value || '');
    const select = this.querySelector('[data-role="theme-pack"]');
    if (select && this._currentPack) select.value = this._currentPack;
  }

  setCurrentLang(value) {
    this._currentLang = String(value || '');
    const select = this.querySelector('[data-role="language"]');
    if (select && this._currentLang) select.value = this._currentLang;
  }

  render() {
    this._syncHostClass();
    this.innerHTML = this._markup();
    this._populateThemePacks();
    this._populateLanguages();
  }

  _label(key, fallback) {
    return this._labels[key] != null ? String(this._labels[key]) : fallback;
  }

  _variant() {
    const raw = String(this.getAttribute('variant') || 'native').toLowerCase().trim();
    return raw.replace(/[^a-z0-9_-]/g, '') || 'native';
  }

  _syncHostClass() {
    const variant = this._variant();
    if (!this.id) this.id = 'tools';
    Array.from(this.classList || []).forEach((className) => {
      if (String(className || '').startsWith('press-theme-controls--')) {
        this.classList.remove(className);
      }
    });
    this.classList.remove('box', 'arcus-tools__groups', 'solstice-tools');
    if (variant === 'arcus') {
      this.classList.add('arcus-tools__groups', `press-theme-controls--${variant}`);
    } else if (variant === 'solstice') {
      this.classList.add('solstice-tools', `press-theme-controls--${variant}`);
    } else {
      this.classList.add('box', `press-theme-controls--${variant}`);
    }
  }

  _markup() {
    const variant = this._variant();
    const sectionTitle = safe(this._label('sectionTitle', 'Tools'));
    const toggleTheme = safe(this._label('toggleTheme', 'Toggle theme'));
    const postEditor = safe(this._label('postEditor', 'Post editor'));
    const themePack = safe(this._label('themePack', 'Theme pack'));
    const language = safe(this._label('language', 'Language'));
    const resetLanguage = safe(this._label('resetLanguage', 'Reset language'));
    if (variant === 'arcus') {
      return `
        <div class="arcus-tools__group" role="group" data-group="theme" aria-label="${toggleTheme} &amp; ${themePack}">
          <button class="arcus-tool" type="button" data-role="theme-toggle" aria-label="${toggleTheme}">
            <span class="arcus-tool__icon">&#127769;</span>
            <span class="arcus-tool__label">${toggleTheme}</span>
          </button>
          <label class="arcus-tool arcus-tool--select">
            <span class="arcus-tool__label">${themePack}</span>
            <select data-role="theme-pack" aria-label="${themePack}"></select>
          </label>
        </div>
        <div class="arcus-tools__group" role="group" data-group="language" aria-label="${language} &amp; ${resetLanguage}">
          <label class="arcus-tool arcus-tool--select">
            <span class="arcus-tool__label">${language}</span>
            <select data-role="language" aria-label="${language}"></select>
          </label>
          <button class="arcus-tool" type="button" data-role="language-reset" aria-label="${resetLanguage}">
            <span class="arcus-tool__icon">&#9851;</span>
            <span class="arcus-tool__label">${resetLanguage}</span>
          </button>
        </div>
        <div class="arcus-tools__group arcus-tools__group--solo" role="group" data-group="editor" aria-label="${postEditor}">
          <button class="arcus-tool" type="button" data-role="post-editor" aria-label="${postEditor}">
            <span class="arcus-tool__icon">&#128221;</span>
            <span class="arcus-tool__label">${postEditor}</span>
          </button>
        </div>`;
    }
    if (variant === 'solstice') {
      return `
        <button class="solstice-tool" type="button" data-role="theme-toggle" aria-label="${toggleTheme}">
          <span class="solstice-tool__icon">&#127769;</span>
          <span class="solstice-tool__label">${toggleTheme}</span>
        </button>
        <button class="solstice-tool" type="button" data-role="post-editor" aria-label="${postEditor}">
          <span class="solstice-tool__icon">&#128221;</span>
          <span class="solstice-tool__label">${postEditor}</span>
        </button>
        <label class="solstice-tool solstice-tool--select">
          <span class="solstice-tool__label">${themePack}</span>
          <select data-role="theme-pack" aria-label="${themePack}"></select>
        </label>
        <label class="solstice-tool solstice-tool--select">
          <span class="solstice-tool__label">${language}</span>
          <select data-role="language" aria-label="${language}"></select>
        </label>
        <button class="solstice-tool" type="button" data-role="language-reset" aria-label="${resetLanguage}">
          <span class="solstice-tool__icon">&#9851;</span>
          <span class="solstice-tool__label">${resetLanguage}</span>
        </button>`;
    }
    return `
      <div class="section-title">${sectionTitle}</div>
      <div class="tools tools-panel">
        <div class="tool-item">
          <button class="btn icon-btn" type="button" data-role="theme-toggle" aria-label="${toggleTheme}" title="${toggleTheme}"><span class="icon">&#127769;</span><span class="btn-text">${toggleTheme}</span></button>
        </div>
        <div class="tool-item">
          <button class="btn icon-btn" type="button" data-role="post-editor" aria-label="${postEditor}" title="${postEditor}"><span class="icon">&#128221;</span><span class="btn-text">${postEditor}</span></button>
        </div>
        <div class="tool-item">
          <label class="tool-label">${themePack}</label>
          <select data-role="theme-pack" aria-label="${themePack}" title="${themePack}"></select>
        </div>
        <div class="tool-item">
          <label class="tool-label">${language}</label>
          <select data-role="language" aria-label="${language}" title="${language}"></select>
        </div>
        <div class="tool-item">
          <button class="btn icon-btn" type="button" data-role="language-reset" aria-label="${resetLanguage}" title="${resetLanguage}"><span class="icon">&#9851;</span><span class="btn-text">${resetLanguage}</span></button>
        </div>
      </div>`;
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this.addEventListener('click', this._clickHandler);
    this.addEventListener('change', this._changeHandler);
    this._eventsBound = true;
  }

  _unbindEvents() {
    if (!this._eventsBound) return;
    try { this.removeEventListener('click', this._clickHandler); } catch (_) {}
    try { this.removeEventListener('change', this._changeHandler); } catch (_) {}
    this._eventsBound = false;
  }

  _handleClick(event) {
    const control = event.target && event.target.closest ? event.target.closest('[data-role]') : null;
    if (!control || !this.contains(control)) return;
    const role = control.getAttribute('data-role');
    if (role === 'theme-toggle') dispatchPressEvent(this, 'press:theme-toggle');
    else if (role === 'post-editor') dispatchPressEvent(this, 'press:open-editor');
    else if (role === 'language-reset') dispatchPressEvent(this, 'press:language-reset');
  }

  _handleChange(event) {
    const control = event.target && event.target.closest ? event.target.closest('[data-role]') : null;
    if (!control || !this.contains(control)) return;
    const role = control.getAttribute('data-role');
    if (role === 'theme-pack') {
      dispatchPressEvent(this, 'press:theme-pack-change', { value: control.value || '' });
    } else if (role === 'language') {
      dispatchPressEvent(this, 'press:language-change', { value: control.value || '' });
    }
  }

  _populateThemePacks() {
    const select = this.querySelector('[data-role="theme-pack"]');
    if (!select) return;
    const packs = this._themePacks.length ? this._themePacks : [{ value: 'native', label: 'Native' }];
    const current = this._currentPack || (packs[0] && packs[0].value) || 'native';
    select.textContent = '';
    const seen = new Set();
    packs.forEach((pack) => {
      if (!pack) return;
      const value = String(pack.value || pack.slug || pack.name || '').trim();
      if (!value || seen.has(value)) return;
      const option = (this.ownerDocument || document).createElement('option');
      option.value = value;
      option.textContent = String(pack.label || pack.name || value);
      select.appendChild(option);
      seen.add(value);
    });
    if (current && !seen.has(current)) {
      const option = (this.ownerDocument || document).createElement('option');
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    select.value = current;
  }

  _populateLanguages() {
    const select = this.querySelector('[data-role="language"]');
    if (!select) return;
    select.textContent = '';
    const current = this._currentLang || (this._languages[0] && this._languages[0].value) || '';
    const seen = new Set();
    this._languages.forEach((lang) => {
      if (!lang) return;
      const value = String(lang.value || lang.code || '').trim();
      if (!value || seen.has(value)) return;
      const option = (this.ownerDocument || document).createElement('option');
      option.value = value;
      option.textContent = String(lang.label || value);
      select.appendChild(option);
      seen.add(value);
    });
    if (current && !seen.has(current)) {
      const option = (this.ownerDocument || document).createElement('option');
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    if (current) select.value = current;
  }
}

export class PressToc extends HTMLElement {
  constructor() {
    super();
    this._tocHtml = '';
    this._articleTitle = '';
    this._headings = [];
    this._positions = [];
    this._contentRootElement = null;
    this._scrollRootElement = null;
    this._ticking = false;
    this._onScroll = () => this._scheduleActiveUpdate();
    this._onResize = () => {
      this._computePositions();
      this._updateActive();
    };
    this._onLoad = () => {
      this._computePositions();
      this._updateActive();
    };
    this._listenersBound = false;
  }

  disconnectedCallback() {
    this._cleanupListeners();
  }

  renderToc(options = {}) {
    this._cleanupListeners();
    this._tocHtml = String(options.tocHtml || '');
    this._articleTitle = String(options.articleTitle || '');
    this._contentRootElement = isDomElement(options.contentRoot) ? options.contentRoot : null;
    this._scrollRootElement = isDomElement(options.scrollRoot) ? options.scrollRoot : null;
    if (options.topLabel != null) this.setAttribute('top-label', String(options.topLabel));
    if (options.topAria != null) this.setAttribute('top-aria', String(options.topAria));
    if (options.contentSelector != null) this.setAttribute('content-selector', String(options.contentSelector));
    if (!this._tocHtml) {
      this.innerHTML = '';
      return false;
    }
    this.innerHTML = this._markup();
    this.enhance();
    return true;
  }

  clear() {
    this._cleanupListeners();
    this._tocHtml = '';
    this._contentRootElement = null;
    this._scrollRootElement = null;
    this.innerHTML = '';
  }

  enhance() {
    const list = this.querySelector('ul');
    if (!list) return false;
    this._enhanceRows();
    this._bindTocClicks();
    this._computePositions();
    this._bindListeners();
    const current = (location.hash || '').replace(/^#/, '');
    if (current && this._idToLink && this._idToLink.has(current)) this._setActive(current);
    else this._updateActive();
    return true;
  }

  _markup() {
    const title = safe(this._articleTitle || this.getAttribute('toc-title') || '');
    const innerClass = safe(this.getAttribute('inner-class') || '');
    const titleClass = safe(this.getAttribute('title-class') || '');
    const showTop = this.getAttribute('show-top') !== 'false';
    if (innerClass || titleClass || !showTop) {
      const heading = title || safe(this.getAttribute('fallback-title') || 'Table of contents');
      return `<div class="${innerClass || 'press-toc__inner'}" part="toc"><div class="${titleClass || 'press-toc__title'}" part="title">${heading}</div>${this._tocHtml}</div>`;
    }
    const topLabel = safe(this.getAttribute('top-label') || 'Top');
    const topAria = safe(this.getAttribute('top-aria') || 'Back to top');
    const titleHtml = title ? `<span>${title}</span>` : '';
    return `<div class="toc-header" part="header">${titleHtml}<button type="button" class="toc-top" part="top-button" aria-label="${topAria}">${topLabel}</button></div><div part="toc">${this._tocHtml}</div>`;
  }

  _enhanceRows() {
    this.querySelectorAll('li').forEach((li) => {
      const sub = li.querySelector(':scope > ul');
      const link = li.querySelector(':scope > a');
      let row = li.querySelector(':scope > .toc-row');
      if (!row) {
        row = (this.ownerDocument || document).createElement('div');
        row.className = 'toc-row';
        if (link) li.insertBefore(row, link);
        else if (sub) li.insertBefore(row, sub);
        else li.appendChild(row);
      }
      if (link && link.parentElement !== row) row.appendChild(link);
      if (sub && !row.querySelector(':scope > .toc-toggle')) {
        const btn = (this.ownerDocument || document).createElement('button');
        btn.className = 'toc-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-label', this.getAttribute('toggle-label') || 'Toggle section');
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = '<span class="caret"></span>';
        row.insertBefore(btn, row.firstChild || null);
        btn.addEventListener('click', () => {
          const collapsed = sub.classList.toggle('collapsed');
          btn.setAttribute('aria-expanded', String(!collapsed));
        });
        const depth = this._getDepth(li);
        if (depth >= 2) {
          sub.classList.add('collapsed');
          btn.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  _bindTocClicks() {
    this._idToLink = new Map();
    this.querySelectorAll('a[href^="#"]:not(.toc-anchor)').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const id = href.replace(/^#/, '');
      if (id && !anchor.classList.contains('toc-top')) this._idToLink.set(id, anchor);
      if (anchor.dataset.pressTocBound === 'true') return;
      anchor.dataset.pressTocBound = 'true';
      anchor.addEventListener('click', (event) => this._handleTocLink(event, anchor));
    });
    const top = this.querySelector('.toc-top');
    if (top && top.dataset.pressTocBound !== 'true') {
      top.dataset.pressTocBound = 'true';
      top.addEventListener('click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        this._scrollToTop();
        this.querySelectorAll('a.active').forEach((link) => link.classList.remove('active'));
      });
    }
  }

  _contentRoot() {
    if (isDomElement(this._contentRootElement)) return this._contentRootElement;
    const selector = this.getAttribute('content-selector') || '[data-theme-region="main"]';
    try {
      return (this.ownerDocument || document).querySelector(selector);
    } catch (_) {
      return null;
    }
  }

  _computePositions() {
    const root = this._contentRoot();
    const scrollRoot = this._scrollRoot();
    const scrollTop = this._scrollTop(scrollRoot);
    const scrollRootTop = scrollRoot && scrollRoot !== window && typeof scrollRoot.getBoundingClientRect === 'function'
      ? scrollRoot.getBoundingClientRect().top
      : 0;
    this._headings = root ? Array.from(root.querySelectorAll('h2[id], h3[id]')) : [];
    this._positions = this._headings.map((heading) => ({
      id: heading.id,
      top: heading.getBoundingClientRect().top - scrollRootTop + scrollTop
    }));
  }

  _scheduleActiveUpdate() {
    if (this._ticking) return;
    this._ticking = true;
    requestAnimationFrame(() => {
      this._ticking = false;
      this._updateActive();
    });
  }

  _updateActive() {
    if (!this._positions.length) return;
    const y = this._scrollTop(this._scrollRoot()) + 120;
    let currentId = this._positions[0] ? this._positions[0].id : '';
    for (let i = 0; i < this._positions.length; i += 1) {
      if (this._positions[i].top <= y) currentId = this._positions[i].id;
      else break;
    }
    if (currentId) this._setActive(currentId);
  }

  _setActive(id) {
    this.querySelectorAll('a.active').forEach((link) => link.classList.remove('active'));
    const link = this._idToLink && this._idToLink.get(id);
    if (!link) return;
    link.classList.add('active');
    let node = link.parentElement;
    while (node && node !== this) {
      const sub = node.querySelector ? node.querySelector(':scope > ul') : null;
      const btn = node.querySelector ? node.querySelector(':scope > .toc-toggle') : null;
      if (sub && sub.classList.contains('collapsed')) {
        sub.classList.remove('collapsed');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
      node = node.parentElement;
    }
    dispatchPressEvent(this, 'press:toc-active', { id });
  }

  _handleTocLink(event, anchor) {
    const href = anchor.getAttribute('href') || '';
    const id = href.replace(/^#/, '');
    if (!id || anchor.classList.contains('toc-top')) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    this._setActive(id);
    const target = (this.ownerDocument || document).getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dispatchPressEvent(this, 'press:navigate', { href: `#${id}`, id });
    try {
      const url = new URL(window.location.href);
      url.hash = id ? `#${id}` : '';
      history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  _scrollToTop() {
    const scrollRoot = this._scrollRoot();
    if (scrollRoot && scrollRoot !== window) {
      try {
        scrollRoot.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return;
      } catch (_) {
        try {
          scrollRoot.scrollTop = 0;
          scrollRoot.scrollLeft = 0;
          return;
        } catch (__) {}
      }
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) {
      try { window.scrollTo(0, 0); } catch (__) {}
    }
  }

  _bindListeners() {
    if (this._listenersBound) return;
    const scrollRoot = this._scrollRoot();
    if (scrollRoot && typeof scrollRoot.addEventListener === 'function') {
      scrollRoot.addEventListener('scroll', this._onScroll, { passive: true });
    }
    window.addEventListener('resize', this._onResize);
    window.addEventListener('load', this._onLoad);
    this._listenersBound = true;
  }

  _cleanupListeners() {
    if (!this._listenersBound) return;
    const scrollRoot = this._scrollRoot();
    try { if (scrollRoot && typeof scrollRoot.removeEventListener === 'function') scrollRoot.removeEventListener('scroll', this._onScroll); } catch (_) {}
    try { window.removeEventListener('resize', this._onResize); } catch (_) {}
    try { window.removeEventListener('load', this._onLoad); } catch (_) {}
    this._listenersBound = false;
  }

  _scrollRoot() {
    return isDomElement(this._scrollRootElement) ? this._scrollRootElement : window;
  }

  _scrollTop(scrollRoot) {
    if (scrollRoot && scrollRoot !== window) return scrollRoot.scrollTop || 0;
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  _getDepth(el) {
    let depth = 0;
    let node = el;
    while (node && node !== this) {
      if (node.tagName === 'UL') depth += 1;
      node = node.parentElement;
    }
    return Math.max(0, depth - 1);
  }
}

export class PressPostCard extends HTMLElement {
  static get observedAttributes() {
    return [
      'href',
      'title',
      'date',
      'excerpt',
      'versions-label',
      'draft-label',
      'data-idx',
      'card-class',
      'with-cover-class',
      'link-class',
      'body-class',
      'title-class',
      'excerpt-class',
      'excerpt-inner-class',
      'meta-class',
      'date-class',
      'versions-class',
      'draft-class',
      'separator-class',
      'tags-class',
      'meta-position',
      'wrap-card',
      'use-shadow',
      'render-root'
    ];
  }

  constructor() {
    super();
    this._clickHandler = (event) => this._handleClick(event);
  }

  connectedCallback() {
    this.style.display = 'contents';
    this.render();
    this.addEventListener('click', this._clickHandler);
  }

  disconnectedCallback() {
    try { this.removeEventListener('click', this._clickHandler); } catch (_) {}
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  render() {
    this._captureSlotContent();
    const root = getRenderRoot(this);
    if (root && root !== this) {
      root.innerHTML = this._renderCard({ shadow: true });
    } else {
      this.innerHTML = this._renderCard();
    }
  }

  _captureSlotContent() {
    ['cover', 'meta', 'actions', 'footer', 'tags'].forEach((name) => {
      const template = this.querySelector(`template[data-slot="${name}"], template[slot="${name}"]`);
      const slotted = Array.from(this.querySelectorAll(`[slot="${name}"]`))
        .filter((node) => node.tagName !== 'TEMPLATE')
        .map((node) => node.outerHTML || node.textContent || '')
        .join('');
      const html = template ? (template.innerHTML || '') : slotted;
      if (name === 'cover' && html) this._coverHtml = html;
      else if (name === 'meta' && html) this._metaHtml = html;
      else if (name === 'actions' && html) this._actionsHtml = html;
      else if (name === 'footer' && html) this._footerHtml = html;
      else if (name === 'tags' && html) this._tagsHtml = html;
    });
  }

  _partSlot(name, html) {
    return html ? `<span part="${safe(name)}" style="display: contents">${html}</span>` : '';
  }

  _shadowSlot(name, fallback = '') {
    if (!fallback && !hasAssignedSlot(this, name)) return '';
    const slotName = safe(name);
    return `<span part="${slotName}" style="display: contents"><slot name="${slotName}">${fallback || ''}</slot></span>`;
  }

  _classAttr(name, fallback = '') {
    const value = this.hasAttribute(name) ? this.getAttribute(name) : fallback;
    return safe(value || '');
  }

  _renderCard(options = {}) {
    const shadow = options && options.shadow === true;
    const title = safe(this.getAttribute('title') || 'Untitled');
    const href = safe(this.getAttribute('href') || '#');
    const dataIdx = safe(this.getAttribute('data-idx') || encodeURIComponent(this.getAttribute('title') || ''));
    const date = safe(this.getAttribute('date') || '');
    const versions = safe(this.getAttribute('versions-label') || '');
    const draft = safe(this.getAttribute('draft-label') || '');
    const excerpt = safe(this.getAttribute('excerpt') || '');
    const hasCover = !!(this._coverHtml || '').trim() || hasAssignedSlot(this, 'cover');
    const cardClassBase = this._classAttr('card-class', 'press-card');
    const withCoverClass = this._classAttr('with-cover-class', 'press-card--with-cover');
    const cardClass = `${cardClassBase}${hasCover && withCoverClass ? ` ${withCoverClass}` : ''}`.trim();
    const linkClass = this._classAttr('link-class', 'press-card__link');
    const bodyClass = this._classAttr('body-class', 'press-card__body');
    const titleClass = this._classAttr('title-class', 'press-card__title');
    const excerptClass = this._classAttr('excerpt-class', 'press-card__excerpt');
    const excerptInnerClass = this._classAttr('excerpt-inner-class', '');
    const metaClass = this._classAttr('meta-class', 'press-card__meta');
    const dateClass = this._classAttr('date-class', 'press-card__date');
    const versionsClass = this._classAttr('versions-class', 'press-card__versions');
    const draftClass = this._classAttr('draft-class', 'press-card__draft');
    const separatorClass = this._classAttr('separator-class', 'press-card__separator');
    const tagsClass = this._classAttr('tags-class', 'press-card__tags');
    const metaPosition = (this.getAttribute('meta-position') || 'after-title').toLowerCase();
    const wrapCard = this.getAttribute('wrap-card') !== 'false';
    const parts = [];
    if (date) parts.push(`<span class="${dateClass}">${date}</span>`);
    if (versions) parts.push(`<span class="${versionsClass}">${versions}</span>`);
    if (draft) parts.push(`<span class="${draftClass}">${draft}</span>`);
    const separator = `<span class="${separatorClass}" aria-hidden="true">&bull;</span>`;
    const meta = this._metaHtml || parts.join(separator);
    const excerptHtml = excerpt
      ? `<p class="${excerptClass}" part="excerpt">${excerptInnerClass ? `<span class="${excerptInnerClass}">${excerpt}</span>` : excerpt}</p>`
      : `<div class="${excerptClass}" part="excerpt"></div>`;
    const titleHtml = `<h3 class="${titleClass}" part="title">${title}</h3>`;
    const metaHtml = `<div class="${metaClass}" part="meta">${shadow ? `<slot name="meta">${meta}</slot>` : meta}</div>`;
    const tagsHtml = (this._tagsHtml || hasAssignedSlot(this, 'tags'))
      ? `<div class="${tagsClass}" part="tags">${shadow ? `<slot name="tags">${this._tagsHtml || ''}</slot>` : this._tagsHtml}</div>`
      : '';
    const bodyParts = metaPosition === 'before-title'
      ? [metaHtml, titleHtml, excerptHtml, tagsHtml]
      : (metaPosition === 'after-excerpt'
          ? [titleHtml, excerptHtml, metaHtml, tagsHtml]
          : [titleHtml, metaHtml, excerptHtml, tagsHtml]);
    const inner = `
      <a class="${linkClass}" part="link" href="${href}" data-idx="${dataIdx}">
        ${shadow ? this._shadowSlot('cover', this._coverHtml) : this._partSlot('cover', this._coverHtml)}
        <div class="${bodyClass}" part="body">
          ${bodyParts.join('')}
          ${shadow ? this._shadowSlot('actions', this._actionsHtml) : this._partSlot('actions', this._actionsHtml)}
          ${shadow ? this._shadowSlot('footer', this._footerHtml) : this._partSlot('footer', this._footerHtml)}
        </div>
      </a>`;
    if (!wrapCard) {
      const directClass = linkClass || cardClass;
      return inner.replace('part="link"', 'part="card link"').replace(`class="${linkClass}"`, `class="${directClass}"`);
    }
    return `<article class="${cardClass}" part="card">${inner}</article>`;
  }

  _handleClick(event) {
    const target = event && event.target;
    const path = event && typeof event.composedPath === 'function' ? event.composedPath() : [];
    const linkFromPath = path.find((node) => node && node.tagName === 'A' && typeof node.getAttribute === 'function' && node.getAttribute('href'));
    const link = linkFromPath || (target && target.closest ? target.closest('a[href]') : null);
    if (!link) return;
    const root = typeof link.getRootNode === 'function' ? link.getRootNode() : null;
    if (!this.contains(link) && root !== this.shadowRoot) return;
    dispatchPressEvent(this, 'press:navigate', {
      href: link.getAttribute('href') || '',
      title: this.getAttribute('title') || ''
    });
  }
}

export function registerPressComponents() {
  defineElement('press-search', PressSearch);
  defineElement('press-theme-controls', PressThemeControls);
  defineElement('press-toc', PressToc);
  defineElement('press-post-card', PressPostCard);
}

registerPressComponents();
