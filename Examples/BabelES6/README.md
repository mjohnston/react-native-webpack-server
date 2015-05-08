## Running the example app

First run `npm install` from the root of this repository (this is needed since the examples reference react-native-webpack-server locally).

Install the example app dependencies and start the server:

```
npm install
npm start
```

Open the Xcode project and build/run.

To run with hot reload:

```
npm run hot
```

Hot reload only works with the web socket executor (hit CMD+D in the simulator) or the WebView executor (CMD+CTRL+Z -> Enable Safari Debugging). See [the explanatory note](https://github.com/mjohnston/react-native-webpack-server#hot-reload).

To build for release:

```
NODE_ENV=production npm start
```

```
curl 'http://localhost:8080/index.ios.bundle?dev=false&minify=true' -o iOS/main.jsbundle
```

Then uncomment the line in AppDelegate.m that loads the local `main.jsbundle`.
