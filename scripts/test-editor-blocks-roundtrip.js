import assert from 'node:assert/strict';

import {
  applyInlineLinkToRuns,
  insertInlineRunsAtRange,
  patchListItem,
  parseInlineRuns,
  parseMarkdownBlocks,
  removeInlineMarkAroundOffset,
  serializeInlineRuns,
  serializeMarkdownBlocks,
  toggleInlineMarkOnRuns
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
    ''
  ].join('\n'));
  assert.deepEqual(blocks.map(block => block.type), ['source', 'source']);
  assert.equal(serializeMarkdownBlocks(blocks), [
    '| A | B |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '> [!note] Title',
    '> Body',
    ''
  ].join('\n'));
});

run('indented lists become editable visual list blocks', () => {
  const source = [
    '- parent',
    '  - child',
    '    - grandchild',
    '- sibling',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'list');
  assert.deepEqual(blocks[0].data.items.map(item => item.indent), [0, 1, 2, 0]);
  assert.equal(serializeMarkdownBlocks(blocks), source);

  blocks[0].dirty = true;
  blocks[0].data.items[1].text = 'edited child';
  assert.equal(serializeMarkdownBlocks(blocks), [
    '- parent',
    '  - edited child',
    '    - grandchild',
    '- sibling',
    ''
  ].join('\n'));
});

run('indented task lists preserve checkbox state and spacing when edited', () => {
  const blocks = parseMarkdownBlocks([
    '- [ ] parent',
    '  - [x] child',
    ''
  ].join('\n'));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].data.listType, 'task');
  assert.deepEqual(blocks[0].data.items.map(item => [item.indent, item.checked]), [[0, false], [1, true]]);
  blocks[0].dirty = true;
  blocks[0].data.items[0].checked = true;
  assert.equal(serializeMarkdownBlocks(blocks), [
    '- [x] parent',
    '  - [x] child',
    ''
  ].join('\n'));
});

run('list item patches preserve latest item state', () => {
  const initial = [{ text: 'A', checked: false }, { text: 'B', checked: false }];
  const afterTextEdit = patchListItem(initial, 0, { text: 'AA' });
  const afterCheckboxEdit = patchListItem(afterTextEdit, 1, { checked: true });
  assert.deepEqual(afterCheckboxEdit, [{ text: 'AA', checked: false }, { text: 'B', checked: true }]);
});

run('malformed card ids stay editable instead of throwing', () => {
  const source = '[Bad card](?id=post/100%foo.md "card")\n';
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'card');
  assert.equal(blocks[0].data.location, 'post/100%foo.md');
  assert.equal(serializeMarkdownBlocks(blocks), source);
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

run('opening thematic breaks are preserved as body content', () => {
  const source = [
    '---',
    'Intro paragraph.',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  assert.equal(serializeMarkdownBlocks(parseMarkdownBlocks(source)), source);
});

run('inline runs serialize nested supported marks canonically', () => {
  assert.equal(
    serializeInlineRuns(parseInlineRuns('plain **bold** *italic* ~~strike~~ `code` [link](https://example.com)')),
    'plain **bold** _italic_ ~~strike~~ `code` [link](https://example.com)'
  );
  assert.equal(
    serializeInlineRuns(parseInlineRuns('**_both_**')),
    '**_both_**'
  );
});

run('inline code escapes backslashes before backticks', () => {
  const source = 'safe \\` **not bold**';
  const serialized = serializeInlineRuns([{ text: source, code: true }]);
  const parsed = parseInlineRuns(serialized);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].code, true);
  assert.equal(parsed[0].text, source);
});

run('inline selection removes a mark from mixed selected text when any selected run has it', () => {
  [
    ['bold', 'aa **bb** cc'],
    ['italic', 'aa _bb_ cc'],
    ['strike', 'aa ~~bb~~ cc']
  ].forEach(([mark, source]) => {
    const next = toggleInlineMarkOnRuns(parseInlineRuns(source), 1, 7, mark);
    assert.equal(serializeInlineRuns(next), 'aa bb cc', `${mark} should be removed from marked parts only`);
  });
});

run('inline selection applies a mark to the full range when no selected run has it', () => {
  [
    ['bold', 'a**a bb c**c'],
    ['italic', 'a_a bb c_c'],
    ['strike', 'a~~a bb c~~c']
  ].forEach(([mark, expected]) => {
    const next = toggleInlineMarkOnRuns(parseInlineRuns('aa bb cc'), 1, 7, mark);
    assert.equal(serializeInlineRuns(next), expected, `${mark} should be applied across the selected range`);
  });
});

run('inline partial selection toggles marks off only inside the range', () => {
  const runs = parseInlineRuns('**abcdef**');
  const next = toggleInlineMarkOnRuns(runs, 2, 4, 'bold');
  assert.equal(serializeInlineRuns(next), '**ab**cd**ef**');
});

run('inline code is exclusive over selected text', () => {
  const runs = parseInlineRuns('a **[bold link](https://example.com)** z');
  const next = toggleInlineMarkOnRuns(runs, 2, 11, 'code');
  assert.equal(serializeInlineRuns(next), 'a `bold link` z');
});

run('inline code can be removed around a collapsed caret', () => {
  const runs = parseInlineRuns('a `code` z');
  assert.equal(serializeInlineRuns(removeInlineMarkAroundOffset(runs, 4, 'code')), 'a code z');
  assert.equal(serializeInlineRuns(removeInlineMarkAroundOffset(parseInlineRuns('a `code` z'), 2, 'code')), 'a code z');
  assert.equal(serializeInlineRuns(removeInlineMarkAroundOffset(parseInlineRuns('a `code` z'), 6, 'code')), 'a code z');
  assert.equal(serializeInlineRuns(removeInlineMarkAroundOffset(parseInlineRuns('a `one` and `two`'), 4, 'code')), 'a one and `two`');
});

run('inline link can be applied, replaced, and removed without losing safe marks', () => {
  const linked = applyInlineLinkToRuns(parseInlineRuns('see **docs** now'), 4, 8, 'https://example.com');
  assert.equal(serializeInlineRuns(linked), 'see [**docs**](https://example.com) now');
  const replaced = applyInlineLinkToRuns(linked, 4, 8, 'https://example.org', 'guide');
  assert.equal(serializeInlineRuns(replaced), 'see [**guide**](https://example.org) now');
  const unlinked = applyInlineLinkToRuns(replaced, 4, 9, '');
  assert.equal(serializeInlineRuns(unlinked), 'see **guide** now');
});

run('inline links sanitize unsafe hrefs', () => {
  const linked = applyInlineLinkToRuns(parseInlineRuns('see docs'), 4, 8, 'javascript:alert(1)');
  assert.equal(serializeInlineRuns(linked), 'see [docs](#)');
  assert.equal(serializeInlineRuns(parseInlineRuns('[docs](javascript:alert)')), '[docs](#)');
});

run('inline pending mark insertion uses selected mark set', () => {
  const next = insertInlineRunsAtRange(parseInlineRuns('ab'), 1, 1, [{ text: 'X', bold: true, italic: true }]);
  assert.equal(serializeInlineRuns(next), 'a**_X_**b');
});
