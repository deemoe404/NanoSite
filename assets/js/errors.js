// errors.js — lightweight global error overlay and reporter
import { t } from './i18n.js';

let reporterConfig = {
  reportUrl: null,
  siteTitle: 'NanoSite'
};
let extraContext = {};
// Queue for sequential overlays (show one at a time)
let overlayQueue = [];
let overlayShowing = false;
const overlayDedup = new Set();

function ensureOverlayRoot() {
  let root = document.getElementById('errorOverlayRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'errorOverlayRoot';
  root.setAttribute('aria-live', 'assertive');
  root.style.position = 'fixed';
  root.style.right = '1rem';
  root.style.bottom = '1rem';
  root.style.zIndex = '2147483647';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '0.625rem';
  document.body.appendChild(root);
  return root;
}

function formatReportPayload(error, context) {
  const now = new Date();
  const reason = error && (error.message || String(error));
  let stack = error && error.stack ? String(error.stack) : undefined;
  // Synthesize a minimal stack if the browser didn't provide one
  if (!stack && context && (context.filename || context.lineno)) {
    const loc = [context.filename, context.lineno, context.colno].filter(v => v || v === 0).join(':');
    stack = loc || undefined;
  }
  const url = window.location.href;
  const lang = document.documentElement && document.documentElement.getAttribute('lang');
  const qp = new URLSearchParams(window.location.search);
  const mergedContext = { ...(extraContext || {}), ...(context || {}) };
  const payload = {
    app: reporterConfig.siteTitle || 'NanoSite',
    time: now.toISOString(),
    name: (error && error.name) || 'Error',
    message: reason || (context && context.message) || 'Unknown error',
    note: mergedContext && mergedContext.note ? String(mergedContext.note) : undefined,
    stack,
    filename: mergedContext && mergedContext.filename || undefined,
    lineno: mergedContext && mergedContext.lineno || undefined,
    colno: mergedContext && mergedContext.colno || undefined,
    url,
    lang,
    query: Object.fromEntries(qp.entries()),
    userAgent: navigator.userAgent,
    context: mergedContext || null
  };
  return payload;
}

function openReportUrl(payload) {
  const base = reporterConfig.reportUrl;
  if (!base) return false;
  const title = encodeURIComponent(`[Bug] ${payload.message.substring(0, 60)}`);
  const body = encodeURIComponent('```json\n' + JSON.stringify(payload, null, 2) + '\n```');
  const join = base.includes('?') ? '&' : '?';
  const url = `${base}${join}title=${title}&body=${body}`;
  try { window.open(url, '_blank', 'noopener'); return true; } catch (_) { return false; }
}

function copyToClipboard(text) {
  try { return navigator.clipboard.writeText(text).then(() => true).catch(() => false); }
  catch (_) { return Promise.resolve(false); }
}

export function showErrorOverlay(err, context = {}) {
  try {
    // Basic dedupe: avoid enqueuing identical name+message+url within a short window
    const key = `${(err && err.name) || 'Error'}|${(err && err.message) || (context && context.message) || ''}|${(context && context.assetUrl) || ''}`;
    if (!overlayDedup.has(key)) {
      overlayDedup.add(key);
      setTimeout(() => overlayDedup.delete(key), 5000);
      overlayQueue.push({ err, context });
    }
    processOverlayQueue();
  } catch (_) {
    // Fallback to immediate render if queueing somehow fails
    try { renderOverlayCard(formatReportPayload(err, context)); } catch (_) {}
  }
}

function processOverlayQueue() {
  if (overlayShowing) return;
  const next = overlayQueue.shift();
  if (!next) return;
  overlayShowing = true;
  const payload = formatReportPayload(next.err, next.context);
  renderOverlayCard(payload, () => {
    overlayShowing = false;
    // Next tick to avoid tight recursion
    setTimeout(processOverlayQueue, 0);
  });
}

function renderOverlayCard(payload, onDone) {
  const root = ensureOverlayRoot();
  const card = document.createElement('div');
  card.className = 'error-card';
  card.setAttribute('role', 'alert');
  const localizeName = (name) => {
    const s = String(name || '').trim();
    const lower = s.toLowerCase();
    if (!s) return t('ui.error') || 'Error';
    if (lower === 'warning') return t('ui.warning') || 'Warning';
    if (lower === 'error') return t('ui.error') || 'Error';
    return s;
  };
  card.innerHTML = `
    <div class="error-head">⚠️ ${escapeHtmlShort(localizeName(payload.name))}: ${escapeHtmlShort(payload.message)}</div>
    <div class="error-meta">${new Date(payload.time).toLocaleString()} · ${escapeHtmlShort(payload.app)}</div>
    <details class="error-details">
      <summary>${escapeHtmlShort(t('ui.details') || 'Details')}</summary>
      <pre class="error-pre">${escapeHtmlLong(JSON.stringify(payload, null, 2))}</pre>
    </details>
    <div class="error-actions">
      <button class="btn-copy">${escapeHtmlShort(t('ui.copyDetails') || t('code.copy') || 'Copy')}</button>
      ${reporterConfig.reportUrl ? `<button class="btn-report">${escapeHtmlShort(t('ui.reportIssue') || 'Report issue')}</button>` : ''}
      <button class="btn-dismiss">${escapeHtmlShort(t('ui.close') || 'Close')}</button>
    </div>
  `;

  // Enter animation (opacity + slight translate/scale)
  card.style.willChange = 'transform, opacity';
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px) scale(0.98)';
  card.style.transition = 'transform 180ms ease, opacity 160ms ease-out';

  let dismissed = false;
  let removed = false;
  const finalizeRemove = () => {
    if (removed) return; removed = true;
    try { clearTimeout(autoTimer); } catch (_) {}
    if (card && card.parentNode) card.parentNode.removeChild(card);
    if (typeof onDone === 'function') {
      try { onDone(); } catch (_) {}
    }
  };
  const animateOut = () => {
    if (dismissed) return; dismissed = true;
    // Exit animation
    card.style.transition = 'transform 180ms ease, opacity 140ms ease-in';
    card.style.transform = 'translateY(10px) scale(0.98)';
    card.style.opacity = '0';
    const onEnd = () => { card.removeEventListener('transitionend', onEnd); finalizeRemove(); };
    card.addEventListener('transitionend', onEnd);
    // Safety: ensure removal even if transitionend doesn't fire
    setTimeout(onEnd, 300);
  };

  // Wire actions
  card.querySelector('.btn-dismiss')?.addEventListener('click', animateOut);
  card.querySelector('.btn-copy')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
    const btn = card.querySelector('.btn-copy');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = ok ? (t('code.copied') || 'Copied') : (t('code.failed') || 'Failed');
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  });
  const reportBtn = card.querySelector('.btn-report');
  if (reportBtn) reportBtn.addEventListener('click', () => openReportUrl(payload));

  // Insert and play enter animation on next frame
  root.appendChild(card);
  requestAnimationFrame(() => { requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0) scale(1)';
  }); });

  // Auto-dismiss after 2 minutes unless details expanded
  const autoTimer = setTimeout(() => {
    try {
      if (!card.querySelector('.error-details')?.open) animateOut();
    } catch (_) { animateOut(); }
  }, 120000);

  // If user expands details, keep it longer; if they collapse again, leave timer as-is
  try {
    const det = card.querySelector('.error-details');
    if (det) det.addEventListener('toggle', () => { /* no-op for now */ });
  } catch (_) {}
}

export function initErrorReporter(options = {}) {
  reporterConfig = {
    reportUrl: options.reportUrl || reporterConfig.reportUrl || null,
    siteTitle: options.siteTitle || reporterConfig.siteTitle || 'NanoSite'
  };
  if (!window.__nano_error_handlers_installed) {
    window.addEventListener('error', (e) => {
      try {
        showErrorOverlay(
          e.error || new Error(e.message || 'Script error'),
          {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            origin: 'window.error'
          }
        );
      } catch (_) {}
    });
    window.addEventListener('unhandledrejection', (e) => {
      try {
        showErrorOverlay(
          e.reason || new Error('Unhandled promise rejection'),
          { message: (e.reason && e.reason.message) || 'Unhandled promise rejection', origin: 'unhandledrejection' }
        );
      } catch (_) {}
    });
    window.__nano_error_handlers_installed = true;
  }
}

// Allow app code to attach additional structured context (e.g., route info)
export function setReporterContext(obj) {
  try {
    const o = (obj && typeof obj === 'object') ? obj : {};
    extraContext = { ...(extraContext || {}), ...o };
  } catch (_) { /* ignore */ }
}

// Minimal HTML escapers to avoid importing utils
function escapeHtmlShort(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[c]));
}
function escapeHtmlLong(s) { return escapeHtmlShort(s); }
