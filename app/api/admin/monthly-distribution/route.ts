/**
 * Admin API for manually triggering monthly token distribution processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

// Inline admin check to avoid module resolution issues
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
  'patrick@mailfischer.com',
  'skyler99ireland@gmail.com',
  'diamatryistmatov@gmail.com',
  'josiahsparrow@gmail.com'
];

const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status using admin SDK
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { month } = await request.json();

    if (!month) {
      return NextResponse.json({ 
        error: 'Missing required field: month (format: YYYY-MM)' 
      }, { status: 400 });
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json({ 
        error: 'Invalid month format. Use YYYY-MM (e.g., 2024-01)' 
      }, { status: 400 });
    }

    // Process monthly distribution
    const result = await TokenEarningsService.processMonthlyDistribution(month);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully processed monthly distribution for ${month}`,
        data: {
          month,
          processedAt: new Date().toISOString(),
          correlationId: result.correlationId
        }
      });
    } else {
      return NextResponse.json({
        error: `Failed to process monthly distribution: ${result.error?.message || 'Unknown error'}`,
        correlationId: result.correlationId
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error processing monthly distribution:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}