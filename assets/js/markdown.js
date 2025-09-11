import { escapeHtml, escapeMarkdown, sanitizeUrl, resolveImageSrc, allowUserHtml } from './utils.js';
import { stripFrontMatter } from './content.js';

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
        // Obsidian-style embeds: ![[path|optional alt or options]]
        .replace(/!\[\[(.+?)\]\]/g, (m, inner) => {
          const raw = String(inner || '').trim();
          if (!raw) return m;
          // Split at first '|': left=src, right=alias/alt or options
          let src = raw;
          let alias = '';
          const pipeIdx = raw.indexOf('|');
          if (pipeIdx >= 0) {
            src = raw.slice(0, pipeIdx).trim();
            alias = raw.slice(pipeIdx + 1).trim();
          }
          if (!src) return m;
          const url = resolveImageSrc(src, baseDir);
          const isVideo = /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(src || '');
          if (isVideo) {
            const ext = String(src || '').split('?')[0].split('.').pop().toLowerCase();
            const type = ({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogg: 'video/ogg' }[ext]) || 'video/mp4';
            const aria = alias ? ` aria-label="${alias}"` : '';
            return `<div class="post-video-wrap"><video class="post-video" controls playsinline preload="metadata"${aria}><source src="${url}" type="${type}">Sorry, your browser doesn't support embedded videos.</video></div>`;
          }
          // Fallback alt from alias or filename
          const fallbackAlt = alias || (String(src).split('/').pop() || 'image');
          return `<img src="${url}" alt="${fallbackAlt}">`;
        })
        // Images or Videos via image syntax: optional title
        .replace(/!\[(.*?)\]\(([^\s\)]*?)(?:\s*&quot;(.*?)&quot;)?\)/g, (m, alt, src, title) => {
          const url = resolveImageSrc(src, baseDir);
          const isVideo = /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(src || '');
          if (isVideo) {
            const ext = String(src || '').split('?')[0].split('.').pop().toLowerCase();
            const type = ({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogg: 'video/ogg' }[ext]) || 'video/mp4';
            const t = title ? ` title="${title}"` : '';
            const aria = alt ? ` aria-label="${alt}"` : '';
            // Poster: allow specifying via title e.g. \"...|poster=frame.jpg\"
            // (Don't guess a basename image; missing files would block auto-capture poster logic.)
            let poster = null;
            if (title && String(title).trim()) {
              const parts = String(title).split(/\s*[|;]\s*/);
              for (const p of parts) {
                const m2 = p.match(/^poster\s*=\s*(.+)$/i);
                if (m2) { poster = m2[1]; break; }
              }
            }
            const posterAttr = poster ? ` poster="${resolveImageSrc(poster, baseDir)}"` : '';

            // Alternate sources for better compatibility
            let extraSources = [];
            if (title && String(title).trim()) {
              const parts = String(title).split(/\s*[|;]\s*/);
              for (const p of parts) {
                let m;
                // sources=foo.mp4,bar.webm (explicit paths)
                m = p.match(/^sources\s*=\s*(.+)$/i);
                if (m) {
                  const list = m[1].split(/\s*,\s*/).filter(Boolean);
                  extraSources.push(...list.map(s => ({ src: resolveImageSrc(s, baseDir), type: s.split('?')[0].split('.').pop().toLowerCase() })));
                  continue;
                }
                // formats=mp4,webm (same basename as primary)
                m = p.match(/^formats\s*=\s*(.+)$/i);
                if (m) {
                  try {
                    const baseNoQuery = String(src || '').split('?')[0];
                    const baseNoExt = baseNoQuery.replace(/\.[^.]+$/, '');
                    const fmts = m[1].split(/\s*,\s*/).filter(Boolean);
                    fmts.forEach(f => { extraSources.push({ src: resolveImageSrc(`${baseNoExt}.${f}`, baseDir), type: String(f).toLowerCase() }); });
                  } catch (_) { /* noop */ }
                }
              }
            }
            const typeFor = (e) => ({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogg: 'video/ogg' }[e] || 'video/mp4');
            const extraHtml = extraSources
              .map(s => `<source src="${s.src}" type="${typeFor(s.type)}">`)
              .join('');
                    return `<div class="post-video-wrap"><video class="post-video" controls playsinline preload="metadata"${posterAttr}${t}${aria}><source src="${url}" type="${type}">${extraHtml}Sorry, your browser doesn't support embedded videos.</video></div>`;
          }
          const t = title ? ` title="${title}"` : '';
          return `<img src="${url}" alt="${alt}"${t}>`;
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
  // Build nested UL/LI markup as a string without reading from DOM
  let html = '';
  let prevLevel = 0;
  for (let i = 0; i < titleLevels.length; i++) {
    const raw = Number(titleLevels[i]) || 1;
    const level = Math.max(1, raw);
    const liTag = liTags[i];
    if (i === 0) {
      // Open lists up to first level
      for (let d = 0; d < level; d++) html += '<ul>';
    } else if (level > prevLevel) {
      // Deepen nesting; open one list per level increase
      for (let d = prevLevel; d < level; d++) html += '<ul>';
    } else if (level < prevLevel) {
      // Climb up: close current item, then for each level up close sublist and its parent item
      html += '</li>';
      for (let d = prevLevel; d > level; d--) html += '</ul></li>';
    } else {
      // Same level: close current item before starting next
      if (i > 0) html += '</li>';
    }
    // Start item for this heading
    html += `<li>${liTag}`;
    prevLevel = level;
  }
  // Close last item and all remaining lists
  html += '</li>';
  for (let d = prevLevel; d > 0; d--) html += '</ul>';
  return html;
}

export function mdParse(markdown, baseDir) {
  // Strip front matter before parsing
  const cleanedMarkdown = stripFrontMatter(markdown);
  const lines = String(cleanedMarkdown || '').split('\n');
  let html = '', tochtml = [], tochirc = [];
  let isInCode = false, isInBigCode = false, isInTable = false, isInTodo = false, isInPara = false;
  let codeLang = '';
  let codeBlockIndent = ''; // Store the indent level of the opening code block
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
    const ltrimmed = line.replace(/^\s*/, '');
    const lineIndent = line.match(/^\s*/)[0]; // Capture the indent of current line

    // Code blocks
    if (ltrimmed.startsWith('````')) {
      closePara();
      if (!isInBigCode) { 
        isInBigCode = true; 
        codeBlockIndent = lineIndent; // Remember the indent level
        codeLang = (ltrimmed.slice(4).trim().split(/\s+/)[0] || '').toLowerCase(); 
        // Calculate indent level (tab = 4 spaces, each level = 2rem roughly)
        const indentLevel = Math.floor(lineIndent.replace(/\t/g, '    ').length / 4);
        const indentClass = indentLevel > 0 ? ` code-indent-${indentLevel}` : '';
        html += `<pre class="code-block${indentClass}"><code${codeLang?` class=\"language-${codeLang}\"`:''}>`; 
      }
      else { 
        isInBigCode = false; 
        codeBlockIndent = '';
        codeLang = ''; 
        html += '</code></pre>'; 
      }
      continue;
    } else if (isInBigCode) {
      // Remove the same level of indentation as the opening block
      const contentLine = line.startsWith(codeBlockIndent) ? line.slice(codeBlockIndent.length) : line;
      html += `${escapeHtml(contentLine)}\n`;
      continue;
    }

    if (ltrimmed.startsWith('```') && !isInBigCode) {
      closePara();
      if (!isInCode) { 
        isInCode = true; 
        codeBlockIndent = lineIndent; // Remember the indent level
        codeLang = (ltrimmed.slice(3).trim().split(/\s+/)[0] || '').toLowerCase(); 
        // Calculate indent level (tab = 4 spaces, each level = 2rem roughly)
        const indentLevel = Math.floor(lineIndent.replace(/\t/g, '    ').length / 4);
        const indentClass = indentLevel > 0 ? ` code-indent-${indentLevel}` : '';
        html += `<pre class="code-block${indentClass}"><code${codeLang?` class=\"language-${codeLang}\"`:''}>`; 
      }
      else { 
        isInCode = false; 
        codeBlockIndent = '';
        codeLang = ''; 
        html += '</code></pre>'; 
      }
      continue;
    } else if (isInCode) {
      // Remove the same level of indentation as the opening block
      const contentLine = line.startsWith(codeBlockIndent) ? line.slice(codeBlockIndent.length) : line;
      html += `${escapeHtml(contentLine)}\n`;
      continue;
    }

    const rawLine = escapeMarkdown(line);

    // If currently inside a list but the next line starts a fenced code/table/blockquote/header,
    // we'll close lists right before handling those blocks (see below after matches).

    // Blockquote (with Obsidian-style Callouts support: > [!type] Title) 
    if (rawLine.startsWith('>')) {
      closeAllLists();
      closePara();
      let quote = `${rawLine.slice(1).trim()}`;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].startsWith('>')) quote += `\n${lines[j].slice(1).trim()}`;
        else break;
      }

      // Detect Obsidian callout syntax in the first line: [!type] optional title
      try {
        const qLines = String(quote).split('\n');
        const first = (qLines[0] || '').trim();
        const m = first.match(/^\[!(\w+)\]\s*(.*)$/i);
        if (m) {
          const typeRaw = (m[1] || '').toLowerCase();
          const known = ['note','info','tip','hint','important','warning','caution','danger','error','success','example','quote','question'];
          const type = known.includes(typeRaw) ? typeRaw : 'note';
          const titleRaw = (m[2] || '').trim();
          // Default localized-ish labels when title is omitted
          const defaultLabel = (t) => ({
            note: 'Note', info: 'Info', tip: 'Tip', hint: 'Hint', important: 'Important',
            warning: 'Warning', caution: 'Caution', danger: 'Danger', error: 'Error',
            success: 'Success', example: 'Example', quote: 'Quote', question: 'Question'
          })[t] || 'Note';
          const label = titleRaw || defaultLabel(type);
          const iconFor = (t) => ({
            note: '📝', info: 'ℹ️', tip: '💡', hint: '💡', important: '📌',
            warning: '⚠️', caution: '⚠️', danger: '⛔', error: '⛔',
            success: '✅', example: '🧪', quote: '❝', question: '❓'
          })[t] || '📝';
          const role = (type === 'warning' || type === 'caution' || type === 'danger' || type === 'error') ? 'alert' : 'note';
          const body = qLines.slice(1).join('\n');
          const bodyHtml = mdParse(body, baseDir).post;
          const titleHtml = replaceInline(escapeHtml(label), baseDir);
          html += `<div class="callout callout-${type}" data-callout="${type}" role="${role}"><div class="callout-title"><span class="callout-icon" aria-hidden="true">${escapeHtml(iconFor(type))}</span><span class="callout-label">${titleHtml}</span></div><div class="callout-body">${bodyHtml}</div></div>`;
        } else {
          html += `<blockquote>${mdParse(quote, baseDir).post}</blockquote>`;
        }
      } catch (_) {
        // Fallback to plain blockquote rendering on any parsing error
        try { html += `<blockquote>${mdParse(quote, baseDir).post}</blockquote>`; } catch (_) { html += `<blockquote>${allowUserHtml(quote, baseDir)}</blockquote>`; }
      }
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
          html += `${replaceInline(allowUserHtml(rawLine, baseDir), baseDir)}`;
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
      const taskText = replaceInline(allowUserHtml(rawLine.slice(5).trim(), baseDir), baseDir);
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
      const itemStartNum = ulm ? null : Number(olm[2]);
      closePara();
      // Adjust nesting based on indent
      if (!listStack.length) {
        if (type === 'ul') html += '<ul>';
        else html += (itemStartNum && itemStartNum !== 1) ? `<ol start="${itemStartNum}">` : '<ol>';
        listStack.push({ indent, type });
      } else {
        let last = listStack[listStack.length - 1];
        if (indent > last.indent) {
          // New nested list
          if (type === 'ul') html += '<ul>';
          else html += (itemStartNum && itemStartNum !== 1) ? `<ol start="${itemStartNum}">` : '<ol>';
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
            if (type === 'ul') html += '<ul>';
            else html += (itemStartNum && itemStartNum !== 1) ? `<ol start="${itemStartNum}">` : '<ol>';
            listStack.push({ indent, type });
          }
        }
      }
      // List item content
      html += `<li>${replaceInline(allowUserHtml(String(content).trim(), baseDir), baseDir)}</li>`;
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
      const text = replaceInline(allowUserHtml(rawLine.slice(level).trim(), baseDir), baseDir);
      html += `<h${level} id="${i}"><a class="anchor" href="#${i}" aria-label="Permalink">#</a>${text}</h${level}>`;
      if (level >= 2 && level <= 3) {
        tochtml.push(`<a href="#${i}">${text}</a>`);
        tochirc.push(level);
      }
      continue;
    }

    // Treat raw HTML block elements as standalone blocks (and capture their full content until closing tag)
    {
      const raw = escapeMarkdown(line);
      const t = raw.trim();
      const m = t.match(/^<\/?([a-zA-Z][\w:-]*)\b(.*)>?$/);
      if (m) {
        const tag = (m[1] || '').toLowerCase();
        const isClosing = /^<\//.test(t);
        const singletons = new Set(['hr','br','img','source','col','meta','link','input']);
        const blockOpenTags = new Set(['div','section','article','p','blockquote','pre','code','figure','details','table','ul','ol','video','picture','iframe']);
        const blockAnyTags = new Set(['div','section','article','p','blockquote','pre','code','figure','figcaption','details','summary','table','thead','tbody','tfoot','tr','td','th','ul','ol','li','video','picture','iframe','hr','br','h1','h2','h3','h4','h5','h6']);

        if (blockAnyTags.has(tag)) {
          // If it's a closing tag or a known singleton, treat as a single line element
          if (isClosing || singletons.has(tag) || /\/>\s*$/.test(t)) {
            closeAllLists();
            closePara();
            html += allowUserHtml(t, baseDir);
            continue;
          }
          // For open block tags like <table>, <figure>, <details>, <video>, <iframe> — capture until the corresponding closing tag
          if (blockOpenTags.has(tag)) {
            let chunk = raw;
            let j = i + 1;
            // Search for matching closing tag on subsequent lines (allow nesting of other tags inside)
            const endRe = new RegExp(`^\\s*<\\/${tag}\\s*>\\s*$`, 'i');
            for (; j < lines.length; j++) {
              const nxt = escapeMarkdown(lines[j]);
              chunk += '\n' + nxt;
              if (endRe.test(nxt.trim())) { break; }
            }
            i = j;
            closeAllLists();
            closePara();
            html += allowUserHtml(chunk, baseDir);
            continue;
          } else {
            // Other block-level tags (thead/tbody/tr/td/etc.) — treat line-by-line without wrapping
            closeAllLists();
            closePara();
            html += allowUserHtml(t, baseDir);
            continue;
          }
        }
      }
    }

    // Blank line => close paragraph
    if (rawLine.trim() === '') { closeAllLists(); closePara(); continue; }

    // Regular paragraph text
    {
      const lineHtmlRaw = replaceInline(allowUserHtml(rawLine, baseDir), baseDir);
      const lineHtml = String(lineHtmlRaw || '').trim();
      // Skip lines that render to empty or a single <br>
      if (lineHtml && lineHtml !== '<br>') {
        if (!isInPara) { html += '<p>'; isInPara = true; }
        html += lineHtml;
        // Add soft line break only when the next line is true text (not blank, not an HTML block start)
        if (i + 1 < lines.length) {
          const nextTrim = escapeMarkdown(lines[i + 1]).trim();
          const isNextHtml = /^<([a-zA-Z][\w:-]*)\b/.test(nextTrim);
          if (nextTrim !== '' && !isNextHtml) html += '<br>';
        }
      }
    }
  }

  if (isInPara) html += '</p>';
  if (isInTable) html += '</tbody></table>';
  if (isInTodo) html += '</ul>';
  if (listStack.length) { while (listStack.length) { const last = listStack.pop(); html += (last.type === 'ul') ? '</ul>' : '</ol>'; } }

  return { post: html, toc: `${tocParser(tochirc, tochtml)}` };
}
