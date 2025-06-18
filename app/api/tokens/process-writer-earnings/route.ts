/**
 * API endpoint for processing monthly writer token earnings
 * This should be called by a cron job at the end of each month
 * to move pending tokens to available status
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
import { getCurrentMonth, getPreviousMonth } from '../../../utils/subscriptionTiers';

// This endpoint should be protected by API key or admin auth in production
export async function POST(request: NextRequest) {
  try {
    // Verify admin access or API key
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.CRON_API_KEY;
    
    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { period, dryRun = false } = body;

    // Default to previous month if no period specified
    const targetPeriod = period || getPreviousMonth();
    
    console.log(`Processing writer token earnings for period: ${targetPeriod} (dry run: ${dryRun})`);

    if (!dryRun) {
      // Process the monthly distribution for writers
      await TokenEarningsService.processMonthlyDistribution(targetPeriod);
    }

    // Get some statistics for the response
    const currentMonth = getCurrentMonth();
    const stats = {
      period: targetPeriod,
      dryRun,
      message: `Writer token earnings ${dryRun ? 'simulated' : 'processed'} for ${targetPeriod}`,
      nextProcessingDate: `${currentMonth}-01`, // First of current month
      description: dryRun 
        ? 'Simulation completed - no changes made'
        : 'Pending tokens have been moved to available status for eligible writers'
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Error processing writer token earnings:', error);
    
    return NextResponse.json({
      error: 'Failed to process writer token earnings',
      details: error.message
    }, { status: 500 });
  }
}
