// Firebase error types and messages
export const FIREBASE_ERROR_TYPES = {
  INITIALIZATION: 'FIREBASE_INITIALIZATION_ERROR',
  CONFIG_MISSING: 'FIREBASE_CONFIG_MISSING',
  RTDB_INIT_FAILED: 'RTDB_INITIALIZATION_FAILED',
  AUTH_FAILED: 'AUTHENTICATION_FAILED'
};

// Error messages for different scenarios
export const getFirebaseErrorMessage = (type, details = '') => {
  const messages = {
    [FIREBASE_ERROR_TYPES.INITIALIZATION]: 'Failed to initialize Firebase',
    [FIREBASE_ERROR_TYPES.CONFIG_MISSING]: 'Missing required Firebase configuration',
    [FIREBASE_ERROR_TYPES.RTDB_INIT_FAILED]: 'Failed to initialize Firebase Realtime Database',
    [FIREBASE_ERROR_TYPES.AUTH_FAILED]: 'Firebase authentication failed'
  };

  return `${messages[type]}${details ? `: ${details}` : ''}`;
};

// Custom Firebase error class
export class FirebaseError extends Error {
  constructor(type, details = '') {
    super(getFirebaseErrorMessage(type, details));
    this.name = 'FirebaseError';
    this.type = type;
    this.details = details;
  }
}
