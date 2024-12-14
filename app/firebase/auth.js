// Mock Firebase Auth implementation
import { app } from './config';

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
    // Accept only test credentials for mock auth
    if (email === 'test@example.com' && password === 'testpassword') {
      this.currentUser = {
        uid: 'mock-user-1',
        email,
        emailVerified: true,
        displayName: 'Mock User',
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

// Create and export a singleton instance with the initialized app
const mockAuth = new MockAuth(app);

// Register auth provider in the app
app.getProvider('auth', {
  initialize: () => {},
  isInitialized: () => true,
  getImmediate: () => mockAuth
});

// Helper functions to match Firebase Auth API
export const auth = mockAuth;
export const getAuth = () => mockAuth;
export const createUser = (email, password) => mockAuth.createUserWithEmailAndPassword(email, password);
export const loginUser = (email, password) => mockAuth.signInWithEmailAndPassword(email, password);
export const logoutUser = () => mockAuth.signOut();
export const addUsername = (uid, username) => mockAuth.addUsername(uid, username);
export const onAuthStateChanged = (auth, callback) => auth.onAuthStateChanged(callback);
export const createUserWithEmailAndPassword = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
export const signOut = (auth) => auth.signOut();
export const updateProfile = (user, profile) => mockAuth.updateProfile(user, profile);
