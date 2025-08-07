/**
 * Fund Tracking API
 * 
 * API endpoints for the fund tracking service in the new fund holding model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { fundTrackingService } from '../../services/fundTrackingService';
import { isAdminUser } from '../../utils/adminUtils';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'user_balance':
        return await handleGetUserBalance(userId);
      
      case 'user_history':
        return await handleGetUserHistory(userId, searchParams);
      
      case 'platform_overview':
        return await handleGetPlatformOverview(userId);
      
      case 'monthly_summary':
        return await handleGetMonthlySummary(userId, searchParams);
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: user_balance, user_history, platform_overview, monthly_summary'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [FUND TRACKING API] Error:', error);
    return NextResponse.json({
      error: 'Fund tracking request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'track_subscription':
        return await handleTrackSubscription(userId, body);
      
      case 'track_allocation':
        return await handleTrackAllocation(userId, body);
      
      case 'lock_monthly_allocations':
        return await handleLockMonthlyAllocations(userId, body);
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: track_subscription, track_allocation, lock_monthly_allocations'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [FUND TRACKING API] Error:', error);
    return NextResponse.json({
      error: 'Fund tracking request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleGetUserBalance(userId: string) {
  const balance = await fundTrackingService.getUserFundBalance(userId);
  
  if (balance) {
    return NextResponse.json({
      success: true,
      balance
    });
  } else {
    return NextResponse.json({
      success: true,
      balance: null,
      message: 'No fund balance found for user'
    });
  }
}

async function handleGetUserHistory(userId: string, searchParams: URLSearchParams) {
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  const history = await fundTrackingService.getUserFundHistory(userId, limit);
  
  return NextResponse.json({
    success: true,
    history,
    count: history.length
  });
}

async function handleGetPlatformOverview(userId: string) {
  // Check admin access for platform overview
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const overview = await fundTrackingService.getPlatformFundOverview();
  
  return NextResponse.json({
    success: true,
    overview
  });
}

async function handleGetMonthlySummary(userId: string, searchParams: URLSearchParams) {
  // Check admin access for monthly summary
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const summary = await fundTrackingService.getMonthlySummary(month);
  
  if (summary) {
    return NextResponse.json({
      success: true,
      summary
    });
  } else {
    return NextResponse.json({
      success: true,
      summary: null,
      message: `No summary found for month ${month}`
    });
  }
}

async function handleTrackSubscription(userId: string, body: any) {
  const { subscriptionId, amount, stripeInvoiceId, transferGroup, metadata } = body;

  if (!subscriptionId || !amount || !stripeInvoiceId || !transferGroup) {
    return NextResponse.json({
      error: 'subscriptionId, amount, stripeInvoiceId, and transferGroup are required'
    }, { status: 400 });
  }

  const result = await fundTrackingService.trackSubscriptionPayment(
    userId,
    subscriptionId,
    amount,
    stripeInvoiceId,
    transferGroup,
    metadata
  );

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Subscription payment tracked successfully',
      trackingId: result.trackingId
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleTrackAllocation(userId: string, body: any) {
  const { pageId, recipientUserId, amount } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({
      error: 'Valid amount is required'
    }, { status: 400 });
  }

  if (!pageId && !recipientUserId) {
    return NextResponse.json({
      error: 'Either pageId or recipientUserId is required'
    }, { status: 400 });
  }

  const result = await fundTrackingService.trackUserAllocation(userId, {
    pageId,
    recipientUserId,
    amount
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'User allocation tracked successfully'
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleLockMonthlyAllocations(userId: string, body: any) {
  // Check admin access for locking allocations
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { month } = body;

  if (!month) {
    return NextResponse.json({
      error: 'Month is required (YYYY-MM format)'
    }, { status: 400 });
  }

  const result = await fundTrackingService.lockMonthlyAllocations(month);

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Monthly allocations locked successfully for ${month}`,
      lockedCount: result.lockedCount
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}
