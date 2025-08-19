// Tag utilities: aggregation, rendering (collapsible), and tooltips for truncated tags
import { t, withLangParam } from './i18n.js';
import { getQueryVariable, escapeHtml } from './utils.js';

// Build a sorted list of tags with counts from an index map
export function aggregateTags(indexMap) {
  const counts = new Map();
  try {
    for (const [, meta] of Object.entries(indexMap || {})) {
      const v = meta && meta.tag;
      let arr = [];
      if (Array.isArray(v)) arr = v;
      else if (typeof v === 'string') arr = v.split(',');
      else if (v != null) arr = [String(v)];
      arr.map(x => String(x).trim()).filter(Boolean).forEach(tag => {
        const key = tag.toLowerCase();
        const cur = counts.get(key) || { label: tag, count: 0 };
        if (!cur.label) cur.label = tag; // preserve first-seen casing
        cur.count++;
        counts.set(key, cur);
      });
    }
  } catch (_) {}
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Render the tag sidebar with collapse/expand and ensure the active tag remains visible
export function renderTagSidebar(indexMap) {
  const root = document.getElementById('tagview');
  if (!root) return;
  const items = aggregateTags(indexMap);
  const currentTag = (getQueryVariable('tag') || '').trim().toLowerCase();
  const total = items.reduce((s, x) => s + x.count, 0);
  const allHref = withLangParam('?tab=search');
  const header = `<div class="section-title">${t('ui.tags')}</div>`;
  if (!items.length) { root.innerHTML = header + `<div class="muted">${t('ui.allTags')}</div>`; return; }
  const lis = items.map(({ label, count }) => {
    const isActive = label.trim().toLowerCase() === currentTag;
    const href = withLangParam(`?tab=search&tag=${encodeURIComponent(label)}`);
    return `<li><a class="tag-link${isActive ? ' active' : ''}" href="${href}"><span class="tag-name">${escapeHtml(label)}</span><span class="tag-count">${count}</span></a></li>`;
  }).join('');
  const allItem = `<li><a class="tag-link all${currentTag ? '' : ' active'}" href="${allHref}"><span class="tag-name">${t('ui.allTags')}</span><span class="tag-count">${total}</span></a></li>`;
  root.innerHTML = header + `
    <div class="tagbox">
      <ul class="tag-list compact" data-collapsed="true">
        ${allItem}
        ${lis}
      </ul>
      <button type="button" class="tag-toggle" aria-expanded="false">${t('ui.more')}</button>
    </div>`;
  try {
    const list = root.querySelector('.tag-list');
    const active = root.querySelector('.tag-link.active');
    const toggle = root.querySelector('.tag-toggle');
    const ensureVisible = () => {
      if (!list || !active || !toggle) return;
      if (!list.classList.contains('is-collapsed')) return; // class set by CSS init below
      const rect = active.getBoundingClientRect();
      const lrect = list.getBoundingClientRect();
      if (rect.bottom > lrect.bottom) {
        list.classList.remove('is-collapsed');
        list.dataset.collapsed = 'false';
        toggle.setAttribute('aria-expanded', 'true');
        toggle.textContent = t('ui.less');
      }
    };
    // Initialize collapse class and wire toggle
    list.classList.add('is-collapsed');
    toggle.addEventListener('click', () => {
      const collapsed = list.classList.toggle('is-collapsed');
      list.dataset.collapsed = collapsed ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.textContent = collapsed ? t('ui.more') : t('ui.less');
    });
    requestAnimationFrame(() => ensureVisible());

    // Setup tag tooltips for truncated text
    setupTagTooltips(root);
  } catch (_) {}
}

// Tooltips to display full tag names when truncated
export function setupTagTooltips(tagRoot) {
  if (!tagRoot) return;

  let currentTooltip = null;
  let tooltipTimeout = null;

  function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'tag-tooltip';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTooltip(tagElement, text) {
    const tagName = tagElement.querySelector('.tag-name');
    if (!tagName || tagName.scrollWidth <= tagName.clientWidth) return;

    if (!currentTooltip) {
      currentTooltip = createTooltip();
    }

    currentTooltip.textContent = text;
    currentTooltip.classList.remove('below');

    const rect = tagElement.getBoundingClientRect();
    currentTooltip.style.visibility = 'hidden';
    currentTooltip.style.display = 'block';
    const ttWidth = currentTooltip.offsetWidth;
    const ttHeight = currentTooltip.offsetHeight;
    const padding = 8;

    let top = rect.top - ttHeight - 8;
    let left = rect.left + (rect.width / 2) - (ttWidth / 2);

    if (top < padding) {
      top = Math.min(window.innerHeight - padding - ttHeight, rect.bottom + 8);
      currentTooltip.classList.add('below');
    }

    if (left < padding) left = padding;
    if (left + ttWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - ttWidth;
    }

    currentTooltip.style.left = `${left}px`;
    currentTooltip.style.top = `${top}px`;
    currentTooltip.style.visibility = '';

    requestAnimationFrame(() => {
      if (currentTooltip) {
        currentTooltip.classList.add('show');
      }
    });
  }

  function hideTooltip() {
    if (currentTooltip) {
      currentTooltip.classList.remove('show');
      setTimeout(() => {
        if (currentTooltip && !currentTooltip.classList.contains('show')) {
          document.body.removeChild(currentTooltip);
          currentTooltip = null;
        }
      }, 200);
    }
  }

  const tagLinks = tagRoot.querySelectorAll('.tag-link');
  tagLinks.forEach(tagLink => {
    const tagNameElement = tagLink.querySelector('.tag-name');
    if (!tagNameElement) return;

    const fullText = tagNameElement.textContent.trim();

    tagLink.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        showTooltip(tagLink, fullText);
      }, 500);
    });

    tagLink.addEventListener('mouseleave', () => {
      clearTimeout(tooltipTimeout);
      hideTooltip();
    });

    tagLink.addEventListener('click', () => {
      clearTimeout(tooltipTimeout);
      hideTooltip();
    });
  });

  const onScrollOrResize = () => { hideTooltip(); };
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);

  try {
    const toggleBtn = tagRoot.querySelector('.tag-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        clearTimeout(tooltipTimeout);
        hideTooltip();
      });
    }
  } catch (_) {}

  tagRoot.addEventListener('click', () => {
    clearTimeout(tooltipTimeout);
    hideTooltip();
  });

  const onKeydown = (e) => { if (e && e.key === 'Escape') hideTooltip(); };
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('click', () => { hideTooltip(); });
}
