#!/usr/bin/env node

/**
 * Feature Flag UI Testing Script
 * 
 * This script tests the UI behavior when the payments feature flag is enabled/disabled
 * by checking the rendered content and button text.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  testTimeout: 10000
};

/**
 * Test the header support button behavior
 */
async function testHeaderSupportButton() {
  console.log('🧪 Testing Header Support Button...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeatureFlagTest/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Check for different button texts
    const hasActivateSubscription = html.includes('Activate Subscription');
    const hasSupportUs = html.includes('Support Us');
    const hasManageSubscription = html.includes('Manage Subscription');
    
    console.log('📊 Header Button Analysis:');
    console.log(`   ✅ Contains "Activate Subscription": ${hasActivateSubscription}`);
    console.log(`   ✅ Contains "Support Us": ${hasSupportUs}`);
    console.log(`   ✅ Contains "Manage Subscription": ${hasManageSubscription}`);
    
    return {
      hasActivateSubscription,
      hasSupportUs,
      hasManageSubscription
    };
  } catch (error) {
    console.error('❌ Error testing header support button:', error.message);
    return null;
  }
}

/**
 * Test the pledge bar behavior
 */
async function testPledgeBarBehavior() {
  console.log('🧪 Testing Pledge Bar Behavior...');
  
  try {
    // Test on a sample page (we'll use the home page for now)
    const response = await fetch(`${TEST_CONFIG.baseUrl}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeatureFlagTest/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Check for pledge bar content
    const hasActivateSubscriptionText = html.includes('Activate Subscription');
    const hasSupportWeWriteText = html.includes('Support WeWrite');
    const hasSupportThisPageText = html.includes('Support this page');
    
    console.log('📊 Pledge Bar Analysis:');
    console.log(`   ✅ Contains "Activate Subscription": ${hasActivateSubscriptionText}`);
    console.log(`   ✅ Contains "Support WeWrite": ${hasSupportWeWriteText}`);
    console.log(`   ✅ Contains "Support this page": ${hasSupportThisPageText}`);
    
    return {
      hasActivateSubscriptionText,
      hasSupportWeWriteText,
      hasSupportThisPageText
    };
  } catch (error) {
    console.error('❌ Error testing pledge bar:', error.message);
    return null;
  }
}

/**
 * Test feature flag configuration files
 */
async function testFeatureFlagConfig() {
  console.log('🧪 Testing Feature Flag Configuration...');
  
  const configFiles = [
    'app/utils/feature-flags.ts',
    'app/components/payments/PledgeBar.js',
    'app/components/layout/Header.tsx',
    'app/components/payments/SupportUsModal.js'
  ];
  
  const results = {};
  
  for (const filePath of configFiles) {
    const fullPath = path.join(__dirname, '..', filePath);
    
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check for feature flag usage
      const usesFeatureFlag = content.includes('useFeatureFlag') || content.includes('isFeatureEnabled');
      const hasPaymentsCheck = content.includes('payments');
      const hasProperConditionals = content.includes('isPaymentsEnabled') || content.includes('isSubscriptionEnabled');
      
      results[filePath] = {
        usesFeatureFlag,
        hasPaymentsCheck,
        hasProperConditionals,
        size: content.length
      };
      
      console.log(`📄 ${filePath}:`);
      console.log(`   ✅ Uses feature flag: ${usesFeatureFlag}`);
      console.log(`   ✅ Checks payments: ${hasPaymentsCheck}`);
      console.log(`   ✅ Has conditionals: ${hasProperConditionals}`);
      
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error.message);
      results[filePath] = { error: error.message };
    }
  }
  
  return results;
}

/**
 * Test API endpoints for feature flag behavior
 */
async function testAPIFeatureFlagBehavior() {
  console.log('🧪 Testing API Feature Flag Behavior...');
  
  const endpoints = [
    '/api/subscription-prices',
    '/api/create-portal-session'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      results[endpoint] = {
        status: response.status,
        statusText: response.statusText,
        available: response.status !== 404
      };
      
      console.log(`🔗 ${endpoint}: ${response.status} ${response.statusText}`);
      
    } catch (error) {
      console.error(`❌ Error testing ${endpoint}:`, error.message);
      results[endpoint] = { error: error.message };
    }
  }
  
  return results;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 FEATURE FLAG UI TEST REPORT');
  console.log('='.repeat(60));
  
  const { headerButton, pledgeBar, configFiles, apiEndpoints } = results;
  
  console.log('\n📊 SUMMARY:');
  
  if (headerButton) {
    console.log('\n🔘 Header Support Button:');
    if (headerButton.hasActivateSubscription) {
      console.log('   ✅ Shows "Activate Subscription" (Payments Enabled)');
    } else if (headerButton.hasSupportUs) {
      console.log('   ✅ Shows "Support Us" (Payments Disabled)');
    } else if (headerButton.hasManageSubscription) {
      console.log('   ✅ Shows "Manage Subscription" (Active Subscription)');
    } else {
      console.log('   ⚠️  No expected button text found');
    }
  }
  
  if (pledgeBar) {
    console.log('\n📋 Pledge Bar:');
    if (pledgeBar.hasActivateSubscriptionText) {
      console.log('   ✅ Shows "Activate Subscription" (Payments Enabled)');
    } else if (pledgeBar.hasSupportWeWriteText) {
      console.log('   ✅ Shows "Support WeWrite" (Payments Disabled)');
    } else {
      console.log('   ⚠️  No expected pledge bar text found');
    }
  }
  
  console.log('\n📁 Configuration Files:');
  Object.entries(configFiles).forEach(([file, result]) => {
    if (result.error) {
      console.log(`   ❌ ${file}: ${result.error}`);
    } else {
      const status = result.usesFeatureFlag && result.hasPaymentsCheck ? '✅' : '⚠️';
      console.log(`   ${status} ${file}: Feature flag integration ${result.usesFeatureFlag ? 'present' : 'missing'}`);
    }
  });
  
  console.log('\n🔗 API Endpoints:');
  Object.entries(apiEndpoints).forEach(([endpoint, result]) => {
    if (result.error) {
      console.log(`   ❌ ${endpoint}: ${result.error}`);
    } else {
      const status = result.available ? '✅' : '❌';
      console.log(`   ${status} ${endpoint}: ${result.status} ${result.statusText}`);
    }
  });
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('   1. Test the UI in a browser to verify visual changes');
  console.log('   2. Check browser console for feature flag debug logs');
  console.log('   3. Verify Firebase feature flag configuration');
  console.log('   4. Test with different user authentication states');
  
  console.log('='.repeat(60));
}

/**
 * Main test runner
 */
async function runFeatureFlagUITests() {
  console.log('🚀 Starting Feature Flag UI Tests...\n');
  
  try {
    const results = {
      headerButton: await testHeaderSupportButton(),
      pledgeBar: await testPledgeBarBehavior(),
      configFiles: await testFeatureFlagConfig(),
      apiEndpoints: await testAPIFeatureFlagBehavior()
    };
    
    generateTestReport(results);
    
    console.log('\n✅ Feature Flag UI tests completed!');
    
  } catch (error) {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFeatureFlagUITests();
}

export { runFeatureFlagUITests };
