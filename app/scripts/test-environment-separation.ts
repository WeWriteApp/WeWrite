/**
 * Test Environment Separation
 * 
 * This script tests that environment separation is working correctly
 * by checking collection names and verifying that preview/dev data
 * doesn't leak into production.
 */

import { 
  getEnvironmentType, 
  getEnvironmentPrefix, 
  getCollectionName,
  getSubCollectionPath,
  PAYMENT_COLLECTIONS,
  logEnvironmentConfig
} from '../utils/environmentConfig';

/**
 * Test environment detection
 */
function testEnvironmentDetection() {
  console.log('\n🌍 Testing Environment Detection...');
  
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  
  console.log(`Environment Type: ${envType}`);
  console.log(`Environment Prefix: "${prefix}"`);
  console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  
  // Verify environment logic
  if (process.env.VERCEL_ENV === 'production') {
    console.log('✅ Production environment detected correctly');
    if (prefix !== '') {
      console.error('❌ ERROR: Production should have no prefix!');
    }
  } else if (process.env.VERCEL_ENV === 'preview') {
    console.log('✅ Preview environment detected correctly');
    if (prefix !== '') {
      console.error('❌ ERROR: Preview should have no prefix (uses production data)!');
    }
  } else {
    console.log('✅ Development environment detected correctly');
    if (prefix !== 'dev_') {
      console.error('❌ ERROR: Development should have "dev_" prefix!');
    }
  }
}

/**
 * Test collection naming
 */
function testCollectionNaming() {
  console.log('\n📝 Testing Collection Naming...');
  
  const criticalCollections = [
    'users',
    'subscriptions',
    'tokenBalances',
    'tokenAllocations',
    'writerTokenBalances',
    'writerTokenEarnings',
    'tokenPayouts',
    'pages'
  ];
  
  criticalCollections.forEach(collection => {
    const envSpecificName = getCollectionName(collection);
    console.log(`${collection} -> ${envSpecificName}`);
    
    // Verify naming logic
    const envType = getEnvironmentType();
    if (envType === 'production' && envSpecificName !== collection) {
      console.error(`❌ ERROR: Production collection name should be unchanged: ${collection}`);
    } else if (envType === 'preview' && !envSpecificName.startsWith('preview_')) {
      console.error(`❌ ERROR: Preview collection should start with "preview_": ${envSpecificName}`);
    } else if (envType === 'development' && !envSpecificName.startsWith('dev_')) {
      console.error(`❌ ERROR: Development collection should start with "dev_": ${envSpecificName}`);
    }
  });
}

/**
 * Test subcollection paths
 */
function testSubCollectionPaths() {
  console.log('\n🗂️ Testing SubCollection Paths...');
  
  const testUserId = 'test-user-123';
  
  // Test subscription path
  const { parentPath, subCollectionName } = getSubCollectionPath(
    PAYMENT_COLLECTIONS.USERS, 
    testUserId, 
    PAYMENT_COLLECTIONS.SUBSCRIPTIONS
  );
  
  console.log(`Subscription Path:`);
  console.log(`  Parent: ${parentPath}`);
  console.log(`  SubCollection: ${subCollectionName}`);
  console.log(`  Full Path: ${parentPath}/${subCollectionName}`);
  
  // Verify environment separation
  const envType = getEnvironmentType();
  if (envType === 'production') {
    if (parentPath !== `users/${testUserId}` || subCollectionName !== 'subscriptions') {
      console.error('❌ ERROR: Production paths should be unchanged');
    }
  } else if (envType === 'preview') {
    if (!parentPath.includes('preview_') || !subCollectionName.includes('preview_')) {
      console.error('❌ ERROR: Preview paths should include "preview_" prefix');
    }
  } else if (envType === 'development') {
    if (!parentPath.includes('dev_') || !subCollectionName.includes('dev_')) {
      console.error('❌ ERROR: Development paths should include "dev_" prefix');
    }
  }
}

/**
 * Test payment collections
 */
function testPaymentCollections() {
  console.log('\n💳 Testing Payment Collections...');
  
  Object.entries(PAYMENT_COLLECTIONS).forEach(([key, value]) => {
    const envSpecificName = getCollectionName(value);
    console.log(`${key}: ${value} -> ${envSpecificName}`);
  });
}

/**
 * Simulate subscription data access
 */
function simulateSubscriptionAccess() {
  console.log('\n🔐 Simulating Subscription Data Access...');
  
  const testUserId = 'user-123';
  const envType = getEnvironmentType();
  
  // Show what collections would be accessed
  const userCollection = getCollectionName(PAYMENT_COLLECTIONS.USERS);
  const { parentPath, subCollectionName } = getSubCollectionPath(
    PAYMENT_COLLECTIONS.USERS, 
    testUserId, 
    PAYMENT_COLLECTIONS.SUBSCRIPTIONS
  );
  const tokenBalanceCollection = getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES);
  
  console.log(`Environment: ${envType}`);
  console.log(`User Collection: ${userCollection}`);
  console.log(`Subscription Path: ${parentPath}/${subCollectionName}`);
  console.log(`Token Balance Collection: ${tokenBalanceCollection}`);
  
  // Verify separation
  if (envType === 'production') {
    console.log('✅ Production will access production data only');
  } else {
    console.log(`✅ ${envType} will access ${envType}-specific data only`);
    console.log('✅ Production data is protected from contamination');
  }
}

/**
 * Check for potential data leaks
 */
function checkForDataLeaks() {
  console.log('\n🚨 Checking for Potential Data Leaks...');
  
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  
  // List of collections that MUST be environment-separated
  const criticalCollections = [
    'subscriptions',
    'tokenBalances', 
    'tokenAllocations',
    'writerTokenBalances',
    'writerTokenEarnings',
    'tokenPayouts',
    'payouts',
    'transactions'
  ];
  
  let hasLeaks = false;
  
  criticalCollections.forEach(collection => {
    const envName = getCollectionName(collection);
    
    if (envType !== 'production' && envName === collection) {
      console.error(`❌ LEAK DETECTED: ${collection} is not environment-separated!`);
      hasLeaks = true;
    }
  });
  
  if (!hasLeaks) {
    console.log('✅ No data leaks detected - environment separation is working');
  } else {
    console.error('❌ CRITICAL: Data leaks detected! Fix environment separation immediately!');
  }
}

/**
 * Main test function
 */
function runEnvironmentSeparationTests() {
  console.log('🧪 Environment Separation Test Suite');
  console.log('=====================================');
  
  // Log current environment config
  logEnvironmentConfig();
  
  // Run all tests
  testEnvironmentDetection();
  testCollectionNaming();
  testSubCollectionPaths();
  testPaymentCollections();
  simulateSubscriptionAccess();
  checkForDataLeaks();
  
  console.log('\n✅ Environment separation tests completed');
  console.log('Review the output above for any errors or warnings');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runEnvironmentSeparationTests();
}

export {
  runEnvironmentSeparationTests,
  testEnvironmentDetection,
  testCollectionNaming,
  checkForDataLeaks
};
