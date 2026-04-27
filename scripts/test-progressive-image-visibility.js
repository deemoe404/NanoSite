import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function parseRules(css) {
  const withoutComments = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(withoutComments))) {
    const selectors = match[1]
      .split(',')
      .map(selector => selector.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    const declarations = new Map();
    match[2].split(';').forEach(part => {
      const idx = part.indexOf(':');
      if (idx === -1) return;
      const property = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim().toLowerCase();
      if (property) declarations.set(property, value);
    });
    rules.push({ selectors, declarations });
  }
  return rules;
}

function assertSelectorDoesNotHideLoadingImage(file, selector) {
  const css = readFileSync(file, 'utf8');
  const rules = parseRules(css).filter(rule => rule.selectors.includes(selector));
  assert.ok(rules.length > 0, `Missing CSS rule for ${selector} in ${file}`);
  rules.forEach(rule => {
    const opacity = rule.declarations.get('opacity');
    assert.notEqual(opacity, '0', `${selector} in ${file} hides the loading image with opacity: 0`);
  });
}

[
  ['assets/themes/native/base.css', '.index .card-cover'],
  ['assets/themes/native/base.css', '.post-image-wrap .post-img'],
  ['assets/themes/native/base.css', '#mainview .link-card .card-cover'],
  ['assets/themes/arcus/theme.css', '.arcus-article__body .post-image-wrap .post-img'],
  ['assets/themes/arcus/theme.css', '.arcus-static__body .post-image-wrap .post-img'],
  ['assets/themes/arcus/theme.css', '.arcus-article__body .link-card .card-cover'],
  ['assets/themes/arcus/theme.css', '.arcus-static__body .link-card .card-cover'],
  ['assets/themes/solstice/theme.css', '.solstice-article__body .post-image-wrap .post-img'],
  ['assets/themes/solstice/theme.css', '.solstice-static__body .post-image-wrap .post-img'],
  ['assets/themes/solstice/theme.css', '.solstice-card__cover img']
].forEach(([file, selector]) => assertSelectorDoesNotHideLoadingImage(file, selector));

console.log('ok - loading images remain visible behind skeleton overlays');
