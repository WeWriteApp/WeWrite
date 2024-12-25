import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { FirebaseError, FIREBASE_ERROR_TYPES } from "../utils/firebase-errors";

let app;
let db;
let rtdb;
let isInitialized = false;
let initializationError = null;

// Mock data and implementations
const mockData = {
  users: {
    'mock-user-1': {
      uid: 'mock-user-1',
      username: 'Test User',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
      stripeCustomerId: null,
      subscriptions: [],
      allocations: {}
    }
  },
  subscriptions: {},
  pages: {}
};

// Mock Firestore implementation
const mockFirestore = {
  _checkNotDeleted: () => true,
  collection: () => ({
    doc: () => ({
      get: () => Promise.resolve({ exists: () => false, data: () => null }),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve()
    }),
    add: () => Promise.resolve({ id: `mock-${Date.now()}` })
  })
};

// Mock RTDB implementation
const createMockRef = (path) => {
  if (typeof path !== 'string') {
    console.error('Invalid path type:', typeof path);
    path = String(path || '');
  }

  // Helper function to get/set nested object value by path
  const getNestedValue = (obj, path) => {
    if (!path) return obj;
    const parts = path.split('/').filter(Boolean);
    let current = obj;
    for (const part of parts) {
      current = current?.[part];
      if (current === undefined) return null;
    }
    return current;
  };

  const setNestedValue = (obj, path, value) => {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  };

  const mockRef = {
    key: path.split('/').pop(),
    path: path,
    parent: null,
    root: null,
    database: () => mockRtdb,

    child: (childPath) => createMockRef(`${path}/${childPath}`),

    // Query methods
    orderByKey: () => mockRef,
    orderByValue: () => mockRef,
    orderByChild: (child) => mockRef,
    limitToFirst: (limit) => mockRef,
    limitToLast: (limit) => mockRef,
    startAt: (value) => mockRef,
    endAt: (value) => mockRef,
    equalTo: (value) => mockRef,

    push: () => {
      const newKey = `mock-${Date.now()}`;
      return createMockRef(`${path}/${newKey}`);
    },

    set: async (value) => {
      console.log('Mock set:', { path, value });
      setNestedValue(mockData, path, value);
      return Promise.resolve();
    },

    update: async (value) => {
      console.log('Mock update:', { path, value });
      const current = getNestedValue(mockData, path) || {};
      setNestedValue(mockData, path, { ...current, ...value });
      return Promise.resolve();
    },

    remove: async () => {
      console.log('Mock remove:', { path });
      setNestedValue(mockData, path, null);
      return Promise.resolve();
    },

    get: async () => {
      console.log('Mock get:', { path });
      const data = getNestedValue(mockData, path);
      return Promise.resolve({
        val: () => data,
        exists: () => data !== null,
        key: path.split('/').pop(),
        ref: mockRef
      });
    },

    once: async (eventType) => {
      console.log('Mock once:', { path, eventType });
      const data = getNestedValue(mockData, path);
      return Promise.resolve({
        val: () => data,
        exists: () => data !== null,
        key: path.split('/').pop(),
        ref: mockRef
      });
    },

    on: (eventType, callback) => {
      console.log('Mock on:', { path, eventType });
      const data = getNestedValue(mockData, path);
      callback({
        val: () => data,
        exists: () => data !== null,
        key: path.split('/').pop(),
        ref: mockRef
      });
      return () => console.log('Mock off:', { path, eventType });
    },

    off: (eventType, callback) => {
      console.log('Mock off:', { path, eventType });
    },

    toJSON: () => getNestedValue(mockData, path),
    toString: () => path
  };

  // Set up parent/root references
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    const parentPath = pathParts.slice(0, -1).join('/');
    mockRef.parent = createMockRef(parentPath);
  }
  mockRef.root = pathParts.length > 0 ? createMockRef('') : mockRef;

  return mockRef;
};

// Mock RTDB instance
const mockRtdb = {
  _checkNotDeleted: () => true,
  ref: (path) => {
    console.log('Creating mock ref for path:', path);
    if (typeof path !== 'string') {
      console.error('Invalid path type:', typeof path);
      path = String(path || '');
    }
    const mockRef = createMockRef(path);
    console.log('Created mock ref with methods:', Object.keys(mockRef));
    return mockRef;
  },
  refFromURL: (url) => {
    console.log('Creating mock ref from URL:', url);
    if (typeof url !== 'string') {
      console.error('Invalid URL type:', typeof url);
      url = String(url || '');
    }
    const path = url.split('/').slice(-2).join('/');
    return createMockRef(path);
  },
  app: null,
  goOffline: () => console.log('Mock database going offline'),
  goOnline: () => console.log('Mock database going online'),
  getRules: () => Promise.resolve({ rules: {} }),
  getRulesJSON: () => ({ rules: {} })
};

// Mock configuration for development
const mockConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mock-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://mock-project-default-rtdb.firebaseio.com'
};

// Initialize Firebase with proper configuration
const initializeFirebase = async () => {
  try {
    // In development with mock DB, use mock config without checking env vars
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DB === 'true') {
      console.log('Using mock configuration in development mode');
      app = getApps().length ? getApp() : initializeApp(mockConfig);
      db = mockFirestore;
      rtdb = mockRtdb;
      isInitialized = true;
      console.log('Mock RTDB initialized with methods:', Object.keys(mockRtdb));
      return;
    }

    // Use environment variables for configuration
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };

    // Validate required configuration
    const requiredEnvVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL'
    ];

    // Log environment variable status
    console.log('Checking Firebase environment variables:', {
      ...Object.fromEntries(
        Object.entries(firebaseConfig).map(([key, value]) => [
          key,
          value ? (key.includes('KEY') ? '[REDACTED]' : 'present') : 'missing'
        ])
      )
    });

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.error('Missing required Firebase configuration:', missingEnvVars);
      // In production, use mock config for non-database operations
      if (process.env.NODE_ENV === 'production') {
        console.warn('Using fallback configuration in production');
        return initializeWithMockConfig();
      }
      throw new Error(`Missing required Firebase configuration: ${missingEnvVars.join(', ')}`);
    }

    // Initialize Firebase app with proper config
    if (!getApps().length) {
      console.log('Initializing Firebase with config:', {
        ...firebaseConfig,
        apiKey: '[REDACTED]',
        appId: '[REDACTED]'
      });
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    // Initialize Firestore and RTDB with retry logic
    console.log('Initializing Firebase databases...');

    // Initialize Firestore
    db = getFirestore(app);

    // Initialize RTDB with retry logic
    const initializeRTDB = async (retries = 3, delay = 1000) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`RTDB initialization attempt ${attempt}/${retries}`);
          rtdb = getDatabase(app);

          // Verify RTDB instance
          if (!rtdb || typeof rtdb.ref !== 'function') {
            throw new Error('Invalid RTDB instance');
          }

          // Test RTDB functionality
          const testRef = rtdb.ref('_test_');
          if (typeof testRef.once !== 'function') {
            throw new Error('Invalid RTDB reference');
          }

          console.log('RTDB initialization successful');
          return true;
        } catch (error) {
          console.warn(`RTDB initialization attempt ${attempt} failed:`, error);
          if (attempt === retries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return false;
    };

    // Wait for RTDB initialization with timeout
    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RTDB initialization timeout')), 30000); // Increased timeout to 30s
      });

      await Promise.race([
        initializeRTDB(),
        timeout
      ]);

      isInitialized = true;
      console.log('Firebase initialized successfully:', {
        app: !!app,
        db: !!db,
        rtdb: !!rtdb,
        rtdbRef: typeof rtdb.ref === 'function'
      });
    } catch (error) {
      console.error('Error initializing RTDB:', error);
      throw error;
    }
  } catch (error) {
    const errorDetails = error.message || 'Unknown error';
    console.error('Firebase initialization error:', errorDetails);
    initializationError = error;

    // Allow mock database in development or for non-database operations in production
    if (process.env.NODE_ENV === 'development' || (process.env.NODE_ENV === 'production' && !error.message?.includes('database'))) {
      console.warn(`Using mock configuration due to initialization error: ${errorDetails}`);
      app = getApps().length ? getApp() : initializeApp(mockConfig);
      db = mockFirestore;
      rtdb = mockRtdb;
      isInitialized = true;
      return;
    } else {
      // In production, throw a structured error for database-related issues
      const firebaseError = new FirebaseError(
        FIREBASE_ERROR_TYPES.INITIALIZATION,
        `Firebase initialization failed: ${errorDetails}`
      );
      console.error('Firebase initialization failed in production environment:', {
        error: firebaseError,
        config: {
          ...firebaseConfig,
          apiKey: '[REDACTED]',
          appId: '[REDACTED]'
        }
      });
      throw firebaseError;
    }
  }
};

// Initialize Firebase immediately
initializeFirebase().catch(error => {
  console.error('Failed to initialize Firebase:', error);
});

export { app, db, rtdb as database, isInitialized, initializationError };
export default app;
