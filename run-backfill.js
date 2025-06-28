// Simple script to run analytics backfill
// Copy and paste this into the browser console on the admin dashboard

(async function() {
  try {
    console.log('🚀 Starting analytics backfill...');
    
    // Get Firebase auth
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    const token = await user.getIdToken();
    console.log('✅ Got auth token');
    
    // Run dry run first
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
      
      // Run actual backfill
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
        console.log('Final stats:', actualResult.stats);
        alert('Analytics backfill completed! Refresh the page to see updated data.');
      } else {
        console.error('❌ Backfill failed:', actualResult.error);
        alert(`Backfill failed: ${actualResult.error}`);
      }
    } else {
      console.error('❌ Dry run failed:', dryRunResult.error);
      alert(`Dry run failed: ${dryRunResult.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
    alert(`Error: ${error.message}`);
  }
})();
