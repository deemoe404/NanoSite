import assert from 'node:assert/strict';

globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {}, getAttribute() { return 'en'; } },
  getElementById() { return null; },
  querySelector() { return null; },
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
  if (textUrl.endsWith('/assets/i18n/languages.json')) {
    return {
      ok: true,
      json: async () => [
        { value: 'en', label: 'English', module: './en.js' },
        { value: 'chs', label: '简体中文', module: './chs.js' },
        { value: 'cht-tw', label: '正體中文（台灣）', module: './cht-tw.js' },
        { value: 'cht-hk', label: '繁體中文（香港）', module: './cht-hk.js' },
        { value: 'ja', label: '日本語', module: './ja.js' }
      ]
    };
  }
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

const { initI18n, loadContentJsonWithRaw, getAvailableLangs, getContentLangs, getCurrentLang } = await import('../assets/js/i18n.js');

await initI18n({ lang: 'en', persist: false });
const result = await loadContentJsonWithRaw('wwwroot', 'index');

assert.equal(requests.filter(url => url.endsWith('/index.yaml')).length, 1);
assert.deepEqual(result.raw, { demo: { en: ['post/demo.md'] } });
assert.equal(result.entries.demo.location, 'post/demo.md');
assert.deepEqual(getContentLangs(), ['en']);
assert.deepEqual(getAvailableLangs(), ['en', 'chs', 'cht-tw', 'cht-hk', 'ja']);

const browserLanguagePrefix = String.fromCharCode(122, 104);
Object.defineProperty(globalThis, 'navigator', {
  value: { language: `${browserLanguagePrefix}-HK` },
  configurable: true
});
await initI18n({ persist: false });
assert.equal(getCurrentLang(), 'cht-hk');

console.log('ok - loadContentJsonWithRaw returns raw index without a duplicate index fetch');
