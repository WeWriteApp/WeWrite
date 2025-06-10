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

    // Get the user's balance from Firestore
    const db = admin.firestore();
    
    try {
      // Fetch user balance document
      const balanceDocRef = db.collection('userBalances').doc(userId);
      const balanceDoc = await balanceDocRef.get();
      
      let balance = {
        available: 0,
        pending: 0,
        total: 0
      };

      if (balanceDoc.exists) {
        const balanceData = balanceDoc.data();
        balance = {
          available: balanceData.available || 0,
          pending: balanceData.pending || 0,
          total: balanceData.total || 0
        };
      }

      return NextResponse.json({ balance });
    } catch (firestoreError) {
      console.error('Error fetching balance from Firestore:', firestoreError);
      return NextResponse.json({ balance: { available: 0, pending: 0, total: 0 } });
    }

  } catch (error) {
    console.error('Error fetching user balance:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
