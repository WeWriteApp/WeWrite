#!/usr/bin/env node

/**
 * API Testing Script
 * 
 * Runs comprehensive API endpoint tests with detailed reporting.
 * Focuses specifically on API functionality, authentication, and security.
 * 
 * Usage:
 *   node app/scripts/run-api-tests.js [options]
 * 
 * Options:
 *   --public      Test only public endpoints
 *   --auth        Test only authenticated endpoints  
 *   --admin       Test only admin endpoints
 *   --security    Run security tests only
 *   --performance Run performance tests only
 *   --live        Run against live server (requires server running)
 *   --report      Generate detailed test report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class APITestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      securityIssues: [],
      performanceIssues: []
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    return {
      public: args.includes('--public'),
      auth: args.includes('--auth'),
      admin: args.includes('--admin'),
      security: args.includes('--security'),
      performance: args.includes('--performance'),
      live: args.includes('--live'),
      report: args.includes('--report'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };
  }

  async run() {
    console.log('🔌 Starting API Endpoint Tests...\n');
    
    try {
      // Pre-flight checks
      await this.preflightChecks();
      
      // Run tests based on options
      if (this.options.public) {
        await this.runPublicEndpointTests();
      } else if (this.options.auth) {
        await this.runAuthenticatedEndpointTests();
      } else if (this.options.admin) {
        await this.runAdminEndpointTests();
      } else if (this.options.security) {
        await this.runSecurityTests();
      } else if (this.options.performance) {
        await this.runPerformanceTests();
      } else if (this.options.live) {
        await this.runLiveAPITests();
      } else {
        await this.runAllAPITests();
      }
      
      // Generate report
      this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ API test runner failed:', error.message);
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('🔍 Running API test pre-flight checks...');
    
    // Check if Jest is available
    try {
      execSync('pnpm dlx jest --version', { stdio: 'pipe' });
      console.log('✅ Jest is available');
    } catch (error) {
      throw new Error('Jest is not installed or not available');
    }
    
    // Check if API test file exists
    const testFile = path.join(process.cwd(), 'app/tests/api-endpoint-testing.test.js');
    if (!fs.existsSync(testFile)) {
      throw new Error('API endpoint test file not found');
    }
    console.log('✅ API test files found');
    
    // Check if server is running for live tests
    if (this.options.live) {
      try {
        const fetch = require('node-fetch');
        const response = await fetch('http://localhost:3000/api/random-pages', { timeout: 5000 });
        console.log('✅ Live server detected');
      } catch (error) {
        console.log('⚠️  Live server not detected - using mock tests');
        this.options.live = false;
      }
    }
    
    console.log('');
  }

  async runPublicEndpointTests() {
    console.log('🌐 Running public endpoint tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/api-endpoint-testing.test.js --testNamePattern="Public API" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Public endpoint tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAuthenticatedEndpointTests() {
    console.log('🔐 Running authenticated endpoint tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/api-endpoint-testing.test.js --testNamePattern="Authenticated API" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Authenticated endpoint tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAdminEndpointTests() {
    console.log('👑 Running admin endpoint tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/api-endpoint-testing.test.js --testNamePattern="Admin API" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Admin endpoint tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runSecurityTests() {
    console.log('🛡️  Running security tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/api-endpoint-testing.test.js --testNamePattern="Security" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Security tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/api-endpoint-testing.test.js --testNamePattern="Performance" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Performance tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runLiveAPITests() {
    console.log('🚀 Running live API tests...\n');
    
    const testCommand = `pnpm dlx jest app/tests/integration/live-route-testing.test.js --testNamePattern="API" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, TEST_BASE_URL: 'http://localhost:3000' }
      });
      
      this.parseJestOutput(output);
      console.log('✅ Live API tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAllAPITests() {
    console.log('🧪 Running comprehensive API test suite...\n');
    
    const testCommands = [
      'pnpm dlx jest app/tests/api-endpoint-testing.test.js --verbose',
      'pnpm dlx jest app/tests/route-validation.test.js --testNamePattern="API Route" --verbose'
    ];
    
    for (const command of testCommands) {
      try {
        console.log(`Running: ${command}`);
        const output = execSync(command, { 
          encoding: 'utf8',
          stdio: this.options.verbose ? 'inherit' : 'pipe'
        });
        
        this.parseJestOutput(output);
        
      } catch (error) {
        this.handleTestError(error);
      }
    }
    
    console.log('✅ Comprehensive API test suite completed');
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
      
      if (line.includes('security') && line.includes('FAIL')) {
        this.results.securityIssues.push(line.trim());
      }
      
      if (line.includes('performance') && line.includes('slow')) {
        this.results.performanceIssues.push(line.trim());
      }
    }
  }

  handleTestError(error) {
    console.error('❌ API test execution failed');
    
    if (error.stdout) {
      this.parseJestOutput(error.stdout.toString());
    }
    
    if (error.stderr) {
      this.results.errors.push(error.stderr.toString());
    }
    
    this.results.failed++;
  }

  generateReport() {
    console.log('\n📊 API Test Results Summary:');
    console.log('============================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ${this.results.failed > 0 ? '❌' : '✅'}`);
    
    if (this.results.securityIssues.length > 0) {
      console.log(`\n🛡️  Security Issues: ${this.results.securityIssues.length}`);
      this.results.securityIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (this.results.performanceIssues.length > 0) {
      console.log(`\n⚡ Performance Issues: ${this.results.performanceIssues.length}`);
      this.results.performanceIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
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
    
    console.log(`\nAPI Success Rate: ${successRate}%`);
    
    if (this.options.report) {
      this.generateDetailedReport();
    }
    
    console.log('\n' + (this.results.failed === 0 ? 
      '🎉 All API tests passed!' : 
      '⚠️  Some API tests failed. Please review the errors above.'));
  }

  generateDetailedReport() {
    const reportPath = path.join(process.cwd(), 'test-reports', 'api-test-report.json');
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

// Run the API test runner
if (require.main === module) {
  const runner = new APITestRunner();
  runner.run();
}

module.exports = APITestRunner;
