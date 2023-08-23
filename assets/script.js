function escapeHtml(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/(?!^)>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function simpleConvert(text) {
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
    .replace(/~~(.*?)~~/g, '<del>$1</del>');
}

function markdownParser(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let tochtml = '<ul>';

  let isInList = false;
  let listType = -1;

  let isInCodeBlock = false;
  let isInTable = false;

  let titleIndex = 0;

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
      html += escapeHtml(rawLine) + '\n';
      continue;
    }

    // Table
    if (rawLine.startsWith('|')) {
      if (!isInTable) {
        if (i + 3 < lines.length && lines[i + 1].startsWith('|') && lines[i + 2].startsWith('|')) {
          isInTable = true;
          const headers = rawLine.split('|');
          html += '<table><thead><tr>';
          for (let j = 1; j < headers.length - 1; j++) {
            html += `<th>${escapeHtml(headers[j].trim())}</th>`;
          }
          html += '</tr></thead><tbody>';
        }
        i++;
        continue;
      } else {
        const tds = rawLine.split('|');
        html += '<tr>';
        for (let j = 1; j < tds.length - 1; j++) {
          html += `<td>${escapeHtml(tds[j].trim())}</td>`;
        }
        html += '</tr>';
        continue;
      }
    } else if (isInTable) {
      html += '</tbody></table>';
      isInTable = false;
    }

    const line = simpleConvert(escapeHtml(lines[i]));

    // Title
    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel} id="${titleIndex}">${headingText}</h${headingLevel}>\n`;
      tochtml += `<li><a href="#${titleIndex}">${headingText}</a></li>`;
      titleIndex++;
    }

    // Break Line
    else if (line.trim() === '---' || line.trim() === '***') {
      html += '<hr>\n';
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
    else if (line.startsWith('>')) {
      if (!isInList) {
        isInList = true;
        html += '<blockquote>\n';
        listType = 2;
      }
      html += line.slice(1).trim() + '<br>';
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

  tochtml += `</ul>`;

  if (isInList) {
    if (listType == 0) {
      html += '</ol>\n';
    } else if (listType == 1) {
      html += '</ul>\n';
    } else if (listType == 2) {
      html += '</blockquote>\n';
    }
  }

  var doc = { "post": html, "toc": tochtml };
  return doc;
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) { return decodeURIComponent(pair[1]); }
  }
  return (false);
}

const getFile = filename => fetch(filename).then(data => data.text);

const displayPost = postname => getFile("/wwwroot/" + postname).then(markdown => {
  output = markdownParser(markdown);
  document.getElementById('tocview').innerHTML = output.toc;
  document.getElementById('mainview').innerHTML = output.post;
});

const displayIndex = () => getFile("/wwwroot/index.json").then(index => {
  for (const [key, value] of Object.entries(JSON.parse(index))) {
    document.getElementById('mainview').innerHTML += `<a href="?id=${value['location']}">${key}</a><br/>`;
  }
});

if (getQueryVariable("id") == false) {
  displayIndex();
} else {
  displayPost(getQueryVariable("id"));
}
