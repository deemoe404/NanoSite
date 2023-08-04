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

getIndex()
  .then(function (index) {
    for (const key in index) {
      if (index.hasOwnProperty(key)) {
        const file = index[key].content;
        console.log("/wwwroot/" + file);
        getContent("/wwwroot/" + file)
          .then(function (content) {
            console.log(content);
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
