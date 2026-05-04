import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const components = read('assets/js/components.js');
const main = read('assets/main.js');
const search = read('assets/js/search.js');
const theme = read('assets/js/theme.js');
const toc = read('assets/js/toc.js');
const nativeSearch = read('assets/themes/native/modules/search-box.js');
const nativeToc = read('assets/themes/native/modules/toc.js');
const nativeInteractions = read('assets/themes/native/modules/interactions.js');
const arcusLayout = read('assets/themes/arcus/modules/layout.js');
const arcusInteractions = read('assets/themes/arcus/modules/interactions.js');
const solsticeLayout = read('assets/themes/solstice/modules/layout.js');
const solsticeInteractions = read('assets/themes/solstice/modules/interactions.js');
const nativeCss = read('assets/themes/native/base.css');
const arcusCss = read('assets/themes/arcus/theme.css');
const solsticeCss = read('assets/themes/solstice/theme.css');

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start marker: ${startNeedle}`);
  const bodyStart = start + startNeedle.length;
  const end = source.indexOf(endNeedle, bodyStart);
  assert.notEqual(end, -1, `missing end marker: ${endNeedle}`);
  return source.slice(bodyStart, end);
}

assert.match(components, /class NanoSearch extends HTMLElement[\s\S]*dispatchNanoEvent\(this, 'nano:search'/, 'nano-search should own the search input and emit nano:search');
assert.match(components, /class NanoThemeControls extends HTMLElement[\s\S]*'nano:theme-pack-change'[\s\S]*'nano:language-change'/, 'nano-theme-controls should own tool UI events');
assert.match(components, /class NanoToc extends HTMLElement[\s\S]*renderToc\(options = \{\}\)[\s\S]*_cleanupListeners/, 'nano-toc should render and clean up its own listeners');
assert.match(components, /class NanoPostCard extends HTMLElement[\s\S]*_renderNative[\s\S]*_renderArcus[\s\S]*_renderSolstice/, 'nano-post-card should render all shipped card variants');
assert.match(components, /defineElement\('nano-search'[\s\S]*defineElement\('nano-theme-controls'[\s\S]*defineElement\('nano-toc'[\s\S]*defineElement\('nano-post-card'/, 'all UI components should be registered centrally');

const nanoSearchAttributeChanged = sliceBetween(
  components,
  '  attributeChangedCallback(name, oldValue, newValue) {',
  '\n\n  get input()'
);
assert.match(nanoSearchAttributeChanged, /if \(name === 'value'\) \{[\s\S]*this\._syncInputState\(\);[\s\S]*return;/, 'nano-search should only sync input value for value attribute changes');
const placeholderBranch = nanoSearchAttributeChanged.indexOf("if (name === 'placeholder')");
const labelBranch = nanoSearchAttributeChanged.indexOf("if (name === 'label')");
assert.notEqual(placeholderBranch, -1, 'nano-search should handle placeholder attribute updates separately');
assert.notEqual(labelBranch, -1, 'nano-search should handle label attribute updates separately');
assert.doesNotMatch(nanoSearchAttributeChanged.slice(placeholderBranch), /this\._syncInputState\(\)/, 'placeholder and label updates should not overwrite the live input value');

const nanoTocBindClicks = sliceBetween(
  components,
  '  _bindTocClicks() {',
  '\n    const top = this.querySelector'
);
const tocMapSet = nanoTocBindClicks.indexOf('this._idToLink.set(id, anchor)');
const tocBoundGuard = nanoTocBindClicks.indexOf("anchor.dataset.nanoTocBound === 'true'");
assert.notEqual(tocMapSet, -1, 'nano-toc should register anchors in _idToLink');
assert.notEqual(tocBoundGuard, -1, 'nano-toc should keep a listener binding guard');
assert.ok(tocMapSet < tocBoundGuard, 'nano-toc should rebuild _idToLink before skipping already-bound anchors');

assert.match(main, /import '\.\/js\/components\.js';/, 'main should register custom elements before theme layout mounting');
assert.match(search, /addEventListener\('nano:search'[\s\S]*navigateSearch/, 'search routing should listen for nano:search');
assert.doesNotMatch(search, /input\.onkeydown\s*=/, 'search.js should not own the component input via onkeydown');

assert.match(theme, /mountThemeControls\(options = \{\}\)[\s\S]*document\.createElement\('nano-theme-controls'\)/, 'core theme controls should mount nano-theme-controls');
assert.match(theme, /component\.addEventListener\('nano:theme-toggle'[\s\S]*component\.addEventListener\('nano:language-reset'/, 'theme control side effects should be event-driven');

assert.match(nativeSearch, /createElement\('nano-search'\)/, 'native search module should mount nano-search');
assert.match(arcusLayout, /createElement\('nano-search'\)/, 'arcus layout should mount nano-search');
assert.match(solsticeLayout, /<nano-search class="solstice-footer__search"/, 'solstice layout should mount nano-search');

assert.match(nativeToc, /createElement\('nano-toc'\)/, 'native TOC module should mount nano-toc');
assert.match(arcusLayout, /createElement\('nano-toc'\)/, 'arcus layout should mount nano-toc');
assert.match(solsticeLayout, /createElement\('nano-toc'\)/, 'solstice layout should mount nano-toc');
assert.match(toc, /typeof tocRoot\.enhance === 'function'/, 'legacy setupTOC should delegate to nano-toc when present');

assert.match(nativeInteractions, /renderNanoPostCardHtml\(/, 'native cards should render through nano-post-card');
assert.match(arcusInteractions, /renderNanoPostCardHtml\(/, 'arcus cards should render through nano-post-card');
assert.match(solsticeInteractions, /renderNanoPostCardHtml\(/, 'solstice cards should render through nano-post-card');
assert.doesNotMatch(arcusInteractions, /\btoc\.innerHTML\s*=\s*''/, 'arcus TOC teardown should use nano-toc.clear() when available');
assert.doesNotMatch(solsticeInteractions, /\btoc\.innerHTML\s*=\s*''/, 'solstice TOC teardown should use nano-toc.clear() when available');
assert.match(arcusInteractions, /function clearArcusToc\(tocEl\)[\s\S]*typeof tocEl\.clear === 'function'[\s\S]*tocEl\.clear\(\)/, 'arcus TOC teardown should call component cleanup');
assert.match(solsticeInteractions, /function clearSolsticeToc\(tocEl\)[\s\S]*typeof tocEl\.clear === 'function'[\s\S]*tocEl\.clear\(\)/, 'solstice TOC teardown should call component cleanup');
assert.match(arcusInteractions, /hooks\.handleViewChange[\s\S]*clearArcusToc\(toc\)/, 'arcus view transitions should use shared TOC teardown');
assert.match(solsticeInteractions, /hooks\.handleViewChange[\s\S]*clearSolsticeToc\(toc\)/, 'solstice view transitions should use shared TOC teardown');

assert.match(nativeCss, /nano-search\.box,[\s\S]*nano-theme-controls\.box,[\s\S]*nano-toc\.box\s*\{\s*display: block;/, 'native component hosts should preserve block layout');
assert.match(arcusCss, /\.arcus-toc\s*\{\s*display: block;/, 'arcus nano-toc host should preserve block layout');
assert.match(solsticeCss, /\.solstice-toc\s*\{\s*display: block;/, 'solstice nano-toc host should preserve block layout');

console.log('ok - ui component boundaries');
