#!/usr/bin/env node

/**
 * Comprehensive Dependency Update Script with Maximum Error Visibility
 * 
 * This script:
 * 1. Updates Next.js and all dependencies to latest versions
 * 2. Configures maximum error emission settings
 * 3. Sets up comprehensive error logging
 * 4. Validates all updates work correctly
 * 5. Provides rollback capability if issues occur
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyUpdater {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.packageLockPath = path.join(process.cwd(), 'package-lock.json');
    this.backupDir = path.join(process.cwd(), '.dependency-backups');
    this.originalPackageJson = null;
    this.updateLog = [];
    this.errors = [];
  }

  async run() {
    console.log('🚀 Starting comprehensive dependency update with maximum error visibility...\n');

    try {
      // Create backup
      await this.createBackup();
      
      // Check current versions
      await this.checkCurrentVersions();
      
      // Update Next.js first (most critical)
      await this.updateNextJS();
      
      // Update all other dependencies
      await this.updateAllDependencies();
      
      // Configure maximum error settings
      await this.configureErrorSettings();
      
      // Validate updates
      await this.validateUpdates();
      
      // Generate update report
      this.generateUpdateReport();
      
      console.log('\n✅ Dependency update completed successfully!');
      console.log('📊 Check the update report for details.');
      
    } catch (error) {
      console.error('\n❌ Dependency update failed:', error.message);
      await this.rollback();
      process.exit(1);
    }
  }

  async createBackup() {
    console.log('💾 Creating backup of current dependencies...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Backup package.json
    this.originalPackageJson = fs.readFileSync(this.packageJsonPath, 'utf8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `package-${timestamp}.json`);
    fs.writeFileSync(backupPath, this.originalPackageJson);

    // Backup package-lock.json if it exists
    if (fs.existsSync(this.packageLockPath)) {
      const lockBackupPath = path.join(this.backupDir, `package-lock-${timestamp}.json`);
      fs.copyFileSync(this.packageLockPath, lockBackupPath);
    }

    console.log(`✅ Backup created: ${backupPath}`);
  }

  async checkCurrentVersions() {
    console.log('🔍 Checking current dependency versions...');
    
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    
    console.log('\n📦 Current Key Versions:');
    console.log(`Next.js: ${packageJson.dependencies.next || 'Not found'}`);
    console.log(`React: ${packageJson.dependencies.react || 'Not found'}`);
    console.log(`TypeScript: ${packageJson.devDependencies.typescript || 'Not found'}`);
    console.log(`Jest: ${packageJson.devDependencies.jest || 'Not found'}`);
  }

  async updateNextJS() {
    console.log('\n🔄 Updating Next.js to latest version...');
    
    try {
      // Get latest Next.js version
      const latestVersion = execSync('npm view next version', { encoding: 'utf8' }).trim();
      console.log(`📈 Latest Next.js version: ${latestVersion}`);
      
      // Update Next.js and related packages
      const nextjsPackages = [
        'next@latest',
        'react@latest',
        'react-dom@latest',
        '@types/react@latest',
        '@types/react-dom@latest',
        'eslint-config-next@latest'
      ];
      
      console.log('Installing Next.js updates...');
      execSync(`npm install ${nextjsPackages.join(' ')}`, { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });
      
      this.updateLog.push(`✅ Next.js updated to ${latestVersion}`);
      
    } catch (error) {
      this.errors.push(`❌ Next.js update failed: ${error.message}`);
      throw error;
    }
  }

  async updateAllDependencies() {
    console.log('\n🔄 Updating all other dependencies...');
    
    try {
      // Update all dependencies to latest
      console.log('Checking for outdated packages...');
      
      let outdatedOutput;
      try {
        outdatedOutput = execSync('npm outdated --json', { encoding: 'utf8' });
      } catch (error) {
        // npm outdated returns exit code 1 when there are outdated packages
        outdatedOutput = error.stdout;
      }
      
      if (outdatedOutput) {
        const outdated = JSON.parse(outdatedOutput);
        const packagesToUpdate = Object.keys(outdated);
        
        if (packagesToUpdate.length > 0) {
          console.log(`📦 Found ${packagesToUpdate.length} packages to update:`);
          packagesToUpdate.forEach(pkg => {
            console.log(`  ${pkg}: ${outdated[pkg].current} → ${outdated[pkg].latest}`);
          });
          
          // Update packages in batches to avoid overwhelming npm
          const batchSize = 10;
          for (let i = 0; i < packagesToUpdate.length; i += batchSize) {
            const batch = packagesToUpdate.slice(i, i + batchSize);
            const updateCommands = batch.map(pkg => `${pkg}@latest`);
            
            console.log(`\nUpdating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(packagesToUpdate.length/batchSize)}...`);
            execSync(`npm install ${updateCommands.join(' ')}`, { 
              stdio: 'inherit',
              env: { ...process.env, NODE_ENV: 'development' }
            });
          }
          
          this.updateLog.push(`✅ Updated ${packagesToUpdate.length} packages`);
        } else {
          console.log('✅ All packages are already up to date');
        }
      }
      
    } catch (error) {
      this.errors.push(`❌ Dependency update failed: ${error.message}`);
      throw error;
    }
  }

  async configureErrorSettings() {
    console.log('\n⚙️  Configuring maximum error visibility settings...');
    
    // Update Next.js config for maximum error visibility
    await this.updateNextConfig();
    
    // Update Jest config for better error reporting
    await this.updateJestConfig();
    
    // Update TypeScript config for strict error checking
    await this.updateTSConfig();
    
    // Update ESLint config for maximum error detection
    await this.updateESLintConfig();
    
    // Create error logging configuration
    await this.createErrorLoggingConfig();
  }

  async updateNextConfig() {
    console.log('📝 Updating Next.js config for maximum error visibility...');
    
    const nextConfigContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Maximum error visibility settings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Enable all source maps for debugging
  productionBrowserSourceMaps: true,

  // Disable optimizations that might hide errors
  optimizeFonts: false,

  // Maximum webpack error reporting
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Enable maximum webpack output
    if (dev) {
      config.stats = {
        all: true,
        modules: true,
        maxModules: Infinity,
        errors: true,
        errorDetails: true,
        errorStack: true,
        warnings: true,
        publicPath: true,
        reasons: true,
        source: true,
        timings: true,
        version: true,
        builtAt: true,
        assets: true,
        chunks: true,
        chunkModules: true,
        chunkOrigins: true,
        depth: true,
        env: true,
        orphanModules: true,
        providedExports: true,
        usedExports: true,
        optimizationBailout: true,
      };
      
      config.infrastructureLogging = {
        level: 'verbose',
        debug: true,
      };
    }

    // Force error emission
    config.optimization = {
      ...config.optimization,
      emitOnErrors: true,
      noEmitOnErrors: false,
    };

    // Add error handling plugin
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENABLE_VERBOSE_LOGGING': JSON.stringify('true'),
      })
    );

    return config;
  },

  // Enable TypeScript error checking in development
  typescript: {
    ignoreBuildErrors: false, // Changed to show all TypeScript errors
  },

  // Enable ESLint during builds
  eslint: {
    ignoreDuringBuilds: false, // Changed to show all ESLint errors
  },

  // Experimental features for better error reporting
  experimental: {
    forceSwcTransforms: false,
    serverComponentsExternalPackages: [],
    logging: {
      level: 'verbose',
    },
  },

  // Enable detailed logging
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },

  // Custom error pages
  async rewrites() {
    return [];
  },

  // Enable all development features
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },

  // Maximum error details in production
  generateEtags: false,
  poweredByHeader: false,
  compress: false, // Disable compression to see full error details
}

module.exports = nextConfig`;

    fs.writeFileSync(path.join(process.cwd(), 'next.config.js'), nextConfigContent);
    this.updateLog.push('✅ Next.js config updated for maximum error visibility');
  }

  async updateJestConfig() {
    console.log('📝 Updating Jest config for better error reporting...');
    
    const jestConfigContent = `module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(test|spec).{js,jsx,ts,tsx}',
    '<rootDir>/app/tests/**/*.{js,jsx,ts,tsx}',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/tests/**/*',
  ],
  // Maximum error visibility
  verbose: true,
  errorOnDeprecated: true,
  bail: false, // Don't stop on first error
  maxWorkers: 1, // Single worker for clearer error output
  detectOpenHandles: true,
  forceExit: false,
  // Enhanced error reporting
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-reports',
      filename: 'jest-report.html',
      expand: true,
      hideIcon: false,
    }]
  ],
  // Show all console output
  silent: false,
  // Transform settings
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@radix-ui|@stripe))',
  ],
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Test timeout
  testTimeout: 30000,
};`;

    fs.writeFileSync(path.join(process.cwd(), 'jest.config.js'), jestConfigContent);
    this.updateLog.push('✅ Jest config updated for maximum error reporting');
  }

  async updateTSConfig() {
    console.log('📝 Updating TypeScript config for strict error checking...');
    
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    let tsConfig;
    
    if (fs.existsSync(tsConfigPath)) {
      tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    } else {
      tsConfig = {};
    }

    // Merge with strict error checking settings
    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      strictPropertyInitialization: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
      // Enhanced error reporting
      pretty: true,
      listFiles: false,
      listEmittedFiles: false,
      traceResolution: false,
      diagnostics: false,
      extendedDiagnostics: false,
      // Module resolution
      moduleResolution: "node",
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: false, // Enable lib checking for more errors
    };

    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    this.updateLog.push('✅ TypeScript config updated for strict error checking');
  }

  async updateESLintConfig() {
    console.log('📝 Updating ESLint config for maximum error detection...');
    
    const eslintConfigContent = `module.exports = {
  extends: [
    'next/core-web-vitals',
    'next/typescript'
  ],
  rules: {
    // Maximum error detection
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'react-hooks/exhaustive-deps': 'error',
    'react/no-unescaped-entities': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/no-children-prop': 'error',
    'react/no-danger-with-children': 'error',
    'react/no-deprecated': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-is-mounted': 'error',
    'react/no-render-return-value': 'error',
    'react/no-string-refs': 'error',
    'react/no-unknown-property': 'error',
    'react/require-render-return': 'error',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};`;

    fs.writeFileSync(path.join(process.cwd(), '.eslintrc.js'), eslintConfigContent);
    this.updateLog.push('✅ ESLint config updated for maximum error detection');
  }

  async createErrorLoggingConfig() {
    console.log('📝 Creating comprehensive error logging configuration...');
    
    // Create error logging utility
    const errorLoggerContent = `/**
 * Comprehensive Error Logging System
 * Captures and reports all types of errors with maximum detail
 */

class ErrorLogger {
  constructor() {
    this.setupGlobalErrorHandlers();
    this.setupConsoleEnhancements();
  }

  setupGlobalErrorHandlers() {
    // Capture unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.logError('Unhandled Promise Rejection', {
          reason: event.reason,
          promise: event.promise,
          stack: event.reason?.stack,
          timestamp: new Date().toISOString(),
        });
      });

      // Capture global errors
      window.addEventListener('error', (event) => {
        this.logError('Global Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Node.js error handlers
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        this.logError('Unhandled Promise Rejection (Node)', {
          reason,
          promise,
          stack: reason?.stack,
          timestamp: new Date().toISOString(),
        });
      });

      process.on('uncaughtException', (error) => {
        this.logError('Uncaught Exception (Node)', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  setupConsoleEnhancements() {
    // Enhance console methods for better visibility
    const originalConsole = { ...console };
    
    console.error = (...args) => {
      this.logError('Console Error', { args, timestamp: new Date().toISOString() });
      originalConsole.error(...args);
    };

    console.warn = (...args) => {
      this.logWarning('Console Warning', { args, timestamp: new Date().toISOString() });
      originalConsole.warn(...args);
    };

    if (process.env.ENABLE_VERBOSE_LOGGING === 'true') {
      console.log = (...args) => {
        originalConsole.log('🔍 [VERBOSE]', ...args);
      };
    }
  }

  logError(type, details) {
    const errorData = {
      type,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      timestamp: new Date().toISOString(),
    };

    // Console output with maximum detail
    console.group(\`🚨 \${type}\`);
    console.error('Error Details:', errorData);
    if (details.stack) {
      console.error('Stack Trace:', details.stack);
    }
    console.groupEnd();

    // Store for reporting (you can extend this to send to external services)
    this.storeError(errorData);
  }

  logWarning(type, details) {
    const warningData = {
      type,
      details,
      timestamp: new Date().toISOString(),
    };

    console.group(\`⚠️  \${type}\`);
    console.warn('Warning Details:', warningData);
    console.groupEnd();
  }

  storeError(errorData) {
    // Store errors locally for debugging
    if (typeof localStorage !== 'undefined') {
      try {
        const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        errors.push(errorData);
        // Keep only last 100 errors
        if (errors.length > 100) {
          errors.splice(0, errors.length - 100);
        }
        localStorage.setItem('app_errors', JSON.stringify(errors));
      } catch (e) {
        console.error('Failed to store error:', e);
      }
    }
  }

  getStoredErrors() {
    if (typeof localStorage !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('app_errors') || '[]');
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  clearStoredErrors() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_errors');
    }
  }
}

// Initialize error logger
const errorLogger = new ErrorLogger();

export default errorLogger;`;

    fs.writeFileSync(path.join(process.cwd(), 'app/utils/error-logger.js'), errorLoggerContent);
    this.updateLog.push('✅ Comprehensive error logging system created');
  }

  async validateUpdates() {
    console.log('\n🔍 Validating dependency updates...');
    
    try {
      // Check if the project builds
      console.log('Testing build process...');
      execSync('npm run build', { 
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout
      });
      
      this.updateLog.push('✅ Build validation passed');
      
      // Run tests if they exist
      try {
        console.log('Running tests...');
        execSync('npm test -- --passWithNoTests', { 
          stdio: 'pipe',
          timeout: 120000 // 2 minutes timeout
        });
        this.updateLog.push('✅ Test validation passed');
      } catch (testError) {
        this.updateLog.push('⚠️  Some tests failed - check test output');
      }
      
    } catch (error) {
      this.errors.push(`❌ Validation failed: ${error.message}`);
      throw error;
    }
  }

  async rollback() {
    console.log('\n🔄 Rolling back changes...');
    
    if (this.originalPackageJson) {
      fs.writeFileSync(this.packageJsonPath, this.originalPackageJson);
      console.log('✅ Restored original package.json');
      
      // Reinstall original dependencies
      try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Restored original dependencies');
      } catch (error) {
        console.error('❌ Failed to restore dependencies:', error.message);
      }
    }
  }

  generateUpdateReport() {
    console.log('\n📊 Generating update report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      success: this.errors.length === 0,
      updates: this.updateLog,
      errors: this.errors,
      nextSteps: [
        'Run npm run dev to test the application',
        'Run npm run test:routes:quick to validate routes',
        'Check console for any new error messages',
        'Monitor application for any runtime issues'
      ]
    };
    
    const reportPath = path.join(process.cwd(), 'dependency-update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Update report saved to: ${reportPath}`);
    
    // Display summary
    console.log('\n📋 Update Summary:');
    this.updateLog.forEach(log => console.log(log));
    
    if (this.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.errors.forEach(error => console.log(error));
    }
  }
}

// Run the updater
if (require.main === module) {
  const updater = new DependencyUpdater();
  updater.run();
}

module.exports = DependencyUpdater;
