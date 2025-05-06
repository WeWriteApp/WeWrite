import * as admin from 'firebase-admin';

// Singleton pattern to ensure we only initialize the app once
let firebaseAdmin;

export function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    // Check if any Firebase apps have been initialized
    if (admin.apps.length === 0) {
      // For development environment, use a service account or default credentials
      if (process.env.NODE_ENV === 'development') {
        try {
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
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

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DB_URL || "https://wewrite-ccd82-default-rtdb.firebaseio.com"
          });
        } catch (e) {
          console.warn('Using fallback Firebase Admin initialization for development:', e.message);
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      } else {
        // Production initialization with proper credentials
        try {
          // Log environment variables (without sensitive data)
          console.log('Firebase Admin initialization - Environment check:', {
            hasProjectId: !!process.env.FIREBASE_PROJECT_ID || !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasDbUrl: !!process.env.FIREBASE_DATABASE_URL || !!process.env.NEXT_PUBLIC_FIREBASE_DB_URL
          });

          // Create service account with fallbacks for different environment variable names
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'key-id',
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID || 'client-id',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
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

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
          });

          console.log(`Firebase Admin initialized successfully with project: ${serviceAccount.project_id}`);
        } catch (error) {
          console.error('Error initializing Firebase Admin with service account:', error);

          // Fallback initialization for Vercel preview environments
          console.warn('Attempting fallback initialization for Vercel preview...');
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      }
    }

    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw new Error("Failed to initialize Firebase Admin");
  }
}
