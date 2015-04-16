# React Native and Webpack

React Native Webpack Server is a development server that leverages the [Webpack Dev Server](https://github.com/webpack/webpack-dev-server) and the [React Packager](https://github.com/facebook/react-native/tree/master/packager) to enable building React Native JavaScript bundles with webpack. This allows you to use the existing webpack ecosystem when targeting React Native.

## Installing

```
npm install --save-dev react-native-webpack-server
```

## Using

By default React Native will look for an index.ios.js at the root of the project. Delete this file and add an entry in your webpack config:

```js
entry: {
  'index.ios': ['./src/main.js']
}
```

Start the React Native Webpack Server using the included script. You might want to put this in your `package.json`.

```js
"scripts": {
  "start": "./node_modules/.bin/react-native-webpack-server start"
}
```

This will start the server on port 8080. The last step is to change the URL of your application bundle in `AppDelegate.m`, changing 8081 to 8080:

```objc
jsCodeLocation = [NSURL URLWithString:@"http://localhost:8080/index.ios.bundle"];
```

To run the development server:

```
npm start
```

## Source Maps

Current solutions for building React Native bundles with Webpack lose source maps. This is because the Webpack bundle is first built and then passed off to the React Packager which [constructs the source map by hand](https://github.com/facebook/react-native/blob/master/packager/react-packager/src/Packager/Package.js#L149). This is done for speed, but it also means you can only use transforms that map lines 1 to 1.

React Native Webpack Server enables source maps by generating the react-native and application bundles separately and then combining their source maps.

## Hot Reload

Since this is built on Webpack you can now leverage the growing ecosystem of addons such as [React Hot Loader](https://github.com/gaearon/react-hot-loader).

To enable hot reload, make sure you first install the `react-hot-loader` package and then start the server with `--hot=1`.

You'll also need to configure Webpack. See the [Babel+ES6 config](https://github.com/mjohnston/react-native-webpack-server/blob/master/Examples/BabelES6/webpack.config.js) for an example.

The examples in this repo use a relative path `../../` to link to react-native-webpack-server. You'll need to replace these with the node.js module path: `react-native-webpack-server`. The 2 places you will see this are in `package.json` scripts and `webpack.config.js` hot loader entry.

**NOTE:** hot reload currently only works with the web socket executor (hit CMD+D in the simulator). If you regurlarly use this feature, you might want to default to the web socket exeuctor in development:

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

**Sometimes the text disappears when using hot reload.**

That is a [known bug](https://github.com/facebook/react-native/issues/813).

**I get the red box of death when using hot reload even after fixing the exception.**

Your code is still executing. Dismiss the red box using the `Esc` key.

**Why is hot reload using a no-op setInterval() in my app?**

It's a terrible hack to jump back onto the React Native runloop when a module is changed. If you have a better idea, please open a PR :)

**Source map generation is really slow on io.js.**

On a late-2012 Macbook Pro, it takes about 1.5 seconds to generate the source map for react-native on io.js. On stable node (0.12.x) it takes around 200ms. I originally thought this was an issue with [source-map](https://github.com/mozilla/source-map) but in an isolated test with the entirety of react-native I found io.js and node.js (stable) to be about the same. If you have any ideas, please let me know. In the meantime, it's best to use the latest stable version of node.js.