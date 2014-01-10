chrome.app.runtime.onLaunched.addListener(function() {
  var width = 1024;
  var height = 512;

  chrome.app.window.create('app.html', {
    id: 'appWindow1',
    bounds: {
      width: width,
      height: height,
    },
    resizable: false
  });
});
