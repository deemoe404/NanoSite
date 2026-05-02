import assert from 'node:assert/strict';

import {
  parseMarkdownBlocks,
  serializeMarkdownBlocks
} from '../assets/js/editor-blocks.js';

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('supported blocks round-trip when untouched', () => {
  const source = [
    '# Title',
    '',
    'Paragraph with **bold** and [a link](?id=post/doc/v2.1.0/doc_en.md).',
    '',
    '![Alt text](assets/example.png)',
    '',
    '- one',
    '- two',
    '',
    '> Quote line',
    '> second line',
    '',
    '```js',
    'console.log("NanoSite");',
    '```',
    ''
  ].join('\n');
  assert.equal(serializeMarkdownBlocks(parseMarkdownBlocks(source)), source);
});

run('dirty supported blocks serialize edited markdown', () => {
  const blocks = parseMarkdownBlocks([
    '## Old heading',
    '',
    'Old paragraph',
    '',
    '![Old](assets/old.png)',
    '',
    '> Old quote',
    '',
    '```js',
    'console.log("old");',
    '```',
    '',
    '1. first',
    '2. second',
    '',
    '- [ ] open',
    '- [x] done',
    '',
    '[Old card](?id=post/old.md "card")',
    ''
  ].join('\n'));

  blocks[0].dirty = true;
  blocks[0].data.level = 3;
  blocks[0].data.text = 'New heading';
  blocks[1].dirty = true;
  blocks[1].data.text = 'New paragraph';
  blocks[2].dirty = true;
  blocks[2].data.alt = 'New';
  blocks[2].data.src = 'assets/new.png';
  blocks[2].data.title = 'New title';
  blocks[3].dirty = true;
  blocks[3].data.text = 'New quote';
  blocks[4].dirty = true;
  blocks[4].data.lang = 'ts';
  blocks[4].data.text = 'console.log("new");';
  blocks[5].dirty = true;
  blocks[5].data.items = [{ text: 'alpha **bold**' }, { text: 'beta' }];
  blocks[6].dirty = true;
  blocks[6].data.listType = 'task';
  blocks[6].data.items = [{ text: 'open', checked: true }, { text: 'done', checked: false }];
  blocks[7].dirty = true;
  blocks[7].data.label = 'New card';
  blocks[7].data.location = 'post/new.md';
  blocks[7].data.forceCard = true;

  assert.equal(serializeMarkdownBlocks(blocks), [
    '### New heading',
    '',
    'New paragraph',
    '',
    '![New](assets/new.png "New title")',
    '',
    '> New quote',
    '',
    '```ts',
    'console.log("new");',
    '```',
    '',
    '1. alpha **bold**',
    '2. beta',
    '',
    '- [x] open',
    '- [ ] done',
    '',
    '[New card](?id=post/new.md "card")',
    ''
  ].join('\n'));
});

run('unsupported risky markdown becomes source blocks', () => {
  const blocks = parseMarkdownBlocks([
    '| A | B |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '> [!note] Title',
    '> Body',
    '',
    '- parent',
    '  - child',
    ''
  ].join('\n'));
  assert.deepEqual(blocks.map(block => block.type), ['source', 'source', 'source']);
  assert.equal(serializeMarkdownBlocks(blocks), [
    '| A | B |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '> [!note] Title',
    '> Body',
    '',
    '- parent',
    '  - child',
    ''
  ].join('\n'));
});

run('front matter is stripped before block parsing', () => {
  const blocks = parseMarkdownBlocks([
    '---',
    'title: Keep outside blocks',
    '---',
    'Body paragraph.',
    ''
  ].join('\n'));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].data.text, 'Body paragraph.');
  assert.equal(serializeMarkdownBlocks(blocks), 'Body paragraph.\n');
});
