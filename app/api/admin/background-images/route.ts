import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess, createAdminUnauthorizedResponse } from '../../../utils/adminSecurity';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

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
  return withAdminContext(request, async () => {
    // Verify admin access
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }

    try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get default background images from Firestore
    const backgroundImagesRef = db.collection(getCollectionName(COLLECTIONS.DEFAULT_BACKGROUND_IMAGES));

    let snapshot;
    try {
      snapshot = await backgroundImagesRef.orderBy('order', 'asc').get();
    } catch (indexError) {
      // If there's an index issue or collection doesn't exist, return empty results for admin
      return NextResponse.json({
        success: true,
        images: [],
        count: 0
      });
    }

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
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch background images',
          auditId: adminAuth.auditId
        },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * POST /api/admin/background-images
 * Upload a new default background image
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    // Verify admin access
    const adminAuth = await verifyAdminAccess(request);

    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }

    try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const order = parseInt(formData.get('order') as string) || 0;

    if (!file) {
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
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json(
          { success: false, error: 'Firebase initialization failed - null instance' },
          { status: 500 }
        );
      }
    } catch (initError) {
      return NextResponse.json(
        { success: false, error: `Firebase initialization failed: ${initError.message}` },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const storage = admin.storage();

    // Try to get the correct bucket
    let bucket;
    const possibleBuckets = [
      process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
      'wewrite-ccd82.appspot.com',
      'wewrite-ccd82.firebasestorage.app',
      'wewrite-ccd82-storage'
    ].filter(Boolean);

    for (const bucketName of possibleBuckets) {
      try {
        bucket = storage.bucket(bucketName);
        await bucket.getMetadata(); // Test if bucket exists
        break;
      } catch (bucketError) {
        bucket = null;
      }
    }

    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'Storage bucket not accessible' },
        { status: 500 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const filename = `default-bg-${timestamp}.${fileExtension}`;
    const filePath = `backgrounds/defaults/${filename}`;

    // Upload to Firebase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileRef = bucket.file(filePath);

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
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Save metadata to Firestore
    const imageData: Omit<DefaultBackgroundImage, 'id'> = {
      filename,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminAuth.userEmail || 'unknown',
      order,
      active: true
    };

    const docRef = await db.collection(getCollectionName(COLLECTIONS.DEFAULT_BACKGROUND_IMAGES)).add(imageData);

    return NextResponse.json({
      success: true,
      image: {
        id: docRef.id,
        ...imageData
      }
    });

    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload background image',
          auditId: adminAuth.auditId
        },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * PUT /api/admin/background-images
 * Update image order or active status
 */
export async function PUT(request: NextRequest) {
  return withAdminContext(request, async () => {
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
      const docRef = db.collection(getCollectionName(COLLECTIONS.DEFAULT_BACKGROUND_IMAGES)).doc(image.id);
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
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update background images',
          auditId: adminAuth.auditId
        },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * DELETE /api/admin/background-images/[id]
 * Delete a default background image
 */
export async function DELETE(request: NextRequest) {
  return withAdminContext(request, async () => {
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
    const docRef = db.collection(getCollectionName(COLLECTIONS.DEFAULT_BACKGROUND_IMAGES)).doc(imageId);
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
      // Continue with Firestore deletion even if storage deletion fails
    }

    // Delete from Firestore
    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Background image deleted successfully'
    });

    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete background image',
          auditId: adminAuth.auditId
        },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}
