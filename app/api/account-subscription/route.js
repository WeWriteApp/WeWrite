import { NextResponse } from 'next/server';
import { auth } from '../../firebase/auth';
import { getUserSubscription } from '../../firebase/subscription';

export async function GET() {
  try {
    // Get the current user
    const user = auth.currentUser;
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the user's subscription from Firestore with verbose: false to reduce logging
    const subscription = await getUserSubscription(user.uid, { verbose: false });
    
    if (!subscription) {
      return NextResponse.json(
        { status: null }
      );
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
