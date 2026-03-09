import assert from 'node:assert/strict';

import {
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings
} from '../assets/js/frontmatter-document.js';
import { parseFrontMatter } from '../assets/js/content.js';

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
