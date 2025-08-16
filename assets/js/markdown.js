import { escapeHtml, escapeMarkdown, sanitizeUrl, resolveImageSrc } from './utils.js';

function isPipeTableSeparator(line) {
  // Matches a classic Markdown table separator like:
  // | ----- | :----: | ------- |
  const s = String(line || '').trim();
  if (!s.startsWith('|')) return false;
  const cells = s.split('|').slice(1, -1); // drop leading/trailing pipes
  if (cells.length === 0) return false;
  for (const c of cells) {
    if (!/^\s*:?-{3,}:?\s*$/.test(c)) return false;
  }
  return true;
}

function replaceInline(text, baseDir) {
  const parts = String(text || '').split('`');
  let result = '';
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
    } else { result += parts[i]; }
    if (i < parts.length - 1) { result += '`'; }
  }
  return result
    .replace(/\`(.*?)\`/g, '<code class="inline">$1</code>')
    .replace(/^\s*$/g, '<br>');
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

export function mdParse(markdown, baseDir) {
  const lines = String(markdown || '').split('\n');
  let html = '', tochtml = [], tochirc = [];
  let isInCode = false, isInBigCode = false, isInTable = false, isInTodo = false, isInPara = false;
  let codeLang = '';
  const closePara = () => { if (isInPara) { html += '</p>'; isInPara = false; } };
  // Basic list support (unordered/ordered, with simple nesting by indent)
  const listStack = []; // stack of { indent: number, type: 'ul'|'ol' }
  const countIndent = (s) => {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === ' ') n += 1; else if (s[i] === '\t') n += 4; else break;
    }
    return n;
  };
  const closeAllLists = () => {
    while (listStack.length) {
      const last = listStack.pop();
      html += (last.type === 'ul') ? '</ul>' : '</ol>';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ltrim3 = line.replace(/^( {0,3})/, '');

    // Code blocks
    if (ltrim3.startsWith('````')) {
      closePara();
      if (!isInBigCode) { isInBigCode = true; codeLang = (ltrim3.slice(4).trim().split(/\s+/)[0] || '').toLowerCase(); html += `<pre><code${codeLang?` class=\"language-${codeLang}\"`:''}>`; }
      else { isInBigCode = false; codeLang = ''; html += '</code></pre>'; }
      continue;
    } else if (isInBigCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    if (ltrim3.startsWith('```') && !isInBigCode) {
      closePara();
      if (!isInCode) { isInCode = true; codeLang = (ltrim3.slice(3).trim().split(/\s+/)[0] || '').toLowerCase(); html += `<pre><code${codeLang?` class=\"language-${codeLang}\"`:''}>`; }
      else { isInCode = false; codeLang = ''; html += '</code></pre>'; }
      continue;
    } else if (isInCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    const rawLine = escapeMarkdown(line);

    // If currently inside a list but the next line starts a fenced code/table/blockquote/header,
    // we'll close lists right before handling those blocks (see below after matches).

    // Blockquote
    if (rawLine.startsWith('>')) {
      closeAllLists();
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

    // Tables (GitHub-style pipe tables)
    if (rawLine.startsWith('|')) {
      closePara();
      const tabs = rawLine.split('|');
      if (!isInTable) {
        // Start a table only if the next line is a header separator row
        if (i + 1 < lines.length && isPipeTableSeparator(lines[i + 1])) {
          isInTable = true;
          html += '<div class="table-wrap"><table><thead><tr>';
          for (let j = 1; j < tabs.length - 1; j++) html += `<th>${mdParse(tabs[j].trim(), baseDir).post}</th>`;
          html += '</tr></thead><tbody>';
          // Skip the separator line
          i += 1;
        } else {
          // Not a valid table header, treat as regular paragraph text
          if (!isInPara) { html += '<p>'; isInPara = true; }
          html += `${replaceInline(escapeHtml(rawLine), baseDir)}`;
          if (i + 1 < lines.length && escapeMarkdown(lines[i + 1]).trim() !== '') html += '<br>';
        }
      } else {
        // Inside a table body: ignore any stray separator lines
        if (isPipeTableSeparator(line)) { continue; }
        html += '<tr>';
        for (let j = 1; j < tabs.length - 1; j++) html += `<td>${mdParse(tabs[j].trim(), baseDir).post}</td>`;
        html += '</tr>';
      }
      // Close table if the next line is not a pipe row
      if (isInTable && (i + 1 >= lines.length || !lines[i + 1].startsWith('|'))) {
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
      closeAllLists();
      closePara();
      if (!isInTodo) { isInTodo = true; html += '<ul class="todo">'; }
      const taskText = replaceInline(escapeHtml(rawLine.slice(5).trim()), baseDir);
      html += match[1] === 'x'
        ? `<li><input type="checkbox" id="todo${i}" disabled checked><label for="todo${i}">${taskText}</label></li>`
        : `<li><input type="checkbox" id="todo${i}" disabled><label for="todo${i}">${taskText}</label></li>`;
      if (i + 1 >= lines.length || !escapeMarkdown(lines[i + 1]).match(/^[-*] \[([ x])\]/)) { html += '</ul>'; isInTodo = false; }
      continue;
    } else if (isInTodo) { html += '</ul>'; isInTodo = false; }

    // Standard unordered/ordered lists (not todo)
    const ulm = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);
    const olm = ulm ? null : rawLine.match(/^(\s*)(\d{1,9})[\.)]\s+(.+)$/);
    if (ulm || olm) {
      const indent = countIndent((ulm ? ulm[1] : olm[1]) || '');
      const type = ulm ? 'ul' : 'ol';
      const content = ulm ? ulm[2] : olm[3];
      closePara();
      // Adjust nesting based on indent
      if (!listStack.length) {
        html += (type === 'ul') ? '<ul>' : '<ol>';
        listStack.push({ indent, type });
      } else {
        let last = listStack[listStack.length - 1];
        if (indent > last.indent) {
          // New nested list
          html += (type === 'ul') ? '<ul>' : '<ol>';
          listStack.push({ indent, type });
        } else {
          // Pop until indent fits
          while (listStack.length && indent < listStack[listStack.length - 1].indent) {
            const popped = listStack.pop();
            html += (popped.type === 'ul') ? '</ul>' : '</ol>';
          }
          // Ensure correct list type at current indent
          last = listStack[listStack.length - 1];
          if (!last || last.type !== type) {
            if (last && last.indent === indent) {
              const popped = listStack.pop();
              html += (popped.type === 'ul') ? '</ul>' : '</ol>';
            }
            html += (type === 'ul') ? '<ul>' : '<ol>';
            listStack.push({ indent, type });
          }
        }
      }
      // List item content
      html += `<li>${replaceInline(escapeHtml(String(content).trim()), baseDir)}</li>`;
      // Continue to next line; we'll close lists when pattern breaks
      const next = (i + 1 < lines.length) ? escapeMarkdown(lines[i + 1]) : '';
      if (!next || (!next.match(/^(\s*)[-*+]\s+(.+)$/) && !next.match(/^(\s*)\d{1,9}[\.)]\s+(.+)$/))) {
        // Next line isn't a list item; close all open lists
        closeAllLists();
      }
      continue;
    } else if (listStack.length) {
      // Current line is not a list; ensure lists are closed
      closeAllLists();
    }

    // Headings
    if (rawLine.startsWith('#')) {
      closeAllLists();
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
    if (rawLine.trim() === '') { closeAllLists(); closePara(); continue; }

    // Regular paragraph text
    if (!isInPara) { html += '<p>'; isInPara = true; }
    html += `${replaceInline(escapeHtml(rawLine), baseDir)}`;
    if (i + 1 < lines.length && escapeMarkdown(lines[i + 1]).trim() !== '') html += '<br>';
  }

  if (isInPara) html += '</p>';
  if (isInTable) html += '</tbody></table>';
  if (isInTodo) html += '</ul>';
  if (listStack.length) { while (listStack.length) { const last = listStack.pop(); html += (last.type === 'ul') ? '</ul>' : '</ol>'; } }

  return { post: html, toc: `${tocParser(tochirc, tochtml)}` };
}
