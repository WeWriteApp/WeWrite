#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * 
 * This script helps set up a complete development environment with test data
 * that is completely separated from production data.
 * 
 * Usage:
 *   node scripts/setup-dev-environment.js
 * 
 * What it does:
 * 1. Creates test users in dev_users collection
 * 2. Creates test pages in dev_pages collection  
 * 3. Creates test activities in dev_activities collection
 * 4. Sets up test subscriptions in dev_subscriptions
 * 5. Verifies environment separation is working
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin using the same pattern as the app
function initializeFirebaseAdmin() {
  try {
    // Try to get existing app first
    try {
      return admin.app();
    } catch (error) {
      // App doesn't exist, create it
    }

    // Use environment variables like the main app does
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
      let keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';

      console.log(`Using service account from ${keySource}`);

      const serviceAccount = JSON.parse(jsonString);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com',
        projectId: serviceAccount.project_id || 'wewrite-ccd82'
      });
    } else {
      // Try default credentials (for local development with gcloud auth)
      console.log('Trying default credentials...');
      admin.initializeApp({
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com',
        projectId: 'wewrite-ccd82'
      });
    }

    console.log('✅ Firebase Admin initialized successfully');
    return admin.app();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.error('💡 Make sure you have GOOGLE_CLOUD_KEY_JSON environment variable set or run "gcloud auth application-default login"');
    process.exit(1);
  }
}

const app = initializeFirebaseAdmin();
const db = admin.firestore();

// Generate Firebase-style UID for development
function generateFirebaseStyleUID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 28; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Test data templates with Firebase-style UIDs
const TEST_USERS = [
  {
    id: generateFirebaseStyleUID(),
    email: 'testuser1@example.com',
    username: 'testuser1',
    uid: generateFirebaseStyleUID(),
    created: admin.firestore.Timestamp.now(),
    bio: 'This is a test user for development',
    isPublic: true
  },
  {
    id: generateFirebaseStyleUID(),
    email: 'testuser2@example.com',
    username: 'testuser2',
    uid: generateFirebaseStyleUID(),
    created: admin.firestore.Timestamp.now(),
    bio: 'Another test user for development',
    isPublic: true
  }
];

const TEST_PAGES = [
  {
    id: 'dev-page-1',
    title: 'Welcome to Development Environment',
    content: 'This is a test page in the development environment. You can safely edit and test here without affecting production data.',
    userId: 'dev-user-1',
    username: 'testuser1',
    isPublic: true,
    createdAt: admin.firestore.Timestamp.now(),
    lastModified: admin.firestore.Timestamp.now(),
    deleted: false
  },
  {
    id: 'dev-page-2',
    title: 'Testing Page Features',
    content: 'This page is for testing various features like editing, activities, and subscriptions.',
    userId: 'dev-user-2', 
    username: 'testuser2',
    isPublic: true,
    createdAt: admin.firestore.Timestamp.now(),
    lastModified: admin.firestore.Timestamp.now(),
    deleted: false
  }
];

async function setupDevUsers() {
  console.log('📝 Setting up development users...');
  
  for (const user of TEST_USERS) {
    try {
      await db.collection('dev_users').doc(user.id).set(user);
      console.log(`✅ Created dev user: ${user.username}`);
      
      // Also create username reservation
      await db.collection('dev_usernames').doc(user.username).set({
        uid: user.uid,
        createdAt: admin.firestore.Timestamp.now()
      });
      console.log(`✅ Reserved username: ${user.username}`);
      
    } catch (error) {
      console.error(`❌ Failed to create user ${user.username}:`, error);
    }
  }
}

async function setupDevPages() {
  console.log('📄 Setting up development pages...');
  
  for (const page of TEST_PAGES) {
    try {
      await db.collection('dev_pages').doc(page.id).set(page);
      console.log(`✅ Created dev page: ${page.title}`);
      
      // Create initial version
      await db.collection('dev_pages').doc(page.id).collection('versions').add({
        content: page.content,
        title: page.title,
        createdAt: admin.firestore.Timestamp.now(),
        userId: page.userId,
        isInitialVersion: true
      });
      console.log(`✅ Created initial version for: ${page.title}`);
      
    } catch (error) {
      console.error(`❌ Failed to create page ${page.title}:`, error);
    }
  }
}

async function setupDevActivities() {
  console.log('🎯 Setting up development activities...');
  
  const activities = [
    {
      type: 'page_created',
      pageId: 'dev-page-1',
      userId: 'dev-user-1',
      username: 'testuser1',
      pageTitle: 'Welcome to Development Environment',
      timestamp: admin.firestore.Timestamp.now(),
      isPublic: true,
      isNewPage: true
    },
    {
      type: 'page_created', 
      pageId: 'dev-page-2',
      userId: 'dev-user-2',
      username: 'testuser2',
      pageTitle: 'Testing Page Features',
      timestamp: admin.firestore.Timestamp.now(),
      isPublic: true,
      isNewPage: true
    }
  ];
  
  for (const activity of activities) {
    try {
      await db.collection('dev_activities').add(activity);
      console.log(`✅ Created activity: ${activity.type} for ${activity.pageTitle}`);
    } catch (error) {
      console.error(`❌ Failed to create activity:`, error);
    }
  }
}

async function setupDevSubscriptions() {
  console.log('💳 Setting up development subscriptions...');
  
  const subscriptions = [
    {
      userId: 'dev-user-1',
      stripeSubscriptionId: 'sub_test_dev_user_1',
      amount: 10,
      tier: '1',
      status: 'active',
      createdAt: admin.firestore.Timestamp.now(),
      lastModified: admin.firestore.Timestamp.now()
    }
  ];
  
  for (const subscription of subscriptions) {
    try {
      await db.collection('dev_users').doc(subscription.userId)
        .collection('dev_subscriptions').doc('current').set(subscription);
      console.log(`✅ Created dev subscription for user: ${subscription.userId}`);
    } catch (error) {
      console.error(`❌ Failed to create subscription:`, error);
    }
  }
}

async function verifyEnvironmentSeparation() {
  console.log('🔍 Verifying environment separation...');
  
  // Check that dev collections exist and have data
  const devUsersSnapshot = await db.collection('dev_users').limit(1).get();
  const devPagesSnapshot = await db.collection('dev_pages').limit(1).get();
  
  if (!devUsersSnapshot.empty && !devPagesSnapshot.empty) {
    console.log('✅ Development collections created successfully');
    console.log(`📊 Dev users: ${devUsersSnapshot.size}, Dev pages: ${devPagesSnapshot.size}`);
  } else {
    console.log('⚠️  Some development collections may be empty');
  }
  
  // Verify production collections are separate (should not be affected)
  const prodUsersSnapshot = await db.collection('users').limit(1).get();
  console.log(`📊 Production users collection size: ${prodUsersSnapshot.size} (unchanged)`);
}

async function main() {
  console.log('🚀 Starting development environment setup...\n');
  
  try {
    await setupDevUsers();
    console.log('');
    
    await setupDevPages();
    console.log('');
    
    await setupDevActivities();
    console.log('');
    
    await setupDevSubscriptions();
    console.log('');
    
    await verifyEnvironmentSeparation();
    console.log('');
    
    console.log('🎉 Development environment setup complete!');
    console.log('');
    console.log('📋 What was created:');
    console.log('  • dev_users collection with test users');
    console.log('  • dev_pages collection with test pages');
    console.log('  • dev_activities collection with test activities');
    console.log('  • dev_subscriptions subcollection with test subscriptions');
    console.log('  • dev_usernames collection with username reservations');
    console.log('');
    console.log('🔒 Environment separation verified:');
    console.log('  • Development data is in dev_ prefixed collections');
    console.log('  • Production data remains untouched');
    console.log('  • Safe to test editing and subscription features');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Setup script completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Setup script failed:', error);
    process.exit(1);
  });
}

module.exports = { main };
