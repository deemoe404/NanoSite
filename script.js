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

try {
  var jsonString = "";

  getContent("/wwwroot/index.json")
  .then(function (content) {
    jsonString = content;
    console.log(jsonString);
  })
  .catch(function (error) {
    console.error("Error fetching content:", error);
  });

  const jsonObject = JSON.parse(jsonString.toString());

  for (const key in jsonObject) {
    if (jsonObject.hasOwnProperty(key)) {
      const obj = jsonObject[key];
      console.log(`Object: ${key}`);
      console.log(JSON.stringify(obj, null, 2));
    }
  }
} catch (error) {
  console.error('Error parsing JSON:', error);
}
