#!/usr/bin/env node

/**
 * Audit Duplicate Collections Script
 * 
 * Identifies collections with inconsistent naming patterns like:
 * - usdBalances vs usd_balances
 * - userSessions vs user_sessions
 * 
 * This helps identify and consolidate duplicate collections with different casing.
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
 * Normalize collection name to find potential duplicates
 */
function normalizeCollectionName(name) {
  // Remove environment prefixes
  const withoutPrefix = name.replace(/^(DEV_|PROD_|dev_|prod_)/, '');
  
  // Convert to camelCase for comparison
  return withoutPrefix
    .split('_')
    .map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Get the preferred collection name based on our standards
 */
function getPreferredName(names) {
  // Prefer camelCase over snake_case
  const camelCaseNames = names.filter(name => !name.includes('_') || name.startsWith('analytics_'));
  if (camelCaseNames.length > 0) {
    return camelCaseNames[0];
  }
  
  // If no camelCase, return the first one
  return names[0];
}

/**
 * Analyze collections for duplicates and inconsistencies
 */
async function auditCollections() {
  console.log('\n🔍 WeWrite Collection Duplicate Audit');
  console.log('=====================================');
  
  try {
    // Get all collections
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id).sort();
    
    console.log(`📊 Found ${collectionNames.length} total collections\n`);
    
    // Group collections by normalized name
    const groupedCollections = {};
    const environmentGroups = {
      dev: [],
      prod: [],
      other: []
    };
    
    collectionNames.forEach(name => {
      const normalized = normalizeCollectionName(name);
      
      if (!groupedCollections[normalized]) {
        groupedCollections[normalized] = [];
      }
      groupedCollections[normalized].push(name);
      
      // Categorize by environment
      if (name.startsWith('DEV_') || name.startsWith('dev_')) {
        environmentGroups.dev.push(name);
      } else if (name.startsWith('PROD_') || name.startsWith('prod_')) {
        environmentGroups.prod.push(name);
      } else {
        environmentGroups.other.push(name);
      }
    });
    
    // Find duplicates
    const duplicates = Object.entries(groupedCollections)
      .filter(([normalized, names]) => names.length > 1)
      .map(([normalized, names]) => ({
        normalized,
        names,
        preferred: getPreferredName(names.map(n => n.replace(/^(DEV_|PROD_|dev_|prod_)/, ''))),
        count: names.length
      }));
    
    // Report findings
    console.log('🔍 ENVIRONMENT BREAKDOWN:');
    console.log(`  • Development collections: ${environmentGroups.dev.length}`);
    console.log(`  • Production collections: ${environmentGroups.prod.length}`);
    console.log(`  • Other collections: ${environmentGroups.other.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATE COLLECTIONS FOUND:');
      console.log('================================');
      
      duplicates.forEach(({ normalized, names, preferred, count }) => {
        console.log(`\n📋 Group: ${normalized} (${count} variants)`);
        names.forEach(name => {
          const isPreferred = name.replace(/^(DEV_|PROD_|dev_|prod_)/, '') === preferred;
          const marker = isPreferred ? '✅' : '⚠️ ';
          console.log(`  ${marker} ${name}`);
        });
        console.log(`  🎯 Preferred base name: ${preferred}`);
      });
      
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      console.log('======================');
      
      duplicates.forEach(({ normalized, names, preferred }) => {
        const devVariants = names.filter(n => n.startsWith('DEV_') || n.startsWith('dev_'));
        const prodVariants = names.filter(n => !n.startsWith('DEV_') && !n.startsWith('dev_'));
        
        if (devVariants.length > 1) {
          console.log(`\n📝 Development duplicates for ${normalized}:`);
          const preferredDev = devVariants.find(n => n.replace(/^(DEV_|dev_)/, '') === preferred);
          const otherDev = devVariants.filter(n => n !== preferredDev);
          
          if (preferredDev && otherDev.length > 0) {
            console.log(`  ✅ Keep: ${preferredDev}`);
            otherDev.forEach(variant => {
              console.log(`  🔄 Migrate data from: ${variant} → ${preferredDev}`);
              console.log(`     Command: npx firebase firestore:export ./backup-${variant} --collection-ids ${variant}`);
              console.log(`     Command: npx firebase firestore:import ./backup-${variant} --collection-ids ${preferredDev}`);
              console.log(`     Command: npx firebase firestore:delete --collection-path ${variant} --yes`);
            });
          }
        }
        
        if (prodVariants.length > 1) {
          console.log(`\n📝 Production duplicates for ${normalized}:`);
          const preferredProd = prodVariants.find(n => n === preferred);
          const otherProd = prodVariants.filter(n => n !== preferredProd);
          
          if (preferredProd && otherProd.length > 0) {
            console.log(`  ✅ Keep: ${preferredProd}`);
            otherProd.forEach(variant => {
              console.log(`  🔄 Migrate data from: ${variant} → ${preferredProd}`);
              console.log(`     ⚠️  PRODUCTION DATA - BE VERY CAREFUL!`);
            });
          }
        }
      });
      
    } else {
      console.log('\n🎉 No duplicate collections found!');
      console.log('All collections follow consistent naming patterns.');
    }
    
    // Show all collections for reference
    console.log('\n📋 ALL COLLECTIONS:');
    console.log('==================');
    
    Object.entries(environmentGroups).forEach(([env, collections]) => {
      if (collections.length > 0) {
        console.log(`\n${env.toUpperCase()} (${collections.length}):`);
        collections.forEach(name => console.log(`  • ${name}`));
      }
    });
    
    console.log('\n✅ Audit complete!');
    
  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

// Run the audit
auditCollections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
