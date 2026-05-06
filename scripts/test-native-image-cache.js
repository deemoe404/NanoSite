import assert from 'node:assert/strict';

const attrs = new Map();
const fetchCalls = [];

const avatarImg = {
  dataset: {},
  setAttribute(name, value) {
    attrs.set(name, String(value));
  },
  getAttribute(name) {
    return attrs.get(name) || '';
  }
};

const documentRef = {
  documentElement: {
    setAttribute() {},
    getAttribute() { return 'en'; }
  },
  body: {
    appendChild() {},
    removeChild() {}
  },
  createElement() {
    return {
      className: '',
      classList: { add() {}, remove() {}, contains() { return false; } },
      dataset: {},
      style: {},
      appendChild() {},
      setAttribute() {},
      getAttribute() { return ''; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  },
  createTextNode(value) {
    return { textContent: String(value || '') };
  },
  getElementById() {
    return null;
  },
  querySelector(selector) {
    if (selector === '.site-card .avatar') return avatarImg;
    return {
      textContent: '',
      appendChild() {},
      setAttribute() {},
      getAttribute() { return ''; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  },
  querySelectorAll() {
    return [];
  }
};

const windowRef = {
  location: { href: 'https://example.test/', pathname: '/' },
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame(callback) {
    return setTimeout(callback, 0);
  },
  cancelAnimationFrame(id) {
    clearTimeout(id);
  }
};

globalThis.window = windowRef;
globalThis.document = documentRef;
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init: init ? { ...init } : init });
  return { ok: true, blob: async () => new Blob(['image']) };
};

const { mount } = await import('../assets/themes/native/modules/interactions.js?native-image-cache-test');

const nativeTheme = mount({ window: windowRef, document: documentRef });
nativeTheme.effects.renderSiteIdentity({
  config: { siteTitle: 'Press', siteSubtitle: 'Fast images', avatar: 'assets/avatar.png' }
});

assert.equal(fetchCalls.length, 0);
assert.equal(attrs.get('src'), 'assets/avatar.png');

console.log('ok - native local images use browser image cache instead of no-store fetch');
