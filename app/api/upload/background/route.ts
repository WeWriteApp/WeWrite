import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { uploadBackgroundImageServer, deleteBackgroundImageByFilenameServer } from '../../../firebase/storage-server';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Check subscription status
    const { getUserSubscriptionServer } = await import('../../../firebase/subscription-server');
    const subscription = await getUserSubscriptionServer(userId, { verbose: false });

    if (!subscription || subscription.status !== 'active' || (subscription.amount || 0) <= 0) {
      return createErrorResponse('FORBIDDEN', 'Custom background images require an active subscription');
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return createErrorResponse('BAD_REQUEST', 'No file provided');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return createErrorResponse('BAD_REQUEST', 'File must be an image');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return createErrorResponse('BAD_REQUEST', 'File too large (max 10MB)');
    }

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }
    const db = admin.firestore();

    // Get current user data to check for existing background image
    const collectionName = await getCollectionNameAsync('users');
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const userData = userDoc.data();

    // Delete old background image if it exists
    if (userData?.backgroundImage?.filename) {
      await deleteBackgroundImageByFilenameServer(userId, userData.backgroundImage.filename);
    }

    // Upload new image to Firebase Storage
    const downloadURL = await uploadBackgroundImageServer(file, userId);

    if (!downloadURL) {
      return createErrorResponse('INTERNAL_ERROR', 'Failed to upload image to storage');
    }

    // Generate filename for tracking (should match the one generated in storage-server.ts)
    const timestamp = Date.now();
    const extension = file.type.split('/')[1] || 'jpg';
    const filename = `background-${timestamp}.${extension}`;

    // Save background image info to user document
    const backgroundImageData = {
      url: downloadURL,
      filename: filename,
      uploadedAt: new Date().toISOString()
    };

    // Also save as the active background preference
    const imageBackgroundPreference = {
      type: 'image',
      data: {
        type: 'image',
        url: downloadURL,
        opacity: 0.15
      },
      updatedAt: new Date().toISOString()
    };

    await db.collection(collectionName).doc(userId).update({
      backgroundImage: backgroundImageData,
      backgroundPreference: imageBackgroundPreference
    });

    return createApiResponse({
      url: downloadURL,
      filename: filename
    });

  } catch (error) {
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
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete background image');
  }
}
