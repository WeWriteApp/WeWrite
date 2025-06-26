#!/usr/bin/env node

/**
 * WeWrite Comprehensive Database Backfill Script
 * 
 * This standalone Node.js script performs comprehensive data backfilling for the WeWrite application:
 * 1. Analytics data (global counters, daily/hourly aggregations)
 * 2. User activity calendars and streak data
 * 3. Notification backfilling for follows and links
 * 4. Data integrity checks and validation
 * 5. Missing field population across all collections
 * 
 * Usage:
 *   node scripts/comprehensive-backfill.js [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no data writes)
 *   --batch-size=N     Set batch size for processing (default: 100)
 *   --verbose          Enable verbose logging
 *   --analytics-only   Only run analytics backfill
 *   --activity-only    Only run activity calendar backfill
 *   --notifications-only Only run notifications backfill
 *   --integrity-only   Only run data integrity checks
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { config } from 'dotenv';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

// Load environment variables
config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator if specified
if (process.env.USE_FIREBASE_EMULATOR === 'true' && process.env.FIRESTORE_EMULATOR_HOST) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('🔧 Connected to Firestore emulator');
}

// Global configuration
const CONFIG = {
  dryRun: false,
  batchSize: 100,
  verbose: false,
  analyticsOnly: false,
  activityOnly: false,
  notificationsOnly: false,
  integrityOnly: false
};

// Global statistics
const STATS = {
  analytics: {
    pagesProcessed: 0,
    usersProcessed: 0,
    dailyAggregationsCreated: 0,
    hourlyAggregationsCreated: 0,
    globalCountersUpdated: false,
    errors: 0
  },
  activity: {
    usersProcessed: 0,
    pagesProcessed: 0,
    activityRecordsCreated: 0,
    streakRecordsUpdated: 0,
    errors: 0
  },
  notifications: {
    followNotificationsCreated: 0,
    linkNotificationsCreated: 0,
    usersProcessed: 0,
    pagesProcessed: 0,
    errors: 0
  },
  integrity: {
    pagesFixed: 0,
    usersFixed: 0,
    versionsFixed: 0,
    orphanedRecordsFound: 0,
    errors: 0
  }
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    if (arg === '--dry-run') {
      CONFIG.dryRun = true;
    } else if (arg === '--verbose') {
      CONFIG.verbose = true;
    } else if (arg === '--analytics-only') {
      CONFIG.analyticsOnly = true;
    } else if (arg === '--activity-only') {
      CONFIG.activityOnly = true;
    } else if (arg === '--notifications-only') {
      CONFIG.notificationsOnly = true;
    } else if (arg === '--integrity-only') {
      CONFIG.integrityOnly = true;
    } else if (arg.startsWith('--batch-size=')) {
      CONFIG.batchSize = parseInt(arg.split('=')[1]) || 100;
    } else if (arg === '--help') {
      console.log(`
WeWrite Comprehensive Database Backfill Script

Usage: node scripts/comprehensive-backfill.js [options]

Options:
  --dry-run              Run in dry-run mode (no data writes)
  --batch-size=N         Set batch size for processing (default: 100)
  --verbose              Enable verbose logging
  --analytics-only       Only run analytics backfill
  --activity-only        Only run activity calendar backfill
  --notifications-only   Only run notifications backfill
  --integrity-only       Only run data integrity checks
  --help                 Show this help message
      `);
      process.exit(0);
    }
  }
}

/**
 * Logging utilities
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = CONFIG.dryRun ? '[DRY-RUN] ' : '';
  
  switch (level) {
    case 'error':
      console.error(`${timestamp} ${prefix}❌ ${message}`);
      break;
    case 'warn':
      console.warn(`${timestamp} ${prefix}⚠️  ${message}`);
      break;
    case 'success':
      console.log(`${timestamp} ${prefix}✅ ${message}`);
      break;
    case 'info':
    default:
      console.log(`${timestamp} ${prefix}ℹ️  ${message}`);
      break;
  }
}

function verbose(message) {
  if (CONFIG.verbose) {
    log(message, 'info');
  }
}

/**
 * Error handling utilities
 */
function handleError(error, context, stats) {
  log(`Error in ${context}: ${error.message}`, 'error');
  if (CONFIG.verbose) {
    console.error(error.stack);
  }
  stats.errors++;
}

/**
 * Batch processing utility
 */
async function processBatch(items, processor, batchSize = CONFIG.batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  for (let i = 0; i < batches.length; i++) {
    verbose(`Processing batch ${i + 1}/${batches.length} (${batches[i].length} items)`);
    await processor(batches[i]);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    parseArguments();
    
    log('🚀 Starting WeWrite Comprehensive Database Backfill');
    log(`Configuration: ${JSON.stringify(CONFIG, null, 2)}`);
    
    if (CONFIG.dryRun) {
      log('🔍 DRY RUN MODE - No data will be written to the database', 'warn');
    }
    
    const startTime = Date.now();
    
    // Run backfill operations based on configuration
    if (!CONFIG.analyticsOnly && !CONFIG.activityOnly && !CONFIG.notificationsOnly && !CONFIG.integrityOnly) {
      // Run all operations
      await runDataIntegrityChecks();
      await runAnalyticsBackfill();
      await runActivityCalendarBackfill();
      await runNotificationsBackfill();
    } else {
      // Run specific operations
      if (CONFIG.integrityOnly) await runDataIntegrityChecks();
      if (CONFIG.analyticsOnly) await runAnalyticsBackfill();
      if (CONFIG.activityOnly) await runActivityCalendarBackfill();
      if (CONFIG.notificationsOnly) await runNotificationsBackfill();
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    log('🎉 Backfill completed successfully!', 'success');
    log(`Total execution time: ${duration} seconds`);
    log('📊 Final Statistics:');
    console.log(JSON.stringify(STATS, null, 2));
    
  } catch (error) {
    log(`Fatal error during backfill: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Data Integrity Checks and Fixes
 */
async function runDataIntegrityChecks() {
  log('🔍 Starting data integrity checks...');

  try {
    await checkAndFixPages();
    await checkAndFixUsers();
    await checkAndFixVersions();
    await checkOrphanedRecords();

    log(`✅ Data integrity checks completed. Fixed ${STATS.integrity.pagesFixed} pages, ${STATS.integrity.usersFixed} users, ${STATS.integrity.versionsFixed} versions`, 'success');
  } catch (error) {
    handleError(error, 'data integrity checks', STATS.integrity);
  }
}

/**
 * Check and fix pages collection
 */
async function checkAndFixPages() {
  log('📄 Checking pages collection...');

  const pagesRef = collection(db, 'pages');
  const pagesSnapshot = await getDocs(pagesRef);

  const batch = writeBatch(db);
  let batchCount = 0;

  for (const pageDoc of pagesSnapshot.docs) {
    const pageData = pageDoc.data();
    const pageId = pageDoc.id;
    const updates = {};

    // Ensure required fields exist
    if (pageData.deleted === undefined) {
      updates.deleted = false;
      verbose(`Setting deleted=false for page ${pageId}`);
    }

    if (!pageData.createdAt) {
      updates.createdAt = serverTimestamp();
      verbose(`Setting createdAt for page ${pageId}`);
    }

    if (!pageData.lastModified) {
      updates.lastModified = pageData.createdAt || serverTimestamp();
      verbose(`Setting lastModified for page ${pageId}`);
    }

    if (pageData.isPublic === undefined) {
      updates.isPublic = true;
      verbose(`Setting isPublic=true for page ${pageId}`);
    }

    if (!pageData.title) {
      updates.title = 'Untitled';
      verbose(`Setting default title for page ${pageId}`);
    }

    if (!pageData.username && pageData.userId) {
      // Try to get username from user document
      try {
        const userDoc = await getDoc(doc(db, 'users', pageData.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          updates.username = userData.username || userData.displayName || 'Anonymous';
          verbose(`Setting username for page ${pageId}`);
        }
      } catch (error) {
        verbose(`Could not fetch user data for page ${pageId}: ${error.message}`);
        updates.username = 'Anonymous';
      }
    }

    // Add fundraising fields if missing
    if (pageData.totalPledged === undefined) {
      updates.totalPledged = 0;
    }
    if (pageData.pledgeCount === undefined) {
      updates.pledgeCount = 0;
    }
    if (pageData.fundraisingEnabled === undefined) {
      updates.fundraisingEnabled = true;
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0 && !CONFIG.dryRun) {
      batch.update(doc(db, 'pages', pageId), updates);
      batchCount++;
      STATS.integrity.pagesFixed++;

      // Commit batch if it gets too large
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  // Commit remaining updates
  if (batchCount > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`📄 Pages check completed. Processed ${pagesSnapshot.size} pages`);
}

/**
 * Check and fix users collection
 */
async function checkAndFixUsers() {
  log('👤 Checking users collection...');

  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);

  const batch = writeBatch(db);
  let batchCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const updates = {};

    // Ensure required fields exist
    if (!userData.createdAt) {
      updates.createdAt = serverTimestamp();
      verbose(`Setting createdAt for user ${userId}`);
    }

    if (!userData.username && userData.displayName) {
      updates.username = userData.displayName;
      verbose(`Setting username from displayName for user ${userId}`);
    }

    if (userData.followerCount === undefined) {
      updates.followerCount = 0;
      verbose(`Setting followerCount=0 for user ${userId}`);
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0 && !CONFIG.dryRun) {
      batch.update(doc(db, 'users', userId), updates);
      batchCount++;
      STATS.integrity.usersFixed++;

      // Commit batch if it gets too large
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  // Commit remaining updates
  if (batchCount > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`👤 Users check completed. Processed ${usersSnapshot.size} users`);
}

/**
 * Check and fix page versions
 */
async function checkAndFixVersions() {
  log('📝 Checking page versions...');

  const pagesRef = collection(db, 'pages');
  const pagesSnapshot = await getDocs(pagesRef);

  for (const pageDoc of pagesSnapshot.docs) {
    const pageId = pageDoc.id;
    const versionsRef = collection(db, 'pages', pageId, 'versions');
    const versionsSnapshot = await getDocs(versionsRef);

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const versionDoc of versionsSnapshot.docs) {
      const versionData = versionDoc.data();
      const versionId = versionDoc.id;
      const updates = {};

      // Ensure required fields exist
      if (!versionData.createdAt) {
        updates.createdAt = serverTimestamp();
        verbose(`Setting createdAt for version ${versionId} in page ${pageId}`);
      }

      if (!versionData.userId) {
        const pageData = pageDoc.data();
        if (pageData.userId) {
          updates.userId = pageData.userId;
          verbose(`Setting userId for version ${versionId} in page ${pageId}`);
        }
      }

      if (!versionData.username && versionData.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', versionData.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            updates.username = userData.username || userData.displayName || 'Anonymous';
            verbose(`Setting username for version ${versionId} in page ${pageId}`);
          }
        } catch (error) {
          updates.username = 'Anonymous';
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0 && !CONFIG.dryRun) {
        batch.update(doc(db, 'pages', pageId, 'versions', versionId), updates);
        batchCount++;
        STATS.integrity.versionsFixed++;

        // Commit batch if it gets too large
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    // Commit remaining updates for this page
    if (batchCount > 0 && !CONFIG.dryRun) {
      await batch.commit();
    }
  }

  log(`📝 Versions check completed`);
}

/**
 * Check for orphaned records
 */
async function checkOrphanedRecords() {
  log('🔍 Checking for orphaned records...');

  // Check for page followers without corresponding pages
  const pageFollowersRef = collection(db, 'pageFollowers');
  const pageFollowersSnapshot = await getDocs(pageFollowersRef);

  for (const followerDoc of pageFollowersSnapshot.docs) {
    const followerData = followerDoc.data();
    const pageId = followerData.pageId;

    if (pageId) {
      const pageDoc = await getDoc(doc(db, 'pages', pageId));
      if (!pageDoc.exists()) {
        log(`Found orphaned page follower record for non-existent page: ${pageId}`, 'warn');
        STATS.integrity.orphanedRecordsFound++;

        // Optionally remove orphaned records
        if (!CONFIG.dryRun) {
          await followerDoc.ref.delete();
          verbose(`Removed orphaned page follower record for page ${pageId}`);
        }
      }
    }
  }

  log(`🔍 Orphaned records check completed. Found ${STATS.integrity.orphanedRecordsFound} orphaned records`);
}

/**
 * Analytics Backfill
 */
async function runAnalyticsBackfill() {
  log('📊 Starting analytics backfill...');

  try {
    await backfillGlobalCounters();
    await backfillDailyAggregations();
    await backfillHourlyAggregations();

    log(`✅ Analytics backfill completed. Processed ${STATS.analytics.pagesProcessed} pages, created ${STATS.analytics.dailyAggregationsCreated} daily and ${STATS.analytics.hourlyAggregationsCreated} hourly aggregations`, 'success');
  } catch (error) {
    handleError(error, 'analytics backfill', STATS.analytics);
  }
}

/**
 * Backfill global counters
 */
async function backfillGlobalCounters() {
  log('📈 Calculating global counters...');

  const pagesRef = collection(db, 'pages');
  const pagesSnapshot = await getDocs(pagesRef);

  let totalPagesEverCreated = 0;
  let totalActivePages = 0;
  let totalDeletedPages = 0;
  let totalPublicPages = 0;
  let totalPrivatePages = 0;

  pagesSnapshot.forEach(doc => {
    const data = doc.data();
    totalPagesEverCreated++;

    if (data.deleted === true) {
      totalDeletedPages++;
    } else {
      totalActivePages++;

      if (data.isPublic === true) {
        totalPublicPages++;
      } else {
        totalPrivatePages++;
      }
    }
  });

  const globalCounters = {
    totalPagesEverCreated,
    totalActivePages,
    totalDeletedPages,
    totalPublicPages,
    totalPrivatePages,
    lastUpdated: serverTimestamp()
  };

  if (!CONFIG.dryRun) {
    await setDoc(doc(db, 'analytics_counters', 'global'), globalCounters);
    STATS.analytics.globalCountersUpdated = true;
  }

  log(`📈 Global counters calculated: ${totalPagesEverCreated} total, ${totalActivePages} active, ${totalDeletedPages} deleted`);
}

/**
 * Backfill daily aggregations
 */
async function backfillDailyAggregations() {
  log('📅 Creating daily aggregations...');

  const pagesRef = collection(db, 'pages');
  const pagesQuery = query(pagesRef, orderBy('createdAt', 'asc'), limit(10000));
  const pagesSnapshot = await getDocs(pagesQuery);

  // Group pages by creation date
  const dailyData = new Map();

  pagesSnapshot.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt;
    const isPublic = data.isPublic === true;
    const isDeleted = data.deleted === true;

    if (createdAt) {
      let dateStr;
      if (createdAt instanceof Timestamp) {
        dateStr = createdAt.toDate().toISOString().split('T')[0];
      } else if (typeof createdAt === 'string') {
        dateStr = new Date(createdAt).toISOString().split('T')[0];
      } else {
        return; // Skip invalid dates
      }

      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, {
          pagesCreated: 0,
          pagesDeleted: 0,
          publicPagesCreated: 0,
          privatePagesCreated: 0
        });
      }

      const dayData = dailyData.get(dateStr);

      if (!isDeleted) {
        dayData.pagesCreated++;
        if (isPublic) {
          dayData.publicPagesCreated++;
        } else {
          dayData.privatePagesCreated++;
        }
      } else {
        dayData.pagesDeleted++;
      }
    }

    STATS.analytics.pagesProcessed++;
  });

  // Create daily aggregation documents
  const batch = writeBatch(db);
  let batchCount = 0;
  let cumulativeTotal = 0;
  let cumulativeActive = 0;

  // Sort dates to calculate cumulative values
  const sortedDates = Array.from(dailyData.keys()).sort();

  for (const dateStr of sortedDates) {
    const dayData = dailyData.get(dateStr);

    cumulativeTotal += dayData.pagesCreated;
    cumulativeActive += (dayData.pagesCreated - dayData.pagesDeleted);

    const aggregationData = {
      date: dateStr,
      pagesCreated: dayData.pagesCreated,
      pagesDeleted: dayData.pagesDeleted,
      publicPagesCreated: dayData.publicPagesCreated,
      privatePagesCreated: dayData.privatePagesCreated,
      netChange: dayData.pagesCreated - dayData.pagesDeleted,
      cumulativeTotal,
      cumulativeActive,
      lastUpdated: serverTimestamp()
    };

    if (!CONFIG.dryRun) {
      batch.set(doc(db, 'analytics_daily', dateStr), aggregationData);
      batchCount++;
      STATS.analytics.dailyAggregationsCreated++;

      // Commit batch if it gets too large
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  // Commit remaining aggregations
  if (batchCount > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`📅 Daily aggregations created for ${dailyData.size} days`);
}

/**
 * Backfill hourly aggregations for recent data
 */
async function backfillHourlyAggregations() {
  log('⏰ Creating hourly aggregations...');

  // Only backfill hourly data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pagesRef = collection(db, 'pages');
  const recentPagesQuery = query(
    pagesRef,
    orderBy('createdAt', 'asc'),
    limit(5000)
  );
  const recentPagesSnapshot = await getDocs(recentPagesQuery);

  // Group pages by creation hour
  const hourlyData = new Map();

  recentPagesSnapshot.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt;
    const isPublic = data.isPublic === true;
    const isDeleted = data.deleted === true;

    if (createdAt) {
      let date;
      if (createdAt instanceof Timestamp) {
        date = createdAt.toDate();
      } else if (typeof createdAt === 'string') {
        date = new Date(createdAt);
      } else {
        return; // Skip invalid dates
      }

      // Only process recent data
      if (date < thirtyDaysAgo) return;

      const hourStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;

      if (!hourlyData.has(hourStr)) {
        hourlyData.set(hourStr, {
          pagesCreated: 0,
          pagesDeleted: 0,
          publicPagesCreated: 0,
          privatePagesCreated: 0
        });
      }

      const hourData = hourlyData.get(hourStr);

      if (!isDeleted) {
        hourData.pagesCreated++;
        if (isPublic) {
          hourData.publicPagesCreated++;
        } else {
          hourData.privatePagesCreated++;
        }
      } else {
        hourData.pagesDeleted++;
      }
    }
  });

  // Create hourly aggregation documents
  const batch = writeBatch(db);
  let batchCount = 0;

  for (const [hourStr, hourData] of hourlyData.entries()) {
    const aggregationData = {
      datetime: hourStr,
      pagesCreated: hourData.pagesCreated,
      pagesDeleted: hourData.pagesDeleted,
      publicPagesCreated: hourData.publicPagesCreated,
      privatePagesCreated: hourData.privatePagesCreated,
      netChange: hourData.pagesCreated - hourData.pagesDeleted,
      lastUpdated: serverTimestamp()
    };

    if (!CONFIG.dryRun) {
      batch.set(doc(db, 'analytics_hourly', hourStr), aggregationData);
      batchCount++;
      STATS.analytics.hourlyAggregationsCreated++;

      // Commit batch if it gets too large
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  // Commit remaining aggregations
  if (batchCount > 0 && !CONFIG.dryRun) {
    await batch.commit();
  }

  log(`⏰ Hourly aggregations created for ${hourlyData.size} hours`);
}

/**
 * Activity Calendar Backfill
 */
async function runActivityCalendarBackfill() {
  log('📅 Starting activity calendar backfill...');

  try {
    const userActivityMap = new Map();

    // Get all pages to analyze versions
    const pagesRef = collection(db, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);

    log(`📄 Found ${pagesSnapshot.size} pages to process for activity data`);

    // Process all pages and their versions
    let processedPages = 0;
    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;
      const userId = pageData.userId;

      if (userId) {
        await processPageVersions(pageId, userId, userActivityMap);
        processedPages++;

        if (processedPages % 100 === 0) {
          verbose(`Processed ${processedPages}/${pagesSnapshot.size} pages...`);
        }
      }
    }

    STATS.activity.pagesProcessed = processedPages;

    log(`📅 Found activity for ${userActivityMap.size} users`);

    // Update activity calendar data for each user
    let processedUsers = 0;
    for (const [userId, activityDatesMap] of userActivityMap.entries()) {
      await updateUserActivityCalendar(userId, activityDatesMap);
      processedUsers++;

      if (processedUsers % 50 === 0) {
        verbose(`Updated activity calendar for ${processedUsers} users...`);
      }
    }

    STATS.activity.usersProcessed = processedUsers;

    log(`✅ Activity calendar backfill completed. Processed ${processedPages} pages and ${processedUsers} users`, 'success');
  } catch (error) {
    handleError(error, 'activity calendar backfill', STATS.activity);
  }
}

/**
 * Process page versions for activity tracking
 */
async function processPageVersions(pageId, userId, userActivityMap) {
  try {
    const versionsRef = collection(db, 'pages', pageId, 'versions');
    const versionsSnapshot = await getDocs(versionsRef);

    if (!userActivityMap.has(userId)) {
      userActivityMap.set(userId, new Map());
    }

    const userActivityDates = userActivityMap.get(userId);

    versionsSnapshot.forEach(versionDoc => {
      const versionData = versionDoc.data();
      const createdAt = versionData.createdAt;

      if (createdAt) {
        let date;
        if (createdAt instanceof Timestamp) {
          date = createdAt.toDate();
        } else if (typeof createdAt === 'string') {
          date = new Date(createdAt);
        } else {
          return; // Skip invalid dates
        }

        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

        if (userActivityDates.has(dateStr)) {
          userActivityDates.set(dateStr, userActivityDates.get(dateStr) + 1);
        } else {
          userActivityDates.set(dateStr, 1);
        }
      }
    });
  } catch (error) {
    verbose(`Error processing versions for page ${pageId}: ${error.message}`);
    STATS.activity.errors++;
  }
}

/**
 * Update activity calendar data for a user
 */
async function updateUserActivityCalendar(userId, activityDatesMap) {
  try {
    // Convert map to array of objects for activity calendar
    const activityData = Array.from(activityDatesMap.entries()).map(([date, count]) => ({
      date,
      count,
      level: 0 // Let the calendar component calculate levels
    }));

    // Sort by date
    activityData.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate streak data
    const { currentStreak, longestStreak, lastActiveDate, activityDates } = calculateStreakData(activityDatesMap);

    if (!CONFIG.dryRun) {
      // Update user's activity calendar data
      const activityCalendarRef = doc(db, 'userActivityCalendar', userId);
      const activityCalendarDoc = await getDoc(activityCalendarRef);

      if (activityCalendarDoc.exists()) {
        await updateDoc(activityCalendarRef, {
          activityData,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(activityCalendarRef, {
          userId,
          activityData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      STATS.activity.activityRecordsCreated++;

      // Update user's streak data
      const streakDocRef = doc(db, 'userStreaks', userId);
      const streakDoc = await getDoc(streakDocRef);

      // Convert activity dates to Timestamps
      const activityTimestamps = activityDates.map(dateStr =>
        Timestamp.fromDate(new Date(dateStr))
      );

      if (streakDoc.exists()) {
        await updateDoc(streakDocRef, {
          currentStreak,
          longestStreak,
          lastActiveDate: lastActiveDate ? Timestamp.fromDate(new Date(lastActiveDate)) : null,
          activityDates: activityTimestamps,
          totalDaysActive: activityDates.length,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(streakDocRef, {
          userId,
          currentStreak,
          longestStreak,
          lastActiveDate: lastActiveDate ? Timestamp.fromDate(new Date(lastActiveDate)) : null,
          activityDates: activityTimestamps,
          totalDaysActive: activityDates.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      STATS.activity.streakRecordsUpdated++;
    }
  } catch (error) {
    verbose(`Error updating activity calendar for user ${userId}: ${error.message}`);
    STATS.activity.errors++;
  }
}

/**
 * Calculate streak data from activity dates
 */
function calculateStreakData(activityDatesMap) {
  const activityDates = Array.from(activityDatesMap.keys()).sort();

  if (activityDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      activityDates: []
    };
  }

  const lastActiveDate = activityDates[activityDates.length - 1];

  // Calculate current streak (consecutive days ending with the most recent activity)
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Start from the most recent activity date
  if (lastActiveDate === today || lastActiveDate === yesterday) {
    currentStreak = 1;

    // Count backwards for consecutive days
    for (let i = activityDates.length - 2; i >= 0; i--) {
      const currentDate = new Date(activityDates[i + 1]);
      const previousDate = new Date(activityDates[i]);
      const dayDifference = Math.floor((currentDate - previousDate) / (24 * 60 * 60 * 1000));

      if (dayDifference === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < activityDates.length; i++) {
    const currentDate = new Date(activityDates[i]);
    const previousDate = new Date(activityDates[i - 1]);
    const dayDifference = Math.floor((currentDate - previousDate) / (24 * 60 * 60 * 1000));

    if (dayDifference === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
    activityDates
  };
}

/**
 * Notifications Backfill
 */
async function runNotificationsBackfill() {
  log('🔔 Starting notifications backfill...');

  try {
    await backfillFollowNotifications();
    await backfillLinkNotifications();

    log(`✅ Notifications backfill completed. Created ${STATS.notifications.followNotificationsCreated} follow notifications and ${STATS.notifications.linkNotificationsCreated} link notifications`, 'success');
  } catch (error) {
    handleError(error, 'notifications backfill', STATS.notifications);
  }
}

/**
 * Backfill notifications for page follows
 */
async function backfillFollowNotifications() {
  log('👥 Backfilling follow notifications...');

  try {
    const pageFollowersRef = collection(db, 'pageFollowers');
    const pageFollowersSnapshot = await getDocs(pageFollowersRef);

    log(`Processing ${pageFollowersSnapshot.size} page follower records...`);

    for (const followerDoc of pageFollowersSnapshot.docs) {
      const followData = followerDoc.data();
      const { pageId, followerId, pageOwnerId, pageTitle } = followData;

      if (!pageId || !followerId || !pageOwnerId) {
        verbose(`Skipping incomplete follow record: ${followerDoc.id}`);
        continue;
      }

      try {
        // Check if a notification already exists
        const notificationsRef = collection(db, 'users', pageOwnerId, 'notifications');
        const notificationsQuery = query(
          notificationsRef,
          where('type', '==', 'follow'),
          where('sourceUserId', '==', followerId),
          where('targetPageId', '==', pageId)
        );

        const existingNotifications = await getDocs(notificationsQuery);

        // Skip if notification already exists
        if (!existingNotifications.empty) continue;

        if (!CONFIG.dryRun) {
          // Create the notification
          const notificationRef = doc(notificationsRef);
          await setDoc(notificationRef, {
            type: 'follow',
            sourceUserId: followerId,
            targetPageId: pageId,
            targetPageTitle: pageTitle,
            read: true, // Mark as read since it's a backfilled notification
            createdAt: followData.followedAt || serverTimestamp()
          });
        }

        STATS.notifications.followNotificationsCreated++;
      } catch (error) {
        verbose(`Error processing follow record: ${error.message}`);
        STATS.notifications.errors++;
      }
    }

    log(`Created ${STATS.notifications.followNotificationsCreated} follow notifications`);
  } catch (error) {
    handleError(error, 'follow notifications backfill', STATS.notifications);
  }
}

/**
 * Backfill notifications for page links
 */
async function backfillLinkNotifications() {
  log('🔗 Backfilling link notifications...');

  try {
    const pagesRef = collection(db, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);

    log(`Processing ${pagesSnapshot.size} pages for links...`);

    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;
      const { linkedPageIds, userId: linkingUserId, title: linkingPageTitle } = pageData;

      if (!linkedPageIds || !Array.isArray(linkedPageIds) || linkedPageIds.length === 0) {
        continue;
      }

      STATS.notifications.pagesProcessed++;

      // Process each linked page
      for (const linkedPageId of linkedPageIds) {
        try {
          // Get the linked page to find its owner
          const linkedPageDoc = await getDoc(doc(db, 'pages', linkedPageId));

          if (!linkedPageDoc.exists()) {
            verbose(`Linked page ${linkedPageId} does not exist`);
            continue;
          }

          const linkedPageData = linkedPageDoc.data();
          const linkedPageOwnerId = linkedPageData.userId;

          // Don't create notification if user is linking to their own page
          if (linkedPageOwnerId === linkingUserId) {
            continue;
          }

          // Check if a notification already exists
          const notificationsRef = collection(db, 'users', linkedPageOwnerId, 'notifications');
          const notificationsQuery = query(
            notificationsRef,
            where('type', '==', 'link'),
            where('sourceUserId', '==', linkingUserId),
            where('sourcePageId', '==', pageId),
            where('targetPageId', '==', linkedPageId)
          );

          const existingNotifications = await getDocs(notificationsQuery);

          // Skip if notification already exists
          if (!existingNotifications.empty) continue;

          if (!CONFIG.dryRun) {
            // Create the notification
            const notificationRef = doc(notificationsRef);
            await setDoc(notificationRef, {
              type: 'link',
              sourceUserId: linkingUserId,
              sourcePageId: pageId,
              sourcePageTitle: linkingPageTitle,
              targetPageId: linkedPageId,
              targetPageTitle: linkedPageData.title,
              read: true, // Mark as read since it's a backfilled notification
              createdAt: pageData.lastModified || pageData.createdAt || serverTimestamp()
            });
          }

          STATS.notifications.linkNotificationsCreated++;
        } catch (error) {
          verbose(`Error processing link to page ${linkedPageId}: ${error.message}`);
          STATS.notifications.errors++;
        }
      }
    }

    log(`Created ${STATS.notifications.linkNotificationsCreated} link notifications`);
  } catch (error) {
    handleError(error, 'link notifications backfill', STATS.notifications);
  }
}

// Export functions for testing
export {
  main,
  runDataIntegrityChecks,
  runAnalyticsBackfill,
  runActivityCalendarBackfill,
  runNotificationsBackfill
};

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('comprehensive-backfill.js')) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
