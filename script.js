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

  let isInList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#')) {
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.slice(headingLevel).trim();
      html += `<h${headingLevel}>${headingText}</h${headingLevel}>\n`;
    }
    else if (line.match(/^\d+\./)) {
      if (!isInList) {
        isInList = true;
        html += '<ol>\n';
      }
      const listItemText = line.slice(line.indexOf('.') + 1).trim();
      html += `<li>${escapeHtml(listItemText)}</li>\n`;
    }
    else if (line.startsWith('-') || line.startsWith('*')) {
      if (!isInList) {
        isInList = true;
        html += '<ul>\n';
      }
      const listItemText = line.slice(1).trim();
      html += `<li>${escapeHtml(listItemText)}</li>\n`;
    }
    else {
      console.log("hit P: " + line);
      if (isInList) {
        console.log(isInList);
        isInList = false;
        html += isInList === 'ol' ? '</ol>\n' : '</ul>\n';
      }
      html += `<p>${escapeHtml(line)}</p>\n`;
    }
  }

  if (isInList) {
    html += isInList === 'ol' ? '</ol>\n' : '</ul>\n';
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
