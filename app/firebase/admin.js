import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Singleton pattern to avoid re-initialization
let app;

export const initAdmin = () => {
  if (getApps().length === 0) {
    try {
      // Use environment variables for Firebase Admin credentials
      // For local development/testing without proper credentials,
      // we'll use a simple implementation that doesn't need credentials
      
      // Production would use something like:
      // const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      // app = initializeApp({
      //   credential: cert(serviceAccount),
      //   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      // });
      
      // For our testing environment, we'll just initialize without credentials
      // This won't connect to a real Firebase instance but will avoid errors
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82'
      });
      
      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }
  
  return app;
};

export default { initAdmin }; 