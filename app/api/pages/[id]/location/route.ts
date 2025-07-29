import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { initAdmin } from '../../../../firebase/admin';
import { getCollectionName } from '../../../../utils/environmentConfig';

interface Location {
  lat: number;
  lng: number;
  zoom?: number;
}

/**
 * PATCH /api/pages/[id]/location
 * Update the location of a specific page
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;
    
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { location } = body;

    console.log('🗺️ Location API: PATCH request received for page:', pageId, 'with location:', location, 'user:', currentUserId);

    // Initialize Firebase Admin
    const admin = initAdmin();
    const db = admin.firestore();

    // Get the page to check ownership
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();
    
    // Check if user owns the page
    if (pageData?.userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Validate location data if provided
    if (location !== null) {
      if (!location || typeof location !== 'object' ||
          typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return NextResponse.json(
          { error: 'Invalid location format. Expected {lat: number, lng: number, zoom?: number}' },
          { status: 400 }
        );
      }

      // Validate coordinate ranges
      if (location.lat < -90 || location.lat > 90 ||
          location.lng < -180 || location.lng > 180) {
        return NextResponse.json(
          { error: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180' },
          { status: 400 }
        );
      }

      // Validate zoom level if provided
      if (location.zoom !== undefined) {
        if (typeof location.zoom !== 'number' || location.zoom < 1 || location.zoom > 20) {
          return NextResponse.json(
            { error: 'Invalid zoom level. Zoom must be a number between 1 and 20' },
            { status: 400 }
          );
        }
      }
    }

    // Update the page with the new location
    const updateData: any = {
      location: location,
      lastModified: new Date().toISOString()
    };

    await pageRef.update(updateData);

    console.log('🗺️ Location API: Successfully updated location for page:', pageId);

    return NextResponse.json({
      success: true,
      pageId,
      location,
      message: location ? 'Location updated successfully' : 'Location cleared successfully'
    });

  } catch (error) {
    console.error('🗺️ Location API: Error updating location:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update location' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pages/[id]/location
 * Get the location of a specific page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;
    
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin
    const admin = initAdmin();
    const db = admin.firestore();

    // Get the page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();
    
    // Check if page is public or user owns it
    const currentUserId = await getUserIdFromRequest(request);
    const isOwner = currentUserId && pageData?.userId === currentUserId;
    const isPublic = pageData?.isPublic === true;

    if (!isOwner && !isPublic) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      pageId,
      location: pageData?.location || null,
      title: pageData?.title || 'Untitled'
    });

  } catch (error) {
    console.error('🗺️ Location API: Error fetching location:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch location' },
      { status: 500 }
    );
  }
}
