/**
 * Browser console test for daily notes feature flag
 *
 * To use this:
 * 1. Open browser console on localhost:3000
 * 2. Copy and paste this entire script
 * 3. Run it to test the feature flag system
 */

async function testDailyNotesFeatureFlag() {
  console.log('🔍 Testing Daily Notes Feature Flag...');

  try {
    // Get current user from auth context
    const user = window.user || window.currentUser;
    if (!user) {
      console.log('❌ No user found. Please log in first.');
      console.log('💡 Try: window.user or check if you are logged in');
      return;
    }

    console.log(`👤 Testing for user: ${user.email} (UID: ${user.uid})`);

    // Use the global Firebase instances that should be available
    const { doc, getDoc, setDoc, getFirestore } = window.firebase?.firestore || {};
    if (!doc || !getDoc || !setDoc) {
      console.log('❌ Firebase Firestore not available. Trying alternative approach...');

      // Try to get from the app's Firebase config
      const db = window.db || window.firestore;
      if (!db) {
        console.log('❌ No Firebase database instance found');
        return;
      }
    }

    // 1. Check global feature flag
    console.log('\n1. Checking global feature flags...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const data = featureFlagsDoc.data();
      console.log('📊 Global flags:', data);
      console.log(`🗓️ Daily notes global: ${data.daily_notes ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.log('❌ No global feature flags found');
      return;
    }

    // 2. Check user-specific override
    console.log('\n2. Checking user-specific override...');
    const userOverrideRef = doc(db, 'featureOverrides', `${user.uid}_daily_notes`);
    const userOverrideDoc = await getDoc(userOverrideRef);

    if (userOverrideDoc.exists()) {
      const overrideData = userOverrideDoc.data();
      console.log(`🔧 User override found: ${overrideData.enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log('📅 Last modified:', overrideData.lastModified);
    } else {
      console.log('📝 No user-specific override found');

      // Create one for testing
      console.log('🔄 Creating user-specific override...');
      await setDoc(userOverrideRef, {
        userId: user.uid,
        featureId: 'daily_notes',
        enabled: true,
        lastModified: new Date().toISOString()
      });
      console.log('✅ User override created: ENABLED');
    }

    // 3. Test the useFeatureFlag hook
    console.log('\n3. Testing feature flag hook...');

    // Import the feature flag utility
    const { isFeatureEnabledForUser } = await import('/app/utils/feature-flags.js');

    const isEnabled = await isFeatureEnabledForUser('daily_notes', user.uid);
    console.log(`🎯 Feature flag result: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);

    // 4. Check if daily notes section should be visible
    console.log('\n4. Checking DOM for daily notes section...');
    const dailyNotesSection = document.querySelector('[data-component="DailyNotesSection"]') ||
                             document.querySelector('.daily-notes') ||
                             document.querySelector('[class*="daily"]');

    if (dailyNotesSection) {
      console.log('✅ Daily notes section found in DOM');
      console.log('📍 Element:', dailyNotesSection);
    } else {
      console.log('❌ Daily notes section NOT found in DOM');
      console.log('🔄 Try refreshing the page to see if it appears now');
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log(`   - User: ${user.email}`);
    console.log(`   - Feature enabled: ${isEnabled ? 'YES' : 'NO'}`);
    console.log(`   - DOM element: ${dailyNotesSection ? 'FOUND' : 'NOT FOUND'}`);

    if (isEnabled && !dailyNotesSection) {
      console.log('\n💡 The feature is enabled but not visible. Try refreshing the page.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Auto-run the test
testDailyNotesFeatureFlag();
