'use strict';

var INVALID_VERSIONS = ['0.5.0']
var RNInfo = require('react-native/package.json')
if (INVALID_VERSIONS.indexOf(RNInfo.version) !== -1) {
  throw new Error('react-native-webpack-server does not work with react-native version: ' + RNInfo.version)
}

var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');
var connect = require('connect');
var spawn = require('child_process').spawn;
var Promise = require('bluebird');
var SourceNode = require('source-map').SourceNode;
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var getReactNativeExternals = require('./getReactNativeExternals');

var ENTRY_JS = 'global.React = require("react-native");';
var SOURCEMAP_REGEX = /\/\/[#@] sourceMappingURL=([^\s'"]*)/;
var WEBPACK_EXTERNAL_REGEX = /external\s"([^"]+)"/;

function fetch(uri) {
  return new Promise(function(resolve, reject) {
    var parts = url.parse(uri);
    var buffer = '';
    var handler = function(res) {
      res.on('data', function(chunk) {
        buffer += chunk;
      });
      res.on('end', function() {
        if (res.statusCode === 200) {
          resolve(buffer);
        } else {
          reject(buffer);
        }
      });
    };
    http.request(parts, handler).end();
  });
}

function parseQueryParams(req) {
  var parts = url.parse(req.url);
  var params = {};

  if (parts.query) {
    parts.query.split('&').forEach(function(pair) {
      pair = pair.split('=');
      // "true", "1" => true
      // "false", "0" => false
      // anything else => leave as-is
      switch (pair[1]) {
        case "true":
        case "1":
          params[pair[0]] = true;
          break;
        case "false":
        case "0":
          params[pair[0]] = false;
          break;
        default:
          params[pair[0]] = pair[1];
      }
    });
  }

  return params;
}

function staticImageTransform(context, request, callback) {
  if (/^image!/.test(request)) {
    return callback(null, JSON.stringify({
      uri: request.replace('image!', ''),
      isStatic: true
    }));
  }
  callback();
}

function resolveReactNativeModule(webpackId, reactNativeExternals) {
  var matches = webpackId.match(WEBPACK_EXTERNAL_REGEX);
  if (matches && matches.length > 1) {
    var module = matches[1];
    return reactNativeExternals[module] ? module : null;
  }
  return null;
}

function getEntryModules(allModules, reactNativeExternals) {
  if (!allModules || allModules.length === 0 || !reactNativeExternals) {
    return [];
  }
  return allModules
    .map(function(mod) {
      return resolveReactNativeModule(mod.identifier(), reactNativeExternals);
    })
    .filter(function(mod) {
      return mod && mod.length > 0;
    });
}

function makeHotConfig(webpackConfig) {
  // Ensure react-hot-loader is installed.
  if (!fs.existsSync(path.resolve(process.cwd(), 'node_modules/react-hot-loader'))) {
    console.error('Please install react-hot-loader first.');
    process.exit(1);
  }

  // Setup alias into project's node_modules/react-hot-loader. We can't use
  // require('react-hot-loader') in the hot entry.js since webpack will look
  // in our own node_modules directory and we would have the same problem
  // with requiring external React.
  webpackConfig.resolve = webpackConfig.resolve || {};
  webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
  webpackConfig.resolve.alias['react-hot-loader/Injection'] =
    path.resolve(process.cwd(), 'node_modules/react-hot-loader/Injection');

  // Restore document.createElement (see: InitializeJavaScriptAppEngine.js)
  webpackConfig.plugins = webpackConfig.plugins || [];
  webpackConfig.plugins.unshift(
    new webpack.BannerPlugin(
      'if (typeof(GLOBAL) !== \'undefined\' && GLOBAL.document) {\n' +
      '  document.createElement = function() {\n' +
      '    return HTMLDocument.prototype.createElement.apply(document, arguments);\n' +
      '  };\n' +
      '}\n',
      {raw: true, entryOnly: true}
    )
  );
}

/**
 * Create a new server with the following options:
 * {String} hostname (default localhost)
 * {Number} port (default 8080)
 * {Number} packagerPort (default 8081)
 * {Number} webpackPort (default 8082)
 * {String} entry (default index.ios)
 * {Object} webpackConfig (default require(./webpack.config.js))
 * {Boolean} hot enable react-hot-loader (default false)
 *
 * @constructor
 * @param {Object} options
 */
function Server(options) {
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
    process.exit(1);
  }

  // Construct resource URLs up-front
  this.webpackBaseURL = 'http://' + this.hostname + ':' + this.webpackPort;
  this.packagerBaseURL = 'http://' + this.hostname + ':' + this.packagerPort;
  this.reactCodeURL = this.packagerBaseURL + '/' + this.entry + '.bundle';
  this.reactMapURL = this.packagerBaseURL + '/' + this.entry + '.map';
  this.appCodeURL = this.webpackBaseURL + '/' + this.entry + '.js';
  this.appMapURL = this.webpackBaseURL + '/' + this.entry + '.js.map';

  // Setup the connect server
  this.server = connect();
  this.server.use(this.handleRequest.bind(this));

  // Create a stub entry module for the RN packager.
  this.entryDir = path.resolve(__dirname, '../_entry');
  this._writeEntryFile();

  // Make sure to clean up when the process is terminated.
  process.on('exit', this.handleProcessExit.bind(this));
  process.on('SIGINT', process.exit.bind(process));

  // Spin up the RN packager and webpack servers.
  this._startWebpackDevServer()
    .then(this._startPackageServer.bind(this));
}

Server.prototype = {

  start: function() {
    var hostname = this.hostname;
    var port = this.port;
    http.createServer(this.server).listen(this.port, function() {
      console.log('Server listening at http://%s:%s', hostname, port);
    });
  },

  handleRequest: function(req, res, next) {
    var parts = url.parse(req.url);
    var pathname = parts.pathname;
    switch (pathname) {
      case ('/' + this.entry + '.bundle'):
        this.handleBundleRequest(req, res, next);
        break;
      case ('/' + this.entry + '.map'):
        this.handleMapRequest(req, res, next);
        break;
      default:
        res.writeHead(404);
        res.end('Cannot GET ' + req.url);
    }
  },

  handleBundleRequest: function(req, res, next) {
    var createBundleCode = this._createBundleCode.bind(this);
    var urlSearch = url.parse(req.url).search;
    var queryParams = parseQueryParams(req);

    // Forward URL params to RN packager
    var reactCodeURL = this.reactCodeURL;
    if (urlSearch) {
      reactCodeURL += urlSearch;
    }

    Promise.props({
      reactCode: fetch(reactCodeURL),
      appCode: fetch(this.appCodeURL),
    }).then(function(r) {
      return createBundleCode(r.reactCode, r.appCode);
    }).then(function(bundleCode) {
      res.writeHead(200);
      res.end(bundleCode);
    }).catch(next);
  },

  handleMapRequest: function(req, res, next) {
    var createBundleMap = this._createBundleMap.bind(this);
    var urlSearch = url.parse(req.url).search;
    var queryParams = parseQueryParams(req);

    // Forward URL params to RN packager
    var reactCodeURL = this.reactCodeURL;
    var reactMapURL = this.reactMapURL;
    if (urlSearch) {
      reactCodeURL += urlSearch;
      reactMapURL += urlSearch;
    }

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
  },

  handleProcessExit: function() {
    // Clean up temp files
    var entryDir = this.entryDir;
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
  },

  _createBundleCode: function(reactCode, appCode) {
    reactCode = reactCode.replace(SOURCEMAP_REGEX, '');
    appCode = appCode.replace(SOURCEMAP_REGEX, '');
    return reactCode + appCode + '//# sourceMappingURL=/' + this.entry + '.map';
  },

  _createBundleMap: function(reactCode, reactMap, appCode, appMap) {
    var node = new SourceNode();
    var map;

    node.add(SourceNode.fromStringWithSourceMap(
      reactCode,
      new SourceMapConsumer(reactMap)
    ));
    node.add(SourceNode.fromStringWithSourceMap(
      appCode,
      new SourceMapConsumer(appMap)
    ));

    node = node.join('');
    map = node.toStringWithSourceMap().map;

    return JSON.stringify(map);
  },

  _writeEntryFile: function(entryModules) {
    var source = ENTRY_JS + '\n';
    var entryFile = path.join(this.entryDir, this.entry + '.js');
    if (!fs.existsSync(this.entryDir)) {
      fs.mkdirSync(this.entryDir);
    }
    fs.writeFileSync(entryFile, source, 'utf-8');
  },

  _startPackageServer: function() {
    // Easier to just shell out to the packager than use the JS API.
    var cmd = './node_modules/react-native/packager/packager.sh';
    var args = [
      '--root', path.resolve(process.cwd(), 'node_modules/react-native'),
      '--root', this.entryDir,
      '--port', this.packagerPort,
    ];
    var opts = {stdio: 'inherit'};
    this.packageServer = spawn(cmd, args, opts);
  },

  _startWebpackDevServer: function() {
    var webpackConfig = this.webpackConfig;
    var webpackURL = 'http://' + this.hostname + ':' + this.webpackPort;
    var hot = this.hot;
    var publicPath = hot ? (webpackURL + '/') : null;
    return getReactNativeExternals().then(function(reactNativeExternals) {
      return new Promise(function(resolve, reject) {
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
        var compiler = webpack(webpackConfig);
        compiler.plugin('done', function(stats) {
          // Write out the RN packager's entry file
          this._writeEntryFile();

          // Conveniently, promises can only be resolved once.
          resolve();
        }.bind(this));

        this.webpackServer = new WebpackDevServer(compiler, {
          hot: hot,
          publicPath: publicPath,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          stats: {colors: true, chunkModules: false}
        });

        this.webpackServer.listen(this.webpackPort, this.hostname, function() {
          console.log('Webpack dev server listening at ', webpackURL);
        });
      }.bind(this));
    }.bind(this));
  },

};

module.exports = Server;
