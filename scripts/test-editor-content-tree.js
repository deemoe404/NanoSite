import assert from 'node:assert/strict';

import {
  buildEditorContentTree,
  findEditorContentTreeNode,
  flattenEditorContentTree,
  normalizeEditorTreePath
} from '../assets/js/editor-content-tree.js';

const sample = {
  index: {
    __order: ['nanoSite', 'guide', 'v2'],
    nanoSite: {
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

const draftStates = new Map([
  ['post/main/v2.0.0/main_en.md', 'dirty'],
  ['tabs:History:chs', 'saved']
]);
const fileStates = new Map([
  ['post/main/main_en.md', 'existing'],
  ['tab/history/chs.md', 'missing']
]);
const diffStates = {
  'index:nanoSite:en:1': 'modified',
  'tabs:History': 'modified'
};

const tree = buildEditorContentTree(sample, {
  draftStates,
  fileStates,
  diffStates
});
const flat = flattenEditorContentTree(tree);

assert.equal(tree.length, 3, 'tree should have System, Articles, and Pages roots');
assert.deepEqual(tree.map(node => node.id), ['system', 'articles', 'pages'], 'root ids should be stable');

const system = tree[0];
assert.equal(system.source, 'system');
assert.equal(system.kind, 'root');
assert.deepEqual(
  system.children.map(node => [node.id, node.kind, node.source, node.label]),
  [
    ['system:site-settings', 'system', 'system', 'Site Settings'],
    ['system:updates', 'system', 'system', 'NanoSite Updates'],
    ['system:sync', 'system', 'system', 'Sync']
  ],
  'system root should expose stable Site Settings, NanoSite Updates, and Sync leaves'
);

const articles = tree[1];
assert.equal(articles.source, 'index');
assert.deepEqual(articles.children.map(node => node.id), ['index:nanoSite', 'index:guide', 'index:v2'], 'article entry order should follow __order');

const articleLangs = findEditorContentTreeNode(tree, 'index:nanoSite').children;
assert.deepEqual(articleLangs.map(node => node.id), ['index:nanoSite:en', 'index:nanoSite:chs'], 'article languages should follow preferred language order');

const enVersions = findEditorContentTreeNode(tree, 'index:nanoSite:en').children;
assert.deepEqual(
  enVersions.map(node => [node.id, node.kind, node.path, node.label]),
  [
    ['index:nanoSite:en:0', 'file', 'post/main/main_en.md', 'Version 1'],
    ['index:nanoSite:en:1', 'file', 'post/main/v2.0.0/main_en.md', 'v2.0.0']
  ],
  'article language nodes should expose version/file leaves while tolerating legacy root-level first versions'
);

assert.equal(findEditorContentTreeNode(tree, 'index:nanoSite:en:1').draftState, 'dirty');
assert.equal(findEditorContentTreeNode(tree, 'index:nanoSite:en:1').diffState, 'modified');
assert.equal(findEditorContentTreeNode(tree, 'index:nanoSite:en:0').fileState, 'existing');
assert.equal(findEditorContentTreeNode(tree, 'index:nanoSite:en').draftState, 'dirty', 'language nodes should aggregate child draft state');

const versionKeyVersions = findEditorContentTreeNode(tree, 'index:v2:en').children;
assert.deepEqual(
  versionKeyVersions.map(node => [node.id, node.path, node.label]),
  [
    ['index:v2:en:0', 'post/v2/v1.0.0/main_en.md', 'v1.0.0'],
    ['index:v2:en:1', 'post/v2/v3.0.0/main_en.md', 'v3.0.0']
  ],
  'article version labels should use the version folder nearest the filename even when the article key looks like a version'
);

const pages = tree[2];
assert.equal(pages.source, 'tabs');
assert.deepEqual(pages.children.map(node => node.id), ['tabs:History', 'tabs:About'], 'page entry order should follow __order');
assert.deepEqual(
  findEditorContentTreeNode(tree, 'tabs:History').children.map(node => [node.id, node.kind, node.path]),
  [
    ['tabs:History:en', 'file', 'tab/history/en.md'],
    ['tabs:History:chs', 'file', 'tab/history/chs.md']
  ],
  'page languages should be direct file leaves without a version layer'
);
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:chs').draftState, 'saved');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History:chs').fileState, 'missing');
assert.equal(findEditorContentTreeNode(tree, 'tabs:History').diffState, 'modified');

assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'draftState')), 'every node should carry draftState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'diffState')), 'every node should carry diffState');
assert.ok(flat.every(node => Object.prototype.hasOwnProperty.call(node, 'fileState')), 'every node should carry fileState');

assert.equal(normalizeEditorTreePath('/wwwroot/../post//demo/./main_en.md'), 'post/demo/main_en.md');

console.log('ok - editor content tree model');
