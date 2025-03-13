'use client';

export { FirebaseProvider, useFirebase } from '../context/FirebaseContext';

// Re-export the hook for convenience
export { useFirebase };

// For backward compatibility, export null values by default
export const firebase_app = null;
export const rtdb = null;
export const db = null;
export const auth = null; 