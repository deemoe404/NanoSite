import assert from 'node:assert/strict';

globalThis.document = {
  title: 'Press',
  baseURI: 'http://example.test/'
};
globalThis.window = {
  location: {
    protocol: 'http:',
    search: '',
    origin: 'http://example.test'
  }
};
globalThis.location = globalThis.window.location;

const { createContentModel } = await import('../assets/js/content-model.js');
const { mdParse } = await import('../assets/js/markdown.js');

const markdown = `---
title: Contract Test
tag: [alpha, beta]
---

# Contract Test

Intro with [internal](?id=post/example.md) and [external](https://example.com).

![Cover](cover.jpeg)

## Section A

- one
- two

### Detail

> Quote

\`\`\`js
console.log('ok');
\`\`\`
`;

const parsed = mdParse(markdown, 'wwwroot/post/example');
const model = createContentModel({
  rawMarkdown: markdown,
  html: parsed.post,
  tocHtml: parsed.toc,
  metadata: { location: 'post/example.md' },
  baseDir: 'wwwroot/post/example',
  location: 'post/example.md'
});

assert.equal(model.rawMarkdown, markdown, 'rawMarkdown should preserve the input');
assert.match(model.html, /<h1 id="0">/, 'html should come from the markdown renderer');
assert.ok(Array.isArray(model.blocks), 'blocks should be an array');
assert.ok(model.blocks.some((block) => block.type === 'heading' && block.level === 2), 'blocks should include heading levels');
assert.ok(model.blocks.some((block) => block.type === 'list'), 'blocks should include list blocks');
assert.ok(model.blocks.some((block) => block.type === 'code'), 'blocks should include code blocks');
assert.deepEqual(
  model.headings.map((heading) => [heading.level, heading.text]),
  [[1, 'Contract Test'], [2, 'Section A'], [3, 'Detail']],
  'headings should preserve level and text'
);
assert.equal(model.tocTree.length, 1, 'tocTree should start at h2');
assert.equal(model.tocTree[0].children[0].text, 'Detail', 'tocTree should nest h3 under h2');
assert.equal(model.metadata.title, 'Contract Test', 'front matter title should be included in metadata');
assert.equal(model.metadata.location, 'post/example.md', 'runtime metadata should be merged');
assert.equal(model.assets[0].url, 'wwwroot/post/example/cover.jpeg', 'assets should resolve relative to baseDir');
assert.ok(model.links.some((link) => link.href === '?id=post/example.md' && link.internal), 'internal links should be identified');
assert.ok(model.links.some((link) => link.href === 'https://example.com' && !link.internal), 'external links should be identified');

console.log('ok - content model');
