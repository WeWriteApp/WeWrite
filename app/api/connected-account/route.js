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

    // Get the user's connected account from Firestore
    const db = admin.firestore();
    
    try {
      // Fetch user document to get connected account info
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      
      let account = null;

      if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Check if user has a connected Stripe account
        if (userData.stripeConnectedAccountId) {
          account = {
            id: userData.stripeConnectedAccountId,
            last4: userData.bankAccountLast4 || '****',
            type: 'bank_account',
            status: userData.accountStatus || 'pending'
          };
        }
      }

      return NextResponse.json({ account });
    } catch (firestoreError) {
      console.error('Error fetching connected account from Firestore:', firestoreError);
      return NextResponse.json({ account: null });
    }

  } catch (error) {
    console.error('Error fetching connected account:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}