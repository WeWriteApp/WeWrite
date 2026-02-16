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

      // Validate latitude (no wrap-around needed)
      if (location.lat < -90 || location.lat > 90) {
        return NextResponse.json(
          { error: 'Invalid latitude. Latitude must be between -90 and 90' },
          { status: 400 }
        );
      }

      // Normalize longitude to handle wrap-around (e.g., 181° becomes -179°)
      let normalizedLng = location.lng;
      while (normalizedLng > 180) {
        normalizedLng -= 360;
      }
      while (normalizedLng < -180) {
        normalizedLng += 360;
      }

      // Update the location object with normalized longitude
      location.lng = normalizedLng;

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

    // Create a version record for this location change
    const now = new Date().toISOString();

    try {
      // Get current user data for version record
      const userRef = db.collection(getCollectionName('users')).doc(currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const username = userData?.username || 'Anonymous';

      // Create version data for location change
      const versionData = {
        content: pageData.content || '', // Keep existing content
        title: pageData.title || 'Untitled',
        createdAt: now,
        userId: currentUserId,
        username: username,
        previousVersionId: pageData.currentVersion || null,
        groupId: pageData.groupId || null,

        // Special metadata for location changes
        changeType: 'location',
        locationChange: {
          from: pageData.location || null,
          to: location
        },

        // No content diff for location changes
        diff: {
          added: 0,
          removed: 0,
          hasChanges: true // Always true for location changes
        }
      };

      // Create the version document
      const versionRef = await pageRef.collection('versions').add(versionData);

      // Update the page with the new location and version info
      const updateData: any = {
        location: location,
        lastModified: now,
        currentVersion: versionRef.id,
        // Add lastDiff for recent edits display
        lastDiff: {
          added: 0,
          removed: 0,
          hasChanges: true,
          preview: location ? 'Added location' : 'Removed location'
        }
      };

      await pageRef.update(updateData);

    } catch (versionError) {
      console.error('🗺️ Location API: Error creating version record (non-fatal):', versionError);

      // Fallback: just update the location without version record
      const updateData: any = {
        location: location,
        lastModified: now
      };
      await pageRef.update(updateData);
    }

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
