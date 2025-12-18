import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

interface PayoutData {
  amount?: number;
  status?: string;
  bankAccount?: string | null;
  createdAt?: { toDate?: () => Date };
  estimatedArrival?: { toDate?: () => Date } | null;
}

interface Payout {
  id: string;
  amount: number;
  date: string;
  status: string;
  bankAccount: string | null;
  estimatedArrival: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const payoutsRef = db.collection(getCollectionName('payouts'))
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50);

      const payoutsSnapshot = await payoutsRef.get();
      const payouts: Payout[] = [];

      payoutsSnapshot.forEach(doc => {
        const payoutData = doc.data() as PayoutData;

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
    const err = error as Error;
    console.error('Error fetching user payouts:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
