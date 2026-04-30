const DEFAULT_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];

const emptyStatus = {
  draftState: '',
  diffState: '',
  fileState: ''
};

export function normalizeEditorTreePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw
    .replace(/[\\]/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .split('/');
  const stack = [];
  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      if (stack.length) stack.pop();
      return;
    }
    stack.push(part);
  });
  return stack.join('/');
}

export function normalizeEditorTreeLang(code) {
  return String(code || '').trim().toLowerCase();
}

export function sortEditorTreeLangs(entry = {}, preferred = DEFAULT_LANG_ORDER) {
  const order = Array.isArray(preferred) && preferred.length ? preferred : DEFAULT_LANG_ORDER;
  return Object.keys(entry || {}).filter(Boolean).sort((a, b) => {
    const aa = normalizeEditorTreeLang(a);
    const bb = normalizeEditorTreeLang(b);
    const ia = order.indexOf(aa);
    const ib = order.indexOf(bb);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return aa.localeCompare(bb);
  });
}

function orderedKeys(state = {}) {
  const out = [];
  const seen = new Set();
  const add = (key) => {
    const value = String(key || '').trim();
    if (!value || value === '__order' || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  if (Array.isArray(state.__order)) state.__order.forEach(add);
  Object.keys(state || {}).forEach(add);
  return out;
}

function makeNode(input, statusMaps) {
  const node = {
    id: '',
    kind: '',
    source: '',
    key: '',
    lang: '',
    versionIndex: null,
    path: '',
    label: '',
    children: [],
    ...emptyStatus,
    ...input
  };
  const draftState = resolveStatus(statusMaps && statusMaps.draft, node);
  const diffState = resolveStatus(statusMaps && statusMaps.diff, node);
  const fileState = resolveStatus(statusMaps && statusMaps.file, node);
  node.draftState = draftState || node.draftState || '';
  node.diffState = diffState || node.diffState || '';
  node.fileState = fileState || node.fileState || '';
  if (!Array.isArray(node.children)) node.children = [];
  return node;
}

function resolveStatus(map, node) {
  if (!map) return '';
  if (typeof map.get === 'function') {
    return map.get(node.id) || (node.path ? map.get(node.path) : '') || '';
  }
  if (typeof map === 'object') {
    return map[node.id] || (node.path ? map[node.path] : '') || '';
  }
  return '';
}

function normalizeIndexValue(value) {
  if (Array.isArray(value)) return value.map(normalizeEditorTreePath).filter(Boolean);
  const path = normalizeEditorTreePath(value);
  return path ? [path] : [];
}

function normalizeTabValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeEditorTreePath(value.location);
  }
  return normalizeEditorTreePath(value);
}

function filenameLabel(path, fallback) {
  const normalized = normalizeEditorTreePath(path);
  if (!normalized) return fallback;
  const parts = normalized.split('/');
  return parts[parts.length - 1] || fallback;
}

function explicitArticleVersionLabel(path) {
  const normalized = normalizeEditorTreePath(path);
  if (!normalized) return '';
  const segments = normalized.split('/');
  if (segments.length <= 1) return '';
  segments.pop();
  if (segments.length < 3) return '';
  if (String(segments[0] || '').trim().toLowerCase() !== 'post') return '';
  const candidate = String(segments[segments.length - 1] || '').trim();
  if (!/^v\d+(?:\.\d+)*$/i.test(candidate)) return '';
  return candidate;
  return '';
}

function versionLabel(path, index) {
  const version = explicitArticleVersionLabel(path);
  if (version) return version;
  return `Version ${index + 1}`;
}

function annotateAggregateStatus(node) {
  if (!node || !Array.isArray(node.children) || !node.children.length) return node;
  node.children.forEach(annotateAggregateStatus);
  const order = ['conflict', 'dirty', 'saved', 'modified', 'added', 'removed', 'missing', 'error', 'existing', 'checking'];
  const pick = (field) => {
    if (node[field]) return node[field];
    const values = node.children.map(child => child[field]).filter(Boolean);
    for (const value of order) {
      if (values.includes(value)) return value;
    }
    return values[0] || '';
  };
  node.draftState = pick('draftState');
  node.diffState = pick('diffState');
  node.fileState = pick('fileState');
  return node;
}

export function buildEditorContentTree(input = {}, options = {}) {
  const index = input && input.index && typeof input.index === 'object' ? input.index : {};
  const tabs = input && input.tabs && typeof input.tabs === 'object' ? input.tabs : {};
  const preferredLangs = Array.isArray(options.preferredLangs) ? options.preferredLangs : DEFAULT_LANG_ORDER;
  const statusMaps = {
    draft: options.draftStates || null,
    diff: options.diffStates || null,
    file: options.fileStates || null
  };

  const systemRoot = makeNode({
    id: 'system',
    kind: 'root',
    source: 'system',
    label: options.systemLabel || 'System',
    children: [
      makeNode({
        id: 'system:site-settings',
        kind: 'system',
        source: 'system',
        key: 'site-settings',
        label: options.siteSettingsLabel || 'Site Settings',
        children: []
      }, statusMaps),
      makeNode({
        id: 'system:updates',
        kind: 'system',
        source: 'system',
        key: 'updates',
        label: options.updatesLabel || 'NanoSite Updates',
        children: []
      }, statusMaps),
      makeNode({
        id: 'system:sync',
        kind: 'system',
        source: 'system',
        key: 'sync',
        label: options.syncLabel || 'Sync',
        children: []
      }, statusMaps)
    ]
  }, statusMaps);

  const articlesRoot = makeNode({
    id: 'articles',
    kind: 'root',
    source: 'index',
    label: options.articlesLabel || 'Articles',
    children: orderedKeys(index).map((key) => {
      const entry = index[key] && typeof index[key] === 'object' ? index[key] : {};
      return makeNode({
        id: `index:${key}`,
        kind: 'entry',
        source: 'index',
        key,
        label: key,
        children: sortEditorTreeLangs(entry, preferredLangs).map((lang) => makeNode({
          id: `index:${key}:${lang}`,
          kind: 'language',
          source: 'index',
          key,
          lang,
          label: lang.toUpperCase(),
          children: normalizeIndexValue(entry[lang]).map((path, versionIndex) => makeNode({
            id: `index:${key}:${lang}:${versionIndex}`,
            kind: 'file',
            source: 'index',
            key,
            lang,
            versionIndex,
            path,
            label: versionLabel(path, versionIndex),
            children: []
          }, statusMaps))
        }, statusMaps))
      }, statusMaps);
    })
  }, statusMaps);

  const pagesRoot = makeNode({
    id: 'pages',
    kind: 'root',
    source: 'tabs',
    label: options.pagesLabel || 'Pages',
    children: orderedKeys(tabs).map((key) => {
      const entry = tabs[key] && typeof tabs[key] === 'object' ? tabs[key] : {};
      return makeNode({
        id: `tabs:${key}`,
        kind: 'entry',
        source: 'tabs',
        key,
        label: key,
        children: sortEditorTreeLangs(entry, preferredLangs).map((lang) => {
          const path = normalizeTabValue(entry[lang]);
          return makeNode({
            id: `tabs:${key}:${lang}`,
            kind: 'file',
            source: 'tabs',
            key,
            lang,
            path,
            label: lang.toUpperCase(),
            children: []
          }, statusMaps);
        })
      }, statusMaps);
    })
  }, statusMaps);

  return [systemRoot, articlesRoot, pagesRoot].map(annotateAggregateStatus);
}

export function flattenEditorContentTree(nodes = []) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    out.push(node);
    (node.children || []).forEach(walk);
  };
  (Array.isArray(nodes) ? nodes : []).forEach(walk);
  return out;
}

export function findEditorContentTreeNode(nodes = [], id) {
  if (!id) return null;
  return flattenEditorContentTree(nodes).find(node => node && node.id === id) || null;
}
