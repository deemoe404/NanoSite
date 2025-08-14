import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindThemePackPicker, mountThemeControls } from './js/theme.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, escapeHtml, formatDisplayDate } from './js/utils.js';
import { initI18n, t, withLangParam, loadLangJson } from './js/i18n.js';

// Lightweight fetch helper
const getFile = (filename) => fetch(filename).then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });

let postsByLocationTitle = {};
let tabsBySlug = {};
let postsIndexCache = {};
let allowedLocations = new Set();
const PAGE_SIZE = 8;

function renderSkeletonArticle() {
  return `
    <div class="skeleton-article" aria-busy="true" aria-live="polite">
      <div class="skeleton-block skeleton-title w-70"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-80"></div>
      <div class="skeleton-block skeleton-image w-100"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-60"></div>
    </div>`;
}

function getArticleTitleFromMain() {
  const h = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
  if (!h) return null;
  const clone = h.cloneNode(true);
  const anchors = clone.querySelectorAll('a.anchor');
  anchors.forEach(a => a.remove());
  const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  return text.replace(/^#+\s*/, '').trim();
}

function renderTabs(activeSlug, searchQuery) {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;
  const make = (slug, label) => {
    const href = withLangParam(`?tab=${encodeURIComponent(slug)}`);
    return `<a class="tab${activeSlug===slug?' active':''}" href="${href}">${label}</a>`;
  };
  let html = make('posts', t('ui.allPosts'));
  for (const [slug, info] of Object.entries(tabsBySlug)) html += make(slug, info.title);
  if (activeSlug === 'search') {
    const q = String(searchQuery || '').trim();
    const href = withLangParam(`?tab=search${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    html += `<a class="tab active" href="${href}">${t('ui.searchTab')}</a>`;
  } else if (activeSlug === 'post') {
    const raw = String(searchQuery || t('ui.postTab')).trim();
    const label = raw ? escapeHtml(raw.length > 28 ? raw.slice(0,25) + '…' : raw) : t('ui.postTab');
    html += `<span class="tab active">${label}</span>`;
  }
  nav.innerHTML = html;
}

// Render footer navigation: Home (All Posts) + custom tabs
function renderFooterNav() {
  const nav = document.getElementById('footerNav');
  if (!nav) return;
  const currentTab = (getQueryVariable('tab') || (getQueryVariable('id') ? 'post' : 'posts')).toLowerCase();
  const make = (href, label, cls = '') => `<a class="${cls}" href="${withLangParam(href)}">${label}</a>`;
  const isActive = (slug) => currentTab === slug;
  let html = '';
  html += make('?tab=posts', t('ui.allPosts'), isActive('posts') ? 'active' : '');
  // (Search link intentionally omitted in footer)
  for (const [slug, info] of Object.entries(tabsBySlug)) {
    const href = `?tab=${encodeURIComponent(slug)}`;
    const label = info && info.title ? info.title : slug;
    html += ' ' + make(href, label, isActive(slug) ? 'active' : '');
  }
  nav.innerHTML = html;
}

function displayPost(postname) {
  // Loading state for post view
  const toc = document.getElementById('tocview');
  if (toc) {
    toc.style.display = '';
    toc.innerHTML = `<div class=\"toc-header\"><span>${t('ui.contents')}</span><span style=\"font-size:.85rem; color: var(--muted);\">${t('ui.loading')}</span></div>`
      + '<ul class="toc-skeleton">'
      + '<li><div class="skeleton-block skeleton-line w-90"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-80"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-85"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-70"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-60"></div></li>'
      + '</ul>';
  }
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();

  return getFile('wwwroot/' + postname).then(markdown => {
    const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
    const baseDir = `wwwroot/${dir}`;
    const output = mdParse(markdown, baseDir);
    // Render main content first so we can read the first heading reliably
    document.getElementById('mainview').innerHTML = output.post;
    const fallback = postsByLocationTitle[postname] || postname;
    const articleTitle = getArticleTitleFromMain() || fallback;
    renderTabs('post', articleTitle);
    const toc = document.getElementById('tocview');
    toc.style.display = '';
    toc.innerHTML = `<div class=\"toc-header\"><span>${escapeHtml(articleTitle)}</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">${t('ui.top')}</a></div>${output.toc}`;
    const searchBox = document.getElementById('searchbox');
    if (searchBox) searchBox.style.display = 'none';
    setDocTitle(articleTitle);
    setupAnchors();
    setupTOC();
    // If URL contains a hash, ensure we jump after content is in DOM
    const currentHash = (location.hash || '').replace(/^#/, '');
    if (currentHash) {
      const target = document.getElementById(currentHash);
      if (target) {
        requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); });
      }
    }
  }).catch(() => {
    document.getElementById('tocview').innerHTML = '';
    const backHref = withLangParam('?tab=posts');
    document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('errors.postNotFoundTitle')}</h3><p>${t('errors.postNotFoundBody')} <a href=\"${backHref}\">${t('ui.backToAllPosts')}</a>.</p></div>`;
    setDocTitle(t('ui.notFound'));
    const searchBox = document.getElementById('searchbox');
    if (searchBox) searchBox.style.display = 'none';
  });
}

function displayIndex(parsed) {
  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';

  const entries = Object.entries(parsed || {});
  const total = entries.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageEntries = entries.slice(start, end);

  let html = '<div class="index">';
  for (const [key, value] of pageEntries) {
    const tag = value ? renderTags(value.tag) : '';
    const cover = (value && value.image)
      ? `<div class=\"card-cover-wrap\"><img class=\"card-cover\" alt=\"${key}\" src=\"${cardImageSrc(value.image)}\"></div>`
      : fallbackCover(key);
    // pre-render meta line with date if available; read time appended after fetch
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class=\"card-date\">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    html += `<a href=\"${withLangParam(`?id=${encodeURIComponent(value['location'])}`)}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div><div class=\"card-meta\">${dateHtml}</div>${tag}</a>`;
  }
  html += '</div>';
  // Pagination controls
  if (totalPages > 1) {
    const makeLink = (p, label, cls = '') => `<a class=\"${cls}\" href=\"${withLangParam(`?tab=posts&page=${p}`)}\">${label}</a>`;
    const makeSpan = (label, cls = '') => `<span class=\"${cls}\">${label}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, t('ui.prev'), 'page-prev') : makeSpan(t('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class=\"page-num active\">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, t('ui.next'), 'page-next') : makeSpan(t('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }
  document.getElementById('mainview').innerHTML = html;

  setupSearch(entries);
  renderTabs('posts');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = '';
  setDocTitle(t('titles.allPosts'));

  const cards = Array.from(document.querySelectorAll('.index a'));
  pageEntries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    getFile('wwwroot/' + loc).then(md => {
      const ex = extractExcerpt(md, 50);
      const el = cards[idx];
      if (!el) return;
      const exEl = el.querySelector('.card-excerpt');
      if (exEl) exEl.textContent = ex;
      // compute and render read time
      const minutes = computeReadTime(md, 200);
      const metaEl = el.querySelector('.card-meta');
      if (metaEl) {
        const dateEl = metaEl.querySelector('.card-date');
        const readHtml = `<span class=\"card-read\">${minutes} ${t('ui.minRead')}</span>`;
        if (dateEl && dateEl.textContent.trim()) {
          // add a separator dot if date exists
          metaEl.innerHTML = `${dateEl.outerHTML}<span class=\"card-sep\">•</span>${readHtml}`;
        } else {
          metaEl.innerHTML = readHtml;
        }
      }
    }).catch(() => {});
  });
}

function displaySearch(query) {
  const q = String(query || '').trim();
  if (!q) return displayIndex(postsIndexCache);

  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';

  // Filter by title or tags
  const allEntries = Object.entries(postsIndexCache || {});
  const ql = q.toLowerCase();
  const filtered = allEntries.filter(([title, meta]) => {
    const inTitle = String(title || '').toLowerCase().includes(ql);
    const tagVal = meta && meta.tag;
    let tagStr = '';
    if (Array.isArray(tagVal)) tagStr = tagVal.join(',');
    else if (typeof tagVal === 'string') tagStr = tagVal;
    else if (tagVal != null) tagStr = String(tagVal);
    const inTags = String(tagStr || '').toLowerCase().includes(ql);
    return inTitle || inTags;
  });

  const total = filtered.length;
  const qPage = parseInt(getQueryVariable('page') || '1', 10);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = isNaN(qPage) ? 1 : Math.min(Math.max(1, qPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageEntries = filtered.slice(start, end);

  let html = '<div class="index">';
  for (const [key, value] of pageEntries) {
    const tag = value ? renderTags(value.tag) : '';
    const cover = (value && value.image)
      ? `<div class=\"card-cover-wrap\"><img class=\"card-cover\" alt=\"${key}\" src=\"${cardImageSrc(value.image)}\"></div>`
      : fallbackCover(key);
    const hasDate = value && value.date;
    const dateHtml = hasDate ? `<span class=\"card-date\">${escapeHtml(formatDisplayDate(value.date))}</span>` : '';
    html += `<a href=\"${withLangParam(`?id=${encodeURIComponent(value['location'])}`)}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div><div class=\"card-meta\">${dateHtml}</div>${tag}</a>`;
  }
  html += '</div>';

  if (total === 0) {
    const backHref = withLangParam('?tab=posts');
    html = `<div class=\"notice\"><h3>${t('ui.noResultsTitle')}</h3><p>${t('ui.noResultsBody', escapeHtml(q))} <a href=\"${backHref}\">${t('ui.backToAllPosts')}</a>.</p></div>`;
  } else if (totalPages > 1) {
    const encQ = encodeURIComponent(q);
    const makeLink = (p, label, cls = '') => `<a class=\"${cls}\" href=\"${withLangParam(`?tab=search&q=${encQ}&page=${p}`)}\">${label}</a>`;
    const makeSpan = (label, cls = '') => `<span class=\"${cls}\">${label}</span>`;
    let pager = '<nav class="pagination" aria-label="Pagination">';
    pager += (page > 1) ? makeLink(page - 1, t('ui.prev'), 'page-prev') : makeSpan(t('ui.prev'), 'page-prev disabled');
    for (let i = 1; i <= totalPages; i++) {
      pager += (i === page) ? `<span class=\"page-num active\">${i}</span>` : makeLink(i, String(i), 'page-num');
    }
    pager += (page < totalPages) ? makeLink(page + 1, t('ui.next'), 'page-next') : makeSpan(t('ui.next'), 'page-next disabled');
    pager += '</nav>';
    html += pager;
  }

  document.getElementById('mainview').innerHTML = html;
  renderTabs('search', q);
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = '';
  const input = document.getElementById('searchInput');
  if (input) input.value = q;
  setupSearch(Object.entries(postsIndexCache || {}));
  setDocTitle(t('titles.search', q));

  const cards = Array.from(document.querySelectorAll('.index a'));
  pageEntries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    getFile('wwwroot/' + loc).then(md => {
      const ex = extractExcerpt(md, 50);
      const el = cards[idx];
      if (!el) return;
      const exEl = el.querySelector('.card-excerpt');
      if (exEl) exEl.textContent = ex;
      const minutes = computeReadTime(md, 200);
      const metaEl = el.querySelector('.card-meta');
      if (metaEl) {
        const dateEl = metaEl.querySelector('.card-date');
        const readHtml = `<span class=\"card-read\">${minutes} ${t('ui.minRead')}</span>`;
        if (dateEl && dateEl.textContent.trim()) {
          metaEl.innerHTML = `${dateEl.outerHTML}<span class=\"card-sep\">•</span>${readHtml}`;
        } else {
          metaEl.innerHTML = readHtml;
        }
      }
    }).catch(() => {});
  });
}

function displayStaticTab(slug) {
  const tab = tabsBySlug[slug];
  if (!tab) return displayIndex({});
  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
  renderTabs(slug);
  getFile('wwwroot/' + tab.location)
    .then(md => {
      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `wwwroot/${dir}`;
      const output = mdParse(md, baseDir);
      document.getElementById('mainview').innerHTML = output.post;
      const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
      setDocTitle((firstHeading && firstHeading.textContent) || tab.title);
    })
    .catch(() => {
      document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('errors.pageUnavailableTitle')}</h3><p>${t('errors.pageUnavailableBody')}</p></div>`;
      setDocTitle(t('ui.pageUnavailable'));
    });
}

// Simple router: render based on current URL
function routeAndRender() {
  const id = getQueryVariable('id');
  const tab = (getQueryVariable('tab') || 'posts').toLowerCase();
  const isValidId = (x) => typeof x === 'string' && !x.includes('..') && !x.startsWith('/') && !x.includes('\\') && allowedLocations.has(x);

  if (isValidId(id)) {
    renderTabs('post');
    displayPost(id);
  } else if (tab === 'search') {
    const q = getQueryVariable('q') || '';
    renderTabs('search', q);
    displaySearch(q);
  } else if (tab !== 'posts' && tabsBySlug[tab]) {
    displayStaticTab(tab);
  } else {
    renderTabs('posts');
    displayIndex(postsIndexCache);
  }
  // Keep footer nav in sync as route/tabs may impact labels
  renderFooterNav();
}

// Intercept in-app navigation and use History API
function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a') : null;
  if (!a) return;
  if (isModifiedClick(e)) return;
  const hrefAttr = a.getAttribute('href') || '';
  // Allow any in-page hash links (e.g., '#', '#heading' or '?id=...#heading')
  if (hrefAttr.includes('#')) return;
  // External targets or explicit new tab
  if (a.target && a.target === '_blank') return;
  try {
    const url = new URL(a.href, window.location.href);
    // Only handle same-origin and same-path navigations
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== window.location.pathname) return;
    const sp = url.searchParams;
    const hasInAppParams = sp.has('id') || sp.has('tab') || url.search === '';
    if (!hasInAppParams) return;
    e.preventDefault();
    history.pushState({}, '', url.toString());
    routeAndRender();
    window.scrollTo(0, 0);
  } catch (_) {
    // If URL parsing fails, fall through to default navigation
  }
});

window.addEventListener('popstate', () => {
  routeAndRender();
});

// Boot
// Boot sequence overview:
// 1) Initialize i18n (detects ?lang → localStorage → browser → default or <html lang>)
// 2) Mount theme tools and apply saved theme
// 3) Load localized index/tabs JSON with fallback chain and render
// Initialize i18n first so localized UI renders correctly
const defaultLang = (document.documentElement && document.documentElement.getAttribute('lang')) || 'en';
initI18n({ defaultLang });

// Ensure theme controls are present, then apply and bind
mountThemeControls();
applySavedTheme();
bindThemeToggle();
bindThemePackPicker();

Promise.allSettled([
  loadLangJson('wwwroot', 'index'),
  loadLangJson('wwwroot', 'tabs')
])
  .then(results => {
    const posts = results[0].status === 'fulfilled' ? (results[0].value || {}) : {};
    const tabs = results[1].status === 'fulfilled' ? (results[1].value || {}) : {};
    tabsBySlug = {};
    for (const [title, cfg] of Object.entries(tabs)) {
      const slug = slugifyTab(title);
      const loc = typeof cfg === 'string' ? cfg : String(cfg.location || '');
      if (!loc) continue;
      tabsBySlug[slug] = { title, location: loc };
    }
    allowedLocations = new Set(Object.values(posts).map(v => String(v.location)));
    postsByLocationTitle = {};
    for (const [title, meta] of Object.entries(posts)) {
      if (meta && meta.location) postsByLocationTitle[meta.location] = title;
    }
    postsIndexCache = posts;
    routeAndRender();
  })
  .catch(() => {
    document.getElementById('tocview').innerHTML = '';
    document.getElementById('mainview').innerHTML = `<div class=\"notice error\"><h3>${t('ui.indexUnavailable')}</h3><p>${t('errors.indexUnavailableBody')}</p></div>`;
  });

// Footer: set dynamic year once
try {
  const y = document.getElementById('footerYear');
  if (y) y.textContent = String(new Date().getFullYear());
  const top = document.getElementById('footerTop');
  if (top) {
    top.textContent = t('ui.top');
    top.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
} catch (_) {}
