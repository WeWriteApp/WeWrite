/**
 * User Logout API
 * Handles user logout and session cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse, getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { cookies } from 'next/headers';

// POST endpoint - User logout
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    // Get user ID from request (if authenticated)
    const currentUserId = await getUserIdFromRequest(request);
    
    // Clear authentication cookies
    const cookieStore = cookies();

    console.log('🔴 LOGOUT API: Clearing all session cookies');

    // List of all possible session cookies to clear
    const sessionCookies = [
      'userSession',
      'authToken',
      'firebase-auth-token',
      '__session',
      'session',
      'authenticated',
      'devUserSession',
      'currentUser',
      'previousUserSession',
      'accountSwitchInProgress',
      'switchToAccount'
    ];

    // Remove all session cookies
    sessionCookies.forEach(cookieName => {
      try {
        cookieStore.delete(cookieName);
        console.log(`🔴 LOGOUT API: Cleared cookie: ${cookieName}`);
      } catch (error) {
        console.warn(`🔴 LOGOUT API: Failed to clear cookie ${cookieName}:`, error);
      }
    });

    // If user was authenticated, update their last logout time
    if (currentUserId) {
      try {
        await db.collection('users').doc(currentUserId).update({
          lastLogoutAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        });

        // Optionally revoke all refresh tokens for this user
        // This will sign out the user from all devices
        // Uncomment if you want to implement this behavior
        // await auth.revokeRefreshTokens(currentUserId);

      } catch (updateError) {
        console.error('Failed to update logout time:', updateError);
        // Don't fail the logout if this update fails
      }
    }

    return createApiResponse({
      message: 'Logged out successfully',
      loggedOut: true
    });

  } catch (error: any) {
    console.error('Logout error:', error);
    
    // Even if there's an error, we should still clear the cookies
    // and return success to ensure the client-side logout works
    const cookieStore = cookies();

    const sessionCookies = [
      'userSession', 'authToken', 'firebase-auth-token', '__session',
      'session', 'authenticated', 'devUserSession', 'currentUser',
      'previousUserSession', 'accountSwitchInProgress', 'switchToAccount'
    ];

    sessionCookies.forEach(cookieName => {
      try {
        cookieStore.delete(cookieName);
      } catch (error) {
        console.warn(`Failed to clear cookie ${cookieName}:`, error);
      }
    });
    
    return createApiResponse({
      message: 'Logged out (with errors)',
      loggedOut: true,
      warning: 'Some cleanup operations failed'
    });
  }
}

// DELETE endpoint - Revoke all sessions (sign out from all devices)
export async function DELETE(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    // Get user ID from request
    const currentUserId = await getUserIdFromRequest(request);
    
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Revoke all refresh tokens for this user
    // This will sign out the user from all devices
    await auth.revokeRefreshTokens(currentUserId);

    // Update user document
    await db.collection('users').doc(currentUserId).update({
      lastGlobalLogoutAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    });

    // Clear authentication cookies for current session
    const cookieStore = cookies();

    const sessionCookies = [
      'userSession', 'authToken', 'firebase-auth-token', '__session',
      'session', 'authenticated', 'devUserSession', 'currentUser',
      'previousUserSession', 'accountSwitchInProgress', 'switchToAccount'
    ];

    sessionCookies.forEach(cookieName => {
      try {
        cookieStore.delete(cookieName);
      } catch (error) {
        console.warn(`Failed to clear cookie ${cookieName}:`, error);
      }
    });

    return createApiResponse({
      message: 'Signed out from all devices successfully',
      globalLogout: true
    });

  } catch (error: any) {
    console.error('Global logout error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return createErrorResponse('BAD_REQUEST', 'User not found');
    }
    
    return createErrorResponse('INTERNAL_ERROR', 'Failed to sign out from all devices');
  }
}
