// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "./firestore";  // Import mock Firestore

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const newConfig =  {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN || 'mock-domain',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'mock-db-url',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID || 'mock-project-id',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET || 'mock-bucket',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID || 'mock-sender-id',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'mock-app-id',
};

// Initialize Firebase
export const app = initializeApp(newConfig);
export const db = getFirestore();  // Export mock Firestore instance

export default app;
