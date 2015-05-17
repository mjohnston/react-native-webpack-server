if (module.hot) {
  var ReactNativeMount = require('ReactNativeMount');
  var HotLoaderInjection = require('react-hot-loader/Injection');
  HotLoaderInjection.RootInstanceProvider.injectProvider({
    getRootInstances: function() {
      return ReactNativeMount._instancesByContainerID;
    }
  });
  //! Terrible hack to marshall WS messages onto React Native's event loop.
  setInterval(function() {}, 200);
}