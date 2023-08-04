var xhr = new XMLHttpRequest();
xhr.open("GET", "/test.txt", true);
xhr.onreadystatechange = function() {
  if (xhr.readyState === 4 && xhr.status === 200) {
    var content = xhr.responseText;
    console.log(content);
  }
};
xhr.send();
