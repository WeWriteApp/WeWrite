/**
 * Analytics Historical Data Backfill Script
 * 
 * This script backfills missing historical analytics data by:
 * 1. Calculating daily/hourly aggregations from existing page data
 * 2. Updating global counters with accurate totals
 * 3. Ensuring all existing pages and users are properly counted
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

/**
 * Main backfill function
 */
export async function backfillAnalytics(db, options = {}) {
  const {
    dryRun = false,
    logProgress = true,
    batchSize = 100
  } = options;

  if (logProgress) {
    console.log('🚀 Starting analytics backfill...');
    if (dryRun) console.log('🔍 DRY RUN MODE - No data will be written');
  }

  const stats = {
    pagesProcessed: 0,
    usersProcessed: 0,
    dailyAggregationsCreated: 0,
    hourlyAggregationsCreated: 0,
    globalCountersUpdated: false,
    errors: 0
  };

  try {
    // Step 1: Backfill global counters
    if (logProgress) console.log('📊 Step 1: Calculating global counters...');
    await backfillGlobalCounters(db, stats, dryRun, logProgress);

    // Step 2: Backfill daily aggregations
    if (logProgress) console.log('📅 Step 2: Creating daily aggregations...');
    await backfillDailyAggregations(db, stats, dryRun, logProgress, batchSize);

    // Step 3: Backfill hourly aggregations for recent data
    if (logProgress) console.log('⏰ Step 3: Creating hourly aggregations...');
    await backfillHourlyAggregations(db, stats, dryRun, logProgress, batchSize);

    if (logProgress) {
      console.log('✅ Analytics backfill completed successfully!');
      console.log('📈 Final statistics:', stats);
    }

    return { success: true, stats };

  } catch (error) {
    console.error('❌ Error during analytics backfill:', error);
    stats.errors++;
    return { success: false, error: error.message, stats };
  }
}

/**
 * Backfill global counters by counting existing pages
 */
async function backfillGlobalCounters(db, stats, dryRun, logProgress) {
  try {
    // Get all pages to calculate accurate counts
    const pagesRef = collection(db, 'pages');
    const pagesQuery = query(pagesRef, limit(10000)); // Limit to prevent memory issues
    const pagesSnapshot = await getDocs(pagesQuery);

    let totalPagesEverCreated = 0;
    let totalActivePages = 0;
    let totalDeletedPages = 0;
    let totalPublicPages = 0;
    let totalPrivatePages = 0;

    pagesSnapshot.forEach(doc => {
      const data = doc.data();
      const isDeleted = data.deleted === true;
      const isPublic = data.isPublic === true;

      totalPagesEverCreated++;
      
      if (isDeleted) {
        totalDeletedPages++;
      } else {
        totalActivePages++;
        if (isPublic) {
          totalPublicPages++;
        } else {
          totalPrivatePages++;
        }
      }

      stats.pagesProcessed++;
    });

    if (logProgress) {
      console.log(`📊 Calculated global counters:
        - Total pages ever created: ${totalPagesEverCreated}
        - Total active pages: ${totalActivePages}
        - Total deleted pages: ${totalDeletedPages}
        - Total public pages: ${totalPublicPages}
        - Total private pages: ${totalPrivatePages}`);
    }

    if (!dryRun) {
      const globalCountersRef = doc(db, 'analytics_counters', 'global');
      await setDoc(globalCountersRef, {
        totalPagesEverCreated,
        totalActivePages,
        totalDeletedPages,
        totalPublicPages,
        totalPrivatePages,
        lastUpdated: Timestamp.now()
      });

      if (logProgress) console.log('✅ Global counters updated');
    }

    stats.globalCountersUpdated = true;

  } catch (error) {
    console.error('Error backfilling global counters:', error);
    throw error;
  }
}

/**
 * Backfill daily aggregations from page creation/deletion data
 */
async function backfillDailyAggregations(db, stats, dryRun, logProgress, batchSize) {
  try {
    // Get all pages with creation dates
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
        let date;
        if (createdAt instanceof Timestamp) {
          date = createdAt.toDate();
        } else if (typeof createdAt === 'string') {
          date = new Date(createdAt);
        } else {
          return; // Skip invalid dates
        }

        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, {
            date: dateKey,
            pagesCreated: 0,
            pagesDeleted: 0,
            publicPagesCreated: 0,
            privatePagesCreated: 0,
            netChange: 0,
            lastUpdated: Timestamp.now()
          });
        }

        const dayData = dailyData.get(dateKey);
        dayData.pagesCreated++;
        
        if (isPublic) {
          dayData.publicPagesCreated++;
        } else {
          dayData.privatePagesCreated++;
        }

        // Note: We can't accurately backfill deletion dates without deletedAt timestamps
        // This would need to be enhanced if deletion tracking is needed
        if (!isDeleted) {
          dayData.netChange++;
        }

        dailyData.set(dateKey, dayData);
      }
    });

    if (logProgress) {
      console.log(`📅 Found ${dailyData.size} days with page creation activity`);
    }

    // Write daily aggregations in batches
    if (!dryRun) {
      const entries = Array.from(dailyData.entries());
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchEntries = entries.slice(i, i + batchSize);

        batchEntries.forEach(([dateKey, dayData]) => {
          const dailyRef = doc(db, 'analytics_daily', dateKey);
          batch.set(dailyRef, dayData);
        });

        await batch.commit();
        stats.dailyAggregationsCreated += batchEntries.length;

        if (logProgress && i % (batchSize * 5) === 0) {
          console.log(`📅 Created ${stats.dailyAggregationsCreated} daily aggregations...`);
        }
      }

      if (logProgress) {
        console.log(`✅ Created ${stats.dailyAggregationsCreated} daily aggregations`);
      }
    } else {
      stats.dailyAggregationsCreated = dailyData.size;
    }

  } catch (error) {
    console.error('Error backfilling daily aggregations:', error);
    throw error;
  }
}

/**
 * Backfill hourly aggregations for the last 30 days
 */
async function backfillHourlyAggregations(db, stats, dryRun, logProgress, batchSize) {
  try {
    // Only backfill hourly data for the last 30 days to avoid excessive data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get pages created in the last 30 days
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

        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getHours().toString().padStart(2, '0');
        const hourKey = `${dateStr}-${hour}`;

        if (!hourlyData.has(hourKey)) {
          hourlyData.set(hourKey, {
            datetime: hourKey,
            pagesCreated: 0,
            pagesDeleted: 0,
            publicPagesCreated: 0,
            privatePagesCreated: 0,
            netChange: 0,
            lastUpdated: Timestamp.now()
          });
        }

        const hourData = hourlyData.get(hourKey);
        hourData.pagesCreated++;
        hourData.netChange++;
        
        if (isPublic) {
          hourData.publicPagesCreated++;
        } else {
          hourData.privatePagesCreated++;
        }

        hourlyData.set(hourKey, hourData);
      }
    });

    if (logProgress) {
      console.log(`⏰ Found ${hourlyData.size} hours with page creation activity (last 30 days)`);
    }

    // Write hourly aggregations in batches
    if (!dryRun) {
      const entries = Array.from(hourlyData.entries());
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchEntries = entries.slice(i, i + batchSize);

        batchEntries.forEach(([hourKey, hourData]) => {
          const hourlyRef = doc(db, 'analytics_hourly', hourKey);
          batch.set(hourlyRef, hourData);
        });

        await batch.commit();
        stats.hourlyAggregationsCreated += batchEntries.length;

        if (logProgress && i % (batchSize * 2) === 0) {
          console.log(`⏰ Created ${stats.hourlyAggregationsCreated} hourly aggregations...`);
        }
      }

      if (logProgress) {
        console.log(`✅ Created ${stats.hourlyAggregationsCreated} hourly aggregations`);
      }
    } else {
      stats.hourlyAggregationsCreated = hourlyData.size;
    }

  } catch (error) {
    console.error('Error backfilling hourly aggregations:', error);
    throw error;
  }
}
