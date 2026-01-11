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

    // Validate file type - check both MIME type and file extension
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      return createErrorResponse('BAD_REQUEST', 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP');
    }

    // Check file extension (prevent MIME type spoofing)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return createErrorResponse('BAD_REQUEST', 'Invalid file extension. Allowed: .jpg, .jpeg, .png, .gif, .webp');
    }

    // Validate file magic bytes (first few bytes that identify file type)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 12));

    const isValidMagic = (
      // JPEG: FF D8 FF
      (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) ||
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) ||
      // GIF: 47 49 46 38
      (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) ||
      // WebP: 52 49 46 46 ... 57 45 42 50
      (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
       bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    );

    if (!isValidMagic) {
      return createErrorResponse('BAD_REQUEST', 'File content does not match a valid image format');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return createErrorResponse('BAD_REQUEST', 'File too large (max 10MB)');
    }

    // Create a new File object from the buffer (since we consumed the original reading magic bytes)
    const validatedFile = new File([buffer], file.name, { type: file.type });

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

    // Upload new image to Firebase Storage (use validatedFile which was recreated from buffer)
    const downloadURL = await uploadBackgroundImageServer(validatedFile, userId);

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
