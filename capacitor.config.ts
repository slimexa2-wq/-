const config = {
  appId: 'com.slimexa.mineradio.ipad',
  appName: 'Mineradio iPad',
  webDir: 'www',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Mineradio'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      overlaysWebView: true
    }
  }
};

export default config;
