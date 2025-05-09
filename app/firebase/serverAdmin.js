import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// Singleton pattern to avoid re-initialization
let app;
let firestoreInstance;
let rtdbInstance;
let authInstance;

/**
 * Initialize Firebase Admin for server components
 * This is a specialized version for server components that ensures proper initialization
 */
export function initServerAdmin() {
  console.log('initServerAdmin: Starting initialization');
  
  // Check if any Firebase apps have been initialized
  if (admin.apps.length === 0) {
    try {
      console.log('initServerAdmin: No existing Firebase apps, initializing new app');
      
      // For development environment, use a service account or default credentials
      if (process.env.NODE_ENV === 'development') {
        // For local development, we'll use a simple implementation
        try {
          console.log('initServerAdmin: Development environment detected');
          
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
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
          
          console.log('initServerAdmin: Development app initialized successfully');
        } catch (e) {
          console.warn('initServerAdmin: Using fallback Firebase Admin initialization for development:', e.message);
          app = admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      } else {
        // Production initialization with proper credentials
        try {
          // Log environment variables (without sensitive data)
          console.log('initServerAdmin: Production environment detected');
          console.log('initServerAdmin: Environment check:', {
            hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !!process.env.FIREBASE_PROJECT_ID,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasDbUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DB_URL || !!process.env.FIREBASE_DATABASE_URL
          });

          // Create service account with fallbacks for different environment variable names
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'key-id',
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'dummy-key',
            client_email: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
            client_id: process.env.FIREBASE_CLIENT_ID || 'client-id',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/dummy'
          };

          // Get database URL with fallback
          const databaseURL = process.env.FIREBASE_DATABASE_URL ||
                             process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                             `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

          app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
          });

          console.log(`initServerAdmin: Production app initialized successfully with project: ${serviceAccount.project_id}`);
        } catch (error) {
          console.error('initServerAdmin: Error initializing Firebase Admin with service account:', error);

          // Fallback initialization for Vercel preview environments
          console.warn('initServerAdmin: Attempting fallback initialization for Vercel preview...');
          app = admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      }
    } catch (error) {
      console.error('initServerAdmin: Error initializing Firebase Admin:', error);
      throw new Error('Failed to initialize Firebase Admin for server components');
    }
  } else {
    // If already initialized, get the default app
    console.log('initServerAdmin: Using existing Firebase app');
    app = admin.app();
  }

  // Initialize services if they don't exist
  if (!firestoreInstance) {
    console.log('initServerAdmin: Initializing Firestore instance');
    firestoreInstance = getFirestore(app);
  }

  // Only initialize RTDB if we have a valid app with databaseURL
  if (!rtdbInstance) {
    try {
      // Check if the app has a databaseURL configured
      const options = app?.options;
      if (options && options.databaseURL) {
        console.log('initServerAdmin: Initializing RTDB instance with URL:', options.databaseURL);
        rtdbInstance = getDatabase(app);
      } else {
        // Create a dummy RTDB instance or set to null
        console.warn('initServerAdmin: No databaseURL provided, RTDB will not be available');
        rtdbInstance = null;
      }
    } catch (error) {
      console.error('initServerAdmin: Error initializing RTDB:', error);
      rtdbInstance = null;
    }
  }

  if (!authInstance) {
    console.log('initServerAdmin: Initializing Auth instance');
    authInstance = getAuth(app);
  }

  return {
    app,
    db: firestoreInstance,
    rtdb: rtdbInstance,
    auth: authInstance
  };
}

// Export admin for convenience
export { admin };

export default { initServerAdmin };
