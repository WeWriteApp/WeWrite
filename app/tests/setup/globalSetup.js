/**
 * Global Jest setup for WeWrite tests
 */

module.exports = async () => {
  // Global setup logic here
  console.log('Setting up WeWrite test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  
  console.log('WeWrite test environment setup complete.');
};
