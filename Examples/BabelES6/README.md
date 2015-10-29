## Running the example app

Install the example app dependencies and start the server:

```
npm install
npm start
```

**iOS**: Open the Xcode project and build/run.

**Android**:

```shell
npm run android-setup-port
react-native run-android
```

To run with hot reload (iOS-only):

```
npm run hot
```

Hot reload only works with the web socket executor (hit CMD+D in the simulator). See [the explanatory note](https://github.com/mjohnston/react-native-webpack-server#hot-module-replacement).

To build for release:

```
npm run bundle
```
