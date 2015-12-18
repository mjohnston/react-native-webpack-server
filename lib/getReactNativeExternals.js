'use strict';

const Promise = require('bluebird');

/**
 * Get a webpack 'externals' config for all React Native internal modules.
 * @param  {Object} options Options
 * @param  {String}         options.projectRoot The project root path, where `node_modules/` is found
 * @return {Object}         A webpack 'externals' config object
 */
function getReactNativeExternals(options) {
  return Promise.all(options.platforms.map(
    (platform) => getReactNativeDependencyNames({
      projectRoots: options.projectRoots || [process.cwd()],
      assetRoots: options.assetRoots || [process.cwd()],
      platform: platform,
    })
  )).then((moduleNamesGroupedByPlatform) => {
    const allReactNativeModules = Array.prototype.concat.apply([], moduleNamesGroupedByPlatform);
    return makeWebpackExternalsConfig(allReactNativeModules);
  });
}

/**
 * Make a webpack 'externals' object from the provided CommonJS module names.
 * @param  {Array<String>} moduleNames The list of module names
 * @return {Object}                    A webpack 'externals' config object
 */
function makeWebpackExternalsConfig(moduleNames) {
  return moduleNames.reduce((externals, moduleName) => Object.assign(externals, {
    [moduleName]: `commonjs ${moduleName}`,
  }), {});
}

/**
 * Extract all non-polyfill dependency names from the React Native packager.
 *
 * @param  {Object}          options             Options
 * @param  {String}          options.projectRoot The project root path, where `node_modules/` is found
 * @param  {String}          options.platform    The platform for which to get dependencies
 * @return {Promise<Object>}                     Resolves with a webpack 'externals' configuration object
 */
function getReactNativeDependencyNames(options) {
  const blacklist = require('react-native/packager/blacklist');
  const ReactPackager = require('react-native/packager/react-packager');
  const rnEntryPoint = require.resolve('react-native');

  return ReactPackager.getDependencies({
    blacklistRE: blacklist(false /* don't blacklist any platform */),
    projectRoots: options.projectRoots,
    assetRoots: options.assetRoots,
    transformModulePath: require.resolve('react-native/packager/transformer'),
  }, {
    entryFile: rnEntryPoint,
    dev: true,
    platform: options.platform,
  }).then(dependencies =>
    dependencies.filter(dependency => !dependency.isPolyfill())
  ).then(dependencies =>
    Promise.all(dependencies.map(dependency => dependency.getName()))
  );
}

module.exports = getReactNativeExternals;
