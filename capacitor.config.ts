import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.wewrite.mobile',
  appName: 'WeWrite',
  webDir: 'out',
  server: {
    // For local development via USB, use localhost with ADB reverse port forwarding
    // Run: adb reverse tcp:3000 tcp:3000
    url: 'http://localhost:3000',
    cleartext: true,
    // Keep all navigation within the WebView
    hostname: 'localhost',
    androidScheme: 'http',
    // Allow navigation to these URLs within the WebView (don't open external browser)
    allowNavigation: ['localhost:3000'],
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
