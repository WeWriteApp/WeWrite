import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync, COLLECTIONS } from '../../../utils/environmentConfig';

/**
 * Daily User Stats Snapshot Cron Job
 *
 * This endpoint captures daily snapshots of user statistics for sparkline visualizations.
 * Should be called once per day via Vercel Cron or external scheduler.
 *
 * Vercel Cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/user-stats-snapshot",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * Security: Protected by CRON_SECRET environment variable
 */

const BATCH_SIZE = 100; // Process users in batches

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret for security
  // Vercel automatically sets CRON_SECRET for cron jobs defined in vercel.json
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, require the secret (Vercel crons automatically include this)
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      console.error('[User Stats Snapshot Cron] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[User Stats Snapshot Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  console.log('[User Stats Snapshot Cron] Starting daily snapshot...');

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = formatDate(today);

    // Get collection names
    const usersCollection = await getCollectionNameAsync(COLLECTIONS.USERS);
    const pagesCollection = await getCollectionNameAsync(COLLECTIONS.PAGES);
    const allocationsCollection = await getCollectionNameAsync(COLLECTIONS.USD_ALLOCATIONS);
    const snapshotsCollection = await getCollectionNameAsync(COLLECTIONS.USER_STATS_SNAPSHOTS);

    // Get all users in batches
    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    while (true) {
      let query = db.collection(usersCollection)
        .orderBy('createdAt', 'desc')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const usersSnapshot = await query.get();

      if (usersSnapshot.empty) {
        break;
      }

      // Process batch of users
      const batch = db.batch();
      let batchWrites = 0;

      for (const userDoc of usersSnapshot.docs) {
        processedCount++;
        const userId = userDoc.id;
        const docId = `${userId}_${dateStr}`;

        try {
          // Check if snapshot already exists for today
          const existingSnapshot = await db.collection(snapshotsCollection).doc(docId).get();
          if (existingSnapshot.exists) {
            skippedCount++;
            continue;
          }

          // Get page count
          const pagesSnapshot = await db.collection(pagesCollection)
            .where('userId', '==', userId)
            .get();
          const pageCount = pagesSnapshot.docs.filter(doc => !doc.data().isDeleted).length;

          // Get sponsors count (unique users allocating to this user)
          const userAllocationsSnapshot = await db.collection(allocationsCollection)
            .where('recipientUserId', '==', userId)
            .where('isActive', '==', true)
            .get();

          const sponsorIds = new Set<string>();
          userAllocationsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.donorUserId && data.donorUserId !== userId) {
              sponsorIds.add(data.donorUserId);
            }
          });
          const sponsorsCount = sponsorIds.size;

          // Get sponsoring count
          const sponsoringSnapshot = await db.collection(allocationsCollection)
            .where('donorUserId', '==', userId)
            .where('isActive', '==', true)
            .count()
            .get();
          const sponsoringCount = sponsoringSnapshot.data().count;

          // Create snapshot document
          const snapshotRef = db.collection(snapshotsCollection).doc(docId);
          batch.set(snapshotRef, {
            userId,
            date: dateStr,
            timestamp: admin.firestore().Timestamp.fromDate(today),
            pageCount,
            sponsorsCount,
            sponsoringCount,
            createdAt: admin.firestore().FieldValue.serverTimestamp(),
          });

          batchWrites++;
          createdCount++;

        } catch (error) {
          console.error(`[User Stats Snapshot Cron] Error processing user ${userId}:`, error);
          errorCount++;
        }
      }

      // Commit batch
      if (batchWrites > 0) {
        await batch.commit();
        console.log(`[User Stats Snapshot Cron] Committed ${batchWrites} snapshots`);
      }

      lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;

    console.log(`[User Stats Snapshot Cron] Complete. Processed: ${processedCount}, Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}, Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      date: dateStr,
      stats: {
        usersProcessed: processedCount,
        snapshotsCreated: createdCount,
        snapshotsSkipped: skippedCount,
        errors: errorCount,
        durationMs: duration,
      }
    });

  } catch (error: any) {
    console.error('[User Stats Snapshot Cron] Fatal error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create user stats snapshots',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
