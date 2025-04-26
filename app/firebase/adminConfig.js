/**
 * Firebase Admin Configuration
 * 
 * This module provides a unified approach to initializing Firebase Admin
 * across the application. It handles different environments and ensures
 * proper credential management.
 */

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
      // Create a service account with fallbacks for each property
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82',
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
        client_id: process.env.FIREBASE_CLIENT_ID || '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || ''
      };
      
      // Initialize with credential if we have the minimum required fields
      if (serviceAccount.project_id) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 
                         process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 
                         "https://wewrite-ccd82-default-rtdb.firebaseio.com"
          });
          console.log('Firebase Admin initialized successfully');
        } catch (certError) {
          console.error('Error initializing with cert, falling back to default:', certError);
          // Fallback to basic initialization if cert fails
          admin.initializeApp({
            projectId: serviceAccount.project_id,
            databaseURL: process.env.FIREBASE_DATABASE_URL || 
                         process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 
                         "https://wewrite-ccd82-default-rtdb.firebaseio.com"
          });
          console.log('Firebase Admin initialized with fallback configuration');
        }
      } else {
        throw new Error('Missing required project_id for Firebase Admin initialization');
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
