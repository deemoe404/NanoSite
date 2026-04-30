import { mdParse } from './markdown.js';
import { setSafeHtml } from './utils.js';
import { t } from './i18n.js?v=20260430a';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.yaml', '.yml', '.md', '.txt', '.html', '.css', '.svg', '.xml',
  '.map', '.config', '.ini'
]);
const TEXT_FILENAMES = new Set(['LICENSE', 'README', 'README.md', 'CHANGELOG', 'CHANGELOG.md']);

export const SYSTEM_UPDATE_ASSET_NAME_PATTERN = /^nanosite-system-v\d+\.\d+\.\d+\.zip$/i;

const RELEASE_API_URL = 'https://api.github.com/repos/deemoe404/NanoSite/releases/latest';
const RELEASE_MANIFEST_URL = 'https://raw.githubusercontent.com/deemoe404/NanoSite/main/assets/system-release.json';
const SYSTEM_UPDATE_ALLOWED_PATH_PATTERN = /^(?:index\.html|index_editor\.html|assets\/(?:main\.js|js\/.+|i18n\/.+|schema\/.+|themes\/.+))$/;
const SYSTEM_UPDATE_BLOCKED_PATH_PATTERN = /^(?:\.git\/|\.github\/|wwwroot\/|site\.ya?ml$|site\.local\.ya?ml$|CNAME$|robots\.txt$|sitemap\.xml$|README(?:\.md)?$|BRANCHING\.md$|scripts\/|assets\/(?:avatar|hero)\.jpeg$)/i;

let initialized = false;
let releaseCache = null;
let busy = false;
let currentSummary = [];
let currentFiles = [];
let assetSha256 = '';
let assetSize = 0;
let assetName = '';

const listeners = new Set();

const elements = {
  root: null,
  status: null,
  downloadLink: null,
  selectButton: null,
  fileInput: null,
  fileSection: null,
  fileList: null,
  notes: null,
  notesWrap: null,
  metaTitle: null,
  metaPublished: null,
  assetMeta: null
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
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

function isTextPath(path) {
  const clean = String(path || '').trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  const basename = clean.split('/').pop();
  if (TEXT_FILENAMES.has(basename)) return true;
  return false;
}

function formatDate(input) {
  try {
    if (!input) return '';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  } catch (_) {
    return '';
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const value = unit === 0 ? Math.round(size) : size.toFixed(1);
  return `${value} ${units[unit]}`;
}

function setStatus(text, options = {}) {
  if (!elements.status) return;
  const { tone = 'info' } = options;
  elements.status.textContent = text ? String(text) : '';
  elements.status.dataset.tone = tone;
}

function setBusy(flag) {
  busy = !!flag;
  if (elements.selectButton) {
    elements.selectButton.disabled = busy;
    elements.selectButton.dataset.state = busy ? 'busy' : 'idle';
  }
  if (elements.fileInput) {
    elements.fileInput.disabled = busy;
  }
}

function clearList(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderNotes(body) {
  if (!elements.notes) return;
  const raw = typeof body === 'string' ? body : '';
  const trimmed = raw.trim();
  if (trimmed) {
    const parsed = mdParse(trimmed);
    const html = typeof parsed === 'string'
      ? parsed
      : parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'post')
        ? parsed.post
        : '';
    if (html) {
      setSafeHtml(elements.notes, html, '', { alreadySanitized: true });
      return;
    }
  }
  elements.notes.textContent = t('editor.systemUpdates.noNotes');
}

function notify() {
  const snapshot = {
    summary: currentSummary.slice(),
    files: currentFiles.slice()
  };
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch (_) { /* noop */ }
  });
}

function applySummary(entries, files) {
  currentSummary = Array.isArray(entries) ? entries : [];
  currentFiles = Array.isArray(files) ? files : [];
  renderFileList();
  notify();
}

function renderFileList() {
  const section = elements.fileSection;
  const list = elements.fileList;
  if (!section || !list) return;
  clearList(list);
  if (!currentSummary.length) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
    return;
  }
  section.hidden = false;
  section.setAttribute('aria-hidden', 'false');
  currentSummary.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'updates-file-item';
    if (entry && entry.state) item.dataset.state = entry.state;
    const name = document.createElement('span');
    name.className = 'updates-file-name';
    name.textContent = entry.label || entry.path || '';
    const badge = document.createElement('span');
    badge.className = 'updates-file-badge';
    if (entry && entry.state === 'added') badge.textContent = t('editor.systemUpdates.fileStatus.added');
    else if (entry && entry.state === 'modified') badge.textContent = t('editor.systemUpdates.fileStatus.modified');
    else badge.textContent = entry.state || '';
    item.appendChild(name);
    item.appendChild(badge);
    list.appendChild(item);
  });
}

function normalizeArchiveEntryPath(path) {
  const raw = String(path || '').replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe system update archive path: ${raw}`);
  }
  const clean = raw.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.some((part) => part === '..' || part === '.')) {
    throw new Error(`Unsafe system update archive path: ${raw}`);
  }
  return clean;
}

function stripCommonArchiveRoot(entries) {
  const paths = entries.map((name) => String(name || '').replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return paths.map((parts) => parts.split('/').slice(1).join('/'));
}

export function isSystemUpdatePath(path) {
  const clean = String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
  return SYSTEM_UPDATE_ALLOWED_PATH_PATTERN.test(clean) && !SYSTEM_UPDATE_BLOCKED_PATH_PATTERN.test(clean);
}

export function collectSystemUpdateArchiveEntries(buffer) {
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) return [];

  const rawEntries = names
    .map((name) => ({
      raw: name,
      path: normalizeArchiveEntryPath(name),
      data: archive[name]
    }))
    .filter((item) => item.path && item.data && item.data.length);

  const strippedPaths = stripCommonArchiveRoot(rawEntries.map((item) => item.path));
  return rawEntries.map((entry, index) => {
    const path = normalizeArchiveEntryPath(strippedPaths[index]);
    if (!isSystemUpdatePath(path)) {
      throw new Error(`Unsafe system update archive path: ${path}`);
    }
    return {
      path,
      data: entry.data
    };
  });
}

export function selectSystemUpdateAsset(releaseData) {
  const assets = Array.isArray(releaseData && releaseData.assets) ? releaseData.assets : [];
  const asset = assets.find((item) => item && SYSTEM_UPDATE_ASSET_NAME_PATTERN.test(String(item.name || '')));
  if (!asset) return null;
  return {
    name: asset.name || 'nanosite-system.zip',
    url: asset.browser_download_url || asset.url || '',
    size: asset.size || 0,
    digest: asset.digest || ''
  };
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireManifestString(manifest, key) {
  const value = manifest && manifest[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid system release manifest: missing ${key}`);
  }
  return value;
}

function normalizeReleaseCache(data) {
  const asset = selectSystemUpdateAsset(data);
  return {
    name: data.name || data.tag_name || 'latest',
    tag: data.tag_name || '',
    publishedAt: data.published_at || data.created_at || '',
    notes: data.body || '',
    htmlUrl: data.html_url || '',
    asset
  };
}

export function normalizeSystemReleaseManifest(manifest) {
  if (!isObject(manifest) || manifest.schemaVersion !== 1) {
    throw new Error('Invalid system release manifest: unsupported schema');
  }
  const name = requireManifestString(manifest, 'name');
  const tag = requireManifestString(manifest, 'tag');
  const publishedAt = requireManifestString(manifest, 'publishedAt');
  const notes = requireManifestString(manifest, 'notes');
  const htmlUrl = requireManifestString(manifest, 'htmlUrl');
  if (!isObject(manifest.asset)) {
    throw new Error('Invalid system release manifest: missing asset');
  }
  const asset = selectSystemUpdateAsset({ assets: [manifest.asset] });
  if (!asset || !asset.name || !asset.url) {
    throw new Error('Invalid system release manifest: invalid asset');
  }
  const size = Number(asset.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Invalid system release manifest: invalid asset size');
  }
  const digest = String(asset.digest || '').trim().toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error('Invalid system release manifest: invalid asset digest');
  }
  return {
    name,
    tag,
    publishedAt,
    notes,
    htmlUrl,
    asset: {
      ...asset,
      size,
      digest
    }
  };
}

export async function verifySystemUpdateAsset(buffer, asset = {}) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const actualSize = buffer ? buffer.byteLength : 0;
  const actualSha256 = await digestSha256(buffer);
  const expectedSize = Number(asset && asset.size);
  if (Number.isFinite(expectedSize) && expectedSize > 0 && Math.abs(expectedSize - actualSize) > 0) {
    throw new Error(t('editor.systemUpdates.errors.sizeMismatch', {
      expected: formatSize(expectedSize),
      actual: formatSize(actualSize)
    }));
  }
  const expectedDigestRaw = String((asset && asset.digest) || '').trim().toLowerCase();
  const expectedDigest = expectedDigestRaw.replace(/^sha256:/, '');
  if (expectedDigest && expectedDigest !== actualSha256.toLowerCase()) {
    throw new Error(t('editor.systemUpdates.errors.digestMismatch'));
  }
  return {
    size: actualSize,
    sha256: actualSha256
  };
}

function getResponseHeader(response, name) {
  try {
    return response && response.headers && typeof response.headers.get === 'function'
      ? String(response.headers.get(name) || '')
      : '';
  } catch (_) {
    return '';
  }
}

function isRateLimitedResponse(response) {
  const status = Number(response && response.status);
  const remaining = getResponseHeader(response, 'x-ratelimit-remaining');
  return status === 429 || (status === 403 && remaining === '0');
}

function createReleaseFetchError(response) {
  const error = new Error(isRateLimitedResponse(response)
    ? t('editor.systemUpdates.errors.releaseRateLimited')
    : t('editor.systemUpdates.errors.releaseFetch'));
  error.rateLimited = isRateLimitedResponse(response);
  error.status = Number(response && response.status) || 0;
  return error;
}

function renderRelease() {
  renderReleaseMeta();
  renderNotes(releaseCache ? releaseCache.notes : '');
  updateDownloadLink();
}

async function fetchLatestReleaseFromApi() {
  const response = await fetch(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw createReleaseFetchError(response);
  const data = await response.json();
  return normalizeReleaseCache(data);
}

function getManifestUrls() {
  const urls = [RELEASE_MANIFEST_URL];
  try {
    const localUrl = new URL('assets/system-release.json', document.baseURI).href;
    if (localUrl && !urls.includes(localUrl)) urls.push(localUrl);
  } catch (_) {}
  return urls;
}

async function fetchLatestReleaseFromManifest() {
  let lastError = null;
  const urls = getManifestUrls();
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) {
        lastError = new Error(`System release manifest fetch failed (${response.status || 'unknown'})`);
        continue;
      }
      const data = await response.json();
      return normalizeSystemReleaseManifest(data);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('System release manifest fetch failed');
}

async function fetchLatestRelease() {
  if (releaseCache) return releaseCache;
  let apiError = null;
  try {
    releaseCache = await fetchLatestReleaseFromApi();
  } catch (err) {
    apiError = err;
    try {
      releaseCache = await fetchLatestReleaseFromManifest();
    } catch (manifestError) {
      const message = apiError && apiError.rateLimited
        ? t('editor.systemUpdates.errors.releaseRateLimited')
        : t('editor.systemUpdates.errors.releaseFetch');
      const error = new Error(message);
      error.apiError = apiError;
      error.manifestError = manifestError;
      throw error;
    }
  }
  renderRelease();
  return releaseCache;
}

function renderReleaseMeta() {
  if (!releaseCache) return;
  if (elements.metaTitle) {
    const { name, tag } = releaseCache;
    elements.metaTitle.textContent = tag ? t('editor.systemUpdates.latestLabel', { name, tag }) : name;
  }
  if (elements.metaPublished) {
    const date = formatDate(releaseCache.publishedAt);
    elements.metaPublished.textContent = date ? t('editor.systemUpdates.publishedLabel', { date }) : '';
  }
  if (elements.assetMeta) {
    if (releaseCache.asset) {
      const { name, size } = releaseCache.asset;
      elements.assetMeta.textContent = t('editor.systemUpdates.assetLabel', { name, size: formatSize(size) });
    } else {
      elements.assetMeta.textContent = t('editor.systemUpdates.noAsset');
    }
  }
}

function updateDownloadLink() {
  const link = elements.downloadLink;
  if (!link) return;
  let href = 'https://github.com/deemoe404/NanoSite/releases/latest';
  let label = t('editor.systemUpdates.openReleasePage');
  link.removeAttribute('download');
  if (releaseCache) {
    if (releaseCache.asset && releaseCache.asset.url) {
      const name = releaseCache.asset.name || releaseCache.name || '';
      href = releaseCache.asset.url;
      label = name ? t('editor.systemUpdates.downloadAssetLink', { name }) : t('editor.systemUpdates.openDownload');
      if (releaseCache.asset.name) link.setAttribute('download', releaseCache.asset.name);
    } else if (releaseCache.htmlUrl) {
      href = releaseCache.htmlUrl;
    }
  }
  link.textContent = label;
  link.href = href;
  link.removeAttribute('aria-disabled');
}

function buildSummaryFromFiles(files) {
  return files.map((file) => ({
    kind: 'system',
    label: file.label || file.path,
    path: file.path,
    state: file.state || 'modified'
  }));
}

async function compareArchive(entries) {
  const files = [];
  for (const entry of entries) {
    const { path, data } = entry;
    if (!path || !data || !data.length) continue;
    const buffer = getBuffer(data);
    const newSha = await digestSha256(buffer);
    let existingBuffer = null;
    let existingSha = '';
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (response.ok) {
        existingBuffer = await response.arrayBuffer();
        existingSha = await digestSha256(existingBuffer);
      }
    } catch (_) {
      existingBuffer = null;
    }
    if (existingBuffer && existingSha === newSha) continue;
    const textPreferred = isTextPath(path);
    let content = null;
    let base64 = null;
    if (textPreferred) {
      try {
        content = strFromU8(new Uint8Array(buffer));
      } catch (_) {
        base64 = bufferToBase64(buffer);
      }
    } else {
      base64 = bufferToBase64(buffer);
    }
    if (!content && !base64) {
      content = strFromU8(new Uint8Array(buffer));
    }
    files.push({
      kind: 'system',
      label: path,
      path,
      content: content || null,
      base64: base64 || null,
      binary: !content,
      state: existingBuffer ? 'modified' : 'added',
      sha256: newSha,
      size: data.length
    });
  }
  return files;
}

async function processArchive(buffer) {
  const entries = collectSystemUpdateArchiveEntries(buffer);
  return compareArchive(entries);
}

export async function analyzeArchive(buffer, filename) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  if (!buffer || !buffer.byteLength) {
    throw new Error(t('editor.systemUpdates.errors.emptyFile'));
  }

  const release = await fetchLatestRelease().catch(() => releaseCache);
  const nameFromRelease = release && release.asset ? (release.asset.name || release.name) : '';
  assetName = filename || nameFromRelease || 'release.zip';
  const verification = release && release.asset
    ? await verifySystemUpdateAsset(buffer, release.asset)
    : { sha256: await digestSha256(buffer), size: buffer.byteLength };
  assetSha256 = verification.sha256;
  assetSize = verification.size;

  if (release) {
    if (release.asset) {
      release.asset.size = assetSize;
      if (!release.asset.name) release.asset.name = assetName;
    } else {
      release.asset = { name: assetName, url: '', size: assetSize, digest: '' };
    }
    renderReleaseMeta();
    updateDownloadLink();
  }

  if (elements.assetMeta) {
    elements.assetMeta.textContent = t('editor.systemUpdates.assetWithHash', {
      name: assetName,
      size: formatSize(assetSize),
      hash: assetSha256
    });
  }

  setStatus(t('editor.systemUpdates.status.verifying'));

  let files = [];
  try {
    files = await processArchive(buffer);
  } catch (err) {
    console.error('Failed to unpack system update archive', err);
    throw new Error(t('editor.systemUpdates.errors.invalidArchive'));
  }

  if (!files.length) {
    setStatus(t('editor.systemUpdates.status.noChanges'), { tone: 'success' });
    applySummary([], []);
    return;
  }

  setStatus(t('editor.systemUpdates.status.comparing'));
  applySummary(buildSummaryFromFiles(files), files);
  const count = files.length;
  setStatus(t('editor.systemUpdates.status.changes', { count }), { tone: 'warn' });
}

function handleSelectClick() {
  if (busy || !elements.fileInput) return;
  elements.fileInput.click();
}

async function handleFileInputChange(event) {
  if (busy) return;
  const input = event && event.target ? event.target : elements.fileInput;
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  setBusy(true);
  try {
    setStatus(t('editor.systemUpdates.status.reading'));
    applySummary([], []);
    const buffer = await file.arrayBuffer();
    await analyzeArchive(buffer, file.name);
  } catch (err) {
    console.error('System update processing failed', err);
    const message = err && err.message ? err.message : t('editor.systemUpdates.errors.generic');
    setStatus(message, { tone: 'error' });
    applySummary([], []);
  } finally {
    setBusy(false);
  }
}

export function initSystemUpdates(options = {}) {
  if (initialized) {
    if (options && typeof options.onStateChange === 'function') listeners.add(options.onStateChange);
    return;
  }
  initialized = true;
  elements.root = document.getElementById('mode-updates');
  elements.status = document.getElementById('systemUpdateStatus');
  elements.downloadLink = document.getElementById('systemUpdateDownloadLink');
  elements.selectButton = document.getElementById('btnSystemSelect');
  elements.fileInput = document.getElementById('systemUpdateFileInput');
  elements.fileSection = document.getElementById('systemUpdateFileSection');
  elements.fileList = document.getElementById('systemUpdateFileList');
  elements.notes = document.getElementById('systemUpdateReleaseNotes');
  elements.metaTitle = document.getElementById('systemUpdateReleaseMeta');
  elements.metaPublished = document.getElementById('systemUpdateReleasePublished');
  elements.assetMeta = document.getElementById('systemUpdateAssetMeta');

  if (options && typeof options.onStateChange === 'function') listeners.add(options.onStateChange);

  if (elements.selectButton) {
    elements.selectButton.dataset.state = 'idle';
    elements.selectButton.addEventListener('click', handleSelectClick);
  }
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', handleFileInputChange);
  }

  updateDownloadLink();
  setStatus(t('editor.systemUpdates.status.idle'));
  fetchLatestRelease().catch((err) => {
    console.error('Failed to load system update metadata', err);
    setStatus(err && err.message ? err.message : t('editor.systemUpdates.errors.releaseFetch'), { tone: 'error' });
  });
}

export function getSystemUpdateSummaryEntries() {
  return currentSummary.slice();
}

export function getSystemUpdateCommitFiles() {
  return currentFiles.slice();
}

export function clearSystemUpdateState(options = {}) {
  applySummary([], []);
  currentSummary = [];
  currentFiles = [];
  assetSha256 = '';
  assetSize = 0;
  assetName = '';
  if (options && options.clearReleaseCache === true) {
    releaseCache = null;
  }
  if (options && options.keepStatus !== true) {
    setStatus(t('editor.systemUpdates.status.idle'));
  }
  renderReleaseMeta();
}
