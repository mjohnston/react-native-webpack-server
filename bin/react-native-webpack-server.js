#!/usr/bin/env node

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
    (new Server(opts)).start();
  });

parser.parse();