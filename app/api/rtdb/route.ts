import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { initAdmin } from '../../firebase/admin';

/**
 * Real-time Database API Route
 * 
 * GET: Read data from RTDB
 * POST: Write data to RTDB
 * PUT: Update data in RTDB
 * DELETE: Remove data from RTDB
 * 
 * This route replaces direct Firebase RTDB calls with API endpoints
 * and provides environment-aware access to real-time database.
 */

// GET /api/rtdb?path=/users/userId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return createErrorResponse('Path parameter is required', 'BAD_REQUEST');
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return createErrorResponse('Path must start with /', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const rtdb = admin.database();

    const snapshot = await rtdb.ref(path).once('value');
    const data = snapshot.val();

    return createApiResponse({
      data,
      path,
      exists: snapshot.exists()
    });

  } catch (error) {
    console.error('Error reading from RTDB:', error);
    return createErrorResponse('Failed to read from real-time database', 'INTERNAL_ERROR');
  }
}

// POST /api/rtdb
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { path, data } = body;

    if (!path || data === undefined) {
      return createErrorResponse('Path and data are required', 'BAD_REQUEST');
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return createErrorResponse('Path must start with /', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const rtdb = admin.database();

    // Use push() to generate a new key if path ends with '/'
    if (path.endsWith('/')) {
      const ref = await rtdb.ref(path).push(data);
      return createApiResponse({
        success: true,
        message: 'Data added to real-time database',
        path,
        key: ref.key,
        fullPath: `${path}${ref.key}`
      });
    } else {
      // Use set() for specific path
      await rtdb.ref(path).set(data);
      return createApiResponse({
        success: true,
        message: 'Data set in real-time database',
        path
      });
    }

  } catch (error) {
    console.error('Error writing to RTDB:', error);
    return createErrorResponse('Failed to write to real-time database', 'INTERNAL_ERROR');
  }
}

// PUT /api/rtdb
export async function PUT(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { path, data } = body;

    if (!path || data === undefined) {
      return createErrorResponse('Path and data are required', 'BAD_REQUEST');
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return createErrorResponse('Path must start with /', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const rtdb = admin.database();

    await rtdb.ref(path).update(data);

    return createApiResponse({
      success: true,
      message: 'Data updated in real-time database',
      path
    });

  } catch (error) {
    console.error('Error updating RTDB:', error);
    return createErrorResponse('Failed to update real-time database', 'INTERNAL_ERROR');
  }
}

// DELETE /api/rtdb
export async function DELETE(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return createErrorResponse('Path parameter is required', 'BAD_REQUEST');
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return createErrorResponse('Path must start with /', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const rtdb = admin.database();

    await rtdb.ref(path).remove();

    return createApiResponse({
      success: true,
      message: 'Data removed from real-time database',
      path
    });

  } catch (error) {
    console.error('Error deleting from RTDB:', error);
    return createErrorResponse('Failed to delete from real-time database', 'INTERNAL_ERROR');
  }
}
