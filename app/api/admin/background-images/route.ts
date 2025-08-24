import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess, createAdminUnauthorizedResponse } from '../../../utils/adminSecurity';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface DefaultBackgroundImage {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  order: number;
  active: boolean;
}

/**
 * GET /api/admin/background-images
 * Fetch all default background images
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  const adminAuth = await verifyAdminAccess(request);
  if (!adminAuth.isAdmin) {
    return createAdminUnauthorizedResponse(adminAuth.auditId);
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Get default background images from Firestore
    const backgroundImagesRef = db.collection(getCollectionName('defaultBackgroundImages'));
    const snapshot = await backgroundImagesRef.orderBy('order', 'asc').get();
    
    const images: DefaultBackgroundImage[] = [];
    snapshot.forEach((doc) => {
      images.push({
        id: doc.id,
        ...doc.data()
      } as DefaultBackgroundImage);
    });

    return NextResponse.json({
      success: true,
      images,
      count: images.length
    });

  } catch (error) {
    console.error('[ADMIN] Error fetching background images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch background images',
        auditId: adminAuth.auditId 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/background-images
 * Upload a new default background image
 */
export async function POST(request: NextRequest) {
  console.log('🖼️ [API] Background image upload request received');

  // Verify admin access
  const adminAuth = await verifyAdminAccess(request);
  if (!adminAuth.isAdmin) {
    console.log('🖼️ [API] Admin access denied');
    return createAdminUnauthorizedResponse(adminAuth.auditId);
  }

  console.log('🖼️ [API] Admin access verified');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const order = parseInt(formData.get('order') as string) || 0;

    console.log('🖼️ [API] Form data parsed:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      order
    });

    if (!file) {
      console.log('🖼️ [API] No file provided in request');
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.log('🖼️ [API] File too large:', file.size);
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    console.log('🖼️ [API] File validation passed, initializing Firebase...');
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('🖼️ [API] Firebase Admin initialization failed');
      return NextResponse.json(
        { success: false, error: 'Firebase initialization failed' },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const storage = admin.storage();
    const bucket = storage.bucket();

    console.log('🖼️ [API] Firebase services initialized:', {
      hasDb: !!db,
      hasStorage: !!storage,
      hasBucket: !!bucket,
      bucketName: bucket.name
    });

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const filename = `default-bg-${timestamp}.${fileExtension}`;
    const filePath = `backgrounds/defaults/${filename}`;

    console.log('🖼️ [API] Generated filename:', filename);
    console.log('🖼️ [API] Upload path:', filePath);

    // Upload to Firebase Storage
    console.log('🖼️ [API] Converting file to buffer...');
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileRef = bucket.file(filePath);

    console.log('🖼️ [API] Uploading to Firebase Storage...');
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: adminAuth.userEmail || 'unknown',
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      }
    });

    // Make file publicly accessible
    console.log('🖼️ [API] Making file public...');
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    console.log('🖼️ [API] Public URL generated:', publicUrl);

    // Save metadata to Firestore
    const imageData: Omit<DefaultBackgroundImage, 'id'> = {
      filename,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminAuth.userEmail || 'unknown',
      order,
      active: true
    };

    console.log('🖼️ [API] Saving metadata to Firestore...');
    const docRef = await db.collection(getCollectionName('defaultBackgroundImages')).add(imageData);
    console.log('🖼️ [API] Document created with ID:', docRef.id);

    console.log('🖼️ [API] Upload completed successfully');
    return NextResponse.json({
      success: true,
      image: {
        id: docRef.id,
        ...imageData
      }
    });

  } catch (error) {
    console.error('[ADMIN] Error uploading background image:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to upload background image',
        auditId: adminAuth.auditId 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/background-images
 * Update image order or active status
 */
export async function PUT(request: NextRequest) {
  // Verify admin access
  const adminAuth = await verifyAdminAccess(request);
  if (!adminAuth.isAdmin) {
    return createAdminUnauthorizedResponse(adminAuth.auditId);
  }

  try {
    const { images } = await request.json();

    if (!Array.isArray(images)) {
      return NextResponse.json(
        { success: false, error: 'Images array is required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const batch = db.batch();

    // Update each image
    for (const image of images) {
      const docRef = db.collection(getCollectionName('defaultBackgroundImages')).doc(image.id);
      batch.update(docRef, {
        order: image.order,
        active: image.active
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Background images updated successfully'
    });

  } catch (error) {
    console.error('[ADMIN] Error updating background images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update background images',
        auditId: adminAuth.auditId 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/background-images/[id]
 * Delete a default background image
 */
export async function DELETE(request: NextRequest) {
  // Verify admin access
  const adminAuth = await verifyAdminAccess(request);
  if (!adminAuth.isAdmin) {
    return createAdminUnauthorizedResponse(adminAuth.auditId);
  }

  try {
    const url = new URL(request.url);
    const imageId = url.searchParams.get('id');

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID is required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const storage = admin.storage();
    const bucket = storage.bucket();

    // Get image data
    const docRef = db.collection(getCollectionName('defaultBackgroundImages')).doc(imageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageData = doc.data() as DefaultBackgroundImage;

    // Delete from Firebase Storage
    const filePath = `backgrounds/defaults/${imageData.filename}`;
    const fileRef = bucket.file(filePath);
    
    try {
      await fileRef.delete();
    } catch (storageError) {
      console.warn('[ADMIN] Could not delete file from storage:', storageError);
      // Continue with Firestore deletion even if storage deletion fails
    }

    // Delete from Firestore
    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Background image deleted successfully'
    });

  } catch (error) {
    console.error('[ADMIN] Error deleting background image:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete background image',
        auditId: adminAuth.auditId 
      },
      { status: 500 }
    );
  }
}
