import { parseFrontMatter, stripFrontMatter, stripMarkdownToText } from './content.js';
import { sanitizeUrl } from './utils.js';

const VIDEO_EXT_RE = /\.(mp4|mov|webm|ogg)(\?.*)?$/i;

function normalizeContentUrl(url, baseDir = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const safe = sanitizeUrl(raw);
  if (!safe || safe === '#') return safe || '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(safe) || safe.startsWith('/') || safe.startsWith('#')) {
    return safe;
  }
  const base = String(baseDir || '').replace(/^\/+|\/+$/g, '');
  const rel = safe.replace(/^\/+/, '');
  return base ? `${base}/${rel}`.replace(/\/{2,}/g, '/') : rel;
}

function cleanInlineText(markdown) {
  return stripMarkdownToText(String(markdown || '')).replace(/\s+/g, ' ').trim();
}

function headingFromLine(line, lineNumber) {
  const match = String(line || '').match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  const level = match[1].length;
  const text = cleanInlineText(match[2]);
  return {
    id: String(lineNumber),
    level,
    text,
    raw: match[2],
    line: lineNumber
  };
}

function parseMarkdownAssetsAndLinks(markdown, baseDir) {
  const assets = [];
  const links = [];
  const source = String(markdown || '');

  source.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
    const parts = String(inner || '').split('|');
    const src = (parts[0] || '').trim();
    if (!src) return '';
    const url = normalizeContentUrl(src, baseDir);
    assets.push({
      type: VIDEO_EXT_RE.test(src) ? 'video' : 'image',
      url,
      source: src,
      alt: (parts[1] || '').trim()
    });
    return '';
  });

  source.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
    const url = normalizeContentUrl(src, baseDir);
    assets.push({
      type: VIDEO_EXT_RE.test(src) ? 'video' : 'image',
      url,
      source: String(src || ''),
      alt: String(alt || ''),
      title: String(title || '')
    });
    return '';
  });

  source.replace(/(^|[^!])\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, prefix, label, href, title) => {
    const url = normalizeContentUrl(href, baseDir);
    links.push({
      url,
      href: String(href || ''),
      label: cleanInlineText(label),
      title: String(title || ''),
      internal: /^\?/.test(String(href || '')) || !/^[a-z][a-z0-9+.-]*:/i.test(String(href || ''))
    });
    return prefix || '';
  });

  return { assets, links };
}

function createBlock(type, rawLines, startLine, extra = {}) {
  const raw = rawLines.join('\n');
  return {
    type,
    raw,
    text: cleanInlineText(raw),
    startLine,
    endLine: startLine + rawLines.length - 1,
    ...extra
  };
}

function isFence(line) {
  return /^\s*(`{3,}|~{3,})/.test(String(line || ''));
}

function isTableStart(lines, index) {
  const current = String(lines[index] || '').trim();
  const next = String(lines[index + 1] || '').trim();
  return current.startsWith('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next);
}

function parseBlocks(markdown) {
  const lines = String(stripFrontMatter(markdown) || '').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!String(line || '').trim()) {
      index += 1;
      continue;
    }

    const heading = headingFromLine(line, index);
    if (heading) {
      blocks.push(createBlock('heading', [line], index, {
        id: heading.id,
        level: heading.level
      }));
      index += 1;
      continue;
    }

    if (isFence(line)) {
      const start = index;
      const marker = String(line).trim()[0];
      const fenceLength = (String(line).trim().match(/^(`{3,}|~{3,})/) || [''])[0].length;
      index += 1;
      while (index < lines.length) {
        const trimmed = String(lines[index] || '').trim();
        if (new RegExp(`^${marker}{${fenceLength},}\\s*$`).test(trimmed)) {
          index += 1;
          break;
        }
        index += 1;
      }
      blocks.push(createBlock('code', lines.slice(start, index), start));
      continue;
    }

    if (/^\s*>/.test(line)) {
      const start = index;
      while (index < lines.length && /^\s*>/.test(lines[index])) index += 1;
      blocks.push(createBlock('quote', lines.slice(start, index), start));
      continue;
    }

    if (isTableStart(lines, index)) {
      const start = index;
      while (index < lines.length && String(lines[index] || '').trim().startsWith('|')) index += 1;
      blocks.push(createBlock('table', lines.slice(start, index), start));
      continue;
    }

    if (/^\s*(?:[-*+]|\d{1,9}[\.)])\s+/.test(line) || /^\s*[-*]\s+\[[ x]\]/i.test(line)) {
      const start = index;
      while (
        index < lines.length
        && (
          /^\s*(?:[-*+]|\d{1,9}[\.)])\s+/.test(lines[index])
          || /^\s*[-*]\s+\[[ x]\]/i.test(lines[index])
          || !String(lines[index] || '').trim()
        )
      ) {
        index += 1;
      }
      blocks.push(createBlock('list', lines.slice(start, index), start));
      continue;
    }

    const start = index;
    while (
      index < lines.length
      && String(lines[index] || '').trim()
      && !headingFromLine(lines[index], index)
      && !isFence(lines[index])
      && !/^\s*>/.test(lines[index])
      && !isTableStart(lines, index)
      && !/^\s*(?:[-*+]|\d{1,9}[\.)])\s+/.test(lines[index])
      && !/^\s*[-*]\s+\[[ x]\]/i.test(lines[index])
    ) {
      index += 1;
    }
    blocks.push(createBlock('paragraph', lines.slice(start, index), start));
  }

  return blocks;
}

function buildTocTree(headings) {
  const roots = [];
  const stack = [];
  headings
    .filter((heading) => heading.level >= 2 && heading.level <= 3)
    .forEach((heading) => {
      const node = {
        id: heading.id,
        level: heading.level,
        text: heading.text,
        children: []
      };
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
    });
  return roots;
}

export function createContentModel({
  rawMarkdown = '',
  html = '',
  tocHtml = '',
  metadata = {},
  baseDir = '',
  location = '',
  title = ''
} = {}) {
  const parsedFrontMatter = parseFrontMatter(rawMarkdown).frontMatter || {};
  const mergedMetadata = {
    ...parsedFrontMatter,
    ...(metadata && typeof metadata === 'object' ? metadata : {})
  };
  if (title && !mergedMetadata.title) mergedMetadata.title = title;
  if (location && !mergedMetadata.location) mergedMetadata.location = location;

  const stripped = stripFrontMatter(rawMarkdown);
  const lines = String(stripped || '').split('\n');
  const headings = lines
    .map((line, index) => headingFromLine(line, index))
    .filter(Boolean);
  const { assets, links } = parseMarkdownAssetsAndLinks(stripped, baseDir);

  return {
    rawMarkdown: String(rawMarkdown || ''),
    markdown: stripped,
    html: String(html || ''),
    tocHtml: String(tocHtml || ''),
    blocks: parseBlocks(rawMarkdown),
    tocTree: buildTocTree(headings),
    headings,
    metadata: mergedMetadata,
    assets,
    links,
    baseDir: String(baseDir || ''),
    location: String(location || '')
  };
}
