#!/usr/bin/env node

/**
 * Dependency System Test Suite
 * 
 * Comprehensive testing for the dependency health monitoring system
 * including unit tests, integration tests, and performance benchmarks.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencySystemTester {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    this.verbose = process.argv.includes('--verbose');
  }

  async run() {
    console.log('🧪 Running Dependency System Test Suite...\n');
    
    try {
      // Unit tests
      await this.runUnitTests();
      
      // Integration tests
      await this.runIntegrationTests();
      
      // Performance tests
      await this.runPerformanceTests();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async runUnitTests() {
    console.log('🔬 Running unit tests...');
    
    await this.test('Health Check Module Import', async () => {
      const { default: DependencyHealthChecker } = await import('./dependency-health-check.js');
      return DependencyHealthChecker !== undefined;
    });
    
    await this.test('Import Validator Module Import', async () => {
      const { default: ImportValidator } = await import('./validate-imports.js');
      return ImportValidator !== undefined;
    });
    
    await this.test('Dependency Map Generator Module Import', async () => {
      const { default: DependencyMapGenerator } = await import('./generate-dependency-map.js');
      return DependencyMapGenerator !== undefined;
    });
    
    await this.test('Self-Healing System Module Import', async () => {
      const { default: SelfHealingDependencySystem } = await import('./self-healing-dependencies.js');
      return SelfHealingDependencySystem !== undefined;
    });
    
    await this.test('Package.json Validation', async () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
      return packageJson.scripts['deps:check'] !== undefined &&
             packageJson.scripts['deps:validate'] !== undefined &&
             packageJson.scripts['deps:map'] !== undefined &&
             packageJson.scripts['deps:fix'] !== undefined;
    });
    
    await this.test('TypeScript Config Validation', async () => {
      const tsConfig = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'tsconfig.json'), 'utf8'));
      return tsConfig.compilerOptions &&
             tsConfig.compilerOptions.paths &&
             tsConfig.compilerOptions.paths['@/*'];
    });
  }

  async runIntegrationTests() {
    console.log('🔗 Running integration tests...');
    
    await this.test('Dependency Health Check Execution', async () => {
      try {
        execSync('npm run deps:check', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        return true;
      } catch (error) {
        // Health check may exit with code 1 if issues found, which is expected
        return error.status === 1;
      }
    });
    
    await this.test('Import Validation Execution', async () => {
      try {
        execSync('npm run deps:validate', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        return true;
      } catch (error) {
        return error.status === 1; // May exit with 1 if validation errors found
      }
    });
    
    await this.test('Dependency Map Generation', async () => {
      try {
        execSync('npm run deps:map', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 45000 
        });
        
        // Check if output files were created
        const reportExists = fs.existsSync(path.join(this.projectRoot, 'dependency-report.json'));
        const mermaidExists = fs.existsSync(path.join(this.projectRoot, 'dependency-map.mermaid'));
        
        return reportExists && mermaidExists;
      } catch (error) {
        return false;
      }
    });
    
    await this.test('Dashboard Generation', async () => {
      try {
        execSync('npm run deps:dashboard', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 15000 
        });
        
        return fs.existsSync(path.join(this.projectRoot, 'dependency-dashboard.html'));
      } catch (error) {
        return false;
      }
    });
    
    await this.test('Self-Healing Plan Generation', async () => {
      try {
        execSync('npm run deps:heal:plan', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...');
    
    await this.test('Health Check Performance', async () => {
      const startTime = Date.now();
      
      try {
        execSync('npm run deps:check', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 60000 
        });
      } catch (error) {
        // Expected if issues found
      }
      
      const duration = Date.now() - startTime;
      const passed = duration < 60000; // Should complete within 60 seconds
      
      if (this.verbose) {
        console.log(`     Health check took ${duration}ms`);
      }
      
      return passed;
    });
    
    await this.test('Import Validation Performance', async () => {
      const startTime = Date.now();
      
      try {
        execSync('npm run deps:validate', { 
          cwd: this.projectRoot, 
          stdio: 'pipe',
          timeout: 45000 
        });
      } catch (error) {
        // Expected if validation errors found
      }
      
      const duration = Date.now() - startTime;
      const passed = duration < 45000; // Should complete within 45 seconds
      
      if (this.verbose) {
        console.log(`     Import validation took ${duration}ms`);
      }
      
      return passed;
    });
    
    await this.test('Memory Usage Check', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Import and instantiate all modules
      const { default: DependencyHealthChecker } = await import('./dependency-health-check.js');
      const { default: ImportValidator } = await import('./validate-imports.js');
      const { default: DependencyMapGenerator } = await import('./generate-dependency-map.js');
      
      const checker = new DependencyHealthChecker();
      const validator = new ImportValidator();
      const generator = new DependencyMapGenerator();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      if (this.verbose) {
        console.log(`     Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      }
      
      // Should not use more than 100MB additional memory
      return memoryIncreaseMB < 100;
    });
  }

  async test(name, testFunction) {
    try {
      const startTime = Date.now();
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      if (result) {
        console.log(`   ✅ ${name} (${duration}ms)`);
        this.testResults.passed++;
        this.testResults.tests.push({ name, status: 'passed', duration });
      } else {
        console.log(`   ❌ ${name} (${duration}ms)`);
        this.testResults.failed++;
        this.testResults.tests.push({ name, status: 'failed', duration });
      }
    } catch (error) {
      console.log(`   ❌ ${name} - Error: ${error.message}`);
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'failed', error: error.message });
      
      if (this.verbose) {
        console.log(`      ${error.stack}`);
      }
    }
  }

  generateReport() {
    console.log('\n📊 TEST RESULTS');
    console.log('=' .repeat(50));
    
    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`⏭️  Skipped: ${this.testResults.skipped}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`   • ${test.name}`);
          if (test.error) {
            console.log(`     Error: ${test.error}`);
          }
        });
    }
    
    // Performance summary
    const performanceTests = this.testResults.tests.filter(test => 
      test.name.includes('Performance') || test.name.includes('Memory')
    );
    
    if (performanceTests.length > 0) {
      console.log('\n⚡ PERFORMANCE SUMMARY:');
      performanceTests.forEach(test => {
        if (test.duration) {
          console.log(`   • ${test.name}: ${test.duration}ms`);
        }
      });
    }
    
    // Save detailed report
    const reportPath = path.join(this.projectRoot, 'dependency-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        skipped: this.testResults.skipped,
        successRate: parseFloat(successRate)
      },
      tests: this.testResults.tests
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    
    console.log('\n' + '='.repeat(50));
    
    if (this.testResults.failed === 0) {
      console.log('🎉 All tests passed! Dependency system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix the issues.');
      process.exit(1);
    }
  }
}

// Run the test suite
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DependencySystemTester();
  tester.run().catch(error => {
    console.error('Error running test suite:', error);
    process.exit(1);
  });
}

export default DependencySystemTester;
