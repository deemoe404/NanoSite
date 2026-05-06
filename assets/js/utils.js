// General utilities and safe helpers
// Content root helper: default to 'wwwroot' but allow runtime override via window.__press_content_root
export function getContentRoot() {
  try {
    const raw = (typeof window !== 'undefined' && window.__press_content_root) ? String(window.__press_content_root) : 'wwwroot';
    return raw.replace(/^\/+|\/+$/g, '');
  } catch (_) {
    return 'wwwroot';
  }
}
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
      const seg = parts[i]
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
        .replace(/\\\|/g, '&#124;');
      result += seg;
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

// Stricter URL sanitizer for image sources.
// Allows only: relative URLs, http(s), blob:, and data:image/* (excluding SVG).
export function sanitizeImageUrl(url) {
  try {
    const raw = String(url || '').trim();
    if (!raw) return '';
    // Protocol-relative -> resolve with current protocol
    const normalized = raw.startsWith('//') ? (window.location.protocol + raw) : raw;
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(normalized);
    if (!hasScheme) return normalized; // relative
    const u = new URL(normalized, document.baseURI);
    const p = (u.protocol || '').toLowerCase();
    if (p === 'http:' || p === 'https:' || p === 'blob:') return u.href;
    if (p === 'data:') {
      // Permit only raster image data URIs; explicitly disallow SVG-based payloads
      const body = normalized.slice(5); // after 'data:'
      const m = body.match(/^image\/([A-Za-z0-9.+-]+)[;,]/);
      if (!m) return '';
      const type = (m[1] || '').toLowerCase();
      const allowed = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif', 'bmp', 'x-icon']);
      return allowed.has(type) ? normalized : '';
    }
    // Block all other schemes (javascript:, file:, ftp:, etc.)
    return '';
  } catch (_) {
    return '';
  }
}

export function resolveImageSrc(src, baseDir) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/.test(s) || s.startsWith('/') || s.startsWith('#')) {
    return sanitizeUrl(s);
  }
  const stripSlashes = (val) => String(val || '').replace(/^\/+|\/+$/g, '');
  const normalizedBase = stripSlashes(baseDir);
  const normalizedRoot = stripSlashes(getContentRoot());
  const candidate = s.replace(/^\/+/, '');

  // Already normalized relative to either the active base directory or content root
  if (normalizedBase && candidate.startsWith(`${normalizedBase}/`)) return candidate;
  if (normalizedRoot && candidate.startsWith(`${normalizedRoot}/`)) return candidate;

  const base = (normalizedBase ? `${normalizedBase}/` : '');
  try {
    const u = new URL(candidate, `${location.origin}/${base}`);
    return u.pathname.replace(/^\/+/, '');
  } catch (_) {
    return `${base}${candidate}`.replace(/\/+/, '/');
  }
}

// Tags and attributes emitted by the Markdown renderer itself. User-authored
// tags are escaped before rendering and are not admitted through this path.
const __NS_RENDERED_MARKDOWN_TAGS = new Set([
  'a','blockquote','br','code','del','div','em','h1','h2','h3','h4','h5','h6',
  'hr','img','input','label','li','ol','p','pre','source','span','strong',
  'table','tbody','td','th','thead','tr','ul','video'
]);
const __NS_RENDERED_MARKDOWN_VOID_TAGS = new Set(['br','hr','img','input','source']);
const __NS_RENDERED_MARKDOWN_GLOBAL_ATTRS = new Set(['aria-hidden','aria-label','class','data-callout','for','id','role','title']);
const __NS_RENDERED_MARKDOWN_TAG_ATTRS = {
  a: new Set(['href']),
  code: new Set(['class']),
  div: new Set(['class','data-callout','role']),
  h1: new Set(['id']),
  h2: new Set(['id']),
  h3: new Set(['id']),
  h4: new Set(['id']),
  h5: new Set(['id']),
  h6: new Set(['id']),
  img: new Set(['alt','src','title']),
  input: new Set(['checked','disabled','id','type']),
  label: new Set(['for']),
  ol: new Set(['start']),
  pre: new Set(['class']),
  source: new Set(['src','type']),
  span: new Set(['aria-hidden','class']),
  video: new Set(['aria-label','class','controls','playsinline','poster','preload','title'])
};
function __press_isAllowedAttr(tag, attr) {
  if (!attr) return false;
  const a = String(attr).toLowerCase();
  if (a.startsWith('on')) return false;
  if (__NS_RENDERED_MARKDOWN_GLOBAL_ATTRS.has(a)) return true;
  const spec = __NS_RENDERED_MARKDOWN_TAG_ATTRS[tag];
  return !!(spec && spec.has(a));
}
function __press_rewriteHref(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  if (s.startsWith('#') || s.startsWith('?')) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return sanitizeUrl(s);
  if (s.startsWith('/')) return s;
  return resolveImageSrc(s, baseDir);
}
function __press_rewriteSrc(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  if (/^(data:|blob:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return sanitizeUrl(s);
  if (s.startsWith('/')) return s;
  return resolveImageSrc(s, baseDir);
}
export function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(variable);
  return value !== null ? decodeURIComponent(value) : null;
}

let baseSiteTitle = (() => {
  const t = document.title || 'Press';
  return (t && String(t).trim()) || 'Press';
})();

export function setBaseSiteTitle(title) {
  const next = (title && String(title).trim()) || null;
  baseSiteTitle = next || baseSiteTitle || 'Press';
}

export function setDocTitle(title) {
  if (title && String(title).trim()) document.title = `${String(title).trim()} · ${baseSiteTitle}`;
  else document.title = baseSiteTitle;
}

export function cardImageSrc(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return getContentRoot() + '/' + s.replace(/^\/+/, '');
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

// Safely set controlled renderer markup into a target element without using innerHTML.
export function setSafeHtml(target, html, baseDir, options = {}) {
  if (!target) return;
  const input = String(html || '');
  const opts = options && typeof options === 'object' ? options : {};
  if (!opts.alreadySanitized) {
    try { target.textContent = input; } catch (_) {}
    return;
  }
  // Build a DOM fragment by tokenizing the renderer output and creating
  // elements/attributes programmatically.
  try {
    const safeHtml = input;

    // Minimal HTML entity unescape for attribute values we set via setAttribute.
    const unescapeHtml = (s) => String(s || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

    // Decode HTML entities for text nodes so Markdown entities render as characters.
    const decodeEntities = (() => {
      const NAMED_ENTITIES = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: '\u00A0',
      };

      return (s) => {
        const str = String(s || '');
        if (!str) return '';

        return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w:-]*);/g, (m, entity) => {
          if (!entity) return m;
          if (entity[0] === '#') {
            const isHex = entity[1] === 'x' || entity[1] === 'X';
            const num = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            if (!Number.isFinite(num) || num < 0) return m;
            try {
              return String.fromCodePoint(num);
            } catch (_) {
              return m;
            }
          }

          const named = NAMED_ENTITIES[entity.toLowerCase()];
          return typeof named === 'string' ? named : m;
        });
      };
    })();

    const frag = document.createDocumentFragment();
    const stack = [];

    const appendNode = (node) => {
      const parent = stack.length ? stack[stack.length - 1] : frag;
      parent.appendChild(node);
    };

    // Tokenize tags. Any unexpected tag is preserved as text.
    const tagRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*)>/g;
    let last = 0;
    let m;
    while ((m = tagRe.exec(safeHtml))) {
      // Text before the tag
      const text = safeHtml.slice(last, m.index);
      if (text) appendNode(document.createTextNode(decodeEntities(text)));
      last = tagRe.lastIndex;

      const raw = m[0];
      const tag = (m[1] || '').toLowerCase();
      const attrs = m[2] || '';
      const isClose = /^<\//.test(raw);
      const isVoid = __NS_RENDERED_MARKDOWN_VOID_TAGS.has(tag);

      if (isClose) {
        // Pop to the nearest matching tag if present
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tagName && stack[i].tagName.toLowerCase() === tag) {
            stack.length = i; // pop everything after i
            break;
          }
        }
        continue;
      }

      if (!__NS_RENDERED_MARKDOWN_TAGS.has(tag)) {
        appendNode(document.createTextNode(raw));
        continue;
      }

      const el = document.createElement(tag);

      // Apply allowed attributes with URL rewriting
      const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
      let a;
      while ((a = attrRe.exec(attrs))) {
        const name = (a[1] || '').toLowerCase();
        if (!name || name.startsWith('on')) continue;
        if (!__press_isAllowedAttr(tag, name)) continue;
        const rawVal = a[3] ?? a[4] ?? a[5] ?? '';
        let val = unescapeHtml(rawVal);
        if (name === 'href') val = __press_rewriteHref(val, baseDir);
        else if (name === 'src') val = __press_rewriteSrc(val, baseDir);
        try { el.setAttribute(name, val); } catch (_) {}
      }

      appendNode(el);
      if (!isVoid) stack.push(el);
    }
    // Remainder after the last tag
    const tail = safeHtml.slice(last);
    if (tail) appendNode(document.createTextNode(decodeEntities(tail)));

    target.replaceChildren(frag);
  } catch (_) {
    // Last resort: never inject as HTML; show as text
    try { target.textContent = input; } catch (__) {}
  }
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

// Human-readable byte size formatting (pure)
export function formatBytes(n) {
  if (!n && n !== 0) return '';
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

// Lightweight article skeleton markup (pure)
export function renderSkeletonArticle() {
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

// Check if a click is modified (meta/ctrl/shift/alt or non-left button) (pure)
export function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
