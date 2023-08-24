function escapeHtml(text) {
  return typeof (text) === 'string' ? text
    .replace(/&(?!#[0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;') : null;
}

function escapeMarkdown(text) {
  if (typeof (text) !== 'string') {
    return null;
  }

  const parts = text.split("`");
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
        .replace("\\\\", "&#092;")
        .replace("\\`", "&#096;")
        .replace("\\*", "&#042;")
        .replace("\\_", "&#095;")
        .replace("\\{", "&#123;").replace("\\}", "&#125;")
        .replace("\\[", "&#091;").replace("\\]", "&#093;")
        .replace("\\(", "&#040;").replace("\\)", "&#041;")
        .replace("\\#", "&#035;")
        .replace("\\+", "&#043;")
        .replace("\\-", "&#045;")
        .replace("\\.", "&#046;")
        .replace("\\!", "&#033;")
        .replace("\\|", "&#124;")
        .replace(/<!--[\s\S]*?-->/g, '');
    } else { result += parts[i]; };
  }
  return result;
}

function replaceInline(text) {
  if (typeof (text) !== 'string') {
    return null;
  }

  const parts = text.split("`");
  console.log(`${text}: ${parts}`);
  let result = "";

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/!\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<img src="$2" alt="$1" title="$3">')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        .replace(/(?<!!)\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<a href="$2" title="$3">$1</a>')
        .replace(/(?<!!)\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/^\*\*\*$/gm, '<hr>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^\s*$/g, "<br>");
    } else { result += parts[i]; };
  }
  return result.replace(/\`(.*?)\`/g, '<code class="inline">$1</code>');
}

const isBlank = text => /^\s*$/.test(text);

function markdownParser(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let tochtml = '';

  let isInCodeBlock = false;
  let isInTable = false;
  let isInTodo = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code Block
    if (line.startsWith('```')) {
      if (!isInCodeBlock) {
        isInCodeBlock = true;
        html += '<pre><code>';
      } else {
        isInCodeBlock = false;
        html += '</code></pre>';
      }
      continue;
    } else if (isInCodeBlock) {
      html += `${line}\n`;
      continue;
    }

    const rawLine = escapeMarkdown(line);

    // Blockquotes
    if (rawLine.startsWith('>')) {
      let quote = `${rawLine.slice(1).trim()}`;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].startsWith('>')) {
          quote += `\n${lines[j].slice(1).trim()}`;
        } else {
          break;
        }
      }
      html += `<blockquote>${markdownParser(quote).post}</blockquote>`;
      i = j - 1;
      continue;
    }

    // Table
    if (rawLine.startsWith('|')) {
      const tabs = rawLine.split("|");
      if (!isInTable) {
        if (i + 2 < lines.length && lines[i + 1].startsWith('|') && lines[i + 2].startsWith('|')) {
          isInTable = true;
          html += "<table><thead><tr>";
          for (let j = 1; j < tabs.length - 1; j++) {
            html += `<th>${markdownParser(tabs[j].trim()).post}</th>`;
          }
          html += "</tr></thead><tbody>";
        }
        i++;
        continue;
      } else {
        html += "<tr>";
        for (let j = 1; j < tabs.length - 1; j++) {
          html += `<td>${markdownParser(tabs[j].trim()).post}</td>`;
        }
        html += "</tr>";
        if (i == lines.length - 1) {
          html += "</tbody></table>";
          isInTable = false;
        }
        continue;
      }
    } else if (isInTable) {
      html += "</tbody></table>";
      isInTable = false;
    }

    // To-do List
    const match = rawLine.match(/^[-*] \[([ x])\]/);
    if (match) {
      if (!isInTodo) {
        isInTodo = true;
        html += '<ul class="todo">';
      }
      const taskText = replaceInline(escapeHtml(rawLine.slice(5).trim()));
      if (match[1] === 'x') {
        html += `<li><input type="checkbox" id="todo${i}" disabled><label for="todo${i}">${taskText}</label></li>`;
      } else {
        html += `<li><input type="checkbox" id="todo${i}" disabled checked><label for="todo${i}">${taskText}</label></li>`;
      }
      continue;
    } else {
      if (isInTodo) {
        html += '</ul>';
        isInTodo = false;
      }
    }

    // Title
    if (rawLine.startsWith('#')) {
      const headingLevel = rawLine.match(/^#+/)[0].length;
      const headingText = replaceInline(escapeHtml(rawLine.slice(headingLevel).trim()));
      html += `<h${headingLevel} id="${i}">${headingText}</h${headingLevel}>\n`;
      tochtml += `<li><a href="#${i}">${headingText}</a></li>`;
      continue;
    }

    html += `<p>${replaceInline(escapeHtml(lines[i]))}</p>`;
  }

  return { "post": html, "toc": `<ul>${tochtml}</ul>` };
}

function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(variable);
  return value !== null ? decodeURIComponent(value) : null;
}

const getFile = filename => fetch(filename).then(data => data.text());

const displayPost = postname => getFile("/wwwroot/" + postname).then(markdown => {
  const output = markdownParser(markdown);
  document.getElementById("tocview").innerHTML = output.toc;
  document.getElementById("mainview").innerHTML = output.post;
});

const displayIndex = () => getFile("/wwwroot/index.json").then(index => {
  for (const [key, value] of Object.entries(JSON.parse(index))) {
    document.getElementById("mainview").innerHTML += `<a href="?id=${encodeURIComponent(value['location'])}">${key}</a><br/>`;
  }
});

if (getQueryVariable("id") == null) {
  displayIndex();
} else {
  displayPost(getQueryVariable("id"));
}
