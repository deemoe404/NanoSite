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

run('dirty paragraph serialization preserves edge whitespace', () => {
  const blocks = parseMarkdownBlocks('  Leading and trailing  \n\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  blocks[0].dirty = true;
  assert.equal(serializeMarkdownBlocks(blocks), '  Leading and trailing  \n\n');
});

run('reordered untouched blocks keep raw markdown content', () => {
  const blocks = parseMarkdownBlocks([
    'Paragraph with hard break  ',
    '',
    '- one  ',
    '- two',
    ''
  ].join('\n'));
  assert.equal(blocks.length, 2);
  const [moved] = blocks.splice(0, 1);
  blocks.splice(1, 0, moved);
  assert.equal(blocks[1].dirty, false);
  const serialized = serializeMarkdownBlocks(blocks);
  assert.match(serialized, /Paragraph with hard break  /);
  assert.match(serialized, /- one  \n- two/);
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

run('front matter stays as source content in block parsing', () => {
  const source = [
    '---',
    'title: Keep outside blocks',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'source');
  assert.equal(blocks[0].raw, '---\ntitle: Keep outside blocks\n---');
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[1].data.text, 'Body paragraph.');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('adjacent markdown block starts split without blank separators', () => {
  const source = [
    '# Title',
    'Body paragraph.',
    '- item',
    '> Quote',
    '```js',
    'console.log("x");',
    '```',
    'Tail paragraph.',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'paragraph', 'list', 'quote', 'code', 'paragraph']);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('tilde fenced code blocks round-trip and dirty serialize to backticks', () => {
  const source = [
    '~~~js',
    'console.log("tilde");',
    '~~~',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'code');
  assert.equal(blocks[0].data.lang, 'js');
  assert.equal(blocks[0].data.text, 'console.log("tilde");');
  assert.equal(serializeMarkdownBlocks(blocks), source);
  blocks[0].dirty = true;
  blocks[0].data.text = 'console.log("edited");';
  assert.equal(serializeMarkdownBlocks(blocks), [
    '```js',
    'console.log("edited");',
    '```',
    ''
  ].join('\n'));
});

run('dirty code serialization lengthens backtick fence when needed', () => {
  const blocks = parseMarkdownBlocks([
    '~~~md',
    '```',
    'inside',
    '```',
    '~~~',
    ''
  ].join('\n'));
  assert.equal(blocks.length, 1);
  blocks[0].dirty = true;
  assert.equal(serializeMarkdownBlocks(blocks), [
    '````md',
    '```',
    'inside',
    '```',
    '````',
    ''
  ].join('\n'));
});

run('unclosed tilde fences stay protected source blocks', () => {
  const source = [
    '~~~js',
    'console.log("open");',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'source');
  assert.equal(serializeMarkdownBlocks(blocks), source);
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
    'plain **bold** _italic_ ~~strike~~ `code` [link](https://example.com "link")'
  );
  assert.equal(
    serializeInlineRuns(parseInlineRuns('**_both_**')),
    '**_both_**'
  );
});

run('intraword underscores stay plain text', () => {
  const runs = parseInlineRuns('snake_case foo_bar_baz version_2_alpha');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].italic, false);
  assert.equal(serializeInlineRuns(runs), 'snake_case foo_bar_baz version_2_alpha');
});

run('underscore emphasis requires non-word boundaries', () => {
  assert.equal(serializeInlineRuns(parseInlineRuns('hello_italic_world')), 'hello_italic_world');
  assert.equal(serializeInlineRuns(parseInlineRuns('中文_斜体_中文')), '中文_斜体_中文');
  assert.equal(serializeInlineRuns(parseInlineRuns('hello _italic_ world')), 'hello _italic_ world');
  assert.equal(serializeInlineRuns(parseInlineRuns('hello (_italic_) world')), 'hello (_italic_) world');
});

run('inline parser preserves literal non-escape backslashes', () => {
  const source = String.raw`C:\Users\name and \alpha`;
  const runs = parseInlineRuns(source);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, source);
  assert.equal(parseInlineRuns(serializeInlineRuns(runs))[0].text, source);
});

run('inline parser consumes backslashes only before escapable punctuation', () => {
  const runs = parseInlineRuns(String.raw`\*not italic\* and \alpha`);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, String.raw`*not italic* and \alpha`);
  assert.equal(serializeInlineRuns(runs), String.raw`\*not italic\* and \\alpha`);
});

run('inline code preserves backslashes and backticks as literal code text', () => {
  const source = 'safe \\` **not bold**';
  const serialized = serializeInlineRuns([{ text: source, code: true }]);
  const parsed = parseInlineRuns(serialized);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].code, true);
  assert.equal(parsed[0].text, source);
});

run('inline code supports variable-length backtick delimiters', () => {
  const runs = parseInlineRuns('``foo`bar``');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].code, true);
  assert.equal(runs[0].text, 'foo`bar');
  assert.equal(serializeInlineRuns(runs), '``foo`bar``');
});

run('inline code serializes with enough backticks for the content', () => {
  assert.equal(serializeInlineRuns([{ text: 'foo``bar', code: true }]), '```foo``bar```');
  assert.equal(parseInlineRuns('```foo``bar```')[0].text, 'foo``bar');
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
  assert.equal(serializeInlineRuns(linked), 'see [**docs**](https://example.com "docs") now');
  const replaced = applyInlineLinkToRuns(linked, 4, 8, 'https://example.org', 'guide');
  assert.equal(serializeInlineRuns(replaced), 'see [**guide**](https://example.org "guide") now');
  const unlinked = applyInlineLinkToRuns(replaced, 4, 9, '');
  assert.equal(serializeInlineRuns(unlinked), 'see **guide** now');
});

run('inline links preserve optional title text', () => {
  const runs = parseInlineRuns('[docs](https://example.com "Custom title")');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].link, 'https://example.com');
  assert.equal(runs[0].linkTitle, 'Custom title');
  assert.equal(serializeInlineRuns(runs), '[docs](https://example.com "Custom title")');
});

run('inline links preserve balanced parentheses in destinations', () => {
  const runs = parseInlineRuns('[math](https://en.wikipedia.org/wiki/Function_(mathematics))');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].link, 'https://en.wikipedia.org/wiki/Function_(mathematics)');
  assert.equal(serializeInlineRuns(runs), '[math](https://en.wikipedia.org/wiki/Function_(mathematics) "math")');
});

run('inline links preserve balanced parentheses before title text', () => {
  const runs = parseInlineRuns('[math](https://example.com/a_(b) "Math title")');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].link, 'https://example.com/a_(b)');
  assert.equal(runs[0].linkTitle, 'Math title');
  assert.equal(serializeInlineRuns(runs), '[math](https://example.com/a_(b) "Math title")');
});

run('inline links preserve nested bracket labels', () => {
  const runs = parseInlineRuns('[a [b] c](https://example.com)');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, 'a [b] c');
  assert.equal(runs[0].link, 'https://example.com');
  assert.equal(serializeInlineRuns(runs), '[a \\[b\\] c](https://example.com "a [b] c")');
});

run('inline links accept angle-bracket destinations', () => {
  const runs = parseInlineRuns('[foo](<https://example.com/a b>)');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].link, 'https://example.com/a b');
  assert.equal(serializeInlineRuns(runs), '[foo](https://example.com/a%20b "foo")');
});

run('inline links accept angle-bracket destinations before title text', () => {
  const runs = parseInlineRuns('[foo](<https://example.com/a_(b)> "Angle title")');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].link, 'https://example.com/a_(b)');
  assert.equal(runs[0].linkTitle, 'Angle title');
  assert.equal(serializeInlineRuns(runs), '[foo](https://example.com/a_(b) "Angle title")');
});

run('inline links sanitize unsafe hrefs', () => {
  const linked = applyInlineLinkToRuns(parseInlineRuns('see docs'), 4, 8, 'javascript:alert(1)');
  assert.equal(serializeInlineRuns(linked), 'see [docs](# "docs")');
  assert.equal(serializeInlineRuns(parseInlineRuns('[docs](javascript:alert)')), '[docs](# "docs")');
});

run('inline pending mark insertion uses selected mark set', () => {
  const next = insertInlineRunsAtRange(parseInlineRuns('ab'), 1, 1, [{ text: 'X', bold: true, italic: true }]);
  assert.equal(serializeInlineRuns(next), 'a**_X_**b');
});
