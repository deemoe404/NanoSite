import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const composerPath = resolve(here, '../assets/js/composer.js');
const hiEditorPath = resolve(here, '../assets/js/hieditor.js');
const editorMainPath = resolve(here, '../assets/js/editor-main.js');
const editorBlocksPath = resolve(here, '../assets/js/editor-blocks.js');
const syntaxHighlightPath = resolve(here, '../assets/js/syntax-highlight.js');
const editorPath = resolve(here, '../index_editor.html');
const nativeThemePath = resolve(here, '../assets/themes/native/theme.css');
const enI18nPath = resolve(here, '../assets/i18n/en.js');
const chsI18nPath = resolve(here, '../assets/i18n/chs.js');
const chtTwI18nPath = resolve(here, '../assets/i18n/cht-tw.js');
const chtHkI18nPath = resolve(here, '../assets/i18n/cht-hk.js');
const jaI18nPath = resolve(here, '../assets/i18n/ja.js');
const languagesManifestPath = resolve(here, '../assets/i18n/languages.json');
const i18nPath = resolve(here, '../assets/js/i18n.js');
const source = readFileSync(composerPath, 'utf8');
const hiEditorSource = readFileSync(hiEditorPath, 'utf8');
const editorMainSource = readFileSync(editorMainPath, 'utf8');
const editorBlocksSource = readFileSync(editorBlocksPath, 'utf8');
const syntaxHighlightSource = readFileSync(syntaxHighlightPath, 'utf8');
const editorSource = readFileSync(editorPath, 'utf8');
const nativeThemeSource = readFileSync(nativeThemePath, 'utf8');
const i18nSource = readFileSync(i18nPath, 'utf8');
const enI18nSource = readFileSync(enI18nPath, 'utf8');
const chsI18nSource = readFileSync(chsI18nPath, 'utf8');
const chtTwI18nSource = readFileSync(chtTwI18nPath, 'utf8');
const chtHkI18nSource = readFileSync(chtHkI18nPath, 'utf8');
const jaI18nSource = readFileSync(jaI18nPath, 'utf8');
const languagesManifestSource = readFileSync(languagesManifestPath, 'utf8');

function extractFunctionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const open = text.indexOf('{', start);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  assert.fail(`${name} body should be balanced`);
}

assert.match(
  editorSource,
  /\.view-toggle \.vt-btn \.vt-dirty-badge\{position:absolute;top:-\.45rem;right:0;min-width:1\.15rem;height:1\.15rem[\s\S]*transform:translateX\(50%\) scale\(\.72\)/,
  'composer file switch dirty indicators should render as right-edge centered numeric badges'
);

assert.doesNotMatch(
  editorSource,
  /\.view-toggle \.vt-btn\.has-draft::before/,
  'composer file switch dirty indicators should not render as inline orange dots'
);

assert.match(
  editorSource,
  /class="vt-btn active" data-view="edit"[\s\S]*class="vt-btn" data-view="blocks"[\s\S]*class="vt-btn" data-view="preview"[\s\S]*id="blocks-wrap" hidden aria-hidden="true"/,
  'markdown editor should expose Edit, Blocks, and Preview views with a dedicated blocks surface'
);

assert.match(
  editorMainSource,
  /function switchView\(mode\) \{[\s\S]*const blocksWrap = \$\('#blocks-wrap'\);[\s\S]*mode === 'blocks'[\s\S]*blocksWrap\.hidden = false;[\s\S]*editorToolbar\.hidden = true;[\s\S]*viewToggle && \(viewToggle\.dataset\.view = 'blocks'\);/,
  'markdown view switcher should show blocks mode while hiding source toolbar and preview'
);

assert.match(
  editorMainSource,
  /const LS_VIEW_KEY = 'ns_editor_markdown_view';[\s\S]*function readPersistedMarkdownEditorView\(\) \{[\s\S]*localStorage\.getItem\(LS_VIEW_KEY\)[\s\S]*function persistMarkdownEditorView\(mode\) \{[\s\S]*localStorage\.setItem\(LS_VIEW_KEY, normalizeMarkdownEditorView\(mode\)\);/,
  'markdown editor should persist the selected source/blocks/preview view'
);

assert.match(
  editorMainSource,
  /const applyMarkdownEditorView = \(mode, opts = \{\}\) => \{[\s\S]*const nextView = normalizeMarkdownEditorView\(mode\);[\s\S]*switchView\(nextView\);[\s\S]*if \(opts\.persist\) persistMarkdownEditorView\(nextView\);[\s\S]*applyMarkdownEditorView\(a\.dataset\.view, \{ persist: true \}\);/,
  'markdown view switcher clicks should store the selected view'
);

assert.match(
  editorMainSource,
  /setView: \(mode, opts = \{\}\) => applyMarkdownEditorView\(mode, opts\),[\s\S]*restorePersistedView: \(opts = \{\}\) => applyMarkdownEditorView\(readPersistedMarkdownEditorView\(\), opts\),/,
  'primary editor API should accept blocks mode'
);

assert.match(
  source,
  /function restorePrimaryEditorMarkdownView\(editorApi\) \{[\s\S]*typeof editorApi\.restorePersistedView === 'function'[\s\S]*editorApi\.restorePersistedView\(\);[\s\S]*editorApi\.setView\('edit'\);[\s\S]*restorePrimaryEditorMarkdownView\(editorApi\);/,
  'composer should restore the persisted markdown editor view when opening markdown files'
);

assert.match(
  editorBlocksSource,
  /export function parseMarkdownBlocks\(markdown\)[\s\S]*export function serializeMarkdownBlocks\(blocks\)[\s\S]*export function createMarkdownBlocksEditor\(root, options = \{\}\)/,
  'blocks mode should provide parser, serializer, and DOM controller entrypoints'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-toolbar|text\('uploadImage', 'Upload Image'\)|requestImageUpload\(\{ index: state\.activeIndex \+ 1 \}\)/,
  'blocks mode should not render the old top block toolbar or visible upload-image insertion button'
);

assert.match(
  editorBlocksSource,
  /const ensureEditableBlankForEmptyDocument = \(\) => \{[\s\S]*if \(state\.blocks\.length\) return null;[\s\S]*Empty documents still need one real blank block[\s\S]*non-empty documents rely on Enter at the end instead[\s\S]*state\.blocks\.push\(block\);[\s\S]*setMarkdown\(markdown\) \{[\s\S]*state\.blocks = parseMarkdownBlocks\(markdown\);[\s\S]*ensureEditableBlankForEmptyDocument\(\);/,
  'blocks mode should materialize a real blank block only for empty documents'
);

assert.match(
  editorBlocksSource,
  /const placeCommandBlock = \(type, data = \{\}, index = state\.blocks\.length\) => \{[\s\S]*state\.blocks\[safeIndex\]\.type === 'blank'[\s\S]*state\.blocks\.splice\(safeIndex, 1, block\);[\s\S]*const block = placeCommandBlock\(type, data, insertIndex\);[\s\S]*placeCommandBlock\('card',[\s\S]*const openArticleCardCommand = \(\) => \{[\s\S]*const insertIndex = Number\.isInteger\(state\.commandMenuInsertIndex\) \? state\.commandMenuInsertIndex : state\.blocks\.length;[\s\S]*state\.cardPickerInsertIndex = insertIndex;/,
  'blank block commands should replace the active blank block and reuse the article-card picker at that position'
);

assert.match(
  editorBlocksSource,
  /function isEditableSelectionOnBlankLine\(el\) \{[\s\S]*const offsets = getEditableSelectionOffsets\(el\);[\s\S]*!offsets\.collapsed[\s\S]*if \(text\.slice\(lineStart, lineEnd\)\.trim\(\) === ''\) return true;[\s\S]*const caretRect = caretRectForEditable\(el\);[\s\S]*createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)[\s\S]*range\.selectNodeContents\(node\);[\s\S]*const hasTextOnCaretLine = rects\.some[\s\S]*if \(hasTextOnCaretLine\)[\s\S]*return true;/,
  'rich text blocks should detect empty visual lines even when DOM line breaks are not counted by Range.toString offsets'
);

assert.match(
  editorBlocksSource,
  /function shouldInsertBlankBlockOnEnter\(el\) \{[\s\S]*const offsets = getEditableSelectionOffsets\(el\);[\s\S]*!offsets\.collapsed[\s\S]*const text = editableVisibleText\(el\);[\s\S]*if \(offsets\.start >= text\.length\) return true;[\s\S]*return isEditableSelectionOnBlankLine\(el\);/,
  'plain Enter at the end of a rich text block should insert a real blank block without first creating an empty line'
);

assert.match(
  editorBlocksSource,
  /commandMenuInsertIndex: null,[\s\S]*const insertBlankBlockAfter = \(index, editable = null, sync = null\) => \{[\s\S]*if \(typeof sync === 'function'\) sync\(\);[\s\S]*insertBlankBlock\(Math\.max\(0, Math\.min\(\(Number\(index\) \|\| 0\) \+ 1, state\.blocks\.length\)\), \{ focus: true \}\);/,
  'Enter should create a focused real blank block after the current block'
);

assert.match(
  editorBlocksSource,
  /editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key !== 'Enter'[\s\S]*!\['paragraph', 'quote', 'heading'\]\.includes\(block\.type\)[\s\S]*!shouldInsertBlankBlockOnEnter\(editable\)[\s\S]*event\.preventDefault\(\);[\s\S]*insertBlankBlockAfter\(index, editable, sync\);/,
  'paragraph, quote, and heading Enter handling should exit the block when Enter would create a new empty line'
);

assert.match(
  editorBlocksSource,
  /state\.blocks\.forEach\(\(block, index\) => \{[\s\S]*list\.appendChild\(renderBlockElement\(block, index\)\);[\s\S]*\}\);[\s\S]*renderCardPicker\(\);/,
  'rendering should use real blank blocks for persistent insertion points without appending a terminal virtual block'
);

assert.match(
  editorBlocksSource,
  /export function isBlockEmptyForBackspace\(block\) \{[\s\S]*block\.type === 'blank'[\s\S]*block\.type === 'paragraph'[\s\S]*block\.type === 'heading'[\s\S]*block\.type === 'quote'[\s\S]*block\.type === 'code'[\s\S]*block\.type === 'source'[\s\S]*block\.type === 'image'[\s\S]*block\.type === 'card'[\s\S]*block\.type === 'list'[\s\S]*editableListItems\(data\.items\)\.every\(item => blank\(item && item\.text\) && !item\.checked\);/,
  'empty block backspace detection should cover blank, text, media, card, and list user-authored content'
);

assert.match(
  editorBlocksSource,
  /const focusPreviousBlockEnd = \(index\) => \{[\s\S]*const targetIndex = Math\.max\(0, Math\.min\(\(Number\(index\) \|\| 0\) - 1, state\.blocks\.length - 1\)\);[\s\S]*focusBlockPrimaryEditable\(target\);[\s\S]*const removeEmptyBlockWithBackspace = \(event, block, index, editable = null, sync = null\) => \{[\s\S]*event\.key !== 'Backspace'[\s\S]*index <= 0[\s\S]*isEditableBackspaceAtEmptyStart\(editable\)[\s\S]*isBlockEmptyForBackspace\(block\)[\s\S]*state\.blocks\.splice\(index, 1\);[\s\S]*render\(\);[\s\S]*focusPreviousBlockEnd\(index\);[\s\S]*emit\(\);/,
  'Backspace should remove empty non-first real blocks and move focus to the previous block end'
);

assert.doesNotMatch(
  editorBlocksSource,
  /renderVirtualBlock|handleTerminalVirtualBackspace|focusTerminalVirtualEditable|ensureTrailingBlankBlock/,
  'terminal virtual block and forced trailing blank runtime should be removed'
);

assert.match(
  editorBlocksSource,
  /createRichEditable[\s\S]*editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, editable, sync\)[\s\S]*event\.key !== 'Enter'[\s\S]*span\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, span, sync\)[\s\S]*event\.key === 'Tab'[\s\S]*code\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, code, sync\)[\s\S]*event\.key !== 'Enter'[\s\S]*area\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, area, sync\)\) return;/,
  'empty Backspace handling should run before rich Enter, list row, code Enter, and source textarea handling'
);

assert.match(
  editorMainSource,
  /const blockLabels = new Proxy\(\{\}, \{[\s\S]*const translationKey = `editor\.blocks\.\$\{name\}`;[\s\S]*const translated = t\(translationKey\);[\s\S]*translated !== translationKey \? translated : \(blockLabelFallbacks\[name\] \|\| name\);/,
  'block labels should use local fallbacks when i18n returns the key for a missing translation'
);

assert.match(
  editorMainSource,
  /linkTitle: 'Link title'/,
  'block link title field should have a local fallback label'
);

assert.match(
  editorMainSource,
  /replaceImage: 'Replace image'/,
  'block replace image button should have a local fallback label'
);

[
  [enI18nSource, /linkTitle: 'Link title'/],
  [chsI18nSource, /linkTitle: '链接标题'/],
  [chtTwI18nSource, /linkTitle: '連結標題'/],
  [jaI18nSource, /linkTitle: 'リンクタイトル'/]
].forEach(([sourceText, pattern]) => {
  assert.match(sourceText, pattern, 'block link title field should have localized labels');
});

assert.match(
  editorBlocksSource,
  /const inlineControls = \[[\s\S]*\['B', 'bold', 'inlineBold', 'Bold'\],[\s\S]*\['I', 'italic', 'inlineItalic', 'Italic'\],[\s\S]*\['Link', 'link', 'inlineLink', 'Link'\][\s\S]*const inlineMoreControls = \[[\s\S]*\['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'\],[\s\S]*\['`', 'code', 'inlineCode', 'Inline code'\]/,
  'blocks mode should keep B/I/Link direct while moving strike and inline code into overflow formatting controls'
);

assert.match(
  editorBlocksSource,
  /const createInlineCommandButton = \(label, command, key, fallback, index, className = 'blocks-inline-btn'\) => \{[\s\S]*btn\.dataset\.inlineCommand = command[\s\S]*btn\.setAttribute\('aria-pressed', 'false'\)[\s\S]*event\.preventDefault\(\)[\s\S]*if \(btn\.getAttribute\('aria-disabled'\) === 'true'\) return;[\s\S]*applyInlineCommand\(command\)/,
  'direct and overflow inline formatting commands should share the same command button path'
);

assert.match(
  editorBlocksSource,
  /const createInlineMoreMenu = \(index\) => \{[\s\S]*wrap\.className = 'blocks-inline-more';[\s\S]*const trigger = button\('Aa', 'blocks-inline-btn blocks-inline-more-trigger'\);[\s\S]*trigger\.setAttribute\('aria-haspopup', 'menu'\);[\s\S]*menu\.className = 'blocks-inline-more-menu';[\s\S]*inlineMoreControls\.forEach\(\(\[_label, command, key, fallback\]\) => \{[\s\S]*createInlineCommandButton\(text\(key, fallback\), command, key, fallback, index, 'blocks-inline-menu-item'\);[\s\S]*item\.setAttribute\('role', 'menuitem'\);[\s\S]*controls\.appendChild\(createInlineMoreMenu\(index\)\);/,
  'inline strike and code controls should show text labels in a menu immediately after the direct Link button'
);

assert.match(
  editorBlocksSource,
  /const createListIndentControls = \(block, index\) => \{[\s\S]*controls\.className = 'blocks-list-indent-controls'[\s\S]*\['←', -1, 'listOutdent'[\s\S]*\['→', 1, 'listIndent'[\s\S]*indentListItem\(block, index, delta\)[\s\S]*if \(block\.type === 'list'\) \{[\s\S]*head\.appendChild\(createListIndentControls\(block, index\)\);/,
  'list blocks should expose outdent and indent buttons in the floating toolbar'
);

assert.match(
  editorBlocksSource,
  /const indentListItem = \(block, index, delta\) => \{[\s\S]*activeListItemIndex\(block, index\)[\s\S]*indent: nextIndent,[\s\S]*indentText: '  '\.repeat\(nextIndent\)[\s\S]*state\.pendingListFocus = \{ blockId: block\.id, itemIndex, atEnd: false \};[\s\S]*if \(event\.key === 'Tab'[\s\S]*indentListItem\(block, index, event\.shiftKey \? -1 : 1\);/,
  'Tab and toolbar list indentation should share the same item indentation path'
);

assert.match(
  editorBlocksSource,
  /function inlineRangeAnyMarked\(runs, start, end, mark\)[\s\S]*next > safeStart && cursor < safeEnd && !!run\[mark\][\s\S]*const shouldApply = command === 'code'[\s\S]*inlineRangeAnyMarked\(runs, start, end, command\)[\s\S]*inlineRangeAnyMarked\(runs, offsets\.start, offsets\.end, mark\)/,
  'B/I/S inline formatting should treat mixed selected ranges as active when any selected text has the mark'
);

assert.match(
  editorBlocksSource,
  /function inlineMarksAtOffset\(runs, offset\)[\s\S]*let previous = null;[\s\S]*target === cursor \|\| \(target > cursor && target < next\)[\s\S]*if \(target === next\) previous = run;[\s\S]*previous \|\| safeRuns\[safeRuns\.length - 1\]/,
  'collapsed caret inline formatting should prefer the right-hand run at mark boundaries and only fall back to the previous run at the end'
);

assert.match(
  editorBlocksSource,
  /function selectionEditableInRoot\(root\)[\s\S]*closestElement\(candidate, '\.blocks-rich-editable'\)[\s\S]*const editableSyncMap = new WeakMap\(\);[\s\S]*state\.activeEditable = selectionEditable;[\s\S]*state\.activeSync = editableSyncMap\.get\(selectionEditable\) \|\| state\.activeSync;[\s\S]*editableSyncMap\.set\(editable, sync\);[\s\S]*editableSyncMap\.set\(span, sync\);/,
  'inline toolbar state should recover the active rich editable directly from the browser selection'
);

assert.match(
  editorBlocksSource,
  /suppressSelectionActiveRecoveryUntil: 0,[\s\S]*const activateEditableFromPointer = \(index, editable, sync\) => \{[\s\S]*state\.suppressSelectionActiveRecoveryUntil = Date\.now\(\) \+ 180;[\s\S]*setActive\(index, editable, sync\);[\s\S]*const canRecoverSelectionActive = !state\.suppressSelectionActiveRecoveryUntil \|\| Date\.now\(\) > state\.suppressSelectionActiveRecoveryUntil;[\s\S]*if \(selectionEditable && canRecoverSelectionActive\) \{/,
  'pointerdown activation should briefly prevent stale browser selection from reselecting the previous block toolbar'
);

assert.match(
  editorBlocksSource,
  /const activateNonTextBlockFromPointer = \(index, blockEl = null\) => \{[\s\S]*state\.suppressSelectionActiveRecoveryUntil = Date\.now\(\) \+ 180;[\s\S]*state\.suppressNextBlockContainerClickUntil = Date\.now\(\) \+ 500;[\s\S]*clearNativeSelection\(\);[\s\S]*setActive\(index\);[\s\S]*\};/,
  'non-text block pointer activation should clear stale browser selection before selecting the block'
);

assert.match(
  editorBlocksSource,
  /function inlineMarksFromDomNode\(node, editable\)[\s\S]*tag === 'strong' \|\| tag === 'b'[\s\S]*function inlineMarksFromPointerEvent\(event, editable\)[\s\S]*document\.caretPositionFromPoint[\s\S]*document\.caretRangeFromPoint[\s\S]*lastInlineMarks: null,[\s\S]*fallbackMarks && fallbackMarks\[mark\]/,
  'inline toolbar state should fall back to marks from the clicked rich-text DOM path when selection offsets are unavailable or ambiguous'
);

assert.match(
  editorBlocksSource,
  /setActive\(index, editable, sync\);[\s\S]*const pointerMarks = inlineMarksFromPointerEvent\(event, editable\);[\s\S]*state\.lastInlineMarks = \{ editable, marks: pointerMarks \};[\s\S]*state\.lastInlineMarkedRange = pointerCodeRange \? \{ editable, mark: 'code', \.\.\.pointerCodeRange \} : null;[\s\S]*updateInlineToolbarState\(\);[\s\S]*setActive\(index, span, sync\);[\s\S]*const pointerMarks = inlineMarksFromPointerEvent\(event, span\);[\s\S]*state\.lastInlineMarks = \{ editable: span, marks: pointerMarks \};[\s\S]*state\.lastInlineMarkedRange = pointerCodeRange \? \{ editable: span, mark: 'code', \.\.\.pointerCodeRange \} : null;[\s\S]*updateInlineToolbarState\(\);/,
  'paragraph and list rich-text clicks should capture inline marks after activation and refresh the toolbar'
);

assert.match(
  editorBlocksSource,
  /editable\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, editable, sync\);[\s\S]*routeDirectQuoteCaretFromPointer\(editable, index, sync, event\);[\s\S]*span\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, span, sync\);[\s\S]*code\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, code, sync\);[\s\S]*area\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, area, sync\);/,
  'editable block pointerdowns should activate the target block before browser focus/click events can paint a stale toolbar'
);

assert.match(
  editorBlocksSource,
  /if \(\(!offsets \|\| offsets\.collapsed\) && codeRange\) \{[\s\S]*state\.pendingInline = \{\};[\s\S]*state\.lastInlineMarks = null;[\s\S]*state\.lastInlineMarkedRange = null;[\s\S]*removeInlineMarkInRange/,
  'removing remembered inline code should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksSource,
  /if \(mark === 'code' && inlineMarksAtOffset\(runs, offsets\.start\)\.code\) \{[\s\S]*state\.pendingInline = \{\};[\s\S]*state\.lastInlineMarks = null;[\s\S]*state\.lastInlineMarkedRange = null;[\s\S]*removeInlineMarkAroundOffset/,
  'removing inline code at a collapsed caret should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksSource,
  /const hasPendingInlineMarks = \(\) => !!\(state\.pendingInline\.bold[\s\S]*state\.pendingInline\.strike[\s\S]*state\.pendingInline\.link\);[\s\S]*const togglePendingInlineMark = \(kind\) => \{[\s\S]*if \(mark === 'code'\) return;[\s\S]*if \(mark === 'code'\) return;[\s\S]*togglePendingInlineMark\(kind\);/,
  'inline code should not be stored as pending formatting for future text input'
);

assert.match(
  editorBlocksSource,
  /const rememberedCodeRange = state\.lastInlineMarkedRange[\s\S]*mark === 'code'[\s\S]*else if \(mark === 'code'\) \{[\s\S]*if \(offsets && offsets\.collapsed\) \{[\s\S]*active = !!\(marks\.code \|\| \(fallbackMarks && fallbackMarks\.code\)\);[\s\S]*disabled = !active;[\s\S]*disabled = !rangeHasInlineText\(runs, offsets\.start, offsets\.end\);[\s\S]*btn\.classList\.toggle\('is-disabled', disabled\);[\s\S]*btn\.disabled = false;[\s\S]*btn\.tabIndex = disabled \? -1 : 0;/,
  'inline code toolbar button should be aria-disabled for plain collapsed carets without using native disabled'
);

assert.match(
  editorSource,
  /\.blocks-inline-btn\[aria-disabled="true"\] \{ opacity:\.45; cursor:not-allowed; \}[\s\S]*\.blocks-inline-btn\[aria-disabled="true"\]:hover/,
  'aria-disabled inline buttons should keep a disabled visual affordance without stealing editor focus'
);

assert.match(
  editorBlocksSource,
  /const blockNodes = Array\.from\(list\.querySelectorAll\('\.blocks-block'\)\);[\s\S]*const activeBlock = blockNodes\[state\.activeIndex\] \|\| null;[\s\S]*if \(!activeBlock \|\| !activeBlock\.contains\(btn\)\) \{[\s\S]*btn\.classList\.remove\('is-active'\);[\s\S]*btn\.setAttribute\('aria-pressed', 'false'\);/,
  'hidden non-active block toolbars should not retain inline formatting active state'
);

assert.match(
  editorBlocksSource,
  /const blockNodes = Array\.from\(list\.querySelectorAll\('\.blocks-block'\)\);[\s\S]*const activeBlock = blockNodes\[state\.activeIndex\] \|\| null;[\s\S]*const keepEditable = state\.activeEditable && activeBlock && nodeContains\(activeBlock, state\.activeEditable\);[\s\S]*state\.activeEditable = null;[\s\S]*state\.activeSync = null;[\s\S]*state\.pendingInline = \{\};[\s\S]*blockNodes\.forEach\(\(el, idx\) => \{/,
  'container-only block selection should clear stale editable state from another block'
);

assert.match(
  editorBlocksSource,
  /const editorViewportBottom = \(\) => \{[\s\S]*document\.getElementById\('editorContentPane'\)[\s\S]*const updateStickyBlockHead = \(\) => \{[\s\S]*const activeBlock = blockNodes\[state\.activeIndex\] \|\| null;[\s\S]*editorStickyToolbarBottom\(\) \+ gap[\s\S]*const blockTopUnderStickyToolbar = blockRect\.top < stickyTop;[\s\S]*if \(blockTopUnderStickyToolbar\) \{[\s\S]*blockRect\.bottom \+ gap \+ headHeight <= stickyTop[\s\S]*head\.classList\.add\('is-bottom-docked'\);[\s\S]*head\.style\.top = `\$\{Math\.max\(0, blockRect\.height \+ gap\)\}px`;[\s\S]*return;[\s\S]*\}[\s\S]*head\.classList\.add\('is-stuck'\);[\s\S]*head\.style\.top = `\$\{top\}px`;/,
  'active block toolbar should become a non-sticky bottom-docked overlay once the block top is covered'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-active \.blocks-block-head\.is-bottom-docked \{ position:absolute; z-index:105; transform:none; transition:none; \}/,
  'bottom-docked active block toolbar should scroll with the block instead of sticking to the viewport'
);

assert.match(
  editorBlocksSource,
  /window\.addEventListener\('scroll', requestStickyBlockHeadUpdate, true\);[\s\S]*window\.addEventListener\('resize', requestStickyBlockHeadUpdate\);/,
  'active block toolbar sticky position should refresh on editor pane scroll and viewport resize'
);

assert.match(
  editorBlocksSource,
  /const findVerticalScrollParent = \(node\) => \{[\s\S]*document\.getElementById\('editorContentPane'\)[\s\S]*const forwardBlockHeadWheel = \(event\) => \{[\s\S]*absX > absY[\s\S]*scrollParent\.scrollTop = before \+ deltaY;[\s\S]*event\.preventDefault\(\);[\s\S]*head\.addEventListener\('wheel', forwardBlockHeadWheel, \{ passive: false \}\);/,
  'active block toolbar should forward vertical wheel gestures to the editor content scroll pane'
);

assert.match(
  editorBlocksSource,
  /item\.addEventListener\('click', \(event\) => \{[\s\S]*shouldSuppressRoutedBlockContainerClick\(\)[\s\S]*closestElement\(event\.target, '\.blocks-block-head'\)[\s\S]*setActive\(index\);[\s\S]*\}\);[\s\S]*item\.addEventListener\('focusin', \(\) => setActive\(index\)\);/,
  'block section container clicks should select the block without hijacking toolbar action clicks or routed carets'
);

assert.match(
  editorBlocksSource,
  /reorderAnimating: false/,
  'block move animation should guard against overlapping reorder operations'
);

assert.match(
  editorBlocksSource,
  /function finishBlockReorder\(\) \{[\s\S]*state\.reorderAnimating = false;[\s\S]*requestStickyBlockHeadUpdate\(\);[\s\S]*\}/,
  'block move animation should relayout the floating toolbar after the shared block transform finishes'
);

assert.match(
  editorBlocksSource,
  /const updateStickyBlockHead = \(\) => \{[\s\S]*clearStickyBlockHeads\(head\);[\s\S]*if \(state\.reorderAnimating\) \{[\s\S]*clearStickyBlockHeads\(\);[\s\S]*return;[\s\S]*\}/,
  'active block toolbar should stay inside the moving block while reorder animation is active'
);

assert.match(
  editorBlocksSource,
  /const captureBlockRects = \(indexes = null\) => \{[\s\S]*const allowed = Array\.isArray\(indexes\) \? new Set\(indexes\) : null;[\s\S]*if \(allowed && !allowed\.has\(index\)\) return;[\s\S]*const id = el\.dataset \? el\.dataset\.blockId : '';[\s\S]*rects\.set\(id, el\.getBoundingClientRect\(\)\);[\s\S]*return rects;/,
  'block move animation should key before-rect snapshots by stable block ids for only the affected indexes'
);

assert.match(
  editorBlocksSource,
  /const animateBlockReorder = \(beforeRects\) => \{[\s\S]*const before = id \? beforeRects\.get\(id\) : null;[\s\S]*const after = el\.getBoundingClientRect\(\);[\s\S]*const dx = before\.left - after\.left;[\s\S]*const dy = before\.top - after\.top;[\s\S]*item\.el\.style\.transition = 'none';[\s\S]*item\.el\.style\.transform = `translate3d\(\$\{item\.dx\}px, \$\{item\.dy\}px, 0\)`;[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*item\.el\.style\.transition = '';[\s\S]*item\.el\.style\.transform = 'translate3d\(0, 0, 0\)';[\s\S]*window\.setTimeout\(finish, 360\)/,
  'block move animation should FLIP the final rendered DOM from old coordinates back to zero transform'
);

assert.match(
  editorBlocksSource,
  /const moveBlock = \(index, direction\) => \{[\s\S]*prefersReducedReorderMotion\(\)[\s\S]*const beforeRects = captureBlockRects\(\[index, targetIndex\]\);[\s\S]*state\.reorderAnimating = true;[\s\S]*const moved = moveBlockInState\(index, direction\);[\s\S]*replaceAdjacentBlockElements\(index, targetIndex\)[\s\S]*emit\(\);[\s\S]*animateBlockReorder\(beforeRects\);/,
  'block move should update state and replace only the adjacent affected DOM nodes before animating'
);

assert.doesNotMatch(
  editorBlocksSource,
  /moved\.dirty\s*=\s*true/,
  'block reorders should not mark untouched block content dirty'
);

assert.match(
  editorBlocksSource,
  /const replaceAdjacentBlockElements = \(index, targetIndex\) => \{[\s\S]*const firstIndex = Math\.min\(index, targetIndex\);[\s\S]*const secondIndex = Math\.max\(index, targetIndex\);[\s\S]*const firstNew = renderBlockElement\(state\.blocks\[firstIndex\], firstIndex\);[\s\S]*const secondNew = renderBlockElement\(state\.blocks\[secondIndex\], secondIndex\);[\s\S]*firstOld\.remove\(\);[\s\S]*secondOld\.remove\(\);[\s\S]*setActive\(state\.activeIndex\);[\s\S]*return true;/,
  'adjacent move should avoid a full list render by replacing only the two swapped block nodes'
);

assert.match(
  editorBlocksSource,
  /const item = document\.createElement\('section'\);[\s\S]*item\.className = `blocks-block blocks-block-\$\{block\.type\}`;[\s\S]*if \(index === state\.activeIndex\) item\.classList\.add\('is-active'\);[\s\S]*item\.dataset\.blockId = block\.id;/,
  'active block should be marked during node creation so the toolbar does not fade out and back in after reorder render'
);

assert.match(
  editorBlocksSource,
  /const createBlockActionMenu = \(index\) => \{[\s\S]*wrap\.className = 'blocks-block-actions';[\s\S]*const trigger = button\('⋯', 'blocks-icon-btn blocks-action-trigger'\);[\s\S]*trigger\.setAttribute\('aria-haspopup', 'menu'\);[\s\S]*trigger\.setAttribute\('aria-expanded', 'false'\);[\s\S]*menu\.className = 'blocks-action-menu';[\s\S]*menu\.setAttribute\('role', 'menu'\);/,
  'block reorder and delete actions should live behind a right-side overflow menu trigger'
);

assert.match(
  editorBlocksSource,
  /const actionMenuBoundaryLeft = \(\) => \{[\s\S]*document\.getElementById\('editorContentPane'\)[\s\S]*return Math\.max\(8, Math\.floor\(rect\.left\)\);[\s\S]*const alignBlockActionMenu = \(menu, trigger = null\) => \{[\s\S]*menu\.classList\.remove\('is-open-right'\);[\s\S]*const boundaryLeft = actionMenuBoundaryLeft\(\);[\s\S]*const triggerRect = trigger && trigger\.getBoundingClientRect[\s\S]*const leftSpace = triggerRect \? triggerRect\.right - boundaryLeft : menuRect\.left - boundaryLeft;[\s\S]*if \(leftSpace < menuRect\.width \+ 8\) menu\.classList\.add\('is-open-right'\);/,
  'block action overflow menu should flip right when the button has insufficient left-side room inside the editor content boundary'
);

assert.match(
  editorBlocksSource,
  /makeItem\(text\('moveUp', 'Move up'\), '', index === 0, \(\) => moveBlock\(index, -1\)\);[\s\S]*makeItem\(text\('moveDown', 'Move down'\), '', index === state\.blocks\.length - 1, \(\) => moveBlock\(index, 1\)\);[\s\S]*makeItem\(text\('addBefore', 'Add before'\), '', false, \(\) => insertBlankBlock\(index\)\);[\s\S]*makeItem\(text\('addAfter', 'Add after'\), '', false, \(\) => insertBlankBlock\(index \+ 1\)\);[\s\S]*makeItem\(text\('delete', 'Delete'\), 'blocks-action-menu-delete', false, \(\) => deleteBlockAt\(index\)\);/,
  'overflow menu items should preserve move/delete behavior and expose blank insertion before and after the block'
);

assert.match(
  editorBlocksSource,
  /const closeBlockActionMenu = \(restoreFocus = false\) => \{[\s\S]*current\.menu\.classList\.remove\('is-open-right'\);[\s\S]*document\.removeEventListener\('mousedown', current\.onDocDown, true\);[\s\S]*document\.removeEventListener\('keydown', current\.onKeyDown, true\);[\s\S]*window\.removeEventListener\('resize', current\.onReposition\);[\s\S]*window\.removeEventListener\('scroll', current\.onReposition, true\);[\s\S]*if \(restoreFocus\)[\s\S]*const onDocDown = \(event\) => \{[\s\S]*closeBlockActionMenu\(false\);[\s\S]*const onKeyDown = \(event\) => \{[\s\S]*event\.key === 'Escape'[\s\S]*closeBlockActionMenu\(true\);/,
  'overflow menu should close on outside click and Escape while cleaning document and window listeners'
);

assert.doesNotMatch(
  editorBlocksSource,
  /button\('↑'|button\('↓'|button\('×', 'blocks-icon-btn blocks-delete-btn'/,
  'block toolbar should not render direct up, down, or delete icon buttons'
);

assert.doesNotMatch(
  editorBlocksSource,
  /animateAdjacentBlockMove|swappedRect\.left - movedRect\.left|swappedRect\.top - movedRect\.top/,
  'block move animation should not animate stale pre-render DOM nodes to their future positions'
);

assert.match(
  editorBlocksSource,
  /suppressNextBlockContainerClickUntil: 0,[\s\S]*const shouldSuppressRoutedBlockContainerClick = \(\) => \{[\s\S]*Date\.now\(\) > state\.suppressNextBlockContainerClickUntil[\s\S]*state\.suppressNextBlockContainerClickUntil = 0;[\s\S]*return true;/,
  'routed caret pointerdowns should suppress the following container click from clearing activeEditable'
);

assert.match(
  editorBlocksSource,
  /const isBlocksCaretInteractiveTarget = \(target\) => \{[\s\S]*closestElement\(target, \[[\s\S]*'\.blocks-block-head'[\s\S]*'\.blocks-command-menu'[\s\S]*'\.blocks-link-editor'[\s\S]*'\.blocks-card-preview'[\s\S]*'\.blocks-inspector'[\s\S]*'button'[\s\S]*'input'[\s\S]*'select'[\s\S]*'textarea'[\s\S]*'a\[href\]'[\s\S]*'\[contenteditable="true"\]'[\s\S]*\]\.join/,
  'blocks caret routing should exclude command menus, link editors, article cards, controls, links, and native editable targets'
);

assert.match(
  editorBlocksSource,
  /const clearNativeSelection = \(\) => \{[\s\S]*sel\.removeAllRanges\(\);[\s\S]*\};/,
  'non-text block selection should be able to clear stale browser text selections'
);

assert.match(
  editorBlocksSource,
  /const routeBlocksCaretFromPointer = \(event\) => \{[\s\S]*isBlocksCaretInteractiveTarget\(event\.target\)[\s\S]*const imageBlock = closestElement\(event\.target, '\.blocks-block-image'\);[\s\S]*event\.preventDefault\(\);[\s\S]*activateNonTextBlockFromPointer\(imageIndex, imageBlock\);[\s\S]*return;[\s\S]*const candidate = nearestEditableFromPoint\(event\.clientX, event\.clientY\);/,
  'image block pointerdowns should use non-text block activation before routing a caret to nearby text'
);

assert.match(
  editorBlocksSource,
  /const editableCaretCandidates = \(\) => \{[\s\S]*querySelectorAll\('\.blocks-list-item \.blocks-list-text'\)[\s\S]*hitTarget: closestElement\(editable, '\.blocks-list-item'\) \|\| editable[\s\S]*querySelectorAll\('\.blocks-rich-editable:not\(\.blocks-list-text\), \.blocks-code-preview code\[contenteditable="true"\], \.blocks-source-textarea'\)[\s\S]*sync: editableSyncMap\.get\(editable\) \|\| null/,
  'routed caret candidates should include whole-row list item hit targets, rich text, code editors, and source markdown textareas with sync callbacks'
);

assert.match(
  editorBlocksSource,
  /editableCaretCandidates\(\)\.forEach\(candidate => \{[\s\S]*nearestRectForPoint\(candidate\.hitTarget \|\| candidate\.editable, x, y\)[\s\S]*best = candidate;/,
  'nearest editable routing should measure list items by their larger hit target while focusing the editable surface'
);

assert.match(
  editorBlocksSource,
  /const CARET_POINT_MEASURE_LIMIT = 12000;[\s\S]*function measuredTextOffsetDetailsFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*doc\.createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)[\s\S]*let insideTextRect = false;[\s\S]*range\.setStart\(node, i\);[\s\S]*range\.setEnd\(node, i \+ 1\);[\s\S]*x >= rect\.left && x <= rect\.right && y >= rect\.top && y <= rect\.bottom[\s\S]*caretBoundaryDistance\(rect, rect\.left, x, y\)[\s\S]*bestOffset = offset \+ i;[\s\S]*caretBoundaryDistance\(rect, rect\.right, x, y\)[\s\S]*bestOffset = offset \+ i \+ 1;[\s\S]*return \{ offset: bestOffset, distance: bestDistance, insideTextRect, textRectCount \};[\s\S]*function measuredTextOffsetFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*return details \? details\.offset : null;/,
  'routed caret fallback should measure text-node character boundaries and report nearest offsets plus text-rect hits'
);

assert.match(
  editorBlocksSource,
  /function textareaTextOffsetDetailsFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*const mirror = document\.createElement\('div'\);[\s\S]*mirror\.style\.whiteSpace = 'pre-wrap';[\s\S]*mirror\.style\.overflowWrap = 'break-word';[\s\S]*'tabSize'[\s\S]*mirror\.textContent = value;[\s\S]*const details = measuredTextOffsetDetailsFromPoint\(mirror, x, y, limit\);[\s\S]*return \{[\s\S]*\.\.\.details,[\s\S]*offset: Math\.max\(0, Math\.min\(value\.length, details\.offset\)\)[\s\S]*function textareaTextOffsetFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*return details \? details\.offset : null;/,
  'routed source markdown textarea focus should use a styled mirror to measure nearest offsets and text-rect hits'
);

assert.match(
  editorBlocksSource,
  /const setContentEditableCaretFromPoint = \(editable, x, y, hitTarget = editable\) => \{[\s\S]*document\.caretPositionFromPoint[\s\S]*pos\.offsetNode\.nodeType === Node\.TEXT_NODE[\s\S]*document\.caretRangeFromPoint[\s\S]*pointRange\.startContainer\.nodeType === Node\.TEXT_NODE[\s\S]*const hitRect = hitTarget && hitTarget\.getBoundingClientRect \? hitTarget\.getBoundingClientRect\(\) : rect;[\s\S]*const measuredDetails = measuredTextOffsetDetailsFromPoint\(editable, x, y\);[\s\S]*const pointInsideEditableRect = !rect \|\| \([\s\S]*x >= rect\.left[\s\S]*y <= rect\.bottom[\s\S]*if \(measuredDetails && !measuredDetails\.insideTextRect\) \{[\s\S]*placeCaretAtTextOffset\(editable, measuredDetails\.offset\);[\s\S]*return;[\s\S]*if \(pointInsideEditableRect && setRangeFromPoint\(x, y\)\) return;[\s\S]*if \(measuredDetails\) \{[\s\S]*placeCaretAtTextOffset\(editable, measuredDetails\.offset\);[\s\S]*nearestRectForPoint\(editable, x, y\)[\s\S]*if \(hitRect && y < hitRect\.top \+ \(hitRect\.height \/ 2\)\) placeCaretAtTextOffset\(editable, 0\);/,
  'routed rich/list/code caret placement should use measured offsets before browser APIs for blank line area clicks, then coarse fallback'
);

assert.doesNotMatch(
  editorBlocksSource,
  /pointInsideHitRect[\s\S]{0,160}setRangeFromPoint\(x, y\)/,
  'list item edge clicks should not use the larger list-item hit rectangle for native caret placement'
);

assert.doesNotMatch(
  editorBlocksSource,
  /if \(hitRect && y <= hitRect\.top\)[\s\S]{0,120}placeCaretAtTextOffset\(editable, 0\)[\s\S]{0,120}if \(hitRect && y >= hitRect\.bottom\)[\s\S]{0,120}placeCaretAtEnd\(editable\)/,
  'line-gap clicks should not early-return to editable start/end before measured caret placement'
);

assert.match(
  editorBlocksSource,
  /const setTextareaCaretFromPoint = \(area, x, y\) => \{[\s\S]*const measuredOffset = textareaTextOffsetFromPoint\(area, x, y\);[\s\S]*const fallbackOffset = rect && y < rect\.top \+ \(rect\.height \/ 2\) \? 0 : valueLength;[\s\S]*const offset = measuredOffset != null \? measuredOffset : fallbackOffset;[\s\S]*area\.setSelectionRange\(offset, offset\);/,
  'routed source markdown textarea focus should prefer mirror-measured offsets before start/end fallback'
);

assert.match(
  editorBlocksSource,
  /const routeDirectQuoteCaretFromPointer = \(editable, index, sync, event\) => \{[\s\S]*classList\.contains\('blocks-quote-text'\)[\s\S]*measuredTextOffsetDetailsFromPoint\(editable, event\.clientX, event\.clientY\)[\s\S]*details\.insideTextRect[\s\S]*event\.preventDefault\(\);[\s\S]*state\.suppressNextBlockContainerClickUntil = Date\.now\(\) \+ 500;[\s\S]*state\.suppressLinkEditorRefreshUntil = Date\.now\(\) \+ 500;[\s\S]*placeCaretAtTextOffset\(editable, details\.offset\);[\s\S]*activateEditableFromPointer\(index, editable, sync\);/,
  'direct quote edge pointerdowns should prevent native start/end snaps, suppress transient link-editor refreshes, and use the measured nearest offset'
);

assert.match(
  editorBlocksSource,
  /let sourcePointer = null;[\s\S]*area\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*const details = textareaTextOffsetDetailsFromPoint\(area, event\.clientX, event\.clientY\);[\s\S]*if \(details && !details\.insideTextRect\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*sourcePointer = \{ x: event\.clientX, y: event\.clientY, moved: false, corrected: true \};[\s\S]*area\.setSelectionRange\(details\.offset, details\.offset\);[\s\S]*sourcePointer = \{ x: event\.clientX, y: event\.clientY, moved: false, corrected: false \};[\s\S]*area\.addEventListener\('pointermove', \(event\) => \{[\s\S]*> 16\) sourcePointer\.moved = true;[\s\S]*area\.addEventListener\('click', \(event\) => \{[\s\S]*if \(!pointer \|\| pointer\.moved \|\| pointer\.corrected\) return;[\s\S]*const details = textareaTextOffsetDetailsFromPoint\(area, event\.clientX, event\.clientY\);[\s\S]*if \(!details \|\| details\.insideTextRect\) return;[\s\S]*area\.setSelectionRange\(details\.offset, details\.offset\);[\s\S]*area\.addEventListener\('blur', \(\) => \{ sourcePointer = null; \}\);/,
  'direct source markdown textarea blank-edge pointerdowns should prevent native end snaps while text clicks and drags keep native behavior'
);

assert.match(
  editorBlocksSource,
  /const routeBlocksCaretFromPointer = \(event\) => \{[\s\S]*isBlocksCaretInteractiveTarget\(event\.target\)[\s\S]*nearestEditableFromPoint\(event\.clientX, event\.clientY\)[\s\S]*event\.preventDefault\(\);[\s\S]*state\.suppressNextBlockContainerClickUntil = Date\.now\(\) \+ 500;[\s\S]*state\.suppressLinkEditorRefreshUntil = Date\.now\(\) \+ 500;[\s\S]*const \{ editable, hitTarget, index, sync \} = candidate;[\s\S]*setTextareaCaretFromPoint\(editable, event\.clientX, event\.clientY\)[\s\S]*setContentEditableCaretFromPoint\(editable, event\.clientX, event\.clientY, hitTarget\)[\s\S]*setActive\(index, editable, sync\);[\s\S]*list\.addEventListener\('pointerdown', routeBlocksCaretFromPointer\);/,
  'blocks list pointerdown should route blank clicks to the nearest editable without dropping active sync or showing a stale link editor'
);

assert.match(
  editorBlocksSource,
  /body\.addEventListener\('click', \(event\) => \{[\s\S]*shouldSuppressRoutedBlockContainerClick\(\)[\s\S]*event\.stopPropagation\(\);[\s\S]*setActive\(index\);/,
  'block body click selection should not override a caret that was just routed on pointerdown'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-inline-toolbar|execCommand/,
  'blocks mode should not use a standalone inline toolbar or document execCommand'
);

assert.match(
  editorBlocksSource,
  /if \(block\.type === 'paragraph' \|\| block\.type === 'quote' \|\| block\.type === 'list'\) \{[\s\S]*head\.appendChild\(createInlineControls\(index\)\);[\s\S]*\}/,
  'paragraph, quote, and list blocks should receive inline controls in the floating block toolbar'
);

assert.doesNotMatch(
  editorBlocksSource,
  /block\.type === 'heading'[\s\S]{0,160}createInlineControls/,
  'heading block toolbar should not receive inline formatting controls'
);

assert.match(
  editorBlocksSource,
  /function selectionLinkInEditable\(editable\)[\s\S]*closestElement\(candidate, 'a\[href\]'\)[\s\S]*const positionLinkEditor = \(link\) => \{[\s\S]*link\.getBoundingClientRect\(\)[\s\S]*root\.getBoundingClientRect\(\)[\s\S]*const linkEditor = document\.createElement\('div'\);[\s\S]*linkEditor\.className = 'blocks-link-editor'[\s\S]*linkText\.addEventListener\('input', applyLinkEditor\)[\s\S]*linkHref\.addEventListener\('input', applyLinkEditor\)[\s\S]*unlink\.addEventListener\('click',[\s\S]*root\.appendChild\(linkEditor\)[\s\S]*positionLinkEditor\(activeLink\)/,
  'inline link editor should float near the active link and expose text, URL, and unlink controls'
);

assert.match(
  editorBlocksSource,
  /suppressLinkEditorRefreshUntil: 0,[\s\S]*refreshLinkEditor = \(explicitLink = null\) => \{[\s\S]*const explicitLinkNode = explicitLink[\s\S]*explicitLink\.matches\('a\[href\]'\)[\s\S]*if \(!explicitLinkNode && state\.suppressLinkEditorRefreshUntil\) \{[\s\S]*Date\.now\(\) < state\.suppressLinkEditorRefreshUntil[\s\S]*hideLinkEditor\(\);[\s\S]*return;[\s\S]*const link = explicitLinkNode && state\.activeEditable && nodeContains\(state\.activeEditable, explicitLinkNode\)[\s\S]*if \(explicitLinkNode\) state\.activeLinkHoldUntil = Date\.now\(\) \+ 800;/,
  'inline link editor should ignore automatic selection refreshes during routed blank-area caret clicks while still honoring explicit link clicks'
);

assert.match(
  editorBlocksSource,
  /const handleLinkEditorOutsidePointer = \(event\) => \{[\s\S]*if \(linkEditor\.hidden\) return;[\s\S]*isLinkEditorInternalTarget\(target\)[\s\S]*hideLinkEditor\(\);[\s\S]*document\.addEventListener\('pointerdown', handleLinkEditorOutsidePointer, true\);[\s\S]*document\.addEventListener\('mousedown', handleLinkEditorOutsidePointer, true\);/,
  'inline link editor should close from a capture-phase outside pointer or mouse press'
);

assert.doesNotMatch(
  editorBlocksSource,
  /inlineToolbar\.appendChild\(linkEditor\)|blocks-inline-toolbar/,
  'inline link editor should not be placed inside the sticky inline toolbar'
);

assert.match(
  editorBlocksSource,
  /const heading = createRichEditable\(`h\$\{level\}`, block, 'text', `blocks-rich-editable blocks-heading-text/,
  'heading blocks should render as real heading elements in the visual canvas'
);

assert.match(
  editorSource,
  /\.blocks-heading-text \{ margin:0; font-family:var\(--serif, var\(--article-serif-stack, Georgia, "Times New Roman", Times, serif\)\);/,
  'heading block spacing should be owned by the outer block rhythm, not an inner heading margin'
);

assert.match(
  editorBlocksSource,
  /const img = document\.createElement\('img'\);[\s\S]*img\.className = 'blocks-image-preview'[\s\S]*const placeholder = document\.createElement\('div'\);[\s\S]*placeholder\.className = 'blocks-image-placeholder'[\s\S]*figure\.append\(img, placeholder, caption\);/,
  'image blocks should render a real image element with an editor-only empty-image placeholder'
);

assert.match(
  editorBlocksSource,
  /const configureImagePreview = \(figure, img, src\) => \{[\s\S]*img\.onload = \(\) => \{[\s\S]*setImagePlaceholderVisible\(figure, false\);[\s\S]*img\.onerror = \(\) => \{[\s\S]*setImagePlaceholderVisible\(figure, true\);[\s\S]*if \(!nextSrc\) \{[\s\S]*img\.removeAttribute\('src'\);[\s\S]*setImagePlaceholderVisible\(figure, true\);[\s\S]*if \(img\.getAttribute\('src'\) !== nextSrc\) img\.src = nextSrc;/,
  'image preview loading should toggle the placeholder for empty, failed, and loaded sources'
);

assert.match(
  editorBlocksSource,
  /\['image', 'image', 'Image', \{ alt: '', src: '' \}\]/,
  'inserted image blocks should start with an intentionally empty src so the placeholder is visible'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const selectImageBlock = \(event\) => \{[\s\S]*figure\.addEventListener\('pointerdown', selectImageBlock\);[\s\S]*figure\.addEventListener\('click', selectImageBlock\);/,
  'image figures should rely on delegated block pointer routing, not stopped local click handlers'
);

assert.match(
  editorBlocksSource,
  /const createImageMetadataControls = \(block, index\) => \{[\s\S]*controls\.className = 'blocks-image-meta-controls';[\s\S]*alt\.className = 'blocks-image-alt';[\s\S]*const replace = button\(text\('replaceImage', 'Replace image'\), 'blocks-btn blocks-image-replace'\);[\s\S]*title\.className = 'blocks-image-title';[\s\S]*updateFromControl\(block, \{ alt: inputValue\(alt\), title: inputValue\(title\) \}\);[\s\S]*options\.requestImageUpload\(\{ replaceIndex: index, replaceBlockId: block\.id \}\);[\s\S]*controls\.append\(alt, title, replace\);/,
  'image metadata controls should place replace-image after text fields'
);

assert.match(
  editorBlocksSource,
  /if \(block\.type === 'image'\) \{[\s\S]*head\.appendChild\(createImageMetadataControls\(block, index\)\);[\s\S]*\}/,
  'image block controls should be appended to the floating block toolbar'
);

assert.match(
  editorBlocksSource,
  /replaceImageBlock\(src, target = state\.activeIndex\) \{[\s\S]*const expectedBlockId = target && typeof target === 'object' && typeof target\.blockId === 'string'[\s\S]*if \(!Number\.isInteger\(safeIndex\) \|\| safeIndex < 0 \|\| safeIndex >= state\.blocks\.length\) \{[\s\S]*if \(!expectedBlockId\) return null;[\s\S]*state\.blocks\.findIndex\(item => item && item\.id === expectedBlockId\)[\s\S]*if \(expectedBlockId && \(!block \|\| block\.id !== expectedBlockId\)\) \{[\s\S]*block\.type !== 'image'[\s\S]*updateFromControl\(block, \{ src \}\);[\s\S]*syncRenderedImageBlock\(block\);[\s\S]*setActive\(safeIndex\);[\s\S]*return \{ index: safeIndex \};/,
  'image replacement should validate the target image identity before updating an existing block'
);

assert.doesNotMatch(
  editorBlocksSource,
  /replaceImageBlock\(src, index = state\.activeIndex\) \{[\s\S]*Math\.max\(0, Math\.min/,
  'image replacement should not clamp stale out-of-range indexes onto another block'
);

assert.match(
  editorMainSource,
  /requestImageUpload: \(\{ index, replaceIndex, replaceBlockId \} = \{\}\) => \{[\s\S]*replaceIndex: Number\.isFinite\(replaceIndex\) \? replaceIndex : null,[\s\S]*replaceBlockId: typeof replaceBlockId === 'string' && replaceBlockId \? replaceBlockId : null[\s\S]*const replaceIndex = blockInsert && Number\.isFinite\(blockInsert\.replaceIndex\)[\s\S]*const replaceBlockId = blockInsert && typeof blockInsert\.replaceBlockId === 'string'[\s\S]*const replaceMarkdown = \(replaceIndex != null \|\| replaceBlockId\)[\s\S]*const result = markdownBlocksEditor\.replaceImageBlock\(relativePath, \{ index: replaceIndex, blockId: replaceBlockId \}\);[\s\S]*if \(!result\) return false;[\s\S]*singleImage: !!replaceMarkdown[\s\S]*if \(replaceMarkdown\) imageFileOptions\.insertAbortToast = t\('editor\.toasts\.imageReplaceTargetMissing'\);/,
  'image upload picker should support replacing one existing image block through an identity-checked target'
);

assert.match(
  editorMainSource,
  /let selection;[\s\S]*if \(customInsertMarkdown\) \{[\s\S]*selection = customInsertMarkdown\(paths\.relativePath, meta\.altText\);[\s\S]*if \(selection === false\) \{[\s\S]*if \(options\.insertAbortToast\) emitEditorToast\('warn', options\.insertAbortToast\);[\s\S]*continue;[\s\S]*window\.dispatchEvent\(new CustomEvent\('ns-editor-asset-added'/,
  'image uploads should skip asset-added events and success toasts when replacement aborts'
);

assert.match(
  editorMainSource,
  /let pendingBlocksImageInsert = null;[\s\S]*let pendingImagePickerToken = 0;[\s\S]*const armImagePickerCancelReset = \(token\) => \{[\s\S]*if \(token !== pendingImagePickerToken\) return;[\s\S]*if \(!hasFiles\) pendingBlocksImageInsert = null;[\s\S]*imageInput\.addEventListener\('cancel', clearIfPickerStillPending, \{ once: true \}\);[\s\S]*imageInput\.addEventListener\('blur', clearIfPickerStillPending, \{ once: true \}\);[\s\S]*const openImageInputPicker = \(\) => \{[\s\S]*pendingImagePickerToken \+= 1;[\s\S]*imageInput\.value = '';[\s\S]*armImagePickerCancelReset\(pickerToken\);[\s\S]*imageInput\.click\(\);/,
  'image picker cancellation should clear stale pending replacement targets'
);

assert.match(
  editorMainSource,
  /imageInput\.addEventListener\('change', \(\) => \{[\s\S]*const blockInsert = pendingBlocksImageInsert;[\s\S]*pendingBlocksImageInsert = null;[\s\S]*pendingImagePickerToken \+= 1;[\s\S]*if \(files && files\.length\) \{/,
  'image picker changes should consume the pending replacement target before handling files'
);

assert.match(
  editorMainSource,
  /const refreshPreviewAssetOverrides = \(\) => \{[\s\S]*\['mainview', 'blocks-wrap'\]\.forEach\(\(id\) => \{[\s\S]*document\.getElementById\(id\)[\s\S]*applyPreviewAssetOverrides\(target, previewAssetCurrentPath\);[\s\S]*\}\);[\s\S]*\};/,
  'asset preview refresh should update both rendered preview and WYSIWYG block images'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-image-inspector/,
  'image metadata controls should not render as an inspector inside the block body'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-image-src/,
  'image metadata controls should not expose a direct image path input'
);

assert.match(
  editorBlocksSource,
  /const listEl = document\.createElement\(isTaskList \? 'ul' : 'div'\);[\s\S]*const li = document\.createElement\(isTaskList \? 'li' : 'div'\);[\s\S]*span\.contentEditable = 'true'/,
  'list blocks should render editable list item elements instead of a textarea'
);

assert.match(
  editorBlocksSource,
  /const quote = document\.createElement\('blockquote'\);[\s\S]*blocks-quote-preview/,
  'quote blocks should render as blockquote elements'
);

assert.match(
  editorBlocksSource,
  /const pre = document\.createElement\('pre'\);[\s\S]*const scroll = document\.createElement\('div'\);[\s\S]*scroll\.className = 'blocks-code-scroll';[\s\S]*const gutter = document\.createElement\('div'\);[\s\S]*gutter\.className = 'blocks-code-gutter';[\s\S]*const surface = document\.createElement\('div'\);[\s\S]*surface\.className = 'blocks-code-surface';[\s\S]*const highlight = document\.createElement\('code'\);[\s\S]*highlight\.className = 'blocks-code-highlight language-plain';[\s\S]*const code = document\.createElement\('code'\);[\s\S]*code\.className = 'blocks-code-editable';[\s\S]*code\.contentEditable = 'true'/,
  'code blocks should render a pre/code editing surface with an owned non-editable scroll wrapper, gutter, and highlight mirror'
);

assert.match(
  editorBlocksSource,
  /const renderCodeGutter = \(gutter, value\) => \{[\s\S]*String\(value == null \? '' : value\)\.split\('\\n'\)\.length[\s\S]*gutter\.replaceChildren\(frag\);[\s\S]*Array\.from\(gutter\.children\)\.forEach/,
  'code block gutters should be rendered from plain line counts without touching code text'
);

assert.doesNotMatch(
  editorBlocksSource,
  /gutter\.style\.width/,
  'code block gutters should not use a fixed inline width that can squeeze two-digit line numbers'
);

assert.match(
  editorBlocksSource,
  /function normalizeCodeEditablePlainText\(value\) \{[\s\S]*\.replace\(\/\\r\\n\/g, '\\n'\)[\s\S]*\.replace\(\/\\r\/g, '\\n'\);[\s\S]*function codeEditableText\(el\) \{[\s\S]*normalizeCodeEditablePlainText\(el\.innerText \|\| el\.textContent \|\| ''\)\.replace\(\/\\n\$\/, ''\);/,
  'code block text extraction should normalize browser Enter separators before syncing'
);

assert.match(
  editorBlocksSource,
  /function insertCodeEditableTextAtSelection\(el, value\) \{[\s\S]*const offsets = codeEditableSelectionOffsets\(el\);[\s\S]*el\.textContent = next;[\s\S]*placeCaretAtTextOffset\(el, start \+ insert\.length\);[\s\S]*return next;/,
  'code block controlled text insertion should restore the caret after rewriting Enter text'
);

assert.match(
  editorBlocksSource,
  /renderCodeGutter\(gutter, block\.data\.text \|\| ''\);[\s\S]*renderCodeHighlight\(highlight, languageLabel, block\.data\.text \|\| '', block\.data\.lang \|\| ''\);[\s\S]*const sync = \(\) => \{[\s\S]*const text = codeEditableText\(code\);[\s\S]*updateFromControl\(block, \{ text \}\);[\s\S]*renderCodeGutter\(gutter, text\);[\s\S]*renderCodeHighlight\(highlight, languageLabel, text, block\.data\.lang \|\| ''\);[\s\S]*editableSyncMap\.set\(code, sync\);[\s\S]*code\.addEventListener\('input', sync\);[\s\S]*code\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key !== 'Enter'[\s\S]*const text = insertCodeEditableTextAtSelection\(code, '\\n'\);[\s\S]*updateFromControl\(block, \{ text \}\);[\s\S]*renderCodeGutter\(gutter, text\);[\s\S]*renderCodeHighlight\(highlight, languageLabel, text, block\.data\.lang \|\| ''\);[\s\S]*code\.addEventListener\('focus', \(\) => setActive\(index, code, sync\)\);[\s\S]*surface\.append\(highlight, code\);[\s\S]*scroll\.append\(gutter, surface\);[\s\S]*pre\.appendChild\(scroll\);[\s\S]*pre\.appendChild\(languageLabel\);/,
  'code block editing surfaces should sync text, gutter, highlight, and badge without rewriting the editable code node'
);

assert.match(
  editorBlocksSource,
  /const createCodeLanguageInput = \(block\) => \{[\s\S]*const lang = document\.createElement\('select'\);[\s\S]*lang\.className = 'blocks-code-language'[\s\S]*CODE_LANGUAGE_OPTIONS\.forEach\(\(value\) => appendOption\(value, labels\.get\(value\) \|\| value\)\);[\s\S]*lang\.addEventListener\('change', \(\) => updateFromControl\(block, \{ lang: lang\.value \}, true\)\);[\s\S]*if \(block\.type === 'code'\) \{[\s\S]*head\.appendChild\(createCodeLanguageInput\(block\)\);/,
  'code block language control should live in the floating block toolbar'
);

assert.match(
  editorBlocksSource,
  /function resolveCodeHighlightLanguage\(language, codeText\) \{[\s\S]*CODE_PLAIN_LANGUAGES\.has\(normalized\)[\s\S]*CODE_HIGHLIGHT_LANGUAGES\.has\(normalized\)[\s\S]*const detected = String\(detectLanguage\(String\(codeText \|\| ''\)\) \|\| ''\)\.toLowerCase\(\);[\s\S]*return \{ language: 'plain', label: 'PLAIN', highlight: false \};/,
  'blocks code highlight resolution should support plain flags, selected languages, and auto-detection'
);

assert.match(
  editorBlocksSource,
  /const createCodeLanguageLabel = \(getCodeText\) => \{[\s\S]*label\.className = 'syntax-language-label blocks-code-language-label';[\s\S]*label\.setAttribute\('role', 'button'\);[\s\S]*navigator\.clipboard\.writeText\(rawText\)[\s\S]*label\.addEventListener\('mouseenter'[\s\S]*label\.addEventListener\('click', copyCode\);/,
  'blocks code should render the native-style copy language badge inside the code frame'
);

assert.match(
  editorBlocksSource,
  /const renderCodeHighlight = \(highlight, label, value, language\) => \{[\s\S]*const meta = resolveCodeHighlightLanguage\(language, raw\);[\s\S]*highlight\.className = `blocks-code-highlight language-\$\{meta\.language\}`;[\s\S]*highlight\.replaceChildren\(createSafeHighlightFragment\(raw, meta\.highlight \? meta\.language : 'plain'\)\);[\s\S]*label\.dataset\.lang = meta\.label \|\| 'PLAIN';/,
  'blocks code should render syntax spans only into the non-editable highlight mirror and update the badge label'
);

assert.match(
  editorBlocksSource,
  /const CODE_LANGUAGE_OPTIONS = \['', 'plain', 'javascript', 'json', 'python', 'html', 'xml', 'css', 'markdown', 'bash', 'shell', 'yaml', 'yml', 'robots'\];/,
  'code block language selector should expose only supported highlighter language options plus blank/plain'
);

assert.match(
  editorBlocksSource,
  /const currentLang = String\(block\.data\.lang \|\| ''\)\.trim\(\);[\s\S]*const normalizedLang = currentLang\.toLowerCase\(\);[\s\S]*if \(currentLang && !CODE_LANGUAGE_OPTIONS\.includes\(normalizedLang\)\) \{[\s\S]*appendOption\(currentLang, `Unsupported: \$\{currentLang\}`, true\);[\s\S]*\}[\s\S]*lang\.value = CODE_LANGUAGE_OPTIONS\.includes\(normalizedLang\) \? normalizedLang : currentLang;/,
  'code block language selector should normalize supported values and preserve unsupported legacy language values'
);

assert.doesNotMatch(
  editorBlocksSource,
  /lang\.type = 'text'|updateFromControl\(block, \{ lang: inputValue\(lang\) \}\)/,
  'code block language selector should not keep the old free-text input path'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-code-inspector/,
  'code block language control should not render as a body inspector'
);

assert.match(
  editorBlocksSource,
  /preview\.innerHTML = `<span class="blocks-card-source"><a href="\$\{escapeAttribute\(href\)\}" title="card">[\s\S]*hydrateCard\(preview\);[\s\S]*link\.tabIndex = -1;/,
  'article-card blocks should keep the preview wrapper while rendering through the card hydration path'
);

assert.match(
  editorBlocksSource,
  /preview\.addEventListener\('click', \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*setActive\(index\);/,
  'article-card block clicks should select the block instead of following the hydrated link'
);

assert.match(
  editorBlocksSource,
  /preview\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*activateNonTextBlockFromPointer\(index, closestElement\(preview, '\.blocks-block-card'\)\);/,
  'article-card pointerdowns should clear stale text selection and select the card block before click recovery runs'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-card-inspector|labelInput\.placeholder = text\('cardLabel'|location\.placeholder = text\('cardLocation'/,
  'article-card blocks should not render redundant label or location inspector inputs'
);

assert.match(
  editorBlocksSource,
  /const autoSizeTextarea = \(area\) => \{[\s\S]*area\.style\.height = 'auto';[\s\S]*area\.style\.height = `\$\{area\.scrollHeight\}px`;[\s\S]*area\.rows = 1;[\s\S]*area\.addEventListener\('input', \(\) => \{[\s\S]*autoSizeTextarea\(area\);[\s\S]*queueMicrotask\(\(\) => autoSizeTextarea\(area\)\);/,
  'source markdown textareas should auto-size to their content from a one-row baseline'
);

assert.match(
  editorBlocksSource,
  /const sync = \(\) => updateFromControl\(block, \{ text: area\.value \}\);[\s\S]*editableSyncMap\.set\(area, sync\);[\s\S]*area\.addEventListener\('focus', \(\) => \{[\s\S]*setActive\(index, area, sync\);/,
  'source markdown textareas should register active sync for routed caret focus'
);

assert.doesNotMatch(
  editorBlocksSource,
  /area\.value = \(block\.data\.items \|\| \[\]\)\.map\(item => item\.checked/,
  'list blocks should not use a textarea as their primary editing surface'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-add|listAddItem/,
  'list blocks should not render a dedicated add item button'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-remove|listRemoveItem/,
  'list blocks should not render per-item remove buttons'
);

assert.doesNotMatch(
  extractFunctionBody(editorBlocksSource, 'editableText'),
  /\.trim\(/,
  'editable text sync should preserve leading and trailing markdown whitespace'
);

assert.doesNotMatch(
  extractFunctionBody(editorBlocksSource, 'splitEditableTextAtSelection'),
  /\.trim\(/,
  'splitting editable text should preserve leading and trailing markdown whitespace'
);

assert.match(
  editorBlocksSource,
  /function splitEditableTextAtSelection\(el\) \{[\s\S]*beforeRange\.cloneContents\(\)[\s\S]*afterRange\.cloneContents\(\)[\s\S]*span\.addEventListener\('keydown', \(event\) => \{[\s\S]*const split = splitEditableTextAtSelection\(span\);[\s\S]*next\[itemIndex\] = \{ \.\.\.next\[itemIndex\], text: split\.before \};[\s\S]*next\.splice\(itemIndex \+ 1, 0, \{[\s\S]*text: split\.after,[\s\S]*checked: false,[\s\S]*indent: currentIndent,[\s\S]*indentText:/,
  'pressing Enter in a visual list item should split text at the caret into a focused new item below with the same indentation'
);

assert.match(
  editorBlocksSource,
  /outdentEmptyListItemForEnter\(currentItems, itemIndex\)[\s\S]*updateFromControl\(block, \{ items: outdentedItems \}, true\)[\s\S]*splitListItemsAtEmptyItem\(currentItems, itemIndex\)[\s\S]*normalizeSplitListStartItems\(emptySplit\.after\)[\s\S]*state\.blocks\.splice\(index \+ 1, 0, nextBlock\)[\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\)[\s\S]*state\.blocks\.splice\(index, 1, blank\)[\s\S]*const split = splitEditableTextAtSelection\(span\);/,
  'pressing Enter in an empty visual list item should outdent nested empties before deleting a top-level empty item to split or exit'
);

assert.match(
  editorBlocksSource,
  /export function mergeListItemIntoPreviousItem\(items, itemIndex\) \{[\s\S]*itemIndentLevel\(previous\) !== itemIndentLevel\(current\)[\s\S]*listItemHasNestedChildren\(source, safeIndex\)[\s\S]*function isEditableSelectionAtStart\(el\) \{[\s\S]*beforeRange\.cloneContents\(\)[\s\S]*event\.key === 'Backspace' \|\| event\.key === 'Delete'[\s\S]*itemIndex > 0[\s\S]*isEditableSelectionAtStart\(span\)[\s\S]*mergeListItemIntoPreviousItem\(next, itemIndex\)[\s\S]*if \(!mergedItem\) return;[\s\S]*state\.pendingListFocus = \{ blockId: block\.id, itemIndex: mergedItem\.focusItemIndex, caretOffset: mergedItem\.caretOffset \}/,
  'Backspace or Delete at the start of a non-first visual list item should merge only structurally safe same-level items'
);

assert.match(
  editorBlocksSource,
  /event\.key === 'Backspace' && itemIndex === 0 && index > 0 && isEditableSelectionAtStart\(span\)[\s\S]*mergeFirstListItemIntoPreviousBlock\(previous,[\s\S]*items: currentItems[\s\S]*if \(!merged\) return;[\s\S]*state\.blocks\.splice\(index - 1, 2, \.\.\.replacement\)[\s\S]*focusBlockPrimaryEditable\(merged\.previousBlock, merged\.focus\.caretOffset\)/,
  'Backspace at the start of the first visual list item should merge into the previous block only through the safe helper'
);

assert.match(
  editorBlocksSource,
  /mergeTextBlockIntoPrevious\(previous, block\) \|\| mergeTextBlockIntoPreviousList\(previous, block\)[\s\S]*state\.pendingListFocus = \{ blockId: merged\.id, itemIndex: previousListItemIndex, caretOffset: previousListTextLength \}/,
  'Backspace at the start of a text block should support merging into a previous list tail item'
);

assert.match(
  editorBlocksSource,
  /function getEditableCaretTextOffset\(el\) \{[\s\S]*beforeRange\.toString\(\)[\s\S]*function placeCaretAtVisualLine\(el, x, edge, fallbackOffset = 0\) \{[\s\S]*edge === 'last' \? lineRects\[lineRects\.length - 1\] : lineRects\[0\][\s\S]*event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'[\s\S]*const nextIndex = event\.key === 'ArrowUp' \? itemIndex - 1 : itemIndex \+ 1;[\s\S]*if \(!isEditableCaretOnEdgeLine\(span, event\.key === 'ArrowUp' \? 'up' : 'down'\)\) return;[\s\S]*placeCaretAtVisualLine\(target, caretRect \? caretRect\.left : 0, event\.key === 'ArrowUp' \? 'last' : 'first', caretOffset\);/,
  'ArrowUp and ArrowDown should cross items only from edge lines and enter multiline targets from the correct visual edge'
);

assert.match(
  editorBlocksSource,
  /activeIndex: -1[\s\S]*setMarkdown\(markdown\) \{[\s\S]*state\.activeIndex = -1;/,
  'blocks mode should start with no selected block so controls are not shown by default'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \{ position:relative; display:flex; flex-direction:column; gap:\.65rem; padding:0; border-radius:0; background:transparent; color:var\(--text\); \}/,
  'blocks wrapper should remain a visual-free layout container while anchoring floating link controls'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell, \.blocks-list, \.blocks-block, \.blocks-block-body, \.blocks-virtual-block \{ cursor:text; \}/,
  'blocks editing canvas should use the text cursor across blank layout areas'
);

assert.match(
  editorSource,
  /\.blocks-block-head, \.blocks-link-editor, \.blocks-image-meta-controls, \.blocks-inspector, \.blocks-card-picker, \.blocks-command-menu, \.blocks-action-menu, \.blocks-inline-more-menu \{ cursor:default; \}/,
  'blocks controls and floating panels should not inherit the canvas text cursor'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*cursor:pointer;/,
  'toolbar buttons, card picker results, block action menu items, and inline menu items should keep pointer cursors'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*border:1px solid var\(--border\); background:var\(--card\);/,
  'floating toolbar buttons should use opaque card backgrounds instead of transparent mixes'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable, \.blocks-code-preview code, \.blocks-block input, \.blocks-block textarea, \.blocks-link-editor input, \.blocks-card-search \{ cursor:text; \}/,
  'editable text surfaces and text inputs should keep text cursors'
);

assert.match(
  editorSource,
  /\.blocks-block select \{ cursor:default; \}/,
  'select controls should keep their control cursor semantics'
);

assert.match(
  editorSource,
  /\.markdown-editor-shell\.is-blocks-mode, \.markdown-editor-shell:has\(#blocks-wrap:not\(\[hidden\]\)\) \{ border:0; border-radius:0; background:transparent; box-shadow:none; \}/,
  'markdown editor shell should drop its visual container treatment in blocks mode'
);

assert.match(
  editorMainSource,
  /if \(editorShell\) editorShell\.classList\.toggle\('is-blocks-mode', mode === 'blocks'\);/,
  'view switching should mark the markdown shell as visual-free only in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-block \{ position:relative; overflow:visible; \}/,
  'blocks should be layout-only relative containers and must not clip floating controls'
);

assert.match(
  editorSource,
  /\.blocks-list \{ display:block; padding-top:0; \}/,
  'blocks list should use normal article flow instead of flex gap spacing'
);

assert.match(
  editorSource,
  /@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace:has\(#blocks-wrap:not\(\[hidden\]\)\) \.editor-canvas::after \{[\s\S]*height:50vh;[\s\S]*pointer-events:none;[\s\S]*\}/,
  'two-column visual editor should reserve half a viewport of bottom reading space after the last block'
);

assert.match(
  editorSource,
  /\.blocks-virtual-block \{ position:relative; margin:\.85rem 0 1\.2rem; min-height:2\.2rem; \}[\s\S]*\.blocks-virtual-editable:empty::before \{ content:attr\(data-placeholder\);[\s\S]*\.blocks-command-menu \{ position:absolute; left:0; top:calc\(100% \+ \.35rem\);[\s\S]*\.blocks-command-menu-item \{ display:flex; align-items:center; gap:\.45rem;/,
  'blocks mode should style the bottom virtual block and slash command menu as editor-native controls'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*gap:3rem/,
  'blocks list should not keep the old oversized editor-only vertical gap'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*padding-top:2\.5rem/,
  'blocks list should not reserve old top padding for floating block controls'
);

assert.match(
  editorSource,
  /\.blocks-block-paragraph, \.blocks-block-source \{ margin:\.85rem 0; \}[\s\S]*\.blocks-block-paragraph \+ \.blocks-block-paragraph \{ margin-top:1rem; \}[\s\S]*\.blocks-block-heading \{ --blocks-heading-font-size:1\.65rem; margin:calc\(var\(--blocks-heading-font-size\) \* 1\.2\) 0 calc\(var\(--blocks-heading-font-size\) \* \.5\); \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h1\) \{ --blocks-heading-font-size:2rem; \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h6\) \{ --blocks-heading-font-size:\.92rem; \}[\s\S]*\.blocks-block-list \{ margin:\.8rem 0; \}[\s\S]*\.blocks-block-quote \{ margin:1\.2em 0; \}[\s\S]*\.blocks-block-image, \.blocks-block-card \{ margin:1rem 0; \}[\s\S]*\.blocks-block-code \{ margin:\.75rem 0; \}/,
  'blocks should use Native article rhythm margins per block type'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-reordering \{ z-index:1; transition:transform \.24s cubic-bezier\(\.2,\.8,\.2,1\); will-change:transform; \}/,
  'moved blocks should animate their reorder transform without adding container chrome'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{[^}]*background:color-mix\(in srgb, var\(--primary\) 42%, #60a5fa\);[^}]*opacity:0;[^}]*transition:opacity \.16s ease, background \.16s ease, box-shadow \.16s ease;/,
  'hover block indicator should use a softer default color and fade smoothly'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}[\s\S]*\.blocks-block\.is-active::before \{ opacity:1; background:color-mix\(in srgb, var\(--primary\) 82%, #60a5fa\);/,
  'active block indicator should stay visible with the stronger selected color after hover ends'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block \{[^}]*\b(?:border|background|box-shadow|border-radius)\s*:/,
  'block containers should not draw their own border, background, radius, or shadow'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block\.is-active \{[^}]*\b(?:border|background|box-shadow|outline)\s*:/,
  'active block containers should not draw an outer highlight'
);

assert.match(
  editorSource,
  /\.blocks-block:focus, \.blocks-block:focus-visible \{ outline:none; \}/,
  'programmatically focused block containers should suppress the browser default focus ring'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{ content:""; position:absolute; z-index:40;[\s\S]*left:-\.2rem; width:\.078125rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*\}/,
  'block hover affordance should use an out-of-flow left glow instead of container chrome'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block::before \{[^}]*\btransform\s*:/,
  'block hover affordance should not shift block layout'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}/,
  'block hover should reveal the left glow cue'
);

assert.match(
  editorSource,
  /\.blocks-block-body \{ display:flex; flex-direction:column; gap:\.7rem; padding:0; \}/,
  'block body should not add outer container padding'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{ position:absolute; top:0; left:\.55rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*transform:translate3d\(0,-112%,0\) scale\(\.98\);/,
  'block type and action controls should be hidden floating overlays at the outside top-left by default'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*height:42px; min-height:42px;[\s\S]*border:1px solid color-mix\(in srgb, var\(--border\) 76%, var\(--text\) 24%\);[\s\S]*border-radius:0; background:var\(--card\);/,
  'block floating toolbar should use a fixed 42px opaque square-corner shell'
);

assert.match(
  editorBlocksSource,
  /const BLOCK_TYPE_ICON_PATHS = \{[\s\S]*paragraph:[\s\S]*heading:[\s\S]*image:[\s\S]*list:[\s\S]*quote:[\s\S]*code:[\s\S]*source:[\s\S]*card:/,
  'block type icon map should cover every block type shown in the floating toolbar'
);

assert.match(
  editorBlocksSource,
  /function createBlockTypeIcon\(blockType\) \{[\s\S]*document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*svg\.setAttribute\('viewBox', '0 0 24 24'\)[\s\S]*svg\.setAttribute\('aria-hidden', 'true'\)[\s\S]*svg\.setAttribute\('focusable', 'false'\)[\s\S]*svg\.innerHTML = BLOCK_TYPE_ICON_PATHS\[blockType\] \|\| BLOCK_TYPE_ICON_PATHS\.paragraph;/,
  'block type icon helper should create non-focusable inline SVG icons with a paragraph fallback'
);

assert.match(
  editorBlocksSource,
  /const head = document\.createElement\('div'\);[\s\S]*head\.className = 'blocks-block-head';[\s\S]*type\.className = 'blocks-block-type';[\s\S]*const typeLabel = text\(block\.type === 'card' \? 'articleCard' : block\.type, block\.type\);[\s\S]*type\.title = typeLabel;[\s\S]*type\.setAttribute\('role', 'img'\);[\s\S]*type\.setAttribute\('aria-label', typeLabel\);[\s\S]*type\.appendChild\(createBlockTypeIcon\(block\.type\)\);[\s\S]*item\.append\(head, renderBlockBody\(block, index\)\);/,
  'block type badge should render an accessible SVG icon for every block, including blank blocks'
);

assert.match(
  editorSource,
  /\.blocks-block-type \{ display:inline-flex; align-items:center; justify-content:center; width:1rem; height:1\.65rem; min-width:1rem; padding:0; color:color-mix\(in srgb, var\(--muted\) 78%, var\(--text\)\); \}[\s\S]*\.blocks-block-type svg \{ display:block; width:1rem; height:1rem; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; \}/,
  'block type badge should draw the inline SVG icon without a rounded background chip'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-active \.blocks-block-head \{ opacity:1; pointer-events:auto; transform:translate3d\(0,-112%,0\) scale\(1\); \}/,
  'block controls should appear only for the active block'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*flex-wrap:nowrap;[\s\S]*transition:opacity \.16s ease;[^}]*white-space:nowrap; \}[\s\S]*\.blocks-block\.is-active \.blocks-block-head\.is-stuck \{ position:fixed; z-index:135; transform:none; transition:none; max-width:calc\(100vw - 1rem\); \}/,
  'active block controls should stay single-row and avoid transform transitions while sticking under the markdown file toolbar'
);

assert.match(
  editorSource,
  /\.blocks-block-actions \{ position:relative; display:flex; align-items:center; margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}[\s\S]*\.blocks-action-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-action-menu\.is-open-right \{ left:0; right:auto; \}[\s\S]*\.blocks-action-menu\[hidden\] \{ display:none !important; \}/,
  'block action overflow menu should anchor right by default and flip rightward when left space is constrained'
);

assert.match(
  editorSource,
  /\.blocks-action-menu-delete \{ color:color-mix\(in srgb, #dc2626 82%, var\(--text\)\); \}[\s\S]*\.blocks-action-menu-delete:hover:not\(:disabled\), \.blocks-action-menu-delete:focus-visible:not\(:disabled\) \{ background:color-mix\(in srgb, #dc2626 12%, var\(--card\)\);/,
  'delete action inside the overflow menu should retain danger styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language[\s\S]*\.blocks-block-head \.blocks-code-language \{ width:8\.5rem; max-width:26vw; cursor:pointer; \}/,
  'code block language selector should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language, \.blocks-block-head \.blocks-image-meta-controls input, \.blocks-block-head \.blocks-image-replace \{[^}]*border:1px solid var\(--border\); border-radius:999px; background:var\(--card\);[\s\S]*\.blocks-image-meta-controls \{ display:flex; align-items:center; gap:\.24rem;[\s\S]*\.blocks-block-head \.blocks-image-replace \{ white-space:nowrap; cursor:pointer; \}/,
  'image metadata fields and replace button should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-image-figure \{ position:relative; margin:0; display:block; width:100%; \}[\s\S]*\.blocks-image-preview \{ display:block; width:100%; height:auto; border-radius:\.5rem;[\s\S]*\.blocks-image-figure\.is-image-placeholder \{ aspect-ratio:5 \/ 1; min-height:5rem;[\s\S]*\.blocks-image-placeholder::after \{ content:""; position:absolute; inset:0; background:linear-gradient\(to top right,[\s\S]*\.blocks-image-figure\.is-image-placeholder \.blocks-image-placeholder \{ display:flex; \}[\s\S]*\.blocks-image-figure figcaption \{ margin-top:\.5em; color:var\(--muted\); font-family:var\(--serif,[\s\S]*font-size:\.9em; text-align:center;[\s\S]*\.blocks-image-figure figcaption\[hidden\] \{ display:none !important; \}/,
  'image block visual styling should mirror native article images and reserve a diagonal empty-image placeholder'
);

assert.match(
  editorSource,
  /\.blocks-code-preview code\.blocks-code-editable:focus \{ outline:none; box-shadow:none; border-color:inherit; \}/,
  'focused code block editor should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-code-preview \{ margin:0; padding:1rem 1\.1rem; border-radius:0\.5rem; overflow:hidden; background-color:var\(--code-bg\); border:0\.0625rem solid var\(--border\); box-shadow:var\(--shadow\); color:var\(--code-text\); position:relative;[\s\S]*font-size:\.893rem; line-height:1\.55; tab-size:2; \}[\s\S]*\.blocks-code-scroll \{ display:flex; align-items:stretch; min-width:0; width:100%; overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{ flex:0 0 auto; position:sticky; left:0; z-index:1; box-sizing:border-box;[\s\S]*padding-right:\.75rem; margin-right:\.75rem; border-right:1px solid color-mix\(in srgb, var\(--code-text\) 12%, transparent\); background:var\(--code-bg\); color:color-mix\(in srgb, var\(--code-text\) 60%, transparent\);[\s\S]*font:inherit; font-variant-numeric:tabular-nums; \}[\s\S]*\.blocks-code-surface \{ position:relative; flex:1 1 auto;[\s\S]*min-width:max-content; min-height:1\.55em; \}[\s\S]*\.blocks-code-preview code \{ display:block;[\s\S]*min-width:100%; min-height:1\.55em; padding:0;[\s\S]*white-space:pre; font:inherit; line-height:inherit; tab-size:inherit; background:transparent; \}[\s\S]*\.blocks-code-highlight \{ color:inherit; pointer-events:none; user-select:none; \}[\s\S]*\.blocks-code-preview code\.blocks-code-editable \{ position:absolute; inset:0; z-index:2; color:transparent; -webkit-text-fill-color:transparent; caret-color:var\(--code-text\); \}/,
  'blocks code blocks should use native code styling while overlaying a transparent editable layer on a highlight mirror'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview code \{[^}]*overflow-x:auto/,
  'editable blocks code should not own horizontal scrolling because browser caret scrolling clips its left edge too early'
);

assert.match(
  editorSource,
  /\.blocks-code-scroll \{[^}]*overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{[^}]*position:sticky; left:0; z-index:1;/,
  'blocks code gutter should stick inside the non-editable scroll wrapper like native preview gutters'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview \{[^}]*#020617[^}]*\}/,
  'blocks code preview should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-gutter \{[^}]*#020617[^}]*\}/,
  'blocks code gutter should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.match(
  syntaxHighlightSource,
  /export function initSyntaxHighlighting\(root = document\) \{[\s\S]*const scope = root && typeof root\.querySelectorAll === 'function' \? root : document;[\s\S]*const codeBlocks = scope\.querySelectorAll\('pre code'\);[\s\S]*preElement\.classList\.contains\('blocks-code-preview'\)[\s\S]*preElement\.closest\('\.markdown-blocks-shell'\)[\s\S]*codeElement\.isContentEditable \|\| codeElement\.getAttribute\('contenteditable'\) === 'true'/,
  'syntax highlighting should be scoped and skip editable blocks code surfaces'
);

assert.match(
  syntaxHighlightSource,
  /export function createSafeHighlightFragment\(code, language\) \{[\s\S]*return toSafeFragment\(simpleHighlight\(code \|\| '', language \|\| 'plain'\)\);[\s\S]*\}/,
  'syntax highlighter should expose a safe fragment helper for editor-owned highlight mirrors'
);

assert.match(
  editorMainSource,
  /setSafeHtml\(target, post \|\| '', baseDir,[\s\S]*try \{ initSyntaxHighlighting\(target\); \} catch \(_\) \{\}/,
  'editor preview syntax highlighting should stay scoped to the preview container'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable \{ outline:none; min-height:1\.65em; line-height:1\.65;/,
  'empty rich text blocks should keep one editable line as a pointer target'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea \{ min-height:0; width:100%; resize:none; overflow:hidden; padding-block:0; \}/,
  'source markdown textareas should expand to content without fixed minimum height, internal scrolling, or vertical padding'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-textarea \{[^}]*min-height:/,
  'block textareas should not reserve a fixed minimum height'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea:focus \{ outline:none; box-shadow:none; border-color:color-mix\(in srgb, var\(--border\) 82%, transparent\); \}/,
  'focused source markdown textarea should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-list-item input\[type="checkbox"\] \{[^}]*cursor:pointer; \}/,
  'task-list checkbox controls should keep pointer cursors inside the text-cursor canvas'
);

assert.match(
  editorSource,
  /\.blocks-card-preview a \{ cursor:default; \}/,
  'article card links should not advertise navigation in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-card-preview \.link-card-wrap \{ margin:0; \}[\s\S]*\.blocks-card-preview \.link-card \{[^}]*border:0\.0625rem solid var\(--border\);[^}]*border-radius:0\.75rem;[^}]*box-shadow:var\(--shadow\);[\s\S]*\.blocks-card-preview \.card-cover-wrap \{[^}]*aspect-ratio:16 \/ 10;[\s\S]*\.blocks-card-preview \.card-title \{[^}]*font-family:var\(--display, var\(--serif\)\);[^}]*font-size:1\.05rem;[\s\S]*\.blocks-card-preview \.card-meta \{[^}]*text-transform:uppercase;/,
  'article-card blocks should mirror the native link-card layout instead of using separate temporary card styling'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-rich-editable:focus,[^{]*\.blocks-code-preview code:focus[^{]*\{ outline:2px solid/,
  'code block editor focus should not share the generic blue focus outline rule'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block:focus-within \.blocks-block-head/,
  'focused stale blocks should not keep a second floating toolbar visible'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \.blocks-inline-btn\.is-active, \.markdown-blocks-shell \.blocks-inline-btn\[aria-pressed="true"\], \.markdown-blocks-shell \.blocks-inline-menu-item\.is-active, \.markdown-blocks-shell \.blocks-inline-menu-item\[aria-pressed="true"\][\s\S]*background:#1d4ed8 !important;[\s\S]*background-color:#1d4ed8 !important;[\s\S]*border-color:#1e40af !important;[\s\S]*color:#fff !important;[\s\S]*box-shadow:inset[\s\S]*\.blocks-inline-controls, \.blocks-list-indent-controls \{ display:flex; align-items:center; gap:\.2rem; padding-left:\.1rem; \}[\s\S]*\.blocks-inline-controls \{ margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}/,
  'inline formatting controls should use a visible filled active state that overrides theme button resets'
);

assert.match(
  editorSource,
  /\.blocks-inline-more \{ position:relative; display:flex; align-items:center; \}[\s\S]*\.blocks-inline-more-trigger \{ min-width:2rem; font-size:\.78rem; font-weight:750; \}[\s\S]*\.blocks-inline-more-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-inline-more-menu\[hidden\] \{ display:none !important; \}[\s\S]*\.blocks-inline-menu-item \{ width:100%; border:0; background:var\(--card\); border-radius:6px; padding:\.46rem \.58rem; text-align:left; white-space:nowrap; font-weight:700; \}[\s\S]*\.blocks-inline-menu-item\[aria-disabled="true"\] \{ opacity:\.45; cursor:not-allowed; \}/,
  'inline formatting overflow menu should be compact and anchored after the Link button'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-btn\.is-active, \.blocks-inline-btn\[aria-pressed="true"\] \{[^}]*var\(--primary\) 15%/,
  'inline formatting active state should not regress to the barely visible 15% primary tint'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-toolbar/,
  'blocks inline formatting should not keep a sticky standalone toolbar style'
);

assert.match(
  editorSource,
  /\.blocks-visual-list \{ margin:0 0 0 1\.25rem; padding-left:0; font-family:var\(--serif, var\(--article-serif-stack, Georgia, "Times New Roman", Times, serif\)\); font-size:1\.04rem; line-height:1\.75; letter-spacing:\.005em; \}[\s\S]*\.blocks-list-item \{ margin:\.35rem 0; padding:0; line-height:1\.75; \}[\s\S]*\.blocks-list-item:first-child \{ margin-top:0; \}[\s\S]*\.blocks-list-item:last-child \{ margin-bottom:0; \}[\s\S]*\.blocks-visual-list \.blocks-list-item::marker \{ font-family:inherit; font-size:1em; font-weight:400; color:inherit; \}/,
  'visual list rows and markers should mirror native typography without adding outer block-body whitespace'
);

assert.match(
  editorSource,
  /\.blocks-list-text \{ display:inline; min-width:0; vertical-align:baseline; line-height:inherit; padding:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-text \{ grid-column:2; display:block; \}/,
  'visual list editable text should not add editor-only padding around native list markers'
);

assert.match(
  editorSource,
  /\.blocks-visual-list-task \{ list-style:none; margin-left:0; padding-left:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-item \{ display:grid; grid-template-columns:1\.45rem minmax\(0, 1fr\);/,
  'task-list rows should keep checklist boxes aligned while regular list markers use native spacing'
);

assert.match(
  editorBlocksSource,
  /if \(block\.type === 'list'\) \{[\s\S]*head\.appendChild\(createListTypeSelect\(block, index\)\);[\s\S]*head\.appendChild\(createListIndentControls\(block, index\)\);[\s\S]*\}/,
  'list type control should live in the floating block toolbar'
);

assert.match(
  editorBlocksSource,
  /const createHeadingLevelSelect = \(block\) => \{[\s\S]*select\.className = 'blocks-heading-level'[\s\S]*select\.addEventListener\('change', \(\) => updateFromControl\(block, \{ level: Number\(select\.value\) \|\| 2 \}, true\)\);[\s\S]*if \(block\.type === 'heading'\) \{[\s\S]*head\.appendChild\(createHeadingLevelSelect\(block\)\);[\s\S]*\}/,
  'heading level control should live in the floating block toolbar'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-heading-controls/,
  'heading level control should not remain as a body control above the heading'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-inspector/,
  'list type control should not remain as a body inspector above the list'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list-remove/,
  'visual list CSS should not style removed per-item delete buttons'
);

assert.doesNotMatch(
  editorSource,
  /id="composerOrderInlineMeta"|data-i18n="editor\.composer\.changeSummary"/,
  'composer should not render the inline change summary block above the editor'
);

assert.doesNotMatch(
  editorSource,
  /id="wrapToggle"|data-wrap="(?:on|off)"/,
  'markdown editor should not expose a manual line-wrap toggle'
);

assert.match(
  editorSource,
  /class="editor-app-shell" id="editorAppShell"[\s\S]*class="editor-rail editor-file-tree-pane" id="editorRail"[\s\S]*id="editorFileTree" role="tree"[\s\S]*class="editor-content-pane" id="editorContentPane"[\s\S]*class="editor-content-frame"[\s\S]*class="editor-layout" id="mode-editor"/,
  'editor should render a fixed two-pane app shell with a left rail and a width-limited right content frame'
);

assert.match(
  editorSource,
  /<section class="editor-structure-panel" id="editorStructurePanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorStructureActions"><\/div>/,
  'structure panel header should expose a mobile file tree drawer toggle before the shared heading'
);

assert.match(
  editorSource,
  /<section class="editor-markdown-panel" id="editorMarkdownPanel"[\s\S]*<div class="toolbar">[\s\S]*<div class="left-actions">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<span class="current-file" id="currentFile"/,
  'markdown toolbar should keep its visual mobile file tree toggle before the current file breadcrumb'
);

assert.match(
  editorSource,
  /<section class="editor-system-panel" id="editorSystemPanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorSystemActions"><\/div>/,
  'system and publish panel header should expose the shared mobile file tree drawer toggle'
);

assert.equal(
  (editorSource.match(/data-editor-rail-toggle/g) || []).length,
  3,
  'editor should render one drawer toggle entry for structure, markdown, and system surfaces'
);

assert.doesNotMatch(
  editorSource,
  /id="editorMobileRailToggle"/,
  'mobile file tree toggles should not depend on one id inside a conditionally hidden panel'
);

assert.doesNotMatch(
  editorSource,
  /localStorage\.getItem\('ns_composer_editor_state'\)/,
  'editor entry should default to the Editor file tree instead of restoring the last Site Settings mode'
);

assert.doesNotMatch(
  editorSource,
  /editor-rail-footer|editorRailSettingsToggle|editorRailSettingsMenu|id="editorLangSwitcher"/,
  'editor rail footer settings menu should be removed'
);

assert.match(
  source,
  /function appendEditorLanguageControl\(body\) \{[\s\S]*id = 'editorLangSwitcher'[\s\S]*id = 'editorLangSelect'[\s\S]*ns-editor-language-control-mounted/,
  'editor language controls should be rendered inside the System structure panel'
);

assert.match(
  source,
  /if \(node\.source === 'system'\) \{[\s\S]*appendEditorLanguageControl\(body\);[\s\S]*node\.children\.forEach/,
  'System root panel should include editor language controls before system leaves'
);

assert.match(
  source,
  /syncLabel: treeText\('sync', 'Publish'\),[\s\S]*node\.id === 'system:sync'[\s\S]*applyMode\('sync'\);/,
  'System tree should expose and route the Publish leaf'
);

assert.doesNotMatch(
  editorSource,
  /id="global-status"|globalStatusRepo|globalArrowLabel|localDraftSummary|editor-github\.js/,
  'legacy global sync flow widget should be removed from the editor shell'
);

assert.match(
  editorSource,
  /id="mode-sync" hidden aria-hidden="true"/,
  'editor should provide an inline Sync panel host'
);

assert.match(
  editorSource,
  /id="editorModalSyncActions" hidden[\s\S]*id="btnSyncSubmit"[\s\S]*form="syncCommitForm"/,
  'Sync commit submit button should live in the system panel header actions and submit the inline form'
);

assert.doesNotMatch(
  source,
  /global-status|globalStatusRepo|globalArrowLabel|localDraftSummary|attachGlobalStatusCommitHandler|handleGlobalBubbleActivation/,
  'composer should not keep legacy global sync widget wiring'
);

assert.match(
  source,
  /function getSyncCommitPanelHost\(\) \{[\s\S]*panel\.id = 'syncCommitPanel';[\s\S]*syncPanel\.appendChild\(panel\);/,
  'Sync page should host the GitHub commit form inline'
);

assert.match(
  source,
  /async function refreshSyncCommitPanel\(options = \{\}\) \{[\s\S]*const headerSubmit = document\.getElementById\('btnSyncSubmit'\)[\s\S]*gatherCommitPayload\(\{ cleanupUnusedAssets: false, showSeoStatus: false \}\)[\s\S]*form\.id = 'syncCommitForm';[\s\S]*const btnSubmit = headerSubmit;[\s\S]*appendGithubCommitSummary\(summaryBlock, commitFiles, seoFiles, summaryEntries\)[\s\S]*const value = getFineGrainedTokenValue\(\);[\s\S]*performDirectGithubCommit\(value, currentSummary\);/,
  'inline Sync page commit form should reuse existing payload and commit flow'
);

assert.doesNotMatch(
  source.slice(source.indexOf('async function refreshSyncCommitPanel(options = {}) {'), source.indexOf('function scheduleSyncCommitPanelRefresh()')),
  /editor\.composer\.github\.modal\.tokenLabel|sync-token-help|className = 'sync-token-field'/,
  'Sync page should no longer render the fine-grained token settings inline'
);

assert.match(
  editorSource,
  /id="editorFileTree" role="tree"/,
  'editor should render the content file tree as the primary article/page manager'
);

assert.doesNotMatch(
  editorSource,
  /class="editor-tree-head"|id="btnEditorAddArticle"|id="btnEditorAddPage"|data-i18n="editor\.tree\.title"|data-i18n="editor\.tree\.subtitle"/,
  'file tree rail should not render the Content heading, subtitle, or add-entry buttons'
);

assert.doesNotMatch(
  source,
  /btnEditorAddArticle|btnEditorAddPage/,
  'add article/page entry handlers should live in the root structure panels, not the tree rail'
);

assert.match(
  source,
  /if \(node\.kind === 'root'\) \{[\s\S]*const add = makeStructureButton\(isPages \? treeText\('addPage', 'Page'\) : treeText\('addArticle', 'Article'\)\);[\s\S]*actions\.appendChild\(add\);/,
  'root structure panels should retain add article/page entry actions'
);

assert.match(
  [
    enI18nSource,
    chsI18nSource,
    chtTwI18nSource,
    jaI18nSource
  ].join('\n'),
  /addArticle: '\+ New article'[\s\S]*addArticle: '\+ 新建文章'[\s\S]*addArticle: '\+ 新增文章'[\s\S]*addArticle: '\+ 新規記事'/,
  'root article actions should be explicit add actions in every UI language'
);

assert.match(
  chtHkI18nSource,
  /import chtTwTranslations from '\.\/cht-tw\.js\?v=20260504saved';/,
  'Hong Kong Traditional Chinese should inherit the cache-busted Traditional Chinese article action'
);

assert.match(
  languagesManifestSource,
  /"\.\/en\.js\?v=20260504saved"[\s\S]*"\.\/chs\.js\?v=20260504saved"[\s\S]*"\.\/cht-tw\.js\?v=20260504saved"[\s\S]*"\.\/cht-hk\.js\?v=20260504saved"[\s\S]*"\.\/ja\.js\?v=20260504saved"/,
  'language manifest should cache-bust language bundles changed by editor action labels'
);

assert.match(
  i18nSource,
  /from '\.\.\/i18n\/en\.js\?v=20260504saved'/,
  'default English bundle import should be cache-busted when editor action labels change'
);

[
  source,
  editorMainSource,
  readFileSync(resolve(here, '../assets/js/editor-boot.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/system-updates.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/theme.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/seo.js'), 'utf8')
].forEach((moduleSource) => {
  assert.doesNotMatch(
    moduleSource,
    /from ['"]\.\/i18n\.js['"]/,
    'runtime modules should import the cache-busted i18n module URL'
  );
});

assert.match(
  editorSource,
  /html, body \{ width: 100%; height: 100%; overflow: hidden; \}[\s\S]*\.editor-page \{ position: fixed; inset: 0;[^}]*overflow: hidden;/,
  'editor page should be fixed to the visible viewport with independent rail and content scrolling'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-page \{ padding:0; \}/,
  'extra narrow editor page should stay flush to the viewport edge'
);

assert.match(
  editorSource,
  /\.editor-rail-tree-scroll \{[^}]*overflow:auto;[\s\S]*\.editor-content-pane \{[^}]*overflow-x:hidden;[\s\S]*overflow-y:auto;/,
  'editor rail tree and right content pane should scroll independently without page-level horizontal scrolling'
);

assert.match(
  editorSource,
  /\.editor-rail-resizer \{[^}]*cursor:col-resize;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-rail \{[\s\S]*position:fixed;[\s\S]*transform:translateX\(-102%\);[\s\S]*\.editor-rail-resizer \{\s*display:none;/,
  'editor rail should support desktop resizing and switch to a mobile drawer without the resizer'
);

assert.match(
  editorSource,
  /\.editor-rail \{[\s\S]*border-right:0;[\s\S]*\.editor-rail-resizer::before \{[\s\S]*left:50%;[\s\S]*width:1px;[\s\S]*opacity:\.65;[\s\S]*\.editor-file-tree-pane \{[\s\S]*border-right:0;/,
  'file tree rail should not show a container border, while the resize handle keeps its own one-pixel line'
);

assert.match(
  editorSource,
  /class="editor-modal-layer" id="editorModalLayer" hidden aria-hidden="true"[\s\S]*class="editor-modal-dialog"[\s\S]*id="mode-composer" hidden aria-hidden="true"[\s\S]*id="mode-updates" hidden aria-hidden="true"/,
  'Site Settings and System Updates should be mounted inside the hidden editor modal layer'
);

assert.match(
  editorSource,
  /\.editor-workspace \{[\s\S]*grid-template-columns:minmax\(0, 1fr\);[\s\S]*\.editor-workspace-meta \{[\s\S]*grid-column:1;[\s\S]*\.frontmatter-panel \{[\s\S]*position: static;/,
  'front matter panel should always flow below the markdown editor instead of using a side rail'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-left:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*margin-right:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*padding-left:var\(--editor-content-pane-padding, 1rem\);[\s\S]*padding-right:var\(--editor-content-pane-padding, 1rem\);/,
  'markdown editor topbar should span the content pane while preserving its visual inset with internal padding'
);

assert.match(
  editorSource,
  /\.frontmatter-panel \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*\.frontmatter-grid \{[\s\S]*--frontmatter-row-gap: 0\.35rem;[\s\S]*display: flex;[\s\S]*gap: var\(--frontmatter-row-gap\);[\s\S]*\.frontmatter-field \{[\s\S]*padding: 0;[\s\S]*display: grid;[\s\S]*grid-template-columns: var\(--frontmatter-single-label-width, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter fields should use compact Site Settings-style rows with measured label width'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \{[\s\S]*grid-template-columns: minmax\(88px, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter label column should not stay fixed to the old 88px width'
);

assert.match(
  editorSource,
  /\.frontmatter-section \{[\s\S]*border: 1px solid color-mix\(in srgb, var\(--border\) 96%, transparent\);[\s\S]*background: var\(--card\);[\s\S]*gap: 0\.6rem;[\s\S]*\.frontmatter-section-head \{[\s\S]*align-items: baseline;[\s\S]*\.frontmatter-section-title \{[\s\S]*font-size: 1rem;[\s\S]*\.frontmatter-section-description \{[\s\S]*font-size: 0\.82rem;[\s\S]*text-align: right;/,
  'front matter sections should mirror the Site Settings single-column section card header style'
);

assert.match(
  editorSource,
  /\.editor-workspace-meta::before \{[\s\S]*width:min\(18rem, 62%\);[\s\S]*repeating-linear-gradient\([\s\S]*color-mix\(in srgb, var\(--muted\) 64%, transparent\) 0 \.72rem,[\s\S]*transparent \.72rem 1\.08rem[\s\S]*@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace-meta::before \{[\s\S]*display:none;/,
  'single-column article editor layout should show a thin decorative dashed divider above the metadata panel and hide it in the two-column rail'
);

assert.match(
  editorSource,
  /\.frontmatter-section\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  'front matter sections should honor hidden state so page files can suppress article-only metadata groups'
);

assert.match(
  editorSource,
  /frontMatterCommonSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.commonDescription"[\s\S]*frontMatterExtraSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.advancedDescription"/,
  'front matter common and advanced sections should include localized section descriptions'
);

assert.match(
  editorMainSource,
  /head\.className = 'frontmatter-field-head';[\s\S]*labelWrap\.className = 'frontmatter-field-label-wrap';[\s\S]*labelSpan\.className = 'frontmatter-field-title';[\s\S]*controls\.className = 'frontmatter-field-controls';[\s\S]*controls\.appendChild\([\s\S]*entry\.container\.appendChild\(controls\);/,
  'front matter field DOM should include field head, label wrap, and controls wrapper'
);

assert.match(
  editorMainSource,
  /const clear = \(\) => \{[\s\S]*state = \{[\s\S]*data:\s*\{\}[\s\S]*hasFrontMatter:\s*false[\s\S]*rebuildBindings\(\);[\s\S]*\};[\s\S]*return \{[\s\S]*clear,/,
  'front matter manager should expose a clear helper to reset stale article metadata state'
);

assert.match(
  editorMainSource,
  /const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*if \(shouldClear && frontMatterManager && typeof frontMatterManager\.clear === 'function'\) frontMatterManager\.clear\(\);[\s\S]*updateMetadataPanelVisibility\(\);[\s\S]*\};/,
  'switching into page metadata mode should clear stale article front matter state only on visibility transitions'
);

assert.match(
  editorMainSource,
  /function syncFrontMatterLabelWidth\(root\) \{[\s\S]*querySelectorAll\('\.frontmatter-field-title'\)[\s\S]*requestAnimationFrame[\s\S]*ResizeObserver/,
  'front matter labels should be measured after render and shared through a CSS variable'
);

assert.match(
  editorMainSource,
  /function syncFrontMatterLabelWidth\(root\) \{[\s\S]*root\.style\.setProperty\('--frontmatter-single-label-width'/,
  'front matter label measurement should write the shared label width CSS variable'
);

assert.match(
  editorMainSource,
  /const measureLabelText = \(label\) => \{[\s\S]*label\.scrollWidth[\s\S]*probe\.textContent = label\.textContent \|\| '';[\s\S]*probe\.style\.whiteSpace = 'nowrap';/,
  'front matter label measurement should probe intrinsic text width when current layout is constrained'
);

assert.match(
  editorMainSource,
  /querySelector\('\.frontmatter-help-tooltip'\)[\s\S]*measureLabelText\(label\)[\s\S]*getComputedStyle\(target \|\| label\)[\s\S]*gap/,
  'front matter label measurement should use intrinsic label width plus the visible help button and gap'
);

assert.match(
  editorMainSource,
  /document\.addEventListener\('ns-editor-language-applied'[\s\S]*frontMatterManager\.applySectionDescriptions\(\);[\s\S]*syncFrontMatterLabelWidth\(frontMatterManager\.panel\);/,
  'front matter labels should resync after editor language changes update localized labels'
);

assert.match(
  editorMainSource,
  /const updateMetadataPanelVisibility = \(\) => \{[\s\S]*tabsMetadataManager\.setVisible\(tabsMetadataVisible\);[\s\S]*syncFrontMatterLabelWidth\(panel\);/,
  'front matter labels should resync after article/page metadata visibility changes'
);

assert.match(
  source,
  /function getTabsMetadataForTab\(tab\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry && entry\[tab\.tabsLang\][\s\S]*title/,
  'tabs metadata reads should prefer the dynamic tab stable identity over path-only lookup'
);

assert.match(
  source,
  /function updateTabsEntryTitleForTab\(tab, metadata\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry\[tab\.tabsLang\]\.title = nextTitle;/,
  'tabs metadata writes should target the dynamic tab stable identity instead of the first matching path'
);

assert.match(
  source,
  /detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\) \{[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'tabs metadata bridge should write through the active dynamic tab identity'
);

assert.match(
  source,
  /const data = \{[\s\S]*path: normalized,[\s\S]*tabsKey:[\s\S]*tabsLang:[\s\S]*editorTreeNodeId:[\s\S]*lookupKey:/,
  'dynamic markdown tabs should persist a stable identity for shared-path tabs content'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \+ \.frontmatter-field|frontmatter-pill|frontmatter-field-hint/,
  'front matter should not render per-row separators, key chips, or persistent hint rows'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}`,
  /frontMatterToggle|frontMatterSummary|frontMatterHelp|frontmatter-toggle|class="frontmatter-help"|\.frontmatter-help\s*\{|data-collapsed/,
  'front matter editor should not render the old collapsible heading or helper copy'
);

assert.match(
  editorSource,
  /\.frontmatter-switch \{[\s\S]*border-radius: 999px;[\s\S]*\.frontmatter-switch-input \{[\s\S]*clip-path: inset\(50%\);[\s\S]*\.frontmatter-switch-track \{[\s\S]*width: 2\.4rem;[\s\S]*\.frontmatter-switch\[data-state="on"\] \.frontmatter-switch-thumb \{[\s\S]*transform: translateX\(1\.05rem\);/,
  'front matter boolean fields should render as two-state switch controls'
);

assert.match(
  editorMainSource,
  /const syncBooleanControl = \(entry, value\) => \{[\s\S]*entry\.input\.setAttribute\('aria-checked', checked \? 'true' : 'false'\);[\s\S]*wrap\.className = 'frontmatter-switch';[\s\S]*checkbox\.setAttribute\('role', 'switch'\);[\s\S]*entry\.switchEl = wrap;/,
  'front matter boolean fields should sync switch state through the existing input binding'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}`,
  /frontmatter-clear|frontmatter-actions|clearEntryValue|editor\.frontMatter\.booleanLabel/,
  'front matter boolean fields should not keep the old checkbox label or clear action'
);

assert.match(
  editorSource,
  /\.frontmatter-panel\[data-frontmatter-visible="false"\]\[data-tabs-visible="false"\] \{ display: none !important; \}/,
  'front matter panel should only fully hide when neither article nor tabs metadata is active'
);

assert.match(
  editorMainSource,
  /let frontMatterVisible = true;[\s\S]*let tabsMetadataVisible = false;[\s\S]*const inferCurrentFileSource = \(path\) => \{[\s\S]*normalized\.startsWith\('tab\/'\) \? 'tabs' : '';[\s\S]*const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*if \(shouldClear && frontMatterManager && typeof frontMatterManager\.clear === 'function'\) frontMatterManager\.clear\(\);[\s\S]*updateMetadataPanelVisibility\(\);[\s\S]*const setTabsMetadataVisible = \(visible\) => \{[\s\S]*tabsMetadataVisible = !!visible;[\s\S]*updateMetadataPanelVisibility\(\);[\s\S]*assignCurrentFileLabel = \(input\) => \{[\s\S]*setFrontMatterVisible\(currentFileInfo\.source !== 'tabs'\);[\s\S]*setTabsMetadataVisible\(currentFileInfo\.source === 'tabs'\);/,
  'markdown editor should swap between article front matter and tabs metadata visibility by file source'
);

assert.match(
  editorMainSource,
  /const getValue = \(\) => \{[\s\S]*if \(frontMatterVisible && frontMatterManager\) return frontMatterManager\.buildMarkdown\(body\);[\s\S]*const setValue = \(value, opts = \{\}\) => \{[\s\S]*if \(frontMatterVisible && frontMatterManager\) \{/,
  'page markdown should bypass front matter parsing and rebuilding while the panel is hidden'
);

assert.match(
  editorMainSource,
  /const tabsMetadataManager = \(\(\) => \{[\s\S]*className = 'frontmatter-section';[\s\S]*className = 'frontmatter-grid';[\s\S]*className = 'frontmatter-field frontmatter-field-text';[\s\S]*dataset\.fieldId = 'tabs-title';[\s\S]*setChangeHandler: \(fn\) => \{[\s\S]*setValue: \(value, opts = \{\}\) => \{[\s\S]*emitChange\(\);/,
  'markdown editor should define a tabs metadata manager that reuses the frontmatter panel shell and field styling'
);

assert.match(
  editorMainSource,
  /const primaryEditorApi = \{[\s\S]*setTabsMetadata: \(value, opts = \{\}\) => tabsMetadataManager && tabsMetadataManager\.setValue\(value, opts\),[\s\S]*onTabsMetadataChange: \(fn\) => \{[\s\S]*tabsMetadataChangeListeners\.add\(fn\);/,
  'primary editor API should expose tabs metadata setters and change subscriptions'
);

assert.match(
  source,
  /function inferMarkdownSourceFromPath\(path\) \{[\s\S]*node && node\.source[\s\S]*startsWith\('tab\/'\) \? 'tabs' : 'index';/,
  'composer should infer whether an opened markdown file comes from tabs.yaml or index.yaml'
);

assert.match(
  source,
  /function deriveDynamicTabIdentity\(path, options = \{\}\) \{[\s\S]*const explicitLookupKey = String\(opts\.lookupKey \|\| ''\)\.trim\(\);[\s\S]*const source = String\([\s\S]*opts\.source[\s\S]*inferMarkdownSourceFromPath\(normalizedPath\)[\s\S]*const lookupKey = explicitLookupKey \|\| \(\(source === 'tabs' && key && lang\)/,
  'composer should preserve explicit file-source identity and persisted lookup keys for dynamic markdown tabs'
);

assert.match(
  source,
  /\$\('\.ct-edit', block\)\.addEventListener\('click', \(\) => \{[\s\S]*const rel = normalizeRelPath\(v\.location\);[\s\S]*openMarkdownInEditor\(rel, \{[\s\S]*source: 'tabs',[\s\S]*key,[\s\S]*lang,[\s\S]*editorTreeNodeId: `tabs:\$\{key\}:\$\{lang\}`[\s\S]*\}\);/,
  'page list edit actions should pass tabs identity when opening the markdown editor'
);

assert.match(
  source,
  /if \(!api \|\| typeof api\.onTabsMetadataChange !== 'function'\) return;[\s\S]*detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\) \{[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'composer should subscribe to tabs metadata changes and write title edits back into tabs state'
);

assert.match(
  editorSource,
  /\.editor-content-shell\.box \{[\s\S]*padding:0;[\s\S]*border:0 !important;[\s\S]*background:transparent;[\s\S]*\.editor-structure-panel \{ min-width:0; border:0; border-radius:0; background:transparent; padding:0; \}/,
  'editor structure view should not render extra outer card containers around the content'
);

assert.match(
  editorSource,
  /\.editor-structure-panel\.is-content-entering \.editor-panel-head,[\s\S]*\.editor-structure-panel\.is-content-entering \.editor-structure-body \{ animation:editor-structure-content-enter \.2s ease-out both; \}[\s\S]*@keyframes editor-structure-content-enter/,
  'editor structure panel content should animate in when the selected tree node changes'
);

assert.match(
  editorSource,
  /\.editor-structure-head \{ display:flex; justify-content:space-between; align-items:center;[\s\S]*\.editor-structure-title-row \{ display:flex; align-items:baseline;[\s\S]*\.editor-structure-kicker \{ display:none !important; \}/,
  'editor structure header should hide the kicker and place the item count beside the title'
);

assert.match(
  editorSource,
  /class="editor-panel-heading editor-structure-heading"[\s\S]*class="editor-structure-title-row"[\s\S]*id="editorStructureTitle"[\s\S]*id="editorStructureMeta"/,
  'editor structure header markup should group the title and metadata in one row'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel\.is-content-entering > \.toolbar,[\s\S]*\.editor-markdown-panel\.is-content-entering \.editor-workspace \{ animation:editor-structure-content-enter \.2s ease-out both; \}/,
  'markdown editor panel should animate in when a file is opened from the tree'
);

assert.match(
  source,
  /function animateEditorStructurePanelContent\(panel\) \{[\s\S]*panel\.classList\.remove\('is-content-entering'\);[\s\S]*panel\.getBoundingClientRect\(\);[\s\S]*panel\.classList\.add\('is-content-entering'\);[\s\S]*function renderEditorStructurePanel\(node\) \{[\s\S]*const animate = \(\) => animateEditorStructurePanelContent\(panel\);/,
  'structure panel rendering should restart the content transition after replacing panel contents'
);

assert.match(
  source,
  /function animateEditorMarkdownPanelContent\(\) \{[\s\S]*document\.getElementById\('editorMarkdownPanel'\)[\s\S]*panel\.classList\.add\('is-content-entering'\);/,
  'markdown editor panel animation helper should restart the content transition class'
);

assert.match(
  source,
  /pushEditorCurrentFileInfo\(tab\);\s*animateEditorMarkdownPanelContent\(\);/,
  'opening a markdown file should restart the editor panel transition after current file info is pushed'
);

assert.match(
  hiEditorSource,
  /function findVerticalScrollParent\(node\) \{[\s\S]*document\.getElementById\('editorContentPane'\)[\s\S]*function forwardVerticalWheel\(event\) \{[\s\S]*absX > absY && scroll\.scrollWidth > scroll\.clientWidth \+ 1[\s\S]*scrollParent\.scrollTop = before \+ deltaY;[\s\S]*event\.preventDefault\(\);[\s\S]*scroll\.addEventListener\('wheel', forwardVerticalWheel, \{ passive: false \}\);/,
  'hidden-overflow markdown editor should forward vertical wheel gestures to the right content pane while preserving horizontal code scrolling'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-workspace-meta \{[\s\S]*order:-1;/,
  'front matter panel should not be reordered above the markdown editor on narrow layouts'
);

assert.match(
  editorSource,
  /\.editor-tree-row \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-toggle \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-node \{[\s\S]*min-height:1\.75rem/,
  'file tree should use compact file-browser row heights'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-expanding \{[^}]*animation:editor-tree-row-enter \.18s ease-out both;[\s\S]*\.editor-tree-row\.is-collapsing \{[^}]*overflow:hidden;[^}]*transition:max-height \.26s ease/,
  'file tree expand and collapse states should animate row entrance and exit'
);

assert.match(
  source,
  /function animateEditorTreeCollapse\(root, node, row\) \{[\s\S]*collectEditorTreeDescendantRows\(row\)[\s\S]*descendant\.style\.maxHeight = `\$\{height\}px`;[\s\S]*window\.requestAnimationFrame\(collapseRows\)[\s\S]*window\.setTimeout\(finish, 340\)/,
  'file tree collapse should animate visible descendant rows before refreshing the tree'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{[^}]*font-weight:700; \}[\s\S]*\.editor-tree-label \{[^}]*font-weight:400; \}[\s\S]*\.editor-tree-row\[data-kind="root"\] \.editor-tree-label \{ font-weight:700; \}/,
  'file tree root labels should be bold while leaf labels keep normal text weight'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-leaf \.editor-tree-node \{ grid-column:1 \/ -1; \}/,
  'file tree leaf nodes should not reserve a separate empty toggle column'
);

assert.doesNotMatch(
  source + editorSource,
  /editor-tree-spacer/,
  'file tree leaf nodes should not render a fake spacer toggle'
);

assert.match(
  source,
  /const rowIndent = hasChildren[\s\S]*\? Math\.max\(0, depth\) \* 1\.12[\s\S]*: Math\.max\(0, depth - 1\) \* 1\.12 \+ 1\.35;/,
  'file tree leaf rows should align their content with the parent node text instead of a blank toggle'
);

assert.match(
  source,
  /if \(depth > 0\) \{[\s\S]*guides\.className = 'editor-tree-guides';[\s\S]*for \(let guideIndex = 0; guideIndex < depth; guideIndex \+= 1\) \{[\s\S]*guide\.className = 'editor-tree-guide';[\s\S]*guide\.style\.setProperty\('--tree-guide-index', String\(guideIndex\)\);/,
  'file tree rows should render guide lines for every ancestor depth so outer rails continue through nested rows'
);

assert.match(
  source,
  /let toggle = null;[\s\S]*if \(hasChildren\) \{[\s\S]*toggle = document\.createElement\('button'\);[\s\S]*if \(toggle\) row\.appendChild\(toggle\);/,
  'file tree should only render expand controls for nodes with children'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-row\.is-selected \{[^}]*background:/,
  'selected file tree rows should not use a full-row highlight background'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-node \{[^}]*border:1px/,
  'file tree nodes should not use button-like blue outlines'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-toggle, #editorFileTree button\.editor-tree-node \{ appearance:none !important; border:0 !important; border-color:transparent !important; box-shadow:none !important; outline:0 !important; background:transparent !important; background-image:none !important; color:inherit !important; font-weight:inherit !important; \}/,
  'file tree buttons should override native theme global button borders'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-node:hover, #editorFileTree button\.editor-tree-node:focus-visible \{ background:color-mix\(in srgb, var\(--text\) 5%, transparent\) !important; color:inherit !important; box-shadow:none !important; outline:0 !important; \}/,
  'file tree hover and focus states should remain borderless'
);

assert.doesNotMatch(
  editorSource,
  /editor-tree-row\[draggable="true"\]|editor-tree-row\.is-drop-target/,
  'file tree should not expose drag/drop reordering states'
);

assert.doesNotMatch(
  source,
  /row\.draggable|bindEditorTreeDrag|canMoveEditorTreeNode|moveEditorTreeNode|editorTreeDragNodeId/,
  'file tree rows should not support direct drag/drop reordering'
);

assert.doesNotMatch(
  source,
  /const states = \[node\.draftState, node\.diffState, node\.fileState\]/,
  'file tree rows should not render the old positional draft/diff/file status dots'
);

assert.match(
  source,
  /function createEditorTreeStatusElement\(node\) \{[\s\S]*editor-tree-status[\s\S]*editor-tree-change-badge[\s\S]*editor-tree-count-badge[\s\S]*editor-tree-order-badge[\s\S]*editor-tree-spinner/,
  'file tree rows should render readable change, count, order, and checking status elements from one helper'
);

assert.match(
  source,
  /editor-tree-order-badge[\s\S]*<svg viewBox="0 0 24 24" focusable="false">[\s\S]*M3 9l4 -4l4 4m-4 -4v14[\s\S]*M21 15l-4 4l-4 -4m4 4v-14/,
  'file tree order badges should use an inline arrows-sort SVG icon instead of a text glyph'
);

assert.match(
  source,
  /status\.setAttribute\('aria-hidden', 'true'\);/,
  'file tree visual status badges should be hidden from assistive tech because the row aria-label carries the summary'
);

assert.match(
  source,
  /button\.appendChild\(createEditorTreeStatusElement\(node\)\);/,
  'file tree rows should append the unified status element instead of individual status dots'
);

assert.match(
  source,
  /button\.setAttribute\('aria-label', getEditorTreeAccessibleLabel\(node, labelText, accessiblePath\)\);/,
  'file tree row aria labels should include the computed status summary'
);

assert.match(
  source,
  /function handleEditorTreeSelection\(nodeId\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*applyMode\('editor', \{ forceStructure: true \}\);[\s\S]*refreshEditorContentTree\(\);[\s\S]*return;[\s\S]*if \(node\.kind === 'file' && node\.path\)/,
  'selecting deleted tombstones should route to the read-only structure panel before file nodes can open markdown'
);

assert.match(
  source,
  /function renderEditorStructurePanel\(node\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*renderEditorDeletedPanel\(node, \{ title, kicker, meta, actions, body \}\);[\s\S]*return;[\s\S]*if \(node\.kind === 'root'\)/,
  'deleted tombstones should render a read-only deleted panel before editable entry/language panels are considered'
);

assert.match(
  source,
  /function restoreDeletedEditorTreeNode\(node\) \{[\s\S]*node\.deletedKind[\s\S]*restoreValue[\s\S]*notifyComposerChange\(node\.source\)[\s\S]*refreshEditorContentTree\(\);/,
  'deleted tombstones should have an explicit restore action that writes restored baseline payloads'
);

assert.match(
  source,
  /const visibleChildren = node\.children\.filter\(child => !child\.isDeleted\);[\s\S]*visibleChildren\.forEach/,
  'root structure reorder lists should exclude deleted tombstones from draggable current-order rows'
);

const deletedPanelBody = extractFunctionBody(source, 'renderEditorDeletedPanel');
assert.doesNotMatch(
  deletedPanelBody,
  /getIndexEntry|getTabsEntry|appendLanguageSelector|addEditorVersion|renderEditorEntryPanel|renderEditorLanguagePanel/,
  'deleted tombstone panel should not call editable entry/language helpers that create missing state as a side effect'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-badge/,
  'editor tree CSS should not keep the old anonymous dot badge styles'
);

assert.match(
  editorSource,
  /\.editor-tree-status \{[\s\S]*\.editor-tree-change-badge \{[\s\S]*\.editor-tree-count-badge \{[\s\S]*\.editor-tree-order-badge \{[\s\S]*\.editor-tree-order-badge svg \{[\s\S]*\.editor-tree-spinner \{/,
  'editor tree CSS should define readable status badges, order badges, and checking spinners'
);

assert.match(
  editorSource,
  /@keyframes editor-tree-spinner-spin[\s\S]*@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.editor-tree-spinner \{ animation:none;/,
  'editor tree checking spinner should stop animating for reduced-motion users'
);

assert.match(
  editorSource,
  /#editorFileTree \.editor-tree-row\.is-selected > button\.editor-tree-node \{ background:color-mix\(in srgb, var\(--primary\) 18%, transparent\) !important;[\s\S]*color:color-mix\(in srgb, var\(--primary\) 86%, var\(--text\)\) !important; \}/,
  'selected file tree state should use a pale file-browser fill on the node button'
);

assert.match(
  source,
  /function isEditorTreeFileKind\(kind\) \{[\s\S]*kind === 'file' \|\| kind === 'deleted-file'[\s\S]*function createEditorTreeIcon\(node\) \{[\s\S]*const isFile = isEditorTreeFileKind\(node\.kind\);[\s\S]*let iconKind = isFile \? 'document' : 'folder';[\s\S]*node\.id === 'system:site-settings'[\s\S]*iconKind = 'settings';[\s\S]*node\.id === 'system:updates'[\s\S]*iconKind = 'updates';[\s\S]*node\.id === 'system:sync'[\s\S]*iconKind = 'publish';[\s\S]*editor-tree-icon-\$\{iconKind\}/,
  'file tree should render folder/document icons and dedicated system action icons'
);

assert.doesNotMatch(
  source,
  /className = 'editor-tree-path'/,
  'file tree should keep paths out of visible node text'
);

assert.match(
  editorSource,
  /\.editor-tree-guides \{ position:absolute; inset:-\.12rem 0; pointer-events:none; \}[\s\S]*\.editor-tree-guide \{[\s\S]*left:calc\(\(var\(--tree-guide-index\) \* 1\.12rem\) \+ \.58rem\);[\s\S]*background:color-mix\(in srgb, var\(--border\) 82%, transparent\)/,
  'nested file tree rows should draw subtle vertical guide lines for all ancestor levels'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{ padding-left:\.45rem; font-weight:700; \}/,
  'root file tree labels should have enough left inset inside the selected pill'
);

[enI18nSource, chsI18nSource, chtTwI18nSource, chtHkI18nSource, jaI18nSource].forEach((i18nText, index) => {
  assert.match(
    i18nText,
    /status:\s*\{[\s\S]*added:[\s\S]*modified:[\s\S]*deleted:[\s\S]*checking:[\s\S]*changedCount:[\s\S]*changedSummary:[\s\S]*orderChanged:[\s\S]*deletedSummary:/,
    `locale ${index} should expose editor tree status badge text`
  );
});

[enI18nSource, chsI18nSource, chtTwI18nSource, jaI18nSource].forEach((i18nText, index) => {
  assert.match(
    i18nText,
    /replaceImage:/,
    `locale ${index} should expose image replacement toolbar text`
  );
});

assert.doesNotMatch(
  editorSource,
  /id="modeDynamicTabs"/,
  'editor should not render visible dynamic markdown tabs'
);

assert.doesNotMatch(
  editorSource,
  /data-cfile="index"|data-cfile="tabs"|id="btnAddItem"/,
  'site settings should not expose Articles/Pages file switching or Add Post Entry controls'
);

assert.match(
  source,
  /function getComposerDiffChangeCount\(diff\) \{[\s\S]*Object\.keys\(diff\.fields\)[\s\S]*Object\.keys\(diff\.keys\)[\s\S]*diff\.orderChanged/,
  'composer file dirty badges should derive a numeric count from the current diff'
);

assert.match(
  source,
  /function updateFileDirtyBadge\(kind\) \{[\s\S]*const changeCount = getComposerDiffChangeCount\(diff\);[\s\S]*badge\.textContent = displayValue;[\s\S]*el\.dataset\.dirtyCount = String\(changeCount\);/,
  'composer file switch dirty badges should render the change count into the button'
);

assert.match(
  source,
  /import \{ buildEditorContentTree, findEditorContentTreeNode, flattenEditorContentTree \} from '\.\/editor-content-tree\.js';/,
  'composer should use the shared editor content tree model'
);

assert.match(
  source,
  /let activeMarkdownDocument = null;/,
  'markdown editor should track a single active document instead of visible tab state'
);

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*treeText\('fieldTitle', 'Title'\)/,
  'page structure rows should no longer render a standalone title field label'
);

const initialBootIndex = source.indexOf('Apply initial state as early as possible');
const initialBootBlock = initialBootIndex >= 0
  ? source.slice(initialBootIndex, source.indexOf('// Robust clipboard helper', initialBootIndex))
  : '';
assert.doesNotMatch(
  initialBootBlock,
  /applyMode\('composer'\)/,
  'initial editor boot should not force Site Settings before the file tree is rendered'
);

assert.match(
  source,
  /function getOrCreateDynamicMode\(path, options = \{\}\) \{[\s\S]*const identity = deriveDynamicTabIdentity\(path, options\);[\s\S]*const existing = dynamicEditorTabsByLookupKey\.get\(identity\.lookupKey\);[\s\S]*button: null,[\s\S]*dynamicEditorTabs\.set\(modeId, data\);[\s\S]*dynamicEditorTabsByLookupKey\.set\(identity\.lookupKey, modeId\);/,
  'markdown document state should no longer create visible dynamic tab buttons'
);

assert.match(
  source,
  /function openMarkdownInEditor\(path, options = \{\}\) \{[\s\S]*flushMarkdownDraft\(active\);[\s\S]*const modeId = getOrCreateDynamicMode\(path, options\);[\s\S]*applyMode\(modeId\);/,
  'switching files from the tree should flush the current markdown draft before opening the next file'
);

assert.match(
  source,
  /function persistDynamicEditorState\(\) \{[\s\S]*const open = Array\.from\(dynamicEditorTabs\.values\(\)\)[\s\S]*lookupKey: tab\.lookupKey \|\| tab\.path,[\s\S]*path: tab\.path,[\s\S]*activeLookupKey: active && \(active\.lookupKey \|\| active\.path\) \? \(active\.lookupKey \|\| active\.path\) : null,[\s\S]*activePath: active && active\.path \? active\.path : null,[\s\S]*expandedNodeIds: Array\.from\(expandedEditorTreeNodeIds\)\.filter\(Boolean\),/,
  'dynamic markdown session state should persist opened files with stable lookup keys, plus active file identity and exact tree expansion'
);

assert.match(
  source,
  /function restoreDynamicEditorState\(\) \{[\s\S]*const open = Array\.isArray\(data\.open\) \? data\.open : \[\];[\s\S]*const lookupKey = item && typeof item === 'object'[\s\S]*const path = item && typeof item === 'object'[\s\S]*getOrCreateDynamicMode\(path, \{[\s\S]*source:[\s\S]*key:[\s\S]*lang:[\s\S]*editorTreeNodeId:[\s\S]*lookupKey[\s\S]*\}\);[\s\S]*expandedEditorTreeNodeIds\.clear\(\);[\s\S]*const activeLookupKey = String\(data\.activeLookupKey \|\| ''\)\.trim\(\);[\s\S]*const activePath = data\.activePath \? normalizeRelPath\(data\.activePath\) : '';[\s\S]*if \(\(isV3 \? data\.mode === 'markdown' : true\) && \(activeLookupKey \|\| activePath\)\) \{[\s\S]*const modeId = \(activeLookupKey && dynamicEditorTabsByLookupKey\.get\(activeLookupKey\)\)[\s\S]*\|\| \(activePath && dynamicEditorTabsByLookupKey\.get\(activePath\)\)[\s\S]*\|\| \(activePath \? getOrCreateDynamicMode\(activePath\) : null\);[\s\S]*applyMode\(modeId, \{ preserveTreeExpansion: true, restoreScroll: true \}\);/,
  'dynamic markdown session restore should recreate open files and active file identity with stable lookup keys'
);

assert.match(
  source,
  /refreshEditorContentTree\(\);\s*const restoredEditorState = restoreDynamicEditorState\(\);\s*if \(!restoredEditorState\) applyMode\('editor'\);\s*allowEditorStatePersist = true;/,
  'editor boot should restore dynamic markdown session state before falling back to the file tree'
);

assert.match(
  editorSource,
  /\.current-file \.cf-breadcrumb \{[\s\S]*gap:\.35rem;[\s\S]*\.current-file \.cf-breadcrumb-separator \{[\s\S]*margin:0 -\.35rem;[\s\S]*\.current-file \.cf-breadcrumb-item \{[\s\S]*color:#57606a;[\s\S]*\.current-file \.cf-breadcrumb-item-current \{[\s\S]*background:transparent;[\s\S]*color:var\(--text\);/,
  'current file indicator should render static gray breadcrumbs with a darker current item'
);

assert.doesNotMatch(
  editorMainSource,
  /<button type="button" class="cf-breadcrumb-item/,
  'current file breadcrumb should not use native buttons that inherit the bordered toolbar style'
);

assert.doesNotMatch(
  editorMainSource,
  /<a href="#" class="cf-breadcrumb-item\$\{currentClass\}"[\s\S]*data-current-file-node-id=/,
  'current file breadcrumb should no longer render clickable links'
);

assert.match(
  editorMainSource,
  /const normalizeCurrentFileBreadcrumb = \(value, fallbackPath = ''\) => \{[\s\S]*const renderCurrentFileBreadcrumb = \(items, fullPath\) => \{[\s\S]*<span class="cf-breadcrumb-item cf-breadcrumb-item-static\$\{currentClass\}"\$\{ariaCurrent\}>/,
  'current file indicator should normalize and emit static breadcrumb entries'
);

assert.match(
  source,
  /function buildCurrentFileBreadcrumb\(tab\) \{[\s\S]*ids\.push\('articles', `index:\$\{node\.key\}`, `index:\$\{node\.key\}:\$\{node\.lang\}`, node\.id\);/,
  'composer should pass abstract article/page breadcrumb segments to the editor header'
);

assert.match(
  source,
  /breadcrumb: buildCurrentFileBreadcrumb\(tab\),/,
  'composer should include the current file breadcrumb in the editor header payload'
);

assert.match(
  source,
  /ns-editor-current-file-breadcrumb-select[\s\S]*handleEditorTreeSelection\(nodeId\);/,
  'composer should route current-file breadcrumb clicks through the editor tree selection handler'
);

assert.match(
  source,
  /function applyMode\(mode, options = \{\}\) \{[\s\S]*mode === 'editor' && dynamicEditorTabs\.size && !options\.forceStructure/,
  'editor structure selection should be able to bypass dynamic markdown document restoration'
);

assert.match(
  source,
  /function showEditorSystemPanel\(mode\) \{[\s\S]*mode === 'sync' \? 'sync'[\s\S]*editorSystemActions[\s\S]*editorModalSyncActions[\s\S]*mode-composer[\s\S]*mode-updates[\s\S]*mode-sync[\s\S]*\['sync', syncActions\]/,
  'Site Settings, NanoSite Updates, and Sync should render through the inline system panel'
);

const showEditorSystemPanelBody = source.slice(
  source.indexOf('function showEditorSystemPanel(mode) {'),
  source.indexOf('function getEditorOverlayTitle(mode)')
);

assert.doesNotMatch(
  showEditorSystemPanelBody,
  /actions\.innerHTML = ''/,
  'switching inline system panels should not destroy migrated action buttons'
);

assert.match(
  showEditorSystemPanelBody,
  /if \(actionSet\.parentElement !== actions\) actions\.appendChild\(actionSet\);[\s\S]*actionSet\.hidden = !active;/,
  'inline system panel actions should be reparented without deleting the ZIP selection button'
);

assert.match(
  source,
  /const isSystemMode = \(value\) => value === 'composer' \|\| value === 'updates' \|\| value === 'sync';[\s\S]*const nextMode = \(candidate === 'editor' \|\| isSystemMode\(candidate\) \|\| isDynamicMode\(candidate\)\)[\s\S]*setEditorDetailPanelMode\(nextMode\);/,
  'opening Site Settings, NanoSite Updates, or Sync should switch to the inline system detail panel'
);

const refreshEditorContentTreeBody = source.slice(
  source.indexOf('function refreshEditorContentTree(options = {}) {'),
  source.indexOf('function createEditorTreeIcon(node)')
);

assert.doesNotMatch(
  refreshEditorContentTreeBody,
  /currentMode === 'composer' \|\| currentMode === 'updates'[\s\S]*setEditorDetailPanelMode\(currentMode\)/,
  'refreshing tree badges while editing site settings should not replay the inline system panel animation'
);

assert.match(
  source,
  /function initEditorRailResize\(\) \{[\s\S]*EDITOR_RAIL_WIDTH_KEY[\s\S]*pointerdown[\s\S]*setEditorRailWidth\([^)]*\{ persist: true \}/,
  'desktop editor rail should be resizable and persist its width'
);

assert.match(
  source,
  /function getEditorRailToggles\(\) \{[\s\S]*document\.querySelectorAll\('\[data-editor-rail-toggle\]'\)[\s\S]*function setEditorRailOpen\(open\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.setAttribute\('aria-expanded', shouldOpen \? 'true' : 'false'\);[\s\S]*function initMobileEditorRail\(\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*if \(!toggles\.length\) return;[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.addEventListener\('click', \(\) => \{[\s\S]*setEditorRailOpen\(!isOpen\);/,
  'mobile editor rail should bind every shared drawer toggle and sync expanded state'
);

assert.match(
  source,
  /function handleEditorTreeSelection\(nodeId\) \{[\s\S]*applyMode\('editor', \{ forceStructure: true \}\);[\s\S]*refreshEditorContentTree\(\);/,
  'selecting non-file tree nodes should hide the markdown editor and show the structure panel'
);

assert.doesNotMatch(
  source,
  /dataset\.fileLabel/,
  'composer file switch dirty labels should not cache translated tab text across language changes'
);

assert.match(
  source,
  /function refreshFileDirtyBadges\(\) \{[\s\S]*updateFileDirtyBadge\('index'\);[\s\S]*updateFileDirtyBadge\('tabs'\);[\s\S]*updateFileDirtyBadge\('site'\);[\s\S]*document\.addEventListener\('ns-editor-language-applied', refreshFileDirtyBadges\)/,
  'composer file switch dirty labels should be recomputed after editor language changes'
);

assert.match(
  source,
  /const renderIdentityLocalizedGrid = \(section\) => \{/,
  'composer site editor should define a merged identity localized grid renderer'
);

assert.match(
  source,
  /renderIdentityLocalizedGrid\(identitySection\);/,
  'Identity section should render title and subtitle through the merged grid'
);

assert.match(
  source,
  /renderIdentityPathGrid\(identitySection\);/,
  'Identity section should render avatar and content root through a compact path grid'
);

assert.match(
  source,
  /const siteConfigSection = createSection\([\s\S]*sections\.configuration\.title[\s\S]*sections\.configuration\.description[\s\S]*createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.behavior\.title[\s\S]*renderBehaviorGrid\(behaviorSubsection\);/,
  'Behavior settings should render inside the combined Site Configuration section'
);

assert.match(
  source,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.theme\.title[\s\S]*renderThemeGrid\(themeSubsection\);/,
  'Theme settings should render inside the combined Site Configuration section'
);

assert.match(
  source,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.assets\.title[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);/,
  'Asset warnings should render inside the combined Site Configuration section'
);

assert.match(
  source,
  /renderSeoResourceGrid\(seoSection\);/,
  'SEO Resource URL should render through the compact grid'
);

assert.match(
  source,
  /renderLocalizedField\(seoSection, 'siteKeywords'[\s\S]*createLinkListField\(seoSection, 'profileLinks'[\s\S]*renderSeoResourceGrid\(seoSection\);/,
  'SEO section should render Profile links before Resource URL'
);

assert.match(
  source,
  /createLinkListField\(seoSection, 'profileLinks', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO Profile links should opt into the shared subsection heading style'
);

assert.match(
  source,
  /const appendLinkHeader = \(\) => \{[\s\S]*head\.className = 'cs-link-head';[\s\S]*labelTitle\.id = labelTitleId;[\s\S]*hrefTitle\.id = hrefTitleId;[\s\S]*listWrap\.appendChild\(head\);[\s\S]*appendLinkHeader\(\);[\s\S]*list\.forEach/,
  'profile link Name and URL labels should render in a static header outside draggable rows'
);

assert.match(
  source,
  /const renderRowsAndRefreshDiff = \(\) => \{[\s\S]*renderRows\(\);[\s\S]*notifyComposerChange\('site', \{ skipAutoSave: true \}\);[\s\S]*\};[\s\S]*moveEntry\(index, event\.key === 'ArrowUp' \? index - 1 : index \+ 1, \{ refreshDiff: true \}\);[\s\S]*renderRowsAndRefreshDiff\(\);/,
  'profile link reorders should refresh site diff markers after replacing row DOM'
);

assert.doesNotMatch(
  source,
  /row\.classList\.add\('cs-link-row--with-title'\)|labelField\.append\(labelTitle, labelInput\)|hrefField\.append\(hrefTitle, hrefInput\)/,
  'profile link draggable rows should not own the static Name and URL labels'
);

assert.match(
  source,
  /const moveEntry = \(from, to, options = \{\}\) => \{[\s\S]*list\.splice\(to, 0, item\);[\s\S]*markDirty\(\);[\s\S]*if \(options\.refreshDiff\) renderRowsAndRefreshDiff\(\);[\s\S]*else renderRows\(\);[\s\S]*const createDragHandle = \(index\) => \{/,
  'profile links should share one reorder path between drag handles and keyboard movement'
);

assert.match(
  source,
  /const handle = document\.createElement\('span'\);[\s\S]*handle\.setAttribute\('role', 'button'\);[\s\S]*handle\.className = 'cs-link-drag-handle';[\s\S]*handle\.setAttribute\('aria-label', t\('editor\.composer\.site\.reorderLink'\)\);[\s\S]*handle\.addEventListener\('pointerdown',/,
  'profile links should render a standalone pointer drag handle for reordering'
);

assert.match(
  source,
  /const createDragPlaceholder = \(row\) => \{[\s\S]*placeholder\.className = 'cs-link-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{rowRect\.height\}px`;/,
  'profile link drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  source,
  /const animateLinkRows = \(callback\) => \{[\s\S]*getBoundingClientRect\(\)[\s\S]*row\.style\.transform = `translate3d\(0, \$\{previous\.top - next\.top\}px, 0\)`[\s\S]*requestAnimationFrame/,
  'profile link drag should animate non-dragged rows into their preview positions'
);

assert.match(
  source,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*linkDragState\.dragRow\.style\.transform = `translate3d\(0, \$\{clientY - linkDragState\.startY\}px, 0\)`[\s\S]*animateLinkRows\(\(\) => \{/,
  'profile link drag should move the dragged row with the pointer while previewing the drop position'
);

assert.doesNotMatch(
  source,
  /className = 'btn-tertiary cs-move'|addEventListener\('click', \(\) => moveEntry\(index, index [-+] 1\)\)/,
  'profile links should not render old up/down reorder buttons'
);

assert.match(
  source,
  /const moveStructureRootEntry = \(source, from, to\) => \{[\s\S]*const order = Array\.isArray\(state\.__order\) \? state\.__order : \[\];[\s\S]*const \[key\] = order\.splice\(from, 1\);[\s\S]*order\.splice\(to, 0, key\);[\s\S]*notifyComposerChange\(source\);[\s\S]*refreshEditorContentTree\(\);/,
  'structure panels should reorder the backing root order and refresh the content tree'
);

assert.match(
  source,
  /const dragController = createEditorStructureDragController\(list,[\s\S]*const createStructureDragHandle = \(child, index, source\) => \{[\s\S]*const labelKey = source === 'tabs' \? 'reorderPage' : 'reorderArticle';[\s\S]*return dragController\.createHandle\(index, treeText\(labelKey, source === 'tabs' \? 'Reorder page' : 'Reorder article'\)\);/,
  'article and page structure rows should render a standalone drag handle with pointer and keyboard reorder hooks'
);

assert.match(
  source,
  /const renderStructureDraggableItem = \(child, detail, index, source\) => \{[\s\S]*item\.className = 'editor-structure-item editor-structure-item--draggable';[\s\S]*const handle = createStructureDragHandle\(child, index, source\);[\s\S]*item\.append\(handle, main, controls\);/,
  'article and page structure rows should compose handle, content, and actions as separate elements'
);

assert.match(
  source,
  /const createPlaceholder = \(item\) => \{[\s\S]*placeholder\.className = 'editor-structure-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{itemRect\.height\}px`;/,
  'article structure drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  source,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*dragState\.dragItem\.style\.transform = `translate3d\(0, \$\{clientY - dragState\.startY\}px, 0\)`[\s\S]*animateRows\(\(\) => \{/,
  'structure drag should move the dragged row with the pointer while previewing the drop position'
);

assert.match(
  source,
  /if \(node\.source === 'index' \|\| node\.source === 'tabs'\) \{[\s\S]*visibleChildren\.forEach\(\(child, index\) => \{[\s\S]*renderStructureDraggableItem\(child, `\$\{child\.children\.length\} \$\{treeText\('languages', 'languages'\)\}`, index, node\.source\)/,
  'articles and pages root panels should both use draggable structure rows for non-deleted current entries'
);

assert.doesNotMatch(
  source,
  /class="ct-field ct-field-title"|const titleLabel = tComposerLang\('fields\.title'\)|const titleInput = \$\('\.ct-title', block\)|entry\[lang\]\.title = e\.target\.value/,
  'page entry structure rows should no longer render editable title inputs once title moves into the markdown editor metadata panel'
);

assert.doesNotMatch(
  source,
  /<input class="ct-loc"|const pathPlaceholder = tComposerLang\('placeholders\.tabPath'\)|const locInput = \$\('\.ct-loc', block\)|entry\[lang\]\.location = e\.target\.value/,
  'page entry lists should no longer render editable location inputs for tabs languages'
);

assert.doesNotMatch(
  source,
  /editor-structure-item[^\\n]*addEventListener\('pointerdown'|item\.setAttribute\('draggable', 'true'\)|className = 'btn-secondary editor-structure-move'/,
  'structure reordering should not start from the whole row or restore legacy move buttons'
);

assert.match(
  source,
  /renderLocalizedField\(seoSection, 'siteDescription', \{[\s\S]*subheading: true[\s\S]*\}\);[\s\S]*renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO localized fields should opt into the shared subsection heading style'
);

assert.match(
  source,
  /const field = options\.subheading[\s\S]*createSubheadingField\(section, \{[\s\S]*dataKey: key,[\s\S]*label: options\.label,[\s\S]*description: options\.description[\s\S]*createField\(section, \{/,
  'localized fields should be able to reuse the shared subsection heading renderer'
);

assert.match(
  source,
  /const createSubheadingField = \(section, config\) => \{[\s\S]*head\.className = 'cs-config-subsection-head'[\s\S]*title\.className = 'cs-config-subsection-title'[\s\S]*description\.className = 'cs-config-subsection-description'/,
  'subheading fields should reuse the same title and description classes as combined configuration subsections'
);

assert.doesNotMatch(
  source,
  /renderLocalizedField\(identitySection,\s*'siteTitle'/,
  'Identity section should not render siteTitle as a standalone localized field'
);

assert.doesNotMatch(
  source,
  /renderLocalizedField\(identitySection,\s*'siteSubtitle'/,
  'Identity section should not render siteSubtitle as a standalone localized field'
);

assert.doesNotMatch(
  source,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'avatar'/,
  'Avatar should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  source,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'contentRoot'/,
  'Content root should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  source,
  /createTextField\(seoSection,\s*\{\s*dataKey: 'resourceURL'/,
  'Resource URL should not use the tall standalone text field layout'
);

assert.match(
  source,
  /\.cs-identity-grid/,
  'composer stylesheet should include identity grid layout rules'
);

assert.match(
  source,
  /grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\)/,
  'desktop identity grid should make the title column one quarter of the title/subtitle input area'
);

assert.match(
  source,
  /siteTitle\|siteSubtitle/,
  'diff and reveal handling should recognize the combined identity field'
);

assert.match(
  source,
  /const useLocalizedGrid = !!\(options\.grid \|\| options\.multiline\);/,
  'localized fields should have an explicit grid option shared by keywords and multiline fields'
);

assert.match(
  source,
  /renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*grid: true,[\s\S]*ensureDefault: false/,
  'Site keywords should opt into the aligned localized grid layout'
);

assert.match(
  source,
  /if \(useLocalizedGrid\) row\.classList\.add\('cs-localized-row--grid'\);[\s\S]*if \(options\.multiline\) row\.classList\.add\('cs-localized-row--multiline'\);/,
  'aligned localized fields should mark grid rows separately from multiline textarea behavior'
);

assert.match(
  source,
  /list\.className = useLocalizedGrid\s+\? 'cs-localized-list cs-localized-list--grid'\s+: 'cs-localized-list';/,
  'aligned localized fields should mark the list so row spacing can match the identity grid'
);

assert.match(
  source,
  /\.cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list\{--cs-editor-row-gap:\.35rem;--cs-editor-row-column-gap:\.45rem;--cs-editor-control-height:1\.95rem;--cs-editor-single-control-width:15rem\}/,
  'identity, aligned localized rows, and profile links should share one row rhythm and fixed single-control width contract'
);

assert.doesNotMatch(
  source,
  /\.(?:cs-root|cs-single-grid-fieldset)\{[^}]*--cs-editor-single-label-width/,
  'compact containers should not redeclare the measured label width because that masks the inherited dynamic value'
);

assert.match(
  source,
  /\.cs-localized-list--grid\{gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-localized-row--grid\{display:grid;grid-template-columns:minmax\(88px,88px\) minmax\(0,1fr\) minmax\(72px,max-content\);align-items:center;column-gap:var\(--cs-editor-row-column-gap\);row-gap:0;min-height:var\(--cs-editor-control-height\);padding:0/,
  'aligned localized rows should use the shared identity row density and reserve aligned input columns'
);

assert.match(
  source,
  /\.cs-identity-grid\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-identity-row\{display:grid;grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\);align-items:center;gap:var\(--cs-editor-row-column-gap\)\}/,
  'identity rows should consume the same row rhythm contract'
);

assert.match(
  source,
  /\.cs-localized-row--grid \.cs-lang-chip\{justify-self:end\}/,
  'aligned localized rows should right-align language chips within the language column'
);

assert.match(
  source,
  /\.cs-identity-lang\{min-width:0;display:flex;align-items:center;justify-content:flex-end\}/,
  'identity localized rows should right-align language chips within the language column'
);

assert.match(
  source,
  /const flag = langFlag\(lang\);[\s\S]*const flagSpan = flag \? `<span class="ci-lang-flag" aria-hidden="true">\$\{escapeHtml\(flag\)\}<\/span>` : '';[\s\S]*<strong class="ci-lang-label" aria-label="\$\{safeLabel\}" title="\$\{safeLabel\}">[\s\S]*<span class="ci-lang-code">\$\{escapeHtml\(lang\.toUpperCase\(\)\)\}<\/span>/,
  'index language section headings should show the regional flag before the language code'
);

assert.match(
  source,
  /\.ci-lang-label\{display:inline-flex;align-items:center;gap:\.35rem;line-height:1\.1;\}[\s\S]*\.ci-lang-label \.ci-lang-flag\{display:inline-grid;place-items:center;width:1\.2em;height:1\.2em;font-size:1rem;line-height:1;\}[\s\S]*\.ci-lang-label \.ci-lang-code\{display:inline-flex;align-items:center;line-height:1\.2;/,
  'index language section flags should be aligned as part of the compact heading label'
);

assert.doesNotMatch(
  source,
  /\.ci-item:hover[\s\S]*transform:translateY\(-1px\)|\.ci-item:hover[\s\S]*--ci-depth-shadow:0 12px 24px|\.ci-item:hover[\s\S]*border-color:color-mix/,
  'composer entry cards should not float, deepen shadow, or recolor border on hover'
);

assert.match(
  source,
  /\.ci-lang\{border:0;border-radius:0;margin:0;background:transparent;padding:\.65rem 0;\}[\s\S]*\.ci-lang\+\.ci-lang\{border-top:1px solid color-mix\(in srgb, var\(--border\) 82%, transparent\);\}/,
  'index language sections should read as separated rows instead of nested cards'
);

assert.match(
  source,
  /<button class="btn-secondary ci-expand"[\s\S]*<\/button>\s*<span class="ci-head-add-lang-slot"><\/span>\s*<button class="btn-secondary ci-del">/,
  'index add-language control should live in the entry header immediately after details'
);

assert.match(
  source,
  /const headAddLangSlot = \$\('\.ci-head-add-lang-slot', row\);[\s\S]*if \(headAddLangSlot\) headAddLangSlot\.innerHTML = '';[\s\S]*\(headAddLangSlot \|\| bodyInner\)\.appendChild\(addLangWrap\);/,
  'index add-language menu should be mounted into the header slot and refreshed with the body'
);

assert.match(
  source,
  /const handle = target\.closest\('\.ci-grip,\.ct-grip'\);[\s\S]*if \(!handle \|\| !container\.contains\(handle\)\) return;[\s\S]*const li = handle\.closest\(keySelector\);/,
  'composer entry reordering should start only from the visible drag handle'
);

assert.doesNotMatch(
  source.match(/function makeDragList\(container, onReorder\) \{[\s\S]*?\nfunction buildIndexUI\(root, state\) \{/)[0],
  /const li = target\.closest\(keySelector\);/,
  'composer entry reordering should not treat the entire card as a drag source'
);

assert.doesNotMatch(
  source.match(/function buildIndexUI\(root, state\) \{[\s\S]*?\nfunction buildTabsUI\(root, state\) \{/)[0],
  /bodyInner\.appendChild\(addLangWrap\);/,
  'index add-language control should not render at the bottom of the expanded language list'
);

assert.match(
  source,
  /const renderIdentityPathGrid = \(section\) => \{/,
  'composer site editor should define a compact identity path grid renderer'
);

assert.match(
  source,
  /const createSingleGridFieldset = \(section\) => \{/,
  'compact single-value sections should share one reusable grid fieldset renderer'
);

assert.match(
  source,
  /function syncSiteEditorSingleLabelWidth\(root\) \{[\s\S]*querySelectorAll\('\.cs-single-grid-title'\)[\s\S]*requestAnimationFrame[\s\S]*ResizeObserver[\s\S]*--cs-editor-single-label-width/,
  'compact single-value labels should be measured once after render and shared through a CSS variable'
);

assert.match(
  source,
  /label\.scrollWidth[\s\S]*getComputedStyle\(target\)[\s\S]*gap/,
  'compact single-value label measurement should use intrinsic label width instead of the currently constrained grid cell'
);

assert.match(
  source,
  /target\.querySelector \? target\.querySelector\('\.cs-help-tooltip'\) : null[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should measure only the help icon, not the tooltip wrapper'
);

assert.doesNotMatch(
  source,
  /querySelector\('\.cs-help-tooltip-wrap'\)[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should not include hidden tooltip bubble width'
);

assert.doesNotMatch(
  source,
  /function syncSiteEditorSingleLabelWidth\(root\) \{[\s\S]*getBoundingClientRect[\s\S]*root\.style\.setProperty\('--cs-editor-single-label-width'/,
  'compact single-value label measurement should not seed width from constrained layout rects'
);

assert.match(
  source,
  /buildSiteUI\(root, state\) \{[\s\S]*syncSiteEditorSingleLabelWidth\(root\);[\s\S]*refreshNavDiffState\(\);/,
  'site editor should resync the measured single-label width after rebuilding translated labels'
);

assert.match(
  source,
  /const renderSingleTextGrid = \(section, items\) => \{[\s\S]*createSingleGridFieldset\(section\)[\s\S]*input\.id = controlId;[\s\S]*input\.addEventListener\('input'/,
  'compact text rows should share one reusable single-grid text renderer'
);

assert.match(
  source,
  /const renderSeoResourceGrid = \(section\) => \{[\s\S]*dataKey: 'resourceURL'[\s\S]*fields\.resourceURLHelp/,
  'SEO Resource URL compact grid should preserve the field key and help tooltip text'
);

assert.doesNotMatch(
  source,
  /renderCompactSectionMenu|cs-mobile-section-nav|cs-nav-button/,
  'site settings should not render section navigation controls'
);

assert.match(
  source,
  /const resolveSiteScrollContainer = \(\) => \{[\s\S]*root \? root\.querySelector\('\.cs-viewport'\)[\s\S]*canOwnScroll[\s\S]*return viewport;[\s\S]*root\.closest\('\.editor-modal-body'\)[\s\S]*return modalBody;[\s\S]*return window;[\s\S]*\};/,
  'site settings scrolling should prefer the internal content viewport before falling back to the modal body'
);

assert.match(
  source,
  /const scrollContainer = resolveSiteScrollContainer\(\);[\s\S]*scrollContainer\.addEventListener\('scroll', onScroll, \{ passive: true \}\);[\s\S]*scrollContainer\.removeEventListener\('scroll', onScroll, \{ passive: true \}\);/,
  'site section state sync should listen to its resolved scroll container, not only window scroll'
);

assert.match(
  source,
  /let measuredAnySection = false;[\s\S]*if \(!rect \|\| rect\.height <= 4\) continue;[\s\S]*measuredAnySection = true;[\s\S]*if \(!measuredAnySection\) return;[\s\S]*if \(!candidate\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should ignore hidden modal measurements instead of falling back to the last section'
);

assert.match(
  source,
  /const scrollTop = getSiteScrollTop\(scrollContainer\);[\s\S]*if \(scrollTop <= 4\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should keep the repository section active when the modal body is at the top'
);

assert.match(
  source,
  /function resetSiteSettingsNavOnOpen\(\) \{[\s\S]*modalBody\.scrollTop = 0;[\s\S]*root\.__nsSiteFirstSectionId[\s\S]*setActive\(firstSectionId,[\s\S]*scrollViewport: false[\s\S]*activateFirst\(\);[\s\S]*requestAnimationFrame/,
  'opening Site Settings should reset the modal body and left navigation to the first section'
);

assert.match(
  source,
  /const renderBehaviorGrid = \(section\) => \{[\s\S]*dataKey: 'defaultLanguage'[\s\S]*dataKey: 'contentOutdatedDays'[\s\S]*dataKey: 'pageSize'[\s\S]*dataKey: 'showAllPosts'[\s\S]*dataKey: 'landingTab'[\s\S]*dataKey: 'cardCoverFallback'[\s\S]*dataKey: 'errorOverlay'/,
  'Behavior compact grid should include all single-value behavior fields'
);

assert.match(
  source,
  /const renderThemeGrid = \(section\) => \{[\s\S]*dataKey: 'themeMode'[\s\S]*dataKey: 'themePack'[\s\S]*dataKey: 'themeOverride'/,
  'Theme compact grid should include all single-value theme fields'
);

assert.match(
  source,
  /const renderAssetWarningsGrid = \(section\) => \{[\s\S]*dataKey: 'assetWarnings'[\s\S]*fields\.assetLargeImage[\s\S]*fields\.assetLargeImageThreshold/,
  'Asset warnings compact grid should include the warning toggle and threshold rows'
);

assert.match(
  source,
  /const renderThemeGrid = \(section\) => \{[\s\S]*fetch\('assets\/themes\/packs\.json'\)[\s\S]*applyThemePackOptions\(fallbackThemePacks\);/,
  'Theme compact grid should preserve dynamic theme pack loading with fallback options'
);

assert.match(
  source,
  /const repoSection = createSection\([\s\S]*sections\.repo\.title[\s\S]*sections\.repo\.description[\s\S]*const identitySection = createSection\(/,
  'Repository should be the first site editor card before Identity'
);

assert.doesNotMatch(
  source,
  /createField\(repoSection,\s*\{[\s\S]*dataKey: 'repo'[\s\S]*fields\.repo[\s\S]*fields\.repoHelp/,
  'Repository card should not render a duplicate GitHub repository field heading'
);

assert.match(
  source,
  /function renderFineGrainedTokenSettings\(host\) \{[\s\S]*tokenField\.className = 'cs-repo-field-group cs-repo-field-group--token cs-token-field';[\s\S]*field\.className = 'cs-repo-field cs-repo-field--token';[\s\S]*input\.id = 'syncGithubTokenInput';[\s\S]*input\.className = 'cs-input cs-repo-input cs-repo-input--token';[\s\S]*const btnForget = document\.createElement\('span'\);[\s\S]*btnForget\.setAttribute\('role', 'button'\);[\s\S]*btnForget\.className = 'cs-token-clear';[\s\S]*field\.append\(affix, input, btnForget\);[\s\S]*setCachedFineGrainedToken\(input\.value\);[\s\S]*host\.appendChild\(wrapper\);/,
  'fine-grained token settings should reuse the repository field style with a full-width token field'
);

assert.doesNotMatch(
  source.slice(source.indexOf('function renderFineGrainedTokenSettings(host) {'), source.indexOf('function startRemoteSyncWatcher')),
  /document\.createElement\('button'\)/,
  'token clear control should avoid native button chrome'
);

assert.doesNotMatch(
  source,
  /cs-token-actions/,
  'token clear control should not reserve a separate action row below the input'
);

assert.match(
  source,
  /const hasAction = !!\(action && \(action\.href \|\| typeof action\.onClick === 'function'\)\);[\s\S]*const shouldAutoDismiss = options\.sticky !== true && !hasAction;/,
  'plain info toasts such as Loading config should auto-dismiss unless explicitly sticky or actionable'
);

assert.match(
  source,
  /repoInputs\.className = 'cs-repo-grid';[\s\S]*repoInputs\.dataset\.field = 'repo';[\s\S]*createRepoFieldGroup\('cs-repo-field-group--owner', t\('editor\.composer\.site\.repoOwner'\), ownerWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--name', t\('editor\.composer\.site\.repoName'\), repoWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--branch', t\('editor\.composer\.site\.repoBranch'\), branchWrap\)[\s\S]*repoSection\.appendChild\(repoInputs\);/,
  'Repository inputs should remain diff-addressable while rendering labeled controls directly in the Repository card'
);

assert.match(
  source,
  /repoSection\.appendChild\(repoInputs\);\s*renderFineGrainedTokenSettings\(repoSection\);/,
  'Repository card should host the fine-grained token settings below the GitHub repository fields'
);

assert.match(
  source,
  /function applySiteDiffMarkers\(diff\) \{[\s\S]*const lang = el\.getAttribute\('data-lang'\);[\s\S]*const subfield = el\.getAttribute\('data-subfield'\);[\s\S]*const hasChangedDescendant = \(el\) =>[\s\S]*if \(hasChangedDescendant\(el\)\) \{/,
  'Site editor diff markers should support control-level language and subfield matching'
);

assert.match(
  source,
  /if \(info\.type === 'object' && info\.fields\) \{\s*return subfield \? !!info\.fields\[subfield\] : false;\s*\}/,
  'Object field diffs should only match controls that declare a changed subfield'
);

assert.match(
  source,
  /if \(info\.type === 'list' && info\.entries\) \{\s*if \(index != null && subfield\) return !!\(info\.entries\[index\] && info\.entries\[index\]\[subfield\]\);\s*return true;\s*\}/,
  'List field diffs should preserve field-level markers when removed rows have no remaining controls'
);

assert.match(
  source,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;/,
  'Localized site inputs should carry field and language diff metadata'
);

assert.match(
  source,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;[\s\S]*input\.dataset\.subfield = key;/,
  'Identity grid inputs should carry field, language, and subfield diff metadata'
);

assert.match(
  source,
  /ownerWrap\.dataset\.field = 'repo';[\s\S]*ownerWrap\.dataset\.subfield = 'owner';[\s\S]*repoWrap\.dataset\.field = 'repo';[\s\S]*repoWrap\.dataset\.subfield = 'name';[\s\S]*branchWrap\.dataset\.field = 'repo';[\s\S]*branchWrap\.dataset\.subfield = 'branch';/,
  'Repository diff metadata should target the specific owner, repo name, or branch pill'
);

assert.match(
  source,
  /labelInput\.dataset\.field = key;[\s\S]*labelInput\.dataset\.index = String\(index\);[\s\S]*labelInput\.dataset\.subfield = 'label';[\s\S]*hrefInput\.dataset\.field = key;[\s\S]*hrefInput\.dataset\.index = String\(index\);[\s\S]*hrefInput\.dataset\.subfield = 'href';/,
  'Profile link diff metadata should target the specific label or URL input'
);

assert.doesNotMatch(
  source,
  /\.cs-field\[data-diff="changed"\],\.cs-repo-grid\[data-diff="changed"\],\.cs-extra-list\[data-diff="changed"\],\.cs-single-grid-row\[data-diff="changed"\]\{background:/,
  'Site editor changed-state highlights should not tint whole field containers'
);

assert.match(
  source,
  /\.cs-field\[data-diff="changed"\] \.cs-input,\.cs-field\[data-diff="changed"\] \.cs-select,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-input,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-select[\s\S]*\{background:color-mix\(in srgb,#f59e0b 10%, transparent\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)\}/,
  'Site editor changed-state highlights should tint changed text and select controls'
);

assert.match(
  source,
  /\.cs-field\[data-diff="changed"\] \.cs-empty\{background:color-mix\(in srgb,#f59e0b 10%, var\(--card\)\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)/,
  'Site editor changed-state highlights should tint empty placeholders for changed list fields'
);

assert.match(
  source,
  /\.cs-repo-grid\[data-diff="changed"\] \.cs-repo-field,[\s\S]*\.cs-extra-list\[data-diff="changed"\] li[\s\S]*background:color-mix\(in srgb,#f59e0b 10%, transparent\)/,
  'Site editor changed-state highlights should tint changed repository fields and read-only key rows'
);

assert.match(
  source,
  /\.cs-field\[data-diff="changed"\] \.cs-switch-track,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-switch-track[\s\S]*background:color-mix\(in srgb,#f59e0b 18%, var\(--card\)\)/,
  'Site editor changed-state highlights should tint changed switch tracks'
);

assert.doesNotMatch(
  source,
  /\[data-diff="changed"\][^{]*\{[^}]*box-shadow:inset[^}]*\}/,
  'Site editor changed-state highlights should not add inset bars'
);

assert.doesNotMatch(
  source,
  /\[data-diff="changed"\][^{]*\{[^}]*padding-left:[^}]*\}/,
  'Site editor changed-state highlights should not add left padding that shifts fields'
);

assert.match(
  source,
  /const siteConfigSection = createSection\([\s\S]*renderBehaviorGrid\(behaviorSubsection\);[\s\S]*renderThemeGrid\(themeSubsection\);[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);[\s\S]*const extrasSection = createSection\(/,
  'Site editor should combine Behavior, Theme, and Asset warnings before Other keys'
);

assert.doesNotMatch(
  source,
  /createField\(extrasSection,\s*\{[\s\S]*dataKey: '__extras'[\s\S]*fields\.extras[\s\S]*fields\.extrasHelp/,
  'Other keys should not render a duplicate Preserved keys field heading'
);

assert.match(
  source,
  /list\.className = 'cs-extra-list';[\s\S]*list\.dataset\.field = '__extras';[\s\S]*extrasSection\.appendChild\(list\);/,
  'Other keys list should remain diff-addressable while rendering directly in the card'
);

assert.doesNotMatch(
  source,
  /const behaviorSection = createSection\([\s\S]*const themeSection = createSection\([\s\S]*const assetsSection = createSection\(/,
  'Behavior, Theme, and Asset warnings should not render as separate top-level cards'
);

assert.match(
  source,
  /field\.className = 'cs-field cs-single-grid-fieldset';/,
  'avatar and content root should share one compact fieldset instead of separate tall fields'
);

assert.match(
  source,
  /row\.dataset\.field = item\.dataKey;/,
  'each compact identity path row should keep its own data-field for diff and reveal handling'
);

assert.doesNotMatch(
  source,
  /input\.dataset\.autofocus = '';/,
  'compact identity path inputs should not steal section navigation focus and scroll gestures'
);

assert.match(
  source,
  /tooltip\.className = 'cs-help-tooltip';[\s\S]*tooltipBubble\.setAttribute\('role', 'tooltip'\);/,
  'compact identity path labels should expose their help text through an accessible tooltip'
);

assert.match(
  source,
  /label\.className = 'cs-single-grid-title';[\s\S]*labelCell\.appendChild\(label\);[\s\S]*labelCell\.appendChild\(tooltipWrap\);/,
  'compact single-grid rows should place help tooltip buttons between the label text and the control'
);

assert.match(
  source,
  /\.cs-single-grid-label\{display:inline-flex;align-items:center;justify-content:flex-end;gap:\.35rem;/,
  'compact single-grid label cells should right-align the label and trailing help icon'
);

assert.match(
  source,
  /\.cs-single-grid\{display:grid;grid-template-columns:var\(--cs-editor-single-label-width,88px\) minmax\(0,var\(--cs-editor-single-control-width\)\);column-gap:var\(--cs-editor-row-column-gap\);row-gap:var\(--cs-editor-row-gap\);align-items:center;justify-content:start\}[\s\S]*\.cs-single-grid-row\{display:grid;grid-template-columns:subgrid;grid-column:1\/-1;align-items:center;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0/,
  'compact identity path rows should use one measured label column and a fixed-width control column'
);

assert.match(
  source,
  /\.cs-link-list\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-row \+ \.cs-link-row\{margin-top:0\}/,
  'profile link rows should use the same vertical row rhythm as localized grid rows'
);

assert.match(
  source,
  /\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-field--label\{flex:1 1 0\}[\s\S]*\.cs-link-field--href\{flex:3 1 0\}/,
  'profile link label and URL fields should keep a 1:3 width ratio with the same horizontal gap as identity grid columns'
);

assert.match(
  source,
  /\.cs-config-subsection \+ \.cs-config-subsection\{border-top:1px solid color-mix\(in srgb,var\(--border\) 82%, transparent\);margin-top:\.35rem;padding-top:\.95rem\}/,
  'combined Site Configuration subsections should be separated by the same divider rhythm as large cards'
);

assert.match(
  source,
  /\.cs-config-subsection-title\{margin:0;font-size:\.84rem;font-weight:600;color:color-mix\(in srgb,var\(--text\) 76%, transparent\)\}[\s\S]*\.cs-config-subsection-description\{margin:0;font-size:\.8rem;color:color-mix\(in srgb,var\(--muted\) 88%, transparent\);flex:1 1 auto;text-align:left\}/,
  'combined Site Configuration subsection headings should use the smaller field-heading rhythm instead of top-level section titles'
);

assert.match(
  source,
  /\.cs-config-subsection\{display:flex;flex-direction:column;gap:\.4rem\}[\s\S]*\.cs-config-subsection > \.cs-config-subsection-head \+ \.cs-field\{padding-top:0\}/,
  'combined Site Configuration subsection content should sit as close to its heading as SEO subheading content'
);

assert.doesNotMatch(
  source,
  /createConfigSubsection[\s\S]*document\.createElement\('h4'\)/,
  'combined Site Configuration subsection labels should not render as document headings'
);

assert.match(
  source,
  /\.cs-single-grid-control \.cs-input,.cs-single-grid-control \.cs-select\{width:100%;min-width:0\}/,
  'compact grid controls should fill the shared control column'
);

assert.match(
  source,
  /\.cs-layout\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:1rem;align-items:start\}/,
  'site settings should use a single-column layout without the old section navigation rail'
);

assert.doesNotMatch(
  source,
  /\.cs-nav|\.cs-mobile-section|cs-nav-button|cs-mobile-section-menu-item/,
  'site settings CSS should not keep removed section navigation selectors'
);

assert.doesNotMatch(
  source,
  /\.editor-modal-body\.is-composer-overlay\{overflow:hidden\}/,
  'site settings overlay should keep the modal body scrollable so the section navigation remains visible'
);

assert.doesNotMatch(
  source,
  /\.editor-modal-body\.is-composer-overlay[\s\S]*\.cs-layout\{height:100%;min-height:0\}/,
  'site settings overlay should not force a full-height composer layout that can collapse the left navigation'
);

assert.doesNotMatch(
  nativeThemeSource,
  /cs-nav-button|cs-mobile-section-nav-toggle|cs-mobile-section-menu-item/,
  'native theme button reset should not carry exceptions for removed site section navigation buttons'
);

assert.match(
  source,
  /\.cs-help-tooltip-wrap:hover \.cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible \+ \.cs-help-tooltip-bubble\{opacity:1;transform:translateY\(0\);pointer-events:auto\}/,
  'compact identity path help should appear as a hover/focus tooltip'
);

assert.match(
  editorSource,
  /\.editor-mobile-rail-toggle \{[\s\S]*display:none;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-mobile-rail-toggle \{\s*display:inline-flex;/,
  'mobile layout should expose a file tree drawer toggle only on small screens'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:0px;[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*display:grid;[\s\S]*grid-template-columns:auto minmax\(0, 1fr\);[\s\S]*column-gap:\.5rem;[\s\S]*\.editor-markdown-panel > \.toolbar \.left-actions \{[\s\S]*grid-column:1;[\s\S]*flex:0 0 auto;[\s\S]*flex-wrap:nowrap;[\s\S]*\.editor-markdown-panel > \.toolbar \.right-actions \{[\s\S]*grid-column:2;[\s\S]*flex-wrap:wrap;[\s\S]*justify-content:flex-end;[\s\S]*justify-self:end;[\s\S]*max-width:100%;[\s\S]*\.editor-markdown-panel > \.toolbar \.editor-mobile-rail-toggle \{[\s\S]*flex:0 0 auto;[\s\S]*\.editor-markdown-panel > \.toolbar \.current-file \{[\s\S]*display:none;/,
  'extra narrow markdown toolbar should hide the breadcrumb and right-align editor controls beside the drawer toggle'
);

assert.match(
  editorSource,
  /--editor-article-main-width: 45rem;[\s\S]*--editor-properties-width: 20rem;[\s\S]*--editor-article-gap: 1\.5rem;[\s\S]*--editor-content-frame-max-width: calc\(var\(--editor-article-main-width\) \+ var\(--editor-article-gap\) \+ var\(--editor-properties-width\)\);[\s\S]*--editor-page-max-width: calc\(var\(--editor-rail-width, 340px\) \+ 6px \+ var\(--editor-content-frame-max-width\)\);/,
  'editor page width should be derived from the rail width plus the shared content frame width'
);

assert.match(
  editorSource,
  /\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:1rem;[\s\S]*padding:var\(--editor-content-pane-padding\);[\s\S]*\.toolbar \{[\s\S]*top:calc\(var\(--editor-content-pane-padding, 0px\) \* -1\);[\s\S]*background:color-mix\(in srgb, var\(--bg\) 96%, var\(--card\) 4%\);[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-top:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*\.editor-tools \{[\s\S]*top:calc\(var\(--editor-toolbar-offset, 0px\) - var\(--editor-content-pane-padding, 0px\)\);[\s\S]*background:color-mix\(in srgb, var\(--card\) 96%, var\(--text\) 4%\);[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:\.75rem;/,
  'markdown file toolbar should stick flush to the editor content pane top while preserving pane padding'
);

assert.match(
  source,
  /function buildDefaultEntryPath\(kind, key, lang\) \{[\s\S]*const baseFolder = normalizedKind === 'tabs' \? 'tab' : 'post';[\s\S]*normalizedKind === 'tabs'[\s\S]*`\$\{baseFolder\}\/\$\{safeKey\}\/v1\.0\.0`[\s\S]*`\$\{baseFolder\}\/v1\.0\.0`[\s\S]*return `\$\{folder\}\/\$\{filename\}`;/,
  'new article defaults should place the first markdown file inside a v1.0.0 directory'
);

assert.match(
  source,
  /async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*showComposerAddEntryPrompt\(anchor, \{[\s\S]*editor\.composer\.versionPrompt\.placeholder[\s\S]*if \(!isComposerVersionTag\(value\)\)[\s\S]*normalizeComposerVersionTag\(value\)[\s\S]*editor\.composer\.versionPrompt\.errorDuplicate/,
  'adding an article version should prompt for a v-prefixed version string before creating the new path'
);

assert.match(
  source,
  /function normalizeComposerVersionPaths\(value\) \{[\s\S]*Array\.isArray\(value\)[\s\S]*normalizeRelPath\(value\)[\s\S]*return normalized \? \[normalized\] : \[\];[\s\S]*function collectComposerArticleVersions\(paths\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(paths\);[\s\S]*async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(entry && entry\[lang\]\);/,
  'legacy scalar article language paths should be normalized before version dedupe runs'
);

assert.match(
  source,
  /function findExplicitArticleVersionSegmentIndex\(segments\) \{[\s\S]*if \(parts\.length < 3\) return -1;[\s\S]*parts\[0\][\s\S]*!== 'post'[\s\S]*const candidateIndex = parts\.length - 1;[\s\S]*if \(!isComposerVersionSegment\(parts\[candidateIndex\]\)\) return -1;[\s\S]*return candidateIndex;[\s\S]*function buildDefaultLanguagePathFromEntry\(kind, key, lang, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = 'v1\.0\.0'[\s\S]*else segments\.push\('v1\.0\.0'\);/,
  'adding a new article language should rewrite only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  source,
  /function buildArticleVersionPath\(key, lang, version, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = normalizedVersion[\s\S]*else segments\.push\(normalizedVersion\);/,
  'adding a version should replace only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  source,
  /function extractVersionFromPath\(relPath\) \{[\s\S]*const segments = normalized\.split\('\/'\);[\s\S]*segments\.pop\(\);[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*return versionIndex >= 0 \? String\(segments\[versionIndex\] \|\| ''\) : '';/,
  'article version extraction should ignore legacy root-style keys that only look like versions'
);

assert.doesNotMatch(
  source,
  /<input class="ci-path" type="text" placeholder="\$\{escapeHtml\(pathPlaceholder\)\}" value="\$\{escapeHtml\(p \|\| ''\)\}" \/>/,
  'article version cards should not render an editable path input in the composer list'
);

assert.doesNotMatch(
  source,
  /const input = document\.createElement\('input'\);[\s\S]*input\.setAttribute\('aria-label', treeText\('location', 'Location'\)\);[\s\S]*main\.appendChild\(label\);[\s\S]*main\.appendChild\(input\);/,
  'article language structure panel should not render an editable location input for version rows'
);

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*const titleInput = document\.createElement\('input'\);[\s\S]*const pathInput = document\.createElement\('input'\);[\s\S]*controls\.appendChild\(titleInput\);[\s\S]*controls\.appendChild\(pathInput\);/,
  'page structure rows should not render editable title or location inputs'
);

assert.doesNotMatch(
  editorSource,
  /#mode-composer > \.editor-main > \.toolbar|<section class="box editor-main" style="grid-column: 1 \/ -1;">|class="site-settings-title"/,
  'site settings modal should not render a redundant inner card toolbar'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalComposerActions" hidden[\s\S]*id="btnRefresh"[\s\S]*id="btnDiscard"/,
  'site settings refresh and discard controls should live in the modal header action slot'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalUpdateActions" hidden[\s\S]*id="btnSystemSelect"[\s\S]*id="systemUpdateFileInput"/,
  'system update archive picker should live in the modal header action slot'
);

assert.doesNotMatch(
  editorSource,
  /<section class="box updates-main"|class="updates-title"/,
  'system updates modal should not render a redundant inner card or duplicate content title'
);

assert.match(
  editorSource,
  /<header class="editor-modal-header">\s*<button type="button" class="btn-secondary editor-modal-close" id="editorModalClose"[\s\S]*<h2 id="editorModalTitle"><\/h2>/,
  'modal close button should sit to the left of the title for macOS-style chrome'
);

assert.match(
  editorSource,
  /\.editor-modal-header-actions \.btn-secondary,\s*\.editor-modal-header-actions \.btn-primary \{\s*height:2rem;\s*padding:0 \.65rem;[\s\S]*\.editor-modal-close \{[\s\S]*height:2rem;/,
  'modal header action buttons should match the close button height'
);

assert.match(
  editorSource,
  /\.editor-modal-layer\[hidden\],[\s\S]*\.editor-overlay-panel\[hidden\] \{[\s\S]*display:none !important;[\s\S]*\.editor-modal-body \{[\s\S]*overflow:auto;/,
  'modal layer should hide by default and scroll its own body when content is tall'
);

assert.doesNotMatch(
  source,
  /cs-multiline-preview|preview = document\.createElement\('button'\)/,
  'collapsed multiline fields should not swap in a preview button'
);

assert.match(
  source,
  /input\.addEventListener\('pointerdown', expandMultiline\);[\s\S]*input\.addEventListener\('focus', expandMultiline\);[\s\S]*input\.addEventListener\('focusin', expandMultiline\);/,
  'the textarea itself should expand from direct pointer and focus interaction'
);

assert.match(
  source,
  /list\.querySelectorAll\('\.cs-localized-row--multiline\.is-expanded'\)\.forEach/,
  'expanding a multiline localized row should collapse other expanded rows in the same field'
);

assert.match(
  source,
  /\.cs-localized-row--multiline textarea\.cs-localized-textarea\{box-sizing:border-box;display:block;height:var\(--cs-editor-control-height\);min-height:var\(--cs-editor-control-height\);max-height:var\(--cs-editor-control-height\);padding-block:0;line-height:calc\(var\(--cs-editor-control-height\) - 2px\);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height \.18s ease/,
  'collapsed multiline textareas should keep the real control but use input-like vertical centering'
);

assert.match(
  source,
  /\.cs-localized-row--multiline\.is-expanded,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\)\{align-items:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded \.cs-remove-lang,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) \.cs-remove-lang\{align-self:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap\}[\s\S]*\.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap/,
  'focused multiline textareas should animate open without replacing the control'
);
