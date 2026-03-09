import assert from 'node:assert/strict';

import {
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings
} from '../assets/js/frontmatter-document.js';
import { parseFrontMatter } from '../assets/js/content.js';
import { insertImageMarkdownAtSelection, normalizeDateInputValue } from '../assets/js/editor-markdown-ops.js';

const ensureKeyOrder = (order = [], key) => {
  if (!key) return order;
  if (!order.includes(key)) order.push(key);
  return order;
};

const createState = (markdown) => {
  const parsed = parseMarkdownFrontMatter(markdown);
  const data = cloneFrontMatterData(parsed.frontMatter);
  const order = parsed.document && Array.isArray(parsed.document.knownOrder)
    ? parsed.document.knownOrder.slice()
    : [];
  const bindings = resolveFrontMatterBindings(data, parsed.document);
  return { parsed, data, order, bindings };
};

const build = (state, body) => buildMarkdownWithFrontMatter(state.parsed.document, body, state.data, {
  bindings: resolveFrontMatterBindings(state.data, state.parsed.document),
  order: state.order,
  eol: state.parsed.eol,
  trailingNewline: state.parsed.trailingNewline
});

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('preserves complex front matter bytes when only the body changes', () => {
  const source = [
    '---',
    '# lead comment',
    'excerpt: |',
    '  first line',
    '  second line',
    'nested:',
    '  hero:',
    '    alt: Welcome',
    'tags:',
    '  - alpha',
    '  - beta',
    'aiGenerated: true',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  const output = build(state, 'Updated body.\n');
  assert.equal(output, `${state.parsed.document.originalFull}\nUpdated body.\n`);
});

run('editing a known field preserves unknown nested metadata and comments', () => {
  const source = [
    '---',
    '# intro',
    'excerpt: |',
    '  old line',
    '',
    '# keep this comment',
    'nested:',
    '  hero:',
    '    alt: Welcome',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.excerpt = 'new line one\nnew line two';
  ensureKeyOrder(state.order, 'excerpt');
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /excerpt: \|\n  new line one\n  new line two/);
  assert.match(output, /# keep this comment/);
  assert.match(output, /nested:\n  hero:\n    alt: Welcome/);
});

run('new known fields are inserted with canonical ordering', () => {
  const source = [
    '---',
    'excerpt: Existing summary',
    'tags:',
    '  - alpha',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.title = 'A title';
  state.data.author = 'NanoSite';
  ensureKeyOrder(state.order, 'title');
  ensureKeyOrder(state.order, 'author');
  const output = build(state, 'Body paragraph.\n');
  const titleIndex = output.indexOf('title: A title');
  const excerptIndex = output.indexOf('excerpt: Existing summary');
  const authorIndex = output.indexOf('author: NanoSite');
  const tagsIndex = output.indexOf('tags:');
  assert.ok(titleIndex >= 0 && excerptIndex >= 0 && titleIndex < excerptIndex);
  assert.ok(authorIndex >= 0 && tagsIndex >= 0 && authorIndex < tagsIndex);
});

run('boolean fields can be cleared back to an unset state', () => {
  const source = [
    '---',
    'draft: true',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  delete state.data.draft;
  const output = build(state, 'Body paragraph.\n');
  assert.ok(!output.includes('draft: true'));
  assert.ok(!output.includes('draft: false'));
});

run('boolean false is preserved as an explicit value', () => {
  const source = [
    '---',
    'aiGenerated: true',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.aiGenerated = false;
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /aiGenerated: false/);
});

run('legacy aliases keep their original keys when rewritten', () => {
  const source = [
    '---',
    'cover: hero.jpg',
    'wip: yes',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.cover = 'hero-next.jpg';
  state.data.wip = false;
  ensureKeyOrder(state.order, 'cover');
  ensureKeyOrder(state.order, 'wip');
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /cover: hero-next\.jpg/);
  assert.match(output, /wip: false/);
  assert.ok(!output.includes('image: hero-next.jpg'));
  assert.ok(!output.includes('draft: false'));
});

run('editing an unrelated field preserves all legacy aliases for the same field', () => {
  const source = [
    '---',
    'title: Old title',
    'cover: hero.jpg',
    'coverImage: hero-wide.jpg',
    'wip: true',
    'unfinished: false',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.title = 'New title';
  ensureKeyOrder(state.order, 'title');
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /title: New title/);
  assert.match(output, /cover: hero\.jpg/);
  assert.match(output, /coverImage: hero-wide\.jpg/);
  assert.match(output, /wip: true/);
  assert.match(output, /unfinished: false/);
});

run('editing the bound alias preserves distinct sibling alias values', () => {
  const source = [
    '---',
    'cover: hero.jpg',
    'coverImage: hero-wide.jpg',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.cover = 'hero-next.jpg';
  ensureKeyOrder(state.order, 'cover');
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /cover: hero-next\.jpg/);
  assert.match(output, /coverImage: hero-wide\.jpg/);
});

run('image insertion uses body offsets and keeps front matter intact', () => {
  const source = [
    '---',
    'title: Demo',
    'draft: false',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  const body = state.parsed.content;
  const insertion = insertImageMarkdownAtSelection(body, 0, 0, 'assets/hero.png', 'Hero');
  const output = build(state, insertion.value);
  assert.ok(output.startsWith('---\ntitle: Demo\ndraft: false\n---\n'));
  assert.match(output, /---\n!\[Hero\]\(assets\/hero\.png\)\n\nBody paragraph\.\n$/);
  assert.ok(output.indexOf('![Hero](assets/hero.png)') > output.indexOf('\n---\n'));
});

run('content parser reads block scalar excerpts', () => {
  const source = [
    '---',
    'excerpt: |',
    '  first line',
    '  second line',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.excerpt, 'first line\nsecond line');
  assert.equal(parsed.content, 'Body paragraph.');
});

run('content parser preserves legacy cover aliases for downstream metadata consumers', () => {
  const source = [
    '---',
    'cover: hero.jpg',
    'coverImage: hero-wide.jpg',
    'banner: hero-banner.jpg',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.cover, 'hero.jpg');
  assert.equal(parsed.frontMatter.coverImage, 'hero-wide.jpg');
  assert.equal(parsed.frontMatter.banner, 'hero-banner.jpg');
});

run('content parser preserves legacy draft aliases for UI metadata flows', () => {
  const source = [
    '---',
    'wip: yes',
    'unfinished: false',
    'inprogress: enabled',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.wip, true);
  assert.equal(parsed.frontMatter.unfinished, false);
  assert.equal(parsed.frontMatter.inprogress, true);
});

run('content parser recognizes quoted boolean front matter values', () => {
  const source = [
    '---',
    'draft: \"false\"',
    'wip: \'yes\'',
    'aiGenerated: \"true\"',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.draft, false);
  assert.equal(parsed.frontMatter.wip, true);
  assert.equal(parsed.frontMatter.aiGenerated, true);
});

run('content parser splits comma-separated tag scalars into separate items', () => {
  const source = [
    '---',
    'tags: alpha, beta, gamma',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.deepEqual(parsed.frontMatter.tags, ['alpha', 'beta', 'gamma']);
});

run('date input normalization preserves the source calendar day for zoned ISO values', () => {
  assert.equal(normalizeDateInputValue('2026-03-01T00:30:00+09:00'), '2026-03-01');
  assert.equal(normalizeDateInputValue('2026-03-01'), '2026-03-01');
});
