'use strict';

/**
 * Extract the React Native module paths
 *
 * @param  {Object}          options             Options
 * @param  {String}          options.projectRoot The project root path, where `node_modules/` is found
 * @return {Promise<Object>}                     Resolves with a webpack 'externals' configuration object
 */
function getReactNativeExternals(options) {
  const blacklist = require('react-native/packager/blacklist');
  const ReactPackager = require('react-native/packager/react-packager');
  const rnEntryPoint = require.resolve('react-native');

  return ReactPackager.getDependencies({
    assetRoots: [options.projectRoot],
    blacklistRE: blacklist(false /* don't blacklist any platform */),
    projectRoots: [options.projectRoot],
    transformModulePath: require.resolve('react-native/packager/transformer'),
  }, rnEntryPoint).then(function(dependencies) {
    return dependencies.filter(function(dependency) {
      return !dependency.isPolyfill();
    });
  }).then(function(dependencies) {
    return Promise.all(dependencies.map(function(dependency) {
      return dependency.getName();
    }));
  }).then(function(moduleIds) {
    return moduleIds.reduce(function(externals, moduleId) {
      externals[moduleId] = 'commonjs ' + moduleId;
      return externals;
    }, {});
  });
}

module.exports = getReactNativeExternals;
