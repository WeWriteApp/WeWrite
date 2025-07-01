#!/usr/bin/env node

/**
 * Route Testing Script
 * 
 * Runs comprehensive route validation tests and provides detailed reporting.
 * This script can be run independently or as part of CI/CD pipeline.
 * 
 * Usage:
 *   node app/scripts/run-route-tests.js [options]
 * 
 * Options:
 *   --quick     Run only essential tests (faster)
 *   --full      Run all tests including security and performance
 *   --api-only  Test only API routes
 *   --pages-only Test only page routes
 *   --report    Generate detailed HTML report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RouteTestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      warnings: [],
      performance: {}
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    return {
      quick: args.includes('--quick'),
      full: args.includes('--full'),
      apiOnly: args.includes('--api-only'),
      pagesOnly: args.includes('--pages-only'),
      report: args.includes('--report'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };
  }

  async run() {
    console.log('🚀 Starting Route Validation Tests...\n');
    
    try {
      // Pre-flight checks
      await this.preflightChecks();
      
      // Run tests based on options
      if (this.options.quick) {
        await this.runQuickTests();
      } else if (this.options.full) {
        await this.runFullTests();
      } else if (this.options.apiOnly) {
        await this.runApiTests();
      } else if (this.options.pagesOnly) {
        await this.runPageTests();
      } else {
        await this.runStandardTests();
      }
      
      // Generate report
      this.generateReport();
      
      // Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('🔍 Running pre-flight checks...');
    
    // Check if Jest is available
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      console.log('✅ Jest is available');
    } catch (error) {
      throw new Error('Jest is not installed or not available');
    }
    
    // Check if test file exists
    const testFile = path.join(process.cwd(), 'app/tests/route-validation.test.js');
    if (!fs.existsSync(testFile)) {
      throw new Error('Route validation test file not found');
    }
    console.log('✅ Test files found');
    
    // Check if app directory structure is correct
    const appDir = path.join(process.cwd(), 'app');
    if (!fs.existsSync(appDir)) {
      throw new Error('App directory not found');
    }
    console.log('✅ App structure validated');
    
    console.log('');
  }

  async runQuickTests() {
    console.log('⚡ Running quick route validation tests...\n');
    
    const testCommand = `npx jest app/tests/route-validation.test.js --testNamePattern="should discover|should validate static" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Quick tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runStandardTests() {
    console.log('🧪 Running standard route validation tests...\n');
    
    const testCommand = `npx jest app/tests/route-validation.test.js --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Standard tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runFullTests() {
    console.log('🔬 Running comprehensive route validation tests...\n');
    
    const testCommands = [
      'npx jest app/tests/route-validation.test.js --verbose',
      'npx jest app/tests/search-integration.test.js --verbose'
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
    
    console.log('✅ Full test suite completed');
  }

  async runApiTests() {
    console.log('🌐 Running API route tests only...\n');
    
    const testCommand = `npx jest app/tests/route-validation.test.js --testNamePattern="API Route" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ API tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  async runPageTests() {
    console.log('📄 Running page route tests only...\n');
    
    const testCommand = `npx jest app/tests/route-validation.test.js --testNamePattern="Page Route" --verbose`;
    
    try {
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      this.parseJestOutput(output);
      console.log('✅ Page tests completed');
      
    } catch (error) {
      this.handleTestError(error);
    }
  }

  parseJestOutput(output) {
    // Parse Jest output to extract test results
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
    }
  }

  handleTestError(error) {
    console.error('❌ Test execution failed');
    
    if (error.stdout) {
      this.parseJestOutput(error.stdout.toString());
    }
    
    if (error.stderr) {
      this.results.errors.push(error.stderr.toString());
    }
    
    this.results.failed++;
  }

  generateReport() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ${this.results.failed > 0 ? '❌' : '✅'}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors Found:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }
    
    // Success rate
    const successRate = this.results.total > 0 ? 
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    
    console.log(`\nSuccess Rate: ${successRate}%`);
    
    if (this.options.report) {
      this.generateHtmlReport();
    }
    
    console.log('\n' + (this.results.failed === 0 ? 
      '🎉 All route tests passed!' : 
      '⚠️  Some tests failed. Please review the errors above.'));
  }

  generateHtmlReport() {
    // Generate HTML report (implementation would go here)
    console.log('📄 HTML report generation not implemented yet');
  }
}

// Run the test runner
if (require.main === module) {
  const runner = new RouteTestRunner();
  runner.run();
}

module.exports = RouteTestRunner;
