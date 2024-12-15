import admin from 'firebase-admin';

// Initialize Firebase Admin only if not already initialized and credentials are available
if (!admin.apps.length && process.env.GOOGLE_CLOUD_KEY_JSON) {
  try {
    // Parse service account credentials from environment variable
    const serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);

    // Initialize Firebase Admin with service account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Use same database URL as client-side Firebase
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw new Error('Failed to initialize Firebase Admin. Check GOOGLE_CLOUD_KEY_JSON configuration.');
  }
}

// Export admin instances for SSR functionality
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminRtdb = admin.database();

// Helper function to verify ID tokens server-side
export const verifyIdToken = async (token) => {
  if (!token) throw new Error('No token provided');
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid authentication token');
  }
};

// Helper function to get user data server-side
export const getUserById = async (uid) => {
  if (!uid) throw new Error('No user ID provided');
  try {
    return await adminAuth.getUser(uid);
  } catch (error) {
    console.error('Error getting user:', error);
    throw new Error('Failed to fetch user data');
  }
};
