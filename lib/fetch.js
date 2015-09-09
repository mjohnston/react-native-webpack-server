var http = require('http');
var url = require('url');

function fetch(uri) {
  return new Promise(function(resolve, reject) {
    var parts = url.parse(uri);
    var buffer = '';
    var handler = function(res) {
      res.on('data', function(chunk) {
        buffer += chunk;
      });
      res.on('end', function() {
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
