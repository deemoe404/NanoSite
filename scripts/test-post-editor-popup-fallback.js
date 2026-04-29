import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const themePath = resolve(here, '../assets/js/theme.js');
const source = readFileSync(themePath, 'utf8');

assert.match(
  source,
  /const editorUrl = 'index_editor\.html';/,
  'post editor button should keep one canonical editor URL'
);

assert.match(
  source,
  /window\.open\(editorUrl,\s*'_blank'\)/,
  'post editor button should still prefer opening the editor in a new tab'
);

assert.match(
  source,
  /popupUsable = !!popup\.document;/,
  'post editor button should verify the popup is actually usable before skipping fallback'
);

assert.match(
  source,
  /popup\.opener = null;/,
  'post editor button should detach opener after a successful popup open'
);

assert.match(
  source,
  /window\.location\.href = editorUrl;/,
  'post editor button should fall back to same-tab navigation when popup opening fails'
);

assert.doesNotMatch(
  source,
  /window\.setTimeout\(\(\) => \{[\s\S]*window\.location\.href = editorUrl;/,
  'post editor button should not schedule a delayed redirect after popup open succeeds'
);

assert.doesNotMatch(
  source,
  /document\.visibilityState === 'visible'/,
  'post editor button should not treat a visible opener page as popup failure'
);
