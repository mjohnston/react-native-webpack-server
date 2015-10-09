#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const url = require('url');
const program = require('commander');
const package = require('../package.json');
const fetch = require('../lib/fetch');
const Server = require('../lib/Server');

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
      '-e, --entry [name]',
      'Webpack entry module. [index.ios]',
      'index.ios'
    );
}

program.version(package.version);

commonOptions(program.command('start'))
  .description('Start the webpack server.')
  .option('-r, --hot', 'Enable hot module replacement. [false]', false)
  .action(function(options) {
    const opts = options.opts();
    const server = createServer(opts);
    server.start();
  });

commonOptions(program.command('bundle'))
  .description('Bundle the app for distribution.')
  .option(
    '-b, --bundlePath [path]',
    'Path where the bundle should be written. [./iOS/main.jsbundle]',
    './iOS/main.jsbundle'
  )
  .option(
    '--no-optimize',
    'Whether the bundle should skip optimization. [false]',
    false
  )
  .option(
    '--platform',
    'The platform for which to create the bundle. [ios]',
    'ios'
  )
  .action(function(options) {
    const opts = options.opts();
    const server = createServer(opts);
    const query = opts.optimize ? {dev: false, minify: true} : {};
    query.platform = opts.platform || 'ios';
    const bundleUrl = url.format({
      protocol: 'http',
      hostname: 'localhost',
      port: opts.port,
      pathname: 'index.ios.bundle',
      query: query,
    });
    const targetPath = path.resolve(opts.bundlePath);

    server.start();

    fetch(bundleUrl).then(function(content) {
      fs.writeFileSync(targetPath, content);
      server.stop();

      // XXX: Hack something is keeping the process alive but we can still
      // safely kill here without leaving processes hanging around...
      process.exit(0);
    }).catch(function(err) {
      console.log('Error creating bundle...', err.stack);
      server.stop();
    });
  });

program.parse(process.argv);
