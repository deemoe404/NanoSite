import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle, bindSeoGenerator, bindThemePackPicker, mountThemeControls, refreshLanguageSelector, applyThemeConfig } from './js/theme.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt, computeReadTime } from './js/content.js';
import { getQueryVariable, setDocTitle, setBaseSiteTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab, escapeHtml, formatDisplayDate } from './js/utils.js';
import { initI18n, t, withLangParam, loadLangJson, loadContentJson, loadTabsJson, getCurrentLang } from './js/i18n.js';
import { updateSEO, extractSEOFromMarkdown } from './js/seo.js';
import { initErrorReporter, setReporterContext } from './js/errors.js';

// Lightweight fetch helper
const getFile = (filename) => fetch(filename).then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });

let postsByLocationTitle = {};
let tabsBySlug = {};
let postsIndexCache = {};
let allowedLocations = new Set();
const PAGE_SIZE = 8;

// --- UI helpers: smooth show/hide (height + opacity) ---
function prefersReducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
}

function smoothShow(el) {
  if (!el) return;
  const cs = window.getComputedStyle(el);
  if (cs.display !== 'none') { el.setAttribute('aria-hidden', 'false'); return; }
  if (prefersReducedMotion()) { el.style.display = 'block'; el.setAttribute('aria-hidden', 'false'); return; }
  // Restore margin/padding if previously saved, else use computed
  const savedMargin = el.dataset.prevMarginBottom || cs.marginBottom || '1.25rem';
  const savedPadTop = el.dataset.prevPaddingTop || cs.paddingTop || '1.25rem';
  const savedPadBottom = el.dataset.prevPaddingBottom || cs.paddingBottom || '1.25rem';
  // Persist for next cycle
  el.dataset.prevPaddingTop = savedPadTop;
  el.dataset.prevPaddingBottom = savedPadBottom;
  const prevMin = cs.minHeight;
  el.dataset.prevMinHeight = prevMin;
  el.style.display = 'block';
  el.style.overflow = 'hidden';
  el.style.minHeight = '0px';
  // Start with collapsed paddings and size
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  el.style.height = '0px';
  el.style.marginBottom = '0px';
  el.style.opacity = '0';
  el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
  // Measure target height including padding: temporarily set paddings
  el.style.paddingTop = savedPadTop;
  el.style.paddingBottom = savedPadBottom;
  void el.getBoundingClientRect();
  const target = el.scrollHeight;
  // Reset to collapsed paddings before animating
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  // Animate
  const HEIGHT_MS = 240; const MARGIN_MS = 240; const PADDING_MS = 240; const OPACITY_MS = 180; const BUFFER_MS = 80;
  el.style.transition = `height ${HEIGHT_MS}ms ease, margin-bottom ${MARGIN_MS}ms ease, padding-top ${PADDING_MS}ms ease, padding-bottom ${PADDING_MS}ms ease, opacity ${OPACITY_MS}ms ease-out`;
  el.style.height = target + 'px';
  el.style.paddingTop = savedPadTop;
  el.style.paddingBottom = savedPadBottom;
  el.style.marginBottom = savedMargin;
  el.style.opacity = '1';
  el.setAttribute('aria-hidden', 'false');
  const ended = new Set();
  let done = false;
  const finalize = () => {
    if (done) return; done = true;
    el.style.transition = '';
    el.style.height = '';
    el.style.overflow = '';
    el.style.willChange = '';
    el.style.minHeight = '';
    el.style.opacity = '';
    el.style.marginBottom = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.removeEventListener('transitionend', onEnd);
  };
  const onEnd = (e) => {
    if (!e || typeof e.propertyName !== 'string') return;
    const p = e.propertyName.trim();
    if (p === 'height' || p === 'padding-bottom') {
      ended.add(p);
      if (ended.has('height') && ended.has('padding-bottom')) finalize();
    }
  };
  el.addEventListener('transitionend', onEnd);
  // Fallback in case a transitionend is missed
  setTimeout(finalize, Math.max(HEIGHT_MS, PADDING_MS) + BUFFER_MS);
}

function smoothHide(el, onDone) {
  if (!el) return;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none') { el.setAttribute('aria-hidden', 'true'); if (typeof onDone === 'function') onDone(); return; }
  if (prefersReducedMotion()) { el.style.display = 'none'; el.setAttribute('aria-hidden', 'true'); if (typeof onDone === 'function') onDone(); return; }
  // Save current margin-bottom to restore on show
  el.dataset.prevMarginBottom = cs.marginBottom;
  el.dataset.prevPaddingTop = cs.paddingTop;
  el.dataset.prevPaddingBottom = cs.paddingBottom;
  const prevMin = cs.minHeight;
  el.dataset.prevMinHeight = prevMin;
  const startHeight = el.scrollHeight;
  el.style.overflow = 'hidden';
  el.style.minHeight = '0px';
  el.style.height = startHeight + 'px';
  el.style.marginBottom = cs.marginBottom;
  el.style.paddingTop = cs.paddingTop;
  el.style.paddingBottom = cs.paddingBottom;
  el.style.opacity = '1';
  el.style.willChange = 'height, margin-bottom, padding-top, padding-bottom, opacity';
  // Reflow then collapse
  void el.getBoundingClientRect();
  const HEIGHT_MS = 240; const MARGIN_MS = 240; const PADDING_MS = 240; const OPACITY_MS = 180; const BUFFER_MS = 80;
  el.style.transition = `height ${HEIGHT_MS}ms ease, margin-bottom ${MARGIN_MS}ms ease, padding-top ${PADDING_MS}ms ease, padding-bottom ${PADDING_MS}ms ease, opacity ${OPACITY_MS}ms ease-out`;
  el.style.height = '0px';
  el.style.marginBottom = '0px';
  el.style.paddingTop = '0px';
  el.style.paddingBottom = '0px';
  el.style.opacity = '0';
  el.setAttribute('aria-hidden', 'true');
  let done = false;
  const ended = new Set();
  const finalize = () => {
    if (done) return; done = true;
    el.style.display = 'none';
    el.style.transition = '';
    el.style.height = '';
    el.style.opacity = '';
    el.style.overflow = '';
    el.style.willChange = '';
    el.style.minHeight = '';
    el.style.marginBottom = '';
    el.removeEventListener('transitionend', onEnd);
    if (typeof onDone === 'function') try { onDone(); } catch (_) {}
  };
  const onEnd = (e) => {
    if (!e || typeof e.propertyName !== 'string') return;
    const p = e.propertyName.trim();
    if (p === 'height' || p === 'margin-bottom' || p === 'padding-bottom') {
      ended.add(p);
      if (ended.has('height') && ended.has('margin-bottom') && ended.has('padding-bottom')) finalize();
    }
  };
  el.addEventListener('transitionend', onEnd);
  // Fallback in case transitionend is missed on some properties
  setTimeout(finalize, Math.max(HEIGHT_MS, MARGIN_MS, PADDING_MS) + BUFFER_MS);
}

// Ensure element height fully resets to its natural auto height
function ensureAutoHeight(el) {
  if (!el) return;
  try {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.height = '';
        el.style.minHeight = '';
        el.style.overflow = '';
      });
    });
  } catch (_) {}
}

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
    const wraps = root.querySelectorAll('.index .card-cover-wrap, .link-card .card-cover-wrap');
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
      // Kick off loading immediately for link-card covers (index covers are loaded sequentially elsewhere)
      const inIndex = !!wrap.closest('.index');
      const ds = img.getAttribute('data-src');
      if (!inIndex && ds && !img.getAttribute('src')) {
        img.src = ds;
      }
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

// Capture first frame from post videos to use as a poster when none is provided
function hydratePostVideos(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
  const videos = Array.from(root.querySelectorAll('video.post-video'));
    if (!videos.length) return;

    const timeout = (ms) => new Promise(res => setTimeout(res, ms));

  const capturePoster = async (video) => {
      if (!video || video.getAttribute('poster')) return; // already has poster
      if (video.dataset.posterGenerated) return; // avoid duplicate work
      video.dataset.posterGenerated = '1';
      try {
        // Ensure metadata is available
    if (!(video.videoWidth > 0 && video.videoHeight > 0)) {
          await Promise.race([
            new Promise(res => video.addEventListener('loadedmetadata', () => res(), { once: true })),
            timeout(4000)
          ]);
        }

        const w = Math.max(1, video.videoWidth || 0);
        const h = Math.max(1, video.videoHeight || 0);
        if (!(w > 1 && h > 1)) return;

        // Nudge to first frame to force frame availability under metadata-only preload
        const originalTime = video.currentTime;
        let seeked = false;
        try { video.pause?.(); } catch (_) {}
        try {
          const target = 0.000001;
          if (Math.abs((video.currentTime || 0) - target) > 1e-6) video.currentTime = target;
          await Promise.race([
            new Promise(res => video.addEventListener('seeked', () => { seeked = true; res(); }, { once: true })),
            new Promise(res => video.addEventListener('loadeddata', () => res(), { once: true })),
            timeout(4000)
          ]);
        } catch (_) { /* ignore */ }

        // Some browsers require readyState >= HAVE_CURRENT_DATA before drawing
        if (!(video.readyState >= 2)) {
          await Promise.race([
            new Promise(res => video.addEventListener('loadeddata', () => res(), { once: true })),
            timeout(2000)
          ]);
        }

        // If still not drawable, try a one-time preload bump to fetch a keyframe
        if (!(video.readyState >= 2)) {
          const prevPreload = video.getAttribute('preload') || '';
          try { video.setAttribute('preload', 'auto'); video.load(); } catch (_) {}
          await Promise.race([
            new Promise(res => video.addEventListener('loadeddata', () => res(), { once: true })),
            timeout(4000)
          ]);
          if (prevPreload) video.setAttribute('preload', prevPreload);
        }

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) return;
  try { ctx.drawImage(video, 0, 0, w, h); } catch (_) { return; }

        // Prefer WebP; fallback to JPEG for older browsers
        let dataUrl = '';
        try { dataUrl = canvas.toDataURL('image/webp', 0.85); } catch (_) {}
        if (!dataUrl || dataUrl.length < 32) {
          try { dataUrl = canvas.toDataURL('image/jpeg', 0.85); } catch (_) { dataUrl = ''; }
        }
        if (dataUrl) video.setAttribute('poster', dataUrl);

        // Restore time if we changed it
        if (seeked && typeof originalTime === 'number' && Math.abs(originalTime) > 1e-6) {
          try { video.currentTime = originalTime; } catch (_) {}
        }
      } catch (_) { /* noop */ }
      finally {
        // Remove placeholder if present
        try {
          const wrap = video.closest('.post-video-wrap');
          const ph = wrap && wrap.querySelector('.ph-skeleton');
          if (ph) ph.remove();
        } catch (_) {}
      }
    };

    // Defer work until near viewport for better perf
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const v = e.target;
            io.unobserve(v);
            if (!v.getAttribute('poster')) capturePoster(v);
            else {
              // Poster already present, just remove placeholder
              const wrap = v.closest('.post-video-wrap');
              const ph = wrap && wrap.querySelector('.ph-skeleton');
              if (ph) ph.remove();
            }
          }
        });
      }, { rootMargin: '200px' });
      videos.forEach(v => io.observe(v));
    } else {
      videos.forEach(v => { if (!v.getAttribute('poster')) capturePoster(v); else { const wrap = v.closest('.post-video-wrap'); const ph = wrap && wrap.querySelector('.ph-skeleton'); if (ph) ph.remove(); } });
    }
  } catch (_) {}
}

// Transform standalone internal links (?id=...) into rich article cards
function hydrateInternalLinkCards(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const anchors = Array.from(root.querySelectorAll('a[href^="?id="]'));
    if (!anchors.length) return;

    const isWhitespaceOnlySiblings = (el) => {
      const p = el && el.parentNode;
      if (!p) return false;
      const nodes = Array.from(p.childNodes || []);
      return nodes.every(n => (n === el) || (n.nodeType === Node.TEXT_NODE && !String(n.textContent || '').trim()));
    };

    const parseId = (href) => {
      try { const u = new URL(href, window.location.href); return u.searchParams.get('id'); } catch (_) { return null; }
    };

    // Simple cache to avoid refetching the same markdown multiple times per page
    const mdCache = new Map(); // location -> Promise<string>

    anchors.forEach(a => {
      const loc = parseId(a.getAttribute('href') || '');
      if (!loc || !allowedLocations.has(loc)) return;

      // Only convert when link is the only content in its block container (p/li/div)
      const parent = a.parentElement;
      const isStandalone = parent && ['P', 'LI', 'DIV'].includes(parent.tagName) && isWhitespaceOnlySiblings(a);
      const titleAttr = (a.getAttribute('title') || '').trim();
      const forceCard = /\b(card|preview)\b/i.test(titleAttr) || a.hasAttribute('data-card') || a.classList.contains('card');
      if (!isStandalone && !forceCard) return;

      // Lookup metadata from loaded index cache
      const title = postsByLocationTitle[loc] || loc;
      const meta = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => v && v.location === loc)?.[1] || {};
      const href = withLangParam(`?id=${encodeURIComponent(loc)}`);
      const tagsHtml = meta ? renderTags(meta.tag) : '';
      const dateHtml = meta && meta.date ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
      const coverSrc = meta && (meta.thumb || meta.cover || meta.image);
      const cover = (coverSrc)
        ? `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(title)}" data-src="${cardImageSrc(coverSrc)}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`
        : fallbackCover(title);

      const wrapper = document.createElement('div');
      wrapper.className = 'link-card-wrap';
      wrapper.innerHTML = `<a class="link-card" href="${href}">${cover}<div class="card-title">${escapeHtml(title)}</div><div class="card-excerpt">${t('ui.loading')}</div><div class="card-meta">${dateHtml}</div>${tagsHtml}</a>`;

      // Placement rules:
      // - If standalone in LI: replace the anchor to keep list structure
      // - If standalone in P/DIV: replace the container with the card
      // - If forced (title contains 'card' or similar) but not standalone:
      //   insert the card right after the parent block, remove the anchor;
      //   if the parent becomes empty, remove it too.
      if (parent.tagName === 'LI' && isStandalone) {
        a.replaceWith(wrapper);
      } else if (isStandalone && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        const target = parent;
        target.parentNode.insertBefore(wrapper, target);
        target.remove();
      } else {
        // forced-card, inline inside a block
        const after = parent.nextSibling;
        parent.parentNode.insertBefore(wrapper, after);
        // remove the anchor from inline text
        a.remove();
        // if paragraph becomes empty/whitespace, remove it
        if (!parent.textContent || !parent.textContent.trim()) {
          parent.remove();
        }
      }

      // Lazy-hydrate cover image
      hydrateCardCovers(wrapper);

      // Fetch markdown to compute excerpt + read time
      const ensureMd = (l) => {
        if (!mdCache.has(l)) mdCache.set(l, getFile('wwwroot/' + l).catch(() => ''));
        return mdCache.get(l);
      };
      ensureMd(loc).then(md => {
        if (!wrapper.isConnected) return;
        const ex = extractExcerpt(md, 50);
        const minutes = computeReadTime(md, 200);
        const card = wrapper.querySelector('a.link-card');
        if (!card) return;
        const exEl = card.querySelector('.card-excerpt');
        if (exEl) exEl.textContent = ex;
        const metaEl = card.querySelector('.card-meta');
        if (metaEl) {
          const readHtml = `<span class="card-read">${minutes} ${t('ui.minRead')}</span>`;
          if (metaEl.querySelector('.card-date')) {
            const dEl = metaEl.querySelector('.card-date');
            metaEl.innerHTML = `${dEl.outerHTML}<span class="card-sep">•</span>${readHtml}`;
          } else {
            metaEl.innerHTML = readHtml;
          }
        }
      }).catch(() => {});
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
      <div style="margin: 1.25rem 0;">
        <div class="skeleton-block skeleton-line w-30" style="height: 1.25rem; margin-bottom: 0.75rem;"></div>
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

// Render a metadata card (title/date/read time/tags) for the current post
function renderPostMetaCard(title, meta, markdown) {
  try {
    const safeTitle = escapeHtml(String(title || ''));
    const hasDate = meta && meta.date;
    const dateHtml = hasDate ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
    let readHtml = '';
    try {
      const minutes = computeReadTime(String(markdown || ''), 200);
      readHtml = `<span class="card-read">${minutes} ${t('ui.minRead')}</span>`;
    } catch (_) {}
    const parts = [];
    if (dateHtml) parts.push(dateHtml);
    if (readHtml) parts.push(readHtml);
    const metaLine = parts.length ? `<div class="post-meta-line">${parts.join('<span class="card-sep">•</span>')}</div>` : '';
    const excerptHtml = (meta && meta.excerpt) ? `<div class="post-meta-excerpt">${escapeHtml(String(meta.excerpt))}</div>` : '';
    const tags = meta ? renderTags(meta.tag) : '';
    return `<section class="post-meta-card" aria-label="Post meta">
      <div class="post-meta-title">${safeTitle}</div>
      ${metaLine}
      ${excerptHtml}
      ${tags || ''}
    </section>`;
  } catch (_) {
    return '';
  }
}

// Render an outdated warning card if the post date exceeds the configured threshold
function renderOutdatedCard(meta) {
  try {
    const hasDate = meta && meta.date;
    if (!hasDate) return '';
    const published = new Date(String(meta.date));
    if (isNaN(published.getTime())) return '';
    const diffDays = Math.floor((Date.now() - published.getTime()) / (1000 * 60 * 60 * 24));
    const threshold = (siteConfig && Number.isFinite(Number(siteConfig.contentOutdatedDays))) ? Number(siteConfig.contentOutdatedDays) : 180;
    if (diffDays < threshold) return '';
    return `<section class="post-outdated-card" role="note">
      <div class="post-outdated-content">${t('ui.outdatedWarning')}</div>
      <button type="button" class="post-outdated-close" aria-label="${t('ui.close')}" title="${t('ui.close')}">×</button>
    </section>`;
  } catch (_) { return ''; }
}

let hasInitiallyRendered = false;

function renderTabs(activeSlug, searchQuery) {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;
  
  const make = (slug, label) => {
    const href = withLangParam(`?tab=${encodeURIComponent(slug)}`);
  return `<a class="tab${activeSlug===slug?' active':''}" data-slug="${slug}" href="${href}">${label}</a>`;
  };
  
  let html = make('posts', t('ui.allPosts'));
  for (const [slug, info] of Object.entries(tabsBySlug)) html += make(slug, info.title);
  if (activeSlug === 'search') {
    const q = String(searchQuery || '').trim();
    const href = withLangParam(`?tab=search${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  html += `<a class="tab active" data-slug="search" href="${href}">${t('ui.searchTab')}</a>`;
  } else if (activeSlug === 'post') {
    const raw = String(searchQuery || t('ui.postTab')).trim();
    const label = raw ? escapeHtml(raw.length > 28 ? raw.slice(0,25) + '…' : raw) : t('ui.postTab');
  html += `<span class="tab active" data-slug="post">${label}</span>`;
  }
  
  // No transition on first load - just set content
  if (!hasInitiallyRendered) {
    // Create a persistent track so overlay (and ::before/::after) aren't recreated
    nav.innerHTML = `<div class="tabs-track">${html}</div>`;
    // Create the highlight overlay element
    ensureHighlightOverlay(nav);
    hasInitiallyRendered = true;
    updateMovingHighlight(nav);
    return;
  }
  
  // Smooth transition only after initial render
  const currentTrack = nav.querySelector('.tabs-track');
  const currentMarkup = currentTrack ? currentTrack.innerHTML : '';
  if (currentMarkup !== html) {
    // Mark currently active tab for deactivation animation (only dynamic tabs)
    const currentActiveTab = nav.querySelector('.tab.active');
    if (currentActiveTab) {
      const curSlug = (currentActiveTab.dataset && currentActiveTab.dataset.slug) || '';
      if (curSlug === 'post' || curSlug === 'search') {
        currentActiveTab.classList.add('deactivating');
      }
    }
    
    // Measure current width only
    const currentWidth = nav.offsetWidth;
    
    // Create a temporary hidden element to measure new width
    const tempNav = nav.cloneNode(false);
    tempNav.style.position = 'absolute';
    tempNav.style.visibility = 'hidden';
    tempNav.style.pointerEvents = 'none';
    tempNav.style.width = 'auto';
    tempNav.style.zIndex = '-1000';
    // Use same structure as real DOM to get consistent width
    tempNav.innerHTML = `<div class="tabs-track">${html}</div>`;
    tempNav.style.position = 'absolute';
    tempNav.style.visibility = 'hidden';
    tempNav.style.pointerEvents = 'none';
    tempNav.style.width = 'auto';
    tempNav.style.zIndex = '-1000';
    nav.parentNode.appendChild(tempNav);
    
    const newWidth = tempNav.offsetWidth;
    nav.parentNode.removeChild(tempNav);
    
  // Set explicit width only and start transition (no opacity changes)
  nav.style.width = `${currentWidth}px`;
  const shrinking = newWidth < currentWidth;
  const growing = newWidth > currentWidth;
  // Faster expansion, slightly delayed shrink
  nav.style.transition = `${growing ? 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0s' : `width 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${shrinking ? '0.06s' : '0s'}`}`;
    
    // Use Apple-style timing for more elegant perception
  // Wait a bit longer so the deactivating animation can play smoothly
  setTimeout(() => {
      // Only replace inner track content, keep wrapper/overlay
      if (!nav.querySelector('.tabs-track')) {
        nav.innerHTML = `<div class="tabs-track">${html}</div>`;
      } else {
        nav.querySelector('.tabs-track').innerHTML = html;
      }
  // Ensure highlight overlay exists after content change
  ensureHighlightOverlay(nav);
  nav.style.width = `${newWidth}px`;
      
      // Update highlight immediately when content changes
      updateMovingHighlight(nav);
      // Trigger activating->in sequence only for dynamic tabs (post/search)
      try {
        const newActive = nav.querySelector('.tab.active');
        const newSlug = (newActive && newActive.dataset && newActive.dataset.slug) || '';
        if (newActive && (newSlug === 'post' || newSlug === 'search')) {
          newActive.classList.add('activating');
          // next frame add .in to play entrance animation
          requestAnimationFrame(() => {
            newActive.classList.add('in');
            // cleanup after animation completes
            setTimeout(() => {
              newActive.classList.remove('activating', 'in');
            }, 260);
          });
        }
      } catch (_) {}
      
  // Reset width to auto after transition
  const resetDelay = growing ? 380 : (shrinking ? 660 : 600);
  setTimeout(() => {
        nav.style.width = 'auto';
        nav.style.transition = ''; // Reset transition
  }, resetDelay); // Match the width transition duration used above
  }, 180); // Snappy swap timed with ~0.14–0.2s poof
  } else {
    // Just update highlight position if content hasn't changed
    updateMovingHighlight(nav);
  }
}

let _pendingHighlightRaf = 0;

// Ensure the highlight overlay element exists
function ensureHighlightOverlay(nav) {
  if (!nav) return;
  
  let overlay = nav.querySelector('.highlight-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'highlight-overlay';
    // Place overlay before the track so it sits visually beneath text but above background
    nav.appendChild(overlay);
  }
  return overlay;
}

// Update the moving highlight overlay position
function updateMovingHighlight(nav) {
  if (!nav) return;

  ensureHighlightOverlay(nav);

  // Coalesce multiple calls into a single rAF to avoid flicker
  if (_pendingHighlightRaf) cancelAnimationFrame(_pendingHighlightRaf);
  _pendingHighlightRaf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const activeTab = nav.querySelector('.tab.active');

      // Clean up any previous transition classes once per tick
      nav.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('activating', 'deactivating');
      });

      if (activeTab) {
        const tabRect = activeTab.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const left = Math.max(0, tabRect.left - navRect.left);
        const width = tabRect.width;

        nav.style.setProperty('--highlight-left', `${left}px`);
        nav.style.setProperty('--highlight-width', `${width}px`);
        nav.style.setProperty('--highlight-opacity', '1');

        nav.style.setProperty('--indicator-left', `${left}px`);
        nav.style.setProperty('--indicator-width', `${Math.max(0, width * 0.85)}px`);
        nav.style.setProperty('--indicator-opacity', '1');

        activeTab.classList.add('activating');
        setTimeout(() => activeTab.classList.remove('activating'), 420);
      } else {
        nav.style.setProperty('--highlight-opacity', '0');
        nav.style.setProperty('--indicator-opacity', '0');
      }

      setupTabHoverEffects(nav);
      _pendingHighlightRaf = 0;
    });
  });
}

// Setup hover preview effects for tabs
function setupTabHoverEffects(nav) {
  if (!nav) return;
  
  // Remove existing listeners
  nav.querySelectorAll('.tab').forEach(tab => {
    tab.removeEventListener('mouseenter', tab._hoverHandler);
    tab.removeEventListener('mouseleave', tab._leaveHandler);
  });
  
  nav.querySelectorAll('.tab').forEach(tab => {
    // Store handlers for cleanup
    tab._hoverHandler = function() {
      if (this.classList.contains('active')) return;
      
      const tabRect = this.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      
      // Show preview for both overlay and indicator
      nav.style.setProperty('--preview-left', `${left}px`);
      nav.style.setProperty('--preview-width', `${width * 0.85}px`);
      nav.style.setProperty('--preview-opacity', '0.4'); // More subtle Apple-style preview
    };
    
    tab._leaveHandler = function() {
      nav.style.setProperty('--preview-opacity', '0');
    };
    
    tab.addEventListener('mouseenter', tab._hoverHandler);
    tab.addEventListener('mouseleave', tab._leaveHandler);
  });
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
  toc.innerHTML = `<div class=\"toc-header\"><span>${t('ui.contents')}</span><span style=\"font-size:.85rem; color: var(--muted);\">${t('ui.loading')}</span></div>`
      + '<ul class="toc-skeleton">'
      + '<li><div class="skeleton-block skeleton-line w-90"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-80"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-85"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-70"></div></li>'
      + '<li><div class="skeleton-block skeleton-line w-60"></div></li>'
      + '</ul>';
  smoothShow(toc);
  ensureAutoHeight(toc);
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
  // Compute fallback title using index cache before rendering
  const fallback = postsByLocationTitle[postname] || postname;
  // Try to get metadata for this post from index cache
  const postMetadata = (Object.entries(postsIndexCache || {}) || []).find(([, v]) => v && v.location === postname)?.[1] || {};
  // Tentatively render meta card with fallback title first; we'll update title after reading h1
  const preTitle = fallback;
  const outdatedCardHtml = renderOutdatedCard(postMetadata);
  const metaCardHtml = renderPostMetaCard(preTitle, postMetadata, markdown);
  // Render outdated card + meta card + main content so we can read first heading reliably
  const mainEl = document.getElementById('mainview');
  if (mainEl) mainEl.innerHTML = outdatedCardHtml + metaCardHtml + output.post;
  try { hydratePostImages('#mainview'); } catch (_) {}
  try { hydratePostVideos('#mainview'); } catch (_) {}
    try { applyLazyLoadingIn('#mainview'); } catch (_) {}
  try { hydrateInternalLinkCards('#mainview'); } catch (_) {}
  // Always use the localized title from index.json for display/meta/tab labels
  const articleTitle = fallback;
    // If title changed after parsing, update the card's title text
    try {
      const titleEl = document.querySelector('#mainview .post-meta-card .post-meta-title');
      if (titleEl) titleEl.textContent = articleTitle;
    } catch (_) {}
    
    // Update SEO meta tags for the post
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
      toc.innerHTML = `<div class=\"toc-header\"><span>${escapeHtml(articleTitle)}</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">${t('ui.top')}</a></div>${output.toc}`;
      smoothShow(toc);
  ensureAutoHeight(toc);
    }
    const searchBox = document.getElementById('searchbox');
    if (searchBox) smoothHide(searchBox);
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
  if (searchBox) smoothHide(searchBox);
  });
}

function displayIndex(parsed) {
  const toc = document.getElementById('tocview');
  smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} });

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
  // Apply masonry layout after initial paint
  requestAnimationFrame(() => applyMasonry('.index'));

  setupSearch(entries);
  renderTabs('posts');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothShow(searchBox);
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
  // Recompute masonry span for the updated card
  const container = document.querySelector('.index');
  if (container && el) updateMasonryItem(container, el);
    }).catch(() => {});
  });
}

function displaySearch(query) {
  const q = String(query || '').trim();
  if (!q) return displayIndex(postsIndexCache);

  const toc = document.getElementById('tocview');
  smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} });

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
  if (searchBox) smoothShow(searchBox);
  const input = document.getElementById('searchInput');
  if (input) input.value = q;
  setupSearch(Object.entries(postsIndexCache || {}));
  setDocTitle(t('titles.search', q));
  // Apply masonry after search render
  requestAnimationFrame(() => applyMasonry('.index'));

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
  const container = document.querySelector('.index');
  if (container && el) updateMasonryItem(container, el);
    }).catch(() => {});
  });
}

// --- Masonry helpers: keep gaps consistent while letting cards auto-height ---
function applyMasonry(selector = '.index') {
  try {
    const container = document.querySelector(selector);
    if (!container) return;
  const cs = getComputedStyle(container);
  const gap = toPx(cs.rowGap || cs.gap || '0', container);
  const rowStr = String(cs.gridAutoRows || '0');
  const row = toPx(rowStr, container);
  if (!row) return;
    const items = Array.from(container.querySelectorAll('a'));
    items.forEach(item => calcAndSetSpan(container, item, row, gap));
    // Re-run once images load to account for cover height
    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      if (img.complete) {
        calcAndSetSpan(container, img.closest('a'), row, gap);
      } else {
        img.addEventListener('load', () => calcAndSetSpan(container, img.closest('a'), row, gap), { once: true });
      }
    });
  } catch (_) {}
}

function updateMasonryItem(container, item) {
  try {
    if (!container || !item) return;
  const cs = getComputedStyle(container);
  const gap = toPx(cs.rowGap || cs.gap || '0', container);
  const rowStr = String(cs.gridAutoRows || '0');
  const row = toPx(rowStr, container);
  if (!row) return;
    calcAndSetSpan(container, item, row, gap);
  } catch (_) {}
}

function calcAndSetSpan(container, item, row, gapPx) {
  if (!container || !item) return;
  item.style.gridRowEnd = 'auto';
  // Include gap: use clientHeight to avoid subpixel rounding; slight epsilon
  const total = item.clientHeight + gapPx + 0.5;
  const span = Math.max(1, Math.round(total / (row + gapPx)));
  item.style.gridRowEnd = `span ${span}`;
}

// Recalculate on resize for responsive columns
window.addEventListener('resize', debounce(() => applyMasonry('.index'), 150));

// Simple debounce utility (scoped here)
function debounce(fn, wait) {
  let t;
  return function() {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, arguments), wait);
  }
}

// Convert a CSS length to pixels; supports px, rem, em
function toPx(val, ctxEl) {
  const s = String(val || '').trim();
  if (!s) return 0;
  if (s.endsWith('px')) return parseFloat(s);
  if (s.endsWith('rem')) return parseFloat(s) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (s.endsWith('em')) return parseFloat(s) * parseFloat(getComputedStyle(ctxEl || document.documentElement).fontSize);
  // Fallback: try parseFloat assuming pixels
  return parseFloat(s) || 0;
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
  if (toc) { smoothHide(toc, () => { try { toc.innerHTML = ''; } catch (_) {} }); }
  const main = document.getElementById('mainview');
  if (main) main.innerHTML = renderSkeletonArticle();
  const searchBox = document.getElementById('searchbox');
  if (searchBox) smoothHide(searchBox);
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
  try { hydratePostVideos('#mainview'); } catch (_) {}
      try { applyLazyLoadingIn('#mainview'); } catch (_) {}
  try { hydrateInternalLinkCards('#mainview'); } catch (_) {}
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

  // Capture current navigation state for error reporting
  try {
    const route = (() => {
      if (isValidId(id)) {
        return { view: 'post', id, title: postsByLocationTitle[id] || null };
      }
      if (tab === 'search') {
        const q = getQueryVariable('q') || '';
        return { view: 'search', q };
      }
      if (tab !== 'posts' && tabsBySlug[tab]) {
        return { view: 'tab', tab, title: (tabsBySlug[tab] && tabsBySlug[tab].title) || tab };
      }
      const page = parseInt(getQueryVariable('page') || '1', 10);
      return { view: 'posts', page: isNaN(page) ? 1 : page };
    })();
    setReporterContext({ route, routeUpdatedAt: new Date().toISOString() });
  } catch (_) { /* ignore */ }

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

// Enhanced smooth click feedback with immediate highlight movement
function addTabClickAnimation(tab) {
  if (!tab || !tab.classList.contains('tab')) return;
  
  // Immediate visual feedback before navigation
  const nav = tab.closest('#tabsNav');
  if (nav && nav.id === 'tabsNav') {
    // Mark current active tab for deactivation
    const currentActive = nav.querySelector('.tab.active');
    if (currentActive && currentActive !== tab) {
      currentActive.classList.add('deactivating');
    }
    
    // Pre-move highlight to clicked tab for immediate feedback
    if (!tab.classList.contains('active')) {
      const tabRect = tab.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      
      const left = tabRect.left - navRect.left;
      const width = tabRect.width;
      
      // Immediately start moving the highlight overlay
      nav.style.setProperty('--highlight-left', `${left}px`);
      nav.style.setProperty('--highlight-width', `${width}px`);
      nav.style.setProperty('--highlight-opacity', '0.7'); // Slightly dimmer during transition for Apple-style elegance
      
      // Also move the bottom indicator
      nav.style.setProperty('--indicator-left', `${left}px`);
      nav.style.setProperty('--indicator-width', `${width * 0.85}px`);
      
      tab.classList.add('activating');
    }
  }
}

// Intercept in-app navigation and use History API
function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a') : null;
  // Handle outdated card close button
  const closeBtn = e.target && e.target.closest ? e.target.closest('.post-outdated-close') : null;
  if (closeBtn) {
    const card = closeBtn.closest('.post-outdated-card');
    if (card) {
      // Animate height collapse + fade/translate, then remove
      const startHeight = card.scrollHeight;
      card.style.height = startHeight + 'px';
      // Force reflow so the browser acknowledges the starting height
      // eslint-disable-next-line no-unused-expressions
      card.getBoundingClientRect();
      card.classList.add('is-dismissing');
      // Next frame, set height to 0 to trigger transition
      requestAnimationFrame(() => {
        card.style.height = '0px';
      });
      const cleanup = () => { card.remove(); };
      card.addEventListener('transitionend', cleanup, { once: true });
      // Fallback removal in case transitionend doesn't fire
      setTimeout(cleanup, 500);
    }
    return;
  }
  if (!a) return;
  
  // Add animation for tab clicks
  if (a.classList.contains('tab')) {
    addTabClickAnimation(a);
  }
  
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

// Update sliding indicator on window resize
window.addEventListener('resize', () => {
  const nav = document.getElementById('tabsNav');
  if (nav) {
  updateMovingHighlight(nav);
  }
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
bindSeoGenerator();
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

    // Apply site-controlled theme after loading config
    try {
      applyThemeConfig(siteConfig);
      // If site enforces a specific pack, ensure the selector reflects it
      const sel = document.getElementById('themePack');
      if (sel && siteConfig && siteConfig.themeOverride !== false && siteConfig.themePack) {
        sel.value = siteConfig.themePack;
      }
    } catch (_) {}

    // Initialize global error reporter with optional report URL from site config
    try {
      const pick = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        const lang = getCurrentLang && getCurrentLang();
        const v = (lang && val[lang]) || val.default || '';
        return typeof v === 'string' ? v : '';
      };
      initErrorReporter({
        reportUrl: siteConfig && siteConfig.reportIssueURL,
        siteTitle: pick(siteConfig && siteConfig.siteTitle) || 'NanoSite'
      });
    } catch (_) {}
    
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
