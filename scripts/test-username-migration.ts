#!/usr/bin/env node

/**
 * Username Migration Test Script
 *
 * This script creates test data and validates the migration process
 * in the development environment before running on production.
 */

// Use dynamic imports for ES modules
let getFirebaseAdmin, getCollectionName;

async function loadModules() {
  const firebaseModule = await import('../app/firebase/firebaseAdmin.js');
  const envModule = await import('../app/utils/environmentConfig.js');

  getFirebaseAdmin = firebaseModule.getFirebaseAdmin;
  getCollectionName = envModule.getCollectionName;
}

// Initialize Firebase Admin
const admin = getFirebaseAdmin();
const db = admin ? admin.firestore() : null;

if (!db) {
  console.error('❌ Failed to initialize Firebase Admin');
  process.exit(1);
}

interface TestUser {
  username: string;
  email: string;
  uid: string;
}

/**
 * Creates test users with whitespace in usernames
 */
async function createTestData(): Promise<TestUser[]> {
  console.log('🧪 Creating test data...');
  
  const testUsers: TestUser[] = [
    {
      username: 'john doe',
      email: 'john.doe@test.com',
      uid: 'test_user_1'
    },
    {
      username: 'jane smith',
      email: 'jane.smith@test.com',
      uid: 'test_user_2'
    },
    {
      username: 'bob\tjohnson',
      email: 'bob.johnson@test.com',
      uid: 'test_user_3'
    },
    {
      username: 'alice\nwilson',
      email: 'alice.wilson@test.com',
      uid: 'test_user_4'
    },
    {
      username: 'test  user',
      email: 'test.user@test.com',
      uid: 'test_user_5'
    }
  ];
  
  const usersCollection = getCollectionName('users');
  const usernamesCollection = getCollectionName('usernames');
  
  console.log(`📁 Creating test data in collections:`);
  console.log(`   Users: ${usersCollection}`);
  console.log(`   Usernames: ${usernamesCollection}`);
  
  for (const user of testUsers) {
    try {
      // Create user document
      await db.collection(usersCollection).doc(user.uid).set({
        username: user.username,
        email: user.email,
        created: new Date().toISOString(),
        isTestData: true
      });
      
      // Create username document
      await db.collection(usernamesCollection).doc(user.username.toLowerCase()).set({
        uid: user.uid,
        createdAt: new Date().toISOString(),
        isTestData: true
      });
      
      console.log(`   ✅ Created test user: "${user.username}"`);
      
    } catch (error) {
      console.error(`   ❌ Failed to create test user "${user.username}":`, error);
    }
  }
  
  return testUsers;
}

/**
 * Validates that test data was created correctly
 */
async function validateTestData(testUsers: TestUser[]): Promise<boolean> {
  console.log('\n🔍 Validating test data...');
  
  const usersCollection = getCollectionName('users');
  const usernamesCollection = getCollectionName('usernames');
  
  let allValid = true;
  
  for (const user of testUsers) {
    try {
      // Check user document
      const userDoc = await db.collection(usersCollection).doc(user.uid).get();
      if (!userDoc.exists) {
        console.error(`   ❌ User document missing: ${user.uid}`);
        allValid = false;
        continue;
      }
      
      // Check username document
      const usernameDoc = await db.collection(usernamesCollection).doc(user.username.toLowerCase()).get();
      if (!usernameDoc.exists) {
        console.error(`   ❌ Username document missing: ${user.username}`);
        allValid = false;
        continue;
      }
      
      // Verify whitespace detection
      const hasWhitespace = /\s/.test(user.username);
      if (!hasWhitespace) {
        console.error(`   ❌ Test username should contain whitespace: ${user.username}`);
        allValid = false;
        continue;
      }
      
      console.log(`   ✅ Test user valid: "${user.username}"`);
      
    } catch (error) {
      console.error(`   ❌ Error validating test user "${user.username}":`, error);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Cleans up test data
 */
async function cleanupTestData(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');
  
  const usersCollection = getCollectionName('users');
  const usernamesCollection = getCollectionName('usernames');
  
  try {
    // Find all test data documents
    const testUsersQuery = await db.collection(usersCollection)
      .where('isTestData', '==', true)
      .get();
    
    const testUsernamesQuery = await db.collection(usernamesCollection)
      .where('isTestData', '==', true)
      .get();
    
    // Delete test user documents
    const userDeletePromises = testUsersQuery.docs.map(doc => doc.ref.delete());
    await Promise.all(userDeletePromises);
    console.log(`   ✅ Deleted ${testUsersQuery.docs.length} test user documents`);
    
    // Delete test username documents
    const usernameDeletePromises = testUsernamesQuery.docs.map(doc => doc.ref.delete());
    await Promise.all(usernameDeletePromises);
    console.log(`   ✅ Deleted ${testUsernamesQuery.docs.length} test username documents`);
    
  } catch (error) {
    console.error('   ❌ Error cleaning up test data:', error);
  }
}

/**
 * Runs migration test
 */
async function runMigrationTest(): Promise<void> {
  console.log('\n🔄 Running migration test...');
  
  try {
    // Import and run migration in dry run mode
    process.env.DRY_RUN = 'true';
    const { runMigration } = await import('./migrate-usernames-whitespace');
    
    const summary = await runMigration();
    
    console.log('\n📊 Migration Test Results:');
    console.log(`   Usernames with whitespace found: ${summary.usernamesWithWhitespace}`);
    console.log(`   Expected migrations: ${summary.results.length}`);
    
    // Validate expected results
    if (summary.usernamesWithWhitespace >= 5) {
      console.log('   ✅ Migration detected test usernames correctly');
    } else {
      console.log('   ⚠️  Migration may not have detected all test usernames');
    }
    
    // Show what would be migrated
    console.log('\n📋 Planned migrations:');
    summary.results.forEach(result => {
      if (result.success) {
        console.log(`   "${result.oldUsername}" → "${result.newUsername}"`);
      } else {
        console.log(`   ❌ "${result.oldUsername}": ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    throw error;
  }
}

/**
 * Validates username cleaning logic
 */
function testUsernameCleaning(): void {
  console.log('\n🧪 Testing username cleaning logic...');
  
  const testCases = [
    { input: 'john doe', expected: 'john_doe' },
    { input: 'jane  smith', expected: 'jane_smith' },
    { input: 'bob\tjohnson', expected: 'bob_johnson' },
    { input: 'alice\nwilson', expected: 'alice_wilson' },
    { input: '  test user  ', expected: 'test_user' },
    { input: 'user___name', expected: 'user_name' },
    { input: 'a b c d', expected: 'a_b_c_d' }
  ];
  
  function cleanUsername(username: string): string {
    return username
      .replace(/\s+/g, '_')           // Replace whitespace with underscores
      .replace(/_+/g, '_')            // Remove consecutive underscores
      .replace(/^_+|_+$/g, '');       // Remove leading/trailing underscores
  }
  
  let allPassed = true;
  
  testCases.forEach(({ input, expected }) => {
    const result = cleanUsername(input);
    const passed = result === expected;
    
    console.log(`   ${passed ? '✅' : '❌'} "${input}" → "${result}" ${passed ? '' : `(expected "${expected}")`}`);
    
    if (!passed) {
      allPassed = false;
    }
  });
  
  if (allPassed) {
    console.log('   ✅ All username cleaning tests passed');
  } else {
    console.log('   ❌ Some username cleaning tests failed');
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 Username Migration Test Suite');
  console.log('================================');
  
  try {
    // Test username cleaning logic
    testUsernameCleaning();
    
    // Clean up any existing test data first
    await cleanupTestData();
    
    // Create test data
    const testUsers = await createTestData();
    
    // Validate test data
    const isValid = await validateTestData(testUsers);
    if (!isValid) {
      throw new Error('Test data validation failed');
    }
    
    // Run migration test
    await runMigrationTest();
    
    // Clean up test data
    await cleanupTestData();
    
    console.log('\n✅ All tests passed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Review the migration script output');
    console.log('   2. Run the actual migration with DRY_RUN=false');
    console.log('   3. Monitor for any issues');
    console.log('   4. Use the generated rollback script if needed');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    
    // Attempt cleanup even if tests failed
    try {
      await cleanupTestData();
    } catch (cleanupError) {
      console.error('❌ Cleanup also failed:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { createTestData, validateTestData, cleanupTestData };
