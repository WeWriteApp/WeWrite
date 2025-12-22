// Server-side Firebase Storage utilities using Firebase Admin SDK
// This file should ONLY be imported in API routes and server components

import { getFirebaseAdmin } from './firebaseAdmin';

/**
 * Upload background image to Firebase Storage using Admin SDK
 * @param imageFile - The image file to upload
 * @param userId - The user ID for organizing files
 * @returns Promise<string | null> - The download URL or null if failed
 */
export const uploadBackgroundImageServer = async (
  imageFile: File,
  userId: string
): Promise<string | null> => {
  if (!imageFile || !userId) {
    return null;
  }

  try {
    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return null;
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_BUCKET || 'wewrite-ccd82-storage';

    // Try different bucket name patterns if the primary one fails
    const possibleBuckets = [
      bucketName,
      'wewrite-ccd82-storage',             // Our created bucket
      'wewrite-ccd82.firebasestorage.app', // New Firebase Storage domain
      'wewrite-ccd82.appspot.com',         // Legacy domain
      'wewrite-ccd82'                      // Just project ID
    ];

    let workingBucket = null;
    let lastError = null;

    for (const testBucketName of possibleBuckets) {
      try {
        const testBucket = admin.storage().bucket(testBucketName);
        await testBucket.getMetadata();
        workingBucket = testBucket;
        break;
      } catch (bucketError) {
        lastError = bucketError;
      }
    }

    if (!workingBucket) {
      throw new Error(`Cannot access any storage bucket. Tried: ${possibleBuckets.join(', ')}. Last error: ${lastError?.message}`);
    }

    const bucket = workingBucket;

    // Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate filename
    const fileType = imageFile.type.split("/")[1] || 'jpg';
    const fileName = `background-${new Date().getTime()}.${fileType}`;
    const filePath = `backgrounds/${userId}/${fileName}`;

    // Create file reference
    const file = bucket.file(filePath);

    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType: imageFile.type,
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          originalName: imageFile.name
        }
      }
    });

    // Make the file publicly readable
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return publicUrl;
  } catch (error) {
    return null;
  }
};

/**
 * Delete background image by filename using Admin SDK
 * @param userId - The user ID
 * @param filename - The filename to delete
 * @returns Promise<boolean> - Success status
 */
export const deleteBackgroundImageByFilenameServer = async (
  userId: string,
  filename: string
): Promise<boolean> => {
  if (!userId || !filename) {
    return false;
  }

  try {
    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return false;
    }
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_BUCKET || 'wewrite-ccd82.appspot.com';
    const bucket = admin.storage().bucket(bucketName);

    // Create file reference
    const filePath = `backgrounds/${userId}/${filename}`;
    const file = bucket.file(filePath);

    // Delete the file
    await file.delete();
    return true;
  } catch (error) {
    return false;
  }
};
