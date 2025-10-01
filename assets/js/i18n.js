// Simple i18n helper for NanoSite
// Usage & extension:
// - To change the default language, edit DEFAULT_LANG below (or set <html lang="xx"> in index.html; boot code passes that into initI18n).
// - To add a new UI language, create a file in assets/i18n (for example: assets/i18n/es.js) that mirrors en.js and
//   register it in assets/i18n/languages.json.
// - Content i18n supports a single unified YAML with per-language entries and default fallback.
//   Prefer using one `wwwroot/index.yaml` that stores, per post, a `default` block and optional language blocks
//   (e.g., `en`, `zh`, `ja`) describing `title` and `location`. Missing languages fall back to `default`.
//   Legacy per-language files like `index.<lang>.yaml` and `tabs.<lang>.yaml` are also supported.
// - Friendly language names come from assets/i18n/languages.json (or the language module's metadata).

import { parseFrontMatter } from './content.js';
import { getContentRoot } from './utils.js';
import { fetchConfigWithYamlFallback } from './yaml.js';
import enTranslations, { languageMeta as enLanguageMeta } from '../i18n/en.js';

// Fetch of content files uses { cache: 'no-store' } to avoid stale data

// Default language fallback when no user/browser preference is available.
const DEFAULT_LANG = 'en';
// Site base default language (can be overridden by initI18n via <html lang>)
let baseDefaultLang = DEFAULT_LANG;
const STORAGE_KEY = 'lang';

// Export the default language constant for use by other modules
export { DEFAULT_LANG };

// UI translation bundles are loaded dynamically from assets/i18n.
// Each language module should export a default object that mirrors en.js.
// Missing keys automatically fall back to the default language bundle.
const translations = {};
const languageNames = {};
let languageManifest = [];
let manifestLoadPromise = null;
const languageModuleUrls = new Map();
const bundleLoadPromises = new Map();
let manifestBaseUrl = null;

// Limit for concurrent front matter fetches when resolving simplified content entries.
// Set to a positive integer to chunk requests; falsy values disable the limit.
const FRONTMATTER_FETCH_BATCH_SIZE = 6;

export const POSTS_METADATA_READY_EVENT = 'ns:posts-metadata-ready';

const frontMatterMetadataCache = new Map();
const frontMatterPromiseCache = new Map();
const frontMatterFetchQueue = [];
let frontMatterActiveFetches = 0;

function interpretTruthyFlag(v) {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'enabled';
}

function normalizeMarkdownPath(path) {
  if (typeof path === 'string') return path.trim();
  return String(path || '').trim();
}

function getFrontMatterConcurrencyLimit() {
  if (Number.isFinite(FRONTMATTER_FETCH_BATCH_SIZE) && FRONTMATTER_FETCH_BATCH_SIZE > 0) {
    return FRONTMATTER_FETCH_BATCH_SIZE;
  }
  return Infinity;
}

async function performFrontMatterFetch(markdownPath) {
  const path = normalizeMarkdownPath(markdownPath);
  if (!path) return { location: path };
  try {
    const url = `${getContentRoot()}/${path}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response || !response.ok) {
      console.warn(`Failed to load content from ${path}: HTTP ${response ? response.status : 'unknown'}`);
      return { location: path };
    }
    const content = await response.text();
    const { frontMatter } = parseFrontMatter(content);
    const resolveImagePath = (img) => {
      const raw = String(img || '').trim();
      if (!raw) return undefined;
      if (/^(https?:|data:)/i.test(raw) || raw.startsWith('/')) return raw;
      const lastSlash = path.lastIndexOf('/');
      const baseDir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
      return (baseDir + raw).replace(/\\+/g, '/');
    };
    const fm = frontMatter || {};
    return {
      location: path,
      image: resolveImagePath(fm.image) || undefined,
      tag: fm.tags || fm.tag || undefined,
      date: fm.date || undefined,
      excerpt: fm.excerpt || undefined,
      versionLabel: fm.version || undefined,
      ai: interpretTruthyFlag(fm.ai || fm.aiGenerated || fm.llm) || undefined,
      draft: interpretTruthyFlag(fm.draft || fm.wip || fm.unfinished || fm.inprogress) || undefined,
      __title: fm.title || undefined
    };
  } catch (error) {
    console.warn(`Failed to load content from ${path}:`, error);
    return { location: path };
  }
}

function processFrontMatterQueue() {
  const limit = getFrontMatterConcurrencyLimit();
  while (frontMatterFetchQueue.length && frontMatterActiveFetches < limit) {
    const job = frontMatterFetchQueue.shift();
    if (!job || typeof job.resolve !== 'function') {
      continue;
    }
    const path = normalizeMarkdownPath(job.path);
    if (!path) {
      try { job.resolve({ location: path }); } catch (_) {}
      continue;
    }
    frontMatterActiveFetches += 1;
    performFrontMatterFetch(path)
      .then((meta) => {
        const data = meta && meta.location ? meta : { location: path };
        const stable = Object.freeze({ ...data });
        frontMatterMetadataCache.set(path, stable);
        try { job.resolve(stable); } catch (_) {}
      })
      .catch((err) => {
        console.warn(`Failed to load content from ${path}:`, err);
        const fallback = Object.freeze({ location: path });
        frontMatterMetadataCache.set(path, fallback);
        try { job.resolve(fallback); } catch (_) {}
      })
      .finally(() => {
        frontMatterActiveFetches = Math.max(0, frontMatterActiveFetches - 1);
        frontMatterPromiseCache.delete(path);
        processFrontMatterQueue();
      });
  }
}

function getFrontMatterMetadata(path) {
  const normalized = normalizeMarkdownPath(path);
  if (!normalized) return Promise.resolve({ location: normalized });
  if (frontMatterMetadataCache.has(normalized)) {
    return Promise.resolve(frontMatterMetadataCache.get(normalized));
  }
  if (frontMatterPromiseCache.has(normalized)) {
    return frontMatterPromiseCache.get(normalized);
  }
  const promise = new Promise((resolve) => {
    frontMatterFetchQueue.push({ path: normalized, resolve });
    processFrontMatterQueue();
  });
  frontMatterPromiseCache.set(normalized, promise);
  return promise;
}

const FALLBACK_LANGUAGE_LABEL = (enLanguageMeta && enLanguageMeta.label) ? enLanguageMeta.label : 'English';
translations[DEFAULT_LANG] = enTranslations;
languageNames[DEFAULT_LANG] = FALLBACK_LANGUAGE_LABEL;
languageManifest = [{ value: DEFAULT_LANG, label: FALLBACK_LANGUAGE_LABEL }];

function emitBundleLoaded(lang) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('ns:i18n-bundle-loaded', { detail: { lang } }));
  } catch (_) { /* ignore */ }
}

function upsertManifestEntry(value, label, { preferFront = false } = {}) {
  if (!value) return;
  const normalized = String(value).toLowerCase();
  const display = label || languageNames[normalized] || normalized;
  const idx = languageManifest.findIndex((item) => item && item.value === normalized);
  if (idx >= 0) {
    const existing = languageManifest[idx];
    if (!existing || existing.label !== display) {
      languageManifest[idx] = { value: normalized, label: display };
    }
  } else if (preferFront) {
    languageManifest.unshift({ value: normalized, label: display });
  } else {
    languageManifest.push({ value: normalized, label: display });
  }
}

async function loadLanguageBundle(langCode) {
  const code = String(langCode || '').toLowerCase();
  if (!code) return null;
  if (translations[code]) return translations[code];
  if (bundleLoadPromises.has(code)) return bundleLoadPromises.get(code);
  if (manifestLoadPromise) await manifestLoadPromise;
  const moduleHref = languageModuleUrls.get(code);
  if (!moduleHref) {
    if (code === DEFAULT_LANG) return translations[DEFAULT_LANG] || null;
    // Attempt implicit fallback to ./<code>.js relative to manifest when not registered
    if (manifestBaseUrl) {
      try {
        const implicitUrl = new URL(`./${code}.js`, manifestBaseUrl);
        languageModuleUrls.set(code, implicitUrl.href);
        return loadLanguageBundle(code);
      } catch (_) {
        // ignore
      }
    }
    return null;
  }
  const loader = (async () => {
    try {
      const mod = await import(moduleHref);
      const bundle = (mod && typeof mod.default === 'object') ? mod.default : (mod && typeof mod.translations === 'object' ? mod.translations : null);
      if (!bundle) {
        console.warn(`[i18n] Language module ${moduleHref} did not export a translations object`);
        return null;
      }
      translations[code] = bundle;
      const metaLabel = languageNames[code] || mod.languageLabel || (mod.languageMeta && mod.languageMeta.label);
      if (metaLabel) languageNames[code] = metaLabel;
      upsertManifestEntry(code, languageNames[code]);
      emitBundleLoaded(code);
      return bundle;
    } catch (err) {
      console.warn("[i18n] Failed to load language bundle for %s", code, err);
      return null;
    }
  })().finally(() => {
    bundleLoadPromises.delete(code);
  });
  bundleLoadPromises.set(code, loader);
  return loader;
}

async function ensureLanguageBundlesLoaded(langToEnsure) {
  if (!manifestLoadPromise) {
    manifestLoadPromise = (async () => {
      const manifestUrl = new URL('../i18n/languages.json', import.meta.url);
      manifestBaseUrl = manifestUrl;
      let manifest = [];
      try {
        const resp = await fetch(manifestUrl, { cache: 'no-store' });
        if (resp && resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) manifest = data;
        }
      } catch (err) {
        console.warn('[i18n] Failed to load language manifest', err);
      }
      if (!manifest.length) {
        manifest = [{ value: DEFAULT_LANG, label: 'English', module: './en.js' }];
      }
      const seen = new Set();
      languageManifest = [];
      for (const entry of manifest) {
        if (!entry) continue;
        const value = String(entry.value || '').toLowerCase().trim();
        if (!value || seen.has(value)) continue;
        const modulePath = entry.module || `./${value}.js`;
        let moduleUrl = null;
        try {
          moduleUrl = new URL(modulePath, manifestUrl);
        } catch (err) {
          console.warn(`[i18n] Invalid module path for ${value}`, err);
          continue;
        }
        languageModuleUrls.set(value, moduleUrl.href);
        if (entry.label) languageNames[value] = entry.label;
        upsertManifestEntry(value, entry.label || value);
        seen.add(value);
      }
      if (!languageModuleUrls.has(DEFAULT_LANG)) {
        try {
          const fallbackUrl = new URL('./en.js', manifestUrl);
          languageModuleUrls.set(DEFAULT_LANG, fallbackUrl.href);
        } catch (err) {
          console.warn('[i18n] Unable to register fallback English bundle', err);
        }
      }
      if (!languageNames[DEFAULT_LANG]) languageNames[DEFAULT_LANG] = FALLBACK_LANGUAGE_LABEL;
      upsertManifestEntry(DEFAULT_LANG, languageNames[DEFAULT_LANG] || FALLBACK_LANGUAGE_LABEL || DEFAULT_LANG, { preferFront: true });
      languageManifest = languageManifest.reduce((acc, entry) => {
        if (!entry || !entry.value) return acc;
        if (acc.find((item) => item.value === entry.value)) return acc;
        acc.push(entry);
        return acc;
      }, []);
  })();
}
  await manifestLoadPromise;

  if (!translations[DEFAULT_LANG]) {
    await loadLanguageBundle(DEFAULT_LANG);
  }

  const target = String(langToEnsure || currentLang || DEFAULT_LANG).toLowerCase();
  if (target && !translations[target]) {
    await loadLanguageBundle(target);
  }

  return translations[target] || translations[DEFAULT_LANG] || null;
}


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

export async function initI18n(opts = {}) {
  const desiredInput = (opts.lang || detectLang() || '').toLowerCase();
  const def = (opts.defaultLang || DEFAULT_LANG).toLowerCase();
  const desired = desiredInput || def;
  await ensureLanguageBundlesLoaded(desired);
  currentLang = desiredInput || def;
  baseDefaultLang = def || DEFAULT_LANG;
  // If translation bundle missing, fall back to default bundle for UI
  if (!translations[currentLang]) currentLang = def;
  // Persist only when allowed (default: true). This enables callers to
  // perform a non-persistent bootstrap before site config is loaded.
  const shouldPersist = (opts && Object.prototype.hasOwnProperty.call(opts, 'persist')) ? !!opts.persist : true;
  if (shouldPersist) {
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
  }
  // Reflect on <html lang>
  document.documentElement.setAttribute('lang', currentLang);
  // Update a few static DOM bits (placeholders, site card)
  applyStaticTranslations();
  return currentLang;
}

export function getCurrentLang() { return currentLang; }

export async function ensureLanguageBundle(langCode) {
  const code = String(langCode || '').toLowerCase();
  if (code) {
    await ensureLanguageBundlesLoaded(code);
    if (translations[code]) return translations[code];
  }
  await ensureLanguageBundlesLoaded(baseDefaultLang || DEFAULT_LANG);
  return translations[code] || translations[currentLang] || translations[DEFAULT_LANG] || null;
}

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

const NORMALIZED_LANG_ALIASES = new Map([
  ['english', 'en'],
  ['en', 'en'],
  ['中文', 'zh'],
  ['简体中文', 'zh'],
  ['zh', 'zh'],
  ['zh-cn', 'zh'],
  ['繁體中文', 'zh-tw'],
  ['繁体中文', 'zh-tw'],
  ['正體中文', 'zh-tw'],
  ['正体中文', 'zh-tw'],
  ['台灣', 'zh-tw'],
  ['臺灣', 'zh-tw'],
  ['zh-tw', 'zh-tw'],
  ['zh-hant', 'zh-tw'],
  ['繁體中文（香港）', 'zh-hk'],
  ['繁体中文（香港）', 'zh-hk'],
  ['香港', 'zh-hk'],
  ['香港繁體', 'zh-hk'],
  ['香港繁体', 'zh-hk'],
  ['粤语', 'zh-hk'],
  ['粵語', 'zh-hk'],
  ['廣東話', 'zh-hk'],
  ['廣州話', 'zh-hk'],
  ['香港話', 'zh-hk'],
  ['zh-hk', 'zh-hk'],
  ['zh-mo', 'zh-hk'],
  ['zh-hant-hk', 'zh-hk'],
  ['zh-hant-tw', 'zh-tw'],
  ['日本語', 'ja'],
  ['にほんご', 'ja'],
  ['ja', 'ja'],
  ['jp', 'ja']
]);

// Normalize common language labels seen in content JSON to BCP-47-ish codes
export function normalizeLangKey(k) {
  const raw = String(k || '').trim();
  const lower = raw.toLowerCase();
  if (NORMALIZED_LANG_ALIASES.has(lower)) return NORMALIZED_LANG_ALIASES.get(lower);
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
      excerpt: (chosen && chosen.excerpt) || val.excerpt || undefined,
      title
    };
    out[title] = meta;
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load content metadata from simplified JSON and Markdown front matter
// Supports per-language single path (string) OR multiple versions (array of strings)
function buildEntryFromVariants(rawVariants, fallbackTitle) {
  if (!Array.isArray(rawVariants) || !rawVariants.length) return null;
  const variants = [];
  for (const variant of rawVariants) {
    if (!variant) continue;
    const location = normalizeMarkdownPath(variant.location);
    if (!location) continue;
    const item = {
      location,
      image: variant.image || undefined,
      tag: variant.tag || undefined,
      date: variant.date || undefined,
      excerpt: variant.excerpt || undefined,
      versionLabel: variant.versionLabel || undefined,
      ai: variant.ai || undefined,
      draft: variant.draft || undefined
    };
    if (variant.__title) item.__title = variant.__title;
    variants.push(item);
  }
  if (!variants.length) return null;
  const toTime = (d) => {
    const t = new Date(String(d || '')).getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };
  variants.sort((a, b) => toTime(b.date) - toTime(a.date));
  const primary = variants[0];
  if (!primary || !primary.location) return null;
  const resolvedTitle = primary.__title || fallbackTitle;
  const { __title, ...restPrimary } = primary;
  const meta = { ...restPrimary, title: resolvedTitle };
  meta.versions = variants.map((variant) => {
    const { __title: _ignored, ...rest } = variant;
    return { ...rest };
  });
  return { title: resolvedTitle, meta };
}

async function loadContentFromFrontMatter(obj, lang) {
  const out = {};
  const langsSeen = new Set();
  const nlang = normalizeLangKey(lang);
  const entries = Object.entries(obj || {});

  for (const [, val] of entries) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.keys(val).forEach(k => {
        const nk = normalizeLangKey(k);
        if (nk !== 'default') langsSeen.add(nk);
      });
    }
  }

  const updatePromises = [];

  for (const [key, val] of entries) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;

    let chosenBucketKey = null;
    if (val[nlang] != null) chosenBucketKey = nlang;
    else if (val[baseDefaultLang] != null) chosenBucketKey = baseDefaultLang;
    else if (val['en'] != null) chosenBucketKey = 'en';
    else if (val['default'] != null) chosenBucketKey = 'default';
    if (!chosenBucketKey) {
      const firstKey = Object.keys(val)[0];
      if (firstKey) chosenBucketKey = firstKey;
    }
    if (!chosenBucketKey) continue;

    const raw = val[chosenBucketKey];
    const rawPaths = Array.isArray(raw)
      ? raw.filter(x => typeof x === 'string')
      : (typeof raw === 'string' ? [raw] : []);
    const normalizedPaths = rawPaths.map(normalizeMarkdownPath).filter(Boolean);
    if (!normalizedPaths.length) continue;

    const variantSources = normalizedPaths.map((path) => frontMatterMetadataCache.get(path) || { location: path });
    const placeholderEntry = buildEntryFromVariants(variantSources, key);
    if (!placeholderEntry) continue;

    out[placeholderEntry.title] = placeholderEntry.meta;

    const needsAsync = normalizedPaths.some((path) => !frontMatterMetadataCache.has(path));
    if (!needsAsync) continue;

    const fetchPromises = normalizedPaths.map((path) =>
      getFrontMatterMetadata(path).catch(() => ({ location: path }))
    );

    const previousTitle = placeholderEntry.title;
    const enrichPromise = Promise.allSettled(fetchPromises).then((settled) => {
      const resolvedVariants = settled.map((result, idx) => {
        if (result.status === 'fulfilled' && result.value && result.value.location) {
          return result.value;
        }
        return { location: normalizedPaths[idx] };
      });
      const finalEntry = buildEntryFromVariants(resolvedVariants, key);
      if (!finalEntry) return;
      const oldKey = previousTitle;
      const newKey = finalEntry.title;
      if (newKey !== oldKey && Object.prototype.hasOwnProperty.call(out, oldKey)) {
        delete out[oldKey];
      }
      out[newKey] = finalEntry.meta;
    }).catch((err) => {
      console.warn(`[i18n] Failed to enrich metadata for ${key}`, err);
    });
    updatePromises.push(enrichPromise);
  }

  if (updatePromises.length) {
    Promise.allSettled(updatePromises).then(() => {
      if (typeof window === 'undefined') return;
      try {
        window.dispatchEvent(new CustomEvent(POSTS_METADATA_READY_EVENT, {
          detail: {
            entries: out,
            lang: nlang
          }
        }));
      } catch (_) { /* ignore */ }
    });
  }

  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}


// Try to load unified YAML (`base.yaml`) first; if not unified or missing, fallback to legacy
// per-language files (base.<currentLang>.yaml -> base.<default>.yaml -> base.yaml)
export async function loadContentJson(basePath, baseName) {
  // YAML only (unified or simplified)
  try {
    const obj = await fetchConfigWithYamlFallback([
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object' && Object.keys(obj).length) {
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
          const hasOnlyPaths = innerKeys.every(ik => {
            const val = v[ik];
            if (typeof val === 'string') return true;
            if (Array.isArray(val)) return val.every(item => typeof item === 'string');
            return false;
          });
          
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

  // Legacy per-language YAML chain
  return loadLangJson(basePath, baseName);
}

// Transform unified tabs YAML into a flat map: title -> { location }
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
    const obj = await fetchConfigWithYamlFallback([
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object') {
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
    `${basePath}/${baseName}.${currentLang}.yaml`,
    `${basePath}/${baseName}.${currentLang}.yml`,
    `${basePath}/${baseName}.${DEFAULT_LANG}.yaml`,
    `${basePath}/${baseName}.${DEFAULT_LANG}.yml`,
    `${basePath}/${baseName}.yaml`,
    `${basePath}/${baseName}.yml`
  ];
  try {
    return await fetchConfigWithYamlFallback(attempts);
  } catch (_) {
    return {};
  }
}

// Update static DOM bits outside main render cycle (sidebar card, search placeholder)
function applyStaticTranslations() {
  // Search placeholder
  const input = document.getElementById('searchInput');
  if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder'));
}

// Expose translations for testing/customization
export const __translations = translations;

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
  // Prefer languages discovered from content (unified index), else manifest order, else loaded bundle keys
  const current = getCurrentLang();
  if (current && !translations[current]) {
    ensureLanguageBundle(current).catch(() => {});
  }
  if (__contentLangs && __contentLangs.length) return __contentLangs;
  if (languageManifest && languageManifest.length) return languageManifest.map((entry) => entry.value);
  return Object.keys(translations);
}
export function getLanguageLabel(code) {
  const normalized = String(code || '').toLowerCase();
  if (languageNames[normalized]) return languageNames[normalized];
  const entry = (languageManifest || []).find((item) => item.value === normalized);
  if (entry && entry.label) return entry.label;
  return code;
}

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
