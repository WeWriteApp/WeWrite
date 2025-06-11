import { NextResponse } from 'next/server';
import { getUserSubscriptionServer } from '../../firebase/subscription-server';

export async function GET(request) {
  try {
    // Get userId from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the user's subscription from Firestore with verbose: false to reduce logging
    const subscription = await getUserSubscriptionServer(userId, { verbose: false });

    if (!subscription) {
      return NextResponse.json({ status: null });
    }

    // Return the subscription data
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching user subscription data:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching subscription data' },
      { status: 500 }
    );
  }
}
