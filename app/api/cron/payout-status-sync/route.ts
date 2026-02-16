/**
 * Payout Status Sync Cron Endpoint
 * 
 * Syncs payout status with Stripe and updates database records
 * Runs every 30 minutes to keep payout status current
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { FinancialUtils } from '../../../types/financial';
import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();

export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronKey = process.env.CRON_API_KEY;
    
    if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Cron access required',
        correlationId
      }, { status: 401 });
    }

    const admin = initAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Database not available',
        correlationId
      }, { status: 503 });
    }

    const db = admin.firestore();
    console.log(`[PAYOUT SYNC] Starting payout status sync [${correlationId}]`);

    // Get all pending and processing payouts
    const payoutsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
      .where('status', 'in', ['pending', 'processing'])
      .limit(50); // Process in batches

    const payoutsSnapshot = await payoutsQuery.get();
    
    if (payoutsSnapshot.empty) {
      console.log(`[PAYOUT SYNC] No pending payouts to sync [${correlationId}]`);
      return NextResponse.json({
        success: true,
        message: 'No pending payouts to sync',
        data: { processed: 0 },
        correlationId
      });
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Process each payout
    for (const payoutDoc of payoutsSnapshot.docs) {
      try {
        const payout = payoutDoc.data();
        processed++;

        // Skip if no Stripe transfer ID
        if (!payout.stripeTransferId) {
          continue;
        }

        // Get transfer status from Stripe
        const transfer = await stripe.transfers.retrieve(payout.stripeTransferId);
        
        let newStatus = payout.status;
        let updateData: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Map Stripe transfer status to our status
        if (transfer.reversed) {
          newStatus = 'failed';
          updateData.failureReason = 'Transfer was reversed';
        } else {
          // Stripe transfers are typically completed immediately for standard payouts
          // For instant payouts, we'd check the destination_payment status
          newStatus = 'completed';
          updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        // Update if status changed
        if (newStatus !== payout.status) {
          updateData.status = newStatus;
          await payoutDoc.ref.update(updateData);
          updated++;
          
          console.log(`[PAYOUT SYNC] Updated payout ${payout.id}: ${payout.status} → ${newStatus} [${correlationId}]`);
        } else {
          // Just update sync timestamp
          await payoutDoc.ref.update({
            lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

      } catch (error) {
        console.error(`[PAYOUT SYNC] Error processing payout ${payoutDoc.id}:`, error);
        errors++;
      }
    }

    console.log(`[PAYOUT SYNC] Completed: processed=${processed}, updated=${updated}, errors=${errors} [${correlationId}]`);

    return NextResponse.json({
      success: true,
      message: 'Payout status sync completed',
      data: {
        processed,
        updated,
        errors,
        correlationId
      }
    });

  } catch (error) {
    console.error(`[PAYOUT SYNC] Fatal error [${correlationId}]:`, error);
    
    return NextResponse.json({
      error: 'Payout status sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    }, { status: 500 });
  }
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({
    service: 'payout-status-sync',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}
