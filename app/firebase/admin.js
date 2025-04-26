import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirebaseAdmin } from './adminConfig';

// Singleton pattern to avoid re-initialization
let app;

export const initAdmin = () => {
  if (getApps().length === 0) {
    try {
      // Use our unified Firebase Admin initialization
      const admin = getFirebaseAdmin();
      app = admin.app();

      console.log('Firebase Admin initialized successfully via unified approach');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);

      // Fallback to basic initialization if the unified approach fails
      try {
        app = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
                    process.env.FIREBASE_PROJECT_ID ||
                    'wewrite-ccd82'
        });
        console.log('Firebase Admin initialized with fallback configuration');
      } catch (fallbackError) {
        console.error('Fallback initialization also failed:', fallbackError);
      }
    }
  }

  return app;
};

export default { initAdmin };