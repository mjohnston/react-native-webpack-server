'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const mkdirp = Promise.promisifyAll(require('mkdirp'));
const path = require('path');
const url = require('url');
const fetch = require('./fetch');

/**
 * Fetch a bundle from the server and write it to file.
 * @param  {Server}  server     An instance of a server
 * @param  {Object}  options    Options
 * @param  {String}  platform   The platform for which to create the bundle: 'android' or 'ios'
 * @param  {String}  targetPath The destination path where the bundle will be written
 * @param  {Boolean} dev        Whether to build the bundle in development mode
 * @param  {Boolean} minify     Whether to minify the bundle
 * @param  {Boolean} sourceMap  Whether to generate a source map (with a `.map` suffix on `targetPath`)
 * @return {Promise}            Resolved when the bundle is written to the target path
 */
module.exports = function createBundle(server, options) {
  let tasks = [download(buildUrl(server, options, 'bundle'), options.targetPath)];

  if (options.sourceMap) {
    tasks.push(download(buildUrl(server, options, 'map'), `${options.targetPath}.map`));
  }

  return Promise.all(tasks);
};

function buildUrl(server, options, type) {
  return url.format({
    protocol: 'http',
    hostname: server.hostname,
    port: server.port,
    pathname: `/index.${options.platform}.${type}`,
    query: {
      platform: options.platform,
      dev: options.dev,
      minify: options.minify,
    },
  });
}

function download(url, targetPath) {
  return fetch(url).then(content =>
    mkdirp.mkdirpAsync(path.dirname(targetPath)).then(() =>
      fs.writeFileAsync(targetPath, content)
    )
  );
}
