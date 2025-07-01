/**
 * Transaction Tracking API
 * 
 * Admin endpoint for viewing and managing cross-system transaction tracking
 * from Stripe payments through token allocations to writer payouts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TransactionTrackingService, TransactionType } from '../../../services/transactionTrackingService';
import { FinancialUtils } from '../../../types/financial';

/**
 * GET /api/admin/transaction-tracking
 * Get transaction tracking data with various filters
 */
export async function GET(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    switch (action) {
      case 'get_transaction': {
        const transactionId = searchParams.get('transactionId');
        if (!transactionId) {
          return NextResponse.json({
            error: 'Transaction ID is required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.getTransaction(transactionId, correlationId);
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to get transaction',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          correlationId
        });
      }
      
      case 'get_chain': {
        const rootTransactionId = searchParams.get('rootTransactionId');
        if (!rootTransactionId) {
          return NextResponse.json({
            error: 'Root transaction ID is required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.getTransactionChain(rootTransactionId, correlationId);
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to get transaction chain',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          correlationId
        });
      }
      
      case 'get_user_transactions': {
        const userId = searchParams.get('userId');
        const type = searchParams.get('type') as TransactionType;
        const limit = parseInt(searchParams.get('limit') || '50');
        
        if (!userId) {
          return NextResponse.json({
            error: 'User ID is required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.getUserTransactions(
          userId,
          type,
          limit,
          correlationId
        );
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to get user transactions',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          correlationId
        });
      }
      
      case 'get_by_correlation': {
        const corrId = searchParams.get('correlationId');
        if (!corrId) {
          return NextResponse.json({
            error: 'Correlation ID is required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.getTransactionsByCorrelationId(corrId);
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to get transactions by correlation ID',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          correlationId
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: get_transaction, get_chain, get_user_transactions, get_by_correlation',
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('Transaction tracking endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to process transaction tracking request',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/transaction-tracking
 * Create or update transaction tracking records
 */
export async function POST(request: NextRequest) {
  const correlationId = FinancialUtils.generateCorrelationId();
  
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        error: 'Unauthorized - Admin access required',
        correlationId
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, ...data } = body;
    
    switch (action) {
      case 'create_transaction': {
        const { transaction } = data;
        if (!transaction) {
          return NextResponse.json({
            error: 'Transaction data is required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.createTransaction(transaction, correlationId);
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to create transaction',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          correlationId
        });
      }
      
      case 'update_status': {
        const { transactionId, status, metadata } = data;
        if (!transactionId || !status) {
          return NextResponse.json({
            error: 'Transaction ID and status are required',
            correlationId
          }, { status: 400 });
        }
        
        const result = await TransactionTrackingService.updateTransactionStatus(
          transactionId,
          status,
          metadata,
          correlationId
        );
        
        if (!result.success) {
          return NextResponse.json({
            error: result.error?.message || 'Failed to update transaction status',
            correlationId
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          correlationId
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: create_transaction, update_status',
          correlationId
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('Transaction tracking POST endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to process transaction tracking request',
      details: error.message,
      correlationId
    }, { status: 500 });
  }
}