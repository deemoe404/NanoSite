function getContent(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var content = xhr.responseText;
      return content;
    }
  };
  xhr.send();
}

console.log(getContent("/test.txt"));
