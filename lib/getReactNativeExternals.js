'use strict';

var path = require('path');

/**
 * Extract the React Native module paths
 *
 * @return {Promise<Object>} A promise which resolves with 
 *                           a webpack 'externals' configuration object
 */
function getReactNativeExternals() {
  var reactNativeRoot = path.dirname(require.resolve('react-native/package'));
  var blacklist = require('react-native/packager/blacklist');
  var ReactPackager = require('react-native/packager/react-packager');
  var reactNativePackage = require('react-native/package');

  return ReactPackager.getDependencies({
    assetRoots: [reactNativeRoot],
    blacklistRE: blacklist(false /* don't blacklist any platform */),
    projectRoots: [reactNativeRoot],
    transformModulePath: require.resolve('react-native/packager/transformer')
  }, reactNativePackage.main).then(function(dependencies) {
    return dependencies.filter(function(dependency) {
      return !dependency.isPolyfill;
    });
  }).then(function(dependencies) {
    return dependencies.reduce(function(externals, dependency) {
      externals[dependency.id] = 'commonjs ' + dependency.id;
      return externals;
    }, {});
  });
}

module.exports = getReactNativeExternals;
