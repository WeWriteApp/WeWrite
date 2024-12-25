import { getDatabase, ref as dbRef, onValue as dbOnValue, get as dbGet, set as dbSet, update as dbUpdate, remove as dbRemove } from 'firebase/database';
import { database } from './config';

// Re-export the database instance and functions with proper error handling
export const ref = (path) => {
  if (!database || !database._checkNotDeleted || typeof database.ref !== 'function') {
    console.error('Database instance not available or invalid:', {
      exists: !!database,
      hasCheckNotDeleted: database?._checkNotDeleted,
      hasRef: typeof database?.ref === 'function'
    });
    throw new Error('Database not initialized or invalid');
  }

  try {
    // Use the database's ref method directly if available (for mock database)
    if (typeof database.ref === 'function') {
      return database.ref(path);
    }
    // Otherwise use Firebase's dbRef
    return dbRef(database, path);
  } catch (error) {
    console.error('Error creating database reference:', error);
    throw error;
  }
};

export const onValue = (reference, callback) => {
  if (!reference) throw new Error('Database reference is required');

  // Use native method if available (mock database)
  if (typeof reference.on === 'function') {
    return reference.on('value', callback);
  }
  return dbOnValue(reference, callback);
};

export const get = (reference) => {
  if (!reference) throw new Error('Database reference is required');

  // Use native method if available (mock database)
  if (typeof reference.once === 'function') {
    return reference.once('value');
  }
  return dbGet(reference);
};

export const set = (reference, value) => {
  if (!reference) throw new Error('Database reference is required');

  // Use native method if available (mock database)
  if (typeof reference.set === 'function') {
    return reference.set(value);
  }
  return dbSet(reference, value);
};

export const update = (reference, value) => {
  if (!reference) throw new Error('Database reference is required');

  // Use native method if available (mock database)
  if (typeof reference.update === 'function') {
    return reference.update(value);
  }
  return dbUpdate(reference, value);
};

export const remove = (reference) => {
  if (!reference) throw new Error('Database reference is required');

  // Use native method if available (mock database)
  if (typeof reference.remove === 'function') {
    return reference.remove();
  }
  return dbRemove(reference);
};

// Export the database instance
export default database;
