import { getDatabase, ref as dbRef, onValue as dbOnValue, get as dbGet, set as dbSet, update as dbUpdate, remove as dbRemove, push as dbPush } from 'firebase/database';
import { getFirebase } from './config';

// Initialize database with error handling
let database = null;

const initializeDatabase = async () => {
  if (database) return database;

  try {
    const { app } = await getFirebase();
    database = getDatabase(app);
    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    return null;
  }
};

// Helper functions for database operations
export const fetchGroupFromFirebase = async (groupId) => {
  try {
    const groupRef = await ref(`groups/${groupId}`);
    const snapshot = await get(groupRef);
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching group:', error);
    return null;
  }
};

export const fetchProfileFromFirebase = async (userId) => {
  try {
    const userRef = await ref(`users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

// Re-export database functions with proper error handling
export const ref = async (path) => {
  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock reference');
    return { key: path };
  }

  // Wait for initialization with timeout
  const timeout = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const db = await initializeDatabase();
    if (db) {
      try {
        return dbRef(db, path);
      } catch (error) {
        console.error('Error creating database reference:', error);
        throw error;
      }
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Database initialization timeout');
};

export const onValue = async (reference, callback) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock onValue');
    callback({ val: () => null, exists: () => false });
    return () => {};
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbOnValue(resolvedRef, callback);
  } catch (error) {
    console.error('Error setting up value listener:', error);
    throw error;
  }
};

export const get = async (reference) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock get');
    return Promise.resolve({ val: () => null, exists: () => false });
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbGet(resolvedRef);
  } catch (error) {
    console.error('Error getting value:', error);
    throw error;
  }
};

export const set = async (reference, value) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock set');
    return Promise.resolve();
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbSet(resolvedRef, value);
  } catch (error) {
    console.error('Error setting value:', error);
    throw error;
  }
};

export const update = async (reference, value) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock update');
    return Promise.resolve();
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbUpdate(resolvedRef, value);
  } catch (error) {
    console.error('Error updating value:', error);
    throw error;
  }
};

export const remove = async (reference) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock remove');
    return Promise.resolve();
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbRemove(resolvedRef);
  } catch (error) {
    console.error('Error removing value:', error);
    throw error;
  }
};

export const push = async (reference, value) => {
  if (!reference) throw new Error('Database reference is required');

  // Handle SSR case
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('Server-side rendering detected, using mock push');
    return Promise.resolve({ key: `mock-${Date.now()}` });
  }

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbPush(resolvedRef, value);
  } catch (error) {
    console.error('Error pushing value:', error);
    throw error;
  }
};

// Export the database initialization function
export { initializeDatabase as getDatabase };

// Export a function to check if database is initialized
export const isDatabaseInitialized = () => database !== null;
