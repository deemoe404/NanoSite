function escapeHtml(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&(?!#[0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function escapeMarkdown(text) {
  return text
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
    .replace("\\|", "&#124;");
}

function replaceInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')

    .replace(/!\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<img src="$2" alt="$1" title="$3">')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')

    .replace(/(?<!!)\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<a href="$2" title="$3">$1</a>')
    .replace(/(?<!!)\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')

    .replace(/\`(.*?)\`/g, '<code class="inline">$1</code>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')

    .replace(/^\*\*\*$/gm, '<hr>')
    .replace(/^---$/gm, '<hr>')

    .replace(/^\s*$/g, "<br>");
}

function markdownParser(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let tochtml = '';

  let isInList = false;
  let listType = -1;

  let isInCodeBlock = false;
  let isInTable = false;
  let isInTodo = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

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
      const output = markdownParser(quote);
      console.log(quote);
      html += `<blockquote>${output.post}</blockquote>`;
      i = j - 1;
      continue;
    }

    // Code Block
    if (rawLine.startsWith('```')) {
      if (!isInCodeBlock) {
        isInCodeBlock = true;
        html += '<pre><code>';
      } else {
        isInCodeBlock = false;
        html += '</code></pre>';
      }
      continue;
    } else if (isInCodeBlock) {
      html += escapeHtml(rawLine) + '\n';
      continue;
    }

    const line = replaceInline(escapeHtml(lines[i]));

    // Table
    if (line.startsWith('|')) {
      const tabs = line.split("|");
      console.log(tabs);
      if (!isInTable) {
        if (i + 2 < lines.length && (lines[i + 1].startsWith('| -') || lines[i + 1].startsWith('| :')) && lines[i + 2].startsWith('|')) {
          isInTable = true;
          html += "<table><thead><tr>";
          for (let j = 1; j < tabs.length - 1; j++) {
            html += `<th>${tabs[j].trim().replace("\\|", "|")}</th>`;
          }
          html += "</tr></thead><tbody>";
        }
        i++;
        continue;
      } else {
        html += "<tr>";
        for (let j = 1; j < tabs.length - 1; j++) {
          html += `<td>${tabs[j].trim().replace("\\|", "|")}</td>`;
        }
        html += "</tr>";
        continue;
      }
    } else if (isInTable) {
      html += "</tbody></table>";
      isInTable = false;
    }

    // To-do List
    const match = line.match(/^[-*] \[([ x])\]/);
    if (match) {
      if (!isInTodo) {
        isInTodo = true;
        html += '<ul class="todo">';
      }
      const taskText = line.slice(5).trim();
      if (match[1] === 'x') {
        html += `<li><input type="checkbox" disabled>${taskText}</li>\n`;
      } else {
        html += `<li><input type="checkbox" checked disabled>${taskText}</li>\n`;
      }
      continue;
    } else {
      if (isInTodo) {
        html += '</ul>';
        isInTodo = false;
      }
    }

    // Title
    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel} id="${i}">${headingText}</h${headingLevel}>\n`;
      tochtml += `<li><a href="#${i}">${headingText}</a></li>`;
    }

    // Ordered List
    else if (line.match(/^\d+\./)) {
      if (!isInList) {
        isInList = true;
        html += '<ol>\n';
        listType = 0;
      }
      const listItemText = line.slice(line.indexOf('.') + 1).trim();
      html += `<li>${listItemText}</li>\n`;
    }

    // Unordered List
    else if (line.startsWith('-') || line.startsWith('*')) {
      if (!isInList) {
        isInList = true;
        html += '<ul>\n';
        listType = 1;
      }
      const listItemText = line.slice(1).trim();
      html += `<li>${listItemText}</li>\n`;
    }

    // Plain Text
    else {
      if (isInList) {
        isInList = false;
        if (listType == 0) {
          html += '</ol>\n';
        } else if (listType == 1) {
          html += '</ul>\n';
        }
      }

      html += /<\/?[a-z][\s\S]*>/i.test(line) ? line : `<p>${line}</p>`;
    }
  }

  if (isInList) {
    if (listType == 0) {
      html += '</ol>\n';
    } else if (listType == 1) {
      html += '</ul>\n';
    }
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
