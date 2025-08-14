// Simple i18n helper for NanoSite
// Usage & extension:
// - To change the default language, edit DEFAULT_LANG below (or set <html lang="xx"> in index.html; boot code passes that into initI18n).
// - To add a new UI language, add a new top-level key to `translations` (e.g., `es`, `fr`) mirroring the `en` structure.
// - To localize content listings, add `wwwroot/index.<lang>.json` and `wwwroot/tabs.<lang>.json`.
// - To show a friendly name in the language dropdown, add an entry to `languageNames`.

// Default language fallback when no user/browser preference is available.
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'lang';

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
      notFound: 'Not Found',
      pageUnavailable: 'Page Unavailable',
      indexUnavailable: 'Index unavailable'
    },
    errors: {
      postNotFoundTitle: 'Post not found',
      postNotFoundBody: 'The requested post could not be loaded. <a href="./">Back to all posts</a>.',
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
      language: 'Language'
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
      notFound: '未找到',
      pageUnavailable: '页面不可用',
      indexUnavailable: '索引不可用'
    },
    errors: {
      postNotFoundTitle: '文章未找到',
      postNotFoundBody: '无法加载所请求的文章。<a href="./">返回全部文章</a>。',
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
      language: '语言'
    },
    toc: {
      toggleAria: '展开/折叠章节',
      copied: '已复制！'
    },
    titles: {
      allPosts: '全部文章',
      search: (q) => `搜索：${q}`
    }
  }
  // Additional languages can be added here, e.g., zh, es, etc.
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
  // Site card
  const title = document.querySelector('.site-card .site-title');
  if (title) title.textContent = t('sidebar.siteTitle');
  const subtitle = document.querySelector('.site-card .site-subtitle');
  if (subtitle) subtitle.textContent = t('sidebar.siteSubtitle');
  const gh = document.querySelector('.site-card .social-links a');
  if (gh) gh.textContent = t('sidebar.socialGithub');
}

// Expose translations for testing/customization
export const __translations = translations;

// Friendly names for the language switcher. Add an entry when you add a new language.
const languageNames = { en: 'English', zh: '中文' };
export function getAvailableLangs() { return Object.keys(translations); }
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
