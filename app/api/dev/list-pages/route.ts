import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    console.log('🔍 Listing pages in dev environment...');
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const pagesCollectionName = getCollectionName('pages');
    console.log('📄 Checking collection:', pagesCollectionName);
    
    const pagesSnapshot = await db.collection(pagesCollectionName).limit(20).get();
    
    const pages = pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data()?.title,
      userId: doc.data()?.userId,
      username: doc.data()?.username,
      isPublic: doc.data()?.isPublic,
      deleted: doc.data()?.deleted,
      createdAt: doc.data()?.createdAt,
      lastModified: doc.data()?.lastModified
    }));
    
    return NextResponse.json({
      success: true,
      collection: pagesCollectionName,
      count: pagesSnapshot.size,
      pages: pages
    });
    
  } catch (error) {
    console.error('❌ Error listing pages:', error);
    return NextResponse.json({
      error: 'Failed to list pages',
      details: error.message
    }, { status: 500 });
  }
}
