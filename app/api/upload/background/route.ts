import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { uploadBackgroundImageServer, deleteBackgroundImageByFilenameServer } from '../../../firebase/storage-server';

export async function POST(request: NextRequest) {
  console.log('[Background Upload API] Starting upload request');
  console.log('[Background Upload API] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('[Background Upload API] Request cookies:', request.cookies.getAll());

  try {
    // Get authenticated user ID
    console.log('[Background Upload API] Getting user ID from request...');
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log('[Background Upload API] No user ID found - unauthorized');
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }
    console.log(`[Background Upload API] User authenticated: ${userId}`);

    console.log('[Background Upload API] Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.log('[Background Upload API] No file provided in form data');
      return createErrorResponse('BAD_REQUEST', 'No file provided');
    }

    console.log(`[Background Upload API] File received: ${file.name} (${file.size} bytes, ${file.type})`);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log(`[Background Upload API] Invalid file type: ${file.type}`);
      return createErrorResponse('BAD_REQUEST', 'File must be an image');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.log(`[Background Upload API] File too large: ${file.size} bytes`);
      return createErrorResponse('BAD_REQUEST', 'File too large (max 10MB)');
    }

    // Get Firebase Admin instance
    console.log('[Background Upload API] Getting Firebase Admin instance...');
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Background Upload API] Failed to get Firebase Admin instance');
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }
    const db = admin.firestore();

    // Get current user data to check for existing background image
    console.log('[Background Upload API] Getting user data...');
    const collectionName = await getCollectionNameAsync('users');
    console.log(`[Background Upload API] Using collection: ${collectionName}`);
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const userData = userDoc.data();

    // Delete old background image if it exists
    if (userData?.backgroundImage?.filename) {
      console.log(`[Background Upload API] Deleting old background image: ${userData.backgroundImage.filename}`);
      await deleteBackgroundImageByFilenameServer(userId, userData.backgroundImage.filename);
    }

    // Upload new image to Firebase Storage
    console.log('[Background Upload API] Uploading to Firebase Storage...');
    const downloadURL = await uploadBackgroundImageServer(file, userId);

    if (!downloadURL) {
      console.error('[Background Upload API] Upload failed - no download URL returned');
      return createErrorResponse('INTERNAL_ERROR', 'Failed to upload image to storage');
    }

    console.log(`[Background Upload API] Upload successful: ${downloadURL}`);

    // Generate filename for tracking (should match the one generated in storage-server.ts)
    const timestamp = Date.now();
    const extension = file.type.split('/')[1] || 'jpg';
    const filename = `background-${timestamp}.${extension}`;

    // Save background image info to user document
    console.log('[Background Upload API] Saving to user document...');
    const backgroundImageData = {
      url: downloadURL,
      filename: filename,
      uploadedAt: new Date().toISOString()
    };

    await db.collection(collectionName).doc(userId).update({
      backgroundImage: backgroundImageData
    });

    console.log('[Background Upload API] Upload completed successfully');
    return createApiResponse({
      url: downloadURL,
      filename: filename
    });

  } catch (error) {
    console.error('[Background Upload API] Upload error:', error);
    console.error('[Background Upload API] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    return createErrorResponse('INTERNAL_ERROR', `Failed to upload background image: ${error.message}`);
  }
}

// GET endpoint to retrieve user's background image
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const collectionName = await getCollectionNameAsync('users');
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.backgroundImage) {
      return createApiResponse({ backgroundImage: null });
    }

    return createApiResponse({
      backgroundImage: userData.backgroundImage
    });

  } catch (error) {
    console.error('Background retrieval error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve background image');
  }
}

// DELETE endpoint to remove user's background image
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Get current user data
    const collectionName = await getCollectionNameAsync('users');
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.backgroundImage) {
      return createApiResponse({ success: true, message: 'No background image to delete' });
    }

    // Delete from Firebase Storage
    if (userData.backgroundImage.filename) {
      await deleteBackgroundImageByFilenameServer(userId, userData.backgroundImage.filename);
    }

    // Remove from user document
    await db.collection(collectionName).doc(userId).update({
      backgroundImage: null
    });

    return createApiResponse({ success: true, message: 'Background image deleted' });

  } catch (error) {
    console.error('Background deletion error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete background image');
  }
}
