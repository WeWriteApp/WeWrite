/**
 * API endpoint for processing monthly earnings and payouts
 * This should be called by a cron job on the 1st of each month
 */

import { NextRequest, NextResponse } from 'next/server';
import { payoutService } from '../../../services/payoutService';
import { stripePayoutService } from '../../../services/stripePayoutService';
import { db } from '../../../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

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
    
    console.log(`Processing monthly earnings for period: ${targetPeriod} (dry run: ${dryRun})`);

    // Step 1: Process all active pledges for the period
    const pledgesResult = await processMonthlyPledges(targetPeriod, dryRun);
    
    // Step 2: Calculate and distribute earnings
    const earningsResult = await calculateAndDistributeEarnings(targetPeriod, dryRun);
    
    // Step 3: Create payouts for eligible recipients
    const payoutsResult = await createMonthlyPayouts(targetPeriod, dryRun);
    
    // Step 4: Process payouts (if not dry run)
    let processedPayouts = 0;
    if (!dryRun) {
      processedPayouts = await processScheduledPayouts(targetPeriod);
    }

    return NextResponse.json({
      success: true,
      data: {
        period: targetPeriod,
        dryRun,
        pledgesProcessed: pledgesResult.count,
        earningsCreated: earningsResult.count,
        totalEarningsAmount: earningsResult.totalAmount,
        payoutsCreated: payoutsResult.count,
        totalPayoutAmount: payoutsResult.totalAmount,
        payoutsProcessed: processedPayouts
      },
      message: `Monthly processing completed for ${targetPeriod}`
    });

  } catch (error) {
    console.error('Error processing monthly earnings:', error);
    return NextResponse.json({
      error: 'Failed to process monthly earnings'
    }, { status: 500 });
  }
}

async function processMonthlyPledges(period: string, dryRun: boolean) {
  console.log(`Processing pledges for period: ${period}`);
  
  // Get all active subscriptions
  const subscriptionsQuery = query(
    collection(db, 'subscriptions'),
    where('status', '==', 'active')
  );
  
  const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
  let processedCount = 0;
  
  for (const subDoc of subscriptionsSnapshot.docs) {
    const subscription = subDoc.data();
    const userId = subDoc.id;
    
    // Get user's pledges
    const pledgesQuery = query(
      collection(db, 'users', userId, 'pledges')
    );
    
    const pledgesSnapshot = await getDocs(pledgesQuery);
    
    for (const pledgeDoc of pledgesSnapshot.docs) {
      const pledge = pledgeDoc.data();
      
      if (!dryRun) {
        // Create earnings record for this pledge
        await distributePledgeEarnings(userId, pledge, period);
      }
      
      processedCount++;
    }
  }
  
  return { count: processedCount };
}

async function calculateAndDistributeEarnings(period: string, dryRun: boolean) {
  console.log(`Calculating earnings for period: ${period}`);
  
  const config = await payoutService.getPayoutConfig();
  let totalAmount = 0;
  let earningsCount = 0;
  
  // This would be implemented based on your specific pledge structure
  // For now, returning mock data
  return {
    count: earningsCount,
    totalAmount
  };
}

async function distributePledgeEarnings(userId: string, pledge: any, period: string) {
  const revenueSplit = await payoutService.getRevenueSplit('page', pledge.pageId);
  
  if (!revenueSplit) {
    console.warn(`No revenue split found for page ${pledge.pageId}`);
    return;
  }

  const config = await payoutService.getPayoutConfig();
  const grossAmount = pledge.amount;
  const stripeFee = (grossAmount * config.stripeFeePercentage / 100) + config.stripeFeeFixed;
  const netAmount = grossAmount - stripeFee;

  const batch = writeBatch(db);

  for (const split of revenueSplit.splits) {
    if (split.recipientType === 'platform') continue;
    
    const earningAmount = (netAmount * split.percentage) / 100;
    const platformFee = (grossAmount * config.platformFeePercentage) / 100;
    const finalAmount = earningAmount - (platformFee * split.percentage / 100);
    
    const earningId = `${pledge.pageId}_${split.recipientId}_${period}_${Date.now()}`;
    
    const earning = {
      id: earningId,
      recipientId: split.recipientId,
      sourceType: 'pledge',
      sourceId: `${userId}_${pledge.pageId}`,
      resourceType: 'page',
      resourceId: pledge.pageId,
      amount: earningAmount,
      platformFee: platformFee * split.percentage / 100,
      netAmount: finalAmount,
      currency: 'usd',
      period,
      status: 'available',
      createdAt: serverTimestamp(),
      metadata: {
        pledgerUserId: userId,
        splitPercentage: split.percentage,
        originalAmount: grossAmount
      }
    };

    batch.set(doc(db, 'earnings', earningId), earning);
    
    // Update recipient balance
    batch.update(doc(db, 'payoutRecipients', split.recipientId), {
      availableBalance: increment(finalAmount),
      totalEarnings: increment(finalAmount),
      updatedAt: serverTimestamp()
    });
  }
  
  await batch.commit();
}

async function createMonthlyPayouts(period: string, dryRun: boolean) {
  console.log(`Creating payouts for period: ${period}`);
  
  // Get all recipients with available balance above threshold
  const recipientsQuery = query(collection(db, 'payoutRecipients'));
  const recipientsSnapshot = await getDocs(recipientsQuery);
  
  let payoutCount = 0;
  let totalAmount = 0;
  
  for (const recipientDoc of recipientsSnapshot.docs) {
    const recipient = recipientDoc.data();
    
    if (recipient.availableBalance >= recipient.payoutPreferences.minimumThreshold) {
      if (!dryRun) {
        const payoutId = `payout_${recipient.id}_${period}`;
        
        const payout = {
          id: payoutId,
          recipientId: recipient.id,
          amount: recipient.availableBalance,
          currency: recipient.payoutPreferences.currency,
          status: 'pending',
          earningIds: [], // Would need to fetch relevant earnings
          period,
          scheduledAt: serverTimestamp(),
          retryCount: 0
        };
        
        await setDoc(doc(db, 'payouts', payoutId), payout);
      }
      
      payoutCount++;
      totalAmount += recipient.availableBalance;
    }
  }
  
  return {
    count: payoutCount,
    totalAmount
  };
}

async function processScheduledPayouts(period: string): Promise<number> {
  console.log(`Processing scheduled payouts for period: ${period}`);

  // Use the new automated payout service for processing
  const { AutomatedPayoutService } = await import('../../../services/automatedPayoutService');
  const { FinancialUtils } = await import('../../../types/financial');

  const correlationId = FinancialUtils.generateCorrelationId();
  const payoutService = AutomatedPayoutService.getInstance({
    batchSize: 20, // Larger batch size for monthly processing
    maxRetries: 5,
    minimumThreshold: 25
  });

  try {
    const result = await payoutService.processAllPendingPayouts(correlationId);

    if (result.success && result.data) {
      console.log(`Automated payout processing completed:`, {
        totalProcessed: result.data.totalProcessed,
        successful: result.data.successful,
        failed: result.data.failed,
        correlationId
      });

      return result.data.successful;
    } else {
      console.error(`Automated payout processing failed:`, result.error?.message);
      return 0;
    }
  } catch (error) {
    console.error(`Error in automated payout processing:`, error);
    return 0;
  }
}

function getPreviousMonth(): string {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return previousMonth.toISOString().slice(0, 7); // YYYY-MM format
}

// GET endpoint for checking processing status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getPreviousMonth();
    
    // Get processing status for the period
    const payoutsQuery = query(
      collection(db, 'payouts'),
      where('period', '==', period)
    );
    
    const payoutsSnapshot = await getDocs(payoutsQuery);
    const payouts = payoutsSnapshot.docs.map(doc => doc.data());
    
    const statusCounts = payouts.reduce((acc, payout) => {
      acc[payout.status] = (acc[payout.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json({
      success: true,
      data: {
        period,
        totalPayouts: payouts.length,
        statusCounts,
        totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0)
      }
    });
    
  } catch (error) {
    console.error('Error getting processing status:', error);
    return NextResponse.json({
      error: 'Failed to get processing status'
    }, { status: 500 });
  }
}
