import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

interface UserData {
  stripeConnectedAccountId?: string;
  bankAccountLast4?: string;
  accountStatus?: string;
}

interface ConnectedAccount {
  id: string;
  last4: string;
  type: string;
  status: string;
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

    try {
      const userDocRef = db.collection(getCollectionName('users')).doc(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let account: ConnectedAccount | null = null;
      const userData = userDoc.data() as UserData;

      if (userData?.stripeConnectedAccountId) {
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
    const err = error as Error;
    console.error('Error fetching connected account:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
