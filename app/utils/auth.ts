import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from "../firebase/firebaseAdmin";
import type { NextRequest } from 'next/server';

// Initialize Firebase Admin only if not during build time
let auth: Auth | null = null;
try {
  const admin = getFirebaseAdmin();
  if (admin) {
    auth = getAuth(admin);
  }
} catch (error) {
  console.warn('Firebase Admin initialization failed in auth utils:', error);
  auth = null;
}

/**
 * Get user ID from request
 * Updated for auth system using simpleUserSession cookie
 *
 * @param request - The Next.js request object
 * @returns The user ID or null if not authenticated
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // Return null if auth is not available (during build time)
  if (!auth) {
    console.warn('Firebase Auth not available, returning null');
    return null;
  }

  try {
    // Get the session token from cookies
    const sessionCookie = request.cookies.get('simpleUserSession')?.value;
    
    if (!sessionCookie) {
      return null;
    }

    // Parse the session cookie (it should contain the user ID)
    try {
      const sessionData = JSON.parse(sessionCookie);
      return sessionData.uid || null;
    } catch (parseError) {
      console.error('Error parsing session cookie:', parseError);
      return null;
    }

  } catch (error) {
    console.error('Error getting user ID from request:', error);
    return null;
  }
}
