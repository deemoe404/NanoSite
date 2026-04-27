import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('assets/themes/native/modules/interactions.js', 'utf8');

assert.ok(
  !source.includes('function sequentialLoadCoversNative'),
  'Native index covers should not use a theme-specific serial loading queue'
);
assert.ok(
  !source.includes('sequentialLoadCoversNative('),
  'Native index cover loading should be delegated to browser image scheduling'
);
assert.ok(
  !source.includes('data-src="${escapeHtml(cardImageSrc(coverSrc))}"'),
  'Native index cover templates should not hide image URLs behind data-src'
);

const directCoverSrcMatches = source.match(/<img class="card-cover"[^`]*\ssrc="\$\{escapeHtml\(cardImageSrc\(coverSrc\)\)\}"/g) || [];
assert.ok(
  directCoverSrcMatches.length >= 2,
  'Native index and search cover templates should render direct src attributes'
);

console.log('ok - native index covers use direct browser image loading');
