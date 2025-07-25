import { NextRequest, NextResponse } from 'next/server';
import { UnifiedFeeCalculationService } from '../../../services/unifiedFeeCalculationService';
import { FinancialUtils } from '../../../types/financial';

/**
 * Calculate payout fees endpoint
 * 
 * POST /api/payouts/calculate-fees
 * Body: { amount: number, payoutMethod?: 'standard' | 'instant', currency?: string }
 * 
 * Returns comprehensive fee breakdown for payout amounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, payoutMethod = 'standard', currency = 'USD' } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({
        error: 'Valid amount is required'
      }, { status: 400 });
    }

    if (!FinancialUtils.validateUsdAmount(amount)) {
      return NextResponse.json({
        error: 'Invalid amount format'
      }, { status: 400 });
    }

    // Check minimum payout threshold
    const minimumThreshold = 25.00; // $25 minimum
    if (amount < minimumThreshold) {
      return NextResponse.json({
        error: `Minimum payout amount is $${minimumThreshold}`,
        minimumThreshold
      }, { status: 400 });
    }

    // Generate correlation ID for tracking
    const correlationId = FinancialUtils.generateCorrelationId();

    // Calculate comprehensive fee breakdown
    const feeService = UnifiedFeeCalculationService.getInstance();
    const feeBreakdown = await feeService.calculateFees(
      amount,
      'payout',
      currency,
      payoutMethod,
      correlationId
    );

    // Format response for frontend consumption
    const response = {
      success: true,
      feeBreakdown: {
        grossAmount: amount,
        wewritePlatformFee: feeBreakdown.platformFee,
        stripeProcessingFee: 0, // Not applicable for payouts
        stripePayoutFee: feeBreakdown.stripePayoutFee,
        taxWithholding: feeBreakdown.taxWithholding || 0,
        totalFees: feeBreakdown.totalFees,
        netPayoutAmount: feeBreakdown.netPayoutAmount,
        currency: currency.toUpperCase(),
        payoutMethod,
        estimatedArrival: payoutMethod === 'instant' ? 'Within 30 minutes' : '1-2 business days'
      },
      correlationId,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error calculating payout fees:', error);
    
    return NextResponse.json({
      error: 'Failed to calculate payout fees',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get fee structure information
 * 
 * GET /api/payouts/calculate-fees
 * 
 * Returns current fee structure for informational purposes
 */
export async function GET() {
  try {
    const feeService = UnifiedFeeCalculationService.getInstance();
    const feeStructure = await feeService.getFeeStructure();

    const response = {
      success: true,
      feeStructure: {
        platformFeePercentage: feeStructure.platformFeePercentage,
        stripePayoutFees: {
          standard: {
            usd: feeStructure.stripePayoutFees.USD.standard,
            eur: feeStructure.stripePayoutFees.EUR.standard,
            gbp: feeStructure.stripePayoutFees.GBP.standard
          },
          instant: {
            usd: feeStructure.stripePayoutFees.USD.instant,
            eur: feeStructure.stripePayoutFees.EUR.instant,
            gbp: feeStructure.stripePayoutFees.GBP.instant
          }
        },
        minimumPayoutThreshold: 25.00,
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportedPayoutMethods: ['standard', 'instant']
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching fee structure:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch fee structure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
