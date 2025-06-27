#!/usr/bin/env node

/**
 * Monthly processing script for Start-of-Month Model
 *
 * 1st of month (all processing happens together):
 *   1. Finalize token allocations from previous month → send to writers
 *   2. Process payouts for writers
 *   3. Bill subscriptions for new month → users get new tokens immediately
 *   4. Users can start allocating new tokens (no dead zone!)
 *
 * Usage:
 * node scripts/process-monthly-payouts.cjs [--dry-run] [--period=YYYY-MM]
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const API_KEY = process.env.CRON_API_KEY;

if (!API_KEY) {
  console.error('❌ CRON_API_KEY environment variable is required');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const periodArg = args.find(arg => arg.startsWith('--period='));
const period = periodArg ? periodArg.split('=')[1] : null;

console.log('🚀 Starting monthly processing (Start-of-Month Model)...');
console.log(`📅 Period: ${period || 'auto (previous month)'}`);
console.log(`🧪 Dry run: ${dryRun ? 'YES' : 'NO'}`);
console.log('📋 Processing: All steps (allocations → payouts → billing)');
console.log('');

async function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = (urlObj.protocol === 'https:' ? https : require('http')).request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function processMonthlyPayouts() {
  try {
    console.log('📊 Processing monthly earnings and payouts...');

    const response = await makeRequest(`${BASE_URL}/api/payouts/process-monthly`, {
      period,
      dryRun
    });

    if (response.status === 200) {
      const result = response.data;

      console.log('✅ Monthly payout processing completed successfully!');
      console.log('');
      console.log('📈 Payout Results:');
      console.log(`   Period: ${result.data.period}`);
      console.log(`   Pledges processed: ${result.data.pledgesProcessed}`);
      console.log(`   Earnings created: ${result.data.earningsCreated}`);
      console.log(`   Total earnings: $${result.data.totalEarningsAmount?.toFixed(2) || '0.00'}`);
      console.log(`   Payouts created: ${result.data.payoutsCreated}`);
      console.log(`   Total payouts: $${result.data.totalPayoutAmount?.toFixed(2) || '0.00'}`);
      console.log(`   Payouts processed: ${result.data.payoutsProcessed}`);

      if (dryRun) {
        console.log('');
        console.log('🧪 This was a dry run - no actual changes were made');
      }

    } else {
      console.error('❌ Payout processing failed:', response.data.error || 'Unknown error');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error processing monthly payouts:', error.message);
    process.exit(1);
  }
}

async function processMonthlyTokens() {
  try {
    console.log('🪙 Processing monthly token distribution...');

    const response = await makeRequest(`${BASE_URL}/api/tokens/process-monthly`, {
      period,
      dryRun
    });

    if (response.status === 200) {
      const result = response.data;

      console.log('✅ Monthly token distribution completed successfully!');
      console.log('');
      console.log('🪙 Token Results:');
      console.log(`   Period: ${result.data.period}`);
      console.log(`   Total tokens distributed: ${result.data.totalTokensDistributed}`);
      console.log(`   Users participating: ${result.data.totalUsersParticipating}`);
      console.log(`   WeWrite tokens: ${result.data.wewriteTokens}`);
      console.log(`   Status: ${result.data.status}`);

      if (dryRun) {
        console.log('');
        console.log('🧪 This was a dry run - no actual changes were made');
      }

    } else {
      console.error('❌ Token distribution failed:', response.data.error || 'Unknown error');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error processing monthly tokens:', error.message);
    process.exit(1);
  }
}

async function checkProcessingStatus() {
  try {
    console.log('🔍 Checking processing status...');
    
    const response = await makeRequest(`${BASE_URL}/api/payouts/process-monthly?period=${period || ''}`, {});
    
    if (response.status === 200) {
      const result = response.data;
      
      console.log('📊 Processing Status:');
      console.log(`   Period: ${result.data.period}`);
      console.log(`   Total payouts: ${result.data.totalPayouts}`);
      console.log(`   Total amount: $${result.data.totalAmount?.toFixed(2) || '0.00'}`);
      console.log('   Status breakdown:');
      
      Object.entries(result.data.statusCounts || {}).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });
      
    } else {
      console.error('❌ Failed to get status:', response.data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting start-of-month processing...');
    console.log('');

    // Step 1: Finalize token allocations from previous month
    console.log('📋 STEP 1: Finalizing token allocations from previous month...');
    await processMonthlyTokens();

    console.log('');
    console.log('⏳ Waiting 2 seconds before processing payouts...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Process payouts for writers
    console.log('💰 STEP 2: Processing payouts for writers...');
    await processMonthlyPayouts();

    console.log('');
    console.log('⏳ Waiting 2 seconds before billing subscriptions...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Bill subscriptions for new month (users get tokens immediately)
    console.log('💳 STEP 3: Billing subscriptions for new month...');
    await processNewSubscriptionBilling();

    // Wait a moment then check status
    console.log('');
    console.log('⏳ Waiting 5 seconds before checking status...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    await checkProcessingStatus();

    console.log('');
    console.log('🎉 Start-of-month processing completed!');
    console.log('💡 Users can now allocate their new tokens throughout the month.');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Process interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Process terminated');
  process.exit(0);
});

// Run the script
main();
