if (module.hot) {
  //! Terrible hack to marshall WS messages onto React Native's event loop.
  setInterval(function() {}, 200);
}
