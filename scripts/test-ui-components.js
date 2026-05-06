import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const components = read('assets/js/components.js');
const main = read('assets/main.js');
const indexHtml = read('index.html');
const composer = read('assets/js/composer.js');
const search = read('assets/js/search.js');
const theme = read('assets/js/theme.js');
const toc = read('assets/js/toc.js');
const nativeSearch = read('assets/themes/native/modules/search-box.js');
const nativeToc = read('assets/themes/native/modules/toc.js');
const nativeInteractions = read('assets/themes/native/modules/interactions.js');
const postCardHtml = read('assets/js/post-card-html.js');
const nativeCss = read('assets/themes/native/base.css');

assert.match(components, /arcus-tools__groups[\s\S]*arcus-tool[\s\S]*solstice-tools[\s\S]*solstice-tool/, 'theme controls should preserve legacy Arcus and Solstice control classes for already-installed themes');
assert.doesNotMatch(components, /\bcartograph\b/i, 'core UI components should not hard-code non-legacy external theme variants');

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start marker: ${startNeedle}`);
  const bodyStart = start + startNeedle.length;
  const end = source.indexOf(endNeedle, bodyStart);
  assert.notEqual(end, -1, `missing end marker: ${endNeedle}`);
  return source.slice(bodyStart, end);
}

assert.match(components, /class PressSearch extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:search'/, 'press-search should own the search input and emit press:search');
assert.match(components, /<input id="\$\{inputId\}" part="input"/, 'press-search should expose its input as a CSS part without a fixed DOM id');
assert.match(components, /const icon = this\.hasAttribute\('icon'\)[\s\S]*const iconHtml = icon \? `<span class="\$\{iconClass\}" part="icon"/, 'press-search should render an icon only when a theme opts in');
assert.match(components, /function ensureShadowRoot[\s\S]*attachShadow\(\{ mode: 'open' \}\)/, 'shared components should offer opt-in shadow roots for real ::part styling');
assert.match(components, /class PressThemeControls extends HTMLElement[\s\S]*'press:theme-pack-change'[\s\S]*'press:language-change'/, 'press-theme-controls should own tool UI events');
assert.match(components, /class PressToc extends HTMLElement[\s\S]*renderToc\(options = \{\}\)[\s\S]*part="toc"[\s\S]*_cleanupListeners/, 'press-toc should render exposed parts and clean up its own listeners');
assert.match(components, /renderToc\(options = \{\}\)[\s\S]*options\.contentRoot[\s\S]*options\.scrollRoot[\s\S]*_scrollRoot\(\)/, 'press-toc should accept region-owned content and scroll roots');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*'card-class'[\s\S]*'tags-class'[\s\S]*_captureSlotContent[\s\S]*_shadowSlot[\s\S]*<slot name="\$\{slotName\}"[\s\S]*_renderCard[\s\S]*part="card/, 'press-post-card should render a generic configurable card with slots and parts');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*<slot name="meta">[\s\S]*<slot name="tags">[\s\S]*_shadowSlot\('cover'[\s\S]*_shadowSlot\('actions'[\s\S]*_shadowSlot\('footer'/, 'press-post-card should support cover/meta/actions/footer slots in shadow mode');
assert.match(components, /export \{ renderPressPostCardHtml \} from '\.\/post-card-html\.js';/, 'components should re-export the pure press-post-card HTML helper');
assert.match(postCardHtml, /export function renderPressPostCardHtml[\s\S]*Object\.prototype\.hasOwnProperty\.call\(classes, key\)[\s\S]*return ` \$\{attr\}="\$\{safe\(String\(classes\[key\]\)\)\}"/, 'press-post-card helper should preserve explicit empty class attributes');
assert.doesNotMatch(postCardHtml, /\bHTMLElement\b|\bcustomElements\b|\bdocument\b|\bwindow\b|from '\.\/utils\.js'/, 'press-post-card HTML helper should stay browser-global free for Node theme tests');
const primitiveComponents = [
  sliceBetween(components, 'export class PressSearch extends HTMLElement {', '\n\nexport class PressThemeControls'),
  sliceBetween(components, 'export class PressToc extends HTMLElement {', '\n\nexport class PressPostCard'),
  sliceBetween(components, 'export class PressPostCard extends HTMLElement {', '\n\nexport function registerPressComponents')
].join('\n');
assert.doesNotMatch(primitiveComponents, /variant ===|_renderNative|_renderArcus|_renderSolstice|arcus-card|solstice-card|arcus-search|solstice-search/, 'shared primitives should not hard-code shipped theme variants');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:navigate'/, 'press-post-card should emit press:navigate');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*composedPath\(\)[\s\S]*root !== this\.shadowRoot/, 'press-post-card navigation should work from shadow DOM clicks');
assert.match(components, /class PressToc extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:navigate'/, 'press-toc should emit press:navigate for heading jumps');
assert.match(components, /defineElement\('press-search'[\s\S]*defineElement\('press-theme-controls'[\s\S]*defineElement\('press-toc'[\s\S]*defineElement\('press-post-card'/, 'all UI components should be registered centrally');

const pressSearchAttributeChanged = sliceBetween(
  components,
  '  attributeChangedCallback(name, oldValue, newValue) {',
  '\n\n  get input()'
);
assert.match(pressSearchAttributeChanged, /if \(name === 'value'\) \{[\s\S]*this\._syncInputState\(\);[\s\S]*return;/, 'press-search should only sync input value for value attribute changes');
const placeholderBranch = pressSearchAttributeChanged.indexOf("if (name === 'placeholder')");
const labelBranch = pressSearchAttributeChanged.indexOf("if (name === 'label')");
assert.notEqual(placeholderBranch, -1, 'press-search should handle placeholder attribute updates separately');
assert.notEqual(labelBranch, -1, 'press-search should handle label attribute updates separately');
assert.doesNotMatch(pressSearchAttributeChanged.slice(placeholderBranch), /this\._syncInputState\(\)/, 'placeholder and label updates should not overwrite the live input value');

const pressTocBindClicks = sliceBetween(
  components,
  '  _bindTocClicks() {',
  '\n    const top = this.querySelector'
);
const tocMapSet = pressTocBindClicks.indexOf('this._idToLink.set(id, anchor)');
const tocBoundGuard = pressTocBindClicks.indexOf("anchor.dataset.pressTocBound === 'true'");
assert.notEqual(tocMapSet, -1, 'press-toc should register anchors in _idToLink');
assert.notEqual(tocBoundGuard, -1, 'press-toc should keep a listener binding guard');
assert.ok(tocMapSet < tocBoundGuard, 'press-toc should rebuild _idToLink before skipping already-bound anchors');

assert.match(main, /import '\.\/js\/components\.js';/, 'main should register custom elements before theme layout mounting');
assert.match(main, /from '\.\/js\/i18n\.js\?v=20260506theme';/, 'main should use the same versioned i18n module instance as shared UI modules');
assert.match(indexHtml, /src="assets\/main\.js\?v=20260506theme"/, 'index should bump the main module URL when runtime imports change');
assert.match(composer, /src="assets\/main\.js\?v=20260506theme"/, 'composer export template should use the same main module URL as index');
assert.match(search, /addEventListener\('press:search'[\s\S]*navigateSearch/, 'search routing should listen for press:search');
assert.doesNotMatch(search, /input\.onkeydown\s*=/, 'search.js should not own the component input via onkeydown');
assert.match(read('assets/js/tags.js'), /press:tag-select/, 'tag sidebar should emit press:tag-select');

assert.match(theme, /mountThemeControls\(options = \{\}\)[\s\S]*document\.createElement\('press-theme-controls'\)/, 'core theme controls should mount press-theme-controls');
assert.match(theme, /component\.addEventListener\('press:theme-toggle'[\s\S]*component\.addEventListener\('press:language-reset'/, 'theme control side effects should be event-driven');
assert.doesNotMatch(theme, /import ['"]\.\/components\.js['"]/, 'theme helpers should not top-level import browser-only custom elements');
assert.match(theme, /function ensurePressComponents\(\)[\s\S]*typeof customElements === 'undefined'[\s\S]*import\('\.\/components\.js'\)/, 'theme controls should lazy-load custom elements only in browser environments');
assert.match(theme, /function refreshThemeControlsLanguages\(component\)[\s\S]*component\.setLanguages\(getLanguageOptions\(\), getCurrentLang\(\)\)/, 'theme controls should centralize language option refresh');
assert.match(theme, /ns:i18n-bundle-loaded[\s\S]*refreshThemeControlsLanguages\(component\)/, 'theme controls should refresh language options after async i18n bundle updates');

assert.match(nativeSearch, /createElement\('press-search'\)/, 'native search module should mount press-search');
assert.doesNotMatch(nativeSearch, /setAttribute\('icon'/, 'native search should not opt into a visible search icon');

assert.match(nativeToc, /createElement\('press-toc'\)/, 'native TOC module should mount press-toc');
assert.match(toc, /typeof tocRoot\.enhance === 'function'/, 'legacy setupTOC should delegate to press-toc when present');

assert.match(nativeInteractions, /renderPressPostCardHtml\(/, 'native cards should render through press-post-card');

assert.match(nativeCss, /press-search\.box,[\s\S]*press-theme-controls\.box,[\s\S]*press-toc\.box\s*\{\s*display: block;/, 'native component hosts should preserve block layout');

console.log('ok - ui component boundaries');
