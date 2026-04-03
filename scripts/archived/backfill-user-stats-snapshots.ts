/**
 * Backfill script to generate 60 days of historical stats snapshots for all users
 *
 * This populates the userStatsSnapshots collection with historical data to enable
 * sparkline visualizations on user profile pages.
 *
 * Document structure:
 *   Collection: userStatsSnapshots (or DEV_userStatsSnapshots)
 *   Document ID: {userId}_{YYYY-MM-DD}
 *   Fields:
 *     - userId: string
 *     - date: string (YYYY-MM-DD)
 *     - timestamp: Firestore Timestamp
 *     - pageCount: number
 *     - sponsorsCount: number
 *     - sponsoringCount: number
 *
 * Usage:
 *   npx tsx scripts/backfill-user-stats-snapshots.ts [--dry-run] [--env=prod] [--days=60]
 *
 * Options:
 *   --dry-run    Preview changes without modifying the database
 *   --env=prod   Force production environment
 *   --days=N     Number of days to backfill (default: 60)
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceProduction = args.includes('--env=prod');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg.split('=')[1], 10) : 60;

// Determine environment and collection names
const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
const collectionPrefix = isProduction ? '' : 'DEV_';

const COLLECTIONS = {
  USERS: `${collectionPrefix}users`,
  PAGES: `${collectionPrefix}pages`,
  USD_ALLOCATIONS: `${collectionPrefix}usdAllocations`,
  USER_STATS_SNAPSHOTS: `${collectionPrefix}userStatsSnapshots`,
};

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(keyJson);
    }

    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id
    });
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS');
}

interface UserData {
  uid: string;
  createdAt?: admin.firestore.Timestamp;
}

interface BackfillStats {
  usersProcessed: number;
  snapshotsCreated: number;
  snapshotsSkipped: number;
  errors: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateNDaysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function getUserStats(
  db: admin.firestore.Firestore,
  userId: string,
  asOfDate: Date
): Promise<{ pageCount: number; sponsorsCount: number; sponsoringCount: number }> {
  // Get page count as of date (pages created before this date, not deleted)
  const pagesSnapshot = await db.collection(COLLECTIONS.PAGES)
    .where('userId', '==', userId)
    .get();

  const pageCount = pagesSnapshot.docs.filter(doc => {
    const data = doc.data();
    if (data.isDeleted) return false;
    const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
    return createdAt <= asOfDate;
  }).length;

  // Get sponsors count (unique users allocating to this user as of date)
  const userAllocationsSnapshot = await db.collection(COLLECTIONS.USD_ALLOCATIONS)
    .where('recipientUserId', '==', userId)
    .where('status', '==', 'active')
    .get();

  const sponsorIds = new Set<string>();
  userAllocationsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || 0);
    // userId is the donor (the person allocating funds)
    if (data.userId && data.userId !== userId && createdAt <= asOfDate) {
      sponsorIds.add(data.userId);
    }
  });
  const sponsorsCount = sponsorIds.size;

  // Get sponsoring count (allocations this user has made as of date)
  const sponsoringSnapshot = await db.collection(COLLECTIONS.USD_ALLOCATIONS)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  const sponsoringCount = sponsoringSnapshot.docs.filter(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || 0);
    return createdAt <= asOfDate;
  }).length;

  return { pageCount, sponsorsCount, sponsoringCount };
}

async function backfillUserStatsSnapshots(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    usersProcessed: 0,
    snapshotsCreated: 0,
    snapshotsSkipped: 0,
    errors: 0,
  };

  const app = initFirebase();
  const db = app.firestore();

  console.log(`\n🔄 Starting user stats snapshots backfill`);
  console.log(`   Collections: ${Object.values(COLLECTIONS).join(', ')}`);
  console.log(`   Days to backfill: ${DAYS_TO_BACKFILL}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

  try {
    // Get all users
    console.log('📋 Fetching all users...');
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).get();
    const users = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      createdAt: doc.data().createdAt
    })) as UserData[];

    console.log(`   Found ${users.length} users\n`);

    // Process each user
    for (const user of users) {
      stats.usersProcessed++;
      console.log(`\n👤 Processing user ${stats.usersProcessed}/${users.length}: ${user.uid}`);

      const userCreatedAt = user.createdAt?.toDate?.() || new Date(0);

      // Generate snapshots for each day
      for (let daysAgo = DAYS_TO_BACKFILL; daysAgo >= 0; daysAgo--) {
        const snapshotDate = getDateNDaysAgo(daysAgo);
        const dateStr = formatDate(snapshotDate);
        const docId = `${user.uid}_${dateStr}`;

        // Skip if snapshot date is before user creation
        if (snapshotDate < userCreatedAt) {
          stats.snapshotsSkipped++;
          continue;
        }

        // Check if snapshot already exists
        const existingDoc = await db.collection(COLLECTIONS.USER_STATS_SNAPSHOTS).doc(docId).get();
        if (existingDoc.exists) {
          stats.snapshotsSkipped++;
          continue;
        }

        try {
          // Get stats as of this date
          const userStats = await getUserStats(db, user.uid, snapshotDate);

          const snapshotData = {
            userId: user.uid,
            date: dateStr,
            timestamp: admin.firestore.Timestamp.fromDate(snapshotDate),
            pageCount: userStats.pageCount,
            sponsorsCount: userStats.sponsorsCount,
            sponsoringCount: userStats.sponsoringCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (!dryRun) {
            await db.collection(COLLECTIONS.USER_STATS_SNAPSHOTS).doc(docId).set(snapshotData);
          }

          stats.snapshotsCreated++;

          // Log progress every 10 snapshots
          if (stats.snapshotsCreated % 10 === 0) {
            console.log(`   📊 Created ${stats.snapshotsCreated} snapshots so far...`);
          }
        } catch (error) {
          console.error(`   ❌ Error creating snapshot for ${docId}:`, error);
          stats.errors++;
        }
      }

      // Small delay between users to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('     BACKFILL: Creating User Stats Snapshots for Sparklines');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Days to backfill: ${DAYS_TO_BACKFILL}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const startTime = Date.now();
  const stats = await backfillUserStatsSnapshots();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('                          RESULTS');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`   Users processed:      ${stats.usersProcessed}`);
  console.log(`   Snapshots created:    ${stats.snapshotsCreated}`);
  console.log(`   Snapshots skipped:    ${stats.snapshotsSkipped}`);
  console.log(`   Errors:               ${stats.errors}`);
  console.log(`   Duration:             ${duration}s`);
  console.log('════════════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
