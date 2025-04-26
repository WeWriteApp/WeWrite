/**
 * Firebase Admin Configuration
 *
 * This module provides a unified approach to initializing Firebase Admin
 * across the application. It handles different environments and ensures
 * proper credential management.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code.
 * It will throw an error if imported on the client.
 */

// Ensure this module is only used on the server
if (typeof window !== 'undefined') {
  throw new Error('Firebase Admin cannot be used on the client side. Use client-side Firebase SDK instead.');
}

// Dynamic import to prevent client-side bundling
let admin;
try {
  // This will only execute on the server
  admin = require('firebase-admin');
} catch (error) {
  console.error('Failed to import firebase-admin:', error);
  throw new Error('Failed to import firebase-admin. This module should only be used on the server.');
}

// Singleton pattern to ensure we only initialize the app once
let firebaseAdmin;

export function getFirebaseAdmin() {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    // Check if any Firebase apps have been initialized
    if (admin.apps.length === 0) {
      // For Vercel deployment, we'll use a simplified initialization approach
      // that doesn't require service account credentials
      const projectId = process.env.FIREBASE_PROJECT_ID ||
                       process.env.NEXT_PUBLIC_FIREBASE_PID ||
                       'wewrite-ccd82';

      const databaseURL = process.env.FIREBASE_DATABASE_URL ||
                         process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                         "https://wewrite-ccd82-default-rtdb.firebaseio.com";

      // Check if we have the minimum required service account credentials
      const hasServiceAccountCreds = process.env.FIREBASE_PRIVATE_KEY &&
                                    process.env.FIREBASE_CLIENT_EMAIL;

      if (hasServiceAccountCreds) {
        try {
          // Create a service account with the available credentials
          // Ensure private_key is properly formatted
          let privateKey = process.env.FIREBASE_PRIVATE_KEY;

          // Handle different formats of private key from environment variables
          if (privateKey) {
            // Replace escaped newlines with actual newlines if needed
            if (privateKey.includes('\\n')) {
              privateKey = privateKey.replace(/\\n/g, '\n');
            }
          } else {
            // If private key is missing, log and throw a specific error
            console.error('Firebase private key is missing or invalid');
            throw new Error('Firebase private key is missing or invalid');
          }

          const serviceAccount = {
            type: 'service_account',
            project_id: projectId,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'private-key-id',
            private_key: privateKey,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID || 'client-id',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || ''
          };

          // Log service account details for debugging (without sensitive info)
          console.log('Firebase config:', {
            projectId: serviceAccount.project_id,
            hasPrivateKey: !!serviceAccount.private_key,
            hasClientEmail: !!serviceAccount.client_email
          });

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
          });
          console.log('Firebase Admin initialized with service account credentials');
        } catch (certError) {
          console.error('Error initializing with cert, falling back to default:', certError);
          // Fallback to basic initialization
          admin.initializeApp({
            projectId: projectId,
            databaseURL: databaseURL
          });
          console.log('Firebase Admin initialized with fallback configuration after cert error');
        }
      } else {
        // Initialize without credentials for Vercel deployment
        admin.initializeApp({
          projectId: projectId,
          databaseURL: databaseURL
        });
        console.log('Firebase Admin initialized without service account credentials');
      }
    }

    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw new Error("Failed to initialize Firebase Admin: " + error.message);
  }
}

export default getFirebaseAdmin;
