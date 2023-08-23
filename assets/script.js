function escapeHtml(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function replaceInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/-\s\[\s\](.*?)/g, '<input type="checkbox" disabled>$1</input>')
    .replace(/\*\s\[\s\](.*?)/g, '<input type="checkbox" disabled>$1</input>')
    .replace(/-\s\[x\](.*?)/g, '<input type="checkbox" checked disabled>$1</input>')
    .replace(/\*\s\[x\](.*?)/g, '<input type="checkbox" checked disabled>$1</input>')
    .replace(/!\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<img src="$2" alt="$1" title="$3">')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
    .replace(/(?<!!)\[(.*?)\]\((.*?)\s*&quot;(.*?)&quot;\)/g, '<a href="$2" title="$3">$1</a>')
    .replace(/(?<!!)\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/\`(.*?)\`/g, '<code class="inline">$1</code>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/^\*\*\*$/gm, '<hr>')
    .replace(/^---$/gm, '<hr>');
}

function markdownParser(markdown) {
  const lines = escapeHtml(markdown).split('\n');
  let html = '';
  let tochtml = '';

  let isInList = false;
  let listType = -1;

  let isInCodeBlock = false;
  let isInTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

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
      html += rawLine + '\n';
      continue;
    }

    const line = replaceInline(lines[i]);

    // Table
    if (rawLine.startsWith('|')) {
      const tabs = rawLine.split('|');
      if (!isInTable) {
        if (i + 3 < lines.length && lines[i + 1].startsWith('|') && lines[i + 2].startsWith('|')) {
          isInTable = true;
          html += '<table><thead><tr>';
          for (let j = 1; j < tabs.length - 1; j++) {
            html += `<th>${tabs[j].trim()}</th>`;
          }
          html += '</tr></thead><tbody>';
        }
        i++;
        continue;
      } else {
        html += '<tr>';
        for (let j = 1; j < tabs.length - 1; j++) {
          html += `<td>${tabs[j].trim()}</td>`;
        }
        html += '</tr>';
        continue;
      }
    } else if (isInTable) {
      html += '</tbody></table>';
      isInTable = false;
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

    // Blockquotes
    else if (line.startsWith('&gt;')) {
      if (!isInList) {
        isInList = true;
        html += '<blockquote>\n';
        listType = 2;
      }
      html += line.slice(4).trim() + '<br>';
    }

    // Plain Text
    else {
      if (isInList) {
        isInList = false;
        if (listType == 0) {
          html += '</ol>\n';
        } else if (listType == 1) {
          html += '</ul>\n';
        } else if (listType == 2) {
          html += '</blockquote>\n';
        }
      }

      html += line.startsWith('<') ? `${line}<br>` : `<p>${line}</p>`;
    }
  }

  if (isInList) {
    if (listType == 0) {
      html += '</ol>\n';
    } else if (listType == 1) {
      html += '</ul>\n';
    } else if (listType == 2) {
      html += '</blockquote>\n';
    }
  }

  return { "post": html, "toc": `<ul>${tochtml}</ul>` };
}

function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  return params.get(variable);
}

const getFile = filename => fetch(filename).then(data => data.text());

const displayPost = postname => getFile("/wwwroot/" + postname).then(markdown => {
  output = markdownParser(markdown);
  document.getElementById("tocview").innerHTML = output.toc;
  document.getElementById("mainview").innerHTML = output.post;
});

const displayIndex = () => getFile("/wwwroot/index.json").then(index => {
  for (const [key, value] of Object.entries(JSON.parse(index))) {
    document.getElementById("mainview").innerHTML += `<a href="?id=${value['location']}">${key}</a><br/>`;
  }
});

if (getQueryVariable("id") == null) {
  displayIndex();
} else {
  displayPost(getQueryVariable("id"));
}
