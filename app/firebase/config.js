// Mock Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "./firestore";

const mockConfig = {
  apiKey: 'mock-api-key',
  authDomain: 'mock-domain',
  databaseURL: 'mock-db-url',
  projectId: 'mock-project-id',
  storageBucket: 'mock-bucket',
  messagingSenderId: 'mock-sender-id',
  appId: 'mock-app-id',
};

// Initialize mock Firebase
const app = {
  name: '[DEFAULT]',
  options: mockConfig,
  automaticDataCollectionEnabled: true,
};

export { app };
export const db = getFirestore(app);
export default app;
