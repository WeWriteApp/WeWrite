import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';

/**
 * Update location for a page
 * PATCH /api/pages/[id]/location
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get the current user ID for authorization
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { location } = await request.json();

    // Validate location format if provided
    if (location !== null && location !== undefined) {
      if (typeof location !== 'object' || 
          typeof location.lat !== 'number' || 
          typeof location.lng !== 'number') {
        return NextResponse.json(
          { error: 'Location must be an object with lat and lng numbers, or null' },
          { status: 400 }
        );
      }

      // Validate coordinate ranges
      if (location.lat < -90 || location.lat > 90) {
        return NextResponse.json(
          { error: 'Latitude must be between -90 and 90' },
          { status: 400 }
        );
      }

      if (location.lng < -180 || location.lng > 180) {
        return NextResponse.json(
          { error: 'Longitude must be between -180 and 180' },
          { status: 400 }
        );
      }
    }

    // Use Firebase Admin SDK for server-side operations
    const { getFirebaseAdmin } = await import('../../../../firebase/admin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const db = admin.firestore();
    const { getCollectionName } = await import('../../../../utils/environmentConfig');
    
    // Get the page document
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // Check if the user owns this page
    if (pageData.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only edit your own pages' },
        { status: 403 }
      );
    }

    // Check if page is deleted
    if (pageData.deleted) {
      return NextResponse.json(
        { error: 'Cannot edit deleted pages' },
        { status: 400 }
      );
    }

    // Update the location
    await pageRef.update({
      location: location,
      lastModified: new Date().toISOString()
    });

    console.log(`Location updated successfully for page ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
      location: location
    });

  } catch (error) {
    console.error('Error updating page location:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
