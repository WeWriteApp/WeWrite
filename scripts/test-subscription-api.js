#!/usr/bin/env node

/**
 * Test script to verify the subscription API is working correctly after migration
 */

const https = require('https');

async function testSubscriptionAPI(baseUrl, userId) {
  const url = `${baseUrl}/api/user-subscription?userId=${userId}`;
  
  console.log(`🔍 Testing subscription API: ${url}`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ API Response (${res.statusCode}):`, JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse response:', data);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
  });
}

async function main() {
  console.log('🚀 Testing Subscription API After Migration');
  console.log('==========================================\n');
  
  // Your user ID from the migration
  const userId = 'fWNeCuussPgYgkN2LGohFRCPXiy1';
  
  // Test different environments
  const environments = [
    {
      name: 'Local Development',
      url: 'http://localhost:3000'
    },
    {
      name: 'Production',
      url: 'https://www.getwewrite.app'
    }
  ];
  
  for (const env of environments) {
    console.log(`📍 Testing ${env.name}: ${env.url}`);
    
    try {
      const response = await testSubscriptionAPI(env.url, userId);
      
      // Analyze the response
      if (response.status === 'active') {
        console.log(`✅ SUCCESS: ${env.name} shows active subscription!`);
      } else if (response.tier === 'inactive') {
        console.log(`❌ ISSUE: ${env.name} still shows inactive subscription`);
      } else {
        console.log(`⚠️  UNKNOWN: ${env.name} returned unexpected response`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${env.name} - ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('💡 If you have a Vercel preview URL, you can test it manually by visiting:');
  console.log(`   [YOUR_PREVIEW_URL]/api/user-subscription?userId=${userId}`);
}

main().catch(console.error);
