import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

// Initialize Firebase Admin lazily
let admin;

function initializeFirebase() {
  if (admin) return { admin }; // Already initialized

  try {
    admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { admin: null };
    }
    console.log('Firebase Admin initialized successfully in connected-account');
  } catch (error) {
    console.error('Error initializing Firebase Admin in connected-account:', error);
    return { admin: null };
  }

  return { admin };
}

export async function POST(request) {
  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      console.warn('Firebase Admin not available for connected-account');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the user's connected account from Firestore (also verifies user exists - avoids admin.auth() jose issues)
    const db = admin.firestore();
    
    try {
      // Fetch user document to get connected account info
      const userDocRef = db.collection(getCollectionName('users')).doc(userId);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists) {
        console.error('User not found in Firestore:', userId);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      let account = null;
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