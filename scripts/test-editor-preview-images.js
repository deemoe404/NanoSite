import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class TestNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
  }

  appendChild(node) {
    if (!node) return node;
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }
}

class TestElement extends TestNode {
  constructor(tagName) {
    super();
    this.tagName = String(tagName || '').toUpperCase();
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  replaceChildren(...nodes) {
    this.childNodes = [];
    nodes.forEach(node => this.appendChild(node));
  }
}

class TestTextNode extends TestNode {
  constructor(text) {
    super();
    this.textContent = String(text || '');
  }
}

class TestDocumentFragment extends TestNode {}

const documentRef = {
  baseURI: 'http://127.0.0.1:8000/index_editor.html',
  createDocumentFragment() {
    return new TestDocumentFragment();
  },
  createElement(tagName) {
    return new TestElement(tagName);
  },
  createTextNode(text) {
    return new TestTextNode(text);
  }
};

globalThis.window = {
  __press_content_root: 'wwwroot',
  location: { protocol: 'http:' }
};
globalThis.document = documentRef;
globalThis.location = { origin: 'http://127.0.0.1:8000' };

const utilsSource = readFileSync('assets/js/utils.js', 'utf8');
assert.equal(
  utilsSource.includes('target.setHTML(input'),
  false,
  'editor preview should not bypass Press sanitizer with native setHTML'
);
assert.equal(
  utilsSource.includes("'Sanitizer' in window"),
  false,
  'editor preview should not use native Sanitizer defaults that can drop rendered media'
);

const { mdParse } = await import('../assets/js/markdown.js?editor-preview-images');
const { setSafeHtml } = await import('../assets/js/utils.js?editor-preview-images');

function collectElements(node, tagName, out = []) {
  if (!node) return out;
  if (node.tagName && node.tagName.toLowerCase() === tagName) out.push(node);
  (node.childNodes || []).forEach(child => collectElements(child, tagName, out));
  return out;
}

const markdown = readFileSync('wwwroot/post/page/githubpages_chs.md', 'utf8');
const baseDir = 'wwwroot/post/page/';
const parsed = mdParse(markdown, baseDir).post;
assert.equal((parsed.match(/<img\b/g) || []).length, 2);

const target = documentRef.createElement('div');
setSafeHtml(target, parsed, baseDir, { alreadySanitized: true });

const images = collectElements(target, 'img');
assert.equal(images.length, 2);
assert.equal(images[0].getAttribute('src'), 'wwwroot/post/page/page.jpeg');
assert.equal(images[0].getAttribute('alt'), 'page');
assert.equal(images[1].getAttribute('src'), 'wwwroot/post/page/step.jpeg');
assert.equal(images[1].getAttribute('alt'), 'step');

console.log('ok - editor preview sanitizer preserves rendered article images');
