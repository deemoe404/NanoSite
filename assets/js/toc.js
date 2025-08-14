import { t } from './i18n.js';

// Anchors and Table of Contents enhancements
export function setupAnchors() {
  const container = document.getElementById('mainview');
  if (!container) return;
  const headings = container.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]');
  headings.forEach(h => {
    const a = h.querySelector('a.anchor');
    if (!a) return;
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = `${location.href.split('#')[0]}#${h.id}`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const tmp = document.createElement('textarea');
          tmp.value = url; document.body.appendChild(tmp); tmp.select();
          document.execCommand('copy'); document.body.removeChild(tmp);
        }
        a.classList.add('copied');
        const prevTitle = a.getAttribute('title') || '';
        a.setAttribute('title', t('toc.copied'));
        setTimeout(() => { a.classList.remove('copied'); a.setAttribute('title', prevTitle); }, 1000);
        history.replaceState(null, '', `#${h.id}`);
      } catch (_) {
        location.hash = h.id;
      }
    });
  });
}

export function setupTOC() {
  const tocRoot = document.getElementById('tocview');
  if (!tocRoot) return;

  const list = tocRoot.querySelector('ul');
  if (!list) return;

  // Add toggles for nested lists
  tocRoot.querySelectorAll('li').forEach(li => {
    const sub = li.querySelector(':scope > ul');
    const link = li.querySelector(':scope > a');
    let row = li.querySelector(':scope > .toc-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'toc-row';
      if (link) li.insertBefore(row, link);
      else if (sub) li.insertBefore(row, sub);
      else li.appendChild(row);
    }
    if (link) row.appendChild(link);
    if (sub) {
      const btn = document.createElement('button');
      btn.className = 'toc-toggle';
      btn.setAttribute('aria-label', t('toc.toggleAria'));
      btn.setAttribute('aria-expanded', 'true');
      btn.innerHTML = '<span class="caret"></span>';
      row.insertBefore(btn, row.firstChild || null);
      btn.addEventListener('click', () => {
        const collapsed = sub.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
      const depth = getDepth(li, tocRoot);
      if (depth >= 2) {
        sub.classList.add('collapsed');
        btn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Map heading ids to TOC links
  const idToLink = new Map();
  tocRoot.querySelectorAll('a[href^="#"]:not(.toc-anchor)').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (id) idToLink.set(id, a);
  });

  // Track H2 and H3 headings
  const headings = Array.from(document.querySelectorAll('#mainview h2[id], #mainview h3[id]'));
  const trackable = new Set(headings.map(h => h.id));
  const onActive = (id) => {
    tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
    const link = idToLink.get(id);
    if (link) {
      link.classList.add('active');
      let node = link.parentElement;
      while (node && node !== tocRoot) {
        const sub = node.querySelector(':scope > ul');
        const btn = node.querySelector(':scope > .toc-toggle');
        if (sub && sub.classList.contains('collapsed')) {
          sub.classList.remove('collapsed');
          if (btn) btn.setAttribute('aria-expanded', 'true');
        }
        node = node.parentElement;
      }
    }
  };

  // Scroll-based active detection
  let ticking = false;
  function computePositions() {
    return headings.map(h => ({ id: h.id, top: h.getBoundingClientRect().top + window.scrollY }));
  }
  let positions = computePositions();
  function updateActive() {
    ticking = false;
    const y = window.scrollY + 120;
    let currentId = positions[0] ? positions[0].id : null;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].top <= y) currentId = positions[i].id; else break;
    }
    if (currentId) onActive(currentId);
  }
  window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(updateActive); ticking = true; } });
  window.addEventListener('resize', () => { positions = computePositions(); updateActive(); });
  window.addEventListener('load', () => { positions = computePositions(); updateActive(); });

  const current = (location.hash || '').replace(/^#/, '');
  if (current && idToLink.has(current) && trackable.has(current)) onActive(current);
  else updateActive();

  tocRoot.querySelectorAll('a[href^="#"]:not(.toc-anchor):not(.toc-top)').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = (a.getAttribute('href') || '').replace('#', '');
      if (id && trackable.has(id)) onActive(id);
      else tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
      const el = id ? document.getElementById(id) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update hash without triggering default jump-to-top
      try {
        const url = new URL(window.location.href);
        url.hash = id ? `#${id}` : '';
        history.replaceState(null, '', url.toString());
      } catch (_) {}
    });
  });

  const topLink = tocRoot.querySelector('.toc-top');
  if (topLink) {
    topLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
    });
  }
}

function getDepth(el, tocRoot) {
  let d = 0; let n = el;
  while (n && n !== tocRoot) { if (n.tagName === 'UL') d++; n = n.parentElement; }
  return Math.max(0, d - 1);
}
