#!/usr/bin/env node

/**
 * Collection Naming Health Check
 * 
 * Comprehensive health check for collection naming consistency.
 * Run this periodically to ensure no new naming issues are introduced.
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
 * Check if collection name follows camelCase convention
 */
function isCamelCase(name) {
  // Remove environment prefixes
  const baseName = name.replace(/^(DEV_|PROD_|dev_|prod_)/, '');
  
  // Allow analytics_ collections as legacy exceptions
  if (baseName.startsWith('analytics_')) {
    return true;
  }
  
  // Check if it's camelCase (no underscores, starts with lowercase)
  return !baseName.includes('_') && /^[a-z][a-zA-Z0-9]*$/.test(baseName);
}

/**
 * Check if collection name uses snake_case
 */
function isSnakeCase(name) {
  const baseName = name.replace(/^(DEV_|PROD_|dev_|prod_)/, '');
  return baseName.includes('_') && !baseName.startsWith('analytics_');
}

/**
 * Normalize collection name for duplicate detection
 */
function normalizeCollectionName(name) {
  const withoutPrefix = name.replace(/^(DEV_|PROD_|dev_|prod_)/, '');
  return withoutPrefix
    .split('_')
    .map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Run comprehensive health check
 */
async function runHealthCheck() {
  console.log('\n🏥 WeWrite Collection Naming Health Check');
  console.log('========================================');
  
  try {
    // Get all collections
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id).sort();
    
    console.log(`📊 Found ${collectionNames.length} total collections\n`);
    
    // Categorize collections
    const categories = {
      dev: collectionNames.filter(name => name.startsWith('DEV_') || name.startsWith('dev_')),
      prod: collectionNames.filter(name => !name.startsWith('DEV_') && !name.startsWith('dev_')),
      camelCase: [],
      snakeCase: [],
      other: []
    };
    
    // Analyze naming patterns
    collectionNames.forEach(name => {
      if (isCamelCase(name)) {
        categories.camelCase.push(name);
      } else if (isSnakeCase(name)) {
        categories.snakeCase.push(name);
      } else {
        categories.other.push(name);
      }
    });
    
    // Find actual duplicates (same environment, different casing)
    const duplicates = [];
    const devCollections = categories.dev.map(name => name.replace(/^(DEV_|dev_)/, ''));
    const prodCollections = categories.prod;

    // Check for duplicates within development environment
    const devGrouped = {};
    devCollections.forEach((baseName, index) => {
      const normalized = normalizeCollectionName(baseName);
      if (!devGrouped[normalized]) {
        devGrouped[normalized] = [];
      }
      devGrouped[normalized].push(categories.dev[index]);
    });

    Object.entries(devGrouped).forEach(([normalized, names]) => {
      if (names.length > 1) {
        duplicates.push({ environment: 'development', normalized, names });
      }
    });

    // Check for duplicates within production environment
    const prodGrouped = {};
    prodCollections.forEach(name => {
      const normalized = normalizeCollectionName(name);
      if (!prodGrouped[normalized]) {
        prodGrouped[normalized] = [];
      }
      prodGrouped[normalized].push(name);
    });

    Object.entries(prodGrouped).forEach(([normalized, names]) => {
      if (names.length > 1) {
        duplicates.push({ environment: 'production', normalized, names });
      }
    });
    
    // Report results
    console.log('📋 ENVIRONMENT BREAKDOWN:');
    console.log(`  • Development collections: ${categories.dev.length}`);
    console.log(`  • Production collections: ${categories.prod.length}`);
    
    console.log('\n📋 NAMING PATTERN ANALYSIS:');
    console.log(`  • camelCase collections: ${categories.camelCase.length}`);
    console.log(`  • snake_case collections: ${categories.snakeCase.length}`);
    console.log(`  • Other patterns: ${categories.other.length}`);
    
    // Health score calculation
    const totalCollections = collectionNames.length;
    const camelCaseScore = (categories.camelCase.length / totalCollections) * 100;
    const duplicateScore = duplicates.length === 0 ? 100 : Math.max(0, 100 - (duplicates.length * 10));
    const overallScore = (camelCaseScore + duplicateScore) / 2;
    
    console.log('\n🎯 HEALTH SCORE:');
    console.log(`  • Naming Consistency: ${camelCaseScore.toFixed(1)}%`);
    console.log(`  • No Duplicates: ${duplicateScore.toFixed(1)}%`);
    console.log(`  • Overall Health: ${overallScore.toFixed(1)}%`);
    
    // Issues found
    let issuesFound = 0;
    
    if (categories.snakeCase.length > 0) {
      console.log('\n⚠️  SNAKE_CASE COLLECTIONS FOUND:');
      categories.snakeCase.forEach(name => {
        console.log(`  • ${name} (should be camelCase)`);
      });
      issuesFound += categories.snakeCase.length;
    }
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  ACTUAL DUPLICATES FOUND:');
      duplicates.forEach(({ environment, normalized, names }) => {
        console.log(`  • ${environment}: ${normalized}`);
        names.forEach(name => console.log(`    - ${name}`));
      });
      issuesFound += duplicates.length;
    }
    
    // Recommendations
    if (issuesFound > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      console.log('==================');
      
      if (categories.snakeCase.length > 0) {
        console.log('1. Fix snake_case collections:');
        console.log('   • Add to COLLECTIONS constant with camelCase name');
        console.log('   • Update API code to use COLLECTIONS.CONSTANT');
        console.log('   • Migrate data if collections contain data');
        console.log('   • Run: node scripts/migrate-collection-casing.js');
      }
      
      if (duplicates.length > 0) {
        console.log('2. Resolve duplicate collections:');
        console.log('   • Run: node scripts/find-casing-duplicates.js');
        console.log('   • Migrate data from old to new collections');
        console.log('   • Delete old collections after verification');
      }
      
      console.log('\n📚 Documentation:');
      console.log('   • See: docs/COLLECTION_NAMING_STANDARDS.md');
      console.log('   • Follow the established naming conventions');
    } else {
      console.log('\n🎉 EXCELLENT HEALTH!');
      console.log('All collections follow consistent naming patterns.');
      console.log('No issues found.');
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`  • Total collections: ${totalCollections}`);
    console.log(`  • Issues found: ${issuesFound}`);
    console.log(`  • Health score: ${overallScore.toFixed(1)}%`);
    
    if (overallScore >= 95) {
      console.log('  • Status: 🟢 EXCELLENT');
    } else if (overallScore >= 80) {
      console.log('  • Status: 🟡 GOOD');
    } else {
      console.log('  • Status: 🔴 NEEDS ATTENTION');
    }
    
    console.log('\n✅ Health check complete!');
    
    // Exit with appropriate code
    process.exit(issuesFound > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

// Run the health check
runHealthCheck();
