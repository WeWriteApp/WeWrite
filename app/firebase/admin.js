import { initializeApp, getApps, cert } from 'firebase-admin/app';
import * as admin from 'firebase-admin';

// Singleton pattern to avoid re-initialization
let app;

export const initAdmin = () => {
  if (getApps().length === 0) {
    try {
      // For development environment, use a service account or default credentials
      if (process.env.NODE_ENV === 'development') {
        // For local development, we'll use a simple implementation
        // that allows API routes to work without throwing errors
        try {
          const serviceAccount = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
            privateKey: process.env.FIREBASE_PRIVATE_KEY ?
              process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') :
              'dummy-key',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
          };

          app = initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
          });
        } catch (e) {
          console.warn('Using fallback Firebase Admin initialization for development:', e.message);
          app = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      } else {
        // Production initialization with proper credentials
        const serviceAccount = {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };

        app = initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL
        });
      }

      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }

  return app;
};

// Export admin for convenience
export { admin };

export default { initAdmin };