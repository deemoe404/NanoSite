import { mdParse } from './js/markdown.js';
import { setupAnchors, setupTOC } from './js/toc.js';
import { applySavedTheme, bindThemeToggle } from './js/theme.js';
import { setupSearch } from './js/search.js';
import { extractExcerpt } from './js/content.js';
import { getQueryVariable, setDocTitle, cardImageSrc, fallbackCover, renderTags, slugifyTab } from './js/utils.js';

// Lightweight fetch helper
const getFile = (filename) => fetch(filename).then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });

let postsByLocationTitle = {};
let tabsBySlug = {};

function renderTabs(activeSlug) {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;
  const make = (slug, label) => `<a class="tab${activeSlug===slug?' active':''}" href="?tab=${encodeURIComponent(slug)}">${label}</a>`;
  let html = make('posts','All Posts');
  for (const [slug, info] of Object.entries(tabsBySlug)) html += make(slug, info.title);
  nav.innerHTML = html;
}

function displayPost(postname) {
  return getFile('wwwroot/' + postname).then(markdown => {
    const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
    const baseDir = `wwwroot/${dir}`;
    const output = mdParse(markdown, baseDir);
    const toc = document.getElementById('tocview');
    toc.style.display = '';
    toc.innerHTML = `<div class=\"toc-header\"><span>Contents</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">Top</a></div>${output.toc}`;
    document.getElementById('mainview').innerHTML = output.post;
    const searchBox = document.getElementById('searchbox');
    if (searchBox) searchBox.style.display = 'none';
    const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
    const fallback = postsByLocationTitle[postname] || postname;
    setDocTitle((firstHeading && firstHeading.textContent) || fallback);
    setupAnchors();
    setupTOC();
  }).catch(() => {
    document.getElementById('tocview').innerHTML = '';
    document.getElementById('mainview').innerHTML = '<div class="notice error"><h3>Post not found</h3><p>The requested post could not be loaded. <a href="./">Back to all posts</a>.</p></div>';
    setDocTitle('Not Found');
    const searchBox = document.getElementById('searchbox');
    if (searchBox) searchBox.style.display = 'none';
  });
}

function displayIndex(parsed) {
  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';

  const entries = Object.entries(parsed || {});

  let html = '<div class="index">';
  for (const [key, value] of entries) {
    const tag = value ? renderTags(value.tag) : '';
    const cover = (value && value.image)
      ? `<div class=\"card-cover-wrap\"><img class=\"card-cover\" alt=\"${key}\" src=\"${cardImageSrc(value.image)}\"></div>`
      : fallbackCover(key);
    html += `<a href=\"?id=${encodeURIComponent(value['location'])}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div>${tag}</a>`;
  }
  document.getElementById('mainview').innerHTML = `${html}</div>`;

  setupSearch(entries);
  renderTabs('posts');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = '';
  setDocTitle('All Posts');

  const cards = Array.from(document.querySelectorAll('.index a'));
  entries.forEach(([title, meta], idx) => {
    const loc = meta && meta.location ? String(meta.location) : '';
    if (!loc) return;
    getFile('wwwroot/' + loc).then(md => {
      const ex = extractExcerpt(md, 50);
      const el = cards[idx];
      if (!el) return;
      const exEl = el.querySelector('.card-excerpt');
      if (exEl) exEl.textContent = ex;
    }).catch(() => {});
  });
}

function displayStaticTab(slug) {
  const tab = tabsBySlug[slug];
  if (!tab) return displayIndex({});
  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
  renderTabs(slug);
  getFile('wwwroot/' + tab.location)
    .then(md => {
      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `wwwroot/${dir}`;
      const output = mdParse(md, baseDir);
      document.getElementById('mainview').innerHTML = output.post;
      const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
      setDocTitle((firstHeading && firstHeading.textContent) || tab.title);
    })
    .catch(() => {
      document.getElementById('mainview').innerHTML = '<div class="notice error"><h3>Page unavailable</h3><p>Could not load this tab.</p></div>';
      setDocTitle('Page Unavailable');
    });
}

// Boot
applySavedTheme();
bindThemeToggle();

getFile('wwwroot/index.json')
  .then(indexText => {
    let posts = {};
    try { posts = JSON.parse(indexText); } catch (e) { posts = {}; }
    return Promise.allSettled([
      Promise.resolve(posts),
      getFile('wwwroot/tabs.json').then(t => { try { return JSON.parse(t); } catch(_) { return {}; } }).catch(() => ({}))
    ]);
  })
  .then(results => {
    const posts = results[0].value || {};
    const tabs = results[1].status === 'fulfilled' ? (results[1].value || {}) : {};
    tabsBySlug = {};
    for (const [title, cfg] of Object.entries(tabs)) {
      const slug = slugifyTab(title);
      const loc = typeof cfg === 'string' ? cfg : String(cfg.location || '');
      if (!loc) continue;
      tabsBySlug[slug] = { title, location: loc };
    }
    const allowed = new Set(Object.values(posts).map(v => String(v.location)));
    postsByLocationTitle = {};
    for (const [title, meta] of Object.entries(posts)) {
      if (meta && meta.location) postsByLocationTitle[meta.location] = title;
    }
    const id = getQueryVariable('id');
    const tab = (getQueryVariable('tab') || 'posts').toLowerCase();
    const isValidId = (x) => typeof x === 'string' && !x.includes('..') && !x.startsWith('/') && !x.includes('\\') && allowed.has(x);
    if (isValidId(id)) {
      renderTabs('posts');
      displayPost(id);
    } else if (tab !== 'posts' && tabsBySlug[tab]) {
      displayStaticTab(tab);
    } else {
      renderTabs('posts');
      displayIndex(posts);
    }
  })
  .catch(() => {
    document.getElementById('tocview').innerHTML = '';
    document.getElementById('mainview').innerHTML = '<div class="notice error"><h3>Index unavailable</h3><p>Could not load the post index. Check network or repository contents.</p></div>';
  });

