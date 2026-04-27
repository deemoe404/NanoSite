import assert from 'node:assert/strict';

globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {}, getAttribute() { return 'en'; } },
  getElementById() { return null; },
  querySelectorAll() { return []; }
};
globalThis.window = globalThis.window || {
  location: { href: 'https://example.test/', pathname: '/' },
  dispatchEvent() {}
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    configurable: true
  });
} catch (_) {}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const requests = [];

globalThis.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.endsWith('/index.yaml')) {
    return {
      ok: true,
      text: async () => [
        'demo:',
        '  en:',
        '    - post/demo.md',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/post/demo.md')) {
    return {
      ok: true,
      text: async () => [
        '---',
        'title: Demo Title',
        'date: 2026-04-27',
        '---',
        'Demo body.',
        ''
      ].join('\n')
    };
  }
  return { ok: false, status: 404, text: async () => '' };
};

const { initI18n, loadContentJsonWithRaw } = await import('../assets/js/i18n.js');

await initI18n({ lang: 'en', persist: false });
const result = await loadContentJsonWithRaw('wwwroot', 'index');

assert.equal(requests.filter(url => url.endsWith('/index.yaml')).length, 1);
assert.deepEqual(result.raw, { demo: { en: ['post/demo.md'] } });
assert.equal(result.entries.demo.location, 'post/demo.md');

console.log('ok - loadContentJsonWithRaw returns raw index without a duplicate index fetch');
