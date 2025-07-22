#!/usr/bin/env node

/**
 * Simple script to create a test account for local development
 * This bypasses email verification and creates a ready-to-use account
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL
  });
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  console.log('💡 Make sure you have firebase-service-account.json in your project root');
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

// Default test account
const DEFAULT_TEST_ACCOUNT = {
  email: 'test@local.dev',
  password: 'TestPassword123!',
  username: 'testuser',
  displayName: 'Test User'
};

async function createTestAccount(accountData = DEFAULT_TEST_ACCOUNT) {
  try {
    console.log('🚀 Creating test account...');
    console.log(`📧 Email: ${accountData.email}`);
    console.log(`👤 Username: ${accountData.username}`);
    
    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(accountData.email);
      console.log('⚠️  User already exists, updating password...');
      
      // Update existing user
      await auth.updateUser(userRecord.uid, {
        password: accountData.password,
        emailVerified: true
      });
      
      console.log('✅ Password updated successfully');
      
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user...');
        
        userRecord = await auth.createUser({
          email: accountData.email,
          password: accountData.password,
          emailVerified: true,
          displayName: accountData.displayName
        });
        
        console.log('✅ User created in Firebase Auth');
      } else {
        throw error;
      }
    }

    // Create user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email: accountData.email,
      username: accountData.username,
      emailVerified: true,
      isAnonymous: false,
      isDevelopment: true,
      bio: 'Test account for local development',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      profileComplete: true,
      pageCount: 0,
      followerCount: 0,
      viewCount: 0
    };

    // Use environment-aware collection names
    const usersCollection = process.env.NODE_ENV === 'development' ? 'DEV_users' : 'users';
    const usernamesCollection = process.env.NODE_ENV === 'development' ? 'DEV_usernames' : 'usernames';

    await db.collection(usersCollection).doc(userRecord.uid).set(userProfile);
    console.log('✅ User profile created in Firestore');

    // Create username mapping
    await db.collection(usernamesCollection).doc(accountData.username).set({
      uid: userRecord.uid,
      email: accountData.email,
      username: accountData.username,
      createdAt: new Date().toISOString()
    });
    console.log('✅ Username mapping created');

    console.log('\n🎉 Test account ready!');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${accountData.email}`);
    console.log(`   Password: ${accountData.password}`);
    console.log(`   Username: ${accountData.username}`);
    console.log('\n💡 You can now log in at http://localhost:3000/auth/login');

    return {
      success: true,
      uid: userRecord.uid,
      email: accountData.email,
      username: accountData.username
    };

  } catch (error) {
    console.error('❌ Error creating test account:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📖 Test Account Creator

Usage:
  node scripts/create-test-account.js [options]

Options:
  --email <email>       Email for the test account (default: test@local.dev)
  --username <username> Username for the test account (default: testuser)
  --password <password> Password for the test account (default: TestPassword123!)
  --help, -h           Show this help message

Examples:
  node scripts/create-test-account.js
  node scripts/create-test-account.js --email mytest@local.dev --username myuser
    `);
    return;
  }

  // Parse command line arguments
  const accountData = { ...DEFAULT_TEST_ACCOUNT };
  
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--email':
        accountData.email = value;
        break;
      case '--username':
        accountData.username = value;
        break;
      case '--password':
        accountData.password = value;
        break;
    }
  }

  const result = await createTestAccount(accountData);
  
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTestAccount };
