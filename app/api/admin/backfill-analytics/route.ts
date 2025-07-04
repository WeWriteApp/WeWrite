import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { Timestamp } from 'firebase-admin/firestore';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();

interface BackfillResult {
  success: boolean;
  message: string;
  stats: {
    globalCountersUpdated: boolean;
    dailyAggregationsCreated: number;
    hourlyAggregationsCreated: number;
    analyticsEventsProcessed: number;
  };
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { dryRun = false, batchSize = 50 } = body;

    console.log(`🚀 Starting analytics backfill (dryRun: ${dryRun}, batchSize: ${batchSize})`);

    const result: BackfillResult = {
      success: true,
      message: dryRun ? 'Dry run completed successfully' : 'Backfill completed successfully',
      stats: {
        globalCountersUpdated: false,
        dailyAggregationsCreated: 0,
        hourlyAggregationsCreated: 0,
        analyticsEventsProcessed: 0
      },
      errors: []
    };

    // 1. Check and update global counters
    try {
      console.log('📊 Checking global counters...');
      const globalCountersRef = adminDb.collection('analytics_counters').doc('global');
      const globalCountersDoc = await globalCountersRef.get();

      if (!globalCountersDoc.exists) {
        console.log('🔧 Global counters missing, calculating from existing data...');
        
        // Count total pages
        const pagesSnapshot = await adminDb.collection('pages').get();
        const totalPages = pagesSnapshot.size;
        const activePages = pagesSnapshot.docs.filter(doc => !doc.data().deleted).length;
        const deletedPages = totalPages - activePages;
        const publicPages = pagesSnapshot.docs.filter(doc => doc.data().isPublic && !doc.data().deleted).length;
        const privatePages = activePages - publicPages;

        if (!dryRun) {
          await globalCountersRef.set({
            totalPagesEverCreated: totalPages,
            totalActivePages: activePages,
            totalDeletedPages: deletedPages,
            totalPublicPages: publicPages,
            totalPrivatePages: privatePages,
            lastUpdated: Timestamp.now()
          });
        }

        result.stats.globalCountersUpdated = true;
        console.log(`✅ Global counters ${dryRun ? 'would be' : ''} updated: ${totalPages} total pages`);
      } else {
        console.log('✅ Global counters already exist');
      }
    } catch (error) {
      const errorMsg = `Error updating global counters: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    // 2. Check and create missing daily aggregations
    try {
      console.log('📅 Checking daily aggregations...');
      
      // Get date range for the last 90 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const dailyAggregationsRef = adminDb.collection('analytics_daily');
      
      // Check which days are missing
      const existingDailyDocs = await dailyAggregationsRef
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .where('date', '<=', endDate.toISOString().split('T')[0])
        .get();

      const existingDates = new Set(existingDailyDocs.docs.map(doc => doc.data().date));
      
      // Generate missing dates
      const missingDates: string[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!existingDates.has(dateStr)) {
          missingDates.push(dateStr);
        }
      }

      console.log(`📊 Found ${missingDates.length} missing daily aggregations`);

      if (missingDates.length > 0 && !dryRun) {
        // Create missing daily aggregations with zero values
        const batch = adminDb.batch();
        let batchCount = 0;

        for (const dateStr of missingDates.slice(0, batchSize)) {
          const docRef = dailyAggregationsRef.doc(dateStr);
          batch.set(docRef, {
            date: dateStr,
            pagesCreated: 0,
            pagesDeleted: 0,
            publicPagesCreated: 0,
            privatePagesCreated: 0,
            netChange: 0,
            cumulativeActive: 0,
            cumulativeTotal: 0,
            lastUpdated: Timestamp.now()
          });
          
          batchCount++;
          if (batchCount >= 500) { // Firestore batch limit
            await batch.commit();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      result.stats.dailyAggregationsCreated = dryRun ? missingDates.length : Math.min(missingDates.length, batchSize);
      console.log(`✅ ${result.stats.dailyAggregationsCreated} daily aggregations ${dryRun ? 'would be' : ''} created`);
    } catch (error) {
      const errorMsg = `Error creating daily aggregations: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    // 3. Check analytics_events collection for data gaps
    try {
      console.log('🔍 Analyzing analytics_events collection...');

      const analyticsEventsRef = adminDb.collection('analytics_events');
      const recentEventsSnapshot = await analyticsEventsRef
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      result.stats.analyticsEventsProcessed = recentEventsSnapshot.size;
      console.log(`📊 Found ${recentEventsSnapshot.size} recent analytics events`);

      // Check for missing event types
      const eventTypes = new Set();
      recentEventsSnapshot.docs.forEach(doc => {
        const eventType = doc.data().eventType;
        if (eventType) {
          eventTypes.add(eventType);
        }
      });

      console.log(`📋 Event types found: ${Array.from(eventTypes).join(', ')}`);

      const expectedEventTypes = ['content_change', 'pwa_install', 'app_installed', 'share', 'edit'];
      const missingEventTypes = expectedEventTypes.filter(type => !eventTypes.has(type));

      if (missingEventTypes.length > 0) {
        console.log(`⚠️  Missing event types: ${missingEventTypes.join(', ')}`);
        result.errors.push(`Missing event types: ${missingEventTypes.join(', ')}`);
      }
    } catch (error) {
      const errorMsg = `Error analyzing analytics events: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    // 4. Check for missing user analytics data
    try {
      console.log('👥 Checking user analytics data...');

      const usersSnapshot = await adminDb.collection('users').limit(10).get();
      const totalUsers = usersSnapshot.size;

      console.log(`📊 Found ${totalUsers} users in sample`);

      // Check if users have creation dates
      let usersWithoutCreatedAt = 0;
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (!userData.createdAt) {
          usersWithoutCreatedAt++;
        }
      });

      if (usersWithoutCreatedAt > 0) {
        result.errors.push(`${usersWithoutCreatedAt} users missing createdAt field`);
      }
    } catch (error) {
      const errorMsg = `Error checking user analytics: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    console.log(`✅ Analytics backfill ${dryRun ? 'dry run' : ''} completed`);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Analytics backfill failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Analytics backfill failed',
      details: error.message
    }, { status: 500 });
  }
}
