// Simple, dependency-free image lightbox for #mainview
// Usage: import { installLightbox } from './js/lightbox.js'; installLightbox({ root: '#mainview' });

export function installLightbox(opts = {}) {
  const rootSelector = opts.root || '#mainview';
  const root = () => document.querySelector(rootSelector) || document;

  // Create overlay once
  let overlay = document.getElementById('ns-lightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ns-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'dialog');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ns-lb-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'ns-lb-reset';
    resetBtn.setAttribute('aria-label', 'Reset zoom');
    resetBtn.textContent = '⤾';

    const stageDiv = document.createElement('div');
    stageDiv.className = 'ns-lb-stage';

    const imgNode = document.createElement('img');
    imgNode.className = 'ns-lb-img';
    imgNode.alt = '';

    const captionDiv = document.createElement('div');
    captionDiv.className = 'ns-lb-caption';
    captionDiv.setAttribute('aria-live', 'polite');

    stageDiv.appendChild(imgNode);
    stageDiv.appendChild(captionDiv);

    const zoomDiv = document.createElement('div');
    zoomDiv.className = 'ns-lb-zoom';
    zoomDiv.setAttribute('aria-hidden', 'true');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'ns-lb-prev';
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.textContent = '‹';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'ns-lb-next';
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.textContent = '›';

    overlay.append(closeBtn, resetBtn, stageDiv, zoomDiv, prevBtn, nextBtn);
    document.body.appendChild(overlay);
  }

  const imgEl = overlay.querySelector('.ns-lb-img');
  const captionEl = overlay.querySelector('.ns-lb-caption');
  const prevBtn = overlay.querySelector('.ns-lb-prev');
  const nextBtn = overlay.querySelector('.ns-lb-next');
  const closeBtn = overlay.querySelector('.ns-lb-close');
  const resetBtn = overlay.querySelector('.ns-lb-reset');
  const stageEl = overlay.querySelector('.ns-lb-stage');
  const zoomEl = overlay.querySelector('.ns-lb-zoom');

  let currentList = [];
  let currentIndex = -1;
  let lastActive = null;

  // Zoom/Pan state
  let scale = 1, tx = 0, ty = 0;
  const minScale = 1, maxScale = 5;
  let dragging = false; let dragX = 0, dragY = 0; let startTx = 0, startTy = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  let lastFit = { baseW: 0, baseH: 0, natW: 0, natH: 0 };
  // Smooth zoom state
  let targetScale = 1;
  let zoomAnchor = null; // {x, y} in stage-centered coords
  let zoomAnchorTimer = null;
  let rafId = null;
  // Pan animation (e.g., for reset)
  let panAnimating = false;
  let panTargetX = 0, panTargetY = 0;

  function computeBaseFit() {
    const natW = imgEl.naturalWidth || 0;
    const natH = imgEl.naturalHeight || 0;
    if (!natW || !natH) { lastFit = { baseW: 0, baseH: 0, natW, natH }; return lastFit; }
    const capH = (captionEl && captionEl.offsetHeight) || 0;
    const sw = stageEl.clientWidth || window.innerWidth;
    const sh = Math.max(0, (stageEl.clientHeight || window.innerHeight) - capH - 8);
    const fit = Math.min(sw / natW, sh / natH);
    const baseW = natW * fit;
    const baseH = natH * fit;
    lastFit = { baseW, baseH, natW, natH };
    return lastFit;
  }

  function clampPan() {
    if (scale <= 1) { tx = 0; ty = 0; return; }
    const { baseW, baseH } = lastFit.baseW ? lastFit : computeBaseFit();
    const capH = (captionEl && captionEl.offsetHeight) || 0;
    const sw = stageEl.clientWidth || window.innerWidth;
    const sh = Math.max(0, (stageEl.clientHeight || window.innerHeight) - capH - 8);
    const vw = sw; const vh = sh;
    const dispW = baseW * scale;
    const dispH = baseH * scale;
    const maxX = Math.max(0, (dispW - vw) / 2);
    const maxY = Math.max(0, (dispH - vh) / 2);
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function applyTransform() {
    clampPan();
    imgEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    if (scale > 1 && !imgEl.classList.contains('ns-lb-grab')) imgEl.classList.add('ns-lb-grab');
    if (scale === 1) { imgEl.classList.remove('ns-lb-grab'); imgEl.classList.remove('ns-lb-grabbing'); }
    if (zoomEl) zoomEl.textContent = `${Math.round(scale * 100)}%`;
  }

  function resetTransform() {
    targetScale = scale = 1; tx = 0; ty = 0; applyTransform();
  }

  function setScaleImmediate(next, anchor) {
    const prev = scale;
    const s2 = Math.max(minScale, Math.min(maxScale, next));
    if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number' && prev > 0 && s2 !== prev) {
      // Keep the point under the cursor/fingers stationary in screen space
      const k = 1 - s2 / prev;
      tx = tx + (anchor.x - tx) * k;
      ty = ty + (anchor.y - ty) * k;
    }
    scale = s2;
    if (scale === 1) { tx = 0; ty = 0; }
    // Simple center-zoom; avoid complex anchor compensation for now
    if (prev !== scale) applyTransform();
  }

  function setScaleTarget(next, anchor) {
    targetScale = Math.max(minScale, Math.min(maxScale, next));
    if (anchor) {
      zoomAnchor = { x: anchor.x, y: anchor.y };
      if (zoomAnchorTimer) clearTimeout(zoomAnchorTimer);
      zoomAnchorTimer = setTimeout(() => { zoomAnchor = null; }, 180);
    }
    ensureRaf();
  }

  function animateReset() {
    panAnimating = true;
    panTargetX = 0; panTargetY = 0;
    setScaleTarget(1, { x: 0, y: 0 });
  }

  function tick() {
    rafId = null;
    const prev = scale;
    const diff = targetScale - prev;
    if (Math.abs(diff) < 0.001) {
      if (prev !== targetScale) setScaleImmediate(targetScale, zoomAnchor || null);
      // continue to pan animate if needed
    } else {
      const step = prev + diff * 0.38; // snappier easing
      setScaleImmediate(step, zoomAnchor || null);
    }
    if (panAnimating) {
      const px = panTargetX - tx;
      const py = panTargetY - ty;
      tx += px * 0.25;
      ty += py * 0.25;
      if (Math.hypot(px, py) < 0.6 && Math.abs(targetScale - scale) < 0.01) {
        tx = panTargetX; ty = panTargetY; panAnimating = false;
      }
      applyTransform();
    }
    ensureRaf();
  }

  function ensureRaf() {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  function collectImages() {
    const container = root();
    const all = Array.from(container.querySelectorAll('img'))
      .filter(el => !el.classList.contains('card-cover')) // ignore index cards
      .filter(el => el.offsetParent !== null); // visible images only
    return all;
  }

  function sanitizeImageSrc(raw) {
    try {
      const s = (raw || '').trim();
      if (!s) return '';
      // Permit only http, https, blob, and data:image/* (raster only) URLs
      const u = new URL(s, document.baseURI);
      const p = u.protocol;
      if (p === 'http:' || p === 'https:' || p === 'blob:') return u.href;
      if (p === 'data:') {
        // Strict allowlist for data:image/* URIs; explicitly disallow SVG
        // Format: data:image/<type>[;base64],...
        const body = s.slice(5); // after 'data:'
        const m = body.match(/^image\/([A-Za-z0-9.+-]+)[;,]/);
        if (!m) return '';
        const type = (m[1] || '').toLowerCase();
        // Allow only common raster formats
        const allowed = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif', 'bmp', 'x-icon']);
        if (allowed.has(type)) return s;
        return '';
      }
      return '';
    } catch (_) {
      return '';
    }
  }

  function resolveSrc(el) {
    if (!el) return '';
    // Use resolved URL properties only (avoid raw attribute text)
    // This prevents DOM text from being reinterpreted as markup/HTML.
    const raw = el.currentSrc || el.src || '';
    return sanitizeImageSrc(raw);
  }

  function openAt(index) {
    if (!currentList.length) return;
    currentIndex = Math.max(0, Math.min(index, currentList.length - 1));
    const src = resolveSrc(currentList[currentIndex]);
    const alt = currentList[currentIndex].alt || '';
    if (src) {
      const ensureFit = () => { computeBaseFit(); applyTransform(); };
      if (imgEl.complete && imgEl.naturalWidth > 0) { imgEl.src = src; ensureFit(); }
      else { imgEl.addEventListener('load', ensureFit, { once: true }); imgEl.src = src; }
    }
    imgEl.alt = alt;
    captionEl.textContent = alt;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('ns-lb-lock');
    resetTransform();
    try { lastActive = document.activeElement; } catch (_) {}
    closeBtn.focus({ preventScroll: true });
    updateAriaForButtons();
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('ns-lb-lock');
    imgEl.removeAttribute('src');
    captionEl.textContent = '';
    try { if (lastActive && lastActive.focus) lastActive.focus({ preventScroll: true }); } catch (_) {}
  }

  function prev() { if (currentList.length) openAt((currentIndex - 1 + currentList.length) % currentList.length); }
  function next() { if (currentList.length) openAt((currentIndex + 1) % currentList.length); }

  function updateAriaForButtons() {
    const total = currentList.length;
    prevBtn.disabled = total < 2;
    nextBtn.disabled = total < 2;
  }

  // Click to close when backdrop or close button is clicked
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === closeBtn) {
      e.preventDefault();
      close();
    }
  });
  prevBtn.addEventListener('click', (e) => { e.preventDefault(); prev(); });
  nextBtn.addEventListener('click', (e) => { e.preventDefault(); next(); });
  if (resetBtn) resetBtn.addEventListener('click', (e) => { e.preventDefault(); animateReset(); });

  // Keyboard navigation when open
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  });

  // Wheel zoom (desktop)
  imgEl.addEventListener('wheel', (e) => {
    if (!overlay.classList.contains('open')) return;
    // Always prevent default to avoid page scrolling behind overlay
    e.preventDefault();

    const ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '');
    const isMac = /Mac|Macintosh|Mac OS/.test(ua);
    const isPinch = !!e.ctrlKey; // Chrome/Safari set ctrlKey during trackpad pinch

    // Two-finger pan on trackpad when not pinching and image is zoomed
    if (!isPinch && scale > 1) {
      // Use wheel deltas directly for panning; clamp and apply
      // Invert to match scroll semantics (scroll down moves content up)
      tx -= e.deltaX;
      ty -= e.deltaY;
      applyTransform();
      return;
    }

    // Otherwise treat as zoom (mouse wheel or pinch)
    const clamp = isPinch ? 600 : 320;
    const dy = Math.max(-clamp, Math.min(clamp, e.deltaY));
    let k = 0.008; // base sensitivity
    if (isMac) k = 0.012; // faster on Mac
    if (isPinch) k *= 1.5; // even faster for pinch
    const eff = Math.abs(dy) < 1 ? Math.sign(dy || 1) * 1.5 : dy;
    const factor = Math.exp(-eff * k);
    const next = scale * factor;
    if (next !== scale) {
      const r = stageEl.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy2 = e.clientY - (r.top + r.height / 2);
      setScaleTarget(next, { x: dx, y: dy2 });
    }
  }, { passive: false });

  // Double click/tap to toggle zoom
  let lastTap = 0;
  const toggleZoom = (anchor) => {
    if (scale === 1) setScaleTarget(2, anchor); else setScaleTarget(1, anchor);
  };
  imgEl.addEventListener('dblclick', (e) => {
    if (!overlay.classList.contains('open')) return;
    e.preventDefault();
    const r = stageEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const target = scale === 1 ? 2 : 1;
    setScaleTarget(target, { x: dx, y: dy });
  });
  imgEl.addEventListener('click', (e) => {
    if (!overlay.classList.contains('open')) return;
    const now = Date.now();
    if (now - lastTap < 280) {
      e.preventDefault();
      const r = stageEl.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const target = scale === 1 ? 2 : 1;
      setScaleTarget(target, { x: dx, y: dy });
    }
    lastTap = now;
  }, true);

  // Drag to pan (mouse)
  imgEl.addEventListener('mousedown', (e) => {
    if (!overlay.classList.contains('open') || scale === 1) return;
    dragging = true; dragX = e.clientX; dragY = e.clientY; startTx = tx; startTy = ty;
    imgEl.classList.add('ns-lb-grabbing');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    tx = startTx + (e.clientX - dragX);
    ty = startTy + (e.clientY - dragY);
    applyTransform();
  });
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; imgEl.classList.remove('ns-lb-grabbing'); } });

  // Touch: pinch to zoom and drag to pan
  imgEl.addEventListener('touchstart', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy) || 1;
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      dragging = true; dragX = e.touches[0].clientX; dragY = e.touches[0].clientY; startTx = tx; startTy = ty;
    }
  }, { passive: true });
  imgEl.addEventListener('touchmove', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const next = pinchStartScale * (dist / pinchStartDist);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const r = stageEl.getBoundingClientRect();
      setScaleImmediate(next, { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) });
      e.preventDefault();
    } else if (e.touches.length === 1 && dragging) {
      tx = startTx + (e.touches[0].clientX - dragX);
      ty = startTy + (e.touches[0].clientY - dragY);
      applyTransform();
      e.preventDefault();
    }
  }, { passive: false });
  imgEl.addEventListener('touchend', () => { dragging = false; imgEl.classList.remove('ns-lb-grabbing'); }, { passive: true });

  // Recompute bounds on resize
  window.addEventListener('resize', () => { if (overlay.classList.contains('open')) { computeBaseFit(); applyTransform(); } });

  // Delegate click from root to open images
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !(t instanceof Element)) return;
    // Only within root container
    if (!t.closest(rootSelector)) return;
    const img = t.closest('img');
    if (!img) return;
    // Ignore images with explicit data-no-viewer
    if (img.hasAttribute('data-no-viewer')) return;
    // Ignore index cover images
    if (img.classList.contains('card-cover')) return;
    const src = resolveSrc(img);
    if (!src) return;
    e.preventDefault();
    currentList = collectImages();
    const idx = currentList.indexOf(img);
    openAt(idx >= 0 ? idx : 0);
  }, true);
}
