// Mock Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "./firestore";
import { MockAuth } from './auth';

const mockConfig = {
  apiKey: process.env.API_KEY || 'mock-api-key',
  authDomain: 'mock-project.firebaseapp.com',
  databaseURL: 'https://mock-project.firebaseio.com',
  projectId: process.env.PROJECT_ID || 'mock-project',
  storageBucket: 'mock-project.appspot.com',
  messagingSenderId: 'mock-sender-id',
  appId: 'mock-app-id',
};

// Initialize Firebase with mock configuration
const app = initializeApp(mockConfig);

// Override app's getProvider method for mocking
app.getProvider = (name) => {
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
};

export { app };
export const db = getFirestore(app);
export default app;
