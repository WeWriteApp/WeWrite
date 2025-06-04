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
      let serviceAccount = require("service-account-key.json");
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://wewrite-ccd82-default-rtdb.firebaseio.com"
      });
    }
    
    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw new Error("Failed to initialize Firebase Admin");
  }
}
