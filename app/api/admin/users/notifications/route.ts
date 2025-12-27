import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { withAdminContext } from '../../../../utils/adminRequestContext';

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const adminAuth = await checkAdminPermissions(request);
    if (!adminAuth.success) {
      return NextResponse.json({ error: adminAuth.error || 'Admin access required' }, { status: 403 });
    }

    try {
      const admin = getFirebaseAdmin();
      const db = admin.firestore();

      const notificationsRef = db
        .collection(getCollectionName('users'))
        .doc(uid)
        .collection(getCollectionName('notifications'))
        .orderBy('createdAt', 'desc')
        .limit(limit);

      const snapshot = await notificationsRef.get();
      const notifications = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'unknown',
          title: data.title || '',
          message: data.message || '',
          criticality: data.criticality || 'low',
          read: !!data.read,
          metadata: data.metadata || {},
          createdAt: data.createdAt || null,
          actionUrl: data.actionUrl || null,
        };
      });

      return NextResponse.json({ success: true, notifications });
    } catch (error: any) {
      console.error('[ADMIN] Failed to load notifications', error);
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }
  }); // End withAdminContext
}
