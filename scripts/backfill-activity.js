// Node.js script to run the activity calendar backfill

// Import the Firebase app initialization
require('dotenv').config();
const path = require('path');

// Set up module aliases for imports
require('module-alias').addAliases({
  '@': path.resolve(__dirname, '../app')
});

// Run the backfill script
async function main() {
  try {
    // Dynamically import the ESM module
    const { backfillActivityCalendar } = await import('../app/scripts/backfillActivityCalendar.js');
    
    console.log('Starting activity calendar backfill...');
    const result = await backfillActivityCalendar();
    
    if (result.success) {
      console.log(`Backfill completed successfully! Processed ${result.usersProcessed} users.`);
      process.exit(0);
    } else {
      console.error(`Backfill failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running backfill script:', error);
    process.exit(1);
  }
}

main();
