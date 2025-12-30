import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { UsdService } from '../../../services/usdService';
import { dollarsToCents, formatUsdCents } from '../../../utils/formatCurrency';

/**
 * Initialize USD Balance for New Subscription
 * 
 * This endpoint creates the initial USD balance for a newly created subscription,
 * ensuring the user has their monthly USD allocation available immediately.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId, subscriptionId, subscriptionAmount } = await request.json();

    // Validate required fields
    if (!userId || !subscriptionId || !subscriptionAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, subscriptionId, subscriptionAmount' },
        { status: 400 }
      );
    }

    // Validate user matches authenticated user
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Validate subscription amount
    if (typeof subscriptionAmount !== 'number' || subscriptionAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid subscription amount' },
        { status: 400 }
      );
    }

    console.log(`🎯 USD Initialize Balance: Initializing for user ${userId}:`, {
      subscriptionId,
      subscriptionAmount,
      usdCents: dollarsToCents(subscriptionAmount)
    });

    // Get subscription details from user's subscription collection
    const { getUserSubscriptionServer } = await import('../../../firebase/subscription-server');
    const subscription = await getUserSubscriptionServer(userId, { verbose: false });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Verify subscription is active
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription is not active' },
        { status: 400 }
      );
    }

    // Calculate monthly USD allocation in cents
    const monthlyUsdCents = dollarsToCents(subscription.amount);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Check if balance already exists
    const existingBalance = await UsdService.getUserUsdBalance(userId);

    if (existingBalance) {
      // Update existing balance with new subscription amount
      await UsdService.updateMonthlyUsdAllocation(userId, subscription.amount);

      console.log(`🎯 USD Initialize Balance: Updated existing balance for user ${userId}:`, {
        previousAmount: formatUsdCents(existingBalance.totalUsdCents),
        newAmount: formatUsdCents(monthlyUsdCents)
      });

      return NextResponse.json({
        success: true,
        balance: {
          totalUsdCents: monthlyUsdCents,
          allocatedUsdCents: existingBalance.allocatedUsdCents || 0,
          availableUsdCents: monthlyUsdCents - (existingBalance.allocatedUsdCents || 0),
          subscriptionId,
          month: currentMonth
        },
        message: 'USD balance updated successfully'
      });
    } else {
      // Create new USD balance
      await UsdService.updateMonthlyUsdAllocation(userId, subscription.amount);
      const newBalance = await UsdService.getUserUsdBalance(userId);

      if (!newBalance) {
        return NextResponse.json(
          { error: 'Failed to create USD balance' },
          { status: 500 }
        );
      }

      console.log(`🎯 USD Initialize Balance: Created new balance for user ${userId}:`, {
        totalAmount: formatUsdCents(newBalance.totalUsdCents),
        availableAmount: formatUsdCents(newBalance.availableUsdCents)
      });

      return NextResponse.json({
        success: true,
        balance: {
          totalUsdCents: newBalance.totalUsdCents,
          allocatedUsdCents: newBalance.allocatedUsdCents,
          availableUsdCents: newBalance.availableUsdCents,
          subscriptionId,
          month: currentMonth
        },
        message: 'USD balance initialized successfully'
      });
    }

  } catch (error) {
    console.error('USD Initialize Balance: Error initializing balance:', error);
    
    // Return user-friendly error messages
    let errorMessage = 'Failed to initialize USD balance';
    if (error.message.includes('subscription')) {
      errorMessage = 'Subscription validation failed. Please check your subscription status.';
    } else if (error.message.includes('amount')) {
      errorMessage = 'Invalid subscription amount provided.';
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message 
      },
      { status: 500 }
    );
  }
}
