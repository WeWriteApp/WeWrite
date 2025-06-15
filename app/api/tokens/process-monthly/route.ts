/**
 * API endpoint for processing monthly token distribution
 * This should be called by a cron job on the 1st of each month
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenService } from '../../../services/tokenService';
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
    
    console.log(`Processing monthly token distribution for period: ${targetPeriod} (dry run: ${dryRun})`);

    if (!dryRun) {
      // Process the monthly distribution
      await TokenService.processMonthlyDistribution(targetPeriod);
    }

    // Get distribution statistics
    const distributionHistory = await TokenService.getDistributionHistory(1);
    const currentDistribution = distributionHistory[0];

    return NextResponse.json({
      success: true,
      data: {
        period: targetPeriod,
        dryRun,
        totalTokensDistributed: currentDistribution?.totalTokensDistributed || 0,
        totalUsersParticipating: currentDistribution?.totalUsersParticipating || 0,
        wewriteTokens: currentDistribution?.wewriteTokens || 0,
        status: currentDistribution?.status || 'pending'
      },
      message: `Monthly token distribution ${dryRun ? 'simulated' : 'completed'} for ${targetPeriod}`
    });

  } catch (error) {
    console.error('Error processing monthly token distribution:', error);
    return NextResponse.json({
      error: 'Failed to process monthly token distribution'
    }, { status: 500 });
  }
}

// GET endpoint for checking distribution status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getPreviousMonth();
    
    // Get distribution history
    const distributionHistory = await TokenService.getDistributionHistory(12);
    const targetDistribution = distributionHistory.find(d => d.month === period);
    
    if (!targetDistribution) {
      return NextResponse.json({
        success: true,
        data: {
          period,
          status: 'not_processed',
          totalTokensDistributed: 0,
          totalUsersParticipating: 0,
          wewriteTokens: 0
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        period,
        status: targetDistribution.status,
        totalTokensDistributed: targetDistribution.totalTokensDistributed,
        totalUsersParticipating: targetDistribution.totalUsersParticipating,
        wewriteTokens: targetDistribution.wewriteTokens,
        processedAt: targetDistribution.processedAt
      }
    });
    
  } catch (error) {
    console.error('Error getting token distribution status:', error);
    return NextResponse.json({
      error: 'Failed to get distribution status'
    }, { status: 500 });
  }
}
