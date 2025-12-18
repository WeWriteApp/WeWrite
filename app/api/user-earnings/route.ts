import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

interface EarningData {
  amount?: number;
  source?: string;
  sourcePageId?: string;
  type?: string;
  status?: string;
  createdAt?: { toDate?: () => Date };
}

interface Earning {
  id: string;
  amount: number;
  source: string;
  sourcePageId?: string;
  sourcePageTitle: string;
  date: string;
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
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const earningsRef = db.collection(getCollectionName('earnings'))
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50);

      const earningsSnapshot = await earningsRef.get();
      const earnings: Earning[] = [];

      for (const doc of earningsSnapshot.docs) {
        const earningData = doc.data() as EarningData;

        let pageTitle = 'Unknown Page';
        if (earningData.sourcePageId) {
          try {
            const pageDoc = await db.collection(getCollectionName('pages')).doc(earningData.sourcePageId).get();
            if (pageDoc.exists) {
              const pageData = pageDoc.data();
              pageTitle = pageData?.title || 'Untitled Page';
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
    const err = error as Error;
    console.error('Error fetching user earnings:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
