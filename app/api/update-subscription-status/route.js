import { NextResponse } from 'next/server';
import { updateSubscription } from '../../firebase/subscription';
import { db } from '../../firebase/database';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request) {
  try {
    // Parse request body
    const { userId, status } = await request.json();

    // Basic validation
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Update subscription in Firestore
    console.log(`Manually updating subscription for user ${userId} to ${status} status`);
    
    await updateSubscription(userId, {
      status: status,
      updatedAt: new Date().toISOString(),
    });

    // Also update the user document to include subscription status for quick access
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      subscriptionStatus: status,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: `Subscription status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while updating subscription status' },
      { status: 500 }
    );
  }
}
