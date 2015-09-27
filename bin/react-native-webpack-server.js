#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const parser = require('nomnom');
const Server = require('../lib/Server');
const fetch = require('../lib/fetch');

function commonOptions (command) {
  return command.option('hostname', {
    default: 'localhost',
  })
  .option('port', {
    default: 8080,
  })
  .option('packagerPort', {
    default: 8081,
  })
  .option('webpackPort', {
    default: 8082,
  })
  .option('entry', {
    default: 'index.ios',
  })
  .option('webpackConfigPath', {
    default: 'webpack.config.js',
  });
}

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

commonOptions(parser.command('start'))
  .option('hot', {
    flag: true,
    default: false,
  })
  .callback(function(opts) {
    const server = createServer(opts);
    server.start();
  });

commonOptions(parser.command('bundle'))
  .callback(function(opts) {
    const server = createServer(opts);
    const url = 'http://localhost:' + opts.port + '/index.ios.bundle';
    const targetPath = path.resolve('./iOS/main.jsbundle');

    server.start();

    fetch(url).then(function(content) {
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

parser.parse();
