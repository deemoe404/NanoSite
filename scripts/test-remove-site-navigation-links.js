import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const read = (path) => readFileSync(resolve(root, path), 'utf8');

const schema = JSON.parse(read('assets/schema/site.json'));
const composer = read('assets/js/composer.js');
const nativeInteractions = read('assets/themes/native/modules/interactions.js');

assert.ok(
  Object.prototype.hasOwnProperty.call(schema.properties, 'profileLinks'),
  'site schema should still expose profileLinks'
);

assert.equal(
  Object.prototype.hasOwnProperty.call(schema.properties, 'links'),
  false,
  'site schema should not expose the deprecated site.links navigation field'
);

assert.doesNotMatch(
  composer,
  /\blinks:\s*\{\s*i18nKey:\s*'editor\.composer\.site\.fields\.navLinks'/,
  'composer diff labels should not include a site.links navigation label'
);

assert.doesNotMatch(
  composer,
  /\bsite\.links\b|\bsrc\.links\b|\bsnapshot\.links\b|\bcur\.links\b|\bbase\.links\b/,
  'composer site state should not read, diff, or save site.links'
);

assert.doesNotMatch(
  composer,
  /createLinkListField\(seoSection,\s*'links'/,
  'site editor should not render a Navigation links list field'
);

assert.doesNotMatch(
  nativeInteractions,
  /cfg\.profileLinks\s*\|\|\s*cfg\.links/,
  'native theme should not fall back from profileLinks to deprecated site.links'
);

for (const locale of ['chs', 'cht-hk', 'cht-tw', 'en', 'ja']) {
  const source = read(`assets/i18n/${locale}.js`);
  assert.doesNotMatch(
    source,
    /\bnavLinks\b/,
    `${locale} locale should not keep Navigation links editor copy`
  );
}

console.log('ok - site.links navigation configuration is removed');
