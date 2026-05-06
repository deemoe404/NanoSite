import assert from 'node:assert/strict';

globalThis.document = { title: 'Press' };
globalThis.window = { location: { search: '', href: 'https://example.test/' } };

let removed = false;
const listeners = [];

const ph = {
  parentNode: {
    removeChild(node) {
      if (node === ph) removed = true;
    }
  }
};

const img = {
  complete: true,
  naturalWidth: 0,
  style: {},
  classList: {
    add() {}
  },
  addEventListener(type) {
    listeners.push(type);
  }
};

const wrap = {
  querySelector(selector) {
    if (selector === 'img.card-cover') return img;
    if (selector === '.ph-skeleton') return ph;
    return null;
  }
};

const root = {
  querySelectorAll(selector) {
    assert.equal(selector, '.index .card-cover-wrap, .link-card .card-cover-wrap');
    return [wrap];
  }
};

const { hydrateCardCovers } = await import('../assets/js/post-render.js?card-cover-error-state-test');

hydrateCardCovers(root);

assert.equal(removed, true);
assert.equal(img.style.opacity, '1');
assert.deepEqual(listeners, []);

console.log('ok - completed failed card covers clear skeleton immediately');
