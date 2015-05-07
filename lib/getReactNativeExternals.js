'use strict';

var fs = require('fs');
var path = require('path');

/**
 * Extract the React Native module paths for a given directory
 *
 * @param {String} rootDir
 * @return {Object}
 */
function getReactNativeExternals(rootDir) {
  var externals = {};
  var file;

  var walk = function(dir) {
    fs.readdirSync(dir).forEach(function(mod) {
      file = path.resolve(dir, mod);
      if (fs.lstatSync(file).isDirectory()) {
        // Skip node_modules directories
        if (!dir.match(/node_modules/)) {
          walk(file);
        }
      } else if (path.extname(mod) === '.js') {
        mod = mod.replace(/\.js$/, '');
        // Only externalize RN's "React" dependency (uppercase).
        if (mod !== 'react') {
          externals[mod] = 'commonjs ' + mod;
        }
      }
    });
  }

  walk(rootDir);

  // 'react-native' is aliased as `React` in the global object
  externals['react-native'] = 'React';

  return externals;
}

module.exports = getReactNativeExternals;