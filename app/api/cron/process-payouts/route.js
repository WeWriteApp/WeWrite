import { NextResponse } from 'next/server';

/**
 * Scheduled function to process payouts at the end of each month
 * This should be called by a cron job or scheduler (e.g., Vercel Cron)
 */
export async function GET(request) {
  try {
    // Verify that this is a scheduled job
    const { headers } = request;
    const authHeader = headers.get('Authorization');
    
    // Check if this is an authorized request
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Call the payouts API to process all payouts
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PAYOUT_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process payouts');
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Payouts processed successfully',
      result
    });
  } catch (error) {
    console.error('Error in scheduled payout processing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process scheduled payouts' },
      { status: 500 }
    );
  }
}
