import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const composerPath = resolve(here, '../assets/js/composer.js');
const source = readFileSync(composerPath, 'utf8');

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
  /\.cs-identity-grid,.cs-localized-list--grid\{--cs-editor-row-gap:\.35rem;--cs-editor-row-column-gap:\.45rem;--cs-editor-control-height:1\.95rem\}/,
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
