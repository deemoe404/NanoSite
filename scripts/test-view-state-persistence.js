import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const composer = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const main = readFileSync(resolve(here, '../assets/main.js'), 'utf8');
const nativeTheme = readFileSync(resolve(here, '../assets/themes/native/modules/interactions.js'), 'utf8');
const arcusTheme = readFileSync(resolve(here, '../assets/themes/arcus/modules/interactions.js'), 'utf8');
const solsticeTheme = readFileSync(resolve(here, '../assets/themes/solstice/modules/interactions.js'), 'utf8');

assert.match(
  composer,
  /editorState: 'press_composer_editor_state'[\s\S]*const EDITOR_STATE_VERSION = 3;/,
  'editor should persist the unified v3 state in the existing editor-state localStorage slot'
);

assert.match(
  composer,
  /expandedNodeIds: Array\.from\(expandedEditorTreeNodeIds\)\.filter\(Boolean\)[\s\S]*railScrollTop: getEditorRailScrollTop\(\)[\s\S]*contentScrollByKey: \{ \.\.\.editorContentScrollByKey \}/,
  'editor v3 state should include exact tree expansion plus rail and per-view content scroll positions'
);

assert.match(
  composer,
  /if \(isV3 && Array\.isArray\(data\.expandedNodeIds\)\) \{[\s\S]*expandedEditorTreeNodeIds\.clear\(\);[\s\S]*expandedEditorTreeNodeIds\.add\(id\);/,
  'restoring v3 state should replace the default expansion set with the saved expansion set'
);

assert.match(
  composer,
  /selectEditorTreeNodeForTab\(tab, \{ expandAncestors: !options\.preserveTreeExpansion \}\)/,
  'restore-mode markdown selection should be able to preserve the saved expansion set without auto-expanding ancestors'
);

assert.match(
  composer,
  /const restoredEditorState = restoreDynamicEditorState\(\);[\s\S]*allowEditorStatePersist = true;[\s\S]*window\.setTimeout\(\(\) => persistDynamicEditorState\(\), 500\)/,
  'editor should delay the first post-restore save so restored scroll positions are not overwritten at boot'
);

assert.match(
  main,
  /const SITE_VIEW_STATE_KEY = 'press_site_view_state_v1';[\s\S]*function getRouteKeyFromUrl/,
  'front-end runtime should define a dedicated persisted view-state store and stable route-key helper'
);

assert.match(
  main,
  /function hasExplicitSiteEntryQuery\(urlLike\) \{[\s\S]*for \(const \[key, value\] of url\.searchParams\.entries\(\)\) \{[\s\S]*if \(String\(key \|\| ''\)\.trim\(\) \|\| String\(value \|\| ''\)\.trim\(\)\) return true;[\s\S]*function restoreLastSiteRouteIfEntry\(\) \{[\s\S]*if \(hasExplicitSiteEntryQuery\(window\.location\.href\)\) return false;[\s\S]*history\.replaceState\(history\.state \|\| \{\}, document\.title, target\.toString\(\)\);[\s\S]*restoreLastSiteRouteIfEntry\(\);[\s\S]*const loadResults = await Promise\.allSettled/,
  'front-end runtime should not replace entry URLs that carry any explicit query intent, including lang'
);

assert.match(
  main,
  /persistSiteViewState\(\);[\s\S]*history\.pushState\(\{\}, '', url\.toString\(\)\);/,
  'client-side navigation should save the outgoing route scroll state before changing URL'
);

assert.match(
  main,
  /persistSiteViewState\(\{ updateScroll: false \}\);[\s\S]*restoreSavedSiteScrollForCurrentRoute\(\);/,
  'each rendered route should persist its identity without overwriting saved scroll before restoration'
);

assert.match(
  main,
  /requestAnimationFrame\(\(\) => requestAnimationFrame\(apply\)\)/,
  'scroll restoration should run after render-time scroll-to-top hooks'
);

assert.match(
  [nativeTheme, arcusTheme, solsticeTheme].join('\n'),
  /hooks\.getScrollState = \(\) =>[\s\S]*hooks\.restoreScrollState = \(params = \{\}\) =>/,
  'all shipped themes should expose scroll-state hooks for route restoration'
);

console.log('ok - view state persistence');
