// errors.js — lightweight global error overlay and reporter

let reporterConfig = {
  reportUrl: null,
  siteTitle: 'NanoSite'
};
let extraContext = {};

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
  const root = ensureOverlayRoot();
  const payload = formatReportPayload(err, context);
  const card = document.createElement('div');
  card.className = 'error-card';
  card.setAttribute('role', 'alert');
  card.innerHTML = `
    <div class="error-head">⚠️ ${escapeHtmlShort(payload.name)}: ${escapeHtmlShort(payload.message)}</div>
    <div class="error-meta">${new Date(payload.time).toLocaleString()} · ${escapeHtmlShort(payload.app)}</div>
    <details class="error-details">
      <summary>Details</summary>
      <pre class="error-pre">${escapeHtmlLong(JSON.stringify(payload, null, 2))}</pre>
    </details>
    <div class="error-actions">
      <button class="btn-copy">Copy details</button>
      ${reporterConfig.reportUrl ? '<button class="btn-report">Report issue</button>' : ''}
      <button class="btn-dismiss">Dismiss</button>
    </div>
  `;

  const onDismiss = () => { if (card && card.parentNode) card.parentNode.removeChild(card); };
  card.querySelector('.btn-dismiss')?.addEventListener('click', onDismiss);
  card.querySelector('.btn-copy')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
    const btn = card.querySelector('.btn-copy');
    if (btn) { const old = btn.textContent; btn.textContent = ok ? 'Copied!' : 'Copy failed'; setTimeout(() => { btn.textContent = old; }, 1500); }
  });
  const reportBtn = card.querySelector('.btn-report');
  if (reportBtn) reportBtn.addEventListener('click', () => openReportUrl(payload));

  root.appendChild(card);
  // Auto-fade after a while but keep details available if expanded
  setTimeout(() => { if (!card.querySelector('.error-details')?.open) onDismiss(); }, 120000);
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
