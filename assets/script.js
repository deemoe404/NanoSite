function escapeHtml(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&(?!#[0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

const isBlank = text => /^\s*$/.test(text);

function markdownParser(markdown) {
  const lines = escapeMarkdown(markdown).split('\n');
  let html = '';
  let tochtml = '';

  let isInList = false;
  let listType = [];

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
      html += `<blockquote>${markdownParser(quote).post}</blockquote>`;
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

    // Table
    if (rawLine.startsWith('|')) {
      const tabs = rawLine.split("|");
      console.log(tabs);
      if (!isInTable) {
        if (i + 2 < lines.length && lines[i + 1].startsWith('|') && lines[i + 2].startsWith('|')) {
          isInTable = true;
          html += "<table><thead><tr>";
          for (let j = 1; j < tabs.length - 1; j++) {
            html += `<th>${replaceInline(escapeHtml(tabs[j].trim()))}</th>`;
          }
          html += "</tr></thead><tbody>";
        }
        i++;
        continue;
      } else {
        html += "<tr>";
        for (let j = 1; j < tabs.length - 1; j++) {
          html += `<td>${replaceInline(escapeHtml(tabs[j].trim()))}</td>`;
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

    // Ordered List
    if (rawLine.match(/^\d+\./)) {
      html += "<ol>";
      let j = i;
      for (; j < lines.length; j++) {
        // 如果这一行是列表语法
        if (lines[j].match(/^\d+\./)) {
          // 如果这一行不是最后一行
          if (j + 1 != lines.length) {
            // 如果这一行的下一行也是列表语法，直接添加一个完整的列表项，并继续
            if (lines[j + 1].match(/^\d+\./)) {
              const text = lines[j].slice(lines[j].indexOf('.') + 1).trim();
              html += `<li><p>${replaceInline(escapeHtml(text))}</p></li>`;
              continue;
            }
            // 如果这一行的下一行不是列表语法
            else {
              // 如果这一行的下一行是空白的，直接添加一个完整的列表，结束列表
              if (isBlank(lines[j + 1])) {
                const text = lines[j].slice(lines[j].indexOf('.') + 1).trim();
                html += `<li><p>${replaceInline(escapeHtml(text))}</p></li>`;
                break;
              }
              // 如果这一行的下一行不是空白的
              else {
                const indent = lines[j + 1].match(/^\s+/)[0]; // 判断行首空格个数
                // 如果行首没有空格，直接添加一个完整的列表，结束列表
                if (indent == null) {
                  const text = lines[j].slice(lines[j].indexOf('.') + 1).trim();
                  html += `<li><p>${replaceInline(escapeHtml(text))}</p></li>`;
                  break;
                }
                // 如果行首有空格，当作缩进处理
                else {
                  const indentCount = indent.length;
                  let k = j + 1;
                  let indentContent = "";
                  // 收集缩进内的所有文本
                  for (; k < lines.length; k++) {
                    const subIndent = lines[k].match(/^\s+/)[0];
                    if (subIndent == null) {
                      break;
                    }
                    else {
                      if (subIndent.length >= indentCount) {
                        indentContent += lines[k].slice(indentCount);
                      }
                      else {
                        break;
                      }
                    }
                    if (k + 1 != lines.length) {
                      indentContent += "\n";
                    }
                  }
                  const text = lines[j].slice(lines[j].indexOf('.') + 1).trim();
                  html += `<li><p>${replaceInline(escapeHtml(text))}</p>${markdownParser(indentContent).post}</li>`;
                  j = k;
                }
              }
            }
          }
          // 如果这一行是最后一行，直接添加一个完整的列表项，结束列表
          else {
            const text = lines[j].slice(lines[j].indexOf('.') + 1).trim();
            html += `<li><p>${replaceInline(escapeHtml(text))}</p></li>`;
            break;
          }
        }
      }
      html += "</ol>";
      i = j - 1;
      continue;
    }

    const line = replaceInline(escapeHtml(lines[i]));

    // Title
    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel} id="${i}">${headingText}</h${headingLevel}>\n`;
      tochtml += `<li><a href="#${i}">${headingText}</a></li>`;
    }

    // // Ordered List
    // else if (line.match(/^\d+\./)) {
    //   if (!isInList) {
    //     isInList = true;
    //     html += '<ol>\n';
    //     listType = 0;
    //   }
    //   const listItemText = line.slice(line.indexOf('.') + 1).trim();
    //   html += `<li>${listItemText}</li>\n`;
    // }

    // // Unordered List
    // else if (line.startsWith('-') || line.startsWith('*')) {
    //   if (!isInList) {
    //     isInList = true;
    //     html += '<ul>\n';
    //     listType = 1;
    //   }
    //   const listItemText = line.slice(1).trim();
    //   html += `<li>${listItemText}</li>\n`;
    // }

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
