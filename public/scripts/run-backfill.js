/**
 * This script can be run from the browser console to trigger the activity backfill
 * Usage: Copy and paste this into the browser console when logged in as an admin
 */
async function runActivityBackfill() {
  try {
    console.log('Triggering activity calendar backfill...');
    
    const response = await fetch('/api/backfill/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Backfill completed successfully!');
      console.log(result.message);
    } else {
      console.error('❌ Backfill failed:', result.error);
    }
  } catch (error) {
    console.error('Error triggering backfill:', error);
  }
}

// Run the backfill
runActivityBackfill();
