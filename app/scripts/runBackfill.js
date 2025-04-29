import { backfillActivityCalendar } from './backfillActivityCalendar';

/**
 * Run the activity calendar backfill script directly
 */
async function runBackfill() {
  console.log('Starting activity calendar backfill...');
  
  try {
    // Run the backfill for all users
    const result = await backfillActivityCalendar(null, true);
    
    if (result.success) {
      console.log(`Backfill completed successfully! Processed ${result.usersProcessed} users.`);
    } else {
      console.error(`Backfill failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Unexpected error during backfill:', error);
  }
  
  console.log('Backfill process finished.');
}

// Execute the backfill
runBackfill();
