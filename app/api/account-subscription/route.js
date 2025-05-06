import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getUserSubscription } from '../../firebase/subscription';

export async function GET(request) {
  try {
    // Get user ID from request using our helper
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription from Firestore with verbose: false to reduce logging
    const subscription = await getUserSubscription(userId, { verbose: false });

    if (!subscription) {
      return NextResponse.json({ status: null });
    }

    // Return the subscription data
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription data:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching subscription data' },
      { status: 500 }
    );
  }
}
