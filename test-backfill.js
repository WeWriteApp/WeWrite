// Simple test script to run analytics backfill
// Run this in the browser console on the admin dashboard

async function runBackfillTest() {
  try {
    console.log('🚀 Starting analytics backfill test...');
    
    // Get Firebase auth token
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    const token = await user.getIdToken();
    console.log('✅ Got auth token');
    
    // First run dry run
    console.log('📋 Running dry run...');
    const dryRunResponse = await fetch('/api/admin/backfill-analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        dryRun: true,
        batchSize: 50
      })
    });
    
    const dryRunResult = await dryRunResponse.json();
    console.log('📊 Dry run result:', dryRunResult);
    
    if (dryRunResult.success) {
      console.log('✅ Dry run successful!');
      console.log('Stats:', dryRunResult.stats);
      
      // Ask if user wants to proceed
      const proceed = confirm(`Dry run successful!\n\nStats:\n- Pages: ${dryRunResult.stats.pagesProcessed}\n- Daily aggregations: ${dryRunResult.stats.dailyAggregationsCreated}\n- Hourly aggregations: ${dryRunResult.stats.hourlyAggregationsCreated}\n\nProceed with actual backfill?`);
      
      if (proceed) {
        console.log('🔄 Running actual backfill...');
        const actualResponse = await fetch('/api/admin/backfill-analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            dryRun: false,
            batchSize: 50
          })
        });
        
        const actualResult = await actualResponse.json();
        console.log('🎯 Actual backfill result:', actualResult);
        
        if (actualResult.success) {
          console.log('🎉 Backfill completed successfully!');
          alert('Analytics backfill completed! Refresh the page to see updated data.');
        } else {
          console.error('❌ Backfill failed:', actualResult.error);
          alert(`Backfill failed: ${actualResult.error}`);
        }
      }
    } else {
      console.error('❌ Dry run failed:', dryRunResult.error);
      alert(`Dry run failed: ${dryRunResult.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
    alert(`Error: ${error.message}`);
  }
}

// Run the test
runBackfillTest();
