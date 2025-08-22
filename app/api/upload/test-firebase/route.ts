import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    console.log('[Firebase Test] Starting Firebase Admin test...');
    console.log('[Firebase Test] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[Firebase Test] Request cookies:', request.cookies.getAll());

    // Test authentication
    const userId = await getUserIdFromRequest(request);
    console.log('[Firebase Test] User ID from auth:', userId);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required for test - no user ID found');
    }
    
    console.log(`[Firebase Test] User authenticated: ${userId}`);
    
    // Test Firebase Admin initialization
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }
    
    console.log('[Firebase Test] Firebase Admin initialized successfully');
    
    // Test Firestore access
    const db = admin.firestore();
    const testDoc = await db.collection('test').doc('connection-test').get();
    console.log('[Firebase Test] Firestore connection test completed');
    
    // Test Storage access
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_BUCKET || 'wewrite-ccd82.appspot.com';
    const bucket = admin.storage().bucket(bucketName);
    console.log(`[Firebase Test] Storage bucket initialized: ${bucketName}`);
    
    // Test if we can list files (this will fail if permissions are wrong)
    try {
      const [files] = await bucket.getFiles({ prefix: 'backgrounds/', maxResults: 1 });
      console.log(`[Firebase Test] Storage access test completed - found ${files.length} files`);
    } catch (storageError) {
      console.error('[Firebase Test] Storage access failed:', storageError);
      return createErrorResponse('INTERNAL_ERROR', `Storage access failed: ${storageError.message}`);
    }
    
    return createApiResponse({
      status: 'success',
      userId: userId,
      firebaseAdmin: 'initialized',
      firestore: 'connected',
      storage: 'accessible',
      bucket: bucketName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Firebase Test] Test failed:', error);
    return createErrorResponse('INTERNAL_ERROR', `Firebase test failed: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Firebase Test POST] Starting Firebase Admin test via POST...');
    console.log('[Firebase Test POST] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[Firebase Test POST] Request cookies:', request.cookies.getAll());

    // Test authentication
    const userId = await getUserIdFromRequest(request);
    console.log('[Firebase Test POST] User ID from auth:', userId);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required for POST test - no user ID found');
    }

    console.log(`[Firebase Test POST] User authenticated: ${userId}`);

    return createApiResponse({
      status: 'success',
      method: 'POST',
      userId: userId,
      message: 'POST authentication test successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Firebase Test POST] Test failed:', error);
    return createErrorResponse('INTERNAL_ERROR', `Firebase POST test failed: ${error.message}`);
  }
}
