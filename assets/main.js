import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindThemePackPicker, mountThemeControls, refreshLanguageSelector } from './js/theme.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, setBaseSiteTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, escapeHtml, formatDisplayDate } from './js/utils.js';
import { initI18n, t, withLangParam, loadLangJson, loadContentJson, loadTabsJson, getCurrentLang } from './js/i18n.js';
import { updateSEO, extractSEOFromMarkdown } from './js/seo.js';

// Lightweight fetch helper
const getFile = (filename) => fetch(filename).then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });

let postsByLocationTitle = {};
let tabsBySlug = {};
let postsIndexCache = {};
let allowedLocations = new Set();
const PAGE_SIZE = 8;

// --- Site config (root-level site.json) ---
let siteConfig = {};
async function loadSiteConfig() {
  try {
    const r = await fetch('site.json');
    if (!r.ok) return {};
    return await r.json();
  } catch (_) { return {}; }
}

function renderSiteLinks(cfg) {
  try {
    const root = document.querySelector('.site-card .social-links');
    if (!root) return;
    const linksVal = (cfg && (cfg.profileLinks || cfg.links)) || [];
    let items = [];
    if (Array.isArray(linksVal)) {
      items = linksVal
        .filter(x => x && x.href && x.label)
        .map(x => ({ href: String(x.href), label: String(x.label) }));
    } else if (linksVal && typeof linksVal === 'object') {
      items = Object.entries(linksVal).map(([label, href]) => ({ label: String(label), href: String(href) }));
    }
    if (!items.length) return;
    const sep = '<span class="link-sep">•</span>';
    const anchors = items.map(({ href, label }) => `<a href="${escapeHtml(href)}" target="_blank" rel="me noopener">${escapeHtml(label)}</a>`);
    root.innerHTML = `<li>${anchors.join(sep)}</li>`;
  } catch (_) { /* noop */ }
}

function renderSiteIdentity(cfg) {
  try {
    if (!cfg) return;
    const pick = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const lang = getCurrentLang && getCurrentLang();
        const langVal = (lang && val[lang]) || val.default || '';
        return typeof langVal === 'string' ? langVal : '';
      }
      return '';
    };
    const title = pick(cfg.siteTitle);
    const subtitle = pick(cfg.siteSubtitle);
    const avatar = pick(cfg.avatar);
    if (title) {
      const el = document.querySelector('.site-card .site-title');
      if (el) el.textContent = title;
      const fs = document.querySelector('.footer-site');
      if (fs) fs.textContent = title;
    }
    if (subtitle) {
      const el2 = document.querySelector('.site-card .site-subtitle');
      if (el2) el2.textContent = subtitle;
    }
    if (avatar) {
      const img = document.querySelector('.site-card .avatar');
      if (img) img.setAttribute('src', avatar);
    }
  } catch (_) { /* noop */ }
}

// Ensure images defer offscreen loading for performance
function applyLazyLoadingIn(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return;
    const imgs = root.querySelectorAll('img');
    imgs.forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  } catch (_) {}
}

// Fade-in covers when each image loads; remove placeholder per-card
function hydrateCardCovers(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const wraps = root.querySelectorAll('.index .card-cover-wrap');
    wraps.forEach(wrap => {
      const img = wrap.querySelector('img.card-cover');
      if (!img) return;
      const ph = wrap.querySelector('.ph-skeleton');
      const done = () => {
        img.classList.add('is-loaded');
        if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
      };
      if (img.complete && img.naturalWidth > 0) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => { if (ph && ph.parentNode) ph.parentNode.removeChild(ph); img.style.opacity = '1'; }, { once: true });
    });
  } catch (_) {}
}

// Enhance post images: wrap with a reserved-ratio container + skeleton, fade-in when loaded
function hydratePostImages(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const candidates = Array.from(root.querySelectorAll('img'))
      .filter(img => !img.classList.contains('card-cover'))
      .filter(img => !img.closest('table'));
    candidates.forEach(img => {
      // Skip if already in a wrapper
      if (img.closest('.post-image-wrap')) return;
      // If the image lives inside a paragraph with other text, avoid restructuring
      const p = img.parentElement && img.parentElement.tagName === 'P' ? img.parentElement : null;
      if (p) {
        const onlyThisImg = (p.childElementCount === 1) && (p.textContent.trim() === '');
        if (!onlyThisImg) return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'post-image-wrap';
      // Prefer explicit attributes for ratio if present
      const wAttr = parseInt(img.getAttribute('width') || '', 10);
      const hAttr = parseInt(img.getAttribute('height') || '', 10);
      if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
        wrap.style.aspectRatio = `${wAttr} / ${hAttr}`;
      }
      const ph = document.createElement('div');
      ph.className = 'ph-skeleton';
      ph.setAttribute('aria-hidden', 'true');

      // Move image inside wrapper
      const targetParent = p || img.parentElement;
      if (!targetParent) return;
      targetParent.insertBefore(wrap, img);
      wrap.appendChild(ph);
      wrap.appendChild(img);

      img.classList.add('post-img');
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

      const src = img.getAttribute('src');
      if (src) {
        img.setAttribute('data-src', src);
        img.removeAttribute('src');
      }

      const done = () => {
        // Set exact ratio once we know it
        if (img.naturalWidth && img.naturalHeight) {
          wrap.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        }
        img.classList.add('is-loaded');
        if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
      };
      if (img.complete && img.naturalWidth > 0) { done(); }
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', () => { if (ph && ph.parentNode) ph.parentNode.removeChild(ph); img.style.opacity = '1'; }, { once: true });
      }

      // Kick off load after wiring handlers
      const ds = img.getAttribute('data-src');
      if (ds) img.src = ds;
    });
  } catch (_) {}
}

// Load cover images sequentially to reduce bandwidth contention
function sequentialLoadCovers(container, maxConcurrent = 1) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll('.index img.card-cover'));
    let idx = 0;
    let active = 0;
    const startNext = () => {
      while (active < maxConcurrent && idx < imgs.length) {
        const img = imgs[idx++];
        if (!img || !img.isConnected) continue;
        const src = img.getAttribute('data-src');
        if (!src) continue;
        active++;
        const done = () => { active--; img.removeEventListener('load', done); img.removeEventListener('error', done); startNext(); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        // Kick off the actual request
        img.src = src;
      }
    };
    startNext();
  } catch (_) {}
}

function renderSkeletonArticle() {
  return `
    <div class="skeleton-article" aria-busy="true" aria-live="polite">
      <div class="skeleton-block skeleton-title w-70"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-85"></div>
      <div class="skeleton-block skeleton-line w-40"></div>
      <div class="skeleton-block skeleton-image w-100"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-80"></div>
      <div class="skeleton-block skeleton-line w-60"></div>
      <div style="margin: 20px 0;">
        <div class="skeleton-block skeleton-line w-30" style="height: 20px; margin-bottom: 12px;"></div>
        <div class="skeleton-block skeleton-line w-85"></div>
        <div class="skeleton-block skeleton-line w-75"></div>
        <div class="skeleton-block skeleton-line w-90"></div>
      </div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-80"></div>
      <div class="skeleton-block skeleton-line w-45"></div>
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
  // Add loading-state classes to keep layout stable
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  if (contentEl) contentEl.classList.add('loading', 'layout-stable');
  if (sidebarEl) sidebarEl.classList.add('loading');
  if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
  
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
    // Remove loading-state classes
    if (contentEl) contentEl.classList.remove('loading');
    if (sidebarEl) sidebarEl.classList.remove('loading');
    
    const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
    const baseDir = `wwwroot/${dir}`;
    const output = mdParse(markdown, baseDir);
    // Render main content first so we can read the first heading reliably
    const mainEl = document.getElementById('mainview');
    if (mainEl) mainEl.innerHTML = output.post;
    try { hydratePostImages('#mainview'); } catch (_) {}
    try { applyLazyLoadingIn('#mainview'); } catch (_) {}
    const fallback = postsByLocationTitle[postname] || postname;
    const articleTitle = getArticleTitleFromMain() || fallback;
    
    // Update SEO meta tags for the post
    const postMetadata = (Object.values(postsIndexCache || {}) || []).find(p => p && p.location === postname) || {};
    try {
      const seoData = extractSEOFromMarkdown(markdown, { 
        ...postMetadata, 
        title: articleTitle 
      }, siteConfig);
      updateSEO(seoData, siteConfig);
    } catch (_) { /* ignore SEO errors */ }
    
    renderTabs('post', articleTitle);
    const toc = document.getElementById('tocview');
    if (toc) {
      toc.style.display = '';
      toc.innerHTML = `<div class=\"toc-header\"><span>${escapeHtml(articleTitle)}</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">${t('ui.top')}</a></div>${output.toc}`;
    }
    const searchBox = document.getElementById('searchbox');
    if (searchBox) searchBox.style.display = 'none';
    try { setDocTitle(articleTitle); } catch (_) {}
    try { setupAnchors(); } catch (_) {}
    try { setupTOC(); } catch (_) {}
    // If URL contains a hash, ensure we jump after content is in DOM
    const currentHash = (location.hash || '').replace(/^#/, '');
    if (currentHash) {
      const target = document.getElementById(currentHash);
      if (target) {
        requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); });
      }
    }
  }).catch(() => {
    // Remove loading-state classes even on error
    if (contentEl) contentEl.classList.remove('loading');
    if (sidebarEl) sidebarEl.classList.remove('loading');
    
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
    // Prefer a smaller thumbnail if provided: `thumb` or `cover`; fallback to `image`
    const coverSrc = value && (value.thumb || value.cover || value.image);
    const cover = (value && coverSrc)
      ? `<div class=\"card-cover-wrap\"><div class=\"ph-skeleton\" aria-hidden=\"true\"></div><img class=\"card-cover\" alt=\"${key}\" data-src=\"${cardImageSrc(coverSrc)}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" width=\"1600\" height=\"1000\"></div>`
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
  hydrateCardCovers('#mainview');
  applyLazyLoadingIn('#mainview');
  sequentialLoadCovers('#mainview', 1);

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
    const coverSrc = value && (value.thumb || value.cover || value.image);
    const cover = (value && coverSrc)
      ? `<div class=\"card-cover-wrap\"><div class=\"ph-skeleton\" aria-hidden=\"true\"></div><img class=\"card-cover\" alt=\"${key}\" data-src=\"${cardImageSrc(coverSrc)}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" width=\"1600\" height=\"1000\"></div>`
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
  hydrateCardCovers('#mainview');
  sequentialLoadCovers('#mainview', 1);
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
  
  // Add loading state class to maintain layout stability
  const contentEl = document.querySelector('.content');
  const sidebarEl = document.querySelector('.sidebar');
  const mainviewContainer = document.getElementById('mainview')?.closest('.box');
  
  if (contentEl) contentEl.classList.add('loading', 'layout-stable');
  if (sidebarEl) sidebarEl.classList.add('loading');
  if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
  
  const toc = document.getElementById('tocview');
  if (toc) { toc.innerHTML = ''; toc.style.display = 'none'; }
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
  renderTabs(slug);
  getFile('wwwroot/' + tab.location)
    .then(md => {
      // 移除加载状态类
      if (contentEl) contentEl.classList.remove('loading');
      if (sidebarEl) sidebarEl.classList.remove('loading');
      
      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `wwwroot/${dir}`;
      const output = mdParse(md, baseDir);
      const mv = document.getElementById('mainview');
      if (mv) mv.innerHTML = output.post;
      try { hydratePostImages('#mainview'); } catch (_) {}
      try { applyLazyLoadingIn('#mainview'); } catch (_) {}
      const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
      const pageTitle = (firstHeading && firstHeading.textContent && firstHeading.textContent.trim()) || tab.title;
      
      // Update SEO meta tags for the tab page
      try {
        const seoData = extractSEOFromMarkdown(md, { 
          title: pageTitle,
          author: tab.author || 'NanoSite'
        }, siteConfig);
        updateSEO(seoData, siteConfig);
      } catch (_) {}
      
      try { setDocTitle(pageTitle); } catch (_) {}
    })
    .catch(() => {
      // 移除加载状态类，即使出错也要移除
      if (contentEl) contentEl.classList.remove('loading');
      if (sidebarEl) sidebarEl.classList.remove('loading');
      
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
    // Update SEO for search page
    try {
      updateSEO({
        title: q ? `Search: ${q} - NanoSite` : 'Search - NanoSite',
        description: q ? `Search results for "${q}"` : 'Search through blog posts and content',
        type: 'website'
      }, siteConfig);
    } catch (_) { /* ignore SEO errors to avoid breaking UI */ }
  } else if (tab !== 'posts' && tabsBySlug[tab]) {
    displayStaticTab(tab);
  } else {
    renderTabs('posts');
    displayIndex(postsIndexCache);
    // Update SEO for home/posts page
    const page = parseInt(getQueryVariable('page') || '1', 10);
    const lang = getCurrentLang && getCurrentLang();
    const getLocalizedValue = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      return (lang && val[lang]) || val.default || '';
    };
    
    try {
      updateSEO({
        title: page > 1 ? 
          `${getLocalizedValue(siteConfig.siteTitle) || 'All Posts'} - Page ${page}` : 
          getLocalizedValue(siteConfig.siteTitle) || 'NanoSite - Zero-Dependency Static Blog',
        description: getLocalizedValue(siteConfig.siteDescription) || 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.',
        type: 'website',
        url: window.location.href
      }, siteConfig);
    } catch (_) { /* ignore SEO errors to avoid breaking UI */ }
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
  // Load transformed posts index for current UI language
  loadContentJson('wwwroot', 'index'),
  // Load tabs (may be unified or legacy)
  loadTabsJson('wwwroot', 'tabs'),
  // Load site config
  loadSiteConfig(),
  // Also fetch the raw index.json to collect all variant locations across languages
  (async () => {
    try {
      const r = await fetch('wwwroot/index.json');
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  })()
])
  .then(results => {
    const posts = results[0].status === 'fulfilled' ? (results[0].value || {}) : {};
    const tabs = results[1].status === 'fulfilled' ? (results[1].value || {}) : {};
    siteConfig = results[2] && results[2].status === 'fulfilled' ? (results[2].value || {}) : {};
    const rawIndex = results[3] && results[3].status === 'fulfilled' ? (results[3].value || null) : null;
    tabsBySlug = {};
    for (const [title, cfg] of Object.entries(tabs)) {
      const slug = slugifyTab(title);
      const loc = typeof cfg === 'string' ? cfg : String(cfg.location || '');
      if (!loc) continue;
      tabsBySlug[slug] = { title, location: loc };
    }
    // Build a whitelist of allowed post file paths. Start with the current-language
    // transformed entries, then include any language-variant locations discovered
    // from the raw unified index.json (if present).
    const baseAllowed = new Set(Object.values(posts).map(v => String(v.location)));
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      try {
        for (const [, entry] of Object.entries(rawIndex)) {
          if (!entry || typeof entry !== 'object') continue;
          for (const [k, v] of Object.entries(entry)) {
            // Skip known non-variant keys
            if (['tag','tags','image','date','excerpt','thumb','cover'].includes(k)) continue;
            // Support both unified and legacy shapes
            if (k === 'location' && typeof v === 'string') { baseAllowed.add(String(v)); continue; }
            if (v && typeof v === 'object' && typeof v.location === 'string') baseAllowed.add(String(v.location));
            else if (typeof v === 'string') baseAllowed.add(String(v));
          }
        }
      } catch (_) { /* ignore parse issues */ }
    }
    allowedLocations = baseAllowed;
    postsByLocationTitle = {};
    for (const [title, meta] of Object.entries(posts)) {
      if (meta && meta.location) postsByLocationTitle[meta.location] = title;
    }
    postsIndexCache = posts;
    // Reflect available content languages in the UI selector (for unified index)
    try { refreshLanguageSelector(); } catch (_) {}
    // Render site identity and profile links from site config
    try {
      renderSiteIdentity(siteConfig);
      // Also update the base document title (tab suffix) from config
      const cfgTitle = (function pick(val){
        if (!val) return '';
        if (typeof val === 'string') return val;
        const lang = getCurrentLang && getCurrentLang();
        const v = (lang && val[lang]) || val.default || '';
        return typeof v === 'string' ? v : '';
      })(siteConfig && siteConfig.siteTitle);
      if (cfgTitle) setBaseSiteTitle(cfgTitle);
    } catch (_) {}
    try { renderSiteLinks(siteConfig); } catch (_) {}
    
    // Set up default SEO with site config
    try {
      const lang = getCurrentLang && getCurrentLang();
      const getLocalizedValue = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return (lang && val[lang]) || val.default || '';
      };
      
      // Update initial page meta tags with site config
      updateSEO({
        title: getLocalizedValue(siteConfig.siteTitle) || 'NanoSite - Zero-Dependency Static Blog',
        description: getLocalizedValue(siteConfig.siteDescription) || 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.',
        type: 'website',
        url: window.location.href
      }, siteConfig);
    } catch (_) {}
    
    // 为mainview容器添加稳定性类
    const mainviewContainer = document.getElementById('mainview')?.closest('.box');
    if (mainviewContainer) mainviewContainer.classList.add('mainview-container');
    
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
