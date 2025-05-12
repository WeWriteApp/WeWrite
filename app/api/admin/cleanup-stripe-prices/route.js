import { NextResponse } from 'next/server';
import { archiveOldPrices } from '../../../utils/stripeProductManager';

/**
 * API route to clean up old Stripe prices
 * This can be called periodically via a cron job or manually by an admin
 */
export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const { apiKey, olderThanDays = 30 } = body;
    
    // Simple API key validation - in production, use a more secure method
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Archive old prices
    const archivedCount = await archiveOldPrices(olderThanDays);
    
    return NextResponse.json({
      success: true,
      message: `Successfully archived ${archivedCount} old prices`,
      archivedCount
    });
  } catch (error) {
    console.error('Error cleaning up Stripe prices:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while cleaning up Stripe prices' },
      { status: 500 }
    );
  }
}
