var http = require('http');
var url = require('url');

function fetch(uri) {
  return new Promise((resolve, reject) => {
    var parts = url.parse(uri);
    var buffer = '';
    var handler = res => {
      res.on('data', chunk => {
        buffer += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(buffer);
        } else {
          reject(buffer);
        }
      });
    };
    http.request(parts, handler).end();
  });
}

module.exports = fetch;
