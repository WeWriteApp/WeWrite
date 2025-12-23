# Mobile App Setup Guide

This guide covers the configuration needed for iOS App Store and Google Play Store submissions.

## Table of Contents
- [iOS Setup](#ios-setup)
- [Android Setup](#android-setup)
- [Deep Linking Setup](#deep-linking-setup)
- [Production Build](#production-build)

---

## iOS Setup

### 1. Firebase Configuration (Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create one)
3. Go to Project Settings > General
4. Under "Your apps", add an iOS app with bundle ID: `app.wewrite.mobile`
5. Download `GoogleService-Info.plist`
6. Place it in `ios/App/App/GoogleService-Info.plist`

### 2. Apple Push Notification Service (APNs)

For push notifications to work:

1. In Apple Developer Portal, create an APNs Key:
   - Go to Certificates, Identifiers & Profiles > Keys
   - Create a new key with APNs enabled
   - Download the `.p8` file (keep it safe, you can only download once)

2. Upload to Firebase:
   - Go to Firebase Console > Project Settings > Cloud Messaging
   - Under "Apple app configuration", upload your APNs key
   - Enter your Key ID and Team ID

### 3. App Entitlements

The `App.entitlements` file is configured for:
- Push notifications (development mode by default)
- Associated Domains for universal links

**For Production:**
Edit `ios/App/App/App.entitlements` and change:
```xml
<key>aps-environment</key>
<string>production</string>
```

### 4. Privacy Manifest

The `PrivacyInfo.xcprivacy` file declares:
- No user tracking
- Data collected: email, name, user ID, user content, payment info
- APIs used: UserDefaults, file timestamps, system boot time

This is required by Apple since Spring 2024.

### 5. Team ID Configuration

Update `public/.well-known/apple-app-site-association`:
Replace `TEAM_ID` with your actual Apple Team ID (found in Apple Developer Portal > Membership).

---

## Android Setup

### 1. Firebase Configuration (Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create one)
3. Go to Project Settings > General
4. Under "Your apps", add an Android app with package name: `app.wewrite.mobile`
5. Download `google-services.json`
6. Place it in `android/app/google-services.json`

**Important:** The `google-services.json` file is required for:
- Firebase Cloud Messaging (push notifications)
- Firebase Analytics (if used)
- Firebase Crashlytics (if used)

### 2. Signing Certificate

For release builds, you need a signing certificate:

1. Generate a keystore (if you don't have one):
```bash
keytool -genkey -v -keystore wewrite-release-key.keystore -alias wewrite -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure signing in `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file("wewrite-release-key.keystore")
            storePassword "your-store-password"
            keyAlias "wewrite"
            keyPassword "your-key-password"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 3. Asset Links (App Links Verification)

Update `public/.well-known/assetlinks.json`:

Get your SHA-256 fingerprint:
```bash
# For debug keystore:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# For release keystore:
keytool -list -v -keystore wewrite-release-key.keystore -alias wewrite
```

Replace `SHA256_FINGERPRINT_PLACEHOLDER` with your actual SHA-256 fingerprint.

---

## Deep Linking Setup

### iOS Universal Links

1. Ensure `App.entitlements` has the associated domains configured
2. Update `public/.well-known/apple-app-site-association` with your Team ID
3. Deploy the file to `https://wewrite.app/.well-known/apple-app-site-association`
4. The file must be served with `Content-Type: application/json`

### Android App Links

1. The `AndroidManifest.xml` is already configured with intent filters
2. Update `public/.well-known/assetlinks.json` with your signing certificate fingerprint
3. Deploy to `https://wewrite.app/.well-known/assetlinks.json`

### Custom URL Scheme

Both platforms support the `wewrite://` URL scheme for backward compatibility.

---

## Production Build

### Using Production Capacitor Config

For App Store / Play Store builds:

```bash
# Backup development config
mv capacitor.config.ts capacitor.config.dev.ts

# Use production config
cp capacitor.config.production.ts capacitor.config.ts

# Sync native projects
npx cap sync

# Build web assets first
npm run build
npx next export  # or your static export command

# Open in IDE for building
npx cap open ios
npx cap open android
```

### iOS Production Checklist

- [ ] Change `aps-environment` to `production` in `App.entitlements`
- [ ] Update version number in Xcode (MARKETING_VERSION and CURRENT_PROJECT_VERSION)
- [ ] Ensure `GoogleService-Info.plist` is in place
- [ ] Update `apple-app-site-association` with real Team ID
- [ ] Archive and upload to App Store Connect

### Android Production Checklist

- [ ] Add `google-services.json` to `android/app/`
- [ ] Configure release signing in `build.gradle`
- [ ] Update version code and version name in `build.gradle`
- [ ] Update `assetlinks.json` with release signing certificate SHA-256
- [ ] Build signed APK or App Bundle
- [ ] Upload to Google Play Console

---

## Troubleshooting

### Push Notifications Not Working

1. Verify Firebase configuration files are in place
2. Check APNs key is uploaded to Firebase (iOS)
3. Ensure device has granted notification permissions
4. Check `aps-environment` matches your build type (development/production)

### Universal Links Not Working

1. Verify `apple-app-site-association` is accessible at `https://yourdomain.com/.well-known/apple-app-site-association`
2. Check the file has correct `Content-Type: application/json`
3. Verify Team ID is correct
4. Test with Apple's [App Search API Validation Tool](https://search.developer.apple.com/appsearch-validation-tool/)

### App Links Not Working (Android)

1. Verify `assetlinks.json` is accessible at `https://yourdomain.com/.well-known/assetlinks.json`
2. Verify SHA-256 fingerprint matches your signing certificate
3. Test with: `adb shell am start -a android.intent.action.VIEW -d "https://wewrite.app/test"`
