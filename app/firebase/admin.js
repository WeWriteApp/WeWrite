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
        try {
          // Log environment variables (without sensitive data)
          console.log('Firebase Admin initialization - Environment check:', {
            hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !!process.env.FIREBASE_PROJECT_ID,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasDbUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DB_URL || !!process.env.FIREBASE_DATABASE_URL
          });

          // Create service account with fallbacks for different environment variable names
          const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Required by Firebase Admin SDK
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Required by Firebase Admin SDK
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            client_email: process.env.FIREBASE_CLIENT_EMAIL, // Required by Firebase Admin SDK
          };

          // Ensure required fields are present
          if (!serviceAccount.project_id) {
            throw new Error('Missing required project_id in service account');
          }
          if (!serviceAccount.private_key) {
            throw new Error('Missing required private_key in service account');
          }
          if (!serviceAccount.client_email) {
            throw new Error('Missing required client_email in service account');
          }

          // Get database URL with fallback
          const databaseURL = process.env.FIREBASE_DATABASE_URL ||
                             process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                             `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

          app = initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
          });

          console.log(`Firebase Admin initialized successfully with project: ${serviceAccount.project_id}`);
        } catch (error) {
          console.error('Error initializing Firebase Admin with service account:', error);

          // Fallback initialization for Vercel preview environments
          console.warn('Attempting fallback initialization for Vercel preview...');
          app = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }

  return app;
};

// Export admin for convenience
export { admin };

export default { initAdmin };