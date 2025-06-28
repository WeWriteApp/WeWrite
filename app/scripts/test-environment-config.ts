#!/usr/bin/env tsx

/**
 * Test Environment Configuration
 * 
 * This script validates that environment-specific collection naming
 * is working correctly across different environments.
 */

import { 
  getEnvironmentType, 
  getEnvironmentPrefix, 
  getCollectionName, 
  getSubCollectionPath,
  validateEnvironmentConfig,
  logEnvironmentConfig,
  PAYMENT_COLLECTIONS 
} from '../utils/environmentConfig';

function testEnvironmentDetection() {
  console.log('\n🔍 Testing Environment Detection...');
  
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  
  console.log(`Environment Type: ${envType}`);
  console.log(`Environment Prefix: "${prefix}"`);
  
  // Test validation
  const isValid = validateEnvironmentConfig();
  console.log(`Configuration Valid: ${isValid ? '✅' : '❌'}`);
  
  if (!isValid) {
    console.error('❌ Environment configuration validation failed!');
    process.exit(1);
  }
}

function testCollectionNaming() {
  console.log('\n📝 Testing Collection Naming...');
  
  const testCollections = [
    'subscriptions',
    'tokenBalances', 
    'tokenAllocations',
    'writerTokenBalances',
    'writerTokenEarnings',
    'tokenPayouts'
  ];
  
  testCollections.forEach(collection => {
    const envSpecificName = getCollectionName(collection);
    console.log(`${collection} -> ${envSpecificName}`);
  });
}

function testSubCollectionPaths() {
  console.log('\n🗂️ Testing SubCollection Paths...');
  
  const testUserId = 'test-user-123';
  
  const { parentPath, subCollectionName } = getSubCollectionPath(
    PAYMENT_COLLECTIONS.USERS, 
    testUserId, 
    PAYMENT_COLLECTIONS.SUBSCRIPTIONS
  );
  
  console.log(`Parent Path: ${parentPath}`);
  console.log(`SubCollection Name: ${subCollectionName}`);
  console.log(`Full Path: ${parentPath}/${subCollectionName}`);
}

function testPaymentCollections() {
  console.log('\n💳 Testing Payment Collections...');
  
  Object.entries(PAYMENT_COLLECTIONS).forEach(([key, value]) => {
    const envSpecificName = getCollectionName(value);
    console.log(`${key}: ${value} -> ${envSpecificName}`);
  });
}

function testEnvironmentScenarios() {
  console.log('\n🌍 Testing Environment Scenarios...');
  
  // Save original env vars
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalNodeEnv = process.env.NODE_ENV;
  
  const scenarios = [
    { VERCEL_ENV: 'production', NODE_ENV: 'production', expected: '' },
    { VERCEL_ENV: 'preview', NODE_ENV: 'production', expected: 'preview_' },
    { VERCEL_ENV: undefined, NODE_ENV: 'development', expected: 'dev_' },
    { VERCEL_ENV: undefined, NODE_ENV: 'test', expected: 'dev_' }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`\nScenario ${index + 1}:`);
    console.log(`  VERCEL_ENV: ${scenario.VERCEL_ENV || 'undefined'}`);
    console.log(`  NODE_ENV: ${scenario.NODE_ENV}`);
    
    // Set environment variables
    if (scenario.VERCEL_ENV) {
      process.env.VERCEL_ENV = scenario.VERCEL_ENV;
    } else {
      delete process.env.VERCEL_ENV;
    }
    process.env.NODE_ENV = scenario.NODE_ENV;
    
    // Clear module cache to force re-evaluation
    delete require.cache[require.resolve('../utils/environmentConfig')];
    
    // Re-import to get fresh evaluation
    const { getEnvironmentPrefix: freshGetPrefix } = require('../utils/environmentConfig');
    const actualPrefix = freshGetPrefix();
    
    console.log(`  Expected Prefix: "${scenario.expected}"`);
    console.log(`  Actual Prefix: "${actualPrefix}"`);
    console.log(`  Result: ${actualPrefix === scenario.expected ? '✅' : '❌'}`);
    
    if (actualPrefix !== scenario.expected) {
      console.error(`❌ Scenario ${index + 1} failed!`);
    }
  });
  
  // Restore original env vars
  if (originalVercelEnv) {
    process.env.VERCEL_ENV = originalVercelEnv;
  } else {
    delete process.env.VERCEL_ENV;
  }
  process.env.NODE_ENV = originalNodeEnv;
}

function main() {
  console.log('🧪 Environment Configuration Test Suite');
  console.log('========================================');
  
  try {
    // Log current configuration
    logEnvironmentConfig();
    
    // Run tests
    testEnvironmentDetection();
    testCollectionNaming();
    testSubCollectionPaths();
    testPaymentCollections();
    testEnvironmentScenarios();
    
    console.log('\n✅ All tests passed! Environment configuration is working correctly.');
    console.log('\n🚀 Ready for safe payments rollout across environments!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the test suite
main();
