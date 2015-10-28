# react-native-webpack-server

react-native-webpack-server is a development server that leverages the [Webpack Dev Server](https://github.com/webpack/webpack-dev-server) and the [React Packager](https://github.com/facebook/react-native/tree/master/packager) to enable building React Native JavaScript bundles with webpack. This allows you to use the existing webpack ecosystem when targeting React Native.

[![react-native-webpack channel on slack](https://img.shields.io/badge/discord-%23react--native--webpack%20%40%20reactiflux-61dafb.svg?style=flat-square)](http://www.reactiflux.com)
[![Build Status](https://travis-ci.org/mjohnston/react-native-webpack-server.svg)](https://travis-ci.org/mjohnston/react-native-webpack-server)

## Installing

```shell
npm install --save-dev react-native-webpack-server
```

## Using

Use `--help` for all CLI options:

```shell
node_modules/.bin/rnws --help
node_modules/.bin/rnws start --help
node_modules/.bin/rnws bundle --help
```

### Setup

By default React Native will look for **index.ios.js**/**index.android.js** at the root of the project. Delete these files and add entries in your webpack config:

```js
entry: {
  'index.ios': ['./src/main.js'],
  'index.android': ['./src/main.js']
}
```

Start react-native-webpack-server using `rnws start`. You might want to put this in your `package.json`:

```js
"scripts": {
  "bundle": "rnws bundle",
  "start": "rnws start"
}
```

This will start the server on port 8080.

On iOS, change the URL of your application bundle in `AppDelegate.m`, changing 8081 to 8080:

```objc
jsCodeLocation = [NSURL URLWithString:@"http://localhost:8080/index.ios.bundle"];
```

On Android, start your emulator or connect your device and run `adb reverse tcp:8081 tcp:8080`. This causes the device to connect to RNWS on port 8080 when it tries to download to <http://localhost:8081/index.android.bundle?platform=android>. Ensure that you also set _Dev Settings_ -> _Debug server host for device_ to "localhost":

<img width="400" alt="screenshot 2015-10-27 22 49 42" src="https://cloud.githubusercontent.com/assets/2177366/10778764/62bf9f80-7cff-11e5-8710-c2e9039f0350.png">

**Note: No debugger or hot module replacement support is available yet for Android.**

Checkout some of the [Examples](/Examples) to get started.

### Bundling for release

When you are ready to ship your app, you will want to generate a minified bundle and package it in the binary. Similar to the [React Native packager](https://facebook.github.io/react-native/docs/running-on-device-ios.html#using-offline-bundle), you can generate an offline JS bundle to use your app without a development server:

```shell
rnws bundle
```

For all options, see:

```shell
rnws bundle --help
```

In your webpack config, you will likely want to enable the `UglifyJsPlugin`. The sample apps are configured to enable minification when `process.env.NODE_ENV` is set to `production`. See the [BabelES6 webpack config](https://github.com/mjohnston/react-native-webpack-server/blob/master/Examples/BabelES6/webpack.config.js#L41) for an example.

## Source Maps

Current solutions for building React Native bundles with Webpack lose source maps. This is because the Webpack bundle is first built and then passed off to the React Packager which [constructs the source map by hand](https://github.com/facebook/react-native/blob/master/packager/react-packager/src/Packager/Package.js#L149). This is done for speed, but it also means you can only use transforms that map lines 1 to 1.

React Native Webpack Server enables source maps by generating the react-native and application bundles separately and then combining their source maps.

## Hot Module Replacement

**Note: HMR currently does not work using React Native >=0.12. See [#103](https://github.com/mjohnston/react-native-webpack-server/issues/103) for a temporary workaround.**

Since this is built on Webpack you can now leverage the growing ecosystem of addons such as React hot module replacement via [react-transform-hmr](https://github.com/gaearon/react-transform-hmr).

To enable hot reload, make sure you first install [babel-plugin-react-transform](https://github.com/gaearon/babel-plugin-react-transform) and [react-transform-hmr](https://github.com/gaearon/react-transform-hmr), then start the server with `--hot`.

You'll also need to configure Webpack. See the [Babel+ES6 config](https://github.com/mjohnston/react-native-webpack-server/blob/master/Examples/BabelES6/webpack.config.js) for an example.

**NOTE:** hot reload currently only works with the Chrome web socket executor (hit CMD+D in the simulator). If you regurlarly use this feature, you might want to default to the web socket executor in development:

RCTBridge.m:
```objc
- (void)setUp
{
  Class executorClass = _executorClass ?: _globalExecutorClass ?: [RCTContextExecutor class];
#if DEBUG
  executorClass = NSClassFromString(@"RCTWebSocketExecutor");
#endif
  ...
  }
```

## FAQ

**I can't import 3rd party modules in my project.**

Most react-native 3rd party modules are published to npm in ES6+ since the react-native packager handles transpiling. You may need to whitelist these modules in your webpack config, as the default configuration in the example excludes all of node_modules. See [issue #34](https://github.com/mjohnston/react-native-webpack-server/issues/34).

**I get the red box of death when using hot reload even after fixing the exception.**

Your code is still executing. Dismiss the red box using the `Esc` key.

**Why is hot reload using a no-op setInterval() in my app?**

It's a terrible hack to jump back onto the React Native runloop when a module is changed. If you have a better idea, please open a PR :)

**Source map generation is really slow on io.js.**

On a late-2012 Macbook Pro, it takes about 1.5 seconds to generate the source map for react-native on io.js. On stable node (0.12.x) it takes around 200ms. I originally thought this was an issue with [source-map](https://github.com/mozilla/source-map) but in an isolated test with the entirety of react-native I found io.js and node.js (stable) to be about the same. If you have any ideas, please let me know. In the meantime, it's best to use the latest stable version of node.js.

**My `.babelrc` configuration is not working**

The react-native packager will [cache its babel configuration](https://github.com/facebook/react-native/issues/1924), causing any subsequent changes to `.babelrc` to have no effect. Try using the `--resetCache` option to clear the RN packager cache:

```shell
rnws start --resetCache
```

See also: [#63](https://github.com/mjohnston/react-native-webpack-server/issues/63), [facebook/react-native#1924](https://github.com/facebook/react-native/issues/1924)
