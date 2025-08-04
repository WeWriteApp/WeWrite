#!/usr/bin/env node

/**
 * Find Casing Duplicates Script
 * 
 * Specifically looks for collections that differ only in casing:
 * - usdBalances vs usd_balances
 * - userSessions vs user_sessions
 * 
 * This helps identify the exact duplicates that need consolidation.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;
  
  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    try {
      const base64Key = process.env.GOOGLE_CLOUD_KEY_JSON;
      const decodedKey = Buffer.from(base64Key, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decodedKey);
      console.log('✅ Decoded base64-encoded credentials');
    } catch (error) {
      console.error('❌ Failed to decode GOOGLE_CLOUD_KEY_JSON:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ GOOGLE_CLOUD_KEY_JSON environment variable not found');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });
  
  console.log('✅ Firebase Admin initialized');
}

const db = admin.firestore();

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Check if a collection name uses snake_case
 */
function isSnakeCase(name) {
  return name.includes('_') && !name.startsWith('analytics_'); // analytics_ are legacy exceptions
}

/**
 * Check if a collection name uses camelCase
 */
function isCamelCase(name) {
  return !name.includes('_') && /[a-z][A-Z]/.test(name);
}

/**
 * Find collections that have both snake_case and camelCase variants
 */
async function findCasingDuplicates() {
  console.log('\n🔍 WeWrite Casing Duplicates Finder');
  console.log('===================================');
  
  try {
    // Get all collections
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id).sort();
    
    console.log(`📊 Found ${collectionNames.length} total collections\n`);
    
    // Group by environment
    const devCollections = collectionNames.filter(name => name.startsWith('DEV_'));
    const prodCollections = collectionNames.filter(name => !name.startsWith('DEV_') && !name.startsWith('dev_'));
    
    console.log(`🔍 Development collections: ${devCollections.length}`);
    console.log(`🔍 Production collections: ${prodCollections.length}\n`);
    
    // Find casing duplicates in development
    const devDuplicates = findCasingDuplicatesInList(devCollections, 'DEV_');
    
    // Find casing duplicates in production
    const prodDuplicates = findCasingDuplicatesInList(prodCollections, '');
    
    // Report findings
    if (devDuplicates.length > 0) {
      console.log('⚠️  DEVELOPMENT CASING DUPLICATES:');
      console.log('=================================');
      
      devDuplicates.forEach(({ snakeCase, camelCase, baseName }) => {
        console.log(`\n📋 Base: ${baseName}`);
        console.log(`  ⚠️  Snake case: ${snakeCase}`);
        console.log(`  ✅ Camel case: ${camelCase} (preferred)`);
        console.log(`  🔄 Action: Migrate ${snakeCase} → ${camelCase}`);
      });
    }
    
    if (prodDuplicates.length > 0) {
      console.log('\n⚠️  PRODUCTION CASING DUPLICATES:');
      console.log('=================================');
      
      prodDuplicates.forEach(({ snakeCase, camelCase, baseName }) => {
        console.log(`\n📋 Base: ${baseName}`);
        console.log(`  ⚠️  Snake case: ${snakeCase}`);
        console.log(`  ✅ Camel case: ${camelCase} (preferred)`);
        console.log(`  🔄 Action: Migrate ${snakeCase} → ${camelCase}`);
        console.log(`  ⚠️  WARNING: This is production data!`);
      });
    }
    
    if (devDuplicates.length === 0 && prodDuplicates.length === 0) {
      console.log('🎉 No casing duplicates found!');
      console.log('All collections follow consistent naming patterns.');
    } else {
      console.log('\n🔧 MIGRATION COMMANDS:');
      console.log('=====================');
      
      [...devDuplicates, ...prodDuplicates].forEach(({ snakeCase, camelCase }) => {
        console.log(`\n# Migrate ${snakeCase} → ${camelCase}`);
        console.log(`npx firebase firestore:export ./backup-${snakeCase.replace(/[^a-zA-Z0-9]/g, '_')} --collection-ids ${snakeCase}`);
        console.log(`npx firebase firestore:import ./backup-${snakeCase.replace(/[^a-zA-Z0-9]/g, '_')} --collection-ids ${camelCase}`);
        console.log(`# After verifying data integrity:`);
        console.log(`npx firebase firestore:delete --collection-path ${snakeCase} --yes`);
      });
      
      console.log('\n⚠️  IMPORTANT NOTES:');
      console.log('===================');
      console.log('1. Always backup data before migration');
      console.log('2. Test migration on development first');
      console.log('3. Verify data integrity after import');
      console.log('4. Update any hardcoded collection references in code');
      console.log('5. Use getCollectionName() for environment-aware access');
    }
    
    // Show specific collections for manual review
    console.log('\n📋 ALL DEVELOPMENT COLLECTIONS:');
    console.log('===============================');
    devCollections.forEach(name => {
      const baseName = name.replace('DEV_', '');
      const casing = isSnakeCase(baseName) ? 'snake_case' : isCamelCase(baseName) ? 'camelCase' : 'other';
      console.log(`  ${name} (${casing})`);
    });
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

/**
 * Find casing duplicates in a list of collections
 */
function findCasingDuplicatesInList(collections, prefix) {
  const duplicates = [];
  const baseNames = collections.map(name => name.replace(prefix, ''));
  
  baseNames.forEach(baseName => {
    if (isSnakeCase(baseName)) {
      const camelVersion = snakeToCamel(baseName);
      const fullCamelName = prefix + camelVersion;
      
      if (collections.includes(fullCamelName)) {
        duplicates.push({
          snakeCase: prefix + baseName,
          camelCase: fullCamelName,
          baseName: baseName
        });
      }
    }
  });
  
  return duplicates;
}

// Run the analysis
findCasingDuplicates()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
