// Mock Firebase Auth implementation
export class MockAuth {
  constructor(app) {
    this.app = app;
    // Try to restore auth state from localStorage
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('mockAuthUser') : null;
    this.currentUser = savedUser ? JSON.parse(savedUser) : null;
    this._authStateObservers = new Set();
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
      // Persist auth state in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('mockAuthUser', JSON.stringify(this.currentUser));
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
      localStorage.removeItem('mockAuthUser');
    }
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

  async addUsername(uid, username) {
    if (this.currentUser && this.currentUser.uid === uid) {
      this.currentUser.username = username;
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
export const createUser = (email, password) => mockAuth.createUserWithEmailAndPassword(email, password);
export const loginUser = (email, password) => mockAuth.signInWithEmailAndPassword(email, password);
export const logoutUser = () => mockAuth.signOut();
export const addUsername = (uid, username) => mockAuth.addUsername(uid, username);
export const onAuthStateChanged = (auth, callback) => auth.onAuthStateChanged(callback);
export const createUserWithEmailAndPassword = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
export const signInWithEmailAndPassword = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
export const signOut = (auth) => auth.signOut();
export const updateProfile = (user, profile) => mockAuth.updateProfile(user, profile);
