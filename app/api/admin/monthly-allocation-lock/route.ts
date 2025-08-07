/**
 * Monthly Allocation Lock API
 * 
 * Admin API endpoints for managing monthly allocation locking
 * and month-end processing in the fund holding model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { monthlyAllocationLockService } from '../../../services/monthlyAllocationLockService';
import { isAdminUser } from '../../../utils/adminUtils';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    console.log(`🔒 [ADMIN] Monthly allocation lock request: ${action}`);

    switch (action) {
      case 'lock_month':
        return await handleLockMonth(body);
      
      case 'open_next_month':
        return await handleOpenNextMonth(body);
      
      case 'get_lock_status':
        return await handleGetLockStatus(body);
      
      case 'get_user_snapshots':
        return await handleGetUserSnapshots(body);
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: lock_month, open_next_month, get_lock_status, get_user_snapshots'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in monthly allocation lock:', error);
    return NextResponse.json({
      error: 'Monthly allocation lock request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    console.log(`📊 [ADMIN] Getting allocation lock status for month: ${month}`);
    
    const lockStatus = await monthlyAllocationLockService.getAllocationLockStatus(month);
    const userSnapshots = await monthlyAllocationLockService.getUserAllocationSnapshots(month);
    
    return NextResponse.json({
      success: true,
      month,
      lockStatus,
      userSnapshots: userSnapshots.slice(0, 50), // Limit to first 50 for performance
      totalSnapshots: userSnapshots.length
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting allocation lock status:', error);
    return NextResponse.json({
      error: 'Failed to get allocation lock status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleLockMonth(body: any) {
  const { month, triggeredBy } = body;

  if (!month) {
    return NextResponse.json({
      error: 'Month is required (YYYY-MM format)'
    }, { status: 400 });
  }

  // Validate month format
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(month)) {
    return NextResponse.json({
      error: 'Invalid month format. Use YYYY-MM format (e.g., 2024-03)'
    }, { status: 400 });
  }

  console.log(`🔒 [ADMIN] Locking allocations for month: ${month}`);
  
  const result = await monthlyAllocationLockService.lockMonthlyAllocations(
    month,
    triggeredBy || 'manual'
  );
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Successfully locked allocations for ${month}`,
      lockStatus: result.lockStatus
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleOpenNextMonth(body: any) {
  const { currentMonth } = body;

  if (!currentMonth) {
    return NextResponse.json({
      error: 'currentMonth is required (YYYY-MM format)'
    }, { status: 400 });
  }

  console.log(`🚀 [ADMIN] Opening next month allocation window from: ${currentMonth}`);
  
  const transition = await monthlyAllocationLockService.openNextMonthAllocation(currentMonth);
  
  if (transition.status === 'completed') {
    return NextResponse.json({
      success: true,
      message: `Successfully opened allocation window for ${transition.toMonth}`,
      transition
    });
  } else {
    return NextResponse.json({
      success: false,
      message: `Failed to open allocation window for ${transition.toMonth}`,
      transition
    }, { status: 500 });
  }
}

async function handleGetLockStatus(body: any) {
  const { month } = body;

  if (!month) {
    return NextResponse.json({
      error: 'Month is required (YYYY-MM format)'
    }, { status: 400 });
  }

  console.log(`📊 [ADMIN] Getting lock status for month: ${month}`);
  
  const lockStatus = await monthlyAllocationLockService.getAllocationLockStatus(month);
  
  return NextResponse.json({
    success: true,
    month,
    lockStatus
  });
}

async function handleGetUserSnapshots(body: any) {
  const { month, limit } = body;

  if (!month) {
    return NextResponse.json({
      error: 'Month is required (YYYY-MM format)'
    }, { status: 400 });
  }

  console.log(`📊 [ADMIN] Getting user snapshots for month: ${month}`);
  
  const userSnapshots = await monthlyAllocationLockService.getUserAllocationSnapshots(month);
  const limitedSnapshots = limit ? userSnapshots.slice(0, limit) : userSnapshots;
  
  return NextResponse.json({
    success: true,
    month,
    userSnapshots: limitedSnapshots,
    totalSnapshots: userSnapshots.length,
    summary: {
      totalUsers: userSnapshots.length,
      totalAllocated: userSnapshots.reduce((sum, snapshot) => sum + snapshot.totalAllocated, 0),
      totalSubscriptions: userSnapshots.reduce((sum, snapshot) => sum + snapshot.subscriptionAmount, 0),
      totalUnallocated: userSnapshots.reduce((sum, snapshot) => sum + snapshot.unallocatedAmount, 0)
    }
  });
}
