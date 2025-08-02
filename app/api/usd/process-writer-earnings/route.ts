/**
 * API endpoint for processing monthly writer USD earnings
 * This should be called by a cron job at the end of each month
 * to move pending USD earnings to available status
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerUsdEarningsService } from '../../../services/usdEarningsService.server';
import { getCurrentMonth, getPreviousMonth } from '../../../utils/subscriptionTiers';

// This endpoint should be protected by API key or admin auth in production
export async function POST(request: NextRequest) {
  try {
    // Verify admin access or API key
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.CRON_API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();
    const { period, dryRun = false } = body;

    // Default to previous month if no period specified
    const targetPeriod = period || getPreviousMonth();

    console.log(`Processing writer USD earnings for period: ${targetPeriod} (dry run: ${dryRun})`);

    let result;
    if (!dryRun) {
      // Process the monthly distribution for writers
      result = await ServerUsdEarningsService.processMonthlyDistribution(targetPeriod);

      if (!result) {
        return NextResponse.json({
          error: 'Failed to process monthly USD distribution'
        }, { status: 500 });
      }
    } else {
      // For dry run, just return what would be processed
      result = {
        processedCount: 0,
        affectedWriters: 0
      };
    }

    // Get some statistics for the response
    const currentMonth = getCurrentMonth();
    const stats = {
      period: targetPeriod,
      dryRun,
      message: `Writer USD earnings ${dryRun ? 'simulated' : 'processed'} for ${targetPeriod}`,
      nextProcessingDate: `${currentMonth}-01`, // First of current month
      description: dryRun
        ? 'Simulation completed - no changes made'
        : 'Pending USD earnings have been moved to available status for eligible writers',
      processedCount: result.processedCount,
      affectedWriters: result.affectedWriters
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Error processing writer USD earnings:', error);

    return NextResponse.json({
      error: 'Failed to process writer USD earnings',
      details: error.message
    }, { status: 500 });
  }
}
