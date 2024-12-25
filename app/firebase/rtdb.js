import { getDatabase, ref as dbRef, onValue as dbOnValue, get as dbGet, set as dbSet, update as dbUpdate, remove as dbRemove, push as dbPush } from 'firebase/database';
import { database, isInitialized } from './config';

// Re-export the database instance
export const rtdb = database;

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
  // Wait for initialization with timeout
  const timeout = 5000;
  const startTime = Date.now();

  while (Date.now() -startTime < timeout) {
    if (isInitialized && database) {
      try {
        return dbRef(database, path);
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

  try {
    const resolvedRef = await Promise.resolve(reference);
    return dbPush(resolvedRef, value);
  } catch (error) {
    console.error('Error pushing value:', error);
    throw error;
  }
};

// Export the database instance
export default database;
