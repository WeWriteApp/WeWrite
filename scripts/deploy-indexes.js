/**
 * Firestore Index Deployment Helper
 * 
 * This script provides instructions for deploying the required Firestore indexes
 * for the WeWrite application's reading history feature.
 */

console.log(`
=======================================================================
FIRESTORE INDEX DEPLOYMENT INSTRUCTIONS
=======================================================================

You need to deploy the updated Firestore indexes to fix the reading history
functionality. The required index has been added to firestore.indexes.json.

To deploy the indexes, run the following command:

  firebase deploy --only firestore:indexes

This will create the following indexes:
1. Collection: readingHistory
   - Fields: userId (ascending), timestamp (descending)

Once the index is created (which may take a few minutes), the reading history
feature will work properly.

Note: You only need to deploy these indexes once. After creation, all queries
that use these indexes will work properly.
=======================================================================
`);

// If Firebase CLI is available, offer to run the command
const { execSync } = require('child_process');

try {
  // Check if Firebase CLI is installed
  execSync('firebase --version', { stdio: 'ignore' });
  
  // Prompt user to deploy indexes
  console.log('Firebase CLI is installed. Would you like to deploy the indexes now?');
  console.log('To deploy, run:');
  console.log('  node scripts/deploy-indexes.js --deploy');
  
  // Check if --deploy flag was passed
  if (process.argv.includes('--deploy')) {
    console.log('\nDeploying Firestore indexes...');
    try {
      execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
      console.log('\n✅ Firestore indexes deployed successfully!');
      console.log('The reading history feature should work once the indexes are built (usually within a few minutes).');
    } catch (deployError) {
      console.error('\n❌ Error deploying Firestore indexes:', deployError.message);
      console.log('Please try running the command manually:');
      console.log('  firebase deploy --only firestore:indexes');
    }
  }
} catch (error) {
  console.log('\nFirebase CLI not found. Please install it with:');
  console.log('  npm install -g firebase-tools');
  console.log('Then login with:');
  console.log('  firebase login');
  console.log('And deploy the indexes with:');
  console.log('  firebase deploy --only firestore:indexes');
}
