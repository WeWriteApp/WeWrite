import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

interface BalanceData {
  available?: number;
  pending?: number;
  total?: number;
}

interface Balance {
  available: number;
  pending: number;
  total: number;
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
      const balanceDocRef = db.collection('userBalances').doc(userId);
      const balanceDoc = await balanceDocRef.get();

      let balance: Balance = {
        available: 0,
        pending: 0,
        total: 0
      };

      if (balanceDoc.exists) {
        const balanceData = balanceDoc.data() as BalanceData;
        balance = {
          available: balanceData?.available || 0,
          pending: balanceData?.pending || 0,
          total: balanceData?.total || 0
        };
      }

      return NextResponse.json({ balance });
    } catch (firestoreError) {
      console.error('Error fetching balance from Firestore:', firestoreError);
      return NextResponse.json({ balance: { available: 0, pending: 0, total: 0 } });
    }

  } catch (error) {
    const err = error as Error;
    console.error('Error fetching user balance:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
