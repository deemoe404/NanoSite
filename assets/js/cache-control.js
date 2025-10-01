let fetchPatched = false;

function extractUrl(input) {
  if (!input) return '';
  if (typeof input === 'string') return input;
  try {
    if (typeof Request !== 'undefined' && input instanceof Request && input.url) {
      return input.url;
    }
  } catch (_) {
    /* ignore instanceof issues */
  }
  try {
    return String(input.url || input.href || '');
  } catch (_) {
    return '';
  }
}

function getExtension(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const pathname = parsed.pathname || '';
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot === -1) return '';
    return pathname.slice(lastDot + 1).toLowerCase();
  } catch (_) {
    const trimmed = url.split('#')[0].split('?')[0];
    const lastDot = trimmed.lastIndexOf('.');
    if (lastDot === -1) return '';
    return trimmed.slice(lastDot + 1).toLowerCase();
  }
}

function shouldBypassCache(ext) {
  return ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mdx' || ext === 'yaml' || ext === 'yml';
}

function shouldPreferCache(ext) {
  return ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'json';
}

export function ensureFetchCachePolicyPatched() {
  if (fetchPatched) return;
  fetchPatched = true;
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = extractUrl(input);
    const ext = getExtension(url);
    const originalInit = init && typeof init === 'object' ? init : undefined;
    const finalInit = originalInit ? { ...originalInit } : {};
    const hasExplicitCache = finalInit && Object.prototype.hasOwnProperty.call(finalInit, 'cache');
    const requestedCache = hasExplicitCache ? finalInit.cache : undefined;

    if (shouldBypassCache(ext)) {
      finalInit.cache = 'no-cache';
    } else if (shouldPreferCache(ext)) {
      if (!hasExplicitCache || requestedCache === 'no-cache' || requestedCache == null) {
        finalInit.cache = 'default';
      } else {
        finalInit.cache = requestedCache;
      }
    } else if (hasExplicitCache && requestedCache !== undefined) {
      finalInit.cache = requestedCache;
    } else {
      // Leave cache undefined for other resources so the browser applies defaults
      delete finalInit.cache;
    }

    return originalFetch(input, finalInit);
  };
}

ensureFetchCachePolicyPatched();

export function getCacheModeForUrl(url, fallback = undefined) {
  const ext = getExtension(url);
  if (shouldBypassCache(ext)) return 'no-cache';
  if (shouldPreferCache(ext)) return 'default';
  return fallback;
}
