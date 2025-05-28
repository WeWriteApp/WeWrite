import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Singleton pattern to avoid re-initialization
let app;

export const initAdmin = () => {
  // Skip initialization during build time
  if (typeof window === 'undefined' && (
    process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILD_ID ||
    process.argv.includes('build')
  )) {
    console.log('Skipping Firebase Admin initialization during build time');
    return null;
  }

  // Check if any Firebase apps have been initialized
  if (admin.apps.length === 0) {
    try {
      // For development environment, use a service account or default credentials
      if (process.env.NODE_ENV === 'development') {
        // For local development, try to use the service account from environment variables
        try {
          // Check if we have the Google Cloud key JSON in environment
          if (process.env.GOOGLE_CLOUD_KEY_JSON) {
            const serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);

            app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
            });
            console.log('Firebase Admin initialized with Google Cloud service account');
          } else {
            // Fallback to individual environment variables
            const serviceAccount = {
              type: 'service_account',
              project_id: process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82',
              private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'dev-key-id',
              private_key: process.env.FIREBASE_PRIVATE_KEY ?
                process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') :
                'dummy-key',
              client_email: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
              client_id: process.env.FIREBASE_CLIENT_ID || 'dummy-client-id',
              auth_uri: 'https://accounts.google.com/o/oauth2/auth',
              token_uri: 'https://oauth2.googleapis.com/token',
              auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
              client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/dummy'
            };

            app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
            });
            console.log('Firebase Admin initialized with individual environment variables');
          }
        } catch (e) {
          console.warn('Using fallback Firebase Admin initialization for development:', e.message);
          app = admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82'
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
          const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82';

          // Check if we have the required service account credentials
          const hasServiceAccountCreds = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL;

          // Only attempt to use service account if we have the required credentials
          const serviceAccount = hasServiceAccountCreds ? {
            type: 'service_account',
            project_id: projectId,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'key-id',
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID || 'client-id',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/dummy'
          } : null;

          // Get database URL with fallback
          const databaseURL = process.env.FIREBASE_DATABASE_URL ||
                             process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                             `https://${projectId}-default-rtdb.firebaseio.com`;

          // Initialize with service account if available, otherwise use application default credentials
          if (hasServiceAccountCreds) {
            app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: databaseURL
            });
          } else {
            // Fallback to application default credentials or just project ID
            app = admin.initializeApp({
              projectId: projectId,
              databaseURL: databaseURL
            });
          }

          console.log(`Firebase Admin initialized successfully with project: ${projectId}`);
        } catch (error) {
          console.error('Error initializing Firebase Admin with service account:', error);

          // Fallback initialization for Vercel preview environments
          console.warn('Attempting fallback initialization for Vercel preview...');
          const fallbackProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'wewrite-ccd82';
          const fallbackDbUrl = process.env.FIREBASE_DATABASE_URL ||
                               process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                               `https://${fallbackProjectId}-default-rtdb.firebaseio.com`;

          app = admin.initializeApp({
            projectId: fallbackProjectId,
            databaseURL: fallbackDbUrl
          });
        }
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  } else {
    // If already initialized, get the default app
    app = admin.app();
  }

  return app;
};

// Export admin for convenience
export { admin };

export default { initAdmin };