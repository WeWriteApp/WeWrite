import { getDatabase, ref as dbRef, onValue as dbOnValue, get as dbGet, set as dbSet, update as dbUpdate, remove as dbRemove } from 'firebase/database';
import { database, isInitialized, initializationError } from './config';

// Re-export the database instance and functions with proper error handling
export const ref = async (path) => {
  // Wait for initialization with timeout
  const timeout = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (initializationError) {
      console.error('Database initialization failed:', initializationError);
      throw initializationError;
    }

    if (isInitialized && database && typeof database.ref === 'function') {
      try {
        // Use the database's ref method directly if available (for mock database)
        return database.ref(path);
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
  if (!reference) {
    const error = new Error('Database reference is required');
    console.error(error);
    throw error;
  }

  try {
    // Wait for reference if it's a promise
    const resolvedRef = await Promise.resolve(reference);

    // Use native method if available (mock database)
    if (typeof resolvedRef.on === 'function') {
      return resolvedRef.on('value', callback);
    }
    return dbOnValue(resolvedRef, callback);
  } catch (error) {
    console.error('Error setting up value listener:', error);
    throw error;
  }
};

export const get = async (reference) => {
  if (!reference) {
    const error = new Error('Database reference is required');
    console.error(error);
    throw error;
  }

  try {
    // Wait for reference if it's a promise
    const resolvedRef = await Promise.resolve(reference);

    // Use native method if available (mock database)
    if (typeof resolvedRef.once === 'function') {
      return resolvedRef.once('value');
    }
    return dbGet(resolvedRef);
  } catch (error) {
    console.error('Error getting value:', error);
    throw error;
  }
};

export const set = async (reference, value) => {
  if (!reference) {
    const error = new Error('Database reference is required');
    console.error(error);
    throw error;
  }

  try {
    // Wait for reference if it's a promise
    const resolvedRef = await Promise.resolve(reference);

    // Use native method if available (mock database)
    if (typeof resolvedRef.set === 'function') {
      return resolvedRef.set(value);
    }
    return dbSet(resolvedRef, value);
  } catch (error) {
    console.error('Error setting value:', error);
    throw error;
  }
};

export const update = async (reference, value) => {
  if (!reference) {
    const error = new Error('Database reference is required');
    console.error(error);
    throw error;
  }

  try {
    // Wait for reference if it's a promise
    const resolvedRef = await Promise.resolve(reference);

    // Use native method if available (mock database)
    if (typeof resolvedRef.update === 'function') {
      return resolvedRef.update(value);
    }
    return dbUpdate(resolvedRef, value);
  } catch (error) {
    console.error('Error updating value:', error);
    throw error;
  }
};

export const remove = async (reference) => {
  if (!reference) {
    const error = new Error('Database reference is required');
    console.error(error);
    throw error;
  }

  try {
    // Wait for reference if it's a promise
    const resolvedRef = await Promise.resolve(reference);

    // Use native method if available (mock database)
    if (typeof resolvedRef.remove === 'function') {
      return resolvedRef.remove();
    }
    return dbRemove(resolvedRef);
  } catch (error) {
    console.error('Error removing value:', error);
    throw error;
  }
};

// Export the database instance
export default database;
