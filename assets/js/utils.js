// General utilities and safe helpers
export function escapeHtml(text) {
  return typeof text === 'string'
    ? text
        .replace(/&(?!#[0-9]+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : null;
}

export function escapeMarkdown(text) {
  const parts = String(text || '').replace(/\\`/g, '&#096;').split('`');
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
        .replace(/\\\\/g, '&#092;')
        .replace(/\\\*/g, '&#042;')
        .replace(/\\_/g, '&#095;')
        .replace(/\\{/g, '&#123;').replace(/\\}/g, '&#125;')
        .replace(/\\\[/g, '&#091;').replace(/\\\]/g, '&#093;')
        .replace(/\\\(/g, '&#040;').replace(/\\\)/g, '&#041;')
        .replace(/\\#/g, '&#035;')
        .replace(/\\\+/g, '&#043;')
        .replace(/\\-/g, '&#045;')
        .replace(/\\\./g, '&#046;')
        .replace(/\\!/g, '&#033;')
        .replace(/\\\|/g, '&#124;')
        .replace(/<!--[\s\S]*?-->/g, '');
    } else {
      result += parts[i];
    }
    if (i < parts.length - 1) result += '`';
  }
  return result;
}

export function sanitizeUrl(url) {
  const s = String(url || '').trim();
  const lower = s.toLowerCase();
  const proto = lower.match(/^([a-z][a-z0-9+.-]*):/);
  if (!proto) return s; // relative URL
  const p = proto[1];
  return ['http', 'https', 'mailto', 'tel'].includes(p) ? s : '#';
}

export function resolveImageSrc(src, baseDir) {
  const s = String(src || '').trim();
  if (/^[a-z][a-z0-9+.-]*:/.test(s) || s.startsWith('/') || s.startsWith('#')) {
    return sanitizeUrl(s);
  }
  const base = String(baseDir || '').replace(/^\/+|\/+$/g, '') + '/';
  try {
    const u = new URL(s, `${location.origin}/${base}`);
    return u.pathname.replace(/^\/+/, '');
  } catch (_) {
    return `${base}${s}`.replace(/\/+/, '/');
  }
}

export function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(variable);
  return value !== null ? decodeURIComponent(value) : null;
}

let baseSiteTitle = (() => {
  const t = document.title || 'NanoSite';
  return (t && String(t).trim()) || 'NanoSite';
})();

export function setBaseSiteTitle(title) {
  const next = (title && String(title).trim()) || null;
  baseSiteTitle = next || baseSiteTitle || 'NanoSite';
}

export function setDocTitle(title) {
  if (title && String(title).trim()) document.title = `${String(title).trim()} · ${baseSiteTitle}`;
  else document.title = baseSiteTitle;
}

export function cardImageSrc(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'wwwroot/' + s.replace(/^\/+/, '');
}

export function fallbackCover(title) {
  const t = String(title || '').trim();
  const initial = t ? escapeHtml(t[0].toUpperCase()) : '?';
  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#f87171', '#10b981', '#fb7185'];
  let sum = 0;
  for (let i = 0; i < t.length; i++) sum = (sum + t.charCodeAt(i)) % 9973;
  const color = palette[sum % palette.length];
  return `<div class=\"card-cover-wrap card-fallback\" style=\"--cover-bg:${color}\"><span class=\"cover-initial\">${initial}</span></div>`;
}

export function renderTags(tagVal) {
  if (!tagVal && tagVal !== 0) return '';
  let tags = [];
  if (Array.isArray(tagVal)) tags = tagVal;
  else if (typeof tagVal === 'string') tags = tagVal.split(',');
  else tags = [String(tagVal)];
  tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (!tags.length) return '';
  return `<div class=\"tags\">${tags.map(t => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>`;
}

// Generate a slug for tab titles. Works for non-Latin scripts by
// hashing when ASCII slug would be empty.
export const slugifyTab = (s) => {
  const src = String(s || '').trim();
  const ascii = src.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  // Fallback: stable hash-based slug for non-ASCII titles
  let hash = 0;
  for (let i = 0; i < src.length; i++) { hash = ((hash << 5) - hash) + src.charCodeAt(i); hash |= 0; }
  return 't-' + Math.abs(hash).toString(36);
};

// Format a date string for display; accepts ISO/"YYYY-MM-DD"/Date
export function formatDisplayDate(input) {
  if (!input && input !== 0) return '';
  try {
    const d = (input instanceof Date) ? input : new Date(String(input));
    if (isNaN(d.getTime())) return escapeHtml(String(input));
    const lang = (document.documentElement && document.documentElement.getAttribute('lang')) || undefined;
    return d.toLocaleDateString(lang || undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return escapeHtml(String(input));
  }
}
