/**
 * Server-side Firebase Admin initialization
 *
 * IMPORTANT: This module should ONLY be imported in server-side code.
 * It will throw an error if imported on the client.
 */

// Ensure this module is only used on the server
if (typeof window !== 'undefined') {
  throw new Error('This module cannot be used on the client side.');
}

import { getFirebaseAdmin } from './adminConfig';

// Singleton pattern to avoid re-initialization
let app;

export const initAdmin = () => {
  if (!app) {
    try {
      // Use our unified Firebase Admin initialization
      const admin = getFirebaseAdmin();
      app = admin.app();

      console.log('Firebase Admin initialized successfully via unified approach');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      throw new Error('Failed to initialize Firebase Admin: ' + error.message);
    }
  }

  return app;
};

export default { initAdmin };