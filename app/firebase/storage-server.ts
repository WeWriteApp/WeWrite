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
    console.error("[Storage Server] Missing required parameters for background image upload");
    return null;
  }

  console.log(`[Storage Server] Starting upload for user ${userId}, file: ${imageFile.name} (${imageFile.size} bytes, ${imageFile.type})`);

  try {
    // Get Firebase Admin instance
    console.log("[Storage Server] Getting Firebase Admin instance...");
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error("[Storage Server] Failed to get Firebase Admin instance");
      return null;
    }

    // Log service account info for debugging
    try {
      const app = admin.app();
      console.log(`[Storage Server] Firebase app name: ${app.name}`);
      console.log(`[Storage Server] Firebase project ID: ${app.options.projectId}`);
    } catch (appError) {
      console.log(`[Storage Server] Could not get app info: ${appError.message}`);
    }
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_BUCKET || 'wewrite-ccd82-storage';
    console.log(`[Storage Server] Using bucket: ${bucketName}`);
    console.log(`[Storage Server] Environment bucket var: ${process.env.NEXT_PUBLIC_FIREBASE_BUCKET}`);

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
        console.log(`[Storage Server] Testing bucket: ${testBucketName}`);
        const testBucket = admin.storage().bucket(testBucketName);
        await testBucket.getMetadata();
        console.log(`[Storage Server] ✅ Bucket access verified: ${testBucketName}`);
        workingBucket = testBucket;
        break;
      } catch (bucketError) {
        console.log(`[Storage Server] ❌ Bucket failed: ${testBucketName} - ${bucketError.message}`);
        lastError = bucketError;
      }
    }

    if (!workingBucket) {
      console.error(`[Storage Server] All bucket attempts failed. Last error:`, lastError);
      throw new Error(`Cannot access any storage bucket. Tried: ${possibleBuckets.join(', ')}. Last error: ${lastError?.message}`);
    }

    const bucket = workingBucket;

    // Convert File to Buffer
    console.log("[Storage Server] Converting file to buffer...");
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Storage Server] Buffer created: ${buffer.length} bytes`);

    // Generate filename
    const fileType = imageFile.type.split("/")[1] || 'jpg';
    const fileName = `background-${new Date().getTime()}.${fileType}`;
    const filePath = `backgrounds/${userId}/${fileName}`;
    console.log(`[Storage Server] Generated file path: ${filePath}`);

    // Create file reference
    const file = bucket.file(filePath);

    // Upload the file
    console.log("[Storage Server] Uploading file to Firebase Storage...");
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
    console.log("[Storage Server] File uploaded successfully");

    // Make the file publicly readable
    console.log("[Storage Server] Making file publicly readable...");
    await file.makePublic();
    console.log("[Storage Server] File made public");

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    console.log(`[Storage Server] Generated public URL: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error("[Storage Server] Error uploading background image:", error);
    console.error("[Storage Server] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
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
      console.error("[Storage Server] Failed to get Firebase Admin instance for deletion");
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
    console.error("Error deleting background image by filename:", error);
    return false;
  }
};
