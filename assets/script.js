function escapeHtml(text) {
  return typeof (text) === 'string' ? text
    .replace(/&(?!#[0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;') : null;
}

function escapeMarkdown(text) {
  const parts = text.replace(/\\`/g, "&#096;").split("`");
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
        .replace(/\\\\/g, "&#092;")
        .replace(/\\\*/g, "&#042;")
        .replace(/\\_/g, "&#095;")
        .replace(/\\{/g, "&#123;").replace(/\\}/g, "&#125;")
        .replace(/\\\[/g, "&#091;").replace(/\\\]/g, "&#093;")
        .replace(/\\\(/g, "&#040;").replace(/\\\)/g, "&#041;")
        .replace(/\\#/g, "&#035;")
        .replace(/\\\+/g, "&#043;")
        .replace(/\\-/g, "&#045;")
        .replace(/\\\./g, "&#046;")
        .replace(/\\!/g, "&#033;")
        .replace(/\\\|/g, "&#124;")
        .replace(/<!--[\s\S]*?-->/g, '');
    } else { result += parts[i]; }
    if (i < parts.length - 1) { result += "`"; }
  }
  return result;
}

function sanitizeUrl(url) {
  const s = String(url || '').trim();
  const lower = s.toLowerCase();
  const proto = lower.match(/^([a-z][a-z0-9+.-]*):/);
  if (!proto) return s; // relative URL
  const p = proto[1];
  return ['http', 'https', 'mailto', 'tel'].includes(p) ? s : '#';
}

function resolveImageSrc(src, baseDir) {
  const s = String(src || '').trim();
  if (/^[a-z][a-z0-9+.-]*:/.test(s) || s.startsWith('/') || s.startsWith('#')) {
    return sanitizeUrl(s);
  }
  const base = String(baseDir || '').replace(/^\/+|\/+$/g, '') + '/';
  try {
    const u = new URL(s, `${location.origin}/${base}`);
    return u.pathname.replace(/^\/+/, '');
  } catch (_) {
    return `${base}${s}`.replace(/\/+/, '/');
  }
}

function replaceInline(text, baseDir) {
  const parts = text.split("`");
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Images: optional title
        .replace(/!\[(.*?)\]\(([^\s\)]*?)(?:\s*&quot;(.*?)&quot;)?\)/g, (m, alt, src, title) => {
          const t = title ? ` title="${title}"` : '';
          return `<img src="${resolveImageSrc(src, baseDir)}" alt="${alt}"${t}>`;
        })
        // Links (non-image): optional title, no lookbehind
        .replace(/(^|[^!])\[(.*?)\]\(([^\s\)]*?)(?:\s*&quot;(.*?)&quot;)?\)/g, (m, prefix, text2, href, title) => {
          const t = title ? ` title="${title}"` : '';
          return `${prefix}<a href="${sanitizeUrl(href)}"${t}>${text2}</a>`;
        })
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/^\*\*\*$/gm, '<hr>')
        .replace(/^---$/gm, '<hr>');
    } else { result += parts[i]; };
    if (i < parts.length - 1) { result += "`"; }
  }
  return result
    .replace(/\`(.*?)\`/g, '<code class="inline">$1</code>')
    .replace(/^\s*$/g, "<br>");
}

function tocParser(titleLevels, liTags) {
  const root = document.createElement('ul');
  const listStack = [root];
  const liStack = [];

  for (let i = 0; i < titleLevels.length; i++) {
    const level = Math.max(1, Number(titleLevels[i]) || 1);
    const liTag = liTags[i];

    while (listStack.length - 1 > level - 1) { listStack.pop(); liStack.pop(); }
    while (listStack.length - 1 < level - 1) {
      const parentLi = liStack[liStack.length - 1] || null;
      const newList = document.createElement('ul');
      (parentLi || root).appendChild(newList);
      listStack.push(newList);
    }

    const currentList = listStack[listStack.length - 1];
    const li = document.createElement('li');
    li.innerHTML = liTag;
    const link = li.querySelector('a');
    currentList.appendChild(li);

    if (liStack.length < listStack.length) { liStack.push(li); } else { liStack[liStack.length - 1] = li; }
  }
  return root.outerHTML;
}

// New parser with paragraph handling and safer block closures
function mdParse(markdown, baseDir) {
  const lines = markdown.split('\n');
  let html = "", tochtml = [], tochirc = [];
  let isInCode = false, isInBigCode = false, isInTable = false, isInTodo = false, isInPara = false;
  const closePara = () => { if (isInPara) { html += '</p>'; isInPara = false; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('````')) {
      closePara();
      if (!isInBigCode) { isInBigCode = true; html += '<pre><code>'; }
      else { isInBigCode = false; html += '</code></pre>'; }
      continue;
    } else if (isInBigCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    if (line.startsWith('```') && !isInBigCode) {
      closePara();
      if (!isInCode) { isInCode = true; html += '<pre><code>'; }
      else { isInCode = false; html += '</code></pre>'; }
      continue;
    } else if (isInCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    const rawLine = escapeMarkdown(line);

    // Blockquote
    if (rawLine.startsWith('>')) {
      closePara();
      let quote = `${rawLine.slice(1).trim()}`;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].startsWith('>')) quote += `\n${lines[j].slice(1).trim()}`;
        else break;
      }
      html += `<blockquote>${mdParse(quote, baseDir).post}</blockquote>`;
      i = j - 1;
      continue;
    }

    // Tables (simple pipe rows)
    if (rawLine.startsWith('|')) {
      closePara();
      const tabs = rawLine.split('|');
      if (!isInTable) {
        if (i + 1 < lines.length && lines[i + 1].startsWith('|')) {
          isInTable = true;
          html += '<div class="table-wrap"><table><thead><tr>';
          for (let j = 1; j < tabs.length - 1; j++) html += `<th>${mdParse(tabs[j].trim(), baseDir).post}</th>`;
          html += '</tr></thead><tbody>';
        }
      } else {
        html += '<tr>';
        for (let j = 1; j < tabs.length - 1; j++) html += `<td>${mdParse(tabs[j].trim(), baseDir).post}</td>`;
        html += '</tr>';
      }
      if (i + 1 >= lines.length || !lines[i + 1].startsWith('|')) {
        html += '</tbody></table></div>';
        isInTable = false;
      }
      continue;
    } else if (isInTable) {
      html += '</tbody></table></div>';
      isInTable = false;
    }

    // To-do list
    const match = rawLine.match(/^[-*] \[([ x])\]/);
    if (match) {
      closePara();
      if (!isInTodo) { isInTodo = true; html += '<ul class="todo">'; }
      const taskText = replaceInline(escapeHtml(rawLine.slice(5).trim()), baseDir);
      html += match[1] === 'x'
        ? `<li><input type="checkbox" id="todo${i}" disabled checked><label for="todo${i}">${taskText}</label></li>`
        : `<li><input type="checkbox" id="todo${i}" disabled><label for="todo${i}">${taskText}</label></li>`;
      if (i + 1 >= lines.length || !escapeMarkdown(lines[i + 1]).match(/^[-*] \[([ x])\]/)) { html += '</ul>'; isInTodo = false; }
      continue;
    } else if (isInTodo) { html += '</ul>'; isInTodo = false; }

    // Headings
    if (rawLine.startsWith('#')) {
      closePara();
      const level = rawLine.match(/^#+/)[0].length;
      const text = replaceInline(escapeHtml(rawLine.slice(level).trim()), baseDir);
      html += `<h${level} id="${i}"><a class="anchor" href="#${i}" aria-label="Permalink">#</a>${text}</h${level}>`;
      if (level >= 2 && level <= 3) {
        tochtml.push(`<a href="#${i}">${text}</a>`);
        tochirc.push(level);
      }
      continue;
    }

    // Blank line => close paragraph
    if (rawLine.trim() === '') { closePara(); continue; }

    // Regular paragraph text
    if (!isInPara) { html += '<p>'; isInPara = true; }
    html += `${replaceInline(escapeHtml(rawLine), baseDir)}`;
    if (i + 1 < lines.length && escapeMarkdown(lines[i + 1]).trim() !== '') html += '<br>';
  }

  if (isInPara) html += '</p>';
  if (isInTable) html += '</tbody></table>';
  if (isInTodo) html += '</ul>';

  return { post: html, toc: `${tocParser(tochirc, tochtml)}` };
}
// Removed legacy markdownParser in favor of mdParse

function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(variable);
  return value !== null ? decodeURIComponent(value) : null;
}

const getFile = filename => fetch(filename).then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.text(); });
const baseSiteTitle = (() => {
  const t = document.title || 'NanoSite';
  return t.trim() || 'NanoSite';
})();
function setDocTitle(title) {
  if (title && title.trim()) document.title = `${title.trim()} · ${baseSiteTitle}`;
  else document.title = baseSiteTitle;
}
let postsByLocationTitle = {};
function cardImageSrc(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'wwwroot/' + s.replace(/^\/+/, '');
}
function fallbackCover(title) {
  const t = String(title || '').trim();
  const initial = t ? escapeHtml(t[0].toUpperCase()) : '?';
  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#f87171', '#10b981', '#fb7185'];
  let sum = 0; for (let i = 0; i < t.length; i++) sum = (sum + t.charCodeAt(i)) % 9973;
  const color = palette[sum % palette.length];
  return `<div class=\"card-cover-wrap card-fallback\" style=\"--cover-bg:${color}\"><span class=\"cover-initial\">${initial}</span></div>`;
}
function renderTags(tagVal) {
  if (!tagVal && tagVal !== 0) return '';
  let tags = [];
  if (Array.isArray(tagVal)) tags = tagVal;
  else if (typeof tagVal === 'string') tags = tagVal.split(',');
  else tags = [String(tagVal)];
  tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (!tags.length) return '';
  return `<div class=\"tags\">${tags.map(t => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>`;
}
function stripMarkdownToText(md) {
  const lines = md.split('\n');
  let text = [];
  let inCode = false, inBigCode = false;
  for (let raw of lines) {
    if (raw.startsWith('````')) { inBigCode = !inBigCode; continue; }
    if (inBigCode) continue;
    if (raw.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (raw.trim().startsWith('|')) continue; // skip tables for snippet
    if (/^\s*#+\s*/.test(raw)) continue; // skip titles entirely for snippet
    if (/^\s*>/.test(raw)) raw = raw.replace(/^\s*>\s?/, '');
    // images -> alt text
    raw = raw.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // links -> text
    raw = raw.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
    // inline code/emphasis markers
    raw = raw.replace(/`([^`]*)`/g, '$1')
             .replace(/\*\*([^*]+)\*\*/g, '$1')
             .replace(/\*([^*]+)\*/g, '$1')
             .replace(/~~([^~]+)~~/g, '$1')
             .replace(/_([^_]+)_/g, '$1');
    text.push(raw.trim());
  }
  return text.join(' ').replace(/\s+/g, ' ').trim();
}
function extractExcerpt(md, wordLimit = 50) {
  const lines = md.split('\n');
  // find first heading index
  let firstH = -1, secondH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i])) { firstH = i; break; }
  }
  if (firstH === -1) {
    // no headings; use from start
    const text = stripMarkdownToText(md);
    return limitWords(text, wordLimit);
  }
  for (let j = firstH + 1; j < lines.length; j++) {
    if (/^\s*#/.test(lines[j])) { secondH = j; break; }
  }
  const segment = lines.slice(firstH + 1, secondH === -1 ? lines.length : secondH).join('\n');
  const text = stripMarkdownToText(segment);
  return limitWords(text, wordLimit);
}
function limitWords(text, n) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  return words.slice(0, n).join(' ') + '…';
}

const displayPost = postname => getFile("wwwroot/" + postname).then(markdown => {
  const dir = (postname.lastIndexOf('/') >= 0) ? postname.slice(0, postname.lastIndexOf('/') + 1) : '';
  const baseDir = `wwwroot/${dir}`;
  const output = mdParse(markdown, baseDir);
  const toc = document.getElementById("tocview");
  toc.style.display = '';
  toc.innerHTML = `<div class=\"toc-header\"><span>Contents</span><a href=\"#\" class=\"toc-top\" aria-label=\"Back to top\">Top</a></div>${output.toc}`;
  document.getElementById("mainview").innerHTML = output.post;
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
  // Title from first heading or index.json mapping
  const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
  const fallback = postsByLocationTitle[postname] || postname;
  setDocTitle((firstHeading && firstHeading.textContent) || fallback);
  setupAnchors();
  setupTOC();
}).catch(() => {
  document.getElementById("tocview").innerHTML = '';
  document.getElementById("mainview").innerHTML = '<div class="notice error"><h3>Post not found</h3><p>The requested post could not be loaded. <a href="./">Back to all posts</a>.</p></div>';
  setDocTitle('Not Found');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
});

const slugifyTab = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');
let tabsBySlug = {};
function renderTabs(activeSlug) {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;
  const make = (slug, label) => `<a class="tab${activeSlug===slug?' active':''}" href="?tab=${encodeURIComponent(slug)}">${label}</a>`;
  let html = make('posts','All Posts');
  for (const [slug, info] of Object.entries(tabsBySlug)) html += make(slug, info.title);
  nav.innerHTML = html;
}

const displayIndex = (parsed) => {
  const toc = document.getElementById("tocview");
  toc.innerHTML = '';
  toc.style.display = 'none';

  const entries = Object.entries(parsed || {});
  const count = entries.length;
  // Try to find demo link
  const demo = entries.find(([title, v]) => /feature demo/i.test(title));
  const demoHref = demo ? `?id=${encodeURIComponent(demo[1].location)}` : '#';

  let html = "<div class=\"index\">";
  for (const [key, value] of entries) {
    const tag = value ? renderTags(value.tag) : '';
    const cover = (value && value.image)
      ? `<div class=\"card-cover-wrap\"><img class=\"card-cover\" alt=\"${key}\" src=\"${cardImageSrc(value.image)}\"></div>`
      : fallbackCover(key);
    html += `<a href=\"?id=${encodeURIComponent(value['location'])}\" data-idx=\"${encodeURIComponent(key)}\">${cover}<div class=\"card-title\">${key}</div><div class=\"card-excerpt\"></div>${tag}</a>`;
  }
  document.getElementById("mainview").innerHTML = `${html}</div>`;

  // Hook up search filter
  setupSearch(entries);
  // Tabs
  renderTabs('posts');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = '';
  setDocTitle('All Posts');

  // Populate excerpts asynchronously
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
};

function displayStaticTab(slug) {
  const tab = tabsBySlug[slug];
  if (!tab) return displayIndex({});
  const toc = document.getElementById('tocview');
  toc.innerHTML = '';
  toc.style.display = 'none';
  const search = document.getElementById('searchInput');
  const searchBox = document.getElementById('searchbox');
  if (searchBox) searchBox.style.display = 'none';
  renderTabs(slug);
  getFile('wwwroot/' + tab.location)
    .then(md => {
      const dir = (tab.location.lastIndexOf('/') >= 0) ? tab.location.slice(0, tab.location.lastIndexOf('/') + 1) : '';
      const baseDir = `wwwroot/${dir}`;
      const output = mdParse(md, baseDir);
      document.getElementById('mainview').innerHTML = output.post;
      // Prefer first heading text for title; fallback to tab title
      const firstHeading = document.querySelector('#mainview h1, #mainview h2, #mainview h3');
      setDocTitle((firstHeading && firstHeading.textContent) || tab.title);
    })
    .catch(() => {
      document.getElementById('mainview').innerHTML = '<div class="notice error"><h3>Page unavailable</h3><p>Could not load this tab.</p></div>';
      setDocTitle('Page Unavailable');
    });
}

function setupSearch(entries){
  const input = document.getElementById('searchInput');
  if (!input) return;
  const container = document.getElementById('mainview');
  const cards = () => Array.from(container.querySelectorAll('.index a'));
  const titles = entries.map(([t]) => t.toLowerCase());
  input.value = '';
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    cards().forEach((el, idx) => {
      const match = !q || titles[idx].includes(q);
      el.style.display = match ? '' : 'none';
    });
  };
}

// Initialize: load index and route safely
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

// Enable copy-to-clipboard for heading anchors
function setupAnchors() {
  const container = document.getElementById('mainview');
  if (!container) return;
  const headings = container.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]');
  headings.forEach(h => {
    const a = h.querySelector('a.anchor');
    if (!a) return;
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = `${location.href.split('#')[0]}#${h.id}`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const tmp = document.createElement('textarea');
          tmp.value = url; document.body.appendChild(tmp); tmp.select();
          document.execCommand('copy'); document.body.removeChild(tmp);
        }
        a.classList.add('copied');
        const prevTitle = a.getAttribute('title') || '';
        a.setAttribute('title', 'Copied!');
        setTimeout(() => { a.classList.remove('copied'); a.setAttribute('title', prevTitle); }, 1000);
        // Update hash for navigation
        history.replaceState(null, '', `#${h.id}`);
      } catch (_) {
        // Fallback: navigate to the anchor
        location.hash = h.id;
      }
    });
  });

  // No TOC copy anchors anymore
}

// Enhance TOC: toggles, active highlighting
function setupTOC() {
  const tocRoot = document.getElementById('tocview');
  if (!tocRoot) return;

  const list = tocRoot.querySelector('ul');
  if (!list) return;

  // Add toggles for nested lists
  tocRoot.querySelectorAll('li').forEach(li => {
    const sub = li.querySelector(':scope > ul');
    const link = li.querySelector(':scope > a');
    // Ensure a row wrapper so nested UL stays below
    let row = li.querySelector(':scope > .toc-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'toc-row';
      if (link) li.insertBefore(row, link);
      else if (sub) li.insertBefore(row, sub);
      else li.appendChild(row);
    }
    // Move existing direct children link/copy into row
    if (link) row.appendChild(link);
    if (sub) {
      const btn = document.createElement('button');
      btn.className = 'toc-toggle';
      btn.setAttribute('aria-label', 'Toggle section');
      btn.setAttribute('aria-expanded', 'true');
      btn.innerHTML = '<span class="caret"></span>';
      row.insertBefore(btn, row.firstChild || null);
      btn.addEventListener('click', () => {
        const collapsed = sub.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
      // Collapse deep levels by default
      const depth = getDepth(li);
      if (depth >= 2) {
        sub.classList.add('collapsed');
        btn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Map heading ids to TOC links
  const idToLink = new Map();
  tocRoot.querySelectorAll('a[href^="#"]:not(.toc-anchor)').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (id) idToLink.set(id, a);
  });

  // Active highlight helpers
  // Track only H2 and H3 headings
  const headings = Array.from(document.querySelectorAll('#mainview h2[id], #mainview h3[id]'));
  const trackable = new Set(headings.map(h => h.id));
  const onActive = (id) => {
    tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
    const link = idToLink.get(id);
    if (link) {
      link.classList.add('active');
      // Expand all parent lists to reveal active
      let node = link.parentElement;
      while (node && node !== tocRoot) {
        const sub = node.querySelector(':scope > ul');
        const btn = node.querySelector(':scope > .toc-toggle');
        if (sub && sub.classList.contains('collapsed')) {
          sub.classList.remove('collapsed');
          if (btn) btn.setAttribute('aria-expanded', 'true');
        }
        node = node.parentElement;
      }
    }
  };

  // Scroll-based active detection: pick the last heading above viewport threshold
  let ticking = false;
  function computePositions() {
    return headings.map(h => ({ id: h.id, top: h.getBoundingClientRect().top + window.scrollY }));
  }
  let positions = computePositions();
  function updateActive() {
    ticking = false;
    const y = window.scrollY + 120; // offset to consider a heading 'current'
    let currentId = positions[0] ? positions[0].id : null;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].top <= y) currentId = positions[i].id; else break;
    }
    if (currentId) onActive(currentId);
  }
  window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(updateActive); ticking = true; } });
  window.addEventListener('resize', () => { positions = computePositions(); updateActive(); });
  // Recompute after images load (layout shift)
  window.addEventListener('load', () => { positions = computePositions(); updateActive(); });

  // Immediate highlight based on current hash or first heading
  const current = (location.hash || '').replace(/^#/, '');
  if (current && idToLink.has(current) && trackable.has(current)) onActive(current);
  else updateActive();

  // Also update active on TOC click for instant feedback
  tocRoot.querySelectorAll('a[href^="#"]:not(.toc-anchor)').forEach(a => {
    a.addEventListener('click', () => {
      const id = (a.getAttribute('href') || '').replace('#','');
      if (id && trackable.has(id)) onActive(id);
      else tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
    });
  });

  // Back to top handler
  const topLink = tocRoot.querySelector('.toc-top');
  if (topLink) {
    topLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      tocRoot.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
    });
  }

  // Utility: compute depth based on nesting level
  function getDepth(el) {
    let d = 0; let n = el;
    while (n && n !== tocRoot) { if (n.tagName === 'UL') d++; n = n.parentElement; }
    // d-1 to make top-level items depth 0
    return Math.max(0, d - 1);
  }
}
// Theme helpers
function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (saved === 'light') document.documentElement.removeAttribute('data-theme');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) { /* ignore */ }
}

function bindThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const setDark = (on) => {
    if (on) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', on ? 'dark' : 'light'); } catch (_) {}
  };
  btn.addEventListener('click', () => setDark(!isDark()));
}
