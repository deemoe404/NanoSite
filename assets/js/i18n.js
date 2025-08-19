// Simple i18n helper for NanoSite
// Usage & extension:
// - To change the default language, edit DEFAULT_LANG below (or set <html lang="xx"> in index.html; boot code passes that into initI18n).
// - To add a new UI language, add a new top-level key to `translations` (e.g., `es`, `fr`) mirroring the `en` structure.
// - Content i18n now supports a single unified JSON with per-language entries and default fallback.
//   Prefer using one `wwwroot/index.json` that stores, per post, a `default` block and optional language blocks
//   (e.g., `en`, `zh`, `ja`) describing `title` and `location`. Missing languages fall back to `default`.
//   Existing per-language files `index.<lang>.json` and `tabs.<lang>.json` remain supported as a fallback.
// - To show a friendly name in the language dropdown, add an entry to `languageNames`.

import { parseFrontMatter } from './content.js';

// Default language fallback when no user/browser preference is available.
const DEFAULT_LANG = 'en';
// Site base default language (can be overridden by initI18n via <html lang>)
let baseDefaultLang = DEFAULT_LANG;
const STORAGE_KEY = 'lang';

// Export the default language constant for use by other modules
export { DEFAULT_LANG };

// UI translation bundles. Add new languages by copying the `en` structure
// and translating values. Missing keys will fall back to `en`.
const translations = {
  en: {
    ui: {
      allPosts: 'All Posts',
      searchTab: 'Search',
      postTab: 'Post',
      prev: 'Prev',
      next: 'Next',
      contents: 'Contents',
      loading: 'Loading…',
      top: 'Top',
      minRead: 'min read',
      close: 'Close',
      copyLink: 'Copy link',
      linkCopied: 'Link copied',
      outdatedWarning: 'Caution: This blog post may contain outdated information as it has been published a long time ago.',
      notFound: 'Not Found',
      pageUnavailable: 'Page Unavailable',
      indexUnavailable: 'Index unavailable',
      backToAllPosts: 'Back to all posts',
      noResultsTitle: 'No results',
      noResultsBody: (q) => `No posts found for "${q}".`,
      tags: 'Tags',
      tagSearch: (tag) => `Tag: ${tag}`,
      allTags: 'All tags',
      more: 'More',
      less: 'Less',
      details: 'Details',
      copyDetails: 'Copy details',
      reportIssue: 'Report issue',
      warning: 'Warning',
      error: 'Error'
    },
    code: {
      copy: 'Copy',
      copied: 'Copied!',
      failed: 'Copy failed',
      copyAria: 'Copy code'
    },
    errors: {
      postNotFoundTitle: 'Post not found',
      postNotFoundBody: 'The requested post could not be loaded.',
      pageUnavailableTitle: 'Page unavailable',
      pageUnavailableBody: 'Could not load this tab.',
      indexUnavailableBody: 'Could not load the post index. Check network or repository contents.'
    },
    sidebar: {
      searchPlaceholder: 'Search posts...',
      siteTitle: "Phyllali's Blog",
      siteSubtitle: 'Thanks for playing my game.',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: 'Function Area',
      toggleTheme: 'Toggle Theme',
      themePack: 'Theme pack',
      language: 'Language',
      seoGenerator: 'SEO Generator'
    },
    toc: {
      toggleAria: 'Toggle section',
      copied: 'Copied!'
    },
    titles: {
      allPosts: 'All Posts',
      search: (q) => `Search: ${q}`
    }
  },
  zh: {
    ui: {
      allPosts: '全部文章',
      searchTab: '搜索',
      postTab: '文章',
      prev: '上一页',
      next: '下一页',
      contents: '目录',
      loading: '加载中…',
      top: '顶部',
      minRead: '分钟阅读',
      close: '关闭',
      copyLink: '复制链接',
      linkCopied: '已复制链接',
      outdatedWarning: '提示：这篇文章发布已久，内容可能已过时。',
      notFound: '未找到',
      pageUnavailable: '页面不可用',
      indexUnavailable: '索引不可用',
      backToAllPosts: '返回全部文章',
      noResultsTitle: '没有结果',
      noResultsBody: (q) => `未找到与 “${q}” 匹配的文章。`,
      tags: '标签',
      tagSearch: (tag) => `标签：${tag}`,
      allTags: '全部标签',
      more: '更多',
      less: '收起',
      details: '详情',
      copyDetails: '复制详情',
      reportIssue: '报告问题',
      warning: '警告',
      error: '错误'
    },
    code: {
      copy: '复制',
      copied: '已复制',
      failed: '复制失败',
      copyAria: '复制代码'
    },
    errors: {
      postNotFoundTitle: '文章未找到',
      postNotFoundBody: '无法加载所请求的文章。',
      pageUnavailableTitle: '页面不可用',
      pageUnavailableBody: '无法加载该页面。',
      indexUnavailableBody: '无法加载文章索引。请检查网络或仓库内容。'
    },
    sidebar: {
      searchPlaceholder: '搜索文章…',
      siteTitle: 'Phyllali 的博客',
      siteSubtitle: '感谢游玩我的游戏。',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: '功能区',
      toggleTheme: '切换主题',
      themePack: '主题包',
      language: '语言',
      seoGenerator: 'SEO 生成器'
    },
    toc: {
      toggleAria: '展开/折叠章节',
      copied: '已复制！'
    },
    titles: {
      allPosts: '全部文章',
      search: (q) => `搜索：${q}`
    }
  },
  ja: {
    ui: {
      allPosts: 'すべての記事',
      searchTab: '検索',
      postTab: '記事',
      prev: '前へ',
      next: '次へ',
      contents: '目次',
      loading: '読み込み中…',
      top: 'トップ',
      minRead: '分で読めます',
      close: '閉じる',
      copyLink: 'リンクをコピー',
      linkCopied: 'リンクをコピーしました',
      outdatedWarning: '注意：公開から時間が経っているため、内容が古くなっている可能性があります。',
      notFound: '見つかりません',
      pageUnavailable: 'ページを表示できません',
      indexUnavailable: 'インデックスを読み込めません',
      backToAllPosts: 'すべての記事へ戻る',
      noResultsTitle: '結果なし',
      noResultsBody: (q) => `「${q}」に一致する記事は見つかりませんでした。`,
      tags: 'タグ',
      tagSearch: (tag) => `タグ: ${tag}`,
      allTags: 'すべてのタグ',
      more: 'もっと見る',
      less: '折りたたむ',
      details: '詳細',
      copyDetails: '詳細をコピー',
      reportIssue: '問題を報告',
      warning: '警告',
      error: 'エラー'
    },
    code: {
      copy: 'コピー',
      copied: 'コピーしました',
      failed: 'コピー失敗',
      copyAria: 'コードをコピー'
    },
    errors: {
      postNotFoundTitle: '記事が見つかりません',
      postNotFoundBody: '要求された記事を読み込めませんでした。',
      pageUnavailableTitle: 'ページを表示できません',
      pageUnavailableBody: 'このページを読み込めませんでした。',
      indexUnavailableBody: '記事インデックスを読み込めませんでした。ネットワークやリポジトリ内容を確認してください。'
    },
    sidebar: {
      searchPlaceholder: '記事を検索…',
      siteTitle: 'Phyllali のブログ',
      siteSubtitle: 'ゲームを遊んでくれてありがとう。',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: 'ツール',
      toggleTheme: 'テーマ切替',
      themePack: 'テーマパック',
      language: '言語',
      seoGenerator: 'SEOジェネレーター'
    },
    toc: {
      toggleAria: 'セクションの切替',
      copied: 'コピーしました！'
    },
    titles: {
      allPosts: 'すべての記事',
      search: (q) => `検索: ${q}`
    }
  }
  // Additional languages can be added here
};

let currentLang = DEFAULT_LANG;

function detectLang() {
  try {
    const url = new URL(window.location.href);
    const qp = (url.searchParams.get('lang') || '').trim();
    if (qp) return qp;
  } catch (_) {}
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch (_) {}
  const nav = (navigator.language || navigator.userLanguage || '').slice(0, 2);
  return nav || DEFAULT_LANG;
}

export function initI18n(opts = {}) {
  const desired = (opts.lang || detectLang() || '').toLowerCase();
  const def = (opts.defaultLang || DEFAULT_LANG).toLowerCase();
  currentLang = desired || def;
  baseDefaultLang = def || DEFAULT_LANG;
  // If translation bundle missing, fall back to default bundle for UI
  if (!translations[currentLang]) currentLang = def;
  try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
  // Reflect on <html lang>
  document.documentElement.setAttribute('lang', currentLang);
  // Update a few static DOM bits (placeholders, site card)
  applyStaticTranslations();
  return currentLang;
}

export function getCurrentLang() { return currentLang; }

// Translate helper: fetches a nested value from the current language bundle,
// with graceful fallback to the default language.
export function t(path, vars) {
  const segs = String(path || '').split('.');
  const pick = (lang) => segs.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), translations[lang] || {});
  let val = pick(currentLang);
  if (val == null) val = pick(DEFAULT_LANG);
  if (typeof val === 'function') return val(vars);
  return val != null ? String(val) : path;
}

// (language switcher helpers are defined near the end of the file)

// --- Content loading (unified JSON with fallback, plus legacy support) ---

// Normalize common language labels seen in content JSON to BCP-47-ish codes
export function normalizeLangKey(k) {
  const raw = String(k || '').trim();
  const lower = raw.toLowerCase();
  const map = new Map([
    ['english', 'en'],
    ['en', 'en'],
    ['中文', 'zh'],
    ['简体中文', 'zh'],
    ['zh', 'zh'],
    ['zh-cn', 'zh'],
    ['日本語', 'ja'],
    ['にほんご', 'ja'],
    ['ja', 'ja'],
    ['jp', 'ja']
  ]);
  if (map.has(lower)) return map.get(lower);
  // If looks like a code (xx or xx-YY), return lower base
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(raw)) return lower;
  return raw; // fallback to original
}

// Attempt to transform a unified content JSON object into a flat map
// for the current language with default fallback.
function transformUnifiedContent(obj, lang) {
  const RESERVED = new Set(['tag', 'tags', 'image', 'date', 'excerpt']);
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    // Collect language variants on this entry
    let chosen = null;
    let title = null;
    let location = null;
    // Gather variant keys excluding reserved
    const variantKeys = Object.keys(val).filter(k => !RESERVED.has(k));
    // Track langs available on this entry
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    // Pick requested language, else default
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { title: v.title || null, location: v.location || null, excerpt: v.excerpt || null };
      return null;
    };
    // Try requested lang, then site default, then common English code, then legacy 'default'
    const nlang = normalizeLangKey(lang);
    chosen = tryPick(nlang) || tryPick(baseDefaultLang) || tryPick('en') || tryPick('default');
    // If still not chosen, fall back to the first available variant (for single-language entries)
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    // Fallback to legacy flat shape if not unified
    if (!chosen && 'location' in val) {
      chosen = { title: key, location: String(val.location || '') };
    }
    if (!chosen || !chosen.location) continue;
    title = chosen.title || key;
    location = chosen.location;
    const meta = {
      location,
      image: val.image || undefined,
      tag: val.tag != null ? val.tag : (val.tags != null ? val.tags : undefined),
      date: val.date || undefined,
      // Prefer language-specific excerpt; fall back to top-level excerpt for legacy data
      excerpt: (chosen && chosen.excerpt) || val.excerpt || undefined
    };
    out[title] = meta;
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load content metadata from simplified JSON and Markdown front matter
async function loadContentFromFrontMatter(obj, lang) {
  const out = {};
  const langsSeen = new Set();
  const nlang = normalizeLangKey(lang);
  
  // Collect all available languages from the simplified JSON
  for (const [key, val] of Object.entries(obj || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.keys(val).forEach(k => {
        const nk = normalizeLangKey(k);
        if (nk !== 'default') langsSeen.add(nk);
      });
    }
  }
  
  // Process each entry
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    
    // Find the best path for the current language
    let chosenPath = val[nlang] || val[baseDefaultLang] || val['en'] || val['default'];
    
    // Fallback to first available path
    if (!chosenPath) {
      const paths = Object.values(val).filter(p => typeof p === 'string');
      if (paths.length > 0) chosenPath = paths[0];
    }
    
    if (!chosenPath) continue;
    
    try {
      // Load the markdown file and extract front matter
      const response = await fetch(`wwwroot/${chosenPath}`);
      if (!response.ok) continue;
      
      const content = await response.text();
      const { frontMatter } = parseFrontMatter(content);
      
      // Build metadata object
      // Resolve relative image path (e.g., "cover.jpg") against the markdown's folder
      const resolveImagePath = (img) => {
        const s = String(img || '').trim();
        if (!s) return undefined;
        // Absolute or protocol URLs stay as-is
        if (/^(https?:|data:)/i.test(s) || s.startsWith('/')) return s;
        // Resolve relative to the markdown location (without wwwroot/ prefix)
        const lastSlash = chosenPath.lastIndexOf('/');
        const baseDir = lastSlash >= 0 ? chosenPath.slice(0, lastSlash + 1) : '';
        return (baseDir + s).replace(/\/+/g, '/');
      };

      const meta = {
        location: chosenPath,
        image: resolveImagePath(frontMatter.image) || undefined,
        tag: frontMatter.tags || frontMatter.tag || undefined,
        date: frontMatter.date || undefined,
        excerpt: frontMatter.excerpt || undefined
      };
      
      // Use title from front matter or fallback to key
      const title = frontMatter.title || key;
      out[title] = meta;
    } catch (error) {
      console.warn(`Failed to load content from ${chosenPath}:`, error);
      // Fallback to basic metadata
      out[key] = { location: chosenPath };
    }
  }
  
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Try to load unified JSON (`base.json`) first; if not unified or missing, fallback to legacy
// per-language files (base.<currentLang>.json -> base.<default>.json -> base.json)
export async function loadContentJson(basePath, baseName) {
  // Try unified
  try {
    const r = await fetch(`${basePath}/${baseName}.json`);
    if (r.ok) {
      const obj = await r.json();
      // Heuristic: if any entry contains a `default` or a non-reserved language-like key, treat as unified
      const keys = Object.keys(obj || {});
      let isUnified = false;
      let isSimplified = false;
      
      // Check if it's a simplified format (just path mappings) or unified format
      for (const k of keys) {
        const v = obj[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          // Check for simplified format (language -> path mapping)
          const innerKeys = Object.keys(v);
          const hasOnlyPaths = innerKeys.every(ik => typeof v[ik] === 'string');
          
          if (hasOnlyPaths) {
            isSimplified = true;
            break;
          }
          
          // Check for unified format
          if ('default' in v) { isUnified = true; break; }
          if (innerKeys.some(ik => !['tag','tags','image','date','excerpt','location'].includes(ik))) { isUnified = true; break; }
        }
      }
      
      if (isSimplified) {
        // Handle simplified format - load metadata from front matter
        const current = getCurrentLang();
        const { entries, availableLangs } = await loadContentFromFrontMatter(obj, current);
        __setContentLangs(availableLangs);
        return entries;
      }
      
      if (isUnified) {
        const current = getCurrentLang();
        const { entries, availableLangs } = transformUnifiedContent(obj, current);
        // Record available content languages so the dropdown can reflect them
        __setContentLangs(availableLangs);
        return entries;
      }
      // Not unified; fall through to legacy handling below
    }
  } catch (_) { /* fall back */ }

  // Legacy per-language JSON chain
  return loadLangJson(basePath, baseName);
}

// Transform unified tabs JSON into a flat map: title -> { location }
function transformUnifiedTabs(obj, lang) {
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const variantKeys = Object.keys(val);
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { title: v.title || null, location: v.location || null };
      return null;
    };
    const nlang = normalizeLangKey(lang);
    let chosen = tryPick(nlang) || tryPick(baseDefaultLang) || tryPick('en') || tryPick('default');
    // If not found, fall back to the first available variant to ensure visibility
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    if (!chosen && 'location' in val) chosen = { title: key, location: String(val.location || '') };
    if (!chosen || !chosen.location) continue;
    const title = chosen.title || key;
    // Provide a stable slug derived from the base key so it stays consistent across languages
    const stableSlug = String(key || '').toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || ('t-' + Math.abs(Array.from(String(key||'')).reduce((h,c)=>((h<<5)-h)+c.charCodeAt(0)|0,0)).toString(36));
    out[title] = { location: chosen.location, slug: stableSlug };
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load tabs in unified format first, then fall back to legacy per-language files
export async function loadTabsJson(basePath, baseName) {
  try {
    const r = await fetch(`${basePath}/${baseName}.json`);
    if (r.ok) {
      const obj = await r.json();
      let isUnified = false;
      for (const [k, v] of Object.entries(obj || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if ('default' in v) { isUnified = true; break; }
          const inner = Object.keys(v);
          if (inner.some(ik => !['location'].includes(ik))) { isUnified = true; break; }
        }
      }
      if (isUnified) {
        const current = getCurrentLang();
        const { entries, availableLangs } = transformUnifiedTabs(obj, current);
        __setContentLangs(availableLangs);
        return entries;
      }
    }
  } catch (_) { /* fall through */ }
  return loadLangJson(basePath, baseName);
}

// Ensure lang param is included when generating internal links
export function withLangParam(urlStr) {
  try {
    const url = new URL(urlStr, window.location.href);
    url.searchParams.set('lang', currentLang);
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch (_) {
    // Fallback: naive append
    const joiner = urlStr.includes('?') ? '&' : '?';
    return `${urlStr}${joiner}lang=${encodeURIComponent(currentLang)}`;
  }
}

// Try to load JSON for a given base name with lang suffix, falling back in order:
// base.<currentLang>.json -> base.<default>.json -> base.json
export async function loadLangJson(basePath, baseName) {
  const attempts = [
    `${basePath}/${baseName}.${currentLang}.json`,
    `${basePath}/${baseName}.${DEFAULT_LANG}.json`,
    `${basePath}/${baseName}.json`
  ];
  for (const p of attempts) {
    try {
      const r = await fetch(p);
      if (!r.ok) continue;
      return await r.json();
    } catch (_) { /* try next */ }
  }
  return {};
}

// Update static DOM bits outside main render cycle (sidebar card, search placeholder)
function applyStaticTranslations() {
  // Search placeholder
  const input = document.getElementById('searchInput');
  if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder'));
}

// Expose translations for testing/customization
export const __translations = translations;

// Friendly names for the language switcher. Add an entry when you add a new language.
const languageNames = { en: 'English', zh: '中文', ja: '日本語' };
let __contentLangs = null;
function __setContentLangs(list) {
  try {
    const add = Array.isArray(list) && list.length ? Array.from(new Set(list)) : [];
    if (!__contentLangs || !__contentLangs.length) {
      __contentLangs = add.length ? add : null;
    } else if (add.length) {
      const s = new Set(__contentLangs);
      add.forEach(x => s.add(x));
      __contentLangs = Array.from(s);
    }
  } catch (_) { /* ignore */ }
}
export function getAvailableLangs() {
  // Prefer languages discovered from content (unified index), else UI bundle keys
  return (__contentLangs && __contentLangs.length) ? __contentLangs : Object.keys(translations);
}
export function getLanguageLabel(code) { return languageNames[code] || code; }

// Programmatic language switching used by the sidebar dropdown
export function switchLanguage(langCode) {
  const code = String(langCode || '').toLowerCase();
  if (!code) return;
  try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
  document.documentElement.setAttribute('lang', code);
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.assign(url.toString());
  } catch (_) {
    const joiner = window.location.search ? '&' : '?';
    window.location.assign(window.location.pathname + window.location.search + `${joiner}lang=${encodeURIComponent(code)}`);
  }
}
