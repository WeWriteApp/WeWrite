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
    console.log('Firebase Admin initialized successfully in user-payouts');
  } catch (error) {
    console.error('Error initializing Firebase Admin in user-payouts:', error);
    return { admin: null };
  }

  return { admin };
}

export async function POST(request) {
  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      console.warn('Firebase Admin not available for user-payouts');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

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
      const payoutsRef = db.collection(getCollectionName('payouts'))
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