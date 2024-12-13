// Mock Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "./firestore";
import { MockAuth } from './auth';

const mockConfig = {
  apiKey: process.env.API_KEY || 'mock-api-key',
  authDomain: 'mock-domain',
  databaseURL: 'mock-db-url',
  projectId: process.env.PROJECT_ID || 'mock-project-id',
  storageBucket: 'mock-bucket',
  messagingSenderId: 'mock-sender-id',
  appId: 'mock-app-id',
};

// Initialize mock Firebase with required methods
const app = {
  name: '[DEFAULT]',
  options: mockConfig,
  automaticDataCollectionEnabled: true,
  getProvider: (name) => {
    if (name === 'auth') {
      return {
        initialize: () => {},
        isInitialized: () => true,
        getImmediate: () => new MockAuth(app)
      };
    }
    return {
      initialize: () => {},
      isInitialized: () => true,
      getImmediate: () => ({})
    };
  }
};

export { app };
export const db = getFirestore(app);
export default app;
