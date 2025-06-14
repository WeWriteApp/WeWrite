#!/usr/bin/env node

/**
 * Script to check Firebase Admin SDK configuration and permissions
 * This helps debug authentication and permission issues
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

async function checkFirebaseAdmin() {
  console.log('🔍 Checking Firebase Admin SDK Configuration...\n');

  try {
    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log('- GOOGLE_CLOUD_KEY_JSON:', !!process.env.GOOGLE_CLOUD_KEY_JSON ? 'Present' : 'Missing');
    console.log('- LOGGING_CLOUD_KEY_JSON:', !!process.env.LOGGING_CLOUD_KEY_JSON ? 'Present' : 'Missing');
    console.log('- PROJECT_ID:', process.env.PROJECT_ID || 'Missing');
    console.log('- NEXT_PUBLIC_FIREBASE_PID:', process.env.NEXT_PUBLIC_FIREBASE_PID || 'Missing');
    console.log('');

    // Parse service account
    let serviceAccount;
    let keySource;
    
    // Test both service accounts to see which one has proper permissions
    const serviceAccounts = [];

    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      try {
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
        }
        serviceAccounts.push({
          source: 'GOOGLE_CLOUD_KEY_JSON',
          account: JSON.parse(jsonString)
        });
      } catch (parseError) {
        console.error('❌ Failed to parse GOOGLE_CLOUD_KEY_JSON:', parseError.message);
      }
    }

    if (process.env.LOGGING_CLOUD_KEY_JSON) {
      try {
        let jsonString = process.env.LOGGING_CLOUD_KEY_JSON;
        // Remove actual newline characters that break JSON parsing
        jsonString = jsonString.replace(/\n/g, '');
        // Also remove carriage returns if present
        jsonString = jsonString.replace(/\r/g, '');

        serviceAccounts.push({
          source: 'LOGGING_CLOUD_KEY_JSON',
          account: JSON.parse(jsonString)
        });
      } catch (parseError) {
        console.error('❌ Failed to parse LOGGING_CLOUD_KEY_JSON:', parseError.message);
      }
    }

    if (serviceAccounts.length === 0) {
      console.error('❌ No service account found in environment variables');
      process.exit(1);
    }

    // Test each service account to find one with proper permissions
    for (const { source, account } of serviceAccounts) {
      console.log(`\n🔑 Testing Service Account: ${source}`);
      console.log('- Project ID:', account.project_id);
      console.log('- Client Email:', account.client_email);
      console.log('- Type:', account.type);

      try {
        // Clean up any existing apps
        admin.apps.forEach(app => app.delete());

        // Initialize Firebase Admin with this service account
        admin.initializeApp({
          credential: admin.credential.cert(account),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || `https://${account.project_id}-default-rtdb.firebaseio.com`
        });
        console.log('✅ Firebase Admin initialized successfully');

        // Test Firestore access
        console.log('🔥 Testing Firestore Access...');
        const db = admin.firestore();

        let hasPermissions = true;

        // Try to read from a collection
        try {
          const testRef = db.collection('test').doc('permissions-check');
          await testRef.get();
          console.log('✅ Firestore read access: OK');
        } catch (readError) {
          console.error('❌ Firestore read access failed:', readError.message);
          hasPermissions = false;
        }

        // Try to write to a collection
        try {
          const testRef = db.collection('test').doc('permissions-check');
          await testRef.set({
            timestamp: new Date(),
            test: 'Firebase Admin SDK permissions check'
          });
          console.log('✅ Firestore write access: OK');
        } catch (writeError) {
          console.error('❌ Firestore write access failed:', writeError.message);
          hasPermissions = false;
        }

        // Test user collection access (the actual issue)
        console.log('👤 Testing User Collection Access...');
        try {
          const usersRef = db.collection('users').limit(1);
          const snapshot = await usersRef.get();
          console.log('✅ Users collection read access: OK');
          console.log(`- Found ${snapshot.size} user(s)`);
        } catch (userError) {
          console.error('❌ Users collection access failed:', userError.message);
          hasPermissions = false;
        }

        // Test subscription subcollection access
        console.log('💳 Testing Subscription Collection Access...');
        try {
          // Use a test user ID
          const testUserId = 'test-user-id';
          const subscriptionRef = db.collection('users').doc(testUserId).collection('subscription').doc('current');
          await subscriptionRef.get();
          console.log('✅ Subscription collection read access: OK');
        } catch (subError) {
          console.error('❌ Subscription collection access failed:', subError.message);
          hasPermissions = false;
        }

        if (hasPermissions) {
          console.log(`\n🎉 SUCCESS: ${source} has proper Firestore permissions!`);
          console.log(`Recommendation: Use ${source} for Firebase Admin SDK initialization`);
          break;
        } else {
          console.log(`\n❌ ${source} lacks sufficient Firestore permissions`);
        }

      } catch (error) {
        console.error(`💥 Error testing ${source}:`, error.message);
      }
    }

    console.log('\n🎉 Firebase Admin SDK check completed!');
    
  } catch (error) {
    console.error('💥 Error during Firebase Admin check:', error);
    process.exit(1);
  }
}

// Run the check
checkFirebaseAdmin().catch(console.error);
