/**
 * Admin API: Admin Users Management
 * Provides endpoints for managing admin user privileges
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
// Admin check function - only jamiegray2234@gmail.com has admin access
const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return userEmail === 'jamiegray2234@gmail.com';
};

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  isAdmin: boolean;
}

// GET endpoint - Get all admin users
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin!.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Loading admin users from Firestore via API...');

    // Get admin users from config
    const adminUsersRef = db.collection('config').doc('adminUsers');
    const adminUsersDoc = await adminUsersRef.get();

    if (!adminUsersDoc.exists) {
      return NextResponse.json({
        success: true,
        adminUsers: [],
        message: 'No admin users configured'
      });
    }

    const adminUserIds = adminUsersDoc.data()?.userIds || [];

    if (adminUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        adminUsers: [],
        message: 'No admin users found'
      });
    }

    // Get user details for each admin user
    const adminUsers: AdminUser[] = [];
    
    for (const adminUserId of adminUserIds) {
      try {
        const userRef = db.collection('users').doc(adminUserId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          adminUsers.push({
            id: adminUserId,
            email: userData?.email || 'No email',
            username: userData?.username,
            displayName: userData?.displayName,
            isAdmin: true
          });
        }
      } catch (error) {
        console.error(`Error loading admin user ${adminUserId}:`, error);
        // Continue processing other users
      }
    }

    console.log(`Successfully loaded ${adminUsers.length} admin users`);

    return NextResponse.json({
      success: true,
      adminUsers,
      total: adminUsers.length
    });

  } catch (error: unknown) {
    console.error('Error loading admin users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load admin users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint - Add or remove admin users
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin!.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetUserId } = body;

    if (!action || !targetUserId) {
      return NextResponse.json({ 
        error: 'action and targetUserId are required' 
      }, { status: 400 });
    }

    // Get current admin users
    const adminUsersRef = db.collection('config').doc('adminUsers');
    const adminUsersDoc = await adminUsersRef.get();
    
    let currentAdminIds: string[] = [];
    if (adminUsersDoc.exists) {
      currentAdminIds = adminUsersDoc.data()?.userIds || [];
    }

    if (action === 'add') {
      // Add user to admin list
      if (!currentAdminIds.includes(targetUserId)) {
        currentAdminIds.push(targetUserId);
        await adminUsersRef.set({ userIds: currentAdminIds });
        
        return NextResponse.json({
          success: true,
          message: `User ${targetUserId} added as admin`
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'User is already an admin'
        }, { status: 400 });
      }
    } else if (action === 'remove') {
      // Remove user from admin list
      const index = currentAdminIds.indexOf(targetUserId);
      if (index > -1) {
        currentAdminIds.splice(index, 1);
        await adminUsersRef.set({ userIds: currentAdminIds });
        
        return NextResponse.json({
          success: true,
          message: `User ${targetUserId} removed from admin`
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'User is not an admin'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "add" or "remove"'
      }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('Error managing admin users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to manage admin users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
