'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const express = require('express');
const spawn = require('child_process').spawn;
const Promise = require('bluebird');
const SourceNode = require('source-map').SourceNode;
const SourceMapConsumer = require('source-map').SourceMapConsumer;
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const getReactNativeExternals = require('./getReactNativeExternals');
const waitForSocket = require('socket-retry-connect').waitForSocket;
const fetch = require('./fetch');

const ENTRY_JS = 'global.React = require("react-native");';
const SOURCEMAP_REGEX = /\/\/[#@] sourceMappingURL=([^\s'"]*)/;

function staticImageTransform(context, request, callback) {
  if (/^image!/.test(request)) {
    return callback(null, JSON.stringify({
      uri: request.replace('image!', ''),
      isStatic: true,
    }));
  }
  callback();
}

function makeHotConfig(webpackConfig) {
  // Restore document.createElement (see: InitializeJavaScriptAppEngine.js)
  webpackConfig.plugins = webpackConfig.plugins || [];
  webpackConfig.plugins.unshift(
    new webpack.BannerPlugin(
      'if (typeof(GLOBAL) !== \'undefined\' && GLOBAL.document) {\n' +
      '  document.createElement = function() {\n' +
      '    return HTMLDocument.prototype.createElement.apply(document, arguments);\n' +
      '  };\n' +
      '}\n' +
      'if (typeof navigator.userAgent === \'undefined\') {\n' +
      '  throw new Error(\'Hot module replacement only works with RCTWebSocketExecutor; use Cmd + D, "Debug in Chrome"\')' +
      '}\n',
      {raw: true, entryOnly: true}
    )
  );
}

class Server {

  /**
   * Create a new server with the following options:
   * @param {String}  hostname (default localhost)
   * @param {Number}  port (default 8080)
   * @param {Number}  packagerPort (default 8081)
   * @param {Number}  webpackPort (default 8082)
   * @param {String}  entry (default index.ios)
   * @param {Object}  webpackConfig (default require(./webpack.config.js))
   * @param {Boolean} hot enable react-hot-loader (default false)
   *
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    if (!options) options = {};

    // Default options
    this.hostname = options.hostname || 'localhost';
    this.port = options.port || 8080;
    this.packagerPort = options.packagerPort || 8081;
    this.webpackPort = options.webpackPort || 8082;
    this.entry = options.entry || 'index.ios';
    this.hot = (options.hot === true);
    this.webpackConfig = options.webpackConfig;

    // Check for local react-native.
    if (!fs.existsSync(path.resolve(process.cwd(), 'node_modules/react-native'))) {
      throw new Error('Could not find react-native. Try `npm install react-native`.');
    }

    // Construct resource URLs up-front
    this.webpackBaseURL = url.format({protocol: 'http', hostname: this.hostname, port: this.webpackPort});
    this.packagerBaseURL = url.format({protocol: 'http', hostname: this.hostname, port: this.packagerPort});
    this.reactCodeURL = url.resolve(this.packagerBaseURL, `${this.entry}.bundle`);
    this.reactMapURL = url.resolve(this.packagerBaseURL, `${this.entry}.map`);
    this.appCodeURL = url.resolve(this.webpackBaseURL, `${this.entry}.js`);
    this.appMapURL = url.resolve(this.webpackBaseURL, `${this.entry}.js.map`);

    // Create a stub entry module for the RN packager.
    this.entryDir = path.resolve(__dirname, '../_entry');
    this._writeEntryFile();

    // Make sure to clean up when the process is terminated.
    process.on('exit', this.handleProcessExit.bind(this));
    process.on('SIGINT', function() {
      this.handleProcessExit();
      process.exit(1);
    }.bind(this));

    // Construct a promise waiting for both servers to fully start...
    this._readyPromise = this._startWebpackDevServer().then(function() {
      // We need to start this one second to prevent races between the bundlers.
      return this._startPackageServer();
    }.bind(this));

    // Setup the express server
    this.server = express();
    this.server.use(function(req, res, next) {
      // Wait for ready promise to resolve
      this._readyPromise
        .then(function() {
          next();
        })
        .catch(function(err) {
          next(err);
        });
    }.bind(this));
    this.server.get('/*.bundle', this.handleBundleRequest.bind(this));
    this.server.get('/*.map', this.handleMapRequest.bind(this));
    this.server.use(function(err, req, res, next) {
      console.error(err.stack);
      next(err);
    });
  }

  start() {
    const hostname = this.hostname;
    const port = this.port;
    this.httpServer = this.server.listen(port, function() {
      console.log('Server listening at http://%s:%s', hostname, port);
    });
  }

  stop() {
    this.handleProcessExit();
    this.httpServer && this.httpServer.close();
    this.webpackServerHttp && this.webpackServerHttp.close();
  }

  handleBundleRequest(req, res, next) {
    const createBundleCode = this._createBundleCode.bind(this);
    const urlSearch = url.parse(req.url).search;

    // Forward URL params to RN packager
    const reactCodeURL = this.reactCodeURL + (urlSearch || '');

    Promise.props({
      reactCode: fetch(reactCodeURL),
      appCode: fetch(this.appCodeURL),
    }).then(function(r) {
      return createBundleCode(r.reactCode, r.appCode, urlSearch);
    }).then(function(bundleCode) {
      res.writeHead(200);
      res.end(bundleCode);
    }).catch(next);
  }

  handleMapRequest(req, res, next) {
    const createBundleMap = this._createBundleMap.bind(this);
    const urlSearch = url.parse(req.url).search;

    // Forward URL params to RN packager
    const reactCodeURL = this.reactCodeURL + (urlSearch || '');
    const reactMapURL = this.reactMapURL + (urlSearch || '');

    Promise.props({
      reactCode: fetch(reactCodeURL),
      reactMap: fetch(reactMapURL),
      appCode: fetch(this.appCodeURL),
      appMap: fetch(this.appMapURL),
    }).then(function(r) {
      return createBundleMap(r.reactCode, r.reactMap, r.appCode, r.appMap);
    }).then(function(bundleMap) {
      res.writeHead(200);
      res.end(bundleMap);
    }).catch(function(err) {
      console.error(err);
      next();
    });
  }

  handleProcessExit() {
    // Clean up temp files
    const entryDir = this.entryDir;
    if (fs.existsSync(entryDir)) {
      fs.readdirSync(entryDir).forEach(function(file) {
        fs.unlinkSync(path.join(entryDir, file));
      });
      fs.rmdirSync(entryDir);
    }

    // Kill the package server
    if (this.packageServer) {
      this.packageServer.kill();
    }
  }

  _createBundleCode(reactCode, appCode, urlSearch) {
    reactCode = reactCode.replace(SOURCEMAP_REGEX, '');
    appCode = appCode.replace(SOURCEMAP_REGEX, '');
    return reactCode + appCode + `//# sourceMappingURL=/${this.entry}.map${urlSearch}`;
  }

  _createBundleMap(reactCode, reactMap, appCode, appMap) {
    const node = new SourceNode();

    node.add(SourceNode.fromStringWithSourceMap(
      reactCode,
      new SourceMapConsumer(reactMap)
    ));
    node.add(SourceNode.fromStringWithSourceMap(
      appCode,
      new SourceMapConsumer(appMap)
    ));

    return node.join('').toStringWithSourceMap().map.toString();
  }

  _writeEntryFile() {
    const source = ENTRY_JS + '\n';
    const entryFile = path.join(this.entryDir, this.entry + '.js');
    if (!fs.existsSync(this.entryDir)) {
      fs.mkdirSync(this.entryDir);
    }
    fs.writeFileSync(entryFile, source, 'utf-8');
  }

  _startPackageServer() {
    /**
     * Starting the server is neither fast nor completely reliable we end up
     * hitting its public api over http periodically so we must wait for it to
     * be actually ready.
     */
    return new Promise(function(accept, reject) {
      // Easier to just shell out to the packager than use the JS API.
      // XXX: Uses the node only invocation so we don't have to deal with bash
      // as well... Fixes issues where server cannot be killed cleanly.
      const cmd = 'node';
      const args = [
        './node_modules/react-native/packager/packager.js',
        '--root', path.resolve(process.cwd(), 'node_modules/react-native'),
        '--root', this.entryDir,
        '--port', this.packagerPort,
      ];
      const opts = {stdio: 'inherit'};
      this.packageServer = spawn(cmd, args, opts);

      function handleError(err) {
        reject(err);
      }

      this.packageServer.on('error', handleError);

      waitForSocket({ port: this.packagerPort }, function(err) {
        console.log('react-native packager ready...');
        this.packageServer.removeListener('error', handleError);
        if (err) {
          handleError(err);
          return;
        }
        accept();
      }.bind(this));
    }.bind(this));
  }

  _startWebpackDevServer() {
    const webpackConfig = this.webpackConfig;
    const webpackURL = 'http://' + this.hostname + ':' + this.webpackPort;
    const hot = this.hot;
    const publicPath = hot ? (webpackURL + '/') : null;
    return getReactNativeExternals().then(function(reactNativeExternals) {

      // Coerce externals into an array, without clobbering it
      webpackConfig.externals = Array.isArray(webpackConfig.externals)
        ? webpackConfig.externals
        : [(webpackConfig.externals || {})];

      // Inject react native externals
      webpackConfig.externals.push(reactNativeExternals);

      // Transform static image references
      webpackConfig.externals.push(staticImageTransform);

      // By default webpack uses webpack://[resource-path]?[hash] in the source
      // map which is handled by its dev server. Use absolute path instead so
      // React Native's exception manager can load the source maps.
      webpackConfig.output = webpackConfig.output || {};
      if (!webpackConfig.output.devtoolModuleFilenameTemplate) {
        webpackConfig.output.devtoolModuleFilenameTemplate = '[absolute-resource-path]';
      }

      // Update webpack config for hot mode.
      if (hot) {
        makeHotConfig(webpackConfig);
      }

      // Plug into webpack compilation to extract webpack dependency tree.
      // Any React Native externals from the application source need to be
      // require()'d in the RN packager's entry file. This allows for RN
      // modules that aren't part of the main 'react-native' dependency tree
      // to be included in the generated bundle (e.g. AdSupportIOS).
      const compiler = webpack(webpackConfig);

      const compilerPromise = new Promise(function(resolve) {
        compiler.plugin('done', function() {
          // Write out the RN packager's entry file
          this._writeEntryFile();
          resolve();
        }.bind(this));
      }.bind(this));

      this.webpackServer = new WebpackDevServer(compiler, {
        hot: hot,
        publicPath: publicPath,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        stats: {colors: true, chunkModules: false},
      });

      const serverPromise = new Promise(function(resolve) {
        this.webpackServerHttp = this.webpackServer.listen(this.webpackPort, this.hostname, function() {
          console.log('Webpack dev server listening at ', webpackURL);
          resolve();
        });
      }.bind(this));

      // Ensure that both the server is up and the compiler's entry
      // file has been written for the React Native packager.
      return Promise.all([compilerPromise, serverPromise]);
    }.bind(this));
  }

}

module.exports = Server;
