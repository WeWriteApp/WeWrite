#!/usr/bin/env node

/**
 * Script to create Firebase Storage bucket
 * Run with: node scripts/create-storage-bucket.js
 */

const { getFirebaseAdmin } = require('../app/firebase/firebaseAdmin');

async function createStorageBucket() {
  try {
    console.log('🔥 Initializing Firebase Admin...');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.error('❌ Failed to initialize Firebase Admin');
      process.exit(1);
    }

    console.log('✅ Firebase Admin initialized');
    
    // Get project info
    const app = admin.app();
    const projectId = app.options.projectId;
    console.log(`📋 Project ID: ${projectId}`);
    
    if (!projectId) {
      console.error('❌ No project ID found in Firebase Admin config');
      process.exit(1);
    }

    // Try different bucket names
    const possibleBuckets = [
      `${projectId}.appspot.com`,
      `${projectId}.firebasestorage.app`,
      projectId
    ];

    console.log('🔍 Checking existing buckets...');
    
    for (const bucketName of possibleBuckets) {
      try {
        console.log(`   Testing: ${bucketName}`);
        const bucket = admin.storage().bucket(bucketName);
        await bucket.getMetadata();
        console.log(`✅ Bucket already exists: ${bucketName}`);
        return bucketName;
      } catch (error) {
        console.log(`   ❌ ${bucketName}: ${error.message}`);
      }
    }

    console.log('🚀 No existing bucket found. Creating new bucket...');
    
    // Create bucket with default name
    const defaultBucketName = `${projectId}.appspot.com`;
    console.log(`📦 Creating bucket: ${defaultBucketName}`);
    
    try {
      const bucket = admin.storage().bucket(defaultBucketName);
      
      // Note: The Firebase Admin SDK doesn't directly create buckets
      // You need to create them via the Firebase Console or gcloud CLI
      console.log('⚠️  Firebase Admin SDK cannot directly create storage buckets.');
      console.log('📝 Please create the bucket manually:');
      console.log('');
      console.log('   1. Go to: https://console.firebase.google.com/');
      console.log(`   2. Select project: ${projectId}`);
      console.log('   3. Go to Storage in the sidebar');
      console.log('   4. Click "Get started"');
      console.log('   5. Choose security rules (test mode for development)');
      console.log('   6. Select a location (e.g., us-central1)');
      console.log('');
      console.log(`   Expected bucket name: ${defaultBucketName}`);
      console.log('');
      console.log('🔧 Alternative: Use gcloud CLI:');
      console.log(`   gsutil mb gs://${defaultBucketName}`);
      
    } catch (error) {
      console.error('❌ Error creating bucket:', error.message);
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
createStorageBucket();
