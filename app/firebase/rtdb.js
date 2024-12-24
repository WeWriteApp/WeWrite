import { database } from './config';

// Re-export the database instance and functions
export const ref = (db, path) => {
  // If no db provided, use default database
  const dbInstance = db || database;
  return dbInstance.ref(path);
};

export const onValue = (reference, callback) => {
  if (!reference) throw new Error('Database reference is required');
  return reference.onValue(callback);
};

export const get = (reference) => {
  if (!reference) throw new Error('Database reference is required');
  return reference.get();
};

export const set = (reference, value) => {
  if (!reference) throw new Error('Database reference is required');
  return reference.set(value);
};

export const update = (reference, value) => {
  if (!reference) throw new Error('Database reference is required');
  return reference.update(value);
};

export const remove = (reference) => {
  if (!reference) throw new Error('Database reference is required');
  return reference.remove();
};

// Export getMockDatabase to provide access to the database instance
export const getMockDatabase = () => database;

export default database;
