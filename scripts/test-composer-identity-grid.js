import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const composerPath = resolve(here, '../assets/js/composer.js');
const hiEditorPath = resolve(here, '../assets/js/hieditor.js');
const editorMainPath = resolve(here, '../assets/js/editor-main.js');
const editorPath = resolve(here, '../index_editor.html');
const nativeThemePath = resolve(here, '../assets/themes/native/theme.css');
const source = readFileSync(composerPath, 'utf8');
const hiEditorSource = readFileSync(hiEditorPath, 'utf8');
const editorMainSource = readFileSync(editorMainPath, 'utf8');
const editorSource = readFileSync(editorPath, 'utf8');
const nativeThemeSource = readFileSync(nativeThemePath, 'utf8');

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
  /class="editor-app-shell" id="editorAppShell"[\s\S]*class="editor-rail editor-file-tree-pane" id="editorRail"[\s\S]*id="editorFileTree" role="tree"[\s\S]*class="editor-content-pane" id="editorContentPane"/,
  'editor should render a fixed two-pane app shell with a left rail and right content pane'
);

assert.doesNotMatch(
  editorSource,
  /localStorage\.getItem\('ns_composer_editor_state'\)/,
  'editor entry should default to the Editor file tree instead of restoring the last Site Settings mode'
);

assert.match(
  editorSource,
  /class="editor-rail-footer"[\s\S]*id="editorRailSettingsToggle"[\s\S]*id="editorRailSettingsMenu"[\s\S]*id="editorLangSwitcher"[\s\S]*data-mode="composer"[\s\S]*data-mode="updates"/,
  'language, Site Settings, and System Updates controls should live in the left rail settings menu'
);

assert.match(
  editorSource,
  /\.global-status\.is-temporarily-hidden \{ display:none !important; \}[\s\S]*<div id="global-status" class="global-status is-temporarily-hidden" aria-live="polite">[\s\S]*<div class="gs-flow">/,
  'global sync status should stay in the DOM but be temporarily hidden from the page'
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
  editorSource,
  /html, body \{ width: 100%; height: 100%; overflow: hidden; \}[\s\S]*\.editor-page \{ position: fixed; inset: 0;[^}]*overflow: hidden;/,
  'editor page should be fixed to the visible viewport with independent rail and content scrolling'
);

assert.match(
  editorSource,
  /\.editor-rail-tree-scroll \{[^}]*overflow:auto;[\s\S]*\.editor-content-pane \{[^}]*overflow:auto;/,
  'editor rail tree and right content pane should scroll independently'
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
  /\.frontmatter-panel \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*\.frontmatter-grid \{[\s\S]*--frontmatter-row-gap: 0\.35rem;[\s\S]*display: flex;[\s\S]*gap: var\(--frontmatter-row-gap\);[\s\S]*\.frontmatter-field \{[\s\S]*padding: 0;[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(88px, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter fields should use compact Site Settings-style label/control rows'
);

assert.match(
  editorSource,
  /\.frontmatter-section \{[\s\S]*border: 1px solid color-mix\(in srgb, var\(--border\) 96%, transparent\);[\s\S]*background: var\(--card\);[\s\S]*gap: 0\.6rem;[\s\S]*\.frontmatter-section-head \{[\s\S]*align-items: baseline;[\s\S]*\.frontmatter-section-title \{[\s\S]*font-size: 1rem;[\s\S]*\.frontmatter-section-description \{[\s\S]*font-size: 0\.82rem;[\s\S]*text-align: right;/,
  'front matter sections should mirror the Site Settings single-column section card header style'
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
  /\.frontmatter-panel\[data-frontmatter-visible="false"\] \{ display: none !important; \}/,
  'front matter panel should have a hard hidden state for page markdown files'
);

assert.match(
  editorMainSource,
  /let frontMatterVisible = true;[\s\S]*const inferCurrentFileSource = \(path\) => \{[\s\S]*normalized\.startsWith\('tab\/'\) \? 'tabs' : '';[\s\S]*const setFrontMatterVisible = \(visible\) => \{[\s\S]*panel\.dataset\.frontmatterVisible = frontMatterVisible \? 'true' : 'false';[\s\S]*panel\.style\.display = frontMatterVisible \? '' : 'none';[\s\S]*setFrontMatterVisible\(currentFileInfo\.source !== 'tabs'\);/,
  'markdown editor should hide the front matter panel for tabs.yaml page markdown files'
);

assert.match(
  editorMainSource,
  /const getValue = \(\) => \{[\s\S]*if \(frontMatterVisible && frontMatterManager\) return frontMatterManager\.buildMarkdown\(body\);[\s\S]*const setValue = \(value, opts = \{\}\) => \{[\s\S]*if \(frontMatterVisible && frontMatterManager\) \{/,
  'page markdown should bypass front matter parsing and rebuilding while the panel is hidden'
);

assert.match(
  source,
  /function inferMarkdownSourceFromPath\(path\) \{[\s\S]*node && node\.source[\s\S]*startsWith\('tab\/'\) \? 'tabs' : 'index';/,
  'composer should infer whether an opened markdown file comes from tabs.yaml or index.yaml'
);

assert.match(
  source,
  /source: tab\.source \|\| inferMarkdownSourceFromPath\(tab\.path\),[\s\S]*source: inferMarkdownSourceFromPath\(normalized\),/,
  'composer should pass the inferred markdown source to the primary editor'
);

assert.match(
  editorSource,
  /\.editor-content-shell\.box \{[\s\S]*padding:0;[\s\S]*border:0 !important;[\s\S]*background:transparent;[\s\S]*\.editor-structure-panel \{ min-width:0; border:0; border-radius:0; background:transparent; padding:0; \}/,
  'editor structure view should not render extra outer card containers around the content'
);

assert.match(
  editorSource,
  /\.editor-structure-panel\.is-content-entering \.editor-structure-head,[\s\S]*\.editor-structure-panel\.is-content-entering \.editor-structure-body \{ animation:editor-structure-content-enter \.2s ease-out both; \}[\s\S]*@keyframes editor-structure-content-enter/,
  'editor structure panel content should animate in when the selected tree node changes'
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
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{[^}]*font-weight:400; \}[\s\S]*\.editor-tree-label \{[^}]*font-weight:400; \}/,
  'file tree labels should use normal text weight instead of bold labels'
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

assert.match(
  source,
  /const states = \[node\.draftState, node\.diffState, node\.fileState\][\s\S]*\.filter\(state => state && state !== 'existing'\)[\s\S]*\.slice\(0, 3\);[\s\S]*if \(states\.length\) \{[\s\S]*badges = document\.createElement\('span'\);[\s\S]*if \(badges\) button\.appendChild\(badges\);/,
  'file tree rows should hide normal existing-file badges and only reserve badge space for meaningful states'
);

assert.match(
  editorSource,
  /#editorFileTree \.editor-tree-row\.is-selected > button\.editor-tree-node \{ background:color-mix\(in srgb, var\(--primary\) 18%, transparent\) !important;[\s\S]*color:color-mix\(in srgb, var\(--primary\) 86%, var\(--text\)\) !important; \}/,
  'selected file tree state should use a pale file-browser fill on the node button'
);

assert.match(
  source,
  /function createEditorTreeIcon\(node\) \{[\s\S]*const isFile = node\.kind === 'file';[\s\S]*editor-tree-icon-\$\{isFile \? 'document' : 'folder'\}/,
  'file tree should render folder and document icon markers'
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
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{ padding-left:\.45rem; font-weight:400; \}/,
  'root file tree labels should have enough left inset inside the selected pill'
);

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

assert.match(
  source,
  /treeText\('fieldTitle', 'Title'\)/,
  'page language title fields should not reuse the tree heading translation key'
);

assert.doesNotMatch(
  source,
  /Apply initial state as early as possible[\s\S]*applyMode\('composer'\)/,
  'initial editor boot should not force Site Settings before the file tree is rendered'
);

assert.match(
  source,
  /function getOrCreateDynamicMode\(path\) \{[\s\S]*button: null,[\s\S]*dynamicEditorTabs\.set\(modeId, data\);/,
  'markdown document state should no longer create visible dynamic tab buttons'
);

assert.match(
  source,
  /function openMarkdownInEditor\(path\) \{[\s\S]*flushMarkdownDraft\(active\);[\s\S]*applyMode\(modeId\);/,
  'switching files from the tree should flush the current markdown draft before opening the next file'
);

assert.match(
  source,
  /function applyMode\(mode, options = \{\}\) \{[\s\S]*mode === 'editor' && dynamicEditorTabs\.size && !options\.forceStructure/,
  'editor structure selection should be able to bypass dynamic markdown document restoration'
);

assert.match(
  source,
  /function openEditorOverlay\(mode, trigger = null\) \{[\s\S]*activeEditorOverlayMode = nextMode;[\s\S]*function closeEditorOverlay\(\) \{[\s\S]*activeEditorOverlayMode = null;/,
  'Site Settings and System Updates should use an overlay state independent from current editor mode'
);

assert.match(
  source,
  /function applyMode\(mode, options = \{\}\) \{[\s\S]*if \(mode === 'composer' \|\| mode === 'updates'\) \{[\s\S]*openEditorOverlay\(mode, options\.trigger \|\| null\);[\s\S]*return;[\s\S]*const nextMode = \(candidate === 'editor' \|\| isDynamicMode\(candidate\)\)/,
  'opening Site Settings or System Updates should not switch currentMode away from the editor'
);

assert.match(
  source,
  /function initEditorRailResize\(\) \{[\s\S]*EDITOR_RAIL_WIDTH_KEY[\s\S]*pointerdown[\s\S]*setEditorRailWidth\([^)]*\{ persist: true \}/,
  'desktop editor rail should be resizable and persist its width'
);

assert.match(
  source,
  /function initMobileEditorRail\(\) \{[\s\S]*editorMobileRailBound[\s\S]*setEditorRailOpen\(!isOpen\);/,
  'mobile editor rail should use a drawer toggle instead of the desktop resizer'
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
  /buildSiteUI\(root, state\) \{[\s\S]*renderCompactSectionMenu\(\);[\s\S]*syncSiteEditorSingleLabelWidth\(root\);[\s\S]*refreshNavDiffState\(\);/,
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

assert.match(
  source,
  /function renderCompactSectionMenu\(\) \{[\s\S]*sectionsMeta\.forEach[\s\S]*setActiveSection\(meta\.id, \{ focusPanel: false \}\);/,
  'single-column site navigation should reuse section metadata for the floating compact menu'
);

assert.match(
  source,
  /const resolveSiteScrollContainer = \(\) => \{[\s\S]*root \? root\.querySelector\('\.cs-viewport'\)[\s\S]*canOwnScroll[\s\S]*return viewport;[\s\S]*root\.closest\('\.editor-modal-body'\)[\s\S]*return modalBody;[\s\S]*return window;[\s\S]*\};/,
  'site section navigation should prefer the internal content viewport before falling back to the modal body'
);

assert.match(
  source,
  /const scrollContainer = resolveSiteScrollContainer\(\);[\s\S]*scrollContainer\.addEventListener\('scroll', onScroll, \{ passive: true \}\);[\s\S]*scrollContainer\.removeEventListener\('scroll', onScroll, \{ passive: true \}\);/,
  'site section active-state sync should listen to its resolved scroll container, not only window scroll'
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
  /repoInputs\.className = 'cs-repo-grid';[\s\S]*repoInputs\.dataset\.field = 'repo';[\s\S]*createRepoFieldGroup\('cs-repo-field-group--owner', t\('editor\.composer\.site\.repoOwner'\), ownerWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--name', t\('editor\.composer\.site\.repoName'\), repoWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--branch', t\('editor\.composer\.site\.repoBranch'\), branchWrap\)[\s\S]*repoSection\.appendChild\(repoInputs\);/,
  'Repository inputs should remain diff-addressable while rendering labeled controls directly in the Repository card'
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
  /\.cs-mobile-section-nav\{display:none;position:fixed;right:1rem;bottom:4\.05rem;[\s\S]*@media \(max-width:920px\)\{[\s\S]*\.cs-nav\{display:none\}[\s\S]*html\[data-init-mode="composer"\]\[data-init-cfile="site"\] \.cs-mobile-section-nav\{display:block\}/,
  'single-column site navigation should move from the inline nav to a floating menu above back-to-top'
);

assert.match(
  source,
  /const navVisible = \(!navStyles \|\| \(navStyles\.display !== 'none' && navStyles\.visibility !== 'hidden'\)\)[\s\S]*nav\.getClientRects\(\)\.length > 0[\s\S]*const navRect = navVisible \? nav\.getBoundingClientRect\(\) : null;/,
  'hidden inline site navigation should not clamp compact menu scroll anchors to the top of the viewport'
);

assert.match(
  source,
  /html body button\.cs-nav-button\.is-active\{background:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;border-color:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;color:#fff !important;box-shadow:none !important[\s\S]*html body button\.cs-mobile-section-menu-item\.is-active\{background:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;border-color:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;color:#fff !important/,
  'site section navigation active state should use solid primary fill and outrank native theme button resets'
);

assert.match(
  source,
  /\.cs-nav\{position:sticky;top:50%;transform:translateY\(-50%\);align-self:start;/,
  'desktop site section navigation should stay vertically centered in the modal body viewport'
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

assert.match(
  source,
  /\.cs-nav-list\{list-style:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;display:flex;flex-direction:column;gap:\.55rem;overflow:visible\}/,
  'desktop site section navigation should not render as a card container or scroll independently'
);

assert.doesNotMatch(
  source,
  /\.cs-nav-list\{[^}]*overflow:auto/,
  'desktop site section navigation list should not be independently scrollable'
);

assert.match(
  nativeThemeSource,
  /button:not\(\.mode-tab\):not\(\.sidebar-tab\):not\(\.cs-nav-button\):not\(\.cs-mobile-section-nav-toggle\):not\(\.cs-mobile-section-menu-item\)/,
  'native theme global button reset should not override site section navigation buttons'
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
  /\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:1rem;[\s\S]*padding:var\(--editor-content-pane-padding\);[\s\S]*\.toolbar \{[\s\S]*top:calc\(var\(--editor-content-pane-padding, 0px\) \* -1\);[\s\S]*background:var\(--card\);[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-top:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*\.editor-tools \{[\s\S]*top:calc\(var\(--editor-toolbar-offset, 0px\) - var\(--editor-content-pane-padding, 0px\)\);[\s\S]*background:var\(--card\);[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:\.75rem;/,
  'markdown file toolbar should stick flush to the editor content pane top while preserving pane padding'
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
  /\.editor-modal-header-actions \.btn-secondary \{\s*height:2rem;\s*padding:0 \.65rem;[\s\S]*\.editor-modal-close \{[\s\S]*height:2rem;/,
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
