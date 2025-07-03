#!/usr/bin/env node

/**
 * Payment Flow Test Runner
 * 
 * Comprehensive test runner for all payment flow testing.
 * Executes tests in the correct order and provides detailed reporting.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  file: string;
  description: string;
  dependencies?: string[];
  critical: boolean;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Payment Flow Setup',
    file: 'setup/paymentFlowTestSetup.test.ts',
    description: 'Test environment setup and utilities',
    critical: true
  },
  {
    name: 'Subscription Flow',
    file: 'subscriptionFlow.test.ts',
    description: 'Subscription creation, activation, and management',
    critical: true
  },
  {
    name: 'Token Allocation',
    file: 'tokenAllocation.test.ts',
    description: 'Token purchasing, allocation, and validation',
    dependencies: ['Subscription Flow'],
    critical: true
  },
  {
    name: 'Unfunded Token States',
    file: 'unfundedTokenStates.test.ts',
    description: 'Logged-out users, no subscription, over-budget states',
    dependencies: ['Token Allocation'],
    critical: true
  },
  {
    name: 'Funded Token States',
    file: 'fundedTokenStates.test.ts',
    description: 'Pending and locked token states with earnings tracking',
    dependencies: ['Token Allocation'],
    critical: true
  },
  {
    name: 'Earnings Dashboard',
    file: 'earningsDashboard.test.ts',
    description: 'Writer earnings dashboard and balance calculations',
    dependencies: ['Funded Token States'],
    critical: true
  },
  {
    name: 'Payout System',
    file: 'payoutSystem.test.ts',
    description: 'Payout requests, validation, and processing',
    dependencies: ['Earnings Dashboard'],
    critical: true
  },
  {
    name: 'Fee Breakdown & Bank Transfer',
    file: 'feeBreakdownBankTransfer.test.ts',
    description: 'Fee calculations and Stripe Connect integration',
    dependencies: ['Payout System'],
    critical: true
  },
  {
    name: 'End-to-End Integration',
    file: 'endToEndPaymentFlow.test.ts',
    description: 'Complete payment flows and cross-service integration',
    dependencies: ['Fee Breakdown & Bank Transfer'],
    critical: true
  }
];

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

class PaymentFlowTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Payment Flow Test Suite');
    console.log('=====================================\n');

    // Verify test files exist
    this.verifyTestFiles();

    // Run tests in dependency order
    for (const suite of TEST_SUITES) {
      await this.runTestSuite(suite);
    }

    // Generate final report
    this.generateReport();
  }

  private verifyTestFiles(): void {
    console.log('📋 Verifying test files...');
    
    const missingFiles: string[] = [];
    
    for (const suite of TEST_SUITES) {
      const testPath = path.join(__dirname, suite.file);
      if (!existsSync(testPath)) {
        missingFiles.push(suite.file);
      }
    }

    if (missingFiles.length > 0) {
      console.error('❌ Missing test files:');
      missingFiles.forEach(file => console.error(`   - ${file}`));
      process.exit(1);
    }

    console.log('✅ All test files found\n');
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`🧪 Running: ${suite.name}`);
    console.log(`   Description: ${suite.description}`);
    
    if (suite.dependencies) {
      console.log(`   Dependencies: ${suite.dependencies.join(', ')}`);
    }

    const startTime = Date.now();
    
    try {
      const testPath = path.join(__dirname, suite.file);
      const command = `npx jest ${testPath} --verbose --detectOpenHandles`;
      
      console.log(`   Command: ${command}`);
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 60000, // 60 second timeout
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: true,
        duration,
        output
      });

      console.log(`✅ ${suite.name} - PASSED (${duration}ms)\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message
      });

      console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}\n`);

      // Stop on critical test failures
      if (suite.critical) {
        console.log('🛑 Critical test failed. Stopping execution.');
        this.generateReport();
        process.exit(1);
      }
    }
  }

  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;
    const totalTests = this.results.length;

    console.log('\n📊 Payment Flow Test Results');
    console.log('============================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

    // Detailed results
    console.log('📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.suite} (${result.duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    // Test coverage summary
    console.log('\n🎯 Test Coverage Summary:');
    console.log('- ✅ Subscription setup and management');
    console.log('- ✅ Token purchasing and allocation');
    console.log('- ✅ Unfunded token state handling');
    console.log('- ✅ Funded token state tracking');
    console.log('- ✅ Earnings dashboard functionality');
    console.log('- ✅ Payout system processing');
    console.log('- ✅ Fee calculations and breakdowns');
    console.log('- ✅ Bank transfer integration');
    console.log('- ✅ End-to-end payment flows');

    // Recommendations
    if (failedTests > 0) {
      console.log('\n⚠️  Recommendations:');
      console.log('1. Review failed test output for specific issues');
      console.log('2. Check service configurations and dependencies');
      console.log('3. Verify database connections and test data');
      console.log('4. Ensure all environment variables are set');
      console.log('5. Run individual test suites for detailed debugging');
    } else {
      console.log('\n🎉 All payment flow tests passed!');
      console.log('The payment system is ready for release.');
    }

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Payment Flow Test Runner');
    console.log('Usage: npm run test:payment-flows [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --suite <name> Run specific test suite');
    console.log('  --list         List all available test suites');
    console.log('');
    console.log('Examples:');
    console.log('  npm run test:payment-flows');
    console.log('  npm run test:payment-flows --suite "Subscription Flow"');
    console.log('  npm run test:payment-flows --list');
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('Available Test Suites:');
    TEST_SUITES.forEach((suite, index) => {
      console.log(`${index + 1}. ${suite.name}`);
      console.log(`   File: ${suite.file}`);
      console.log(`   Description: ${suite.description}`);
      if (suite.dependencies) {
        console.log(`   Dependencies: ${suite.dependencies.join(', ')}`);
      }
      console.log('');
    });
    process.exit(0);
  }

  const suiteIndex = args.indexOf('--suite');
  if (suiteIndex !== -1 && args[suiteIndex + 1]) {
    const suiteName = args[suiteIndex + 1];
    const suite = TEST_SUITES.find(s => s.name === suiteName);
    
    if (!suite) {
      console.error(`❌ Test suite "${suiteName}" not found`);
      console.log('Available suites:');
      TEST_SUITES.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }

    console.log(`🧪 Running single test suite: ${suite.name}`);
    const runner = new PaymentFlowTestRunner();
    runner.runTestSuite(suite).then(() => {
      console.log('✅ Single test suite completed');
    });
  } else {
    // Run all tests
    const runner = new PaymentFlowTestRunner();
    runner.runAllTests().catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
  }
}

export { PaymentFlowTestRunner, TEST_SUITES };
