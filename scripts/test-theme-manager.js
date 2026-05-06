import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
globalThis.document = {
  title: 'Press',
  baseURI: 'https://example.test/',
  documentElement: { setAttribute() {} },
  querySelectorAll: () => [],
  getElementById: () => null
};
globalThis.window = {
  location: { href: 'https://example.test/', protocol: 'https:' },
  dispatchEvent() {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

const {
  analyzeThemeArchive,
  clearThemeManagerState,
  collectThemeArchiveEntries,
  getThemeManagerCommitFiles,
  initThemeManager,
  normalizeThemeCatalog,
  normalizeThemeRegistry,
  normalizeThemeReleaseManifest,
  sanitizeThemeSlug,
  stageThemeUninstall,
  verifyThemeAsset
} = await import('../assets/js/theme-manager.js?theme-manager-test');

function makeZip(files) {
  const entries = {};
  Object.entries(files).forEach(([path, content]) => {
    entries[path] = content instanceof Uint8Array ? content : strToU8(String(content));
  });
  return zipSync(entries).buffer;
}

async function sha256(buffer) {
  const digest = await webcrypto.subtle.digest('SHA-256', buffer);
  return Buffer.from(digest).toString('hex');
}

function makeThemeManifest({
  name = 'Test',
  version = '1.0.0',
  contractVersion = 1,
  styles = ['theme.css'],
  modules = ['modules/layout.js'],
  overrides = {}
} = {}) {
  return {
    name,
    version,
    contractVersion,
    styles,
    modules,
    views: {
      post: { module: modules[0], handler: 'post' },
      posts: { module: modules[0], handler: 'posts' },
      search: { module: modules[0], handler: 'search' },
      tab: { module: modules[0], handler: 'tab' },
      error: { module: modules[0], handler: 'error' },
      loading: { module: modules[0], handler: 'loading' }
    },
    regions: {
      main: { required: true },
      toc: {},
      search: {},
      nav: {},
      tags: {},
      footer: { required: true }
    },
    components: ['press-search', 'press-toc', 'press-post-card'],
    scrollContainer: false,
    configSchema: { type: 'object', additionalProperties: true },
    content: { shapes: ['rawMarkdown', 'html', 'blocks', 'tocTree', 'headings', 'metadata', 'assets', 'links'] },
    ...overrides
  };
}

function makeThemeZip({ slug = 'test', name = 'Test', version = '1.0.0', contractVersion = 1, files = {} } = {}) {
  const manifest = makeThemeManifest({ name, version, contractVersion });
  return makeZip({
    [`press-theme-${slug}/theme.json`]: JSON.stringify(manifest, null, 2),
    [`press-theme-${slug}/theme.css`]: ':root{color-scheme:light;}',
    [`press-theme-${slug}/modules/layout.js`]: 'export default { mount() {}, views: {}, components: {}, effects: {} };',
    ...Object.fromEntries(Object.entries(files).map(([path, content]) => [`press-theme-${slug}/${path}`, content]))
  });
}

function mockFetchRegistry(registry, options = {}) {
  const textFiles = options.textFiles || {};
  const catalog = options.catalog || { schemaVersion: 1, themes: [] };
  const jsonFiles = options.jsonFiles || {};
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    if (url === 'assets/themes/packs.json') {
      return { ok: true, json: async () => registry };
    }
    if (url === 'assets/themes/catalog.json') {
      return { ok: true, json: async () => catalog };
    }
    if (Object.prototype.hasOwnProperty.call(jsonFiles, url)) {
      return { ok: true, json: async () => jsonFiles[url] };
    }
    if (Object.prototype.hasOwnProperty.call(textFiles, url)) {
      const value = String(textFiles[url]);
      return {
        ok: true,
        text: async () => value,
        arrayBuffer: async () => Buffer.from(value).buffer
      };
    }
    return {
      ok: false,
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };
}

async function run(name, fn) {
  try {
    clearThemeManagerState({ keepStatus: true });
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  } finally {
    delete globalThis.fetch;
  }
}

await run('normalizes registry and catalog metadata', async () => {
  assert.equal(sanitizeThemeSlug('Arcus Theme'), 'arcus-theme');
  const registry = normalizeThemeRegistry([
    { value: 'native', label: 'Native' },
    { value: 'arcus', label: 'Arcus', files: ['theme.json', 'modules/layout.js'] }
  ]);
  assert.equal(registry[0].value, 'native');
  assert.equal(registry[0].builtIn, true);
  assert.equal(registry[0].removable, false);
  assert.equal(registry[1].removable, true);

  const catalog = normalizeThemeCatalog({
    themes: [{ value: 'arcus', label: 'Arcus', repo: 'EkilyHQ/Press-Theme-Arcus', manifestUrl: 'https://example.test/theme-release.json' }]
  });
  assert.equal(catalog[0].value, 'arcus');
  assert.throws(() => normalizeThemeCatalog({ themes: [{ value: '!!!', manifestUrl: 'https://example.test' }] }), /invalid/i);
});

await run('keeps Press repository installed registry native-only', async () => {
  const packs = JSON.parse(readFileSync(new URL('../assets/themes/packs.json', import.meta.url), 'utf8'));
  const catalog = JSON.parse(readFileSync(new URL('../assets/themes/catalog.json', import.meta.url), 'utf8'));
  assert.deepEqual(packs.map((entry) => entry.value), ['native']);
  assert.deepEqual(catalog.themes.map((entry) => entry.value).sort(), ['arcus', 'cartograph', 'solstice']);
});

await run('normalizes release manifests and rejects contract mismatch', async () => {
  const manifest = normalizeThemeReleaseManifest({
    schemaVersion: 1,
    type: 'press-theme',
    value: 'arcus',
    label: 'Arcus',
    version: '1.2.3',
    contractVersion: 1,
    release: { tag: 'v1.2.3' },
    asset: {
      name: 'press-theme-arcus-v1.2.3.zip',
      url: 'https://example.test/press-theme-arcus-v1.2.3.zip',
      size: 10,
      digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
    },
    files: ['theme.json', 'theme.css']
  });
  assert.equal(manifest.value, 'arcus');
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, contractVersion: 2 }), /contractVersion/i);
});

await run('rejects unsafe and multi-theme ZIP archives', async () => {
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({ 'press-theme-test/../site.yaml': 'contentRoot: wwwroot' })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      '../theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      '../theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      './theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      './theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-test/theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      'press-theme-test/modules//layout.js': 'export {};'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({ 'press-theme-test/theme.css': 'body{}' })),
    /theme\.json/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'arcus/theme.json': '{"name":"Arcus","contractVersion":1}',
      'solstice/theme.json': '{"name":"Solstice","contractVersion":1}'
    })),
    /theme\.json|single|root/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 2 })),
    /contractVersion/i
  );
});

await run('rejects invalid theme manifests before staging', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await assert.rejects(
    () => analyzeThemeArchive(makeZip({
      'press-theme-bad/theme.json': JSON.stringify({
        name: 'Bad',
        version: '1.0.0',
        contractVersion: 1,
        styles: ['theme.css']
      }, null, 2),
      'press-theme-bad/theme.css': ':root{}'
    }), 'press-theme-bad-v1.0.0.zip'),
    /modules|content|views|regions/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);

  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-bad/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Bad',
        modules: ['modules/missing.js']
      }), null, 2),
      'press-theme-bad/theme.css': ':root{}'
    })),
    /modules.*missing/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-bad/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Bad',
        styles: ['missing.css']
      }), null, 2),
      'press-theme-bad/modules/layout.js': 'export default {};'
    })),
    /styles.*missing/i
  );
});

await run('verifies ZIP size and digest before official install', async () => {
  const buffer = makeThemeZip();
  const digest = await sha256(buffer);
  await verifyThemeAsset(buffer, {
    name: 'press-theme-test-v1.0.0.zip',
    size: buffer.byteLength,
    digest: `sha256:${digest}`
  }, 'press-theme-test-v1.0.0.zip');
  await assert.rejects(
    () => verifyThemeAsset(buffer, {
      name: 'press-theme-test-v1.0.0.zip',
      size: buffer.byteLength + 1,
      digest: `sha256:${digest}`
    }, 'press-theme-test-v1.0.0.zip'),
    /size/i
  );
  await assert.rejects(
    () => verifyThemeAsset(buffer, {
      name: 'press-theme-test-v1.0.0.zip',
      size: buffer.byteLength,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    }, 'press-theme-test-v1.0.0.zip'),
    /digest|hash/i
  );
});

await run('preserves zero-byte files from theme ZIP archives', async () => {
  const archive = collectThemeArchiveEntries(makeZip({
    'press-theme-test/theme.json': JSON.stringify(makeThemeManifest(), null, 2),
    'press-theme-test/theme.css': '',
    'press-theme-test/modules/layout.js': 'export default {};'
  }));
  const file = archive.files.find((entry) => entry.path === 'theme.css');
  assert(file);
  assert.equal(file.size, 0);
  assert.equal(file.content, '');
});

await run('stages a new theme install as additions plus packs.json', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await analyzeThemeArchive(makeThemeZip({ files: { 'modules/layout.js': 'export {};' } }), 'press-theme-test-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.state === 'added'));
  assert(files.some((file) => file.path === 'assets/themes/test/modules/layout.js' && file.state === 'added'));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && file.content.includes('"value": "test"')));
});

await run('refuses to stage theme writes when registry cannot be loaded', async () => {
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    if (url === 'assets/themes/packs.json') {
      return { ok: false, json: async () => [] };
    }
    return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  await assert.rejects(
    () => analyzeThemeArchive(makeThemeZip(), 'press-theme-test-v1.0.0.zip'),
    /registry|not staged/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('stages removed old files during theme update', async () => {
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '0.9.0', contractVersion: 1, files: ['theme.json', 'theme.css', 'modules/old.js'] }
  ]);
  await analyzeThemeArchive(makeThemeZip(), 'press-theme-test-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/modules/old.js' && file.deleted));
});

await run('infers old registry file inventory during theme update', async () => {
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'legacy', label: 'Legacy' }
  ], {
    textFiles: {
      'assets/themes/legacy/theme.json': JSON.stringify({
        name: 'Legacy',
        version: '0.9.0',
        contractVersion: 1,
        modules: ['modules/old.js']
      }),
      'assets/themes/legacy/modules/old.js': 'export {};'
    }
  });
  await analyzeThemeArchive(makeZip({
    'press-theme-legacy/theme.json': JSON.stringify(makeThemeManifest({
      name: 'Legacy',
      version: '1.0.0',
      styles: ['main.css'],
      modules: ['modules/new.js']
    }), null, 2),
    'press-theme-legacy/main.css': 'body{}',
    'press-theme-legacy/modules/new.js': 'export {};'
  }), 'press-theme-legacy-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(!files.some((file) => file.path === 'assets/themes/legacy/theme.css' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/modules/old.js' && file.deleted));
});

await run('stages uninstall deletions and falls back current default to native', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ]);
  await stageThemeUninstall('test');
  const files = getThemeManagerCommitFiles();
  assert.equal(themePack, 'native');
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "test"')));
});

await run('infers old registry file inventory during uninstall', async () => {
  initThemeManager({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'legacy', label: 'Legacy' }
  ], {
    textFiles: {
      'assets/themes/legacy/theme.json': JSON.stringify({
        name: 'Legacy',
        version: '0.9.0',
        contractVersion: 1,
        modules: ['modules/layout.js']
      }),
      'assets/themes/legacy/theme.css': 'body{}',
      'assets/themes/legacy/modules/layout.js': 'export {};'
    }
  });
  await stageThemeUninstall('legacy');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/legacy/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/theme.css' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/modules/layout.js' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "legacy"')));
});

await run('clearing uninstall staging restores the previous default theme', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ]);
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  clearThemeManagerState({ keepStatus: true });
  assert.equal(themePack, 'test');
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('post-commit theme cleanup keeps the published fallback default', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ]);
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  clearThemeManagerState({ keepStatus: true, keepSiteThemeFallback: true });
  assert.equal(themePack, 'native');
  assert.equal(getThemeManagerCommitFiles().length, 0);
});
