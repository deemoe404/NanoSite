// General utilities and safe helpers
// Content root helper: default to 'wwwroot' but allow runtime override via window.__ns_content_root
export function getContentRoot() {
  try {
    const raw = (typeof window !== 'undefined' && window.__ns_content_root) ? String(window.__ns_content_root) : 'wwwroot';
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
      let seg = parts[i]
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
      // Robustly strip HTML comments by repeating until stable
      seg = (function removeHtmlComments(input) {
        let prev, out = String(input || '');
        do {
          prev = out;
          out = out.replace(/<!--[\s\S]*?-->/g, '');
        } while (out !== prev);
        return out;
      })(seg);
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

// Allow a safe subset of HTML tags within Markdown content.
// - Escapes all text outside tags
// - Keeps only allowlisted tags/attributes
// - Rewrites relative href/src/srcset relative to the markdown file's folder (baseDir)
const __NS_ALLOWED_TAGS = new Set([
  'b','strong','i','em','u','mark','small','sub','sup','kbd','abbr','ins','del',
  'span','div','section','article','p','br','hr',
  'blockquote','pre','code','figure','figcaption',
  'a','img','video','source','picture',
  'ul','ol','li','table','thead','tbody','tfoot','tr','td','th','colgroup','col',
  'details','summary',
  'h1','h2','h3','h4','h5','h6',
  'iframe'
]);
const __NS_VOID_TAGS = new Set(['br','hr','img','source','col','input','meta','link']);
const __NS_GLOBAL_ATTRS = new Set(['id','class','title','style','role','lang','dir']);
const __NS_TAG_ATTRS = {
  a: new Set(['href','target','rel','download']),
  img: new Set(['src','alt','width','height','loading','decoding','srcset','sizes','referrerpolicy']),
  video: new Set(['src','controls','autoplay','loop','muted','poster','preload','playsinline','width','height']),
  source: new Set(['src','type','media','sizes','srcset']),
  table: new Set(['border','summary']),
  td: new Set(['colspan','rowspan','headers','scope','align','valign']),
  th: new Set(['colspan','rowspan','headers','scope','align','valign']),
  iframe: new Set(['src','width','height','allow','allowfullscreen','loading','referrerpolicy','title'])
};
function __ns_isAllowedAttr(tag, attr) {
  if (!attr) return false;
  const a = String(attr).toLowerCase();
  if (a.startsWith('on')) return false; // no inline handlers
  if (a.startsWith('data-') || a.startsWith('aria-')) return true;
  if (__NS_GLOBAL_ATTRS.has(a)) return true;
  const spec = __NS_TAG_ATTRS[tag];
  return !!(spec && spec.has(a));
}
function __ns_rewriteHref(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  if (s.startsWith('#') || s.startsWith('?')) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return sanitizeUrl(s);
  if (s.startsWith('/')) return s;
  return resolveImageSrc(s, baseDir);
}
function __ns_rewriteSrc(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  if (/^(data:|blob:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return sanitizeUrl(s);
  if (s.startsWith('/')) return s;
  return resolveImageSrc(s, baseDir);
}
function __ns_rewriteSrcset(val, baseDir) {
  const s = String(val || '');
  if (!s.trim()) return s;
  try {
    return s.split(',').map(part => {
      const seg = part.trim();
      if (!seg) return '';
      const bits = seg.split(/\s+/);
      const url = bits.shift();
      const rewritten = __ns_rewriteSrc(url, baseDir);
      return [rewritten, ...bits].join(' ');
    }).filter(Boolean).join(', ');
  } catch (_) { return s; }
}
function __ns_sanitizeAttrs(tag, rawAttrs, baseDir) {
  const s = String(rawAttrs || '');
  let out = '';
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const name = m[1];
    const hasVal = m[2] != null;
    let val = m[3] ?? m[4] ?? m[5] ?? '';
    if (!__ns_isAllowedAttr(tag, name)) continue;
    const low = String(name).toLowerCase();
    if (hasVal) {
      if (low === 'href') val = __ns_rewriteHref(val, baseDir);
      else if (low === 'src') val = __ns_rewriteSrc(val, baseDir);
      else if (low === 'srcset') val = __ns_rewriteSrcset(val, baseDir);
      out += ` ${low}="${escapeHtml(val)}"`;
    } else {
      out += ` ${low}`;
    }
  }
  return out;
}
export function allowUserHtml(input, baseDir) {
  const str = String(input || '');
  if (!str) return '';
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tagRe.exec(str))) {
    // Text before the tag
    out += escapeHtml(str.slice(last, m.index));
    last = tagRe.lastIndex;
    const full = m[0];
    const name = (m[1] || '').toLowerCase();
    const attrs = m[2] || '';
    const isClosing = /^<\//.test(full);
    const isSelfClosing = /\/>$/.test(full) || __NS_VOID_TAGS.has(name);
    if (!__NS_ALLOWED_TAGS.has(name)) {
      out += escapeHtml(full);
      continue;
    }
    if (isClosing) {
      out += `</${name}>`;
    } else {
      const safeAttrs = __ns_sanitizeAttrs(name, attrs, baseDir);
      out += `<${name}${safeAttrs}${isSelfClosing ? ' />' : '>'}`;
    }
  }
  // Remainder after last tag
  out += escapeHtml(str.slice(last));
  return out;
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

// Safely set sanitized HTML into a target element without using innerHTML.
// - Prefers the native Sanitizer API when available
// - Falls back to parsing into a safe DocumentFragment with our allowlist
export function setSafeHtml(target, html, baseDir) {
  if (!target) return;
  const input = String(html || '');
  try {
    // Prefer native Sanitizer API when available
    if (typeof window !== 'undefined' && 'Sanitizer' in window && typeof Element.prototype.setHTML === 'function') {
      const s = new window.Sanitizer();
      target.setHTML(input, { sanitizer: s });
      return;
    }
  } catch (_) { /* fall through to manual sanitizer */ }

  // Manual sanitizer: convert to a safe fragment using our allowlist
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    const tempRoot = doc.body.firstElementChild || doc.body;

    const toFrag = (root) => {
      const frag = document.createDocumentFragment();

      const sanitizeElem = (el) => {
        const tag = el.tagName ? String(el.tagName).toLowerCase() : '';
        const isAllowed = __NS_ALLOWED_TAGS.has(tag);

        // If the element is not allowed, unwrap it by returning a fragment of its children
        if (!isAllowed) {
          const childFrag = document.createDocumentFragment();
          el.childNodes.forEach((ch) => {
            const node = sanitizeNode(ch);
            if (node) childFrag.appendChild(node);
          });
          return childFrag;
        }

        const out = document.createElement(tag);
        // Copy allowed attributes with rewriting
        for (const attr of Array.from(el.attributes || [])) {
          const name = attr.name;
          const low = String(name || '').toLowerCase();
          // Block inline event handlers explicitly
          if (low.startsWith('on')) continue;
          if (!__ns_isAllowedAttr(tag, low)) continue;
          let val = attr.value ?? '';
          if (low === 'href') val = __ns_rewriteHref(val, baseDir);
          else if (low === 'src') val = __ns_rewriteSrc(val, baseDir);
          else if (low === 'srcset') val = __ns_rewriteSrcset(val, baseDir);
          try { out.setAttribute(low, val); } catch (_) {}
        }

        // Recurse children
        el.childNodes.forEach((ch) => {
          const node = sanitizeNode(ch);
          if (node) out.appendChild(node);
        });
        return out;
      };

      const sanitizeNode = (node) => {
        if (!node) return null;
        const t = node.nodeType;
        if (t === Node.TEXT_NODE) {
          return document.createTextNode(node.nodeValue || '');
        }
        if (t === Node.ELEMENT_NODE) {
          return sanitizeElem(node);
        }
        // Drop comments, processing instructions, etc.
        return null;
      };

      root.childNodes.forEach((n) => {
        const safe = sanitizeNode(n);
        if (safe) frag.appendChild(safe);
      });
      return frag;
    };

    const safeFrag = toFrag(tempRoot);
    target.replaceChildren(safeFrag);
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
