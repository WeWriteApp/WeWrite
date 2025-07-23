#!/usr/bin/env node

/**
 * Migration Script: Activities to Versions
 * 
 * This script migrates existing activities from the activities collection
 * to the unified version system under pages/{pageId}/versions
 * 
 * Usage: node scripts/migrate-activities-to-versions.js [--dry-run] [--limit=100]
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.development' });
require('dotenv').config({ path: '.env' });

const admin = require('firebase-admin');

// Environment-aware collection naming (inline implementation)
function getCollectionName(baseName) {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return baseName;
  } else {
    return `DEV_${baseName}`;
  }
}

// Initialize Firebase Admin
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountKey = process.env.GOOGLE_CLOUD_KEY_JSON;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_CLOUD_KEY_JSON environment variable is required');
    }

    const serviceAccount = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString());
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }
  
  return admin.firestore();
}

// Convert activity to version format
function convertActivityToVersion(activity, activityId) {
  const activityData = activity.data || activity;
  
  return {
    // Core version data
    content: activityData.content || '',
    title: activityData.pageName || 'Untitled',
    createdAt: activityData.timestamp || activityData.createdAt || new Date().toISOString(),
    userId: activityData.userId || 'unknown',
    username: activityData.username || 'Unknown User',
    previousVersionId: null, // Will be set during migration
    groupId: activityData.groupId || null,
    
    // Diff data
    diff: activityData.diff || {
      added: 0,
      removed: 0,
      hasChanges: false
    },
    
    // Rich diff preview
    diffPreview: activityData.diffPreview || {
      beforeContext: '',
      addedText: '',
      removedText: '',
      afterContext: '',
      hasAdditions: false,
      hasRemovals: false
    },
    
    // Metadata
    isNewPage: activityData.activityType === 'page_creation' || false,
    isNoOp: activityData.diff?.hasChanges === false,
    
    // Migration metadata
    migratedFromActivity: true,
    originalActivityId: activityId,
    migrationTimestamp: new Date().toISOString()
  };
}

// Main migration function
async function migrateActivitiesToVersions(options = {}) {
  const { dryRun = false, limit = null } = options;
  
  console.log('🚀 Starting Activities to Versions Migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Limit: ${limit || 'No limit'}`);
  console.log('');
  
  const db = initializeFirebase();
  const activitiesCollection = getCollectionName('activities');
  const pagesCollection = getCollectionName('pages');
  
  // Get all activities
  let activitiesQuery = db.collection(activitiesCollection)
    .orderBy('timestamp', 'desc');
  
  if (limit) {
    activitiesQuery = activitiesQuery.limit(limit);
  }
  
  const activitiesSnapshot = await activitiesQuery.get();
  
  if (activitiesSnapshot.empty) {
    console.log('❌ No activities found to migrate');
    return;
  }
  
  console.log(`📊 Found ${activitiesSnapshot.size} activities to migrate`);
  console.log('');
  
  const stats = {
    processed: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    pagesMigrated: new Set()
  };
  
  // Group activities by page
  const activitiesByPage = new Map();
  
  activitiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const pageId = data.pageId;
    
    if (!pageId) {
      console.log(`⚠️  Skipping activity ${doc.id} - no pageId`);
      stats.skipped++;
      return;
    }
    
    if (!activitiesByPage.has(pageId)) {
      activitiesByPage.set(pageId, []);
    }
    
    activitiesByPage.get(pageId).push({ id: doc.id, data });
  });
  
  console.log(`📋 Activities grouped into ${activitiesByPage.size} pages`);
  console.log('');
  
  // Migrate each page's activities
  for (const [pageId, activities] of activitiesByPage) {
    try {
      console.log(`📄 Migrating page ${pageId} (${activities.length} activities)`);
      
      // Check if page exists
      const pageDoc = await db.collection(pagesCollection).doc(pageId).get();
      if (!pageDoc.exists) {
        console.log(`  ⚠️  Page ${pageId} not found, skipping activities`);
        stats.skipped += activities.length;
        continue;
      }
      
      // Sort activities by timestamp (oldest first for proper version chain)
      activities.sort((a, b) => {
        const timeA = new Date(a.data.timestamp || a.data.createdAt || 0);
        const timeB = new Date(b.data.timestamp || b.data.createdAt || 0);
        return timeA - timeB;
      });
      
      // Check if versions already exist for this page
      const versionsRef = db.collection(pagesCollection).doc(pageId).collection('versions');
      const existingVersions = await versionsRef.get();
      
      if (!existingVersions.empty) {
        console.log(`  ⚠️  Page ${pageId} already has ${existingVersions.size} versions, skipping`);
        stats.skipped += activities.length;
        continue;
      }
      
      if (!dryRun) {
        // Migrate activities to versions
        let previousVersionId = null;
        
        for (const activity of activities) {
          const versionData = convertActivityToVersion(activity.data, activity.id);
          versionData.previousVersionId = previousVersionId;

          const versionRef = await versionsRef.add(versionData);
          previousVersionId = versionRef.id;

          stats.migrated++;
          console.log(`  ✅ Migrated activity ${activity.id} → version ${versionRef.id}`);
        }
        
        stats.pagesMigrated.add(pageId);
      } else {
        console.log(`  🔍 DRY RUN: Would migrate ${activities.length} activities`);
        stats.migrated += activities.length;
      }
      
      stats.processed += activities.length;
      
    } catch (error) {
      console.error(`  ❌ Error migrating page ${pageId}:`, error.message);
      stats.errors += activities.length;
    }
  }
  
  // Print final stats
  console.log('');
  console.log('📊 Migration Complete!');
  console.log(`  Processed: ${stats.processed} activities`);
  console.log(`  Migrated: ${stats.migrated} activities`);
  console.log(`  Skipped: ${stats.skipped} activities`);
  console.log(`  Errors: ${stats.errors} activities`);
  console.log(`  Pages migrated: ${stats.pagesMigrated.size} pages`);
  
  if (dryRun) {
    console.log('');
    console.log('🔍 This was a DRY RUN - no data was actually migrated');
    console.log('Run without --dry-run to perform the actual migration');
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  migrateActivitiesToVersions({ dryRun, limit })
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateActivitiesToVersions };
