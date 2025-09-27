import { mdParse } from './markdown.js';
import { setSafeHtml } from './utils.js';
import { t } from './i18n.js';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.yaml', '.yml', '.md', '.txt', '.html', '.css', '.svg', '.xml',
  '.map', '.config', '.ini'
]);
const TEXT_FILENAMES = new Set(['LICENSE', 'README', 'README.md', 'CHANGELOG', 'CHANGELOG.md']);

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
  button: null,
  fileSection: null,
  fileList: null,
  notes: null,
  notesWrap: null,
  metaTitle: null,
  metaPublished: null,
  assetMeta: null,
  banner: null,
  bannerList: null,
  bannerEmpty: null,
  bannerSummary: null
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

function setButtonBusy(flag) {
  busy = !!flag;
  if (!elements.button) return;
  elements.button.disabled = busy;
  elements.button.dataset.state = busy ? 'busy' : 'idle';
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
  renderBanner();
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

function renderBanner() {
  const banner = elements.banner;
  const list = elements.bannerList;
  const empty = elements.bannerEmpty;
  if (!banner || !list || !empty) return;
  clearList(list);
  if (!currentSummary.length) {
    banner.hidden = true;
    banner.setAttribute('aria-hidden', 'true');
    empty.hidden = false;
    if (elements.bannerSummary) elements.bannerSummary.textContent = '';
    return;
  }
  banner.hidden = false;
  banner.setAttribute('aria-hidden', 'false');
  empty.hidden = true;
  currentSummary.slice(0, 5).forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'system-update-banner-item';
    const label = document.createElement('span');
    label.className = 'system-update-banner-name';
    label.textContent = entry.label || entry.path || '';
    const badge = document.createElement('span');
    badge.className = 'system-update-banner-badge';
    if (entry && entry.state === 'added') badge.textContent = t('editor.systemUpdates.fileStatus.added');
    else if (entry && entry.state === 'modified') badge.textContent = t('editor.systemUpdates.fileStatus.modified');
    else badge.textContent = entry.state || '';
    item.appendChild(label);
    item.appendChild(badge);
    list.appendChild(item);
  });
  const summary = elements.bannerSummary;
  if (summary) {
    const count = currentSummary.length;
    summary.textContent = t('editor.systemUpdates.banner.summary', { count });
  }
}

function normalizePaths(entries) {
  const paths = entries.map((name) => name.replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return paths.map((parts) => parts.split('/').slice(1).join('/'));
}

async function fetchLatestRelease() {
  if (releaseCache) return releaseCache;
  const response = await fetch('https://api.github.com/repos/deemoe404/NanoSite/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(t('editor.systemUpdates.errors.releaseFetch'));
  const data = await response.json();
  const asset = Array.isArray(data.assets) && data.assets.length ? data.assets[0] : null;
  const archiveUrl = data && (data.zipball_url || data.tarball_url) ? (data.zipball_url || data.tarball_url) : '';
  const archiveName = (() => {
    const base = data && (data.tag_name || data.name);
    if (!base) return 'source.zip';
    return `${String(base).replace(/\s+/g, '-').replace(/[^\w.-]+/g, '') || 'source'}.zip`;
  })();
  releaseCache = {
    name: data.name || data.tag_name || 'latest',
    tag: data.tag_name || '',
    publishedAt: data.published_at || data.created_at || '',
    notes: data.body || '',
    htmlUrl: data.html_url || '',
    asset: asset ? {
      name: asset.name || 'release.zip',
      url: asset.browser_download_url,
      size: asset.size || 0
    } : null,
    archive: archiveUrl ? {
      name: archiveName,
      url: archiveUrl
    } : null
  };
  renderReleaseMeta();
  renderNotes(releaseCache.notes);
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
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) return [];
  const normalizedNames = normalizePaths(names);
  const entries = normalizedNames.map((path, index) => ({
    path,
    data: archive[names[index]]
  })).filter((item) => item.path && item.path.slice(-1) !== '/');
  const filtered = entries.filter((item) => {
    if (!item.path || item.path.endsWith('/')) return false;
    const lower = item.path.toLowerCase();
    if (lower.startsWith('.git/') || lower.startsWith('.github/')) return false;
    return true;
  });
  return compareArchive(filtered);
}

async function downloadLatestRelease() {
  const release = await fetchLatestRelease();
  const targets = [];
  if (release.asset && release.asset.url) {
    targets.push({
      url: release.asset.url,
      name: release.asset.name || 'release.zip',
      type: 'asset'
    });
  }
  if (release.archive && release.archive.url) {
    targets.push({
      url: release.archive.url,
      name: release.archive.name || 'source.zip',
      type: 'archive'
    });
  }
  if (!targets.length) {
    throw new Error(t('editor.systemUpdates.errors.assetMissing'));
  }

  setStatus(t('editor.systemUpdates.status.downloading'));

  let buffer = null;
  let usedTarget = null;
  const failures = [];

  for (const target of targets) {
    try {
      if (usedTarget) break;
      if (target.type === 'archive' && failures.length && elements.status) {
        setStatus(t('editor.systemUpdates.status.retrying'), { tone: 'info' });
      }
      const response = await fetch(target.url, {
        cache: 'no-store',
        mode: 'cors',
        redirect: 'follow'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      buffer = await response.arrayBuffer();
      usedTarget = target;
    } catch (err) {
      failures.push(err);
    }
  }

  if (!buffer || !usedTarget) {
    const blocked = failures.some((err) => err instanceof TypeError);
    const message = blocked
      ? t('editor.systemUpdates.errors.assetDownloadBlocked')
      : t('editor.systemUpdates.errors.assetDownload');
    throw new Error(message);
  }

  assetSha256 = await digestSha256(buffer);
  assetSize = buffer.byteLength;
  assetName = usedTarget.name || 'release.zip';
  if (!release.asset && release.archive) {
    release.asset = {
      name: release.archive.name || assetName,
      url: release.archive.url,
      size: assetSize
    };
    renderReleaseMeta();
  }
  if (elements.assetMeta) {
    elements.assetMeta.textContent = t('editor.systemUpdates.assetWithHash', {
      name: assetName,
      size: formatSize(assetSize),
      hash: assetSha256
    });
  }
  setStatus(t('editor.systemUpdates.status.verifying'));
  const files = await processArchive(buffer);
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

async function handleDownloadClick() {
  if (busy) return;
  setButtonBusy(true);
  try {
    await fetchLatestRelease();
    await downloadLatestRelease();
  } catch (err) {
    console.error('System update failed', err);
    const message = err && err.message ? err.message : t('editor.systemUpdates.errors.generic');
    setStatus(message, { tone: 'error' });
    applySummary([], []);
  } finally {
    setButtonBusy(false);
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
  elements.button = document.getElementById('btnSystemRefresh');
  elements.fileSection = document.getElementById('systemUpdateFileSection');
  elements.fileList = document.getElementById('systemUpdateFileList');
  elements.notes = document.getElementById('systemUpdateReleaseNotes');
  elements.metaTitle = document.getElementById('systemUpdateReleaseMeta');
  elements.metaPublished = document.getElementById('systemUpdateReleasePublished');
  elements.assetMeta = document.getElementById('systemUpdateAssetMeta');
  elements.banner = document.getElementById('systemUpdateBanner');
  elements.bannerList = document.getElementById('systemUpdateBannerList');
  elements.bannerEmpty = document.getElementById('systemUpdateBannerEmpty');
  elements.bannerSummary = document.getElementById('systemUpdateBannerSummary');

  if (options && typeof options.onStateChange === 'function') listeners.add(options.onStateChange);

  if (elements.button) {
    elements.button.addEventListener('click', handleDownloadClick);
  }

  setStatus(t('editor.systemUpdates.status.idle'));
  fetchLatestRelease().catch((err) => {
    console.error('Failed to load system update metadata', err);
    setStatus(t('editor.systemUpdates.errors.releaseFetch'), { tone: 'error' });
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
  if (options && options.keepStatus !== true) {
    setStatus(t('editor.systemUpdates.status.idle'));
  }
  renderReleaseMeta();
}

