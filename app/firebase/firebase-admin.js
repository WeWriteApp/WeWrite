// app/firebase/firebase-admin.js
// This file exports Firebase Admin SDK functionality for server-side operations

import { getFirebaseAdmin } from './firebaseAdmin';

// Get the Firebase Admin instance
const admin = getFirebaseAdmin();

// Export the auth and firestore services
export const auth = admin.auth();
export const db = admin.firestore();
export const rtdb = admin.database();

export default admin;
