const DEFAULT_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];

const emptyStatus = {
  draftState: '',
  diffState: '',
  fileState: '',
  changeState: '',
  checkingCount: 0,
  orderChanged: false,
  isDeleted: false,
  deletedKind: '',
  restoreValue: null,
  restoreIndex: null,
  restoreOrderIndex: null
};

function emptyChangeCounts() {
  return { added: 0, modified: 0, deleted: 0, total: 0 };
}

function addChangeCount(target, state, amount = 1) {
  if (!target || !state || amount <= 0) return target;
  if (state === 'added') target.added += amount;
  else if (state === 'modified') target.modified += amount;
  else if (state === 'deleted') target.deleted += amount;
  target.total = target.added + target.modified + target.deleted;
  return target;
}

function mergeChangeCounts(target, source) {
  if (!target || !source) return target;
  target.added += Number(source.added || 0);
  target.modified += Number(source.modified || 0);
  target.deleted += Number(source.deleted || 0);
  target.total = target.added + target.modified + target.deleted;
  return target;
}

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

function cloneTreeValue(value) {
  if (Array.isArray(value)) return value.map(cloneTreeValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = cloneTreeValue(value[key]);
    });
    return out;
  }
  return value == null ? null : value;
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
    changeCounts: emptyChangeCounts(),
    ...emptyStatus,
    ...input
  };
  const draftState = resolveStatus(statusMaps && statusMaps.draft, node);
  const diffState = resolveStatus(statusMaps && statusMaps.diff, node);
  const fileState = resolveStatus(statusMaps && statusMaps.file, node);
  node.draftState = draftState || node.draftState || '';
  node.diffState = diffState || node.diffState || '';
  node.fileState = fileState || node.fileState || '';
  node.changeState = node.changeState || '';
  node.changeCounts = node.changeCounts && typeof node.changeCounts === 'object'
    ? {
      added: Number(node.changeCounts.added || 0),
      modified: Number(node.changeCounts.modified || 0),
      deleted: Number(node.changeCounts.deleted || 0),
      total: Number(node.changeCounts.total || 0)
    }
    : emptyChangeCounts();
  node.checkingCount = Number(node.checkingCount || 0);
  node.orderChanged = !!node.orderChanged;
  node.isDeleted = !!node.isDeleted;
  node.deletedKind = node.deletedKind || '';
  node.restoreValue = cloneTreeValue(node.restoreValue);
  node.restoreIndex = Number.isFinite(Number(node.restoreIndex)) ? Number(node.restoreIndex) : null;
  node.restoreOrderIndex = Number.isFinite(Number(node.restoreOrderIndex)) ? Number(node.restoreOrderIndex) : null;
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

function diffInfoForKey(diff, key) {
  return diff && diff.keys && diff.keys[key] ? diff.keys[key] : null;
}

function diffStateForKey(diff, key) {
  const info = diffInfoForKey(diff, key);
  if (info && info.state) return info.state;
  if (diff && Array.isArray(diff.addedKeys) && diff.addedKeys.includes(key)) return 'added';
  if (diff && Array.isArray(diff.removedKeys) && diff.removedKeys.includes(key)) return 'removed';
  return '';
}

function langDiffInfo(keyInfo, lang) {
  return keyInfo && keyInfo.langs && keyInfo.langs[lang] ? keyInfo.langs[lang] : null;
}

function removedKeys(current, baseline, diff) {
  const out = [];
  const seen = new Set();
  const add = (key) => {
    const value = String(key || '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  if (diff && Array.isArray(diff.removedKeys)) diff.removedKeys.forEach(add);
  if (diff) {
    orderedKeys(baseline || {}).forEach((key) => {
      if (current && Object.prototype.hasOwnProperty.call(current, key)) return;
      add(key);
    });
  }
  return out;
}

function keyOrderIndex(state, key) {
  const order = Array.isArray(state && state.__order) ? state.__order : orderedKeys(state || {});
  const index = order.indexOf(key);
  return index >= 0 ? index : null;
}

function removedLangs(currentEntry, baselineEntry, keyInfo, preferredLangs) {
  const out = [];
  const seen = new Set();
  const add = (lang) => {
    const value = String(lang || '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  if (keyInfo && Array.isArray(keyInfo.removedLangs)) keyInfo.removedLangs.forEach(add);
  if (keyInfo) {
    Object.keys(baselineEntry || {}).forEach((lang) => {
      if (currentEntry && Object.prototype.hasOwnProperty.call(currentEntry, lang)) return;
      add(lang);
    });
  }
  const sortable = {};
  out.forEach(lang => { sortable[lang] = true; });
  return sortEditorTreeLangs(sortable, preferredLangs);
}

function removedVersionItems(langInfo, currentValue, baselineValue) {
  const removed = [];
  const seen = new Set();
  const add = (value, index) => {
    const path = normalizeEditorTreePath(value);
    if (!path || seen.has(path)) return;
    seen.add(path);
    removed.push({ value: path, index: Number.isFinite(Number(index)) ? Number(index) : removed.length });
  };
  if (langInfo && langInfo.versions && Array.isArray(langInfo.versions.removed)) {
    langInfo.versions.removed.forEach(item => add(item && item.value, item && item.index));
  }
  if (langInfo) {
    const currentItems = new Set(normalizeIndexValue(currentValue));
    normalizeIndexValue(baselineValue).forEach((path, index) => {
      if (!currentItems.has(path)) add(path, index);
    });
  }
  return removed;
}

function inheritStructuralState(node, inheritedState = '') {
  if (!node) return node;
  if (!node.diffState && (inheritedState === 'added' || inheritedState === 'removed')) {
    node.diffState = inheritedState;
  }
  if (inheritedState === 'removed' || node.diffState === 'removed') {
    node.isDeleted = true;
  }
  const nextState = node.diffState === 'added' || node.diffState === 'removed'
    ? node.diffState
    : inheritedState;
  (node.children || []).forEach(child => inheritStructuralState(child, nextState));
  return node;
}

function inferChangeState(node) {
  if (!node) return '';
  if (node.isDeleted || node.diffState === 'removed') return 'deleted';
  if (node.fileState === 'missing' || node.diffState === 'added') return 'added';
  if (node.draftState === 'dirty' || node.diffState === 'modified' || node.diffState === 'changed') return 'modified';
  return '';
}

function annotateAggregateStatus(node) {
  if (!node) return node;
  if (Array.isArray(node.children) && node.children.length) {
    node.children.forEach(annotateAggregateStatus);
  }
  const directFileState = node.fileState;
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
  node.changeState = node.changeState || inferChangeState(node);

  const counts = emptyChangeCounts();
  if (Array.isArray(node.children) && node.children.length) {
    node.children.forEach(child => mergeChangeCounts(counts, child.changeCounts));
  } else if (node.changeState) {
    addChangeCount(counts, node.changeState);
  }
  if (node.kind === 'system' && node.changeState && !counts.total) {
    addChangeCount(counts, node.changeState);
  }
  node.changeCounts = counts;
  node.checkingCount = (directFileState === 'checking' ? 1 : 0)
    + (Array.isArray(node.children)
      ? node.children.reduce((sum, child) => sum + Number(child.checkingCount || 0), 0)
      : 0);
  return node;
}

export function buildEditorContentTree(input = {}, options = {}) {
  const index = input && input.index && typeof input.index === 'object' ? input.index : {};
  const tabs = input && input.tabs && typeof input.tabs === 'object' ? input.tabs : {};
  const preferredLangs = Array.isArray(options.preferredLangs) ? options.preferredLangs : DEFAULT_LANG_ORDER;
  const indexDiff = options.indexDiff || null;
  const tabsDiff = options.tabsDiff || null;
  const indexBaseline = options.indexBaseline && typeof options.indexBaseline === 'object' ? options.indexBaseline : {};
  const tabsBaseline = options.tabsBaseline && typeof options.tabsBaseline === 'object' ? options.tabsBaseline : {};
  const statusMaps = {
    draft: options.draftStates || null,
    diff: options.diffStates || null,
    file: options.fileStates || null
  };

  const welcomeRoot = makeNode({
    id: 'welcome',
    kind: 'root',
    source: 'welcome',
    label: options.welcomeLabel || 'welcome',
    children: []
  }, statusMaps);

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
        label: options.syncLabel || 'Publish',
        children: []
      }, statusMaps)
    ]
  }, statusMaps);

  const articlesRoot = makeNode({
    id: 'articles',
    kind: 'root',
    source: 'index',
    label: options.articlesLabel || 'Articles',
    orderChanged: !!(indexDiff && indexDiff.orderChanged),
      children: orderedKeys(index).map((key) => {
        const entry = index[key] && typeof index[key] === 'object' ? index[key] : {};
        const baselineEntry = indexBaseline[key] && typeof indexBaseline[key] === 'object' ? indexBaseline[key] : {};
        const keyInfo = diffInfoForKey(indexDiff, key);
        const orderIndex = keyOrderIndex(indexBaseline, key);
        const currentLangs = sortEditorTreeLangs(entry, preferredLangs);
        const deletedLangs = removedLangs(entry, baselineEntry, keyInfo, preferredLangs);
        return makeNode({
        id: `index:${key}`,
        kind: 'entry',
        source: 'index',
        key,
        label: key,
        diffState: diffStateForKey(indexDiff, key),
        children: [
          ...currentLangs.map((lang) => {
            const langInfo = langDiffInfo(keyInfo, lang);
            const currentValue = entry[lang];
            const baselineValue = baselineEntry[lang];
            const removedVersions = removedVersionItems(langInfo, currentValue, baselineValue);
            return makeNode({
              id: `index:${key}:${lang}`,
              kind: 'language',
              source: 'index',
              key,
              lang,
              label: lang.toUpperCase(),
              diffState: langInfo && langInfo.state ? langInfo.state : '',
              orderChanged: !!(langInfo && langInfo.versions && langInfo.versions.orderChanged),
              children: [
                ...normalizeIndexValue(currentValue).map((path, versionIndex) => makeNode({
                  id: `index:${key}:${lang}:${versionIndex}`,
                  kind: 'file',
                  source: 'index',
                  key,
                  lang,
                  versionIndex,
                  path,
                  label: versionLabel(path, versionIndex),
                  children: []
                }, statusMaps)),
                ...removedVersions.map(item => makeNode({
                  id: `index:${key}:${lang}:removed:${item.index}`,
                  kind: 'deleted-file',
                  source: 'index',
                  key,
                  lang,
                  versionIndex: item.index,
                  path: item.value,
                  label: versionLabel(item.value, item.index),
                  children: [],
                  diffState: 'removed',
                  isDeleted: true,
                  deletedKind: 'version',
                  restoreValue: item.value,
                  restoreIndex: item.index,
                  restoreOrderIndex: orderIndex
                }, statusMaps))
              ]
            }, statusMaps);
          }),
          ...deletedLangs.map((lang) => makeNode({
            id: `index:${key}:${lang}`,
            kind: 'deleted-language',
            source: 'index',
            key,
            lang,
            label: lang.toUpperCase(),
            diffState: 'removed',
            isDeleted: true,
            deletedKind: 'language',
            restoreValue: baselineEntry[lang],
            restoreOrderIndex: orderIndex,
            children: normalizeIndexValue(baselineEntry[lang]).map((path, versionIndex) => makeNode({
              id: `index:${key}:${lang}:removed:${versionIndex}`,
              kind: 'deleted-file',
              source: 'index',
              key,
              lang,
              versionIndex,
              path,
              label: versionLabel(path, versionIndex),
              children: [],
              diffState: 'removed',
              isDeleted: true,
              deletedKind: 'version',
              restoreValue: path,
              restoreIndex: versionIndex,
              restoreOrderIndex: orderIndex
            }, statusMaps))
          }, statusMaps))
        ]
      }, statusMaps);
    }).concat(removedKeys(index, indexBaseline, indexDiff).map((key) => {
      const baselineEntry = indexBaseline[key] && typeof indexBaseline[key] === 'object' ? indexBaseline[key] : {};
      const orderIndex = keyOrderIndex(indexBaseline, key);
      return makeNode({
        id: `index:${key}`,
        kind: 'deleted-entry',
        source: 'index',
        key,
        label: key,
        diffState: 'removed',
        isDeleted: true,
        deletedKind: 'entry',
        restoreValue: baselineEntry,
        restoreOrderIndex: orderIndex,
        children: sortEditorTreeLangs(baselineEntry, preferredLangs).map((lang) => makeNode({
          id: `index:${key}:${lang}`,
          kind: 'deleted-language',
          source: 'index',
          key,
          lang,
          label: lang.toUpperCase(),
          diffState: 'removed',
          isDeleted: true,
          deletedKind: 'language',
          restoreValue: baselineEntry[lang],
          restoreOrderIndex: orderIndex,
          children: normalizeIndexValue(baselineEntry[lang]).map((path, versionIndex) => makeNode({
            id: `index:${key}:${lang}:removed:${versionIndex}`,
            kind: 'deleted-file',
            source: 'index',
            key,
            lang,
            versionIndex,
            path,
            label: versionLabel(path, versionIndex),
            children: [],
            diffState: 'removed',
            isDeleted: true,
            deletedKind: 'version',
            restoreValue: path,
            restoreIndex: versionIndex,
            restoreOrderIndex: orderIndex
          }, statusMaps))
        }, statusMaps))
      }, statusMaps);
    }))
  }, statusMaps);

  const pagesRoot = makeNode({
    id: 'pages',
    kind: 'root',
    source: 'tabs',
    label: options.pagesLabel || 'Pages',
    orderChanged: !!(tabsDiff && tabsDiff.orderChanged),
    children: orderedKeys(tabs).map((key) => {
      const entry = tabs[key] && typeof tabs[key] === 'object' ? tabs[key] : {};
      const baselineEntry = tabsBaseline[key] && typeof tabsBaseline[key] === 'object' ? tabsBaseline[key] : {};
      const keyInfo = diffInfoForKey(tabsDiff, key);
      const orderIndex = keyOrderIndex(tabsBaseline, key);
      const currentLangs = sortEditorTreeLangs(entry, preferredLangs);
      const deletedLangs = removedLangs(entry, baselineEntry, keyInfo, preferredLangs);
      return makeNode({
        id: `tabs:${key}`,
        kind: 'entry',
        source: 'tabs',
        key,
        label: key,
        diffState: diffStateForKey(tabsDiff, key),
        children: [
          ...currentLangs.map((lang) => {
            const langInfo = langDiffInfo(keyInfo, lang);
            const path = normalizeTabValue(entry[lang]);
            return makeNode({
              id: `tabs:${key}:${lang}`,
              kind: 'file',
              source: 'tabs',
              key,
              lang,
              path,
              label: lang.toUpperCase(),
              diffState: langInfo && langInfo.state ? langInfo.state : '',
              children: []
            }, statusMaps);
          }),
          ...deletedLangs.map((lang) => {
            const path = normalizeTabValue(baselineEntry[lang]);
            return makeNode({
              id: `tabs:${key}:${lang}`,
              kind: 'deleted-file',
              source: 'tabs',
              key,
              lang,
              path,
              label: lang.toUpperCase(),
              diffState: 'removed',
              isDeleted: true,
              deletedKind: 'page-language',
              restoreValue: baselineEntry[lang],
              restoreOrderIndex: orderIndex,
              children: []
            }, statusMaps);
          })
        ]
    }, statusMaps);
    }).concat(removedKeys(tabs, tabsBaseline, tabsDiff).map((key) => {
      const baselineEntry = tabsBaseline[key] && typeof tabsBaseline[key] === 'object' ? tabsBaseline[key] : {};
      const orderIndex = keyOrderIndex(tabsBaseline, key);
      return makeNode({
        id: `tabs:${key}`,
        kind: 'deleted-entry',
        source: 'tabs',
        key,
        label: key,
        diffState: 'removed',
        isDeleted: true,
        deletedKind: 'entry',
        restoreValue: baselineEntry,
        restoreOrderIndex: orderIndex,
        children: sortEditorTreeLangs(baselineEntry, preferredLangs).map((lang) => {
          const path = normalizeTabValue(baselineEntry[lang]);
          return makeNode({
            id: `tabs:${key}:${lang}`,
            kind: 'deleted-file',
            source: 'tabs',
            key,
            lang,
            path,
            label: lang.toUpperCase(),
            diffState: 'removed',
            isDeleted: true,
            deletedKind: 'page-language',
            restoreValue: baselineEntry[lang],
            restoreOrderIndex: orderIndex,
            children: []
          }, statusMaps);
        })
      }, statusMaps);
    }))
  }, statusMaps);

  return [welcomeRoot, systemRoot, articlesRoot, pagesRoot].map(root => annotateAggregateStatus(inheritStructuralState(root)));
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
