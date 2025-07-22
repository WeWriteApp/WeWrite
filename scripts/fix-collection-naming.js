#!/usr/bin/env node

/**
 * Fix Collection Naming Script
 * 
 * This script helps fix the inconsistency between dev_ and DEV_ collection prefixes.
 * It will:
 * 1. List all existing collections
 * 2. Identify collections with inconsistent naming (dev_ vs DEV_)
 * 3. Provide commands to migrate data from dev_ to DEV_ collections
 * 4. Clean up old dev_ collections
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    // Try to get service account from environment (same as your app uses)
    let serviceAccount;

    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      // Use the same credential your app uses
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;

      // Handle base64 encoded credentials
      if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True' && !jsonString.includes(' ') && !jsonString.startsWith('{')) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
        console.log('✅ Decoded base64-encoded credentials');
      }

      serviceAccount = JSON.parse(jsonString);
      console.log('✅ Using GOOGLE_CLOUD_KEY_JSON credentials');
    } else if (process.env.LOGGING_CLOUD_KEY_JSON) {
      // Fallback to logging credentials
      serviceAccount = JSON.parse(process.env.LOGGING_CLOUD_KEY_JSON);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
      console.error('❌ No Firebase service account found.');
      console.error('Available environment variables:');
      console.error('  - GOOGLE_CLOUD_KEY_JSON (preferred)');
      console.error('  - LOGGING_CLOUD_KEY_JSON (fallback)');
      console.error('  - FIREBASE_SERVICE_ACCOUNT_KEY');
      console.error('  - GOOGLE_APPLICATION_CREDENTIALS');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });

    console.log('✅ Firebase Admin initialized');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    process.exit(1);
  }
}

// Get all collections in the database
async function getAllCollections(db) {
  try {
    const collections = await db.listCollections();
    return collections.map(col => col.id);
  } catch (error) {
    console.error('❌ Failed to list collections:', error);
    return [];
  }
}

// Analyze collection naming
function analyzeCollections(collections) {
  const analysis = {
    dev_collections: [],
    DEV_collections: [],
    production_collections: [],
    inconsistent_pairs: []
  };

  collections.forEach(name => {
    if (name.startsWith('dev_')) {
      analysis.dev_collections.push(name);
    } else if (name.startsWith('DEV_')) {
      analysis.DEV_collections.push(name);
    } else {
      analysis.production_collections.push(name);
    }
  });

  // Find inconsistent pairs (both dev_ and DEV_ versions exist)
  analysis.dev_collections.forEach(devCol => {
    const baseName = devCol.substring(4); // Remove 'dev_'
    const devUpperCase = `DEV_${baseName}`;
    if (analysis.DEV_collections.includes(devUpperCase)) {
      analysis.inconsistent_pairs.push({
        old: devCol,
        new: devUpperCase,
        baseName
      });
    }
  });

  return analysis;
}

// Generate migration commands
function generateMigrationCommands(analysis) {
  const commands = [];

  console.log('\n🔧 COLLECTION NAMING ANALYSIS');
  console.log('================================');
  
  if (analysis.dev_collections.length > 0) {
    console.log(`\n📋 Found ${analysis.dev_collections.length} collections with old 'dev_' prefix:`);
    analysis.dev_collections.forEach(col => console.log(`  • ${col}`));
  }

  if (analysis.DEV_collections.length > 0) {
    console.log(`\n✅ Found ${analysis.DEV_collections.length} collections with correct 'DEV_' prefix:`);
    analysis.DEV_collections.forEach(col => console.log(`  • ${col}`));
  }

  if (analysis.inconsistent_pairs.length > 0) {
    console.log(`\n⚠️  Found ${analysis.inconsistent_pairs.length} INCONSISTENT PAIRS:`);
    analysis.inconsistent_pairs.forEach(pair => {
      console.log(`  • ${pair.old} AND ${pair.new} both exist!`);
    });
    
    console.log('\n🚨 MANUAL ACTION REQUIRED:');
    console.log('You have both dev_ and DEV_ versions of the same collections.');
    console.log('You need to manually decide which data to keep and merge if necessary.');
  }

  // Generate Firebase CLI commands for cleanup
  const devOnlyCollections = analysis.dev_collections.filter(devCol => {
    const baseName = devCol.substring(4);
    const devUpperCase = `DEV_${baseName}`;
    return !analysis.DEV_collections.includes(devUpperCase);
  });

  if (devOnlyCollections.length > 0) {
    console.log('\n🔄 MIGRATION COMMANDS:');
    console.log('Run these commands to migrate data from dev_ to DEV_ collections:');
    console.log('(Make sure you have firebase-tools installed: pnpm add firebase-tools -w)');
    
    devOnlyCollections.forEach(oldCol => {
      const baseName = oldCol.substring(4);
      const newCol = `DEV_${baseName}`;
      console.log(`\n# Migrate ${oldCol} -> ${newCol}`);
      console.log(`npx firebase firestore:export ./backup-${oldCol} --collection-ids ${oldCol}`);
      console.log(`npx firebase firestore:import ./backup-${oldCol} --collection-ids ${newCol}`);
      console.log(`# After verifying data: npx firebase firestore:delete --collection-path ${oldCol} --yes`);
    });
  }

  return commands;
}

// Main function
async function main() {
  console.log('🔍 WeWrite Collection Naming Fixer');
  console.log('==================================');
  
  const db = initializeFirebase();
  
  console.log('\n📊 Analyzing collections...');
  const collections = await getAllCollections(db);
  
  if (collections.length === 0) {
    console.log('❌ No collections found or unable to access Firestore');
    return;
  }

  console.log(`✅ Found ${collections.length} total collections`);
  
  const analysis = analyzeCollections(collections);
  generateMigrationCommands(analysis);

  console.log('\n📝 SUMMARY:');
  console.log(`  • Total collections: ${collections.length}`);
  console.log(`  • Old dev_ collections: ${analysis.dev_collections.length}`);
  console.log(`  • Correct DEV_ collections: ${analysis.DEV_collections.length}`);
  console.log(`  • Production collections: ${analysis.production_collections.length}`);
  console.log(`  • Inconsistent pairs: ${analysis.inconsistent_pairs.length}`);

  if (analysis.dev_collections.length === 0) {
    console.log('\n🎉 All collections are using the correct DEV_ prefix!');
  }

  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
