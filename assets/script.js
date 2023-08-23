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

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  let html = '';

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

    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel} id="title${titleIndex}">${headingText}</h${headingLevel}>\n`;
      titleIndex = titleIndex + 1;
    }
    else if (line.trim() === '---' || line.trim() === '***') {
      html += '<hr>\n';
    }
    else if (line.match(/^\d+\./)) {
      if (!isInList) {
        isInList = true;
        html += '<ol>\n';
        listType = 0;
      }
      const listItemText = line.slice(line.indexOf('.') + 1).trim();
      html += `<li>${listItemText}</li>\n`;
    }
    else if (line.startsWith('-') || line.startsWith('*')) {
      if (!isInList) {
        isInList = true;
        html += '<ul>\n';
        listType = 1;
      }
      const listItemText = line.slice(1).trim();
      html += `<li>${listItemText}</li>\n`;
    }
    else if (line.startsWith('>')) {
      if (!isInList) {
        isInList = true;
        html += '<blockquote>\n';
        listType = 2;
      }
      html += line.slice(1).trim() + '<br>';
    }
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

  return html;
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) { return pair[1]; }
  }
  return (false);
}

function getContent(file) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", file, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.send();
  });
}

function getIndex() {
  return new Promise(function (resolve, reject) {
    try {
      getContent("/wwwroot/index.json").then(function (content) {
        resolve(JSON.parse(content.toString()));
      }).catch(function (error) {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function displayContent(variable) {
  getContent("/wwwroot/" + variable).then(function (content) {
    htmlOutput = markdownToHtml(content);
    document.getElementById('mainview').innerHTML = htmlOutput;
  }).catch(function (error) {
    console.log(error);
  });
}

function displayIndex() {
  getIndex().then(function (index) {
    htmlOutput = "";
    for (const key in index) {
      if (index.hasOwnProperty(key)) {
        htmlOutput += `<a href="?id=${index[key].content}">${key.toString()}</a><br/>`;
      }
    }
    document.getElementById('mainview').innerHTML = htmlOutput;
  }).catch(function (error) {
    console.log(error);
  });
}

if (getQueryVariable("id") == false) {
  displayIndex();
} else {
  displayContent(decodeURIComponent(getQueryVariable("id")));
}
