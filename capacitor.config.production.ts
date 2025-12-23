import type { CapacitorConfig } from '@capacitor/cli';

/**
 * PRODUCTION Capacitor Configuration
 *
 * Use this config for App Store / Play Store builds:
 * 1. Copy this file to capacitor.config.ts before building
 * 2. Or rename: mv capacitor.config.ts capacitor.config.dev.ts && mv capacitor.config.production.ts capacitor.config.ts
 * 3. Run: npx cap sync
 * 4. Build for production in Xcode / Android Studio
 *
 * IMPORTANT: For production builds, you must:
 * - Change aps-environment to "production" in App.entitlements
 * - Add google-services.json to android/app/ for Firebase
 * - Update version numbers in build.gradle and Xcode
 */

const config: CapacitorConfig = {
  appId: 'app.wewrite.mobile',
  appName: 'WeWrite',
  webDir: 'out',

  // Production: No development server, use bundled assets
  // The 'server' block is intentionally omitted for production

  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'WeWrite',
    // Allow the app to handle links to wewrite.app
    limitsNavigationsToAppBoundDomains: true
  },

  android: {
    // Disable mixed content in production (HTTPS only)
    allowMixedContent: false,
    captureInput: true,
    // CRITICAL: Disable debugging in production
    webContentsDebuggingEnabled: false,
    // Use HTTPS scheme in production
    // Note: server block is omitted, so app uses bundled assets
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
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    PushNotifications: {
      // Present notifications when app is in foreground
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
