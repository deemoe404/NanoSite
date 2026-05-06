import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
globalThis.document = {
  title: 'Press',
  baseURI: 'https://example.test/',
  documentElement: { setAttribute() {} },
  querySelectorAll: () => []
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
  analyzeArchive,
  collectSystemUpdateArchiveEntries,
  clearSystemUpdateState,
  getDisplayReleaseNotes,
  normalizeSystemReleaseManifest,
  selectSystemUpdateAsset,
  verifySystemUpdateAsset
} = await import('../assets/js/system-updates.js?system-updates-test');

function makeZip(files) {
  const entries = {};
  Object.entries(files).forEach(([path, content]) => {
    entries[path] = strToU8(String(content));
  });
  return zipSync(entries).buffer;
}

async function sha256(buffer) {
  const digest = await webcrypto.subtle.digest('SHA-256', buffer);
  return Buffer.from(digest).toString('hex');
}

function jsonResponse(data, options = {}) {
  const {
    ok = true,
    status = ok ? 200 : 500,
    headers = {}
  } = options;
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    ok,
    status,
    headers: {
      get(name) {
        return normalizedHeaders[String(name || '').toLowerCase()] || null;
      }
    },
    json: async () => data,
    arrayBuffer: async () => new ArrayBuffer(0)
  };
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await run('selects the dedicated Press system release asset', async () => {
  const asset = selectSystemUpdateAsset({
    assets: [
      { name: 'source.zip', browser_download_url: 'https://example.test/source.zip' },
      { name: 'press-system-v3.3.5.zip', browser_download_url: 'https://example.test/system.zip' }
    ]
  });

  assert.equal(asset.name, 'press-system-v3.3.5.zip');
  assert.equal(asset.url, 'https://example.test/system.zip');
  assert.equal(selectSystemUpdateAsset({
    assets: [{ name: 'Press-v3.3.5-source.zip', browser_download_url: 'https://example.test/source.zip' }]
  }), null);
});

await run('verifies release asset size and digest before archive comparison', async () => {
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html>' });
  const digest = await sha256(buffer);

  await verifySystemUpdateAsset(buffer, {
    name: 'press-system-v3.3.5.zip',
    size: buffer.byteLength,
    digest: `sha256:${digest}`
  }, 'press-system-v3.3.5.zip');

  await assert.rejects(
    () => verifySystemUpdateAsset(buffer, {
      name: 'press-system-v3.3.5.zip',
      size: buffer.byteLength,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    }, 'press-system-v3.3.5.zip'),
    /sha-?256|digest|hash/i
  );
});

await run('normalizes static system release manifests', async () => {
  const release = normalizeSystemReleaseManifest({
    schemaVersion: 1,
    name: 'v3.3.5',
    tag: 'v3.3.5',
    publishedAt: '2026-04-29T08:18:39Z',
    notes: 'Release notes',
    htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
    asset: {
      name: 'press-system-v3.3.5.zip',
      url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
      size: 123,
      digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
    }
  });

  assert.equal(release.tag, 'v3.3.5');
  assert.equal(release.asset.name, 'press-system-v3.3.5.zip');
  assert.throws(
    () => normalizeSystemReleaseManifest({
      schemaVersion: 1,
      name: 'v3.3.5',
      tag: 'v3.3.5',
      publishedAt: '2026-04-29T08:18:39Z',
      notes: '',
      htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5'
    }),
    /manifest/i
  );
  assert.throws(
    () => normalizeSystemReleaseManifest({
      schemaVersion: 1,
      name: 'v3.3.5',
      tag: 'v3.3.5',
      publishedAt: '2026-04-29T08:18:39Z',
      notes: '',
      htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
      asset: {
        name: 'Press-v3.3.5-source.zip',
        url: 'https://github.com/EkilyHQ/Press/archive/refs/tags/v3.3.5.zip',
        size: 123,
        digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
      }
    }),
    /manifest/i
  );
});

await run('hides stale release notes when no Press system package is attached', async () => {
  const stalePackageName = `${String.fromCharCode(110, 97, 110, 111)}site-system-v3.3.36.zip`;
  assert.equal(getDisplayReleaseNotes({
    name: 'v3.3.36',
    notes: `Use \`${stalePackageName}\`.`,
    asset: null
  }), '');

  assert.equal(getDisplayReleaseNotes({
    name: 'v3.3.37',
    notes: 'Use `press-system-v3.3.37.zip`.',
    asset: { name: 'press-system-v3.3.37.zip' }
  }), 'Use `press-system-v3.3.37.zip`.');
});

await run('falls back to the static release manifest when the GitHub API is rate limited', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>manifest</p>' });
  const digest = await sha256(buffer);
  let apiCalls = 0;
  let manifestCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      apiCalls += 1;
      return jsonResponse({ message: 'rate limited' }, {
        ok: false,
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' }
      });
    }
    if (url.includes('assets/system-release.json')) {
      manifestCalls += 1;
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }
      });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(buffer, 'press-system-v3.3.5.zip');

  assert.equal(apiCalls, 1);
  assert.equal(manifestCalls, 1);
  delete globalThis.fetch;
});

await run('uses the static manifest digest when verifying a selected archive', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>manifest</p>' });

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      return jsonResponse({ message: 'rate limited' }, {
        ok: false,
        status: 429
      });
    }
    if (url.includes('assets/system-release.json')) {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
        }
      });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await assert.rejects(
    () => analyzeArchive(buffer, 'press-system-v3.3.5.zip'),
    /sha-?256|digest|hash/i
  );
  delete globalThis.fetch;
});

await run('normalizes a rooted system update archive to safe site-relative paths', async () => {
  const buffer = makeZip({
    'press-system-v3.3.5/index.html': '<!doctype html>',
    'press-system-v3.3.5/assets/js/system-updates.js': 'export {};'
  });

  const entries = collectSystemUpdateArchiveEntries(buffer);

  assert.deepEqual(entries.map((entry) => entry.path).sort(), [
    'assets/js/system-updates.js',
    'index.html'
  ]);
});

await run('rejects archives that would overwrite user content or site config', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/wwwroot/index.yaml': 'posts: []'
    })),
    /unsafe|system update/i
  );

  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});

await run('rejects path traversal entries before comparing files', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/../site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});

await run('does not poison expected release digest from a selected local archive', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const wrongBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>wrong</p>' });
  const rightBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>right</p>' });
  let releaseCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      releaseCalls += 1;
      return {
        ok: true,
        json: async () => ({
          name: 'v3.3.5',
          tag_name: 'v3.3.5',
          assets: [{
            name: 'press-system-v3.3.5.zip',
            browser_download_url: 'https://example.test/press-system-v3.3.5.zip',
            size: 0,
            digest: ''
          }]
        })
      };
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(wrongBuffer, 'press-system-v3.3.5.zip');
  await analyzeArchive(rightBuffer, 'press-system-v3.3.5.zip');

  assert.equal(releaseCalls, 1);
  delete globalThis.fetch;
});
