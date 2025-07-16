/**
 * Setup script to ensure all test users have all feature flags enabled
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';
import { DEV_TEST_USERS } from '../firebase/developmentAuth';

const ALL_FEATURE_FLAGS = [
  'payments',
  'map_view', 
  'calendar_view',
  'inactive_subscription',
  'token_system'
];

export async function setupTestUserFeatures() {
  try {
    console.log('🚀 Setting up feature flags for test users...');
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const results = [];
    
    // Process each test user
    for (const [key, testUser] of Object.entries(DEV_TEST_USERS)) {
      console.log(`\n📝 Processing test user: ${testUser.username} (${testUser.uid})`);
      
      const userResults = {
        user: key,
        uid: testUser.uid,
        username: testUser.username,
        features: []
      };
      
      // Enable all feature flags for this test user
      for (const featureFlag of ALL_FEATURE_FLAGS) {
        try {
          const overrideId = `${testUser.uid}_${featureFlag}`;
          const overrideRef = db.collection(getCollectionName('featureOverrides')).doc(overrideId);
          
          const overrideData = {
            userId: testUser.uid,
            featureId: featureFlag,
            enabled: true,
            lastModified: new Date().toISOString(),
            modifiedBy: 'system',
            reason: 'Test user - all features enabled by default'
          };
          
          await overrideRef.set(overrideData);
          
          userResults.features.push({
            feature: featureFlag,
            status: 'enabled',
            overrideId
          });
          
          console.log(`  ✅ ${featureFlag}: enabled`);
          
        } catch (error) {
          console.error(`  ❌ ${featureFlag}: error -`, error);
          userResults.features.push({
            feature: featureFlag,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      results.push(userResults);
    }
    
    // Also ensure the global feature flags document exists
    console.log('\n🔧 Ensuring global feature flags document exists...');
    const featureFlagsRef = db.collection(getCollectionName('config')).doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();
    
    if (!featureFlagsDoc.exists) {
      console.log('Creating global feature flags document...');
      const globalFlags = {};
      ALL_FEATURE_FLAGS.forEach(flag => {
        globalFlags[flag] = false; // Default to disabled globally
      });
      
      await featureFlagsRef.set(globalFlags);
      console.log('✅ Global feature flags document created');
    } else {
      console.log('✅ Global feature flags document already exists');
    }
    
    console.log('\n🎉 Test user feature setup complete!');
    console.log('\n📊 Summary:');
    results.forEach(result => {
      const enabledCount = result.features.filter(f => f.status === 'enabled').length;
      const errorCount = result.features.filter(f => f.status === 'error').length;
      console.log(`  ${result.username}: ${enabledCount} features enabled, ${errorCount} errors`);
    });
    
    return {
      success: true,
      results,
      totalUsers: results.length,
      totalFeatures: ALL_FEATURE_FLAGS.length
    };
    
  } catch (error) {
    console.error('❌ Error setting up test user features:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupTestUserFeatures()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Setup completed successfully');
        process.exit(0);
      } else {
        console.error('\n❌ Setup failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}
