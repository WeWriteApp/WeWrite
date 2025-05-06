// app/firebase/firestore.js
// This file exports the Firestore database instance from Firebase Admin SDK

import { getFirebaseAdmin } from './firebaseAdmin';

// Get the Firebase Admin instance
const admin = getFirebaseAdmin();

// Export the firestore service
export const db = admin.firestore();

export default db;
