/**
 * API endpoint to verify hourly aggregations pipeline
 * Admin-only endpoint to check if hourly analytics data is being properly collected
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, limit, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';
import { checkAdminPermissions } from '../../admin-auth-helper';

export async function GET(request: NextRequest) {
  try {
    // Check admin access using session cookie (avoids jose issues)
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin verification: Checking hourly aggregations pipeline...');

    // Check analytics_hourly collection
    const hourlyQuery = query(
      collection(db, getCollectionName('analytics_hourly')),
      orderBy('datetime', 'desc'),
      limit(24) // Last 24 hours
    );
    const hourlySnapshot = await getDocs(hourlyQuery);
    
    let sampleHourlyData = null;
    const hourlyData = [];
    
    if (hourlySnapshot.size > 0) {
      hourlySnapshot.docs.forEach(doc => {
        const data = doc.data();
        hourlyData.push({
          datetime: data.datetime,
          pagesCreated: data.pagesCreated || 0,
          pagesDeleted: data.pagesDeleted || 0,
          publicPagesCreated: data.publicPagesCreated || 0,
          privatePagesCreated: data.privatePagesCreated || 0,
          netChange: data.netChange || 0,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
        });
      });
      
      sampleHourlyData = hourlyData[0];
    }

    // Check analytics_daily collection
    const dailyQuery = query(
      collection(db, getCollectionName('analytics_daily')),
      orderBy('date', 'desc'),
      limit(7) // Last 7 days
    );
    const dailySnapshot = await getDocs(dailyQuery);
    
    let sampleDailyData = null;
    const dailyData = [];
    
    if (dailySnapshot.size > 0) {
      dailySnapshot.docs.forEach(doc => {
        const data = doc.data();
        dailyData.push({
          date: data.date,
          pagesCreated: data.pagesCreated || 0,
          pagesDeleted: data.pagesDeleted || 0,
          publicPagesCreated: data.publicPagesCreated || 0,
          privatePagesCreated: data.privatePagesCreated || 0,
          netChange: data.netChange || 0,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
        });
      });
      
      sampleDailyData = dailyData[0];
    }

    // Check analytics_counters collection
    const countersQuery = query(
      collection(db, getCollectionName('analytics_counters')),
      limit(10)
    );
    const countersSnapshot = await getDocs(countersQuery);
    
    let globalCounters = null;
    if (countersSnapshot.size > 0) {
      const globalDoc = countersSnapshot.docs.find(doc => doc.id === 'global');
      if (globalDoc) {
        const data = globalDoc.data();
        globalCounters = {
          totalPagesEverCreated: data.totalPagesEverCreated || 0,
          totalActivePages: data.totalActivePages || 0,
          totalDeletedPages: data.totalDeletedPages || 0,
          totalPublicPages: data.totalPublicPages || 0,
          totalPrivatePages: data.totalPrivatePages || 0,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
        };
      }
    }

    // Calculate summary statistics
    const totalHourlyActivity = hourlyData.reduce((sum, item) => sum + (item.pagesCreated || 0) + (item.pagesDeleted || 0), 0);
    const totalDailyActivity = dailyData.reduce((sum, item) => sum + (item.pagesCreated || 0) + (item.pagesDeleted || 0), 0);

    // Check for recent activity (last 24 hours)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const currentHour = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}`;
    
    const hasRecentHourlyData = hourlyData.some(item => {
      const itemDate = new Date(item.datetime + ':00:00');
      return itemDate >= twentyFourHoursAgo;
    });

    const result = {
      hourlyAggregations: {
        count: hourlySnapshot.size,
        sample: sampleHourlyData,
        recentData: hourlyData.slice(0, 5), // Last 5 hours
        totalActivity: totalHourlyActivity,
        hasRecentActivity: hasRecentHourlyData
      },
      dailyAggregations: {
        count: dailySnapshot.size,
        sample: sampleDailyData,
        recentData: dailyData.slice(0, 3), // Last 3 days
        totalActivity: totalDailyActivity
      },
      globalCounters: {
        available: !!globalCounters,
        data: globalCounters
      },
      systemHealth: {
        hourlyPipelineActive: hasRecentHourlyData,
        dataIntegrity: hourlySnapshot.size > 0 && dailySnapshot.size > 0,
        currentHour,
        lastHourlyUpdate: sampleHourlyData?.lastUpdated || null
      },
      status: hasRecentHourlyData ? 'healthy' : 'warning',
      timestamp: new Date().toISOString()
    };

    console.log('✅ Hourly aggregations verification complete:', {
      hourlyCount: hourlySnapshot.size,
      dailyCount: dailySnapshot.size,
      hasRecentActivity: hasRecentHourlyData,
      status: result.status
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error verifying hourly aggregations:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify hourly aggregations'
    }, { status: 500 });
  }
}
