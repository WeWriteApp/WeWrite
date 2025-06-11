/**
 * Manual Feature Flag Testing Script
 * 
 * Run this in the browser console to test feature flag behavior
 */

console.log('🧪 WeWrite Feature Flag Testing Script');
console.log('=====================================');

// Test 1: Check global feature flags
console.log('\n1. 📊 Global Feature Flags:');
if (typeof window !== 'undefined' && window.globalFeatureFlags) {
  console.log('   ✅ Global flags loaded:', window.globalFeatureFlags);
  console.log('   💰 Payments enabled:', window.globalFeatureFlags.payments);
} else {
  console.log('   ❌ Global flags not found');
}

// Test 2: Check for header button
console.log('\n2. 🔘 Header Support Button:');
const headerButtons = document.querySelectorAll('header button');
let foundSupportButton = false;
headerButtons.forEach(button => {
  const text = button.textContent.trim();
  if (text.includes('Support') || text.includes('Activate') || text.includes('Manage')) {
    console.log(`   ✅ Found button: "${text}"`);
    foundSupportButton = true;
  }
});
if (!foundSupportButton) {
  console.log('   ❌ No support button found in header');
}

// Test 3: Check for pledge bars
console.log('\n3. 📋 Pledge Bars:');
const pledgeBars = document.querySelectorAll('[data-pledge-bar], .pledge-bar, h3');
let foundPledgeText = false;
pledgeBars.forEach(element => {
  const text = element.textContent.trim();
  if (text.includes('Activate Subscription') || text.includes('Support WeWrite') || text.includes('Support this page')) {
    console.log(`   ✅ Found pledge text: "${text}"`);
    foundPledgeText = true;
  }
});
if (!foundPledgeText) {
  console.log('   ❌ No pledge bar text found');
}

// Test 4: Check for feature flag hooks
console.log('\n4. 🔧 Feature Flag Integration:');
const scripts = document.querySelectorAll('script');
let hasFeatureFlagCode = false;
scripts.forEach(script => {
  if (script.textContent.includes('useFeatureFlag') || script.textContent.includes('isPaymentsEnabled')) {
    hasFeatureFlagCode = true;
  }
});
console.log(`   ${hasFeatureFlagCode ? '✅' : '❌'} Feature flag code detected: ${hasFeatureFlagCode}`);

// Test 5: Check current user authentication
console.log('\n5. 👤 User Authentication:');
if (typeof window !== 'undefined' && window.firebase) {
  console.log('   ✅ Firebase available');
  // Note: This would need to be adapted based on the actual auth implementation
} else {
  console.log('   ❌ Firebase not available');
}

// Test 6: Simulate feature flag check
console.log('\n6. 🧮 Feature Flag Simulation:');
console.log('   To manually test feature flag behavior:');
console.log('   1. Open browser dev tools');
console.log('   2. Go to Application > Local Storage');
console.log('   3. Look for feature flag data');
console.log('   4. Check console for [FeatureFlags] logs');

// Test 7: Check for modals
console.log('\n7. 🪟 Modal Testing:');
console.log('   To test modals:');
console.log('   1. Click any support button');
console.log('   2. Check modal title and content');
console.log('   3. Look for DollarSign vs Heart icons');
console.log('   4. Verify button actions');

console.log('\n🎯 Testing Complete!');
console.log('=====================================');
console.log('If payments are enabled, you should see:');
console.log('• Header: "Activate Subscription" button');
console.log('• Pledge bars: "Activate Subscription" text');
console.log('• Modals: Subscription activation content');
console.log('\nIf payments are disabled, you should see:');
console.log('• Header: "Support Us" button');
console.log('• Pledge bars: "Support WeWrite" text');
console.log('• Modals: OpenCollective support content');
