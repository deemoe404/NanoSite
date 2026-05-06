import assert from 'node:assert/strict';

import {
  buildEditorContentTree,
  findEditorContentTreeNode,
  flattenEditorContentTree,
  normalizeEditorTreePath
} from '../assets/js/editor-content-tree.js';

const sample = {
  index: {
    __order: ['press', 'guide', 'v2', 'v3'],
    press: {
      en: [
        'post/main/main_en.md',
        'post/main/v2.0.0/main_en.md'
      ],
      chs: 'post/main/v2.0.0/main_chs.md'
    },
    guide: {
      ja: ['post/guide/v1.0.0/guide_ja.md']
    },
    v2: {
      en: [
        'post/v2/v1.0.0/main_en.md',
        'post/v2/v3.0.0/main_en.md'
      ]
    },
    v3: {
      en: ['post/v3/main_en.md']
    }
  },
  tabs: {
    __order: ['History', 'About'],
    History: {
      en: { title: 'Updates', location: 'tab/history/en.md' },
      chs: { title: '更新日志', location: 'tab/history/chs.md' }
    },
    About: {
      en: { title: 'About', location: 'tab/about/en.md' }
    }
  }
};

const baseline = {
  index: {
    __order: ['oldArticle', 'press', 'v2', 'v3'],
    oldArticle: {
      en: ['post/old/v1.0.0/old_en.md']
    },
    press: {
      en: [
        'post/main/main_en.md',
        'post/main/v1.5.0/old_en.md',
        'post/main/v2.0.0/main_en.md'
      ],
      chs: 'post/main/v2.0.0/main_chs.md',
      ja: ['post/main/main_ja.md']
    },
    v2: {
      en: [
        'post/v2/v1.0.0/main_en.md',
        'post/v2/v3.0.0/main_en.md'
      ]
    },
    v3: {
      en: ['post/v3/main_en.md']
    }
  },
  tabs: {
    __order: ['Archive', 'History', 'About'],
    Archive: {
      en: { title: 'Archive', location: 'tab/archive/en.md' }
    },
    History: {
      en: { title: 'Updates', location: 'tab/history/en.md' },
      chs: { title: '更新日志', location: 'tab/history/chs.md' },
      ja: { title: '履歴', location: 'tab/history/ja.md' }
    },
    About: {
      en: { title: 'About', location: 'tab/about/en.md' }
    }
  }
};

const draftStates = new Map([
  ['post/main/v2.0.0/main_en.md', 'dirty'],
  ['tabs:History:chs', 'saved'],
  ['tabs:About:en', 'saved']
]);
const fileStates = new Map([
  ['post/main/main_en.md', 'existing'],
  ['tab/history/chs.md', 'missing'],
  ['post/v3/main_en.md', 'checking']
]);
const diffStates = {
  'index:press:en:1': 'modified',
  'tabs:History': 'modified'
};
const indexDiff = {
  hasChanges: true,
  orderChanged: true,
  addedKeys: ['guide'],
  removedKeys: ['oldArticle'],
  keys: {
    guide: { state: 'added', langs: {}, addedLangs: [], removedLangs: [] },
    oldArticle: { state: 'removed', langs: {}, addedLangs: [], removedLangs: [] },
    press: {
      state: 'modified',
      addedLangs: [],
      removedLangs: ['ja'],
      langs: {
        en: {
          state: 'modified',
          versions: {
            orderChanged: true,
            removed: [{ value: 'post/main/v1.5.0/old_en.md', index: 1 }]
          }
        },
        ja: { state: 'removed' }
      }
    }
  }
};
const tabsDiff = {
  hasChanges: true,
  orderChanged: true,
  addedKeys: [],
  removedKeys: ['Archive'],
  keys: {
    Archive: { state: 'removed', langs: {}, addedLangs: [], removedLangs: [] },
    History: {
      state: 'modified',
      addedLangs: [],
      removedLangs: ['ja'],
      langs: {
        ja: { state: 'removed' }
      }
    }
  }
};

const tree = buildEditorContentTree(sample, {
  draftStates,
  fileStates,
  diffStates,
  indexDiff,
  tabsDiff,
  indexBaseline: baseline.index,
  tabsBaseline: baseline.tabs
});
const flat = flattenEditorContentTree(tree);

assert.equal(tree.length, 4, 'tree should have welcome, System, Articles, and Pages roots');
assert.deepEqual(tree.map(node => node.id), ['welcome', 'system', 'articles', 'pages'], 'root ids should be stable');

const welcome = tree[0];
assert.equal(welcome.id, 'welcome');
assert.equal(welcome.source, 'welcome');
assert.equal(welcome.kind, 'root');
assert.equal(welcome.label, 'welcome');
assert.deepEqual(welcome.children, [], 'welcome should be a virtual leaf root');
assert.deepEqual(welcome.changeCounts, { added: 0, modified: 0, deleted: 0, total: 0 }, 'welcome should not participate in content changes');
assert.equal(welcome.checkingCount, 0, 'welcome should not aggregate file checks');
assert.equal(welcome.changeState, '', 'welcome should not render a change badge');
assert.equal(welcome.orderChanged, false, 'welcome should not render an order badge');

const localizedWelcomeTree = buildEditorContentTree(sample, { welcomeLabel: 'Welcome' });
assert.equal(localizedWelcomeTree[0].id, 'welcome', 'localized welcome label should not change node id');
assert.equal(localizedWelcomeTree[0].label, 'Welcome', 'welcome root label should accept localized UI text');

const system = tree[1];
assert.equal(system.source, 'system');
assert.equal(system.kind, 'root');
assert.deepEqual(
  system.children.map(node => [node.id, node.kind, node.source, node.label]),
  [
    ['system:site-settings', 'system', 'system', 'Site Settings'],
    ['system:updates', 'system', 'system', 'Press Updates'],
    ['system:sync', 'system', 'system', 'Publish']
  ],
  'system root should expose stable Site Settings, Press Updates, and Publish leaves'
);

const articles = tree[2];
assert.equal(articles.source, 'index');
assert.deepEqual(articles.children.map(node => node.id), ['index:press', 'index:guide', 'index:v2', 'index:v3', 'index:oldArticle'], 'article entry order should follow __order and append deleted baseline entries');

const articleLangs = findEditorContentTreeNode(tree, 'index:press').children;
assert.deepEqual(articleLangs.map(node => node.id), ['index:press:en', 'index:press:chs', 'index:press:ja'], 'article languages should follow preferred language order and append deleted baseline languages');

const enVersions = findEditorContentTreeNode(tree, 'index:press:en').children;
assert.deepEqual(
  enVersions.map(node => [node.id, node.kind, node.path, node.label]),
  [
    ['index:press:en:0', 'file', 'post/main/main_en.md', 'Version 1'],
    ['index:press:en:1', 'file', 'post/main/v2.0.0/main_en.md', 'v2.0.0'],
    ['index:press:en:removed:1', 'deleted-file', 'post/main/v1.5.0/old_en.md', 'v1.5.0']
  ],
  'article language nodes should expose current and deleted version/file leaves while tolerating legacy root-level first versions'
);

assert.equal(findEditorContentTreeNode(tree, 'index:press:en:1').draftState, 'dirty');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:1').diffState, 'modified');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:0').fileState, 'existing');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en').draftState, 'dirty', 'language nodes should aggregate child draft state');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:1').changeState, 'modified', 'dirty or modified file leaves should render as Modified');
assert.equal(findEditorContentTreeNode(tree, 'index:guide:ja:0').changeState, 'added', 'descendants of added article keys should render as Added');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:removed:1').changeState, 'deleted', 'removed article versions should render as Deleted tombstones');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:removed:1').isDeleted, true, 'removed article versions should be marked as tombstones');
assert.equal(findEditorContentTreeNode(tree, 'index:press:ja:removed:0').changeState, 'deleted', 'removed article languages should expose deleted file tombstones');
assert.equal(findEditorContentTreeNode(tree, 'index:oldArticle:en:removed:0').changeState, 'deleted', 'removed article keys should expose deleted descendant file tombstones');
assert.deepEqual(
  [
    findEditorContentTreeNode(tree, 'index:oldArticle').kind,
    findEditorContentTreeNode(tree, 'index:press:ja').kind,
    findEditorContentTreeNode(tree, 'index:press:en:removed:1').kind,
    findEditorContentTreeNode(tree, 'tabs:Archive').kind,
    findEditorContentTreeNode(tree, 'tabs:History:ja').kind
  ],
  ['deleted-entry', 'deleted-language', 'deleted-file', 'deleted-entry', 'deleted-file'],
  'deleted entry, language, and file tombstones should use non-editable tree kinds'
);
assert.deepEqual(
  [
    findEditorContentTreeNode(tree, 'index:oldArticle').deletedKind,
    findEditorContentTreeNode(tree, 'index:press:ja').deletedKind,
    findEditorContentTreeNode(tree, 'index:press:en:removed:1').deletedKind,
    findEditorContentTreeNode(tree, 'tabs:Archive').deletedKind,
    findEditorContentTreeNode(tree, 'tabs:History:ja').deletedKind
  ],
  ['entry', 'language', 'version', 'entry', 'page-language'],
  'deleted tombstones should declare the explicit restore target kind'
);
assert.deepEqual(findEditorContentTreeNode(tree, 'index:oldArticle').restoreValue, baseline.index.oldArticle, 'deleted article entries should carry the baseline entry payload for restore');
assert.equal(findEditorContentTreeNode(tree, 'index:oldArticle').restoreOrderIndex, 0, 'deleted article entries should remember their baseline order index');
assert.deepEqual(findEditorContentTreeNode(tree, 'index:press:ja').restoreValue, baseline.index.press.ja, 'deleted article languages should carry the baseline language payload for restore');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:removed:1').restoreValue, 'post/main/v1.5.0/old_en.md', 'deleted article versions should carry their baseline file path for restore');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en:removed:1').restoreIndex, 1, 'deleted article versions should remember their baseline version index');
assert.deepEqual(findEditorContentTreeNode(tree, 'tabs:History:ja').restoreValue, baseline.tabs.History.ja, 'deleted page language files should carry their baseline tab-language payload for restore');
assert.equal(findEditorContentTreeNode(tree, 'index:press:en').orderChanged, true, 'article language nodes should expose version order changes');
assert.deepEqual(
  findEditorContentTreeNode(tree, 'index:press').changeCounts,
  { added: 0, modified: 1, deleted: 2, total: 3 },
  'article entry nodes should aggregate descendant changed file counts even when children are collapsed'
);
assert.equal(findEditorContentTreeNode(tree, 'index:v3:en:0').checkingCount, 1, 'checking file leaves should carry checkingCount');
assert.equal(findEditorContentTreeNode(tree, 'index:v3:en:0').changeCounts.total, 0, 'checking should not count as a file change');
assert.equal(articles.orderChanged, true, 'Articles root should expose root order changes');
assert.equal(articles.checkingCount, 1, 'Articles root should aggregate descendant checking states');

const versionKeyVersions = findEditorContentTreeNode(tree, 'index:v2:en').children;
assert.deepEqual(
  versionKeyVersions.map(node => [node.id, node.path, node.label]),
  [
    ['index:v2:en:0', 'post/v2/v1.0.0/main_en.md', 'v1.0.0'],
    ['index:v2:en:1', 'post/v2/v3.0.0/main_en.md', 'v3.0.0']
  ],
  'article version labels should use the version folder nearest the filename even when the article key looks like a version'
);

const legacyVersionLikeKeyVersions = findEditorContentTreeNode(tree, 'index:v3:en').children;
assert.deepEqual(
  legacyVersionLikeKeyVersions.map(node => [node.id, node.path, node.label]),
  [
    ['index:v3:en:0', 'post/v3/main_en.md', 'Version 1']
  ],
  'legacy root-style article paths should not treat a version-like article key as an explicit version folder'
);

const pages = tree[3];
assert.equal(pages.source, 'tabs');
assert.deepEqual(pages.children.map(node => node.id), ['tabs:History', 'tabs:About', 'tabs:Archive'], 'page entry order should follow __order and append deleted baseline entries');
assert.deepEqual(
  findEditorContentTreeNode(tree, 'tabs:History').children.map(node => [node.id, node.kind, node.path]),
  [
    ['tabs:History:en', 'file', 'tab/history/en.md'],
    ['tabs:History:chs', 'file', 'tab/history/chs.md'],
    ['tabs:History:ja', 'deleted-file', 'tab/history/ja.md']
  ],
  'page languages should be direct current or deleted file leaves without a version layer'
);
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:chs').draftState, 'saved');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:chs').fileState, 'missing');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:chs').changeState, 'added', 'missing remote page files should render as Added');
assert.equal(findEditorContentTreeNode(tree, 'tabs:About:en').changeState, '', 'saved drafts should not create tree change badges');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:ja').changeState, 'deleted', 'removed page languages should render as Deleted tombstones');
assert.equal(findEditorContentTreeNode(tree, 'tabs:Archive:en').changeState, 'deleted', 'removed page keys should expose deleted file tombstones');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History').diffState, 'modified');
assert.deepEqual(
  findEditorContentTreeNode(tree, 'tabs:History').changeCounts,
  { added: 1, modified: 0, deleted: 1, total: 2 },
  'page entry nodes should aggregate added and deleted descendant file counts'
);
assert.equal(pages.orderChanged, true, 'Pages root should expose root order changes');

assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'draftState')), 'every node should carry draftState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'diffState')), 'every node should carry diffState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'fileState')), 'every node should carry fileState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'changeState')), 'every node should carry changeState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'changeCounts')), 'every node should carry changeCounts');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'checkingCount')), 'every node should carry checkingCount');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'orderChanged')), 'every node should carry orderChanged');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'isDeleted')), 'every node should carry isDeleted');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'deletedKind')), 'every node should carry deletedKind');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'restoreValue')), 'every node should carry restoreValue');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'restoreIndex')), 'every node should carry restoreIndex');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'restoreOrderIndex')), 'every node should carry restoreOrderIndex');

assert.equal(normalizeEditorTreePath('/wwwroot/../post//demo/./main_en.md'), 'post/demo/main_en.md');

console.log('ok - editor content tree model');
