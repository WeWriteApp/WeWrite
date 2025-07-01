#!/usr/bin/env node

/**
 * Integration Testing Script
 * 
 * Runs comprehensive integration tests that validate complete user flows
 * with realistic data and scenarios.
 * 
 * Usage:
 *   node app/scripts/run-integration-tests.js [options]
 * 
 * Options:
 *   --auth        Test authentication flows
 *   --pages       Test page management flows
 *   --search      Test search and discovery flows
 *   --payments    Test payment and subscription flows
 *   --admin       Test admin functionality flows
 *   --live        Run against live server
 *   --data        Use real test data
 *   --performance Test performance scenarios
 *   --errors      Test error handling scenarios
 *   --report      Generate detailed test report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      flowResults: {},
      performanceMetrics: {},
      dataValidationResults: {}
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    return {
      auth: args.includes('--auth'),
      pages: args.includes('--pages'),
      search: args.includes('--search'),
      payments: args.includes('--payments'),
      admin: args.includes('--admin'),
      live: args.includes('--live'),
      data: args.includes('--data'),
      performance: args.includes('--performance'),
      errors: args.includes('--errors'),
      report: args.includes('--report'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };
  }

  async run() {
    console.log('🔄 Starting Integration Tests...\n');
    
    try {
      // Pre-flight checks
      await this.preflightChecks();
      
      // Run tests based on options
      if (this.options.auth) {
        await this.runAuthenticationFlowTests();
      } else if (this.options.pages) {
        await this.runPageManagementFlowTests();
      } else if (this.options.search) {
        await this.runSearchFlowTests();
      } else if (this.options.payments) {
        await this.runPaymentFlowTests();
      } else if (this.options.admin) {
        await this.runAdminFlowTests();
      } else if (this.options.performance) {
        await this.runPerformanceTests();
      } else if (this.options.errors) {
        await this.runErrorHandlingTests();
      } else if (this.options.live) {
        await this.runLiveIntegrationTests();
      } else {
        await this.runAllIntegrationTests();
      }
      
      // Generate report
      this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Integration test runner failed:', error.message);
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('🔍 Running integration test pre-flight checks...');
    
    // Check if Jest is available
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      console.log('✅ Jest is available');
    } catch (error) {
      throw new Error('Jest is not installed or not available');
    }
    
    // Check if integration test files exist
    const testFiles = [
      'app/tests/integration/user-flow-testing.test.js',
      'app/tests/integration/live-route-testing.test.js'
    ];

    for (const testFile of testFiles) {
      const fullPath = path.join(process.cwd(), testFile);
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  ${testFile} not found - some tests may be skipped`);
      } else {
        console.log(`✅ ${testFile} found`);
      }
    }
    
    // Check if test data is available
    if (this.options.data) {
      console.log('✅ Real test data mode enabled');
    } else {
      console.log('✅ Mock test data mode enabled');
    }
    
    console.log('');
  }

  async runAuthenticationFlowTests() {
    console.log('🔐 Running authentication flow tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Authentication" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.authentication = 'passed';
      console.log('✅ Authentication flow tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.authentication = 'failed';
    }
  }

  async runPageManagementFlowTests() {
    console.log('📄 Running page management flow tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Page Creation|Reply" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.pageManagement = 'passed';
      console.log('✅ Page management flow tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.pageManagement = 'failed';
    }
  }

  async runSearchFlowTests() {
    console.log('🔍 Running search flow tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Search" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.search = 'passed';
      console.log('✅ Search flow tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.search = 'failed';
    }
  }

  async runPaymentFlowTests() {
    console.log('💳 Running payment flow tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Payment|Subscription" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.payments = 'passed';
      console.log('✅ Payment flow tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.payments = 'failed';
    }
  }

  async runAdminFlowTests() {
    console.log('👑 Running admin flow tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Admin" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.admin = 'passed';
      console.log('✅ Admin flow tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.admin = 'failed';
    }
  }

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Performance" --verbose`;
    
    try {
      const startTime = Date.now();
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      const duration = Date.now() - startTime;
      
      this.parseJestOutput(output);
      this.results.performanceMetrics.totalDuration = duration;
      this.results.flowResults.performance = 'passed';
      console.log(`✅ Performance tests completed in ${duration}ms`);
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.performance = 'failed';
    }
  }

  async runErrorHandlingTests() {
    console.log('🚨 Running error handling tests...\n');
    
    const testCommand = `npx jest app/tests/integration/user-flow-testing.test.js --testNamePattern="Error" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.errorHandling = 'passed';
      console.log('✅ Error handling tests completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.errorHandling = 'failed';
    }
  }

  async runLiveIntegrationTests() {
    console.log('🚀 Running live integration tests...\n');
    
    const testCommands = [
      'npx jest app/tests/integration/live-route-testing.test.js --verbose',
      'npx jest app/tests/integration/user-flow-testing.test.js --verbose'
    ];
    
    for (const command of testCommands) {
      try {
        console.log(`Running: ${command}`);
        const output = execSync(command, { 
          encoding: 'utf8',
          stdio: this.options.verbose ? 'inherit' : 'pipe',
          env: { ...process.env, TEST_BASE_URL: 'http://localhost:3000' }
        });
        
        this.parseJestOutput(output);
        
      } catch (error) {
        this.handleTestError(error);
      }
    }
    
    this.results.flowResults.liveIntegration = 'completed';
    console.log('✅ Live integration tests completed');
  }

  async runAllIntegrationTests() {
    console.log('🧪 Running comprehensive integration test suite...\n');
    
    const testCommand = `npx jest app/tests/integration/ --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      this.results.flowResults.comprehensive = 'passed';
      console.log('✅ Comprehensive integration test suite completed');
      
    } catch (error) {
      this.handleTestError(error);
      this.results.flowResults.comprehensive = 'failed';
    }
  }

  parseJestOutput(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) total/);
        if (match) {
          this.results.passed += parseInt(match[1]);
          this.results.total += parseInt(match[2]);
          this.results.failed += parseInt(match[2]) - parseInt(match[1]);
        }
      }
      
      if (line.includes('FAIL') || line.includes('Error:')) {
        this.results.errors.push(line.trim());
      }
      
      if (line.includes('Time:')) {
        const timeMatch = line.match(/Time:\s+(\d+\.?\d*)\s*s/);
        if (timeMatch) {
          this.results.performanceMetrics.testDuration = parseFloat(timeMatch[1]) * 1000;
        }
      }
    }
  }

  handleTestError(error) {
    console.error('❌ Integration test execution failed');
    
    if (error.stdout) {
      this.parseJestOutput(error.stdout.toString());
    }
    
    if (error.stderr) {
      this.results.errors.push(error.stderr.toString());
    }
    
    this.results.failed++;
  }

  generateReport() {
    console.log('\n📊 Integration Test Results Summary:');
    console.log('====================================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ${this.results.failed > 0 ? '❌' : '✅'}`);
    
    // Flow results
    console.log('\n🔄 User Flow Results:');
    Object.entries(this.results.flowResults).forEach(([flow, status]) => {
      const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
      console.log(`${icon} ${flow}: ${status}`);
    });
    
    // Performance metrics
    if (Object.keys(this.results.performanceMetrics).length > 0) {
      console.log('\n⚡ Performance Metrics:');
      Object.entries(this.results.performanceMetrics).forEach(([metric, value]) => {
        console.log(`${metric}: ${value}ms`);
      });
    }
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors Found:');
      this.results.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      
      if (this.results.errors.length > 5) {
        console.log(`... and ${this.results.errors.length - 5} more errors`);
      }
    }
    
    // Success rate
    const successRate = this.results.total > 0 ? 
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    
    console.log(`\nIntegration Success Rate: ${successRate}%`);
    
    if (this.options.report) {
      this.generateDetailedReport();
    }
    
    console.log('\n' + (this.results.failed === 0 ? 
      '🎉 All integration tests passed!' : 
      '⚠️  Some integration tests failed. Please review the errors above.'));
  }

  generateDetailedReport() {
    const reportPath = path.join(process.cwd(), 'test-reports', 'integration-test-report.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      testOptions: this.options,
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the integration test runner
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run();
}

module.exports = IntegrationTestRunner;
