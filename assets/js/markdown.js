import { escapeHtml, escapeMarkdown, sanitizeUrl, resolveImageSrc } from './utils.js';

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

