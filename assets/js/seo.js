// seo.js - Dynamic SEO meta tag management for client-side routing
// This maintains SEO benefits while keeping the "no compilation needed" philosophy

import { getCurrentLang, DEFAULT_LANG } from './i18n.js';
import { getAvailableLangs } from './i18n.js';
import { parseFrontMatter } from './content.js';

function ensureTrailingSlash(value) {
  const str = String(value == null ? '' : value).trim();
  if (!str) return '';
  return str.endsWith('/') ? str : `${str}/`;
}

export function resolveSiteBaseUrl(siteConfig = {}) {
  const raw = siteConfig && siteConfig.siteURL;
  if (raw != null) {
    const trimmed = String(raw).trim();
    if (trimmed) {
      try {
        const resolved = new URL(trimmed, window.location.href).href;
        const normalized = ensureTrailingSlash(resolved);
        if (normalized) return normalized;
      } catch (_) {
        try {
          const resolved = new URL(trimmed, window.location.origin).href;
          const normalized = ensureTrailingSlash(resolved);
          if (normalized) return normalized;
        } catch (_) {}
      }
    }
  }

  try {
    const normalized = ensureTrailingSlash(new URL('.', window.location.href).href);
    if (normalized) return normalized;
  } catch (_) {}

  const hasWindow = typeof window !== 'undefined' && window.location;
  const origin = hasWindow && window.location.origin ? window.location.origin : '';
  const pathname = hasWindow && window.location.pathname ? window.location.pathname : '';
  const basePath = pathname.replace(/[^/]*$/, '');
  const fallback = ensureTrailingSlash(`${origin}${basePath}`);
  if (fallback) return fallback;
  if (origin) return ensureTrailingSlash(origin);
  return '/';
}

function resolveResourceBase(siteConfig = {}) {
  const siteBase = resolveSiteBaseUrl(siteConfig);
  const raw = siteConfig && Object.prototype.hasOwnProperty.call(siteConfig, 'resourceURL')
    ? siteConfig.resourceURL
    : undefined;
  if (raw == null) return siteBase;
  const trimmed = String(raw).trim();
  if (!trimmed) return siteBase;
  try {
    return ensureTrailingSlash(new URL(trimmed, siteBase).href);
  } catch (_) {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return ensureTrailingSlash(new URL(trimmed, window.location.origin).href);
      }
    } catch (_) { /* noop */ }
    const normalized = trimmed.replace(/^\/+/, '');
    return ensureTrailingSlash(`${siteBase}${normalized}`);
  }
}

function ensureAbsoluteUrl(value, base, siteConfig = {}) {
  const str = String(value || '').trim();
  if (!str) return '';
  const fallbackBase = ensureTrailingSlash(base || resolveSiteBaseUrl(siteConfig) || (typeof window !== 'undefined' && window.location ? `${window.location.origin}/` : '/'));
  try {
    return new URL(str, fallbackBase).href;
  } catch (_) {
    const normalized = str.replace(/^\/+/, '');
    return `${fallbackBase}${normalized}`;
  }
}

/**
 * Generate a fallback image using SVG when no avatar is configured
 * @param {string} title - Site title to display on the image
 * @returns {string} Data URI for the generated SVG image
 */
function generateFallbackImage(title) {
  // Get the first character or initials for the image
  const displayText = extractDisplayText(title);
  
  // Generate a consistent color based on the title
  const backgroundColor = generateColorFromText(title);
  const textColor = getContrastColor(backgroundColor);
  
  // Create SVG content
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustBrightness(backgroundColor, -20)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      <text x="50%" y="50%" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            fill="${textColor}" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            font-size="120" 
            font-weight="600">
        ${escapeXML(displayText)}
      </text>
      <text x="50%" y="75%" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            fill="${textColor}" 
            opacity="0.8"
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            font-size="32" 
            font-weight="400">
        ${escapeXML(title.length > 40 ? title.substring(0, 37) + '...' : title)}
      </text>
    </svg>
  `.trim();
  
  // Convert SVG to data URI
  try {
    // Use percent-encoding to safely embed Unicode SVG
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  } catch (_) {
    // Fallback for rare environments
    try {
      const enc = new TextEncoder();
      const bytes = enc.encode(svg);
      let bin = '';
      bytes.forEach(b => { bin += String.fromCharCode(b); });
      return `data:image/svg+xml;base64,${btoa(bin)}`;
    } catch (_) {
      return 'data:image/svg+xml;charset=UTF-8,';
    }
  }
}

/**
 * Extract display text from title (initials or first character)
 */
function extractDisplayText(title) {
  if (!title) return '?';
  
  // Clean the title
  const cleanTitle = title.replace(/[^\w\s]/g, '').trim();
  if (!cleanTitle) return title.charAt(0).toUpperCase();
  
  const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
  
  if (words.length >= 2) {
    // Use initials for multi-word titles
    return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
  } else {
    // Use first character for single word
    return cleanTitle.charAt(0).toUpperCase();
  }
}

/**
 * Generate a consistent color from text using a hash function
 */
function generateColorFromText(text) {
  // Create a hash from the text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Define a palette of professional colors
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Purple
  ];
  
  // Select color based on hash
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

/**
 * Get contrasting text color (white or black) based on background color
 */
function getContrastColor(hexColor) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Adjust color brightness
 */
function adjustBrightness(hexColor, percent) {
  const num = parseInt(hexColor.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * Escape XML characters for SVG content
 */
function escapeXML(str) {
  return String(str).replace(/[<>&'"]/g, function(char) {
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

/**
 * Update document meta tags dynamically for better SEO
 * @param {Object} options - SEO options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.image - Page image URL
 * @param {string} options.url - Canonical URL
 * @param {string} options.type - Content type (article, website, etc.)
 * @param {string} options.author - Content author
 * @param {string} options.publishedTime - Publication date (ISO string)
 * @param {string} options.modifiedTime - Last modified date (ISO string)
 * @param {Array<string>} options.tags - Content tags
 * @param {Object} siteConfig - Site configuration object
 */
export function updateSEO(options = {}, siteConfig = {}) {
  // Helper function to get localized value from site config
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    // Try to get current language (this would need to be imported from i18n.js)
    const lang = getCurrentLang ? getCurrentLang() : 'default';
    return (lang && val[lang]) || val.default || fallback;
  };

  // Get default values from site config
  const defaultTitle = getLocalizedValue(siteConfig.siteTitle, 'NanoSite - Zero-Dependency Static Blog');
  const defaultDescription = getLocalizedValue(siteConfig.siteDescription, 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.');
  const siteBaseUrl = resolveSiteBaseUrl(siteConfig);
  const resourceBase = resolveResourceBase(siteConfig);

  // Generate fallback image if no avatar configured
  const defaultImage = siteConfig.avatar ?
    ensureAbsoluteUrl(siteConfig.avatar, resourceBase, siteConfig) :
    generateFallbackImage(defaultTitle);

  // Debug: log when using fallback image
  if (!siteConfig.avatar) {
    console.log('🎨 SEO: Generated fallback image for:', defaultTitle);
  }

  const {
    title = defaultTitle,
    description = defaultDescription,
    image: providedImage,
    url = window.location.href,
    type = 'website',
    author = 'NanoSite',
    publishedTime = null,
    modifiedTime = null,
    tags = []
  } = options;

  const normalizedTags = Array.isArray(tags)
    ? tags.map(tag => String(tag || '').trim()).filter(Boolean)
    : typeof tags === 'string'
      ? tags.split(',').map(tag => String(tag || '').trim()).filter(Boolean)
      : [];

  const resolvedImage = ensureAbsoluteUrl(providedImage || defaultImage, resourceBase, siteConfig);
  const canonicalUrl = ensureAbsoluteUrl(url || window.location.href, siteBaseUrl, siteConfig);

  // Update document title
  document.title = title;

  // Helper function to update or create meta tag
  function updateMetaTag(name, content, attr = 'name') {
    const attribute = attr === 'property' || attr === 'itemprop' ? attr : 'name';
    const selector = `meta[${attribute}="${name}"]`;
    let meta = document.querySelector(selector);

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
  }

  function removeMetaTags(name, attr = 'name') {
    const attribute = attr === 'property' || attr === 'itemprop' ? attr : 'name';
    const nodes = document.querySelectorAll(`meta[${attribute}="${name}"]`);
    nodes.forEach((node) => {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  // Helper function to update link tag
  function updateLinkTag(rel, href) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  // Update basic meta tags
  updateMetaTag('title', title);
  updateMetaTag('description', description);
  updateMetaTag('author', author);

  // Update keywords if tags provided
  if (normalizedTags.length > 0) {
    updateMetaTag('keywords', normalizedTags.join(', '));
  } else {
    removeMetaTags('keywords');
  }

  // Update canonical URL
  updateLinkTag('canonical', canonicalUrl);

  // Update Open Graph tags
  updateMetaTag('og:type', type, 'property');
  updateMetaTag('og:url', canonicalUrl, 'property');
  updateMetaTag('og:title', title, 'property');
  updateMetaTag('og:description', description, 'property');
  updateMetaTag('og:image', resolvedImage, 'property');

  // Update Twitter Card tags
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:url', canonicalUrl);
  updateMetaTag('twitter:title', title);
  updateMetaTag('twitter:description', description);
  updateMetaTag('twitter:image', resolvedImage);

  // Add article-specific meta tags if it's an article
  if (type === 'article') {
    updateMetaTag('og:type', 'article', 'property');
    if (author) updateMetaTag('article:author', author, 'property');
    if (publishedTime) updateMetaTag('article:published_time', publishedTime, 'property');
    if (modifiedTime) updateMetaTag('article:modified_time', modifiedTime, 'property');

    // Add article tags
    removeMetaTags('article:tag', 'property');
    normalizedTags.forEach(tag => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'article:tag');
      meta.setAttribute('content', tag);
      document.head.appendChild(meta);
    });
  }

  // Update structured data
  updateStructuredData({ ...options, image: resolvedImage, tags: normalizedTags, url: canonicalUrl }, siteConfig);
}

// Parse various date shapes into ISO string safely (Safari-friendly)
function toISODateSafe(input) {
  try {
    const s = String(input || '').trim();
    if (!s) return null;
    let d = null;
    // YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return isNaN(d) ? null : d.toISOString();
    }
    // YYYY/MM/DD
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) {
      d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return isNaN(d) ? null : d.toISOString();
    }
    // Fallback: let Date parse full string
    d = new Date(s);
    return isNaN(d) ? null : d.toISOString();
  } catch (_) { return null; }
}

/**
 * Update JSON-LD structured data
 */
function updateStructuredData(options, siteConfig = {}) {
  const {
    title,
    description,
    url,
    type,
    author,
    publishedTime,
    modifiedTime,
    image,
    tags = []
  } = options;

  // Get default values from site config
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    const lang = getCurrentLang ? getCurrentLang() : 'default';
    return (lang && val[lang]) || val.default || fallback;
  };
  
    const defaultTitle = getLocalizedValue(siteConfig.siteTitle, 'NanoSite');
    const siteBaseUrl = resolveSiteBaseUrl(siteConfig);
    const resourceBase = resolveResourceBase(siteConfig);
    const logoUrl = siteConfig.avatar ?
      ensureAbsoluteUrl(siteConfig.avatar, resourceBase, siteConfig) :
      generateFallbackImage(defaultTitle);
    // Base URL used in structured data (e.g., SearchAction target)
    const defaultUrl = siteBaseUrl;

  // Remove existing structured data
  const existingScript = document.querySelector('script[type="application/ld+json"]:not([data-permanent])');
  if (existingScript) {
    existingScript.remove();
  }

  let structuredData;

  if (type === 'article') {
    // Article structured data
    structuredData = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "description": description,
      "url": url,
      "author": {
        "@type": "Person",
        "name": author
      },
      "publisher": {
        "@type": "Organization",
        "name": defaultTitle,
        "logo": {
          "@type": "ImageObject",
          "url": logoUrl
        }
      }
    };

    if (publishedTime) {
      structuredData.datePublished = publishedTime;
    }
    if (modifiedTime) {
      structuredData.dateModified = modifiedTime;
    }
    if (image) {
      structuredData.image = {
        "@type": "ImageObject",
        "url": image
      };
    }
    if (tags.length > 0) {
      structuredData.keywords = tags;
    }
  } else {
    // Default WebSite structured data
    structuredData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": title,
      "description": description,
      "url": url,
      "author": {
        "@type": "Person",
        "name": author
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${defaultUrl}?tab=search&q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(structuredData, null, 2);
  document.head.appendChild(script);
}

/**
 * Extract SEO data from markdown content
 * @param {string} content - Markdown content
 * @param {Object} metadata - Post metadata from index.yaml
 * @param {Object} siteConfig - Site configuration object
 * @returns {Object} SEO options
 */
export function extractSEOFromMarkdown(content, metadata = {}, siteConfig = {}) {
  // First try to extract data from front matter
  const { frontMatter } = parseFrontMatter(content);
  
  // Use front matter data with fallback to metadata and extraction
  const title = frontMatter.title || metadata.title || extractTitleFromMarkdown(content, siteConfig);
  const description = frontMatter.excerpt || metadata.excerpt || extractExcerptFromMarkdown(content, siteConfig);
  const tags = frontMatter.tags || frontMatter.tag || metadata.tags || metadata.tag || extractTagsFromMarkdown(content);
  
  // Get resource base from site config for building absolute resource URLs
  const resourceBase = siteConfig.resourceURL || (window.location.origin + window.location.pathname);
  
  // Determine image: front matter > metadata > site avatar > generated fallback
  let image = frontMatter.image || metadata.image || metadata.cover;
  if (!image) {
    if (siteConfig && siteConfig.avatar) {
      image = siteConfig.avatar;
    } else {
      // No configured image - generate a fallback based on article title
      image = generateFallbackImage(title);
    }
  }
  
  // Try to extract date from front matter, then metadata, then content
  const publishedTime = toISODateSafe(frontMatter.date || metadata.date || extractDateFromMarkdown(content));
  
  // If image is relative (e.g., 'cover.jpg'), resolve it against the markdown's folder
  const resolveRelativeImage = (img) => {
    const s = String(img || '').trim();
    if (!s) return s;
    if (/^(https?:|data:)/i.test(s) || s.startsWith('/')) return s;
    const loc = String(metadata.location || '').trim();
    const lastSlash = loc.lastIndexOf('/');
    const baseDir = lastSlash >= 0 ? loc.slice(0, lastSlash + 1) : '';
    return (baseDir + s).replace(/^\/+/, '');
  };

  const finalImage = resolveRelativeImage(image);

  return {
    title,
    description,
  image: (finalImage && (finalImage.startsWith('http') || finalImage.startsWith('data:'))) ? finalImage : `${resourceBase}${String(finalImage || '').replace(/^\/+/, '')}`,
    type: 'article',
    author: frontMatter.author || metadata.author || 'NanoSite',
    publishedTime: publishedTime,
    tags,
    url: window.location.href
  };
}

/**
 * Extract title from markdown content (first H1)
 */
function extractTitleFromMarkdown(content, siteConfig = {}) {
  const match = content.match(/^#\s+(.+)/m);
  if (match) return match[1].trim();
  
  // Get fallback title from site config
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    const lang = getCurrentLang ? getCurrentLang() : 'default';
    return (lang && val[lang]) || val.default || fallback;
  };
  
  return getLocalizedValue(siteConfig.siteTitle, 'NanoSite');
}

/**
 * Extract excerpt from markdown content (first paragraph)
 */
function extractExcerptFromMarkdown(content, siteConfig = {}) {
  // Remove frontmatter if present
  const withoutFrontmatter = content.replace(/^---\s*\n.*?\n---\s*\n/s, '');
  
  // Remove headings and get first substantial paragraph
  const withoutHeadings = withoutFrontmatter.replace(/^#+\s+.+$/gm, '');
  const paragraphs = withoutHeadings.split('\n\n').filter(p => p.trim().length > 0);
  
  if (paragraphs.length > 0) {
    // Clean up markdown syntax for description
    return paragraphs[0]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .replace(/\n/g, ' ')
      .trim()
      .substring(0, 155) + (paragraphs[0].length > 155 ? '...' : '');
  }
  
  // Get fallback description from site config
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    const lang = getCurrentLang ? getCurrentLang() : 'default';
    return (lang && val[lang]) || val.default || fallback;
  };
  
  return getLocalizedValue(siteConfig.siteDescription, 'A pure front-end template for simple blogs and docs. No compilation needed - just edit Markdown files and deploy.');
}

/**
 * Extract tags from markdown content (look for tags in metadata or content)
 */
function extractTagsFromMarkdown(content) {
  // Look for tags in various formats
  const tagMatches = [
    ...content.matchAll(/(?:tags?|topics?):\s*(.+)/gi),
    ...content.matchAll(/#(\w+)/g) // Hashtags
  ];
  
  const tags = new Set();
  tagMatches.forEach(match => {
    if (match[1]) {
      // Split comma/space separated tags
      match[1].split(/[,\s]+/).forEach(tag => {
        const cleanTag = tag.trim().replace(/[#\[\]"']/g, '');
        if (cleanTag) tags.add(cleanTag);
      });
    }
  });
  
  return Array.from(tags);
}

/**
 * Extract date from markdown content
 */
function extractDateFromMarkdown(content) {
  const dateMatch = content.match(/(?:date|published):\s*(.+)/i);
  if (dateMatch) {
    const iso = toISODateSafe(dateMatch[1].trim());
    if (iso) return iso.split('T')[0];
  }
  return null;
}

/**
 * Generate sitemap data for static generation
 * This can be used to create a sitemap.xml file
 */
export function generateSitemapData(postsData = {}, tabsData = {}, siteConfig = {}) {
  // Use site's base URL (remove current file path or respect configured URL)
  const baseUrl = resolveSiteBaseUrl(siteConfig);
  const urls = [];
  const siteDefaultLang = (siteConfig && siteConfig.defaultLanguage) ? String(siteConfig.defaultLanguage).toLowerCase() : DEFAULT_LANG;
  
  // Helper function to get location from language-specific data with proper fallback
  const getLocationFromLangData = (data) => {
    if (!data || typeof data !== 'object') return null;

    // Helper: pick preferred entry from an array (assume last is latest)
    const pickFromArray = (arr) => {
      try {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const last = arr[arr.length - 1];
        if (typeof last === 'string') return last;
        if (last && typeof last === 'object' && last.location) return last.location;
        // Fallback: scan from end for first usable
        for (let i = arr.length - 1; i >= 0; i--) {
          const it = arr[i];
          if (typeof it === 'string') return it;
          if (it && typeof it === 'object' && it.location) return it.location;
        }
      } catch (_) {}
      return null;
    };

    // Try current language, then DEFAULT_LANG, then 'en', then 'default'
    const currentLang = getCurrentLang();
    const tryLangs = [currentLang, DEFAULT_LANG, 'en', 'default'];

    for (const lang of tryLangs) {
      const langData = data[lang];
      if (langData != null) {
        if (typeof langData === 'string') return langData;
        if (Array.isArray(langData)) {
          const picked = pickFromArray(langData);
          if (picked) return picked;
        }
        if (typeof langData === 'object' && langData.location) return langData.location;
      }
    }

    // Fallback to legacy flat shape if not unified
    if (data.location) return data.location;

    return null;
  };
  
  // Add homepage + alternates for all languages
  try {
    const allLangs = (getAvailableLangs && getAvailableLangs()) || [siteDefaultLang];
    const alternates = Array.from(new Set(allLangs.map(l => String(l).toLowerCase()))).map(l => ({
      hreflang: l,
      href: l === siteDefaultLang ? `${baseUrl}` : `${baseUrl}?lang=${encodeURIComponent(l)}`
    }));
    // x-default: use site default language
    const xDefaultHref = `${baseUrl}`;
    // Emit one URL entry per language (with alternates) to make inclusion explicit
    alternates.forEach(alt => {
      urls.push({
        loc: alt.href,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '1.0',
        alternates,
        xdefault: xDefaultHref
      });
    });
  } catch (_) {
    urls.push({
      loc: baseUrl,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: '1.0'
    });
  }
  
  // Add posts (expand each version once per post key)
  // postsData is an object where keys are post titles and values are post metadata
  Object.entries(postsData).forEach(([title, postMeta]) => {
    // Collect all versioned locations from all languages
    const extractVersion = (p) => { try { const m = String(p||'').match(/\/(v\d+(?:\.\d+){1,3})\//i); return (m && m[1]) || 'v0'; } catch(_) { return 'v0'; } };
    const versionToLangLoc = new Map(); // ver -> { lang: loc }
    const add = (lang, loc) => { if (!loc) return; const ver = extractVersion(loc); if (!versionToLangLoc.has(ver)) versionToLangLoc.set(ver, {}); versionToLangLoc.get(ver)[lang] = loc; };
    if (postMeta && typeof postMeta === 'object') {
      Object.entries(postMeta).forEach(([lang, val]) => {
        if (typeof val === 'string') add(lang, val);
        else if (Array.isArray(val)) val.forEach(it => { if (typeof it === 'string') add(lang, it); else if (it && it.location) add(lang, it.location); });
        else if (val && typeof val === 'object' && val.location) add(lang, val.location);
      });
    }
    const currentLang = getCurrentLang();
    const tryLangs = [currentLang, DEFAULT_LANG, 'en', 'zh', 'zh-tw', 'zh-hk', 'ja', 'default'];
    versionToLangLoc.forEach((langLocMap) => {
      const langs = Object.keys(langLocMap || {});
      if (!langs.length) return;
      // Build alternates for all available languages on this version
      const alternates = langs.map(l => ({
        hreflang: l,
        href: `${baseUrl}?id=${encodeURIComponent(langLocMap[l])}&lang=${encodeURIComponent(l)}`
      }));
      // x-default = site default when available, else first
      const xDefaultHref = (langLocMap[siteDefaultLang]) ? `${baseUrl}?id=${encodeURIComponent(langLocMap[siteDefaultLang])}` : alternates[0].href;
      // Emit one entry per language (explicit visibility) with full alternates
      langs.forEach(l => {
        const loc = langLocMap[l];
        if (!loc) return;
        urls.push({
          loc: `${baseUrl}?id=${encodeURIComponent(loc)}&lang=${encodeURIComponent(l)}`,
          lastmod: postMeta.date || new Date().toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: '0.8',
          alternates,
          xdefault: xDefaultHref
        });
      });
    });
  });
  
  // Add tabs
  // tabsData is an object where keys are tab titles and values are tab metadata
  Object.entries(tabsData).forEach(([title, tabMeta]) => {
    if (!tabMeta || typeof tabMeta !== 'object') return;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Collect languages present for this tab
    const langs = Object.keys(tabMeta).filter(k => !!tabMeta[k]);
    if (!langs.length) return;
    const alternates = langs.map(l => ({
      hreflang: l,
      href: `${baseUrl}?tab=${encodeURIComponent(slug)}&lang=${encodeURIComponent(l)}`
    }));
    const xDefaultHref = `${baseUrl}?tab=${encodeURIComponent(slug)}`;
    langs.forEach(l => {
      urls.push({
        loc: `${baseUrl}?tab=${encodeURIComponent(slug)}&lang=${encodeURIComponent(l)}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.6',
        alternates,
        xdefault: xDefaultHref
      });
    });
  });
  
  return urls;
}
