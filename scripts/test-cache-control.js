import assert from 'node:assert/strict';

let moduleSeq = 0;

async function loadCacheControl({ pathname = '/' } = {}) {
  const calls = [];
  globalThis.window = {
    location: { href: `https://example.test${pathname}`, pathname },
    fetch: async (input, init) => {
      calls.push({ input, init: init ? { ...init } : init });
      return { ok: true, text: async () => '', json: async () => ({}) };
    }
  };
  globalThis.Request = class Request {
    constructor(url) {
      this.url = url;
    }
  };

  const mod = await import(`../assets/js/cache-control.js?cache-test=${moduleSeq++}`);
  return { mod, calls };
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  } finally {
    delete globalThis.window;
    delete globalThis.Request;
  }
}

await run('main site downgrades explicit no-store content fetches to browser default', async () => {
  const { calls } = await loadCacheControl({ pathname: '/' });

  await window.fetch('/wwwroot/index.yaml', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
});

await run('editor pages keep content fetches on no-store by default', async () => {
  const { calls } = await loadCacheControl({ pathname: '/index_editor.html' });

  await window.fetch('/wwwroot/post/demo.md', { cache: 'default' });

  assert.equal(calls[0].init.cache, 'no-store');
});

await run('site cachePolicy.content can force no-cache on main site content', async () => {
  const { mod, calls } = await loadCacheControl({ pathname: '/' });

  mod.configureFetchCachePolicy({ cachePolicy: { content: 'no-cache' } });
  await window.fetch('/wwwroot/tabs.yml', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'no-cache');
});

await run('invalid site cache policy values fall back to defaults', async () => {
  const { mod, calls } = await loadCacheControl({ pathname: '/' });

  mod.configureFetchCachePolicy({ cachePolicy: { content: 'reload', editorContent: 'force-cache' } });
  await window.fetch('/wwwroot/post/demo.md', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
});

await run('non-content resources keep their existing cache behavior', async () => {
  const { calls } = await loadCacheControl({ pathname: '/' });

  await window.fetch('/assets/main.js', { cache: 'no-cache' });
  await window.fetch('/assets/i18n/languages.json', { cache: 'no-store' });
  await window.fetch('/assets/hero.jpeg', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
  assert.equal(calls[1].init.cache, 'no-store');
  assert.equal(calls[2].init.cache, 'no-store');
});
