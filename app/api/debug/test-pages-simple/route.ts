import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';

// Initialize Firebase Admin SDK
let testApp;
try {
  const existingApps = getApps();
  testApp = existingApps.find(app => app.name === 'test-pages-simple') ||
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    }, 'test-pages-simple');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export async function GET(request: NextRequest) {
  try {
    const db = getFirestore(testApp);
    
    console.log(`🔍 [TEST] Testing simple pages query`);
    console.log(`🔍 [TEST] Collection name: ${getCollectionName('pages')}`);
    
    // Test 1: Get any 5 pages
    const simpleQuery = db.collection(getCollectionName('pages')).limit(5);
    const simpleSnapshot = await simpleQuery.get();
    
    console.log(`🔍 [TEST] Simple query returned ${simpleSnapshot.size} pages`);
    
    const pages = simpleSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        isPublic: data.isPublic,
        deleted: data.deleted,
        lastModified: data.lastModified?.toDate ? data.lastModified.toDate().toISOString() : data.lastModified,
        userId: data.userId,
        username: data.username
      };
    });
    
    // Test 2: Get public pages only
    const publicQuery = db.collection(getCollectionName('pages')).where('isPublic', '==', true).limit(5);
    const publicSnapshot = await publicQuery.get();
    
    console.log(`🔍 [TEST] Public query returned ${publicSnapshot.size} pages`);
    
    const publicPages = publicSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        isPublic: data.isPublic,
        deleted: data.deleted,
        lastModified: data.lastModified?.toDate ? data.lastModified.toDate().toISOString() : data.lastModified,
        userId: data.userId,
        username: data.username
      };
    });
    
    return NextResponse.json({
      success: true,
      collectionName: getCollectionName('pages'),
      totalPages: simpleSnapshot.size,
      publicPages: publicSnapshot.size,
      samplePages: pages,
      samplePublicPages: publicPages,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
