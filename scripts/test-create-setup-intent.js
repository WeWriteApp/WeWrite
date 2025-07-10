#!/usr/bin/env node

/**
 * Test script to call the create-setup-intent API directly and see the error
 */

const https = require('https');

async function testCreateSetupIntent() {
  console.log('🧪 Testing create-setup-intent API...');
  
  const postData = JSON.stringify({
    userId: 'fWNeCuussPgYgkN2LGohFRCPXiy1',
    tier: 'tier2',
    amount: 20,
    tierName: 'Supporter',
    tokens: 20
  });
  
  const options = {
    hostname: 'wewrite-next-kuos7hwmi-wewrite-apps-projects.vercel.app',
    port: 443,
    path: '/api/subscription/create-setup-intent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      // You'll need to add your auth token here
      'Authorization': 'Bearer YOUR_AUTH_TOKEN_HERE'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📊 Status Code: ${res.statusCode}`);
      console.log(`📋 Headers:`, res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`📄 Response Body:`, JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.log(`📄 Raw Response:`, data);
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request Error:', error);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Since we can't easily get the auth token, let's test locally instead
async function testLocalAPI() {
  console.log('🏠 Testing local API instead...');
  
  try {
    const response = await fetch('http://localhost:3000/api/subscription/create-setup-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'fWNeCuussPgYgkN2LGohFRCPXiy1',
        tier: 'tier2',
        amount: 20,
        tierName: 'Supporter',
        tokens: 20
      })
    });
    
    console.log(`📊 Status: ${response.status}`);
    
    const data = await response.text();
    console.log(`📄 Response:`, data);
    
    try {
      const json = JSON.parse(data);
      console.log(`📋 Parsed JSON:`, JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('📄 Raw response (not JSON):', data);
    }
    
  } catch (error) {
    console.error('❌ Fetch Error:', error.message);
  }
}

console.log('💡 Note: This script tests the API without authentication.');
console.log('💡 For full testing, you need to run your local dev server and test there.');
console.log('💡 Or check the Vercel function logs directly.');

// testCreateSetupIntent().catch(console.error);
testLocalAPI().catch(console.error);
