import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyInlineLinkToRuns,
  autofixMarkdownSourceBlock,
  insertInlineRunsAtRange,
  inlineRenderedTextLength,
  isBlockEmptyForBackspace,
  joinMergedEditableText,
  convertListTailItemAfterEmptyToParagraph,
  listVisualMarkerLabels,
  mergeFirstListItemIntoPreviousBlock,
  mergeListItemIntoPreviousItem,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  patchListItem,
  parseInlineRuns,
  parseMarkdownBlocks,
  removeInlineMarkAroundOffset,
  patchListItemType,
  serializeInlineRuns,
  serializeMarkdownBlocks,
  splitListItemsAtEmptyItem,
  splitTextBlockIntoParagraph,
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

const editorBlocksSource = readFileSync(new URL('../assets/js/editor-blocks.js', import.meta.url), 'utf8');

const functionSource = (name) => {
  const start = editorBlocksSource.indexOf(`function ${name}`);
  if (start < 0) return '';
  const next = editorBlocksSource.indexOf('\nfunction ', start + 1);
  return editorBlocksSource.slice(start, next < 0 ? editorBlocksSource.length : next);
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

run('empty image blocks round-trip without inventing a placeholder src', () => {
  const source = '![]()\n';
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'image');
  assert.equal(blocks[0].data.src, '');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('empty block backspace detection only treats user-empty blocks as removable', () => {
  assert.equal(isBlockEmptyForBackspace({ type: 'blank', data: {} }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'paragraph', data: { text: '   ' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'heading', data: { text: 'Title' } }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'quote', data: { text: '\n' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'code', data: { text: '' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'source', raw: 'raw', data: {} }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'image', data: { src: '', alt: '', title: '' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'image', data: { src: '', alt: 'diagram', title: '' } }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'card', data: { location: '', label: '', title: '' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'card', data: { location: 'post/doc.md', label: '', title: '' } }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'list', data: { items: [{ text: '  ', checked: false }] } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'list', data: { items: [{ text: '', checked: true }] } }), false);
});

run('dirty paragraph serialization preserves edge whitespace', () => {
  const blocks = parseMarkdownBlocks('  Leading and trailing  \n\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  blocks[0].dirty = true;
  assert.equal(serializeMarkdownBlocks(blocks), '  Leading and trailing  \n\n');
});

run('normal markdown block separators do not materialize blank blocks', () => {
  const source = 'A\n\nB';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'paragraph']);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('one extra markdown blank line materializes one blank block', () => {
  const source = 'A\n\n\nB';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'blank', 'paragraph']);
  assert.equal(blocks[1].dirty, false);
  assert.equal(blocks[1].data.after, '\n');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('multiple extra markdown blank lines materialize multiple blank blocks', () => {
  const source = 'A\n\n\n\nB';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'blank', 'blank', 'paragraph']);
  assert.deepEqual(blocks.filter(block => block.type === 'blank').map(block => block.data.after), ['\n', '\n']);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('trailing extra markdown blank lines round-trip as blank blocks', () => {
  const source = 'A\n\n\n';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'blank']);
  assert.equal(blocks[1].dirty, false);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('leading markdown blank lines round-trip as blank blocks', () => {
  const source = '\n\nA';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['blank', 'blank', 'paragraph']);
  assert.equal(blocks[0].dirty, false);
  assert.equal(blocks[1].dirty, false);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('blank-only markdown round-trips as blank blocks', () => {
  const source = '\n\n';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['blank', 'blank']);
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('mid-enter splits a paragraph into a following paragraph block', () => {
  const [block] = parseMarkdownBlocks('abcdef\n\n');
  const split = splitTextBlockIntoParagraph(block, 'abc', 'def');
  assert.deepEqual(split.map(item => item.type), ['paragraph', 'paragraph']);
  assert.equal(split[0].dirty, true);
  assert.equal(split[1].dirty, true);
  assert.equal(split[0].data.text, 'abc');
  assert.equal(split[1].data.text, 'def');
  assert.equal(serializeMarkdownBlocks(split), 'abc\n\ndef\n\n');
});

run('mid-enter keeps heading metadata and moves trailing text to a paragraph', () => {
  const [block] = parseMarkdownBlocks('### abcdef\n\n');
  const split = splitTextBlockIntoParagraph(block, 'abc', 'def');
  assert.deepEqual(split.map(item => item.type), ['heading', 'paragraph']);
  assert.equal(split[0].data.level, 3);
  assert.equal(split[0].data.text, 'abc');
  assert.equal(split[1].data.text, 'def');
  assert.equal(serializeMarkdownBlocks(split), '### abc\n\ndef\n\n');
});

run('mid-enter keeps quote before caret and moves trailing text to a paragraph', () => {
  const [block] = parseMarkdownBlocks('> abcdef\n\n');
  const split = splitTextBlockIntoParagraph(block, 'abc', 'def');
  assert.deepEqual(split.map(item => item.type), ['quote', 'paragraph']);
  assert.equal(split[0].data.text, 'abc');
  assert.equal(split[1].data.text, 'def');
  assert.equal(serializeMarkdownBlocks(split), '> abc\n\ndef\n\n');
});

run('mid-enter split preserves inline markdown text around the split', () => {
  const [block] = parseMarkdownBlocks('hello **bold** world\n\n');
  const split = splitTextBlockIntoParagraph(block, 'hello **bo**', '**ld** world');
  assert.equal(split[0].data.text, 'hello **bo**');
  assert.equal(split[1].data.text, '**ld** world');
  assert.equal(serializeMarkdownBlocks(split), 'hello **bo**\n\n**ld** world\n\n');
});

run('text block split helper only supports editable text block types', () => {
  const [listBlock] = parseMarkdownBlocks('- one\n- two\n\n');
  assert.equal(splitTextBlockIntoParagraph(listBlock, 'one', 'two'), null);
});

run('mid-enter split leaves end-of-block Enter on the blank block insertion path', () => {
  assert.match(
    editorBlocksSource,
    /offsets\.start >= currentText\.length[\s\S]*return false;[\s\S]*splitEditableTextAtSelection\(editable\)/,
    'split path should bail out before splitting when the caret is at the end'
  );
  assert.match(
    editorBlocksSource,
    /splitTextBlockAfterCaret\(event, block, index, editable\)[\s\S]*shouldInsertBlankBlockOnEnter\(editable\)[\s\S]*insertBlankBlockAfter\(index, editable, sync\)/,
    'plain Enter should try mid-split before falling back to real blank block insertion'
  );
});

run('mid-enter split ignores modified Enter key chords', () => {
  assert.match(
    editorBlocksSource,
    /event\.key !== 'Enter' \|\| event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.isComposing/,
    'split path should only handle plain Enter'
  );
});

run('backspace at text block start merges paragraph into previous paragraph', () => {
  const blocks = parseMarkdownBlocks('abc\n\ndef\n\n');
  const merged = mergeTextBlockIntoPrevious(blocks[0], blocks[1]);
  assert.equal(merged.type, 'paragraph');
  assert.equal(merged.dirty, true);
  assert.equal(merged.data.text, 'abc def');
  assert.equal(merged.focusCaretOffset, 4);
  assert.equal(serializeMarkdownBlocks([merged]), 'abc def\n\n');
});

run('backspace merge preserves previous heading metadata', () => {
  const blocks = parseMarkdownBlocks('### abc\n\ndef\n\n');
  const merged = mergeTextBlockIntoPrevious(blocks[0], blocks[1]);
  assert.equal(merged.type, 'heading');
  assert.equal(merged.data.level, 3);
  assert.equal(merged.data.text, 'abc def');
  assert.equal(serializeMarkdownBlocks([merged]), '### abc def\n\n');
});

run('backspace merge preserves previous quote type', () => {
  const blocks = parseMarkdownBlocks('> abc\n\ndef\n\n');
  const merged = mergeTextBlockIntoPrevious(blocks[0], blocks[1]);
  assert.equal(merged.type, 'quote');
  assert.equal(merged.data.text, 'abc def');
  assert.equal(serializeMarkdownBlocks([merged]), '> abc def\n\n');
});

run('backspace merge only uses current block text', () => {
  const [paragraph] = parseMarkdownBlocks('abc\n\n');
  const [heading] = parseMarkdownBlocks('### def\n\n');
  const [quote] = parseMarkdownBlocks('> ghi\n\n');
  assert.equal(mergeTextBlockIntoPrevious(paragraph, heading).data.text, 'abc def');
  assert.equal(mergeTextBlockIntoPrevious(paragraph, quote).data.text, 'abc ghi');
});

run('backspace merge inserts a single safe space only when needed', () => {
  assert.deepEqual(joinMergedEditableText('abc', 'def'), { text: 'abc def', separator: ' ' });
  assert.deepEqual(joinMergedEditableText('abc ', 'def'), { text: 'abc def', separator: '' });
  assert.deepEqual(joinMergedEditableText('abc', ' def'), { text: 'abc def', separator: '' });
  assert.deepEqual(joinMergedEditableText('', 'def'), { text: 'def', separator: '' });
  assert.deepEqual(joinMergedEditableText('abc', ''), { text: 'abc', separator: '' });
});

run('backspace merge caret offsets use rendered inline text length', () => {
  assert.equal(inlineRenderedTextLength('Click **Save.**'), 'Click Save.'.length);
  assert.equal(inlineRenderedTextLength('_Italic_ [docs](?id=post/doc.md "Docs") `a*b` \\*literal\\*'), 'Italic docs a*b *literal*'.length);

  const previousText = { type: 'paragraph', data: { text: 'Click **Save.**' } };
  const currentText = { type: 'paragraph', data: { text: 'Follow' } };
  const textMerge = mergeTextBlockIntoPrevious(previousText, currentText);
  assert.equal(textMerge.data.text, 'Click **Save.** Follow');
  assert.equal(textMerge.focusCaretOffset, 'Click Save. '.length);

  const previousList = { type: 'list', data: { items: [{ text: 'Click **Save.**', indent: 0 }] } };
  const textToListMerge = mergeTextBlockIntoPreviousList(previousList, currentText);
  assert.equal(textToListMerge.data.items[0].text, 'Click **Save.** Follow');
  assert.equal(textToListMerge.focusCaretOffset, 'Click Save. '.length);

  const itemMerge = mergeListItemIntoPreviousItem([{ text: 'Click **Save.**', indent: 0 }, { text: 'Follow', indent: 0 }], 1);
  assert.deepEqual(itemMerge.items, [{ text: 'Click **Save.** Follow', indent: 0 }]);
  assert.equal(itemMerge.caretOffset, 'Click Save. '.length);

  const firstItemToText = mergeFirstListItemIntoPreviousBlock(previousText, { type: 'list', data: { items: [{ text: 'Follow', indent: 0 }] } }, 0);
  assert.equal(firstItemToText.previousBlock.data.text, 'Click **Save.** Follow');
  assert.deepEqual(firstItemToText.focus, { type: 'text', caretOffset: 'Click Save. '.length });

  const firstItemToList = mergeFirstListItemIntoPreviousBlock(previousList, { type: 'list', data: { items: [{ text: 'Follow', indent: 0 }] } }, 0);
  assert.equal(firstItemToList.previousBlock.data.items[0].text, 'Click **Save.** Follow');
  assert.deepEqual(firstItemToList.focus, { type: 'list', itemIndex: 0, caretOffset: 'Click Save. '.length });
});

run('backspace merge requires two text blocks', () => {
  const [paragraph] = parseMarkdownBlocks('abc\n\n');
  const [listBlock] = parseMarkdownBlocks('- def\n\n');
  assert.equal(mergeTextBlockIntoPrevious(null, paragraph), null);
  assert.equal(mergeTextBlockIntoPrevious(listBlock, paragraph), null);
  assert.equal(mergeTextBlockIntoPrevious(paragraph, listBlock), null);
});

run('backspace at text block start merges text into previous list tail item', () => {
  const [listBlock] = parseMarkdownBlocks('- abc\n  - child\n\n');
  const [paragraph] = parseMarkdownBlocks('def\n\n');
  const merged = mergeTextBlockIntoPreviousList(listBlock, paragraph);
  assert.equal(merged.type, 'list');
  assert.equal(merged.dirty, true);
  assert.equal(merged.data.items[1].text, 'child def');
  assert.equal(merged.data.items[1].indent, 1);
  assert.equal(merged.focusCaretOffset, 6);
  assert.equal(serializeMarkdownBlocks([merged]), '- abc\n  - child def\n\n');
});

run('backspace text-to-list merge only contributes current text and preserves list metadata', () => {
  const previous = {
    type: 'list',
    data: {
      listType: 'task',
      items: [
        { text: 'done', checked: true, listType: 'task', marker: '+', indent: 0 },
        { text: 'tail', checked: false, listType: 'task', marker: '*', indent: 0 }
      ]
    }
  };
  const heading = { type: 'heading', data: { level: 3, text: ' head' } };
  const quote = { type: 'quote', data: { text: ' quote' } };
  const withHeading = mergeTextBlockIntoPreviousList(previous, heading);
  assert.deepEqual(withHeading.data.items[1], { text: 'tail head', checked: false, listType: 'task', marker: '*', indent: 0 });
  assert.equal(mergeTextBlockIntoPreviousList(withHeading, quote).data.items[1].text, 'tail head quote');
});

run('list item Backspace merge only joins adjacent same-level items', () => {
  const initial = [
    { text: 'abc', indent: 1, checked: true, listType: 'task' },
    { text: 'def', indent: 1, checked: false, listType: 'ul' }
  ];
  const merged = mergeListItemIntoPreviousItem(initial, 1);
  assert.equal(merged.caretOffset, 4);
  assert.equal(merged.focusItemIndex, 0);
  assert.deepEqual(merged.items, [{ text: 'abc def', indent: 1, checked: true, listType: 'task' }]);
  assert.equal(mergeListItemIntoPreviousItem([{ text: 'parent', indent: 0 }, { text: 'child', indent: 1 }], 1), null);
  assert.equal(mergeListItemIntoPreviousItem([{ text: 'child', indent: 1 }, { text: 'parent', indent: 0 }], 1), null);
  assert.equal(mergeListItemIntoPreviousItem([{ text: 'prev', indent: 0 }, { text: 'parent', indent: 0 }, { text: 'child', indent: 1 }], 1), null);
});

run('first list item Backspace can merge into previous text or list block when structurally safe', () => {
  const previousText = { type: 'paragraph', data: { text: 'abc' } };
  const currentList = { type: 'list', data: { listType: 'ul', items: [{ text: 'def', indent: 0 }, { text: 'next', indent: 0 }] } };
  const textMerge = mergeFirstListItemIntoPreviousBlock(previousText, currentList, 0);
  assert.equal(textMerge.previousBlock.data.text, 'abc def');
  assert.deepEqual(textMerge.currentBlock.data.items, [{ text: 'next', indent: 0 }]);
  assert.deepEqual(textMerge.focus, { type: 'text', caretOffset: 4 });

  const previousList = { type: 'list', data: { listType: 'ul', items: [{ text: 'tail', indent: 1, marker: '*' }] } };
  const listMerge = mergeFirstListItemIntoPreviousBlock(previousList, { type: 'list', data: { items: [{ text: 'def', indent: 0 }] } }, 0);
  assert.equal(listMerge.previousBlock.data.items[0].text, 'tail def');
  assert.equal(listMerge.previousBlock.data.items[0].indent, 1);
  assert.equal(listMerge.currentBlock, null);
  assert.deepEqual(listMerge.focus, { type: 'list', itemIndex: 0, caretOffset: 5 });
});

run('first list item Backspace refuses nested or child-owning items', () => {
  const previousText = { type: 'paragraph', data: { text: 'abc' } };
  assert.equal(
    mergeFirstListItemIntoPreviousBlock(previousText, { type: 'list', data: { items: [{ text: 'child', indent: 1 }] } }, 0),
    null
  );
  assert.equal(
    mergeFirstListItemIntoPreviousBlock(previousText, { type: 'list', data: { items: [{ text: 'parent', indent: 0 }, { text: 'child', indent: 1 }] } }, 0),
    null
  );
  assert.equal(
    mergeFirstListItemIntoPreviousBlock({ type: 'image', data: { src: 'x.png' } }, { type: 'list', data: { items: [{ text: 'item', indent: 0 }] } }, 0),
    null
  );
});

run('backspace merge path runs after empty-block removal and before Enter handling', () => {
  assert.match(
    editorBlocksSource,
    /removeEmptyBlockWithBackspace\(event, block, index, editable, sync\)[\s\S]*mergeTextBlockWithPreviousOnBackspace\(event, block, index, editable\)[\s\S]*event\.key !== 'Enter'/,
    'text block Backspace merge should run after empty-block removal and before Enter handling'
  );
  assert.match(
    editorBlocksSource,
    /if \(!Number\.isInteger\(index\) \|\| index <= 0\) return false;[\s\S]*mergeTextBlockIntoPrevious\(previous, block\) \|\| mergeTextBlockIntoPreviousList\(previous, block\)/,
    'text block Backspace merge should never apply to the first block'
  );
});

run('backspace merge ignores modified Backspace key chords', () => {
  assert.match(
    editorBlocksSource,
    /event\.key !== 'Backspace' \|\| event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.isComposing/,
    'merge path should only handle plain Backspace'
  );
});

run('backspace merge focuses previous block at its rendered text length', () => {
  assert.match(
    editorBlocksSource,
    /focusBlockPrimaryEditable\(merged, merged\.focusCaretOffset\)/,
    'caret should land after any inserted separator after text block merge'
  );
  assert.match(
    editorBlocksSource,
    /state\.pendingListFocus = \{[\s\S]*caretOffset: merged\.focusCaretOffset[\s\S]*\}/,
    'caret should land after any inserted separator after text-to-list merge'
  );
});

run('cross-block arrows only handle plain vertical arrow keys', () => {
  assert.match(
    editorBlocksSource,
    /event\.key !== 'ArrowUp' && event\.key !== 'ArrowDown'/,
    'cross-block navigation should only consider vertical arrow keys'
  );
  assert.match(
    editorBlocksSource,
    /event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.isComposing/,
    'cross-block navigation should ignore modified arrow key chords and IME composition'
  );
});

run('cross-block arrows only leave text editables from edge lines', () => {
  assert.match(
    editorBlocksSource,
    /isEditableCaretOnEdgeLine\(editable, direction\)[\s\S]*if \(!onEdge\) return false;/,
    'contenteditable arrow navigation should only cross blocks on the first or last visual line'
  );
  assert.match(
    editorBlocksSource,
    /isTextareaCaretOnEdgeLine\(editable, direction\)[\s\S]*if \(!onEdge\) return false;/,
    'textarea arrow navigation should only cross blocks at the first or last text line'
  );
});

run('cross-block arrows detect wrapped contenteditable visual lines from text ranges', () => {
  const edgeLineSource = functionSource('isEditableCaretOnEdgeLine');
  assert.match(
    editorBlocksSource,
    /function editableVisualLineRects\(el\)[\s\S]*createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)[\s\S]*range\.setStart\(node, i\)[\s\S]*range\.getClientRects/,
    'visual line detection should be based on per-character text range rectangles'
  );
  assert.match(
    edgeLineSource,
    /const lineRects = editableVisualLineRects\(el\);/,
    'edge-line detection should use grouped visual text lines'
  );
  assert.doesNotMatch(
    edgeLineSource,
    /el\.getClientRects/,
    'edge-line detection should not use the editable element rect as a proxy for wrapped text lines'
  );
});

run('cross-block arrows place target caret using grouped visual text lines', () => {
  assert.match(
    functionSource('placeCaretAtVisualLine'),
    /const lineRects = editableVisualLineRects\(el\);/,
    'target caret placement should use the same visual line grouping as edge detection'
  );
});

run('cross-block arrows focus non-text block containers and continue from them', () => {
  assert.match(
    editorBlocksSource,
    /if \(!editable\) \{[\s\S]*activateNonTextBlockFromPointer\(target\.index, target\.blockEl\);[\s\S]*return true;[\s\S]*\}/,
    'non-text navigation targets should focus the block container'
  );
  assert.match(
    editorBlocksSource,
    /if \(event\.target !== item\) return;[\s\S]*handleCrossBlockArrowNavigation\(event, index\);/,
    'focused non-text block containers should continue cross-block arrow navigation'
  );
});

run('cross-block arrows keep list item navigation before block-level fallback', () => {
  assert.match(
    editorBlocksSource,
    /nextIndex < 0 \|\| nextIndex >= items\.length[\s\S]*handleCrossBlockArrowNavigation\(event, index, span\)/,
    'list items should cross blocks only when arrowing beyond the first or last item'
  );
  assert.match(
    editorBlocksSource,
    /placeCaretAtVisualLine\(target, caretRect \? caretRect\.left : 0, event\.key === 'ArrowUp' \? 'last' : 'first', caretOffset\)/,
    'existing list item visual-line navigation should be preserved'
  );
});

run('cross-block arrows wire rich text, code, and source editables', () => {
  assert.match(
    editorBlocksSource,
    /mergeTextBlockWithPreviousOnBackspace\(event, block, index, editable\)[\s\S]*handleCrossBlockArrowNavigation\(event, index, editable\)[\s\S]*event\.key !== 'Enter'/,
    'rich text editables should run cross-block arrows before Enter handling'
  );
  assert.match(
    editorBlocksSource,
    /removeEmptyBlockWithBackspace\(event, block, index, code, sync\)[\s\S]*handleCrossBlockArrowNavigation\(event, index, code\)[\s\S]*event\.key !== 'Enter'/,
    'code editables should run cross-block arrows before code Enter handling'
  );
  assert.match(
    editorBlocksSource,
    /removeEmptyBlockWithBackspace\(event, block, index, area, sync\)[\s\S]*handleCrossBlockArrowNavigation\(event, index, area\)/,
    'source textareas should run cross-block arrows after empty-block deletion'
  );
});

run('empty list item Enter exits or splits the list before normal item splitting', () => {
  assert.match(
    editorBlocksSource,
    /if \(event\.key === 'Enter'\) \{[\s\S]*const currentText = editableText\(span\);[\s\S]*const outdentedItems = outdentEmptyListItemForEnter\(currentItems, itemIndex\);[\s\S]*if \(outdentedItems\) \{[\s\S]*updateFromControl\(block, \{ items: outdentedItems \}, true\);[\s\S]*return;[\s\S]*const trailingParagraph = isEditableSelectionAtStart\(span\)[\s\S]*convertListTailItemAfterEmptyToParagraph\(currentItems, itemIndex\)[\s\S]*focusBlockPrimaryEditable\(paragraph, 0\);[\s\S]*const emptySplit = splitListItemsAtEmptyItem\(currentItems, itemIndex\);[\s\S]*const splitAfter = normalizeSplitListStartItems\(emptySplit\.after\);[\s\S]*state\.blocks\.splice\(index \+ 1, 0, nextBlock\)[\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\)[\s\S]*state\.blocks\.splice\(index, 1, blank\)[\s\S]*return;[\s\S]*const split = splitEditableTextAtSelection\(span\);[\s\S]*state\.pendingListFocus = \{ blockId: block\.id, itemIndex: itemIndex \+ 1, caretOffset: 0 \};/,
    'empty list item Enter should delete the empty item and choose list split, blank exit, or blank replacement before normal item splitting'
  );
  assert.match(
    editorBlocksSource,
    /if \(event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.isComposing\) return;[\s\S]*if \(event\.key === 'Enter'\)/,
    'empty list item Enter should share the existing plain-Enter-only guard'
  );
});

run('blank blocks replace the inline virtual insertion state', () => {
  assert.doesNotMatch(
    editorBlocksSource,
    /inlineVirtualIndex|openInlineVirtualBlockAfter|createParagraphFromVirtualInput|shouldOpenInlineVirtualBlockOnEnter/,
    'blank blocks should not depend on persistent inline virtual block state'
  );
  assert.match(
    editorBlocksSource,
    /const BLOCK_TYPES = new Set\(\[[^\]]*'blank'[^\]]*\]\)/,
    'blank should be an internal block type'
  );
  assert.match(
    editorBlocksSource,
    /function makeBlankBlock\(after = '\\n', data = \{\}\)[\s\S]*makeBlock\('blank', '', \{ \.\.\.data, after: after \|\| '\\n' \}\)/,
    'blank blocks should serialize as newline whitespace only'
  );
});

run('visual editor has no terminal virtual UI and only materializes blank blocks for empty documents', () => {
  assert.match(
    editorBlocksSource,
    /const ensureEditableBlankForEmptyDocument = \(\) => \{[\s\S]*if \(state\.blocks\.length\) return null;[\s\S]*Empty documents still need one real blank block[\s\S]*non-empty documents rely on Enter at the end instead[\s\S]*makeBlankBlock\('\\n', \{ dirty: true \}\)[\s\S]*state\.blocks\.push\(block\)/,
    'visual editor state should create a dirty real blank only for empty documents'
  );
  assert.match(
    editorBlocksSource,
    /setMarkdown\(markdown\) \{[\s\S]*state\.blocks = parseMarkdownBlocks\(markdown\);[\s\S]*ensureEditableBlankForEmptyDocument\(\);[\s\S]*state\.activeIndex = -1;/,
    'setMarkdown should add a real blank only when the parsed document has no blocks'
  );
  const setMarkdownSource = editorBlocksSource.match(/setMarkdown\(markdown\) \{[\s\S]*?\n    \},/)?.[0] || '';
  assert.match(
    setMarkdownSource,
    /ensureEditableBlankForEmptyDocument\(\);[\s\S]*render\(\);/,
    'setMarkdown should render the empty-document blank'
  );
  assert.doesNotMatch(
    setMarkdownSource,
    /emit\(|options\.onChange/,
    'setMarkdown should not actively emit a save when it materializes the empty-document blank'
  );
  assert.doesNotMatch(
    editorBlocksSource,
    /renderVirtualBlock|handleTerminalVirtualBackspace|focusTerminalVirtualEditable|ensureTrailingBlankBlock|list\.appendChild\(renderVirtualBlock\(state\.blocks\.length\)\)/,
    'terminal virtual block runtime should be removed'
  );
});

run('typing or slash command on blank blocks replaces the blank block', () => {
  assert.match(
    editorBlocksSource,
    /const renderBlankBlock = \(body, block, index\) => \{[\s\S]*event\.data === '\/'[\s\S]*openBlockCommandMenu\(index\)[\s\S]*createParagraphFromBlankInput\(event\.data, index\)/,
    'blank block input should either open the command menu or become a paragraph'
  );
  assert.match(
    editorBlocksSource,
    /renderBlankBlock[\s\S]*editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key === 'Enter' && !event\.shiftKey && !event\.altKey && !event\.ctrlKey && !event\.metaKey && !event\.isComposing[\s\S]*event\.preventDefault\(\);[\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\);[\s\S]*return;[\s\S]*removeEmptyBlockWithBackspace/,
    'plain Enter in a blank block should insert a following blank instead of converting the current blank to a paragraph'
  );
  assert.match(
    editorBlocksSource,
    /if \(state\.blocks\[safeIndex\] && state\.blocks\[safeIndex\]\.type === 'blank'\) \{[\s\S]*state\.blocks\.splice\(safeIndex, 1, block\);[\s\S]*render\(\);/,
    'command-selected blocks should replace an existing blank block without forcing a new trailing blank'
  );
});

run('blank blocks use existing removable and cross-block navigation paths', () => {
  assert.match(
    editorBlocksSource,
    /if \(block\.type === 'blank'\) return true;/,
    'empty-block Backspace detection should treat blank blocks as removable'
  );
  assert.match(
    editorBlocksSource,
    /if \(!Number\.isInteger\(index\) \|\| index <= 0\) return false;[\s\S]*if \(!isBlockEmptyForBackspace\(block\)\) return false;/,
    'blank Backspace removal should still skip the first block'
  );
  assert.match(
    editorBlocksSource,
    /editable\.className = 'blocks-rich-editable blocks-paragraph-text blocks-virtual-editable blocks-blank-editable'/,
    'blank blocks should expose a rich editable for cross-block arrow targeting'
  );
  assert.match(
    editorBlocksSource,
    /blockEl\.querySelector\('\.blocks-rich-editable:not\(\.blocks-list-text\), \.blocks-code-preview code\[contenteditable="true"\], \.blocks-image-caption, \.blocks-source-textarea'\)/,
    'cross-block target discovery should include blank rich editables and image captions'
  );
  assert.match(
    editorBlocksSource,
    /const head = document\.createElement\('div'\);[\s\S]*head\.className = 'blocks-block-head';[\s\S]*head\.appendChild\(actions\);[\s\S]*item\.append\(head, renderBlockBody\(block, index\)\);/,
    'blank blocks should use the normal floating block toolbar'
  );
  assert.match(
    editorBlocksSource,
    /const focusPreviousBlockEnd = \(index\) => \{[\s\S]*if \(target\.type === 'list'\) \{[\s\S]*editableListItems\(target\.data && target\.data\.items\)\.length - 1[\s\S]*focusListItemEditable\(target, itemIndex, \{ atEnd: true \}\);[\s\S]*return;[\s\S]*focusBlockPrimaryEditable\(target\);/,
    'empty-block Backspace should focus the previous list block at its last item end'
  );
});

run('dirty list serialization preserves item edge whitespace', () => {
  const blocks = parseMarkdownBlocks('- item  \n- next\n\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'list');
  blocks[0].dirty = true;
  blocks[0].data.items[1].text = 'edited';
  assert.equal(serializeMarkdownBlocks(blocks), '- item  \n- edited\n\n');
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

run('inline code that looks like html stays an editable paragraph', () => {
  const source = 'Generate the initial `<head>` tags from `site.yaml`.\n';
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].data.text, 'Generate the initial `<head>` tags from `site.yaml`.');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('raw html outside inline code still becomes source', () => {
  const source = 'Generate <head> tags from `site.yaml`.\n';
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'source');
  assert.equal(blocks[0].data.sourceReason, 'rawHtml');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('indented list source blocks explain the markdown fallback', () => {
  const source = [
    '\t- nested-looking item',
    '\t- another item',
    ''
  ].join('\n');
  const blocks = parseMarkdownBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'source');
  assert.equal(blocks[0].data.sourceReason, 'indentedList');
  assert.equal(serializeMarkdownBlocks(blocks), source);
});

run('indented list source blocks can autofix into visual list blocks', () => {
  const source = [
    '\t- nested-looking item',
    '\t- another item',
    ''
  ].join('\n');
  const [sourceBlock] = parseMarkdownBlocks(source);
  const fixed = autofixMarkdownSourceBlock(sourceBlock);
  assert.equal(fixed.length, 1);
  assert.equal(fixed[0].type, 'list');
  assert.equal(fixed[0].dirty, true);
  assert.deepEqual(fixed[0].data.items.map(item => item.text), ['nested-looking item', 'another item']);
  assert.equal(serializeMarkdownBlocks(fixed), '- nested-looking item\n- another item\n');
});

run('mixed ordered and unordered nested lists become editable visual lists', () => {
  const source = [
    '1. Configure apex A records:',
    '   - `185.199.108.153`',
    '   - `185.199.109.153`',
    '2. Save the custom domain.',
    ''
  ].join('\n');
  const [listBlock] = parseMarkdownBlocks(source);
  assert.equal(listBlock.type, 'list');
  assert.equal(listBlock.data.listType, 'mixed');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['ol', 'ul', 'ul', 'ol']);
  assert.deepEqual(listBlock.data.items.map(item => item.indent), [0, 1, 1, 0]);
  assert.equal(serializeMarkdownBlocks([listBlock]), source);
});

run('dirty mixed standard list edits preserve per-item list types', () => {
  const source = [
    '1. Configure apex A records:',
    '   - `185.199.108.153`',
    '   - `185.199.109.153`',
    '2. Save the custom domain.',
    ''
  ].join('\n');
  const [listBlock] = parseMarkdownBlocks(source);
  listBlock.dirty = true;
  listBlock.data.items[1].text = '`185.199.108.153` (GitHub Pages)';
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. Configure apex A records:',
    '   - `185.199.108.153` (GitHub Pages)',
    '   - `185.199.109.153`',
    '2. Save the custom domain.',
    ''
  ].join('\n'));
});

run('generated ordered numbers ignore nested bullet items', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. Parent',
    '   - Child',
    '2. Sibling',
    ''
  ].join('\n'));
  listBlock.dirty = true;
  delete listBlock.data.items[0].number;
  delete listBlock.data.items[2].number;
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. Parent',
    '   - Child',
    '2. Sibling',
    ''
  ].join('\n'));
});

run('generated nested ordered numbers restart under each parent', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. A',
    '   - A1',
    '2. B',
    '   - B1',
    ''
  ].join('\n'));
  listBlock.dirty = true;
  listBlock.data.items[1].listType = 'ol';
  listBlock.data.items[3].listType = 'ol';
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. A',
    '   1. A1',
    '2. B',
    '   1. B1',
    ''
  ].join('\n'));
});

run('visual nested ordered markers restart under each parent', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. A',
    '   - A1',
    '2. B',
    '   - B1',
    ''
  ].join('\n'));
  listBlock.data.items[1].listType = 'ol';
  listBlock.data.items[3].listType = 'ol';
  assert.deepEqual(listVisualMarkerLabels(listBlock.data.items, listBlock.data.listType), [
    '1.',
    '1.',
    '2.',
    '1.'
  ]);
});

run('standard list type changes apply to homogeneous indentation levels', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. Parent',
    '   - First child',
    '   - Second child',
    '2. Sibling',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 1, 'ol', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.equal(listBlock.data.listType, 'ol');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['ol', 'ol', 'ol', 'ol']);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. Parent',
    '   1. First child',
    '   2. Second child',
    '2. Sibling',
    ''
  ].join('\n'));
});

run('standard list type changes apply to the active sibling group only', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. DNS records',
    '   - 185.199.108.153',
    '   - 185.199.109.153',
    '   - 185.199.110.153',
    '   - 185.199.111.153',
    '2. Pages settings',
    '   1. Custom domain',
    '   2. Save',
    '3. Verification',
    '   - Wait',
    '   - Check DNS',
    '   - Open site',
    '4. Done',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 1, 'ol', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.deepEqual(listBlock.data.items.map(item => item.listType), [
    'ol',
    'ol', 'ol', 'ol', 'ol',
    'ol',
    'ol', 'ol',
    'ol',
    'ul', 'ul', 'ul',
    'ol'
  ]);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. DNS records',
    '   1. 185.199.108.153',
    '   2. 185.199.109.153',
    '   3. 185.199.110.153',
    '   4. 185.199.111.153',
    '2. Pages settings',
    '   1. Custom domain',
    '   2. Save',
    '3. Verification',
    '   - Wait',
    '   - Check DNS',
    '   - Open site',
    '4. Done',
    ''
  ].join('\n'));
});

run('sibling-group type changes skip deeper child items', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. Parent',
    '   - Alpha',
    '      - Alpha child',
    '   - Beta',
    '      - Beta child',
    '2. Sibling',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 1, 'ol', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['ol', 'ol', 'ul', 'ol', 'ul', 'ol']);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. Parent',
    '   1. Alpha',
    '      - Alpha child',
    '   2. Beta',
    '      - Beta child',
    '2. Sibling',
    ''
  ].join('\n'));
});

run('standard list type changes stay item-local on mixed indentation levels', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. Alpha',
    '- Beta',
    '2. Gamma',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 0, 'ul', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.equal(listBlock.data.listType, 'mixed');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['ul', 'ul', 'ol']);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '- Alpha',
    '- Beta',
    '2. Gamma',
    ''
  ].join('\n'));
});

run('checklist type changes apply to homogeneous indentation levels', () => {
  const [listBlock] = parseMarkdownBlocks([
    '1. Parent',
    '   - First child',
    '   - Second child',
    '2. Sibling',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 1, 'task', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.equal(listBlock.data.listType, 'mixed');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['ol', 'task', 'task', 'ol']);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '1. Parent',
    '   - [ ] First child',
    '   - [ ] Second child',
    '2. Sibling',
    ''
  ].join('\n'));
});

run('checklist levels convert back without changing the whole block', () => {
  const [listBlock] = parseMarkdownBlocks([
    '- [ ] Parent',
    '  - [x] Child',
    '- [ ] Sibling',
    ''
  ].join('\n'));
  const patch = patchListItemType(listBlock.data.items, 1, 'ul', listBlock.data.listType);
  listBlock.dirty = true;
  Object.assign(listBlock.data, patch);
  assert.equal(listBlock.data.listType, 'mixed');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['task', 'ul', 'task']);
  assert.equal(serializeMarkdownBlocks([listBlock]), [
    '- [ ] Parent',
    '  - Child',
    '- [ ] Sibling',
    ''
  ].join('\n'));
});

run('mixed checklist and standard lists become editable visual lists', () => {
  const source = [
    '- [ ] Checklist item',
    '- Standard item',
    ''
  ].join('\n');
  const [listBlock] = parseMarkdownBlocks(source);
  assert.equal(listBlock.type, 'list');
  assert.equal(listBlock.data.listType, 'mixed');
  assert.deepEqual(listBlock.data.items.map(item => item.listType), ['task', 'ul']);
  assert.equal(serializeMarkdownBlocks([listBlock]), source);
});

run('uniformly indented mixed lists keep the mixed-list fallback reason', () => {
  const source = [
    '   1. Configure apex A records:',
    '      - `185.199.108.153`',
    '      - `185.199.109.153`',
    '   2. Save the custom domain.',
    ''
  ].join('\n');
  const [sourceBlock] = parseMarkdownBlocks(source);
  assert.equal(sourceBlock.type, 'source');
  assert.equal(sourceBlock.data.sourceReason, 'mixedList');
  assert.deepEqual(autofixMarkdownSourceBlock(sourceBlock), []);
  assert.equal(serializeMarkdownBlocks([sourceBlock]), source);
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

run('empty list item Enter split helper removes the empty item and preserves surrounding metadata', () => {
  const initial = [
    { text: 'Before', checked: false, indent: 0, listType: 'ol', delimiter: ')' },
    { text: '   ', checked: true, indent: 0, listType: 'task', indentText: '' },
    { text: 'After', checked: true, indent: 1, listType: 'task', indentText: '  ' }
  ];
  const split = splitListItemsAtEmptyItem(initial, 1);
  assert.deepEqual(split.before, [initial[0]]);
  assert.deepEqual(split.after, [initial[2]]);
});

run('empty list item Enter helper outdents nested empty items before split or exit', () => {
  const initial = [
    { text: 'Parent', checked: false, indent: 0, listType: 'ul' },
    { text: '   ', checked: true, indent: 2, listType: 'task', indentText: '    ', marker: '-', delimiter: ')' },
    { text: 'Child', checked: false, indent: 2, listType: 'ol', indentText: '    ' }
  ];
  const next = outdentEmptyListItemForEnter(initial, 1);
  assert.deepEqual(next[1], {
    text: '',
    checked: true,
    indent: 1,
    listType: 'task',
    indentText: '  ',
    marker: '-',
    delimiter: ')'
  });
  assert.equal(splitListItemsAtEmptyItem(next, 1), null);
});

run('empty list item Enter split helper distinguishes trailing exit, unique blank, nested blank, and non-empty items', () => {
  assert.deepEqual(splitListItemsAtEmptyItem([{ text: 'Before' }, { text: '' }], 1), {
    before: [{ text: 'Before' }],
    after: []
  });
  assert.deepEqual(splitListItemsAtEmptyItem([{ text: '' }], 0), {
    before: [],
    after: []
  });
  assert.equal(splitListItemsAtEmptyItem([{ text: '', indent: 1 }], 0), null);
  assert.equal(splitListItemsAtEmptyItem([{ text: 'Not empty' }], 0), null);
  assert.equal(splitListItemsAtEmptyItem([{ text: '' }], 1), null);
});

run('double Enter at list tail converts the current item into a paragraph', () => {
  assert.deepEqual(convertListTailItemAfterEmptyToParagraph([
    { text: 'Before', indent: 0 },
    { text: '', indent: 0 },
    { text: 'Tail **item**', indent: 0, listType: 'task', checked: true }
  ], 2), {
    before: [{ text: 'Before', indent: 0 }],
    text: 'Tail **item**'
  });
  assert.deepEqual(convertListTailItemAfterEmptyToParagraph([
    { text: '', indent: 0 },
    { text: 'Only tail', indent: 0 }
  ], 1), {
    before: [],
    text: 'Only tail'
  });
  assert.equal(convertListTailItemAfterEmptyToParagraph([
    { text: '', indent: 0 },
    { text: 'First after', indent: 0 },
    { text: 'Second after', indent: 0 }
  ], 1), null);
  assert.equal(convertListTailItemAfterEmptyToParagraph([
    { text: '', indent: 0 },
    { text: 'Nested tail', indent: 1 }
  ], 1), null);
  assert.equal(convertListTailItemAfterEmptyToParagraph([
    { text: '', indent: 1 },
    { text: 'Tail', indent: 0 }
  ], 1), null);
  assert.equal(convertListTailItemAfterEmptyToParagraph([
    { text: 'Not empty', indent: 0 },
    { text: 'Tail', indent: 0 }
  ], 1), null);
  assert.equal(convertListTailItemAfterEmptyToParagraph([
    { text: '', indent: 0 },
    { text: '', indent: 0 }
  ], 1), null);
});

run('empty list item Enter promotes split list starts to root level', () => {
  const promoted = normalizeSplitListStartItems([
    { text: 'Nested start', indent: 2, indentText: '    ', listType: 'ol' },
    { text: 'Nested child', indent: 3, indentText: '      ', listType: 'task', checked: true }
  ]);
  assert.deepEqual(promoted, [
    { text: 'Nested start', indent: 0, indentText: '', listType: 'ol' },
    { text: 'Nested child', indent: 1, indentText: '  ', listType: 'task', checked: true }
  ]);
  assert.deepEqual(normalizeSplitListStartItems([{ text: 'Root', indent: 0 }]), [{ text: 'Root', indent: 0 }]);
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
