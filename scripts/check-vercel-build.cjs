#!/usr/bin/env node

/**
 * Comprehensive Vercel Build Error Checker
 * Simulates Vercel build environment and captures all errors
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VercelBuildChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.buildLog = [];
  }

  async checkBuild() {
    console.log('🔍 Checking Vercel build compatibility...\n');

    try {
      await this.checkEnvironment();
      await this.checkDependencies();
      await this.runTypeCheck();
      await this.runLintCheck();
      await this.runBuildCheck();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Build check failed:', error.message);
      process.exit(1);
    }
  }

  async checkEnvironment() {
    console.log('🌍 Checking environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`   Node.js: ${nodeVersion}`);
    
    // Check npm version
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      console.log(`   npm: ${npmVersion}`);
    } catch (error) {
      this.errors.push('npm not found');
    }

    // Check Next.js version
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next;
      console.log(`   Next.js: ${nextVersion}`);
    } catch (error) {
      this.errors.push('Could not read package.json');
    }

    console.log('   ✅ Environment check completed\n');
  }

  async checkDependencies() {
    console.log('📦 Checking dependencies...');
    
    try {
      // Check if node_modules exists
      if (!fs.existsSync('node_modules')) {
        console.log('   Installing dependencies...');
        execSync('npm ci', { stdio: 'inherit' });
      }
      
      console.log('   ✅ Dependencies check completed\n');
    } catch (error) {
      this.errors.push(`Dependency installation failed: ${error.message}`);
    }
  }

  async runTypeCheck() {
    console.log('🔍 Running TypeScript check...');
    
    try {
      const result = execSync('npx tsc --noEmit --skipLibCheck', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log('   ✅ TypeScript check passed\n');
    } catch (error) {
      console.log('   ❌ TypeScript errors found:');
      const errorOutput = error.stdout || error.stderr || error.message;
      console.log(errorOutput);
      this.errors.push('TypeScript compilation errors');
      this.buildLog.push('=== TypeScript Errors ===');
      this.buildLog.push(errorOutput);
    }
  }

  async runLintCheck() {
    console.log('🔍 Running ESLint check...');
    
    try {
      const result = execSync('npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log('   ✅ ESLint check passed\n');
    } catch (error) {
      console.log('   ⚠️  ESLint warnings/errors found:');
      const errorOutput = error.stdout || error.stderr || error.message;
      console.log(errorOutput.substring(0, 1000) + (errorOutput.length > 1000 ? '...' : ''));
      this.warnings.push('ESLint warnings found');
      this.buildLog.push('=== ESLint Issues ===');
      this.buildLog.push(errorOutput);
    }
  }

  async runBuildCheck() {
    console.log('🏗️  Running Next.js build...');
    
    return new Promise((resolve) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          SKIP_TYPE_CHECK: '1', // Match Vercel config
          NODE_OPTIONS: '--max_old_space_size=4096'
        }
      });

      let stdout = '';
      let stderr = '';

      buildProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      buildProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      buildProcess.on('close', (code) => {
        this.buildLog.push('=== Build Output ===');
        this.buildLog.push(stdout);
        if (stderr) {
          this.buildLog.push('=== Build Errors ===');
          this.buildLog.push(stderr);
        }

        if (code === 0) {
          console.log('\n   ✅ Build completed successfully\n');
        } else {
          console.log(`\n   ❌ Build failed with exit code ${code}\n`);
          this.errors.push(`Build failed with exit code ${code}`);
        }
        resolve();
      });
    });
  }

  async generateReport() {
    console.log('📊 BUILD REPORT');
    console.log('='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }
    
    console.log('\n📈 SUMMARY:');
    console.log(`   Errors: ${this.errors.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    
    if (this.errors.length === 0) {
      console.log('\n✅ Build should work on Vercel!');
    } else {
      console.log('\n❌ Build will likely fail on Vercel');
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   • Fix TypeScript errors first');
      console.log('   • Address ESLint issues');
      console.log('   • Check Next.js configuration');
    }
    
    // Save detailed log
    const logPath = path.join(process.cwd(), 'vercel-build-check.log');
    fs.writeFileSync(logPath, this.buildLog.join('\n\n'));
    console.log(`\n📄 Detailed log saved: ${logPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new VercelBuildChecker();
  checker.checkBuild().catch(error => {
    console.error('❌ Build check failed:', error);
    process.exit(1);
  });
}

module.exports = VercelBuildChecker;
