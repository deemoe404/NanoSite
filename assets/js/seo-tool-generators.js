import { state } from './seo-tool-state.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';
import { setEditorValue, getEditorValue } from './hieditor.js';
import { generateSitemapData } from './seo.js?v=2';
import { fetchConfigWithYamlFallback } from './yaml.js';
import { getContentRootFrom, loadSiteConfigFlex } from './seo-tool-config.js';
import { getCurrentLang, DEFAULT_LANG, withLangParam } from './i18n.js';
import { parseFrontMatter, stripFrontMatter, stripMarkdownToText } from './content.js';
import { extractSEOFromMarkdown } from './seo.js?v=2';

// --- Helpers shared by preview and sitemap enrichment ---
async function __fetchMdWithFallback(loc) {
  try {
    const siteCfg = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
    const cr = getContentRootFrom(siteCfg);
    const candidates = [];
    const normLoc = String(loc || '').replace(/^\/+/, '');
    const base = cr.replace(/\/+$/,'');
    // Try resourceURL absolute first
    try {
      const res = String(siteCfg.resourceURL || '').trim();
      if (res) {
        const u = new URL(normLoc.replace(/^\/+/, ''), res.endsWith('/') ? res : (res + '/'));
        candidates.push(u.toString());
      }
    } catch (_) {}
    // Then local fallbacks
    candidates.push(`${base}/${normLoc}`);
    candidates.push(`/${normLoc}`);
    candidates.push(normLoc);
    for (const u of candidates) {
      try { const r = await fetch(u); if (r.ok) return await r.text(); } catch (_) {}
    }
  } catch (_) {}
  return '';
}

function __toISODateYYYYMMDD(input) {
  try {
    const s = String(input || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0,10);
  } catch (_) {}
  return null;
}

function t(kind, msg){ try { window.showToast && window.showToast(kind, msg); } catch (_) {} }

// Build a link with an explicit language code, regardless of current UI language
function withGivenLang(urlStr, langCode) {
  try {
    const url = new URL(urlStr, window.location.href);
    if (langCode) url.searchParams.set('lang', String(langCode));
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch (_) {
    const joiner = urlStr.includes('?') ? '&' : '?';
    return `${urlStr}${joiner}lang=${encodeURIComponent(String(langCode||''))}`;
  }
}

// Formatters
function formatXML(xml) {
  try {
    const P = />(\s*)</g;
    xml = xml.replace(P, '>$1\n<');
    let pad = 0; let result = '';
    xml.split('\n').forEach(line => {
      if (!line.trim()) return;
      if (line.match(/^<\//)) pad = Math.max(pad - 1, 0);
      result += '  '.repeat(pad) + line.trim() + '\n';
      if (line.match(/^<[^!?][^>]*[^\/]>/) && !line.match(/<.*<\/.*>/)) pad += 1;
    });
    return result.trim();
  } catch (_) { return xml; }
}
function formatHTMLFragment(html) { return formatXML(html); }

// Escapers
function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, function(char) {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}
function escapeXML(str) {
  return String(str || '').replace(/[<>&'\"]/g, function(char) {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

// Generators
function generateSitemapXML(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  urls.forEach(url => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXML(url.loc)}</loc>\n`;
    if (Array.isArray(url.alternates) && url.alternates.length) {
      url.alternates.forEach(alt => {
        if (!alt || !alt.href || !alt.hreflang) return;
        xml += `    <xhtml:link rel="alternate" hreflang="${escapeXML(alt.hreflang)}" href="${escapeXML(alt.href)}"/>\n`;
      });
      if (url.xdefault) {
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXML(url.xdefault)}"/>\n`;
      }
    }
    if (url.lastmod) xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    if (url.changefreq) xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    if (url.priority) xml += `    <priority>${url.priority}</priority>\n`;
    xml += '  </url>\n';
  });
  xml += '</urlset>';
  return xml;
}

function generateRobotsTxt(siteConfig) {
  const baseUrl = window.location.origin + '/';
  const cr = getContentRootFrom(siteConfig);
  let robots = `User-agent: *\n`;
  robots += `Allow: /\n\n`;
  robots += `# Sitemap\n`;
  robots += `Sitemap: ${baseUrl}sitemap.xml\n\n`;
  robots += `# Allow crawling of main content\n`;
  robots += `Allow: /${cr}/\n`;
  robots += `Allow: /assets/\n\n`;
  robots += `# Disallow admin or internal directories\n`;
  robots += `Disallow: /admin/\n`;
  robots += `Disallow: /.git/\n`;
  robots += `Disallow: /node_modules/\n`;
  robots += `Disallow: /.env\n`;
  robots += `Disallow: /package.json\n`;
  robots += `Disallow: /package-lock.json\n\n`;
  robots += `# SEO tools (allow but not priority)\n`;
  robots += `Allow: /seo-generator.html\n`;
  robots += `Allow: /sitemap-generator.html\n\n`;
  robots += `# Crawl delay (be nice to servers)\n`;
  robots += `Crawl-delay: 1\n\n`;
  robots += `# Generated by NanoSite SEO Generator\n`;
  robots += `# ${new Date().toISOString()}\n`;
  return robots;
}

function generateMetaTagsHTML(siteConfig) {
  const baseUrl = window.location.origin + '/';
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    return val.default || fallback;
  };
  const siteTitle = getLocalizedValue(siteConfig.siteTitle, 'NanoSite');
  const siteDescription = getLocalizedValue(siteConfig.siteDescription, 'A pure front-end blog template');
  const siteKeywords = getLocalizedValue(siteConfig.siteKeywords, 'blog, static site, markdown');
  const avatar = siteConfig.avatar || 'assets/avatar.png';
  const fullAvatarUrl = avatar.startsWith('http') ? avatar : baseUrl + avatar;
  let html = `  <!-- Primary SEO Meta Tags -->\n`;
  html += `  <title>${escapeHTML(siteTitle)}</title>\n`;
  html += `  <meta name="title" content="${escapeHTML(siteTitle)}">\n`;
  html += `  <meta name="description" content="${escapeHTML(siteDescription)}">\n`;
  html += `  <meta name="keywords" content="${escapeHTML(siteKeywords)}">\n`;
  html += `  <meta name="author" content="${escapeHTML(siteTitle)}">\n`;
  html += `  <meta name="robots" content="index, follow">\n`;
  html += `  <link rel="canonical" href="${baseUrl}">\n`;
  html += `  \n`;
  html += `  <!-- Open Graph / Facebook -->\n`;
  html += `  <meta property="og:type" content="website">\n`;
  html += `  <meta property="og:url" content="${baseUrl}">\n`;
  html += `  <meta property="og:title" content="${escapeHTML(siteTitle)}">\n`;
  html += `  <meta property="og:description" content="${escapeHTML(siteDescription)}">\n`;
  html += `  <meta property="og:image" content="${fullAvatarUrl}">\n`;
  html += `  <meta property="og:logo" content="${fullAvatarUrl}">\n`;
  html += `  \n`;
  html += `  <!-- Twitter -->\n`;
  html += `  <meta property="twitter:card" content="summary_large_image">\n`;
  html += `  <meta property="twitter:url" content="${baseUrl}">\n`;
  html += `  <meta property="twitter:title" content="${escapeHTML(siteTitle)}">\n`;
  html += `  <meta property="twitter:description" content="${escapeHTML(siteDescription)}">\n`;
  html += `  <meta property="twitter:image" content="${fullAvatarUrl}">\n`;
  html += `  \n`;
  html += `  <!-- Initial meta tags - will be updated by dynamic SEO system -->\n`;
  html += `  <meta name="theme-color" content="#1a1a1a">\n`;
  html += `  <meta name="msapplication-TileColor" content="#1a1a1a">\n`;
  html += `  <link rel="icon" type="image/png" href="${avatar}">`;
  return html;
}

// ---- Human-friendly previews and Source overlay ----
function __escHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[c]));
}

// Map language codes (en, zh-CN, ja) to human-friendly names
function labelLang(code) {
  try {
    if (!code) return '';
    const map = {
      'en': 'English', 'en-us': 'English (US)', 'en-gb': 'English (UK)',
      'zh': 'Chinese', 'zh-cn': 'Chinese (Simplified)', 'zh-sg': 'Chinese (Simplified)', 'zh-tw': 'Chinese (Traditional)', 'zh-hk': 'Chinese (Traditional)',
      'ja': 'Japanese', 'ko': 'Korean', 'fr': 'French', 'de': 'German', 'es': 'Spanish', 'pt': 'Portuguese', 'pt-br': 'Portuguese (BR)', 'it': 'Italian',
      'ru': 'Russian', 'ar': 'Arabic', 'hi': 'Hindi', 'id': 'Indonesian', 'vi': 'Vietnamese', 'th': 'Thai', 'tr': 'Turkish', 'nl': 'Dutch',
      'sv': 'Swedish', 'pl': 'Polish', 'he': 'Hebrew', 'fa': 'Persian'
    };
    const key = String(code).toLowerCase();
    if (map[key]) return map[key];
    const base = key.split(/[-_]/)[0];
    if (map[base]) return map[base];
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      try {
        const dn = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' });
        const name = dn.of(base);
        if (name) return name.charAt(0).toUpperCase() + name.slice(1);
      } catch (_) {}
    }
    return code;
  } catch(_) { return String(code || ''); }
}

function openSourceOverlay(title, code, language = 'plain'){
  try {
    const overlay = document.getElementById('tab-help-overlay');
    const titleEl = document.getElementById('tab-help-title');
    const bodyEl = document.getElementById('tab-help-body');
    const closeBtn = document.getElementById('tab-help-close');
    if (!overlay || !titleEl || !bodyEl || !closeBtn) return;
    const raw = String(code || '');
    const langClass = `language-${(language||'plain').toLowerCase()}`;
    const pre = `<div class=\"hi-editor\"><div class=\"code-scroll\"><div class=\"code-gutter\"></div><pre class=\"hi-pre\"><code class=\"${langClass}\">${__escHtml(raw)}</code></pre></div></div>`;
    const html = `<p style=\"margin:.25rem 0 .5rem;color:#57606a\">Raw source</p>${pre}`;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden','true');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
      try { closeBtn.removeEventListener('click', close); } catch(_){}
      try { overlay.removeEventListener('click', onOverlay); } catch(_){}
    };
    const onOverlay = (e) => { if (e && e.target === overlay) close(); };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', onOverlay);
    overlay.querySelector('.gh-modal')?.addEventListener('click', (e)=> e.stopPropagation());
    try { initSyntaxHighlighting && initSyntaxHighlighting(); } catch(_){}
  } catch (_) {}
}

function setHTML(id, html){ const el = document.getElementById(id); if (el) el.innerHTML = html; }
// expose overlay + editor getter globally for inline anchors
try { window.openSourceOverlay = openSourceOverlay; } catch (_) {}
try { window.__getEditorVal = getEditorValue; } catch (_) {}
try {
  window.__openSrc = function(textareaId, lang, title){
    try {
      const content = (window.__getEditorVal && window.__getEditorVal(textareaId)) || (document.getElementById(textareaId) || {}).value || '';
      openSourceOverlay(title || 'Source', content || '', lang || 'plain');
    } catch (_) {}
    return false;
  };
} catch (_) {}

async function renderSitemapPreview(urls = []){
  const baseUrl = window.location.origin + '/';
  const total = Array.isArray(urls) ? urls.length : 0;
  const lastmods = urls.map(u => u.lastmod).filter(Boolean).sort();
  const latest = lastmods.length ? lastmods[lastmods.length - 1] : '—';
  const cfg = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
  const cr = getContentRootFrom(cfg);

  const posts = (window.__seoToolState && window.__seoToolState.currentPostsData) || {};
  const tabs  = (window.__seoToolState && window.__seoToolState.currentTabsData) || {};

  const langPref = (() => {
    const cur = getCurrentLang ? getCurrentLang() : DEFAULT_LANG;
    return [cur, DEFAULT_LANG, 'en', 'zh', 'ja', 'default'];
  })();

  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const titleFromMd = (md) => {
    try {
      const { frontMatter, content } = parseFrontMatter(md || '');
      if (frontMatter && frontMatter.title) return String(frontMatter.title).trim();
      const m = String(content || '').match(/^#\s+(.+)/m);
      return m ? m[1].trim() : '';
    } catch(_) { return ''; }
  };
  async function fetchMdWithFallback(loc) {
    const candidates = [];
    const normLoc = String(loc || '').replace(/^\/+/, '');
    const base = cr.replace(/\/+$/,'');
    // contentRoot-based
    candidates.push(`${base}/${normLoc}`);
    candidates.push(`/${normLoc}`);
    candidates.push(normLoc);
    // Try resourceURL from site config if present
    try {
      const siteCfg = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
      const res = String(siteCfg.resourceURL || '').trim();
      if (res) {
        const u = new URL(normLoc.replace(/^\/+/, ''), res.endsWith('/') ? res : (res + '/'));
        candidates.unshift(u.toString());
      }
    } catch(_) {}
    for (const u of candidates) {
      try { const r = await fetch(u); if (r.ok) return await r.text(); } catch(_) {}
    }
    return '';
  }
  async function readPostDetails(loc) {
    try {
      const md = await fetchMdWithFallback(loc);
      const title = titleFromMd(md);
      return { title, md };
    } catch(_) { return { title: '', md: '' }; }
  }
  // Cache for per-file metrics to avoid repeated fetch/parsing
  const __mdInfoCache = new Map(); // loc -> { title, dateStr, tags, wordCount }
  async function computeInfoFor(loc, metaHint) {
    try {
      if (__mdInfoCache.has(loc)) return __mdInfoCache.get(loc);
      const md = await fetchMdWithFallback(loc);
      // Title per file (front-matter title > H1)
      let title = '';
      try {
        const { frontMatter, content } = parseFrontMatter(md || '');
        title = (frontMatter && frontMatter.title) ? String(frontMatter.title).trim() : titleFromMd(md);
      } catch(_) { title = titleFromMd(md); }
      let dateStr = '';
      let tags = [];
      let wordCount = 0;
      if (md) {
        let fm = {};
        try { fm = parseFrontMatter(md).frontMatter || {}; } catch(_) {}
        try {
          const siteCfgBase = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
          const siteCfg = { ...siteCfgBase };
          if (!siteCfg.avatar) siteCfg.avatar = 'assets/avatar.jpeg';
          const seo = extractSEOFromMarkdown(md, { ...(metaHint||{}), location: loc }, siteCfg) || {};
          if (seo.publishedTime) { try { dateStr = String(seo.publishedTime).slice(0,10); } catch(_) {} }
          if (Array.isArray(seo.tags)) tags = seo.tags;
        } catch(_) {}
        try {
          if (!dateStr && fm && fm.date) dateStr = String(fm.date).trim();
          if ((!tags || !Array.isArray(tags) || tags.length === 0) && fm) {
            if (Array.isArray(fm.tags)) tags = fm.tags;
            else if (typeof fm.tags === 'string' && fm.tags.trim()) tags = [fm.tags.trim()];
          }
        } catch(_) {}
        try {
          const plain = stripMarkdownToText(stripFrontMatter(md));
          const basic = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
          wordCount = basic > 1 ? basic : (plain || '').replace(/\s+/g, '').length;
        } catch(_) {}
      }
      const res = { title, dateStr, tags, wordCount };
      __mdInfoCache.set(loc, res);
      return res;
    } catch(_) { return { dateStr: '', tags: [], wordCount: 0 }; }
  }
  function langsOf(meta) {
    const langs = [];
    for (const [k, v] of Object.entries(meta || {})) {
      if (typeof v === 'string') langs.push(k);
      else if (Array.isArray(v) && v.length > 0) langs.push(k);
      else if (v && typeof v === 'object' && (v.location || v.title)) langs.push(k);
    }
    return langs;
  }
  function pick(meta) {
    const pickFromArray = (arr) => {
      try {
        if (!Array.isArray(arr) || arr.length === 0) return { location: '', title: '' };
        const last = arr[arr.length - 1];
        if (typeof last === 'string') return { location: last, title: '' };
        if (last && typeof last === 'object') return { location: last.location || '', title: last.title || '' };
        for (let i = arr.length - 1; i >= 0; i--) {
          const it = arr[i];
          if (typeof it === 'string') return { location: it, title: '' };
          if (it && typeof it === 'object' && (it.location || it.title)) return { location: it.location || '', title: it.title || '' };
        }
      } catch (_) {}
      return { location: '', title: '' };
    };
    for (const l of langPref) {
      const v = meta && meta[l];
      if (typeof v === 'string') return { lang: l, location: v, title: '' };
      if (Array.isArray(v)) { const picked = pickFromArray(v); return { lang: l, location: picked.location, title: picked.title || '' }; }
      if (v && typeof v === 'object' && v.location) return { lang: l, location: v.location, title: v.title || '' };
    }
    // legacy flat
    if (meta && meta.location) return { lang: langPref[0], location: meta.location, title: meta.title || '' };
    return { lang: langPref[0], location: '', title: '' };
  }

  // Build grouped post entries (parent with per-version children)
  // Lazily load per-language details to enable incremental rendering + progress
  const postItems = (() => {
    const groups = [];
    const extractVersion = (p) => {
      try { const m = String(p||'').match(/\/(v\d+(?:\.\d+){1,3})\//i); return (m && m[1]) || 'v0'; } catch(_) { return 'v0'; }
    };
    const semverCmpDesc = (a,b)=>{ const A=String(a).replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0); const B=String(b).replace(/^v/i,'').split('.').map(n=>parseInt(n,10)||0); for(let i=0;i<Math.max(A.length,B.length);i++){const da=A[i]||0,db=B[i]||0;if(da!==db)return db-da;} return 0; };
    for (const [key, meta] of Object.entries(posts)) {
      const versionMap = new Map();
      const add = (lang, loc) => {
        if (!loc) return; const ver = extractVersion(loc);
        if (!versionMap.has(ver)) versionMap.set(ver, { perLang: {}, langs: [] });
        const rec = versionMap.get(ver); rec.perLang[lang] = loc; if (!rec.langs.includes(lang)) rec.langs.push(lang);
      };
      for (const [lang, v] of Object.entries(meta || {})) {
        if (typeof v === 'string') add(lang, v);
        else if (Array.isArray(v)) v.forEach(it => { if (typeof it === 'string') add(lang, it); else if (it && it.location) add(lang, it.location); });
        else if (v && typeof v === 'object' && v.location) add(lang, v.location);
      }
      const versions = Array.from(versionMap.keys()).sort(semverCmpDesc);
      const allLangs = Array.from(new Set([].concat(...Array.from(versionMap.values()).map(x => x.langs))));
      const parent = { type: 'group', key, title: key, versionCount: versions.length, langs: allLangs, children: [] };
      for (const ver of versions) {
        const rec = versionMap.get(ver);
        const primaryLang = langPref.find(l => rec.langs.includes(l)) || rec.langs[0] || 'en';
        const primaryLoc = rec.perLang[primaryLang];
        const perLangLinks = rec.langs.map(l => {
          const loc = rec.perLang[l] || '';
          const q = loc ? `/index.html?id=${encodeURIComponent(loc)}` : '';
          return { lang: l, href: q ? withGivenLang(q, l) : '' };
        }).filter(x => x.href);
        // Seed without details (title/date/tags/words) — will be filled lazily
        const perLangDetails = rec.langs.map(l => {
          const loc = rec.perLang[l] || '';
          const link = perLangLinks.find(x => x.lang === l);
          const href = link ? link.href : '';
          return { lang: l, location: loc, href, title: '', dateStr: '', tags: [], wordCount: 0 };
        });
        parent.children.push({ type: 'post', key: `${key}@${ver}`, version: ver, title: `${key} ${ver}`.trim(), langs: rec.langs, multi: rec.langs.length>1, href: primaryLoc ? withGivenLang(`/index.html?id=${encodeURIComponent(primaryLoc)}`, primaryLang) : '#', location: primaryLoc, perLangLinks, perLang: rec.perLang, perLangDetails });
      }
      parent.children.sort((a,b)=>{ const av=a.version||'v0', bv=b.version||'v0'; return semverCmpDesc(av,bv); });
      groups.push(parent);
    }
    return groups.sort((a,b)=> a.key.localeCompare(b.key));
  })();

  // Build tab entries
  const tabItems = (() => {
    const entries = [];
    const pickFromArray = (arr) => {
      try {
        if (!Array.isArray(arr) || arr.length === 0) return { location: '', title: '' };
        const last = arr[arr.length - 1];
        if (typeof last === 'string') return { location: last, title: '' };
        if (last && typeof last === 'object') return { location: last.location || '', title: last.title || '' };
        for (let i = arr.length - 1; i >= 0; i--) {
          const it = arr[i];
          if (typeof it === 'string') return { location: it, title: '' };
          if (it && typeof it === 'object' && (it.location || it.title)) return { location: it.location || '', title: it.title || '' };
        }
      } catch (_) {}
      return { location: '', title: '' };
    };
    for (const [key, meta] of Object.entries(tabs)) {
      const langs = langsOf(meta);
      const primary = pick(meta);
      const slug = slugify(key);
      const title = primary.title || key;
      const perLangDetails = langs.map(l => {
        const v = meta && meta[l];
        let loc = '';
        if (typeof v === 'string') loc = v;
        else if (Array.isArray(v)) loc = pickFromArray(v).location || '';
        else if (v && typeof v === 'object' && v.location) loc = v.location;
        return { lang: l, href: withGivenLang(`/index.html?tab=${encodeURIComponent(slug)}`, l), location: loc };
      });
      entries.push({ type: 'tab', key, title, langs, perLangDetails, multi: langs.length > 1, href: withLangParam(`/index.html?tab=${encodeURIComponent(slug)}`) });
    }
    return entries.sort((a,b)=> a.key.localeCompare(b.key));
  })();

  // Helper to create a safe DOM id for later incremental updates
  const makeId = (key, ver, lang) => {
    const slug = slugify(String(key||''));
    const v = String(ver||'v0').replace(/[^a-z0-9.-]/gi,'-');
    const l = String(lang||'').replace(/[^a-z0-9.-]/gi,'-');
    return `postd-${slug}-${v}-${l}`;
  };

  const postsList = postItems.map((group, groupIdx) => {
    const sepStyle = groupIdx > 0
      ? ' style="border-top:1px solid #d0d7de; margin-top:.5rem; padding-top:.5rem;"'
      : '';
    // Helper to render a language list (used for single-version and per-version)
    const renderLangs = (groupKey, ver, perLangDetails = []) => perLangDetails.map(d => {
      const langCode = `<code>${__escHtml(labelLang(d.lang))}</code>`;
      const sep = '<span class=\\"chip-sep\\">:</span>';
      const pathCode = d.location ? `<code>${__escHtml(d.location)}</code>` : '';
      const chip = `<span class=\"chip is-lang\">${langCode}${pathCode ? sep + pathCode : ''}</span>`;
      const id = makeId(groupKey, ver, d.lang);
      // Initially render with loading placeholder — content replaced as details load
      const placeholder = '<span class=\"dim\" style=\"margin-left:.35rem;\">Loading…</span>';
      return `<li id=\"${id}\"><div class=\"lang-row\">${chip}${placeholder}</div></li>`;
    }).join('');

    let innerHtml = '';
    if (group.versionCount <= 1) {
      // Single version: collapse levels; render languages directly under group
      const only = group.children[0] || { perLangDetails: [] };
      const langsList = renderLangs(group.key, only.version || 'v0', only.perLangDetails || []);
      innerHtml = `<ul class=\"config-list\" style=\"margin-top:.6rem;\">${langsList}</ul>`;
    } else {
      // Multi-version: second-level shows version number; mark latest on first
      const versionsHtml = group.children.map((it, idx) => {
        const isLatest = idx === 0; // sorted desc
        const verLabel = (it.version && it.version !== 'v0') ? __escHtml(it.version) : 'version';
        const latestChip = isLatest ? ' <span class=\"chip\">latest</span>' : '';
        const langsList = renderLangs(group.key, it.version, it.perLangDetails || []);
        const head = `<div class=\"item-head\"><a href=\"${__escHtml(it.href)}\"><strong>${verLabel}</strong></a>${latestChip}</div>`;
        return `<li>${head}<ul class=\"config-list\" style=\"margin:.6rem 0 0 .75rem\">${langsList}</ul></li>`;
      }).join('');
      innerHtml = `<ul class=\"config-list\" style=\"margin-top:.5rem;\">${versionsHtml}</ul>`;
    }

    return `
      <li${sepStyle}>
        <div class=\"item-head topline\">
          <span class=\"l1-title\">${__escHtml(group.title)}</span>
          <span class=\"mini-badge\">${group.versionCount} version${group.versionCount>1?'s':''}</span>
        </div>
        ${innerHtml}
      </li>`;
  }).join('');

  const tabsList = tabItems.map(it => (
    `<li>
       <a href="${__escHtml(it.href)}">${__escHtml(it.title)}</a>
       <div class="config-value" style="margin-top:.25rem;">
         <span class="badge ok">Static Page</span>
         <span class="badge ${it.langs.length>1?'ok':'warn'}">${it.langs.length>1 ? 'Multilingual' : 'Single language'}</span>
         <span class="dim" style="margin-left:.5rem;">Languages:</span>
         ${
           (it.perLangDetails || it.langs.map(l => ({ lang: l, href: withLangParam(`/index.html?tab=${encodeURIComponent(slugify(it.key))}&lang=${encodeURIComponent(l)}`), location: '' })))
             .map(d => `<span class="chip is-lang"><code>${__escHtml(labelLang(d.lang))}</code>${d.location?`<span class="chip-sep">:</span><code>${__escHtml(d.location)}</code>`:''}</span>`)
             .join('')
         }
       </div>
     </li>`
  )).join('');

  const body = [
    '<div class="config-group">',
    '  <div class="config-group-title">🧭 Overview</div>',
    '  <div class="section-body">',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Site Root</span></span><div class="config-value"><code>', __escHtml(baseUrl), '</code></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">URL Count</span></span><div class="config-value"><span class="badge ok">', String(total), ' URLs</span></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Last Modified</span></span><div class="config-value">', __escHtml(latest), '</div></div>',
    '  </div>',
    '</div>',
    '<div class="config-group">',
    '  <div class="config-group-title">🏠 Home</div>',
    '  <div class="section-body">',
    `    <ul class="config-list"><li><a href="${__escHtml(withLangParam('/index.html'))}">/index.html</a></li></ul>`,
    '  </div>',
    '</div>',
    '<div class="config-group">',
    '  <div class="config-group-title">📝 Posts</div>',
    '  <div class="section-body">',
    postsList ? `<ul class="config-list">${postsList}</ul>` : '<div class="dim" style="padding:.25rem 0 .5rem;">No posts</div>',
    '  </div>',
    '</div>',
    '<div class="config-group">',
    '  <div class="config-group-title">📁 Tabs</div>',
    '  <div class="section-body">',
    tabsList ? `<ul class="config-list">${tabsList}</ul>` : '<div class="dim" style="padding:.25rem 0 .5rem;">No tabs</div>',
    '  </div>',
    '</div>'
  ].join('');

  const html = [
    '<div class="config-header">',
    '  <div class="config-header-left"><h3>Sitemap</h3></div>',
    '  <div class="status-inline">',
    '    <p class="success">✓ Generated</p>',
    '    <button class="icon-btn" type="button" onclick="generateSitemap()" title="Refresh sitemap" aria-label="Refresh sitemap">',
    '      <svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/>',
    '        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
    '      </svg>',
    '    </button>',
    '  </div>',
    '</div>',
    '<div class="config-body">', body, '</div>'
  ].join('');
  // Inject progress badge into Posts title
  const totalTasks = (() => {
    try {
      let n = 0;
      postItems.forEach(g => g.children.forEach(ch => n += (ch.perLangDetails||[]).length));
      return n;
    } catch(_) { return 0; }
  })();
  const withProgress = html.replace(
    '<div class="config-group-title">📝 Posts</div>',
    `<div class="config-group-title">📝 Posts <span id=\"posts-progress\" class=\"mini-badge\">0% (0/${totalTasks})</span></div>`
  );
  setHTML('sitemapPreview', withProgress);
  // Keep view mode consistent if a toggle exists for this section
  try { if (window.__applyView) window.__applyView('sitemap'); } catch (_) {}

  // Start lazy loading of per-language details and live update DOM + progress
  try {
    let done = 0;
    const updateProgress = () => {
      const el = document.getElementById('posts-progress');
      if (el) {
        const pct = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
        el.textContent = `${pct}% (${done}/${totalTasks})`;
      }
    };
    updateProgress();
    const tasks = [];
    for (const g of postItems) {
      for (const ch of g.children) {
        for (const d of (ch.perLangDetails||[])) {
          tasks.push({ id: makeId(g.key, ch.version, d.lang), lang: d.lang, href: d.href, loc: d.location });
        }
      }
    }
    // Process in small concurrent batches to keep UI responsive
    const concurrency = 1;
    let idx = 0;
    const runOne = async () => {
      const i = idx++;
      if (i >= tasks.length) return;
      const { id, lang, href, loc } = tasks[i];
      try {
        const info = loc ? await computeInfoFor(loc, { lang }) : { title: '', dateStr: '', tags: [], wordCount: 0 };
        const el = document.getElementById(id);
        if (el) {
          const langLabel = __escHtml(labelLang(lang));
          const titleHtml = info.title
            ? (href ? `<a href="${__escHtml(href)}"><strong class="post-title">${__escHtml(info.title)}</strong></a>`
                     : `<strong class="post-title">${__escHtml(info.title)}</strong>`)
            : '';
          const langPathChip = ` <span class="chip is-lang"><code>${langLabel}</code>${loc?`<span class=\"chip-sep\">:</span><code>${__escHtml(loc)}</code>`:''}</span>`;
          const dateB = info.dateStr ? ` <span class="mini-badge is-date">Date: ${__escHtml(info.dateStr)}</span>` : '';
          const wordsB = ` <span class="mini-badge is-words">Words: ${info.wordCount || 0}</span>`;
          const tagsHtml = (Array.isArray(info.tags) && info.tags.length) ? ` <span class="dim tags-label" style="margin-left:.5rem;">Tags:</span> ${info.tags.map(tg => `<span class=\"chip is-tag\">${__escHtml(tg)}</span>`).join('')}` : '';
          el.innerHTML = `<div class="lang-row">${titleHtml}${langPathChip}</div><div class="config-value" style="margin-top:.25rem;">${dateB}${wordsB}${tagsHtml}</div>`;
        }
      } catch(_) {}
      finally { done++; updateProgress(); }
      await runOne();
    };
    const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runOne());
    await Promise.all(runners);
  } catch(_) {}
}

function renderRobotsPreview(text = ''){
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const items = lines.filter(l => !l.startsWith('#'));
  const getVals = (prefix) => items.filter(l => l.toLowerCase().startsWith(prefix + ':')).map(l => l.split(':').slice(1).join(':').trim()).filter(Boolean);
  const userAgents = getVals('user-agent');
  const allows = getVals('allow');
  const disallows = getVals('disallow');
  const sitemaps = getVals('sitemap');
  const crawlDelay = getVals('crawl-delay')[0] || '—';
  const list = (arr) => arr.length ? arr.map(v => `<span class=\"chip\">${__escHtml(v)}</span>`).join('') : '<em class="dim">None</em>';
  const body = [
    '<div class="config-group">',
    '  <div class="config-group-title">🤖 Rules</div>',
    '  <div class="section-body">',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">User-agents</span></span><div class="config-value"><div class="chips">', list(userAgents), '</div></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Allow</span></span><div class="config-value"><div class="chips">', list(allows), '</div></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Disallow</span></span><div class="config-value"><div class="chips">', list(disallows), '</div></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Crawl-delay</span></span><div class="config-value">', __escHtml(crawlDelay), '</div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Sitemap</span></span><div class="config-value">', (sitemaps[0] ? `<code>${__escHtml(sitemaps[0])}</code>` : '<em class="dim">None</em>'), '</div></div>',
    '  </div>',
    '</div>'
  ].join('');
  const html = [
    '<div class="config-header">',
    '  <div class="config-header-left"><h3>Robots.txt</h3></div>',
    '  <div class="status-inline">',
    '    <p class="success">✓ Generated</p>',
    '    <button class="icon-btn" type="button" onclick="generateRobots()" title="Refresh robots.txt" aria-label="Refresh robots.txt">',
    '      <svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/>',
    '        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
    '      </svg>',
    '    </button>',
    '  </div>',
    '</div>',
    '<div class="config-body">', body, '</div>'
  ].join('');
  setHTML('robotsPreview', html);
  try { if (window.__applyView) window.__applyView('robots'); } catch (_) {}
}

function renderMetaPreview(frag = '', cfg = {}){
  let doc;
  try { const parser = new DOMParser(); doc = parser.parseFromString(`<head>${frag}</head>`, 'text/html'); } catch(_) { doc = null; }
  const get = (sel, attr) => { try { const el = doc && doc.querySelector(sel); return el ? (attr ? el.getAttribute(attr) : (el.textContent||'')) : ''; } catch(_) { return ''; } };
  const title = get('title') || get('meta[name="title"]','content');
  const desc = get('meta[name="description"]','content');
  const keys = get('meta[name="keywords"]','content');
  const robots = get('meta[name="robots"]','content');
  const canonical = get('link[rel="canonical"]','href');
  const ogImage = get('meta[property="og:image"]','content');
  const twCard = get('meta[property="twitter:card"]','content');
  const badge = (ok) => ok ? '<span class="badge ok">OK</span>' : '<span class="badge warn">Missing</span>';
  const chips = (v) => v ? v.split(/,\s*/).map(x => `<span class=\"chip\">${__escHtml(x)}</span>`).join('') : '<em class="dim">None</em>';
  const body = [
    '<div class="config-group">',
    '  <div class="config-group-title">🏷 Basics</div>',
    '  <div class="section-body">',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Title</span></span><div class="config-value">', __escHtml(title || ''), ' ', badge(!!title), '</div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Description</span></span><div class="config-value">', __escHtml(desc || ''), ' ', badge(!!desc), '</div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Keywords</span></span><div class="config-value"><div class="chips">', chips(keys || ''), '</div></div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Robots</span></span><div class="config-value">', __escHtml(robots || 'index, follow'), '</div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Canonical</span></span><div class="config-value">', canonical ? `<code>${__escHtml(canonical)}</code>` : '<em class="dim">None</em>', '</div></div>',
    '  </div>',
    '</div>',
    '<div class="config-group">',
    '  <div class="config-group-title">🔗 Social</div>',
    '  <div class="section-body">',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Open Graph Image</span></span><div class="config-value">', ogImage ? `<code>${__escHtml(ogImage)}</code> <span class="badge ok">Set</span>` : '<em class="dim">None</em> <span class="badge warn">Missing</span>', '</div></div>',
    '    <div class="config-item"><span class="config-label"><span class="config-label-text">Twitter Card</span></span><div class="config-value">', __escHtml(twCard || 'summary_large_image'), '</div></div>',
    '  </div>',
    '</div>'
  ].join('');
  const html = [
    '<div class="config-header">',
    '  <div class="config-header-left"><h3>Meta Tags</h3></div>',
    '  <div class="status-inline">',
    '    <p class="success">✓ Generated</p>',
    '    <button class="icon-btn" type="button" onclick="generateMetaTags()" title="Refresh meta tags" aria-label="Refresh meta tags">',
    '      <svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/>',
    '        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
    '      </svg>',
    '    </button>',
    '  </div>',
    '</div>',
    '<div class="config-body">', body, '</div>'
  ].join('');
  setHTML('metaPreview', html);
  try { if (window.__applyView) window.__applyView('meta'); } catch (_) {}
}

// --- Code preview helper ---
function updateCodePreview(previewId, content, language) {
  try {
    const pre = document.getElementById(previewId);
    if (!pre) return;
    // Ensure structure contains a code element
    let code = pre.querySelector('code');
    if (!code) {
      code = document.createElement('code');
      pre.innerHTML = '';
      pre.appendChild(code);
    }
    // Assign explicit language class for highlighter
    const langClass = `language-${(language || 'plain').toLowerCase()}`;
    // Reset existing language-* classes
    Array.from(code.classList).forEach(c => { if (c.startsWith('language-')) code.classList.remove(c); });
    code.classList.add(langClass);
    // Set raw text (clears previous markup if any)
    code.textContent = content || '';
    // Apply highlighter/line numbers
    try { initSyntaxHighlighting(); } catch (_) {}
  } catch (_) {}
}

// Public API for onclick bindings
async function generateSitemap() {
  const statusEl = document.getElementById('sitemap-status');
  const outputEl = document.getElementById('sitemapOutput');
  try {
    if (statusEl) statusEl.innerHTML = '<p>Loading data...</p>';
    state.currentSiteConfig = await loadSiteConfigFlex();
    const cr = getContentRootFrom(state.currentSiteConfig);
    const [postsObj, tabsObj] = await Promise.all([
      fetchConfigWithYamlFallback([`${cr}/index.yaml`,`${cr}/index.yml`]),
      fetchConfigWithYamlFallback([`${cr}/tabs.yaml`,`${cr}/tabs.yml`])
    ]);
    state.currentPostsData = postsObj || {};
    state.currentTabsData = tabsObj || {};
    state.currentSiteConfig = await loadSiteConfigFlex();
    let urls = generateSitemapData(state.currentPostsData, state.currentTabsData, state.currentSiteConfig);
    // Enrich lastmod from post front matter dates where available
    try {
      const enriched = await Promise.all(urls.map(async (u) => {
        try {
          const urlObj = new URL(u.loc, window.location.origin);
          const id = urlObj.searchParams.get('id');
          const tab = urlObj.searchParams.get('tab');
          const lang = urlObj.searchParams.get('lang');
          if (id) {
            const md = await __fetchMdWithFallback(id);
            if (md) {
              let dateStr = null;
              try {
                const { frontMatter } = parseFrontMatter(md);
                if (frontMatter && frontMatter.date) {
                  dateStr = __toISODateYYYYMMDD(frontMatter.date);
                }
              } catch (_) {}
              try {
                if (!dateStr) {
                  const siteCfgBase = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
                  const siteCfg = { ...siteCfgBase };
                  if (!siteCfg.avatar) siteCfg.avatar = 'assets/avatar.jpeg';
                  const seo = extractSEOFromMarkdown(md, { location: id }, siteCfg) || {};
                  if (seo.publishedTime) {
                    dateStr = __toISODateYYYYMMDD(seo.publishedTime);
                  }
                }
              } catch (_) {}
              if (dateStr) u.lastmod = dateStr;
            }
          } else if (tab) {
            // Try to resolve tab markdown by slug and language
            const tabsObj = (window.__seoToolState && window.__seoToolState.currentTabsData) || {};
            // Build reverse lookup: slug -> entry value
            const toSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            let matchedMeta = null;
            for (const [k, v] of Object.entries(tabsObj)) {
              if (toSlug(k) === tab) { matchedMeta = v; break; }
            }
            let loc = null;
            if (matchedMeta && typeof matchedMeta === 'object') {
              const lcode = (lang || '').toLowerCase();
              const mv = matchedMeta[lcode];
              if (typeof mv === 'string') loc = mv;
              else if (mv && typeof mv === 'object' && mv.location) loc = mv.location;
            }
            if (loc) {
              const md = await __fetchMdWithFallback(loc);
              if (md) {
                let dateStr = null;
                try {
                  const { frontMatter } = parseFrontMatter(md);
                  if (frontMatter && frontMatter.date) {
                    dateStr = __toISODateYYYYMMDD(frontMatter.date);
                  }
                } catch (_) {}
                try {
                  if (!dateStr) {
                    const siteCfgBase = (window.__seoToolState && window.__seoToolState.currentSiteConfig) || {};
                    const siteCfg = { ...siteCfgBase };
                    if (!siteCfg.avatar) siteCfg.avatar = 'assets/avatar.jpeg';
                    const seo = extractSEOFromMarkdown(md, { location: loc }, siteCfg) || {};
                    if (seo.publishedTime) {
                      dateStr = __toISODateYYYYMMDD(seo.publishedTime);
                    }
                  }
                } catch (_) {}
                if (dateStr) u.lastmod = dateStr;
              }
            }
          }
        } catch (_) {}
        return u;
      }));
      urls = enriched;
      // Set homepage lastmod to latest post date if available
      const latest = urls
        .map(x => x && x.lastmod)
        .filter(Boolean)
        .sort()
        .slice(-1)[0];
      if (latest) {
        urls.forEach(x => {
          try {
            const uo = new URL(x.loc, window.location.origin);
            const isHome = (uo.pathname === '/' && (!uo.search || uo.search === '' || /^\?lang=/.test(uo.search)));
            if (isHome) x.lastmod = latest;
          } catch (_) {}
        });
      }
    } catch (_) { /* keep defaults on failure */ }
    const xml = generateSitemapXML(urls);
    if (outputEl) outputEl.value = xml;
    try { setEditorValue('sitemapOutput', xml); } catch (_) {}
    if (statusEl) statusEl.innerHTML = '';
    try { renderSitemapPreview(urls); } catch (_) {}
    t('ok', `Sitemap generated (${urls.length} URLs)`);
    try { (window.__seoGenerated = window.__seoGenerated || {}).sitemap = true; } catch (_) {}
    outputEl && outputEl.select();
  } catch (error) {
    console.error('Error generating sitemap:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error generating sitemap: ${error.message}</p>`;
    t('err', `Sitemap error: ${error.message}`);
  }
}

async function generateRobots() {
  const statusEl = document.getElementById('robots-status');
  const outputEl = document.getElementById('robotsOutput');
  try {
    if (statusEl) statusEl.innerHTML = '<p>Generating robots.txt...</p>';
    if (!state.currentSiteConfig.resourceURL) state.currentSiteConfig = await loadSiteConfigFlex();
    const robotsContent = generateRobotsTxt(state.currentSiteConfig);
    if (outputEl) outputEl.value = robotsContent;
    try { setEditorValue('robotsOutput', robotsContent); } catch (_) {}
    if (statusEl) statusEl.innerHTML = '';
    try { renderRobotsPreview(robotsContent); } catch (_) {}
    outputEl && outputEl.select();
    t('ok', 'Robots.txt generated');
    try { (window.__seoGenerated = window.__seoGenerated || {}).robots = true; } catch (_) {}
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error generating robots.txt: ${error.message}</p>`;
    t('err', `Robots error: ${error.message}`);
  }
}

async function generateMetaTags() {
  const statusEl = document.getElementById('meta-status');
  const outputEl = document.getElementById('metaOutput');
  try {
    if (statusEl) statusEl.innerHTML = '<p>Generating HTML meta tags...</p>';
    if (!state.currentSiteConfig.resourceURL) state.currentSiteConfig = await loadSiteConfigFlex();
    const metaContent = generateMetaTagsHTML(state.currentSiteConfig);
    if (outputEl) outputEl.value = metaContent;
    try { setEditorValue('metaOutput', metaContent); } catch (_) {}
    if (statusEl) statusEl.innerHTML = '';
    try { renderMetaPreview(metaContent, state.currentSiteConfig); } catch (_) {}
    outputEl && outputEl.select();
    t('ok', 'Meta tags generated');
    try { (window.__seoGenerated = window.__seoGenerated || {}).meta = true; } catch (_) {}
  } catch (error) {
    console.error('Error generating meta tags:', error);
    if (statusEl) statusEl.innerHTML = `<p class="error">✗ Error generating meta tags: ${error.message}</p>`;
  }
}

function copyFromTextarea(id, okMsg){
  let val = '';
  try { val = getEditorValue(id) || ''; } catch (_) {}
  if (!val) {
    const el = document.getElementById(id);
    val = el ? (el.value || '') : '';
  }
  if (!val) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val)
      .then(()=>{ t('ok', okMsg); })
      .catch(()=>{ el.select(); document.execCommand('copy'); t('ok', okMsg); });
  } else { el.select(); document.execCommand('copy'); t('ok', okMsg); }
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Validators
function validateSitemap(){
  const val = getEditorValue('sitemapOutput') || (document.getElementById('sitemapOutput') || {}).value || '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(val, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) { t('err', 'Invalid XML'); return false; }
    const ok = doc.documentElement && (doc.documentElement.localName === 'urlset');
    t(ok ? 'ok' : 'warn', ok ? 'XML is valid (urlset root)' : 'XML valid but unexpected root');
    return ok;
  } catch (e) { t('err', 'Validation failed'); return false; }
}
function validateRobots(){
  const val = (getEditorValue('robotsOutput') || (document.getElementById('robotsOutput') || {}).value || '').toLowerCase();
  const hasUA = val.includes('user-agent');
  const hasSM = val.includes('sitemap:');
  if (hasUA && hasSM) { t('ok', 'Robots looks OK'); return true; }
  if (!hasUA && !hasSM) { t('warn', 'Missing User-agent and Sitemap'); return false; }
  t('warn', !hasUA ? 'Missing User-agent' : 'Missing Sitemap');
  return false;
}
function validateMeta(){
  const frag = getEditorValue('metaOutput') || (document.getElementById('metaOutput') || {}).value || '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<head>${frag}</head>`, 'text/html');
    const hasDesc = !!doc.querySelector('meta[name="description"]');
    const hasTitle = !!doc.querySelector('title');
    const ok = hasDesc && hasTitle;
    t(ok ? 'ok' : 'warn', ok ? 'Meta looks OK' : 'Missing <title> or description');
    return ok;
  } catch (_) { t('err', 'Validation failed'); return false; }
}

// Beautifiers removed (no longer used)

// Copy/Download glue
function copySitemap(){ copyFromTextarea('sitemapOutput', 'Sitemap copied'); }
function copyRobots(){ copyFromTextarea('robotsOutput', 'Robots.txt copied'); }
function copyMetaTags(){ copyFromTextarea('metaOutput', 'Meta tags copied'); }
function downloadSitemap(){ const c = (getEditorValue('sitemapOutput')) || ''; downloadFile('sitemap.xml', c, 'application/xml'); }
function downloadRobots(){ const c = (getEditorValue('robotsOutput')) || ''; downloadFile('robots.txt', c, 'text/plain'); }
function downloadMetaTags(){ const c = (getEditorValue('metaOutput')) || ''; downloadFile('meta-tags.html', c, 'text/html'); }

// Expose to window for inline attributes
window.generateSitemap = generateSitemap;
window.generateRobots = generateRobots;
window.generateMetaTags = generateMetaTags;
window.copySitemap = copySitemap;
window.copyRobots = copyRobots;
window.copyMetaTags = copyMetaTags;
window.validateSitemap = validateSitemap;
window.validateRobots = validateRobots;
window.validateMeta = validateMeta;
window.downloadSitemap = downloadSitemap;
window.downloadRobots = downloadRobots;
window.downloadMetaTags = downloadMetaTags;

// Make state discoverable to UI overlay for editor
window.__seoToolState = state;

// Expose a small helper to update preview when external edits occur
window.__seoUpdatePreview = function(id){
  try { const ta = document.getElementById(id); const val = ta ? (ta.value || '') : ''; setEditorValue(id, val); } catch (_) {}
}
