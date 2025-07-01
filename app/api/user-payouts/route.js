import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's payout history from Firestore
    const db = admin.firestore();
    
    try {
      // Fetch payout transactions for the user
      const payoutsRef = db.collection('payouts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50);
      
      const payoutsSnapshot = await payoutsRef.get();
      
      const payouts = [];
      
      payoutsSnapshot.forEach(doc => {
        const payoutData = doc.data();
        
        payouts.push({
          id: doc.id,
          amount: payoutData.amount || 0,
          date: payoutData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          status: payoutData.status || 'pending',
          bankAccount: payoutData.bankAccount || null,
          estimatedArrival: payoutData.estimatedArrival?.toDate?.()?.toISOString() || null
        });
      });

      return NextResponse.json({ payouts });
    } catch (firestoreError) {
      console.error('Error fetching payouts from Firestore:', firestoreError);
      return NextResponse.json({ payouts: [] });
    }

  } catch (error) {
    console.error('Error fetching user payouts:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}