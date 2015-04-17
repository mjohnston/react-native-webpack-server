#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var parser = require('nomnom');
var Server = require('../lib/Server');

parser.command('start')
  .option('hostname', {
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
  })
  .option('hot', {
    flag: true,
    default: false,
  })
  .callback(function(opts) {
    opts.webpackConfigPath = path.resolve(process.cwd(), opts.webpackConfigPath);
    if (fs.existsSync(opts.webpackConfigPath)) {
      opts.webpackConfig = require(path.resolve(process.cwd(), opts.webpackConfigPath));
    } else {
      throw new Error('Must specify webpackConfigPath or create ./webpack.config.js');
-     process.exit(1);
    }
    delete opts.webpackConfigPath;

    (new Server(opts)).start();
  });

parser.parse();