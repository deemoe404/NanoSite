import { sanitizeImageUrl, sanitizeUrl } from './utils.js';

// Ensure images defer offscreen loading for performance
export function applyLazyLoadingIn(container) {
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
export function hydrateCardCovers(container) {
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
      const inIndex = !!wrap.closest('.index');
      if (!inIndex) {
        // Link-card covers load immediately; nothing extra needed here
      } else {
        // Index covers are hydrated elsewhere
      }
    });
  } catch (_) {}
}

// Enhance post images: wrap with a reserved-ratio container + skeleton, fade-in when loaded
export function hydratePostImages(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const candidates = Array.from(root.querySelectorAll('img'))
      .filter(img => !img.classList.contains('card-cover'))
      .filter(img => !img.closest('table'))
      .filter(img => !img.closest('figure'));
    candidates.forEach(img => {
      if (img.closest('.post-image-wrap')) return;
      const p = img.parentElement && img.parentElement.tagName === 'P' ? img.parentElement : null;
      const onlyThisImg = p ? (p.childElementCount === 1 && p.textContent.trim() === '') : false;

      const setupWrap = (hostEl, nodeToMove) => {
        const wrap = document.createElement('div');
        wrap.className = 'post-image-wrap';
        const wAttr = parseInt(img.getAttribute('width') || '', 10);
        const hAttr = parseInt(img.getAttribute('height') || '', 10);
        if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
          wrap.style.aspectRatio = `${wAttr} / ${hAttr}`;
        }
        const ph = document.createElement('div');
        ph.className = 'ph-skeleton';
        ph.setAttribute('aria-hidden', 'true');

        try {
          if (nodeToMove && nodeToMove.parentElement === hostEl) hostEl.insertBefore(wrap, nodeToMove);
          else hostEl.appendChild(wrap);
        } catch (_) { hostEl.appendChild(wrap); }
        wrap.appendChild(ph);
        wrap.appendChild(nodeToMove || img);

        img.classList.add('post-img');
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

        const src = img.getAttribute('src');
        if (src) { img.setAttribute('data-src', src); img.removeAttribute('src'); }

        const done = () => {
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

        if (src) {
          const safe = sanitizeImageUrl(src);
          if (safe) img.src = safe;
        }
      };

      if (onlyThisImg) {
        const alt = (img.getAttribute('alt') || '').trim();
        const figure = document.createElement('figure');
        if (p && p.parentElement) p.parentElement.insertBefore(figure, p);
        const link = (img.parentElement && img.parentElement.tagName === 'A' && img.parentElement.parentElement === p) ? img.parentElement : null;
        const nodeToMove = link || img;
        setupWrap(figure, nodeToMove);
        try { if (p && p.parentElement) p.parentElement.removeChild(p); } catch (_) {}
        if (alt) {
          const cap = document.createElement('figcaption');
          cap.textContent = alt;
          figure.appendChild(cap);
        }
      } else {
        const targetParent = img.parentElement;
        if (!targetParent) return;
        const link = (img.parentElement && img.parentElement.tagName === 'A') ? img.parentElement : null;
        const nodeToMove = link || img;
        setupWrap(targetParent, nodeToMove);
      }
    });
  } catch (_) {}
}

// Auto-generate preview posters for videos to avoid gray screen before play
export function hydratePostVideos(container) {
  try {
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
    if (!root) return;
    const videos = Array.from(root.querySelectorAll('video'));
    videos.forEach(video => {
      try {
        if (!video.classList.contains('post-video')) video.classList.add('post-video');
        if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
        if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
        if (!video.hasAttribute('playsinline')) video.setAttribute('playsinline', '');
        if (!video.closest('.post-video-wrap')) {
          const wrap = document.createElement('div');
          wrap.className = 'post-video-wrap';
          const parent = video.parentElement;
          if (parent) {
            parent.insertBefore(wrap, video);
            wrap.appendChild(video);
          }
        }
        try { video.load(); } catch (_) {}

        if (video.dataset.vfInstalled !== '1') {
          const wrap = video.closest('.post-video-wrap') || video.parentElement;
          const overlay = document.createElement('div');
          overlay.className = 'video-fallback';
          overlay.style.display = 'none';
          const toAbs = (s) => { try { return new URL(s, window.location.href).toString(); } catch(_) { return s; } };
          const sources = [video.getAttribute('src'), ...Array.from(video.querySelectorAll('source')).map(s => s.getAttribute('src'))].filter(Boolean);
          const first = sources.length ? toAbs(sources[0]) : '#';
          const content = document.createElement('div');
          content.className = 'vf-content';
          const title = document.createElement('div');
          title.className = 'vf-title';
          title.textContent = 'Video not available';
          const actions = document.createElement('div');
          actions.className = 'vf-actions';
          const link = document.createElement('a');
          link.className = 'vf-link primary';
          try { link.setAttribute('rel', 'noopener'); } catch(_) {}
          link.setAttribute('target', '_blank');
          const sanitized = sanitizeUrl(first);
          link.setAttribute('href', sanitized || '#');
          link.textContent = 'Open file';
          actions.appendChild(link);
          content.appendChild(title);
          content.appendChild(actions);
          overlay.appendChild(content);
          if (wrap && !wrap.querySelector('.video-fallback')) wrap.appendChild(overlay);
          const show = () => { overlay.style.display = 'flex'; };
          const hide = () => { overlay.style.display = 'none'; };
          video.addEventListener('error', show);
          video.addEventListener('loadeddata', hide);
          video.addEventListener('canplay', hide);
          video.addEventListener('play', hide);
          Array.from(video.querySelectorAll('source')).forEach(s => { s.addEventListener('error', show); });
          video.dataset.vfInstalled = '1';
        }
      } catch (_) {}
    });

    const queue = Array.from(root.querySelectorAll('video'))
      .filter(video => video && !video.hasAttribute('poster') && video.dataset.autoposterDone !== '1');

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const waitForMetadata = (video) => new Promise(resolve => {
      if (!video) return resolve();
      if (video.readyState >= 2) return resolve();
      const onMeta = () => {};
      const onData = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); resolve(); };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('loadeddata', onData);
        video.removeEventListener('error', onErr);
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      video.addEventListener('loadeddata', onData, { once: true });
      video.addEventListener('error', onErr, { once: true });
    });

    const capturePoster = async (video) => {
      if (!video) return;
      if (video.readyState < 2) await waitForMetadata(video);
      if (video.readyState < 2) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl) video.setAttribute('poster', dataUrl);
      } catch (_) {}
    };

    const processVideo = async (video) => {
      try {
        const wasPaused = video.paused;
        const origTime = video.currentTime;
        const captureAt = async (time) => {
          try {
            if (Number.isFinite(time)) video.currentTime = time;
            await waitForMetadata(video);
            if (video.readyState >= 2) {
              await capturePoster(video);
              return true;
            }
          } catch (_) {}
          return false;
        };
        if (await captureAt(0)) {
          if (!wasPaused) { try { await video.play(); } catch(_) {} }
          if (Number.isFinite(origTime)) { try { video.currentTime = origTime; } catch(_) {} }
          return;
        }
        const duration = Number.isFinite(video.duration) ? video.duration : null;
        if (duration && duration > 0) {
          const ok = await captureAt(Math.min(0.1 * duration, duration - 0.05));
          if (ok) {
            if (!wasPaused) { try { await video.play(); } catch(_) {} }
            if (Number.isFinite(origTime)) { try { video.currentTime = origTime; } catch(_) {} }
            return;
          }
        }
        await captureAt(0.5);
        if (!wasPaused) { try { await video.play(); } catch(_) {} }
        if (Number.isFinite(origTime)) { try { video.currentTime = origTime; } catch(_) {} }
      } catch (_) {}
    };

    (async () => {
      for (const v of queue) {
        await processVideo(v);
        await delay(80);
      }
    })();
  } catch (_) {}
}
