function markdownToHtml(markdown) {
  // Heading
  markdown = markdown.replace(/(#+)(.*)/g, function (match, hashes, title) {
    const level = hashes.length;
    return `<h${level}>${title.trim()}</h${level}>`;
  });

  // Bold
  markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Unordered List
  markdown = markdown.replace(/^- (.*)/gm, '<ul><li>$1</li></ul>');

  // Ordered List
  markdown = markdown.replace(/^[0-9]+\. (.*)/gm, '<ol><li>$1</li></ol>');

  // Line Break
  markdown = markdown.replace(/  \n/g, '<br>');

  // Paragraph
  const paragraphs = markdown.split(/\n{2,}/g);
  markdown = paragraphs.map((p) => `<p>${p}</p>`).join('');

  return markdown;
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
              const htmlOutput = markdownToHtml(content);
              document.getElementById('output').innerHTML = htmlOutput;
            })
            .catch(function (error) {
              console.log("ERROR");
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
}
