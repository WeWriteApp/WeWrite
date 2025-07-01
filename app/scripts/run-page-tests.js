#!/usr/bin/env node

/**
 * Page Route Testing Script
 * 
 * Runs comprehensive page route tests with detailed reporting.
 * Focuses specifically on page functionality, authentication, and user experience.
 * 
 * Usage:
 *   node app/scripts/run-page-tests.js [options]
 * 
 * Options:
 *   --public      Test only public pages
 *   --auth        Test only authenticated pages  
 *   --admin       Test only admin pages
 *   --dynamic     Test only dynamic routes
 *   --redirects   Test only redirect behavior
 *   --loading     Test loading states and hydration
 *   --seo         Test SEO and metadata
 *   --a11y        Test accessibility features
 *   --live        Run against live server
 *   --report      Generate detailed test report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PageTestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      authIssues: [],
      seoIssues: [],
      accessibilityIssues: []
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    return {
      public: args.includes('--public'),
      auth: args.includes('--auth'),
      admin: args.includes('--admin'),
      dynamic: args.includes('--dynamic'),
      redirects: args.includes('--redirects'),
      loading: args.includes('--loading'),
      seo: args.includes('--seo'),
      a11y: args.includes('--a11y'),
      live: args.includes('--live'),
      report: args.includes('--report'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };
  }

  async run() {
    console.log('📄 Starting Page Route Tests...\n');
    
    try {
      // Pre-flight checks
      await this.preflightChecks();
      
      // Run tests based on options
      if (this.options.public) {
        await this.runPublicPageTests();
      } else if (this.options.auth) {
        await this.runAuthenticatedPageTests();
      } else if (this.options.admin) {
        await this.runAdminPageTests();
      } else if (this.options.dynamic) {
        await this.runDynamicRouteTests();
      } else if (this.options.redirects) {
        await this.runRedirectTests();
      } else if (this.options.loading) {
        await this.runLoadingStateTests();
      } else if (this.options.seo) {
        await this.runSEOTests();
      } else if (this.options.a11y) {
        await this.runAccessibilityTests();
      } else if (this.options.live) {
        await this.runLivePageTests();
      } else {
        await this.runAllPageTests();
      }
      
      // Generate report
      this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Page test runner failed:', error.message);
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('🔍 Running page test pre-flight checks...');
    
    // Check if Jest is available
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      console.log('✅ Jest is available');
    } catch (error) {
      throw new Error('Jest is not installed or not available');
    }
    
    // Check if page test file exists
    const testFile = path.join(process.cwd(), 'app/tests/page-route-testing.test.js');
    if (!fs.existsSync(testFile)) {
      throw new Error('Page route test file not found');
    }
    console.log('✅ Page test files found');
    
    // Check if React Testing Library is available
    try {
      require('@testing-library/react');
      console.log('✅ React Testing Library available');
    } catch (error) {
      console.log('⚠️  React Testing Library not found - some tests may be skipped');
    }
    
    console.log('');
  }

  async runPublicPageTests() {
    console.log('🌐 Running public page tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Public Page" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Public page tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAuthenticatedPageTests() {
    console.log('🔐 Running authenticated page tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Authenticated Page" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Authenticated page tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAdminPageTests() {
    console.log('👑 Running admin page tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Admin Page" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Admin page tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runDynamicRouteTests() {
    console.log('🔀 Running dynamic route tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Dynamic Page" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Dynamic route tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runRedirectTests() {
    console.log('↩️  Running redirect behavior tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Redirect" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Redirect tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runLoadingStateTests() {
    console.log('⏳ Running loading state tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Loading" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Loading state tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runSEOTests() {
    console.log('🔍 Running SEO and metadata tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="SEO" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ SEO tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAccessibilityTests() {
    console.log('♿ Running accessibility tests...\n');
    
    const testCommand = `npx jest app/tests/page-route-testing.test.js --testNamePattern="Accessibility|Performance" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Accessibility tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runLivePageTests() {
    console.log('🚀 Running live page tests...\n');
    
    const testCommand = `npx jest app/tests/integration/live-route-testing.test.js --testNamePattern="Page" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, TEST_BASE_URL: 'http://localhost:3000' }
      });
      
      this.parseJestOutput(output);
      console.log('✅ Live page tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runAllPageTests() {
    console.log('🧪 Running comprehensive page test suite...\n');
    
    const testCommands = [
      'npx jest app/tests/page-route-testing.test.js --verbose',
      'npx jest app/tests/route-validation.test.js --testNamePattern="Page Route" --verbose'
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
    
    console.log('✅ Comprehensive page test suite completed');
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
      
      if (line.includes('auth') && line.includes('FAIL')) {
        this.results.authIssues.push(line.trim());
      }
      
      if (line.includes('seo') && line.includes('FAIL')) {
        this.results.seoIssues.push(line.trim());
      }
      
      if (line.includes('accessibility') && line.includes('FAIL')) {
        this.results.accessibilityIssues.push(line.trim());
      }
    }
  }

  handleTestError(error) {
    console.error('❌ Page test execution failed');
    
    if (error.stdout) {
      this.parseJestOutput(error.stdout.toString());
    }
    
    if (error.stderr) {
      this.results.errors.push(error.stderr.toString());
    }
    
    this.results.failed++;
  }

  generateReport() {
    console.log('\n📊 Page Test Results Summary:');
    console.log('=============================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ${this.results.failed > 0 ? '❌' : '✅'}`);
    
    if (this.results.authIssues.length > 0) {
      console.log(`\n🔐 Authentication Issues: ${this.results.authIssues.length}`);
      this.results.authIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (this.results.seoIssues.length > 0) {
      console.log(`\n🔍 SEO Issues: ${this.results.seoIssues.length}`);
      this.results.seoIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (this.results.accessibilityIssues.length > 0) {
      console.log(`\n♿ Accessibility Issues: ${this.results.accessibilityIssues.length}`);
      this.results.accessibilityIssues.forEach((issue, index) => {
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
    
    console.log(`\nPage Success Rate: ${successRate}%`);
    
    if (this.options.report) {
      this.generateDetailedReport();
    }
    
    console.log('\n' + (this.results.failed === 0 ? 
      '🎉 All page tests passed!' : 
      '⚠️  Some page tests failed. Please review the errors above.'));
  }

  generateDetailedReport() {
    const reportPath = path.join(process.cwd(), 'test-reports', 'page-test-report.json');
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

// Run the page test runner
if (require.main === module) {
  const runner = new PageTestRunner();
  runner.run();
}

module.exports = PageTestRunner;
