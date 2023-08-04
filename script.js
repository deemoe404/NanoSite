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

function markdownToHtml(markdown) {
  // Heading
  markdown = markdown.replace(/(#+)(.*)/g, function(match, hashes, title) {
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

var jsonObject;
try {
  getContent("/wwwroot/index.json")
  .then(function (content) {
    const jsonObject = JSON.parse(content.toString());
    console.log(content);
  })
  .catch(function (error) {
    console.error("Error fetching content:", error);
  });
} catch (error) {
  console.error('Error parsing JSON:', error);
}

for (const key in jsonObject) {
  if (jsonObject.hasOwnProperty(key)) {
    const obj = jsonObject[key];
    console.log(`Object: ${key}`);
    console.log(JSON.stringify(obj, null, 2));
  }
}
