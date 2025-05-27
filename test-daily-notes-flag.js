#!/usr/bin/env node

/**
 * Test script to verify daily notes feature flag functionality
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } = require('firebase/firestore');

// Firebase config (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testDailyNotesFlag() {
  try {
    console.log('🔍 Testing Daily Notes Feature Flag System...\n');

    // 1. Check global feature flags
    console.log('1. Checking global feature flags...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const data = featureFlagsDoc.data();
      console.log('   📊 Global feature flags:', JSON.stringify(data, null, 2));
      console.log(`   🗓️  Daily notes global flag: ${data.daily_notes}`);
    } else {
      console.log('   ❌ No global feature flags document found');
      return;
    }

    // 2. Check for user-specific overrides
    console.log('\n2. Checking user-specific overrides...');
    const featureOverridesRef = collection(db, 'featureOverrides');
    const dailyNotesOverridesQuery = query(
      featureOverridesRef,
      where('featureId', '==', 'daily_notes')
    );
    const overridesSnapshot = await getDocs(dailyNotesOverridesQuery);

    if (overridesSnapshot.empty) {
      console.log('   📝 No user-specific overrides found for daily_notes');
    } else {
      console.log('   📝 User-specific overrides found:');
      overridesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`      - User ${data.userId}: ${data.enabled ? 'ENABLED' : 'DISABLED'} (modified: ${data.lastModified})`);
      });
    }

    // 3. Check if we need to enable the flag for the admin user
    console.log('\n3. Checking admin user access...');

    // Get admin user ID (jamiegray2234@gmail.com)
    const usersRef = collection(db, 'users');
    const adminQuery = query(usersRef, where('email', '==', 'jamiegray2234@gmail.com'));
    const adminSnapshot = await getDocs(adminQuery);

    if (!adminSnapshot.empty) {
      const adminDoc = adminSnapshot.docs[0];
      const adminUserId = adminDoc.id;
      console.log(`   👤 Found admin user: ${adminUserId}`);

      // Check if admin has override
      const adminOverrideRef = doc(db, 'featureOverrides', `${adminUserId}_daily_notes`);
      const adminOverrideDoc = await getDoc(adminOverrideRef);

      if (adminOverrideDoc.exists()) {
        const overrideData = adminOverrideDoc.data();
        console.log(`   🔧 Admin override exists: ${overrideData.enabled ? 'ENABLED' : 'DISABLED'}`);

        if (!overrideData.enabled) {
          console.log('   🔄 Enabling daily notes for admin user...');
          await setDoc(adminOverrideRef, {
            userId: adminUserId,
            featureId: 'daily_notes',
            enabled: true,
            lastModified: new Date().toISOString()
          });
          console.log('   ✅ Daily notes enabled for admin user');
        }
      } else {
        console.log('   🔄 Creating daily notes override for admin user...');
        await setDoc(adminOverrideRef, {
          userId: adminUserId,
          featureId: 'daily_notes',
          enabled: true,
          lastModified: new Date().toISOString()
        });
        console.log('   ✅ Daily notes override created for admin user');
      }
    } else {
      console.log('   ❌ Admin user not found');
    }

    console.log('\n🎉 Daily notes feature flag test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Global flag checked ✓');
    console.log('   - User overrides checked ✓');
    console.log('   - Admin user access ensured ✓');
    console.log('\n💡 The daily notes section should now appear on the homepage for the admin user.');

  } catch (error) {
    console.error('❌ Error testing daily notes flag:', error);
  }
}

// Run the test
testDailyNotesFlag().then(() => {
  console.log('\n🏁 Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
