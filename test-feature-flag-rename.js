#!/usr/bin/env node

/**
 * Test script to verify the feature flag rename is working
 */

console.log('🧪 Testing feature flag rename from subscription_management to payments...');

// Test 1: Check TypeScript type definition
console.log('\n1. Testing TypeScript type definition...');
try {
  const fs = require('fs');
  const featureFlagsContent = fs.readFileSync('./app/utils/feature-flags.ts', 'utf8');
  
  if (featureFlagsContent.includes("'payments'")) {
    console.log('✅ TypeScript type includes "payments"');
  } else {
    console.log('❌ TypeScript type missing "payments"');
  }
  
  if (!featureFlagsContent.includes("'subscription_management'")) {
    console.log('✅ TypeScript type no longer includes "subscription_management"');
  } else {
    console.log('❌ TypeScript type still includes "subscription_management"');
  }
} catch (error) {
  console.log('❌ Error reading feature-flags.ts:', error.message);
}

// Test 2: Check hook usage
console.log('\n2. Testing hook usage...');
try {
  const fs = require('fs');
  const hookContent = fs.readFileSync('./app/hooks/useSubscriptionFeature.js', 'utf8');
  
  if (hookContent.includes("useFeatureFlag('payments'")) {
    console.log('✅ useSubscriptionFeature hook uses "payments"');
  } else {
    console.log('❌ useSubscriptionFeature hook not using "payments"');
  }
  
  if (!hookContent.includes("useFeatureFlag('subscription_management'")) {
    console.log('✅ useSubscriptionFeature hook no longer uses "subscription_management"');
  } else {
    console.log('❌ useSubscriptionFeature hook still uses "subscription_management"');
  }
} catch (error) {
  console.log('❌ Error reading useSubscriptionFeature.js:', error.message);
}

// Test 3: Check component usage
console.log('\n3. Testing component usage...');
const componentsToCheck = [
  './app/components/PledgeBar.js',
  './app/components/FollowingList.tsx',
  './app/components/ActivityCard.js',
  './app/account/page.tsx'
];

componentsToCheck.forEach(filePath => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes("useFeatureFlag('payments'") || content.includes("flagsData.payments")) {
      console.log(`✅ ${filePath} uses "payments"`);
    } else {
      console.log(`❌ ${filePath} not using "payments"`);
    }
    
    if (!content.includes("useFeatureFlag('subscription_management'") && !content.includes("flagsData.subscription_management")) {
      console.log(`✅ ${filePath} no longer uses "subscription_management"`);
    } else {
      console.log(`❌ ${filePath} still uses "subscription_management"`);
    }
  } catch (error) {
    console.log(`❌ Error reading ${filePath}:`, error.message);
  }
});

// Test 4: Check admin panel configuration
console.log('\n4. Testing admin panel configuration...');
try {
  const fs = require('fs');
  const adminContent = fs.readFileSync('./app/components/AdminPanel.tsx', 'utf8');
  
  if (adminContent.includes("id: 'payments'")) {
    console.log('✅ AdminPanel.tsx includes payments flag');
  } else {
    console.log('❌ AdminPanel.tsx missing payments flag');
  }
  
  if (!adminContent.includes("id: 'subscription_management'")) {
    console.log('✅ AdminPanel.tsx no longer includes subscription_management flag');
  } else {
    console.log('❌ AdminPanel.tsx still includes subscription_management flag');
  }
} catch (error) {
  console.log('❌ Error reading AdminPanel.tsx:', error.message);
}

console.log('\n🎉 Feature flag rename test completed!');
console.log('\n📝 Summary:');
console.log('- All code references should now use "payments" instead of "subscription_management"');
console.log('- The database migration needs to be run when you have admin access');
console.log('- Test the admin panel to ensure the toggle works correctly');
