/**
 * Development endpoint to test USD allocation flow
 * This bypasses authentication for testing purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { UsdService } from '../../../services/usdService';
import { formatUsdCents } from '../../../utils/formatCurrency';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const body = await request.json();
    const {
      fromUserId = 'dev_admin_user',
      pageId = 'gRC1iJxmBeQdOBCxjKKk',
      usdCentsChange = 250
    } = body;

    console.log(`🧪 TEST ALLOCATION: ${formatUsdCents(Math.abs(usdCentsChange))} from ${fromUserId} to page ${pageId}`);

    // Perform the allocation
    await UsdService.allocateUsdToPage(fromUserId, pageId, usdCentsChange);

    // Get updated balance
    const updatedBalance = await UsdService.getUserUsdBalance(fromUserId);
    const currentAllocation = await UsdService.getCurrentPageAllocation(fromUserId, pageId);

    console.log(`🧪 TEST ALLOCATION SUCCESS:`, {
      newAllocation: formatUsdCents(currentAllocation),
      newAvailable: updatedBalance ? formatUsdCents(updatedBalance.availableUsdCents) : '$0.00'
    });

    return NextResponse.json({
      success: true,
      balance: updatedBalance,
      currentPageAllocation: currentAllocation,
      message: `Test allocation successful: ${formatUsdCents(Math.abs(usdCentsChange))} to page`
    });

  } catch (error) {
    console.error('🧪 TEST ALLOCATION ERROR:', error);
    return NextResponse.json({
      error: 'Test allocation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'pending-earnings';
    const userId = searchParams.get('userId') || 'dev_test_user_1';

    console.log(`🧪 TEST GET: ${action} for user ${userId}`);

    if (action === 'check-production-data') {
      // URGENT: Check production collections for real user data
      try {
        console.log(`🚨 URGENT: Checking production collections for real user data`);

        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');
        const { getCurrentMonth } = await import('../../../utils/usdConstants');

        // Get Firebase Admin instance
        let prodCheckApp = getApps().find(app => app.name === 'prod-check-app');
        if (!prodCheckApp) {
          const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
          const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
          const serviceAccount = JSON.parse(decodedJson);

          prodCheckApp = initializeApp({
            credential: cert({
              projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
            })
          }, 'prod-check-app');
        }

        const db = getFirestore(prodCheckApp);
        const currentMonth = getCurrentMonth();

        // Check PRODUCTION collections (without DEV_ prefix)
        const prodCollections = {
          allocations: 'usdAllocations',
          earnings: 'writerUsdEarnings',
          balances: 'writerUsdBalances'
        };

        const results = {};

        // Check allocations in production collection
        const allocationsSnapshot = await db.collection(prodCollections.allocations)
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .limit(50)
          .get();

        results.productionAllocations = {
          total: allocationsSnapshot.size,
          sample: allocationsSnapshot.docs.slice(0, 10).map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        };

        // Check for specific users
        const userIds = [userId, 'fWNeCuussPgYgkN2LGohFRCPXiy1', 'I5IoRbISVuOjSEkyhaE4nZkcMQ42'];

        for (const checkUserId of userIds) {
          // Check allocations where this user is recipient
          const userAllocationsSnapshot = await db.collection(prodCollections.allocations)
            .where('recipientUserId', '==', checkUserId)
            .where('month', '==', currentMonth)
            .where('status', '==', 'active')
            .get();

          // Check earnings
          const userEarningsSnapshot = await db.collection(prodCollections.earnings)
            .where('userId', '==', checkUserId)
            .where('month', '==', currentMonth)
            .get();

          // Check balance
          const userBalanceDoc = await db.collection(prodCollections.balances)
            .doc(checkUserId)
            .get();

          results[checkUserId] = {
            allocations: userAllocationsSnapshot.size,
            earnings: userEarningsSnapshot.size,
            hasBalance: userBalanceDoc.exists,
            balanceData: userBalanceDoc.exists ? userBalanceDoc.data() : null
          };
        }

        console.log(`🚨 PRODUCTION DATA CHECK RESULTS:`, results);

        return NextResponse.json({
          success: true,
          message: `Production data check completed`,
          currentMonth,
          collections: prodCollections,
          results
        });
      } catch (error) {
        console.error(`🚨 PRODUCTION DATA CHECK ERROR:`, error);
        return NextResponse.json({
          error: 'Failed to check production data',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'process-production-allocations') {
      // URGENT: Process PRODUCTION allocations into earnings records
      try {
        console.log(`🚨 URGENT: Processing PRODUCTION allocations into earnings records`);

        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');
        const { UsdEarningsService } = await import('../../../services/usdEarningsService');
        const { getCurrentMonth } = await import('../../../utils/usdConstants');

        // Get Firebase Admin instance
        let prodProcessApp = getApps().find(app => app.name === 'prod-process-app');
        if (!prodProcessApp) {
          const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
          const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
          const serviceAccount = JSON.parse(decodedJson);

          prodProcessApp = initializeApp({
            credential: cert({
              projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
            })
          }, 'prod-process-app');
        }

        const db = getFirestore(prodProcessApp);
        const currentMonth = getCurrentMonth();

        // Get all active allocations from PRODUCTION collection (no DEV_ prefix)
        const allocationsSnapshot = await db.collection('usdAllocations')
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .get();

        console.log(`🚨 Found ${allocationsSnapshot.size} PRODUCTION allocations to process`);

        let processedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each allocation
        for (const doc of allocationsSnapshot.docs) {
          try {
            const allocation = doc.data();

            if (allocation.recipientUserId) {
              // Process this allocation into earnings using PRODUCTION collections
              // We need to manually process this since the service uses environment-based collection names

              // Create earnings record directly in production collection
              const earningsRef = db.collection('writerUsdEarnings').doc(`${allocation.recipientUserId}_${allocation.month}`);
              const earningsDoc = await earningsRef.get();

              const allocationData = {
                allocationId: `${allocation.userId}_${allocation.resourceId}_${Date.now()}`,
                fromUserId: allocation.userId,
                resourceType: allocation.resourceType,
                resourceId: allocation.resourceId,
                usdCents: allocation.usdCents,
                timestamp: new Date()
              };

              if (earningsDoc.exists) {
                // Update existing earnings record
                await earningsRef.update({
                  allocations: [...(earningsDoc.data()?.allocations || []), allocationData],
                  totalUsdCentsReceived: (earningsDoc.data()?.totalUsdCentsReceived || 0) + allocation.usdCents,
                  updatedAt: new Date()
                });
              } else {
                // Create new earnings record
                await earningsRef.set({
                  userId: allocation.recipientUserId,
                  month: allocation.month,
                  status: 'pending',
                  createdAt: new Date(),
                  allocations: [allocationData],
                  totalUsdCentsReceived: allocation.usdCents,
                  updatedAt: new Date()
                });
              }

              // Update balance in production collection
              const balanceRef = db.collection('writerUsdBalances').doc(allocation.recipientUserId);
              const balanceDoc = await balanceRef.get();

              if (balanceDoc.exists) {
                const currentBalance = balanceDoc.data();
                await balanceRef.update({
                  totalUsdCentsEarned: (currentBalance?.totalUsdCentsEarned || 0) + allocation.usdCents,
                  pendingUsdCents: (currentBalance?.pendingUsdCents || 0) + allocation.usdCents,
                  updatedAt: new Date()
                });
              } else {
                await balanceRef.set({
                  userId: allocation.recipientUserId,
                  totalUsdCentsEarned: allocation.usdCents,
                  pendingUsdCents: allocation.usdCents,
                  availableUsdCents: 0,
                  paidOutUsdCents: 0,
                  lastProcessedMonth: null,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
              }

              processedCount++;
              console.log(`✅ Processed PRODUCTION allocation ${doc.id}: $${(allocation.usdCents / 100).toFixed(2)} to ${allocation.recipientUserId}`);
            }
          } catch (error) {
            errorCount++;
            errors.push({
              allocationId: doc.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`❌ Failed to process PRODUCTION allocation ${doc.id}:`, error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Processed ${processedCount} PRODUCTION allocations into earnings records`,
          summary: {
            totalAllocations: allocationsSnapshot.size,
            processedCount,
            errorCount,
            errors: errors.slice(0, 10) // Limit error details
          }
        });
      } catch (error) {
        console.error(`🚨 URGENT PRODUCTION PROCESSING ERROR:`, error);
        return NextResponse.json({
          error: 'Failed to process PRODUCTION allocations',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'process-existing-allocations') {
      // URGENT: Process all existing allocations into earnings records
      try {
        console.log(`🚨 URGENT: Processing existing allocations into earnings records`);

        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');
        const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');
        const { UsdEarningsService } = await import('../../../services/usdEarningsService');
        const { getCurrentMonth } = await import('../../../utils/usdConstants');

        // Get Firebase Admin instance
        let processApp = getApps().find(app => app.name === 'process-allocations-app');
        if (!processApp) {
          const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
          const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
          const serviceAccount = JSON.parse(decodedJson);

          processApp = initializeApp({
            credential: cert({
              projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
            })
          }, 'process-allocations-app');
        }

        const db = getFirestore(processApp);
        const currentMonth = getCurrentMonth();

        // Get all active allocations for current month
        const allocationsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .get();

        console.log(`🚨 Found ${allocationsSnapshot.size} active allocations to process`);

        let processedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each allocation
        for (const doc of allocationsSnapshot.docs) {
          try {
            const allocation = doc.data();

            if (allocation.recipientUserId) {
              // Process this allocation into earnings
              await UsdEarningsService.processUsdAllocation(
                allocation.userId,
                allocation.recipientUserId,
                allocation.resourceId,
                allocation.resourceType,
                allocation.usdCents,
                allocation.month
              );

              processedCount++;
              console.log(`✅ Processed allocation ${doc.id}: $${(allocation.usdCents / 100).toFixed(2)} to ${allocation.recipientUserId}`);
            }
          } catch (error) {
            errorCount++;
            errors.push({
              allocationId: doc.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`❌ Failed to process allocation ${doc.id}:`, error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Processed ${processedCount} allocations into earnings records`,
          summary: {
            totalAllocations: allocationsSnapshot.size,
            processedCount,
            errorCount,
            errors: errors.slice(0, 10) // Limit error details
          }
        });
      } catch (error) {
        console.error(`🚨 URGENT PROCESSING ERROR:`, error);
        return NextResponse.json({
          error: 'Failed to process existing allocations',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'payout-processing') {
      // Test payout processing with fees
      try {
        console.log(`🧪 PAYOUT PROCESSING: Testing payout for ${userId}`);

        // Get current balance
        const { UsdEarningsService } = await import('../../../services/usdEarningsService');
        const currentBalance = await UsdEarningsService.getWriterUsdBalance(userId);

        if (!currentBalance || currentBalance.availableUsdCents === 0) {
          return NextResponse.json({
            error: 'No available balance for payout',
            currentBalance,
            message: 'User must have available earnings to test payout'
          }, { status: 400 });
        }

        // Test fee calculation using the centralized service
        const { FeeConfigurationService } = await import('../../../services/feeConfigurationService');
        const payoutAmount = currentBalance.availableUsdCents / 100; // Convert cents to dollars
        const fees = await FeeConfigurationService.calculatePayoutFees(payoutAmount, 'standard');

        console.log(`🧪 PAYOUT FEES CALCULATION:`, {
          payoutAmount: payoutAmount,
          platformFee: fees.platformFee,
          stripeConnectFee: fees.stripeConnectFee,
          stripePayoutFee: fees.stripePayoutFee,
          totalFees: fees.totalFees,
          netAmount: fees.netAmount
        });

        return NextResponse.json({
          success: true,
          userId,
          currentBalance,
          payoutTest: {
            requestedAmount: payoutAmount,
            fees,
            message: `Payout fees calculated: Platform fee $${fees.platformFee.toFixed(2)}, Stripe fees $${(fees.stripeConnectFee + fees.stripePayoutFee).toFixed(2)}, Net payout $${fees.netAmount.toFixed(2)}`
          }
        });
      } catch (error) {
        console.error(`🧪 PAYOUT PROCESSING ERROR for ${userId}:`, error);
        return NextResponse.json({
          error: 'Failed to test payout processing',
          details: error instanceof Error ? error.message : 'Unknown error',
          userId
        }, { status: 500 });
      }
    } else if (action === 'monthly-processing') {
      // Test monthly processing system
      const { UsdEarningsService } = await import('../../../services/usdEarningsService');

      try {
        console.log(`🧪 MONTHLY PROCESSING: Processing earnings for current month`);

        // Process monthly earnings for the current month
        const currentMonth = '2025-08'; // Current month from our test data
        const result = await UsdEarningsService.processMonthlyDistribution(currentMonth);

        // Get updated balance
        const updatedBalance = await UsdEarningsService.getWriterUsdBalance(userId);

        console.log(`🧪 MONTHLY PROCESSING SUCCESS:`, {
          processedCount: result.processedCount,
          affectedWriters: result.affectedWriters,
          updatedBalance: updatedBalance ? {
            pending: updatedBalance.pendingUsdCents,
            available: updatedBalance.availableUsdCents,
            total: updatedBalance.totalUsdCentsEarned
          } : null
        });

        return NextResponse.json({
          success: true,
          userId,
          result,
          updatedBalance: updatedBalance || null,
          message: `Monthly processing completed: ${result.processedCount} earnings processed, ${result.affectedWriters} writers affected`
        });
      } catch (error) {
        console.error(`🧪 MONTHLY PROCESSING ERROR for ${userId}:`, error);
        return NextResponse.json({
          error: 'Failed to process monthly earnings',
          details: error instanceof Error ? error.message : 'Unknown error',
          userId
        }, { status: 500 });
      }
    } else if (action === 'pending-earnings') {
      // Test pending earnings by directly calling the service
      const { UsdEarningsService } = await import('../../../services/usdEarningsService');

      try {
        // Get earnings balance first
        const earningsBalance = await UsdEarningsService.getWriterUsdBalance(userId);

        // Try to get earnings records directly from Firestore without complex queries
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');
        const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');

        // Get Firebase Admin instance
        let earningsServiceApp = getApps().find(app => app.name === 'earnings-service-app');
        if (!earningsServiceApp) {
          const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
          const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
          const serviceAccount = JSON.parse(decodedJson);

          earningsServiceApp = initializeApp({
            credential: cert({
              projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
            })
          }, 'earnings-service-app');
        }

        const db = getFirestore(earningsServiceApp);

        // Simple query to get all earnings for this user (no complex indexing)
        const earningsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
          .where('userId', '==', userId)
          .get();

        const allEarnings = earningsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const pendingEarnings = allEarnings.filter((earning: any) => earning.status === 'pending');

        console.log(`🧪 PENDING EARNINGS for ${userId}:`, {
          totalEarnings: allEarnings.length,
          pendingEarnings: pendingEarnings.length,
          earningsBalance: earningsBalance ? {
            pending: earningsBalance.pendingUsdCents,
            available: earningsBalance.availableUsdCents,
            total: earningsBalance.totalUsdCentsEarned
          } : null
        });

        return NextResponse.json({
          success: true,
          userId,
          pendingEarnings,
          allEarnings,
          earningsBalance: earningsBalance || null,
          message: `Found ${pendingEarnings.length} pending earnings out of ${allEarnings.length} total earnings records`
        });
      } catch (error) {
        console.error(`🧪 PENDING EARNINGS ERROR for ${userId}:`, error);
        return NextResponse.json({
          error: 'Failed to fetch pending earnings',
          details: error instanceof Error ? error.message : 'Unknown error',
          userId
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      error: 'Unknown action',
      availableActions: ['pending-earnings', 'monthly-processing', 'payout-processing', 'process-existing-allocations', 'check-production-data', 'process-production-allocations']
    }, { status: 400 });

  } catch (error) {
    console.error('🧪 TEST GET ERROR:', error);
    return NextResponse.json({
      error: 'Test GET failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
