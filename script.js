function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  let html = '';

  const escapeHtml = (text) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading
    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel}>${headingText}</h${headingLevel}>\n`;
    }
    // Ordered List
    else if (line.match(/^\d+\./)) {
      const listItems = line.split(/(\d+\.[ \t]+)/).filter(Boolean);
      const listNumber = parseInt(listItems[0], 10);
      html += `<ol>`;
      for (let j = 1; j < listItems.length; j += 2) {
        const listItemText = listItems[j + 1].trim();
        html += `<li>${escapeHtml(listItemText)}</li>\n`;
      }
      html += `</ol>\n`;
    }
    // Unordered List
    else if (line.startsWith('-') || line.startsWith('*')) {
      const listItemText = line.slice(1).trim();
      html += `<ul><li>${escapeHtml(listItemText)}</li></ul>\n`;
    }
    // Paragraph
    else if (line) {
      html += `<p>${escapeHtml(line)}</p>\n`;
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
      getContent("/wwwroot/index.json")
        .then(function (content) {
          resolve(JSON.parse(content.toString()));
        })
        .catch(function (error) {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

function displayContent(variable) {
  getIndex()
    .then(function (index) {
      for (const key in index) {
        if (index.hasOwnProperty(key) && key.toString() == variable) {
          getContent("/wwwroot/" + index[key].content)
            .then(function (content) {
              var url = window.location.origin;
              homeurl = "<a href=\"" + url + "\">Home</a><br/>";
              htmlOutput = markdownToHtml(content);
              htmlOutput = homeurl + htmlOutput;
              document.getElementById('output').innerHTML = htmlOutput;
            })
            .catch(function (error) {
              console.log(error);
            });
        }
      }
    })
    .catch(function (error) {
      console.log("ERROR");
    });
}

function displayHome() {
  getIndex()
    .then(function (index) {
      htmlOutput = "";
      var url = window.location.origin;
      for (const key in index) {
        if (index.hasOwnProperty(key)) {
          tmp = "<a href=\"" + url + "?id=" + key.toString() + "\">" + key.toString() + "</a>";
          htmlOutput = htmlOutput + "<br/>" + tmp;
        }
      }
      document.getElementById('output').innerHTML = htmlOutput;
    })
    .catch(function (error) {
      console.log("ERROR");
    });
}

if (getQueryVariable("id") == false) {
  displayHome();
} else {
  displayContent(decodeURIComponent(getQueryVariable("id")));
}
