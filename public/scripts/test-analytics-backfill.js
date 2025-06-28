/**
 * Test script for analytics backfill functionality
 * Usage: Copy and paste this into the browser console when logged in as an admin
 */
async function testAnalyticsBackfill() {
  try {
    console.log('🧪 Testing analytics backfill API...');
    
    // First, test with dry run
    console.log('📋 Running dry run test...');
    const dryRunResponse = await fetch('/api/admin/backfill-analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}`
      },
      body: JSON.stringify({
        dryRun: true,
        batchSize: 50
      })
    });
    
    const dryRunResult = await dryRunResponse.json();
    
    if (dryRunResult.success) {
      console.log('✅ Dry run completed successfully!');
      console.log('📊 Dry run statistics:', dryRunResult.stats);
      
      // Ask user if they want to proceed with actual backfill
      const proceed = confirm(
        `Dry run completed successfully!\n\n` +
        `Statistics:\n` +
        `- Pages processed: ${dryRunResult.stats.pagesProcessed}\n` +
        `- Daily aggregations to create: ${dryRunResult.stats.dailyAggregationsCreated}\n` +
        `- Hourly aggregations to create: ${dryRunResult.stats.hourlyAggregationsCreated}\n` +
        `- Global counters to update: ${dryRunResult.stats.globalCountersUpdated ? 'Yes' : 'No'}\n\n` +
        `Do you want to proceed with the actual backfill?`
      );
      
      if (proceed) {
        console.log('🚀 Running actual backfill...');
        const actualResponse = await fetch('/api/admin/backfill-analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            dryRun: false,
            batchSize: 50
          })
        });
        
        const actualResult = await actualResponse.json();
        
        if (actualResult.success) {
          console.log('🎉 Actual backfill completed successfully!');
          console.log('📈 Final statistics:', actualResult.stats);
          alert('Analytics backfill completed successfully! Check the console for details.');
        } else {
          console.error('❌ Actual backfill failed:', actualResult.error);
          alert(`Backfill failed: ${actualResult.error}`);
        }
      } else {
        console.log('⏹️ Backfill cancelled by user');
      }
    } else {
      console.error('❌ Dry run failed:', dryRunResult.error);
      alert(`Dry run failed: ${dryRunResult.error}`);
    }
  } catch (error) {
    console.error('💥 Error testing analytics backfill:', error);
    alert(`Error: ${error.message}`);
  }
}

// Test API endpoint availability
async function testBackfillAPI() {
  try {
    const response = await fetch('/api/admin/backfill-analytics');
    const data = await response.json();
    console.log('📡 API endpoint info:', data);
    return true;
  } catch (error) {
    console.error('❌ API endpoint not available:', error);
    return false;
  }
}

// Run the test
console.log('🔧 Analytics Backfill Test Script Loaded');
console.log('📋 Available functions:');
console.log('  - testAnalyticsBackfill() - Run full backfill test');
console.log('  - testBackfillAPI() - Test API endpoint availability');
console.log('');
console.log('💡 To start testing, run: testAnalyticsBackfill()');

// Auto-test API availability
testBackfillAPI().then(available => {
  if (available) {
    console.log('✅ Analytics backfill API is available');
  } else {
    console.log('❌ Analytics backfill API is not available');
  }
});
