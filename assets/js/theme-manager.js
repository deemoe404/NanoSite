import { t } from './i18n.js?v=20260506theme';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

const THEME_ROOT = 'assets/themes';
const REQUIRED_CONTRACT_VERSION = 1;
const THEME_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const THEME_RELEASE_ASSET_PATTERN = /^press-theme-[a-z0-9_-]+-v\d+\.\d+\.\d+\.zip$/i;
const THEME_ARCHIVE_ALLOWED_EXTENSIONS = new Set([
  '.avif', '.css', '.gif', '.ico', '.jpeg', '.jpg', '.js', '.json', '.mjs', '.otf',
  '.png', '.svg', '.ttf', '.txt', '.webp', '.woff', '.woff2'
]);
const THEME_TEXT_EXTENSIONS = new Set(['.css', '.js', '.json', '.mjs', '.svg', '.txt']);

let initialized = false;
let busy = false;
let registryCache = null;
let catalogCache = null;
let currentSummary = [];
let currentFiles = [];
let currentThemeDigest = '';
let currentThemeSize = 0;
let currentThemeAssetName = '';
let pendingSiteThemeFallback = null;

const listeners = new Set();
const optionsRef = {
  getCurrentThemePack: null,
  setSiteThemePack: null
};

const elements = {
  root: null,
  status: null,
  tabs: null,
  views: null,
  installedList: null,
  availableList: null,
  pendingSection: null,
  pendingList: null,
  fileInput: null,
  headerImportButton: null,
  inlineImportButton: null,
  refreshCatalogButton: null,
  clearButton: null
};

function getBuffer(view) {
  if (view instanceof Uint8Array) {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (view instanceof ArrayBuffer) return view.slice(0);
  if (view && view.buffer instanceof ArrayBuffer) {
    const buf = view.buffer;
    const { byteOffset = 0, byteLength = buf.byteLength } = view;
    return buf.slice(byteOffset, byteOffset + byteLength);
  }
  return new ArrayBuffer(0);
}

async function digestSha256(buffer) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const view = new DataView(hash);
  const parts = [];
  for (let i = 0; i < view.byteLength; i += 4) {
    parts.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
  }
  return parts.join('');
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function safeString(value) {
  return value == null ? '' : String(value);
}

function extname(path) {
  const clean = safeString(path).toLowerCase();
  const last = clean.split('/').pop() || '';
  const idx = last.lastIndexOf('.');
  return idx >= 0 ? last.slice(idx) : '';
}

function isThemeTextPath(path) {
  return THEME_TEXT_EXTENSIONS.has(extname(path));
}

function normalizeDigest(value, options = {}) {
  const raw = safeString(value).trim().toLowerCase();
  if (!raw) {
    if (options.required) throw new Error('Theme release manifest asset digest is required.');
    return '';
  }
  const hex = raw.startsWith('sha256:') ? raw.slice(7) : raw;
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new Error('Theme release manifest asset digest must be a SHA-256 hash.');
  }
  return `sha256:${hex}`;
}

export function sanitizeThemeSlug(value) {
  const slug = safeString(value).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
  if (!THEME_SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid theme slug: ${safeString(value) || '(empty)'}`);
  }
  return slug;
}

export function normalizeThemeFilePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const clean = raw.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  if (clean !== 'theme.json' && clean.endsWith('/theme.json')) {
    throw new Error('Theme ZIP must contain exactly one theme.json at the theme root.');
  }
  if (clean !== 'theme.json' && !THEME_ARCHIVE_ALLOWED_EXTENSIONS.has(extname(clean))) {
    throw new Error(`Unsupported theme archive file type: ${clean}`);
  }
  return clean;
}

function validateRawThemeArchivePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  return raw;
}

function stripCommonArchiveRoot(entries) {
  const paths = entries.map((name) => safeString(name).replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return segments.map((parts) => parts.slice(1).join('/'));
}

function normalizeFileList(files) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(files) ? files : []).forEach((file) => {
    const path = normalizeThemeFilePath(file);
    if (!path || seen.has(path)) return;
    seen.add(path);
    normalized.push(path);
  });
  normalized.sort((a, b) => a.localeCompare(b));
  return normalized;
}

function normalizeRegistrySource(input, fallbackType) {
  const source = input && typeof input === 'object' ? input : {};
  const type = safeString(source.type || fallbackType || 'manual').trim().toLowerCase() || 'manual';
  const normalized = { type };
  if (source.repo) normalized.repo = safeString(source.repo).trim();
  if (source.manifestUrl) normalized.manifestUrl = safeString(source.manifestUrl).trim();
  if (source.url) normalized.url = safeString(source.url).trim();
  return normalized;
}

function normalizeRegistryRelease(input) {
  const release = input && typeof input === 'object' ? input : {};
  const normalized = {};
  if (release.tag) normalized.tag = safeString(release.tag).trim();
  if (release.name) normalized.name = safeString(release.name).trim();
  if (release.htmlUrl) normalized.htmlUrl = safeString(release.htmlUrl).trim();
  if (release.publishedAt) normalized.publishedAt = safeString(release.publishedAt).trim();
  if (release.assetName) normalized.assetName = safeString(release.assetName).trim();
  if (release.size != null && Number.isFinite(Number(release.size))) normalized.size = Number(release.size);
  if (release.digest) normalized.digest = normalizeDigest(release.digest);
  if (release.installedAt) normalized.installedAt = safeString(release.installedAt).trim();
  return normalized;
}

export function normalizeThemeRegistry(input) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(input) ? input : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value);
    if (seen.has(value)) return;
    seen.add(value);
    const builtIn = value === 'native' || entry.builtIn === true;
    const item = {
      value,
      label: safeString(entry.label || entry.name || value) || value,
      version: safeString(entry.version || ''),
      contractVersion: Number.isFinite(Number(entry.contractVersion)) ? Number(entry.contractVersion) : REQUIRED_CONTRACT_VERSION,
      builtIn,
      removable: builtIn ? false : entry.removable !== false,
      source: normalizeRegistrySource(entry.source, builtIn ? 'builtin' : 'manual'),
      release: normalizeRegistryRelease(entry.release),
      files: normalizeFileList(entry.files)
    };
    if (builtIn) {
      item.source = { type: 'builtin' };
      item.removable = false;
    }
    normalized.push(item);
  });
  if (!seen.has('native')) {
    normalized.unshift({
      value: 'native',
      label: 'Native',
      version: '',
      contractVersion: REQUIRED_CONTRACT_VERSION,
      builtIn: true,
      removable: false,
      source: { type: 'builtin' },
      release: {},
      files: []
    });
  }
  return normalized;
}

export function normalizeThemeCatalog(input) {
  const themes = Array.isArray(input) ? input : (input && Array.isArray(input.themes) ? input.themes : []);
  const normalized = [];
  const seen = new Set();
  themes.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value || entry.slug);
    if (seen.has(value)) return;
    const manifestUrl = safeString(entry.manifestUrl || entry.releaseManifestUrl).trim();
    if (!manifestUrl) throw new Error(`Official theme catalog entry ${value} is missing manifestUrl.`);
    seen.add(value);
    normalized.push({
      value,
      label: safeString(entry.label || entry.name || value) || value,
      repo: safeString(entry.repo || '').trim(),
      manifestUrl,
      description: safeString(entry.description || '').trim()
    });
  });
  return normalized;
}

export function normalizeThemeReleaseManifest(input) {
  if (!input || typeof input !== 'object') throw new Error('Theme release manifest is missing.');
  if (Number(input.schemaVersion) !== 1 || input.type !== 'press-theme') {
    throw new Error('Theme release manifest must be schemaVersion 1 and type "press-theme".');
  }
  const value = sanitizeThemeSlug(input.value || input.slug);
  const version = safeString(input.version || '').trim();
  if (!version) throw new Error('Theme release manifest version is required.');
  const contractVersion = Number(input.contractVersion);
  if (contractVersion !== REQUIRED_CONTRACT_VERSION) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }
  const asset = input.asset && typeof input.asset === 'object' ? input.asset : null;
  if (!asset) throw new Error('Theme release manifest asset is required.');
  const assetName = safeString(asset.name || '').trim();
  if (!THEME_RELEASE_ASSET_PATTERN.test(assetName)) {
    throw new Error('Theme release manifest asset must be a press-theme-<slug>-vX.Y.Z.zip file.');
  }
  const assetSlugMatch = assetName.match(/^press-theme-([a-z0-9_-]+)-v/i);
  if (assetSlugMatch && assetSlugMatch[1].toLowerCase() !== value) {
    throw new Error('Theme release manifest asset name does not match the theme slug.');
  }
  const url = safeString(asset.url || asset.browser_download_url || '').trim();
  if (!url) throw new Error('Theme release manifest asset url is required.');
  const size = Number(asset.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error('Theme release manifest asset size is required.');
  const release = input.release && typeof input.release === 'object' ? input.release : {};
  return {
    schemaVersion: 1,
    type: 'press-theme',
    value,
    label: safeString(input.label || input.name || value) || value,
    version,
    contractVersion,
    release: {
      tag: safeString(release.tag || input.tag || '').trim(),
      name: safeString(release.name || input.name || '').trim(),
      htmlUrl: safeString(release.htmlUrl || input.htmlUrl || '').trim(),
      publishedAt: safeString(release.publishedAt || input.publishedAt || '').trim(),
      notes: safeString(release.notes || input.notes || '').trim()
    },
    asset: {
      name: assetName,
      url,
      size,
      digest: normalizeDigest(asset.digest, { required: true })
    },
    files: normalizeFileList(input.files)
  };
}

export function collectThemeArchiveEntries(buffer, options = {}) {
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) throw new Error('Theme ZIP is empty.');

  const rawEntries = names
    .map((name) => ({
      raw: name,
      path: validateRawThemeArchivePath(name),
      data: archive[name]
    }))
    .filter((item) => item.path && !item.path.endsWith('/') && item.data && item.data.length);
  const strippedPaths = stripCommonArchiveRoot(rawEntries.map((entry) => entry.path));
  const entries = rawEntries.map((entry, index) => {
    const path = normalizeThemeFilePath(strippedPaths[index]);
    return { path, data: entry.data };
  }).filter((entry) => entry.path);

  if (!entries.some((entry) => entry.path === 'theme.json')) {
    throw new Error('Theme ZIP must contain theme.json at the theme root.');
  }

  const manifestEntry = entries.find((entry) => entry.path === 'theme.json');
  let themeManifest = null;
  try {
    themeManifest = JSON.parse(strFromU8(manifestEntry.data));
  } catch (err) {
    const error = new Error('Theme ZIP theme.json is not valid JSON.');
    error.cause = err;
    throw error;
  }
  const slugSource = options.expectedSlug || themeManifest.value || themeManifest.slug || themeManifest.name;
  const slug = sanitizeThemeSlug(slugSource);
  if (options.expectedSlug && slug !== sanitizeThemeSlug(options.expectedSlug)) {
    throw new Error('Theme ZIP slug does not match the selected release manifest.');
  }
  const contractVersion = Number(themeManifest.contractVersion);
  if (contractVersion !== REQUIRED_CONTRACT_VERSION) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }

  const seen = new Set();
  const normalizedEntries = entries.map((entry) => {
    if (seen.has(entry.path)) throw new Error(`Theme ZIP contains duplicate path: ${entry.path}`);
    seen.add(entry.path);
    const bufferValue = getBuffer(entry.data);
    const binary = !isThemeTextPath(entry.path);
    const file = {
      path: entry.path,
      data: entry.data,
      binary,
      size: entry.data.length
    };
    if (binary) file.base64 = bufferToBase64(bufferValue);
    else file.content = strFromU8(entry.data);
    return file;
  });

  return {
    slug,
    label: safeString(themeManifest.name || themeManifest.label || slug) || slug,
    version: safeString(themeManifest.version || ''),
    contractVersion,
    manifest: themeManifest,
    files: normalizedEntries
  };
}

export async function verifyThemeAsset(buffer, asset, expectedName = '') {
  const normalized = asset && typeof asset === 'object' ? asset : {};
  const expectedSize = Number(normalized.size);
  if (Number.isFinite(expectedSize) && expectedSize > 0 && buffer.byteLength !== expectedSize) {
    throw new Error(`Theme ZIP size mismatch: expected ${expectedSize}, got ${buffer.byteLength}.`);
  }
  const digest = normalizeDigest(normalized.digest, { required: true });
  const actual = await digestSha256(buffer);
  if (digest !== `sha256:${actual}`) {
    throw new Error('Theme ZIP SHA-256 digest mismatch.');
  }
  const name = safeString(normalized.name || '').trim();
  if (expectedName && name && name !== expectedName) {
    throw new Error('Theme ZIP asset name mismatch.');
  }
  return { digest: `sha256:${actual}`, size: buffer.byteLength };
}

function notifyStateChange() {
  listeners.forEach((listener) => {
    try { listener(); } catch (_) {}
  });
}

function setStatus(text, options = {}) {
  if (!elements.status) return;
  elements.status.textContent = text ? safeString(text) : '';
  elements.status.dataset.tone = options.tone || 'info';
}

function setBusy(value) {
  busy = !!value;
  [elements.headerImportButton, elements.inlineImportButton, elements.refreshCatalogButton, elements.clearButton]
    .forEach((button) => {
      if (!button) return;
      button.disabled = busy;
      button.dataset.state = busy ? 'busy' : 'idle';
    });
}

function getCurrentThemePackValue() {
  try {
    return optionsRef.getCurrentThemePack ? sanitizeThemeSlug(optionsRef.getCurrentThemePack()) : '';
  } catch (_) {
    return '';
  }
}

function clearPendingSiteThemeFallback(options = {}) {
  const pending = pendingSiteThemeFallback;
  pendingSiteThemeFallback = null;
  if (!pending || options.keep === true) return;
  if (typeof optionsRef.setSiteThemePack !== 'function') return;
  const current = getCurrentThemePackValue();
  if (!current || current === pending.to) {
    try { optionsRef.setSiteThemePack(pending.from); } catch (_) {}
  }
}

function applySummary(summary, files, meta = {}) {
  currentSummary = Array.isArray(summary) ? summary.slice() : [];
  currentFiles = Array.isArray(files) ? files.slice() : [];
  currentThemeDigest = meta.digest || '';
  currentThemeSize = Number.isFinite(meta.size) ? meta.size : 0;
  currentThemeAssetName = meta.assetName || '';
  renderPendingFiles();
  notifyStateChange();
}

function themeCommitPath(slug, relPath) {
  return `${THEME_ROOT}/${slug}/${relPath}`.replace(/\/+/g, '/');
}

async function fetchText(path) {
  try {
    const response = await fetch(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response || !response.ok) return { exists: false, content: '' };
    return { exists: true, content: await response.text() };
  } catch (_) {
    return { exists: false, content: '' };
  }
}

function themeFilesFromManifest(manifest) {
  const files = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    try {
      const normalized = normalizeThemeFilePath(value);
      if (normalized) files.push(normalized);
    } catch (_) {}
  };
  const addList = (list) => {
    (Array.isArray(list) ? list : []).forEach(add);
  };

  add('theme.json');
  const styles = manifest && Array.isArray(manifest.styles)
    ? manifest.styles.map((entry) => safeString(entry).trim()).filter(Boolean)
    : [];
  if (styles.length) addList(styles);
  else add('theme.css');
  addList(manifest && manifest.modules);
  addList(manifest && manifest.files);

  const views = manifest && manifest.views && typeof manifest.views === 'object' ? manifest.views : {};
  Object.values(views).forEach((view) => {
    if (view && typeof view === 'object') add(view.module);
  });

  return normalizeFileList(files);
}

async function inferLocalThemeFiles(slug) {
  try {
    const manifestPath = themeCommitPath(slug, 'theme.json');
    const existing = await fetchText(manifestPath);
    if (!existing.exists || !existing.content) return [];
    return themeFilesFromManifest(JSON.parse(existing.content));
  } catch (_) {
    return [];
  }
}

async function inferCatalogThemeFiles(slug) {
  try {
    const catalog = await loadCatalog();
    const entry = catalog.find((item) => item.value === slug);
    if (!entry || !entry.manifestUrl) return [];
    const manifest = normalizeThemeReleaseManifest(await fetchJson(entry.manifestUrl));
    return normalizeFileList(manifest.files);
  } catch (_) {
    return [];
  }
}

async function resolveThemeFileInventory(entry) {
  if (!entry || !entry.value) return [];
  const explicit = normalizeFileList(entry.files);
  if (explicit.length) return explicit;
  const value = sanitizeThemeSlug(entry.value);
  const local = await inferLocalThemeFiles(value);
  if (local.length) return local;
  const catalog = await inferCatalogThemeFiles(value);
  if (catalog.length) return catalog;
  return [];
}

async function fetchBase64(path) {
  try {
    const response = await fetch(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response || !response.ok) return { exists: false, base64: '' };
    return { exists: true, base64: bufferToBase64(await response.arrayBuffer()) };
  } catch (_) {
    return { exists: false, base64: '' };
  }
}

async function loadRegistry(options = {}) {
  if (registryCache && !options.force) return registryCache.slice();
  let data = null;
  try {
    const response = await fetch('assets/themes/packs.json', { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('Unable to load installed themes.');
    data = await response.json();
  } catch (err) {
    if (options.allowFallback === false) {
      const error = new Error('Unable to load installed theme registry. Theme changes were not staged.');
      error.cause = err;
      throw error;
    }
    data = [{ value: 'native', label: 'Native', builtIn: true, removable: false, source: { type: 'builtin' }, files: [] }];
  }
  registryCache = normalizeThemeRegistry(data);
  return registryCache.slice();
}

async function loadCatalog(options = {}) {
  if (catalogCache && !options.force) return catalogCache.slice();
  try {
    const response = await fetch('assets/themes/catalog.json', { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('Unable to load theme catalog.');
    catalogCache = normalizeThemeCatalog(await response.json());
  } catch (_) {
    catalogCache = [];
  }
  return catalogCache.slice();
}

function makeRegistryEntry({ archive, previous, releaseManifest, source, assetMeta }) {
  const builtIn = archive.slug === 'native';
  if (builtIn && !(previous && previous.builtIn)) {
    throw new Error('The native theme can only be managed by Press system updates.');
  }
  return {
    value: archive.slug,
    label: releaseManifest ? releaseManifest.label : archive.label,
    version: releaseManifest ? releaseManifest.version : archive.version,
    contractVersion: archive.contractVersion,
    builtIn: !!(previous && previous.builtIn),
    removable: previous && previous.builtIn ? false : true,
    source: previous && previous.builtIn ? { type: 'builtin' } : source,
    release: previous && previous.builtIn ? normalizeRegistryRelease(previous.release) : {
      tag: releaseManifest && releaseManifest.release ? releaseManifest.release.tag : '',
      name: releaseManifest && releaseManifest.release ? releaseManifest.release.name : '',
      htmlUrl: releaseManifest && releaseManifest.release ? releaseManifest.release.htmlUrl : '',
      publishedAt: releaseManifest && releaseManifest.release ? releaseManifest.release.publishedAt : '',
      assetName: assetMeta.assetName || '',
      size: assetMeta.size || 0,
      digest: assetMeta.digest || '',
      installedAt: new Date().toISOString()
    },
    files: archive.files.map((file) => file.path).sort((a, b) => a.localeCompare(b))
  };
}

async function buildThemeFileChanges(archive, previousEntry) {
  const changes = [];
  const oldFiles = new Set(await resolveThemeFileInventory(previousEntry));
  const newFiles = new Set(archive.files.map((file) => file.path));
  for (const file of archive.files) {
    const path = themeCommitPath(archive.slug, file.path);
    const base = {
      kind: 'system',
      category: 'theme',
      theme: archive.slug,
      label: path,
      path,
      state: 'added'
    };
    if (file.binary) {
      const existing = await fetchBase64(path);
      if (existing.exists && existing.base64 === file.base64) continue;
      changes.push({
        ...base,
        state: existing.exists ? 'modified' : 'added',
        binary: true,
        base64: file.base64,
        size: file.size,
        mime: 'application/octet-stream'
      });
    } else {
      const existing = await fetchText(path);
      if (existing.exists && existing.content === file.content) continue;
      changes.push({
        ...base,
        state: existing.exists ? 'modified' : 'added',
        content: file.content
      });
    }
  }
  oldFiles.forEach((relPath) => {
    if (newFiles.has(relPath)) return;
    const path = themeCommitPath(archive.slug, relPath);
    changes.push({
      kind: 'system',
      category: 'theme',
      theme: archive.slug,
      label: path,
      path,
      state: 'deleted',
      deleted: true
    });
  });
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}

function buildRegistryChange(registry, nextEntry) {
  const next = [];
  let replaced = false;
  registry.forEach((entry) => {
    if (entry.value === nextEntry.value) {
      next.push(nextEntry);
      replaced = true;
    } else {
      next.push(entry);
    }
  });
  if (!replaced) next.push(nextEntry);
  next.sort((a, b) => {
    if (a.value === 'native') return -1;
    if (b.value === 'native') return 1;
    return a.value.localeCompare(b.value);
  });
  return next;
}

function registryCommitFile(registry) {
  return {
    kind: 'system',
    category: 'theme',
    theme: 'registry',
    label: 'assets/themes/packs.json',
    path: 'assets/themes/packs.json',
    state: 'modified',
    content: `${JSON.stringify(registry, null, 2)}\n`
  };
}

async function stageThemeArchive(buffer, fileName, options = {}) {
  clearPendingSiteThemeFallback();
  const releaseManifest = options.releaseManifest || null;
  if (releaseManifest) {
    await verifyThemeAsset(buffer, releaseManifest.asset, releaseManifest.asset.name);
  }
  const digest = await digestSha256(buffer);
  const archive = collectThemeArchiveEntries(buffer, { expectedSlug: releaseManifest && releaseManifest.value });
  if (releaseManifest && archive.version && archive.version !== releaseManifest.version) {
    throw new Error('Theme ZIP theme.json version does not match the release manifest.');
  }
  const registry = await loadRegistry({ force: true, allowFallback: false });
  const previous = registry.find((entry) => entry.value === archive.slug) || null;
  if (previous && previous.builtIn && !options.allowBuiltInUpdate) {
    throw new Error('Built-in themes are updated only by Press system updates.');
  }
  const source = options.source || {
    type: 'manual',
    url: safeString(fileName || '').trim()
  };
  const assetMeta = {
    assetName: releaseManifest ? releaseManifest.asset.name : safeString(fileName || `press-theme-${archive.slug}.zip`),
    digest: `sha256:${digest}`,
    size: buffer.byteLength
  };
  const nextEntry = makeRegistryEntry({ archive, previous, releaseManifest, source, assetMeta });
  const nextRegistry = buildRegistryChange(registry, nextEntry);
  const fileChanges = await buildThemeFileChanges(archive, previous);
  fileChanges.push(registryCommitFile(nextRegistry));
  const summary = fileChanges.map((file) => ({
    kind: 'system',
    category: 'theme',
    theme: archive.slug,
    label: file.label || file.path,
    path: file.path,
    state: file.state || 'modified',
    deleted: !!file.deleted
  }));
  registryCache = nextRegistry;
  applySummary(summary, fileChanges, { digest: `sha256:${digest}`, size: buffer.byteLength, assetName: assetMeta.assetName });
  setStatus(`${previous ? 'Updated' : 'Installed'} ${nextEntry.label}. Review and publish the staged theme files.`, { tone: 'success' });
  renderThemeManager();
  return { archive, registry: nextRegistry, files: fileChanges };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response || !response.ok) throw new Error(`Unable to fetch ${url}.`);
  return response.json();
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response || !response.ok) throw new Error(`Unable to download ${url}.`);
  return response.arrayBuffer();
}

async function stageCatalogTheme(catalogEntry) {
  const releaseManifest = normalizeThemeReleaseManifest(await fetchJson(catalogEntry.manifestUrl));
  if (releaseManifest.value !== catalogEntry.value) {
    throw new Error('Official catalog entry does not match release manifest slug.');
  }
  const buffer = await fetchArrayBuffer(releaseManifest.asset.url);
  return stageThemeArchive(buffer, releaseManifest.asset.name, {
    releaseManifest,
    source: {
      type: 'official',
      repo: catalogEntry.repo,
      manifestUrl: catalogEntry.manifestUrl
    }
  });
}

export async function stageThemeUninstall(slug) {
  clearPendingSiteThemeFallback();
  const value = sanitizeThemeSlug(slug);
  const registry = await loadRegistry({ force: true, allowFallback: false });
  const entry = registry.find((item) => item.value === value);
  if (!entry) throw new Error(`Theme ${value} is not installed.`);
  if (entry.builtIn || entry.removable === false) throw new Error('Built-in themes cannot be uninstalled.');
  const inventory = await resolveThemeFileInventory(entry);
  if (!inventory.length) {
    throw new Error(`Theme ${entry.label || value} has no file inventory. Reinstall or update it before uninstalling.`);
  }
  const files = inventory.map((relPath) => {
    const path = themeCommitPath(value, relPath);
    return {
      kind: 'system',
      category: 'theme',
      theme: value,
      label: path,
      path,
      state: 'deleted',
      deleted: true
    };
  });
  const nextRegistry = registry.filter((item) => item.value !== value);
  files.push(registryCommitFile(nextRegistry));
  try {
    const current = getCurrentThemePackValue();
    if (current === value && typeof optionsRef.setSiteThemePack === 'function') {
      pendingSiteThemeFallback = { from: current, to: 'native' };
      optionsRef.setSiteThemePack('native');
    }
  } catch (_) {}
  const summary = files.map((file) => ({
    kind: 'system',
    category: 'theme',
    theme: value,
    label: file.label || file.path,
    path: file.path,
    state: file.state || 'modified',
    deleted: !!file.deleted
  }));
  registryCache = nextRegistry;
  applySummary(summary, files);
  setStatus(`Uninstalled ${entry.label}. Publish to delete the theme files.`, { tone: 'success' });
  renderThemeManager();
  return { registry: nextRegistry, files };
}

function clearElement(node) {
  if (node) node.innerHTML = '';
}

function makeButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className || 'btn-secondary';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderPendingFiles() {
  if (!elements.pendingSection || !elements.pendingList) return;
  clearElement(elements.pendingList);
  const files = currentFiles.slice();
  elements.pendingSection.hidden = !files.length;
  elements.pendingSection.setAttribute('aria-hidden', files.length ? 'false' : 'true');
  files.forEach((file) => {
    const item = document.createElement('li');
    item.className = 'updates-file-item';
    const name = document.createElement('span');
    name.className = 'updates-file-name';
    name.textContent = file.path || file.label || '';
    const badge = document.createElement('span');
    badge.className = 'updates-file-badge';
    badge.textContent = file.deleted ? 'deleted' : (file.state || 'modified');
    item.appendChild(name);
    item.appendChild(badge);
    elements.pendingList.appendChild(item);
  });
}

function renderInstalledThemes(registry, catalog) {
  if (!elements.installedList) return;
  clearElement(elements.installedList);
  registry.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'theme-manager-row';
    const body = document.createElement('div');
    body.className = 'theme-manager-row-body';
    const title = document.createElement('strong');
    title.textContent = entry.label || entry.value;
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = [
      entry.value,
      entry.version ? `v${entry.version}` : '',
      entry.builtIn ? 'built-in' : (entry.source && entry.source.type ? entry.source.type : '')
    ].filter(Boolean).join(' · ');
    body.appendChild(title);
    body.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'theme-manager-row-actions';
    const catalogEntry = catalog.find((item) => item.value === entry.value);
    if (!entry.builtIn && catalogEntry) {
      actions.appendChild(makeButton('Update', 'btn-secondary', async () => {
        if (busy) return;
        setBusy(true);
        try {
          setStatus(`Downloading ${catalogEntry.label}...`);
          await stageCatalogTheme(catalogEntry);
        } catch (err) {
          console.error('Theme update failed', err);
          setStatus(err && err.message ? err.message : 'Theme update failed.', { tone: 'error' });
        } finally {
          setBusy(false);
        }
      }));
    }
    if (!entry.builtIn && entry.removable !== false) {
      actions.appendChild(makeButton('Uninstall', 'btn-secondary', async () => {
        if (busy) return;
        setBusy(true);
        try {
          await stageThemeUninstall(entry.value);
        } catch (err) {
          console.error('Theme uninstall failed', err);
          setStatus(err && err.message ? err.message : 'Theme uninstall failed.', { tone: 'error' });
        } finally {
          setBusy(false);
        }
      }));
    }
    row.appendChild(body);
    row.appendChild(actions);
    elements.installedList.appendChild(row);
  });
}

function renderAvailableThemes(registry, catalog) {
  if (!elements.availableList) return;
  clearElement(elements.availableList);
  if (!catalog.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No official theme catalog is available.';
    elements.availableList.appendChild(empty);
    return;
  }
  const installed = new Set(registry.map((entry) => entry.value));
  catalog.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'theme-manager-row';
    const body = document.createElement('div');
    body.className = 'theme-manager-row-body';
    const title = document.createElement('strong');
    title.textContent = entry.label || entry.value;
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = [entry.value, entry.repo || '', entry.description || ''].filter(Boolean).join(' · ');
    body.appendChild(title);
    body.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'theme-manager-row-actions';
    actions.appendChild(makeButton(installed.has(entry.value) ? 'Update' : 'Install', 'btn-primary', async () => {
      if (busy) return;
      setBusy(true);
      try {
        setStatus(`Downloading ${entry.label}...`);
        await stageCatalogTheme(entry);
      } catch (err) {
        console.error('Theme install failed', err);
        setStatus(err && err.message ? err.message : 'Theme install failed.', { tone: 'error' });
      } finally {
        setBusy(false);
      }
    }));
    row.appendChild(body);
    row.appendChild(actions);
    elements.availableList.appendChild(row);
  });
}

async function renderThemeManager(options = {}) {
  if (!elements.root) return;
  const [registry, catalog] = await Promise.all([
    loadRegistry(options),
    loadCatalog(options)
  ]);
  renderInstalledThemes(registry, catalog);
  renderAvailableThemes(registry, catalog);
  renderPendingFiles();
}

function setActiveThemeManagerView(view) {
  const next = view === 'available' || view === 'import' ? view : 'installed';
  if (elements.tabs) {
    elements.tabs.forEach((button) => {
      const active = button.dataset.themeManagerView === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  if (elements.views) {
    elements.views.forEach((panel) => {
      const active = panel.dataset.themeManagerPanel === next;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
}

async function handleImportFile(file) {
  if (!file) return;
  setBusy(true);
  try {
    setStatus(`Reading ${file.name}...`);
    const buffer = await file.arrayBuffer();
    await stageThemeArchive(buffer, file.name);
    setActiveThemeManagerView('installed');
  } catch (err) {
    console.error('Theme import failed', err);
    applySummary([], []);
    setStatus(err && err.message ? err.message : 'Theme import failed.', { tone: 'error' });
  } finally {
    setBusy(false);
  }
}

function openImportPicker() {
  if (elements.fileInput && !busy) elements.fileInput.click();
}

export function initThemeManager(options = {}) {
  if (options && typeof options.onStateChange === 'function') listeners.add(options.onStateChange);
  if (options && typeof options.getCurrentThemePack === 'function') optionsRef.getCurrentThemePack = options.getCurrentThemePack;
  if (options && typeof options.setSiteThemePack === 'function') optionsRef.setSiteThemePack = options.setSiteThemePack;
  if (initialized) return;
  initialized = true;

  elements.root = document.getElementById('mode-themes');
  elements.status = document.getElementById('themeManagerStatus');
  elements.tabs = Array.from(document.querySelectorAll('[data-theme-manager-view]'));
  elements.views = Array.from(document.querySelectorAll('[data-theme-manager-panel]'));
  elements.installedList = document.getElementById('themeManagerInstalledList');
  elements.availableList = document.getElementById('themeManagerAvailableList');
  elements.pendingSection = document.getElementById('themeManagerPendingSection');
  elements.pendingList = document.getElementById('themeManagerFileList');
  elements.fileInput = document.getElementById('themeImportFileInput');
  elements.headerImportButton = document.getElementById('btnThemeImport');
  elements.inlineImportButton = document.getElementById('btnThemeImportInline');
  elements.refreshCatalogButton = document.getElementById('btnThemeRefreshCatalog');
  elements.clearButton = document.getElementById('btnThemeClearStaged');

  elements.tabs.forEach((button) => {
    button.addEventListener('click', () => setActiveThemeManagerView(button.dataset.themeManagerView));
  });
  if (elements.headerImportButton) elements.headerImportButton.addEventListener('click', openImportPicker);
  if (elements.inlineImportButton) elements.inlineImportButton.addEventListener('click', openImportPicker);
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (event) => {
      const input = event && event.target ? event.target : elements.fileInput;
      const file = input && input.files && input.files[0] ? input.files[0] : null;
      if (input) input.value = '';
      handleImportFile(file);
    });
  }
  if (elements.refreshCatalogButton) {
    elements.refreshCatalogButton.addEventListener('click', async () => {
      if (busy) return;
      setBusy(true);
      try {
        await renderThemeManager({ force: true });
        setStatus('Theme catalog refreshed.', { tone: 'success' });
      } catch (err) {
        setStatus(err && err.message ? err.message : 'Unable to refresh theme catalog.', { tone: 'error' });
      } finally {
        setBusy(false);
      }
    });
  }
  if (elements.clearButton) {
    elements.clearButton.addEventListener('click', () => clearThemeManagerState({ keepStatus: false }));
  }

  setActiveThemeManagerView('installed');
  setStatus('No theme changes are staged.');
  renderThemeManager().catch((err) => {
    console.error('Failed to initialize theme manager', err);
    setStatus(err && err.message ? err.message : 'Failed to load themes.', { tone: 'error' });
  });
}

export function getThemeManagerSummaryEntries() {
  return currentSummary.slice();
}

export function getThemeManagerCommitFiles() {
  return currentFiles.slice();
}

export function clearThemeManagerState(options = {}) {
  clearPendingSiteThemeFallback({ keep: options && options.keepSiteThemeFallback === true });
  applySummary([], []);
  currentThemeDigest = '';
  currentThemeSize = 0;
  currentThemeAssetName = '';
  if (options && options.keepRegistryCache !== true) {
    registryCache = null;
    renderThemeManager({ force: true }).catch(() => {});
  }
  if (options && options.keepStatus !== true) {
    try {
      const key = 'editor.themeManager.status.idle';
      const label = t(key);
      setStatus(label && label !== key ? label : 'No theme changes are staged.');
    } catch (_) {
      setStatus('No theme changes are staged.');
    }
  }
}

export async function analyzeThemeArchive(buffer, fileName = '', options = {}) {
  return stageThemeArchive(buffer, fileName, options);
}
