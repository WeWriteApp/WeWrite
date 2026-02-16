/**
 * Admin API endpoint to configure Stripe platform account
 * for the new fund holding model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { platformAccountConfigService } from '../../../services/platformAccountConfigService';
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


    switch (action) {
      case 'initialize':
        return await handleInitialize();
      
      case 'enable_manual_payouts':
        return await handleEnableManualPayouts();
      
      case 'get_status':
        return await handleGetStatus();
      
      case 'create_platform_payout':
        return await handleCreatePlatformPayout(body);
      
      case 'check_balance':
        return await handleCheckBalance(body);
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: initialize, enable_manual_payouts, get_status, create_platform_payout, check_balance'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in platform account configuration:', error);
    return NextResponse.json({
      error: 'Platform account configuration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleInitialize() {
  
  const result = await platformAccountConfigService.initializeFundHoldingModel();
  
  if (result.success) {
    const status = await platformAccountConfigService.getPlatformAccountStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Fund holding model initialized successfully',
      status
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleEnableManualPayouts() {
  
  const result = await platformAccountConfigService.enableManualPayouts();
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Manual payouts enabled successfully'
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleGetStatus() {
  
  const status = await platformAccountConfigService.getPlatformAccountStatus();
  
  if (status) {
    return NextResponse.json({
      success: true,
      status
    });
  } else {
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve platform account status'
    }, { status: 500 });
  }
}

async function handleCreatePlatformPayout(body: any) {
  const { amount, description } = body;
  
  if (!amount || amount <= 0) {
    return NextResponse.json({
      error: 'Valid amount is required'
    }, { status: 400 });
  }

  
  const result = await platformAccountConfigService.createPlatformPayout(
    amount,
    description || 'Platform revenue payout'
  );
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Platform payout of $${amount} created successfully`,
      payoutId: result.payoutId
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }
}

async function handleCheckBalance(body: any) {
  const { requiredAmount } = body;
  
  if (!requiredAmount || requiredAmount <= 0) {
    return NextResponse.json({
      error: 'Valid requiredAmount is required'
    }, { status: 400 });
  }

  
  const result = await platformAccountConfigService.checkBalanceSufficiency(requiredAmount);
  const balanceBreakdown = await platformAccountConfigService.getBalanceBreakdown();
  
  return NextResponse.json({
    success: true,
    balanceSufficiency: result,
    balanceBreakdown
  });
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

    
    const status = await platformAccountConfigService.getPlatformAccountStatus();
    const balanceBreakdown = await platformAccountConfigService.getBalanceBreakdown();
    
    if (status && balanceBreakdown) {
      return NextResponse.json({
        success: true,
        platformAccount: status,
        balance: balanceBreakdown,
        fundHoldingModel: {
          enabled: status.fundHoldingConfigured,
          description: status.fundHoldingConfigured 
            ? 'Platform account configured for fund holding - manual payouts enabled'
            : 'Platform account not configured for fund holding - automatic payouts may be enabled'
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve platform account information'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error getting platform account status:', error);
    return NextResponse.json({
      error: 'Failed to get platform account status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
