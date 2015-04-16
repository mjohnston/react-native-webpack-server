if (module.hot) {
  var ReactIOSMount = require('ReactIOSMount');
  var HotLoaderInjection = require('react-hot-loader/Injection');
  HotLoaderInjection.RootInstanceProvider.injectProvider({
    getRootInstances: function() {
      return ReactIOSMount._instancesByContainerID;
    }
  });
  //! Terrible hack to marshall WS messages onto React Native's event loop.
  setInterval(function() {}, 200);
}