/**
 * Admin API: Transaction Volume Data
 * Provides hourly transaction volume data for monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // Check admin permissions
      const authResult = await checkAdminPermissions(request);
      if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: 401 });
      }

    // Get last 24 hours of transaction data
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get transactions from the last 24 hours
    const transactionsSnapshot = await adminDb.collection(getCollectionName(COLLECTIONS.FINANCIAL_TRANSACTIONS))
      .where('createdAt', '>=', last24Hours)
      .orderBy('createdAt', 'asc')
      .get();

    // Group transactions by hour
    const hourlyData: { [hour: string]: { successful: number; failed: number; pending: number } } = {};

    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      const createdAt = transaction.createdAt?.toDate() || new Date(transaction.createdAt);
      
      // Round down to the hour
      const hour = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), createdAt.getHours());
      const hourKey = hour.toISOString();

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = { successful: 0, failed: 0, pending: 0 };
      }

      switch (transaction.status) {
        case 'COMPLETED':
          hourlyData[hourKey].successful++;
          break;
        case 'FAILED':
          hourlyData[hourKey].failed++;
          break;
        case 'PENDING':
        case 'PROCESSING':
          hourlyData[hourKey].pending++;
          break;
      }
    });

    // Convert to array format for the frontend
    const volumeData = Object.entries(hourlyData)
      .map(([hourKey, data]) => ({
        timestamp: new Date(hourKey),
        successful: data.successful,
        failed: data.failed,
        pending: data.pending
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Fill in missing hours with zero data
    const completeVolumeData = [];
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      hour.setMinutes(0, 0, 0);
      
      const existingData = volumeData.find(d => 
        d.timestamp.getTime() === hour.getTime()
      );
      
      completeVolumeData.push(existingData || {
        timestamp: hour,
        successful: 0,
        failed: 0,
        pending: 0
      });
    }

    return NextResponse.json({
      success: true,
      data: completeVolumeData,
      timestamp: new Date().toISOString()
    });

    } catch (error: any) {
      console.error('Error fetching transaction volume:', error);
      return NextResponse.json({
        error: 'Failed to fetch transaction volume',
        details: error.message
      }, { status: 500 });
    }
  }); // End withAdminContext
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}