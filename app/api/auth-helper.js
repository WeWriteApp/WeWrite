import { getAuth } from 'firebase-admin/auth';
import { initAdmin, admin } from "../../firebase/admin';

// Initialize Firebase Admin
initAdmin();

// Get auth instance
const auth = getAuth();

/**
 * Helper function to get the user ID from a request
 * Tries multiple authentication methods:
 * 1. Query parameter (for testing)
 * 2. Session cookie
 * 3. wewrite_user_id cookie
 * 4. userSession cookie
 * 5. Authorization header
 *
 * In development mode, it will also accept any authentication method
 * to make testing easier.
 *
 * @param {Request} request - The Next.js request object
 * @returns {Promise<string|null>} - The user ID or null if not authenticated
 */
export async function getUserIdFromRequest(request) {
  // Get user ID from cookies or query parameters
  let userId;

  // SECURITY FIX: Remove query parameter authentication
  // This was a critical security vulnerability that allowed authentication bypass
  // const url = new URL(request.url);
  // const queryUserId = url.searchParams.get('userId');
  //
  // if (queryUserId) {
  //   console.log('Using userId from query parameters:', queryUserId);
  //   return queryUserId;
  // }

  // Check for development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Try to get from session cookie
  const sessionCookie = request.cookies.get('session')?.value;

  if (sessionCookie) {
    try {
      // Verify the session cookie
      const decodedClaims = await auth.verifySessionCookie(sessionCookie);
      userId = decodedClaims.uid;
      console.log('Using userId from session cookie:', userId);
      return userId;
    } catch (error) {
      console.error('Error verifying session cookie:', error);

      // SECURITY FIX: Remove unverified session cookie acceptance in development
      // This was a security vulnerability that could allow session forgery
      // if (isDevelopment && sessionCookie) {
      //   try {
      //     // Try to extract a user ID from the token without verification
      //     const parts = sessionCookie.split('.');
      //     if (parts.length === 3) {
      //       const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      //       if (payload && payload.uid) {
      //         console.log('Development mode: Using unverified session cookie:', payload.uid);
      //         return payload.uid;
      //       }
      //     }
      //   } catch (e) {
      //     console.error('Error parsing session cookie in development mode:', e);
      //   }
      // }

      // Fall back to other methods
    }
  }

  // If still no userId, try other cookies
  const wewriteUserId = request.cookies.get('wewrite_user_id')?.value;
  if (wewriteUserId) {
    console.log('Using userId from wewrite_user_id cookie:', wewriteUserId);
    return wewriteUserId;
  }

  // If still no userId, try userSession cookie
  const userSessionCookie = request.cookies.get('userSession')?.value;
  if (userSessionCookie) {
    try {
      const userSession = JSON.parse(userSessionCookie);
      if (userSession && userSession.uid) {
        console.log('Using userId from userSession cookie:', userSession.uid);
        return userSession.uid;
      }
    } catch (error) {
      console.error('Error parsing userSession cookie:', error);
    }
  }

  // Try to get from Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decodedToken = await auth.verifyIdToken(token);
      console.log('Using userId from Authorization header:', decodedToken.uid);
      return decodedToken.uid;
    } catch (error) {
      console.error('Error verifying ID token:', error);

      // SECURITY FIX: Remove unverified token acceptance in development
      // This was a security vulnerability that could allow token forgery
      // if (isDevelopment && token) {
      //   try {
      //     // Try to extract a user ID from the token without verification
      //     const parts = token.split('.');
      //     if (parts.length === 3) {
      //       const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      //       if (payload && payload.uid) {
      //         console.log('Development mode: Using unverified token:', payload.uid);
      //         return payload.uid;
      //       }
      //     }
      //   } catch (e) {
      //     console.error('Error parsing token in development mode:', e);
      //   }
      // }
    }
  }

  // SECURITY FIX: Remove automatic fallback to test user in development
  // This was a critical security vulnerability that could allow unauthorized access
  // if (isDevelopment) {
  //   console.log('Development mode: Using default test user ID');
  //   return "test-user-id-for-development';
  // }

  // No user ID found
  return null;
}
