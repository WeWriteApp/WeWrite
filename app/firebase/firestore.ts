// app/firebase/firestore.ts
// This file exports the Firestore database instance from Firebase Admin SDK

import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebaseAdmin';

// Get the Firebase Admin instance
const admin = getFirebaseAdmin();

// Export the firestore service
export const db: Firestore | null = admin ? admin.firestore() : null;

export default db;
