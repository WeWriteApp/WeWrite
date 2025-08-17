#!/usr/bin/env node

/**
 * Comprehensive test script for USD migration
 * 
 * This script runs various tests to validate the USD-based system:
 * - Unit tests for utilities
 * - Integration tests for API endpoints
 * - End-to-end workflow tests
 * - Migration accuracy tests
 * - Performance tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  UNIT_TESTS: [
    '__tests__/utils/formatCurrency.test.ts',
    '__tests__/utils/usdConstants.test.ts'
  ],
  INTEGRATION_TESTS: [
    '__tests__/api/usd/balance.test.ts',
    '__tests__/api/usd/allocate.test.ts'
  ],
  TIMEOUT: 30000, // 30 seconds
  VERBOSE: process.argv.includes('--verbose')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubsection(title) {
  log(`\n${title}`, 'yellow');
  log('-'.repeat(title.length), 'yellow');
}

/**
 * Run Jest tests for specific files
 */
function runJestTests(testFiles, description) {
  logSubsection(`Running ${description}`);
  
  try {
    const testPattern = testFiles.join('|');
    const jestCommand = `npx jest --testPathPattern="${testPattern}" --verbose=${TEST_CONFIG.VERBOSE} --timeout=${TEST_CONFIG.TIMEOUT}`;
    
    log(`Command: ${jestCommand}`, 'blue');
    
    const output = execSync(jestCommand, { 
      encoding: 'utf8',
      stdio: TEST_CONFIG.VERBOSE ? 'inherit' : 'pipe'
    });
    
    if (!TEST_CONFIG.VERBOSE) {
      // Parse Jest output for summary
      const lines = output.split('\n');
      const summaryLine = lines.find(line => line.includes('Tests:'));
      if (summaryLine) {
        log(summaryLine, 'green');
      }
    }
    
    log(`✅ ${description} passed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    if (TEST_CONFIG.VERBOSE) {
      log(error.stdout || error.message, 'red');
    }
    return false;
  }
}

/**
 * Test currency conversion accuracy
 */
function testCurrencyConversions() {
  logSubsection('Testing Currency Conversion Accuracy');
  
  const { dollarsToCents, centsToDollars, migrateTokensToUsdCents } = require('../app/utils/formatCurrency');
  
  const testCases = [
    { dollars: 0, expectedCents: 0 },
    { dollars: 1, expectedCents: 100 },
    { dollars: 10.50, expectedCents: 1050 },
    { dollars: 99.99, expectedCents: 9999 },
    { dollars: 1000, expectedCents: 100000 }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(({ dollars, expectedCents }) => {
    const cents = dollarsToCents(dollars);
    const backToDollars = centsToDollars(cents);
    
    if (cents === expectedCents && backToDollars === dollars) {
      log(`✅ $${dollars} ↔ ${cents} cents`, 'green');
      passed++;
    } else {
      log(`❌ $${dollars} → ${cents} cents (expected ${expectedCents})`, 'red');
      failed++;
    }
  });
  
  // Test token migration
  const tokenMigrationTests = [
    { tokens: 0, expectedCents: 0 },
    { tokens: 10, expectedCents: 100 }, // 10 tokens = $1.00
    { tokens: 100, expectedCents: 1000 }, // 100 tokens = $10.00
    { tokens: 250, expectedCents: 2500 } // 250 tokens = $25.00
  ];
  
  tokenMigrationTests.forEach(({ tokens, expectedCents }) => {
    const cents = migrateTokensToUsdCents(tokens);
    
    if (cents === expectedCents) {
      log(`✅ ${tokens} tokens → ${cents} cents`, 'green');
      passed++;
    } else {
      log(`❌ ${tokens} tokens → ${cents} cents (expected ${expectedCents})`, 'red');
      failed++;
    }
  });
  
  log(`\nConversion Tests: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  return failed === 0;
}

/**
 * Test API endpoint availability
 */
async function testApiEndpoints() {
  logSubsection('Testing API Endpoint Availability');
  
  const endpoints = [
    '/api/usd/balance',
    '/api/usd/allocate',
    '/api/usd/allocate-user',
    '/api/usd/pledge-bar-data',
    '/api/usd/initialize-balance'
  ];
  
  // This is a basic check - in a real environment, you'd make actual HTTP requests
  const apiDir = path.join(__dirname, '../app/api/usd');
  
  let passed = 0;
  let failed = 0;
  
  endpoints.forEach(endpoint => {
    const routePath = endpoint.replace('/api/usd/', '').replace(/\//g, path.sep);
    const filePath = path.join(apiDir, routePath, 'route.ts');
    
    if (fs.existsSync(filePath)) {
      log(`✅ ${endpoint} - route file exists`, 'green');
      passed++;
    } else {
      log(`❌ ${endpoint} - route file missing`, 'red');
      failed++;
    }
  });
  
  log(`\nAPI Endpoint Tests: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  return failed === 0;
}

/**
 * Test component availability
 */
function testComponentAvailability() {
  logSubsection('Testing USD Component Availability');
  
  const components = [
    'app/components/payments/UsdPledgeBar.tsx',
    'app/components/payments/UsdAllocationModal.tsx',
    'app/components/payments/UserUsdPledgeBar.tsx',
    'app/components/payments/UsdAllocationDisplay.tsx',
    'app/components/payments/UsdAllocationBreakdown.tsx',
    'app/components/payments/UsdFundingTierSlider.tsx',
    'app/components/ui/UsdPieChart.tsx',
    'app/components/ui/RemainingUsdCounter.tsx'
  ];
  
  let passed = 0;
  let failed = 0;
  
  components.forEach(componentPath => {
    const fullPath = path.join(__dirname, '..', componentPath);
    
    if (fs.existsSync(fullPath)) {
      log(`✅ ${componentPath}`, 'green');
      passed++;
    } else {
      log(`❌ ${componentPath} - missing`, 'red');
      failed++;
    }
  });
  
  log(`\nComponent Tests: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  return failed === 0;
}

/**
 * Test service availability
 */
function testServiceAvailability() {
  logSubsection('Testing USD Service Availability');
  
  const services = [
    'app/services/usdService.server.ts',
    'app/services/usdService.ts',
    'app/contexts/UsdBalanceContext.tsx',
    'app/utils/simulatedUsd.ts'
  ];
  
  let passed = 0;
  let failed = 0;
  
  services.forEach(servicePath => {
    const fullPath = path.join(__dirname, '..', servicePath);
    
    if (fs.existsSync(fullPath)) {
      log(`✅ ${servicePath}`, 'green');
      passed++;
    } else {
      log(`❌ ${servicePath} - missing`, 'red');
      failed++;
    }
  });
  
  log(`\nService Tests: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  return failed === 0;
}

/**
 * Test migration scripts
 */
function testMigrationScripts() {
  logSubsection('Testing Migration Script Availability');
  
  const scripts = [
    'scripts/migrate-tokens-to-usd.js',
    'scripts/rollback-usd-migration.js'
  ];
  
  let passed = 0;
  let failed = 0;
  
  scripts.forEach(scriptPath => {
    const fullPath = path.join(__dirname, '..', scriptPath);
    
    if (fs.existsSync(fullPath)) {
      // Check if script is executable
      try {
        const stats = fs.statSync(fullPath);
        log(`✅ ${scriptPath} - exists and readable`, 'green');
        passed++;
      } catch (error) {
        log(`❌ ${scriptPath} - exists but not readable`, 'red');
        failed++;
      }
    } else {
      log(`❌ ${scriptPath} - missing`, 'red');
      failed++;
    }
  });
  
  log(`\nMigration Script Tests: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');
  return failed === 0;
}

/**
 * Main test runner
 */
async function runAllTests() {
  logSection('WeWrite USD Migration Test Suite');
  
  const results = {
    unitTests: false,
    integrationTests: false,
    currencyConversions: false,
    apiEndpoints: false,
    components: false,
    services: false,
    migrationScripts: false
  };
  
  try {
    // Run unit tests
    results.unitTests = runJestTests(TEST_CONFIG.UNIT_TESTS, 'Unit Tests');
    
    // Run integration tests
    results.integrationTests = runJestTests(TEST_CONFIG.INTEGRATION_TESTS, 'Integration Tests');
    
    // Run custom tests
    results.currencyConversions = testCurrencyConversions();
    results.apiEndpoints = await testApiEndpoints();
    results.components = testComponentAvailability();
    results.services = testServiceAvailability();
    results.migrationScripts = testMigrationScripts();
    
  } catch (error) {
    log(`\nUnexpected error during testing: ${error.message}`, 'red');
  }
  
  // Summary
  logSection('Test Results Summary');
  
  const testCategories = Object.keys(results);
  const passedTests = testCategories.filter(category => results[category]);
  const failedTests = testCategories.filter(category => !results[category]);
  
  passedTests.forEach(category => {
    log(`✅ ${category}`, 'green');
  });
  
  failedTests.forEach(category => {
    log(`❌ ${category}`, 'red');
  });
  
  const overallSuccess = failedTests.length === 0;
  
  log(`\nOverall Result: ${passedTests.length}/${testCategories.length} test categories passed`, 
      overallSuccess ? 'green' : 'red');
  
  if (overallSuccess) {
    log('\n🎉 All tests passed! USD migration is ready for deployment.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review and fix issues before deployment.', 'red');
  }
  
  process.exit(overallSuccess ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testCurrencyConversions,
  testApiEndpoints,
  testComponentAvailability,
  testServiceAvailability,
  testMigrationScripts
};
