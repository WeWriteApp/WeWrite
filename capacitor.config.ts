import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.wewrite.mobile',
  appName: 'WeWrite',
  webDir: 'out',
  server: {
    // Use the live server URL for development
    // Comment this out for production builds that use local assets
    url: 'https://getwewrite.app',
    cleartext: true,
    // Keep all navigation within the WebView
    hostname: 'getwewrite.app',
    androidScheme: 'https',
    // Allow navigation to these URLs within the WebView (don't open external browser)
    allowNavigation: ['getwewrite.app', '*.getwewrite.app', 'getwewrite.app/*'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'WeWrite'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      // Let the native theme handle status bar styling based on light/dark mode
      // The Android styles.xml and values-night/styles.xml configure this
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
