import assert from 'node:assert/strict';

import {
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings
} from '../assets/js/frontmatter-document.js';
import { getManualMarkdownSaveState } from '../assets/js/composer-markdown-save.js';
import { parseFrontMatter } from '../assets/js/content.js';
import { insertImageMarkdownAtSelection, normalizeDateInputValue } from '../assets/js/editor-markdown-ops.js';
import { mergeYamlConfig, resolveSiteRepoConfig } from '../assets/js/yaml.js';

globalThis.document = globalThis.document || { title: 'NanoSite' };

const { mdParse } = await import('../assets/js/markdown.js');

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

run('editing an unrelated field preserves known keys that fail strict parsing', () => {
  const source = [
    '---',
    'title: Demo',
    'draft: maybe',
    'tags:',
    '  primary: alpha',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const state = createState(source);
  state.data.title = 'Updated demo';
  ensureKeyOrder(state.order, 'title');
  const output = build(state, 'Body paragraph.\n');
  assert.match(output, /title: Updated demo/);
  assert.match(output, /draft: maybe/);
  assert.match(output, /tags:\n  primary: alpha/);
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

run('content parser ignores indented fence markers inside block scalars', () => {
  const source = [
    '---',
    'excerpt: |',
    '  first line',
    '  ---',
    '  second line',
    'date: 2026-03-10',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.excerpt, 'first line\n---\nsecond line');
  assert.equal(parsed.frontMatter.date, '2026-03-10');
  assert.equal(parsed.content, 'Body paragraph.');
});

run('mixed body EOL does not leak into preserved front matter', () => {
  const source = '---\ntitle: Demo\n---\nBody paragraph.\r\n';
  const state = createState(source);
  assert.equal(state.parsed.eol, '\n');
  assert.equal(state.parsed.document.originalFull, '---\ntitle: Demo\n---');
  const output = build(state, 'Updated body.\n');
  assert.equal(output, '---\ntitle: Demo\n---\nUpdated body.\n');
});

run('front matter-only edits preserve a missing trailing newline at EOF', () => {
  const source = '---\ntitle: Demo\n---';
  const state = createState(source);
  state.data.title = 'Updated demo';
  ensureKeyOrder(state.order, 'title');
  const output = build(state, '');
  assert.equal(output, '---\ntitle: Updated demo\n---');
});

run('content parser preserves hash characters inside plain scalar values', () => {
  const source = [
    '---',
    'title: C# tips',
    'image: docs/page#section',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.title, 'C# tips');
  assert.equal(parsed.frontMatter.image, 'docs/page#section');
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

run('content parser recognizes known keys case-insensitively', () => {
  const source = [
    '---',
    'Title: Demo title',
    'Date: 2026-03-10',
    'Tags: alpha, beta',
    'CoverImage: hero-wide.jpg',
    '---',
    'Body paragraph.',
    ''
  ].join('\n');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.frontMatter.title, 'Demo title');
  assert.equal(parsed.frontMatter.date, '2026-03-10');
  assert.deepEqual(parsed.frontMatter.tags, ['alpha', 'beta']);
  assert.equal(parsed.frontMatter.coverImage, 'hero-wide.jpg');
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

run('manual markdown save requires dirty non-empty content', () => {
  assert.deepEqual(getManualMarkdownSaveState('', true), {
    canSave: false,
    content: '',
    reason: 'empty'
  });
  assert.deepEqual(getManualMarkdownSaveState('Body paragraph.', false), {
    canSave: false,
    content: 'Body paragraph.',
    reason: 'clean'
  });
  assert.deepEqual(getManualMarkdownSaveState('Body\r\nparagraph.\r\n', true), {
    canSave: true,
    content: 'Body\nparagraph.\n',
    reason: 'default'
  });
});

run('markdown parser treats inline HTML tags as literal text', () => {
  const output = mdParse('Hello <span class="raw">HTML</span>.').post;
  assert.equal(output, '<p>Hello &lt;span class=&quot;raw&quot;&gt;HTML&lt;/span&gt;.</p>');
});

run('markdown parser treats block HTML tags as literal text', () => {
  const output = mdParse([
    '<div class="raw">',
    '**Not a live tag block**',
    '</div>',
    ''
  ].join('\n')).post;
  assert.ok(!output.includes('<div class="raw">'));
  assert.ok(!output.includes('</div>'));
  assert.match(output, /&lt;div class=&quot;raw&quot;&gt;/);
  assert.match(output, /<strong>Not a live tag block<\/strong>/);
  assert.match(output, /&lt;\/div&gt;/);
});

run('markdown parser treats HTML comments as literal text', () => {
  const output = mdParse('Before <!-- hidden --> after.').post;
  assert.equal(output, '<p>Before &lt;!-- hidden --&gt; after.</p>');
});

run('local site overrides merge into tracked site config without dropping fields', () => {
  const merged = mergeYamlConfig(
    {
      contentRoot: 'wwwroot',
      themePack: 'paper',
      repo: { owner: 'deemoe404', name: 'NanoSite', branch: 'main' }
    },
    { contentRoot: 'wwwroot.local' }
  );
  assert.deepEqual(merged, {
    contentRoot: 'wwwroot.local',
    themePack: 'paper',
    repo: { owner: 'deemoe404', name: 'NanoSite', branch: 'main' }
  });
});

run('local site overrides merge nested config objects recursively', () => {
  const merged = mergeYamlConfig(
    {
      repo: { owner: 'deemoe404', name: 'NanoSite', branch: 'main' },
      seo: { title: 'NanoSite', keywords: ['nano', 'site'] }
    },
    {
      repo: { branch: 'dev' },
      seo: { title: 'NanoSite Local' }
    }
  );
  assert.deepEqual(merged, {
    repo: { owner: 'deemoe404', name: 'NanoSite', branch: 'dev' },
    seo: { title: 'NanoSite Local', keywords: ['nano', 'site'] }
  });
});

run('site repo resolution merges local overrides over tracked composer state', () => {
  const resolved = resolveSiteRepoConfig(
    {
      repo: { owner: 'deemoe404', name: 'NanoSite', branch: 'main' }
    },
    {
      repo: { branch: 'dev' }
    }
  );
  assert.deepEqual(resolved, {
    owner: 'deemoe404',
    name: 'NanoSite',
    branch: 'dev'
  });
});
