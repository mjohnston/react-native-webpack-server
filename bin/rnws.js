#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const program = require('commander');
const packageJson = require('../package.json');
const createBundle = require('../lib/createBundle');
const Server = require('../lib/Server');

function normalizeOptions(options) {
  options.platforms = [];
  if (options.android) {
    options.platforms.push('android');
  }
  if (options.ios) {
    options.platforms.push('ios');
  }

  if (options.projectRoots) {
    options.projectRoots = options.projectRoots.split(',')
      .map(dir => path.resolve(process.cwd(), dir));
  }
  if (options.root) {
    options.root = options.root.split(',')
      .map(dir => path.resolve(process.cwd(), dir));
  }
  if (options.assetRoots) {
    options.assetRoots = options.assetRoots.split(',')
      .map(dir => path.resolve(process.cwd(), dir));
  }

  return options;
}

/**
 * Create a server instance using the provided options.
 * @param  {Object} opts react-native-webpack-server options
 * @return {Server}      react-native-webpack-server server
 */
function createServer(opts) {
  opts.webpackConfigPath = path.resolve(process.cwd(), opts.webpackConfigPath);
  if (fs.existsSync(opts.webpackConfigPath)) {
    opts.webpackConfig = require(path.resolve(process.cwd(), opts.webpackConfigPath));
  } else {
    throw new Error('Must specify webpackConfigPath or create ./webpack.config.js');
  }
  delete opts.webpackConfigPath;

  const server = new Server(opts);
  return server;
}

/**
 * Apply a set of common options to the commander.js program.
 * @param  {Object} program The commander.js program
 * @return {Object}         The program with options applied
 */
function commonOptions(program) {
  return program
    .option(
      '-H, --hostname [hostname]',
      'Hostname on which the server will listen. [localhost]',
      'localhost'
    )
    .option(
      '-P, --port [port]',
      'Port on which the server will listen. [8080]',
      8080
    )
    .option(
      '-p, --packagerPort [port]',
      'Port on which the react-native packager will listen. [8081]',
      8081
    )
    .option(
      '-w, --webpackPort [port]',
      'Port on which the webpack dev server will listen. [8082]',
      8082
    )
    .option(
      '-c, --webpackConfigPath [path]',
      'Path to the webpack configuration file. [webpack.config.js]',
      'webpack.config.js'
    )
    .option(
      '--no-android',
      'Disable support for Android. [false]',
      false
    )
    .option(
      '--no-ios',
      'Disable support for iOS. [false]',
      false
    )
    .option(
      '-A, --androidEntry [name]',
      'Android entry module name. Has no effect if \'--no-android\' is passed. [index.android]',
      'index.android'
    )
    .option(
      '-I, --iosEntry [name]',
      'iOS entry module name. Has no effect if \'--no-ios\' is passed. [index.ios]',
      'index.ios'
    )
    .option(
      '--projectRoots [projectRoots]',
      'List of comma-separated paths for the react-native packager to consider as project root directories',
      null
    )
    .option(
      '--root [root]',
      'List of comma-separated paths for the react-native packager to consider as additional directories. If provided, these paths must include react-native and its dependencies.',
      null
    )
    .option(
      '--assetRoots [assetRoots]',
      'List of comma-separated paths for the react-native packager to consider as asset root directories',
      null
    )
    .option(
      '-r, --resetCache',
      'Remove cached react-native packager files [false]',
      false
    )
    .option(
      '--hasteExternals',
      // React Native 0.23 rewrites `require('HasteModule')` calls to
      // `require(42)` where 42 is an internal module id. That breaks
      // treating Haste modules simply as commonjs modules and leaving
      // the `require()` call in the source. So for now this feature
      // only works with React Native <0.23.
      'Allow direct import of React Native\'s (<0.23) internal Haste modules [false]',
      false
    );
}

commonOptions(program.command('start'))
  .description('Start the webpack server.')
  .option('-r, --hot', 'Enable hot module replacement. [false]', false)
  .action(function(options) {
    const opts = normalizeOptions(options.opts());
    const server = createServer(opts);
    server.start();
  });

commonOptions(program.command('bundle'))
  .description('Bundle the app for distribution.')
  .option(
    '--androidBundlePath [path]',
    'Path where the Android bundle should be written. [./android/app/src/main/assets/index.android.bundle]',
    './android/app/src/main/assets/index.android.bundle'
  )
  .option(
    '--iosBundlePath [path]',
    'Path where the iOS bundle should be written. [./ios/main.jsbundle]',
    './ios/main.jsbundle'
  )
  .option(
    '--no-optimize',
    'Whether the bundle should skip optimization. [false]',
    false
  )
  .option(
    '-s, --sourceMap',
    'Whether a source map should be generated (along side the bundle). [false]',
    false
  )
  .action(function(options) {
    const opts = normalizeOptions(options.opts());
    const server = createServer(opts);
    const bundlePaths = {
      android: opts.androidBundlePath,
      ios: opts.iosBundlePath,
    };

    const doBundle = () => Promise.all(opts.platforms.map(
      (platform) => createBundle(server, {
        platform: platform,
        targetPath: bundlePaths[platform],
        dev: !opts.optimize,
        minify: opts.optimize,
        sourceMap: opts.sourceMap,
      })
    ));

    server.start()
      .then(doBundle)
      .finally(() => {
        server.stop();
        process.exit(0);
      });
  });

program.version(packageJson.version);
program.parse(process.argv);
