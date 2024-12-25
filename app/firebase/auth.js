import { getAuth as getFirebaseAuth } from "firebase/auth";
import { getFirebase } from './config';

export class MockAuth {
  constructor(app) {
    this.app = app;
    this.currentUser = null;
    this._authStateObservers = new Set();

    // Initialize auth state safely for SSR
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('mockAuthUser');
        if (savedUser) {
          this.currentUser = JSON.parse(savedUser);
          this._notifyAuthStateObservers();
        }
      } catch (error) {
        console.error('Error initializing mock auth:', error);
        // Reset to safe state if initialization fails
        this.currentUser = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mockAuthUser');
        }
      }
    }
  }

  getAuth() {
    return this;
  }

  signInWithEmailAndPassword(email, password) {
    // In development mode, accept any credentials
    if (process.env.NODE_ENV === 'development') {
      this.currentUser = {
        uid: `mock-user-${Date.now()}`, // Generate unique ID for testing
        email,
        emailVerified: true,
        displayName: email.split('@')[0],
        photoURL: null,
        groups: ['default-group'],
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString()
        }
      };

      // Safely persist auth state
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mockAuthUser', JSON.stringify(this.currentUser));
        } catch (error) {
          console.error('Error persisting auth state:', error);
        }
      }

      this._notifyAuthStateObservers();
      return Promise.resolve({ user: this.currentUser });
    }
    return Promise.reject(new Error('Invalid credentials'));
  }

  createUserWithEmailAndPassword(email, password) {
    return this.signInWithEmailAndPassword(email, password);
  }

  signOut() {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('mockAuthUser');
      } catch (error) {
        console.error('Error clearing auth state:', error);
      }
    }
    this._notifyAuthStateObservers();
    return Promise.resolve();
  }

  onAuthStateChanged(callback) {
    if (!callback || typeof callback !== 'function') {
      console.error('Invalid callback provided to onAuthStateChanged');
      return () => {};
    }

    this._authStateObservers.add(callback);
    // Initial callback with current state
    callback(this.currentUser);
    // Return unsubscribe function
    return () => {
      this._authStateObservers.delete(callback);
    };
  }

  updateProfile(user, { displayName }) {
    if (this.currentUser && user.uid === this.currentUser.uid) {
      this.currentUser.displayName = displayName;
      // Safely persist updated profile
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mockAuthUser', JSON.stringify(this.currentUser));
        } catch (error) {
          console.error('Error persisting profile update:', error);
        }
      }
      this._notifyAuthStateObservers();
    }
    return Promise.resolve();
  }

  async addUsername(uid, username) {
    if (this.currentUser && this.currentUser.uid === uid) {
      this.currentUser.username = username;
      // Safely persist username update
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mockAuthUser', JSON.stringify(this.currentUser));
        } catch (error) {
          console.error('Error persisting username update:', error);
        }
      }
      this._notifyAuthStateObservers();
    }
    return Promise.resolve();
  }

  _notifyAuthStateObservers() {
    this._authStateObservers.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (error) {
        console.error('Error in auth state observer:', error);
      }
    });
  }
}

// Initialize Firebase Auth
let auth;
let initializationPromise = null;

const initializeAuth = async () => {
  try {
    // Wait for Firebase initialization
    const { app } = await getFirebase();

    if (!app) {
      throw new Error('Firebase app must be initialized before auth');
    }

    // Initialize auth with the Firebase app instance
    const authInstance = getFirebaseAuth(app);
    console.log('Firebase Auth initialized successfully');

    // Only use mock auth in development
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DB === 'true') {
      console.log('Using mock auth in development mode');
      return new MockAuth(app);
    }

    return authInstance;
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
    throw error;
  }
};

export const getAuth = async () => {
  if (!auth) {
    if (!initializationPromise) {
      initializationPromise = initializeAuth();
    }
    auth = await initializationPromise;
  }
  return auth;
};

// Export auth helper functions
export const createUser = async (email, password) => {
  const auth = await getAuth();
  return auth.createUserWithEmailAndPassword(email, password);
};

export const loginUser = async (email, password) => {
  const auth = await getAuth();
  return auth.signInWithEmailAndPassword(email, password);
};

export const logoutUser = async () => {
  const auth = await getAuth();
  return auth.signOut();
};

export const addUsername = async (uid, username) => {
  const auth = await getAuth();
  return auth.addUsername(uid, username);
};

export const onAuthStateChanged = (auth, callback) => auth.onAuthStateChanged(callback);
export const createUserWithEmailAndPassword = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
export const signOut = (auth) => auth.signOut();
export const updateProfile = (user, profile) => auth.updateProfile(user, profile);
