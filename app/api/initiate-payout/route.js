import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export async function POST(request) {
  try {
    const { userId, amount } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json({ error: 'User ID and amount are required' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Verify the user exists in Firebase
    try {
      await admin.auth().getUser(userId);
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = admin.firestore();
    
    try {
      // Check user's available balance
      const balanceDocRef = db.collection('userBalances').doc(userId);
      const balanceDoc = await balanceDocRef.get();
      
      if (!balanceDoc.exists) {
        return NextResponse.json({ error: 'No balance found for user' }, { status: 400 });
      }

      const balanceData = balanceDoc.data();
      const availableBalance = balanceData.available || 0;

      if (amount > availableBalance) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      // Check if user has a connected account
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists || !userDoc.data().stripeConnectedAccountId) {
        return NextResponse.json({ error: 'No connected bank account found' }, { status: 400 });
      }

      // Create payout record
      const payoutData = {
        userId: userId,
        amount: amount,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        bankAccount: userDoc.data().bankAccountLast4 || '****'
      };

      const payoutRef = await db.collection('payouts').add(payoutData);

      // Update user balance (deduct the payout amount from available)
      await balanceDocRef.update({
        available: admin.firestore.FieldValue.increment(-amount),
        pending: admin.firestore.FieldValue.increment(amount)
      });

      // In a real implementation, you would integrate with Stripe Connect
      // to actually initiate the payout to the user's connected account
      // For now, we'll just create the record and mark it as processing

      // Simulate processing delay
      setTimeout(async () => {
        try {
          await payoutRef.update({
            status: 'processing'
          });
        } catch (error) {
          console.error('Error updating payout status:', error);
        }
      }, 5000);

      return NextResponse.json({ 
        success: true, 
        payoutId: payoutRef.id,
        message: 'Payout initiated successfully'
      });

    } catch (firestoreError) {
      console.error('Error processing payout:', firestoreError);
      return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error initiating payout:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
