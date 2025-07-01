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

    // Get the user's earnings from Firestore
    const db = admin.firestore();
    
    try {
      // Fetch earnings transactions for the user
      const earningsRef = db.collection('earnings')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50);
      
      const earningsSnapshot = await earningsRef.get();
      
      const earnings = [];
      
      for (const doc of earningsSnapshot.docs) {
        const earningData = doc.data();
        
        // Fetch page details if available
        let pageTitle = 'Unknown Page';
        if (earningData.sourcePageId) {
          try {
            const pageDoc = await db.collection('pages').doc(earningData.sourcePageId).get();
            if (pageDoc.exists) {
              pageTitle = pageDoc.data().title || 'Untitled Page';
            }
          } catch (pageError) {
            console.error('Error fetching page details:', pageError);
          }
        }

        earnings.push({
          id: doc.id,
          amount: earningData.amount || 0,
          source: earningData.source || 'pledge',
          sourcePageId: earningData.sourcePageId,
          sourcePageTitle: pageTitle,
          date: earningData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          type: earningData.type || 'pledge',
          status: earningData.status || 'completed'
        });
      }

      return NextResponse.json({ earnings });
    } catch (firestoreError) {
      console.error('Error fetching earnings from Firestore:', firestoreError);
      return NextResponse.json({ earnings: [] });
    }

  } catch (error) {
    console.error('Error fetching user earnings:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}