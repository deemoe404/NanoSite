function getContent(file) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", file, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var content = xhr.responseText;
      return content;
    }
  };
  xhr.send();
}

getContent("/test.txt", function(content) {
  console.log(content);
});

var xhr = new XMLHttpRequest();
xhr.open("GET", "/test.txt", true);
xhr.onreadystatechange = function() {
  if (xhr.readyState === 4 && xhr.status === 200) {
    var content = xhr.responseText;
    console.log(content);
  }
};
xhr.send();

function getContent(file) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", file, true);
    xhr.onreadystatechange = function() {
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

getContent("/test.txt")
  .then(function(content) {
    console.log(content);
  })
  .catch(function(error) {
    console.error("Error fetching content:", error);
  });
