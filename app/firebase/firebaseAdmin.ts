import * as admin from 'firebase-admin';

let firebaseAdminInstance: typeof admin | null = null;

export function getFirebaseAdmin(): typeof admin | null {
  if (firebaseAdminInstance) {
    return firebaseAdminInstance;
  }

  try {
    // Check if Firebase Admin is already initialized
    if (admin.apps.length > 0) {
      firebaseAdminInstance = admin;
      return firebaseAdminInstance;
    }

    // Initialize Firebase Admin
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    if (!base64Json) {
      console.warn('[Firebase Admin] No GOOGLE_CLOUD_KEY_JSON found, skipping initialization');
      return null;
    }

    console.log('Decoded base64-encoded GOOGLE_CLOUD_KEY_JSON');
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    console.log(`Using service account from GOOGLE_CLOUD_KEY_JSON: ${serviceAccount.client_email}`);

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });

    firebaseAdminInstance = admin;
    console.log('Firebase Admin initialized successfully');
    return firebaseAdminInstance;
  } catch (error) {
    console.error('[Firebase Admin] Failed to initialize Firebase Admin:', error);
    return null;
  }
}
