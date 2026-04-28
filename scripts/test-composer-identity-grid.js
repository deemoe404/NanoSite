import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const composerPath = resolve(here, '../assets/js/composer.js');
const editorPath = resolve(here, '../index_editor.html');
const nativeThemePath = resolve(here, '../assets/themes/native/theme.css');
const source = readFileSync(composerPath, 'utf8');
const editorSource = readFileSync(editorPath, 'utf8');
const nativeThemeSource = readFileSync(nativeThemePath, 'utf8');

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
  /renderBehaviorGrid\(behaviorSection\);/,
  'Behavior section should render single-value fields through the compact grid'
);

assert.match(
  source,
  /renderThemeGrid\(themeSection\);/,
  'Theme section should render single-value fields through the compact grid'
);

assert.match(
  source,
  /renderAssetWarningsGrid\(assetsSection\);/,
  'Asset warnings section should render single-value fields through the compact grid'
);

assert.match(
  source,
  /renderSeoResourceGrid\(seoSection\);/,
  'SEO Resource URL should render through the compact grid'
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
  /\.cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset\{--cs-editor-row-gap:\.35rem;--cs-editor-row-column-gap:\.45rem;--cs-editor-control-height:1\.95rem\}/,
  'identity and aligned localized rows should share one row rhythm contract'
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
  /\.cs-localized-row--grid \.cs-lang-chip\{justify-self:start\}/,
  'aligned localized rows should keep language chips content-width instead of stretching them'
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
  /\.cs-single-grid\{display:grid;grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\);column-gap:var\(--cs-editor-row-column-gap\);row-gap:var\(--cs-editor-row-gap\);align-items:center\}[\s\S]*\.cs-single-grid-row\{display:grid;grid-template-columns:subgrid;grid-column:1\/-1;align-items:center;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0/,
  'compact identity path rows should use one parent grid and subgrid rows so labels and inputs share column tracks'
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
  /html body button\.cs-nav-button\.is-active\{background:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;border-color:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;color:#fff !important;box-shadow:none !important[\s\S]*html body button\.cs-mobile-section-menu-item\.is-active\{background:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;border-color:color-mix\(in srgb,var\(--primary\) 96%, var\(--text\) 4%\) !important;color:#fff !important/,
  'site section navigation active state should use solid primary fill and outrank native theme button resets'
);

assert.match(
  source,
  /\.cs-nav-list\{list-style:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;display:flex;flex-direction:column;gap:\.55rem;/,
  'desktop site section navigation should not render as a card container'
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
  /html, body \{ overflow-x: visible; overflow-y: visible; \}[\s\S]*\.editor-page \{[^}]*overflow-x: clip;/,
  'editor page should keep root scrolling visible for sticky toolbars while clipping horizontal page overflow'
);

assert.match(
  editorSource,
  /#mode-composer > \.editor-main > \.toolbar \{\s*margin:-1\.25rem -1\.25rem 1\.25rem;\s*padding:\.85rem 1\.25rem \.7rem;/,
  'composer file toolbar should span the editor card while keeping visual spacing as internal padding'
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
