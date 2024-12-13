// Mock Firebase Auth implementation
export class MockAuth {
  constructor(app) {
    this.app = app;
    this.currentUser = null;
    this._authStateObservers = new Set();
  }

  getAuth() {
    return this;
  }

  signInWithEmailAndPassword(email, password) {
    this.currentUser = {
      uid: 'mock-uid',
      email,
      emailVerified: true,
      displayName: 'Mock User',
      photoURL: null,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString()
      }
    };
    this._notifyAuthStateObservers();
    return Promise.resolve({ user: this.currentUser });
  }

  createUserWithEmailAndPassword(email, password) {
    return this.signInWithEmailAndPassword(email, password);
  }

  signOut() {
    this.currentUser = null;
    this._notifyAuthStateObservers();
    return Promise.resolve();
  }

  onAuthStateChanged(callback) {
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
      this._notifyAuthStateObservers();
    }
    return Promise.resolve();
  }

  _notifyAuthStateObservers() {
    this._authStateObservers.forEach(callback => {
      callback(this.currentUser);
    });
  }
}

// Export a singleton instance for server-side rendering
export const mockAuth = new MockAuth(null);

// Helper functions to match Firebase Auth API
export const auth = mockAuth;
export const getAuth = () => mockAuth;
export const createUserWithEmailAndPassword = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
export const signOut = (auth) => auth.signOut();
export const updateProfile = (user, profile) => mockAuth.updateProfile(user, profile);
