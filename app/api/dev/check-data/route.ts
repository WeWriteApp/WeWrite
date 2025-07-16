import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Checking test data...');
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    // Check users
    const usersCollectionName = getCollectionName('users');
    console.log('🔍 Checking users in collection:', usersCollectionName);
    
    const usersSnapshot = await db.collection(usersCollectionName).limit(10).get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data()?.username,
      totalPages: doc.data()?.totalPages || 0,
      publicPages: doc.data()?.publicPages || 0
    }));
    
    // Check pages
    const pagesCollectionName = getCollectionName('pages');
    console.log('🔍 Checking pages in collection:', pagesCollectionName);
    
    const pagesSnapshot = await db.collection(pagesCollectionName).limit(10).get();
    const pages = pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data()?.title,
      userId: doc.data()?.userId,
      username: doc.data()?.username,
      isPublic: doc.data()?.isPublic,
      content: doc.data()?.content,
      hasContent: doc.data()?.content !== null && doc.data()?.content !== undefined
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        usersCollection: usersCollectionName,
        pagesCollection: pagesCollectionName,
        users: users,
        pages: pages,
        userCount: usersSnapshot.size,
        pageCount: pagesSnapshot.size
      }
    });
    
  } catch (error) {
    console.error('🔍 Data check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'unknown'
    }, { status: 500 });
  }
}
