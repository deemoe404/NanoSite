import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
globalThis.document = {
  title: 'NanoSite',
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
  collectSystemUpdateArchiveEntries,
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

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await run('selects the dedicated NanoSite system release asset', async () => {
  const asset = selectSystemUpdateAsset({
    assets: [
      { name: 'source.zip', browser_download_url: 'https://example.test/source.zip' },
      { name: 'nanosite-system-v3.3.5.zip', browser_download_url: 'https://example.test/system.zip' }
    ]
  });

  assert.equal(asset.name, 'nanosite-system-v3.3.5.zip');
  assert.equal(asset.url, 'https://example.test/system.zip');
  assert.equal(selectSystemUpdateAsset({
    assets: [{ name: 'NanoSite-v3.3.5-source.zip', browser_download_url: 'https://example.test/source.zip' }]
  }), null);
});

await run('verifies release asset size and digest before archive comparison', async () => {
  const buffer = makeZip({ 'nanosite-system-v3.3.5/index.html': '<!doctype html>' });
  const digest = await sha256(buffer);

  await verifySystemUpdateAsset(buffer, {
    name: 'nanosite-system-v3.3.5.zip',
    size: buffer.byteLength,
    digest: `sha256:${digest}`
  }, 'nanosite-system-v3.3.5.zip');

  await assert.rejects(
    () => verifySystemUpdateAsset(buffer, {
      name: 'nanosite-system-v3.3.5.zip',
      size: buffer.byteLength,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    }, 'nanosite-system-v3.3.5.zip'),
    /sha-?256|digest|hash/i
  );
});

await run('normalizes a rooted system update archive to safe site-relative paths', async () => {
  const buffer = makeZip({
    'nanosite-system-v3.3.5/index.html': '<!doctype html>',
    'nanosite-system-v3.3.5/assets/js/system-updates.js': 'export {};'
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
      'nanosite-system-v3.3.5/wwwroot/index.yaml': 'posts: []'
    })),
    /unsafe|system update/i
  );

  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'nanosite-system-v3.3.5/site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});

await run('rejects path traversal entries before comparing files', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'nanosite-system-v3.3.5/../site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});
