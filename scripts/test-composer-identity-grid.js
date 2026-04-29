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
  /repoInputs\.className = 'cs-repo-grid';[\s\S]*repoInputs\.dataset\.field = 'repo';[\s\S]*repoInputs\.append\(pathRow, branchWrap\);[\s\S]*repoSection\.appendChild\(repoInputs\);/,
  'Repository inputs should remain diff-addressable while rendering directly in the Repository card'
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
  /\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}/,
  'profile link label and URL fields should use the same horizontal gap as identity grid columns'
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

assert.match(
  editorSource,
  /\.page-titlebar \{\s*display:grid;\s*grid-template-columns:minmax\(0, max-content\) minmax\(0, 1fr\);[\s\S]*\.status-stack \{\s*grid-column:1 \/ -1;\s*grid-row:1;[\s\S]*width:100%;/,
  'global status should be pinned to a full-width titlebar grid row'
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
